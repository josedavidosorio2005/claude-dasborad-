const { test } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, tokenFor, MASTER_PASSWORD } = require('./helpers');

const auth = (t) => ({ Authorization: `Bearer ${t}` });
const MES = '2026-06';

async function makeUser(adminToken, over) {
  const user = 'du_' + Math.random().toString(36).slice(2, 8);
  const res = await request(app)
    .post('/api/users')
    .set(auth(adminToken))
    .send({ nombre: 'Dash User', user, password: 'ClaveDash123', rol: 'CLIENTES_DASH', perms: {}, ...over, user });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return { id: res.body.id, user, token: await tokenFor(user, 'ClaveDash123') };
}

const RESUMEN_OK = {
  llamadas_3p: 3853, wpp_3p: 4269, llamadas_general: 12481, wpp_general: 2635,
  nivel_atencion_3p: 98, nivel_atencion_wpp_3p: 98, nivel_atencion_general: 87,
  ordmed_gestionados: 716, ordmed_agendas: 140, recup_cancelado: 655, recup_atendido: 290,
  total_agendas: 11918, agendas_general: 7281, agendas_3p: 4637,
  inasist_audifonos: 4, inasist_audiologia: 5, inasist_examenes: 6, inasist_total: 6,
  sta_ordenes: 3797, sta_factcump: 1064, citas_para_mes: 14488, citas_atendidas: 10831,
};

test('GET /api/dashboard/secciones/ORLANT lista las secciones', async () => {
  const t = await tokenFor('admin', MASTER_PASSWORD);
  const res = await request(app).get('/api/dashboard/secciones/ORLANT').set(auth(t));
  assert.equal(res.status, 200);
  assert.ok(res.body.secciones.resumen && res.body.secciones.tipificacion && res.body.secciones.salida);
  assert.equal(res.body.secciones.resumen.filaUnica, true);
});

test('cargar datos exige el permiso cargarDatos', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const sinPermiso = await makeUser(admin, { perms: { ClientesDash: true } });
  const r = await request(app)
    .post('/api/dashboard/cargas')
    .set(auth(sinPermiso.token))
    .send({ cliente: 'ORLANT', seccion: 'tipificacion', cadencia: 'mensual', periodo: MES, filas: [{ linea: '3P', tipificacion: 'X', cantidad: 1 }] });
  assert.equal(r.status, 403);
});

test('REPORTES trae cargarDatos:true automaticamente al crearse (feedback Edwin 2.1)', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const user = 'rep_' + Math.random().toString(36).slice(2, 8);
  // se crea SIN pasar cargarDatos en perms
  const created = await request(app).post('/api/users').set(auth(admin)).send({
    nombre: 'Reportes Auto', user, password: 'ClaveRep123', rol: 'REPORTES', perms: { campana_ORLANT: true },
  });
  assert.equal(created.status, 201, JSON.stringify(created.body));
  assert.equal(created.body.perms.cargarDatos, true, 'REPORTES debe traer cargarDatos sin asignarlo a mano');

  // y efectivamente puede cargar datos de dashboards
  const tok = await tokenFor(user, 'ClaveRep123');
  const carga = await request(app).post('/api/dashboard/cargas').set(auth(tok)).send({
    cliente: 'ORLANT', seccion: 'tipificacion', cadencia: 'mensual', periodo: '2026-07',
    filas: [{ linea: '3P', tipificacion: 'X', cantidad: 1 }],
  });
  assert.equal(carga.status, 201, JSON.stringify(carga.body));
});

test('cambiar el rol de un usuario a REPORTES le agrega cargarDatos (feedback Edwin 2.1)', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const u = await makeUser(admin, { rol: 'CALIDAD', perms: { Calidad: true } });
  const antes = await request(app).get('/api/users').set(auth(admin));
  assert.notEqual((antes.body.find((x) => x.id === u.id).perms || {}).cargarDatos, true);

  const upd = await request(app).put('/api/users/' + u.id).set(auth(admin)).send({ rol: 'REPORTES' });
  assert.equal(upd.status, 200);
  assert.equal(upd.body.perms.cargarDatos, true, 'al pasar a REPORTES debe ganar cargarDatos');
});

