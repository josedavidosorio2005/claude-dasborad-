// monitoreos-bulk.test.js — cubre POST /api/monitoreos/bulk (carga masiva de
// Calidad, primera campana real: CARTERA INTERNA), usando las MISMAS filas
// que produciria el parseo del fixture de 3 hojas (cartera-fixture.xlsx) via
// calidad-carga-masiva-logic.js — de punta a punta: Excel -> parseo -> API.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');
const { leerHojaXlsxComoAoA } = require('./helpers/xlsx-lite');
const { cmParseRows } = require('../../public/js/calidad-carga-masiva-logic.js');

const auth = (t) => ({ Authorization: `Bearer ${t}` });
const FIXTURE = path.join(__dirname, 'fixtures', 'cartera-fixture.xlsx');
// Fase 134: CARTERA INTERNA se elimino de PLANTILLAS (ya no es un cliente de
// produccion), pero el fixture .xlsx de abajo sigue siendo datos REALES de
// prueba con esta forma exacta de 14 items -- se inserta la plantilla
// directo en la base de pruebas (nunca se reinserta sola: la migracion
// fase134_borrar_clientes_v1 ya corrio para cuando este archivo se carga,
// asi que no vuelve a borrarla) para que POST /monitoreos/bulk la encuentre
// igual que encontraria la de cualquier campana real.
const ITEMS_CARTERA = [
  { n: 1, cat: 'APERTURA', label: 'Saludo', weight: 5, critico: false },
  { n: 2, cat: 'APERTURA', label: 'Grabacion de la llamada o chat', weight: 7, critico: false },
  { n: 3, cat: 'APERTURA', label: 'Motivo de la llamada', weight: 9, critico: false },
  { n: 4, cat: 'COMUNICACION', label: 'Comunicacion oral y cumplimiento de parametros de cobranza', weight: 9, critico: false },
  { n: 5, cat: 'GESTION', label: 'Buen uso de los argumentos - Persuade al cliente', weight: 7, critico: true },
  { n: 6, cat: 'GESTION', label: 'Objeciones', weight: 9, critico: true },
  { n: 7, cat: 'GESTION', label: 'Liquidacion del credito', weight: 12, critico: true },
  { n: 8, cat: 'GESTION', label: 'Resolucion de la llamada - dudas', weight: 5, critico: false },
  { n: 9, cat: 'GESTION', label: 'Medios de pago', weight: 13, critico: true },
  { n: 10, cat: 'LEGAL', label: 'Habeas data', weight: 5, critico: false },
  { n: 11, cat: 'GESTION', label: 'Documenta gestion de la llamada', weight: 5, critico: false },
  { n: 12, cat: 'COMUNICACION', label: 'Ortografia', weight: 5, critico: false },
  { n: 13, cat: 'CIERRE', label: 'Cierre de la llamada', weight: 6, critico: false },
  { n: 14, cat: 'TIEMPOS', label: 'Tiempo de retoma de llamada', weight: 3, critico: false },
];
db.prepare(
  `INSERT OR IGNORE INTO calidad_plantillas (campana, engine, items, activo, updatedAt)
   VALUES ('CARTERA INTERNA', 'standard', ?, 1, ?)`
).run(JSON.stringify(ITEMS_CARTERA), new Date().toISOString());

async function calidadUserCartera(adminToken) {
  const user = 'cal_cartera_' + Math.random().toString(36).slice(2, 7);
  const create = await request(app)
    .post('/api/users')
    .set(auth(adminToken))
    .send({
      nombre: 'Calidad Cartera',
      user,
      password: 'ClaveCalidad123',
      rol: 'CALIDAD',
      perms: { Calidad: true, ['campana_CARTERA INTERNA']: true },
    });
  assert.equal(create.status, 201, JSON.stringify(create.body));
  const token = await tokenFor(user, 'ClaveCalidad123');
  return token;
}

