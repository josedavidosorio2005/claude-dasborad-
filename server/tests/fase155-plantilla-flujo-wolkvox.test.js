// fase155-plantilla-flujo-wolkvox.test.js — Fase 155 (reunion con Edwin,
// 19/10): la plantilla de Flujo de Llamadas trae EXACTAMENTE las columnas del
// reporte de Wolkvox, en el mismo orden (incluidas las de porcentaje que el
// sistema ignora), para pegar sin modificar nada. Plantilla, ficha y lector
// dicen lo mismo.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const XLSX = require('../../public/js/vendor/xlsx-0.20.3.full.min.js');
const T = require('../../public/js/trafico-logic.js');

const RAIZ = path.join(__dirname, '..', '..');
// Orden del reporte de la cola de Wolkvox (HistQueue), el mismo en el
// archivo de Mobilize (con sus alias) y en la hoja DATA de ORLANT.
const WOLKVOX = [
  'SKILL_NAME', 'DATE', 'TOTAL LLAMADAS', 'LLAMADAS CONTESTADAS', 'LLAMADAS ABANDONADAS',
  'SERVICE_LEVEL_10SEC', 'SERVICE_LEVEL_20SEC', 'SERVICE_LEVEL_30SEC', 'ABANDON',
  'ASA', 'ATA', 'WAIT_TIME', 'AHT', 'NIVEL DE ATENCION', 'TASA DE ABNDONO',
];
const MOBILIZE = [
  'TIPO DE LINEA', 'DÍA', 'LLAMADAS INGRESADAS', 'LLAMADAS CONTESTADAS', 'LLAMADAS ABANDONADAS',
  'SERVICE_LEVEL_10SEC', 'NIVEL DE SERVICIO 80 - 20', 'SERVICE_LEVEL_30SEC', 'ABANDON',
  'ASA', 'ATA', 'WAIT_TIME', 'AHT', 'NIVEL DE ATENCION', '% ABANDONO',
];
const NOTA = 'Nivel de atención y tasa de abandono los calcula el sistema; no hace falta llenarlos.';

function libro() {
  return XLSX.read(fs.readFileSync(path.join(RAIZ, 'server', 'plantillas', 'PLANTILLA_FLUJO_LLAMADAS.xlsx')), { type: 'buffer' });
}

test('PLANTILLA_FLUJO_LLAMADAS: mismas columnas y mismo orden que el reporte de Wolkvox', () => {
  const filas = XLSX.utils.sheet_to_json(libro().Sheets.LLAMADAS, { header: 1, defval: '' });
  assert.deepEqual(filas[0], WOLKVOX);
});

test('INSTRUCCIONES dice en una linea que nivel y tasa los calcula el sistema', () => {
  const ins = XLSX.utils.sheet_to_json(libro().Sheets.INSTRUCCIONES, { header: 1, defval: '' });
  assert.ok(ins.some((f) => f[1] === NOTA), 'falta la linea de calculos');
});

test('la ficha lista las mismas columnas que la plantilla y la misma linea', () => {
  const ficha = fs.readFileSync(path.join(RAIZ, 'docs', 'plantillas', 'flujo_llamadas.md'), 'utf8');
  assert.ok(ficha.includes(NOTA));
  WOLKVOX.forEach((c) => assert.ok(ficha.includes('| ' + c + ' |'), 'la ficha no lista ' + c));
});

test('lector: reconoce las 15 columnas (ORLANT y Mobilize) y no lee ABANDON ni los %', () => {
  for (const enc of [WOLKVOX, MOBILIZE]) {
    const map = T.traficoColIndexMap(enc);
    assert.equal(Object.keys(map).length, 15, 'todas las columnas reconocidas: ' + enc[0]);
    const ws = XLSX.utils.aoa_to_sheet([enc, ['SKILL A', '2026-08-01', 10, 8, 2, 0.5, 0.6, 0.7, 0.99, 5, 6, 0.001, 0.002, 1, 0]]);
    const r = T.traficoParseFilas(XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true }), ws);
    assert.ifError(r.error);
    assert.equal(r.filas[0].abandonWolkvox, undefined, 'ABANDON nunca se lee');
  }
});
