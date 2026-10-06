// fase126-admin-borrado-rango.test.js — Fase 126 (pedido explicito de
// Edwin: quitar los meses de prueba de ORLANT, dejar solo ago-sep/2026
// real). Cubre el endpoint nuevo POST /api/admin/borrado-rango:
// solo-admin, dry-run por defecto, aborta sin borrar si el conteo real no
// coincide con filasEsperadas, solo campana ORLANT, transaccion, y que el
// Historial quede sin datos personales. Antes de este PR la ruta no
// existia (404) -- estas pruebas fallan solas contra el codigo viejo.
// Datos SIEMPRE inventados, meses de 2020/2021 para no chocar entre tests
// del mismo archivo (comparten la misma base temporal, ver helpers.js).
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, db, tokenFor, MASTER_PASSWORD, SEED } = require('./helpers');

const auth = (t) => ({ Authorization: `Bearer ${t}` });

function filaAgendas(i, mes, dia) {
  return [
    'ASESOR_PRUEBA_' + (i % 5), 'SEDE_PRUEBA', 'EXAMEN_PRUEBA', 'ESPECIALIDAD_PRUEBA',
    'PROFESIONAL_PRUEBA', mes + '-' + dia + ' 08:00:00', i % 2 === 0 ? '3P' : 'GENERAL', 'ENTIDAD_PRUEBA',
  ];
}

async function cargarAgendas(admin, campana, filas, archivoNombre) {
  const res = await request(app).post('/api/calidad/agendas/carga').set(auth(admin))
    .send({ campana, archivoNombre: archivoNombre || 'prueba.xlsx', filas });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body;
}

async function cargarTipificacion(admin, campana, canal, filas) {
  const res = await request(app).post('/api/calidad/tipificacion/carga').set(auth(admin))
    .send({ campana, canal, archivoNombre: 'prueba.xlsx', filas });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body;
}

async function cargarEfectividadCitas(admin, campana, filas) {
  const res = await request(app).post('/api/calidad/efectividad-citas/carga').set(auth(admin))
    .send({ campana, archivoNombre: 'prueba.xlsx', filas });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res.body;
}

function contarAgendas(campana, mesDesde, mesHasta) {
  return db.prepare(
    "SELECT COUNT(*) AS n FROM agendas WHERE campana = ? AND substr(fechaSolicitud,1,7) >= ? AND substr(fechaSolicitud,1,7) <= ?"
  ).get(campana, mesDesde, mesHasta).n;
}

test('POST /admin/borrado-rango sin token -> 401', async () => {
  const res = await request(app).post('/api/admin/borrado-rango')
    .send({ base: 'agendas', campana: 'ORLANT', mesDesde: '2020-01', mesHasta: '2020-01', filasEsperadas: 0, confirmar: true });
  assert.equal(res.status, 401);
});

test('POST /admin/borrado-rango con un rol que no es administrador -> 403, 0 filas borradas', async () => {
  await cargarAgendas(await tokenFor('admin', MASTER_PASSWORD), 'ORLANT', [filaAgendas(0, '2020-02', '01')]);
  const noAdmin = await tokenFor('crodriguez', SEED.crodriguez); // CALIDAD, no es administrador
  const res = await request(app).post('/api/admin/borrado-rango').set(auth(noAdmin))
    .send({ base: 'agendas', campana: 'ORLANT', mesDesde: '2020-02', mesHasta: '2020-02', filasEsperadas: 1, confirmar: true });
  assert.equal(res.status, 403);
  assert.equal(contarAgendas('ORLANT', '2020-02', '2020-02'), 1, 'no debio borrar nada');
});

test('campana distinta de ORLANT -> 400, candado explicito (nunca Aurora/HLM por este camino)', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const res = await request(app).post('/api/admin/borrado-rango').set(auth(admin))
    .send({ base: 'agendas', campana: 'CLINICA AURORA', mesDesde: '2020-01', mesHasta: '2020-01', filasEsperadas: 0, confirmar: true });
  assert.equal(res.status, 400);
});

test('base invalida -> 400', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const res = await request(app).post('/api/admin/borrado-rango').set(auth(admin))
    .send({ base: 'monitoreos', campana: 'ORLANT', mesDesde: '2020-01', mesHasta: '2020-01', filasEsperadas: 0, confirmar: true });
  assert.equal(res.status, 400);
});

test('mesDesde > mesHasta -> 400', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const res = await request(app).post('/api/admin/borrado-rango').set(auth(admin))
    .send({ base: 'agendas', campana: 'ORLANT', mesDesde: '2020-05', mesHasta: '2020-01', filasEsperadas: 0, confirmar: true });
  assert.equal(res.status, 400);
});

test('dry-run por defecto (sin confirmar): cuenta pero NO borra nada', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  await cargarAgendas(admin, 'ORLANT', [filaAgendas(0, '2020-03', '01'), filaAgendas(1, '2020-03', '02')]);
  const res = await request(app).post('/api/admin/borrado-rango').set(auth(admin))
    .send({ base: 'agendas', campana: 'ORLANT', mesDesde: '2020-03', mesHasta: '2020-03', filasEsperadas: 2 });
  assert.equal(res.status, 200);
  assert.equal(res.body.dryRun, true);
  assert.equal(res.body.filas, 2);
  assert.equal(contarAgendas('ORLANT', '2020-03', '2020-03'), 2, 'el dry-run no debio borrar nada');
});

