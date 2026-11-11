// fase334-calidad-cada-quien.test.js — Fase 334 (pedido de Edwin, 11/11): en el Modulo de Calidad
// cada quien ve solo lo que califico. ADMIN todo; CALIDAD siempre solo lo suyo; SUPERVISOR solo lo
// suyo en el modulo (?vista=propios) y el consolidado en el dashboard; ASESOR sin cambios; la tarjeta
// de total muestra el de la campaña y «Hechos por mí». Calidad de encuestas no cambia. SINTETICO.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');

const H = (t) => ({ Authorization: 'Bearer ' + t });
const PW = 'Clave#Fase334x';
const hoy = new Date().toISOString().slice(0, 10);
const mes = hoy.slice(0, 7);
let admin, cal1, cal2, sup, rep, asesor, cliente;
const ids = async (tok, q) => { const r = await request(app).get('/api/monitoreos').query(Object.assign({ campana: 'MOBILIZE' }, q || {})).set(H(tok)); return { status: r.status, ids: Array.isArray(r.body) ? r.body.map((m) => m.id).sort((a, b) => a - b) : [], body: r.body }; };
async function crear(user, rol, perms, extra) {
  const r = await request(app).post('/api/users').set(H(admin)).send(Object.assign({ nombre: 'Persona Ficticia ' + user, user, password: PW, rol, perms }, extra));
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return { id: r.body.id, nombre: 'Persona Ficticia ' + user, token: await tokenFor(user, PW) };
}
const mon = (tok, asesorNombre, asesorUserId) => request(app).post('/api/monitoreos').set(H(tok)).send({ campana: 'MOBILIZE', asesor: asesorNombre, asesorUserId, fecha: hoy, canal: 'LLAMADA', answers: { 1: 'SI' }, observaciones: 'Obs ficticia 334' });
let m1, m2, mS, mA2;

before(async () => {
  admin = await tokenFor('admin', MASTER_PASSWORD);
  cal1 = await crear('cal334a', 'CALIDAD', { Calidad: true, campana_MOBILIZE: true });
  cal2 = await crear('cal334b', 'CALIDAD', { Calidad: true, campana_MOBILIZE: true });
  sup = await crear('sup334', 'SUPERVISOR', { Calidad: true, campana_MOBILIZE: true, cliente_MOBILIZE: true });
  rep = await crear('rep334', 'REPORTES', { Calidad: true, campana_MOBILIZE: true });
  asesor = await crear('as334', 'ASESOR', {}, { asesorCampana: 'MOBILIZE' });
  cliente = await crear('cli334', 'CLIENTES_DASH', { ClientesDash: true, cliente_MOBILIZE: true });
  m1 = (await mon(cal1.token, asesor.nombre, asesor.id)).body;
  m2 = (await mon(cal2.token, asesor.nombre, asesor.id)).body;
  mS = (await mon(sup.token, asesor.nombre, asesor.id)).body;
  mA2 = (await mon(admin, asesor.nombre, asesor.id)).body;
  for (const m of [m1, m2, mS, mA2]) assert.ok(m && m.id, JSON.stringify(m));
  // Las cuatro se crearon para que existan otros monitoreos de la campaña (incluidos los de otras pruebas).
});

test('ADMIN: todos los monitoreos de la campaña, con y sin vista=propios', async () => {
  const t = await ids(admin);
  for (const m of [m1, m2, mS, mA2]) assert.ok(t.ids.includes(m.id));
  assert.deepEqual((await ids(admin, { vista: 'propios' })).ids, t.ids, 'el admin no se filtra');
});

test('CALIDAD: solo lo suyo, en el servidor, pida lo que pida', async () => {
  assert.deepEqual((await ids(cal1.token)).ids, [m1.id]);
  assert.deepEqual((await ids(cal1.token, { vista: 'propios' })).ids, [m1.id]);
  assert.deepEqual((await ids(cal1.token, { mes })).ids, [m1.id]);
  assert.deepEqual((await ids(cal2.token)).ids, [m2.id]);
});

test('SUPERVISOR: en el modulo (vista=propios) solo lo suyo; en el dashboard (sin vista) el consolidado', async () => {
  assert.deepEqual((await ids(sup.token, { vista: 'propios' })).ids, [mS.id]);
  const dash = await ids(sup.token);
  for (const m of [m1, m2, mS, mA2]) assert.ok(dash.ids.includes(m.id), 'consolidado del dashboard sin cambios');
});

