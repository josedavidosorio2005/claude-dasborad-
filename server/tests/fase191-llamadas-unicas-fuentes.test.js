// fase191-llamadas-unicas-fuentes.test.js — Fase 191 (Mobilize, pedido del
// 27/10): Llamadas Unicas desde las bases tal cual las baja Wolkvox.
// - Contestadas unicas: del CDR de Tipificacion, filas de ingreso (SKILL_NAME
//   distinto de "-"), un telefono una vez por dia (unicaDia).
// - Abandonadas unicas: reporte "Detalle de llamadas abandonadas", misma regla.
// - Salida conectada: filas "-" del mismo CDR; no conectadas pendientes.
// - Meses sin CDR siguen con la carga vieja; cada mes dice su fuente.
// - El telefono nunca llega al servidor ni a una respuesta.
// Todo con datos SINTETICOS.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
// helpers primero: arma el entorno de prueba antes de cargar el servidor.
const { request, app, tokenFor, MASTER_PASSWORD, db } = require('./helpers');
const T = require('../../public/js/tipificacion-logic.js');
const LU = require('../../public/js/llamadas-unicas-logic.js');
const CL = require('../../public/js/centro-cargas-logic.js');
const { cargasPlanConsolidado } = require('../../public/js/cargas-logic.js');
const { CARGAS_POR_MODULO } = require('../centro-cargas');
const { CAMPOS_FILA } = require('../tipificaciones');
const { CAMPOS_FILA_ABANDONADAS } = require('../llamadas-unicas');
const dbModulo = require('../db');

const auth = (t) => ({ Authorization: `Bearer ${t}` });
const TEL = '3009998877'; // centinela: nunca debe aparecer fuera del navegador
const CDR_HEADER = ['AGENT_NAME', 'DATE', 'TELEPHONE', 'DESCRIPTION_COD_ACT', 'SKILL_NAME', 'TYPE_INTERACTION', 'CONN_ID'];
const cdr = (filas) => [CDR_HEADER, ...filas];
// fila de CDR: [asesor, fecha, telefono, tipificacion, skill, tipo, conn]
const fila = (a, f, tel, sk, tipo, tip, conn) => [a, f, tel, tip || 'AGENDADA', sk, tipo || 'inbound', conn || ('C' + Math.random())];
const ABA_HEADER = ['CONN_ID', 'SKILL_ID', 'SKILL_NAME', 'DATE', 'RESULT', 'ANI', 'ABANDON_TIME', 'TYPE_INTERACTION', 'CUSTOMER_ID'];
const aba = (fecha, ani, opts) => ['X' + Math.random(), 1, (opts && opts.skill) || 'SKILL SAC', fecha, (opts && opts.result) || 'ABANDON', ani, 12, (opts && opts.tipo) || 'inbound', 'CLI'];

// ── CDR: marca de unica por dia ───────────────────────────────────────────

test('CDR: duplicado el mismo dia = 1, mismo telefono en dos dias = 2, filas "-" excluidas', () => {
  const r = T.tipificacionParseFilas(cdr([
    fila('Ana', '2025-03-03', TEL, 'SKILL SAC', 'inbound', 'AGENDADA', 'c1'),
    fila('Ana', '2025-03-03', '300 999 8877', 'SKILL SAC', 'inbound', 'INFO', 'c2'), // mismo numero con espacios, mismo dia
    fila('Beto', '2025-03-03', TEL, 'SKILL VENTAS', 'inbound', 'INFO', 'c3'), // 3a vez el mismo dia, otro skill
    fila('Ana', '2025-03-04', TEL, 'SKILL SAC', 'inbound', 'AGENDADA', 'c4'), // otro dia: cuenta
    fila('Ana', '2025-03-04', '3110000001', 'SKILL SAC', 'inbound', 'INFO', 'c5'), // distinta en algo mas que el telefono (Fase 88 junta las identicas)
    fila('Ana', '2025-03-04', TEL, '-', 'outbound_ma', 'AGENDADA', 'c6'), // salida
    fila('Beto', '2025-03-05', '3110000002', '-', 'inbound', 'INFO', 'c7'), // "-" sin tipo de salida: tampoco es ingreso
  ]), null, 'LLAMADAS', { marcarUnicasDia: true });
  assert.equal(r.error, undefined);
  assert.deepEqual(r.unicasDia, { ingreso: 5, unicas: 3, sinTelefono: 0 });
  assert.deepEqual(r.filas.map((f) => f.unicaDia), [1, 0, 0, 1, 1, 0, 0]);
  const arrays = r.filas.map(T.tipificacionFilaComoArray);
  assert.ok(arrays.every((a) => a.length === CAMPOS_FILA.length));
  assert.ok(!JSON.stringify(arrays).includes(TEL) && !JSON.stringify(arrays).includes('9998877'), 'el telefono no viaja');
  assert.ok(r.filas.every((f) => !('_tel' in f) && !('_skillGuion' in f)), 'el telefono se borra de la fila');
});

