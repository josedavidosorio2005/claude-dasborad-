// fase343-telefono-calificar.test.js — Fase 343 (corrige la Fase 340, 11/11): el telefono SI se usa en
// Calidad para ubicar la llamada junto con el ID. Vuelve a «Calificar» (al lado del ID de la llamada) y se
// guarda con el monitoreo. Solo lo ven quienes califican (CALIDAD, SUPERVISOR, Reportes, ADMIN); el cliente
// y el asesor nunca. La carga masiva sigue leyendo TELEFONO. Datos SINTETICOS.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');
const L = require('../../public/js/calidad-calificar-logic.js');
const CM = require('../../public/js/calidad-carga-masiva-logic.js');

const H = (t) => ({ Authorization: 'Bearer ' + t });
const PUB = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'public', f), 'utf8');
const hoy = new Date().toISOString().slice(0, 10);
const PW = 'Clave#Fase343x';
const TEL = '3000000343';
let admin;
before(async () => { admin = await tokenFor('admin', MASTER_PASSWORD); });
async function crear(user, rol, perms, extra) {
  const r = await request(app).post('/api/users').set(H(admin)).send(Object.assign({ nombre: 'Persona Ficticia ' + user, user, password: PW, rol, perms }, extra || {}));
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return { id: r.body.id, token: await tokenFor(user, PW) };
}

test('formulario: el telefono sale en ORLANT, en las genericas y en las plantillas que lo traen, justo despues del ID', () => {
  const k = (p) => L.cc2CamposDe(p).map((c) => c.k);
  assert.deepEqual(k({ campana: 'ORLANT', campos: null }).slice(2, 4), ['idLlamada', 'telefono']);
  assert.deepEqual(k({ campana: 'OTRA', campos: null }).slice(2, 4), ['idLlamada', 'telefono']);
  assert.deepEqual(k({ campana: 'CLINICA AURORA', campos: [{ k: 'asesor' }, { k: 'fecha' }, { k: 'telefono' }, { k: 'codificacion' }, { k: 'idLlamada' }] }), ['asesor', 'fecha', 'codificacion', 'idLlamada', 'telefono']);
  assert.ok(!k({ campana: 'SURA', campos: [{ k: 'asesor' }, { k: 'idLlamada' }] }).includes('telefono'), 'una plantilla que no lo trae sigue sin el');
  const cc2 = PUB('js/calidad-calificar.js');
  assert.match(cc2, /telefono: _cc2Val\('telefono'\)/, 'se manda al guardar');
  assert.match(cc2, /set\('telefono', m\.telefono\)/, 'se llena al editar');
});

test('servidor: se guarda al crear y se corrige al editar', async () => {
  const c = await request(app).post('/api/monitoreos').set(H(admin)).send({ campana: 'MOBILIZE', asesor: 'Asesor Ficticio', fecha: hoy, canal: 'LLAMADA', answers: { 1: 'SI' }, telefono: TEL });
  assert.equal(c.status, 201, JSON.stringify(c.body));
  assert.equal(db.prepare('SELECT telefono FROM monitoreos WHERE id = ?').get(c.body.id).telefono, TEL);
  const e = await request(app).put('/api/monitoreos/' + c.body.id).set(H(admin)).send({ telefono: '3000000344', observaciones: 'Edicion ficticia' });
  assert.equal(e.status, 200, JSON.stringify(e.body));
  assert.equal(db.prepare('SELECT telefono FROM monitoreos WHERE id = ?').get(c.body.id).telefono, '3000000344');
  const sin = await request(app).put('/api/monitoreos/' + c.body.id).set(H(admin)).send({ observaciones: 'Otra edicion ficticia' });
  assert.equal(sin.status, 200);
  assert.equal(db.prepare('SELECT telefono FROM monitoreos WHERE id = ?').get(c.body.id).telefono, '3000000344', 'editar sin mandarlo no lo borra');
});

