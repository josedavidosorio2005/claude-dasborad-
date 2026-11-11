// fase331-pr4-boton-monitoreo.test.js — Fase 331 (PR 4): boton "Monitoreo" en cada pregunta de
// la pestaña Encuesta del dashboard de Mobilize. Muestra las llamadas que calificaron mal ESA
// pregunta con el resultado de su monitoreo; una llamada que fallo varias preguntas muestra el
// MISMO monitoreo en todas. Solo lectura, con los filtros del panel; la cuenta de cliente no lo
// ve. Datos SINTETICOS.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { request, app, tokenFor, MASTER_PASSWORD } = require('./helpers');

const H = (t) => ({ Authorization: 'Bearer ' + t });
const PUB = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'public', f), 'utf8');
const PW = 'Clave#Fase331p4';
const hoy = new Date().toISOString().slice(0, 10);
let admin, cliente, sup;
const lista = (tok, q) => request(app).get('/api/calidad/encuestas/monitoreo').query(Object.assign({ campana: 'MOBILIZE', estado: 'todas' }, q)).set(H(tok));

async function crear(user, rol, perms) {
  const r = await request(app).post('/api/users').set(H(admin)).send({ nombre: 'Persona Ficticia ' + user, user, password: PW, rol, perms });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return tokenFor(user, PW);
}

before(async () => {
  admin = await tokenFor('admin', MASTER_PASSWORD);
  cliente = await crear('cli331p4', 'CLIENTES_DASH', { ClientesDash: true, cliente_MOBILIZE: true });
  sup = await crear('sup331p4', 'SUPERVISOR', { campana_MOBILIZE: true, cliente_MOBILIZE: true });
  const c = await request(app).post('/api/calidad/encuestas/carga').set(H(admin)).send({ campana: 'MOBILIZE', filas: [
    ['2025-01-06', 'Asesor Ficticio Uno', 'SKILL A', 2, 5, 2, 5, '', 'CONN-P4-A', '09:00'], // falla P1 y P3
    ['2025-01-07', 'Asesor Ficticio Dos', 'SKILL B', 1, 5, 1, 5, '', 'CONN-P4-B', '10:00'], // falla P1
    ['2025-01-08', 'Asesor Ficticio Dos', 'SKILL A', 9, 5, 2, 5, '', 'CONN-P4-C', '11:00'], // falla P3
  ] });
  assert.equal(c.status, 201, JSON.stringify(c.body));
  const g = await request(app).post('/api/monitoreos').set(H(admin)).send({ campana: 'MOBILIZE', asesor: 'Asesor Ficticio Uno', fecha: hoy, canal: 'LLAMADA', answers: { 1: 'SI' }, observaciones: 'Observación ficticia P4', encuestaConnId: 'CONN-P4-A' });
  assert.equal(g.status, 201, JSON.stringify(g.body));
});

test('una llamada que fallo P1 y P3 muestra el MISMO monitoreo en las dos preguntas', async () => {
  const p1 = (await lista(sup, { pregunta: 'q1', meses: '2025-01' })).body.filas;
  const p3 = (await lista(sup, { pregunta: 'q3', meses: '2025-01' })).body.filas;
  assert.deepEqual(p1.map((f) => [f.connId, f.estado]), [['CONN-P4-B', 'pendiente'], ['CONN-P4-A', 'resuelta']]);
  assert.deepEqual(p3.map((f) => [f.connId, f.estado]), [['CONN-P4-C', 'pendiente'], ['CONN-P4-A', 'resuelta']]);
  const a1 = p1.find((f) => f.connId === 'CONN-P4-A');
  const a3 = p3.find((f) => f.connId === 'CONN-P4-A');
  assert.deepEqual(a1.monitoreo, a3.monitoreo);
  assert.equal(a1.monitoreo.observaciones, 'Observación ficticia P4');
});

test('mismos filtros del panel: skill y asesor', async () => {
  const s = (await lista(admin, { pregunta: 'q1', meses: '2025-01', skill: 'SKILL B' })).body.filas;
  assert.deepEqual(s.map((f) => f.connId), ['CONN-P4-B']);
  const a = (await lista(admin, { pregunta: 'q3', meses: '2025-01', agente: 'Asesor Ficticio Dos' })).body.filas;
  assert.deepEqual(a.map((f) => f.connId), ['CONN-P4-C']);
});

test('la cuenta de cliente no lo ve: 403 en el servidor y el navegador ni lo pide', async () => {
  assert.equal((await lista(cliente, { pregunta: 'q1' })).status, 403);
  assert.equal((await request(app).get('/api/calidad/encuestas/monitoreo/conteo').query({ campana: 'MOBILIZE' }).set(H(cliente))).status, 403);
  const js = PUB('js/encuesta-monitoreo.js');
  assert.ok(js.includes("if (typeof currentUser !== 'undefined' && currentUser && currentUser.rol === 'CLIENTES_DASH') return false;"));
  // Probado de verdad: con rol de cliente no hay boton ni peticion.
  let pedidas = 0;
  const ctx = { currentUser: { rol: 'CLIENTES_DASH' }, apiRequest: async () => { pedidas++; return { activa: true }; }, document: { addEventListener() {} }, esc: (x) => String(x) };
  vm.createContext(ctx);
  vm.runInContext(js, ctx);
  return ctx.encMonCargarAcceso('MOBILIZE').then((ok) => { assert.equal(ok, false); assert.equal(pedidas, 0); });
});

test('solo lectura y cableado: boton por pregunta, dialogo registrado (Escape y foco), sin escrituras', async () => {
  const js = PUB('js/encuesta-monitoreo.js');
  assert.ok(!/apiRequest\('(POST|PUT|DELETE)'/.test(js), 'no toma bloqueos ni guarda nada');
  assert.ok(js.includes("'&estado=todas&pregunta='"), 'pendientes y resueltas');
  assert.ok(!/tel[eé]fono\b(?![s ]\.?$)/i.test(js.replace('Sin telefonos.', '')), 'sin telefono');
  const enc = PUB('js/encuesta.js');
  assert.ok(enc.includes("var monOk = typeof encMonCargarAcceso === 'function' ? await encMonCargarAcceso(campana) : false;"));
  assert.ok(enc.includes('var mon = monOk ? encMonBotonHtml(q, i) : \'\';'));
  const html = PUB('index.html');
  assert.ok(html.includes('id="modal-encuesta-monitoreo"'));
  assert.ok(html.indexOf('<script src="js/encuesta-monitoreo.js"></script>') > html.indexOf('<script src="js/calidad-encuestas-logic.js"></script>'));
  assert.ok(PUB('js/motion-helpers.js').includes("'modal-encuesta-monitoreo': function () { if (typeof encMonCerrar === 'function') encMonCerrar(); },"));
  // Con permiso: el servidor dice activa y aparece el boton.
  let pedidas = 0;
  const ctx = { currentUser: { rol: 'SUPERVISOR' }, apiRequest: async () => { pedidas++; return { activa: true }; }, document: { addEventListener() {} }, esc: (x) => String(x) };
  vm.createContext(ctx);
  vm.runInContext(js, ctx);
  assert.equal(await ctx.encMonCargarAcceso('MOBILIZE'), true);
  await ctx.encMonCargarAcceso('MOBILIZE');
  assert.equal(pedidas, 1, 'se pregunta una sola vez por campaña');
  assert.match(ctx.encMonBotonHtml({ key: 'q2' }, 3), /class="btn-sm enc-mon-btn" data-q="q2" data-i="3"/);
});