test('CDR: sin marcarUnicasDia (ORLANT) o sin TELEPHONE, nada se marca y el resto es igual', () => {
  const filas = [fila('Ana', '2025-03-03', TEL, 'SKILL SAC', 'inbound', 'A', 'c1'), fila('Ana', '2025-03-03', TEL, 'SKILL SAC', 'inbound', 'B', 'c2')];
  const sin = T.tipificacionParseFilas(cdr(filas), null, 'LLAMADAS');
  assert.equal(sin.unicasDia, null);
  assert.ok(sin.filas.every((f) => f.unicaDia === undefined));
  assert.equal(T.tipificacionFilaComoArray(sin.filas[0])[11], undefined);
  const sinTel = T.tipificacionParseFilas([CDR_HEADER.filter((h) => h !== 'TELEPHONE'), ...filas.map((f) => f.filter((_, i) => i !== 2))], null, 'LLAMADAS', { marcarUnicasDia: true });
  assert.equal(sinTel.unicasDia, null);
  assert.ok(sinTel.avisos.some((a) => /no trae TELEPHONE/.test(a)));
  // Con la marca, las mismas 2 filas siguen siendo 2 en Tipificacion (la marca no cambia el conteo).
  const con = T.tipificacionParseFilas(cdr(filas), null, 'LLAMADAS', { marcarUnicasDia: true });
  assert.equal(con.filas.length, sin.filas.length);
});

test('CDR: TELEPHONE sigue sin mapearse en tipificacionColIndexMap (privacidad Fase 131)', () => {
  const map = T.tipificacionColIndexMap(CDR_HEADER);
  assert.ok(!Object.values(map).includes(CDR_HEADER.indexOf('TELEPHONE')));
  assert.deepEqual(T.TIPIFICACION_ORDEN_ARRAY, CAMPOS_FILA);
});

// ── Reporte de abandonadas ────────────────────────────────────────────────

test('abandonadas: columnas obligatorias DATE, ANI y SKILL_NAME; error claro si faltan', () => {
  assert.deepEqual(LU.LLAMADAS_ABANDONADAS_COLUMNAS.filter((c) => c.obligatoria).map((c) => c.label), ['DATE', 'ANI', 'SKILL_NAME']);
  const r = LU.llamadasAbandonadasParseFilas([['CONN_ID', 'DATE', 'SKILL_NAME'], ['x', '2025-03-03', 'SAC']]);
  assert.match(r.error, /Faltan columnas obligatorias: ANI\./);
  assert.equal(r.filas, undefined);
});

test('abandonadas: duplicado mismo dia = 1, dos dias = 2, RESULT/TYPE_INTERACTION filtran, sin telefono en la salida', () => {
  const r = LU.llamadasAbandonadasParseFilas([ABA_HEADER,
    aba('2025-03-03', TEL), aba('2025-03-03', '300-999-8877'), aba('2025-03-04', TEL),
    aba('2025-03-04', '3110000003', { result: 'ANSWER' }), aba('2025-03-04', '3110000004', { tipo: 'outbound_ma' }),
    aba('2025-03-05', '3110000005', { skill: 'SKILL VENTAS' }),
  ]);
  assert.deepEqual(r.filas, [['2025-03-03', 'SKILL SAC'], ['2025-03-04', 'SKILL SAC'], ['2025-03-05', 'SKILL VENTAS']]);
  assert.equal(r.duplicadosQuitados, 1);
  assert.deepEqual(r.columnasUsadas, ['DATE', 'ANI', 'SKILL_NAME', 'RESULT', 'TYPE_INTERACTION']);
  assert.ok(r.avisos.some((a) => /RESULT distinto de ABANDON/.test(a)) && r.avisos.some((a) => /TYPE_INTERACTION distinto de inbound/.test(a)));
  assert.ok(!JSON.stringify(r.filas).includes('9998877'));
  assert.deepEqual(LU.LLAMADAS_ABANDONADAS_ORDEN_ARRAY, CAMPOS_FILA_ABANDONADAS);
});

