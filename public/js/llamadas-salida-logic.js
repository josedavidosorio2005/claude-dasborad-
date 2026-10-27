// llamadas-salida-logic.js — Llamadas de salida de Mobilize (Fase 141, Parte
// C, reunion con Edwin del 13/10/2026). Logica PURA (sin DOM) de parseo del
// archivo real de Wolkvox con columnas AGENT_NAME, DATE, TELEPHONE,
// DESCRIPTION_COD_ACT (tipificacion) y TIPO ("Conectada" / "No conectada"),
// la plantilla que armo Edwin (Fase 163): las conectadas salen del CDR y las
// no conectadas del reporte "Detalle de llamadas no conectadas" (numeral 5).
// La plantilla vieja con SKILL_ID ("LLAMADAS DE SALIDA CONECTADAS" / "NO
// CONECTADAS") se sigue aceptando. Doble modo: global en
// el navegador, require() en Node para las pruebas
// (server/tests/fase141-llamadas-salida-*.test.js).
//
// PRIVACIDAD (mismo criterio que llamadas-unicas-logic.js): TELEPHONE se lee
// SOLO para deduplicar por (dia, telefono, tipo) EN MEMORIA, aqui mismo --
// nunca sale de esta funcion. El array de salida (ver
// LLAMADAS_SALIDA_ORDEN_ARRAY) NO tiene un campo de telefono, y la tabla
// `llamadas_salida` del servidor no tiene esa columna.
'use strict';

var _llamadasSalidaUnicas = (typeof require === 'function') ? require('./llamadas-unicas-logic.js') : (typeof window !== 'undefined' ? window : this);
var _llamadasSalidaFechaLimites = (typeof require === 'function') ? require('./fecha-limites-logic.js') : (typeof window !== 'undefined' ? window : this);

var LLAMADAS_SALIDA_COLUMNAS = [
  { key: 'agente', label: 'AGENT_NAME', obligatoria: true },
  { key: 'fecha', label: 'DATE', obligatoria: true },
  { key: 'telefono', label: 'TELEPHONE', obligatoria: true },
  { key: 'tipificacion', label: 'DESCRIPTION_COD_ACT', obligatoria: true },
  { key: 'tipo', label: 'TIPO', obligatoria: true, aliases: ['SKILL_ID'] },
];
// Orden fijo del payload compacto (array, no objeto) -- debe coincidir EXACTO
// con CAMPOS_FILA (server/llamadas-salida.js) y con
// llamadasSalidaFilaArraySchema (server/validation.js). A proposito, NO
// incluye 'telefono'.
var LLAMADAS_SALIDA_ORDEN_ARRAY = ['agente', 'fecha', 'tipo', 'tipificacion'];

// SKILL_ID -> tipo guardado. Comparacion insensible a mayusculas/acentos/
// espacios repetidos; cualquier otro valor se rechaza con aviso.
var LLAMADAS_SALIDA_TIPOS = {
  'conectada': 'CONECTADA',
  'no conectada': 'NO_CONECTADA',
  'llamadas de salida conectadas': 'CONECTADA',
  'llamadas de salida no conectadas': 'NO_CONECTADA',
};
// Fase 163: DESCRIPTION_COD_ACT "-" (o vacio) = sin tipificacion.
function _llamadasSalidaTipificacion(t) {
  return !t || /^-+$/.test(t) ? 'Sin tipificación' : t;
}

function _llamadasSalidaNormalizarParaComparar(s) {
  return String(s == null ? '' : s)
    .trim()
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ');
}

function llamadasSalidaNormTexto(v) {
  return String(v == null ? '' : v).trim().replace(/\s+/g, ' ');
}

// Encabezados sin importar mayusculas/espacios (igual que el parser de
// ingreso: "agent_name", " DATE " y "Agent_Name" valen lo mismo).
function llamadasSalidaColIndexMap(headerRow) {
  var map = {};
  (headerRow || []).forEach(function (h, i) {
    var n = llamadasSalidaNormTexto(h).toLowerCase().replace(/\s+/g, '_');
    var col = LLAMADAS_SALIDA_COLUMNAS.filter(function (c) {
      return [c.label].concat(c.aliases || []).some(function (l) { return l.toLowerCase() === n; });
    })[0];
    if (col && map[col.key] === undefined) map[col.key] = i;
  });
  return map;
}

function _llamadasSalidaNormalizarTelefono(v) {
  return String(v == null ? '' : v).replace(/[^0-9]/g, '');
}

// Fase 171 (pedido de Edwin, archivo de octubre de Mobilize: 85 filas, 45
// conectadas y 40 no conectadas, y la vista previa tomaba 54): cada fila del
// archivo es UNA llamada de salida. Antes se dejaba una sola por (dia,
// telefono, tipo) -- 28 filas reales se perdian -- y una fila sin
// AGENT_NAME se omitia (3 filas). Ahora:
//   - solo se omiten las filas totalmente vacias y las que no se pueden
//     ubicar (sin DATE valida, con DATE futura o con un TIPO que no es
//     conectada/no conectada), con UN aviso agrupado por motivo;
//   - sin AGENT_NAME se carga como "Sin asesor" (un aviso agrupado);
//   - TIPO acepta mayusculas, acentos, guion/guion bajo, plural y "noconectada".
// TELEPHONE se sigue leyendo solo para contar (en memoria) cuantos numeros
// aparecen el mismo dia como conectada Y no conectada; nunca sale de aqui.
var LLAMADAS_SALIDA_SIN_ASESOR = 'Sin asesor';

