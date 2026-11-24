// gestion-humana.test.js — Fase GH7 (23/11/2026, OK del usuario): la Gestión humana ANTERIOR (personal por
// campaña, Fase 10) se retiró. Sus rutas responden 410 y su tablero 404; la tabla y el rol GESTION_HUMANA
// se conservan, y Talento humano (/gh/estado, /gh/acceso) sigue igual. Las pruebas de su CRUD, validaciones
// y tablero (y fase225-gh-meses) salieron con el módulo: viven en el historial de git.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { request, app, tokenFor, MASTER_PASSWORD, db } = require('./helpers');
const { AVISO } = require('../routes/gestion-humana');

test('las rutas de la Gestión humana anterior responden 410 con el aviso (y 401 sin sesión)', async () => {
  const tk = await tokenFor('admin', MASTER_PASSWORD);
  const H = { Authorization: 'Bearer ' + tk };
  for (const [m, u] of [['get', '/api/gh/personal'], ['get', '/api/gh/personal?estado=activo'], ['get', '/api/gh/resumen'], ['post', '/api/gh/personal'], ['put', '/api/gh/personal/1'], ['delete', '/api/gh/personal/1']]) {
    const r = await request(app)[m](u).set(H).send({});
    assert.equal(r.status, 410, m + ' ' + u);
    assert.equal(r.body.error, AVISO);
    assert.equal(r.headers['cache-control'], 'no-store');
  }
  assert.equal((await request(app).get('/api/gh/personal')).status, 401);
  assert.equal((await request(app).get('/api/dashboard/GESTION_HUMANA').set(H)).status, 404);
});

test('se conservan la tabla y el rol; Talento humano sigue respondiendo', async () => {
  assert.ok(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='gestion_humana_personal'").get(), 'la tabla sigue');
  const tk = await tokenFor('admin', MASTER_PASSWORD);
  const H = { Authorization: 'Bearer ' + tk };
  assert.equal((await request(app).get('/api/gh/acceso').set(H)).status, 200);
  assert.equal((await request(app).get('/api/gh/estado').set(H)).status, 200);
  const roles = fs.readFileSync(path.join(__dirname, '..', 'auth.js'), 'utf8') + fs.readFileSync(path.join(__dirname, '..', 'validation.js'), 'utf8');
  assert.match(roles, /GESTION_HUMANA/);
});

test('la tarjeta y la entrada del menú ya no se muestran', () => {
  const pub = path.join(__dirname, '..', '..', 'public', 'js');
  const constants = fs.readFileSync(path.join(pub, 'constants.js'), 'utf8');
  assert.ok(!/key:'GestionHumana'/.test(constants), 'sin tarjeta «Gestión Humana — Personal por Campaña»');
});

// Fase GH8: el HTML oculto y el JS de la Gestión humana anterior ya no están en la página.
test('sin el HTML ni el JS de la Gestión humana anterior', () => {
  const pub = path.join(__dirname, '..', '..', 'public');
  const html = fs.readFileSync(path.join(pub, 'index.html'), 'utf8');
  for (const id of ['menu-gestionhumana-li', 'section-gestionhumana', 'gh-person-modal', 'gestionhumana-overlay', 'gh-admin-tbody', 'gh-ov-table']) {
    assert.ok(!html.includes('id="' + id + '"'), 'sigue ' + id);
  }
  assert.ok(!/openGenericDashboard\('GESTION_HUMANA'\)/.test(html), 'sin botón al tablero retirado');
  assert.ok(!html.includes('js/gestion-humana.js'), 'sin el script');
  assert.ok(!fs.existsSync(path.join(pub, 'js', 'gestion-humana.js')), 'el archivo salió');
  const js = ['session.js', 'ui-core.js', 'dashboards-core.js', 'cerrar-ventanas.js', 'motion-helpers.js']
    .map((f) => fs.readFileSync(path.join(pub, 'js', f), 'utf8')).join('\n');
  assert.ok(!/gestionhumana|openGestionHumana|closeGestionHumana|gh-person-modal/.test(js), 'sin referencias en el JS');
  assert.ok(html.includes('id="th-frame"'), 'Talento humano sigue en la página');
});
