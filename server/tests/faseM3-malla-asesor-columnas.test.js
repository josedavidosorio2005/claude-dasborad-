// faseM3-malla-asesor-columnas.test.js — pedido de Edwin (27/11/2026): en «Mi malla» de la asesora («Esta semana»)
// el horario iba pegado a las pausas («08:30 – 17:30Pausa 10:30–10:45 · Almuerzo…»). Ahora: columnas con encabezado
// Horario | Pausa 1 | Almuerzo | Pausa 2 y una línea vertical suave; en descanso, «Descanso» en Horario y lo demás
// vacío; en el celular, el horario y debajo una pausa por línea. «Puntual» y las novedades igual. Datos INVENTADOS.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

global.esc = require('../../public/js/esc.js').esc;
const L = require('../../public/js/malla-logic.js');
Object.assign(global, L);
const UI = require('../../public/js/malla.js');

const DIA = (x) => Object.assign({ entrada: '08:30', salida: '17:30', almuerzo: '12:30', almuerzoMin: 60 }, x || {});
const HOR = { 1: DIA({ pausa1: '10:30', pausa1Min: 15, pausa2: '15:30', pausa2Min: 10 }), 2: DIA({ pausa1: '10:30', pausa1Min: 15 }), 3: null, 4: DIA(), 5: DIA(), 6: null, 7: null };

test('partes del día y columnas de la semana (solo las que existen, en orden)', () => {
  assert.deepEqual(L.mallaPausasPartes(HOR[1]).map((x) => [x.etq, x.txt]), [['Pausa 1', '10:30–10:45'], ['Almuerzo', '12:30–13:30'], ['Pausa 2', '15:30–15:40']]);
  assert.deepEqual(L.mallaPausasPartes(null), []);
  assert.deepEqual(L.mallaColsPausaSemana(HOR).map((c) => c.etq), ['Pausa 1', 'Almuerzo', 'Pausa 2']);
  assert.deepEqual(L.mallaColsPausaSemana({ 1: DIA(), 2: null }).map((c) => c.etq), ['Almuerzo']);
  assert.deepEqual(L.mallaColsPausaSemana({ 1: { entrada: '07:00', salida: '16:00' } }), []);
});

test('«Mi malla»: Horario | Pausa 1 | Almuerzo | Pausa 2; descanso solo en Horario; puntualidad al final', () => {
  const html = UI.mallaMiaHtml({ semanas: [{ semana: '2031-03-03', turno: { grupo: 'Grupo <inventado>', horario: HOR, especiales: [], festivos: {}, color: 1 }, novedades: [] }] });
  assert.match(html, /<thead><tr><th scope="col">Día<\/th><th scope="col">Horario<\/th><th scope="col" class="ml-mia-pz">Pausa 1<\/th><th scope="col" class="ml-mia-pz">Almuerzo<\/th><th scope="col" class="ml-mia-pz">Pausa 2<\/th><th scope="col"><span class="sr-only">Puntualidad<\/span><\/th><\/tr><\/thead>/);
  assert.ok(html.includes('<td>08:30 – 17:30</td><td class="ml-mia-pz" data-etq="Pausa 1">10:30–10:45</td><td class="ml-mia-pz" data-etq="Almuerzo">12:30–13:30</td><td class="ml-mia-pz" data-etq="Pausa 2">15:30–15:40</td><td class="ml-punt-celda"></td>'));
  // martes sin pausa 2: celda vacía; miércoles de descanso: «Descanso» y las demás vacías.
  assert.ok(html.includes('data-etq="Almuerzo">12:30–13:30</td><td class="ml-mia-pz ml-mia-pz-vacia" data-etq="Pausa 2"></td>'));
  assert.ok(html.includes('<td>Descanso</td><td class="ml-mia-pz ml-mia-pz-vacia" data-etq="Pausa 1"></td><td class="ml-mia-pz ml-mia-pz-vacia" data-etq="Almuerzo"></td><td class="ml-mia-pz ml-mia-pz-vacia" data-etq="Pausa 2"></td><td class="ml-punt-celda"></td>'));
  assert.doesNotMatch(html, /ml-mia-pausas|<inventado>/);
});

test('estilos: línea vertical suave entre columnas y, en el celular, una pausa por línea sin desbordar', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'css', 'styles.css'), 'utf8');
  assert.match(css, /\.ml-tabla-mia \.ml-mia-pz\{border-left:1px solid var\(--c-border-soft\);/);
  assert.match(css, /@media \(max-width:600px\)\{\n  \.ml-tabla-mia thead\{[^}]*\}\n  \.ml-tabla-mia,\.ml-tabla-mia tbody,\.ml-tabla-mia tr,\.ml-tabla-mia th,\.ml-tabla-mia td\{display:block;width:auto\}/);
  assert.match(css, /\.ml-tabla-mia td\.ml-mia-pz::before\{content:attr\(data-etq\) ": ";/);
  assert.match(css, /\.ml-tabla-mia td\.ml-mia-pz-vacia\{display:none\}/);
});
