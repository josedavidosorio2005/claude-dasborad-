// fase119-zonas-horarias.test.js — Fase 119, Parte 3: confirma con
// EJECUCION real (no solo lectura de codigo) que server/fecha-limites.js
// y public/js/fecha-limites-logic.js se comportan IDENTICO bajo
// TZ=UTC y TZ=America/Bogota -- el servidor real (AWS) corre en UTC,
// los usuarios estan en Colombia; si la logica alguna vez empezara a
// depender de la zona horaria del PROCESO (en vez del offset fijo -5
// que ya usa), un cambio de entorno rompería silenciosamente los cortes
// de mes sin que ninguna prueba normal (que corre en la TZ del runner,
// siempre la misma) lo detectara.
//
// Tecnica: 2 procesos hijos reales, uno con TZ=UTC y otro con
// TZ=America/Bogota, cada uno corriendo el MISMO script inline que
// requiere los 2 modulos y imprime un JSON con los escenarios pedidos.
// Si algun dia alguien reemplaza getUTCHours()/getUTCMonth() por
// getHours()/getMonth() (sensibles a la TZ del proceso), esta prueba lo
// detecta por una diferencia real entre los 2 procesos -- no por leer el
// codigo y confiar en que nadie lo cambie.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');

const SCRIPT = `
const fl = require(${JSON.stringify(path.join(__dirname, '..', 'fecha-limites.js'))});
// Caso pedido explicitamente: un registro del 31 a las 23:30 hora Colombia.
// 23:30 Colombia (UTC-5) el dia 31 = 04:30 UTC del dia 1 siguiente.
const registro3130Colombia = new Date('2026-08-01T04:30:00.000Z'); // 2026-07-31 23:30 Colombia
// 'hoy' fijo para que el resultado no dependa del dia real. A proposito
// MUY temprano en UTC (07:00): tras el offset manual de -5h (-> 02:00 UTC
// del mismo dia), si el codigo alguna vez leyera la hora LOCAL DEL
// PROCESO en vez de UTC, un proceso con TZ=America/Bogota restaria OTRAS
// 5h y cruzaria a el dia ANTERIOR (21:00 del 14, no 02:00 del 15) --
// exactamente el escenario que esta prueba necesita para poder fallar de
// verdad si alguien rompe el offset fijo.
const ahoraFijo = new Date('2026-09-15T07:00:00.000Z');
const out = {
  tz: process.env.TZ || '(sin TZ)',
  // El registro del 31 (23:30 Colombia) sigue siendo JULIO en hora Colombia,
  // aunque en UTC ya es agosto -- se construye la fecha-hora Colombia tal
  // como la guardaria la plataforma (AAAA-MM-DD) para esa marca de tiempo.
  hoyColombiaDelRegistro: fl.fechaLimitesHoyColombia(registro3130Colombia),
  hoyColombiaDeAhoraFijo: fl.fechaLimitesHoyColombia(ahoraFijo),
  finDeMesActual: fl.fechaLimitesFinDeMesActual(ahoraFijo),
  esFuturaMesSiguiente: fl.fechaLimitesEsFutura('2026-10-01', ahoraFijo),
  esFuturaDentroDelMes: fl.fechaLimitesEsFutura('2026-09-20', ahoraFijo),
  ahoraColombiaStr: fl.fechaLimitesAhoraColombiaStr(registro3130Colombia),
};
console.log(JSON.stringify(out));
`;

function correrConTZ(tz) {
  const out = execFileSync(process.execPath, ['-e', SCRIPT], {
    env: { ...process.env, TZ: tz },
    encoding: 'utf8',
  });
  return JSON.parse(out.trim().split('\n').pop());
}

test('Fase 119 3: fecha-limites.js (server) -- TZ=UTC y TZ=America/Bogota dan EXACTAMENTE el mismo resultado', () => {
  const resUtc = correrConTZ('UTC');
  const resBogota = correrConTZ('America/Bogota');

  assert.equal(resUtc.tz, 'UTC');
  assert.equal(resBogota.tz, 'America/Bogota');

  // El registro de las 23:30 hora Colombia del 31 de julio sigue en JULIO,
  // no en agosto (aunque en UTC ya sea 1 de agosto) -- pedido explicito del
  // prompt de la Fase 119.
  assert.equal(resUtc.hoyColombiaDelRegistro, '2026-07-31');
  assert.equal(resBogota.hoyColombiaDelRegistro, '2026-07-31');

  assert.equal(resUtc.hoyColombiaDeAhoraFijo, resBogota.hoyColombiaDeAhoraFijo);
  assert.equal(resUtc.hoyColombiaDeAhoraFijo, '2026-09-15');

  assert.equal(resUtc.finDeMesActual, resBogota.finDeMesActual);
  assert.equal(resUtc.finDeMesActual, '2026-09-30');

  assert.equal(resUtc.esFuturaMesSiguiente, resBogota.esFuturaMesSiguiente);
  assert.equal(resUtc.esFuturaMesSiguiente, true);

  assert.equal(resUtc.esFuturaDentroDelMes, resBogota.esFuturaDentroDelMes);
  assert.equal(resUtc.esFuturaDentroDelMes, false);

  assert.equal(resUtc.ahoraColombiaStr, resBogota.ahoraColombiaStr);
  assert.equal(resUtc.ahoraColombiaStr, '31/07/2026 23:30:00');
});

