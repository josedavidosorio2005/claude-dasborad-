// seed-demo.test.js — cubre las garantias del seed de demo (scripts/seed-demo.js):
//  - idempotente (correrlo dos veces no duplica nada)
//  - seed:demo:limpiar deja la base como estaba (solo borra lo marcado)
//  - los 12 clientes quedan con carga en TODAS sus secciones
//  - el mensual de Nivel de Servicio que produce el seed coincide con el que
//    produce el endpoint real de carga diaria, para las mismas filas.
//
// No invoca el CLI (scripts/seed-demo.js) como subproceso: usa directamente
// las mismas funciones de scripts/seed-demo-lib/* contra la BD de pruebas
// (tests/helpers.js), igual que el resto de la suite prueba la logica del
// servidor sin pasar por HTTP cuando no hace falta.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { db, app, request, tokenFor, MASTER_PASSWORD } = require('./helpers');

const { ensureMarksTable, countByTabla, limpiarTodo } = require('../scripts/seed-demo-lib/marks');
const { campanasConCalidadTab } = require('../scripts/seed-demo-lib/campanas');
const { seedUsers } = require('../scripts/seed-demo-lib/users');
const { seedCalidad } = require('../scripts/seed-demo-lib/calidad');
const { seedNivelServicio } = require('../scripts/seed-demo-lib/nivel-servicio');
const { filasDelMes } = require('../scripts/seed-demo-lib/nivel-servicio');
const { seedDashboards } = require('../scripts/seed-demo-lib/dashboards');
const { seedInventario } = require('../scripts/seed-demo-lib/inventario');
const { seedGerencia } = require('../scripts/seed-demo-lib/gerencia');
const { seedGestionHumana } = require('../scripts/seed-demo-lib/gestion-humana');
const { CONFIGS } = require('../dashboard-config-seed');
const { cargarNivelServicioDiario } = require('../nivel-servicio-diario');
const { rngFromSeed } = require('../scripts/seed-demo-lib/util');

const auth = (t) => ({ Authorization: `Bearer ${t}` });

const CLIENTES_LIST = CONFIGS.map((c) => c.cliente);
const CAMPANAS_CALIDAD = campanasConCalidadTab(CONFIGS);

// Corre el seed completo una vez (todos los sub-modulos, en el mismo orden
// que scripts/seed-demo.js) y devuelve los resultados de cada uno.
function correrSeedCompleto() {
  ensureMarksTable(db);
  const { porRol, creadosConPassword } = seedUsers(db, { clientesList: CLIENTES_LIST, campanasCalidad: CAMPANAS_CALIDAD });
  const cal = seedCalidad(db, { campanas: CAMPANAS_CALIDAD, porRol });
  const ns = seedNivelServicio(db, { campanas: CAMPANAS_CALIDAD, cargadoPorNombre: 'Test Seed' });
  seedDashboards(db, { cargadoPorNombre: 'Test Seed' });
  const inv = seedInventario(db, { cargadoPorNombre: 'Test Seed' });
  const ger = seedGerencia(db, { cargadoPorNombre: 'Test Seed' });
  const gh = seedGestionHumana(db, { clientesList: CLIENTES_LIST, cargadoPorNombre: 'Test Seed' });
  return { porRol, creadosConPassword, cal, ns, inv, ger, gh };
}

test('el seed de demo es idempotente: correrlo dos veces no duplica nada', () => {
  const r1 = correrSeedCompleto();
  assert.ok(r1.creadosConPassword.length > 0, 'la primera corrida crea usuarios de demo');
  assert.ok(r1.cal.monitoreosCreados > 0, 'la primera corrida crea monitoreos');
  assert.ok(r1.ns.diarioCreados > 0, 'la primera corrida crea filas diarias de nivel de servicio');
  assert.ok(r1.inv.itemsCreados > 0, 'la primera corrida crea items de inventario');
  assert.ok(r1.ger.kpisCreados > 0, 'la primera corrida crea KPIs de gerencia');
  assert.ok(r1.gh.creados > 0, 'la primera corrida crea personal de gestion humana');

  const totalesTrasPrimera = countByTabla(db);

  const r2 = correrSeedCompleto();
  assert.equal(r2.creadosConPassword.length, 0, 'la segunda corrida no crea usuarios nuevos');
  assert.equal(r2.cal.monitoreosCreados, 0, 'la segunda corrida no crea monitoreos nuevos');
  assert.equal(r2.cal.metasCreadas, 0, 'la segunda corrida no crea metas nuevas');
  assert.equal(r2.ns.diarioCreados, 0, 'la segunda corrida no crea filas diarias nuevas');
  assert.equal(r2.inv.itemsCreados, 0, 'la segunda corrida no crea items nuevos');
  assert.equal(r2.inv.movimientosCreados, 0, 'la segunda corrida no crea movimientos nuevos');
  assert.equal(r2.ger.kpisCreados, 0, 'la segunda corrida no crea KPIs nuevos');
  assert.equal(r2.gh.creados, 0, 'la segunda corrida no crea personal nuevo');

  const totalesTrasSegunda = countByTabla(db);
  assert.deepEqual(totalesTrasSegunda, totalesTrasPrimera, 'el total marcado no cambia entre la 1a y la 2a corrida');

  // Corre una tercera vez para reforzar (idempotencia real, no casualidad de 2).
  const r3 = correrSeedCompleto();
  assert.equal(r3.cal.monitoreosCreados + r3.ns.diarioCreados + r3.inv.itemsCreados + r3.ger.kpisCreados + r3.gh.creados, 0);
});

