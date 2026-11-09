// fase299-supervisor-carga.test.js — Fase 299 (pedido del usuario, 09/11/2026):
// el SUPERVISOR carga datos en las campanas que tiene asignadas, incluidas las de
// tablero propio (SURA: bases, metas, codigos) y las que se creen despues. Depende
// del ROL + acceso a la campana, nunca de una lista fija. Fuera de sus campanas,
// 403. CLIENTE (CLIENTES_DASH) y ASESOR siguen sin cargar. Lo de administracion
// (usuarios, contrasenas, campanas, configuracion) sigue solo del administrador.
// Todo con datos sinteticos.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { app, db, request, tokenFor, MASTER_PASSWORD } = require('./helpers');
const auth = require('../auth');
const { XLSX, baseVentas } = require('./helpers/sura-sinteticos');

const API = '/api/sura-televentas/SURA';
const H = (t) => ({ Authorization: 'Bearer ' + t });
const AURORA = 'CLINICA AURORA', HLM = 'HOSPITAL LA MARIA';
let tAdmin, tGeneral, tSup56, tSupViejo, tCliente, tAsesor;

function stub() {
  return new Proxy(function () {}, {
    get: (t, k) => (k === 'forEach' ? () => {} : k === Symbol.toPrimitive ? () => '' : stub()),
    set: () => true,
    apply: () => stub(),
  });
}
function lector() {
  global.XLSX = XLSX;
  global.document = stub();
  const { stvCrearApp } = require('../../public/js/sura-televentas-app.js');
  return stvCrearApp(stub(), {}, () => false).leer;
}
const leer = lector();
const u8 = (buf) => new Uint8Array(buf);
const cargaVentas = (mes, semilla) => {
  const v = baseVentas({ mes, n: 10, semilla });
  return { archivoNombre: 'sintetico.xlsx', archivo: Buffer.from(v.buf).toString('base64'), datos: leer.parseBook(u8(v.buf)) };
};

function crearUsuario(user, nombre, rol, perms) {
  db.prepare(
    `INSERT INTO users (nombre, user, rol, active, password_hash, perms, createdAt, debe_cambiar_password)
     VALUES (?,?,?,1,?,?,?,0)`
  ).run(nombre, user, rol, bcrypt.hashSync('Clave#2026x', 4), JSON.stringify(perms), new Date().toISOString());
  return tokenFor(user, 'Clave#2026x');
}

before(async () => {
  tAdmin = await tokenFor('admin', MASTER_PASSWORD);
  // Supervisor general (perfil nuevo): los 5 clientes.
  const cinco = {};
  for (const c of ['ORLANT', 'MOBILIZE', 'SURA', AURORA, HLM]) cinco['supervisa_' + c] = true;
  tGeneral = await crearUsuario('f299_general', 'Supervisor General Sintetico', 'SUPERVISOR', { ClientesDash: true, ...cinco });
  // Como el id 56: solo Aurora y HLM.
  tSup56 = await crearUsuario('f299_aurora_hlm', 'Supervisor Aurora Sintetico', 'SUPERVISOR', { ClientesDash: true, ['supervisa_' + AURORA]: true, ['supervisa_' + HLM]: true });
  // Perfil de antes (sin supervisa_): cuenta por rol + cliente_/campana_.
  tSupViejo = await crearUsuario('f299_viejo', 'Supervisor Viejo Sintetico', 'SUPERVISOR', { ClientesDash: true, cliente_SURA: true, campana_SURA: true });
  tCliente = await crearUsuario('f299_cliente', 'Cliente Sintetico', 'CLIENTES_DASH', { ClientesDash: true, cliente_SURA: true, ['cliente_' + AURORA]: true });
  tAsesor = await crearUsuario('f299_asesor', 'Asesor Sintetico', 'ASESOR', { cliente_SURA: true, campana_SURA: true, ['campana_' + AURORA]: true });
});