test('POST /api/monitoreos/bulk: carga de punta a punta (fixture de 3 hojas -> parseo -> API)', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const token = await calidadUserCartera(admin);

  const aoa = leerHojaXlsxComoAoA(FIXTURE, 'Monitoreos');
  const parsed = cmParseRows(aoa, ITEMS_CARTERA);
  assert.equal(parsed.error, undefined);
  assert.equal(parsed.filas.length, 3); // 2 filas del fixture se descartan por diseno (ver calidad-carga-masiva-logic.test.js)

  // idLlamada unicos para esta prueba: la base de datos de test se comparte
  // entre los "test()" de este archivo (no hay limpieza entre ellos).
  const sufijo1 = '-' + Math.random().toString(36).slice(2, 7);
  const filasTest1 = parsed.filas.map((f) => ({ ...f, idLlamada: f.idLlamada + sufijo1 }));

  const res = await request(app)
    .post('/api/monitoreos/bulk')
    .set(auth(token))
    .send({ campana: 'CARTERA INTERNA', archivoNombre: 'cartera-fixture.xlsx', filas: filasTest1 });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.insertadas, 3);
  assert.equal(res.body.actualizadas, 0);
  assert.equal(res.body.omitidas, 0);

  const lista = await request(app).get('/api/monitoreos?campana=' + encodeURIComponent('CARTERA INTERNA')).set(auth(token));
  assert.equal(lista.status, 200);
  const propias = lista.body.filter((m) => m.idLlamada && m.idLlamada.endsWith(sufijo1));
  assert.equal(propias.length, 3);
  const conFallo = propias.find((m) => m.asesor === 'Asesor Prueba Dos');
  assert.equal(conFallo.fallos, 1); // item 6 (Objeciones, critico) fallado en el fixture
});

test('POST /api/monitoreos/bulk: idempotente por (campana, asesor, fecha, idLlamada) — reprocesar el mismo archivo actualiza, no duplica', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const token = await calidadUserCartera(admin);
  const aoa = leerHojaXlsxComoAoA(FIXTURE, 'Monitoreos');
  const parsed = cmParseRows(aoa, ITEMS_CARTERA);
  // idLlamada unicos para esta prueba: la base de datos de test se comparte
  // entre los "test()" de este archivo (no hay limpieza entre ellos), asi
  // que reusar los mismos idLlamada del fixture chocaria con las filas que
  // ya inserto la prueba anterior.
  const sufijo = '-' + Math.random().toString(36).slice(2, 7);
  const filas = parsed.filas.map((f) => ({ ...f, idLlamada: f.idLlamada + sufijo }));
  const body = { campana: 'CARTERA INTERNA', archivoNombre: 'cartera-fixture.xlsx', filas };

  const r1 = await request(app).post('/api/monitoreos/bulk').set(auth(token)).send(body);
  assert.equal(r1.body.insertadas, 3, JSON.stringify(r1.body));

  const r2 = await request(app).post('/api/monitoreos/bulk').set(auth(token)).send(body);
  assert.equal(r2.body.insertadas, 0);
  assert.equal(r2.body.actualizadas, 3); // mismas idLlamada -> actualiza en vez de duplicar

  const lista = await request(app).get('/api/monitoreos?campana=' + encodeURIComponent('CARTERA INTERNA')).set(auth(token));
  const propias = lista.body.filter((m) => m.idLlamada && m.idLlamada.endsWith(sufijo));
  assert.equal(propias.length, 3); // sigue siendo 3, no 6: la segunda subida actualizo, no duplico
});

test('POST /api/monitoreos/bulk: filas sin idLlamada no se deduplican (no hay clave natural)', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const token = await calidadUserCartera(admin);
  const fila = {
    asesor: 'Asesor Sin Id',
    fecha: '2026-09-10',
    canal: 'LLAMADA',
    idLlamada: '',
    answers: Object.fromEntries(ITEMS_CARTERA.map((it) => [String(it.n), 'SI'])),
  };
  const body = { campana: 'CARTERA INTERNA', filas: [fila] };
  const r1 = await request(app).post('/api/monitoreos/bulk').set(auth(token)).send(body);
  const r2 = await request(app).post('/api/monitoreos/bulk').set(auth(token)).send(body);
  assert.equal(r1.body.insertadas, 1);
  assert.equal(r2.body.insertadas, 1); // sin idLlamada: se inserta de nuevo, no se asume que es la misma
});

test('POST /api/monitoreos/bulk: un usuario sin permiso sobre la campana no puede cargar', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const otroUser = 'cal_sinacceso_' + Math.random().toString(36).slice(2, 7);
  await request(app)
    .post('/api/users')
    .set(auth(admin))
    .send({ nombre: 'Sin Acceso', user: otroUser, password: 'ClaveCalidad123', rol: 'CALIDAD', perms: { Calidad: true } });
  const token = await tokenFor(otroUser, 'ClaveCalidad123');
  const res = await request(app)
    .post('/api/monitoreos/bulk')
    .set(auth(token))
    .send({ campana: 'CARTERA INTERNA', filas: [{ asesor: 'X', fecha: '2026-09-01', canal: 'LLAMADA', answers: { 1: 'SI' } }] });
  assert.equal(res.status, 403);
});
