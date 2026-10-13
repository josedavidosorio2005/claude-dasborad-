// llamadas-salida-logic.js — Llamadas de salida de Mobilize (Fase 141, Parte
// C, reunion con Edwin del 13/10/2026). Logica PURA (sin DOM) de parseo del
// archivo real de Wolkvox con columnas AGENT_NAME, DATE, TELEPHONE,
// DESCRIPTION_COD_ACT (tipificacion) y SKILL_ID ("LLAMADAS DE SALIDA
// CONECTADAS" / "LLAMADAS DE SALIDA NO CONECTADAS"). Doble modo: global en
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
  { key: 'tipo', label: 'SKILL_ID', obligatoria: true },
];
// Orden fijo del payload compacto (array, no objeto) -- debe coincidir EXACTO
// con CAMPOS_FILA (server/llamadas-salida.js) y con
// llamadasSalidaFilaArraySchema (server/validation.js). A proposito, NO
// incluye 'telefono'.
var LLAMADAS_SALIDA_ORDEN_ARRAY = ['agente', 'fecha', 'tipo', 'tipificacion'];

// SKILL_ID -> tipo guardado. Comparacion insensible a mayusculas/acentos/
// espacios repetidos; cualquier otro valor se rechaza con aviso.
var LLAMADAS_SALIDA_TIPOS = {
  'llamadas de salida conectadas': 'CONECTADA',
  'llamadas de salida no conectadas': 'NO_CONECTADA',
};

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
    var col = LLAMADAS_SALIDA_COLUMNAS.filter(function (c) { return c.label.toLowerCase() === n; })[0];
    if (col && map[col.key] === undefined) map[col.key] = i;
  });
  return map;
}

function _llamadasSalidaNormalizarTelefono(v) {
  return String(v == null ? '' : v).replace(/[^0-9]/g, '');
}

// Devuelve { error } si falta una columna obligatoria (nunca filas parciales
// en ese caso). Si no: { filas, avisos, duplicadosQuitados,
// telefonosEnAmbosTipos } -- este ultimo SOLO se reporta (cuantos pares
// dia+telefono aparecen como conectada Y como no conectada el mismo dia),
// no se resuelve.
function llamadasSalidaParseFilas(aoa) {
  if (!aoa || !aoa.length) return { error: 'El archivo esta vacio.' };
  var map = llamadasSalidaColIndexMap(aoa[0]);
  var faltantes = LLAMADAS_SALIDA_COLUMNAS.filter(function (c) { return c.obligatoria && map[c.key] === undefined; });
  if (faltantes.length) {
    return { error: 'Faltan columnas obligatorias: ' + faltantes.map(function (c) { return c.label; }).join(', ') + '.' };
  }

  var crudas = [];
  var avisos = [];
  for (var i = 1; i < aoa.length; i++) {
    var row = aoa[i];
    if (!row || row.every(function (v) { return v === '' || v === null || v === undefined; })) continue;
    var filaNum = i + 1;

    var agente = llamadasSalidaNormTexto(row[map.agente]);
    var tipificacion = llamadasSalidaNormTexto(row[map.tipificacion]);
    var skillId = llamadasSalidaNormTexto(row[map.tipo]);
    var telefono = _llamadasSalidaNormalizarTelefono(row[map.telefono]);
    var fecha = _llamadasSalidaUnicas.llamadasUnicasParseFecha(row[map.fecha]);

    var tipo = LLAMADAS_SALIDA_TIPOS[_llamadasSalidaNormalizarParaComparar(skillId)];
    if (!tipo) {
      avisos.push('Fila ' + filaNum + ': SKILL_ID "' + skillId + '" no es "LLAMADAS DE SALIDA CONECTADAS" ni "LLAMADAS DE SALIDA NO CONECTADAS", se omitio.');
      continue;
    }
    if (!agente) {
      avisos.push('Fila ' + filaNum + ': falta AGENT_NAME, se omitio.');
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
    if (_llamadasSalidaFechaLimites.fechaLimitesEsFutura(fecha)) {
      avisos.push('Fila ' + filaNum + ': DATE ' + fecha + ' esta en el futuro, se omitio.');
      continue;
    }
    crudas.push({ agente: agente, fecha: fecha, telefono: telefono, tipo: tipo, tipificacion: tipificacion || 'Sin tipificación' });
  }

  // "Unica" = una sola vez por (dia, telefono, tipo): el mismo numero el
  // mismo dia cuenta una vez como conectada y/o una vez como no conectada.
  // Se conserva la PRIMERA fila de cada grupo (orden estable).
  var vistos = {};
  var tiposPorDiaTel = {};
  var filas = [];
  var duplicadosQuitados = 0;
  crudas.forEach(function (f) {
    var diaTel = f.fecha + '|' + f.telefono;
    var clave = diaTel + '|' + f.tipo;
    tiposPorDiaTel[diaTel] = tiposPorDiaTel[diaTel] || {};
    tiposPorDiaTel[diaTel][f.tipo] = true;
    if (vistos[clave]) { duplicadosQuitados++; return; }
    vistos[clave] = true;
    filas.push([f.agente, f.fecha, f.tipo, f.tipificacion]);
  });
  var telefonosEnAmbosTipos = Object.keys(tiposPorDiaTel).filter(function (k) {
    return tiposPorDiaTel[k].CONECTADA && tiposPorDiaTel[k].NO_CONECTADA;
  }).length;

  return { filas: filas, avisos: avisos, duplicadosQuitados: duplicadosQuitados, telefonosEnAmbosTipos: telefonosEnAmbosTipos };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    LLAMADAS_SALIDA_COLUMNAS: LLAMADAS_SALIDA_COLUMNAS,
    LLAMADAS_SALIDA_ORDEN_ARRAY: LLAMADAS_SALIDA_ORDEN_ARRAY,
    llamadasSalidaColIndexMap: llamadasSalidaColIndexMap,
    llamadasSalidaParseFilas: llamadasSalidaParseFilas,
  };
}
