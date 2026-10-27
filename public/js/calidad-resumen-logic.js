// calidad-resumen-logic.js — InConexion Platform (Fase 172, pedido de Edwin).
// "Calidad: resumen por asesor" de Mobilize: la plantilla de Edwin trae UNA
// fila por asesor (Nombre del Asesor | # Monitoreos | Prom. Puntaje (%) |
// Clasificacion | Alerta Criticos | Total Fallos Criticos). # Monitoreos,
// Puntaje y Fallos son FORMULAS a un libro externo ("[1]Monitoreos!...") que
// no viene en el archivo: se leen los valores YA CALCULADOS que Excel guardo
// (SheetJS los entrega en v). Clasificacion y Alerta NO se leen del texto
// (traen emojis): se recalculan con los numeros, con las mismas reglas de las
// formulas del archivo. La plantilla no trae mes: el mes lo elige quien sube
// (Centro de cargas o el campo Periodo de Cargar Datos).
// Logica PURA (sin DOM). Doble modo: global en el navegador, require() en
// Node para las pruebas (server/tests/fase172-calidad-resumen.test.js).
'use strict';

var CALIDAD_RESUMEN_COLUMNAS = [
  { key: 'agente', label: 'Nombre del Asesor', obligatoria: true },
  { key: 'monitoreos', label: '# Monitoreos', obligatoria: true },
  { key: 'puntaje', label: 'Prom. Puntaje (%)', obligatoria: true },
  { key: 'clasificacion', label: 'Clasificación', obligatoria: false },
  { key: 'alerta', label: 'Alerta Críticos', obligatoria: false },
  { key: 'fallos', label: 'Total Fallos Críticos', obligatoria: true },
];
// Orden fijo del payload -- igual a CAMPOS_FILA (server/calidad-resumen.js) y
// calidadResumenFilaArraySchema (validation.js).
var CALIDAD_RESUMEN_ORDEN_ARRAY = ['agente', 'monitoreos', 'puntaje', 'fallos'];
var CALIDAD_RESUMEN_HOJA = 'CALIDAD_RESUMEN';
var CALIDAD_RESUMEN_MSG_FORMULAS = 'Abra la plantilla junto con el libro de Monitoreos, deje que calcule y guárdela antes de subirla.';

// Encabezado comparable: sin la flecha y lo que sigue ("← Escribir aquí"),
// sin acentos, sin espacios y en minusculas.
function calidadResumenNormEncabezado(h) {
  return String(h == null ? '' : h).split('←')[0]
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '').toLowerCase();
}

function calidadResumenColIndexMap(headerRow) {
  var map = {};
  (headerRow || []).forEach(function (h, i) {
    var n = calidadResumenNormEncabezado(h);
    var col = CALIDAD_RESUMEN_COLUMNAS.filter(function (c) { return calidadResumenNormEncabezado(c.label) === n; })[0];
    if (col && map[col.key] === undefined) map[col.key] = i;
  });
  return map;
}

// Mismas reglas que las formulas del archivo de Edwin.
function calidadResumenClasificacion(puntaje) {
  if (puntaje === null || puntaje === undefined || isNaN(puntaje)) return null;
  if (puntaje < 70) return 'Crítico';
  if (puntaje < 90) return 'No crítico';
  return 'Sobresaliente';
}
function calidadResumenAlerta(fallos) {
  if (fallos === null || fallos === undefined || isNaN(fallos)) return null;
  if (fallos === 0) return 'Sin fallos críticos';
  if (fallos === 1) return 'Alerta';
  return 'Crítico frecuente';
}
// Nivel de semaforo de cada uno (verde/amarillo/rojo).
function calidadResumenNivelClasificacion(c) { return c === 'Sobresaliente' ? 'verde' : c === 'No crítico' ? 'amarillo' : c === 'Crítico' ? 'rojo' : null; }
function calidadResumenNivelAlerta(a) { return a === 'Sin fallos críticos' ? 'verde' : a === 'Alerta' ? 'amarillo' : a === 'Crítico frecuente' ? 'rojo' : null; }

