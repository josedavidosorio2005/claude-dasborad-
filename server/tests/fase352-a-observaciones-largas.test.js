// fase352-a-observaciones-largas.test.js — Fase 352 (A, reunion con Edwin del 13/11): en Calidad ›
// Calificar, Observaciones, Estrategia, Motivo de afectacion y Causa admiten 2000 caracteres
// (antes 500 / 200 / 300 / 300, y el servidor cortaba los extras en 200). Mismo tope en el
// formulario y en el servidor; la base ya guarda TEXT sin limite. Datos INVENTADOS.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const C = require('../calidad-campos');
const { schemas } = require('../validation');

const PUB = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'public', f), 'utf8');
const largo = (n) => ('Retroalimentacion inventada. '.repeat(Math.ceil(n / 29)).slice(0, n - 1) + '.');
const camposSura = [{ k: 'asesor' }, { k: 'fecha' }, { k: 'observaciones' }, { k: 'estrategia' }, { k: 'motivoTexto' }, { k: 'causa' }];

test('A: un solo tope de 2000 para los cuatro textos largos', () => {
  assert.equal(C.TEXTO_LARGO_CALIDAD_MAX, 2000);
  for (const k of ['estrategia', 'motivoTexto', 'causa']) assert.equal(C.CAMPOS_CALIDAD[k].max, 2000, k);
  // Los campos cortos no cambian.
  assert.equal(C.CAMPOS_CALIDAD.placa.max, 20);
  assert.equal(C.CAMPOS_CALIDAD.idAgente.max, 60);
  assert.equal(C.CAMPOS_CALIDAD.tipificacionSistema.max, 120);
});

test('A: el servidor acepta 2000 caracteres en cada texto largo y rechaza 2001', () => {
  const base = { campana: 'CAMPANA INVENTADA', asesor: 'Asesor Inventado', fecha: '2026-11-10', answers: { 1: 'SI' } };
  const ok = schemas.createMonitoreoBody.safeParse({ ...base, observaciones: largo(2000), extras: { estrategia: largo(2000), motivoTexto: largo(2000), causa: largo(2000) } });
  assert.equal(ok.success, true, JSON.stringify(ok.error && ok.error.issues));
  assert.equal(schemas.createMonitoreoBody.safeParse({ ...base, observaciones: largo(2001) }).success, false);
  assert.equal(schemas.updateMonitoreoBody.safeParse({ extras: { causa: largo(2000) } }).success, true);
  // Antes: Motivo y Causa dejaban escribir 300 en el formulario pero el servidor cortaba en 200.
  assert.equal(schemas.createMonitoreoBody.safeParse({ ...base, extras: { causa: largo(250) } }).success, true, '250 en Causa ya no falla');
});

test('A: calidad-campos valida el tope por campo (2000 si, 2001 no)', () => {
  const n = C.normalizarCampos(camposSura);
  assert.ok(Array.isArray(n.campos), JSON.stringify(n));
  const lista = { campos: n.campos };
  for (const k of ['estrategia', 'motivoTexto', 'causa']) {
    const bien = C.validarExtras(lista, { [k]: largo(2000) });
    assert.ok(!bien.error, k + ': ' + bien.error);
    const mal = C.validarExtras(lista, { [k]: largo(2001) });
    assert.match(String(mal.error), /máximo 2000 caracteres/, k);
  }
});

test('A: el formulario usa el mismo tope, casilla alta que se agranda y contador', () => {
  const js = PUB('js/calidad-calificar.js');
  assert.ok(js.includes('var CC2_TEXTO_LARGO_MAX = 2000;'));
  assert.ok(js.includes("if (c.k === 'motivoTexto' || c.k === 'estrategia' || c.k === 'causa') return _cc2TextoLargo(id, lbl, 4);"));
  assert.ok(js.includes("if (c.k === 'observaciones') return _cc2TextoLargo(id, lbl, 6);"));
  assert.doesNotMatch(js, /maxlength="500"|slice\(0, 500\)/, 'no queda el tope viejo');
  assert.ok(js.includes('aria-describedby'), 'el contador esta asociado a la casilla');
  assert.ok(js.includes('cc2ActualizarContadores(); // Fase 352'), 'al editar, el contador muestra lo ya escrito');
  const css = PUB('css/styles.css');
  assert.ok(css.includes('.cc2-f textarea{resize:vertical}'), 'se puede agrandar');
  assert.ok(css.includes('.cc2-f textarea.cc2-largo{min-height:96px;line-height:1.5}'));
  // Logica del contador (funcion pura del navegador).
  const ctx = {};
  new Function('document', 'ctx', js + '; ctx.f = cc2ContadorTexto;')({ addEventListener() {}, getElementById() { return null; }, querySelectorAll() { return []; } }, ctx);
  assert.equal(ctx.f(1234, 2000), '1.234 / 2.000 caracteres');
  assert.equal(ctx.f(0, 2000), '0 / 2.000 caracteres');
});
