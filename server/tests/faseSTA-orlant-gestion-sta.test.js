// faseSTA-orlant-gestion-sta.test.js — Fase STA (20/11/2026): «Gestión STA» de ORLANT en el
// servidor (orlant-sta.js + routes/orlant-sta.js), con las reglas del HTML de Edwin
// (docs/orlant/sta/Gestion_STA.html). Datos INVENTADOS (números de autorización ficticios).
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');
const STA = require('../orlant-sta');

const H = (t) => ({ Authorization: 'Bearer ' + t });
const B = '/api/orlant/sta';
let admin, sup, supOtro, ger, cli, cliOtro, as1, as2, asOtro, id1, id2, idOtro;

function crear(user, rol, perms, asesorCampana) {
  const r = db.prepare(`INSERT INTO users (nombre, user, rol, active, password_hash, perms, asesorCampana, createdAt, debe_cambiar_password) VALUES (?,?,?,1,?,?,?,?,0)`)
    .run('Prueba ' + user, user, rol, bcrypt.hashSync('Clave#2026x', 4), JSON.stringify(perms), asesorCampana || null, new Date().toISOString());
  return r.lastInsertRowid;
}
const tok = (u) => tokenFor(u, 'Clave#2026x');
const fila = (n, extra) => Object.assign({ 'Fecha Ingreso Sta': '2026-11-0' + ((n % 9) + 1) + ' 08:00:00', Entidad: n % 2 ? 'ENTIDAD FICTICIA A' : 'ENTIDAD FICTICIA B', 'Numero Autorizacion': 'F' + String(1000 + n), Estado: 'En proceso', 'Descripcion Cups': 'CUPS FICTICIO', 'Fecha Autorizacion': '2026-10-01 00:00:00', 'Fecha Expiracion': '2027-01-01 00:00:00', Servicio: n % 3 ? 'SERVICIO X' : 'SERVICIO Y' }, extra || {});
const COLS = STA.CAMPOS.slice();
const cargar = (t, filas, extra) => request(app).post(B + '/cargas').set(H(t)).send(Object.assign({ archivo: 'base-ficticia.xlsx', columnas: COLS, filas }, extra || {}));

before(async () => {
  admin = await tokenFor('admin', MASTER_PASSWORD);
  crear('fsta_sup', 'SUPERVISOR', { campana_ORLANT: true, cliente_ORLANT: true });
  crear('fsta_supotro', 'SUPERVISOR', { campana_MOBILIZE: true, cliente_MOBILIZE: true });
  crear('fsta_ger', 'GERENCIA', {});
  crear('fsta_cli', 'CLIENTES_DASH', { ClientesDash: true, cliente_ORLANT: true });
  crear('fsta_cliotro', 'CLIENTES_DASH', { ClientesDash: true, cliente_MOBILIZE: true });
  id1 = Number(crear('fsta_as1', 'ASESOR', { campana_ORLANT: true }, 'ORLANT'));
  id2 = Number(crear('fsta_as2', 'ASESOR', { campana_ORLANT: true }, 'ORLANT'));
  idOtro = Number(crear('fsta_asotro', 'ASESOR', { campana_MOBILIZE: true }, 'MOBILIZE'));
  [sup, supOtro, ger, cli, cliOtro, as1, as2, asOtro] = await Promise.all(['fsta_sup', 'fsta_supotro', 'fsta_ger', 'fsta_cli', 'fsta_cliotro', 'fsta_as1', 'fsta_as2', 'fsta_asotro'].map(tok));
});

test('el HTML de Edwin está en docs/orlant/sta tal cual (nunca se edita)', () => {
  const p = path.join(__dirname, '..', '..', 'docs', 'orlant', 'sta', 'Gestion_STA.html');
  const h = crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
  assert.equal(h.slice(0, 16), 'ec4f895773815749', 'si Edwin manda una versión nueva, se reemplaza el archivo y esta huella');
});

