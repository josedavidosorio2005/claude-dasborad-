// whatsapp-tiempos-logic.js — InConexion Platform (Fase 142, punto 4,
// reunion con Edwin del 13/10/2026). ORLANT, WhatsApp: "Nivel de Servicio"
// por RANGOS de minutos a partir del detalle por conversacion (export de
// Wolkvox: Reportes > Skills & Servicios > "10. Detalle de llamadas
// contestadas" -- SKILL_NAME, DATE, RESULT, ANSWER_TIME; CONN_ID, SKILL_ID,
// ANI y TIEMPO, si vienen, se ignoran).
// Logica PURA (sin DOM). Doble modo: global en el navegador, require() en
// Node para las pruebas (server/tests/fase142-whatsapp-tiempos.test.js y
// server/tests/fase165-whatsapp-tiempos.test.js).
//
// Decisiones (usuario, 13/10; cortes y lectura de ANSWER_TIME, Fase 165):
//   - El rango SIEMPRE se calcula aqui a partir de ANSWER_TIME (segundos),
//     con los cortes de Edwin (Fase 165): <180, <300, <480, <600, resto. La
//     columna TIEMPO del Excel se IGNORA (en el archivo de agosto la formula
//     apunta a la fecha y todas las filas salen "10 minutos en adelante").
//   - Solo se cargan filas cuyo SKILL_NAME empieza por "WHATSAPP"; las demas
//     (colas de llamadas mezcladas en el mismo export) se cuentan como
//     ignoradas, sin ser error. RESULT distinto de ANSWER se omite con aviso.
//     Filas totalmente vacias se omiten y se cuentan.
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

// Cortes de Edwin (Fase 165): segundos, limite superior EXCLUIDO (180 s ya es
// "3 a 5 minutos"). El ultimo no tiene tope. Mismos cortes en
// server/whatsapp-tiempos.js (RANGOS).
var WPP_TIEMPOS_RANGOS = [
  { key: 'r0_3', label: '0 a 3 minutos', menorQue: 180 },
  { key: 'r3_5', label: '3 a 5 minutos', menorQue: 300 },
  { key: 'r5_8', label: '5 a 8 minutos', menorQue: 480 },
  { key: 'r8_10', label: '8 a 10 minutos', menorQue: 600 },
  { key: 'r10', label: '10 minutos en adelante', menorQue: null },
];

function wppTiemposRangoDe(segundos) {
  for (var i = 0; i < WPP_TIEMPOS_RANGOS.length; i++) {
    var r = WPP_TIEMPOS_RANGOS[i];
    if (r.menorQue === null || segundos < r.menorQue) return r.key;
  }
  return WPP_TIEMPOS_RANGOS[WPP_TIEMPOS_RANGOS.length - 1].key;
}

function _wppTiemposNorm(v) {
  return String(v == null ? '' : v).trim().replace(/\s+/g, ' ');
}

