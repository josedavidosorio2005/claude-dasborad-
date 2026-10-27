// llamadas-unicas-logic.js — Llamadas Unicas de Mobilize (Fase 138, PR3,
// pedido de Edwin 09/10/2026). Logica PURA (sin DOM) de parseo del archivo
// real (export de Wolkvox, CDR → "1. Detalle de las llamadas" para
// contestadas + Skills & Servicios → "2. Llamadas abandonadas", unificados
// por Edwin en una sola plantilla con columnas AGENT_NAME, DATE, TELEPHONE,
// SKILL_NAME). Doble modo: global en el navegador, require() en Node para
// las pruebas (server/tests/fase138-pr3-llamadas-unicas-*.test.js).
//
// PRIVACIDAD (dura, pedido explicito de Edwin/el usuario): TELEPHONE se lee
// SOLO para deduplicar por (dia, telefono) EN MEMORIA, aqui mismo -- nunca
// sale de esta funcion. El array de salida (ver LLAMADAS_UNICAS_ORDEN_ARRAY)
// NO tiene un campo de telefono; nadie mas en el codigo (cargas.js,
// llamadas-unicas.js del servidor, la tabla `llamadas_unicas`) lo vuelve a
// tocar. "Unica" = un mismo numero cuenta UNA SOLA VEZ POR DIA (puede llamar
// 2 veces el mismo dia; dias distintos SI cuentan por separado).
'use strict';

var _llamadasUnicasFechaLimites = (typeof require === 'function') ? require('./fecha-limites-logic.js') : (typeof window !== 'undefined' ? window : this);

// Fase 163 (reunion con Edwin, 21/10): la COLUMNA AGENT_NAME sigue siendo
// obligatoria, pero el VALOR no. Edwin arma el archivo con dos reportes de
// Wolkvox: las contestadas del CDR (traen asesor) y las abandonadas de
// "Skill y servicios, numeral 2: Detalle llamadas abandonadas" (skill,
// telefono y dia, SIN asesor). Una fila sin asesor es una abandonada y se
// carga con el asesor vacio (antes se omitia).
var LLAMADAS_UNICAS_COLUMNAS = [
  { key: 'agente', label: 'AGENT_NAME', obligatoria: true },
  { key: 'fecha', label: 'DATE', obligatoria: true },
  { key: 'telefono', label: 'TELEPHONE', obligatoria: true },
  { key: 'skill', label: 'SKILL_NAME', obligatoria: true },
];
var LLAMADAS_UNICAS_COLUMNAS_OBLIGATORIAS = LLAMADAS_UNICAS_COLUMNAS.filter(function (c) { return c.obligatoria; });
// Orden fijo del payload compacto (array, no objeto) -- debe coincidir
// EXACTO con CAMPOS_FILA (server/llamadas-unicas.js) y con
// llamadasUnicasFilaArraySchema (server/validation.js). A proposito, NO
// incluye 'telefono'.
var LLAMADAS_UNICAS_ORDEN_ARRAY = ['agente', 'fecha', 'tipo', 'skill'];

// SKILL_NAME = "NO CONTESTADAS" (comparacion insensible a mayusculas/
// acentos/espacios). Hasta la Fase 141 marcaba una llamada abandonada; desde
// la Fase 142 se RECHAZA (ver llamadasUnicasParseFilas): son llamadas de
// salida no conectadas y van en "Llamadas de salida". Las abandonadas
// entrantes siguen sin fuente definida por Edwin -- el servidor sigue
// aceptando tipo ABANDONADA y la etiqueta "Abandonadas" para cuando la haya.
function _llamadasUnicasNormalizarParaComparar(s) {
  return String(s == null ? '' : s)
    .trim()
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // quita acentos (marcas combinantes tras NFD)
    .replace(/\s+/g, ' ');
}
var LLAMADAS_UNICAS_SKILL_ABANDONADA = 'no contestadas';
var LLAMADAS_UNICAS_SKILL_ABANDONADA_ETIQUETA = 'Abandonadas';
var LLAMADAS_UNICAS_MSG_NO_CONTESTADAS = 'NO CONTESTADAS es una llamada de SALIDA no conectada; cárgala en Llamadas de salida.';

function llamadasUnicasNormTexto(v) {
  return String(v == null ? '' : v).trim().replace(/\s+/g, ' ');
}

