// semaforo-logic.test.js — cubre public/js/semaforo-logic.js (motor de color
// por umbral configurable), corriendo la MISMA logica que usa el navegador.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  semaforoColorDe,
  semaforoUmbralPara,
  semaforoMetricaKey,
  semaforoClaseCss,
  semaforoSimboloDe,
  semaforoTextoAccesibleDe,
  semaforoBadgeHtml,
} = require('../../public/js/semaforo-logic.js');

test('semaforoColorDe: mayor_es_mejor (ej. nivel de atencion, umbral 90/70)', () => {
  const u = { verde: 90, amarillo: 70, direccion: 'mayor_es_mejor' };
  assert.equal(semaforoColorDe(95, u), 'verde');
  assert.equal(semaforoColorDe(90, u), 'verde'); // el limite inclusivo cuenta como verde
  assert.equal(semaforoColorDe(80, u), 'amarillo');
  assert.equal(semaforoColorDe(70, u), 'amarillo'); // el limite inclusivo cuenta como amarillo
  assert.equal(semaforoColorDe(50, u), 'rojo');
});

test('semaforoColorDe: menor_es_mejor (ej. tasa de abandono, umbral 5/10)', () => {
  const u = { verde: 5, amarillo: 10, direccion: 'menor_es_mejor' };
  assert.equal(semaforoColorDe(2, u), 'verde');
  assert.equal(semaforoColorDe(5, u), 'verde'); // el limite inclusivo cuenta como verde
  assert.equal(semaforoColorDe(8, u), 'amarillo');
  assert.equal(semaforoColorDe(10, u), 'amarillo'); // el limite inclusivo cuenta como amarillo
  assert.equal(semaforoColorDe(15, u), 'rojo');
});

test('semaforoColorDe: sin umbral o valor invalido -> null (nunca inventa color)', () => {
  assert.equal(semaforoColorDe(90, null), null);
  assert.equal(semaforoColorDe(null, { verde: 90, amarillo: 70 }), null);
  assert.equal(semaforoColorDe(undefined, { verde: 90, amarillo: 70 }), null);
  assert.equal(semaforoColorDe('no-es-numero', { verde: 90, amarillo: 70 }), null);
  assert.equal(semaforoColorDe(NaN, { verde: 90, amarillo: 70 }), null);
});

test('semaforoColorDe: direccion por defecto es mayor_es_mejor si no se especifica', () => {
  assert.equal(semaforoColorDe(95, { verde: 90, amarillo: 70 }), 'verde');
});

test('semaforoUmbralPara: prioriza el override por campana sobre el default global', () => {
  const umbrales = [
    { metrica: 'nivel_atencion', campana: '', verde: 90, amarillo: 70, direccion: 'mayor_es_mejor' },
    { metrica: 'nivel_atencion', campana: 'HOSPITAL LA MARIA', verde: 80, amarillo: 60, direccion: 'mayor_es_mejor' },
  ];
  const global_ = semaforoUmbralPara(umbrales, 'nivel_atencion', 'ORLANT');
  assert.equal(global_.verde, 90);
  const override = semaforoUmbralPara(umbrales, 'nivel_atencion', 'HOSPITAL LA MARIA');
  assert.equal(override.verde, 80);
});

test('semaforoUmbralPara: sin fila para esa metrica -> null', () => {
  assert.equal(semaforoUmbralPara([], 'nivel_atencion', 'ORLANT'), null);
  assert.equal(
    semaforoUmbralPara([{ metrica: 'otra_metrica', campana: '', verde: 1, amarillo: 1 }], 'nivel_atencion', 'ORLANT'),
    null
  );
});

test('semaforoMetricaKey: deriva un identificador estable del titulo (minusculas, sin tildes, "_")', () => {
  assert.equal(semaforoMetricaKey('Nivel de Atencion'), 'nivel_de_atencion');
  assert.equal(semaforoMetricaKey('Nivel de Atención'), 'nivel_de_atencion');
  assert.equal(semaforoMetricaKey('% Recaudo vs meta'), 'recaudo_vs_meta');
  assert.equal(semaforoMetricaKey(''), '');
});

test('semaforoClaseCss: mapea el color a la clase CSS compartida por tarjetas y celdas', () => {
  assert.equal(semaforoClaseCss('verde'), 'kpi-green');
  assert.equal(semaforoClaseCss('amarillo'), 'kpi-org');
  assert.equal(semaforoClaseCss('rojo'), 'kpi-red');
  assert.equal(semaforoClaseCss(null), '');
});

// ═══════════════════════════════════════════════════════════
// Fase 133 (WCAG 1.4.1) — el simbolo/texto accesible NUNCA debe cambiar
// que color/clase le toca a un valor. Misma entrada -> mismo color de
// SIEMPRE (las pruebas de arriba, sin tocar) + un simbolo/texto nuevo.
// ═══════════════════════════════════════════════════════════
test('semaforoSimboloDe: 3 formas DISTINTAS entre si y del set ▲/▼ que ya usa la flecha de tendencia', () => {
  assert.equal(semaforoSimboloDe('verde'), '●');
  assert.equal(semaforoSimboloDe('amarillo'), '◆');
  assert.equal(semaforoSimboloDe('rojo'), '■');
  assert.equal(semaforoSimboloDe(null), '');
  const simbolos = ['verde', 'amarillo', 'rojo'].map(semaforoSimboloDe);
  assert.equal(new Set(simbolos).size, 3, 'los 3 simbolos deben ser distintos entre si');
  simbolos.forEach((s) => assert.ok(s !== '▲' && s !== '▼', 'no debe reusar las flechas de tendencia'));
});

test('semaforoTextoAccesibleDe: una frase en espanol por color, vacia si no hay color', () => {
  assert.equal(semaforoTextoAccesibleDe('verde'), 'Cumple la meta');
  assert.equal(semaforoTextoAccesibleDe('amarillo'), 'Cerca de la meta');
  assert.equal(semaforoTextoAccesibleDe('rojo'), 'No cumple la meta');
  assert.equal(semaforoTextoAccesibleDe(null), '');
});

test('semaforoBadgeHtml: simbolo aria-hidden + texto .sr-only, vacio sin color (nunca inventa un badge)', () => {
  const html = semaforoBadgeHtml('verde');
  assert.match(html, /aria-hidden="true"/);
  assert.match(html, /●/);
  assert.match(html, /class="sr-only"/);
  assert.match(html, /Cumple la meta/);
  assert.equal(semaforoBadgeHtml(null), '');
  assert.equal(semaforoBadgeHtml(''), '');
});

test('el simbolo/texto NUNCA cambia la clasificacion de color original (misma entrada que las pruebas de semaforoColorDe de arriba)', () => {
  const u = { verde: 90, amarillo: 70, direccion: 'mayor_es_mejor' };
  [95, 90, 80, 70, 50].forEach((valor) => {
    const colorAntes = semaforoColorDe(valor, u);
    const claseAntes = semaforoClaseCss(colorAntes);
    // Lo unico "nuevo" es el badge -- la clase sigue siendo funcion solo del color.
    assert.equal(semaforoClaseCss(semaforoColorDe(valor, u)), claseAntes);
    assert.equal(typeof semaforoBadgeHtml(colorAntes), 'string');
  });
});
