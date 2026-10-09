// fase95-tema-b-catalogo-codificaciones.test.js — Fase 95, tema B.
//
// Mecanismo del catalogo de codificaciones por campana (el CONTENIDO de la
// lista lo manda Edwin, fuera de esta fase): mientras una campana no tenga
// ninguna codificacion cargada, el campo sigue siendo texto libre (igual
// que hasta ahora); en cuanto tiene al menos una activa, el formulario la
// vuelve un desplegable y el servidor valida el valor contra esa lista.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { db, request, app, tokenFor, MASTER_PASSWORD, SEED } = require('./helpers');

const auth = (t) => ({ Authorization: `Bearer ${t}` });
const MES = new Date().toISOString().slice(0, 7);
const FECHA = `${MES}-15`;
const RESP_TODO_SI = Object.fromEntries(Array.from({ length: 17 }, (_, i) => [String(i + 1), 'SI']));

async function calidadUser(adminToken, campana, sufijo) {
  const user = 'cal95b_' + sufijo + '_' + Math.random().toString(36).slice(2, 7);
  const create = await request(app)
    .post('/api/users')
    .set(auth(adminToken))
    .send({
      nombre: 'Calidad Fase95B ' + sufijo,
      user,
      password: 'ClaveCalidad123',
      rol: 'CALIDAD',
      perms: { Calidad: true, ['campana_' + campana]: true },
    });
  assert.equal(create.status, 201, JSON.stringify(create.body));
  const token = await tokenFor(user, 'ClaveCalidad123');
  return { token, id: create.body.id };
}

test('GET /api/calidad/codificaciones: sin acceso a la campana -> 403', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const { token } = await calidadUser(admin, null, 'noacc'); // sin ninguna campana
  const res = await request(app).get('/api/calidad/codificaciones?campana=ORLANT').set(auth(token));
  assert.equal(res.status, 403);
});

test('GET /api/calidad/codificaciones: campana sin catalogo todavia -> lista vacia', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const { token } = await calidadUser(admin, 'ORLANT', 'vacia');
  const res = await request(app).get('/api/calidad/codificaciones?campana=ORLANT').set(auth(token));
  assert.equal(res.status, 200);
  assert.deepEqual(res.body, []);
});

test('POST /api/calidad/codificaciones/bulk: un no-admin no puede agregar', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const { token } = await calidadUser(admin, 'ORLANT', 'noadmin');
  const res = await request(app)
    .post('/api/calidad/codificaciones/bulk')
    .set(auth(token))
    .send({ campana: 'ORLANT', valores: ['POS'] });
  assert.equal(res.status, 403);
});

test('POST /api/calidad/codificaciones/bulk: pegar varias de una vez, dedupe case/espacios-insensible (dentro del pegado y contra lo ya cargado)', async () => {
  const admin = await tokenFor('psuarez', SEED.psuarez);
  const r1 = await request(app)
    .post('/api/calidad/codificaciones/bulk')
    .set(auth(admin))
    .send({ campana: 'ORLANT', valores: ['POS', ' pos ', 'NO CONTESTA', 'no contesta', 'NUMERO EQUIVOCADO'] });
  assert.equal(r1.status, 201, JSON.stringify(r1.body));
  assert.equal(r1.body.creadas.length, 3, 'solo 3 valores unicos dentro del mismo pegado');
  assert.equal(r1.body.yaExistian.length, 2);

  // Volver a pegar los mismos 3 (algunos con otra capitalizacion) -> todos "yaExistian", 0 creadas nuevas.
  const r2 = await request(app)
    .post('/api/calidad/codificaciones/bulk')
    .set(auth(admin))
    .send({ campana: 'ORLANT', valores: ['Pos', 'no contesta  ', 'Numero Equivocado'] });
  assert.equal(r2.status, 201, JSON.stringify(r2.body));
  assert.equal(r2.body.creadas.length, 0);
  assert.equal(r2.body.yaExistian.length, 3);

  const listado = await request(app).get('/api/calidad/codificaciones?campana=ORLANT').set(auth(admin));
  assert.equal(listado.status, 200);
  assert.equal(listado.body.length, 3, 'no se duplico ninguna fila en la base');
  assert.ok(listado.body.every((c) => c.activo === true));
});

test('PUT /api/calidad/codificaciones/:id: desactivar y reactivar (nunca se borra)', async () => {
  const admin = await tokenFor('psuarez', SEED.psuarez);
  const alta = await request(app)
    .post('/api/calidad/codificaciones/bulk')
    .set(auth(admin))
    .send({ campana: 'ORLANT', valores: ['DESACTIVAR_ME_' + Math.random().toString(36).slice(2, 6)] });
  assert.equal(alta.status, 201);
  const valor = alta.body.creadas[0];
  const row = db.prepare('SELECT id FROM calidad_codificaciones WHERE campana = ? AND valor = ?').get('ORLANT', valor);
  assert.ok(row);

  const desact = await request(app)
    .put('/api/calidad/codificaciones/' + row.id)
    .set(auth(admin))
    .send({ activo: false });
  assert.equal(desact.status, 200, JSON.stringify(desact.body));
  assert.equal(desact.body.activo, false);

  const listado = await request(app).get('/api/calidad/codificaciones?campana=ORLANT').set(auth(admin));
  const encontrada = listado.body.find((c) => c.id === row.id);
  assert.ok(encontrada, 'sigue en la lista, solo desactivada -- nunca se borra');
  assert.equal(encontrada.activo, false);

  const react = await request(app)
    .put('/api/calidad/codificaciones/' + row.id)
    .set(auth(admin))
    .send({ activo: true });
  assert.equal(react.status, 200);
  assert.equal(react.body.activo, true);
});

