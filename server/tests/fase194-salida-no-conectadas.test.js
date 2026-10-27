// fase194-salida-no-conectadas.test.js — Fase 194 (Mobilize, pedido del 27/10):
// 1) El Centro de cargas de "Llamadas Únicas y de Salida" solo lleva los dos
//    reportes de Wolkvox (abandonadas y no conectadas); lo ya guardado no se
//    borra; un mes sin abandonadas muestra 0.
// 2) Salida conectada: TODAS las filas SKILL_NAME "-" del CDR cuentan (ni la
//    codificacion de prueba ni el deduplicado exacto las quitan): septiembre
//    67, agosto 28.
// 3) Base nueva de no conectadas: cada fila cuenta, sin quitar repetidas;
//    alimenta "no conectadas" y el total de salida. Sin telefono.
// Todo con datos SINTETICOS.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
// helpers primero: arma el entorno de prueba antes de cargar el servidor.
const { request, app, tokenFor, MASTER_PASSWORD, db } = require('./helpers');
const T = require('../../public/js/tipificacion-logic.js');
const LS = require('../../public/js/llamadas-salida-logic.js');
const LU = require('../../public/js/llamadas-unicas-logic.js');
const CL = require('../../public/js/centro-cargas-logic.js');
const { CARGAS_POR_MODULO } = require('../centro-cargas');
const { CAMPOS_FILA_NO_CONECTADAS } = require('../llamadas-salida');
const dbModulo = require('../db');

const auth = (t) => ({ Authorization: `Bearer ${t}` });
const TEL = '3009998877';
const MOBILIZE = { codificacionesExcluidas: T.TIPIFICACION_CDR_EXCLUIR_POR_DEFECTO, marcarUnicasDia: true, conservarSalidaGuion: true };
const CDR_H = ['AGENT_NAME', 'DATE', 'TELEPHONE', 'DESCRIPTION_COD_ACT', 'SKILL_NAME', 'TYPE_INTERACTION'];
const pad = (n) => (n < 10 ? '0' : '') + n;
// CDR de un mes con `n` filas "-": incluye 2 exactamente iguales y 1 de prueba (las 3 que se perdian).
function cdrMes(mes, n, extraIngreso) {
  const filas = [CDR_H];
  for (let i = 0; i < n - 3; i++) filas.push(['Asesor Uno', `${mes}-${pad(1 + (i % 28))} ${pad(8 + (i % 10))}:${pad(i % 60)}:00`, '31100' + pad(i), 'AGENDADA', '-', 'outbound_ma']);
  filas.push(['Asesor Dos', `${mes}-15 10:00:00`, TEL, 'Cliente_no_contesta', '-', 'outbound_ma']);
  filas.push(['Asesor Dos', `${mes}-15 10:00:00`, TEL, 'Cliente_no_contesta', '-', 'outbound_ma']); // duplicado exacto
  filas.push(['Asesor Dos', `${mes}-16 11:00:00`, TEL, 'PRUEBA', '-', 'outbound_ma']); // codificacion de prueba
  (extraIngreso || []).forEach((f) => filas.push(f));
  return filas;
}
const cuenta = (r) => r.filas.filter((f) => f.skill === '-' || f.skill === 'LLAMADAS DE SALIDA').length;

test('salida "-": septiembre 67 y agosto 28 -- ninguna fila "-" se pierde (antes 64 y 27)', () => {
  const sep = T.tipificacionParseFilas(cdrMes('2025-09', 67), null, 'LLAMADAS', MOBILIZE);
  assert.equal(cuenta(sep), 67);
  const ago = T.tipificacionParseFilas(cdrMes('2025-08', 28), null, 'LLAMADAS', MOBILIZE);
  assert.equal(cuenta(ago), 28);
  // Como Mobilize antes de esta fase: se perdian la duplicada exacta y la de prueba.
  const antes = T.tipificacionParseFilas(cdrMes('2025-09', 67), null, 'LLAMADAS', { codificacionesExcluidas: T.TIPIFICACION_CDR_EXCLUIR_POR_DEFECTO });
  assert.equal(cuenta(antes), 65, '67 - 1 duplicada - 1 de prueba');
  assert.ok(sep.avisos.some((a) => /1 fila\(s\) de salida \(SKILL_NAME "-"\) con codificación de prueba se conservaron/.test(a)));
  assert.ok(sep.filas.every((f) => !Object.getOwnPropertyNames(f).some((k) => k.startsWith('_'))), 'sin marcas internas');
});

test('el ingreso no cambia: las pruebas y los duplicados exactos de ingreso se siguen quitando; únicas igual', () => {
  const ing = [
    ['Asesor Uno', '2025-09-02 09:00:00', '3110000001', 'AGENDADA', 'SKILL SAC', 'inbound'],
    ['Asesor Uno', '2025-09-02 09:00:00', '3110000001', 'AGENDADA', 'SKILL SAC', 'inbound'], // duplicado exacto
    ['Asesor Uno', '2025-09-02 10:00:00', '3110000002', 'PRUEBA', 'SKILL SAC', 'inbound'], // prueba
    ['Asesor Uno', '2025-09-03 10:00:00', '3110000001', 'INFO', 'SKILL SAC', 'inbound'],
  ];
  const r = T.tipificacionParseFilas(cdrMes('2025-09', 67, ing), null, 'LLAMADAS', MOBILIZE);
  const ingreso = r.filas.filter((f) => f.skill === 'SKILL SAC');
  assert.equal(ingreso.length, 2);
  assert.deepEqual(r.unicasDia, { ingreso: 2, unicas: 2, sinTelefono: 0 });
  assert.equal(cuenta(r), 67);
});

