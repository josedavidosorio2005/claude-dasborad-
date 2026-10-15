// fase144-a1-trafico-rango-mes.test.js — Fase 144 (A1, hallazgo D03 de la
// Fase 143). Los paneles de Trafico (ORLANT Llamadas, ORLANT WhatsApp,
// Mobilize Flujo de Llamadas) mostraban el rango del mes elegido SOLO en el
// primer dibujo: un clic en la misma pestaña, ir y volver o reabrir el
// tablero volvia al rango de TODOS los datos, sin aviso, bajo un encabezado
// que seguia diciendo el mes. Estas pruebas fijan la decision pura del rango
// (traficoDecidirRango) en la secuencia real de dibujos, y que los dos
// archivos de panel la usan.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { traficoDecidirRango, traficoRangoTexto, traficoFinDeMes } = require('../../public/js/trafico-logic.js');

const PUBLIC_JS = path.join(__dirname, '..', '..', 'public', 'js');
const MIN = '2026-04-01';
const MAX = '2026-09-12';
const URL_VACIA = { skills: null, desde: '', hasta: '', granularidad: 'mes', combinar: true };

// Simula al panel: guarda en "memoria" lo mismo que guardan trafico.js /
// trafico-whatsapp.js entre un dibujo y el siguiente.
function panel() {
  const mem = { mesSincronizado: undefined, estado: null, sinDatos: undefined };
  return function dibujar(mesSel, tieneDatosMes, estadoURL) {
    const d = traficoDecidirRango({
      mesSel, mesSincronizado: mem.mesSincronizado, estadoPrevio: mem.estado,
      sinDatosPrevio: mem.sinDatos, estadoURL: estadoURL || URL_VACIA,
      minDisp: MIN, maxDisp: MAX, tieneDatosMes,
    });
    if (d.sincronizar) mem.mesSincronizado = mesSel;
    mem.sinDatos = d.sinDatosMes;
    mem.estado = d.estado;
    return { d, mem };
  };
}

test('traficoFinDeMes: ultimo dia real del mes (30/31/28/29)', () => {
  assert.equal(traficoFinDeMes('2026-09'), '2026-09-30');
  assert.equal(traficoFinDeMes('2026-08'), '2026-08-31');
  assert.equal(traficoFinDeMes('2026-02'), '2026-02-28');
  assert.equal(traficoFinDeMes('2028-02'), '2028-02-29');
});

test('mes con datos: el rango termina en el mes elegido en el 1.er, 2.º y n-esimo dibujo (el bug D03)', () => {
  const dibujar = panel();
  for (let n = 1; n <= 4; n++) {
    const { d } = dibujar('2026-08', true);
    assert.equal(d.estado.hasta, '2026-08-31', `dibujo ${n}: hasta`);
    assert.equal(d.estado.desde, MIN, `dibujo ${n}: desde (ventana recortada al primer dato)`);
    assert.equal(d.sinDatosMes, false);
  }
});

test('mes sin datos: el aviso se mantiene en los dibujos siguientes (antes desaparecia y salian 6 meses)', () => {
  const dibujar = panel();
  for (let n = 1; n <= 3; n++) {
    const { d } = dibujar('2026-10', false);
    assert.equal(d.sinDatosMes, true, `dibujo ${n}`);
    assert.equal(d.estado.hasta, '2026-10-31');
  }
});

test('cambiar de mes manda: un mes nuevo recalcula la ventana y apaga el aviso si tiene datos', () => {
  const dibujar = panel();
  dibujar('2026-10', false);
  const { d } = dibujar('2026-09', true);
  assert.equal(d.sinDatosMes, false);
  assert.equal(d.estado.hasta, '2026-09-30');
  assert.equal(d.origen, 'mes');
});

test('rango puesto a mano (Fase 77) se respeta en los dibujos siguientes, y el mes nuevo lo reemplaza', () => {
  const dibujar = panel();
  const { mem } = dibujar('2026-08', true);
  // "Aplicar filtros": el panel guarda en memoria el rango manual.
  mem.estado = Object.assign({}, mem.estado, { desde: '2026-09-01', hasta: '2026-09-30' });
  for (let n = 1; n <= 3; n++) {
    const { d } = dibujar('2026-08', true);
    assert.deepEqual([d.estado.desde, d.estado.hasta], ['2026-09-01', '2026-09-30'], `dibujo ${n}`);
    assert.equal(d.origen, 'previo');
  }
  const { d } = dibujar('2026-07', true);
  assert.equal(d.estado.hasta, '2026-07-31');
});

test('sin mes global: URL primero; si no trae fechas, la ventana por defecto de 12 meses (comportamiento de siempre)', () => {
  const conURL = traficoDecidirRango({ mesSel: null, estadoURL: Object.assign({}, URL_VACIA, { desde: '2026-05-01', hasta: '2026-06-30' }), minDisp: MIN, maxDisp: MAX });
  assert.deepEqual([conURL.estado.desde, conURL.estado.hasta, conURL.origen], ['2026-05-01', '2026-06-30', 'url']);
  const def = traficoDecidirRango({ mesSel: null, estadoURL: URL_VACIA, minDisp: MIN, maxDisp: MAX });
  assert.deepEqual([def.estado.desde, def.estado.hasta, def.origen], [MIN, MAX, 'defecto']);
});

test('skills/granularidad del estado anterior se conservan al cambiar de mes', () => {
  const dibujar = panel();
  const { mem } = dibujar('2026-08', true);
  mem.estado.skills = ['ORLANT 3P'];
  mem.estado.granularidad = 'dia';
  const { d } = dibujar('2026-06', true);
  assert.deepEqual(d.estado.skills, ['ORLANT 3P']);
  assert.equal(d.estado.granularidad, 'dia');
});

test('traficoDecidirRango no muta los objetos que recibe', () => {
  const previo = { desde: '2026-01-01', hasta: '2026-01-31', skills: ['A'] };
  const copia = JSON.parse(JSON.stringify(previo));
  traficoDecidirRango({ mesSel: '2026-03', mesSincronizado: '2026-01', estadoPrevio: previo, estadoURL: URL_VACIA, minDisp: MIN, maxDisp: MAX, tieneDatosMes: true });
  assert.deepEqual(previo, copia);
});

test('traficoRangoTexto: el mes en letras (Fase 147, pedido de Edwin)', () => {
  assert.equal(traficoRangoTexto('2026-04-01', '2026-09-30'), 'Mostrando: 1 abr 2026 – 30 sep 2026');
  assert.equal(traficoRangoTexto('', null), 'Mostrando: — – —');
});

test('trafico.js y trafico-whatsapp.js deciden el rango con traficoDecidirRango en cada dibujo y muestran el subtitulo', () => {
  for (const [archivo, pref] of [['trafico.js', 'tv'], ['trafico-whatsapp.js', 'tww']]) {
    const src = fs.readFileSync(path.join(PUBLIC_JS, archivo), 'utf8');
    assert.match(src, /traficoDecidirRango\(\{/, archivo + ': usa la decision pura');
    assert.doesNotMatch(src, /if\(_gd\.mesSel && _trafico(Wpp)?MesSincronizado\[[a-zA-Z]+\] !== _gd\.mesSel\)\{/, archivo + ': ya no sincroniza solo una vez');
    assert.match(src, new RegExp("class=\"trafico-rango\" id=\"" + pref + "-rango-'\\+i\\+'\""), archivo + ': subtitulo con el rango');
    assert.match(src, new RegExp("getElementById\\('" + pref + "-rango-'\\+i\\)"), archivo + ': subtitulo se actualiza al aplicar filtros');
  }
});