// public/js/fecha-limites-logic.js es la version navegador, misma logica
// duplicada a proposito (ver comentario del archivo server) -- confirmar
// que TAMBIEN es TZ-independiente por el mismo motivo.
const SCRIPT_FRONT = `
const fl = require(${JSON.stringify(path.join(__dirname, '..', '..', 'public', 'js', 'fecha-limites-logic.js'))});
const registro3130Colombia = new Date('2026-08-01T04:30:00.000Z');
const ahoraFijo = new Date('2026-09-15T07:00:00.000Z');
console.log(JSON.stringify({
  tz: process.env.TZ || '(sin TZ)',
  hoyColombiaDelRegistro: fl.fechaLimitesHoyColombia(registro3130Colombia),
  hoyColombiaDeAhoraFijo: fl.fechaLimitesHoyColombia(ahoraFijo),
  finDeMesActual: fl.fechaLimitesFinDeMesActual(ahoraFijo),
  esFuturaMesSiguiente: fl.fechaLimitesEsFutura('2026-10-01', ahoraFijo),
}));
`;

function correrFrontConTZ(tz) {
  const out = execFileSync(process.execPath, ['-e', SCRIPT_FRONT], {
    env: { ...process.env, TZ: tz },
    encoding: 'utf8',
  });
  return JSON.parse(out.trim().split('\n').pop());
}

test('Fase 119 3: fecha-limites-logic.js (navegador/public) -- TZ=UTC y TZ=America/Bogota dan EXACTAMENTE el mismo resultado', () => {
  const resUtc = correrFrontConTZ('UTC');
  const resBogota = correrFrontConTZ('America/Bogota');
  assert.equal(resUtc.hoyColombiaDelRegistro, resBogota.hoyColombiaDelRegistro);
  assert.equal(resUtc.hoyColombiaDelRegistro, '2026-07-31');
  assert.equal(resUtc.hoyColombiaDeAhoraFijo, resBogota.hoyColombiaDeAhoraFijo);
  assert.equal(resUtc.hoyColombiaDeAhoraFijo, '2026-09-15');
  assert.equal(resUtc.finDeMesActual, resBogota.finDeMesActual);
  assert.equal(resUtc.esFuturaMesSiguiente, resBogota.esFuturaMesSiguiente);
});

// Tipificacion: horas tipo 18:06 no deben cambiar de dia bajo ninguna TZ de
// proceso -- tipificacionParseHora/tipificacionValorCrudoSiFechaBoxeada
// trabajan sobre el valor CRUDO del serial de Excel, nunca sobre un Date
// boxeado sensible a la TZ del proceso (ver fase116-tipificacion-histcdr.test.js).
const SCRIPT_TIPIF = `
const tl = require(${JSON.stringify(path.join(__dirname, '..', '..', 'public', 'js', 'tipificacion-logic.js'))});
// Serial real usado en fase116-tipificacion-histcdr.test.js: 8/31/26 18:06 -> 18:06:08
const SERIAL = 46265.75425925926;
console.log(JSON.stringify({ tz: process.env.TZ || '(sin TZ)', hora: tl.tipificacionParseHora(SERIAL) }));
`;

function correrTipifConTZ(tz) {
  const out = execFileSync(process.execPath, ['-e', SCRIPT_TIPIF], {
    env: { ...process.env, TZ: tz },
    encoding: 'utf8',
  });
  return JSON.parse(out.trim().split('\n').pop());
}

test('Fase 119 3: Tipificación -- una hora 18:06 no cambia de día bajo TZ=UTC ni TZ=America/Bogota', () => {
  const resUtc = correrTipifConTZ('UTC');
  const resBogota = correrTipifConTZ('America/Bogota');
  assert.equal(resUtc.hora, '18:06:08');
  assert.equal(resBogota.hora, '18:06:08');
});
