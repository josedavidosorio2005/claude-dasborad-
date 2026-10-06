// efectividad-agendamiento-logic.js — InConexion Platform (Fase 111, ORLANT,
// pedido de Edwin: "el ranking va a ser efectividad por agendamiento").
//
// Logica PURA (sin DOM) de parseo de la hoja EFECTIVIDAD_AGENDAMIENTO.xlsx
// (por asesor, un mes a la vez): NOMBRE DE AGENTE, MES, CANTIDAD DE
// GESTIONES, AGENDAS, EFECTIVIDAD (=AGENDAS/GESTIONES, viene en el archivo
// pero NUNCA se guarda -- se recalcula siempre; si difiere de la del
// archivo se junta una advertencia para la confirmacion de la carga,
// mismo criterio de "nunca confiar en un derivado ya calculado" que el
// resto de esta plataforma). Doble modo: global en el navegador, require()
// en Node para las pruebas (server/tests/efectividad-agendamiento-logic.test.js).
//
// El archivo real de Edwin trae sus 2 primeras filas de Excel totalmente
// vacias (ninguna celda, ni siquiera vacia) y los encabezados en la fila 3
// -- SheetJS (`XLSX.utils.sheet_to_json(ws, {header:1, blankrows:false,
// defval:null})`, mismo patron que el resto de cargas.js) arma el array a
// partir del RANGO USADO de la hoja (`!ref`), asi que `aoa[0]` YA es la
// fila de encabezados sin importar en que fila real de Excel este -- nunca
// se asume que es la fila 1. Confirmado con el archivo real (A3:E23) y con
// una prueba que arma un workbook sintetico con esa misma forma (ver
// test).
'use strict';

var _eaMesNombre = (typeof require === 'function') ? require('./mes-nombre-logic.js') : (typeof window !== 'undefined' ? window : this);

// EFECTIVIDAD (5ta columna): no es obligatoria para reconocer la hoja (solo
// se usa, si esta presente, para comparar contra el recalculo) y nunca se
// pide en la plantilla descargable (`ocultaEnPlantilla`, mismo mecanismo
// que los campos ya "ocultaEnPlantilla" de Inasistencia/`resumen`).
var EFECTIVIDAD_AGENDAMIENTO_COLUMNAS = [
  { key: 'asesor', label: 'NOMBRE DE AGENTE', obligatoria: true },
  { key: 'mes', label: 'MES', obligatoria: true },
  { key: 'gestiones', label: 'CANTIDAD DE GESTIONES', obligatoria: true },
  { key: 'agendas', label: 'AGENDAS', obligatoria: true },
  { key: 'efectividadArchivo', label: 'EFECTIVIDAD', obligatoria: false, ocultaEnPlantilla: true },
];
// Orden fijo del payload compacto (arrays) -- debe coincidir EXACTO con
// server/efectividad-agendamiento.js (CAMPOS_FILA) y validation.js
// (efectividadAgendamientoFilaArraySchema).
var EFECTIVIDAD_AGENDAMIENTO_ORDEN_ARRAY = ['mes', 'asesor', 'gestiones', 'agendas'];

function _eaNorm(s) { return String(s == null ? '' : s).trim().toLowerCase(); }

function efectividadAgendamientoColIndexMap(headerRow) {
  var map = {};
  (headerRow || []).forEach(function (h, i) {
    var n = _eaNorm(h);
    var col = EFECTIVIDAD_AGENDAMIENTO_COLUMNAS.filter(function (c) { return _eaNorm(c.label) === n; })[0];
    if (col && map[col.key] === undefined) map[col.key] = i;
  });
  return map;
}

// Entero no negativo (celda numerica o texto numerico), o null si no aplica
// -- mismo criterio que _inasistenciaNumeroEntero.
function _eaNumeroEntero(v) {
  if (v === null || v === undefined || v === '') return null;
  var n = Number(v);
  if (!Number.isFinite(n)) return null;
  if (Math.round(n) !== n) return null;
  if (n < 0) return null;
  return n;
}