function _calidadResumenEsError(v) {
  return typeof v === 'string' && /^#/.test(v.trim()) && /(REF|VALUE|VALOR|DIV|N\/A|NAME|NOMBRE|NUM|NULL|NULO)/i.test(v);
}
// Numero de una celda (ya calculada). null si esta vacia; NaN si es error o texto.
function _calidadResumenNumero(v) {
  if (v === null || v === undefined || (typeof v === 'string' && v.trim() === '')) return null;
  if (typeof v === 'number') return isFinite(v) ? v : NaN;
  if (_calidadResumenEsError(v)) return NaN;
  var n = Number(String(v).replace('%', '').trim().replace(',', '.'));
  return isFinite(n) ? n : NaN;
}

// Celdas en error que SheetJS marca con t === 'e' (la hoja cruda `ws`, si viene).
function _calidadResumenFilasConError(ws) {
  var filas = {};
  if (!ws) return filas;
  Object.keys(ws).forEach(function (k) {
    if (k.charAt(0) === '!') return;
    var c = ws[k];
    if (c && c.t === 'e') {
      var m = /(\d+)$/.exec(k);
      if (m) filas[Number(m[1])] = true;
    }
  });
  return filas;
}

// Devuelve { error } si falta una columna obligatoria. Si no:
// Fase 179: fila de totales al final de la plantilla ("TOTAL", "Promedio
// general", "Gran total"...): no es un asesor; contarla duplicaba los
// monitoreos del mes.
var CALIDAD_RESUMEN_FILA_TOTAL_RE = /^(GRAN )?(TOTAL|TOTALES|PROMEDIO|PROMEDIOS)( GENERAL| GENERALES| DEL MES)?:?$/;
function calidadResumenEsFilaTotal(nombre) {
  var n = String(nombre || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
  return CALIDAD_RESUMEN_FILA_TOTAL_RE.test(n);
}

// { filas: [[agente, monitoreos, puntaje, fallos]], avisos, sinCalcular,
//   monitoreos (total), promedio (ponderado por monitoreos) }.
function calidadResumenParseFilas(aoa, ws) {
  if (!aoa || !aoa.length) return { error: 'El archivo esta vacio.' };
  var map = calidadResumenColIndexMap(aoa[0]);
  var faltantes = CALIDAD_RESUMEN_COLUMNAS.filter(function (c) { return c.obligatoria && map[c.key] === undefined; });
  if (faltantes.length) {
    return { error: 'Faltan columnas obligatorias: ' + faltantes.map(function (c) { return c.label; }).join(', ') + '.' };
  }
  var conError = _calidadResumenFilasConError(ws);
  var filas = [];
  var sinCalcular = [];
  var repetidos = [];
  var totales = [];
  var vistos = {};
  for (var i = 1; i < aoa.length; i++) {
    var row = aoa[i] || [];
    var agente = String(row[map.agente] == null ? '' : row[map.agente]).trim().replace(/\s+/g, ' ');
    if (!agente) continue; // fila sin asesor = fila vacia de la plantilla
    if (calidadResumenEsFilaTotal(agente)) { totales.push(i + 1); continue; } // Fase 179
    var mon = _calidadResumenNumero(row[map.monitoreos]);
    var pun = _calidadResumenNumero(row[map.puntaje]);
    var fal = _calidadResumenNumero(row[map.fallos]);
    if (conError[i + 1] || [mon, pun, fal].some(function (x) { return x === null || isNaN(x); })) {
      sinCalcular.push(i + 1);
      continue;
    }
    if (vistos[agente.toUpperCase()]) { repetidos.push(i + 1); continue; }
    vistos[agente.toUpperCase()] = true;
    filas.push([agente, Math.round(mon), pun, Math.round(fal)]);
  }
  var avisos = [];
  // Fase 177 (auditoria): si TODOS los puntajes estan entre 0 y 1 (y alguno
  // es mayor que 0), la celda trae la fraccion (0,85) y no el porcentaje
  // (85): se pasa a porcentaje con un aviso. Sin esto, todos salian "Crítico".
  var enFraccion = filas.length > 0 &&
    filas.every(function (f) { return f[2] <= 1; }) && filas.some(function (f) { return f[2] > 0; });
  filas.forEach(function (f) { f[2] = Math.round((enFraccion ? f[2] * 100 : f[2]) * 100) / 100; });
  if (enFraccion) avisos.push('El puntaje venía como fracción (ej. 0,85): se leyó como porcentaje (85 %). Revise que los puntajes de la vista previa estén bien.');
  if (sinCalcular.length) {
    avisos.push(sinCalcular.length + ' asesor(es) con # Monitoreos, Puntaje o Fallos en error o sin valor, se omitieron (filas ' +
      sinCalcular.slice(0, 5).join(', ') + (sinCalcular.length > 5 ? ' y ' + (sinCalcular.length - 5) + ' más' : '') + '). ' + CALIDAD_RESUMEN_MSG_FORMULAS);
  }
  if (totales.length) avisos.push(totales.length + ' fila(s) de total o promedio, no son asesores: se omitieron (filas ' + totales.join(', ') + ').');
  if (repetidos.length) avisos.push(repetidos.length + ' asesor(es) repetido(s), se dejo la primera fila de cada uno (filas ' + repetidos.join(', ') + ').');
  var total = filas.reduce(function (a, f) { return a + f[1]; }, 0);
  var suma = filas.reduce(function (a, f) { return a + f[1] * f[2]; }, 0);
  return { filas: filas, avisos: avisos, sinCalcular: sinCalcular.length, monitoreos: total, promedio: total ? Math.round(suma / total * 100) / 100 : null };
}

// ── Fase 202: archivo con una hoja por mes ("AGOSTO", "SEPTIEMBRE"...) ──
// El archivo de Edwin trae una hoja por mes, con el nombre del mes y sin año.
// calidadResumenMesDeHoja: { mes: 1..12, anio: AAAA|null } o null si el
// nombre no es un mes ("Hoja1" sigue el camino de siempre: el mes elegido).
var CALIDAD_RESUMEN_MESES = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
function calidadResumenMesDeHoja(nombre) {
  var n = String(nombre || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ').trim();
  var m = /^([A-Z]+)(?: (\d{4}))?$/.exec(n);
  if (!m) return null;
  var idx = CALIDAD_RESUMEN_MESES.indexOf(m[1] === 'SETIEMBRE' ? 'SEPTIEMBRE' : m[1]);
  return idx === -1 ? null : { mes: idx + 1, anio: m[2] ? Number(m[2]) : null };
}
// Periodo AAAA-MM de una hoja. Sin año en el nombre, el del mes de
// referencia (el elegido en el Centro o en Período); si el mes de la hoja va
// despues del de referencia, es del año anterior (ej. DICIEMBRE subido en
// enero). null si no hay referencia valida.
function calidadResumenPeriodoDeHoja(info, mesReferencia) {
  if (!info) return null;
  var anio = info.anio;
  if (!anio) {
    var ref = /^(\d{4})-(\d{2})$/.exec(String(mesReferencia || ''));
    if (!ref) return null;
    anio = Number(ref[1]) - (info.mes > Number(ref[2]) ? 1 : 0);
  }
  return anio + '-' + (info.mes < 10 ? '0' : '') + info.mes;
}
// Torta: % de monitoreos de cada asesor en el mes (suma 100 %).
function calidadResumenPctMonitoreos(asesores) {
  var total = (asesores || []).reduce(function (a, x) { return a + (x.monitoreos || 0); }, 0);
  return (asesores || []).map(function (x) { return total ? Math.round((x.monitoreos || 0) / total * 1000) / 10 : null; });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CALIDAD_RESUMEN_COLUMNAS: CALIDAD_RESUMEN_COLUMNAS,
    CALIDAD_RESUMEN_ORDEN_ARRAY: CALIDAD_RESUMEN_ORDEN_ARRAY,
    CALIDAD_RESUMEN_HOJA: CALIDAD_RESUMEN_HOJA,
    CALIDAD_RESUMEN_MSG_FORMULAS: CALIDAD_RESUMEN_MSG_FORMULAS,
    calidadResumenNormEncabezado: calidadResumenNormEncabezado,
    calidadResumenColIndexMap: calidadResumenColIndexMap,
    calidadResumenClasificacion: calidadResumenClasificacion,
    calidadResumenAlerta: calidadResumenAlerta,
    calidadResumenNivelClasificacion: calidadResumenNivelClasificacion,
    calidadResumenNivelAlerta: calidadResumenNivelAlerta,
    calidadResumenParseFilas: calidadResumenParseFilas,
    calidadResumenEsFilaTotal: calidadResumenEsFilaTotal,
    calidadResumenMesDeHoja: calidadResumenMesDeHoja,
    calidadResumenPeriodoDeHoja: calidadResumenPeriodoDeHoja,
    calidadResumenPctMonitoreos: calidadResumenPctMonitoreos,
  };
}