test('filasEsperadas no coincide -> 409, aborta SIN borrar nada (incluso con confirmar:true)', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  await cargarAgendas(admin, 'ORLANT', [filaAgendas(0, '2020-04', '01'), filaAgendas(1, '2020-04', '02')]);
  const res = await request(app).post('/api/admin/borrado-rango').set(auth(admin))
    .send({ base: 'agendas', campana: 'ORLANT', mesDesde: '2020-04', mesHasta: '2020-04', filasEsperadas: 99, confirmar: true });
  assert.equal(res.status, 409);
  assert.equal(contarAgendas('ORLANT', '2020-04', '2020-04'), 2, 'no debio borrar nada con un conteo que no cuadra');
});

test('borrado real de Agendas: borra SOLO el rango pedido, deja el resto intacto', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  await cargarAgendas(admin, 'ORLANT', [filaAgendas(0, '2020-05', '01'), filaAgendas(1, '2020-05', '02'), filaAgendas(2, '2020-05', '03')]);
  await cargarAgendas(admin, 'ORLANT', [filaAgendas(3, '2020-06', '01')]); // fuera del rango -- debe sobrevivir

  const res = await request(app).post('/api/admin/borrado-rango').set(auth(admin))
    .send({ base: 'agendas', campana: 'ORLANT', mesDesde: '2020-05', mesHasta: '2020-05', filasEsperadas: 3, confirmar: true });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.ok, true);
  assert.equal(res.body.borradas, 3);
  assert.equal(contarAgendas('ORLANT', '2020-05', '2020-05'), 0, 'el mes borrado debe quedar en 0');
  assert.equal(contarAgendas('ORLANT', '2020-06', '2020-06'), 1, 'el mes fuera de rango no debe tocarse');
});

test('borrado real de Tipificacion de Llamadas: respeta el canal (nunca toca WhatsApp del mismo mes)', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const filaTip = (agente, fecha) => [agente, fecha, '08:00:00', 5, 'MOTIVO_PRUEBA', 'SKILL_PRUEBA'];
  await cargarTipificacion(admin, 'ORLANT', 'LLAMADAS', [filaTip('A1', '2020-07-01'), filaTip('A2', '2020-07-02')]);
  await cargarTipificacion(admin, 'ORLANT', 'WHATSAPP', [filaTip('A3', '2020-07-03')]);

  const res = await request(app).post('/api/admin/borrado-rango').set(auth(admin))
    .send({ base: 'tipificacion_llamadas', campana: 'ORLANT', mesDesde: '2020-07', mesHasta: '2020-07', filasEsperadas: 2, confirmar: true });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.borradas, 2);

  const quedan = db.prepare("SELECT canal, COUNT(*) AS n FROM tipificaciones WHERE campana='ORLANT' AND fecha LIKE '2020-07%' GROUP BY canal").all();
  assert.deepEqual(quedan, [{ canal: 'WHATSAPP', n: 1 }], 'WhatsApp del mismo mes no debio tocarse');
});

test('borrado real de Efectividad de Citas (columna mes directa, sin substr)', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  await cargarEfectividadCitas(admin, 'ORLANT', [['2020-08', 100, 90]]);
  await cargarEfectividadCitas(admin, 'ORLANT', [['2020-09', 50, 40]]); // fuera del rango

  const res = await request(app).post('/api/admin/borrado-rango').set(auth(admin))
    .send({ base: 'efectividad_citas', campana: 'ORLANT', mesDesde: '2020-08', mesHasta: '2020-08', filasEsperadas: 1, confirmar: true });
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.borradas, 1);

  const quedan = db.prepare("SELECT mes FROM efectividad_citas WHERE campana='ORLANT' ORDER BY mes").all();
  assert.deepEqual(quedan, [{ mes: '2020-09' }]);
});

test('el Historial registra el borrado SOLO con conteos -- nunca un nombre de asesor/entidad', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  await cargarAgendas(admin, 'ORLANT', [filaAgendas(0, '2020-10', '01')]);
  const res = await request(app).post('/api/admin/borrado-rango').set(auth(admin))
    .send({ base: 'agendas', campana: 'ORLANT', mesDesde: '2020-10', mesHasta: '2020-10', filasEsperadas: 1, confirmar: true });
  assert.equal(res.status, 200);

  const hist = await request(app).get('/api/historial').set(auth(admin));
  const evento = hist.body.find((h) => h.accion === 'ADMIN_BORRADO_RANGO' && h.detalle.includes('2020-10'));
  assert.ok(evento, 'debe quedar un evento en Historial');
  assert.ok(!/ASESOR_PRUEBA/.test(evento.detalle), 'el detalle del historial nunca debe traer un nombre de asesor');
  assert.match(evento.detalle, /^agendas 2020-10\.\.2020-10$/);
});