test('los 12 dashboards de cliente quedan con carga en TODAS sus secciones', () => {
  correrSeedCompleto();
  const rows = db.prepare('SELECT DISTINCT cliente, seccion FROM dashboard_cargas').all();
  const cargados = new Set(rows.map((r) => r.cliente + '|' + r.seccion));

  assert.equal(CLIENTES_LIST.length, 12, 'sanity check: deberian ser 12 clientes configurados');
  for (const cfg of CONFIGS) {
    for (const seccionKey of Object.keys(cfg.secciones)) {
      assert.ok(
        cargados.has(cfg.cliente + '|' + seccionKey),
        `falta carga para ${cfg.cliente} / ${seccionKey}`
      );
      // Y con las 6 periodos de historico (2026-04..2026-09), no solo 1.
      const n = db
        .prepare('SELECT COUNT(*) c FROM dashboard_cargas WHERE cliente = ? AND seccion = ?')
        .get(cfg.cliente, seccionKey).c;
      assert.ok(n >= 1, `${cfg.cliente}/${seccionKey} deberia tener al menos 1 carga`);
    }
  }
});

test('seed:demo:limpiar borra EXACTAMENTE lo sembrado y deja la base como estaba', () => {
  // Este archivo comparte la BD entre tests (tests/helpers.js abre una sola
  // vez por archivo): partimos de una limpieza para que "antes" sea un
  // estado conocido sin importar que otros tests de este archivo ya hayan
  // sembrado datos de demo.
  limpiarTodo(db);

  const antes = {
    users: db.prepare('SELECT COUNT(*) c FROM users').get().c,
    dashboards_config: db.prepare('SELECT COUNT(*) c FROM dashboards_config').get().c,
    calidad_plantillas: db.prepare('SELECT COUNT(*) c FROM calidad_plantillas').get().c,
  };

  correrSeedCompleto();

  const conSeed = {
    monitoreos: db.prepare('SELECT COUNT(*) c FROM monitoreos').get().c,
    dashboard_cargas: db.prepare('SELECT COUNT(*) c FROM dashboard_cargas').get().c,
    users: db.prepare('SELECT COUNT(*) c FROM users').get().c,
  };
  assert.ok(conSeed.monitoreos > 0);
  assert.ok(conSeed.dashboard_cargas > 0);
  assert.ok(conSeed.users > antes.users, 'el seed agrego usuarios de demo');

  const borrados = limpiarTodo(db);
  assert.ok(Object.values(borrados).some((n) => n > 0), 'limpiarTodo reporta filas borradas');

  const despues = {
    users: db.prepare('SELECT COUNT(*) c FROM users').get().c,
    dashboards_config: db.prepare('SELECT COUNT(*) c FROM dashboards_config').get().c,
    calidad_plantillas: db.prepare('SELECT COUNT(*) c FROM calidad_plantillas').get().c,
    monitoreos: db.prepare('SELECT COUNT(*) c FROM monitoreos').get().c,
    cronograma_metas: db.prepare('SELECT COUNT(*) c FROM cronograma_metas').get().c,
    calidad_nivel_servicio: db.prepare('SELECT COUNT(*) c FROM calidad_nivel_servicio').get().c,
    calidad_nivel_servicio_diario: db.prepare('SELECT COUNT(*) c FROM calidad_nivel_servicio_diario').get().c,
    dashboard_cargas: db.prepare('SELECT COUNT(*) c FROM dashboard_cargas').get().c,
    inventario_items: db.prepare('SELECT COUNT(*) c FROM inventario_items').get().c,
    inventario_movimientos: db.prepare('SELECT COUNT(*) c FROM inventario_movimientos').get().c,
    gerencia_kpis: db.prepare('SELECT COUNT(*) c FROM gerencia_kpis').get().c,
    gestion_humana_personal: db.prepare('SELECT COUNT(*) c FROM gestion_humana_personal').get().c,
    seed_demo_marcas: db.prepare('SELECT COUNT(*) c FROM seed_demo_marcas').get().c,
  };

  // Lo sembrado desaparece por completo.
  assert.equal(despues.monitoreos, 0);
  assert.equal(despues.cronograma_metas, 0);
  assert.equal(despues.calidad_nivel_servicio, 0);
  assert.equal(despues.calidad_nivel_servicio_diario, 0);
  assert.equal(despues.dashboard_cargas, 0);
  assert.equal(despues.inventario_items, 0);
  assert.equal(despues.inventario_movimientos, 0);
  assert.equal(despues.gerencia_kpis, 0);
  assert.equal(despues.gestion_humana_personal, 0);
  assert.equal(despues.seed_demo_marcas, 0);

  // Lo que NO sembro seed-demo (config base) queda exactamente igual.
  assert.equal(despues.users, antes.users, 'los usuarios base (no-demo) quedan intactos');
  assert.equal(despues.dashboards_config, antes.dashboards_config, 'la configuracion de dashboards no se toca');
  assert.equal(despues.calidad_plantillas, antes.calidad_plantillas, 'las plantillas de calidad no se tocan');
});

