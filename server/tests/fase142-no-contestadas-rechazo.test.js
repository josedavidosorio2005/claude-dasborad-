// fase142-no-contestadas-rechazo.test.js — Fase 142 (decision del usuario,
// 13/10/2026): en Llamadas Unicas, SKILL_NAME = NO CONTESTADAS ya no se
// interpreta como abandonada (en septiembre eran llamadas de SALIDA no
// conectadas, Fase 141 Parte B). La hoja completa se rechaza con un mensaje
// claro en la vista previa, y "Guardar" no la envia (solo guarda resultados
// con `filas`, ver guardarCarga en cargas.js). Datos SINTETICOS.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { cargasProcesarHoja } = require('../../public/js/cargas-logic.js');
const { llamadasUnicasParseFilas, LLAMADAS_UNICAS_MSG_NO_CONTESTADAS } = require('../../public/js/llamadas-unicas-logic.js');

const HEADER = ['AGENT_NAME', 'DATE', 'TELEPHONE', 'SKILL_NAME'];
const slot = { tipo: 'llamadas_unicas', hoja: 'LLAMADAS_UNICAS', titulo: 'Llamadas Únicas (ingreso)', filaUnica: false };
const wsFalso = {}; // sin celdas con formula

test('el mensaje es exactamente el pedido', () => {
  assert.equal(LLAMADAS_UNICAS_MSG_NO_CONTESTADAS, 'NO CONTESTADAS es una llamada de SALIDA no conectada; cárgala en Llamadas de salida.');
});

test('Cargar Datos: una hoja con filas NO CONTESTADAS queda con error y SIN filas (no se guarda nada)', () => {
  const aoa = [HEADER,
    ['Asesor Uno', '2026-09-01', '3001', 'SKILL SAC'],
    ['Asesor Dos', '2026-09-01', '3002', 'NO CONTESTADAS']];
  const r = cargasProcesarHoja(slot, aoa, wsFalso, llamadasUnicasParseFilas, ['Hoja1']);
  assert.ok(r.error.startsWith(LLAMADAS_UNICAS_MSG_NO_CONTESTADAS));
  assert.equal(r.filas, undefined);
  // guardarCarga solo envia resultados con `filas` -- esta hoja nunca sale.
  const cargasJs = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'cargas.js'), 'utf8');
  assert.match(cargasJs, /var conDatos = _cargasResultados\.filter\(function\(r\)\{ return r\.filas; \}\);/);
});

test('Cargar Datos: el archivo corregido (sin NO CONTESTADAS, con filas vacias) sigue cargando normal', () => {
  const aoa = [HEADER,
    ['Asesor Uno', '2026-09-01', '3001', 'SKILL SAC'],
    [null, null, null, null],
    ['Asesor Dos', '2026-09-02', '3002', 'Skill Key Account']];
  const r = cargasProcesarHoja(slot, aoa, wsFalso, llamadasUnicasParseFilas, ['Hoja1']);
  assert.ok(!r.error);
  assert.equal(r.filas.length, 2);
  assert.equal(r.avisos.length, 0);
});
