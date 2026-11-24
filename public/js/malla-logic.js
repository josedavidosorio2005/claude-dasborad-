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
  // Fase M1 (B): horario del grupo en los festivos. Sin la clave (o null): el festivo descansa.
  var fe = h.festivo;
  if (fe !== null && fe !== undefined && fe !== '') {
    if (typeof fe !== 'object' || !_mHora(fe.entrada) || !_mHora(fe.salida)) return { ok: false, error: 'Festivos: escribe la hora de entrada y de salida (HH:MM)' };
    if (fe.salida <= fe.entrada) return { ok: false, error: 'Festivos: la salida debe ser después de la entrada (no hay turnos nocturnos)' };
    out.festivo = { entrada: fe.entrada, salida: fe.salida };
  }
  return { ok: true, horario: out };
}

// Fase M1 (B): festivos de Colombia de un año (Ley 51 de 1983, «Ley Emiliani»): los fijos, los que se
// pasan al lunes siguiente y los que dependen de la Pascua. -> [{ fecha, nombre }] ordenados.
function _mPascua(anio) { // algoritmo anónimo gregoriano (Meeus/Jones/Butcher)
  var a = anio % 19, b = Math.floor(anio / 100), c = anio % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  var g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  var l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  var mes = Math.floor((h + l - 7 * m + 114) / 31), dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(anio, mes - 1, dia));
}
function _mMasDias(d, n) { var x = new Date(d.getTime()); x.setUTCDate(x.getUTCDate() + n); return x; }
function _mAlLunes(d) { var dow = d.getUTCDay(); return dow === 1 ? d : _mMasDias(d, (8 - dow) % 7); }
function mallaFestivosColombia(anio) {
  anio = Number(anio);
  if (!Number.isInteger(anio) || anio < 2000 || anio > 2100) return [];
  var F = function (m, d) { return new Date(Date.UTC(anio, m - 1, d)); };
  var p = _mPascua(anio);
  var lista = [
    [F(1, 1), 'Año Nuevo'], [_mAlLunes(F(1, 6)), 'Día de los Reyes Magos'], [_mAlLunes(F(3, 19)), 'Día de San José'],
    [_mMasDias(p, -3), 'Jueves Santo'], [_mMasDias(p, -2), 'Viernes Santo'], [F(5, 1), 'Día del Trabajo'],
    [_mMasDias(p, 43), 'Ascensión del Señor'], [_mMasDias(p, 64), 'Corpus Christi'], [_mMasDias(p, 71), 'Sagrado Corazón de Jesús'],
    [_mAlLunes(F(6, 29)), 'San Pedro y San Pablo'], [F(7, 20), 'Día de la Independencia'], [F(8, 7), 'Batalla de Boyacá'],
    [_mAlLunes(F(8, 15)), 'Asunción de la Virgen'], [_mAlLunes(F(10, 12)), 'Día de la Raza'], [_mAlLunes(F(11, 1)), 'Todos los Santos'],
    [_mAlLunes(F(11, 11)), 'Independencia de Cartagena'], [F(12, 8), 'Inmaculada Concepción'], [F(12, 25), 'Navidad'],
  ];
  return lista.map(function (x) { return { fecha: _mIso(x[0]), nombre: x[1] }; }).sort(function (a, b) { return a.fecha < b.fecha ? -1 : 1; });
}
// El horario de una semana con los festivos encima: un festivo en un día que el grupo trabaja usa el
// horario «festivo» del grupo (o descansa si el grupo no lo tiene: así queda por defecto). Un festivo en
// un día que el grupo no trabaja sigue siendo descanso. festivos: { 'AAAA-MM-DD': nombre }.
// -> { horario, festivos: { n: nombre } }
function mallaAplicarFestivos(horario, lunes, festivos) {
  var h = {}, k;
  for (k in (horario || {})) if (Object.prototype.hasOwnProperty.call(horario, k)) h[k] = horario[k];
  var marcados = {};
  for (var i = 0; i < MALLA_DIAS.length; i++) {
    var n = MALLA_DIAS[i].n, f = mallaFechaDelDia(lunes, n);
    if (!festivos || !Object.prototype.hasOwnProperty.call(festivos, f)) continue;
    marcados[n] = festivos[f];
    var t = h[n] || h[String(n)] || null;
    delete h[String(n)];
    h[n] = t ? (h.festivo || null) : null;
  }
  return { horario: h, festivos: marcados };
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
    mallaFestivosColombia: mallaFestivosColombia, mallaAplicarFestivos: mallaAplicarFestivos, // Fase M1 (B)
  };
}
