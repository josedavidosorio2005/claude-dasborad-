// agendas-logic.js — InConexion Platform (Fase 78).
//
// Logica PURA (sin DOM) de "Agendas" de ORLANT: parseo de la hoja AGENDAS
// del archivo real de Edwin (citas asignadas, ~7.500 filas/mes) y la regla
// de privacidad de NOMBRE_ENTIDAD. Doble modo como trafico-logic.js: global
// en el navegador, require() en Node para las pruebas
// (server/tests/agendas-logic.test.js).
//
// El servidor NUNCA abre el Excel ni ve el NOMBRE_ENTIDAD original: todo el
// parseo (incluida la anonimizacion de entidad) ocurre AQUI, en el
// navegador, antes de armar el payload que se manda a la API -- asi el
// nombre real de un paciente particular nunca sale del navegador, ni
// siquiera de paso (no llega a la red, no puede aparecer en un log del
// servidor). Ver PRIVACIDAD mas abajo.
'use strict';

// ── Columnas de la hoja AGENDAS (formato consolidado de ORLANT) ─────────
// Emparejamiento por NOMBRE de columna, igual que el resto de la
// plataforma -- nunca por posicion. Las 8 son tal cual las nombra Edwin;
// solo NOMBRE_ENTIDAD puede venir vacia (paciente sin entidad registrada
// -> "SIN ENTIDAD", ver agendasAplicarPrivacidadEntidad).
var AGENDAS_COLUMNAS = [
  { key: 'asesor', label: 'NOMBRE DE AGENTE', obligatoria: true },
  { key: 'sede', label: 'SEDE', obligatoria: true },
  { key: 'examen', label: 'NOMBRE_EXAMEN', obligatoria: true },
  { key: 'especialidad', label: 'ESPECIALIDAD', obligatoria: true },
  { key: 'profesional', label: 'PROFESIONAL', obligatoria: true },
  { key: 'fechaSolicitud', label: 'FECHA_SOLICITUD', obligatoria: true },
  { key: 'tipoLinea', label: 'TIPO DE LINEA', obligatoria: true },
  { key: 'entidad', label: 'NOMBRE_ENTIDAD', obligatoria: false },
];
var AGENDAS_COLUMNAS_OBLIGATORIAS = AGENDAS_COLUMNAS.filter(function (c) { return c.obligatoria; });
// Orden fijo para el payload compacto (arrays, no objetos con las 8 claves
// repetidas por fila) -- ver agendasFilaComoArray. Mismo orden que las
// columnas de la tabla `agendas` (server/db.js).
var AGENDAS_ORDEN_ARRAY = ['asesor', 'sede', 'examen', 'especialidad', 'profesional', 'fechaSolicitud', 'tipoLinea', 'entidad'];

function agendasNorm(s) {
  return String(s == null ? '' : s).trim().toLowerCase();
}

function agendasColIndexMap(headerRow) {
  var map = {};
  (headerRow || []).forEach(function (h, i) {
    var n = agendasNorm(h);
    var col = AGENDAS_COLUMNAS.filter(function (c) { return agendasNorm(c.label) === n; })[0];
    if (col && map[col.key] === undefined) map[col.key] = i;
  });
  return map;
}

// Pedido explicito de Edwin: quita espacios sobrantes al inicio/fin y
// colapsa los dobles espacios internos en TODOS los textos -- nunca cambia
// mayusculas/minusculas ni ningun otro caracter ("no cambies nada mas de
// los valores"). Comparte el mismo criterio de trim+collapse que
// traficoNorm/cargasNorm de otros modulos, aqui SIN forzar minusculas
// (esta se usa para el VALOR final que se guarda, no solo para comparar).
function agendasNormTexto(v) {
  return String(v == null ? '' : v).trim().replace(/\s+/g, ' ');
}

// ── FECHA_SOLICITUD: serial de Excel CON hora (fraccion de dia), o texto
// "dd/mm/aaaa hh:mm:ss" -- Edwin: "Hora local de Colombia, sin convertir a
// UTC". El serial se convierte con aritmetica directa sobre UTC (mismo
// criterio que traficoFechaDesdeSerial, trafico-logic.js): NUNCA se usa
// Date+cellDates de SheetJS, que en algunos entornos interpreta el serial
// con la zona horaria del SISTEMA que corre el navegador y puede desplazar
// el dia/mes calendario -- exactamente lo que Edwin pide evitar. Se
// redondea al segundo (Math.round) para que un extremo como "30/04/2025
// 19:00" no se corra al 1/05 por un error de punto flotante en la fraccion
// del serial.
function agendasFechaHoraDesdeSerial(serial) {
  var n = Number(serial);
  if (!Number.isFinite(n)) return null;
  var ms = Math.round((n - 25569) * 86400000);
  var d = new Date(ms);
  if (isNaN(d.getTime())) return null;
  var y = d.getUTCFullYear();
  if (y < 1970 || y > 2200) return null;
  var pad2 = function (x) { return (x < 10 ? '0' : '') + x; };
  return y + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate()) + ' ' +
    pad2(d.getUTCHours()) + ':' + pad2(d.getUTCMinutes()) + ':' + pad2(d.getUTCSeconds());
}

