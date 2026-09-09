// tests/inventario-gerencia.test.js — Pruebas para Inventario y Gerencia.
const test = require('node:test');
const assert = require('node:assert/strict');
const { app, request, tokenFor, MASTER_PASSWORD, SEED } = require('./helpers');

test('Inventario: CRUD de items y control de permisos', async (t) => {
  const adminToken = await tokenFor('admin', MASTER_PASSWORD);
  const invToken = await tokenFor('mlopez', SEED.mlopez); // rol INVENTARIO con perms.Inventario: true
  const noInvToken = await tokenFor('crodriguez', SEED.crodriguez); // rol CALIDAD sin perms.Inventario

  // 1. Usuario sin permiso recibe 403
  const resNoAcc = await request(app)
    .get('/api/inventario/items')
    .set('Authorization', 'Bearer ' + noInvToken);
  assert.equal(resNoAcc.status, 403);

  // 2. Crear un item como usuario de inventario
  const itemData = {
    nombre: 'Audifonos USB Pro',
    categoria: 'Equipos',
    descripcion: 'Para asesores de contact center',
    cantidad: 25,
    unidad: 'un',
    ubicacion: 'Bodega 1',
    estado: 'Disponible',
    proveedor: 'Logitech',
    costoUnitario: 85000,
    observaciones: 'Lote nuevo',
  };
  const resCrear = await request(app)
    .post('/api/inventario/items')
    .set('Authorization', 'Bearer ' + invToken)
    .send(itemData);
  assert.equal(resCrear.status, 201);
  assert.equal(resCrear.body.nombre, 'Audifonos USB Pro');
  assert.equal(resCrear.body.cantidad, 25);
  const itemId = resCrear.body.id;

  // 3. Listar items
  const resList = await request(app)
    .get('/api/inventario/items')
    .set('Authorization', 'Bearer ' + invToken);
  assert.equal(resList.status, 200);
  assert.ok(resList.body.length >= 1);
  assert.ok(resList.body.some((it) => it.id === itemId));

  // 4. Resumen
  const resResumen = await request(app)
    .get('/api/inventario/resumen')
    .set('Authorization', 'Bearer ' + invToken);
  assert.equal(resResumen.status, 200);
  assert.ok(resResumen.body.total >= 1);
  assert.ok(resResumen.body.totalUnidades >= 25);

  // 5. Registrar movimiento de salida
  const movData = {
    itemId,
    tipo: 'Salida',
    cantidad: 5,
    fecha: '2026-09-09',
    motivo: 'Entrega a nuevo asesor',
  };
  const resMov = await request(app)
    .post('/api/inventario/movimientos')
    .set('Authorization', 'Bearer ' + invToken)
    .send(movData);
  assert.equal(resMov.status, 201);

  // Verificar que la cantidad del item se redujo
  const resList2 = await request(app)
    .get('/api/inventario/items')
    .set('Authorization', 'Bearer ' + invToken);
  const updatedItem = resList2.body.find((it) => it.id === itemId);
  assert.equal(updatedItem.cantidad, 20); // 25 - 5

  // 6. Carga masiva de items (simulando Excel)
  const cargaItems = [
    { nombre: 'Mouse Optico', categoria: 'Equipos', cantidad: 50, unidad: 'un' },
    { nombre: 'Teclado USB', categoria: 'Equipos', cantidad: 40, unidad: 'un' },
  ];
  const resCarga = await request(app)
    .post('/api/inventario/carga-items')
    .set('Authorization', 'Bearer ' + invToken)
    .send({ items: cargaItems });
  assert.equal(resCarga.status, 201);
  assert.equal(resCarga.body.creados, 2);

  // 7. Eliminar item
  const resDel = await request(app)
    .delete('/api/inventario/items/' + itemId)
    .set('Authorization', 'Bearer ' + adminToken);
  assert.equal(resDel.status, 200);
});

