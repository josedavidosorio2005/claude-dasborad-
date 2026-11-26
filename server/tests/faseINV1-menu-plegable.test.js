// faseINV1-menu-plegable.test.js — Fase INV1 (pedido de Edwin, 26/11/2026): el menú del Inventario va en secciones
// plegables («Menú», «Ciclo de elementos», «Gestión»), con los pasos 1–5 y los contadores, como su HTML. En una sección
// plegada solo queda a la vista la pantalla abierta; en el celular (≤ 760 px) se ve todo. Conteos INVENTADOS.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

global.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const UI = require(path.join(__dirname, '..', '..', 'public', 'js', 'activos.js'));
const resumen = { total: 20, porEstado: { libre: 7, en_uso: 9, en_reparacion: 3, malo: 1 }, actasPorFirmar: 2 };
const boton = (html, vista) => (html.match(new RegExp('<button type="button" class="([^"]*)" data-ac-vista="' + vista + '"')) || [])[1];

test('tres secciones como botones con aria-expanded; pasos 1–5 y contadores', () => {
  const html = UI.activosMenuHtml('sistemas', 'panel', resumen);
  for (const s of ['Menú', 'Ciclo de elementos', 'Gestión']) {
    assert.ok(html.includes('<button type="button" class="ac-menu-sec" aria-expanded="true" onclick="activosPlegarSeccion(\'' + esc(s) + '\')">' + esc(s) + '<span aria-hidden="true">▾</span></button>'), s);
  }
  const pasos = [...html.matchAll(/<span class="ac-paso" aria-hidden="true">(\d)<\/span>/g)].map((m) => m[1]);
  assert.deepEqual(pasos, ['1', '2', '3', '4', '5']);
  assert.match(html, /data-ac-vista="libres"[^]*?<span class="ac-menu-n">7<\/span>/);
  assert.match(html, /data-ac-vista="actas"[^]*?<span class="ac-menu-n">2<\/span>/);
});

test('plegar «Ciclo de elementos»: sus pantallas se ocultan, menos la abierta; las otras secciones no cambian', () => {
  const html = UI.activosMenuHtml('sistemas', 'libres', resumen, '', { 'Ciclo de elementos': true });
  assert.ok(html.includes('aria-expanded="false" onclick="activosPlegarSeccion(\'Ciclo de elementos\')">Ciclo de elementos<span aria-hidden="true">▸</span>'));
  for (const v of ['registrar', 'asignados', 'reparacion', 'malos']) assert.equal(boton(html, v), 'ac-menu-btn ac-menu-oculto', v);
  assert.equal(boton(html, 'libres'), 'ac-menu-btn', 'la pantalla abierta queda a la vista');
  for (const v of ['panel', 'agentes', 'actas']) assert.equal(boton(html, v), 'ac-menu-btn', v);
});

test('CSS: lo plegado se oculta, pero en el celular se ve todo; activosPlegarSeccion vuelve a pintar el menú', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'css', 'styles.css'), 'utf8');
  assert.match(css, /\n\.ac-menu-oculto\{display:none\}/);
  assert.match(css, /@media \(max-width: 760px\)\{[\s\S]{0,300}?\.ac-menu-sec\{display:none\}\n  \.ac-menu-oculto\{display:flex\}/);
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'activos.js'), 'utf8');
  assert.match(src, /function activosPlegarSeccion\(sec\) \{\n  _ac\.plegadas = _ac\.plegadas \|\| \{\};\n  _ac\.plegadas\[sec\] = !_ac\.plegadas\[sec\];\n  _acPintarMenu\(\);/);
});
