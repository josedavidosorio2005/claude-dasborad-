// fase160-plantilla-whatsapp-ejemplos.test.js — Fase 160 (verificacion de
// ORLANT de punta a punta): siguiendo los ejemplos de la plantilla de Flujo
// de WhatsApp, la carga se rechazaba ("un tiempo es demasiado grande": AHT
// 400 se lee como 400 dias) y los % (0.4 sin formato) quedaban como dudosos.
// Los ejemplos deben estar en el formato que el lector acepta.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const XLSX = require('../../public/js/vendor/xlsx-0.20.3.full.min.js');
const W = require('../../public/js/trafico-whatsapp-logic.js');

const ins = XLSX.utils.sheet_to_json(
  XLSX.read(fs.readFileSync(path.join(__dirname, '..', 'plantillas', 'PLANTILLA_FLUJO_WHATSAPP.xlsx'))).Sheets.INSTRUCCIONES,
  { header: 1, defval: '' });
const ejemplo = (col) => { const f = ins.find((r) => r[0] === col); assert.ok(f, 'falta ' + col); return f[3]; };

test('los % de ejemplo se leen como porcentaje, sin depender del formato de la celda', () => {
  for (const c of ['SERVICE_LEVEL_10SEC', 'SERVICE_LEVEL_20SEC', 'SERVICE_LEVEL_30SEC', 'SERVICE_LEVEL_5MIN']) {
    const v = ejemplo(c);
    assert.equal(typeof v, 'string', c + ' debe ir como texto "NN %"');
    const n = W.traficoWppPctDesdeTexto(v, null);
    assert.ok(n > 1 && n <= 100, c + ': ' + v + ' -> ' + n);
  }
});

test('el AHT de ejemplo es una hora de Excel (h:mm:ss) y cabe en el limite del servidor', () => {
  const v = ejemplo('AHT');
  const m = String(v).match(/^(\d+):(\d{2}):(\d{2})$/);
  assert.ok(m, 'AHT debe ir como h:mm:ss, no en segundos: ' + v);
  // Excel guarda 0:06:40 como fraccion de dia; el lector la pasa a segundos.
  const seg = W.traficoWppSegundosDesdeFraccionDia((+m[1] * 3600 + +m[2] * 60 + +m[3]) / 86400);
  assert.equal(seg, 400);
  assert.ok(seg <= 1000000);
});
