// faseN2-orlant-inbound.test.js — Fase N2 (23/11/2026, docs/orlant/nuevo-dashboard/plan.md §2–3, C3):
// entrada de llamadas del tablero nuevo de ORLANT con las MISMAS reglas que «Tráfico de Llamadas»
// (abandonadas por fila, TMO y ASA ponderados por contestadas), línea General / 3P con el «Mapa de
// skills» (sin definir y «No cuenta» aparte), variación contra el período anterior y tipificación de la
// entrada. Datos SIEMPRE inventados, en 2025 para no cruzarse con otras pruebas.
'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { db, cleanup } = require('./helpers');
const { orlantTableroDatos } = require('../orlant-tablero');
const skillLinea = require('../skill-linea');
const T = require('../../public/js/trafico-logic.js');
const front = require('../../public/js/orlant-tablero.js');

after(cleanup);
const C = 'ORLANT';
const R = { desde: '2025-03-01', hasta: '2025-04-30' };
const t = new Date().toISOString();
const S_GEN = 'SKILL INVENTADA N2 GENERAL', S_3P = 'SKILL INVENTADA N2 3P', S_SIN = 'SKILL INVENTADA N2 SIN MAPA', S_FUERA = 'SKILL INVENTADA N2 SALIDA';
const L = db.prepare(`INSERT INTO calidad_nivel_servicio_diario (campana, fecha, skillName, totalLlamadas, contestadas, contestadas20sEstimado, llamadasAbandonadas, asaSegundos, ahtSegundos, createdAt)
  VALUES (?,?,?,?,?,?,?,?,?,?)`);
// [fecha, skill, total, contestadas, ns20, abandonadas (null = no vino), asa, aht]
const FILAS = [
  ['2025-03-03', S_GEN, 100, 90, 80, 7, 10, 200],     // abandonadas del archivo: 7 (no 10)
  ['2025-03-04', S_3P, 50, 40, 30, null, 20, 300],    // sin columna: 50 − 40 = 10
  ['2025-03-05', S_SIN, 20, 20, 18, 0, null, null],   // sin AHT ni ASA: no pesan
  ['2025-04-07', S_GEN, 120, 100, 90, 15, 12, 240],
  ['2025-04-08', S_FUERA, 999, 999, 999, 0, 1, 1],    // «No cuenta»: fuera de todo
];
for (const f of FILAS) L.run(C, ...f, t);
const TP = db.prepare("INSERT INTO tipificaciones (campana, canal, agente, fecha, tipificacion, skill, createdAt) VALUES (?, 'LLAMADAS', 'ASESORA INVENTADA', ?, ?, ?, ?)");
const tip = (n, fecha, tipif, skill) => { for (let i = 0; i < n; i++) TP.run(C, fecha, tipif, skill, t); };
tip(5, '2025-03-03', 'CITA ASIGNADA INVENTADA', S_GEN);
tip(3, '2025-03-04', 'CITA ASIGNADA INVENTADA', S_3P);
tip(2, '2025-03-04', 'INFORMACIÓN INVENTADA', S_3P);
tip(4, '2025-03-04', 'SALIDA INVENTADA', '-');          // salida (Fase 183): fuera
tip(6, '2025-04-08', 'NO CUENTA INVENTADA', S_FUERA);   // skill «No cuenta»: fuera

test('sin mapa: Total igual a la pestaña «Tráfico de Llamadas» (abandonadas por fila, TMO y ASA ponderados); General y 3P avisan', () => {
  const d = orlantTableroDatos(db, Object.assign({ gran: 'mes' }, R), C);
  const ll = d.llamadas;
  assert.equal(ll.mapaVacio, skillLinea.mapa(db, C).size === 0);
  // Referencia: la función de la pestaña, con las mismas filas (sin la de «No cuenta», que aún no lo es).
  const ref = T.traficoAgregar(FILAS.map((f) => ({ fecha: f[0], skillName: f[1], totalLlamadas: f[2], contestadas: f[3], llamadasAbandonadas: f[5], asaSegundos: f[6], ahtSegundos: f[7] })), { granularidad: 'mes' });
  const refTot = { total: ref.reduce((a, x) => a + x.totalLlamadas, 0) };
  assert.equal(ll.total.recibidas, refTot.total);
  assert.equal(ll.total.abandonadas, 7 + 10 + 0 + 15 + 0, 'abandonadas: las del archivo o la resta, fila por fila');
  for (const m of ref) {
    const mio = ll.serie.find((x) => x.periodo === m.periodo);
    assert.equal(Math.round(mio.abandono * 10000) / 100, m.tasaAbandonoPct, 'abandono de ' + m.periodo + ' igual a la pestaña');
    assert.equal(Math.round(mio.tmoSegundos * 100) / 100, m.ahtSegundos, 'TMO de ' + m.periodo + ' igual al AHT de la pestaña');
    assert.equal(Math.round(mio.asaSegundos * 100) / 100, m.asaSegundos, 'ASA de ' + m.periodo + ' igual a la pestaña');
  }
  const base = { seccion: 'inbound', canal: 'llamadas', gran: 'mes', linea: 'total' };
  const c = front.otContenido(d, base);
  assert.match(c.kpis, /TMO/);
  assert.match(c.detalle, /Tipificación de la entrada/);
  if (ll.mapaVacio) assert.match(front.otContenido(d, Object.assign({}, base, { linea: '3p' })).kpis, /Todavía no hay skills con línea guardada/);
});