test('Reportes y cliente sin cambios; el cliente sigue sin evaluador ni observaciones; el asesor sin lista de campaña', async () => {
  const r = await ids(rep.token);
  for (const m of [m1, m2, mS]) assert.ok(r.ids.includes(m.id));
  const c = await ids(cliente.token);
  for (const m of [m1, m2, mS]) assert.ok(c.ids.includes(m.id));
  for (const m of c.body) { assert.equal('evaluador' in m, false); assert.equal('observaciones' in m, false); }
  assert.equal((await ids(asesor.token)).status, 403);
  const mios = (await request(app).get('/api/monitoreos/mios').set(H(asesor.token))).body.map((m) => m.id);
  for (const m of [m1, m2, mS, mA2]) assert.ok(mios.includes(m.id), 'el asesor ve sus resultados de cualquier evaluador');
});

test('tarjeta: total de la campaña (hechos por todos) y «Hechos por mí», por mes', async () => {
  const totalReal = db.prepare("SELECT COUNT(*) AS n FROM monitoreos WHERE campana = 'MOBILIZE'").get().n;
  const r = await request(app).get('/api/monitoreos/total').query({ campana: 'MOBILIZE' }).set(H(cal1.token));
  assert.equal(r.status, 200);
  assert.equal(r.body.total, totalReal);
  assert.equal(r.body.propios, 1);
  assert.equal(r.body.porMes[mes].propios, 1);
  assert.ok(r.body.porMes[mes].total >= 4);
  assert.ok(!JSON.stringify(r.body).includes('Persona Ficticia'), 'solo conteos, ningun nombre ni monitoreo de otros');
  assert.equal((await request(app).get('/api/monitoreos/total').query({ campana: 'ORLANT' }).set(H(cal1.token))).status, 403);
});

test('Reportes del modulo: CALIDAD/SUPERVISOR ven solo su propia meta en el cumplimiento', async () => {
  for (const u of [cal1, cal2, sup]) {
    const ts = new Date().toISOString();
    db.prepare('INSERT INTO cronograma_metas (campana, mes, liderId, liderNombre, metaGrupal, asesores, diasLaborales, whatsapp, pctWhatsapp, createdAt, updatedAt) VALUES (?, ?, ?, ?, 10, 1, 20, 0, 0, ?, ?)')
      .run('MOBILIZE', mes, u.id, u.nombre, ts, ts);
  }
  const cu = async (tok, q) => (await request(app).get('/api/metas/cumplimiento').query(Object.assign({ campana: 'MOBILIZE', mes }, q || {})).set(H(tok))).body.lideres.map((l) => l.liderId).sort((a, b) => a - b);
  assert.deepEqual(await cu(cal1.token), [cal1.id]);
  assert.deepEqual(await cu(sup.token, { vista: 'propios' }), [sup.id]);
  assert.equal((await cu(admin)).length, 3, 'el admin ve todas las metas');
});

test('pantalla: el modulo lee su propia lista; el dashboard sigue con el consolidado; Calidad de encuestas no cambia', () => {
  const PUB = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', f), 'utf8');
  const cal = PUB('calidad.js');
  assert.ok(cal.includes("d.monitoreosModulo = (await apiRequest('GET','/monitoreos?'+q+'&vista=propios')) || [];"));
  assert.ok(cal.includes("'<div class=\"kl cal-kpi-mios\">Hechos por mí: <b>'+total+'</b></div>"));
  assert.ok(!/CAL_DB\[[^\]]+\][^\n]{0,30}\.monitoreos(?!Modulo)/.test(cal.replace(/d\.monitoreos(Modulo)? =[^\n]*/g, '').replace("return (d.monitoreosModulo !== null && d.monitoreosModulo !== undefined) ? d.monitoreosModulo : (d.monitoreos || []);", '')), 'el modulo no lee el consolidado directo');
  assert.ok(!/CAL_DB\[[^\]]+\][^\n]{0,30}\.monitoreos/.test(PUB('calidad-analisis.js')), 'Resumen y Detalle del modulo, con su lista');
  assert.ok(PUB('dashboard-generic.js').includes("var todos = (typeof CAL_DB!=='undefined' && CAL_DB[camp] && CAL_DB[camp].monitoreos) || [];"), 'dashboard: consolidado');
  assert.ok(!PUB('calidad-encuestas.js').includes('vista=propios'), 'Calidad de encuestas: cola compartida');
});
