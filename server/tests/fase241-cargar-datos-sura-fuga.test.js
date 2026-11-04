// fase241-cargar-datos-sura-fuga.test.js — Fase 241 (bug reportado por Edwin,
// 04/11): en Cargar datos, despues de elegir SURA y cambiar a otro cliente,
// la seccion de SURA se seguia viendo abajo. Dos causas: (A) la hoja de SURA
// (shadow DOM) declara :host{display:block}, que le gana al [hidden]; (B) si
// se cambiaba de cliente mientras SURA cargaba, al terminar SURA se volvia a
// mostrar. Cada cliente muestra solo lo suyo.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PUB = path.join(__dirname, '..', '..', 'public');

test('(A) la página oculta el panel de SURA aunque su hoja declare :host{display:block}', () => {
  const css = fs.readFileSync(path.join(PUB, 'css', 'styles.css'), 'utf8');
  assert.match(css, /#cc-stv-host\[hidden\]\{display:none;\}/);
  // la causa sigue en la hoja de SURA (generada; no se toca)
  assert.match(fs.readFileSync(path.join(PUB, 'css', 'sura-televentas-app.css'), 'utf8'), /:host\{[^}]*display:block/);
});

function extraer(src, firma) {
  const i = src.indexOf(firma);
  return src.slice(i, src.indexOf('\n}\n', i) + 2);
}

// _ccCargar / _ccCargarTeleventas reales, con SURA que tarda en cargar.
function sandbox() {
  const els = {
    'cc-body': { innerHTML: '' },
    'cc-stv-host': { hidden: true },
    'cc-migas': { innerHTML: '' },
    'cc-anio': { closest: () => ({ hidden: false }) },
  };
  let soltarSura;
  const ctx = {
    _cc: { cliente: 'SURA', anio: 2026, modulo: null },
    document: { getElementById: (id) => els[id] },
    esc: (s) => String(s),
    stvEsTeleventas: (c) => c === 'SURA',
    stvMontarCarga: () => new Promise((res) => { soltarSura = () => res({ puedeEditar: true }); }),
    stvDesmontarCarga: () => {},
    apiRequest: async (m, url) => (url.includes('/versiones') ? { versiones: [] } : { modulos: [{ id: 'trafico' }] }),
    _ccRender: () => { els['cc-body'].innerHTML = 'tarjetas de ' + ctx._cc.cliente; },
  };
  vm.createContext(ctx);
  const src = fs.readFileSync(path.join(PUB, 'js', 'centro-cargas.js'), 'utf8');
  vm.runInContext('var _ccGeneracion = 0;\n' + extraer(src, 'async function _ccCargar()').replace(/^\s*var _ccGeneracion = 0;\n/m, '') + extraer(src, 'async function _ccCargarTeleventas(') + extraer(src, 'function _ccOcultarTeleventas('), ctx);
  return { ctx, els, soltar: () => soltarSura() };
}

test('(B) SURA llega tarde después de cambiar a ORLANT: no vuelve a mostrarse ni pisa el contenido', async () => {
  const { ctx, els, soltar } = sandbox();
  const cargaSura = ctx._ccCargar();          // elige SURA (queda cargando)
  ctx._cc.cliente = 'ORLANT';
  await ctx._ccCargar();                       // cambia a ORLANT antes de que SURA termine
  assert.equal(els['cc-body'].innerHTML, 'tarjetas de ORLANT');
  soltar();                                    // ahora sí termina SURA
  await cargaSura;
  assert.equal(els['cc-stv-host'].hidden, true, 'SURA sigue oculta');
  assert.equal(els['cc-body'].innerHTML, 'tarjetas de ORLANT', 'no pisa lo de ORLANT');
});

test('SURA sola (sin cambiar) sí se muestra', async () => {
  const { ctx, els, soltar } = sandbox();
  const carga = ctx._ccCargar();
  soltar();
  await carga;
  assert.equal(els['cc-stv-host'].hidden, false);
  assert.match(els['cc-body'].innerHTML, /Televentas/);
});