function llamadasUnicasColIndexMap(headerRow) {
  var map = {};
  (headerRow || []).forEach(function (h, i) {
    var n = llamadasUnicasNormTexto(h).toLowerCase();
    var col = LLAMADAS_UNICAS_COLUMNAS.filter(function (c) { return c.label.toLowerCase() === n; })[0];
    if (col && map[col.key] === undefined) map[col.key] = i;
  });
  return map;
}

// DATE: texto "dd/mm/aaaa" o serial de Excel (fecha, sin hora) -- mismo
// criterio que tipificacionParseFecha (tipificacion-logic.js), duplicado a
// proposito (mismo criterio ya establecido en el repo para estos "archivos
// gemelos" de Wolkvox).
//
// Fase 139 (hallazgo real, ensayo local de la carga de septiembre): la
// pantalla de carga lee el Excel con sheetStubs/cellNF (cargas.js), y con
// esas opciones SheetJS entrega la DATE del archivo real de Wolkvox como
// objeto `Date` nativo -- antes solo se leia number/string, asi que las 139
// filas quedaban "DATE invalida" y la carga no tenia ninguna fila. Mismo bug
// y mismo arreglo que Inasistencia (_inasistenciaFechaDesdeDateLocal,
// inasistencia-logic.js): getters LOCALES (nunca getUTC*), porque SheetJS
// arma ese Date con el reloj local del navegador.
function _llamadasUnicasFechaDesdeDateLocal(d) {
  if (isNaN(d.getTime())) return null;
  var y = d.getFullYear();
  if (y < 1970 || y > 2200) return null;
  var pad2 = function (x) { return (x < 10 ? '0' : '') + x; };
  return y + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}

function llamadasUnicasParseFecha(v) {
  if (v instanceof Date) return _llamadasUnicasFechaDesdeDateLocal(v);
  if (typeof v === 'number') {
    var n = Math.floor(v);
    var ms = Math.round((n - 25569) * 86400000);
    var d = new Date(ms);
    if (isNaN(d.getTime())) return null;
    var y = d.getUTCFullYear();
    if (y < 1970 || y > 2200) return null;
    var pad2 = function (x) { return (x < 10 ? '0' : '') + x; };
    return y + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate());
  }
  if (typeof v === 'string') {
    var t = v.trim();
    if (t === '') return null;
    // Fase 163: DATE con hora (Llamadas de Salida). Con zona (ISO "Z" o
    // "+hh:mm") se pasa a la hora de Colombia (UTC-5, sin horario de
    // verano); sin zona, la hora ya es la local y el dia es el que dice.
    var iso = /^(\d{4}-\d{2}-\d{2})[T ](\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?\s*(Z|[+-]\d{2}:?\d{2})?$/i.exec(t);
    if (iso) {
      if (!iso[5]) return iso[1];
      var ms0 = Date.parse(t.replace(' ', 'T'));
      if (isNaN(ms0)) return null;
      return new Date(ms0 - 5 * 3600 * 1000).toISOString().slice(0, 10);
    }
    t = t.replace(/\s+\d{1,2}:\d{2}(:\d{2})?(\s*[ap]\.?\s*m\.?)?$/i, '');
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
    var m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
    if (!m) return null;
    var dd = parseInt(m[1], 10), mm = parseInt(m[2], 10), aaaa = parseInt(m[3], 10);
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
    var pad2b = function (x) { return (x < 10 ? '0' : '') + x; };
    return aaaa + '-' + pad2b(mm) + '-' + pad2b(dd);
  }
  return null;
}

// Telefono: SOLO para la clave de deduplicado -- normalizado (quita
// espacios/guiones) para que "300 123 4567" y "3001234567" cuenten como el
// MISMO numero. Nunca se devuelve en las filas de salida.
function _llamadasUnicasNormalizarTelefono(v) {
  return String(v == null ? '' : v).replace(/[^0-9]/g, '');
}

