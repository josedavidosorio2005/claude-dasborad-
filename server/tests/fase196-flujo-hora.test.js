// fase196-flujo-hora.test.js — Fase 196 (Mobilize): pestaña "Flujo por hora".
// Lector del reporte de cola por hora de Wolkvox (DATE AAAAMMDD, HOUR),
// matriz hora x dia con totales, tres niveles de color, carga y lectura por
// la API, migracion (solo la forma reconocible) y que el reporte por hora no
// se confunde con el diario de Flujo de Llamadas. Todo con datos SINTETICOS.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
// helpers primero: arma el entorno de prueba antes de cargar el servidor.
const { request, app, tokenFor, MASTER_PASSWORD, db } = require('./helpers');
const L = require('../../public/js/flujo-hora-logic.js');
const { CAMPOS_FILA } = require('../flujo-hora');
const { CARGAS_POR_MODULO } = require('../centro-cargas');
const CL = require('../../public/js/centro-cargas-logic.js');
const dbModulo = require('../db');

const auth = (t) => ({ Authorization: `Bearer ${t}` });
const H = ['DATE', 'SKILL_ID', 'SKILL_NAME', 'HOUR', 'INBOUND_CALLS', 'ANSWER_CALLS', 'ABANDON_CALLS', 'SERVICE_LEVEL_10SEC',
  'SERVICE_LEVEL_20SEC', 'SERVICE_LEVEL_30SEC', 'WAIT_TIME', 'ABANDON', 'AHT', 'ASA', 'ATA'];
const fila = (fecha, skill, hora, ing, con, ab) => [fecha, 101, skill, hora, ing, con, ab, '-', '-', '-', '-', '-', '-', '-', '-'];
// Marzo 2025: 3 dias, 2 horas, 2 skills. Ingresadas 9+1+4+2+6 = 22, contestadas 20, abandonadas 2.
const MARZO = [H,
  fila(20250303, 'SKILL SAC', 8, 9, 8, 1),
  fila(20250303, 'SKILL KEY', 8, 1, 1, 0), // misma hora y dia, otra skill: se suma en la celda
  fila(20250303, 'SKILL SAC', 9, 4, 4, 0),
  fila(20250310, 'SKILL SAC', 8, 2, 2, 0),
  fila(20250331, 'SKILL SAC', 9, 6, 5, 1),
];

test('lector: DATE AAAAMMDD, HOUR, totales del archivo; columnas obligatorias', () => {
  assert.deepEqual(L.FLUJO_HORA_ORDEN_ARRAY, CAMPOS_FILA);
  const r = L.flujoHoraParseFilas(MARZO);
  assert.equal(r.error, undefined);
  assert.equal(r.filas.length, 5);
  assert.deepEqual(r.totales, { ingresadas: 22, contestadas: 20, abandonadas: 2 });
  assert.deepEqual([r.desde, r.hasta, r.dias], ['2025-03-03', '2025-03-31', 3]);
  assert.deepEqual(r.filas[0], ['2025-03-03', 8, 'SKILL SAC', 9, 8, 1]);
  assert.equal(L.flujoHoraParseFecha(20250229), null, '29 de febrero de 2025 no existe');
  assert.match(L.flujoHoraParseFilas([['DATE', 'SKILL_NAME', 'INBOUND_CALLS']]).error, /Faltan columnas obligatorias: HOUR, ANSWER_CALLS, ABANDON_CALLS\./);
  const dup = L.flujoHoraParseFilas([H, fila(20250303, 'SKILL SAC', 8, 9, 8, 1), fila(20250303, 'SKILL SAC', 8, 9, 8, 1)]);
  assert.equal(dup.filas.length, 1, 'la misma fila dos veces no se suma dos veces');
  assert.ok(dup.avisos.some((a) => /ya venia en el archivo/.test(a)));
});

test('matriz: filas = horas, columnas = los 31 dias de marzo, totales por fila, columna y general', () => {
  const r = L.flujoHoraParseFilas(MARZO);
  // Como la API: sumado por dia + hora.
  const suma = {};
  r.filas.forEach((f) => { const k = f[0] + '|' + f[1]; suma[k] = suma[k] || { dia: f[0], hora: f[1], ingresadas: 0, contestadas: 0, abandonadas: 0 }; suma[k].ingresadas += f[3]; suma[k].contestadas += f[4]; suma[k].abandonadas += f[5]; });
  const m = L.flujoHoraMatriz(Object.values(suma), '2025-03', 'ingresadas');
  assert.deepEqual(m.horas, [8, 9]);
  assert.equal(m.dias.length, 31);
  assert.equal(m.celdas[8][3], 10, '9 + 1 de dos skills');
  assert.equal(m.celdas[9][31], 6);
  assert.deepEqual([m.totalFila[8], m.totalFila[9]], [12, 10]);
  assert.deepEqual([m.totalColumna[3], m.totalColumna[10], m.totalColumna[31], m.totalColumna[15]], [14, 2, 6, 0]);
  assert.equal(m.total, 22);
  assert.equal(m.max, 10);
  assert.equal(L.flujoHoraMatriz(Object.values(suma), '2025-03', 'abandonadas').total, 2);
  assert.equal(L.flujoHoraTramo(8), '8:00 - 9:00');
});

