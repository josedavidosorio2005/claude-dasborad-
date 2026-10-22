// fase164-encabezado-movil.test.js — Fase 164, lote 1 (auditoria de diseno):
// D-01: en el telefono (375 px) "X Cerrar" del tablero quedaba fuera de la
// pantalla (x=371): los botones del encabezado iban en una sola fila sin
// wrap. D-07: el isotipo de la barra se aplastaba en <=768 px (35x26 de una
// imagen casi cuadrada) porque el CSS bajaba solo el alto.
// Lee index.html y styles.css como texto (mismo criterio que las pruebas de
// la Fase 133/144); la verificacion en navegador real esta en el PR.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const PUB = path.join(__dirname, '..', '..', 'public');
const HTML = fs.readFileSync(path.join(PUB, 'index.html'), 'utf8');
const CSS = fs.readFileSync(path.join(PUB, 'css', 'styles.css'), 'utf8');

// Cuerpo de cada @media(max-width:Npx){...} (llaves balanceadas).
function bloquesMedia(ancho) {
  const out = [];
  const re = new RegExp('@media\\s*\\(max-width:\\s*' + ancho + 'px\\)\\s*\\{', 'g');
  let m;
  while ((m = re.exec(CSS))) {
    let i = m.index + m[0].length, prof = 1;
    while (prof && i < CSS.length) { if (CSS[i] === '{') prof++; else if (CSS[i] === '}') prof--; i++; }
    out.push(CSS.slice(m.index + m[0].length, i - 1));
  }
  return out.join('\n');
}

test('D-01: el grupo de botones del encabezado y "X Cerrar" tienen nombre propio', () => {
  const grupo = HTML.match(/<div class="gd-header-acciones"[^>]*>([\s\S]*?)<\/div>/);
  assert.ok(grupo, 'falta el contenedor .gd-header-acciones');
  assert.match(grupo[1], /<button class="aurora-close" id="gd-cerrar-btn" onclick="closeGenericDashboard\(\)">X Cerrar<\/button>/);
  assert.match(grupo[1], /id="gd-export-btn"/);
});

test('D-01: en <=480 px los botones envuelven y Cerrar queda fijo arriba a la derecha', () => {
  const m480 = bloquesMedia(480);
  assert.match(m480, /#gd-modal \.gd-header-acciones\{flex-wrap:wrap;\}/);
  assert.match(m480, /#gd-modal #gd-cerrar-btn\{position:absolute;top:12px;right:12px;\}/);
  // reserva espacio para que el titulo no pase por debajo de Cerrar
  assert.match(m480, /#gd-modal \.aurora-header > div:first-child > div:first-child\{padding-right:96px;\}/);
  // el encabezado del tablero es sticky: es la referencia del absolute
  assert.match(CSS, /#gd-modal \.aurora-header\{position:sticky;/);
});

test('D-07: en <=768 px el isotipo baja de alto sin deformarse (width:auto)', () => {
  assert.match(bloquesMedia(768), /\.navbar-logo-icon\{height:26px;width:auto;\}/);
});