// Texto "dd/mm/aaaa hh:mm:ss" (con o sin segundos) -> "aaaa-mm-dd hh:mm:ss".
// Parseo manual (nunca `new Date(texto)`: dd/mm/aaaa es ambiguo para el
// motor de fechas de JS, que asume mm/dd/aaaa en locale en-US).
var AGENDAS_FECHA_TEXTO_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;
function agendasParseFechaSolicitud(v) {
  if (typeof v === 'number') return agendasFechaHoraDesdeSerial(v);
  if (typeof v === 'string') {
    var t = v.trim();
    if (t === '') return null;
    // Ya viene en formato final (por si algun dia el archivo trae texto
    // "aaaa-mm-dd hh:mm:ss" en vez de dd/mm/aaaa).
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(t)) return t;
    if (/^\d+(\.\d+)?$/.test(t)) return agendasFechaHoraDesdeSerial(Number(t));
    var m = AGENDAS_FECHA_TEXTO_RE.exec(t);
    if (!m) return null;
    var dd = parseInt(m[1], 10), mm = parseInt(m[2], 10), aaaa = parseInt(m[3], 10);
    var hh = m[4] ? parseInt(m[4], 10) : 0, mi = m[5] ? parseInt(m[5], 10) : 0, ss = m[6] ? parseInt(m[6], 10) : 0;
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31 || hh > 23 || mi > 59 || ss > 59) return null;
    var pad2 = function (x) { return (x < 10 ? '0' : '') + x; };
    return aaaa + '-' + pad2(mm) + '-' + pad2(dd) + ' ' + pad2(hh) + ':' + pad2(mi) + ':' + pad2(ss);
  }
  return null;
}

var AGENDAS_TIPOS_LINEA = ['3P', 'GENERAL'];

// ── Parseo de filas (aoa = array-of-arrays, fila 0 = encabezados) ───────
// Devuelve { error } si falta una columna obligatoria, o { filas, avisos,
// entidadesAgrupadas, entidadesSinDato } -- `filas` ya trae NOMBRE_ENTIDAD
// anonimizada (ver agendasAplicarPrivacidadEntidad, aplicada aqui mismo
// antes de devolver, para que ningun caller externo pueda "olvidarse" del
// paso de privacidad).
function agendasParseFilas(aoa) {
  if (!aoa || !aoa.length) return { error: 'El archivo esta vacio.' };
  var map = agendasColIndexMap(aoa[0]);
  var faltantes = AGENDAS_COLUMNAS_OBLIGATORIAS.filter(function (c) { return map[c.key] === undefined; });
  if (faltantes.length) {
    return {
      error: 'Faltan columnas obligatorias: ' + faltantes.map(function (c) { return c.label; }).join(', ') +
        '. Sube la hoja AGENDAS tal cual la exporta el sistema de Edwin, sin recortar columnas.',
    };
  }

  var filas = [];
  var avisos = [];
  for (var i = 1; i < aoa.length; i++) {
    var row = aoa[i];
    if (!row || row.every(function (v) { return v === '' || v === null || v === undefined; })) continue;
    var filaNum = i + 1;

    var asesor = agendasNormTexto(row[map.asesor]);
    var sede = agendasNormTexto(row[map.sede]);
    var examen = agendasNormTexto(row[map.examen]);
    var especialidad = agendasNormTexto(row[map.especialidad]);
    var profesional = agendasNormTexto(row[map.profesional]);
    var tipoLinea = agendasNormTexto(row[map.tipoLinea]);
    var entidad = map.entidad !== undefined ? agendasNormTexto(row[map.entidad]) : '';
    var fechaSolicitud = agendasParseFechaSolicitud(row[map.fechaSolicitud]);

    if (!asesor || !sede || !examen || !especialidad || !profesional) {
      avisos.push('Fila ' + filaNum + ': falta un dato obligatorio (agente/sede/examen/especialidad/profesional), se omitio.');
      continue;
    }
    if (!fechaSolicitud) {
      avisos.push('Fila ' + filaNum + ': FECHA_SOLICITUD invalida o vacia, se omitio.');
      continue;
    }
    if (AGENDAS_TIPOS_LINEA.indexOf(tipoLinea) === -1) {
      avisos.push('Fila ' + filaNum + ': TIPO DE LINEA debe ser 3P o GENERAL (vino "' + tipoLinea + '"), se omitio.');
      continue;
    }

    filas.push({
      asesor: asesor, sede: sede, examen: examen, especialidad: especialidad,
      profesional: profesional, fechaSolicitud: fechaSolicitud, tipoLinea: tipoLinea,
      entidad: entidad,
    });
  }

  if (!filas.length) {
    return { error: 'Ninguna fila valida (revisa los avisos anteriores).', avisos: avisos };
  }

  var priv = agendasAplicarPrivacidadEntidad(filas);
  return {
    filas: priv.filas, avisos: avisos,
    entidadesAgrupadas: priv.entidadesAgrupadas, entidadesSinDato: priv.entidadesSinDato,
  };
}

