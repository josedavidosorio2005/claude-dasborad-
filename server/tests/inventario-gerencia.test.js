// tests/inventario-gerencia.test.js — Pruebas para Inventario y Gerencia.
const test = require('node:test');
const assert = require('node:assert/strict');
const { app, request, tokenFor, MASTER_PASSWORD, SEED } = require('./helpers');

// Fase 383: el Inventario anterior se retiró (lo reemplaza el Inventario de sistemas). Toda ruta
// /inventario/* responde 410 «retirado» a cualquier usuario con sesión; sin sesión, 401. Nada se borra.
test('Inventario anterior: retirado (410 para todos), sin sesión 401', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const rolInv = await tokenFor('mlopez', SEED.mlopez); // rol INVENTARIO con perms.Inventario
  const calidad = await tokenFor('crodriguez', SEED.crodriguez);
  const rutas = [['get', '/api/inventario/items'], ['get', '/api/inventario/resumen'], ['get', '/api/inventario/movimientos'],
    ['post', '/api/inventario/items'], ['put', '/api/inventario/items/1'], ['delete', '/api/inventario/items/1'],
    ['post', '/api/inventario/movimientos'], ['post', '/api/inventario/carga-items'], ['post', '/api/inventario/carga-movimientos']];
  for (const tok of [admin, rolInv, calidad]) {
    for (const [m, ruta] of rutas) {
      const r = await request(app)[m](ruta).set('Authorization', 'Bearer ' + tok).send({ nombre: 'X', cantidad: 1 });
      // Las cargas pasan antes por el tope de cargas (Fase 154): sin el permiso del módulo, 403 sin leer el cuerpo.
      if (r.status === 403 && ruta.includes('/carga-') && tok !== admin) continue;
      assert.equal(r.status, 410, m + ' ' + ruta);
      assert.equal(r.body.codigo, 'retirado');
      assert.match(r.body.error, /Inventario de sistemas/);
    }
  }
  assert.equal((await request(app).get('/api/inventario/items')).status, 401);
});

test('Gerencia: LECTURA con perms.Gerencia, ESCRITURA solo con Cargar Datos (feedback Edwin 2.2)', async (t) => {
  const adminToken = await tokenFor('admin', MASTER_PASSWORD);
  const gerToken = await tokenFor('jherrera', SEED.jherrera); // rol GERENCIA, perms.Gerencia: true, SIN cargarDatos
  const noGerToken = await tokenFor('crodriguez', SEED.crodriguez); // rol CALIDAD sin perms.Gerencia
  // Un cargador de datos (rol REPORTES -> cargarDatos automatico, ver 2.1)
  const loaderUser = 'gerload_' + Math.random().toString(36).slice(2, 8);
  await request(app).post('/api/users').set('Authorization', 'Bearer ' + adminToken)
    .send({ nombre: 'Ger Loader', user: loaderUser, password: 'ClaveLoad123', rol: 'REPORTES', perms: {} });
  const loaderToken = await tokenFor(loaderUser, 'ClaveLoad123');

  // 1. Usuario sin perms.Gerencia no puede ni leer
  assert.equal((await request(app).get('/api/gerencia/kpis').set('Authorization', 'Bearer ' + noGerToken)).status, 403);

  // 2. Gerencia PUEDE leer
  const kpiData = { periodo: '2026-09', nombre: 'Nivel de Atencion Global', categoria: 'Operaciones', valor: 94.2, unidad: '%', meta: 90.0 };
  // ...pero NO puede crear
  const gerCrea = await request(app).post('/api/gerencia/kpis').set('Authorization', 'Bearer ' + gerToken).send(kpiData);
  assert.equal(gerCrea.status, 403, 'Gerencia es solo lectura: POST /gerencia/kpis debe dar 403');

  // 3. El cargador de datos SI crea
  const resCrear = await request(app).post('/api/gerencia/kpis').set('Authorization', 'Bearer ' + loaderToken).send(kpiData);
  assert.equal(resCrear.status, 201, JSON.stringify(resCrear.body));
  const kpiId = resCrear.body.id;

  // 4. Gerencia lee KPIs, resumen y periodos (200)
  assert.equal((await request(app).get('/api/gerencia/kpis?periodo=2026-09').set('Authorization', 'Bearer ' + gerToken)).status, 200);
  const resResumen = await request(app).get('/api/gerencia/resumen?periodo=2026-09').set('Authorization', 'Bearer ' + gerToken);
  assert.equal(resResumen.status, 200);
  assert.ok(resResumen.body.porCategoria['Operaciones']);
  assert.ok((await request(app).get('/api/gerencia/periodos').set('Authorization', 'Bearer ' + gerToken)).body.includes('2026-09'));

  // 5. Gerencia NO puede editar, borrar ni cargar Excel
  assert.equal((await request(app).put('/api/gerencia/kpis/' + kpiId).set('Authorization', 'Bearer ' + gerToken).send({ valor: 1 })).status, 403);
  assert.equal((await request(app).delete('/api/gerencia/kpis/' + kpiId).set('Authorization', 'Bearer ' + gerToken)).status, 403);
  assert.equal((await request(app).post('/api/gerencia/carga').set('Authorization', 'Bearer ' + gerToken)
    .send({ periodo: '2026-09', kpis: [{ nombre: 'X', categoria: 'Operaciones', valor: 1, meta: 1 }] })).status, 403);

  // 6. El cargador de datos SI puede la carga masiva y el borrado
  const resCarga = await request(app).post('/api/gerencia/carga').set('Authorization', 'Bearer ' + loaderToken).send({
    periodo: '2026-09',
    kpis: [
      { nombre: 'AHT Promedio', categoria: 'Operaciones', valor: 380, unidad: 'seg', meta: 400 },
      { nombre: 'Costo por Contacto', categoria: 'Financiero', valor: 3200, unidad: 'COP', meta: 3500 },
    ],
  });
  assert.equal(resCarga.status, 201);
  assert.equal(resCarga.body.upserted, 2);
  assert.equal((await request(app).delete('/api/gerencia/kpis/' + kpiId).set('Authorization', 'Bearer ' + adminToken)).status, 200);
});

