// fase214-ranking-con-salida.test.js — Fase 214, punto 1 (pedido de Edwin, 29/10, solo ORLANT).
// Un usuario de agosto tenia 505 llamadas + 628 WhatsApp en el CDR (1.133) y el
// ranking le daba 205: solo contaba el ingreso. Ahora:
//   - contestadas = TODO el CDR del asesor (ingreso + salida, llamadas y
//     WhatsApp), con ingreso y salida aparte;
//   - quien pasa del 100 % sigue en el ranking con `sobreWolkvox` y no deforma
//     la escala del % (eaTechoPct);
//   - los agentes del CDR sin usuario en la Clasificacion de usuarios van
//     aparte, con "OTROS".
// Datos SIEMPRE inventados.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { request, app, tokenFor, MASTER_PASSWORD, db } = require('./helpers');
const L = require('../../public/js/efectividad-agendamiento-logic.js');

const auth = (t) => ({ Authorization: `Bearer ${t}` });

test('ranking ORLANT: ingreso + salida, marca de mas del 100 % y agentes sin usuario aparte', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  await request(app).put('/api/calidad/agendas/codigos-entidad').set(auth(admin)).send({ campana: 'ORLANT', codigos: [{ codigo: 'EPSG', linea: 'GENERAL' }] });
  const u = await request(app).put('/api/calidad/agendas/usuarios').set(auth(admin)).send({ campana: 'ORLANT', usuarios: [
    { usuario: 'A1', asesor: 'Asesora Salida' },
    { usuario: 'A2', asesor: 'Asesor Mucho Agenda' },
    { usuario: 'A3', asesor: 'Asesora Sin Agendas' },
  ] });
  assert.equal(u.status, 200, JSON.stringify(u.body));
  const fila = (us, dia) => [us, '01', 'EX', 'ESP', 'PROF', '2026-06-' + dia + ' 09:00:00', 'EPSG', 'ENT'];
  const filas = [];
  for (let k = 1; k <= 6; k++) filas.push(fila('A1', '0' + k));
  for (let k = 1; k <= 5; k++) filas.push(fila('A2', '1' + k));
  const c = await request(app).post('/api/calidad/agendas/carga').set(auth(admin)).send({ campana: 'ORLANT', formato: 'cruda', filas });
  assert.equal(c.status, 201, JSON.stringify(c.body));

  const ins = db.prepare(`INSERT INTO tipificaciones (campana, canal, agente, fecha, tipificacion, skill, tipoInteraccion, createdAt)
    VALUES ('ORLANT', ?, ?, '2026-06-10', 'X', ?, ?, '2026-06-29T00:00:00Z')`);
  const n = (veces, ...args) => { for (let k = 0; k < veces; k++) ins.run(...args); };
  // Asesora Salida: 1 llamada de ingreso + 5 de salida; 2 WhatsApp de ingreso + 4 de salida = 12.
  n(1, 'LLAMADAS', 'ASESORA SALIDA', '4060 AGENDAMIENTO', 'inbound');
  n(5, 'LLAMADAS', 'ASESORA SALIDA', '-', 'outbound_ma');
  n(2, 'WHATSAPP', 'Asesora Salida', 'WHATSAPP ORLANT GENERAL', 'inbound');
  n(4, 'WHATSAPP', 'Asesora Salida', 'WHATSAPP ORLANT GENERAL', 'outbound_ma');
  // Asesor Mucho Agenda: 2 contactos para 5 agendas (250 %).
  n(1, 'LLAMADAS', 'ASESOR MUCHO AGENDA', '-', 'outbound_ma');
  n(1, 'WHATSAPP', 'ASESOR MUCHO AGENDA', 'WHATSAPP ORLANT GENERAL', 'inbound');
  // Con usuario y sin agendas: sigue en el ranking (0 %). Sin usuario: aparte.
  n(3, 'LLAMADAS', 'ASESORA SIN AGENDAS', '4060 AGENDAMIENTO', 'inbound');
  n(7, 'WHATSAPP', 'AGENTE APOYO WOLKVOX', 'WHATSAPP ORLANT GENERAL', 'outbound_ma');

  const r = await request(app).get('/api/calidad/efectividad-agendamiento/ranking?campana=ORLANT&meses=2026-06').set(auth(admin));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const por = Object.fromEntries(r.body.filas.map((f) => [f.asesor.toUpperCase(), f]));
  const s = por['ASESORA SALIDA'];
  assert.deepEqual([s.llamadas, s.whatsapp, s.ingreso, s.salida, s.gestiones, s.agendas], [6, 6, 3, 9, 12, 6]);
  assert.equal(s.efectividad, 0.5);
  assert.equal(s.sobreWolkvox, false);
  const m = por['ASESOR MUCHO AGENDA'];
  assert.deepEqual([m.gestiones, m.agendas, m.efectividad, m.sobreWolkvox], [2, 5, 2.5, true]);
  assert.equal(m.puesto, 1, 'sigue en el ranking');
  assert.deepEqual([por['ASESORA SIN AGENDAS'].gestiones, por['ASESORA SIN AGENDAS'].efectividad], [3, 0]);
  assert.ok(!por['AGENTE APOYO WOLKVOX']);
  assert.deepEqual(r.body.aparte, [{ asesor: 'AGENTE APOYO WOLKVOX', agendas: 0, gestiones: 7, sinUsuario: true }]);
  assert.deepEqual(r.body.equipo, { gestiones: 17, agendas: 11, efectividad: 11 / 17 });
});