// ── Parseo de filas (aoa = array-of-arrays, fila 0 = encabezados) ───────
// Devuelve { error } si falta una columna obligatoria (incluida TELEPHONE,
// aunque su valor nunca se guarde -- hace falta para deduplicar) -- NUNCA
// vuelca filas parciales en ese caso. Si no, { filas, avisos, duplicadosQuitados }.
function llamadasUnicasParseFilas(aoa) {
  if (!aoa || !aoa.length) return { error: 'El archivo esta vacio.' };
  var map = llamadasUnicasColIndexMap(aoa[0]);
  var faltantes = LLAMADAS_UNICAS_COLUMNAS_OBLIGATORIAS.filter(function (c) { return map[c.key] === undefined; });
  if (faltantes.length) {
    return {
      error: 'Faltan columnas obligatorias: ' + faltantes.map(function (c) { return c.label; }).join(', ') + '.',
    };
  }

  var crudas = [];
  var avisos = [];
  var filasNoContestadas = [];
  for (var i = 1; i < aoa.length; i++) {
    var row = aoa[i];
    if (!row || row.every(function (v) { return v === '' || v === null || v === undefined; })) continue;
    var filaNum = i + 1;

    var agente = llamadasUnicasNormTexto(row[map.agente]);
    var skillCrudo = llamadasUnicasNormTexto(row[map.skill]);
    var telefono = _llamadasUnicasNormalizarTelefono(row[map.telefono]);
    var fecha = llamadasUnicasParseFecha(row[map.fecha]);

    if (!skillCrudo) {
      avisos.push('Fila ' + filaNum + ': falta un dato obligatorio (skill), se omitio.');
      continue;
    }
    if (!fecha) {
      avisos.push('Fila ' + filaNum + ': DATE invalida o vacia, se omitio.');
      continue;
    }
    if (!telefono) {
      avisos.push('Fila ' + filaNum + ': TELEPHONE invalido o vacio, se omitio.');
      continue;
    }
    if (_llamadasUnicasFechaLimites.fechaLimitesEsFutura(fecha)) {
      avisos.push('Fila ' + filaNum + ': DATE ' + fecha + ' esta en el futuro, se omitio.');
      continue;
    }

    // Fase 142 (decision del usuario, 13/10/2026): SKILL_NAME = NO
    // CONTESTADAS ya NO se interpreta como abandonada -- en septiembre esas
    // filas eran llamadas de SALIDA no conectadas (Fase 141, Parte B). Se
    // juntan aqui y, si hay alguna, el archivo completo se rechaza abajo.
    if (_llamadasUnicasNormalizarParaComparar(skillCrudo) === LLAMADAS_UNICAS_SKILL_ABANDONADA) {
      filasNoContestadas.push(filaNum);
      continue;
    }
    crudas.push({
      agente: agente,
      fecha: fecha,
      telefono: telefono,
      tipo: agente ? 'CONTESTADA' : 'ABANDONADA', // Fase 163: sin asesor = abandonada
      skill: skillCrudo,
    });
  }

  // Opcion mas segura (Fase 142): una sola fila NO CONTESTADAS bloquea la
  // hoja completa (nunca una carga parcial que deje el mes a medias). La
  // vista previa muestra el error y "Guardar" no envia esta hoja.
  if (filasNoContestadas.length) {
    var muestra = filasNoContestadas.slice(0, 10).join(', ') + (filasNoContestadas.length > 10 ? '…' : '');
    return {
      error: LLAMADAS_UNICAS_MSG_NO_CONTESTADAS + ' (' + filasNoContestadas.length + ' fila(s): ' + muestra + ')',
    };
  }

  // Deduplicado por (dia, telefono, tipo) -- "unica" = una sola vez por dia,
  // sin importar cuantas veces llamo ese numero ESE dia; el mismo numero en
  // un dia DISTINTO cuenta aparte. Fase 163: contestadas y abandonadas se
  // cuentan por separado (mismo criterio que Llamadas de salida); cuantos
  // dia+telefono aparecen en los dos tipos solo se informa. Se conserva la
  // PRIMERA fila de cada grupo (orden estable); el telefono NUNCA llega a
  // `filas` (solo existio para esta clave, en memoria, hasta aqui).
  var vistos = {};
  var tiposPorDiaTel = {};
  var filas = [];
  var duplicadosQuitados = 0;
  var contestadas = 0, abandonadas = 0;
  crudas.forEach(function (f) {
    var diaTel = f.fecha + '|' + f.telefono;
    tiposPorDiaTel[diaTel] = tiposPorDiaTel[diaTel] || {};
    tiposPorDiaTel[diaTel][f.tipo] = true;
    var clave = diaTel + '|' + f.tipo;
    if (vistos[clave]) { duplicadosQuitados++; return; }
    vistos[clave] = true;
    if (f.tipo === 'ABANDONADA') abandonadas++; else contestadas++;
    filas.push([f.agente, f.fecha, f.tipo, f.skill]);
  });
  var telefonosEnAmbosTipos = Object.keys(tiposPorDiaTel).filter(function (k) {
    return tiposPorDiaTel[k].CONTESTADA && tiposPorDiaTel[k].ABANDONADA;
  }).length;

  return { filas: filas, avisos: avisos, duplicadosQuitados: duplicadosQuitados, contestadas: contestadas, abandonadas: abandonadas, telefonosEnAmbosTipos: telefonosEnAmbosTipos };
}

