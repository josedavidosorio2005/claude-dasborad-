// inasistencia-logic.js — InConexion Platform (Fase 98, ORLANT, pedido
// urgente de Edwin).
//
// Logica PURA (sin DOM) de "Inasistencia" de ORLANT: parseo de la hoja
// INASISTENCIA del archivo real de Edwin (totales AGREGADOS por mes +
// especialidad -- nunca datos de pacientes). Doble modo como agendas-logic.js:
// global en el navegador, require() en Node para las pruebas
// (server/tests/inasistencia-logic.test.js).
'use strict';

// fecha-limites-logic.js: global en el navegador, require() en Node.
var _inasistenciaFechaLimites = (typeof require === 'function') ? require('./fecha-limites-logic.js') : (typeof window !== 'undefined' ? window : this);

// ── Columnas de la hoja INASISTENCIA ────────────────────────────────────
// Emparejamiento por NOMBRE de columna, nunca por posicion. ESPECIALIDAD
// acepta tambien "ESPECIALIDA" (sin la D -- asi viene en el archivo real de
// Edwin, ver `labelAlt`). AÑO es opcional (el archivo real no la trae --
// el año se infiere del mes, ver inasistenciaParseMes).
var INASISTENCIA_COLUMNAS = [
  { key: 'mes', label: 'MES', obligatoria: true },
  { key: 'especialidad', label: 'ESPECIALIDAD', labelAlt: ['ESPECIALIDA'], obligatoria: true },
  { key: 'cancelada', label: 'CANCELADA', obligatoria: true },
  { key: 'inasistencia', label: 'INASISTENCIA', obligatoria: true },
  { key: 'pendiente', label: 'PENDIENTE', obligatoria: true },
  { key: 'atendidas', label: 'ATENDIDAS', obligatoria: true },
  { key: 'total', label: 'TOTAL', obligatoria: true },
  { key: 'anio', label: 'AÑO', labelAlt: ['ANO'], obligatoria: false },
];
var INASISTENCIA_COLUMNAS_OBLIGATORIAS = INASISTENCIA_COLUMNAS.filter(function (c) { return c.obligatoria; });
// Orden fijo para el payload compacto (arrays) -- ver inasistenciaFilaComoArray.
// Mismo orden que server/inasistencia.js (CAMPOS_FILA) y
// validation.js (inasistenciaFilaArraySchema).
var INASISTENCIA_ORDEN_ARRAY = ['mes', 'especialidad', 'cancelada', 'inasistencia', 'pendiente', 'atendidas', 'total'];

function inasistenciaNorm(s) {
  return String(s == null ? '' : s).trim().toLowerCase();
}

function inasistenciaColIndexMap(headerRow) {
  var map = {};
  (headerRow || []).forEach(function (h, i) {
    var n = inasistenciaNorm(h);
    var col = INASISTENCIA_COLUMNAS.filter(function (c) {
      if (inasistenciaNorm(c.label) === n) return true;
      return (c.labelAlt || []).some(function (alt) { return inasistenciaNorm(alt) === n; });
    })[0];
    if (col && map[col.key] === undefined) map[col.key] = i;
  });
  return map;
}

// Trim + colapsa dobles espacios (nunca cambia mayusculas/minusculas) --
// mismo criterio que agendasNormTexto.
function inasistenciaNormTexto(v) {
  return String(v == null ? '' : v).trim().replace(/\s+/g, ' ');
}

var INASISTENCIA_MESES_NOMBRE = {
  ENERO: '01', FEBRERO: '02', MARZO: '03', ABRIL: '04', MAYO: '05', JUNIO: '06',
  JULIO: '07', AGOSTO: '08', SEPTIEMBRE: '09', SETIEMBRE: '09', OCTUBRE: '10', NOVIEMBRE: '11', DICIEMBRE: '12',
};

// Serial de Excel (sin hora) -> 'AAAA-MM' -- aritmetica directa sobre UTC,
// nunca Date+cellDates de SheetJS (puede desplazar el mes por la zona
// horaria del sistema). Mismo criterio que agendasFechaHoraDesdeSerial.
function _inasistenciaSerialAMes(serial) {
  var n = Number(serial);
  if (!Number.isFinite(n)) return null;
  var ms = Math.round((n - 25569) * 86400000);
  var d = new Date(ms);
  if (isNaN(d.getTime())) return null;
  var y = d.getUTCFullYear();
  if (y < 1970 || y > 2200) return null;
  var pad2 = function (x) { return (x < 10 ? '0' : '') + x; };
  return y + '-' + pad2(d.getUTCMonth() + 1);
}