test('permisos: estado por rol (supervisor/admin todo, asesor lo suyo; cliente, gerencia y otros 403)', async () => {
  for (const t of [admin, sup]) assert.equal((await request(app).get(B + '/estado').set(H(t))).body.vista, 'supervisor');
  assert.equal((await request(app).get(B + '/estado').set(H(ger))).status, 403, '25/11: GERENCIA ya no gestiona el STA');
  const a = await request(app).get(B + '/estado').set(H(as1));
  assert.equal(a.body.vista, 'asesor');
  assert.equal(a.body.yo.id, id1);
  assert.equal(a.body.agentes, undefined, 'el asesor no recibe la lista de asesores ni las cargas');
  for (const t of [cli, cliOtro, supOtro, asOtro]) assert.equal((await request(app).get(B + '/estado').set(H(t))).status, 403);
  assert.equal((await request(app).get(B + '/estado')).status, 401);
  // Escribir la base o asignar: solo gestores.
  for (const t of [as1, cli, supOtro, asOtro, ger]) {
    assert.equal((await cargar(t, [fila(1)])).status, 403);
    assert.equal((await request(app).post(B + '/asignar').set(H(t)).send({ agenteId: id1, cantidad: 1 })).status, 403);
    assert.equal((await request(app).put(B + '/config/tipis').set(H(t)).send({ tipis: ['X'], efectivas: [] })).status, 403);
  }
  // Codificar: solo asesores de ORLANT.
  for (const t of [admin, sup, cli, asOtro]) assert.equal((await request(app).post(B + '/casos/F1001/codificar').set(H(t)).send({ tipi: 'No contesta', obs: 'x' })).status, 403);
  // Resumen: gestores y el cliente de ORLANT; nadie más.
  assert.equal((await request(app).get(B + '/resumen').set(H(cli))).status, 200);
  for (const t of [cliOtro, as1, asOtro]) assert.equal((await request(app).get(B + '/resumen').set(H(t))).status, 403);
  // Agentes = los ASESOR de ORLANT que ya existen (no los de otra campaña).
  const ag = (await request(app).get(B + '/estado').set(H(sup))).body.agentes.map((x) => x.id);
  assert.ok(ag.includes(id1) && ag.includes(id2) && !ag.includes(idOtro));
});

test('carga: el número de autorización es la llave; mensaje nuevos / ya existían / actualizados; histórico y descarga', async () => {
  const xlsx = Buffer.from('EXCEL FICTICIO').toString('base64');
  const r1 = await cargar(sup, [fila(1), fila(2), fila(3), fila(3), fila(4, { 'Numero Autorizacion': '' }), fila(5, { 'Numero Autorizacion': 1005.0 })], { archivoB64: xlsx });
  assert.equal(r1.status, 200, JSON.stringify(r1.body));
  assert.equal(r1.body.nuevos, 4); // F1001, F1002, F1003 y «1005» (llega como número)
  assert.equal(r1.body.dup, 1, 'repetido dentro del mismo archivo');
  assert.equal(r1.body.sinNum, 1);
  assert.equal(r1.body.mensaje, 'Se cargaron 4 nuevos, 1 ya existían, 0 actualizados');
  const r2 = await cargar(sup, [fila(1), fila(2, { Estado: 'ANULADA' }), fila(6)]);
  assert.equal(r2.body.mensaje, 'Se cargaron 1 nuevos, 2 ya existían, 1 actualizados; 1 fuera de gestión (Estado distinto de «En proceso» o «Sin contacto»)'); // 25/11: ANULADA sale de la gestión
  assert.deepEqual(r2.body.cambios, { 'En proceso → ANULADA': 1 });
  const caso = (await request(app).get(B + '/estado').set(H(sup))).body.casos.find((c) => c._id === 'F1002');
  assert.equal(caso.Estado, 'ANULADA');
  assert.equal(caso._hist.length, 1);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM sta_casos WHERE numero = 'F1001'").get().n, 1, 'nunca se duplica');
  const cg = (await request(app).get(B + '/cargas').set(H(sup))).body.cargas;
  assert.equal(cg.length, 2);
  assert.equal(cg[1].tieneArchivo, true);
  const d = await request(app).get(B + '/cargas/' + cg[1].id + '/archivo').set(H(sup)).buffer(true).parse((res, cb) => { const b = []; res.on('data', (x) => b.push(x)); res.on('end', () => cb(null, Buffer.concat(b))); });
  assert.equal(d.status, 200);
  assert.equal(d.body.toString(), 'EXCEL FICTICIO');
  assert.equal((await cargar(sup, [fila(1)], { columnas: ['Entidad'] })).status, 400, 'sin la columna llave');
});