test('regla por rol: SUPERVISOR con clientes (perfil nuevo o viejo) carga; sin clientes, o con otro rol, no', () => {
  const sup = (perms) => ({ rol: 'SUPERVISOR', perms });
  assert.equal(auth.supervisorCarga(sup({ cliente_SURA: true })), true, 'perfil viejo');
  assert.equal(auth.supervisorCarga(sup({ 'cliente_CAMPANA NUEVA 2027': true })), true, 'una campana creada despues queda cubierta sola');
  assert.equal(auth.supervisorCarga(sup({ Calidad: true })), false, 'sin clientes');
  assert.equal(auth.supervisorCarga(sup({ cliente_SURA: false })), false);
  for (const rol of ['CLIENTES_DASH', 'ASESOR', 'CALIDAD', 'GERENCIA']) {
    assert.equal(auth.supervisorCarga({ rol, perms: { cliente_SURA: true, campana_SURA: true } }), false, rol);
  }
  const s = sup({ cliente_SURA: true, campana_SURA: true });
  assert.equal(auth.canLoadCampaign(s, 'SURA'), true);
  assert.equal(auth.canLoadCampaign(s, 'ORLANT'), false, 'solo sus campanas');
  assert.equal(auth.canLoadCampaign({ isMasterAdmin: true, rol: 'ADMIN' }, 'CUALQUIERA'), true);
});

test('SURA: el supervisor general monta, reemplaza, elimina y cambia metas/codigos; queda registrado quien', async () => {
  const r = await request(app).get(`${API}/resumen`).set(H(tGeneral));
  assert.equal(r.status, 200);
  assert.equal(r.body.puedeEditar, true);
  assert.equal(r.body.puedeDescargar, false, 'el Excel original (cedulas reales) sigue siendo del administrador');
  assert.ok(r.body.pestanas.includes('p1'), 'trae la pestana de carga');

  const subir = await request(app).post(`${API}/bases/ventas/2026-06`).set(H(tGeneral)).send(cargaVentas('2026-06', 3));
  assert.equal(subir.status, 201, JSON.stringify(subir.body));
  const fila = db.prepare("SELECT cargadoPorNombre, cargadoEn FROM sura_bases WHERE cliente='SURA' AND tipo='ventas' AND mes='2026-06'").get();
  assert.equal(fila.cargadoPorNombre, 'Supervisor General Sintetico', 'quien cargo');
  assert.ok(fila.cargadoEn, 'cuando');
  const ev = db.prepare("SELECT actor FROM historial WHERE accion='SURA_BASE_CARGADA' ORDER BY ts DESC LIMIT 1").get();
  assert.match(ev.actor, /Supervisor General Sintetico/);

  assert.equal((await request(app).put(`${API}/config/metas`).set(H(tGeneral)).send({ valor: { '2026-06': { odontologico: { p: 1000, v: 2 } } } })).status, 200);
  const cfg = db.prepare("SELECT actualizadoPorNombre, actualizadoEn FROM sura_config WHERE cliente='SURA' AND clave='metas'").get();
  assert.equal(cfg.actualizadoPorNombre, 'Supervisor General Sintetico');
  assert.ok(cfg.actualizadoEn);
  const evCfg = db.prepare("SELECT actor, detalle FROM historial WHERE accion='SURA_CONFIG_CAMBIADA' ORDER BY ts DESC LIMIT 1").get();
  assert.match(evCfg.actor, /Supervisor General Sintetico/);
  assert.equal(evCfg.detalle, 'clave metas', 'solo la clave, nunca el valor');
  assert.equal((await request(app).put(`${API}/config/tip`).set(H(tGeneral)).send({ valor: [['900', 'prueba', 'RPC', '1', '1', '1', '0', '0', '1', '1', '0', '1', 'NO']] })).status, 200, 'codigos');

  assert.equal((await request(app).get(`${API}/bases/ventas/2026-06/archivo`).set(H(tGeneral))).status, 403, 'descargar el original: solo admin');
  assert.equal((await request(app).delete(`${API}/bases/ventas/2026-06`).set(H(tGeneral))).status, 200);
});

test('SURA: un supervisor con el perfil de antes tambien carga (por rol); el de Aurora+HLM no entra a SURA', async () => {
  assert.equal((await request(app).post(`${API}/bases/ventas/2026-05`).set(H(tSupViejo)).send(cargaVentas('2026-05', 5))).status, 201);
  assert.equal((await request(app).get(`${API}/resumen`).set(H(tSup56))).status, 403, 'sin acceso a SURA');
  assert.equal((await request(app).post(`${API}/bases/ventas/2026-04`).set(H(tSup56)).send(cargaVentas('2026-04', 6))).status, 403);
  assert.equal((await request(app).put(`${API}/config/metas`).set(H(tSup56)).send({ valor: {} })).status, 403);
});

