// fase337-fecha-del-monitoreo.test.js — Fase 337 (pedido urgente, 11/11): quien califica elige la
// fecha del monitoreo (hoy por defecto, pasada si, futura no) y un monitoreo guardado puede cambiar
// SOLO su fecha (sin tocar respuestas ni puntaje), con historial. Pasa al mes que corresponde en todas
// las vistas. Pruebas por rol. Datos SINTETICOS.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');
const { fechaLimitesHoyColombia } = require('../fecha-limites');

const H = (t) => ({ Authorization: 'Bearer ' + t });
const PW = 'Clave#Fase337x';
const HOY = fechaLimitesHoyColombia();
const manana = (() => { const d = new Date(HOY + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); })();
let admin, cal1, cal2, sup, rep, asesor, cliente;
async function crear(user, rol, perms, extra) {
  const r = await request(app).post('/api/users').set(H(admin)).send(Object.assign({ nombre: 'Persona Ficticia ' + user, user, password: PW, rol, perms }, extra));
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return { id: r.body.id, nombre: 'Persona Ficticia ' + user, token: await tokenFor(user, PW) };
}
const crearMon = (tok, extra) => request(app).post('/api/monitoreos').set(H(tok)).send(Object.assign({ campana: 'MOBILIZE', asesor: 'Asesor Ficticio', canal: 'LLAMADA', answers: { 1: 'SI', 2: 'NO' }, observaciones: 'Obs ficticia 337' }, extra));
const cambiar = (tok, id, fecha) => request(app).put('/api/monitoreos/' + id + '/fecha').set(H(tok)).send({ fecha });
const fila = (id) => db.prepare('SELECT * FROM monitoreos WHERE id = ?').get(id);

before(async () => {
  admin = await tokenFor('admin', MASTER_PASSWORD);
  cal1 = await crear('cal337a', 'CALIDAD', { Calidad: true, campana_MOBILIZE: true });
  cal2 = await crear('cal337b', 'CALIDAD', { Calidad: true, campana_MOBILIZE: true });
  sup = await crear('sup337', 'SUPERVISOR', { Calidad: true, campana_MOBILIZE: true, cliente_MOBILIZE: true });
  rep = await crear('rep337', 'REPORTES', { Calidad: true, campana_MOBILIZE: true });
  asesor = await crear('as337', 'ASESOR', {}, { asesorCampana: 'MOBILIZE' });
  cliente = await crear('cli337', 'CLIENTES_DASH', { ClientesDash: true, cliente_MOBILIZE: true });
});

test('Calificar: la fecha elegida se guarda (pasada si, hoy si); futura, invalida o "Invalid Date", 400', async () => {
  const pasada = await crearMon(cal1.token, { fecha: '2026-09-10' });
  assert.equal(pasada.status, 201, JSON.stringify(pasada.body));
  assert.equal(pasada.body.fecha, '2026-09-10');
  assert.equal(pasada.body.mes, '2026-09');
  const hoy = await crearMon(cal1.token, { fecha: HOY }); // el formulario manda hoy por defecto
  assert.equal(hoy.status, 201, JSON.stringify(hoy.body));
  assert.equal(hoy.body.fecha, HOY);
  const fut = await crearMon(cal1.token, { fecha: manana });
  assert.equal(fut.status, 400); assert.match(fut.body.error, /no puede ser futura/);
  for (const mala of ['Invalid Date', '2026-02-30', '10/11/2026', '2019-12-31']) assert.equal((await crearMon(cal1.token, { fecha: mala })).status, 400, mala);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM monitoreos WHERE fecha NOT GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'").get().n, 0, 'nunca se guarda una fecha que no sea AAAA-MM-DD');
  // El supervisor tambien elige la fecha al calificar.
  const s = await crearMon(sup.token, { fecha: '2026-10-03' });
  assert.equal(s.status, 201); assert.equal(s.body.fecha, '2026-10-03');
});

test('cambiar fecha: solo la fecha y el mes; respuestas, puntaje, evaluador y observaciones quedan igual; historial', async () => {
  const m = (await crearMon(cal1.token, { fecha: HOY })).body;
  const antes = fila(m.id);
  const r = await cambiar(cal1.token, m.id, '2026-09-20');
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const d = fila(m.id);
  assert.equal(d.fecha, '2026-09-20'); assert.equal(d.mes, '2026-09');
  for (const k of ['answers', 'puntaje', 'clasificacion', 'fallos', 'nivelCritico', 'evaluador', 'evaluadorUserId', 'observaciones', 'asesor', 'asesorUserId', 'extras', 'plantillaId', 'origen', 'idLlamada']) assert.deepEqual(d[k], antes[k], k);
  const h = db.prepare("SELECT * FROM historial WHERE accion = 'MONITOREO_FECHA' ORDER BY rowid DESC LIMIT 1").get();
  assert.ok(h, 'queda en el historial');
  const txt = JSON.stringify(h);
  assert.ok(txt.includes(HOY) && txt.includes('2026-09-20'), 'con la fecha anterior y la nueva');
  assert.ok(txt.includes('cal337a') || txt.includes(cal1.nombre), 'y quien la cambio');
});