// ── Migracion, tabla sin telefono, Centro de cargas ───────────────────────

test('migracion: unicaDia en tipificaciones, tabla llamadas_abandonadas sin telefono, idempotente', () => {
  dbModulo.crearLlamadasUnicasFuentes();
  dbModulo.crearLlamadasUnicasFuentes();
  assert.ok(db.prepare('PRAGMA table_info(tipificaciones)').all().some((c) => c.name === 'unicaDia'));
  const cols = db.prepare('PRAGMA table_info(llamadas_abandonadas)').all().map((c) => c.name);
  assert.deepEqual(cols, ['id', 'campana', 'fecha', 'skill', 'archivoNombre', 'cargadoPorNombre', 'createdAt']);
});

test('Centro de cargas: tercera carga del modulo Llamadas Unicas, sin plantilla y sin aviso de mes incompleto', () => {
  const c = CARGAS_POR_MODULO.llamadas_unicas.find((x) => x.id === 'llamadas_abandonadas');
  assert.equal(c.tabla, 'llamadas_abandonadas');
  assert.equal(c.plantilla, null);
  assert.equal(CL.centroModuloDeCarga('llamadas_abandonadas'), 'llamadas_unicas');
  assert.equal(CL.centroEtiquetaCarga(c), 'Abandonadas');
  assert.ok(CL.centroOmiteCobertura('llamadas_abandonadas'));
  assert.equal(CL.centroFechaFila('llamadas_abandonadas', ['2025-03-03', 'SAC']), '2025-03-03');
  assert.match(CL.centroNotaSinPlantilla('llamadas_abandonadas'), /tal cual/);
  const plan = cargasPlanConsolidado({}, null, null, null, null, null, null, null, null, null, undefined, null, null, null, null, null, [{ label: 'DATE' }]);
  assert.ok(plan.some((h) => h.tipo === 'llamadas_abandonadas'));
});

// ── API: fuentes por mes, cifras y privacidad ─────────────────────────────

