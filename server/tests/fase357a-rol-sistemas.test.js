// fase357a-rol-sistemas.test.js — Fase 357 A (pedido de Edwin, 17/11): rol «Sistemas», por ahora
// SIN módulos (luego verá el inventario de sistemas). Datos SINTETICOS.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { request, app, tokenFor, MASTER_PASSWORD } = require('./helpers');
const { ROLES } = require('../validation');
const { dashModulosVisibles } = require('../../public/js/dashboards-logic.js');

const H = (t) => ({ Authorization: 'Bearer ' + t });
let admin, sis, idSis;

before(async () => {
  admin = await tokenFor('admin', MASTER_PASSWORD);
  const r = await request(app).post('/api/users').set(H(admin))
    .send({ nombre: 'Persona Ficticia Sistemas', user: 'f357_sis', password: 'Clave#F357sis', rol: 'SISTEMAS', perms: {} });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  idSis = r.body.id;
  sis = await tokenFor('f357_sis', 'Clave#F357sis');
});

test('SISTEMAS es un rol válido y el administrador lo asigna', async () => {
  assert.ok(ROLES.includes('SISTEMAS'));
  const u = (await request(app).get('/api/users').set(H(admin))).body.find((x) => x.id === idSis);
  assert.equal(u.rol, 'SISTEMAS');
  // Cambiar de rol a SISTEMAS y de vuelta, por la ruta normal de edición.
  assert.equal((await request(app).put('/api/users/' + idSis).set(H(admin)).send({ nombre: 'Persona Ficticia Sistemas', rol: 'SISTEMAS', perms: {} })).status, 200);
});

test('SISTEMAS no ve ningún módulo ni datos de clientes', async () => {
  for (const ruta of ['/api/historial', '/api/gerencia/kpis', '/api/dashboard/ORLANT', '/api/monitoreos?campana=ORLANT', '/api/inventario', '/api/tickets/contador']) {
    const r = await request(app).get(ruta).set(H(sis));
    assert.ok([403, 404].includes(r.status), ruta + ' → ' + r.status);
  }
  const cli = (await request(app).get('/api/dashboard/clientes').set(H(sis))).body;
  assert.equal(Array.isArray(cli) ? cli.length : (cli.clientes || []).length, 0);
  // Lo de cualquier usuario con sesión sí: Sugerencias / Tickets, solo «General».
  const camp = (await request(app).get('/api/tickets/campanas').set(H(sis))).body.campanas.map((c) => c.valor);
  assert.deepEqual(camp, ['GENERAL']);
});

test('interfaz: el rol aparece en el formulario y entra al menú de tarjetas sin módulos', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'constants.js'), 'utf8');
  const bloque = (nombre) => src.slice(src.indexOf('var ' + nombre + ' = ['), src.indexOf('];', src.indexOf('var ' + nombre + ' = [')));
  assert.match(bloque('REGULAR_ROLES'), /\{key:'SISTEMAS',\s*label:'SISTEMAS'/);
  assert.match(bloque('ALL_ROLES'), /\{key:'SISTEMAS',\s*label:'SISTEMAS'/);
  assert.match(src, /SISTEMAS: '[^']*sin módulos/);
  assert.doesNotMatch(src.slice(src.indexOf('var ROLE_DEFAULT'), src.indexOf('};', src.indexOf('var ROLE_DEFAULT'))), /SISTEMAS/, 'sin módulo por defecto');
  // Con permisos vacíos no se ve ninguna tarjeta (los módulos se ven solo por permiso).
  const modulos = [{ key: 'Calidad', label: 'Calidad' }, { key: 'Inventario', label: 'Inventario' }, { key: 'Gerencia', label: 'Gerencia' }, { key: 'ClientesDash', label: 'Dashboard' }];
  assert.deepEqual(dashModulosVisibles(modulos, { rol: 'SISTEMAS', perms: {} }, false), []);
  // El selector de rol del formulario de usuario está escrito en index.html: debe tener SISTEMAS
  // (hallazgo de la verificación en Brave).
  const index = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'index.html'), 'utf8');
  const sel = index.slice(index.indexOf('<select id="mu-rol"'), index.indexOf('</select>', index.indexOf('<select id="mu-rol"')));
  assert.match(sel, /<option value="SISTEMAS">SISTEMAS<\/option>/);
  // Sin rama propia en la entrada: cae en el menú de tarjetas, con el aviso «No tienes módulos asignados».
  const ses = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'session.js'), 'utf8');
  assert.match(ses, /else \{ enterUserDashboard\(\); \}/);
});