test('SURA: CLIENTE y ASESOR siguen sin poder cargar ni cambiar nada', async () => {
  const c = await request(app).get(`${API}/resumen`).set(H(tCliente));
  assert.equal(c.status, 200);
  assert.equal(c.body.puedeEditar, false);
  for (const t of [tCliente, tAsesor]) {
    assert.equal((await request(app).post(`${API}/bases/ventas/2026-03`).set(H(t)).send(cargaVentas('2026-03', 9))).status, 403);
    assert.equal((await request(app).delete(`${API}/bases/ventas/2026-05`).set(H(t))).status, 403);
    assert.equal((await request(app).put(`${API}/config/metas`).set(H(t)).send({ valor: {} })).status, 403);
  }
});

test('campanas genericas: el supervisor carga y cambia codigos SOLO en las suyas (Aurora/HLM vs ORLANT)', async () => {
  const skills = (campana) => ({ campana, skills: [{ codigo: '4166', nombre: 'Skill sintetico' }] });
  const ns = (campana) => ({ campana, mes: '2026-07', contestadas20s: 5, llamadasTotales: 10 });
  const cod = (campana) => ({ campana, valores: ['CODIGO SINTETICO ' + Math.random().toString(36).slice(2, 7)] });
  for (const [ruta, body] of [['put', '/api/calidad/tipificacion/skills-whatsapp', skills], ['post', '/api/calidad/nivel-servicio', ns], ['post', '/api/calidad/codificaciones/bulk', cod]].map(([m, u, b]) => [[m, u], b])) {
    const [m, url] = ruta;
    const propia = await request(app)[m](url).set(H(tSup56)).send(body(AURORA));
    assert.ok(propia.status < 300, `${m} ${url} en Aurora: ${propia.status} ${JSON.stringify(propia.body)}`);
    assert.equal((await request(app)[m](url).set(H(tSup56)).send(body('ORLANT'))).status, 403, `${url} en ORLANT (no asignada)`);
    for (const t of [tCliente, tAsesor]) assert.equal((await request(app)[m](url).set(H(t)).send(body(AURORA))).status, 403, `${url} cliente/asesor`);
  }
  // Centro de cargas: su cliente si, el ajeno no.
  assert.equal((await request(app).get('/api/centro-cargas/' + encodeURIComponent(HLM)).set(H(tSup56))).status, 200);
  assert.equal((await request(app).get('/api/centro-cargas/MOBILIZE').set(H(tSup56))).status, 403);
  assert.equal((await request(app).get('/api/centro-cargas/' + encodeURIComponent(AURORA)).set(H(tCliente))).status, 403);
});

test('lo de administracion sigue siendo solo del administrador (aunque sea el supervisor general)', async () => {
  const id = db.prepare("SELECT id FROM users WHERE user = 'f299_cliente'").get().id;
  const intentos = [
    request(app).post('/api/users').set(H(tGeneral)).send({ nombre: 'X', user: 'f299_x', password: 'Clave#2026xyz', rol: 'ASESOR', perms: {} }),
    request(app).delete('/api/users/' + id).set(H(tGeneral)),
    request(app).put('/api/users/' + id + '/password').set(H(tGeneral)).send({ password: 'Otra#2026xyzw' }),
    request(app).get('/api/dashboards/config').set(H(tGeneral)),
    request(app).put('/api/umbrales/1').set(H(tGeneral)).send({}),
  ];
  for (const r of await Promise.all(intentos)) {
    assert.equal(r.status, 403, `${r.req.method} ${r.req.path} -> ${r.status} (solo admin)`);
  }
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM users WHERE user = 'f299_x'").get().n, 0, 'no creo el usuario');
  // Crear una campana (dashboards_config) con un cuerpo VALIDO: 403, no 400.
  const cfg = (await request(app).get('/api/dashboards/config/ORLANT').set(H(tAdmin))).body;
  const nueva = { cliente: 'CAMPANA SINTETICA 299', titulo: 'Sintetica', vista: cfg.vista || null, secciones: cfg.secciones, layout: cfg.layout };
  const crear = await request(app).post('/api/dashboards/config').set(H(tGeneral)).send(nueva);
  assert.equal(crear.status, 403, 'crear campana: solo admin -> ' + crear.status + ' ' + JSON.stringify(crear.body));
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM dashboards_config WHERE cliente = 'CAMPANA SINTETICA 299'").get().n, 0);
  assert.ok(db.prepare('SELECT 1 FROM users WHERE id = ?').get(id), 'no borro el usuario');
});