// ── Fase 191: "Detalle de llamadas abandonadas" de Wolkvox, tal cual ──────
// El reporte (Skills y servicios, hoja "HistQueue<fecha>") trae CONN_ID,
// SKILL_ID, SKILL_NAME, DATE, RESULT, ANI, ABANDON_TIME, TYPE_INTERACTION y
// CUSTOMER_ID. Se usan DATE, ANI (el telefono, SOLO en memoria para la clave
// dia+telefono) y SKILL_NAME -- obligatorias --, y RESULT/TYPE_INTERACTION,
// si vienen, para no contar una fila que no sea una abandonada de ingreso.
// CONN_ID, CUSTOMER_ID, SKILL_ID y ABANDON_TIME no se leen.
var LLAMADAS_ABANDONADAS_COLUMNAS = [
  { key: 'fecha', label: 'DATE', obligatoria: true },
  { key: 'telefono', label: 'ANI', obligatoria: true },
  { key: 'skill', label: 'SKILL_NAME', obligatoria: true },
  { key: 'resultado', label: 'RESULT', obligatoria: false },
  { key: 'tipoInteraccion', label: 'TYPE_INTERACTION', obligatoria: false },
];
// Orden fijo de la fila que va al servidor (= CAMPOS_FILA_ABANDONADAS de
// server/llamadas-unicas.js). Sin telefono, a proposito.
var LLAMADAS_ABANDONADAS_ORDEN_ARRAY = ['fecha', 'skill'];

function llamadasAbandonadasColIndexMap(headerRow) {
  var map = {};
  (headerRow || []).forEach(function (h, i) {
    var n = llamadasUnicasNormTexto(h).toUpperCase();
    LLAMADAS_ABANDONADAS_COLUMNAS.forEach(function (c) { if (c.label === n && map[c.key] === undefined) map[c.key] = i; });
  });
  return map;
}

// { error } si falta una columna obligatoria; si no, { filas, avisos,
// duplicadosQuitados, abandonadas, columnasUsadas }. Unica = un telefono una
// sola vez por dia (dias distintos cuentan aparte), igual que las contestadas.
function llamadasAbandonadasParseFilas(aoa) {
  if (!aoa || !aoa.length) return { error: 'El archivo esta vacio.' };
  var map = llamadasAbandonadasColIndexMap(aoa[0]);
  var faltantes = LLAMADAS_ABANDONADAS_COLUMNAS.filter(function (c) { return c.obligatoria && map[c.key] === undefined; });
  if (faltantes.length) {
    return { error: 'Faltan columnas obligatorias: ' + faltantes.map(function (c) { return c.label; }).join(', ') + '. Sube el reporte "Detalle de llamadas abandonadas" de Wolkvox tal cual.' };
  }
  var avisos = [];
  var noAbandono = 0, deSalida = 0;
  var vistos = {};
  var filas = [];
  var duplicadosQuitados = 0;
  for (var i = 1; i < aoa.length; i++) {
    var row = aoa[i];
    if (!row || row.every(function (v) { return v === '' || v === null || v === undefined; })) continue;
    var filaNum = i + 1;
    var fecha = llamadasUnicasParseFecha(row[map.fecha]);
    var telefono = _llamadasUnicasNormalizarTelefono(row[map.telefono]);
    var skill = llamadasUnicasNormTexto(row[map.skill]);
    if (!fecha) { avisos.push('Fila ' + filaNum + ': DATE invalida o vacia, se omitio.'); continue; }
    if (!telefono) { avisos.push('Fila ' + filaNum + ': ANI invalido o vacio, se omitio.'); continue; }
    if (!skill) { avisos.push('Fila ' + filaNum + ': falta SKILL_NAME, se omitio.'); continue; }
    if (_llamadasUnicasFechaLimites.fechaLimitesEsFutura(fecha)) { avisos.push('Fila ' + filaNum + ': DATE ' + fecha + ' esta en el futuro, se omitio.'); continue; }
    if (map.resultado !== undefined && llamadasUnicasNormTexto(row[map.resultado]).toUpperCase() !== 'ABANDON') { noAbandono++; continue; }
    if (map.tipoInteraccion !== undefined) {
      var tipo = llamadasUnicasNormTexto(row[map.tipoInteraccion]).toLowerCase();
      if (tipo && tipo !== 'inbound') { deSalida++; continue; }
    }
    var clave = fecha + '|' + telefono;
    if (vistos[clave]) { duplicadosQuitados++; continue; }
    vistos[clave] = true;
    filas.push([fecha, skill]);
  }
  if (noAbandono) avisos.push(noAbandono + ' fila(s) con RESULT distinto de ABANDON, no se contaron.');
  if (deSalida) avisos.push(deSalida + ' fila(s) que no son de ingreso (TYPE_INTERACTION distinto de inbound), no se contaron.');
  if (!filas.length) return { error: 'Ninguna llamada abandonada valida en el archivo.', avisos: avisos };
  var columnasUsadas = LLAMADAS_ABANDONADAS_COLUMNAS.filter(function (c) { return map[c.key] !== undefined; }).map(function (c) { return c.label; });
  return { filas: filas, avisos: avisos, duplicadosQuitados: duplicadosQuitados, abandonadas: filas.length, columnasUsadas: columnasUsadas };
}