test('M4: dashboard configurable de Gerencia (adaptador); el de Inventario se retiró', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const rolInvToken = await tokenFor('mlopez', SEED.mlopez);   // perms.Inventario (módulo retirado)
  // Fase 383: el tablero del Inventario anterior ya no existe.
  assert.equal((await request(app).get('/api/dashboard/INVENTARIO').set('Authorization', 'Bearer ' + admin)).status, 404);
  assert.equal((await request(app).get('/api/dashboard/INVENTARIO').set('Authorization', 'Bearer ' + rolInvToken)).status, 404);
  const gerToken = await tokenFor('jherrera', SEED.jherrera); // perms.Gerencia
  const B = (t) => 'Bearer ' + t;

  // Datos base
  // Gerencia es solo lectura (2.2): los KPIs los carga el admin / un cargador de datos.
  await request(app).post('/api/gerencia/kpis').set('Authorization', B(admin))
    .send({ periodo: '2026-08', nombre: 'Nivel de atencion', categoria: 'Operaciones', valor: 92, unidad: '%', meta: 90 });
  await request(app).post('/api/gerencia/kpis').set('Authorization', B(admin))
    .send({ periodo: '2026-08', nombre: 'Productividad', categoria: 'Operaciones', valor: 80, unidad: '%', meta: 90 });

  // Gerencia: % cumplimiento derivado por periodo
  const ger = await request(app).get('/api/dashboard/GERENCIA').set('Authorization', B(gerToken));
  assert.equal(ger.status, 200);
  const gr = ger.body.secciones.resumen.find((r) => r.periodo === '2026-08').filas[0];
  assert.equal(gr.con_meta, 2);
  assert.equal(gr.cumplen, 1); // 92>=90 si, 80>=90 no
  assert.equal(gr.pct_cumplimiento, 50);

  // Permisos: sin el permiso del modulo -> 403
  assert.equal((await request(app).get('/api/dashboard/GERENCIA').set('Authorization', B(rolInvToken))).status, 403);
  assert.equal((await request(app).get('/api/dashboard/INVENTARIO').set('Authorization', B(gerToken))).status, 404); // Fase 383: retirado

  // No se pueden cargar Excel contra estos (no estan en dashboards_config)
  const carga = await request(app).post('/api/dashboard/cargas').set('Authorization', B(admin))
    .send({ cliente: 'INVENTARIO', seccion: 'resumen', cadencia: 'mensual', periodo: '2026-08', filas: [{ items: 1 }] });
  assert.equal(carga.status, 400);
});
