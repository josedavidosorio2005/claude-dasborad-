// fase346-fecha-llamada-encuesta.test.js — Fase 346 (reunion con Edwin, 12/11; decision del usuario,
// opcion a): un monitoreo de Calidad de encuestas cuenta en el mes de la CALIFICACION (su fecha, como
// los normales), y todas las listas de Calidad muestran tambien «Llamada del DD/MM», que el servidor
// saca de la encuesta enlazada. No cambia ningun dato guardado. Datos SINTETICOS.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');
const L = require('../../public/js/calidad-equipo-logic.js');

const H = (t) => ({ Authorization: 'Bearer ' + t });
const PUB = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'public', f), 'utf8');
const hoy = new Date().toISOString().slice(0, 10);
let admin, cli, idEnc, idManual;

before(async () => {
  admin = await tokenFor('admin', MASTER_PASSWORD);
  const c = await request(app).post('/api/users').set(H(admin)).send({ nombre: 'Persona Ficticia cli346', user: 'cli346', password: 'Clave#Fase346x', rol: 'CLIENTES_DASH', perms: { ClientesDash: true, cliente_MOBILIZE: true } });
  assert.equal(c.status, 201, JSON.stringify(c.body));
  cli = await tokenFor('cli346', 'Clave#Fase346x');
  // Encuesta mal calificada del 2025-06-06 (llamada), calificada hoy.
  const filas = [['2025-06-06', 'Asesor Ficticio Uno', 'SKILL X', 2, 2, 2, 2, '', 'CONN-346-A', '09:00']];
  assert.equal((await request(app).post('/api/calidad/encuestas/carga').set(H(admin)).send({ campana: 'MOBILIZE', archivoNombre: 's346.xlsx', filas })).status, 201);
  assert.equal((await request(app).post('/api/calidad/encuestas/monitoreo/bloqueo').set(H(admin)).send({ campana: 'MOBILIZE', connId: 'CONN-346-A' })).status, 200);
  const base = { campana: 'MOBILIZE', asesor: 'Asesor Ficticio Uno', fecha: hoy, canal: 'LLAMADA', answers: { 1: 'SI' }, observaciones: 'Observacion ficticia 346' };
  const e = await request(app).post('/api/monitoreos').set(H(admin)).send(Object.assign({ encuestaConnId: 'CONN-346-A' }, base));
  assert.equal(e.status, 201, JSON.stringify(e.body));
  idEnc = e.body.id;
  const m = await request(app).post('/api/monitoreos').set(H(admin)).send(base);
  assert.equal(m.status, 201, JSON.stringify(m.body));
  idManual = m.body.id;
});

test('servidor: el de encuesta trae fechaLlamada (la de la encuesta); cuenta en el mes de su fecha (la calificacion); el manual no la trae', async () => {
  const lista = (await request(app).get('/api/monitoreos?campana=MOBILIZE').set(H(admin))).body;
  const e = lista.find((x) => x.id === idEnc), m = lista.find((x) => x.id === idManual);
  assert.equal(e.fechaLlamada, '2025-06-06');
  assert.equal(e.fecha, hoy, 'la fecha del monitoreo no cambia');
  assert.equal(e.mes, hoy.slice(0, 7), 'cuenta en el mes de la calificacion');
  assert.ok(!('fechaLlamada' in m), 'un monitoreo normal no la trae');
  // Nada se guarda: la columna no existe en la tabla.
  assert.ok(!db.prepare('PRAGMA table_info(monitoreos)').all().some((c) => c.name === 'fechaLlamada'));
});

test('el dashboard del cliente tambien la recibe (Detalle por mes / Resumen por asesor)', async () => {
  const lista = (await request(app).get('/api/monitoreos?campana=MOBILIZE').set(H(cli))).body;
  assert.ok(lista.some((x) => x.fechaLlamada === '2025-06-06'));
});

test('texto: «Llamada del DD/MM» junto a la fecha; sin fechaLlamada, solo la fecha', () => {
  assert.equal(L.ceFechaLlamadaCorta('2025-06-06'), '06/06');
  assert.equal(L.ceFechaConLlamadaHtml({ fecha: '2026-11-12', fechaLlamada: '2026-11-06' }), '2026-11-12 <span class="ce-llamada">Llamada del 06/11</span>');
  assert.equal(L.ceFechaConLlamadaHtml({ fecha: '2026-11-12' }), '2026-11-12');
});

test('las 4 listas lo usan: dashboard › Detalle por mes y Resumen por asesor, modulo › Monitoreos y Resueltas', () => {
  const panel = PUB('js/calidad-panel.js');
  assert.equal((panel.match(/ceFechaConLlamadaHtml\(m, esc\)/g) || []).length, 2);
  assert.ok(!panel.includes("esc(m.fecha || '-') + '</td>'"));
  assert.equal((PUB('js/calidad.js').match(/ceFechaConLlamadaHtml\(m,esc\)/g) || []).length, 2);
  assert.match(PUB('js/calidad-encuestas.js'), /ceFechaConLlamadaHtml\(\{ fechaLlamada: f\.fecha \}, _cenEsc, cenFecha\(mon\.fecha\)\)/);
});
