// Fase 215: tablero "Televentas" de SURA. Con Excel SINTETICOS (inventados,
// helpers/sura-sinteticos.js): lectura con las funciones del HTML de Edwin,
// persistencia por (cliente, tipo de base, mes), permisos (el cliente no ve
// "Cargar informacion" ni "Bases" y recibe 403 al escribir), cedulas
// seudonimizadas para el cliente, y una guardiana que falla si el repo vuelve
// a tener las constantes SEED del HTML original (datos reales).
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { app, db, request, tokenFor, MASTER_PASSWORD } = require('./helpers');
const sura = require('../sura-televentas');
const { XLSX, baseVentas, baseInicial, baseEstrategias } = require('./helpers/sura-sinteticos');

const RAIZ = path.join(__dirname, '..', '..');
const API = '/api/sura-televentas/SURA';
let tAdmin, tCliente, tReportes, tOtro;

// La logica del tablero corre en el navegador dentro de un Shadow DOM; para
// usar sus lecturas de Excel en Node basta un DOM de mentira que acepte todo.
function stub() {
  return new Proxy(function () {}, {
    get: (t, k) => (k === 'forEach' ? () => {} : k === Symbol.toPrimitive ? () => '' : stub()),
    set: () => true,
    apply: () => stub(),
  });
}
function lecturas() {
  global.XLSX = XLSX;
  global.document = stub();
  const { stvCrearApp } = require('../../public/js/sura-televentas-app.js');
  return stvCrearApp(stub(), {}, () => false).leer;
}
const leer = lecturas();
const u8 = (buf) => new Uint8Array(buf);

function crearUsuario(user, rol, perms) {
  db.prepare(
    `INSERT INTO users (nombre, user, rol, active, password_hash, perms, createdAt, debe_cambiar_password)
     VALUES (?,?,?,1,?,?,?,0)`
  ).run('Prueba ' + user, user, rol, bcrypt.hashSync('Clave#2026x', 4), JSON.stringify(perms), new Date().toISOString());
  return tokenFor(user, 'Clave#2026x');
}

function cargaDe(tipo, archivoNombre, buf, datos) {
  return { archivoNombre, archivo: Buffer.from(buf).toString('base64'), datos };
}

before(async () => {
  tAdmin = await tokenFor('admin', MASTER_PASSWORD);
  tCliente = await crearUsuario('sura_cliente', 'CLIENTES_DASH', { ClientesDash: true, cliente_SURA: true });
  tReportes = await crearUsuario('sura_reportes', 'REPORTES', { cargarDatos: true, cliente_SURA: true, campana_SURA: true });
  tOtro = await crearUsuario('orlant_cliente', 'CLIENTES_DASH', { ClientesDash: true, cliente_ORLANT: true });
});

const auth = (t) => ({ Authorization: 'Bearer ' + t });

test('la migracion crea SURA (tablero propio, sin modulos genericos) y es idempotente', () => {
  const row = db.prepare("SELECT dashboard, modulos, parametros FROM clientes_registro WHERE nombre = 'SURA'").get();
  assert.ok(row, 'SURA en el registro de clientes');
  assert.equal(row.dashboard, 1);
  assert.deepEqual(JSON.parse(row.modulos), []);
  assert.deepEqual(JSON.parse(row.parametros).especificos, ['sura_televentas']);
  db.crearSuraTeleventas();
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM clientes_registro WHERE nombre = 'SURA'").get().n, 1);
  assert.equal(sura.esClienteTeleventas(db, 'SURA'), true);
  assert.equal(sura.esClienteTeleventas(db, 'ORLANT'), false);
});

test('las lecturas del HTML con Excel sinteticos: ventas, polizas, produccion anualizada y x12', () => {
  for (const prodMensual of [false, true]) {
    const v = baseVentas({ mes: '2026-09', n: 48, semilla: 3, prodMensual });
    const r = leer.parseBook(u8(v.buf));
    assert.equal(r.sheet, 'data');
    assert.equal(r.total, v.esperado.registros);
    assert.equal(r.rows.length, v.esperado.ventas);
    assert.equal(r.rows.reduce((s, x) => s + x[2], 0), v.esperado.polizas);
    assert.equal(r.rows.reduce((s, x) => s + x[3], 0), v.esperado.produccion);
    assert.equal(r.x12, prodMensual);
    assert.equal(r.pr.ids.length, v.esperado.registros);
    const ct = Object.values(r.ct).reduce((s, o) => s + o.c, 0);
    assert.equal(ct, v.esperado.contactos);
    assert.ok(r.rows.every((x) => x.length === 12 && /^2026-09-\d{2}$/.test(x[1])));
  }
  const ini = leer.parseIni(u8(baseInicial({ n: 30, semilla: 3 }).buf));
  assert.equal(ini.ids.length, 30);
  assert.ok(ini.cols.some((c) => c.k === 'categoria_percentil'));
  const est = leer.parseEst(u8(baseEstrategias({ n: 30, semilla: 3 }).buf));
  assert.equal(est.ids.length, 30);
  assert.deepEqual(est.cols.map((c) => c.num), [1, 2]);
});