test('asignar N libres (los más antiguos, con filtros); si hay menos, asigna los disponibles; devolver y pasar', async () => {
  await cargar(sup, Array.from({ length: 20 }, (_, i) => fila(10 + i)));
  const libres = () => db.prepare("SELECT COUNT(*) n FROM sta_casos WHERE campana = 'ORLANT' AND agenteId IS NULL").get().n;
  const L0 = libres();
  let r = await request(app).post(B + '/asignar').set(H(sup)).send({ agenteId: id1, cantidad: 3, filtros: { entidad: ['ENTIDAD FICTICIA A'] } });
  assert.deepEqual([r.body.asignados, r.body.pedidos], [3, 3]);
  const mios = db.prepare('SELECT datos FROM sta_casos WHERE agenteId = ?').all(id1).map((x) => JSON.parse(x.datos));
  assert.ok(mios.every((d) => d.Entidad === 'ENTIDAD FICTICIA A'));
  r = await request(app).post(B + '/asignar').set(H(sup)).send({ agenteId: id2, cantidad: 9999, filtros: { servicio: ['SERVICIO Y'] } });
  assert.equal(r.body.asignados, r.body.disponibles, 'pidió más de los que hay: asigna los disponibles');
  assert.equal(libres(), L0 - 3 - r.body.asignados);
  assert.equal((await request(app).post(B + '/asignar').set(H(sup)).send({ agenteId: idOtro, cantidad: 1 })).status, 400, 'asesor de otra campaña');
  assert.equal((await request(app).post(B + '/asignar').set(H(sup)).send({ agenteId: id1, cantidad: 0 })).status, 400);
  // devolver 1 de as1 → libres; pasar 1 de as1 a as2
  assert.equal((await request(app).post(B + '/devolver').set(H(sup)).send({ agenteId: id1, cantidad: 1 })).body.devueltos, 1);
  assert.equal((await request(app).post(B + '/pasar').set(H(sup)).send({ agenteId: id1, destinoId: id2, cantidad: 1 })).body.pasados, 1);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM sta_casos WHERE agenteId = ?').get(id1).n, 1);
  assert.equal((await request(app).post(B + '/pasar').set(H(sup)).send({ agenteId: id1, destinoId: idOtro, cantidad: 1 })).status, 400);
});

test('asesor: solo ve y codifica lo suyo; reglas de codificar del HTML; volver a llamar', async () => {
  const mio = db.prepare("SELECT numero FROM sta_casos WHERE agenteId = ? AND estado = 'pendiente' LIMIT 1").get(id1).numero;
  const ajeno = db.prepare("SELECT numero FROM sta_casos WHERE agenteId = ? AND estado = 'pendiente' LIMIT 1").get(id2).numero;
  const e = (await request(app).get(B + '/estado').set(H(as1))).body;
  assert.ok(e.casos.length && e.casos.every((c) => c._agente === id1), 'solo sus casos');
  const cod = (t, n, b) => request(app).post(B + '/casos/' + encodeURIComponent(n) + '/codificar').set(H(t)).send(b);
  assert.equal((await cod(as1, ajeno, { tipi: 'No contesta', obs: 'x' })).status, 409, 'el caso de otro asesor no');
  assert.equal((await cod(as1, mio, { tipi: '', obs: 'x' })).status, 400);
  assert.equal((await cod(as1, mio, { tipi: 'Inventada', obs: 'x' })).status, 400);
  assert.equal((await cod(as1, mio, { tipi: 'No contesta', obs: '  ' })).status, 400, 'observación obligatoria');
  assert.equal((await cod(as1, mio, { tipi: 'Agendado', obs: 'x', citas: 0 })).status, 400, 'efectiva pide citas >= 1');
  assert.equal((await cod(as1, mio, { tipi: 'Volver a llamar', obs: 'x', cuando: '2020-01-01 10:00' })).status, 400, 'hora pasada');
  const futuro = STA.ahora(new Date(Date.now() + 3600e3)).slice(0, 16);
  let r = await cod(as1, mio, { tipi: 'Volver a llamar', obs: 'pidió que llamen luego', cuando: futuro });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.caso._rell.estado, 'pendiente');
  assert.equal(r.body.caso._estado, 'gestionado');
  // «Recordar en 10 min» y luego gestionarla: la anterior pasa a prev y la rellamada queda hecha.
  assert.equal((await request(app).post(B + '/casos/' + mio + '/rellamada').set(H(as1)).send({ accion: 'pos' })).status, 200);
  assert.equal((await request(app).post(B + '/casos/' + mio + '/rellamada').set(H(as2)).send({ accion: 'ya' })).status, 409, 'otro asesor no');
  r = await cod(as1, mio, { tipi: 'Agendado', obs: 'agendó', citas: 2 });
  assert.equal(r.status, 200);
  assert.equal(r.body.caso._rell.estado, 'hecha');
  assert.equal(r.body.caso._prev.length, 1);
  assert.equal(r.body.caso._citas, 2);
  assert.equal((await cod(as1, mio, { tipi: 'No contesta', obs: 'x' })).status, 409, 'ya gestionado y sin rellamada: no está en la bandeja');
  // devolver / pasar nunca mueven un caso gestionado
  assert.equal(db.prepare('SELECT agenteId FROM sta_casos WHERE numero = ?').get(mio).agenteId, id1);
});