// Wolkvox escribe algunos textos con un apostrofo literal al inicio
// ('4022.2141..., '5742); se quita antes de leer el valor.
function _wppTiemposSinApostrofo(v) {
  return typeof v === 'string' ? v.replace(/^[\s ]*'+/, '') : v;
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

// Fase 165 (reporte de octubre de ORLANT, "miles de avisos"): antes solo se
// aceptaba un numero limpio, y el export de Wolkvox puede traer ANSWER_TIME
// como texto con apostrofo ('5742, igual que CONN_ID) o como duracion
// ("01:35:42"); cada fila de WhatsApp quedaba omitida con un aviso propio.
// Ahora se acepta:
//   - numero o texto numerico, con o sin apostrofo/espacios, con separador
//     de miles ("5.742" o "5,742" = 5742) o coma decimal ("12,5");
//   - duracion "hh:mm:ss" o "mm:ss" (texto);
//   - celda con formato de hora de Excel (ver _wppTiemposColumnaEsHora):
//     fraccion de dia -> segundos; o un Date de 1899/1900 si SheetJS ya la
//     convirtio.
// Devuelve null si la celda esta vacia y NaN si trae algo que no se puede leer.
var _WPP_TIEMPOS_BASE_HORA = new Date(1899, 11, 30).getTime();

function _wppTiemposVacio(v) {
  return v === null || v === undefined || (typeof v === 'string' && v.replace(/[\s ']/g, '') === '');
}

function _wppTiemposSegundos(v, esHora) {
  if (_wppTiemposVacio(v)) return null;
  var n;
  if (v instanceof Date) {
    if (isNaN(v.getTime()) || v.getFullYear() > 1900) return NaN;
    n = (v.getTime() - _WPP_TIEMPOS_BASE_HORA) / 1000;
  } else if (typeof v === 'number') {
    n = esHora ? v * 86400 : v;
  } else {
    var s = String(_wppTiemposSinApostrofo(v)).replace(/[\s ]/g, '');
    var hms = /^(\d+):(\d{1,2})(?::(\d{1,2}))?$/.exec(s);
    if (hms) {
      n = hms[3] === undefined
        ? parseInt(hms[1], 10) * 60 + parseInt(hms[2], 10)
        : parseInt(hms[1], 10) * 3600 + parseInt(hms[2], 10) * 60 + parseInt(hms[3], 10);
    } else if (/^\d{1,3}([.,]\d{3})+$/.test(s)) {
      n = Number(s.replace(/[.,]/g, ''));
    } else {
      n = /^\d+([.,]\d+)?$/.test(s) ? Number(s.replace(',', '.')) : NaN;
    }
  }
  if (!isFinite(n) || n < 0) return NaN;
  return Math.round(n);
}

// Columna A1 ("A", "AB"...) de un indice 0-based.
function _wppTiemposLetras(n) {
  var s = '';
  for (n = n + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

// true si la columna ANSWER_TIME tiene formato de hora/duracion de Excel
// ("[h]:mm:ss", "mm:ss"...) en la mayoria de sus primeras celdas numericas.
// ws es la hoja cruda de SheetJS (2do argumento de cargasProcesarHoja); sin
// ws (pruebas, otros llamadores) se asume que no.
function _wppTiemposColumnaEsHora(ws, col) {
  if (!ws || !ws['!ref'] || col === undefined) return false;
  var m = /^([A-Z]+)(\d+)/.exec(String(ws['!ref']));
  if (!m) return false;
  var c0 = 0;
  for (var k = 0; k < m[1].length; k++) c0 = c0 * 26 + (m[1].charCodeAt(k) - 64);
  var letras = _wppTiemposLetras(c0 - 1 + col);
  var desde = parseInt(m[2], 10) + 1;
  var vistas = 0, horas = 0;
  for (var fila = desde; fila < desde + 400 && vistas < 50; fila++) {
    var cel = ws[letras + fila];
    if (!cel || (cel.t !== 'n' && cel.t !== 'd')) continue;
    vistas++;
    var z = String(cel.z || '');
    if (cel.t === 'd' || (/[hs]|mm/i.test(z) && !/general/i.test(z))) horas++;
  }
  return vistas > 0 && horas * 2 > vistas;
}

function _wppTiemposListaFilas(nums) {
  var muestra = nums.slice(0, 5).join(', ');
  return nums.length > 5 ? muestra + ' y ' + (nums.length - 5) + ' más' : muestra;
}

// Devuelve { error } si falta una columna obligatoria. Si no:
// { filas, avisos, ignoradasNoWhatsapp, vacias, porRango: {r0_3,...}, dias }.
// Fase 165: los avisos van AGRUPADOS por motivo (uno por motivo, con las
// primeras filas), nunca uno por fila. `vacias` cuenta las filas que se
// omiten sin ser error: totalmente vacias (tambien las que SheetJS ya no
// entrega, si se pasa ws) y las de WhatsApp con la celda ANSWER_TIME vacia.
function wppTiemposParseFilas(aoa, ws) {
  if (!aoa || !aoa.length) return { error: 'El archivo esta vacio.' };
  var map = wppTiemposColIndexMap(aoa[0]);
  var faltantes = WPP_TIEMPOS_COLUMNAS.filter(function (c) { return c.obligatoria && map[c.key] === undefined; });
  if (faltantes.length) {
    return { error: 'Faltan columnas obligatorias: ' + faltantes.map(function (c) { return c.label; }).join(', ') + '.' };
  }
  var filas = [];
  var avisos = [];
  var ignoradasNoWhatsapp = 0;
  var vacias = 0;
  var porMotivo = { tiempo: [], resultado: [], fecha: [], futura: [], sinTiempo: [] };
  var esHora = _wppTiemposColumnaEsHora(ws, map.segundos);
  var porRango = {};
  WPP_TIEMPOS_RANGOS.forEach(function (r) { porRango[r.key] = 0; });
  var dias = {};
  // Filas vacias que cargas.js ya no entrega (sheet_to_json con
  // blankrows:false): las que caben en el rango de la hoja pero no llegaron.
  var ref = ws && ws['!ref'] ? /^[A-Z]+(\d+):[A-Z]+(\d+)$/.exec(String(ws['!ref'])) : null;
  if (ref) vacias += Math.max(0, (parseInt(ref[2], 10) - parseInt(ref[1], 10)) - (aoa.length - 1));
  for (var i = 1; i < aoa.length; i++) {
    var row = aoa[i];
    if (!row || row.every(_wppTiemposVacio)) { vacias++; continue; }
    var filaNum = i + 1;
    var skill = _wppTiemposNorm(_wppTiemposSinApostrofo(row[map.skill]));
    if (!/^WHATSAPP/i.test(skill)) { ignoradasNoWhatsapp++; continue; }
    var resultado = _wppTiemposNorm(_wppTiemposSinApostrofo(row[map.resultado])).toUpperCase();
    if (resultado !== 'ANSWER') { porMotivo.resultado.push(filaNum); continue; }
    var fh = wppTiemposParseFechaHora(_wppTiemposSinApostrofo(row[map.fecha]));
    if (!fh) { porMotivo.fecha.push(filaNum); continue; }
    if (_wppTiemposFechaLimites.fechaLimitesEsFutura(fh.fecha)) { porMotivo.futura.push(filaNum); continue; }
    var seg = _wppTiemposSegundos(row[map.segundos], esHora);
    if (seg === null) { porMotivo.sinTiempo.push(filaNum); vacias++; continue; }
    if (isNaN(seg)) { porMotivo.tiempo.push(filaNum); continue; }
    filas.push([skill, fh.fecha, fh.hora, seg]);
    porRango[wppTiemposRangoDe(seg)]++;
    dias[fh.fecha] = true;
  }
  var textos = {
    tiempo: 'con un ANSWER_TIME que no se pudo leer como segundos',
    resultado: 'con RESULT distinto de ANSWER',
    fecha: 'con DATE invalida o vacia',
    futura: 'con DATE en el futuro',
    sinTiempo: 'sin ANSWER_TIME (celda vacia)',
  };
  Object.keys(textos).forEach(function (k) {
    var nums = porMotivo[k];
    if (nums.length) avisos.push(nums.length + ' fila(s) de WhatsApp ' + textos[k] + ', se omitieron (filas ' + _wppTiemposListaFilas(nums) + ').');
  });
  return { filas: filas, avisos: avisos, ignoradasNoWhatsapp: ignoradasNoWhatsapp, vacias: vacias, porRango: porRango, dias: Object.keys(dias).length };
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