// MES + AÑO (opcional) -> 'AAAA-MM', o null si no se pudo reconocer.
// Acepta: ya 'AAAA-MM' (o 'AAAA-MM-DD...', se recorta); serial de Excel (o
// texto numerico); nombre de mes en texto ("AGOSTO"). Con nombre de mes:
// si viene AÑO (columna opcional), se usa tal cual; si no, se infiere el
// AÑO MAS RECIENTE en que ese mes no es futuro (hora Colombia) -- mismo
// criterio de "nunca despues del mes en curso" de la Fase 86.
function inasistenciaParseMes(valorMes, valorAnio, ahora) {
  if (valorMes === null || valorMes === undefined || valorMes === '') return null;
  if (typeof valorMes === 'string') {
    var t = valorMes.trim();
    if (/^\d{4}-\d{2}$/.test(t)) return t;
    if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 7);
    if (/^\d+(\.\d+)?$/.test(t)) return _inasistenciaSerialAMes(Number(t));
    var nombre = t.toUpperCase();
    var mm = INASISTENCIA_MESES_NOMBRE[nombre];
    if (!mm) return null;
    var anioTexto = (valorAnio !== undefined && valorAnio !== null && String(valorAnio).trim() !== '') ? String(valorAnio).trim().replace(/\.0$/, '') : null;
    if (anioTexto && /^\d{4}$/.test(anioTexto)) return anioTexto + '-' + mm;
    var hoy = _inasistenciaFechaLimites.fechaLimitesHoyColombia(ahora);
    var anioActual = parseInt(hoy.slice(0, 4), 10);
    var mesActual = hoy.slice(5, 7);
    return (mm > mesActual) ? (String(anioActual - 1) + '-' + mm) : (String(anioActual) + '-' + mm);
  }
  if (typeof valorMes === 'number') return _inasistenciaSerialAMes(valorMes);
  return null;
}

// Entero no negativo (celda numerica o texto numerico), o null si no aplica
// -- nunca se adivina un valor invalido.
function _inasistenciaNumeroEntero(v) {
  if (v === null || v === undefined || v === '') return null;
  var n = Number(v);
  if (!Number.isFinite(n)) return null;
  if (Math.round(n) !== n) return null;
  if (n < 0) return null;
  return n;
}

// "4,16 %" / "4.16%" / 4.16 / 0.0416 (fraccion de formato % de Excel) -> 4.16.
function _inasistenciaPctDesdeCelda(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Math.round((v <= 1 ? v * 100 : v) * 10) / 10;
  var s = String(v).trim().replace('%', '').replace(',', '.').trim();
  if (s === '') return null;
  var n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 10) / 10 : null;
}

