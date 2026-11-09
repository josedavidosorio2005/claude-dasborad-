// fase309-revision-seguridad.test.js — Fase 309 (revision de seguridad del 09/11):
// la cuenta cliente no recibe por la API el nombre de los lideres/evaluadores de
// Calidad (GET /metas), igual que /metas/cumplimiento y /monitoreos. Datos SINTETICOS.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');

const H = (t) => ({ Authorization: 'Bearer ' + t });
const C = 'CLINICA AURORA';
let admin, cliente, supervisor, liderId;
function crear(user, rol, perms) {
  const info = db.prepare(`INSERT INTO users (nombre, user, rol, active, password_hash, perms, createdAt, debe_cambiar_password) VALUES (?,?,?,1,?,?,?,0)`)
    .run('Lider Ficticio ' + user, user, rol, bcrypt.hashSync('Clave#2026x', 4), JSON.stringify(perms), new Date().toISOString());
  return { id: info.lastInsertRowid, tok: tokenFor(user, 'Clave#2026x') };
}
before(async () => {
  admin = await tokenFor('admin', MASTER_PASSWORD);
  const l = crear('f309_lider', 'SUPERVISOR', { ['campana_' + C]: true });
  liderId = l.id; supervisor = await l.tok;
  cliente = await crear('f309_cli', 'CLIENTES_DASH', { ClientesDash: true, ['cliente_' + C]: true }).tok;
  const r = await request(app).post('/api/metas').set(H(admin)).send({ campana: C, mes: '2026-11', liderId, metaGrupal: 10, asesores: 2, diasLaborales: 19 });
  assert.ok([200, 201].includes(r.status), JSON.stringify(r.body));
});

test('GET /metas: el cliente no recibe el nombre del lider; el supervisor de la campaña si', async () => {
  const cli = await request(app).get('/api/metas?campana=' + encodeURIComponent(C)).set(H(cliente));
  assert.equal(cli.status, 200);
  assert.ok(cli.body.length >= 1);
  for (const m of cli.body) assert.equal(m.liderNombre, '', 'sin nombre del lider para el cliente');
  assert.ok(!JSON.stringify(cli.body).includes('Lider Ficticio'));
  const sup = await request(app).get('/api/metas?campana=' + encodeURIComponent(C)).set(H(supervisor));
  assert.ok(sup.body.some((m) => m.liderNombre === 'Lider Ficticio f309_lider'));
  // Otra campaña: 403 (sin fuga entre campañas).
  assert.equal((await request(app).get('/api/metas?campana=MOBILIZE').set(H(cliente))).status, 403);
});