test('admin monta las 3 bases de un mes, se leen igual del servidor y el Excel original se descarga tal cual', async () => {
  const v = baseVentas({ mes: '2026-08', n: 40, semilla: 8 });
  const ventas = leer.parseBook(u8(v.buf));
  const ini = baseInicial({ n: 40, semilla: 8 });
  const est = baseEstrategias({ n: 40, semilla: 8 });
  const cargas = [
    ['ventas', 'ventas_agosto.xlsx', v.buf, ventas],
    ['inicial', 'inicial_agosto.xlsx', ini.buf, leer.parseIni(u8(ini.buf))],
    ['estrategias', 'estrategias_agosto.xlsx', est.buf, leer.parseEst(u8(est.buf))],
  ];
  for (const [tipo, nombre, buf, datos] of cargas) {
    const r = await request(app).post(`${API}/bases/${tipo}/2026-08`).set(auth(tAdmin)).send(cargaDe(tipo, nombre, buf, datos));
    assert.equal(r.status, 201, JSON.stringify(r.body));
    assert.equal(r.body.archivoNombre, nombre);
  }
  const res = await request(app).get(`${API}/resumen`).set(auth(tAdmin));
  assert.equal(res.status, 200);
  assert.equal(res.body.puedeEditar, true);
  assert.deepEqual(res.body.pestanas, sura.PESTANAS);
  assert.deepEqual(res.body.bases.filter((b) => b.mes === '2026-08').map((b) => [b.tipo, b.registros, b.tieneArchivo]).sort(),
    [['estrategias', 40, true], ['inicial', 40, true], ['ventas', v.esperado.ventas, true]]);

  const g = await request(app).get(`${API}/bases/ventas/2026-08`).set(auth(tAdmin));
  assert.equal(g.status, 200);
  assert.deepEqual(g.body.rows, ventas.rows);
  assert.deepEqual(g.body.pr, ventas.pr);
  assert.equal(g.body.file, 'ventas_agosto.xlsx');
  assert.equal(g.body.v, 18);

  const a = await request(app).get(`${API}/bases/ventas/2026-08/archivo`).set(auth(tAdmin)).buffer(true).parse((r, cb) => {
    const partes = [];
    r.on('data', (c) => partes.push(c));
    r.on('end', () => cb(null, Buffer.concat(partes)));
  });
  assert.equal(a.status, 200);
  assert.ok(Buffer.from(a.body).equals(v.buf), 'el Excel descargado es identico al montado');
  assert.match(a.headers['content-disposition'], /ventas_agosto\.xlsx/);
});

test('reemplazar y eliminar guardan la version anterior; eliminar deja el mes sin base', async () => {
  const v = baseVentas({ mes: '2026-07', n: 20, semilla: 7 });
  const datos = leer.parseBook(u8(v.buf));
  const enviar = () => request(app).post(`${API}/bases/ventas/2026-07`).set(auth(tAdmin)).send(cargaDe('ventas', 'julio.xlsx', v.buf, datos));
  assert.equal((await enviar()).status, 201);
  assert.equal((await enviar()).status, 201);
  const versiones = () => db.prepare("SELECT motivo FROM sura_versiones WHERE cliente='SURA' AND tipo='ventas' AND mes='2026-07' ORDER BY id").all().map((r) => r.motivo);
  assert.deepEqual(versiones(), ['reemplazo']);
  assert.equal((await request(app).delete(`${API}/bases/ventas/2026-07`).set(auth(tAdmin))).status, 200);
  assert.deepEqual(versiones(), ['reemplazo', 'eliminacion']);
  assert.equal((await request(app).get(`${API}/bases/ventas/2026-07`).set(auth(tAdmin))).status, 404);
  assert.equal((await request(app).get(`${API}/bases/ventas/2026-07/archivo`).set(auth(tAdmin))).status, 404);
  assert.equal((await request(app).delete(`${API}/bases/ventas/2026-07`).set(auth(tAdmin))).status, 404);
});