// Fase 122 (hallazgo real, EFECTIVIDAD_EN_AGENDAMIENTO_AGOSTO.xlsx): un
// asesor con efectividad > 100% (ej. SANTIAGO LONDOÑO RUA, 118%) guarda la
// celda EFECTIVIDAD como 1.180052956751986 con formato real de Excel "0%"
// -- la vieja regla "<=1 es fraccion, >1 ya es porcentaje" adivinaba mal
// para estos casos (1.18 > 1 se tomaba como "ya es porcentaje", dando 1.2%
// en vez de 118%, y la plataforma avisaba "no coincide con el recalculo"
// sobre un archivo que en realidad SI coincidia). Mismo patron ya
// establecido para esto en Trafico (traficoClasificarCeldaNumerica,
// trafico-logic.js, Fase 88): leer el FORMATO real de la celda (`z`
// contiene "%") en vez de adivinar por el valor.
//
// A diferencia de Trafico (header en la fila 1 de Excel), esta hoja trae
// sus 2 primeras filas de Excel totalmente vacias y los encabezados en la
// fila 3 (ver cabecera de este archivo) -- la celda cruda real de la fila
// `r` de `aoa` NO esta en la fila `r` de Excel, sino en
// (fila de inicio del rango usado de la hoja) + r. `_eaFilaExcelInicio` lee
// ws['!ref'] (ej. "A3:E22") con una expresion regular simple -- sin
// depender de la libreria XLSX aqui (este archivo es logica pura, sin DOM
// ni dependencias, para poder probarse con node:test sin cargar un
// navegador ni SheetJS).
function _eaFilaExcelInicio(ws) {
  var m = /^[A-Z]+(\d+):/.exec((ws && ws['!ref']) || '');
  return m ? parseInt(m[1], 10) : 1;
}
function _eaCeldaRef(ws, filaAoa0based, col0based) {
  var fila = _eaFilaExcelInicio(ws) + filaAoa0based;
  var col = '';
  var n = col0based;
  do {
    col = String.fromCharCode(65 + (n % 26)) + col;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return col + fila;
}
// 'porcentaje' si la celda es numerica (t:'n') y su formato (z) contiene
// "%" (guarda la FRACCION, se multiplica x100); 'numero' si es numerica sin
// ese formato; null sin informacion de formato (ws ausente, celda de
// texto/vacia) -- en null, _eaPctDesdeCelda cae al comportamiento de
// SIEMPRE (adivina por el valor, igual que antes de esta fase).
function _eaClasificarCeldaNumerica(ws, filaAoa0based, col0based) {
  if (!ws) return null;
  var cell = ws[_eaCeldaRef(ws, filaAoa0based, col0based)];
  if (!cell || cell.t !== 'n') return null;
  return (cell.z && cell.z.indexOf('%') !== -1) ? 'porcentaje' : 'numero';
}

// "97,36 %" / "97.36%" / 97.36 / 0.9736 (fraccion de formato % de Excel) ->
// 97.36 -- mismo criterio que _inasistenciaPctDesdeCelda.
// `clasificacion` (Fase 122, opcional): resultado de
// _eaClasificarCeldaNumerica para ESTA celda -- 'porcentaje' fuerza x100
// sin importar la magnitud (cubre > 100%); 'numero' toma el valor tal cual;
// sin clasificacion (ws ausente), sigue el criterio viejo "<=1 es fraccion"
// EXACTAMENTE igual que antes de esta fase (nunca cambia el resultado de
// una prueba vieja que no pasa `ws`).
function _eaPctDesdeCelda(v, clasificacion) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') {
    if (clasificacion === 'porcentaje') return Math.round(v * 1000) / 10;
    if (clasificacion === 'numero') return Math.round(v * 10) / 10;
    return Math.round((v <= 1 ? v * 100 : v) * 10) / 10;
  }
  var s = String(v).trim().replace('%', '').replace(',', '.').trim();
  if (s === '') return null;
  var n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : null;
}

