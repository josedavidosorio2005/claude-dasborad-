// faseQA-auditoria-24nov.test.js — Auditoría de diseño y bugs del 24/11 (local, datos inventados).
// Cada arreglo de prioridad alta o media tiene su prueba aquí.
'use strict';
process.env.TZ = 'UTC'; // como el servidor de producción (Docker en UTC)
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const CSS = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'css', 'styles.css'), 'utf8');
const regla = (sel) => { const i = CSS.indexOf(sel + '{'); assert.ok(i >= 0, 'falta la regla ' + sel); return CSS.slice(i, CSS.indexOf('}', i)); };
// Contraste WCAG entre dos colores #rrggbb.
function contraste(a, b) {
  const l = (h) => { const [r, g, bl] = [1, 3, 5].map((i) => { const x = parseInt(h.slice(i, i + 2), 16) / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * bl; };
  const [x, y] = [l(a), l(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05);
}
// Valor de un token en claro (primer :root) y en oscuro (:root[data-theme="dark"]).
function token(nombre, oscuro) {
  const ini = oscuro ? CSS.indexOf(':root[data-theme="dark"]') : CSS.indexOf(':root');
  const bloque = CSS.slice(ini, CSS.indexOf('\n}', ini));
  const m = bloque.match(new RegExp('--' + nombre + ':\\s*#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\\b'));
  if (m) return '#' + (m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1]).toLowerCase();
  assert.ok(oscuro, 'token ' + nombre);
  return token(nombre, false); // no cambia en oscuro
}

test('Inventario: títulos de las gráficas y menú seleccionado con contraste AA en claro y oscuro', () => {
  assert.match(regla('.acp-card h4'), /color:var\(--c-primary\)/, 'no --c-brand-blue como texto (sistema de diseño)');
  assert.match(regla('.ac-menu-btn[aria-current="page"]'), /background:var\(--c-brand\);color:var\(--c-on-brand\)/);
  for (const oscuro of [false, true]) {
    assert.ok(contraste(token('c-primary', oscuro), token('c-surface', oscuro)) >= 4.5, 'título sobre la tarjeta, oscuro=' + oscuro);
    assert.ok(contraste(token('c-brand', oscuro), token('c-on-brand', oscuro)) >= 4.5, 'menú seleccionado, oscuro=' + oscuro);
  }
});

test('Inventario, movimientos por mes: en hora de Colombia, no en la del servidor (UTC)', async () => {
  const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');
  const P = require('../activos-panel');
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const r = await request(app).post('/api/activos').set({ Authorization: 'Bearer ' + admin }).send({ tipo: 'MOUSE', codigo: 'QA-24NOV-1' });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const id = r.body.activo.id;
  db.prepare('DELETE FROM activos_historial WHERE activoId = ?').run(id); // solo el movimiento de la prueba
  // 30/11 a las 11:30 p. m. en Colombia = 1/12 a las 4:30 a. m. UTC.
  const ts = Date.parse('2026-12-01T04:30:00Z');
  db.prepare('INSERT INTO activos_historial (activoId, ts, fecha, accion, estadoAntes, estadoDespues, motivo, quien) VALUES (?,?,?,?,?,?,?,?)')
    .run(id, ts, '2026-11-30', 'Ingreso', null, 'libre', 'inventado', 'prueba');
  // «Ahora» = 30/11 a las 10 p. m. en Colombia (1/12 a las 3 a. m. UTC): el último mes del gráfico es noviembre.
  const p = P.panel(db, 'sistemas', '', '2026-12-01T03:00:00Z');
  assert.deepEqual(p.movimientos.map((m) => m.mes), ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11']);
  assert.equal(p.movimientos[5].ingresos, 1, 'el ingreso del 30/11 en la noche cuenta en noviembre');
  // El 1/12 a las 12:30 a. m. de Colombia ya es diciembre, y el ingreso del 30/11 sigue en noviembre.
  const q = P.panel(db, 'sistemas', '', '2026-12-01T05:30:00Z');
  assert.equal(q.movimientos[5].mes, '2026-12');
  assert.equal(q.movimientos[4].ingresos, 1);
});

test('Inventario, Panel general: filtros y botones (Excel, Registrar ingreso) de 44 px en el celular', () => {
  assert.ok(CSS.includes('@media (max-width:768px){.acp-chip,.acp-btn{min-height:44px}}'));
});

test('Malla del supervisor: entrada y salida de 44 px en el celular (como las pausas)', () => {
  assert.ok(CSS.includes('.ml-tabla-dia input[type="time"],.ml-tabla input[type="time"]{min-height:44px}')); // 26/11: el cuadro único
});

test('Calidad (Calificar y Calidad de encuestas): selectores de campaña y de mes de 44 px en el celular', () => {
  assert.ok(CSS.includes('@media (max-width:768px){#cal-campana-sel,#cal-mes-sel{min-height:44px}}'));
  const html = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'index.html'), 'utf8');
  for (const id of ['cal-campana-sel', 'cal-mes-sel']) assert.ok(!new RegExp('id="' + id + '"[^>]*style="[^"]*(height|min-height)\s*:').test(html), id + ' sin alto fijo en línea que gane al CSS');
});

test('Portal Asesor: la insignia de monitoreos nuevos pasa AA también en oscuro', () => {
  assert.ok(CSS.includes('[data-theme="dark"] .asesor-badge-nuevos{background:var(--c-danger-bg);color:var(--c-danger-dark);border:1px solid var(--c-danger-dark)}'));
  assert.ok(contraste(token('c-danger-dark', false), '#ffffff') >= 4.5, 'claro: blanco sobre rojo');
  assert.ok(contraste(token('c-danger-dark', true), token('c-danger-bg', true)) >= 4.5, 'oscuro: rojo claro sobre fondo rojo oscuro');
  const html = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'index.html'), 'utf8');
  assert.ok(!/id="asesor-menu-calidad-badge"[^>]*style=/.test(html), 'sin estilo en línea que gane al tema oscuro');
});
