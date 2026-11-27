// faseINV1-panel-sin-baja.test.js — Fase INV1 (pedido de Edwin, 26/11/2026): el Panel general del Inventario no
// muestra los dados de baja (ni en la dona de estados ni en las barras por tipo, sede u operación) y no dice «sin los
// dados de baja». Siguen en la lista (filtro por estado) y en el historial. Panel INVENTADO.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

global.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const UI = require(path.join(__dirname, '..', '..', 'public', 'js', 'activos.js'));

const est = { en_uso: 6, libre: 3, en_reparacion: 1, malo: 0, de_baja: 10 };
const fila = (nombre, porEstado) => ({ codigo: nombre, nombre, porEstado, total: Object.values(porEstado).reduce((a, b) => a + b, 0) });
const panel = {
  tipo: '', tipos: [{ codigo: 'TORRE', nombre: 'Torre' }], total: 20, porEstado: est, porRendimiento: null,
  agentes: { activos: 4, conEquipo: 3 }, actasPendientes: 0,
  porTipo: [fila('TORRE', est)], porSede: [fila('SEDE INVENTADA', est)], porOperacion: [fila('OPERACION INVENTADA', est)],
  marcas: [], valor: { porTipo: [], total: 0, sinPrecio: 0 }, renta: { porProveedor: [], total: 0, n: 0 }, calidad: [], movimientos: [{ mes: '2026-11', ingresos: 0 }],
};

test('el panel no muestra los dados de baja ni el texto «sin los dados de baja»', () => {
  const html = UI.activosPanel2Html(panel);
  assert.doesNotMatch(html, /dados de baja|Dados de baja|de_baja/i);
  assert.match(html, /Cuántos están en uso, libres, en reparación o malos\./);
  assert.match(html, /10 elementos en total/, 'el total del panel es sin los dados de baja (20 − 10)');
  assert.match(html, /60% en uso/, '6 de 10, no 6 de 20');
});

test('la lista y el historial no cambian: el estado «Dado de baja» sigue existiendo para filtrar', () => {
  assert.equal(UI.AC_VISTA_ESTADO !== undefined, true);
  const src = require('fs').readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'activos.js'), 'utf8');
  assert.match(src, /de_baja: 'Dado de baja'/);
});
