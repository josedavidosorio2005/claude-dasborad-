// fase344-telefono-calidad-encuestas.test.js — Fase 344 (pedido del usuario, 12/11): el telefono
// (ANI) de la base de Encuesta HistIVR se guarda al cargarla y sale en Calidad de encuestas
// (Pendientes, Resueltas, formulario al calificar y monitoreo guardado) SOLO para quienes califican
// (CALIDAD, SUPERVISOR, Reportes, administrador). El cliente y el asesor nunca: ni en el dashboard
// (resumen, comentarios), ni en la ventana «Monitoreo», ni en exportaciones. Sin ANI se ve «—» y se
// califica igual con el ID. Volver a subir la misma base no duplica, no pierde los monitoreos ni su
// vinculo y no cambia los pendientes. Datos SINTETICOS (telefonos inventados).
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');
const L = require('../../public/js/encuesta-logic.js');
const encMon = require('../encuesta-monitoreo');

const H = (t) => ({ Authorization: 'Bearer ' + t });
const PW = 'Clave#Fase344x';
const hoy = new Date().toISOString().slice(0, 10);
const PUB = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'public', f), 'utf8');
const TEL_A = '3000000441';
const TEL_C = '3000000443';
let admin, cal, sup, rep, ger, ases, cli;

async function crear(user, rol, perms, extra) {
  const r = await request(app).post('/api/users').set(H(admin)).send(Object.assign({ nombre: 'Persona Ficticia ' + user, user, password: PW, rol, perms }, extra || {}));
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return { id: r.body.id, token: await tokenFor(user, PW) };
}

// Archivo HistIVR sintetico: [AGENT_NAME, SKILL_NAME, DATE, Q01..Q04, VOICE_MESSAGE, CONN_ID, ANI, CUSTOMER_ID]
const CAB = ['AGENT_NAME', 'SKILL_NAME', 'DATE', 'Q01', 'Q02', 'Q03', 'Q04', 'VOICE_MESSAGE', 'CONN_ID', 'ANI', 'CUSTOMER_ID'];
const ARCHIVO = [
  CAB,
  ['Asesor Ficticio Uno', 'SKILL X', '2025-06-03 09:15', 2, 2, 2, 2, 'Comentario ficticio', 'CONN-344-A', Number(TEL_A), 'CLIENTE-344'],
  ['Asesor Ficticio Dos', 'SKILL X', '2025-06-04 10:00', 10, 5, 1, 5, '', 'CONN-344-B', '3000000442', 'CLIENTE-344'],
  ['Asesor Ficticio Dos', 'SKILL X', '2025-06-05 11:30', 1, 1, 2, 1, '', 'CONN-344-C', TEL_C, 'CLIENTE-344'],
  ['Asesor Ficticio Uno', 'SKILL X', '2025-06-06 12:00', 3, '-', '-', '-', '', 'CONN-344-D', '-', 'CLIENTE-344'], // sin ANI
];
const filas = (aoa) => L.encuestaParseFilas(aoa).filas;
const cargar = (f) => request(app).post('/api/calidad/encuestas/carga').set(H(admin)).send({ campana: 'MOBILIZE', archivoNombre: 'sintetico-344.xlsx', filas: f });
const impacto = (f) => request(app).post('/api/calidad/encuestas/carga/impacto').set(H(admin)).send({ campana: 'MOBILIZE', filas: f });
const lista = (tok, estado) => request(app).get('/api/calidad/encuestas/monitoreo').query({ campana: 'MOBILIZE', estado: estado || 'todas', desde: '2025-06-01', hasta: '2025-06-30' }).set(H(tok));
const bloquear = (tok, connId) => request(app).post('/api/calidad/encuestas/monitoreo/bloqueo').set(H(tok)).send({ campana: 'MOBILIZE', connId });
const guardar = (tok, extra) => request(app).post('/api/monitoreos').set(H(tok)).send(Object.assign({ campana: 'MOBILIZE', asesor: 'Asesor Ficticio Uno', fecha: hoy, canal: 'LLAMADA', answers: { 1: 'SI' }, observaciones: 'Observación ficticia 344' }, extra));

