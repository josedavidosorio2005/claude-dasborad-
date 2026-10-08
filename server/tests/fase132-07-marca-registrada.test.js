// fase132-07-marca-registrada.test.js — Fase 132 (cierre): el manual de
// marca pide "InConexion®" (SIN tilde, SIEMPRE con el símbolo ®) en los
// textos visibles de la plataforma. Esta prueba falla si vuelve a aparecer
// "InConexión" (con tilde) en public/index.html, o si el nombre de marca
// aparece en un texto visible sin el ® -- para que un cambio futuro no
// rompa esto otra vez sin que nadie lo note.
//
// Excepciones a propósito (no son un bug):
// - atributos alt="InConexion" de las imágenes del logo (el PNG ya trae
//   el ® dibujado -- no se duplica en el texto alternativo).
// - "InConexion SAS": nombre legal de la empresa (sufijo societario),
//   no es el uso de marca del producto.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const INDEX_PATH = path.join(__dirname, '..', '..', 'public', 'index.html');
const html = fs.readFileSync(INDEX_PATH, 'utf8');

test('index.html nunca usa "InConexión" con tilde', () => {
  const conTilde = [...html.matchAll(/InConexión/g)];
  assert.equal(conTilde.length, 0, 'se encontraron ' + conTilde.length + ' uso(s) de "InConexión" con tilde -- el nombre va sin tilde, con ®');
});

test('las 4 navbars (Admin, Cliente, Asesor, Supervisor) muestran InConexion®', () => {
  const navbars = [...html.matchAll(/<span class="navbar-logo-text">([^<]*(?:<sup>®<\/sup>)?[^<]*)<\/span>/g)];
  assert.equal(navbars.length, 4, 'se esperaban 4 navbars con .navbar-logo-text, se encontraron ' + navbars.length);
  navbars.forEach((m) => {
    assert.match(m[1], /^InConexion<sup>®<\/sup>/, '.navbar-logo-text debería empezar con "InConexion<sup>®</sup>", es: ' + m[1]);
  });
});

test('el <title> de la pestaña usa InConexion®', () => {
  const m = html.match(/<title>([^<]+)<\/title>/);
  assert.ok(m, 'no se encontró <title>');
  assert.equal(m[1], 'InConexion® Platform');
});

test('ningún texto visible de index.html usa el nombre de marca sin ® (fuera de las excepciones documentadas)', () => {
  const texto = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    // "InConexion<sup>®</sup>" -> "InConexion®": el superíndice es parte
    // del mismo texto visible, no un corte entre nodos de texto distintos.
    .replace(/<sup>®<\/sup>/g, '®')
    // el resto de etiquetas (y sus atributos, como alt="InConexion") no
    // son texto renderizado -- se quitan, con un espacio para no unir
    // palabras de nodos de texto distintos.
    .replace(/<[^>]+>/g, ' ');

  const sinMarca = [...texto.matchAll(/InConexion(?!®|\s+SAS\b)/g)];
  assert.equal(
    sinMarca.length,
    0,
    'texto visible con "InConexion" sin ® (excepto "InConexion SAS"): ' +
      sinMarca.map((m) => texto.slice(Math.max(0, m.index - 20), m.index + 20)).join(' | ')
  );
});