test('Gerencia: CRUD de KPIs y control de permisos', async (t) => {
  const adminToken = await tokenFor('admin', MASTER_PASSWORD);
  const gerToken = await tokenFor('jherrera', SEED.jherrera); // rol GERENCIA con perms.Gerencia: true
  const noGerToken = await tokenFor('crodriguez', SEED.crodriguez); // rol CALIDAD sin perms.Gerencia

  // 1. Usuario sin permiso recibe 403
  const resNoAcc = await request(app)
    .get('/api/gerencia/kpis')
    .set('Authorization', 'Bearer ' + noGerToken);
  assert.equal(resNoAcc.status, 403);

  // 2. Crear KPI individual
  const kpiData = {
    periodo: '2026-09',
    nombre: 'Nivel de Atencion Global',
    categoria: 'Operaciones',
    valor: 94.2,
    unidad: '%',
    meta: 90.0,
    observaciones: 'Meta superada',
  };
  const resCrear = await request(app)
    .post('/api/gerencia/kpis')
    .set('Authorization', 'Bearer ' + gerToken)
    .send(kpiData);
  assert.equal(resCrear.status, 201);
  assert.equal(resCrear.body.nombre, 'Nivel de Atencion Global');
  assert.equal(resCrear.body.valor, 94.2);
  const kpiId = resCrear.body.id;

  // 3. Resumen gerencial
  const resResumen = await request(app)
    .get('/api/gerencia/resumen?periodo=2026-09')
    .set('Authorization', 'Bearer ' + gerToken);
  assert.equal(resResumen.status, 200);
  assert.equal(resResumen.body.periodo, '2026-09');
  assert.ok(resResumen.body.kpis.length >= 1);
  assert.ok(resResumen.body.porCategoria['Operaciones']);

  // 4. Periodos disponibles
  const resPeriodos = await request(app)
    .get('/api/gerencia/periodos')
    .set('Authorization', 'Bearer ' + gerToken);
  assert.equal(resPeriodos.status, 200);
  assert.ok(resPeriodos.body.includes('2026-09'));

  // 5. Carga masiva de KPIs (simulando Excel)
  const cargaKpis = {
    periodo: '2026-09',
    kpis: [
      { nombre: 'AHT Promedio', categoria: 'Operaciones', valor: 380, unidad: 'seg', meta: 400 },
      { nombre: 'Costo por Contacto', categoria: 'Financiero', valor: 3200, unidad: 'COP', meta: 3500 },
    ],
  };
  const resCarga = await request(app)
    .post('/api/gerencia/carga')
    .set('Authorization', 'Bearer ' + gerToken)
    .send(cargaKpis);
  assert.equal(resCarga.status, 201);
  assert.equal(resCarga.body.upserted, 2);

  // 6. Eliminar KPI
  const resDel = await request(app)
    .delete('/api/gerencia/kpis/' + kpiId)
    .set('Authorization', 'Bearer ' + adminToken);
  assert.equal(resDel.status, 200);
});

test('M4: dashboards configurables de Inventario y Gerencia (adaptadores)', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const invToken = await tokenFor('mlopez', SEED.mlopez);   // perms.Inventario
  const gerToken = await tokenFor('jherrera', SEED.jherrera); // perms.Gerencia
  const B = (t) => 'Bearer ' + t;

  // Datos base
  await request(app).post('/api/inventario/items').set('Authorization', B(invToken))
    .send({ nombre: 'Diadema QA', categoria: 'Equipos', cantidad: 10, unidad: 'un', estado: 'Disponible', costoUnitario: 50000 });
  await request(app).post('/api/inventario/items').set('Authorization', B(invToken))
    .send({ nombre: 'Silla QA', categoria: 'Mobiliario', cantidad: 0, unidad: 'un', estado: 'Mantenimiento', costoUnitario: 200000 });
  await request(app).post('/api/gerencia/kpis').set('Authorization', B(gerToken))
    .send({ periodo: '2026-08', nombre: 'Nivel de atencion', categoria: 'Operaciones', valor: 92, unidad: '%', meta: 90 });
  await request(app).post('/api/gerencia/kpis').set('Authorization', B(gerToken))
    .send({ periodo: '2026-08', nombre: 'Productividad', categoria: 'Operaciones', valor: 80, unidad: '%', meta: 90 });

  // Inventario: renderiza por el motor generico, con KPIs derivados y alerta de sin stock
  const itemsAll = (await request(app).get('/api/inventario/items').set('Authorization', B(invToken))).body;
  const inv = await request(app).get('/api/dashboard/INVENTARIO').set('Authorization', B(invToken));
  assert.equal(inv.status, 200);
  assert.equal(inv.body.config.cliente, 'INVENTARIO');
  const invResumen = inv.body.secciones.resumen[0].filas[0];
  assert.equal(invResumen.items, itemsAll.length);
  assert.equal(invResumen.sin_stock, itemsAll.filter((i) => i.cantidad <= 0).length);
  assert.ok(invResumen.sin_stock >= 1); // la "Silla QA" quedo en 0
  assert.ok(inv.body.secciones.por_categoria[0].filas.length >= 2);

  // Gerencia: % cumplimiento derivado por periodo
  const ger = await request(app).get('/api/dashboard/GERENCIA').set('Authorization', B(gerToken));
  assert.equal(ger.status, 200);
  const gr = ger.body.secciones.resumen.find((r) => r.periodo === '2026-08').filas[0];
  assert.equal(gr.con_meta, 2);
  assert.equal(gr.cumplen, 1); // 92>=90 si, 80>=90 no
  assert.equal(gr.pct_cumplimiento, 50);

  // Permisos: sin el permiso del modulo -> 403
  assert.equal((await request(app).get('/api/dashboard/GERENCIA').set('Authorization', B(invToken))).status, 403);
  assert.equal((await request(app).get('/api/dashboard/INVENTARIO').set('Authorization', B(gerToken))).status, 403);

  // No se pueden cargar Excel contra estos (no estan en dashboards_config)
  const carga = await request(app).post('/api/dashboard/cargas').set('Authorization', B(admin))
    .send({ cliente: 'INVENTARIO', seccion: 'resumen', cadencia: 'mensual', periodo: '2026-08', filas: [{ items: 1 }] });
  assert.equal(carga.status, 400);
});