test('con mapa: General y 3P salen del «Mapa de skills»; «Sin definir» avisado; «No cuenta» fuera de todo', () => {
  skillLinea.guardar(db, C, [{ skill: S_GEN, linea: 'GENERAL' }, { skill: S_3P, linea: '3P' }, { skill: S_FUERA, linea: 'NO_CUENTA' }], 'Prueba N2');
  const d = orlantTableroDatos(db, Object.assign({ gran: 'mes' }, R), C);
  const ll = d.llamadas;
  assert.equal(ll.mapaVacio, false);
  assert.equal(ll.porLinea.GENERAL.total.recibidas, 220);
  assert.equal(ll.porLinea['3P'].total.recibidas, 50);
  assert.equal(ll.porLinea.SIN_DEFINIR.total.recibidas, 20);
  assert.equal(ll.total.recibidas, 290, 'Total = General + 3P + sin definir, sin «No cuenta»');
  assert.deepEqual(ll.noCuenta, { recibidas: 999, skills: 1 });
  assert.equal(ll.porLinea.GENERAL.total.tmoSegundos, (200 * 90 + 240 * 100) / 190);
  assert.equal(ll.porLinea['3P'].total.abandonadas, 10);
  assert.deepEqual(ll.porLinea.GENERAL.serie.map((x) => x.periodo), ['2025-03', '2025-04']);
  assert.equal(ll.porSkill.find((x) => x.skill === S_GEN).linea, 'GENERAL');
  const base = { seccion: 'inbound', canal: 'llamadas', gran: 'mes' };
  const g = front.otContenido(d, Object.assign({}, base, { linea: 'general' }));
  assert.match(g.kpis, />220</);
  assert.match(g.kpis, /20 llamadas son de skills «Sin definir»/);
  assert.match(g.kpis, /999 llamadas de 1 skill marcado «No cuenta» quedan fuera/);
  assert.ok(!g.detalle.includes(S_3P), 'la tabla por skill de General no muestra los de 3P');
  const tres = front.otContenido(d, Object.assign({}, base, { linea: '3p' }));
  assert.match(tres.kpis, />50</);
  skillLinea.guardar(db, C, [S_GEN, S_3P, S_FUERA].map((skill) => ({ skill, linea: null })), 'Prueba N2');
});

test('tipificación de la entrada: sin salida («-»), por línea, sin «No cuenta»; top 15 + «Otras»', () => {
  skillLinea.guardar(db, C, [{ skill: S_GEN, linea: 'GENERAL' }, { skill: S_3P, linea: '3P' }, { skill: S_FUERA, linea: 'NO_CUENTA' }], 'Prueba N2');
  const te = orlantTableroDatos(db, Object.assign({ gran: 'mes' }, R), C).tipificacionEntrada;
  assert.equal(te.total.total, 10, '5 + 3 + 2: ni la salida (4) ni «No cuenta» (6)');
  assert.deepEqual(te.total.filas.map((x) => [x.tipificacion, x.n]), [['CITA ASIGNADA INVENTADA', 8], ['INFORMACIÓN INVENTADA', 2]]);
  assert.equal(te.total.filas[0].participacion, 0.8);
  assert.deepEqual(te.porLinea['3P'].filas.map((x) => x.n), [3, 2]);
  assert.equal(te.porLinea.GENERAL.total, 5);
  assert.equal(te.noCuenta, 6);
  skillLinea.guardar(db, C, [S_GEN, S_3P, S_FUERA].map((skill) => ({ skill, linea: null })), 'Prueba N2');
  // Top 15: con 17 tipificaciones distintas, 15 + «Otras (2)».
  for (let i = 0; i < 17; i++) tip(1, '2025-05-02', 'TIP N2 ' + String(i).padStart(2, '0'), S_GEN);
  const may = orlantTableroDatos(db, { desde: '2025-05-01', hasta: '2025-05-31' }, C).tipificacionEntrada.total;
  assert.equal(may.filas.length, 16);
  assert.equal(may.filas[15].tipificacion, 'Otras (2)');
  assert.equal(may.filas[15].n, 2);
});

test('variación y formatos: % para cantidades, puntos para porcentajes; TMO en min:seg', () => {
  assert.equal(front.otVariacion(110, 100), '+10,0 %');
  assert.equal(front.otVariacion(90, 100), '−10,0 %');
  assert.equal(front.otVariacion(5, 0), '—');
  assert.equal(front.otVariacion(0.85, 0.8, 'pts'), '+5,0 pts');
  assert.equal(front.otVariacion(null, 0.8, 'pts'), '—');
  assert.equal(front.otMinSeg(245), '4:05 min');
  assert.equal(front.otMinSeg(null), '—');
  const d = orlantTableroDatos(db, Object.assign({ gran: 'mes' }, R), C);
  const c = front.otContenido(d, { seccion: 'inbound', canal: 'llamadas', gran: 'mes', linea: 'total' });
  assert.match(c.detalle, /vs\. anterior/);
  assert.match(c.detalle, /<th scope="row">Abr 2025<\/th><td>[^<]+<\/td><td>[+−]/, 'abril trae la variación contra marzo');
});