before(async () => {
  admin = await tokenFor('admin', MASTER_PASSWORD);
  cal = await crear('cal344', 'CALIDAD', { Calidad: true, campana_MOBILIZE: true });
  sup = await crear('sup344', 'SUPERVISOR', { campana_MOBILIZE: true, cliente_MOBILIZE: true, supervisa_MOBILIZE: true });
  rep = await crear('rep344', 'REPORTES', { Calidad: true, campana_MOBILIZE: true });
  ger = await crear('ger344', 'GERENCIA', { Calidad: true, campana_MOBILIZE: true });
  ases = await crear('as344', 'ASESOR', {}, { asesorCampana: 'MOBILIZE' });
  cli = await crear('cli344', 'CLIENTES_DASH', { ClientesDash: true, cliente_MOBILIZE: true });
});

test('lector: ANI se lee como texto en su campo (al final); "-" o sin columna = ""; CUSTOMER_ID nunca', () => {
  const f = filas(ARCHIVO);
  const iTel = L.ENCUESTA_ORDEN_ARRAY.indexOf('telefono');
  assert.equal(iTel, L.ENCUESTA_ORDEN_ARRAY.length - 1, 'al final del payload: una carga vieja sin el sigue valida');
  assert.deepEqual(f.map((x) => x[iTel]), [TEL_A, '3000000442', TEL_C, '']);
  assert.ok(!JSON.stringify(f).includes('CLIENTE-344'), 'CUSTOMER_ID nunca viaja');
  assert.equal(L.encuestaParseFilas(ARCHIVO).conTelefono, 3);
  const sinAni = filas([CAB.filter((c) => c !== 'ANI'), ['A', 'S', '2025-06-03 09:15', 2, 2, 2, 2, '', 'X']]);
  assert.equal(sinAni[0][iTel], '');
});

test('migracion: solo agrega la columna telefono (no toca filas)', () => {
  assert.ok(db.prepare('PRAGMA table_info(encuestas)').all().some((c) => c.name === 'telefono'));
  const src = fs.readFileSync(path.join(__dirname, '..', 'db.js'), 'utf8');
  const i = src.indexOf("runOnceMigration('fase344_encuestas_telefono_v1'");
  assert.ok(i > 0);
  const bloque = src.slice(i, src.indexOf('});', i));
  assert.match(bloque, /ALTER TABLE encuestas ADD COLUMN telefono TEXT NOT NULL DEFAULT ''/);
  assert.ok(!/DROP|DELETE|UPDATE|INSERT/i.test(bloque));
});

test('carga: se guarda el ANI; el dashboard (resumen, comentarios, FCR, opciones) y «Descargar lo cargado» nunca lo devuelven', async () => {
  const c = await cargar(filas(ARCHIVO));
  assert.equal(c.status, 201, JSON.stringify(c.body));
  assert.equal(db.prepare("SELECT telefono FROM encuestas WHERE campana = 'MOBILIZE' AND connId = 'CONN-344-A'").get().telefono, TEL_A);
  const q = { campana: 'MOBILIZE', desde: '2025-06-01', hasta: '2025-06-30' };
  for (const tok of [admin, cli.token, sup.token]) {
    for (const ruta of ['resumen', 'comentarios', 'fcr', 'opciones']) {
      const r = await request(app).get('/api/calidad/encuestas/' + ruta).query(ruta === 'opciones' ? { campana: 'MOBILIZE' } : q).set(H(tok));
      assert.equal(r.status, 200, ruta + ' ' + JSON.stringify(r.body));
      assert.ok(!JSON.stringify(r.body).includes(TEL_A) && !JSON.stringify(r.body).includes(TEL_C), ruta + ' no lleva telefono');
    }
  }
  const d = await request(app).get('/api/centro-cargas/MOBILIZE/encuesta/2025-06/datos').set(H(admin));
  assert.equal(d.status, 200, JSON.stringify(d.body));
  assert.ok(d.body.filas.length >= 4);
  assert.ok(!d.body.columnas.includes('telefono') && !JSON.stringify(d.body).includes(TEL_A), 'la exportacion del Centro de cargas lo excluye');
});

