// faseSTA13-graficas-edwin.test.js — pedidos de Edwin (reunión 26/11/2026) para las Gráficas de Gestión STA (las mismas en
// el panel del administrador y en la pestaña del cliente de ORLANT): agendas por entidad y por servicio, gestiones por
// entidad y por servicio después de Codificación, números sobre barras y porciones, y TODAS las codificaciones (sin
// «Otros»). Sin cambiar datos: solo la visual. La revisión visual (375/768/1440, claro y oscuro) se hizo aparte con
// Playwright y datos INVENTADOS.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { STA_MARKUP } = require('../../public/js/orlant-sta-app.js');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'orlant-sta-app.js'), 'utf8');

test('las 4 gráficas nuevas, en el orden pedido: agendas por entidad/servicio antes de Codificación y gestiones después', () => {
  const pos = ['grAgAs', 'grAgEnt', 'grAgServ', 'grDona', 'grGeEnt', 'grGeServ', 'grEfec'].map((id) => STA_MARKUP.indexOf('id="' + id + '"'));
  pos.forEach((p, i) => assert.ok(p > 0, 'falta el ' + i));
  for (let i = 1; i < pos.length; i++) assert.ok(pos[i] > pos[i - 1], 'orden ' + i);
  for (const t of ['Agendas por entidad', 'Agendas por servicio', 'Gestiones por entidad', 'Gestiones por servicio']) assert.ok(STA_MARKUP.includes('<h3>' + t + '</h3>'), t);
});

test('se pintan con los mismos filtros: agendas = gestiones efectivas (con citas); gestiones = todas las filtradas', () => {
  assert.match(SRC, /const agen=gs\.filter\(esEf\);/);
  assert.match(SRC, /\[\['grAgEnt','Entidad'\],\['grAgServ','Servicio'\]\]\.forEach[^\n]*filasCampoGest\(agen,campo,true\)/);
  assert.match(SRC, /\[\['grGeEnt','Entidad'\],\['grGeServ','Servicio'\]\]\.forEach[^\n]*filasCampoGest\(gs,campo,false\)/);
});

test('Codificación general: todas las codificaciones, sin «Otros»', () => {
  assert.match(SRC, /const cnt=agrupar\(gs,c=>c\._tipi,Infinity\);/);
  assert.doesNotMatch(SRC, /agrupar\(gs,c=>c\._tipi,7\)/);
});

test('números sobre porciones (dona), columnas (también con más de 14 si caben) y puntos de las líneas; nunca bajo 12 px', () => {
  assert.match(SRC, /segs\+=etiquetasDona\(items,total,cx,cy,\(R\+r\)\/2\);/);
  assert.match(SRC, /class="val-dona"/);
  assert.match(SRC, /if\(tots\[i\]&&\(cats\.length<=14\|\|iw\/cats\.length>=30\)\)/);
  assert.match(SRC, /if\(cats\.length<=45&&iw\/Math\.max\(1,cats\.length\)>=26\) series\.forEach\(\(s,k\)=>s\.vals\.forEach/);
  assert.doesNotMatch(SRC, /font-size:(9|10|11)px/);
  const css = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'css', 'orlant-sta-app.css'), 'utf8');
  assert.match(css, /\.dona svg text\.val-dona\{fill:#fff;font-size:12px;/);
});

test('el archivo sigue cargando en Node y no toca la API (solo visual)', () => {
  assert.equal(typeof require('../../public/js/orlant-sta-app.js').staCrearApp, 'function');
  const diff = SRC.match(/filasCampoGest[\s\S]*?function agrupar/)[0];
  assert.doesNotMatch(diff, /API\.|apiRequest/);
});