test('flujo completo: cargar resumen, leerlo en el dashboard, reemplazarlo', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const loader = await makeUser(admin, { rol: 'CALIDAD', perms: { Calidad: true, cargarDatos: true } });

  // carga inicial
  const c1 = await request(app)
    .post('/api/dashboard/cargas')
    .set(auth(loader.token))
    .send({ cliente: 'ORLANT', seccion: 'resumen', cadencia: 'mensual', periodo: MES, filas: [RESUMEN_OK] });
  assert.equal(c1.status, 201, JSON.stringify(c1.body));
  assert.equal(c1.body.filas[0].llamadas_3p, 3853);

  // el dashboard lo lee
  const dash = await request(app).get('/api/dashboard/ORLANT').set(auth(admin));
  assert.equal(dash.status, 200);
  assert.equal(dash.body.secciones.resumen[0].filas[0].total_agendas, 11918);

  // reemplazar el mismo periodo (upsert -> 200, no duplica)
  const c2 = await request(app)
    .post('/api/dashboard/cargas')
    .set(auth(loader.token))
    .send({ cliente: 'ORLANT', seccion: 'resumen', cadencia: 'mensual', periodo: MES, filas: [{ ...RESUMEN_OK, total_agendas: 99999 }] });
  assert.equal(c2.status, 200);
  const dash2 = await request(app).get('/api/dashboard/ORLANT').set(auth(admin));
  assert.equal(dash2.body.secciones.resumen.length, 1);
  assert.equal(dash2.body.secciones.resumen[0].filas[0].total_agendas, 99999);
});

test('validacion: resumen sin columnas obligatorias -> 400 con detalles', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const r = await request(app)
    .post('/api/dashboard/cargas')
    .set(auth(admin))
    .send({ cliente: 'ORLANT', seccion: 'resumen', cadencia: 'mensual', periodo: MES, filas: [{ llamadas_3p: 1 }] });
  assert.equal(r.status, 400);
  assert.ok(Array.isArray(r.body.detalles) && r.body.detalles.length > 5);
});

test('validacion: periodo con formato invalido -> 400', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const r = await request(app)
    .post('/api/dashboard/cargas')
    .set(auth(admin))
    .send({ cliente: 'ORLANT', seccion: 'tipificacion', cadencia: 'mensual', periodo: 'junio', filas: [{ linea: '3P', tipificacion: 'X', cantidad: 1 }] });
  assert.equal(r.status, 400);
});

test('acceso al dashboard: sin cliente_ORLANT -> 403; con permiso -> 200', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const sin = await makeUser(admin, { perms: { ClientesDash: true } });
  const con = await makeUser(admin, { perms: { ClientesDash: true, cliente_ORLANT: true } });

  assert.equal((await request(app).get('/api/dashboard/ORLANT').set(auth(sin.token))).status, 403);
  assert.equal((await request(app).get('/api/dashboard/ORLANT').set(auth(con.token))).status, 200);
});

test('M3: los dashboards de cliente nuevos respetan la misma logica de permisos', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const sin = await makeUser(admin, { perms: { ClientesDash: true } });
  const con = await makeUser(admin, { perms: { ClientesDash: true, cliente_INFONDO: true } });

  assert.equal((await request(app).get('/api/dashboard/INFONDO').set(auth(sin.token))).status, 403);
  const ok = await request(app).get('/api/dashboard/INFONDO').set(auth(con.token));
  assert.equal(ok.status, 200);
  assert.ok(ok.body.config.layout.tabs.some((t) => t.key === 'recaudo'));
  // El dashboard de SASCHA usa la plantilla de atencion y expone su KPI de pedidos.
  const sascha = await request(app)
    .get('/api/dashboards/config/' + encodeURIComponent('SASCHA FITNESS'))
    .set(auth(admin));
  assert.equal(sascha.status, 200);
  assert.ok(sascha.body.layout.kpis.some((k) => k.titulo === 'Pedidos'));
});

test('usuario semilla de dashboard cliente conserva acceso explicito a ORLANT', async () => {
  const token = await tokenFor('agomez', 'cli123');
  const res = await request(app).get('/api/dashboard/ORLANT').set(auth(token));
  assert.equal(res.status, 200);
});

test('configuracion editable de dashboards: solo el administrador puede leerla', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const viewer = await makeUser(admin, { perms: { ClientesDash: true, cliente_ORLANT: true } });

  assert.equal((await request(app).get('/api/dashboards/config').set(auth(viewer.token))).status, 403);
  assert.equal((await request(app).get('/api/dashboards/config/ORLANT').set(auth(viewer.token))).status, 403);

  const ok = await request(app).get('/api/dashboards/config').set(auth(admin));
  assert.equal(ok.status, 200);
  assert.ok(ok.body.some((r) => r.cliente === 'ORLANT'));
});

