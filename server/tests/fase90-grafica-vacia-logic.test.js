// fase90-grafica-vacia-logic.test.js — Fase 90, tema A (hallazgo real: la
// pastilla "Nivel de Servicio" de Trafico de WhatsApp quedaba en blanco,
// sin ningun mensaje, cuando la serie principal (5 min) no tenia dato
// para el periodo). Estas 2 funciones puras son la logica de DECISION que
// antes vivia inline en _gdChart/_traficoDibujarSL (dashboard-generic.js/
// trafico.js, sin doble modo -- la insercion real del aviso en el DOM se
// verifica con Playwright).
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { gdGraficaEstaVacia, gdSerieSinDatoAvisoNecesario } = require('../../public/js/grafica-vacia-logic.js');

// ── gdGraficaEstaVacia ───────────────────────────────────────────────────
test('gdGraficaEstaVacia: TODAS las series sin ningun dato -> vacia (el caso que _gdChart ya cubria)', () => {
  const cfg = { data: { labels: ['2026-08'], datasets: [{ data: [null] }, { data: [undefined] }] } };
  assert.equal(gdGraficaEstaVacia(cfg), true);
});

test('gdGraficaEstaVacia: 2 series, UNA con dato (el hallazgo real: WhatsApp 5 min null, 20s con dato) -> NO esta vacia', () => {
  const cfg = { data: { labels: ['2026-08'], datasets: [{ data: [null] }, { data: [34.67] }] } };
  assert.equal(gdGraficaEstaVacia(cfg), false, 'debe seguir dibujando la serie que SI tiene dato, nunca en blanco');
});

test('gdGraficaEstaVacia: una sola serie con dato real -> no esta vacia (caso normal, Llamadas)', () => {
  const cfg = { data: { labels: ['2026-08'], datasets: [{ data: [87.66] }] } };
  assert.equal(gdGraficaEstaVacia(cfg), false);
});

test('gdGraficaEstaVacia: sin labels, sin cfg, o sin data -> vacia', () => {
  assert.equal(gdGraficaEstaVacia(null), true);
  assert.equal(gdGraficaEstaVacia({}), true);
  assert.equal(gdGraficaEstaVacia({ data: {} }), true);
  assert.equal(gdGraficaEstaVacia({ data: { labels: [] } }), true);
});

test('gdGraficaEstaVacia: un 0 (dato real, ej. 0% de nivel de servicio) NO cuenta como "sin dato"', () => {
  const cfg = { data: { labels: ['2026-08'], datasets: [{ data: [0] }] } };
  assert.equal(gdGraficaEstaVacia(cfg), false, '0 es un dato real, distinto de null/undefined');
});

// ── gdSerieSinDatoAvisoNecesario ─────────────────────────────────────────
test('gdSerieSinDatoAvisoNecesario: principal SIN dato, secundaria CON dato -> hace falta el aviso especifico (el hallazgo real)', () => {
  assert.equal(gdSerieSinDatoAvisoNecesario([null, null], [34.67, 32.18]), true);
});

test('gdSerieSinDatoAvisoNecesario: las dos series CON dato -> no hace falta aviso', () => {
  assert.equal(gdSerieSinDatoAvisoNecesario([98.38, 97.1], [34.67, 32.18]), false);
});

test('gdSerieSinDatoAvisoNecesario: las dos series SIN dato -> no hace falta ESTE aviso (ese caso lo cubre gdGraficaEstaVacia, el aviso generico)', () => {
  assert.equal(gdSerieSinDatoAvisoNecesario([null, null], [null, null]), false);
});

test('gdSerieSinDatoAvisoNecesario: principal CON dato, secundaria SIN dato -> no hace falta (la principal es la que importa mostrar)', () => {
  assert.equal(gdSerieSinDatoAvisoNecesario([98.38], [null]), false);
});