test('quien lo ve en Calidad de encuestas: CALIDAD, SUPERVISOR, Reportes y admin si; Gerencia no; asesor y cliente sin acceso', async () => {
  for (const tok of [admin, cal.token, sup.token, rep.token]) {
    const r = await lista(tok);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.verTelefono, true);
    const porId = Object.fromEntries(r.body.filas.map((f) => [f.connId, f.telefono]));
    assert.deepEqual([porId['CONN-344-A'], porId['CONN-344-C'], porId['CONN-344-D']], [TEL_A, TEL_C, ''], 'sin ANI = "" (se ve «—»)');
  }
  const g = await lista(ger.token);
  assert.equal(g.status, 200, JSON.stringify(g.body));
  assert.equal(g.body.verTelefono, false);
  assert.ok(g.body.filas.length && g.body.filas.every((f) => !('telefono' in f)), 'Gerencia ve la lista sin telefono');
  assert.ok(!JSON.stringify(g.body).includes(TEL_A));
  for (const tok of [ases.token, cli.token]) assert.equal((await lista(tok)).status, 403);
  // Por defecto el modulo no lo devuelve (solo si la ruta lo pide).
  assert.ok(encMon.listar(db, { campana: 'MOBILIZE', estado: 'todas' }, null).filas.every((f) => !('telefono' in f)));
});

test('calificar: el bloqueo trae el telefono para prellenarlo; al guardar sin el, se toma el ANI; el asesor y el cliente no lo reciben', async () => {
  const b = await bloquear(cal.token, 'CONN-344-A');
  assert.equal(b.status, 200, JSON.stringify(b.body));
  assert.equal(b.body.llamada.telefono, TEL_A);
  const g = await guardar(cal.token, { encuestaConnId: 'CONN-344-A', asesorUserId: undefined });
  assert.equal(g.status, 201, JSON.stringify(g.body));
  assert.equal(g.body.telefono, TEL_A, 'monitoreo guardado con el ANI');
  db.prepare('UPDATE monitoreos SET asesorUserId = ? WHERE id = ?').run(ases.id, g.body.id);
  const res = (await lista(cal.token, 'resueltas')).body.filas.find((f) => f.connId === 'CONN-344-A');
  assert.ok(res && res.estado === 'resuelta' && res.telefono === TEL_A, 'Resueltas con su telefono');
  const deCli = (await request(app).get('/api/monitoreos?campana=MOBILIZE').set(H(cli.token))).body;
  assert.ok(deCli.length && !JSON.stringify(deCli).includes(TEL_A), 'el cliente (dashboard y su exportacion) no lo recibe');
  const mios = (await request(app).get('/api/monitoreos/mios').set(H(ases.token))).body;
  assert.ok(mios.some((m) => m.id === g.body.id) && !JSON.stringify(mios).includes(TEL_A), 'el asesor no lo recibe');
  const deGer = (await request(app).get('/api/monitoreos?campana=MOBILIZE').set(H(ger.token))).body;
  assert.ok(!JSON.stringify(deGer).includes(TEL_A));
});

test('sin telefono: se bloquea y se califica igual con el ID', async () => {
  const b = await bloquear(sup.token, 'CONN-344-D');
  assert.equal(b.status, 200, JSON.stringify(b.body));
  assert.equal(b.body.llamada.telefono, '');
  const g = await guardar(sup.token, { encuestaConnId: 'CONN-344-D' });
  assert.equal(g.status, 201, JSON.stringify(g.body));
  assert.equal(g.body.telefono, '');
  assert.equal(g.body.idLlamada, 'CONN-344-D');
});