test('quien lo ve: CALIDAD, SUPERVISOR, Reportes y admin si; cliente, asesor (lista, detalle y visto) ', async () => {
  const ases = await crear('ases343', 'ASESOR', {}, { asesorCampana: 'MOBILIZE' });
  const c = await request(app).post('/api/monitoreos').set(H(admin)).send({ campana: 'MOBILIZE', asesor: 'Persona Ficticia ases343', asesorUserId: ases.id, fecha: hoy, canal: 'LLAMADA', answers: { 1: 'SI' }, telefono: TEL });
  assert.equal(c.status, 201, JSON.stringify(c.body));
  const id = c.body.id;
  db.prepare('UPDATE monitoreos SET asesorUserId = ? WHERE id = ?').run(ases.id, id);
  const ven = [await crear('cal343', 'CALIDAD', { Calidad: true, campana_MOBILIZE: true }), await crear('sup343', 'SUPERVISOR', { Calidad: true, supervisa_MOBILIZE: true }), await crear('rep343', 'REPORTES', { Calidad: true, campana_MOBILIZE: true })];
  // CALIDAD ve solo los suyos (Fase 334): califica uno propio con telefono y lo ve.
  const propioCal = await request(app).post('/api/monitoreos').set(H(ven[0].token)).send({ campana: 'MOBILIZE', asesor: 'Asesor Ficticio', fecha: hoy, canal: 'LLAMADA', answers: { 1: 'SI' }, telefono: TEL });
  assert.equal(propioCal.status, 201, JSON.stringify(propioCal.body));
  const deCal = (await request(app).get('/api/monitoreos?campana=MOBILIZE').set(H(ven[0].token))).body;
  assert.equal(deCal.find((m) => m.id === propioCal.body.id).telefono, TEL, 'CALIDAD lo ve');
  for (const u of ven.slice(1)) {
    const lista = (await request(app).get('/api/monitoreos?campana=MOBILIZE').set(H(u.token))).body;
    assert.ok(Array.isArray(lista), JSON.stringify(lista));
    assert.equal(lista.find((m) => m.id === id).telefono, TEL, 'SUPERVISOR y Reportes lo ven');
  }
  assert.equal((await request(app).get('/api/monitoreos?campana=MOBILIZE').set(H(admin))).body.find((m) => m.id === id).telefono, TEL);
  const cli = await crear('cli343', 'CLIENTES_DASH', { ClientesDash: true, cliente_MOBILIZE: true });
  const gcli = await request(app).get('/api/monitoreos?campana=MOBILIZE').set(H(cli.token));
  assert.equal(gcli.status, 200);
  assert.ok(gcli.body.length && gcli.body.every((m) => !('telefono' in m)), 'el cliente (dashboard y su exportacion) nunca lo recibe');
  const mios = (await request(app).get('/api/monitoreos/mios').set(H(ases.token))).body;
  const propio = mios.find((m) => m.id === id);
  assert.ok(propio && !('telefono' in propio), 'el asesor no lo recibe en Mis resultados');
  const visto = await request(app).put('/api/monitoreos/' + id + '/visto').set(H(ases.token));
  if (visto.status === 200) assert.ok(!('telefono' in visto.body), 'ni al marcarlo como visto');
  assert.ok(!PUB('index.html').includes('id="dm-telefono"') && !PUB('js/mis-resultados.js').includes('dm-telefono'), 'la ventana del asesor no tiene el campo');
});

test('carga masiva por Excel: sigue leyendo y guardando la columna TELEFONO', () => {
  const col = CM.CM_COLUMNAS_FIJAS || CM.CM_FIJAS || null;
  const src = PUB('js/calidad-carga-masiva-logic.js');
  assert.match(src, /\{ key: 'telefono', label: 'TELEFONO', labelAlt: \['# TELEFONO'\] \}/);
  assert.match(src, /telefono: map\.fijas\.telefono!==undefined/);
  assert.ok(col === null || col.some((c) => c.key === 'telefono'));
});
