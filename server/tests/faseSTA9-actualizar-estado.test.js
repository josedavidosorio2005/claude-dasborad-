// faseSTA9-actualizar-estado.test.js — Pedidos de Edwin (llamada del 25/11/2026) para «Gestión STA» de ORLANT:
//  1) solo «En proceso» y «Sin contacto» se gestionan; con otro Estado el caso sale de asignados, pendientes y sin
//     asignar («Fuera de gestión») y no le cuenta productividad a la asesora que lo tenía;
//  2) «Actualizar estado»: Excel con Numero Autorizacion y Estado; los que no existen se reportan y no se crean;
//  3) si la base normal lo trae otra vez «En proceso», vuelve a quedar disponible;
//  4) «Agendas por asesor» solo con las asesoras que tienen agendas o citas.
// Datos INVENTADOS.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const bcrypt = require('bcryptjs');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');
const STA = require('../orlant-sta');

const H = (t) => ({ Authorization: 'Bearer ' + t });
const B = '/api/orlant/sta';
let admin, sup, cli, as1, id1;
function crear(user, rol, perms, asesorCampana) {
  return Number(db.prepare(`INSERT INTO users (nombre, user, rol, active, password_hash, perms, asesorCampana, createdAt, debe_cambiar_password) VALUES (?,?,?,1,?,?,?,?,0)`)
    .run('Prueba ' + user, user, rol, bcrypt.hashSync('Clave#2026x', 4), JSON.stringify(perms), asesorCampana || null, new Date().toISOString()).lastInsertRowid);
}
const tok = (u) => tokenFor(u, 'Clave#2026x');
const caso = (n) => db.prepare('SELECT * FROM sta_casos WHERE campana = ? AND numero = ?').get('ORLANT', n);
const fila = (n, estado) => ({ 'Fecha Ingreso Sta': '2026-11-0' + ((n % 9) + 1) + ' 08:00:00', Entidad: 'ENTIDAD INVENTADA', 'Numero Autorizacion': 'AE' + n, Estado: estado, 'Descripcion Cups': 'CUPS INVENTADO', 'Fecha Autorizacion': '2026-11-01 00:00:00', 'Fecha Expiracion': '2026-12-31 00:00:00', Servicio: 'SERVICIO INVENTADO' });
const cargar = (t, filas) => request(app).post(B + '/cargas').set(H(t)).send({ archivo: 'base-inventada.xlsx', columnas: STA.CAMPOS, filas });
const estados = (t, filas) => request(app).post(B + '/estados').set(H(t)).send({ archivo: 'estados-inventados.xlsx', filas });

before(async () => {
  admin = await tokenFor('admin', MASTER_PASSWORD);
  crear('sta9_sup', 'SUPERVISOR', { campana_ORLANT: true, cliente_ORLANT: true });
  crear('sta9_cli', 'CLIENTES_DASH', { ClientesDash: true, cliente_ORLANT: true });
  id1 = crear('sta9_as1', 'ASESOR', { campana_ORLANT: true }, 'ORLANT');
  [sup, cli, as1] = await Promise.all(['sta9_sup', 'sta9_cli', 'sta9_as1'].map(tok));
});

test('regla: «En proceso» y «Sin contacto» (sin importar mayúsculas ni tildes) se gestionan; el resto no', () => {
  for (const e of ['En proceso', 'EN PROCESO', ' en  proceso ', 'Sin contacto', 'SIN CONTACTO']) assert.equal(STA.esGestionable(e), true, e);
  for (const e of ['Agendada', 'Cumplida', 'Anulada', 'Facturado', 'AUTORIZADA']) assert.equal(STA.esGestionable(e), false, e);
  assert.equal(STA.esGestionable(''), true, 'vacío: no decide');
});

test('carga normal: un caso nuevo con otro Estado entra «Fuera de gestión» y no queda disponible para asignar', async () => {
  const r = await cargar(sup, [1, 2, 3, 4, 5, 6].map((n) => fila(n, 'En proceso')).concat([fila(7, 'Sin contacto'), fila(8, 'Cumplida')]));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.nuevos, 8);
  assert.equal(r.body.nuevosFuera, 1);
  assert.equal(caso('AE8').estado, 'fuera');
  assert.equal(caso('AE7').estado, 'pendiente');
  assert.ok(!STA.disponiblesFiltrados(db, {}).some((x) => x.numero === 'AE8'), 'AE8 no es disponible');
  const a = await request(app).post(B + '/asignar').set(H(sup)).send({ agenteId: id1, cantidad: 4 });
  assert.equal(a.body.asignados, 4);
  assert.deepEqual(['AE1', 'AE2', 'AE3', 'AE4'].map((n) => caso(n).agenteId), [id1, id1, id1, id1]);
  const cfg = STA.config(db);
  const c = await request(app).post(B + '/casos/AE1/codificar').set(H(as1)).send({ tipi: 'No contesta', obs: 'Obs inventada' });
  assert.equal(c.status, 200, JSON.stringify(c.body));
  assert.ok(cfg.tipis.includes('No contesta'));
});

