// faseSTA6-base-eliminada.test.js — pedido 3 de Edwin (reunión 23/11/2026): cuando se elimina una base
// de STA, el registro de cargas la muestra como «Eliminada» (antes desaparecía o quedaba igual). Datos
// INVENTADOS.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');
const STA = require('../orlant-sta');

const H = (t) => ({ Authorization: 'Bearer ' + t });
const B = '/api/orlant/sta';
let admin;
const fila = (n) => ({ 'Fecha Ingreso Sta': '2026-11-02 08:00:00', Entidad: 'ENT', 'Numero Autorizacion': 'EL' + n, Estado: 'En proceso', 'Descripcion Cups': 'CUPS', 'Fecha Autorizacion': '2026-10-01 00:00:00', 'Fecha Expiracion': '2027-01-01 00:00:00', Servicio: 'SERV' });

before(async () => {
  admin = await tokenFor('admin', MASTER_PASSWORD);
});

test('eliminar una carga sin gestionados: queda en el registro como «Eliminada», sin casos ni archivo; Historial', async () => {
  const c = await request(app).post(B + '/cargas').set(H(admin)).send({ archivo: 'base-a-eliminar.xlsx', columnas: STA.CAMPOS, filas: [fila(1), fila(2)], archivoB64: Buffer.from('excel inventado').toString('base64') });
  assert.equal(c.status, 200, JSON.stringify(c.body));
  let cg = (await request(app).get(B + '/cargas').set(H(admin))).body.cargas.find((x) => x.archivo === 'base-a-eliminar.xlsx');
  assert.equal(cg.tieneArchivo, true);
  assert.equal(cg.eliminadaAt, null);
  const r = await request(app).delete(B + '/cargas/' + cg.id).set(H(admin));
  assert.equal(r.status, 200);
  assert.equal(r.body.eliminados, 2);
  cg = (await request(app).get(B + '/cargas').set(H(admin))).body.cargas.find((x) => x.id === cg.id);
  assert.ok(cg, 'la carga sigue en el registro');
  assert.match(cg.eliminadaAt, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  assert.match(cg.eliminadaPor, /admin/i);
  assert.equal(cg.eliminados, 2);
  assert.equal(cg.casosActuales, 0);
  assert.equal(cg.tieneArchivo, false, 'el Excel original se borra con la base');
  assert.equal((await request(app).get(B + '/cargas/' + cg.id + '/archivo').set(H(admin))).status, 404);
  // Eliminarla otra vez: 409, sin tocar nada.
  assert.equal((await request(app).delete(B + '/cargas/' + cg.id).set(H(admin))).status, 409);
  assert.match(db.prepare("SELECT detalle FROM historial WHERE accion = 'STA_CARGA_ELIMINAR' ORDER BY id DESC").get().detalle, /2 casos eliminados/);
});

test('la tabla columnas nuevas se agrega sola en una base vieja (sin eliminadaAt)', () => {
  const cols = db.prepare('PRAGMA table_info(sta_cargas)').all().map((c) => c.name);
  assert.ok(cols.includes('eliminadaAt') && cols.includes('eliminadaPor'));
  STA.asegurarTablas(db); // idempotente
});

test('navegador: el historial de cargas pinta «Eliminada» (fecha y quién) y sin botones para esa fila', () => {
  const appJs = fs.readFileSync(path.join(__dirname, '..', '..', 'public/js/orlant-sta-app.js'), 'utf8');
  assert.ok(appJs.includes('${c.eliminadaAt?`<span class="tag sta-eliminada">Eliminada</span>'));
  assert.ok(appJs.includes(`<tr\${c.eliminadaAt?' class="sta-fila-eliminada"':''}>`));
  const css = fs.readFileSync(path.join(__dirname, '..', '..', 'public/css/orlant-sta-app.css'), 'utf8');
  assert.match(css, /\.tag\.sta-eliminada\{/);
});
