// flujo-hora-logic.js — InConexion Platform (Fase 196, Mobilize). Pestaña
// "Flujo por hora": el reporte de cola de Wolkvox POR HORA (hoja
// "HistQueue<fecha>"), subido tal cual: DATE (AAAAMMDD), SKILL_ID, SKILL_NAME,
// HOUR, INBOUND_CALLS, ANSWER_CALLS, ABANDON_CALLS, SERVICE_LEVEL_10/20/30SEC,
// WAIT_TIME, ABANDON, AHT, ASA, ATA. Se usan DATE, HOUR, SKILL_NAME y las tres
// cantidades; el resto no se lee. El reporte no trae telefonos.
// Logica PURA (sin DOM). Doble modo: global en el navegador, require() en
// Node para las pruebas (server/tests/fase196-flujo-hora.test.js).
'use strict';

var _flujoHoraFechaLimites = (typeof require === 'function') ? require('./fecha-limites-logic.js') : (typeof window !== 'undefined' ? window : this);

var FLUJO_HORA_COLUMNAS = [
  { key: 'fecha', label: 'DATE', obligatoria: true },
  { key: 'hora', label: 'HOUR', obligatoria: true },
  { key: 'skill', label: 'SKILL_NAME', obligatoria: true },
  { key: 'ingresadas', label: 'INBOUND_CALLS', obligatoria: true },
  { key: 'contestadas', label: 'ANSWER_CALLS', obligatoria: true },
  { key: 'abandonadas', label: 'ABANDON_CALLS', obligatoria: true },
];
// Orden fijo de la fila que va al servidor (= CAMPOS_FILA de server/flujo-hora.js).
var FLUJO_HORA_ORDEN_ARRAY = ['fecha', 'hora', 'skill', 'ingresadas', 'contestadas', 'abandonadas'];
var FLUJO_HORA_METRICAS = [
  { key: 'ingresadas', titulo: 'Ingresadas' },
  { key: 'contestadas', titulo: 'Contestadas' },
  { key: 'abandonadas', titulo: 'Abandonadas' },
];

function _fhNorm(v) { return String(v == null ? '' : v).trim().replace(/\s+/g, ' '); }
function _fhPad(n) { return (n < 10 ? '0' : '') + n; }

function flujoHoraColIndexMap(headerRow) {
  var map = {};
  (headerRow || []).forEach(function (h, i) {
    var n = _fhNorm(h).toUpperCase();
    FLUJO_HORA_COLUMNAS.forEach(function (c) { if (c.label === n && map[c.key] === undefined) map[c.key] = i; });
  });
  return map;
}

