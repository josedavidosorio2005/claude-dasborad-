// fase163-nivel-servicio.test.js — Fase 163, punto 2 (reunion con Edwin,
// 21/10). Son dos indicadores distintos:
// - Nivel de atencion = contestadas / ingresadas (no cambia).
// - Nivel de servicio = promedio SIMPLE de la columna SERVICE_LEVEL_20SEC
//   del reporte de Wolkvox, de las filas (skill-dia) que entran en el
//   filtro: por dia y skill, el valor del reporte; en el mes, el promedio de
//   esas filas. Las filas sin dato no cuentan; las de 0 % si.
// Caso real (forma del archivo de agosto de Mobilize, 17 filas, cada una con
// SL 0 % o 100 %): 15 de 17 en 100 % -> 88,24 %, no 95,52 % (que era el
// ponderado por llamadas e igual al nivel de atencion).
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const T = require('../../public/js/trafico-logic.js');

// 17 filas skill-dia con la misma forma que el archivo real (sin sus datos):
// 2 dias con SL 0 % (1 y 2 ingresadas, ninguna contestada) y 15 con 100 %.
function filasMobilize() {
  const f = [];
  const conCien = [1, 3, 1, 6, 2, 8, 4, 10, 4, 6, 8, 4, 1, 3, 3];
  conCien.forEach((n, i) => f.push({ fecha: '2026-08-' + String(11 + i).padStart(2, '0'), skillName: i < 3 ? 'SKILL B' : 'SKILL A', totalLlamadas: n, contestadas: n, serviceLevel20secPct: 100 }));
  f.push({ fecha: '2026-08-11', skillName: 'SKILL A', totalLlamadas: 1, contestadas: 0, serviceLevel20secPct: 0 });
  f.push({ fecha: '2026-08-30', skillName: 'SKILL A', totalLlamadas: 2, contestadas: 0, serviceLevel20secPct: 0 });
  return f;
}

test('tarjeta del mes: promedio simple de las 17 filas = 88,24 %, distinto del nivel de atencion', () => {
  const filas = filasMobilize();
  assert.equal(filas.length, 17);
  assert.equal(T.traficoServiceLevelPromedioPeriodo(filas, 'serviceLevel20secPct'), 88.24);
  const ing = filas.reduce((a, f) => a + f.totalLlamadas, 0);
  const con = filas.reduce((a, f) => a + f.contestadas, 0);
  assert.equal(T.traficoPctAtencionAbandono(ing, con, ing - con).nivelAtencionPct, 95.52, 'el nivel de atencion no cambia');
});

test('grafica por mes, por dia y por skill: el mismo promedio simple', () => {
  const filas = filasMobilize();
  const mes = T.traficoAgregar(filas, { granularidad: 'mes', combinar: true });
  assert.equal(mes.length, 1);
  assert.equal(mes[0].serviceLevel20secPct, 88.24);
  assert.equal(mes[0].nivelAtencionPct, 95.52);

  const porSkill = T.traficoAgregar(filas, { granularidad: 'mes', combinar: false });
  const a = porSkill.find((x) => x.skillName === 'SKILL A');
  assert.equal(a.serviceLevel20secPct, Math.round((12 * 100 / 14) * 100) / 100, 'SKILL A: 12 filas en 100 % y 2 en 0 %');
  assert.equal(porSkill.find((x) => x.skillName === 'SKILL B').serviceLevel20secPct, 100);

  // Por dia: con una sola fila, el valor del reporte tal cual; con dos skills el mismo dia, el promedio de las dos.
  const dia = T.traficoAgregar(filas, { granularidad: 'dia', combinar: true });
  assert.equal(dia.find((x) => x.periodo === '2026-08-30').serviceLevel20secPct, 0);
  const d11 = dia.find((x) => x.periodo === '2026-08-11');
  assert.equal(d11.serviceLevel20secPct, 50, 'el 11: una fila en 100 % y otra en 0 %');
});

test('filas sin dato no cuentan; las de 0 % si', () => {
  const filas = [
    { fecha: '2026-08-01', skillName: 'A', totalLlamadas: 100, contestadas: 90, serviceLevel20secPct: 80 },
    { fecha: '2026-08-02', skillName: 'A', totalLlamadas: 900, contestadas: 900, serviceLevel20secPct: null },
    { fecha: '2026-08-03', skillName: 'A', totalLlamadas: 5, contestadas: 0, serviceLevel20secPct: 0 },
  ];
  assert.equal(T.traficoServiceLevelPromedioPeriodo(filas, 'serviceLevel20secPct'), 40);
  assert.equal(T.traficoAgregar(filas, { granularidad: 'mes' })[0].serviceLevel20secPct, 40);
  assert.equal(T.traficoServiceLevelPromedioPeriodo([filas[1]], 'serviceLevel20secPct'), null, 'sin ninguna fila con dato: sin dato');
});

test('los tiempos siguen ponderados como antes (ASA/AHT por contestadas, ATA por abandonadas)', () => {
  const filas = [
    { fecha: '2026-08-01', skillName: 'A', totalLlamadas: 10, contestadas: 10, llamadasAbandonadas: 0, asaSegundos: 10, serviceLevel20secPct: 100 },
    { fecha: '2026-08-02', skillName: 'A', totalLlamadas: 40, contestadas: 30, llamadasAbandonadas: 10, asaSegundos: 30, serviceLevel20secPct: 50 },
  ];
  const m = T.traficoAgregar(filas, { granularidad: 'mes' })[0];
  assert.equal(m.asaSegundos, 25, '(10*10 + 30*30) / 40');
  assert.equal(m.serviceLevel20secPct, 75);
});

// La nota "?" de la grafica de nivel de servicio de Llamadas ya no puede
// decir "ponderado por llamadas". AHT/ASA y WhatsApp siguen ponderados, asi
// que su nota no cambia.
test('nota de la grafica y de la tarjeta: Llamadas dice promedio simple; AHT y WhatsApp siguen ponderados', () => {
  const fs = require('fs');
  const path = require('path');
  const vm = require('vm');
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'trafico.js'), 'utf8');
  const ctx = { esc: (s) => String(s), console };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  const tituloNota = (html) => (html.match(/<span title="([^"]*)"/) || [])[1];
  const slLlamadas = tituloNota(ctx._traficoSubtabContentHTML('tv', 0, 'sl'));
  assert.match(slLlamadas, /Promedio simple de la columna SERVICE_LEVEL_20SEC/);
  assert.doesNotMatch(slLlamadas, /ponderado por/i);
  assert.match(tituloNota(ctx._traficoSubtabContentHTML('tv', 0, 'aht')), /ponderado por volumen de llamadas/);
  assert.match(tituloNota(ctx._traficoSubtabContentHTML('tww', 0, 'sl')), /ponderado por volumen/);
  // La tarjeta "Nivel de servicio (20 s)" de Llamadas tampoco dice ponderado.
  const nota = src.match(/nivelServicioMetrica: 'service_level',\s*nivelServicioNota: '([^']*)'/)[1];
  assert.match(nota, /Promedio simple de la columna SERVICE_LEVEL_20SEC/);
  assert.doesNotMatch(nota, /ponderado por el total/);
});
