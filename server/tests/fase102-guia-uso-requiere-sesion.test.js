// fase102-guia-uso-requiere-sesion.test.js — Fase 102 (auditoria de
// seguridad, hallazgo real). La guia de uso (docs/guia-uso-orlant.md,
// public antes) se servia como archivo ESTATICO por express.static, sin
// pasar por ningun middleware de auth -- cualquiera con la URL
// (https://informa.inconexion.com.co/guia-uso.html) la veia sin iniciar
// sesion: nombre del cliente y la estructura exacta (archivo/hoja/columnas
// obligatorias) de cada base que carga ORLANT. Ahora vive fuera de
// public/ (server/paginas/guia-uso.html) y solo se entrega por
// GET /api/guia-uso, protegido con requireActor.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { request, app, tokenFor, MASTER_PASSWORD } = require('./helpers');

const auth = (t) => ({ Authorization: `Bearer ${t}` });

test('GET /api/guia-uso sin token -> 401 (antes era un archivo publico sin ninguna proteccion)', async () => {
  const res = await request(app).get('/api/guia-uso');
  assert.equal(res.status, 401);
});

test('GET /api/guia-uso con token invalido -> 401', async () => {
  const res = await request(app).get('/api/guia-uso').set(auth('no-es-un-jwt-real'));
  assert.equal(res.status, 401);
});

test('GET /api/guia-uso con sesion valida -> 200, trae el HTML completo de la guia', async () => {
  const t = await tokenFor('admin', MASTER_PASSWORD);
  const res = await request(app).get('/api/guia-uso').set(auth(t));
  assert.equal(res.status, 200);
  assert.match(res.headers['content-type'], /html/);
  assert.match(res.text, /Guía de uso/);
  assert.match(res.text, /ORLANT/);
});

test('la pagina ya no existe bajo public/ (nunca servida por express.static sin auth)', () => {
  const rutaVieja = path.join(__dirname, '..', '..', 'public', 'guia-uso.html');
  assert.equal(fs.existsSync(rutaVieja), false, 'guia-uso.html no debe vivir en public/');
  const rutaNueva = path.join(__dirname, '..', 'paginas', 'guia-uso.html');
  assert.ok(fs.existsSync(rutaNueva), 'la pagina debe existir en server/paginas/, fuera del estatico');
});

// GET /guia-uso.html (sin /api, el viejo camino estatico) ya no debe
// devolver la guia -- cae al catch-all del SPA (200, index.html) porque
// el archivo ya no esta en public/, pero NUNCA el contenido de la guia.
test('GET /guia-uso.html (sin /api) ya no sirve el contenido de la guia', async () => {
  const res = await request(app).get('/guia-uso.html');
  assert.ok(!/Cómo entrar/.test(res.text));
});
