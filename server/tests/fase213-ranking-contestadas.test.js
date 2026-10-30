// fase213-ranking-contestadas.test.js — Fase 213 (pedido de Edwin, 29/10, solo ORLANT).
// Ranking de asesores = agendas del asesor / contestadas del asesor (llamadas
// + WhatsApp del CDR de Tipificacion; Fase 214: ingreso + salida). El asesor de cada agenda sale
// de la Clasificacion de usuarios con su fecha de cambio (un usuario que pasa a
// otra persona el 07/10 reparte sus agendas); "OTROS" va aparte. El archivo
// EFECTIVIDAD_AGENDAMIENTO no se borra. Datos SIEMPRE inventados.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, tokenFor, MASTER_PASSWORD, db } = require('./helpers');

const auth = (t) => ({ Authorization: `Bearer ${t}` });

test('ORLANT: ranking por contestadas, cambio de usuario por fecha, OTROS aparte y alias', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  await request(app).put('/api/calidad/agendas/codigos-entidad').set(auth(admin)).send({ campana: 'ORLANT', codigos: [{ codigo: 'EPSG', linea: 'GENERAL' }] });
  const u = await request(app).put('/api/calidad/agendas/usuarios').set(auth(admin)).send({ campana: 'ORLANT', usuarios: [
    { usuario: 'U1', asesor: 'Persona Uno' },
    { usuario: 'U8', asesor: 'Persona Antes' },
    { usuario: 'U8', asesor: 'Persona Despues', fechaCambio: '2026-10-07' },
    { usuario: 'U9', asesor: 'OTROS' },
  ] });
  assert.equal(u.status, 200, JSON.stringify(u.body));
  const fila = (us, dia) => [us, '01', 'EX', 'ESP', 'PROF', '2026-10-' + dia + ' 09:00:00', 'EPSG', 'ENT'];
  const filas = [fila('U1', '01'), fila('U1', '02'), fila('U1', '03'), fila('U8', '05'), fila('U8', '06'), fila('U8', '08'), fila('U9', '09')];
  const c = await request(app).post('/api/calidad/agendas/carga').set(auth(admin)).send({ campana: 'ORLANT', formato: 'cruda', filas });
  assert.equal(c.status, 201, JSON.stringify(c.body));

  // CDR: ingreso (skill distinto de "-") y salida (skill "-") de llamadas; WhatsApp de ingreso y de salida.
  const ins = db.prepare(`INSERT INTO tipificaciones (campana, canal, agente, fecha, tipificacion, skill, tipoInteraccion, createdAt)
    VALUES ('ORLANT', ?, ?, ?, 'X', ?, ?, '2026-10-29T00:00:00Z')`);
  for (let k = 0; k < 4; k++) ins.run('LLAMADAS', 'PERSONA UNO', '2026-10-02', '4060 AGENDAMIENTO', 'inbound');
  ins.run('LLAMADAS', 'PERSONA UNO', '2026-10-02', '-', 'out_pre'); // salida: cuenta desde la Fase 214
  for (let k = 0; k < 2; k++) ins.run('WHATSAPP', 'Persona Uno', '2026-10-03', 'WHATSAPP ORLANT GENERAL', 'inbound');
  ins.run('WHATSAPP', 'Persona Uno', '2026-10-03', 'WHATSAPP ORLANT GENERAL', 'outbound_ma'); // salida: cuenta desde la Fase 214
  for (let k = 0; k < 4; k++) ins.run('LLAMADAS', 'PERSONA ANTES', '2026-10-05', '4060 AGENDAMIENTO', 'inbound');
  ins.run('LLAMADAS', 'Persona Despues Alias', '2026-10-08', '4060 AGENDAMIENTO', 'inbound');
  ins.run('LLAMADAS', 'PERSONA UNO', '2026-09-30', '4060 AGENDAMIENTO', 'inbound'); // otro mes
  await request(app).post('/api/alias-asesores').set(auth(admin)).send({ campana: 'ORLANT', alias: 'Persona Despues Alias', canonico: 'Persona Despues' });

  const op = await request(app).get('/api/calidad/efectividad-agendamiento/opciones?campana=ORLANT').set(auth(admin));
  assert.ok(op.body.meses.includes('2026-10'));
  const r = await request(app).get('/api/calidad/efectividad-agendamiento/ranking?campana=ORLANT&meses=2026-10').set(auth(admin));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.fuente, 'contactos');
  const por = Object.fromEntries(r.body.filas.map((f) => [f.asesor.toUpperCase(), f]));
  assert.deepEqual([por['PERSONA UNO'].llamadas, por['PERSONA UNO'].whatsapp, por['PERSONA UNO'].gestiones, por['PERSONA UNO'].agendas], [5, 3, 8, 3]);
  assert.deepEqual([por['PERSONA UNO'].ingreso, por['PERSONA UNO'].salida], [6, 2]);
  assert.equal(por['PERSONA UNO'].efectividad, 3 / 8);
  // U8 pasa a otra persona el 07/10: 2 agendas antes, 1 desde ese dia.
  assert.deepEqual([por['PERSONA ANTES'].agendas, por['PERSONA ANTES'].gestiones], [2, 4]);
  assert.deepEqual([por['PERSONA DESPUES'].agendas, por['PERSONA DESPUES'].gestiones], [1, 1], 'el alias cruza el nombre del CDR');
  assert.equal(por['PERSONA DESPUES'].puesto, 1);
  assert.equal(por['PERSONA DESPUES'].sobreWolkvox, false, '100 % exacto no lleva la marca');
  // OTROS aparte, fuera del ranking y del total del equipo.
  assert.ok(!por.OTROS);
  assert.deepEqual(r.body.aparte, [{ asesor: 'OTROS', agendas: 1 }]);
  assert.deepEqual(r.body.equipo, { gestiones: 13, agendas: 6, efectividad: 6 / 13 });
});

test('el panel muestra Contestadas (Fase 219: sin la nota larga) y el export lo trae', () => {
  const fs = require('fs');
  const path = require('path');
  const js = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'efectividad-agendamiento.js'), 'utf8');
  assert.match(js, /thG\.textContent = contactos \? 'Contestadas' : 'Gestiones';/);
  // Fase 219 (pedido de Edwin): sin el parrafo de debajo de las tarjetas; OTROS sigue aparte en el Excel.
  assert.doesNotMatch(js, /El total del equipo no cuadra exacto con Efectividad de Citas|' Fuera del ranking: '/);
  // Fase 214: contestadas = ingreso + salida.
  assert.match(js, /label: contactos \? 'Contestadas \(ingreso \+ salida\)' : 'Gestiones'/);
  const gen = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'dashboard-generic.js'), 'utf8');
  assert.match(gen, /'Contestadas \(ingreso \+ salida\)': f\.gestiones/);
  assert.match(gen, /' \(fuera del ranking\)'/);
});