// ── PRIVACIDAD (obligatorio, Edwin): NOMBRE_ENTIDAD nunca se guarda tal
// cual vino del archivo.
//   - Vacia -> "SIN ENTIDAD".
//   - Aparece MENOS de 5 veces en este mismo archivo (paciente particular
//     casi siempre, ver cabecera de este archivo) -> "PARTICULAR / OTRA".
//   - Aparece 5 veces o mas -> se guarda tal cual (ya con espacios
//     normalizados), es una entidad real (EPS, prepagada, aseguradora...).
// El umbral se calcula SOLO sobre las filas de este archivo (cada carga
// reemplaza un periodo completo, asi que "las veces que aparece" siempre
// se refiere al periodo que se esta subiendo, nunca a un acumulado
// historico que nadie ve completo a la vez).
// Pura: recibe filas ya con `entidad` normalizada de espacios (trim +
// collapse), nunca el texto crudo de la celda.
function agendasAplicarPrivacidadEntidad(filas) {
  var freq = {};
  (filas || []).forEach(function (f) {
    if (f.entidad === '') return;
    freq[f.entidad] = (freq[f.entidad] || 0) + 1;
  });
  var entidadesAgrupadas = 0, entidadesSinDato = 0;
  var out = (filas || []).map(function (f) {
    var entidadFinal;
    if (f.entidad === '') { entidadFinal = 'SIN ENTIDAD'; entidadesSinDato++; }
    else if (freq[f.entidad] < 5) { entidadFinal = 'PARTICULAR / OTRA'; entidadesAgrupadas++; }
    else { entidadFinal = f.entidad; }
    if (entidadFinal === f.entidad) return f;
    var copia = {};
    for (var k in f) copia[k] = f[k];
    copia.entidad = entidadFinal;
    return copia;
  });
  return { filas: out, entidadesAgrupadas: entidadesAgrupadas, entidadesSinDato: entidadesSinDato };
}

// Fila (objeto) -> array en AGENDAS_ORDEN_ARRAY, para el payload compacto
// que se manda al servidor (Fase 78: ~7.500 filas/mes en formato de
// objetos con las 8 claves repetidas por fila se acerca al limite de
// express.json (2mb, ver server/config.js) -- en arrays el mismo archivo
// pesa ~35% menos, con margen comodo. El servidor mapea cada posicion de
// vuelta a su nombre (ver server/agendas.js) -- nunca se cambia el ORDEN
// sin actualizar los dos lados a la vez.
function agendasFilaComoArray(f) {
  return AGENDAS_ORDEN_ARRAY.map(function (k) { return f[k]; });
}

// Extremos (primera/ultima) de FECHA_SOLICITUD entre las filas ya parseadas
// -- define el periodo que la carga va a REEMPLAZAR (Fase 78, mismo
// criterio de "reemplaza por periodo" que Trafico, pero aqui el periodo
// sale de los datos mismos, no de un selector de mes/skill).
function agendasRangoFechas(filas) {
  if (!filas || !filas.length) return null;
  var min = filas[0].fechaSolicitud, max = filas[0].fechaSolicitud;
  filas.forEach(function (f) {
    if (f.fechaSolicitud < min) min = f.fechaSolicitud;
    if (f.fechaSolicitud > max) max = f.fechaSolicitud;
  });
  return { desde: min, hasta: max };
}

// Doble modo: global en el navegador, require() en Node para las pruebas.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    AGENDAS_COLUMNAS: AGENDAS_COLUMNAS,
    AGENDAS_ORDEN_ARRAY: AGENDAS_ORDEN_ARRAY,
    AGENDAS_TIPOS_LINEA: AGENDAS_TIPOS_LINEA,
    agendasColIndexMap: agendasColIndexMap,
    agendasNormTexto: agendasNormTexto,
    agendasFechaHoraDesdeSerial: agendasFechaHoraDesdeSerial,
    agendasParseFechaSolicitud: agendasParseFechaSolicitud,
    agendasParseFilas: agendasParseFilas,
    agendasAplicarPrivacidadEntidad: agendasAplicarPrivacidadEntidad,
    agendasFilaComoArray: agendasFilaComoArray,
    agendasRangoFechas: agendasRangoFechas,
  };
}
