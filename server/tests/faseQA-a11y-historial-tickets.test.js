// faseQA-a11y-historial-tickets.test.js — Revisión con axe-core del 25/11 (local, base de demostración):
//   (a) la tabla del Historial se desplazaba solo con el mouse a 375 y 768 px (scrollable-region-focusable);
//   (b) la tarjeta «Sugerencias / Tickets» tenía un nombre accesible sin su texto visible (label-content-name-mismatch);
//   (c) el código de la ventana del Inventario anterior (retirado en la Fase 383) seguía en la página.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const PUB = path.join(__dirname, '../../public');
const html = fs.readFileSync(path.join(PUB, 'index.html'), 'utf8');

test('(a) el contenedor de la tabla del Historial recibe el foco y tiene nombre (se desplaza con el teclado)', () => {
  const m = html.match(/<div class="table-wrap" id="hist-table-wrap"([^>]*)>\s*<table><thead><tr>\s*<th>Fecha y Hora<\/th>/);
  assert.ok(m, 'falta el contenedor de la tabla del Historial');
  assert.match(m[1], /tabindex="0"/);
  assert.match(m[1], /role="region"/);
  assert.match(m[1], /aria-label="[^"]+"/);
  // El foco visible ya lo da la regla global [tabindex]:focus-visible.
  assert.match(fs.readFileSync(path.join(PUB, 'css/styles.css'), 'utf8'), /\[tabindex\]:focus-visible/);
});
