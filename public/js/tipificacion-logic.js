// tipificacion-logic.js — InConexion Platform (Fase 77).
//
// Logica PURA (sin DOM) de "Tipificacion" de ORLANT: parseo de las hojas
// TIPIFICACION_LLAMADAS / TIPIFICACION_WHATSAPP del archivo real de Edwin
// (~15.000 filas/mes). Doble modo como agendas-logic.js: global en el
// navegador, require() en Node para las pruebas
// (server/tests/tipificacion-logic.test.js).
'use strict';

// ── Columnas (AGENT_NAME, DATE, HORA, TIME_MIN, DESCRIPTION_COD_ACT,
// SKILL_NAME) -- MES es una formula de Excel del archivo de Edwin
// (=TEXT(B2,"MMMM")), se ignora a proposito: el mes sale de DATE.
var TIPIFICACION_COLUMNAS = [
  { key: 'agente', label: 'AGENT_NAME', obligatoria: true },
  { key: 'fecha', label: 'DATE', obligatoria: true },
  { key: 'hora', label: 'HORA', obligatoria: false },
  { key: 'duracionMin', label: 'TIME_MIN', obligatoria: false },
  { key: 'tipificacion', label: 'DESCRIPTION_COD_ACT', obligatoria: true },
  { key: 'skill', label: 'SKILL_NAME', obligatoria: true },
];
var TIPIFICACION_COLUMNAS_OBLIGATORIAS = TIPIFICACION_COLUMNAS.filter(function (c) { return c.obligatoria; });
// Orden fijo del payload compacto (arrays, no objetos) -- ver
// tipificacionFilaComoArray. Mismo motivo que Agendas (Fase 78): a
// ~15.000-30.000 filas, un objeto con las claves repetidas por fila pesa
// bastante mas que un array posicional.
var TIPIFICACION_ORDEN_ARRAY = ['agente', 'fecha', 'hora', 'duracionMin', 'tipificacion', 'skill'];

function tipificacionNorm(s) {
  return String(s == null ? '' : s).trim().toLowerCase();
}

function tipificacionColIndexMap(headerRow) {
  var map = {};
  (headerRow || []).forEach(function (h, i) {
    var n = tipificacionNorm(h);
    var col = TIPIFICACION_COLUMNAS.filter(function (c) { return tipificacionNorm(c.label) === n; })[0];
    if (col && map[col.key] === undefined) map[col.key] = i;
  });
  return map;
}

// Trim + colapsar espacios dobles -- mismo criterio que el resto de la
// plataforma (agendasNormTexto, traficoNorm...), sin forzar mayusculas ni
// cambiar ningun otro caracter. DESCRIPTION_COD_ACT se guarda con este
// mismo tratamiento (el valor ORIGINAL, incluido "-" tal cual) -- el
// reemplazo "_ -> espacio" / "- -> Sin tipificacion" es solo de
// PRESENTACION (ver tipificacionEtiqueta), nunca se aplica al guardar.
function tipificacionNormTexto(v) {
  return String(v == null ? '' : v).trim().replace(/\s+/g, ' ');
}

