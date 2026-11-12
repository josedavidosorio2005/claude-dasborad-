// fase348-c2-buscador-calidad.test.js — Fase 348, punto C2 (reunion con Edwin del 12/11): buscador
// en las listas del Modulo de Calidad por ID, nombre del asesor, fecha de la llamada y telefono. El
// telefono solo lo ven y lo buscan CALIDAD, SUPERVISOR, Reportes y el administrador: la pagina lo
// revisa por rol y el servidor nunca manda el campo a los demas. Datos SINTETICOS.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { request, app, tokenFor, MASTER_PASSWORD } = require('./helpers');
const L = require('../../public/js/calidad-listas-logic.js');
const { puedeVerTelefono } = require('../auth');

const H = (t) => ({ Authorization: 'Bearer ' + t });
const PUB = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'public', f), 'utf8');
const hoy = new Date().toISOString().slice(0, 10);
const TEL = '3000000348';
const tok = {};

const m = { id: 77, idLlamada: "'CONN-A-901", asesor: 'Ásesor Fíctício Uno', fecha: '2026-11-05', fechaLlamada: '2026-11-02', telefono: TEL };

test('C2: busca por ID (sin el apostrofo de Wolkvox), asesor sin tildes ni mayusculas', () => {
  const c = L.clCamposMonitoreo(m);
  assert.equal(L.clCoincide(c, 'conn-a-9'), true);
  assert.equal(L.clCoincide(c, "'CONN-A-901"), true);
  assert.equal(L.clCoincide(c, 'asesor ficticio'), true);
  assert.equal(L.clCoincide(c, 'FICTICIO UNO'), true);
  assert.equal(L.clCoincide(c, 'otra persona'), false);
  assert.equal(L.clCoincide(c, '   '), true, 'sin busqueda: todo');
});

test('C2: busca por fecha de la llamada o del monitoreo, como se escriba', () => {
  const c = L.clCamposMonitoreo(m);
  for (const q of ['02/11', '2/11', '02/11/2026', '2026-11-02', '05/11', '5/11/2026', '2026-11-05']) assert.equal(L.clCoincide(c, q), true, q);
  assert.equal(L.clCoincide(c, '07/11'), false);
  assert.deepEqual(L.clFechaVariantes('2026-11-05 09:10'), ['2026-11-05', '05/11/2026', '5/11/2026', '05/11', '5/11', '5/11', '05-11-2026']);
});

test('C2: el telefono solo se busca con permiso y con 3 o mas cifras', () => {
  const c = L.clCamposMonitoreo(m);
  assert.equal(L.clCoincide(c, '0000348'), false, 'sin permiso no busca por telefono');
  assert.equal(L.clCoincide(c, '0000348', { telefono: true }), true);
  assert.equal(L.clCoincide(c, '300 000 0348', { telefono: true }), true);
  assert.equal(L.clCoincide(c, '34', { telefono: true }), false, 'menos de 3 cifras no cuenta');
  const e = L.clCamposEncuesta({ connId: 'X-1', agente: 'Agente Ficticio', fecha: '2026-11-03', telefono: TEL, monitoreo: { fecha: '2026-11-09' } });
  assert.equal(L.clCoincide(e, '9/11'), true);
  assert.equal(L.clCoincide(e, TEL), false);
  assert.equal(L.clCoincide(e, TEL, { telefono: true }), true);
  assert.equal(L.clFiltrar([m, { asesor: 'Otro' }], 'otro', L.clCamposMonitoreo).length, 1);
});

test('C2: los roles que buscan telefono son los mismos de puedeVerTelefono del servidor', () => {
  for (const rol of ['CALIDAD', 'SUPERVISOR', 'REPORTES', 'GERENCIA', 'ASESOR', 'CLIENTES_DASH', 'LIDER']) {
    assert.equal(L.clPuedeBuscarTelefono({ rol }, false), puedeVerTelefono({ rol, perms: {} }), rol);
  }
  assert.equal(L.clPuedeBuscarTelefono(null, true), true, 'administrador');
  assert.equal(L.clPuedeBuscarTelefono(null, false), false);
});

before(async () => {
  tok.admin = await tokenFor('admin', MASTER_PASSWORD);
  const crear = async (user, rol, perms) => {
    const r = await request(app).post('/api/users').set(H(tok.admin)).send(Object.assign({ nombre: 'Persona Ficticia ' + user, user, password: 'Clave#Fase348x', rol, perms }));
    assert.equal(r.status, 201, JSON.stringify(r.body));
    tok[rol] = await tokenFor(user, 'Clave#Fase348x');
  };
  await crear('rep348', 'REPORTES', { Calidad: true, campana_MOBILIZE: true });
  await crear('ger348', 'GERENCIA', { Calidad: true, campana_MOBILIZE: true });
  await crear('cli348', 'CLIENTES_DASH', { ClientesDash: true, cliente_MOBILIZE: true });
  const r = await request(app).post('/api/monitoreos').set(H(tok.admin)).send({ campana: 'MOBILIZE', asesor: 'Asesor Ficticio 348', fecha: hoy, canal: 'LLAMADA', idLlamada: 'LLAM-348', telefono: TEL, answers: { 1: 'SI' }, observaciones: 'Observacion ficticia 348' });
  assert.equal(r.status, 201, JSON.stringify(r.body));
});

test('C2 (servidor): GET /monitoreos manda el telefono solo a quien califica; a los demas, sin el campo', async () => {
  const lista = async (t) => (await request(app).get('/api/monitoreos?campana=MOBILIZE').set(H(t))).body;
  const deAdmin = (await lista(tok.admin)).find((x) => x.idLlamada === 'LLAM-348');
  assert.equal(deAdmin.telefono, TEL);
  const deCal = (await lista(tok.REPORTES)).find((x) => x.idLlamada === 'LLAM-348');
  assert.equal(deCal.telefono, TEL);
  for (const rol of ['GERENCIA', 'CLIENTES_DASH']) {
    const r = await request(app).get('/api/monitoreos?campana=MOBILIZE').set(H(tok[rol]));
    if (r.status !== 200) continue; // sin acceso a la lista: tampoco ve el telefono
    const x = r.body.find((y) => y.idLlamada === 'LLAM-348');
    if (x) assert.equal(Object.prototype.hasOwnProperty.call(x, 'telefono'), false, rol);
    assert.ok(!JSON.stringify(r.body).includes(TEL), rol);
  }
});

test('C2: las tres listas usan el buscador comun, con el telefono atado al servidor y al rol', () => {
  const ui = PUB('js/calidad-listas.js');
  assert.match(ui, /clPuedeBuscarTelefono\(/);
  assert.match(ui, /hasOwnProperty\.call\(x, 'telefono'\)/, 'solo si el servidor lo mando');
  const cal = PUB('js/calidad.js');
  assert.match(cal, /clBuscar\('mon', arr, clCamposMonitoreo, conTelBusca\)/);
  assert.match(PUB('index.html'), /id="cal-monitoreos-buscar"/);
  const ana = PUB('js/calidad-analisis.js');
  assert.match(ana, /clBuscar\('det', delMes, clCamposMonitoreo, conTel\)/);
  assert.doesNotMatch(ana, /detalleTexto/);
  const cen = PUB('js/calidad-encuestas.js');
  assert.match(cen, /var conTel = !!d\.verTelefono && clBuscaTelefono\(d\.filas\)/);
  assert.match(cen, /clBuscar\(idLista, d\.filas, clCamposEncuesta, conTel\)/);
});
