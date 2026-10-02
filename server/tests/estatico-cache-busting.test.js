// tests/estatico-cache-busting.test.js — Fase 67.
//
// Causa raiz de "produccion sigue sirviendo la plantilla vieja": un usuario
// con una pestaña ya abierta antes de un deploy sigue ejecutando el JS viejo
// (ningun deploy empuja codigo a una pestaña abierta), y ademas cualquiera
// que recargara dentro de la ventana de Cache-Control: max-age=300 podia
// recibir JS/CSS viejo del cache del navegador sin pasar por el servidor.
// Ver server.js (seccion "Frontend estatico + fallback SPA").
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { request, app } = require('./helpers');

test('index.html trae los scripts/estilos locales con ?v= (cache-busting), sin CDN externo', async () => {
  const res = await request(app).get('/');
  assert.equal(res.status, 200);
  assert.equal(res.headers['cache-control'], 'no-cache');

  const cargasTag = res.text.match(/src="js\/cargas\.js(\?v=\d+)?"/);
  assert.ok(cargasTag, 'no se encontro <script src="js/cargas.js"> en index.html');
  assert.ok(cargasTag[1], 'js/cargas.js deberia llevar ?v=<build id>');

  const cssTag = res.text.match(/href="css\/styles\.css(\?v=\d+)?"/);
  assert.ok(cssTag, 'no se encontro <link href="css/styles.css"> en index.html');
  assert.ok(cssTag[1], 'css/styles.css deberia llevar ?v=<build id>');

  // Fase 114: SheetJS se sirve ahora desde la propia app (public/js/vendor/,
  // con integrity) -- ya no hay ningun script/estilo externo que versionar
  // distinto, y ningun <script src="https://..."> deberia quedar en la pagina.
  const xlsxTag = res.text.match(/src="(js\/vendor\/xlsx-[^"]+)"[^>]*integrity="(sha384-[^"]+)"/);
  assert.ok(xlsxTag, 'no se encontro el script vendorizado de xlsx con su atributo integrity');
  assert.ok(xlsxTag[1].includes('?v='), 'el xlsx vendorizado deberia llevar ?v=<build id> igual que cualquier script local');

  assert.ok(!/src="https:\/\//.test(res.text), 'no deberia quedar ningun <script src="https://..."> externo');
});

test('el mismo build id se usa en TODOS los scripts locales de una misma respuesta', async () => {
  const res = await request(app).get('/');
  const versiones = [...res.text.matchAll(/(?:src|href)="(?:js|css)\/[^"]*\?v=(\d+)"/g)].map((m) => m[1]);
  assert.ok(versiones.length > 5, 'se esperaban varios scripts/estilos locales versionados');
  const distintos = new Set(versiones);
  assert.equal(distintos.size, 1, 'todos los scripts/estilos locales deberian compartir el mismo ?v=');
});

test('/index.html y el fallback SPA sirven el mismo HTML versionado que "/"', async () => {
  const [raiz, indiceExplicito, fallback] = await Promise.all([
    request(app).get('/'),
    request(app).get('/index.html'),
    request(app).get('/dashboards'), // ruta de la SPA que no es un archivo estatico real
  ]);
  assert.equal(indiceExplicito.status, 200);
  assert.equal(indiceExplicito.headers['cache-control'], 'no-cache');
  assert.equal(indiceExplicito.text, raiz.text);

  assert.equal(fallback.status, 200);
  assert.equal(fallback.headers['cache-control'], 'no-cache');
  assert.equal(fallback.text, raiz.text);
});

test('la URL versionada de un script sirve el archivo real (la query string no rompe el estatico)', async () => {
  const res = await request(app).get('/');
  const m = res.text.match(/src="(js\/cargas\.js\?v=\d+)"/);
  assert.ok(m, 'no se encontro la URL versionada de cargas.js');

  const [versionado, sinVersion] = await Promise.all([
    request(app).get('/' + m[1]),
    request(app).get('/js/cargas.js'),
  ]);
  assert.equal(versionado.status, 200);
  assert.equal(sinVersion.status, 200);
  assert.equal(versionado.text, sinVersion.text, 'el contenido debe ser identico con o sin ?v=');
  assert.equal(versionado.headers['cache-control'], 'public, max-age=300');
});
