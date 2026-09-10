// tests/role-matrix.test.js — Fase 7: matriz de acceso por rol.
//
// Confirma que cada rol ve exactamente lo que debe: qué endpoints/módulos puede
// tocar y cuáles le devuelven 403. Cubre los 10 roles del sistema.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, tokenFor, MASTER_PASSWORD, SEED } = require('./helpers');

const auth = (t) => ({ Authorization: `Bearer ${t}` });

async function crearUsuario(adminToken, rol, perms) {
  const user = 'rm_' + Math.random().toString(36).slice(2, 8);
  const res = await request(app).post('/api/users').set(auth(adminToken)).send({
    nombre: `RM ${rol}`, user, password: 'ClaveRoleMx123', rol, perms: perms || {},
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return tokenFor(user, 'ClaveRoleMx123');
}

const st = (res) => res.status;

test('matriz de roles: cada rol accede solo a lo suyo', async (t) => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);

  // Datos mínimos para que haya algo que leer
  await request(app).post('/api/inventario/items').set(auth(admin))
    .send({ nombre: 'Item RM', categoria: 'Equipos', cantidad: 5, unidad: 'un', estado: 'Disponible', costoUnitario: 1000 });
  await request(app).post('/api/gerencia/kpis').set(auth(admin))
    .send({ periodo: '2026-08', nombre: 'KPI RM', categoria: 'Operaciones', valor: 90, unidad: '%', meta: 85 });

  const G = (tok, path) => request(app).get(path).set(auth(tok)).then(st);

  // ── ADMIN (master) ──
  await t.test('ADMIN ve todo', async () => {
    assert.equal(await G(admin, '/api/users'), 200);
    assert.equal(await G(admin, '/api/dashboards/config'), 200);
    assert.equal(await G(admin, '/api/dashboard/INVENTARIO'), 200);
    assert.equal(await G(admin, '/api/dashboard/GERENCIA'), 200);
    assert.equal(await G(admin, '/api/dashboard/ORLANT'), 200);
    assert.equal(await G(admin, '/api/monitoreos?campana=ORLANT'), 200);
    assert.equal(await G(admin, '/api/historial'), 200);
  });

  // ── CALIDAD (crodriguez): campañas de calidad, NADA de inventario/gerencia ──
  await t.test('CALIDAD: monitoreos sí, inventario/gerencia no', async () => {
    const tok = await tokenFor('crodriguez', SEED.crodriguez);
    assert.equal(await G(tok, '/api/monitoreos?campana=ORLANT'), 200);
    assert.equal(await G(tok, '/api/calidad/plantillas'), 200);
    assert.equal(await G(tok, '/api/dashboard/INVENTARIO'), 403);
    assert.equal(await G(tok, '/api/dashboard/GERENCIA'), 403);
    assert.equal(await G(tok, '/api/dashboards/config'), 403); // solo admin
    assert.equal(await G(tok, '/api/inventario/items'), 403);
  });

  // ── INVENTARIO (mlopez) ──
  await t.test('INVENTARIO: su módulo sí, el resto no', async () => {
    const tok = await tokenFor('mlopez', SEED.mlopez);
    assert.equal(await G(tok, '/api/inventario/items'), 200);
    assert.equal(await G(tok, '/api/inventario/resumen'), 200);
    assert.equal(await G(tok, '/api/dashboard/INVENTARIO'), 200);
    assert.equal(await G(tok, '/api/dashboard/GERENCIA'), 403);
    assert.equal(await G(tok, '/api/gerencia/kpis'), 403);
    assert.equal(await G(tok, '/api/dashboard/ORLANT'), 403);
  });

  // ── GERENCIA (jherrera): lee gerencia + calidad; NO escribe (solo lectura); no inventario ──
  await t.test('GERENCIA: su módulo y calidad sí (solo lectura), inventario no', async () => {
    const tok = await tokenFor('jherrera', SEED.jherrera);
    assert.equal(await G(tok, '/api/gerencia/kpis?periodo=2026-08'), 200);
    assert.equal(await G(tok, '/api/dashboard/GERENCIA'), 200);
    assert.equal(await G(tok, '/api/monitoreos?campana=ORLANT'), 200);
    assert.equal(await G(tok, '/api/dashboard/INVENTARIO'), 403);
    assert.equal(await G(tok, '/api/inventario/items'), 403);
    // Gerencia es SOLO LECTURA (feedback Edwin 2.2): no crea/edita/borra/carga KPIs.
    const w = await request(app).post('/api/gerencia/kpis').set(auth(tok))
      .send({ periodo: '2026-08', nombre: 'W RM', categoria: 'Operaciones', valor: 1, unidad: '%', meta: 1 });
    assert.equal(w.status, 403);
  });

  // ── GESTION_HUMANA: su modulo (CRUD) si, gerencia/inventario/clientes no ──
  await t.test('GESTION_HUMANA: su módulo sí, el resto no', async () => {
    const tok = await crearUsuario(admin, 'GESTION_HUMANA', { GestionHumana: true });
    assert.equal(await G(tok, '/api/gh/personal'), 200);
    assert.equal(await G(tok, '/api/gh/resumen'), 200);
    assert.equal(await G(tok, '/api/dashboard/GESTION_HUMANA'), 200);
    const alta = await request(app).post('/api/gh/personal').set(auth(tok))
      .send({ nombre: 'RM GH', campana: 'RM', fecha_ingreso: '2026-02-01', costo_hora: 1000, horas_mes: 160 });
    assert.equal(alta.status, 201);
    // no toca otros modulos
    assert.equal(await G(tok, '/api/dashboard/GERENCIA'), 403);
    assert.equal(await G(tok, '/api/gerencia/kpis'), 403);
    assert.equal(await G(tok, '/api/inventario/items'), 403);
    assert.equal(await G(tok, '/api/dashboard/ORLANT'), 403);
    // no puede administrar usuarios
    const crear = await request(app).post('/api/users').set(auth(tok))
      .send({ nombre: 'X', user: 'ghx_' + Date.now(), password: 'ClaveLarga123', rol: 'ASESOR' });
    assert.equal(crear.status, 403);
  });

  // ── CLIENTES_DASH (agomez): todos los dashboards de cliente, no la config ──
  await t.test('CLIENTES_DASH: dashboards de cliente sí, config y módulos no', async () => {
    const tok = await tokenFor('agomez', SEED.agomez);
    assert.equal(await G(tok, '/api/dashboard/ORLANT'), 200);
    assert.equal(await G(tok, '/api/dashboard/INFONDO'), 200);
    assert.equal(await G(tok, '/api/dashboard/BIVETT'), 200);
    assert.equal(await G(tok, '/api/dashboards/config'), 403);
    assert.equal(await G(tok, '/api/dashboard/INVENTARIO'), 403);
    assert.equal(await G(tok, '/api/dashboard/GERENCIA'), 403);
    assert.equal(await G(tok, '/api/inventario/items'), 403);
  });

  // ── AUX_ADMIN (lrios): ve usuarios pero NO administra ──
  await t.test('AUX_ADMIN: lee usuarios, no crea ni gestiona permisos', async () => {
    const tok = await tokenFor('lrios', SEED.lrios);
    assert.equal(await G(tok, '/api/users'), 200);
    const crear = await request(app).post('/api/users').set(auth(tok))
      .send({ nombre: 'X', user: 'x_' + Date.now(), password: 'ClaveLarga123', rol: 'ASESOR' });
    assert.equal(crear.status, 403);
  });

  // ── SUPERVISOR con campana_ORLANT: puede evaluar esa campaña ──
  await t.test('SUPERVISOR: evalúa su campaña, no otra', async () => {
    const tok = await crearUsuario(admin, 'SUPERVISOR', { campana_ORLANT: true });
    assert.equal(await G(tok, '/api/monitoreos?campana=ORLANT'), 200);
    assert.equal(await G(tok, '/api/monitoreos?campana=INFONDO'), 403);
    const ev = await request(app).post('/api/monitoreos').set(auth(tok)).send({
      campana: 'ORLANT', asesor: 'Asesor RM', fecha: '2026-08-10', canal: 'LLAMADA',
      answers: { '1': 'SI' },
    });
    assert.ok([201, 400].includes(ev.status), 'evaluar ORLANT no debe dar 403: ' + ev.status);
    const evOtra = await request(app).post('/api/monitoreos').set(auth(tok)).send({
      campana: 'INFONDO', asesor: 'Asesor RM', fecha: '2026-08-10', canal: 'LLAMADA', answers: { '1': 'SI' },
    });
    assert.equal(evOtra.status, 403);
  });

  // ── ASESOR: solo sus propios monitoreos ──
  await t.test('ASESOR: ve /monitoreos/mios, no la campaña completa', async () => {
    const tok = await crearUsuario(admin, 'ASESOR', {});
    assert.equal(await G(tok, '/api/monitoreos/mios'), 200);
    assert.equal(await G(tok, '/api/monitoreos?campana=ORLANT'), 403);
    assert.equal(await G(tok, '/api/inventario/items'), 403);
    assert.equal(await G(tok, '/api/dashboards/config'), 403);
  });

  // ── REPORTES con campana_ORLANT: puede editar/borrar monitoreos de su campaña ──
  await t.test('REPORTES: gestiona monitoreos de su campaña', async () => {
    const rep = await crearUsuario(admin, 'REPORTES', { campana_ORLANT: true });
    // admin crea uno
    const mon = await request(app).post('/api/monitoreos').set(auth(admin)).send({
      campana: 'ORLANT', asesor: 'Asesor Rep', fecha: '2026-08-11', canal: 'LLAMADA', answers: { '1': 'SI' },
    });
    if (mon.status === 201) {
      const del = await request(app).delete('/api/monitoreos/' + mon.body.id).set(auth(rep));
      assert.equal(del.status, 200);
    }
    assert.equal(await G(rep, '/api/monitoreos?campana=ORLANT'), 200);
  });
});
