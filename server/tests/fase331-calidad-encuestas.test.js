// fase331-calidad-encuestas.test.js — Fase 331 (pedido del supervisor, Mobilize): las
// llamadas con la encuesta mal calificada se escuchan y califican en Calidad. Una fila
// por llamada (CONN_ID), bloqueo "la esta calificando otra persona", un solo monitoreo
// por llamada (lo rechaza el servidor) y el monitoreo queda marcado como de encuesta.
// Datos SINTETICOS (nombres e IDs inventados, sin telefonos).
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');
const encMon = require('../encuesta-monitoreo');

const H = (t) => ({ Authorization: 'Bearer ' + t });
const PW = 'Clave#Fase331x';
const hoy = new Date().toISOString().slice(0, 10);
let admin, evA, evB, evOrlant, sup, reportes, asesor, cliente;

async function crear(user, rol, perms, extra) {
  const r = await request(app).post('/api/users').set(H(admin)).send(Object.assign({ nombre: 'Persona Ficticia ' + user, user, password: PW, rol, perms }, extra));
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return { id: r.body.id, nombre: 'Persona Ficticia ' + user, token: await tokenFor(user, PW) };
}

// [fecha, agente, skill, q1, q2, q3, q4, comentario, connId]
const FILAS = [
  ['2025-03-03', 'Asesor Ficticio Uno', 'SKILL X', 3, 2, 2, null, '', 'CONN-A'], // falla P1, P2 y P3
  ['2025-03-04', 'Asesor Ficticio Dos', 'SKILL X', 9, 5, 1, 5, '', 'CONN-B'], // bien
  ['2025-03-05', 'Asesor Ficticio Dos', 'SKILL X', 6, null, null, 3, '', 'CONN-C'], // solo P4 (6 en P1 no es mala)
  ['2025-03-06', 'Asesor Ficticio Uno', 'SKILL X', 5, null, null, null, '', ''], // mala pero sin ID
  ['2025-03-07', 'Asesor Ficticio Uno', 'SKILL X', null, null, null, null, '', 'CONN-E'], // no contesto
  ['2025-03-08', 'Asesor Ficticio Tres', 'SKILL X', 0, 4, 1, 4, '', 'CONN-F'], // P1 = 0 (borde)
];
const cargar = () => request(app).post('/api/calidad/encuestas/carga').set(H(admin)).send({ campana: 'MOBILIZE', archivoNombre: 'sintetico-331.xlsx', filas: FILAS });
const lista = (tok, q) => request(app).get('/api/calidad/encuestas/monitoreo').query(Object.assign({ campana: 'MOBILIZE' }, q || {})).set(H(tok));
const bloquear = (tok, connId) => request(app).post('/api/calidad/encuestas/monitoreo/bloqueo').set(H(tok)).send({ campana: 'MOBILIZE', connId });
const liberar = (tok, connId) => request(app).post('/api/calidad/encuestas/monitoreo/liberar').set(H(tok)).send({ campana: 'MOBILIZE', connId });
const guardar = (tok, extra) => request(app).post('/api/monitoreos').set(H(tok)).send(Object.assign({ campana: 'MOBILIZE', asesor: 'Asesor Ficticio Uno', fecha: hoy, canal: 'LLAMADA', answers: { 1: 'SI' }, observaciones: 'Observación ficticia 331' }, extra));

before(async () => {
  admin = await tokenFor('admin', MASTER_PASSWORD);
  evA = await crear('ev331a', 'CALIDAD', { Calidad: true, campana_MOBILIZE: true });
  evB = await crear('ev331b', 'CALIDAD', { Calidad: true, campana_MOBILIZE: true });
  evOrlant = await crear('ev331o', 'CALIDAD', { Calidad: true, campana_ORLANT: true });
  sup = await crear('sup331', 'SUPERVISOR', { campana_MOBILIZE: true, cliente_MOBILIZE: true });
  reportes = await crear('rep331', 'REPORTES', { Calidad: true, campana_MOBILIZE: true });
  asesor = await crear('as331', 'ASESOR', {}, { asesorCampana: 'MOBILIZE' });
  cliente = await crear('cli331', 'CLIENTES_DASH', { ClientesDash: true, cliente_MOBILIZE: true });
  const c = await cargar();
  assert.equal(c.status, 201, JSON.stringify(c.body));
});