test('ORLANT no cambia: sin conservarSalidaGuion el deduplicado exacto sigue igual', () => {
  const r = T.tipificacionParseFilas(cdrMes('2025-09', 67), null, 'LLAMADAS');
  assert.equal(cuenta(r), 66, 'solo quita el duplicado exacto; ORLANT no excluye pruebas');
});

test('no conectadas: columnas obligatorias, cada fila cuenta (repetidas incluidas), sin telefono', () => {
  assert.deepEqual(LS.LLAMADAS_NO_CONECTADAS_COLUMNAS.map((c) => c.label), ['AGENT_NAME', 'DATE', 'RING_TIME', 'RESULT']);
  assert.deepEqual(LS.LLAMADAS_NO_CONECTADAS_ORDEN_ARRAY, CAMPOS_FILA_NO_CONECTADAS);
  const falta = LS.llamadasNoConectadasParseFilas([['AGENT_NAME', 'DATE', 'TELEPHONE'], ['A', '2025-10-02', TEL]]);
  assert.match(falta.error, /Faltan columnas obligatorias: RING_TIME, RESULT\./);
  const H = ['AGENT_NAME', 'DATE', 'DESTINY', 'TELEPHONE', 'RING_TIME', 'RESULT', 'TYPE_INTERACTION', 'CUSTOMER_ID', 'CAMPAIGN_ID', 'AGENT_ID', 'CONN_ID'];
  const fila = (a, d) => [a, d, TEL, TEL, 20, 'NO ANSWER', 'outbound_ma', 'CLI-1', 9, 77, 'C' + Math.random()];
  const r = LS.llamadasNoConectadasParseFilas([H, fila('Asesor Uno', '2025-10-02 09:00'), fila('Asesor Uno', '2025-10-02 09:00'), fila('', '2025-10-03 09:00'), fila('Asesor Dos', '2025-10-04 09:00')]);
  assert.equal(r.filas.length, 4, 'la repetida tambien cuenta');
  assert.deepEqual(r.porMes, { '2025-10': 4 });
  assert.deepEqual(r.filas[2], ['2025-10-03', 'Sin asesor']);
  assert.ok(!JSON.stringify(r.filas).includes(TEL) && !JSON.stringify(r.filas).includes('CLI-1'));
});

test('Centro de cargas: el módulo solo lleva Abandonadas y No conectadas, con plantilla = el reporte de Wolkvox', () => {
  const ids = CARGAS_POR_MODULO.llamadas_unicas.map((c) => c.id);
  assert.deepEqual(CARGAS_POR_MODULO.llamadas_unicas.filter((c) => !c.retirada).map((c) => c.id), ['llamadas_abandonadas', 'llamadas_no_conectadas']);
  assert.deepEqual(ids.filter((x) => CARGAS_POR_MODULO.llamadas_unicas.find((c) => c.id === x).retirada), ['llamadas_unicas', 'llamadas_salida'], 'las viejas quedan retiradas');
  assert.deepEqual(CARGAS_POR_MODULO.llamadas_unicas.filter((c) => !c.retirada).map((c) => c.plantilla), ['PLANTILLA_LLAMADAS_ABANDONADAS.xlsx', 'PLANTILLA_LLAMADAS_NO_CONECTADAS.xlsx']);
  assert.equal(CL.centroModuloDeCarga('llamadas_no_conectadas'), 'llamadas_unicas');
  assert.equal(CL.centroEtiquetaCarga({ id: 'llamadas_no_conectadas' }), 'No conectadas');
  assert.ok(CL.centroOmiteCobertura('llamadas_no_conectadas'));
  assert.equal(CL.centroFechaFila('llamadas_no_conectadas', ['2025-10-02', 'A']), '2025-10-02');
});

test('migración: tabla llamadas_no_conectadas sin teléfono, idempotente', () => {
  dbModulo.crearLlamadasNoConectadas();
  dbModulo.crearLlamadasNoConectadas();
  assert.deepEqual(db.prepare('PRAGMA table_info(llamadas_no_conectadas)').all().map((c) => c.name),
    ['id', 'campana', 'fecha', 'agente', 'archivoNombre', 'cargadoPorNombre', 'createdAt']);
});

