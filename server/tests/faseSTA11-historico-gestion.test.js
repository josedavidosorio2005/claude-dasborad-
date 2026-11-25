// faseSTA11-historico-gestion.test.js — Pedido de Edwin (25/11/2026, 2:45 p. m.): cargar el histórico de STA con su
// gestión (codificación, observación, fecha de gestión sin hora y asesor). Decisiones del usuario (26/11):
//  - orden NOVIEMBRE → OCTUBRE → SEPTIEMBRE; una autorización que ya existe se rechaza (gana la más reciente);
//  - «En proceso» / «Sin contacto»: disponibles, la gestión vieja en «Gestiones anteriores»; ajuste (25/11): si trae
//    codificación, esa gestión CUENTA (gráficas, Gestionados, productividad) con la marca `cuenta`; sin codificación no;
//  - otro estado: gestionados a nombre de su asesora, en su fecha y sin hora, con su estado (suman en gráficas);
//  - «Agenda InConexion» (efectiva) = 1 cita; asesora sin usuario = no entra; revisar (dryRun) no escribe nada.
// Datos INVENTADOS.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');
const STA = require('../orlant-sta');

const H = (t) => ({ Authorization: 'Bearer ' + t });
const B = '/api/orlant/sta';
let admin, sup, cli, as1, idA, idB;
function crear(user, nombre, rol, perms, asesorCampana) {
  return Number(db.prepare(`INSERT INTO users (nombre, user, rol, active, password_hash, perms, asesorCampana, createdAt, debe_cambiar_password) VALUES (?,?,?,1,?,?,?,?,0)`)
    .run(nombre, user, rol, bcrypt.hashSync('Clave#2026x', 4), JSON.stringify(perms), asesorCampana || null, new Date().toISOString()).lastInsertRowid);
}
const caso = (n) => db.prepare('SELECT * FROM sta_casos WHERE campana = ? AND numero = ?').get('ORLANT', n);
const fila = (n, estado, cod, fg, asesor) => ({ 'Fecha Ingreso Sta': '2026-09-01 08:00:00', Entidad: 'ENTIDAD INVENTADA', 'Numero Autorizacion': n, Estado: estado, 'Descripcion Cups': 'CUPS', 'Fecha Autorizacion': '2026-09-01 00:00:00', 'Fecha Expiracion': '2026-12-31 00:00:00', Servicio: 'SERV',
  codificacion: cod, observacion: 'Observación inventada ' + n, fechaGestion: fg, asesor });
const hist = (t, archivo, filas, dryRun) => request(app).post(B + '/historico').set(H(t)).send({ archivo, filas, dryRun });

before(async () => {
  admin = await tokenFor('admin', MASTER_PASSWORD);
  crear('sta11_sup', 'Líder Inventada Once', 'SUPERVISOR', { campana_ORLANT: true, cliente_ORLANT: true });
  crear('sta11_cli', 'Cliente Inventado', 'CLIENTES_DASH', { ClientesDash: true, cliente_ORLANT: true });
  idA = crear('sta11_a', 'Asesora Inventada Uno', 'ASESOR', { campana_ORLANT: true }, 'ORLANT');
  idB = crear('sta11_b', 'Asesora Inventada Dos', 'ASESOR', { campana_ORLANT: true }, 'ORLANT');
  [sup, cli, as1] = await Promise.all(['sta11_sup', 'sta11_cli', 'sta11_a'].map((u) => tokenFor(u, 'Clave#2026x')));
  const cfg = STA.config(db);
  const tipis = [...new Set(cfg.tipis.concat(['Agenda InConexion', 'No contesta', 'Paciente atendido']))];
  assert.equal((await request(app).put(B + '/config/tipis').set(H(admin)).send({ tipis, efectivas: ['Agenda InConexion'] })).status, 200);
  // Ya existe en la base actual (ganará sobre el histórico).
  assert.equal((await request(app).post(B + '/cargas').set(H(sup)).send({ archivo: 'base.xlsx', columnas: STA.CAMPOS, filas: [Object.assign(fila('HX-EXISTE', 'En proceso'), {})] })).status, 200);
});

test('revisar (dryRun): hace las cuentas y NO escribe nada', async () => {
  const antes = db.prepare('SELECT COUNT(*) n FROM sta_casos').get().n;
  const cargasAntes = db.prepare('SELECT COUNT(*) n FROM sta_cargas').get().n;
  const r = await hist(sup, 'STA - NOVIEMBRE.xlsx', [fila('HX-1', 'En proceso', 'No contesta', '2026-11-03', 'Asesora Inventada Uno'), fila('HX-2', 'Agendada', 'Agenda InConexion', '2026-11-04', 'ASESORA INVENTADA DOS')], true);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.dryRun, r.body.nuevos, r.body.disponibles, r.body.gestionados, r.body.cuentanDisponibles, r.body.citas], [true, 2, 1, 1, 1, 1]);
  assert.match(r.body.mensaje, /^Revisión \(no se cargó nada\)/);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM sta_casos').get().n, antes);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM sta_cargas').get().n, cargasAntes);
});