// Fase 191: de donde sale cada parte de un mes (tabla del panel). `m` es una
// fila de /calidad/llamadas-unicas/por-mes o de /calidad/llamadas-salida/por-mes.
var LLAMADAS_UNICAS_FUENTE_TEXTO = {
  CDR: 'CDR',
  ABANDONADAS: 'reporte de abandonadas',
  PLANTILLA: 'Carga anterior',
  MIXTA: 'CDR y carga anterior',
  NO_CONECTADAS: 'reporte de no conectadas', // Fase 194
};
function llamadasUnicasFuenteMes(m) {
  var t = function (f, vacio) { return (f && LLAMADAS_UNICAS_FUENTE_TEXTO[f]) || vacio; };
  return 'Contestadas: ' + t(m && m.fuenteContestadas, 'sin cargar') + ' · Abandonadas: ' + t(m && m.fuenteAbandonadas, 'sin cargar');
}
// Fase 194: conectadas y no conectadas pueden salir de bases distintas.
function llamadasSalidaFuenteMes(m) {
  var t = function (f) { return LLAMADAS_UNICAS_FUENTE_TEXTO[f] || LLAMADAS_UNICAS_FUENTE_TEXTO.PLANTILLA; };
  var con = t(m && m.fuente);
  if (m && m.noConectadas === null) return 'Conectadas: ' + con + ' · No conectadas: falta su base';
  return 'Conectadas: ' + con + ' · No conectadas: ' + t((m && m.fuenteNoConectadas) || (m && m.fuente));
}

// Doble modo: global en el navegador, require() en Node para las pruebas.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    llamadasUnicasFuenteMes: llamadasUnicasFuenteMes,
    llamadasSalidaFuenteMes: llamadasSalidaFuenteMes,
    LLAMADAS_ABANDONADAS_COLUMNAS: LLAMADAS_ABANDONADAS_COLUMNAS,
    LLAMADAS_ABANDONADAS_ORDEN_ARRAY: LLAMADAS_ABANDONADAS_ORDEN_ARRAY,
    llamadasAbandonadasColIndexMap: llamadasAbandonadasColIndexMap,
    llamadasAbandonadasParseFilas: llamadasAbandonadasParseFilas,
    LLAMADAS_UNICAS_COLUMNAS: LLAMADAS_UNICAS_COLUMNAS,
    LLAMADAS_UNICAS_ORDEN_ARRAY: LLAMADAS_UNICAS_ORDEN_ARRAY,
    LLAMADAS_UNICAS_SKILL_ABANDONADA_ETIQUETA: LLAMADAS_UNICAS_SKILL_ABANDONADA_ETIQUETA,
    LLAMADAS_UNICAS_MSG_NO_CONTESTADAS: LLAMADAS_UNICAS_MSG_NO_CONTESTADAS,
    llamadasUnicasColIndexMap: llamadasUnicasColIndexMap,
    llamadasUnicasParseFecha: llamadasUnicasParseFecha,
    llamadasUnicasParseFilas: llamadasUnicasParseFilas,
  };
}