test('API: contestadas del CDR, abandonadas del reporte, meses sin CDR con la carga vieja, salida conectada del CDR', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  // Carga vieja (plantilla) de enero 2025: 4 contestadas + 2 abandonadas; y salida vieja de enero.
  let res = await request(app).post('/api/calidad/llamadas-unicas/carga').set(auth(admin)).send({ campana: 'MOBILIZE', filas: [
    ['Ana', '2025-01-10', 'CONTESTADA', 'SKILL SAC'], ['Ana', '2025-01-10', 'CONTESTADA', 'SKILL SAC'], ['Ana', '2025-01-11', 'CONTESTADA', 'SKILL SAC'], ['Beto', '2025-01-11', 'CONTESTADA', 'SKILL SAC'],
    ['', '2025-01-12', 'ABANDONADA', 'SKILL SAC'], ['', '2025-01-12', 'ABANDONADA', 'SKILL SAC'],
  ] });
  assert.equal(res.status, 201);
  res = await request(app).post('/api/calidad/llamadas-salida/carga').set(auth(admin)).send({ campana: 'MOBILIZE', filas: [
    ['Ana', '2025-01-10', 'CONECTADA', 'X'], ['Ana', '2025-01-10', 'NO_CONECTADA', 'Y'], ['Ana', '2025-01-11', 'NO_CONECTADA', 'Y'],
  ] });
  assert.equal(res.status, 201);
  // Marzo 2025: CDR con la marca (como lo arma el navegador) y el reporte de abandonadas.
  const lector = T.tipificacionParseFilas(cdr([
    fila('Ana', '2025-03-03', TEL, 'SKILL SAC', 'inbound', 'A', 'c1'),
    fila('Ana', '2025-03-03', TEL, 'SKILL SAC', 'inbound', 'B', 'c2'),
    fila('Beto', '2025-03-03', TEL, 'SKILL SAC', 'inbound', 'C', 'c3'),
    fila('Ana', '2025-03-04', TEL, 'SKILL SAC', 'inbound', 'A', 'c4'),
    fila('Beto', '2025-03-04', '3110000001', 'SKILL VENTAS', 'inbound', 'A', 'c5'),
    fila('Ana', '2025-03-04', TEL, '-', 'outbound_ma', 'A', 'c6'),
    fila('Ana', '2025-03-05', '3110000002', '-', 'outbound_ma', 'Cliente_no_contesta', 'c7'),
    fila('Beto', '2025-03-05', '3110000003', '-', 'outbound_ma', 'A', 'c8'),
  ]), null, 'LLAMADAS', { marcarUnicasDia: true });
  const cuerpoCdr = { campana: 'MOBILIZE', canal: 'LLAMADAS', archivoNombre: 'cdr-sintetico.xlsx', filas: lector.filas.map(T.tipificacionFilaComoArray) };
  assert.ok(!JSON.stringify(cuerpoCdr).includes('9998877'), 'el cuerpo que va al servidor no trae telefono');
  res = await request(app).post('/api/calidad/tipificacion/carga').set(auth(admin)).send(cuerpoCdr);
  assert.equal(res.status, 201);
  const ab = LU.llamadasAbandonadasParseFilas([ABA_HEADER, aba('2025-03-03', TEL), aba('2025-03-03', TEL), aba('2025-03-06', TEL)]);
  res = await request(app).post('/api/calidad/llamadas-abandonadas/carga/impacto').set(auth(admin)).send({ campana: 'MOBILIZE', filas: ab.filas });
  assert.deepEqual([res.status, res.body.filasNuevas, res.body.filasExistentes], [200, 2, 0]);
  res = await request(app).post('/api/calidad/llamadas-abandonadas/carga').set(auth(admin)).send({ campana: 'MOBILIZE', archivoNombre: 'abandonadas.xlsx', filas: ab.filas });
  assert.equal(res.status, 201);
  // Subir el mismo archivo otra vez reemplaza (no duplica).
  res = await request(app).post('/api/calidad/llamadas-abandonadas/carga').set(auth(admin)).send({ campana: 'MOBILIZE', filas: ab.filas });
  assert.deepEqual([res.body.insertadas, res.body.borradas], [2, 2]);

  const porMes = (await request(app).get('/api/calidad/llamadas-unicas/por-mes').query({ campana: 'MOBILIZE', desde: '2025-01-01', hasta: '2025-03-31' }).set(auth(admin))).body;
  assert.deepEqual(porMes, [
    { periodo: '2025-01', contestadas: 4, abandonadas: 2, total: 6, fuenteContestadas: 'PLANTILLA', fuenteAbandonadas: 'PLANTILLA' },
    // CDR: 03/03 un telefono 3 veces = 1; 04/03 el mismo telefono = 1 mas; otro telefono = 1; las "-" no cuentan.
    { periodo: '2025-03', contestadas: 3, abandonadas: 2, total: 5, fuenteContestadas: 'CDR', fuenteAbandonadas: 'ABANDONADAS' },
  ]);
  const resumen = (await request(app).get('/api/calidad/llamadas-unicas/resumen').query({ campana: 'MOBILIZE', desde: '2025-03-01', hasta: '2025-03-31' }).set(auth(admin))).body;
  assert.deepEqual(resumen, { contestadas: 3, abandonadas: 2, total: 5 });
  // Filtro de skill y de asesor sobre el CDR (las abandonadas no traen asesor).
  const ventas = (await request(app).get('/api/calidad/llamadas-unicas/resumen').query({ campana: 'MOBILIZE', desde: '2025-03-01', hasta: '2025-03-31', skill: 'SKILL VENTAS' }).set(auth(admin))).body;
  assert.deepEqual(ventas, { contestadas: 1, abandonadas: 0, total: 1 });
  const beto = (await request(app).get('/api/calidad/llamadas-unicas/resumen').query({ campana: 'MOBILIZE', desde: '2025-03-01', hasta: '2025-03-31', agente: 'Beto' }).set(auth(admin))).body;
  assert.deepEqual(beto, { contestadas: 1, abandonadas: 0, total: 1 });
  const op = (await request(app).get('/api/calidad/llamadas-unicas/opciones').query({ campana: 'MOBILIZE' }).set(auth(admin))).body;
  assert.ok(op.meses.includes('2025-03') && op.skills.includes('SKILL VENTAS') && !op.skills.includes('-') && !op.skills.includes('LLAMADAS DE SALIDA'));

  // Salida: marzo del CDR (3 filas "-", conectadas; no conectadas pendientes); enero sigue con la carga vieja.
  const sal = (await request(app).get('/api/calidad/llamadas-salida/por-mes').query({ campana: 'MOBILIZE', desde: '2025-01-01', hasta: '2025-03-31' }).set(auth(admin))).body;
  assert.deepEqual(sal, [
    { periodo: '2025-01', total: 3, noConectadas: 2, conectadas: 1, fuente: 'PLANTILLA' },
    { periodo: '2025-03', total: null, noConectadas: null, conectadas: 3, fuente: 'CDR' },
  ]);
  const salRes = (await request(app).get('/api/calidad/llamadas-salida/resumen').query({ campana: 'MOBILIZE', desde: '2025-01-01', hasta: '2025-03-31' }).set(auth(admin))).body;
  assert.deepEqual(salRes, { conectadas: 4, noConectadas: null, total: null, noConectadasPendiente: true });
  const salEne = (await request(app).get('/api/calidad/llamadas-salida/resumen').query({ campana: 'MOBILIZE', desde: '2025-01-01', hasta: '2025-01-31' }).set(auth(admin))).body;
  assert.deepEqual(salEne, { conectadas: 1, noConectadas: 2, total: 3, noConectadasPendiente: false });
  const det = (await request(app).get('/api/calidad/llamadas-salida/detalle').query({ campana: 'MOBILIZE', desde: '2025-03-01', hasta: '2025-03-31' }).set(auth(admin))).body;
  assert.deepEqual(det.porAsesor, [{ agente: 'Ana', total: null, noConectadas: null, conectadas: 2 }, { agente: 'Beto', total: null, noConectadas: null, conectadas: 1 }]);

  // Privacidad: ninguna respuesta ni tabla trae el telefono.
  const todo = JSON.stringify([porMes, resumen, op, sal, det]);
  assert.ok(!todo.includes('9998877'));
  const filasGuardadas = JSON.stringify(db.prepare("SELECT * FROM tipificaciones WHERE campana = 'MOBILIZE'").all().concat(db.prepare('SELECT * FROM llamadas_abandonadas').all()));
  assert.ok(!filasGuardadas.includes('9998877'));
});