test('NOVIEMBRE → OCTUBRE: rechaza las que ya existen (gana la más reciente); disponibles y gestionados como decidió el usuario', async () => {
  let r = await hist(sup, 'STA - NOVIEMBRE.xlsx', [
    fila('HX-1', 'En proceso', 'No contesta', '2026-11-03', 'Asesora Inventada Uno'),
    fila('HX-2', 'Agendada', 'Agenda InConexion', '2026-11-04', 'ASESORA INVENTADA DOS'),
    fila('HX-EXISTE', 'Facturado', 'Paciente atendido', '2026-11-05', 'Asesora Inventada Uno'),
    fila('HX-3', 'Facturado', 'Paciente atendido', '2026-11-06', 'Persona Sin Usuario'),
    fila('HX-6', 'Sin contacto', '', '2026-11-07', 'Asesora Inventada Uno'),
    fila('HX-7', 'En proceso', 'Agenda InConexion', '2026-11-08', 'Asesora Inventada Dos'),
  ]);
  assert.equal(r.status, 200);
  assert.deepEqual([r.body.nuevos, r.body.existen, r.body.sinAsesor, r.body.disponibles, r.body.cuentanDisponibles, r.body.citas], [4, 1, 1, 3, 2, 2]);
  assert.deepEqual(r.body.asesoresSinUsuario, { 'Persona Sin Usuario': 1 });
  // HX-1 «En proceso»: disponible, sin asesora; la gestión vieja en «Gestiones anteriores».
  const c1 = caso('HX-1');
  assert.deepEqual([c1.estado, c1.agenteId, c1.tipi], ['pendiente', null, '']);
  const p1 = JSON.parse(c1.prev)[0];
  assert.deepEqual([p1.tipi, p1.fg, p1.agente, p1.historico, p1.cuenta], ['No contesta', '2026-11-03 00:00:00', idA, true, true]);
  // Sin codificación: disponible y su gestión NO cuenta.
  const p6 = JSON.parse(caso('HX-6').prev)[0];
  assert.deepEqual([caso('HX-6').estado, p6.cuenta, p6.citas], ['pendiente', undefined, 0]);
  // «Agenda InConexion» en un caso disponible: cuenta con 1 cita.
  const p7 = JSON.parse(caso('HX-7').prev)[0];
  assert.deepEqual([caso('HX-7').estado, caso('HX-7').agenteId, p7.cuenta, p7.citas, p7.agente], ['pendiente', null, true, 1, idB]);
  assert.ok(STA.disponiblesFiltrados(db, {}).some((x) => x.numero === 'HX-1'));
  // HX-2 «Agendada»: gestionado a nombre de su asesora, en su fecha sin hora, 1 cita (efectiva).
  const c2 = caso('HX-2');
  assert.deepEqual([c2.estado, c2.agenteId, c2.tipi, c2.fg, c2.citas], ['gestionado', idB, 'Agenda InConexion', '2026-11-04 00:00:00', 1]);
  assert.equal(JSON.parse(c2.datos).Estado, 'Agendada');
  assert.equal(JSON.parse(c2.hist)[0].origen, 'historico');
  // La que ya existía no cambió.
  assert.equal(JSON.parse(caso('HX-EXISTE').datos).Estado, 'En proceso');
  // OCTUBRE trae HX-2 otra vez (ya cargada por noviembre): se rechaza.
  r = await hist(sup, 'STA - OCTUBRE.xlsx', [fila('HX-2', 'Cumplida', 'No contesta', '2026-10-10', 'Asesora Inventada Uno'), fila('HX-4', 'Anulada', 'No contesta', '2026-10-11', 'Asesora Inventada Uno')]);
  assert.deepEqual([r.body.nuevos, r.body.existen], [1, 1]);
  assert.equal(caso('HX-2').agenteId, idB, 'gana noviembre');
  assert.equal(caso('HX-4').estado, 'gestionado');
});

test('dentro de un archivo, una autorización repetida: gana la de fecha de gestión más reciente', async () => {
  const r = await hist(sup, 'STA - SEPTIEMBRE.xlsx', [fila('HX-5', 'Cumplida', 'No contesta', '2026-09-02', 'Asesora Inventada Uno'), fila('HX-5', 'Facturado', 'Paciente atendido', '2026-09-20', 'Asesora Inventada Dos')]);
  assert.deepEqual([r.body.nuevos, r.body.repetidasArchivo], [1, 1]);
  const c = caso('HX-5');
  assert.deepEqual([c.tipi, c.agenteId, JSON.parse(c.datos).Estado], ['Paciente atendido', idB, 'Facturado']);
});

