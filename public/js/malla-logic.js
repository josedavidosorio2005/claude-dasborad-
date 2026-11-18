// malla-logic.js — Fase 358 (pedido de Edwin, 17/11): «Malla de turnos». Lógica pura compartida por
// el servidor (server/malla.js) y la interfaz. Decisiones del usuario: horario por día (el sábado
// puede ser distinto), un solo tramo por día, sin turnos nocturnos (la salida es después de la
// entrada el mismo día). La semana va de lunes a domingo y se identifica por su lunes (AAAA-MM-DD).
'use strict';

var MALLA_DIAS = [
  { n: 1, corto: 'Lun', largo: 'Lunes' }, { n: 2, corto: 'Mar', largo: 'Martes' }, { n: 3, corto: 'Mié', largo: 'Miércoles' },
  { n: 4, corto: 'Jue', largo: 'Jueves' }, { n: 5, corto: 'Vie', largo: 'Viernes' }, { n: 6, corto: 'Sáb', largo: 'Sábado' },
  { n: 7, corto: 'Dom', largo: 'Domingo' },
];
var MALLA_NOMBRE_MAX = 60;

function _mPad(n) { return (n < 10 ? '0' : '') + n; }
function _mFecha(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  var d = new Date(s + 'T00:00:00Z');
  return isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? null : d;
}
function _mIso(d) { return d.getUTCFullYear() + '-' + _mPad(d.getUTCMonth() + 1) + '-' + _mPad(d.getUTCDate()); }

// Lunes de la semana de una fecha AAAA-MM-DD (o null si la fecha no es válida).
function mallaLunesDe(fecha) {
  var d = _mFecha(fecha);
  if (!d) return null;
  var dow = d.getUTCDay() || 7; // 1 = lunes ... 7 = domingo
  d.setUTCDate(d.getUTCDate() - (dow - 1));
  return _mIso(d);
}
function mallaEsLunes(fecha) { return !!_mFecha(fecha) && mallaLunesDe(fecha) === fecha; }
function mallaSumarSemanas(lunes, n) {
  var d = _mFecha(lunes);
  if (!d) return null;
  d.setUTCDate(d.getUTCDate() + 7 * (Number(n) || 0));
  return _mIso(d);
}
// Fecha (AAAA-MM-DD) de un día de la semana (1 = lunes ... 7 = domingo).
function mallaFechaDelDia(lunes, dia) {
  var d = _mFecha(lunes);
  if (!d) return null;
  d.setUTCDate(d.getUTCDate() + (Number(dia) - 1));
  return _mIso(d);
}

// Fase 366 (pedido de Edwin 18/11, D1): las semanas (sus lunes) que tocan un mes AAAA-MM, para el
// selector de mes de la malla. Incluye la semana que empieza el mes anterior si el día 1 cae en ella.
function mallaSemanasDelMes(mes) {
  if (typeof mes !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) return [];
  var primero = mes + '-01';
  var d = _mFecha(primero);
  var ultimo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  var out = [];
  for (var l = mallaLunesDe(primero); l <= _mIso(ultimo); l = mallaSumarSemanas(l, 1)) out.push(l);
  return out;
}

var _MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
// «Semana del 16 al 22 de nov de 2026» (o «del 30 de nov al 6 de dic de 2026»).
function mallaSemanaTexto(lunes) {
  var a = _mFecha(lunes);
  if (!a) return '';
  var b = _mFecha(mallaSumarSemanas(lunes, 1)); b.setUTCDate(b.getUTCDate() - 1);
  var mA = _MESES[a.getUTCMonth()], mB = _MESES[b.getUTCMonth()];
  return 'Semana del ' + a.getUTCDate() + (mA !== mB ? ' de ' + mA : '') + ' al ' + b.getUTCDate() + ' de ' + mB + ' de ' + b.getUTCFullYear();
}

function _mHora(s) { return typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s); }

// Horario de un grupo: { "1": {entrada, salida} | null, ..., "7": ... }. Devuelve { ok, horario, error }
// con el horario normalizado (las 7 claves; null = no trabaja ese día).
function mallaValidarHorario(h) {
  if (!h || typeof h !== 'object' || Array.isArray(h)) return { ok: false, error: 'Falta el horario' };
  var out = {}, alguno = false;
  for (var i = 0; i < MALLA_DIAS.length; i++) {
    var dia = MALLA_DIAS[i], v = h[String(dia.n)];
    if (v === null || v === undefined || v === '') { out[dia.n] = null; continue; }
    if (typeof v !== 'object' || !_mHora(v.entrada) || !_mHora(v.salida)) return { ok: false, error: dia.largo + ': escribe la hora de entrada y de salida (HH:MM)' };
    if (v.salida <= v.entrada) return { ok: false, error: dia.largo + ': la salida debe ser después de la entrada (no hay turnos nocturnos)' };
    out[dia.n] = { entrada: v.entrada, salida: v.salida };
    alguno = true;
  }
  if (!alguno) return { ok: false, error: 'El grupo debe trabajar al menos un día' };
  return { ok: true, horario: out };
}

function mallaNombreValido(n) {
  return typeof n === 'string' && n.trim().length >= 1 && n.trim().length <= MALLA_NOMBRE_MAX;
}

// Texto del turno de un día: «07:00 – 16:00» o «Descanso».
function mallaTurnoTexto(t) { return t && t.entrada ? t.entrada + ' – ' + t.salida : 'Descanso'; }

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    MALLA_DIAS: MALLA_DIAS, MALLA_NOMBRE_MAX: MALLA_NOMBRE_MAX,
    mallaLunesDe: mallaLunesDe, mallaEsLunes: mallaEsLunes, mallaSumarSemanas: mallaSumarSemanas, mallaFechaDelDia: mallaFechaDelDia, mallaSemanasDelMes: mallaSemanasDelMes,
    mallaSemanaTexto: mallaSemanaTexto, mallaValidarHorario: mallaValidarHorario, mallaNombreValido: mallaNombreValido, mallaTurnoTexto: mallaTurnoTexto,
  };
}