test('dashboard configurable: crea un cliente pendiente sin archivo JS nuevo', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const config = {
    cliente: 'DEMO QA',
    titulo: 'Dashboard Demo QA',
    vista: null,
    secciones: {
      resumen: {
        titulo: 'Resumen mensual',
        descripcion: 'Carga simple de prueba',
        cadencia: 'mensual',
        periodo: 'mes',
        filaUnica: true,
        columnas: [
          { key: 'llamadas', label: 'Llamadas', tipo: 'entero' },
          { key: 'nivel_atencion', label: 'Nivel atencion (%)', tipo: 'porcentaje' },
        ],
      },
    },
    layout: {
      kpis: [
        { titulo: 'Llamadas', formato: 'miles', fuente: { s: 'resumen', modo: 'ultimo', campo: 'llamadas' } },
        { titulo: 'Nivel atencion', formato: 'porcentaje', fuente: { s: 'resumen', modo: 'ultimo', campo: 'nivel_atencion' } },
      ],
      tabs: [
        {
          key: 'general',
          label: 'General',
          panels: [
            {
              tipo: 'line',
              titulo: 'Llamadas por mes',
              series: [{ label: 'Llamadas', fuente: { s: 'resumen', modo: 'serie', campo: 'llamadas' } }],
            },
          ],
        },
      ],
    },
  };

  const create = await request(app).post('/api/dashboards/config').set(auth(admin)).send(config);
  assert.equal(create.status, 201, JSON.stringify(create.body));

  const clientes = await request(app).get('/api/dashboard/clientes').set(auth(admin));
  assert.ok(clientes.body.clientes.includes('DEMO QA'));

  const carga = await request(app)
    .post('/api/dashboard/cargas')
    .set(auth(admin))
    .send({
      cliente: 'DEMO QA',
      seccion: 'resumen',
      cadencia: 'mensual',
      periodo: MES,
      filas: [{ llamadas: 42, nivel_atencion: 91 }],
    });
  assert.equal(carga.status, 201, JSON.stringify(carga.body));

  const dash = await request(app).get('/api/dashboard/' + encodeURIComponent('DEMO QA')).set(auth(admin));
  assert.equal(dash.status, 200);
  assert.equal(dash.body.config.layout.kpis.length, 2);
  assert.equal(dash.body.secciones.resumen[0].filas[0].llamadas, 42);

  const del = await request(app).delete('/api/dashboards/config/' + encodeURIComponent('DEMO QA')).set(auth(admin));
  assert.equal(del.status, 200);
});

test('Aurora y HLM tienen secciones definidas', async () => {
  const t = await tokenFor('admin', MASTER_PASSWORD);
  const cl = await request(app).get('/api/dashboard/clientes').set(auth(t));
  // Los 3 dashboards migrados + los 9 de cliente de M3 (Fase A2).
  ['CLINICA AURORA', 'HOSPITAL LA MARIA', 'ORLANT', 'TELEVENTAS SURA', 'INFONDO', 'BIVETT']
    .forEach((c) => assert.ok(cl.body.clientes.includes(c), 'falta ' + c));
  assert.equal(cl.body.clientes.length, 12);

  const au = await request(app).get('/api/dashboard/secciones/' + encodeURIComponent('CLINICA AURORA')).set(auth(t));
  assert.equal(au.status, 200);
  assert.ok(au.body.secciones.resumen && au.body.secciones.sabados);

  const hlm = await request(app).get('/api/dashboard/secciones/' + encodeURIComponent('HOSPITAL LA MARIA')).set(auth(t));
  assert.ok(hlm.body.secciones.dia && hlm.body.secciones.entidades);
});

test('HLM: carga por sede y lectura', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const c = await request(app)
    .post('/api/dashboard/cargas')
    .set(auth(admin))
    .send({
      cliente: 'HOSPITAL LA MARIA', seccion: 'resumen', cadencia: 'mensual', periodo: '2026-06',
      filas: [
        { sede: 'CASTILLA', llamadas_ingresadas: 14293, nivel_atencion: 76, llamadas_contestadas: 11030, llamadas_abandonadas: 3263, wpp_ingresados: 13926, agendas_wpp: 1450, agendas_llamada: 2109, aht_segundos: 199 },
        { sede: 'SEDE33', llamadas_ingresadas: 1602, nivel_atencion: 90, llamadas_contestadas: 1467, llamadas_abandonadas: 135, wpp_ingresados: 0, agendas_wpp: 0, agendas_llamada: 288, aht_segundos: 104, llamadas_salida: 6704, wpp_salida: 362 },
      ],
    });
  assert.equal(c.status, 201, JSON.stringify(c.body));
  assert.equal(c.body.filas.length, 2);
  const dash = await request(app).get('/api/dashboard/' + encodeURIComponent('HOSPITAL LA MARIA')).set(auth(admin));
  assert.equal(dash.body.secciones.resumen[0].filas.length, 2);
});

test('tipificacion multi-fila y borrado', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const create = await request(app)
    .post('/api/dashboard/cargas')
    .set(auth(admin))
    .send({
      cliente: 'ORLANT', seccion: 'tipificacion', cadencia: 'mensual', periodo: '2026-05',
      filas: [
        { linea: '3P', tipificacion: 'AGENDADA_InConexion', cantidad: 28 },
        { linea: 'GENERAL', tipificacion: 'INFORMACION_GENERAL', cantidad: 12 },
      ],
    });
  assert.equal(create.status, 201);
  assert.equal(create.body.filas.length, 2);

  const del = await request(app).delete(`/api/dashboard/cargas/${create.body.id}`).set(auth(admin));
  assert.equal(del.status, 200);
});
