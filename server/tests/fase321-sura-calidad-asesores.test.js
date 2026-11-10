// fase321-sura-calidad-asesores.test.js — Fase 321 (10/11/2026): SURA con el modulo de
// Calidad en el registro, para crear sus usuarios ASESOR (como ORLANT) y que vean «Mis
// resultados» con solo sus monitoreos, nunca el tablero Televentas. Datos SINTETICOS.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');
const reg = require('../clientes-registro');

const H = (t) => ({ Authorization: 'Bearer ' + t });
let admin, ases1, ases2, id1, id2;
function crear(nombre, user, rol, perms, asesorCampana) {
  const info = db.prepare(`INSERT INTO users (nombre, user, rol, active, password_hash, perms, asesorCampana, createdAt, debe_cambiar_password) VALUES (?,?,?,1,?,?,?,?,0)`)
    .run(nombre, user, rol, bcrypt.hashSync('Clave#2026x', 4), JSON.stringify(perms), asesorCampana, new Date().toISOString());
  return Number(info.lastInsertRowid);
}
before(async () => {
  admin = await tokenFor('admin', MASTER_PASSWORD);
  id1 = crear('asesor_ficticio_uno', 'Asesor_FU_10001', 'ASESOR', {}, 'SURA');
  id2 = crear('asesor_ficticio_dos', 'Asesor_FD_10002', 'ASESOR', {}, 'SURA');
  ases1 = await tokenFor('Asesor_FU_10001', 'Clave#2026x');
  ases2 = await tokenFor('Asesor_FD_10002', 'Clave#2026x');
});

test('registro: SURA tiene Calidad (aparece para asignar asesores); su tablero sigue siendo Televentas; idempotente', () => {
  assert.ok(reg.campanasCalidad(db).includes('SURA'));
  const r = db.prepare("SELECT modulos, parametros FROM clientes_registro WHERE nombre = 'SURA'").get();
  assert.deepEqual(JSON.parse(r.modulos), ['calidad']);
  assert.deepEqual(JSON.parse(r.parametros).especificos, ['sura_televentas']);
  require('../db').suraModuloCalidad();
  assert.deepEqual(JSON.parse(db.prepare("SELECT modulos FROM clientes_registro WHERE nombre = 'SURA'").get().modulos), ['calidad']);
  const orl = JSON.parse(db.prepare("SELECT modulos FROM clientes_registro WHERE nombre = 'ORLANT'").get().modulos);
  assert.ok(orl.includes('calidad'), 'ORLANT igual');
});

test('ASESOR de SURA: «Mis resultados» solo con sus monitoreos; sin acceso al tablero Televentas ni a los monitoreos de la campaña', async () => {
  const insertar = (asesor, asesorUserId) => db.prepare(`INSERT INTO monitoreos (campana, asesor, asesorUserId, fecha, mes, canal, answers, puntaje, clasificacion, fallos, nivelCritico, evaluador, createdAt)
    VALUES ('SURA', ?, ?, '2026-11-10', '2026-11', 'LLAMADA', '{}', 90, 'x', 0, 'x', 'Evaluador Ficticio', '10/11/2026 10:00:00')`).run(asesor, asesorUserId);
  insertar('asesor_ficticio_uno', id1); insertar('asesor_ficticio_dos', id2); insertar('asesor_ficticio_uno', null);
  const m1 = await request(app).get('/api/monitoreos/mios').set(H(ases1));
  assert.equal(m1.status, 200);
  assert.equal(m1.body.length, 2, 'los suyos: por id y por nombre en su campaña');
  assert.ok(m1.body.every((m) => m.asesor === 'asesor_ficticio_uno'));
  const m2 = await request(app).get('/api/monitoreos/mios').set(H(ases2));
  assert.equal(m2.body.length, 1);
  assert.equal((await request(app).get('/api/sura-televentas/SURA/resumen').set(H(ases1))).status, 403, 'no ve el tablero Televentas');
  assert.equal((await request(app).get('/api/monitoreos?campana=SURA').set(H(ases1))).status, 403, 'no ve los monitoreos de los demás');
  assert.equal((await request(app).get('/api/sura-televentas/SURA/resumen').set(H(admin))).status, 200, 'el administrador sigue igual');
});