test('«Actualizar estado»: cambia los existentes, reporta los que no existen (sin crearlos) y aplica la regla', async () => {
  const r = await estados(sup, [
    { numero: 'AE2', estado: 'Agendada' },   // pendiente de la asesora → sale de la gestión, sin productividad
    { numero: 'AE1', estado: 'Facturado' },  // ya gestionado por ella → conserva su gestión
    { numero: 'AE5', estado: 'Sin contacto' }, // libre, sigue gestionable (cambia el dato)
    { numero: 'AE8', estado: 'En proceso' }, // estaba fuera → vuelve disponible
    { numero: 'AE6', estado: 'En proceso' }, // sin cambio
    { numero: 'NOEXISTE1', estado: 'En proceso' },
    { numero: 'NOEXISTE2', estado: 'Anulada' },
    { numero: '', estado: 'Anulada' },
    { numero: 'AE7', estado: '' },
    { numero: 'AE5', estado: 'Cumplida' },   // repetida en el archivo: cuenta la primera
    { numero: 4.0, estado: 'Cumplida' },     // número de Excel: «4» no existe (los casos son AE…)
  ]);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const b = r.body;
  assert.equal(b.actualizados, 4);
  assert.equal(b.sinCambio, 1);
  assert.equal(b.salieron, 1);
  assert.equal(b.volvieron, 1);
  assert.equal(b.noExisten, 3);
  assert.deepEqual(b.noExistenLista, ['NOEXISTE1', 'NOEXISTE2', '4']);
  assert.equal(b.sinNum, 1);
  assert.equal(b.sinEstado, 1);
  assert.equal(b.repetidos, 1);
  assert.deepEqual(b.cambios, { 'En proceso → Agendada': 1, 'En proceso → Facturado': 1, 'En proceso → Sin contacto': 1, 'Cumplida → En proceso': 1 });
  assert.equal(db.prepare("SELECT COUNT(*) n FROM sta_casos WHERE numero LIKE 'NOEXISTE%' OR numero = '4'").get().n, 0, 'no se crean');
  // AE2: fuera, sin asesora; el historial dice de quién era.
  const e2 = caso('AE2');
  assert.equal(e2.estado, 'fuera');
  assert.equal(e2.agenteId, null);
  assert.equal(JSON.parse(e2.datos).Estado, 'Agendada');
  const h2 = JSON.parse(e2.hist).pop();
  assert.equal(h2.sale, true); assert.equal(h2.agente, id1); assert.equal(h2.origen, 'actualizar');
  // AE1: gestionado, conserva su gestión (productividad de la asesora).
  const e1 = caso('AE1');
  assert.equal(e1.estado, 'gestionado'); assert.equal(e1.agenteId, id1); assert.equal(e1.tipi, 'No contesta');
  // AE8: vuelve libre y disponible.
  assert.equal(caso('AE8').estado, 'pendiente'); assert.equal(caso('AE8').agenteId, null);
  assert.ok(STA.disponiblesFiltrados(db, {}).some((x) => x.numero === 'AE8'));
  // La asesora ya no ve AE2; sus gestionados siguen siendo 1 (AE1) y sus pendientes AE3, AE4.
  const mio = (await request(app).get(B + '/estado').set(H(as1))).body.casos;
  assert.deepEqual(mio.map((c) => c._id).sort(), ['AE1', 'AE3', 'AE4']);
  // Historial.
  const hist = db.prepare("SELECT detalle FROM historial WHERE accion = 'STA_ESTADOS' ORDER BY id DESC LIMIT 1").get();
  assert.match(hist.detalle, /4 actualizados, 1 sin cambio, 1 salieron de la gestión, 1 volvieron, 3 no existen/);
});

test('la gráfica «Estado» del cliente refleja el cambio y «Fuera de gestión» va aparte (no es «sin asignar»)', async () => {
  const r = (await request(app).get(B + '/resumen').set(H(cli))).body;
  assert.equal(r.fueraGestion, 1, 'AE2');
  assert.equal(r.porEstado['Agendada'].fuera, 1);
  assert.equal(r.porEstado['Agendada'].sinAsignar, 0);
  assert.equal(r.total, r.sinAsignar + r.pendientes + r.gestionados + r.fueraGestion);
  const v = (await request(app).get(B + '/estado?vista=cliente').set(H(cli))).body.casos;
  assert.equal(v.filter((c) => c._estado === 'fuera' && c.Estado === 'Agendada').length, 1);
});

