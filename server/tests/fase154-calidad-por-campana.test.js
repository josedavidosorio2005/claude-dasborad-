// fase154-calidad-por-campana.test.js — Fase 154 (condicion del PR 2):
// CALIDAD y SUPERVISOR con permisos SOLO por campana (campana_X, sin
// cliente_X) siguen recibiendo sus campanas de Calidad en
// GET /dashboard/clientes y trabajan igual que antes: ven la plantilla de
// su campana, crean monitoreos, los listan y ven los propios.
'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { app, db, request, cleanup } = require('./helpers');
const { signToken } = require('../auth');

after(cleanup);

function tokenDe(user, rol, perms) {
  db.prepare(
    "INSERT INTO users (nombre, user, rol, active, password_hash, perms, createdAt) VALUES (?, ?, ?, 1, 'x', ?, '2026-10-19')"
  ).run('Persona ' + user, user, rol, JSON.stringify(perms));
  const row = db.prepare('SELECT * FROM users WHERE user = ?').get(user);
  return signToken({ isMasterAdmin: false, userId: row.id, rol: row.rol, tokenVersion: row.token_version });
}
const conToken = (r, t) => r.set('Authorization', 'Bearer ' + t);
const MIS = ['ORLANT', 'MOBILIZE'];

for (const rol of ['CALIDAD', 'SUPERVISOR']) {
  test(rol + ' solo con campana_ (sin cliente_): recibe sus campanas y trabaja igual', async () => {
    const perms = { Calidad: true, campana_ORLANT: true, campana_MOBILIZE: true };
    if (rol === 'SUPERVISOR') perms.ClientesDash = true;
    const t = tokenDe('f154' + rol.toLowerCase(), rol, perms);
    assert.equal(Object.keys(perms).some((k) => k.startsWith('cliente_')), false);

    // Listas del registro: sus 2 campanas de Calidad, y nada ajeno.
    const cli = await conToken(request(app).get('/api/dashboard/clientes'), t);
    assert.equal(cli.status, 200);
    assert.deepEqual([...cli.body.campanasCalidad].sort(), [...MIS].sort());
    assert.deepEqual([...cli.body.listaClientes].sort(), [...MIS].sort());
    assert.deepEqual(cli.body.registro.map((c) => c.nombre).sort(), [...MIS].sort());

    // Plantillas de Calidad de sus campanas (de aqui sale el selector de campana).
    const pl = await conToken(request(app).get('/api/calidad/plantillas'), t);
    assert.equal(pl.status, 200);
    const campanasPlantilla = (Array.isArray(pl.body) ? pl.body.map((p) => p.campana) : Object.keys(pl.body));
    MIS.forEach((c) => assert.ok(campanasPlantilla.includes(c), rol + ' ve la plantilla de ' + c));

    // Crea un monitoreo en cada campana, los lista y los ve.
    for (const c of MIS) {
      const nuevo = await conToken(request(app).post('/api/monitoreos'), t)
        .send({ campana: c, asesor: 'Asesor ' + rol, fecha: '2026-09-15', canal: 'LLAMADA', answers: { '1': 'SI' } });
      assert.equal(nuevo.status, 201, rol + ' crea en ' + c + ': ' + JSON.stringify(nuevo.body));
      const lista = await conToken(request(app).get('/api/monitoreos?campana=' + encodeURIComponent(c)), t);
      assert.equal(lista.status, 200);
      assert.ok(lista.body.some((m) => m.id === nuevo.body.id), rol + ' lista su monitoreo de ' + c);
    }
    // Una campana ajena sigue cerrada.
    const ajena = await conToken(request(app).get('/api/monitoreos?campana=' + encodeURIComponent('CLINICA AURORA')), t);
    assert.equal(ajena.status, 403);
  });
}
