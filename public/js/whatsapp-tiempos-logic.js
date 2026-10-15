// whatsapp-tiempos-logic.js — InConexion Platform (Fase 142, punto 4,
// reunion con Edwin del 13/10/2026). ORLANT, WhatsApp: "Nivel de Servicio"
// por RANGOS de minutos a partir del detalle por conversacion (export
// HistQueue de Wolkvox: SKILL_NAME, DATE, RESULT, ANSWER_TIME, TIEMPO).
// Logica PURA (sin DOM). Doble modo: global en el navegador, require() en
// Node para las pruebas (server/tests/fase142-whatsapp-tiempos.test.js).
//
// Decisiones (usuario, 13/10):
//   - El rango SIEMPRE se calcula aqui a partir de ANSWER_TIME (segundos),
//     con los cortes de Edwin: <=180, <=300, <=480, <=600, >600. La columna
//     TIEMPO del Excel se IGNORA (en el archivo de agosto la formula apunta a
//     la fecha y todas las filas salen "10 minutos en adelante").
//   - Solo se cargan filas cuyo SKILL_NAME empieza por "WHATSAPP"; las demas
//     (colas de llamadas mezcladas en el mismo export) se cuentan como
//     ignoradas, sin ser error. RESULT distinto de ANSWER se omite con aviso.
//     Filas totalmente vacias se ignoran.
//   - El archivo no trae telefonos ni nombres; el payload tampoco.
'use strict';

var _wppTiemposFechaLimites = (typeof require === 'function') ? require('./fecha-limites-logic.js') : (typeof window !== 'undefined' ? window : this);

var WPP_TIEMPOS_COLUMNAS = [
  { key: 'skill', label: 'SKILL_NAME', obligatoria: true },
  { key: 'fecha', label: 'DATE', obligatoria: true },
  { key: 'resultado', label: 'RESULT', obligatoria: true },
  { key: 'segundos', label: 'ANSWER_TIME', obligatoria: true },
];
// Orden fijo del payload compacto -- debe coincidir con CAMPOS_FILA
// (server/whatsapp-tiempos.js) y whatsappTiemposFilaArraySchema (validation.js).
var WPP_TIEMPOS_ORDEN_ARRAY = ['skill', 'fecha', 'hora', 'segundos'];

// Cortes de Edwin (segundos, limite superior INCLUIDO). El ultimo no tiene tope.
var WPP_TIEMPOS_RANGOS = [
  { key: 'r0_3', label: '0-3 minutos', hasta: 180 },
  { key: 'r3_5', label: '3-5 minutos', hasta: 300 },
  { key: 'r5_8', label: '5-8 minutos', hasta: 480 },
  { key: 'r8_10', label: '8-10 minutos', hasta: 600 },
  { key: 'r10', label: '10 minutos en adelante', hasta: null },
];

function wppTiemposRangoDe(segundos) {
  for (var i = 0; i < WPP_TIEMPOS_RANGOS.length; i++) {
    var r = WPP_TIEMPOS_RANGOS[i];
    if (r.hasta === null || segundos <= r.hasta) return r.key;
  }
  return WPP_TIEMPOS_RANGOS[WPP_TIEMPOS_RANGOS.length - 1].key;
}

function _wppTiemposNorm(v) {
  return String(v == null ? '' : v).trim().replace(/\s+/g, ' ');
}

function wppTiemposColIndexMap(headerRow) {
  var map = {};
  (headerRow || []).forEach(function (h, i) {
    var n = _wppTiemposNorm(h).toUpperCase().replace(/\s+/g, '_');
    var col = WPP_TIEMPOS_COLUMNAS.filter(function (c) { return c.label === n; })[0];
    if (col && map[col.key] === undefined) map[col.key] = i;
  });
  return map;
}

function _pad2(x) { return (x < 10 ? '0' : '') + x; }

// DATE con hora -> { fecha: 'AAAA-MM-DD', hora: 0..23 } o null.
// SheetJS (lectura de cargas.js, cellNF/sheetStubs) entrega un Date nativo
// armado con el reloj LOCAL del navegador: getters locales, nunca getUTC*
// (mismo criterio que llamadasUnicasParseFecha, Fase 139). Tambien acepta
// serial de Excel con fraccion de dia y texto "dd/mm/aaaa hh:mm[:ss]" o
// "aaaa-mm-dd hh:mm[:ss]".
function wppTiemposParseFechaHora(v) {
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return null;
    var y = v.getFullYear();
    if (y < 1970 || y > 2200) return null;
    return { fecha: y + '-' + _pad2(v.getMonth() + 1) + '-' + _pad2(v.getDate()), hora: v.getHours() };
  }
  if (typeof v === 'number' && isFinite(v)) {
    var dias = Math.floor(v);
    var d = new Date(Math.round((dias - 25569) * 86400000));
    if (isNaN(d.getTime())) return null;
    var yy = d.getUTCFullYear();
    if (yy < 1970 || yy > 2200) return null;
    var hora = Math.floor(Math.round((v - dias) * 86400) / 3600);
    if (hora > 23) hora = 23;
    return { fecha: yy + '-' + _pad2(d.getUTCMonth() + 1) + '-' + _pad2(d.getUTCDate()), hora: hora };
  }
  if (typeof v === 'string') {
    var t = v.trim();
    var m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::\d{2})?)?$/.exec(t);
    if (m) return { fecha: m[1] + '-' + m[2] + '-' + m[3], hora: m[4] ? Math.min(23, parseInt(m[4], 10)) : 0 };
    m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::\d{2})?)?$/.exec(t);
    if (m) {
      var dd = parseInt(m[1], 10), mm = parseInt(m[2], 10);
      if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
      return { fecha: m[3] + '-' + _pad2(mm) + '-' + _pad2(dd), hora: m[4] ? Math.min(23, parseInt(m[4], 10)) : 0 };
    }
  }
  return null;
}