test('niveles: alto (verde) desde 2/3 del maximo, medio (amarillo) desde 1/3, bajo (gris) por debajo y el 0', () => {
  assert.deepEqual([10, 7, 6, 4, 3, 1, 0].map((v) => L.flujoHoraNivel(v, 10)), ['alto', 'alto', 'medio', 'medio', 'bajo', 'bajo', 'bajo']);
  assert.equal(L.flujoHoraNivel(0, 0), 'bajo');
  const css = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'css', 'styles.css'), 'utf8');
  assert.match(css, /\.fh-celda\.fh-alto,\.fh-muestra\.fh-alto\{background:var\(--c-calor-alto\)/);
  assert.match(css, /\.fh-celda\.fh-medio,\.fh-muestra\.fh-medio\{background:var\(--c-calor-medio\)/);
  assert.match(css, /\.fh-celda\.fh-bajo,\.fh-muestra\.fh-bajo\{background:var\(--c-calor-bajo\)/);
  // Contraste del texto sobre cada nivel, en los dos temas (>= 4.5:1).
  const C = require('../../public/js/contraste-logic.js');
  for (const [bg, tx] of [['#74B859', '#12321A'], ['#F5D54A', '#3D3000'], ['#D9DEE2', '#2E363C'], ['#3F7D34', '#FFFFFF'], ['#B8961A', '#1A1400'], ['#3A4A53', '#E3E8EB']]) {
    assert.ok(C.contrasteRazon(bg, tx) >= 4.5, bg + ' / ' + tx);
    assert.ok(css.includes(bg) && css.includes(tx), 'el token existe: ' + bg);
  }
  assert.match(css, /\.fh-wrap\{overflow-x:auto;/, 'en el celular cada tabla se desplaza de lado dentro de su tarjeta');
});

test('el reporte por hora no entra en Flujo de Llamadas y uno diario no entra en Flujo por hora', () => {
  const s = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'cargas.js'), 'utf8');
  assert.ok(s.includes('if(esTrafico && traeHour) continue;'));
  assert.ok(s.includes('if(esFlujoHora && !traeHour) continue;'));
});

test('Centro de cargas y migración: módulo flujo_hora con su plantilla; pestaña después de Llamadas Únicas; idempotente', () => {
  assert.deepEqual(CARGAS_POR_MODULO.flujo_hora.map((c) => [c.id, c.tabla, c.plantilla]), [['flujo_hora', 'flujo_hora', 'PLANTILLA_FLUJO_HORA.xlsx']]);
  assert.equal(CL.centroModuloDeCarga('flujo_hora'), 'flujo_hora');
  assert.equal(CL.centroFechaFila('flujo_hora', ['2025-03-03', 8]), '2025-03-03');
  dbModulo.crearFlujoHora();
  dbModulo.crearFlujoHora();
  const cols = db.prepare('PRAGMA table_info(flujo_hora)').all().map((c) => c.name);
  assert.ok(!cols.some((c) => /tel|ani/i.test(c)), 'sin columna de telefono');
  const tabs = JSON.parse(db.prepare("SELECT layout FROM dashboards_config WHERE cliente = 'MOBILIZE'").get().layout).tabs.map((t) => t.key);
  assert.equal(tabs.filter((k) => k === 'flujo_hora').length, 1);
  assert.equal(tabs.indexOf('flujo_hora'), tabs.indexOf('llamadas_unicas') + 1);
  const mods = JSON.parse(db.prepare("SELECT modulos FROM clientes_registro WHERE nombre = 'MOBILIZE'").get().modulos);
  assert.equal(mods.filter((m) => m === 'flujo_hora').length, 1);
});

test('API: carga, reemplazo por rango y mes sumado por día + hora (22 / 20 / 2)', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const r = L.flujoHoraParseFilas(MARZO);
  const imp = await request(app).post('/api/calidad/flujo-hora/carga/impacto').set(auth(admin)).send({ campana: 'MOBILIZE', filas: r.filas });
  assert.deepEqual([imp.status, imp.body.filasNuevas, imp.body.ingresadas, imp.body.contestadas, imp.body.abandonadas], [200, 5, 22, 20, 2]);
  let c = await request(app).post('/api/calidad/flujo-hora/carga').set(auth(admin)).send({ campana: 'MOBILIZE', archivoNombre: 'hora.xlsx', filas: r.filas });
  assert.deepEqual([c.status, c.body.insertadas, c.body.borradas], [201, 5, 0]);
  c = await request(app).post('/api/calidad/flujo-hora/carga').set(auth(admin)).send({ campana: 'MOBILIZE', filas: r.filas });
  assert.deepEqual([c.body.insertadas, c.body.borradas], [5, 5], 'subir lo mismo reemplaza, no duplica');
  const mes = (await request(app).get('/api/calidad/flujo-hora/mes').query({ campana: 'MOBILIZE', mes: '2025-03' }).set(auth(admin))).body;
  assert.equal(mes.length, 4, '4 combinaciones dia + hora');
  assert.deepEqual(mes.find((x) => x.dia === '2025-03-03' && x.hora === 8), { dia: '2025-03-03', hora: 8, ingresadas: 10, contestadas: 9, abandonadas: 1 });
  for (const k of ['ingresadas', 'contestadas', 'abandonadas']) {
    assert.equal(L.flujoHoraMatriz(mes, '2025-03', k).total, r.totales[k], k + ': el mapa da lo mismo que el archivo');
  }
  const op = (await request(app).get('/api/calidad/flujo-hora/opciones').query({ campana: 'MOBILIZE' }).set(auth(admin))).body;
  assert.ok(op.meses.includes('2025-03'));
  const malo = await request(app).post('/api/calidad/flujo-hora/carga').set(auth(admin)).send({ campana: 'MOBILIZE', filas: [['2025-03-03', 24, 'SAC', 1, 1, 0]] });
  assert.equal(malo.status, 400, 'hora 24 no existe');
});