// aoa = array-of-arrays ya resuelto por SheetJS (aoa[0] = encabezados, en
// la fila que sea del Excel original -- ver cabecera del archivo). Devuelve
// { error } si falta una columna obligatoria, o { filas, avisos,
// advertenciasEfectividad }.
// `ws` (Fase 122, opcional): worksheet CRUDO de SheetJS -- si viene, la
// columna EFECTIVIDAD usa su FORMATO real de celda para decidir si
// multiplicar x100 (ver _eaClasificarCeldaNumerica), cubriendo asesores con
// efectividad > 100%. Sin `ws`, el comportamiento es EXACTAMENTE igual al
// de siempre.
function efectividadAgendamientoParseFilas(aoa, ahora, ws) {
  var header = (aoa && aoa[0]) || [];
  var map = efectividadAgendamientoColIndexMap(header);
  var faltantes = EFECTIVIDAD_AGENDAMIENTO_COLUMNAS.filter(function (c) { return c.obligatoria && map[c.key] === undefined; });
  if (faltantes.length) {
    return { error: 'Faltan columnas obligatorias: ' + faltantes.map(function (c) { return c.label; }).join(', ') };
  }

  var filas = [];
  var avisos = [];
  var advertenciasEfectividad = [];
  for (var r = 1; r < (aoa || []).length; r++) {
    var row = aoa[r];
    if (!row || row.every(function (c) { return c === null || c === undefined || c === ''; })) continue;

    var asesor = String(row[map.asesor] == null ? '' : row[map.asesor]).trim().replace(/\s+/g, ' ');
    if (!asesor) { avisos.push('Fila ' + (r + 1) + ': sin NOMBRE DE AGENTE, se omite.'); continue; }

    var mes = _eaMesNombre.mesNombreAAAAMM(row[map.mes], null, ahora);
    if (!mes) { avisos.push('Fila ' + (r + 1) + ' (' + asesor + '): MES "' + row[map.mes] + '" no reconocido, se omite.'); continue; }

    var gestiones = _eaNumeroEntero(row[map.gestiones]);
    var agendas = _eaNumeroEntero(row[map.agendas]);
    if (gestiones === null || agendas === null) {
      avisos.push('Fila ' + (r + 1) + ' (' + asesor + '): CANTIDAD DE GESTIONES/AGENDAS invalido, se omite.');
      continue;
    }

    var efRecalcPct = gestiones > 0 ? Math.round((agendas / gestiones) * 1000) / 10 : 0;
    if (map.efectividadArchivo !== undefined) {
      var clasifEf = ws ? _eaClasificarCeldaNumerica(ws, r, map.efectividadArchivo) : null;
      var delArchivo = _eaPctDesdeCelda(row[map.efectividadArchivo], clasifEf);
      if (delArchivo !== null && delArchivo !== efRecalcPct) {
        advertenciasEfectividad.push(
          'Fila ' + (r + 1) + ' (' + asesor + '): EFECTIVIDAD del archivo (' + delArchivo +
          '%) no coincide con el recalculo (' + efRecalcPct + '%) -- se usa el recalculo.'
        );
      }
    }

    filas.push({ mes: mes, asesor: asesor, gestiones: gestiones, agendas: agendas });
  }
  return { filas: filas, avisos: avisos, advertenciasEfectividad: advertenciasEfectividad };
}

function efectividadAgendamientoFilaComoArray(f) {
  return EFECTIVIDAD_AGENDAMIENTO_ORDEN_ARRAY.map(function (k) { return f[k]; });
}

// Formato de % con 2 decimales y coma (control real: "44,81 %", "97,36 %",
// "12,18 %") -- mismo criterio que inasistenciaFmtPct, nunca el formato de
// 1 decimal de gdFmtValor(v,'%'). `v` viene como fraccion 0..1 (igual que
// `efectividad`/`equipo.efectividad` del servidor) -- se multiplica por
// 100 aqui, una sola vez, para que nadie mas tenga que acordarse.
function efectividadAgendamientoFmtPct(v) {
  if (v === null || v === undefined) return '—';
  return (v * 100).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' %';
}

// Meses distintos que trae el archivo (ordenados) -- el conjunto que la
// carga va a REEMPLAZAR, mismo criterio que inasistencia-logic.js.
function efectividadAgendamientoMesesDelArchivo(filas) {
  var set = {};
  (filas || []).forEach(function (f) { set[f.mes] = true; });
  return Object.keys(set).sort();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    EFECTIVIDAD_AGENDAMIENTO_COLUMNAS: EFECTIVIDAD_AGENDAMIENTO_COLUMNAS,
    EFECTIVIDAD_AGENDAMIENTO_ORDEN_ARRAY: EFECTIVIDAD_AGENDAMIENTO_ORDEN_ARRAY,
    efectividadAgendamientoColIndexMap: efectividadAgendamientoColIndexMap,
    _eaCeldaRef: _eaCeldaRef,
    _eaClasificarCeldaNumerica: _eaClasificarCeldaNumerica,
    _eaPctDesdeCelda: _eaPctDesdeCelda,
    efectividadAgendamientoParseFilas: efectividadAgendamientoParseFilas,
    efectividadAgendamientoFilaComoArray: efectividadAgendamientoFilaComoArray,
    efectividadAgendamientoFmtPct: efectividadAgendamientoFmtPct,
    efectividadAgendamientoMesesDelArchivo: efectividadAgendamientoMesesDelArchivo,
  };
}