// ANSWER_TIME: segundos enteros >= 0 (numero o texto numerico).
function _wppTiemposSegundos(v) {
  if (v === null || v === undefined || v === '') return null;
  var n = typeof v === 'number' ? v : Number(String(v).trim().replace(',', '.'));
  if (!isFinite(n) || n < 0) return null;
  return Math.round(n);
}

// Devuelve { error } si falta una columna obligatoria. Si no:
// { filas, avisos, ignoradasNoWhatsapp, porRango: {r0_3,...}, dias }.
function wppTiemposParseFilas(aoa) {
  if (!aoa || !aoa.length) return { error: 'El archivo esta vacio.' };
  var map = wppTiemposColIndexMap(aoa[0]);
  var faltantes = WPP_TIEMPOS_COLUMNAS.filter(function (c) { return c.obligatoria && map[c.key] === undefined; });
  if (faltantes.length) {
    return { error: 'Faltan columnas obligatorias: ' + faltantes.map(function (c) { return c.label; }).join(', ') + '.' };
  }
  var filas = [];
  var avisos = [];
  var ignoradasNoWhatsapp = 0;
  var porRango = {};
  WPP_TIEMPOS_RANGOS.forEach(function (r) { porRango[r.key] = 0; });
  var dias = {};
  for (var i = 1; i < aoa.length; i++) {
    var row = aoa[i];
    if (!row || row.every(function (v) { return v === '' || v === null || v === undefined; })) continue;
    var filaNum = i + 1;
    var skill = _wppTiemposNorm(row[map.skill]);
    if (!/^WHATSAPP/i.test(skill)) { ignoradasNoWhatsapp++; continue; }
    var resultado = _wppTiemposNorm(row[map.resultado]).toUpperCase();
    if (resultado !== 'ANSWER') { avisos.push('Fila ' + filaNum + ': RESULT "' + resultado + '" no es ANSWER, se omitio.'); continue; }
    var fh = wppTiemposParseFechaHora(row[map.fecha]);
    if (!fh) { avisos.push('Fila ' + filaNum + ': DATE invalida o vacia, se omitio.'); continue; }
    if (_wppTiemposFechaLimites.fechaLimitesEsFutura(fh.fecha)) { avisos.push('Fila ' + filaNum + ': DATE ' + fh.fecha + ' esta en el futuro, se omitio.'); continue; }
    var seg = _wppTiemposSegundos(row[map.segundos]);
    if (seg === null) { avisos.push('Fila ' + filaNum + ': ANSWER_TIME invalido o vacio, se omitio.'); continue; }
    filas.push([skill, fh.fecha, fh.hora, seg]);
    porRango[wppTiemposRangoDe(seg)]++;
    dias[fh.fecha] = true;
  }
  return { filas: filas, avisos: avisos, ignoradasNoWhatsapp: ignoradasNoWhatsapp, porRango: porRango, dias: Object.keys(dias).length };
}

// Mes por defecto de la vista: el mes elegido arriba (o el actual) si tiene
// datos; si no, el ultimo mes con datos que no sea futuro.
function wppTiemposMesPorDefecto(meses, mesPreferido, mesActual) {
  var lista = (meses || []).slice().sort();
  if (!lista.length) return null;
  if (mesPreferido && lista.indexOf(mesPreferido) !== -1) return mesPreferido;
  var validos = mesActual ? lista.filter(function (m) { return m <= mesActual; }) : lista;
  if (!validos.length) validos = lista;
  return validos[validos.length - 1];
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    WPP_TIEMPOS_COLUMNAS: WPP_TIEMPOS_COLUMNAS,
    WPP_TIEMPOS_ORDEN_ARRAY: WPP_TIEMPOS_ORDEN_ARRAY,
    WPP_TIEMPOS_RANGOS: WPP_TIEMPOS_RANGOS,
    wppTiemposRangoDe: wppTiemposRangoDe,
    wppTiemposColIndexMap: wppTiemposColIndexMap,
    wppTiemposParseFechaHora: wppTiemposParseFechaHora,
    wppTiemposParseFilas: wppTiemposParseFilas,
    wppTiemposMesPorDefecto: wppTiemposMesPorDefecto,
  };
}