test('recarga de la base normal: si vuelve «En proceso», queda disponible otra vez; si un asignado pasa a otro estado, sale', async () => {
  const r = await cargar(sup, [fila(2, 'En proceso'), fila(3, 'Anulada')]);
  assert.equal(r.status, 200);
  assert.equal(r.body.volvieron, 1);
  assert.equal(r.body.salieron, 1);
  assert.match(r.body.mensaje, /1 fuera de gestión .*; 1 volvieron a quedar disponibles/);
  assert.equal(caso('AE2').estado, 'pendiente'); assert.equal(caso('AE2').agenteId, null);
  assert.equal(caso('AE3').estado, 'fuera'); assert.equal(caso('AE3').agenteId, null);
  assert.equal(JSON.parse(caso('AE2').hist).pop().origen, 'carga');
  // Regresar un gestionado cuyo Estado ya no se gestiona: queda «fuera», no disponible.
  assert.equal((await estados(sup, [{ numero: 'AE1', estado: 'Cumplida' }])).status, 200);
  assert.equal((await request(app).post(B + '/gestionados/regresar').set(H(sup)).send({ numeros: ['AE1'] })).body.regresados, 1);
  assert.equal(caso('AE1').estado, 'fuera');
});

test('permisos y validación: solo quien gestiona el STA; archivo vacío o sin nombre, 400', async () => {
  assert.equal((await estados(as1, [{ numero: 'AE4', estado: 'Anulada' }])).status, 403);
  assert.equal((await estados(cli, [{ numero: 'AE4', estado: 'Anulada' }])).status, 403);
  assert.equal((await request(app).post(B + '/estados').send({ archivo: 'x', filas: [] })).status, 401);
  assert.equal((await estados(sup, [])).status, 400);
  assert.equal((await request(app).post(B + '/estados').set(H(admin)).send({ filas: [{ numero: 'AE4', estado: 'X' }] })).status, 400);
  assert.equal(caso('AE4').estado, 'pendiente', 'nada cambió');
});

// ── Navegador (archivo generado por scripts/orlant/generar-sta.js) ──
const APP = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'orlant-sta-app.js'), 'utf8');
const CSS = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'css', 'orlant-sta-app.css'), 'utf8');
const A = require('../../public/js/orlant-sta-app.js');

test('navegador: «Cargar base de datos» y «Actualizar estado» lado a lado, con su plantilla', () => {
  const m = A.STA_MARKUP;
  const i = m.indexOf('<div class="sta-cargas-dos">');
  assert.ok(i > 0);
  const bloque = m.slice(i, m.indexOf('Historial de cargas'));
  assert.ok(bloque.indexOf('Cargar base de datos') < bloque.indexOf('Actualizar estado'));
  assert.match(bloque, /id="dropEst" onclick="STAapp\.\$\('archivoEst'\)\.click\(\)"/);
  assert.match(bloque, /onclick="STAapp\.descargarPlantillaEstado\(\)">Descargar plantilla<\/button>/);
  assert.match(bloque, /<input type="file" id="archivoEst" accept="\.xlsx,\.xls,\.csv" class="hidden" aria-label="Archivo para actualizar estado">/);
  assert.match(APP, /const ws=XLSX\.utils\.aoa_to_sheet\(\[\['Numero Autorizacion','Estado'\]\]\)/);
  assert.match(APP, /API\.estados\(file\.name, objs\)/);
  assert.match(APP, /procesarEstados, descargarPlantillaEstado|descargarPlantillaEstado[\s\S]*STAapp = \{[^}]*procesarEstados/);
  assert.match(CSS, /\.sta-cargas-dos\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(CSS, /@media\(max-width:820px\)\{\.sta-cargas-dos\{grid-template-columns:minmax\(0,1fr\)\}\}/);
});

test('navegador: los «Fuera de gestión» no son sin asignar ni disponibles; tienen su KPI y su color en las gráficas', () => {
  const ctx = { S: { casos: { a: { _agente: null, _estado: 'pendiente' }, b: { _agente: null, _estado: 'fuera' }, c: { _agente: '7', _estado: 'pendiente' } } } };
  vm.createContext(ctx);
  vm.runInContext(APP.match(/\nfunction disponibles\(\)\{[^\n]*\}/)[0], ctx);
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.disponibles().map((c) => c._estado))), ['pendiente']);
  assert.match(APP, /\['Gestionados',gest\],\['Fuera de gestión',fuera\]\]/);
  assert.match(APP, /'Fuera de gestión':'#7a6a8f'/);
  assert.match(APP, /c\._estado==='fuera'\?'Fuera de gestión':\(c\._agente\?'Pendiente':'Sin asignar'\)/);
  assert.doesNotMatch(APP, /filter\(c=>!c\._agente\)/, 'ningún conteo de «sin asignar» sin mirar el estado');
});

test('navegador: «Agendas por asesor» solo con las asesoras que tienen agendas o citas', () => {
  assert.match(APP, /const asesAg=ases\.filter\(a=>\{ const o=dat\(a\.id\); return o\.e>0\|\|o\.citas>0; \}\);/);
  assert.match(APP, /else \{ const rows=asesAg\.map\(a=>\{/);
  assert.match(APP, /Ninguna asesora tiene agendas ni citas con estos filtros\./);
});
