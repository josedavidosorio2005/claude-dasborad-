// fase102-monitoreos-cruce-campana.test.js — Fase 102 (auditoria de
// seguridad, hallazgo real). El fallback por NOMBRE de /monitoreos/mios,
// /monitoreos/mios/nuevos y PUT /monitoreos/:id/visto (para filas SIN
// asesorUserId -- que es TODA la carga masiva, ver POST /monitoreos/bulk,
// su INSERT nunca completa esa columna) nunca filtraba por campana: un
// asesor cuyo NOMBRE coincide (insensible a mayusculas, sin espacios extra)
// con el de un asesor de OTRA campana veia/marcaba como visto los
// monitoreos de ese otro asesor. Con una sola campana real hoy (ORLANT) no
// se podia disparar, pero es un hueco de diseno que se activa apenas haya
// una segunda campana con datos reales y un nombre coincidente.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, tokenFor, MASTER_PASSWORD } = require('./helpers');
const { PLANTILLAS } = require('../calidad-plantillas-seed.js');

const auth = (t) => ({ Authorization: `Bearer ${t}` });

function respuestasTodoSi(campana) {
  const items = PLANTILLAS.find((p) => p.campana === campana).items;
  return Object.fromEntries(items.map((it) => [String(it.n), 'SI']));
}

async function calidadUser(adminToken, campana, sufijo) {
  const user = 'cal102_' + sufijo + '_' + Math.random().toString(36).slice(2, 7);
  const create = await request(app)
    .post('/api/users')
    .set(auth(adminToken))
    .send({
      nombre: 'Calidad Fase102 ' + sufijo,
      user,
      password: 'ClaveCalidad123',
      rol: 'CALIDAD',
      perms: { Calidad: true, ['campana_' + campana]: true },
    });
  assert.equal(create.status, 201, JSON.stringify(create.body));
  return await tokenFor(user, 'ClaveCalidad123');
}

test('un asesor NO ve ni marca como visto el monitoreo de OTRA campana aunque el nombre coincida exacto (carga masiva, sin asesorUserId)', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const NOMBRE_COMPARTIDO = 'Asesor Fase102 Cruce ' + Math.random().toString(36).slice(2, 7);
  const idLlamada = 'cruce-' + Math.random().toString(36).slice(2, 7);

  // El asesor REAL, de ORLANT -- su usuario de login.
  const userOrlant = 'ase102orlant_' + Math.random().toString(36).slice(2, 7);
  const createAsesor = await request(app)
    .post('/api/users')
    .set(auth(admin))
    .send({ nombre: NOMBRE_COMPARTIDO, user: userOrlant, password: 'ClaveAsesor1234', rol: 'ASESOR', perms: {}, asesorCampana: 'ORLANT' });
  assert.equal(createAsesor.status, 201, JSON.stringify(createAsesor.body));
  const tokenAsesor = await tokenFor(userOrlant, 'ClaveAsesor1234');

  // Un monitoreo de carga masiva en OTRA campana (MOBILIZE), con el
  // MISMO nombre de asesor (persona distinta, coincidencia real posible) --
  // POST /monitoreos/bulk nunca completa asesorUserId.
  const tokenCalCartera = await calidadUser(admin, 'MOBILIZE', 'cartera');
  const bulkCartera = await request(app)
    .post('/api/monitoreos/bulk')
    .set(auth(tokenCalCartera))
    .send({
      campana: 'MOBILIZE',
      filas: [{ asesor: NOMBRE_COMPARTIDO, fecha: '2026-09-01', canal: 'LLAMADA', idLlamada, answers: respuestasTodoSi('MOBILIZE') }],
    });
  assert.equal(bulkCartera.status, 201, JSON.stringify(bulkCartera.body));
  assert.equal(bulkCartera.body.insertadas, 1);

  const listaCartera = await request(app).get('/api/monitoreos?campana=' + encodeURIComponent('MOBILIZE')).set(auth(tokenCalCartera));
  const monitoreoCartera = listaCartera.body.find((m) => m.idLlamada === idLlamada);
  assert.ok(monitoreoCartera, 'el monitoreo de carga masiva debe existir');
  assert.equal(monitoreoCartera.asesorUserId, null, 'precondicion: la carga masiva nunca completa asesorUserId');

  // El asesor de ORLANT NO debe verlo en "Mis Resultados".
  const mios = await request(app).get('/api/monitoreos/mios').set(auth(tokenAsesor));
  assert.equal(mios.status, 200);
  assert.ok(!mios.body.some((m) => m.id === monitoreoCartera.id), 'no debe aparecer el monitoreo de la otra campana');

  // Ni puede marcarlo como visto -- 403, no 200.
  const visto = await request(app).put(`/api/monitoreos/${monitoreoCartera.id}/visto`).set(auth(tokenAsesor));
  assert.equal(visto.status, 403, JSON.stringify(visto.body));
});