test('cada archivo queda como una carga propia (se puede eliminar) y el Historial dice quién lo cargó', async () => {
  const cg = db.prepare("SELECT * FROM sta_cargas WHERE archivo = 'Histórico · STA - OCTUBRE.xlsx'").get();
  assert.ok(cg && cg.nuevos === 1);
  const h = db.prepare("SELECT detalle, actor FROM historial WHERE accion = 'STA_HISTORICO' ORDER BY id DESC LIMIT 1").get();
  assert.match(h.detalle, /1 nuevos \(1 gestionados, 0 disponibles\)/);
  const del = await request(app).delete(B + '/cargas/' + cg.id).set(H(sup));
  assert.equal(del.status, 200);
  assert.equal(caso('HX-4'), undefined, 'eliminar la carga quita lo del histórico');
});

test('suman en el resumen del cliente las gestionadas y las disponibles con codificación; las sin codificación no', async () => {
  const r = (await request(app).get(B + '/resumen').set(H(cli))).body;
  assert.ok(r.porTipi['Agenda InConexion'] >= 1);
  assert.ok(r.porDia['2026-11-04'] && r.porDia['2026-11-04'].citas >= 1);
  assert.equal(r.porDia['2026-11-03'].gestiones, 1, 'HX-1 disponible con codificación: suma en su fecha');
  assert.equal(r.porDia['2026-11-08'].citas, 1, 'HX-7: Agenda InConexion = 1 cita');
  assert.ok(!r.porDia['2026-11-07'], 'HX-6 sin codificación: no suma');
  // La vista del cliente lleva la gestión que cuenta, recortada (sin observación).
  const e = (await request(app).get(B + '/estado?vista=cliente').set(H(cli))).body;
  const conPrev = (e.casos || []).filter((c) => c._prev);
  assert.ok(conPrev.length >= 2 && conPrev.every((c) => c._prev.every((p) => p.cuenta && !('obs' in p))), JSON.stringify(conPrev).slice(0, 200));
});

test('app: gestFiltradas suma la gestión del histórico de un caso disponible, a nombre de su asesora y en su fecha', () => {
  const fs = require('fs'), path = require('path'), vm = require('vm');
  const APP = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'orlant-sta-app.js'), 'utf8');
  const trozo = (n) => APP.match(new RegExp('\nfunction ' + n + '\\(.*\n'))[0];
  const ctx = { S: { casos: {
    a: { _id: 'a', _estado: 'gestionado', _agente: '5', _tipi: 'No contesta', _fg: '2026-10-02 08:00:00', _citas: 0 },
    b: { _id: 'b', _estado: 'pendiente', _agente: null, _tipi: '', _fg: '', _prev: [{ cuenta: true, agente: 7, tipi: 'Agenda InConexion', fg: '2026-11-03 00:00:00', citas: 1 }, { agente: 7, tipi: 'No contesta', fg: '2026-11-01 00:00:00' }] },
  } } };
  vm.createContext(ctx); vm.runInContext(trozo('gestHistCuenta') + trozo('gestFiltradas'), ctx);
  const l = ctx.gestFiltradas('', '', '');
  assert.equal(l.length, 2, 'la gestionada y la del histórico que cuenta (no la que no cuenta)');
  const v = l.find((c) => c._virtual);
  assert.deepEqual([v._agente, v._tipi, v._citas, v._estado, v._id], ['7', 'Agenda InConexion', 1, 'gestionado', 'b#h0']);
  assert.equal(ctx.gestFiltradas('7', '2026-11-01', '2026-11-30').length, 1, 'filtra por asesora y fechas');
  assert.equal(ctx.S.casos.b._estado, 'pendiente', 'el caso sigue disponible');
  assert.match(APP, /c\._virtual\?' disabled title="Gestión del histórico: el caso ya está disponible"'/);
});

test('permisos y validación: solo quien gestiona el STA; archivo vacío o sin nombre, 400', async () => {
  assert.equal((await hist(as1, 'x.xlsx', [fila('HX-9', 'Facturado', 'No contesta', '2026-09-01', 'Asesora Inventada Uno')])).status, 403);
  assert.equal((await hist(cli, 'x.xlsx', [fila('HX-9', 'Facturado', 'No contesta', '2026-09-01', 'Asesora Inventada Uno')])).status, 403);
  assert.equal((await hist(sup, 'x.xlsx', [])).status, 400);
  assert.equal((await request(app).post(B + '/historico').set(H(sup)).send({ filas: [fila('HX-9', 'Facturado', 'No contesta', '2026-09-01', 'x')] })).status, 400);
  const r = await hist(sup, 'x.xlsx', [fila('HX-10', 'Facturado', 'No contesta', '01/09/2026', 'Asesora Inventada Uno')]);
  assert.deepEqual([r.body.nuevos, r.body.sinFecha], [0, 1], 'fecha de gestión inválida: no entra');
});