// DATE -> 'AAAA-MM-DD' o null. Wolkvox la trae como numero AAAAMMDD
// (20261001); tambien se acepta texto AAAAMMDD, AAAA-MM-DD, dd/mm/aaaa y una
// fecha de Excel (Date local o serial).
function flujoHoraParseFecha(v) {
  var ok = function (y, m, d) {
    if (y < 1970 || y > 2200 || m < 1 || m > 12 || d < 1 || d > 31) return null;
    var f = new Date(Date.UTC(y, m - 1, d));
    if (f.getUTCMonth() !== m - 1) return null; // 31 de febrero, etc.
    return y + '-' + _fhPad(m) + '-' + _fhPad(d);
  };
  if (v instanceof Date) return isNaN(v.getTime()) ? null : ok(v.getFullYear(), v.getMonth() + 1, v.getDate());
  var t = _fhNorm(v);
  var m = /^(\d{4})(\d{2})(\d{2})$/.exec(t);
  if (m) return ok(+m[1], +m[2], +m[3]);
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
  if (m) return ok(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(t);
  if (m) return ok(+m[3], +m[2], +m[1]);
  if (typeof v === 'number' && v > 20000 && v < 80000) { // serial de Excel
    var d = new Date(Math.round((Math.floor(v) - 25569) * 86400000));
    return ok(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  return null;
}

function _fhEntero(v) {
  if (v === null || v === undefined || _fhNorm(v) === '') return null;
  var n = typeof v === 'number' ? v : Number(_fhNorm(v).replace(',', '.'));
  return isFinite(n) && Math.floor(n) === n && n >= 0 ? n : null;
}

// { error } si falta una columna obligatoria; si no, { filas, avisos, totales, dias, desde, hasta }.
function flujoHoraParseFilas(aoa) {
  if (!aoa || !aoa.length) return { error: 'El archivo esta vacio.' };
  var map = flujoHoraColIndexMap(aoa[0]);
  var faltantes = FLUJO_HORA_COLUMNAS.filter(function (c) { return map[c.key] === undefined; });
  if (faltantes.length) {
    return { error: 'Faltan columnas obligatorias: ' + faltantes.map(function (c) { return c.label; }).join(', ') + '. Sube el reporte de Wolkvox por hora tal cual.' };
  }
  var filas = [];
  var avisos = [];
  var dias = {};
  var totales = { ingresadas: 0, contestadas: 0, abandonadas: 0 };
  var vistos = {};
  for (var i = 1; i < aoa.length; i++) {
    var row = aoa[i];
    if (!row || row.every(function (v) { return v === '' || v === null || v === undefined; })) continue;
    var n = i + 1;
    var fecha = flujoHoraParseFecha(row[map.fecha]);
    if (!fecha) { avisos.push('Fila ' + n + ': DATE invalida o vacia, se omitio.'); continue; }
    if (_flujoHoraFechaLimites.fechaLimitesEsFutura(fecha)) { avisos.push('Fila ' + n + ': DATE ' + fecha + ' esta en el futuro, se omitio.'); continue; }
    var hora = _fhEntero(row[map.hora]);
    if (hora === null || hora > 23) { avisos.push('Fila ' + n + ': HOUR invalida (0 a 23), se omitio.'); continue; }
    var skill = _fhNorm(row[map.skill]);
    if (!skill) { avisos.push('Fila ' + n + ': falta SKILL_NAME, se omitio.'); continue; }
    var c = {};
    var mal = FLUJO_HORA_METRICAS.filter(function (m) { c[m.key] = _fhEntero(row[map[m.key]]); return c[m.key] === null; });
    if (mal.length) { avisos.push('Fila ' + n + ': cantidad invalida en ' + mal.map(function (m) { return FLUJO_HORA_COLUMNAS.filter(function (x) { return x.key === m.key; })[0].label; }).join(', ') + ', se omitio.'); continue; }
    var clave = fecha + '|' + hora + '|' + skill.toUpperCase();
    if (vistos[clave]) { avisos.push('Fila ' + n + ': ' + fecha + ' a las ' + hora + ' h de ' + skill + ' ya venia en el archivo, se omitio (no se suma dos veces).'); continue; }
    vistos[clave] = true;
    filas.push([fecha, hora, skill.slice(0, 200), c.ingresadas, c.contestadas, c.abandonadas]);
    FLUJO_HORA_METRICAS.forEach(function (m) { totales[m.key] += c[m.key]; });
    dias[fecha] = true;
  }
  if (!filas.length) return { error: 'Ninguna fila valida en el archivo.', avisos: avisos };
  var lista = Object.keys(dias).sort();
  return { filas: filas, avisos: avisos, totales: totales, dias: lista.length, desde: lista[0], hasta: lista[lista.length - 1] };
}

// Tramo de una hora: 8 -> "8:00 - 9:00".
function flujoHoraTramo(h) { return h + ':00 - ' + (h + 1) + ':00'; }

// Matriz de un mes para una metrica. `filas` = [{ dia: 'AAAA-MM-DD', hora,
// ingresadas, contestadas, abandonadas }] (del servidor, ya sumadas por
// dia+hora). Columnas = TODOS los dias del mes (1..28/29/30/31), filas = las
// horas con datos en el mes. Devuelve { horas, dias, celdas[h][d], totalFila,
// totalColumna, total, max }.
function flujoHoraMatriz(filas, mes, metrica) {
  var anio = Number(String(mes).slice(0, 4)), m = Number(String(mes).slice(5, 7));
  var nDias = new Date(Date.UTC(anio, m, 0)).getUTCDate();
  var dias = [];
  for (var d = 1; d <= nDias; d++) dias.push(d);
  var horas = [];
  (filas || []).forEach(function (f) { if (String(f.dia).slice(0, 7) === mes && horas.indexOf(f.hora) === -1) horas.push(f.hora); });
  horas.sort(function (a, b) { return a - b; });
  var celdas = {};
  horas.forEach(function (h) { celdas[h] = {}; dias.forEach(function (x) { celdas[h][x] = 0; }); });
  (filas || []).forEach(function (f) {
    if (String(f.dia).slice(0, 7) !== mes) return;
    celdas[f.hora][Number(String(f.dia).slice(8, 10))] += f[metrica] || 0;
  });
  var totalFila = {}, totalColumna = {}, total = 0, max = 0;
  dias.forEach(function (x) { totalColumna[x] = 0; });
  horas.forEach(function (h) {
    totalFila[h] = 0;
    dias.forEach(function (x) {
      var v = celdas[h][x];
      totalFila[h] += v; totalColumna[x] += v; total += v;
      if (v > max) max = v;
    });
  });
  return { horas: horas, dias: dias, celdas: celdas, totalFila: totalFila, totalColumna: totalColumna, total: total, max: max };
}

// Nivel de color de una celda en tres tramos del maximo de la tabla: el mas
// alto (verde) desde 2/3 del maximo, el medio (amarillo) desde 1/3, el mas
// bajo (gris) por debajo, incluido 0.
function flujoHoraNivel(v, max) {
  if (!max || !v) return 'bajo';
  if (v >= (2 * max) / 3) return 'alto';
  if (v >= max / 3) return 'medio';
  return 'bajo';
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    FLUJO_HORA_COLUMNAS: FLUJO_HORA_COLUMNAS,
    FLUJO_HORA_ORDEN_ARRAY: FLUJO_HORA_ORDEN_ARRAY,
    FLUJO_HORA_METRICAS: FLUJO_HORA_METRICAS,
    flujoHoraColIndexMap: flujoHoraColIndexMap,
    flujoHoraParseFecha: flujoHoraParseFecha,
    flujoHoraParseFilas: flujoHoraParseFilas,
    flujoHoraTramo: flujoHoraTramo,
    flujoHoraMatriz: flujoHoraMatriz,
    flujoHoraNivel: flujoHoraNivel,
  };
}
