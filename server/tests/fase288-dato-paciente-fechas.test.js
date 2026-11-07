// fase288-dato-paciente-fechas.test.js — Fase 288 (revision del 07/11, hallazgo #11):
// una fecha («15-10-2026», «2026-10-15», con o sin hora) no es un dato de paciente, y el
// mensaje dice que numero se rechazo. Textos INVENTADOS.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { app, request, tokenFor, MASTER_PASSWORD } = require('./helpers');
const D = require('../datos-paciente');

const H = (t) => ({ Authorization: 'Bearer ' + t });

test('las fechas pasan; documentos y telefonos no (tambien junto a una fecha)', () => {
  for (const t of ['Cita del 15-10-2026 mal agendada', 'cita 2026-10-15 10:30', '15 10 2026', '15.10.2026', '15/10/2026', '1-2-2026', 'ID 4062 y 4063', '']) {
    assert.equal(D.datoPacienteEncontrado(t), null, t);
  }
  const casos = { 'cédula 1036555777': '1036555777', 'Llamar al 300 123 4567': '300 123 4567', 'doc 1.036.555.777': '1.036.555.777',
    'el 2026-10-15 llamó al 3001234567': '3001234567', 'número 99-99-2026': '99-99-2026' };
  for (const [t, n] of Object.entries(casos)) assert.equal(D.datoPacienteEncontrado(t), n, t);
});

test('el mensaje dice el campo y el numero rechazado', () => {
  const m = D.mensajeDatoPaciente('La observación', 'Paciente con cédula 1036555777');
  assert.match(m, /^La observación tiene «1036555777»/);
  assert.match(m, /datos de pacientes/);
});

test('Errores y monitoreos: la fecha con guiones se guarda; el documento se rechaza con el numero en el mensaje', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const ok = await request(app).post('/api/calidad/errores').set(H(admin)).send({ campana: 'CLINICA AURORA', mes: '2026-10', asesor: 'Asesora Inventada', observacion: 'Cita del 15-10-2026 en la sede equivocada' });
  assert.equal(ok.status, 201, JSON.stringify(ok.body));
  const malo = await request(app).post('/api/calidad/errores').set(H(admin)).send({ campana: 'CLINICA AURORA', mes: '2026-10', asesor: 'Asesora Inventada', observacion: 'Paciente 1036 555 777' });
  assert.equal(malo.status, 400);
  assert.match(malo.body.error, /«1036 555 777»/);
  const answers = Object.fromEntries(Array.from({ length: 17 }, (_, i) => [String(i + 1), 'SI']));
  const base = { campana: 'ORLANT', asesor: 'Asesor Inventado', fecha: '2026-10-15', answers };
  assert.equal((await request(app).post('/api/monitoreos').set(H(admin)).send({ ...base, observaciones: 'Llamada del 2026-10-15 10:30, bien.' })).status, 201);
  const m = await request(app).post('/api/monitoreos').set(H(admin)).send({ ...base, observaciones: 'Llamar al 3001234567' });
  assert.equal(m.status, 400);
  assert.match(m.body.error, /^La observación tiene «3001234567»/);
});
