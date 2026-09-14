// gestion-humana.test.js — Modulo de Gestion Humana (Fase 10, feedback de Edwin 4).
// CRUD de personal, permisos por rol, y el dashboard GESTION_HUMANA (rotacion,
// ingresos/salidas por mes, costo de nomina y rentabilidad por campana).

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, tokenFor, MASTER_PASSWORD, db } = require('./helpers');

const auth = (t) => ({ Authorization: `Bearer ${t}` });

async function userToken(admin, rol, perms) {
  const user = 'gh_' + Math.random().toString(36).slice(2, 8);
  const res = await request(app).post('/api/users').set(auth(admin)).send({
    nombre: `GH ${rol}`, user, password: 'ClaveGH12345', rol, perms: perms || {},
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return tokenFor(user, 'ClaveGH12345');
}

function persona(over = {}) {
  return {
    nombre: 'Persona ' + Math.random().toString(36).slice(2, 6),
    campana: 'TELEVENTAS SURA',
    fecha_ingreso: '2026-01-15',
    costo_hora: 10000,
    horas_mes: 192,
    ...over,
  };
}

test('GESTION_HUMANA: CRUD de personal y permisos', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const gh = await userToken(admin, 'GESTION_HUMANA', { GestionHumana: true });
  const otro = await userToken(admin, 'CALIDAD', { Calidad: true });

  // otro rol no entra
  assert.equal((await request(app).get('/api/gh/personal').set(auth(otro))).status, 403);
  assert.equal((await request(app).post('/api/gh/personal').set(auth(otro)).send(persona())).status, 403);

  // GESTION_HUMANA crea
  const c = await request(app).post('/api/gh/personal').set(auth(gh)).send(persona({ nombre: 'Ana Ruiz', campana: 'INFONDO' }));
  assert.equal(c.status, 201, JSON.stringify(c.body));
  assert.equal(c.body.activo, true);
  assert.equal(c.body.costo_mes, 10000 * 192);
  const id = c.body.id;

  // lee
  const list = await request(app).get('/api/gh/personal').set(auth(gh));
  assert.equal(list.status, 200);
  assert.ok(list.body.some((p) => p.id === id));

  // marca salida (edita)
  const u = await request(app).put('/api/gh/personal/' + id).set(auth(gh))
    .send({ fecha_salida: '2026-06-30', motivo_salida: 'Renuncia voluntaria' });
  assert.equal(u.status, 200);
  assert.equal(u.body.activo, false);
  assert.equal(u.body.fecha_salida, '2026-06-30');

  // filtro por estado
  const retirados = await request(app).get('/api/gh/personal?estado=retirado').set(auth(gh));
  assert.ok(retirados.body.every((p) => !p.activo));

  // borra
  assert.equal((await request(app).delete('/api/gh/personal/' + id).set(auth(gh))).status, 200);
  assert.equal((await request(app).get('/api/gh/personal').set(auth(gh))).body.some((p) => p.id === id), false);
});

test('GESTION_HUMANA: validaciones', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const gh = await userToken(admin, 'GESTION_HUMANA', { GestionHumana: true });

  const sinNombre = await request(app).post('/api/gh/personal').set(auth(gh)).send(persona({ nombre: '' }));
  assert.equal(sinNombre.status, 400);

  const salidaAntes = await request(app).post('/api/gh/personal').set(auth(gh))
    .send(persona({ fecha_ingreso: '2026-05-01', fecha_salida: '2026-01-01' }));
  assert.equal(salidaAntes.status, 400);
});

test('dashboard GESTION_HUMANA: rotacion, flujo mensual y costo de nomina', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const gh = await userToken(admin, 'GESTION_HUMANA', { GestionHumana: true });
  const P = (o) => request(app).post('/api/gh/personal').set(auth(gh)).send(persona(o));

  // 4 ingresan en enero, 1 sale en marzo
  await P({ nombre: 'A', fecha_ingreso: '2026-01-10', campana: 'CAMP_A', costo_hora: 10000 });
  await P({ nombre: 'B', fecha_ingreso: '2026-01-10', campana: 'CAMP_A', costo_hora: 10000 });
  await P({ nombre: 'C', fecha_ingreso: '2026-01-10', campana: 'CAMP_B', costo_hora: 20000 });
  await P({ nombre: 'D', fecha_ingreso: '2026-01-10', campana: 'CAMP_B', costo_hora: 20000, fecha_salida: '2026-03-20', motivo_salida: 'Fin de contrato' });

  const dash = await request(app).get('/api/dashboard/GESTION_HUMANA').set(auth(gh));
  assert.equal(dash.status, 200);
  assert.equal(dash.body.config.cliente, 'GESTION_HUMANA');

  const flujo = dash.body.secciones.flujo_mes;
  const ene = flujo.find((m) => m.periodo === '2026-01').filas[0];
  assert.equal(ene.ingresos, 4);
  assert.equal(ene.salidas, 0);

  const mar = flujo.find((m) => m.periodo === '2026-03').filas[0];
  assert.equal(mar.salidas, 1);
  // activos al inicio de marzo = 4 -> rotacion marzo = 1/4 = 25%
  assert.equal(mar.rotacion_pct, 25);

  const resumen = dash.body.secciones.resumen[0].filas[0];
  assert.equal(resumen.activos, 3); // D ya salio
  // costo nomina activos = A+B (10000*192) + C (20000*192)
  assert.equal(resumen.costo_nomina_mes, (10000 * 192) * 2 + (20000 * 192));
  assert.equal(resumen.campanas, 2);
});