test('metas, meta individual, asesores y codigos se guardan en el servidor (null vuelve al original)', async () => {
  const put = (clave, valor, t = tAdmin) => request(app).put(`${API}/config/${clave}`).set(auth(t)).send({ valor });
  assert.equal((await put('metas', { '2026-08': { odontologico: { p: 1000000, v: 10 } } })).status, 200);
  assert.equal((await put('metasI', { '2026-08': { salud_para_ti: { v: 3 } } })).status, 200);
  assert.equal((await put('agc', { odontologico: { out: ['asesor_prueba_1'], in: [] } })).status, 200);
  assert.equal((await put('tip', [['900', 'prueba', 'RPC', '1', '1', '1', '0', '0', '1', '1', '0', '1', 'NO']])).status, 200);
  assert.equal((await put('agalias', { asesor_prueba_x: 'asesor_prueba_1' })).status, 200);
  const cfg = (await request(app).get(`${API}/resumen`).set(auth(tCliente))).body.config;
  assert.equal(cfg.metas['2026-08'].odontologico.p, 1000000);
  assert.deepEqual(cfg.agc.odontologico.out, ['asesor_prueba_1']);
  assert.equal(cfg.tip.length, 1);
  assert.equal((await put('tip', null)).status, 200);
  assert.equal((await request(app).get(`${API}/resumen`).set(auth(tAdmin))).body.config.tip, undefined);
  // validados en el servidor
  assert.equal((await put('metas', { 'agosto': {} })).status, 400);
  assert.equal((await put('metas', { '2026-08': { odontologico: { p: -5 } } })).status, 400);
  assert.equal((await put('otra', {})).status, 400);
  assert.equal((await request(app).put(`${API}/config/metas`).set(auth(tAdmin)).send({})).status, 400);
});

test('el cliente ve 6 pestanas (todas menos Cargar informacion, Fase 218) y todo lo que escribe da 403', async () => {
  const r = await request(app).get(`${API}/resumen`).set(auth(tCliente));
  assert.equal(r.status, 200);
  assert.equal(r.body.puedeEditar, false);
  assert.deepEqual(r.body.pestanas, ['p9', 'p2', 'p5', 'p7', 'p3', 'p10']);
  assert.ok(!r.body.pestanas.includes('p1'));
  const v = baseVentas({ mes: '2026-11', n: 8, semilla: 11 });
  const carga = cargaDe('ventas', 'nov.xlsx', v.buf, leer.parseBook(u8(v.buf)));
  for (const t of [tCliente, tReportes]) {
    assert.equal((await request(app).post(`${API}/bases/ventas/2026-11`).set(auth(t)).send(carga)).status, 403);
    assert.equal((await request(app).delete(`${API}/bases/ventas/2026-08`).set(auth(t))).status, 403);
    assert.equal((await request(app).put(`${API}/config/metas`).set(auth(t)).send({ valor: {} })).status, 403);
    assert.equal((await request(app).get(`${API}/bases/ventas/2026-08/archivo`).set(auth(t))).status, 403);
  }
  assert.equal((await request(app).get(`${API}/bases/ventas/2026-11`).set(auth(tAdmin))).status, 404, 'nada se guardo');
  // sin acceso a SURA, o un cliente que no tiene este tablero
  assert.equal((await request(app).get(`${API}/resumen`).set(auth(tOtro))).status, 403);
  assert.equal((await request(app).get('/api/sura-televentas/ORLANT/resumen').set(auth(tAdmin))).status, 404);
  assert.equal((await request(app).get(`${API}/resumen`)).status, 401);
});

test('el cliente recibe las cedulas seudonimizadas y los cruces entre bases siguen dando lo mismo', async () => {
  const admin = {}, cliente = {};
  for (const tipo of ['ventas', 'inicial', 'estrategias']) {
    admin[tipo] = (await request(app).get(`${API}/bases/${tipo}/2026-08`).set(auth(tAdmin))).body;
    cliente[tipo] = (await request(app).get(`${API}/bases/${tipo}/2026-08`).set(auth(tCliente))).body;
  }
  const reales = new Set(admin.inicial.ids);
  assert.ok(reales.size > 0);
  assert.equal(cliente.ventas.pr.ids.filter((x) => reales.has(x)).length, 0);
  assert.equal(cliente.inicial.ids.filter((x) => reales.has(x)).length, 0);
  assert.equal(cliente.estrategias.ids.filter((x) => reales.has(x)).length, 0);
  assert.ok(cliente.ventas.rows.every((r) => !reales.has(r[11])));
  const cruce = (b) => {
    const s = new Set(b.inicial.ids);
    return [b.ventas.rows.filter((r) => s.has(r[11])).length, b.estrategias.ids.filter((x) => s.has(x)).length, b.ventas.pr.ids.filter((x) => s.has(x)).length];
  };
  assert.deepEqual(cruce(cliente), cruce(admin));
  assert.deepEqual(cliente.ventas.rows.map((r) => r.slice(0, 11)), admin.ventas.rows.map((r) => r.slice(0, 11)));
});

