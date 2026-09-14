// util.js — Helpers compartidos del seed de demo: PRNG determinista, fechas y
// redondeo. El PRNG esta seedeado por una clave de texto (no por Math.random)
// para que, cuando una entidad ya esta marcada (seedOnce la salta), los
// numeros que HABRIAN salido para ella sean siempre los mismos — reproducible,
// util para depurar y para los tests que comparan valores.
'use strict';

// Los 6 meses de historico pedidos (2026-04 a 2026-09). HOY es el ultimo.
const MESES = ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'];
const HOY = new Date('2026-09-14T00:00:00Z');

function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// mulberry32: PRNG rapido y determinista a partir de un seed de 32 bits.
function rngFromSeed(seedStr) {
  let a = fnv1a(String(seedStr)) || 1;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Entero uniforme en [min, max] usando un rand() de rngFromSeed.
function randInt(rand, min, max) {
  return Math.floor(rand() * (max - min + 1)) + min;
}

// Float uniforme en [min, max], redondeado a `dec` decimales.
function randFloat(rand, min, max, dec) {
  const n = rand() * (max - min) + min;
  const p = Math.pow(10, dec === undefined ? 1 : dec);
  return Math.round(n * p) / p;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function daysInMonth(mesKey) {
  const [y, m] = mesKey.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

// Dias del mes ya "transcurridos" en el demo: el mes completo si es anterior
// al mes actual (HOY), o hasta ayer si es el mes en curso — asi no se generan
// datos operativos en fechas futuras respecto a HOY.
function diasGenerables(mesKey) {
  const total = daysInMonth(mesKey);
  const esMesActual = mesKey === MESES[MESES.length - 1];
  if (!esMesActual) return total;
  const ayer = HOY.getUTCDate() - 1;
  return Math.max(1, Math.min(total, ayer));
}

// Fraccion del mes ya transcurrida (para escalar totales mensuales del mes en
// curso y que no salga un mes "completo" con solo la mitad de los dias).
function progresoMes(mesKey) {
  return diasGenerables(mesKey) / daysInMonth(mesKey);
}

function fechaISO(mesKey, dia) {
  const d = String(dia).padStart(2, '0');
  return `${mesKey}-${d}`;
}

// 0=domingo...6=sabado, calculado en UTC para no depender de zona horaria local.
function diaSemana(mesKey, dia) {
  const [y, m] = mesKey.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, dia)).getUTCDay();
}

function esFinDeSemana(mesKey, dia) {
  const dw = diaSemana(mesKey, dia);
  return dw === 0 || dw === 6;
}

function esSabado(mesKey, dia) {
  return diaSemana(mesKey, dia) === 6;
}

// Todos los sabados generables de un mes (para las secciones "sabados").
function sabadosDelMes(mesKey) {
  const out = [];
  const gen = diasGenerables(mesKey);
  for (let d = 1; d <= gen; d++) {
    if (esSabado(mesKey, d)) out.push(d);
  }
  return out;
}

module.exports = {
  MESES,
  HOY,
  rngFromSeed,
  randInt,
  randFloat,
  round2,
  daysInMonth,
  diasGenerables,
  progresoMes,
  fechaISO,
  diaSemana,
  esFinDeSemana,
  esSabado,
  sabadosDelMes,
};