test('PUT /api/calidad/codificaciones/:id: un no-admin no puede desactivar/reactivar', async () => {
  const admin = await tokenFor('psuarez', SEED.psuarez);
  const { token } = await calidadUser(admin, 'ORLANT', 'noadmin2');
  const alta = await request(app)
    .post('/api/calidad/codificaciones/bulk')
    .set(auth(admin))
    .send({ campana: 'ORLANT', valores: ['SOLO_ADMIN_' + Math.random().toString(36).slice(2, 6)] });
  const row = db.prepare('SELECT id FROM calidad_codificaciones WHERE valor = ?').get(alta.body.creadas[0]);
  const res = await request(app).put('/api/calidad/codificaciones/' + row.id).set(auth(token)).send({ activo: false });
  assert.equal(res.status, 403);
});

test('POST /api/monitoreos: campana SIN catalogo -> codificacion sigue siendo texto libre (regresion)', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const { token } = await calidadUser(admin, 'MOBILIZE', 'libre');
  const res = await request(app)
    .post('/api/monitoreos')
    .set(auth(token))
    .send({ campana: 'MOBILIZE', asesor: 'Alguien', fecha: FECHA, codificacion: 'Cualquier cosa 123', answers: RESP_TODO_SI });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.codificacion, 'Cualquier cosa 123');
});

test('POST /api/monitoreos: campana CON catalogo -> valor valido se acepta (normalizado a la forma del catalogo) y valor invalido da 400', async () => {
  const admin = await tokenFor('psuarez', SEED.psuarez);
  const { token } = await calidadUser(admin, 'ORLANT', 'validar');
  await request(app)
    .post('/api/calidad/codificaciones/bulk')
    .set(auth(admin))
    .send({ campana: 'ORLANT', valores: ['VALOR_CATALOGO'] });

  const valido = await request(app)
    .post('/api/monitoreos')
    .set(auth(token))
    .send({ campana: 'ORLANT', asesor: 'Alguien', fecha: FECHA, codificacion: '  valor_catalogo  ', answers: RESP_TODO_SI });
  assert.equal(valido.status, 201, JSON.stringify(valido.body));
  assert.equal(valido.body.codificacion, 'VALOR_CATALOGO', 'se normaliza a la forma exacta guardada en el catalogo');

  const invalido = await request(app)
    .post('/api/monitoreos')
    .set(auth(token))
    .send({ campana: 'ORLANT', asesor: 'Alguien', fecha: FECHA, codificacion: 'NO ESTA EN LA LISTA', answers: RESP_TODO_SI });
  assert.equal(invalido.status, 400, JSON.stringify(invalido.body));
});

test('PUT /api/monitoreos/:id: si el body no trae codificacion, no se re-valida (la fila conserva la que tenia)', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const campana = 'MOBILIZE';
  const { token } = await calidadUser(admin, campana, 'sinRevalidar');
  const create = await request(app)
    .post('/api/monitoreos')
    .set(auth(token))
    .send({ campana, asesor: 'Alguien', fecha: FECHA, codificacion: 'TEXTO LIBRE ANTES DEL CATALOGO', answers: RESP_TODO_SI });
  assert.equal(create.status, 201, JSON.stringify(create.body));

  // Se carga el catalogo DESPUES de crear el monitoreo (con otro valor).
  const adminFull = await tokenFor('psuarez', SEED.psuarez);
  await request(app)
    .post('/api/calidad/codificaciones/bulk')
    .set(auth(adminFull))
    .send({ campana, valores: ['OTRO_VALOR'] });

  // Editar sin tocar el campo codificacion: no debe fallar aunque el valor viejo ya no este en el catalogo.
  const edit = await request(app)
    .put('/api/monitoreos/' + create.body.id)
    .set(auth(adminFull))
    .send({ observaciones: 'editado sin tocar codificacion' });
  assert.equal(edit.status, 200, JSON.stringify(edit.body));
  assert.equal(edit.body.codificacion, 'TEXTO LIBRE ANTES DEL CATALOGO');

  // Pero si intenta CAMBIAR la codificacion a algo fuera del catalogo, ahora si se rechaza.
  const editInvalido = await request(app)
    .put('/api/monitoreos/' + create.body.id)
    .set(auth(adminFull))
    .send({ codificacion: 'ESTO NO EXISTE' });
  assert.equal(editInvalido.status, 400);
});

test('Historial: agregar y desactivar una codificacion queda registrado', async () => {
  const admin = await tokenFor('psuarez', SEED.psuarez);
  const valor = 'HIST_' + Math.random().toString(36).slice(2, 7);
  const alta = await request(app)
    .post('/api/calidad/codificaciones/bulk')
    .set(auth(admin))
    .send({ campana: 'ORLANT', valores: [valor] });
  assert.equal(alta.status, 201);
  const agregada = db.prepare("SELECT * FROM historial WHERE accion = 'COD_AGREGADA' AND detalle LIKE ?").get('%' + valor + '%');
  assert.ok(agregada, 'debe quedar un evento COD_AGREGADA en el historial');

  const row = db.prepare('SELECT id FROM calidad_codificaciones WHERE valor = ?').get(valor);
  await request(app).put('/api/calidad/codificaciones/' + row.id).set(auth(admin)).send({ activo: false });
  const desactivada = db.prepare("SELECT * FROM historial WHERE accion = 'COD_DESACTIVADA' AND nombre = ?").get(valor);
  assert.ok(desactivada, 'debe quedar un evento COD_DESACTIVADA en el historial');
});
