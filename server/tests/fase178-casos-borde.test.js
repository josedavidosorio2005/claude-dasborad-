// fase178-casos-borde.test.js — Fase 178 (Parte 2, prevencion): casos de
// borde de lo nuevo de las Fases 165 a 177 que no tenian prueba. No cambia
// codigo: fija el comportamiento de hoy para que una regresion se note.
// Todo SINTETICO (ningun dato real).
//   - CDR (HistCDR / HistChat) con columnas faltantes o con otro formato de
//     encabezado.
//   - Archivos con filas raras: encabezado repetido, fila de totales, filas
//     vacias, otras colas mezcladas.
//   - Meses sin datos: cada ruta nueva responde 200 con la estructura vacia,
//     sin NaN ni null en los numeros.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const T = require('../../public/js/tipificacion-logic.js');
const W = require('../../public/js/whatsapp-tiempos-logic.js');
const { request, app, tokenFor, MASTER_PASSWORD } = require('./helpers');

const auth = (t) => ({ Authorization: `Bearer ${t}` });
const HCDR = ['AGENT_NAME', 'DATE', 'DESCRIPTION_COD_ACT', 'SKILL_NAME', 'TYPE_INTERACTION'];

// ── CDR con columnas faltantes ──────────────────────────────────────
test('CDR de llamadas sin columnas obligatorias: error que las nombra todas (nunca carga a medias)', () => {
  assert.deepEqual(T.tipificacionParseFilas([['AGENT_NAME', 'SKILL_NAME'], ['Ana', 'X']], null, 'LLAMADAS'),
    { error: 'Faltan columnas obligatorias: DATE, DESCRIPTION_COD_ACT.' });
  assert.deepEqual(T.tipificacionParseFilas([['DATE', 'DESCRIPTION_COD_ACT', 'SKILL_NAME'], ['2026-09-01', 'A', 'X']], null, 'LLAMADAS'),
    { error: 'Faltan columnas obligatorias: AGENT_NAME.' });
  assert.deepEqual(T.tipificacionParseFilas([], null, 'LLAMADAS'), { error: 'El archivo esta vacio.' });
});

test('CDR de WhatsApp sin SKILL_NAME ni SKILL_ID: error; con SKILL_ID pero sin la tabla de skills: error claro', () => {
  const sinSkill = T.tipificacionParseFilas([['AGENT_NAME', 'DATE', 'DESCRIPTION_COD_ACT', 'CHANNEL'], ['Ana', '2026-09-01', 'A', 'wa']], null, 'WHATSAPP');
  assert.match(sinSkill.error, /Faltan columnas obligatorias: SKILL_NAME\./);
  const sinTabla = T.tipificacionParseFilas([['AGENT_NAME', 'DATE', 'DESCRIPTION_COD_ACT', 'SKILL_ID', 'CHANNEL'], ['Ana', '2026-09-01', 'A', '4306', 'wa']], null, 'WHATSAPP');
  assert.match(sinTabla.error, /SKILL_ID y no SKILL_NAME/);
});

test('CDR sin TYPE_INTERACTION (columna opcional): carga, sin tipo, y "-" NO se vuelve salida', () => {
  const r = T.tipificacionParseFilas([['AGENT_NAME', 'DATE', 'DESCRIPTION_COD_ACT', 'SKILL_NAME'],
    ['Ana', '2026-09-01', 'Agendada', '-'], ['Ana', '2026-09-02', 'Agendada', 'GENERAL']], null, 'LLAMADAS');
  assert.equal(r.error, undefined);
  assert.deepEqual(r.filas.map((f) => [f.skill, f.tipoInteraccion]), [['-', null], ['GENERAL', null]]);
  assert.equal(r.salida, 0);
});

test('encabezados en minusculas o con espacios de mas se reconocen igual', () => {
  const r = T.tipificacionParseFilas([['agent_name ', ' Date', 'description_cod_act', 'skill_name'], ['Ana', '2026-09-01', 'A', 'X']], null, 'LLAMADAS');
  assert.equal(r.error, undefined);
  assert.equal(r.filas.length, 1);
});

// ── Filas raras ─────────────────────────────────────────────────────
test('CDR con encabezado repetido, fila de totales y filas vacias: solo entran las filas reales, con aviso de las raras', () => {
  const r = T.tipificacionParseFilas([HCDR,
    ['Ana', '2026-09-01', 'Agendada', 'GENERAL', 'inbound'],
    HCDR, // encabezado pegado dos veces
    ['', '', '', '', ''], [], // vacias: se saltan sin aviso
    ['Total', '', '', '', ''], // fila de totales al final de un export
    ['Ana', '2026-09-02', 'Agendada', 'GENERAL', 'inbound'],
  ], null, 'LLAMADAS');
  assert.deepEqual(r.filas.map((f) => f.fecha), ['2026-09-01', '2026-09-02']);
  assert.deepEqual(r.avisos, ['Fila 3: DATE invalida o vacia, se omitio.', 'Fila 6: falta un dato obligatorio (agente/tipificacion/skill), se omitio.']);
});