// ── DATE: texto "dd/mm/aaaa" o serial de Excel (fecha, sin hora) ────────
function tipificacionParseFecha(v) {
  if (typeof v === 'number') {
    var n = Math.floor(v); // DATE no trae hora -- por si algun archivo la trajera pegada, se descarta (HORA es columna aparte)
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

// ── HORA: texto "H:MM:SS a. m./p. m." (con espacio normal O NO separable
//   antes de "m."), texto de 24h "HH:MM:SS", o serial de Excel
// (fraccion de dia) -- Edwin: hora LOCAL de Colombia, nunca se convierte a
// UTC. No bloquea la fila si no se puede leer (no se usa para filtrar
// hoy, solo se guarda para uso futuro) -- devuelve null en vez de fallar.
var TIPIFICACION_HORA_AMPM_RE = /^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([ap])\.?\s*m\.?$/i;
var TIPIFICACION_HORA_24H_RE = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/;
function tipificacionParseHora(v) {
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return null;
    var fraccion = v - Math.floor(v);
    var totalSeg = Math.round(fraccion * 86400);
    if (totalSeg < 0 || totalSeg >= 86400) return null;
    var hh0 = Math.floor(totalSeg / 3600), mm0 = Math.floor((totalSeg % 3600) / 60), ss0 = totalSeg % 60;
    var p2 = function (x) { return (x < 10 ? '0' : '') + x; };
    return p2(hh0) + ':' + p2(mm0) + ':' + p2(ss0);
  }
  if (typeof v !== 'string') return null;
  // Normaliza CUALQUIER espacio (incluido el espacio NO separable que
  // trae "p. m." en el archivo real de Edwin -- s de JS ya lo cubre) a
  // espacio comun antes de comparar contra los patrones -- sin esto,
  // "6:06:08 p. m." no calzaria contra un regex con espacio literal.
  var t = v.replace(/s+/g, ' ').trim();
  if (t === '') return null;
  var p2b = function (x) { return (x < 10 ? '0' : '') + x; };
  var mAmPm = TIPIFICACION_HORA_AMPM_RE.exec(t);
  if (mAmPm) {
    var hh = parseInt(mAmPm[1], 10);
    var mm = parseInt(mAmPm[2], 10);
    var ss = mAmPm[3] ? parseInt(mAmPm[3], 10) : 0;
    if (hh < 1 || hh > 12 || mm > 59 || ss > 59) return null;
    var esPM = /p/i.test(mAmPm[4]);
    if (esPM && hh !== 12) hh += 12;
    if (!esPM && hh === 12) hh = 0;
    return p2b(hh) + ':' + p2b(mm) + ':' + p2b(ss);
  }
  var m24 = TIPIFICACION_HORA_24H_RE.exec(t);
  if (m24) {
    var hh2 = parseInt(m24[1], 10), mm2 = parseInt(m24[2], 10), ss2 = m24[3] ? parseInt(m24[3], 10) : 0;
    if (hh2 > 23 || mm2 > 59 || ss2 > 59) return null;
    return p2b(hh2) + ':' + p2b(mm2) + ':' + p2b(ss2);
  }
  return null;
}

function tipificacionParseDuracion(v) {
  if (v === null || v === undefined || v === '') return null;
  var n = typeof v === 'number' ? v : Number(String(v).trim());
  return Number.isFinite(n) ? Math.round(n) : null;
}

// ── Presentacion (NUNCA se guarda asi, solo para mostrar): "_" -> espacio,
// y el valor COMPLETO "-" -> "Sin tipificacion". Cualquier otro valor con
// un "-" que no sea el marcador exacto de "sin tipificar" no se toca
// (ej. una tipificacion real que trajera un guion como parte del texto).
function tipificacionEtiqueta(valorOriginal) {
  var v = String(valorOriginal == null ? '' : valorOriginal);
  if (v.trim() === '-') return 'Sin tipificación';
  return v.replace(/_/g, ' ').trim();
}

// ── Parseo de filas (aoa = array-of-arrays, fila 0 = encabezados) ───────
function tipificacionParseFilas(aoa) {
  if (!aoa || !aoa.length) return { error: 'El archivo esta vacio.' };
  var map = tipificacionColIndexMap(aoa[0]);
  var faltantes = TIPIFICACION_COLUMNAS_OBLIGATORIAS.filter(function (c) { return map[c.key] === undefined; });
  if (faltantes.length) {
    return {
      error: 'Faltan columnas obligatorias: ' + faltantes.map(function (c) { return c.label; }).join(', ') + '.',
    };
  }

  var filas = [];
  var avisos = [];
  for (var i = 1; i < aoa.length; i++) {
    var row = aoa[i];
    if (!row || row.every(function (v) { return v === '' || v === null || v === undefined; })) continue;
    var filaNum = i + 1;

    var agente = tipificacionNormTexto(row[map.agente]);
    var tipificacion = tipificacionNormTexto(row[map.tipificacion]);
    var skill = tipificacionNormTexto(row[map.skill]);
    var fecha = tipificacionParseFecha(row[map.fecha]);
    var hora = map.hora !== undefined ? tipificacionParseHora(row[map.hora]) : null;
    var duracionMin = map.duracionMin !== undefined ? tipificacionParseDuracion(row[map.duracionMin]) : null;

    if (!agente || !tipificacion || !skill) {
      avisos.push('Fila ' + filaNum + ': falta un dato obligatorio (agente/tipificacion/skill), se omitio.');
      continue;
    }
    if (!fecha) {
      avisos.push('Fila ' + filaNum + ': DATE invalida o vacia, se omitio.');
      continue;
    }

    filas.push({ agente: agente, fecha: fecha, hora: hora, duracionMin: duracionMin, tipificacion: tipificacion, skill: skill });
  }

  if (!filas.length) {
    return { error: 'Ninguna fila valida (revisa los avisos anteriores).', avisos: avisos };
  }
  return { filas: filas, avisos: avisos };
}

function tipificacionFilaComoArray(f) {
  return TIPIFICACION_ORDEN_ARRAY.map(function (k) { return f[k]; });
}

// Primera y ultima DATE entre las filas ya parseadas -- define el periodo
// (dia a dia, sin hora) que la carga va a REEMPLAZAR para este canal.
function tipificacionRangoFechas(filas) {
  if (!filas || !filas.length) return null;
  var min = filas[0].fecha, max = filas[0].fecha;
  filas.forEach(function (f) {
    if (f.fecha < min) min = f.fecha;
    if (f.fecha > max) max = f.fecha;
  });
  return { desde: min, hasta: max };
}

// Doble modo: global en el navegador, require() en Node para las pruebas.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    TIPIFICACION_COLUMNAS: TIPIFICACION_COLUMNAS,
    TIPIFICACION_ORDEN_ARRAY: TIPIFICACION_ORDEN_ARRAY,
    tipificacionColIndexMap: tipificacionColIndexMap,
    tipificacionNormTexto: tipificacionNormTexto,
    tipificacionParseFecha: tipificacionParseFecha,
    tipificacionParseHora: tipificacionParseHora,
    tipificacionParseDuracion: tipificacionParseDuracion,
    tipificacionEtiqueta: tipificacionEtiqueta,
    tipificacionParseFilas: tipificacionParseFilas,
    tipificacionFilaComoArray: tipificacionFilaComoArray,
    tipificacionRangoFechas: tipificacionRangoFechas,
  };
}