test('tipificaciones del líder y resumen del cliente (solo agregados)', async () => {
  const c = await request(app).put(B + '/config/tipis').set(H(sup)).send({ tipis: ['Agendado', 'No contesta', 'Volver a llamar', 'Nueva ficticia'], efectivas: ['Agendado', 'No existe'] });
  assert.equal(c.status, 200);
  assert.deepEqual(c.body.efectivas, ['Agendado']);
  assert.equal((await request(app).put(B + '/config/tipis').set(H(sup)).send({ tipis: ['A', 'a'], efectivas: [] })).status, 400);
  const r = (await request(app).get(B + '/resumen').set(H(cli))).body;
  assert.ok(r.total > 0 && r.gestionados >= 1 && r.citas >= 2);
  const txt = JSON.stringify(r);
  assert.ok(!/F10\d\d/.test(txt) && !/Prueba fsta/.test(txt) && !/agendó/.test(txt), 'sin números de autorización, nombres ni observaciones');
});

test('eliminar carga: con «conservar» quedan los gestionados; sin él se borra todo lo de esa carga', async () => {
  const cg = (await request(app).get(B + '/cargas').set(H(sup))).body.cargas;
  const conGest = cg.find((x) => x.gestionados > 0);
  const r = await request(app).delete(B + '/cargas/' + conGest.id + '?conservar=1').set(H(sup));
  assert.equal(r.status, 200);
  assert.ok(r.body.conservados >= 1);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM sta_casos WHERE cargaId = ? AND estado <> 'gestionado'").get(conGest.id).n, 0);
  const otra = (await request(app).get(B + '/cargas').set(H(sup))).body.cargas.find((x) => x.gestionados === 0);
  assert.equal((await request(app).delete(B + '/cargas/' + otra.id).set(H(as1))).status, 403);
  await request(app).delete(B + '/cargas/' + otra.id).set(H(sup));
  assert.equal(db.prepare('SELECT COUNT(*) n FROM sta_casos WHERE cargaId = ?').get(otra.id).n, 0);
  assert.equal((await request(app).delete(B + '/cargas/999999').set(H(sup))).status, 404);
});

test('Tickets: el cliente de ORLANT no los usa (403); el cliente de otra campaña y el asesor sí', async () => {
  assert.equal((await request(app).get('/api/tickets').set(H(cli))).status, 403);
  assert.equal((await request(app).get('/api/tickets/campanas').set(H(cli))).status, 403);
  assert.equal((await request(app).get('/api/tickets').set(H(cliOtro))).status, 200);
  assert.equal((await request(app).get('/api/tickets').set(H(as1))).status, 200);
  const L = require('../../public/js/dashboards-logic.js');
  assert.ok(!L.dashTarjetasEntrada('CLIENTES_DASH', false, false, true).some((t) => t.key === 'tickets'));
  assert.ok(L.dashTarjetasEntrada('CLIENTES_DASH', false, false, false).some((t) => t.key === 'tickets'));
});