test('reglas: sembradas solo para MOBILIZE y configurables por pregunta (no fijas en el codigo)', () => {
  assert.deepEqual(encMon.reglasDe(db, 'MOBILIZE').map((r) => [r.pregunta, r.min, r.max]), [['q1', 0, 5], ['q2', 1, 3], ['q3', 2, 2], ['q4', 1, 3]]);
  assert.deepEqual(encMon.reglasDe(db, 'ORLANT'), []);
  assert.deepEqual(encMon.fallasDeFila({ q1: 7, q2: 3, q3: 1, q4: 4 }, encMon.reglasDe(db, 'MOBILIZE')), [{ pregunta: 'q2', valor: 3 }]);
  // Otra regla en la tabla cambia el resultado sin tocar el codigo.
  const reglas = [{ pregunta: 'q1', min: 0, max: 6 }];
  assert.deepEqual(encMon.fallasDeFila({ q1: 6 }, reglas), [{ pregunta: 'q1', valor: 6 }]);
});

test('lista: una fila por llamada con todas sus preguntas falladas; sin ID aparte; contador', async () => {
  const r = await lista(evA.token);
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.activa, true);
  assert.equal(r.body.puedeCalificar, true);
  assert.equal(r.body.bloqueoMinutos, 15);
  assert.deepEqual(r.body.filas.map((f) => f.connId), ['CONN-F', 'CONN-C', 'CONN-A'], 'mas reciente primero, sin las buenas ni las sin contestar');
  const a = r.body.filas.find((f) => f.connId === 'CONN-A');
  assert.deepEqual(a.fallas, [{ pregunta: 'q1', valor: 3 }, { pregunta: 'q2', valor: 2 }, { pregunta: 'q3', valor: 2 }], 'una sola fila aunque fallo 3 preguntas');
  assert.equal(a.fecha, '2025-03-03');
  assert.equal(a.agente, 'Asesor Ficticio Uno');
  assert.equal(a.estado, 'pendiente');
  assert.equal(a.monitoreo, null);
  assert.deepEqual(r.body.conteo, { pendientes: 3, resueltas: 0, sinId: 1 });
  assert.ok(!JSON.stringify(r.body).match(/tel[eé]fono|"ani"/i), 'sin telefonos');
  const n = await request(app).get('/api/calidad/encuestas/monitoreo/conteo').query({ campana: 'MOBILIZE' }).set(H(evB.token));
  assert.deepEqual(n.body, { activa: true, pendientes: 3 });
  const o = await request(app).get('/api/calidad/encuestas/monitoreo/conteo').query({ campana: 'ORLANT' }).set(H(admin));
  assert.deepEqual(o.body, { activa: false, pendientes: 0 }, 'ORLANT no tiene esta funcion');
});

test('filtro por pregunta (boton Monitoreo de la Encuesta) y por mes', async () => {
  const q4 = await lista(admin, { pregunta: 'q4', estado: 'todas' });
  assert.deepEqual(q4.body.filas.map((f) => f.connId), ['CONN-C']);
  const q1 = await lista(admin, { pregunta: 'q1', estado: 'todas' });
  assert.deepEqual(q1.body.filas.map((f) => f.connId), ['CONN-F', 'CONN-A']);
  assert.equal(q1.body.filas.find((f) => f.connId === 'CONN-A').fallas.length, 3, 'muestra todas las preguntas que fallo');
  const otroMes = await lista(admin, { meses: '2025-04' });
  assert.deepEqual(otroMes.body.filas, []);
  const mes = await lista(admin, { meses: '2025-03' });
  assert.equal(mes.body.filas.length, 3);
});