test('dashboard GESTION_HUMANA: rentabilidad por campana cruza costo con ingresos del dashboard del cliente', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const gh = await userToken(admin, 'GESTION_HUMANA', { GestionHumana: true });

  // 2 personas activas en la campana RENT_TEST, costo mensual conocido
  await request(app).post('/api/gh/personal').set(auth(gh)).send(persona({ nombre: 'X', campana: 'RENT_TEST', costo_hora: 5000, horas_mes: 200 }));
  await request(app).post('/api/gh/personal').set(auth(gh)).send(persona({ nombre: 'Y', campana: 'RENT_TEST', costo_hora: 5000, horas_mes: 200 }));
  const costo = 5000 * 200 * 2; // 2.000.000

  // Simula la ultima carga de `resumen` del dashboard de esa campana con `recaudo`.
  // (El motor lee dashboard_cargas directamente; aqui insertamos la fila sin pasar
  //  por la validacion de plantilla, que no aplica a esta prueba del cruce.)
  db.prepare(
    `INSERT INTO dashboard_cargas (cliente, seccion, cadencia, periodo, filas, archivoNombre, cargadoPor, cargadoPorNombre, cargadoEn)
     VALUES (?, 'resumen', 'mensual', '2026-05', ?, NULL, NULL, 'test', '10/09/2026 00:00:00')`
  ).run('RENT_TEST', JSON.stringify([{ recaudo: 10000000, meta_recaudo: 12000000 }]));

  const dash = await request(app).get('/api/dashboard/GESTION_HUMANA').set(auth(gh));
  const camp = dash.body.secciones.por_campana[0].filas.find((f) => f.campana === 'RENT_TEST');
  assert.ok(camp, 'falta la campana RENT_TEST en por_campana');
  assert.equal(camp.activos, 2);
  assert.equal(camp.costo_mes, costo);
  assert.equal(camp.ingresos, 10000000);
  assert.equal(camp.rentabilidad, 10000000 - costo);
  assert.equal(camp.margen_pct, Math.round(((10000000 - costo) / 10000000) * 1000) / 10);
  // efectividad = produccion (recaudo) vs su meta (meta_recaudo), misma fila resumen
  assert.equal(camp.efectividad_pct, Math.round((10000000 / 12000000) * 1000) / 10);
});

test('dashboard GESTION_HUMANA: sin meta_recaudo/meta_ventas en el resumen, la efectividad queda en null', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const gh = await userToken(admin, 'GESTION_HUMANA', { GestionHumana: true });
  await request(app).post('/api/gh/personal').set(auth(gh)).send(persona({ campana: 'SIN_META', costo_hora: 1000, horas_mes: 100 }));
  db.prepare(
    `INSERT INTO dashboard_cargas (cliente, seccion, cadencia, periodo, filas, archivoNombre, cargadoPor, cargadoPorNombre, cargadoEn)
     VALUES (?, 'resumen', 'mensual', '2026-05', ?, NULL, NULL, 'test', '10/09/2026 00:00:00')`
  ).run('SIN_META', JSON.stringify([{ ventas: 500000 }])); // sin meta_ventas
  const dash = await request(app).get('/api/dashboard/GESTION_HUMANA').set(auth(gh));
  const camp = dash.body.secciones.por_campana[0].filas.find((f) => f.campana === 'SIN_META');
  assert.equal(camp.ingresos, 500000);
  assert.equal(camp.efectividad_pct, null);
});

test('dashboard GESTION_HUMANA: sin datos de ingresos, la rentabilidad queda en 0 (hueco documentado)', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const gh = await userToken(admin, 'GESTION_HUMANA', { GestionHumana: true });
  await request(app).post('/api/gh/personal').set(auth(gh)).send(persona({ campana: 'SIN_INGRESOS', costo_hora: 1000, horas_mes: 100 }));
  const dash = await request(app).get('/api/dashboard/GESTION_HUMANA').set(auth(gh));
  const camp = dash.body.secciones.por_campana[0].filas.find((f) => f.campana === 'SIN_INGRESOS');
  assert.equal(camp.costo_mes, 100000);
  assert.equal(camp.ingresos, 0);
  assert.equal(camp.rentabilidad, 0);
  assert.equal(camp.margen_pct, 0);
  assert.equal(camp.efectividad_pct, null);
});

test('GET /api/gh/resumen agrega activos y costo por campana', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const gh = await userToken(admin, 'GESTION_HUMANA', { GestionHumana: true });
  await request(app).post('/api/gh/personal').set(auth(gh)).send(persona({ campana: 'Z1', costo_hora: 1000, horas_mes: 100 }));
  const r = await request(app).get('/api/gh/resumen').set(auth(gh));
  assert.equal(r.status, 200);
  assert.ok(r.body.activos >= 1);
  const z1 = r.body.porCampana.find((c) => c.campana === 'Z1');
  assert.ok(z1 && z1.costo_mes === 100000);
});