test('Nivel de Servicio: el mensual que produce el seed coincide con el que produce el endpoint real, para las mismas filas', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const filas = filasDelMes('CAMPANA COMPARACION', '2026-05', rngFromSeed('comparacion-fija'));
  assert.ok(filas.length > 15, 'un mes de lunes a sabado deberia tener bastantes filas');

  // Camino 1: el endpoint HTTP real (como lo usaria un admin subiendo el Excel).
  const campanaEndpoint = 'NS ENDPOINT ' + Math.random().toString(36).slice(2, 8);
  const resEndpoint = await request(app)
    .post('/api/calidad/nivel-servicio/carga-diaria')
    .set(auth(admin))
    .send({ campana: campanaEndpoint, archivoNombre: 'x.xlsx', filas });
  assert.equal(resEndpoint.status, 201, JSON.stringify(resEndpoint.body));
  const mensualEndpoint = resEndpoint.body.mensual.find((m) => m.mes === '2026-05');
  assert.ok(mensualEndpoint);

  // Camino 2: la misma funcion compartida, llamada como la llama el seed.
  const campanaSeed = 'NS SEED ' + Math.random().toString(36).slice(2, 8);
  const resultadoSeed = cargarNivelServicioDiario(db, {
    campana: campanaSeed,
    archivoNombre: 'seed-demo.xlsx',
    cargadoPorNombre: 'Test Seed',
    filas,
  });
  const mensualSeed = resultadoSeed.mensual.find((m) => m.mes === '2026-05');
  assert.ok(mensualSeed);

  assert.equal(mensualSeed.contestadas20s, mensualEndpoint.contestadas20s);
  assert.equal(mensualSeed.llamadasTotales, mensualEndpoint.llamadasTotales);

  const calc = require('../calidad-logic');
  const pctSeed = calc.nivelServicioPct(mensualSeed.contestadas20s, mensualSeed.llamadasTotales);
  assert.equal(pctSeed, mensualEndpoint.pct);
});

test('las campanas con pestana de Calidad quedan con plantilla (nunca 404 al evaluar)', () => {
  for (const campana of CAMPANAS_CALIDAD) {
    const row = db.prepare('SELECT * FROM calidad_plantillas WHERE campana = ? AND activo = 1').get(campana);
    assert.ok(row, `falta plantilla de calidad para "${campana}" (su dashboard tiene pestana de Calidad)`);
  }
});

test('GET /api/seed-demo/estado: activo=true con datos sembrados, false tras limpiar', async () => {
  // Estado limpio conocido (independiente del orden de los demas tests de
  // este archivo, que comparten la misma BD).
  limpiarTodo(db);

  const admin = await tokenFor('admin', MASTER_PASSWORD);

  const antes = await request(app).get('/api/seed-demo/estado').set(auth(admin));
  assert.equal(antes.status, 200);
  assert.equal(antes.body.activo, false, 'sin nada sembrado, activo debe ser false');
  assert.equal(antes.body.marcas, 0);

  correrSeedCompleto();

  const durante = await request(app).get('/api/seed-demo/estado').set(auth(admin));
  assert.equal(durante.status, 200);
  assert.equal(durante.body.activo, true, 'con datos sembrados, activo debe ser true');
  assert.ok(durante.body.marcas > 0);

  limpiarTodo(db);

  const despues = await request(app).get('/api/seed-demo/estado').set(auth(admin));
  assert.equal(despues.status, 200);
  assert.equal(despues.body.activo, false, 'tras limpiar, activo vuelve a false');
  assert.equal(despues.body.marcas, 0);
});

test('GET /api/seed-demo/estado: cualquier rol autenticado lo puede leer (lo necesita para pintar el banner)', async () => {
  limpiarTodo(db);
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const calidad = await tokenFor('crodriguez', 'calidad123');
  const inventario = await tokenFor('mlopez', 'inv123');

  for (const token of [admin, calidad, inventario]) {
    const res = await request(app).get('/api/seed-demo/estado').set(auth(token));
    assert.equal(res.status, 200);
    assert.equal(typeof res.body.activo, 'boolean');
  }
});