test('validacion de la carga en el servidor', async () => {
  const v = baseVentas({ mes: '2026-06', n: 8, semilla: 6 });
  const datos = leer.parseBook(u8(v.buf));
  const post = (url, body) => request(app).post(`${API}/bases/${url}`).set(auth(tAdmin)).send(body);
  assert.equal((await post('ventas/2026-13', cargaDe('ventas', 'a.xlsx', v.buf, datos))).status, 400);
  assert.equal((await post('otra/2026-06', cargaDe('ventas', 'a.xlsx', v.buf, datos))).status, 400);
  assert.equal((await post('ventas/2026-06', cargaDe('ventas', 'a.pdf', v.buf, datos))).status, 400);
  assert.equal((await post('ventas/2026-06', cargaDe('ventas', 'a.xlsx', Buffer.from('no es un excel'), datos))).status, 400);
  assert.equal((await post('ventas/2026-06', cargaDe('ventas', 'a.xlsx', v.buf, { ...datos, rows: [['x']] }))).status, 400);
  assert.equal((await post('ventas/2026-06', cargaDe('ventas', 'a.xlsx', v.buf, { ...datos, pr: { ...datos.pr, d: [] } }))).status, 400);
  assert.equal((await post('inicial/2026-06', cargaDe('inicial', 'a.xlsx', v.buf, { ids: ['1'], cols: [{ h: 'x', k: 'x', n: [] }] }))).status, 400);
  // claves extra del navegador no se guardan
  assert.equal((await post('ventas/2026-06', cargaDe('ventas', 'a.xlsx', v.buf, { ...datos, extra: 'x' }))).status, 201);
  assert.equal((await request(app).get(`${API}/bases/ventas/2026-06`).set(auth(tAdmin))).body.extra, undefined);
});

test('una base grande (mas de 2 MB) entra por el limite propio de la ruta', async () => {
  const v = baseVentas({ mes: '2026-05', n: 12, semilla: 5 });
  const grande = Buffer.concat([v.buf, Buffer.alloc(3 * 1024 * 1024, 7)]);
  const r = await request(app).post(`${API}/bases/ventas/2026-05`).set(auth(tAdmin)).send(cargaDe('ventas', 'grande.xlsx', grande, leer.parseBook(u8(v.buf))));
  assert.equal(r.status, 201, JSON.stringify(r.body));
});

test('guardiana: el repo no trae las constantes SEED ni el almacenamiento del HTML original', () => {
  const ignorar = new Set(['node_modules', '.git', 'vendor', 'data']);
  const hallados = [];
  (function recorrer(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (ignorar.has(e.name)) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) recorrer(p);
      else if (/\.(js|html|json|css|md)$/.test(e.name) && p !== __filename) {
        const s = fs.readFileSync(p, 'utf8');
        // SEED del HTML = objeto por mes ({"2026-07": ...}); las demas, por nombre.
        // (tests/helpers.js tiene su propio SEED de contrasenas de prueba: no aplica.)
        if (/\bconst\s+SEED_(INI|EST|METAS|OLD|EST_OLD)\s*=/.test(s) || /\bconst\s+SEED\s*=\s*\{\s*"20\d\d-\d\d"/.test(s) || /ventas_db2/.test(s)) {
          hallados.push(path.relative(RAIZ, p));
        }
      }
    }
  })(RAIZ);
  assert.deepEqual(hallados, []);
  const appJs = fs.readFileSync(path.join(RAIZ, 'public', 'js', 'sura-televentas-app.js'), 'utf8');
  assert.match(appJs, /let AGALIAS=\{\};/, 'los alias de asesores vienen del servidor, nunca escritos en el codigo');
  assert.doesNotMatch(appJs, /indexedDB/);
  assert.ok(appJs.length < 400 * 1024, 'sin datos embebidos (el HTML original pesaba 8,7 MB)');
});