test('API: conectadas del CDR (67 / 28), no conectadas de la base nueva, total; mes sin base = Pendiente; abandonadas sin cargar = 0; lo viejo no se borra', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  // Carga vieja (plantilla) de ingreso con 2 abandonadas en septiembre: ya no cuentan (0), pero no se borran.
  let res = await request(app).post('/api/calidad/llamadas-unicas/carga').set(auth(admin)).send({ campana: 'MOBILIZE', filas: [
    ['Asesor Uno', '2025-09-10', 'CONTESTADA', 'SKILL SAC'], ['', '2025-09-11', 'ABANDONADA', 'SKILL SAC'], ['', '2025-09-12', 'ABANDONADA', 'SKILL SAC'],
  ] });
  assert.equal(res.status, 201);
  for (const [mes, n] of [['2025-08', 28], ['2025-09', 67]]) {
    const r = T.tipificacionParseFilas(cdrMes(mes, n), null, 'LLAMADAS', MOBILIZE);
    res = await request(app).post('/api/calidad/tipificacion/carga').set(auth(admin))
      .send({ campana: 'MOBILIZE', canal: 'LLAMADAS', archivoNombre: 'cdr-' + mes + '.xlsx', filas: r.filas.map(T.tipificacionFilaComoArray) });
    assert.equal(res.status, 201);
  }
  // No conectadas solo de septiembre: 5 filas (2 repetidas).
  const nc = [['2025-09-02', 'Asesor Uno'], ['2025-09-02', 'Asesor Uno'], ['2025-09-05', 'Asesor Dos'], ['2025-09-06', 'Sin asesor'], ['2025-09-07', 'Asesor Dos']];
  res = await request(app).post('/api/calidad/llamadas-no-conectadas/carga/impacto').set(auth(admin)).send({ campana: 'MOBILIZE', filas: nc });
  assert.deepEqual([res.status, res.body.filasNuevas, res.body.filasExistentes], [200, 5, 0]);
  res = await request(app).post('/api/calidad/llamadas-no-conectadas/carga').set(auth(admin)).send({ campana: 'MOBILIZE', archivoNombre: 'nc.xlsx', filas: nc });
  assert.deepEqual([res.status, res.body.insertadas], [201, 5]);
  const q = { campana: 'MOBILIZE', desde: '2025-08-01', hasta: '2025-09-30' };
  const sal = (await request(app).get('/api/calidad/llamadas-salida/por-mes').query(q).set(auth(admin))).body;
  assert.deepEqual(sal, [
    { periodo: '2025-08', total: null, noConectadas: null, conectadas: 28, fuente: 'CDR', fuenteNoConectadas: null },
    { periodo: '2025-09', total: 72, noConectadas: 5, conectadas: 67, fuente: 'CDR', fuenteNoConectadas: 'NO_CONECTADAS' },
  ]);
  const sep = (await request(app).get('/api/calidad/llamadas-salida/resumen').query({ campana: 'MOBILIZE', desde: '2025-09-01', hasta: '2025-09-30' }).set(auth(admin))).body;
  assert.deepEqual(sep, { conectadas: 67, noConectadas: 5, total: 72, noConectadasPendiente: false });
  const soloNc = (await request(app).get('/api/calidad/llamadas-salida/resumen').query({ campana: 'MOBILIZE', desde: '2025-09-01', hasta: '2025-09-30', tipo: 'NO_CONECTADA' }).set(auth(admin))).body;
  assert.deepEqual([soloNc.conectadas, soloNc.noConectadas], [0, 5]);
  const det = (await request(app).get('/api/calidad/llamadas-salida/detalle').query({ campana: 'MOBILIZE', desde: '2025-09-01', hasta: '2025-09-30' }).set(auth(admin))).body;
  const dos = det.porAsesor.find((x) => x.agente === 'Asesor Dos');
  assert.deepEqual([dos.conectadas, dos.noConectadas, dos.total], [3, 2, 5]);
  // Abandonadas: septiembre sin el reporte de Wolkvox = 0, aunque la carga vieja tenga 2 (no se borran).
  const lu = (await request(app).get('/api/calidad/llamadas-unicas/por-mes').query({ campana: 'MOBILIZE', desde: '2025-09-01', hasta: '2025-09-30' }).set(auth(admin))).body;
  assert.equal(lu[0].abandonadas, 0);
  assert.equal(lu[0].fuenteAbandonadas, null);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM llamadas_unicas WHERE campana='MOBILIZE' AND tipo='ABANDONADA' AND fecha LIKE '2025-09%'").get().n, 2);
  // Privacidad.
  assert.ok(!JSON.stringify([sal, det]).includes(TEL));
  assert.ok(!JSON.stringify(db.prepare('SELECT * FROM llamadas_no_conectadas').all()).includes(TEL));
});

test('panel: fuente por mes con conectadas y no conectadas', () => {
  assert.equal(LU.llamadasSalidaFuenteMes({ fuente: 'CDR', fuenteNoConectadas: 'NO_CONECTADAS', noConectadas: 41 }), 'Conectadas: CDR · No conectadas: reporte de no conectadas');
  assert.equal(LU.llamadasSalidaFuenteMes({ fuente: 'CDR', noConectadas: null }), 'Conectadas: CDR · No conectadas: falta su base');
  assert.equal(LU.llamadasSalidaFuenteMes({ fuente: 'PLANTILLA', fuenteNoConectadas: 'PLANTILLA', noConectadas: 2 }), 'Conectadas: Carga anterior · No conectadas: Carga anterior');
});
