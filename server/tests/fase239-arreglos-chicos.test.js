// fase239-arreglos-chicos.test.js — Fase 239 (pendientes técnicos que no
// dependen de Edwin): el alias de asesor también se aplica en la carga masiva
// de Calidad; sin "var" repetidos (ESLint no-redeclare de la propuesta).
// Datos SINTETICOS.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');

const auth = (t) => ({ Authorization: `Bearer ${t}` });
let admin;
const hoy = new Date().toISOString().slice(0, 10);

before(async () => {
  admin = await tokenFor('admin', MASTER_PASSWORD);
  const ahora = new Date().toISOString();
  db.prepare("INSERT INTO alias_asesores (campana, alias, canonico, createdAt) VALUES ('ORLANT', 'Asesora Sintetica B', 'Asesora Sintetica A', ?)").run(ahora);
});

test('carga masiva de Calidad: el nombre pasa por el alias de la campaña y la respuesta dice cuántos se unificaron', async () => {
  const fila = (asesor, idLlamada) => ({ asesor, fecha: hoy, canal: 'LLAMADA', idLlamada, answers: { 1: 'SI' } });
  const r = await request(app).post('/api/monitoreos/bulk').set(auth(admin)).send({
    campana: 'ORLANT', archivoNombre: 'sintetico.xlsx',
    filas: [fila('Asesora Sintetica B', 'f239-1'), fila('asesora sintetica b ', 'f239-2'), fila('Otra Persona', 'f239-3')],
  });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.insertadas, 3);
  assert.equal(r.body.filasUnificadasPorAlias, 2);
  assert.equal(r.body.asesoresUnificadosPorAlias, 1);
  const nombres = db.prepare("SELECT asesor FROM monitoreos WHERE idLlamada LIKE 'f239-%' ORDER BY idLlamada").all().map((x) => x.asesor);
  assert.deepEqual(nombres, ['Asesora Sintetica A', 'Asesora Sintetica A', 'Otra Persona']);
});

test('sin "var" repetido en buildPerms (state.js) ni en saveUserModal (users.js)', () => {
  const js = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', f), 'utf8');
  const cuerpo = (src, firma) => { const i = src.indexOf(firma); return src.slice(i, src.indexOf('\n}\n', i)); };
  assert.equal((cuerpo(js('state.js'), 'function buildPerms(').match(/\bvar p\b/g) || []).length, 1);
  assert.equal((cuerpo(js('users.js'), 'async function saveUserModal(').match(/\bvar payload\b/g) || []).length, 1);
});