test('eaTechoPct: los de mas del 100 % no deforman la escala del %', () => {
  const f = (e) => ({ efectividad: e });
  // Normales hasta 69,8 % -> techo 80; los de 9.712 % y 305 % quedan en 80.
  const filas = [f(97.125), f(0.698), f(0.42), f(3.05), f(null)];
  assert.equal(L.eaTechoPct(filas), 80);
  assert.deepEqual(filas.map((x) => L.eaPctEnEscala(x, 80)), [80, 69.8, 42, 80, null]);
  assert.equal(L.eaTechoPct([f(1)]), 110, '100 % exacto cabe');
  assert.equal(L.eaTechoPct([f(2)]), 10, 'sin normales, techo minimo');
  assert.equal(L.EA_MARCA_WOLKVOX, 'agenda más de lo que registra Wolkvox');
});

test('panel y export: ingreso/salida, marca ⚠ con texto, % real en cifra y tooltip, sin usuario en la nota', () => {
  const ea = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'efectividad-agendamiento.js'), 'utf8');
  assert.ok(ea.includes('<th class="ea-col-contactos" hidden>Ingreso</th><th class="ea-col-contactos" hidden>Salida</th>'));
  assert.ok(ea.includes("'<td>'+gdFmtValor(f.ingreso)+'</td><td>'+gdFmtValor(f.salida)+'</td>'"));
  assert.ok(ea.includes("(f.sobreWolkvox ? ' <span class=\"ea-marca-wolkvox\">⚠ '+EA_MARCA_WOLKVOX+'</span>' : '')"));
  assert.ok(ea.includes('o.scales.y2.max = techo;'));
  assert.ok(ea.includes("return f && f.sobreWolkvox ? '⚠ ' + pctReal(ctx.dataIndex)"));
  assert.ok(ea.includes("(f && f.sobreWolkvox ? ' ⚠ ' + EA_MARCA_WOLKVOX : '')"), 'tooltip y Ver datos con el % real');
  assert.match(ea, /de ingreso y de salida, del CDR de Tipificación/);
  assert.match(ea, /contestadas, sin usuario de Agendamiento/);
  const gen = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'dashboard-generic.js'), 'utf8');
  assert.ok(gen.includes("Ingreso: f.ingreso, Salida: f.salida, 'Contestadas (ingreso + salida)': f.gestiones }, f.agendas, efectividadAgendamientoFmtPct(f.efectividad), f.sobreWolkvox ? EA_MARCA_WOLKVOX : '')"));
  assert.ok(gen.includes("a.sinUsuario ? 'agente de Wolkvox sin usuario de Agendamiento' : ''"));
});