test('acceso: equipo de Calidad de MOBILIZE si; asesor, cliente y Calidad de otra campaña no', async () => {
  for (const u of [sup, reportes]) assert.equal((await lista(u.token)).status, 200, u.nombre);
  assert.equal((await lista(reportes.token)).body.puedeCalificar, false, 'Reportes ve la lista pero no califica');
  assert.equal((await bloquear(reportes.token, 'CONN-C')).status, 403);
  for (const u of [asesor, cliente, evOrlant]) {
    assert.equal((await lista(u.token)).status, 403, u.nombre);
    assert.equal((await request(app).get('/api/calidad/encuestas/monitoreo/conteo').query({ campana: 'MOBILIZE' }).set(H(u.token))).status, 403);
    assert.equal((await bloquear(u.token, 'CONN-C')).status, 403);
  }
  assert.equal((await guardar(cliente.token, { encuestaConnId: 'CONN-C' })).status, 403);
});

test('bloqueo: otra persona no puede abrirla ni guardarla; se libera al cancelar o al vencer', async () => {
  const b1 = await bloquear(evA.token, 'CONN-A');
  assert.equal(b1.status, 200, JSON.stringify(b1.body));
  assert.equal(b1.body.llamada.connId, 'CONN-A');
  assert.equal(b1.body.bloqueo.propio, true);
  const b2 = await bloquear(evB.token, 'CONN-A');
  assert.equal(b2.status, 409);
  assert.equal(b2.body.error, 'La está calificando otra persona');
  assert.equal(b2.body.bloqueadoPor, evA.nombre);
  const vistaB = (await lista(evB.token)).body.filas.find((f) => f.connId === 'CONN-A');
  assert.deepEqual([vistaB.bloqueo.nombre, vistaB.bloqueo.propio], [evA.nombre, false]);
  const g = await guardar(evB.token, { encuestaConnId: 'CONN-A' });
  assert.equal(g.status, 409, 'el servidor tambien lo rechaza al guardar');
  assert.equal((await bloquear(evA.token, 'CONN-A')).status, 200, 'el dueño renueva');
  assert.equal((await liberar(evB.token, 'CONN-A')).status, 409, 'no se libera el de otro');
  assert.equal((await liberar(evA.token, 'CONN-A')).body.liberado, true);
  assert.equal((await bloquear(evB.token, 'CONN-A')).status, 200, 'cancelado: ya la abre otra persona');
  // Vencido: queda libre para los demas.
  db.prepare("UPDATE encuesta_monitoreo_bloqueos SET expira = ? WHERE campana = 'MOBILIZE' AND connId = 'CONN-A'").run(Date.now() - 1000);
  assert.equal((await bloquear(evA.token, 'CONN-A')).status, 200, 'vencido: la abre otra persona');
  assert.equal(encMon.BLOQUEO_MS, 15 * 60 * 1000);
  assert.equal((await bloquear(evA.token, 'CONN-B')).status, 404, 'una llamada bien calificada no se abre');
  assert.equal((await bloquear(evA.token, 'NO-EXISTE')).status, 404);
});

