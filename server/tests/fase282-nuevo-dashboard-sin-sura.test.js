// fase282-nuevo-dashboard-sin-sura.test.js — Fase 282: Admin › Dashboards › «Nuevo
// dashboard» ofrecia SURA como cliente «libre» para armar un tablero generico,
// aunque SURA ya tiene su tablero propio (Televentas): la lista solo quitaba los
// clientes con tablero generico. Ahora usa la misma regla que los portales
// (dashClienteTieneTablero, Fase 281). Registro SINTETICO.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PUB = path.join(__dirname, '..', '..', 'public', 'js');
const L = require(path.join(PUB, 'dashboards-logic.js'));
const CLIENTES = ['ORLANT', 'MOBILIZE', 'SURA', 'OTRO PROPIO', 'CLIENTE NUEVO', 'CLIENTE DOS'];
const GENERICOS = ['ORLANT', 'MOBILIZE'];
// SURA con su tablero propio; "OTRO PROPIO" simula otro cliente con tablero propio futuro.
const REGISTRO = CLIENTES.map((c) => ({ nombre: c, parametros: { especificos: c === 'SURA' || c === 'OTRO PROPIO' ? ['sura_televentas'] : [] } }));

test('regla: libres = sin tablero generico ni propio; al editar, el que se edita siempre queda', () => {
  assert.deepEqual(L.dashClientesLibres(CLIENTES, GENERICOS, REGISTRO, null), ['CLIENTE NUEVO', 'CLIENTE DOS']);
  assert.deepEqual(L.dashClientesLibres(CLIENTES, GENERICOS, REGISTRO, 'ORLANT'), ['ORLANT', 'CLIENTE NUEVO', 'CLIENTE DOS']);
  assert.deepEqual(L.dashClientesLibres(CLIENTES, GENERICOS, [], null), ['SURA', 'OTRO PROPIO', 'CLIENTE NUEVO', 'CLIENTE DOS'], 'sin registro, como antes');
});

// openDashCfgModal REAL (public/js/dashboards-admin.js) con un DOM minimo.
async function abrirNuevo(cliente) {
  const nodos = {};
  const nodo = (id) => (nodos[id] = nodos[id] || { id, innerHTML: '', textContent: '', value: '', classList: { add() {}, remove() {}, toggle() {} }, style: {}, addEventListener() {}, querySelector: () => null, querySelectorAll: () => [] });
  const ctx = {
    console, setTimeout,
    document: { getElementById: nodo, querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, createElement: () => nodo('x' + Math.random()) },
    window: {},
    esc: (s) => String(s == null ? '' : s), showToast() {},
    apiRequest: async () => ({ cliente, titulo: 'T', layout: { tabs: [] }, secciones: [], kpis: [] }),
    CLIENTES_LIST: CLIENTES, BUILT_CLIENT_DASHBOARDS: GENERICOS, REGISTRO_CLIENTES: REGISTRO,
    dashClientesLibres: L.dashClientesLibres, dashClienteTieneTablero: L.dashClienteTieneTablero,
    motionAbrirModal() {}, motionAbrirDialogo() {},
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(PUB, 'dashboards-admin.js'), 'utf8'), ctx, { filename: 'dashboards-admin.js' });
  await ctx.openDashCfgModal(cliente);
  const html = Object.values(nodos).map((n) => n.innerHTML).join('\n');
  const sel = html.match(/<select id="dc-cliente"[^>]*>([\s\S]*?)<\/select>/);
  return { opciones: sel ? [...sel[1].matchAll(/<option[^>]*>([^<]*)<\/option>/g)].map((m) => m[1]) : null, elegido: ctx._dcState && ctx._dcState.cliente, html };
}

test('«Nuevo dashboard»: no ofrece SURA ni otro cliente con tablero propio; el elegido por defecto es libre', async () => {
  const r = await abrirNuevo(null);
  assert.deepEqual(r.opciones, ['CLIENTE NUEVO', 'CLIENTE DOS'], 'antes salian tambien SURA y OTRO PROPIO');
  assert.equal(r.elegido, 'CLIENTE NUEVO', 'antes el primero libre era SURA');
});

test('«Editar dashboard» de un cliente existente: sigue igual (el cliente fijo, sin lista)', async () => {
  const r = await abrirNuevo('ORLANT');
  assert.equal(r.opciones, null, 'al editar, el cliente no se cambia');
  assert.match(r.html, /value="ORLANT" aria-label="Cliente" disabled/);
});