test('volver a subir la misma base: no duplica, los monitoreos y su vinculo siguen, los pendientes no cambian', async () => {
  const antes = (await lista(admin)).body;
  const total = db.prepare("SELECT COUNT(*) AS n FROM encuestas WHERE campana = 'MOBILIZE' AND fecha BETWEEN '2025-06-01' AND '2025-06-30'").get().n;
  const nMon = db.prepare("SELECT COUNT(*) AS n FROM monitoreos WHERE campana = 'MOBILIZE'").get().n;
  const imp = await impacto(filas(ARCHIVO));
  assert.equal(imp.status, 200, JSON.stringify(imp.body));
  const ce = imp.body.calidadEncuestas;
  assert.equal(ce.pendientesDespues, ce.pendientesAntes);
  assert.equal(ce.resueltasDespues, ce.resueltasAntes);
  assert.equal(ce.monitoreosSinLlamada, 0);
  assert.equal(ce.conTelefono, 3);
  assert.ok(!JSON.stringify(imp.body).includes(TEL_A), 'el impacto solo trae conteos');
  assert.equal((await cargar(filas(ARCHIVO))).status, 201);
  const despues = (await lista(admin)).body;
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM encuestas WHERE campana = 'MOBILIZE' AND fecha BETWEEN '2025-06-01' AND '2025-06-30'").get().n, total, 'no duplica');
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM monitoreos WHERE campana = 'MOBILIZE'").get().n, nMon, 'ningun monitoreo se borra');
  assert.deepEqual(despues.conteo, antes.conteo, 'pendientes y resueltas iguales');
  const est = (d) => d.filas.map((f) => [f.connId, f.estado, f.monitoreo && f.monitoreo.id]).sort();
  assert.deepEqual(est(despues), est(antes), 'cada llamada con su mismo monitoreo');
  // Un archivo al que le falta (dentro de sus fechas) una llamada ya calificada lo avisa ANTES de guardar.
  const sinA = filas(ARCHIVO.map((r) => (r[8] === 'CONN-344-A' ? r.slice(0, 8).concat(['CONN-344-Z'], r.slice(9)) : r)));
  const aviso = (await impacto(sinA)).body.calidadEncuestas;
  assert.equal(aviso.monitoreosSinLlamada, 1);
  assert.match(L.encuestaImpactoCalidadTexto(aviso, sinA.length), /ATENCIÓN: 1 monitoreo\(s\) ya hechos quedarían sin su llamada/);
  assert.match(L.encuestaImpactoCalidadTexto(ce, 4), /^Calidad de encuestas: pendientes \d+ → \d+; resueltas \d+ → \d+\.\nTeléfono \(ANI\): 3 de 4 fila\(s\)\.$/);
});

test('pantallas: Telefono con Copiar solo si el servidor lo manda; la ventana «Monitoreo» del dashboard y el panel del cliente sin telefono', () => {
  const ce = PUB('js/calidad-encuestas.js');
  assert.match(ce, /\(d\.verTelefono \? '<th>Teléfono<\/th>' : ''\)/);
  assert.match(ce, /data-que="tel" aria-label="Copiar el teléfono"/);
  assert.match(ce, /setVal\('cc2-f-telefono', ll\.telefono\)/);
  assert.match(ce, /'telefono' in ll \? '<div><dt>Teléfono<\/dt>/);
  assert.match(ce, /cen-sin-tel">—/);
  assert.ok(!/telefono/i.test(PUB('js/encuesta-monitoreo.js').replace(/\/\/.*$/gm, '')), 'la ventana «Monitoreo» del dashboard no muestra telefono');
  assert.ok(!/\.telefono/.test(PUB('js/calidad-panel.js')), 'el panel de Calidad del cliente no muestra telefono');
  assert.ok(!/\.telefono/.test(PUB('js/encuesta.js')), 'la pestaña Encuesta del dashboard (y su Excel) no muestra telefono');
  assert.match(PUB('js/calidad.js'), /hasOwnProperty\.call\(m,'telefono'\)/);
});