test('guardar: monitoreo marcado como de encuesta, sale de pendientes para todos, segundo monitoreo 409', async () => {
  // evA tiene el bloqueo de CONN-A (prueba anterior).
  const g = await guardar(evA.token, { encuestaConnId: 'CONN-A' });
  assert.equal(g.status, 201, JSON.stringify(g.body));
  assert.equal(g.body.origen, 'encuesta');
  assert.equal(g.body.encuestaConnId, 'CONN-A');
  assert.equal(g.body.idLlamada, 'CONN-A', 'el ID de la llamada queda en el monitoreo');
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM encuesta_monitoreo_bloqueos WHERE connId = 'CONN-A'").get().n, 0, 'guardar libera el bloqueo');
  for (const u of [evA, evB, sup]) {
    const p = await lista(u.token);
    assert.ok(!p.body.filas.some((f) => f.connId === 'CONN-A'), 'ya no esta en pendientes para ' + u.nombre);
    assert.deepEqual(p.body.conteo, { pendientes: 2, resueltas: 1, sinId: 1 });
  }
  const res = await lista(evB.token, { estado: 'resueltas' });
  assert.equal(res.body.filas.length, 1);
  const f = res.body.filas[0];
  assert.equal(f.estado, 'resuelta');
  assert.equal(f.monitoreo.id, g.body.id);
  assert.equal(f.monitoreo.observaciones, 'Observación ficticia 331');
  assert.equal(f.monitoreo.evaluador, evA.nombre);
  assert.equal(typeof f.monitoreo.puntaje, 'number');
  const otra = await guardar(evB.token, { encuestaConnId: 'CONN-A' });
  assert.equal(otra.status, 409);
  assert.equal(otra.body.error, 'Esa llamada ya fue calificada');
  const b = await bloquear(evB.token, 'CONN-A');
  assert.equal(b.status, 409);
  assert.equal(b.body.resuelta, true);
  // El indice unico es la ultima defensa (dos guardados a la vez).
  assert.throws(() => db.prepare("INSERT INTO monitoreos (campana, asesor, fecha, mes, evaluador, answers, createdAt, encuestaConnId) VALUES ('MOBILIZE', 'x', '2025-03-03', '2025-03', 'x', '{}', 'x', 'CONN-A')").run(), /UNIQUE/);
  // Sin bloqueo previo tambien se puede (si nadie mas la tiene abierta).
  const c = await guardar(evB.token, { encuestaConnId: 'CONN-C' });
  assert.equal(c.status, 201, JSON.stringify(c.body));
  assert.equal((await guardar(evB.token, { encuestaConnId: 'CONN-B' })).status, 400, 'una llamada bien calificada no se monitorea por aqui');
  assert.equal((await guardar(evB.token, { encuestaConnId: 'NO-EXISTE' })).status, 400);
});

test('volver a subir el mes de encuestas no pierde el vinculo (es por CONN_ID, no por id de fila)', async () => {
  const antes = db.prepare("SELECT id FROM encuestas WHERE connId = 'CONN-A'").get().id;
  assert.equal((await cargar()).status, 201);
  const despues = db.prepare("SELECT id FROM encuestas WHERE connId = 'CONN-A'").get().id;
  assert.notEqual(antes, despues, 'la recarga cambia el id de la fila');
  const r = await lista(admin, { estado: 'todas' });
  assert.equal(r.body.filas.find((f) => f.connId === 'CONN-A').estado, 'resuelta');
  assert.deepEqual(r.body.conteo, { pendientes: 1, resueltas: 2, sinId: 1 });
});

test('monitoreos de siempre: igual que antes (origen manual, sin encuesta); los de encuesta se distinguen', async () => {
  const m = await guardar(evA.token, {});
  assert.equal(m.status, 201, JSON.stringify(m.body));
  assert.equal(m.body.origen, 'manual');
  assert.equal(m.body.encuestaConnId, null);
  // Fase 334: el evaluador ve solo lo suyo; el consolidado se pide como administrador.
  const todos = (await request(app).get('/api/monitoreos?campana=MOBILIZE').set(H(admin))).body;
  assert.equal(todos.filter((x) => x.origen === 'encuesta').length, 2);
  assert.ok(todos.some((x) => x.origen === 'manual'));
  // La carga masiva no acepta el vinculo (no viene de encuestas).
  assert.equal(require('../validation').schemas.monitoreoBulkBody.safeParse({ campana: 'MOBILIZE', filas: [{ asesor: 'x', fecha: '2025-03-03', answers: { 1: 'SI' }, encuestaConnId: 'CONN-F' }] }).data.filas[0].encuestaConnId, undefined);
});
