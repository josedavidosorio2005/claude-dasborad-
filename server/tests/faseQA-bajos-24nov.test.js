// faseQA-bajos-24nov.test.js — dos bajos de la auditoría del 24/11 (pedido del usuario, 24/11):
// 1) una novedad de Gestión Humana sin fecha de fin no salía como «ausente» en el Inventario;
// 2) en modo demostración la franja de aviso tapaba la barra con «Cerrar» de las ventanas de módulo en
//    pantalla completa (solo Talento humano tenía el ajuste). Personas INVENTADAS.
'use strict';
process.env.NODE_ENV = 'test';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const NGH = require('../gh-novedades');

const HOY = '2026-11-24';
const E = { id: 'e1', estado: 'Activo', nombre: 'Persona Inventada' };
const nov = (x) => Object.assign({ empId: 'e1', anulada: false, fIni: '2026-11-20' }, x);

test('novedad sin fecha de fin: «ausente» desde su inicio, con texto «sin fecha de regreso»', () => {
  for (const fFin of [undefined, '', null]) {
    const st = NGH.estadoHoy(E, [], [nov({ fFin })], HOY);
    assert.ok(st, 'fFin=' + fFin);
    assert.equal(st.t, 'ausente');
    assert.match(st.txt, /^Ausente desde el 20\/11\/2026, sin fecha de regreso \(novedad registrada en Gestión Humana\)$/);
  }
});

test('las demás novedades siguen igual: con fin vigente, vencida, futura, anulada', () => {
  assert.match(NGH.estadoHoy(E, [], [nov({ fFin: '2026-11-30' })], HOY).txt, /^Ausente hasta el 30\/11\/2026/);
  assert.equal(NGH.estadoHoy(E, [], [nov({ fFin: '2026-11-23' })], HOY), null, 'vencida');
  assert.equal(NGH.estadoHoy(E, [], [nov({ fIni: '2026-11-26' })], HOY), null, 'futura sin fin: aún no');
  assert.equal(NGH.estadoHoy(E, [], [nov({ fFin: '', anulada: true })], HOY), null, 'anulada');
  assert.equal(NGH.estadoHoy(E, [], [nov({ fIni: '', fFin: '' })], HOY), null, 'sin inicio: no se adivina');
});

test('próxima ausencia sin fecha de fin: texto sin «fecha sin registrar»', () => {
  const pr = NGH.proxima(E, [], [nov({ fIni: '2026-11-26', fFin: '' })], HOY);
  assert.equal(pr.txt, 'Ausente desde el 26/11/2026, sin fecha de regreso');
  assert.equal(NGH.proxima(E, [], [nov({ fIni: '2026-11-26', fFin: '2026-11-28' })], HOY).txt, 'Ausente del 26/11/2026 al 28/11/2026');
});

test('franja de demostración: el ajuste cubre exactamente las ventanas de pantalla completa de styles.css', () => {
  const pub = path.join(__dirname, '..', '..', 'public');
  const js = fs.readFileSync(path.join(pub, 'js', 'state.js'), 'utf8');
  const css = fs.readFileSync(path.join(pub, 'css', 'styles.css'), 'utf8');
  const m = js.match(/SEED_DEMO_MODALES_PANTALLA_COMPLETA = ((?:'[^']*'\s*\+?\s*)+);/);
  assert.ok(m, 'lista en state.js');
  const lista = (s) => s.split(',').map((x) => x.trim()).filter(Boolean).sort();
  const deJs = lista(m[1].replace(/'\s*\+\s*'/g, '').replace(/'/g, ''));
  const regla = css.slice(css.indexOf('/* Fase 364 (B3): ventanas de módulo en pantalla completa'));
  const sel = regla.slice(regla.indexOf('#calidad-modal'), regla.indexOf('{', regla.indexOf('#calidad-modal')));
  assert.deepEqual(deJs, lista(sel));
  assert.ok(deJs.includes('#activos-overlay > .modal'), 'Inventario');
  assert.match(js, /setProperty\('margin-top', topPx, 'important'\)/);
  assert.match(js, /removeProperty\('margin-top'\)/, 'sin demostración se quita el ajuste');
});