// ── Parseo de filas (aoa = array-of-arrays, fila 0 = encabezados) ───────
// Devuelve { error } si falta una columna obligatoria, o { filas, avisos }.
// Filas vacias se ignoran. TOTAL siempre se guarda tal cual vino del
// archivo (nunca se recalcula) -- si no cuadra con la suma de los otros 4,
// o si trae una columna "% DE INASISTENCIA" que no coincide con el
// ponderado recalculado, se agrega un AVISO (nunca bloquea la fila).
function inasistenciaParseFilas(aoa, ahora) {
  if (!aoa || !aoa.length) return { error: 'El archivo esta vacio.' };
  var map = inasistenciaColIndexMap(aoa[0]);
  var faltantes = INASISTENCIA_COLUMNAS_OBLIGATORIAS.filter(function (c) { return map[c.key] === undefined; });
  if (faltantes.length) {
    return {
      error: 'Faltan columnas obligatorias: ' + faltantes.map(function (c) { return c.label; }).join(', ') +
        '. Sube la hoja INASISTENCIA tal cual la exporta el sistema de Edwin, sin recortar columnas.',
    };
  }
  // Columna "% DE INASISTENCIA" del archivo (si viene) -- solo para el
  // aviso de cruce contra el % recalculado, nunca se guarda.
  var idxPctArchivo = -1;
  (aoa[0] || []).forEach(function (h, i) {
    if (idxPctArchivo === -1 && /^% *de *inasistencia/.test(inasistenciaNorm(h))) idxPctArchivo = i;
  });

  var filas = [];
  var avisos = [];
  for (var i = 1; i < aoa.length; i++) {
    var row = aoa[i];
    if (!row || row.every(function (v) { return v === '' || v === null || v === undefined; })) continue;
    var filaNum = i + 1;

    var mes = inasistenciaParseMes(row[map.mes], map.anio !== undefined ? row[map.anio] : undefined, ahora);
    if (!mes) {
      avisos.push('Fila ' + filaNum + ': MES invalido o no reconocido ("' + row[map.mes] + '"), se omitio.');
      continue;
    }
    if (_inasistenciaFechaLimites.fechaLimitesEsFutura(mes + '-01', ahora)) {
      avisos.push('Fila ' + filaNum + ': el mes ' + mes + ' esta en el futuro, se omitio.');
      continue;
    }
    var especialidad = inasistenciaNormTexto(row[map.especialidad]);
    if (!especialidad) {
      avisos.push('Fila ' + filaNum + ': falta ESPECIALIDAD, se omitio.');
      continue;
    }

    var cancelada = _inasistenciaNumeroEntero(row[map.cancelada]);
    var inas = _inasistenciaNumeroEntero(row[map.inasistencia]);
    var pendiente = _inasistenciaNumeroEntero(row[map.pendiente]);
    var atendidas = _inasistenciaNumeroEntero(row[map.atendidas]);
    var total = _inasistenciaNumeroEntero(row[map.total]);
    if (cancelada === null || inas === null || pendiente === null || atendidas === null || total === null) {
      avisos.push('Fila ' + filaNum + ' (' + mes + ' / ' + especialidad + '): CANCELADA/INASISTENCIA/PENDIENTE/ATENDIDAS/TOTAL deben ser numeros enteros no negativos, se omitio.');
      continue;
    }

    var sumaCalculada = cancelada + inas + pendiente + atendidas;
    if (sumaCalculada !== total) {
      avisos.push('Fila ' + filaNum + ' (' + mes + ' / ' + especialidad + '): TOTAL del archivo (' + total + ') no coincide con CANCELADA+INASISTENCIA+PENDIENTE+ATENDIDAS (' + sumaCalculada + ') -- se uso el TOTAL del archivo tal cual.');
    }

    var pctRecalculado = total > 0 ? Math.round(((inas + pendiente) / total) * 1000) / 10 : null;
    if (idxPctArchivo !== -1 && pctRecalculado !== null) {
      var pctArchivo = _inasistenciaPctDesdeCelda(row[idxPctArchivo]);
      if (pctArchivo !== null && Math.abs(pctArchivo - pctRecalculado) > 0.15) {
        avisos.push('Fila ' + filaNum + ' (' + mes + ' / ' + especialidad + '): el % DE INASISTENCIA del archivo (' + pctArchivo + '%) difiere del recalculado (' + pctRecalculado + '%) -- se uso el recalculado.');
      }
    }

    filas.push({ mes: mes, especialidad: especialidad, cancelada: cancelada, inasistencia: inas, pendiente: pendiente, atendidas: atendidas, total: total });
  }

  if (!filas.length) return { error: 'Ninguna fila valida (revisa los avisos anteriores).', avisos: avisos };
  return { filas: filas, avisos: avisos };
}

// Fila (objeto) -> array en INASISTENCIA_ORDEN_ARRAY, para el payload
// compacto que se manda al servidor -- ver server/inasistencia.js.
function inasistenciaFilaComoArray(f) {
  return INASISTENCIA_ORDEN_ARRAY.map(function (k) { return f[k]; });
}

// Meses distintos (ordenados) entre las filas ya parseadas -- para el
// mensaje de confirmacion de carga ("Se cargará como Ago-26 y Sep-26").
function inasistenciaMesesDeFilas(filas) {
  var set = {};
  (filas || []).forEach(function (f) { set[f.mes] = true; });
  return Object.keys(set).sort();
}

// 'AAAA-MM' -> "Ago-26" (mismo formato corto que _agendasMesLbl/
// _tipificacionMesLbl) -- pura, usada por cargas.js (mensaje de
// confirmacion) e inasistencia.js (selector/tarjetas/tabla).
var INASISTENCIA_MESES_ABREV = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
function inasistenciaMesLbl(mes) {
  var partes = String(mes || '').split('-');
  return partes.length === 2 ? (INASISTENCIA_MESES_ABREV[parseInt(partes[1], 10) - 1] + '-' + partes[0].slice(2)) : String(mes || '');
}

// Doble modo: global en el navegador, require() en Node para las pruebas.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    INASISTENCIA_COLUMNAS: INASISTENCIA_COLUMNAS,
    INASISTENCIA_COLUMNAS_OBLIGATORIAS: INASISTENCIA_COLUMNAS_OBLIGATORIAS,
    INASISTENCIA_ORDEN_ARRAY: INASISTENCIA_ORDEN_ARRAY,
    inasistenciaColIndexMap: inasistenciaColIndexMap,
    inasistenciaNormTexto: inasistenciaNormTexto,
    inasistenciaParseMes: inasistenciaParseMes,
    inasistenciaParseFilas: inasistenciaParseFilas,
    inasistenciaFilaComoArray: inasistenciaFilaComoArray,
    inasistenciaMesesDeFilas: inasistenciaMesesDeFilas,
    inasistenciaMesLbl: inasistenciaMesLbl,
  };
}
