// faseSTA15-agendas-asesor-gestiones-dia.test.js — pedidos de Edwin (27/11/2026) para la Gestión STA (Gráficas del
// administrador y vista del cliente de ORLANT, mismo STA_MARKUP):
//  1) «Agendas por asesor» como por entidad y por servicio: un solo número por barra, «N agendas» con el valor de
//     citas (valAgendas = el más alto entre casos agendados y citas); largo y orden por ese número; sin «citas».
//  2) «Gestiones por día»: solo la línea de Gestiones (sin la de Citas ni su leyenda); subtítulo «Casos codificados
//     cada día hábil». Sin cambiar datos.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { STA_MARKUP } = require('../../public/js/orlant-sta-app.js');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'orlant-sta-app.js'), 'utf8');
const tarjeta = (id) => { const i = STA_MARKUP.indexOf('id="' + id + '"'); return STA_MARKUP.slice(STA_MARKUP.lastIndexOf('<div class="card', i), i); };
const bloque = (desde, hasta) => SRC.slice(SRC.indexOf(desde), SRC.indexOf(hasta, SRC.indexOf(desde)));

test('Agendas por asesor: «N agendas» con valAgendas; largo y orden por ese número; sin «citas»', () => {
  const b = bloque('// 1. Agendas por asesor', "$('grAgAs').innerHTML=hbarSVG");
  assert.match(b, /v=valAgendas\(\{n:o\.e,citas:o\.citas\}\); return \{label:a\.nombre,vals:\[v\],etq:`\$\{fmt\(v\)\} agendas`,/);
  assert.match(b, /\.sort\(\(x,y\)=>y\.vals\[0\]-x\.vals\[0\]/);
  const visible = b.replace(/\/\/[^\n]*/g, '').replace(/o\.citas|citas:o\.citas/g, '');
  assert.doesNotMatch(visible, /citas/i, 'ni en la etiqueta, el detalle ni el aviso vacío');
  const card = tarjeta('grAgAs');
  assert.match(card, /<h3>Agendas por asesor<\/h3><p class="nota">Agendas de cada asesor<\/p>/);
  assert.doesNotMatch(card, /citas/i);
  // valAgendas: el número de citas, que es el más alto (mismo de entidad y servicio).
  const valAgendas = new Function(SRC.match(/function valAgendas\(o\)\{[^}]*\}/)[0] + '; return valAgendas;')();
  assert.equal(valAgendas({ n: 58, citas: 79 }), 79);
  assert.equal(valAgendas({ n: 5, citas: 0 }), 5);
});

test('Gestiones por día: solo la línea de Gestiones, sin leyenda de Citas; subtítulo sin «citas»', () => {
  assert.match(SRC, /const serD=\[\{nombre:'Gestiones',color:G_LIN,vals:dias\.map\(x=>gs\.filter\(c=>c\._fg\.startsWith\(x\)\)\.length\)\}\];\n    \$\('grDia'\)\.innerHTML=lineaSVG\('grDia',dias,serD\);/);
  assert.doesNotMatch(SRC, /nombre:'Citas'/);
  const card = tarjeta('grDia');
  assert.match(card, /<h3>Gestiones por día<\/h3><p class="nota">Casos codificados cada día hábil<\/p>/);
  assert.doesNotMatch(card, /citas/i);
});

test('las dos vistas montan el mismo markup', () => {
  const vistas = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'orlant-sta.js'), 'utf8');
  assert.equal((vistas.match(/_staHojaCss\(\) \+ STA_MARKUP/g) || []).length, 2);
});