function llamadasSalidaTipoDe(valor) {
  var n = _llamadasSalidaNormalizarParaComparar(valor)
    .replace(/[-_.\/]+/g, ' ').replace(/\s+/g, ' ').trim()
    .replace(/\bnoconectadas?\b/g, 'no conectada')
    .replace(/\bconectadas\b/g, 'conectada');
  return LLAMADAS_SALIDA_TIPOS[n] || LLAMADAS_SALIDA_TIPOS[n.replace(/^llamadas de salida /, '')] || null;
}

function _llamadasSalidaListaFilas(nums) {
  var muestra = nums.slice(0, 5).join(', ');
  return nums.length > 5 ? muestra + ' y ' + (nums.length - 5) + ' más' : muestra;
}

// Devuelve { error } si falta una columna obligatoria (nunca filas parciales
// en ese caso). Si no: { filas, avisos, sinAsesor, telefonosEnAmbosTipos }.
function llamadasSalidaParseFilas(aoa) {
  if (!aoa || !aoa.length) return { error: 'El archivo esta vacio.' };
  var map = llamadasSalidaColIndexMap(aoa[0]);
  var faltantes = LLAMADAS_SALIDA_COLUMNAS.filter(function (c) { return c.obligatoria && map[c.key] === undefined; });
  if (faltantes.length) {
    return { error: 'Faltan columnas obligatorias: ' + faltantes.map(function (c) { return c.label; }).join(', ') + '.' };
  }

  var filas = [];
  var avisos = [];
  var omitidas = { tipo: [], fecha: [], futura: [] };
  var sinAsesor = [];
  var tiposPorDiaTel = {};
  for (var i = 1; i < aoa.length; i++) {
    var row = aoa[i];
    if (!row || row.every(function (v) { return v === '' || v === null || v === undefined || (typeof v === 'string' && v.trim() === ''); })) continue;
    var filaNum = i + 1;

    var agente = llamadasSalidaNormTexto(row[map.agente]);
    var tipificacion = llamadasSalidaNormTexto(row[map.tipificacion]);
    var telefono = _llamadasSalidaNormalizarTelefono(row[map.telefono]);
    var fecha = _llamadasSalidaUnicas.llamadasUnicasParseFecha(row[map.fecha]);
    var tipo = llamadasSalidaTipoDe(row[map.tipo]);

    if (!tipo) { omitidas.tipo.push(filaNum); continue; }
    if (!fecha) { omitidas.fecha.push(filaNum); continue; }
    if (_llamadasSalidaFechaLimites.fechaLimitesEsFutura(fecha)) { omitidas.futura.push(filaNum); continue; }
    if (!agente) { agente = LLAMADAS_SALIDA_SIN_ASESOR; sinAsesor.push(filaNum); }
    if (telefono) {
      var diaTel = fecha + '|' + telefono;
      tiposPorDiaTel[diaTel] = tiposPorDiaTel[diaTel] || {};
      tiposPorDiaTel[diaTel][tipo] = true;
    }
    filas.push([agente, fecha, tipo, _llamadasSalidaTipificacion(tipificacion)]);
  }

  if (omitidas.tipo.length) avisos.push(omitidas.tipo.length + ' fila(s) con un TIPO que no es "Conectada" ni "No conectada", se omitieron (filas ' + _llamadasSalidaListaFilas(omitidas.tipo) + ').');
  if (omitidas.fecha.length) avisos.push(omitidas.fecha.length + ' fila(s) con DATE invalida o vacia, se omitieron (filas ' + _llamadasSalidaListaFilas(omitidas.fecha) + ').');
  if (omitidas.futura.length) avisos.push(omitidas.futura.length + ' fila(s) con DATE en el futuro, se omitieron (filas ' + _llamadasSalidaListaFilas(omitidas.futura) + ').');
  if (sinAsesor.length) avisos.push(sinAsesor.length + ' fila(s) sin AGENT_NAME: se cargan como "' + LLAMADAS_SALIDA_SIN_ASESOR + '" (filas ' + _llamadasSalidaListaFilas(sinAsesor) + ').');
  var telefonosEnAmbosTipos = Object.keys(tiposPorDiaTel).filter(function (k) {
    return tiposPorDiaTel[k].CONECTADA && tiposPorDiaTel[k].NO_CONECTADA;
  }).length;
  return { filas: filas, avisos: avisos, sinAsesor: sinAsesor.length, telefonosEnAmbosTipos: telefonosEnAmbosTipos };
}