test('API: la carga de abandonadas pide permiso de carga y acceso a la campaña', async () => {
  const res = await request(app).post('/api/calidad/llamadas-abandonadas/carga').send({ campana: 'MOBILIZE', filas: [['2025-03-03', 'SAC']] });
  assert.equal(res.status, 401);
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const mala = await request(app).post('/api/calidad/llamadas-abandonadas/carga').set(auth(admin)).send({ campana: 'MOBILIZE', filas: [['2025-03-03', 'SAC', TEL]] });
  assert.equal(mala.status, 400, 'una fila con un tercer campo (telefono) se rechaza');
});

test('panel: tabla "De dónde sale cada mes" y "Pendiente" en las no conectadas', () => {
  const s = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'llamadas-unicas.js'), 'utf8');
  assert.ok(s.includes("'<div id=\"lu-fuentes-' + i + '\"></div>'"));
  assert.ok(s.includes("'<div id=\"ls-fuentes-' + i + '\"></div>'"));
  assert.ok(s.includes("return v === null || v === undefined ? 'Pendiente'"));
  assert.equal(LU.llamadasUnicasFuenteMes({ fuenteContestadas: 'CDR', fuenteAbandonadas: 'ABANDONADAS' }), 'Contestadas: CDR · Abandonadas: reporte de abandonadas');
  assert.equal(LU.llamadasUnicasFuenteMes({ fuenteContestadas: 'PLANTILLA', fuenteAbandonadas: null }), 'Contestadas: Carga anterior · Abandonadas: sin cargar');
  assert.equal(LU.llamadasSalidaFuenteMes({ fuente: 'CDR', noConectadas: null }), 'CDR (falta la base de no conectadas)');
  assert.equal(LU.llamadasSalidaFuenteMes({ fuente: 'PLANTILLA', noConectadas: 2 }), 'Carga anterior');
});