test('CDR donde ninguna fila sirve: error (no una carga vacia que borre el mes)', () => {
  const r = T.tipificacionParseFilas([HCDR, ['Total', '', '', '', ''], HCDR], null, 'LLAMADAS');
  assert.match(r.error, /Ninguna fila valida/);
});

test('WhatsApp por rangos con filas raras: encabezado repetido, totales, vacias, otras colas y fecha mala', () => {
  const H = ['SKILL_NAME', 'DATE', 'RESULT', 'ANSWER_TIME'];
  const r = W.wppTiemposParseFilas([H,
    ['WHATSAPP 3P', '2026-10-01 09:00:00', 'ANSWER', 100],
    H,
    ['Total', '', '', ''],
    [],
    ['LINEA GENERAL', '2026-10-01 09:00:00', 'ANSWER', 5],
    ['WHATSAPP 3P', 'fecha mala', 'ANSWER', 5],
    ['WHATSAPP 3P', '2026-10-02 10:00:00', 'ANSWER', 400],
  ], null);
  assert.deepEqual(r.filas, [['WHATSAPP 3P', '2026-10-01', 9, 100], ['WHATSAPP 3P', '2026-10-02', 10, 400]]);
  assert.equal(r.ignoradasNoWhatsapp, 3, 'encabezado repetido, "Total" y la otra cola');
  assert.equal(r.vacias, 1);
  assert.deepEqual(r.avisos, ['1 fila(s) de WhatsApp con DATE invalida o vacia, se omitieron (filas 7).']);
  assert.deepEqual(W.wppTiemposParseFilas([['SKILL_NAME', 'DATE'], ['WHATSAPP X', '2026-10-01']], null), { error: 'Faltan columnas obligatorias: RESULT, ANSWER_TIME.' });
});

// ── Meses sin datos ─────────────────────────────────────────────────
function sinNumerosRotos(body, ruta) {
  JSON.stringify(body, (k, v) => {
    if (v === null && /pct|total|cantidad|promedio|llamadas|wpp|monitoreos/i.test(k)) assert.fail(`${ruta}: ${k} = null`);
    if (typeof v === 'number') assert.ok(Number.isFinite(v), `${ruta}: ${k} no es un numero finito`);
    return v;
  });
}

test('meses sin datos: las rutas nuevas responden 200 con la estructura vacia, sin NaN ni null en los numeros', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const casos = [
    ['/api/calidad/whatsapp-tiempos/rangos', { campana: 'ORLANT', mes: '2019-02' }, (b) => { assert.equal(b.total, 0); assert.equal(b.rangos.length, 5); assert.ok(b.rangos.every((x) => x.cantidad === 0 && x.pct === 0)); }],
    ['/api/calidad/whatsapp-tiempos/resumen', { campana: 'ORLANT', mes: '2019-02' }, (b) => { assert.deepEqual(b.porSkill, []); assert.deepEqual(b.porMes, []); }],
    ['/api/calidad/whatsapp-tiempos/opciones', { campana: 'ORLANT' }, (b) => assert.deepEqual(b, { meses: [], skills: [] })],
    ['/api/calidad/salida/asesores', { campana: 'ORLANT', mes: '2019-02' }, (b) => assert.deepEqual(b.asesores, [])],
    ['/api/calidad/salida/mensual', { campana: 'ORLANT' }, (b) => assert.deepEqual(b, [])],
    ['/api/calidad/calidad-resumen/mensual', { campana: 'MOBILIZE' }, (b) => assert.deepEqual(b, { meses: [] })],
    ['/api/calidad/tipificacion/opciones', { campana: 'ORLANT', canal: 'LLAMADAS' }, (b) => assert.deepEqual(b, { meses: [], agentes: [], skills: [] })],
    ['/api/calidad/tipificacion/resumen-salida', { campana: 'ORLANT', mes: '2019-02' }, () => {}],
    ['/api/calidad/encuestas/resumen', { campana: 'MOBILIZE', desde: '2019-02-01', hasta: '2019-02-28' }, (b) => assert.equal(b.total, 0)],
    ['/api/calidad/llamadas-salida/resumen', { campana: 'MOBILIZE', desde: '2019-02-01', hasta: '2019-02-28' }, () => {}],
  ];
  for (const [ruta, q, revisar] of casos) {
    const r = await request(app).get(ruta).query(q).set(auth(admin));
    assert.equal(r.status, 200, `${ruta}: ${r.status} ${JSON.stringify(r.body)}`);
    sinNumerosRotos(r.body, ruta);
    revisar(r.body);
  }
});