// ── Fase 194: "5. Detalle de las llamadas para las no conectadas" ─────────
// Reporte de Wolkvox (Reportes → CDR, hoja "HistCDR<fecha>") subido tal cual:
// AGENT_NAME, DATE, DESTINY, TELEPHONE, RING_TIME, RESULT, TYPE_INTERACTION,
// CUSTOMER_ID, CAMPAIGN_ID, AGENT_ID, CONN_ID. Se usan AGENT_NAME y DATE;
// RING_TIME y RESULT son obligatorias solo para reconocer el reporte (el CDR
// de Tipificacion no las trae). TELEPHONE y los demas datos nunca se leen.
// Cada fila es una llamada no conectada: NO se quitan repetidas.
var LLAMADAS_NO_CONECTADAS_COLUMNAS = [
  { key: 'agente', label: 'AGENT_NAME', obligatoria: true },
  { key: 'fecha', label: 'DATE', obligatoria: true },
  { key: 'ringTime', label: 'RING_TIME', obligatoria: true },
  { key: 'resultado', label: 'RESULT', obligatoria: true },
];
// Orden fijo de la fila que va al servidor (= CAMPOS_FILA_NO_CONECTADAS de
// server/llamadas-salida.js). Sin telefono, a proposito.
var LLAMADAS_NO_CONECTADAS_ORDEN_ARRAY = ['fecha', 'agente'];

function llamadasNoConectadasColIndexMap(headerRow) {
  var map = {};
  (headerRow || []).forEach(function (h, i) {
    var n = llamadasSalidaNormTexto(h).toUpperCase();
    LLAMADAS_NO_CONECTADAS_COLUMNAS.forEach(function (c) { if (c.label === n && map[c.key] === undefined) map[c.key] = i; });
  });
  return map;
}

// { error } si falta una columna obligatoria; si no, { filas, avisos,
// noConectadas, columnasUsadas, porMes }.
function llamadasNoConectadasParseFilas(aoa) {
  if (!aoa || !aoa.length) return { error: 'El archivo esta vacio.' };
  var map = llamadasNoConectadasColIndexMap(aoa[0]);
  var faltantes = LLAMADAS_NO_CONECTADAS_COLUMNAS.filter(function (c) { return map[c.key] === undefined; });
  if (faltantes.length) {
    return { error: 'Faltan columnas obligatorias: ' + faltantes.map(function (c) { return c.label; }).join(', ') + '. Sube el reporte "5. Detalle de las llamadas para las no conectadas" de Wolkvox tal cual.' };
  }
  var filas = [];
  var avisos = [];
  var porMes = {};
  var sinAsesor = 0;
  for (var i = 1; i < aoa.length; i++) {
    var row = aoa[i];
    if (!row || row.every(function (v) { return v === '' || v === null || v === undefined; })) continue;
    var filaNum = i + 1;
    var fecha = _llamadasSalidaUnicas.llamadasUnicasParseFecha(row[map.fecha]);
    if (!fecha) { avisos.push('Fila ' + filaNum + ': DATE invalida o vacia, se omitio.'); continue; }
    if (_llamadasSalidaFechaLimites.fechaLimitesEsFutura(fecha)) { avisos.push('Fila ' + filaNum + ': DATE ' + fecha + ' esta en el futuro, se omitio.'); continue; }
    var agente = llamadasSalidaNormTexto(row[map.agente]);
    if (!agente) { agente = LLAMADAS_SALIDA_SIN_ASESOR; sinAsesor++; }
    filas.push([fecha, agente.slice(0, 200)]);
    porMes[fecha.slice(0, 7)] = (porMes[fecha.slice(0, 7)] || 0) + 1;
  }
  if (sinAsesor) avisos.push(sinAsesor + ' fila(s) sin AGENT_NAME: se cargan como "' + LLAMADAS_SALIDA_SIN_ASESOR + '".');
  if (!filas.length) return { error: 'Ninguna llamada no conectada valida en el archivo.', avisos: avisos };
  return {
    filas: filas, avisos: avisos, noConectadas: filas.length, porMes: porMes,
    columnasUsadas: LLAMADAS_NO_CONECTADAS_COLUMNAS.map(function (c) { return c.label; }),
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    LLAMADAS_NO_CONECTADAS_COLUMNAS: LLAMADAS_NO_CONECTADAS_COLUMNAS,
    LLAMADAS_NO_CONECTADAS_ORDEN_ARRAY: LLAMADAS_NO_CONECTADAS_ORDEN_ARRAY,
    llamadasNoConectadasColIndexMap: llamadasNoConectadasColIndexMap,
    llamadasNoConectadasParseFilas: llamadasNoConectadasParseFilas,
    LLAMADAS_SALIDA_COLUMNAS: LLAMADAS_SALIDA_COLUMNAS,
    LLAMADAS_SALIDA_ORDEN_ARRAY: LLAMADAS_SALIDA_ORDEN_ARRAY,
    llamadasSalidaColIndexMap: llamadasSalidaColIndexMap,
    llamadasSalidaParseFilas: llamadasSalidaParseFilas,
    llamadasSalidaTipoDe: llamadasSalidaTipoDe,
    LLAMADAS_SALIDA_SIN_ASESOR: LLAMADAS_SALIDA_SIN_ASESOR,
  };
}