test('por rol: quien lo califico, Reportes y el admin si; otro CALIDAD, asesor y cliente no', async () => {
  const deCal1 = (await crearMon(cal1.token, { fecha: HOY })).body;
  const deSup = (await crearMon(sup.token, { fecha: HOY })).body;
  assert.equal((await cambiar(cal2.token, deCal1.id, '2026-10-01')).status, 403, 'otro CALIDAD no');
  assert.equal((await cambiar(asesor.token, deCal1.id, '2026-10-01')).status, 403, 'asesor no');
  assert.equal((await cambiar(cliente.token, deCal1.id, '2026-10-01')).status, 403, 'cliente no');
  assert.equal((await cambiar(sup.token, deCal1.id, '2026-10-01')).status, 403, 'el supervisor no cambia el de otro');
  assert.equal((await cambiar(sup.token, deSup.id, '2026-10-02')).status, 200, 'el supervisor si el suyo');
  assert.equal((await cambiar(rep.token, deCal1.id, '2026-10-03')).status, 200, 'Reportes si');
  assert.equal((await cambiar(admin, deCal1.id, '2026-10-04')).status, 200, 'admin si');
  assert.equal(fila(deCal1.id).fecha, '2026-10-04');
  assert.equal((await cambiar(admin, deCal1.id, manana)).status, 400, 'futura no');
  assert.equal((await cambiar(admin, deCal1.id, 'Invalid Date')).status, 400);
  assert.equal((await request(app).put('/api/monitoreos/' + deCal1.id + '/fecha').set(H(admin)).send({ fecha: '2026-10-05', puntaje: 100 })).status, 400, 'no acepta otros campos');
});

test('el monitoreo pasa al mes nuevo en la lista por mes y en el cumplimiento de metas', async () => {
  const m = (await crearMon(cal1.token, { fecha: HOY })).body;
  const mesNuevo = '2026-08';
  assert.equal((await cambiar(cal1.token, m.id, mesNuevo + '-14')).status, 200);
  const enMes = (await request(app).get('/api/monitoreos').query({ campana: 'MOBILIZE', mes: mesNuevo }).set(H(admin))).body.map((x) => x.id);
  assert.ok(enMes.includes(m.id));
  const enHoy = (await request(app).get('/api/monitoreos').query({ campana: 'MOBILIZE', mes: HOY.slice(0, 7) }).set(H(admin))).body.map((x) => x.id);
  assert.ok(!enHoy.includes(m.id));
  const ts = new Date().toISOString();
  db.prepare('INSERT INTO cronograma_metas (campana, mes, liderId, liderNombre, metaGrupal, asesores, diasLaborales, whatsapp, pctWhatsapp, createdAt, updatedAt) VALUES (?, ?, ?, ?, 10, 1, 20, 0, 0, ?, ?)').run('MOBILIZE', mesNuevo, cal1.id, cal1.nombre, ts, ts);
  const cu = (await request(app).get('/api/metas/cumplimiento').query({ campana: 'MOBILIZE', mes: mesNuevo }).set(H(admin))).body.lideres.find((l) => l.liderId === cal1.id);
  assert.ok(cu && cu.realizados >= 1, 'cuenta en las metas del mes nuevo');
});

test('Calidad de encuestas: su monitoreo tambien elige y cambia la fecha', async () => {
  const c = await request(app).post('/api/calidad/encuestas/carga').set(H(admin)).send({ campana: 'MOBILIZE', filas: [['2025-03-20', 'Asesor Ficticio', 'SKILL X', 1, null, null, null, '', 'CONN-337', '10:00']] });
  assert.equal(c.status, 201, JSON.stringify(c.body));
  const g = await crearMon(cal1.token, { fecha: '2026-10-10', encuestaConnId: 'CONN-337' });
  assert.equal(g.status, 201, JSON.stringify(g.body));
  assert.equal(g.body.fecha, '2026-10-10'); assert.equal(g.body.origen, 'encuesta');
  assert.equal((await cambiar(cal1.token, g.body.id, '2026-10-12')).status, 200);
  assert.equal(fila(g.body.id).encuestaConnId, 'CONN-337', 'el vinculo con la encuesta no cambia');
});

test('pantalla: campo «Fecha del monitoreo» editable (hoy, sin futuras) y «Cambiar fecha» en Monitoreos', () => {
  const PUB = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'public', f), 'utf8');
  const cc2 = PUB('js/calidad-calificar.js');
  assert.ok(cc2.includes('<span class="cc2-lt">Fecha del monitoreo *</span><input type="date" id="\' + id + \'" value="\' + esc(calFechaHoyLocal()) + \'" max="\' + esc(calFechaHoyLocal()) + \'"'));
  assert.ok(!cc2.includes("(isFullAdmin() ? '' : ' disabled')"), 'ya no se bloquea para quien no es admin');
  const cal = PUB('js/calidad.js');
  assert.ok(cal.includes("apiRequest('PUT','/monitoreos/'+id+'/fecha', { fecha: fecha })"));
  assert.ok(cal.includes('Cambiar fecha</button>'));
  assert.ok(PUB('index.html').includes('<label for="cf-fecha">Fecha del monitoreo</label><input type="date" id="cf-fecha" min="2020-01-01">'));
});
