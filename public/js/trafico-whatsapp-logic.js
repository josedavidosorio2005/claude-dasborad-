// trafico-whatsapp-logic.js — InConexion Platform. Fase 50.
//
// Logica PURA (sin DOM) del modulo de Trafico de WhatsApp: parseo de la
// plantilla real (hoja DATA, columnas confirmadas por Edwin) y agregado por
// cola dentro de un periodo. Mismo patron que trafico-logic.js (doble modo
// navegador/Node, emparejamiento de columnas por nombre normalizado, nunca
// por posicion) pero con una diferencia de fondo: cada fila es una COLA por
// un PERIODO (FECHA INICIO..FECHA FIN), no un dia — no hay granularidad
// diaria en estos datos, asi que aqui no hay traficoAgregar por dia/mes/año
// como en la version de voz.
'use strict';

// ── Columnas de la plantilla real de WhatsApp (hoja DATA) ───────────────
// Solo 5 obligatorias (cola + las 2 fechas del periodo + total + contestados);
// el resto, si falta, la metrica queda ausente (no en 0 — 0% es un dato real).
// ABANDONO (columna propia de la plantilla) NO se parsea aqui a proposito:
// mismo criterio que la Fase 45 aplico a voz (abandonPct) — la tasa de
// abandono se recalcula EXACTA desde abandonados/total en vez de confiar en
// el % que trae el archivo.
var TRAFICO_WPP_COLUMNAS = [
  { key: 'colaWhatsapp', label: 'NOMBRE_COLA_WHATSAPP', obligatoria: true },
  { key: 'fechaInicio', label: 'FECHA INICIO', obligatoria: true },
  { key: 'fechaFin', label: 'FECHA FIN', obligatoria: true },
  { key: 'totalWhatsapp', label: 'TOTAL WHATSAPP', obligatoria: true },
  { key: 'contestados', label: 'WHATSAPP CONTESTADOS', obligatoria: true },
  { key: 'abandonados', label: 'WHATSAPP ABANDONADOS' },
  { key: 'serviceLevel10secPct', label: 'SERVICE_LEVEL_10SEC' },
  { key: 'serviceLevel20secPct', label: 'SERVICE_LEVEL_20SEC' },
  { key: 'serviceLevel30secPct', label: 'SERVICE_LEVEL_30SEC' },
  { key: 'asaSegundos', label: 'ASA' },
  { key: 'ataSegundos', label: 'ATA' },
];
var TRAFICO_WPP_COLUMNAS_OBLIGATORIAS = TRAFICO_WPP_COLUMNAS.filter(function (c) { return c.obligatoria; });

function traficoWppNorm(s) {
  return String(s == null ? '' : s).trim().toLowerCase();
}

// Mismo criterio que traficoEsFilaTotal (trafico-logic.js): nunca confiar en
// una fila TOTAL/resumen de la base como si fuera una cola real.
var TRAFICO_WPP_COLA_TOTAL_RE = /^(gran\s+)?total(es)?(\s+general(es)?)?$/i;
function traficoWppEsFilaTotal(colaWhatsapp) {
  return TRAFICO_WPP_COLA_TOTAL_RE.test(String(colaWhatsapp == null ? '' : colaWhatsapp).trim());
}

function traficoWppColIndexMap(headerRow) {
  var map = {};
  (headerRow || []).forEach(function (h, i) {
    var n = traficoWppNorm(h);
    var col = TRAFICO_WPP_COLUMNAS.filter(function (c) { return traficoWppNorm(c.label) === n; })[0];
    if (col && map[col.key] === undefined) map[col.key] = i;
  });
  return map;
}

// ── Conversiones puras (mismas que trafico-logic.js donde aplica) ───────
function traficoWppFechaDesdeSerial(serial) {
  var n = Number(serial);
  if (!Number.isFinite(n)) return null;
  var d = new Date(Math.round((n - 25569) * 86400000));
  if (isNaN(d.getTime())) return null;
  var y = d.getUTCFullYear();
  if (y < 1970 || y > 2200) return null;
  var m = d.getUTCMonth() + 1, day = d.getUTCDate();
  return y + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
}

// FECHA INICIO / FECHA FIN: en la plantilla real vienen como texto corto
// (ej. "8/1/26"), no como fecha nativa de Excel -- a diferencia de DATE en
// la plantilla de voz. Se acepta ese formato ademas del serial numerico y
// AAAA-MM-DD, por si el archivo llega con fecha nativa en otro entorno.
function traficoWppParseFecha(v) {
  if (typeof v === 'number') return traficoWppFechaDesdeSerial(v);
  if (v instanceof Date && !isNaN(v)) {
    return v.getUTCFullYear() + '-' + String(v.getUTCMonth() + 1).padStart(2, '0') + '-' + String(v.getUTCDate()).padStart(2, '0');
  }
  if (typeof v === 'string') {
    var t = v.trim();
    if (t === '') return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
    if (/^\d+(\.\d+)?$/.test(t)) return traficoWppFechaDesdeSerial(Number(t));
    // M/D/AA o M/D/AAAA (formato corto de la plantilla real, ej. "8/1/26").
    var mCorto = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (mCorto) {
      var mes = Number(mCorto[1]), dia = Number(mCorto[2]), anio = Number(mCorto[3]);
      if (anio < 100) anio += 2000;
      if (mes >= 1 && mes <= 12 && dia >= 1 && dia <= 31) {
        return anio + '-' + (mes < 10 ? '0' : '') + mes + '-' + (dia < 10 ? '0' : '') + dia;
      }
    }
    var d2 = new Date(t);
    if (!isNaN(d2)) return d2.toISOString().slice(0, 10);
  }
  return null;
}

// SERVICE_LEVEL_10/20/30SEC: texto "31.73 %" (con o sin espacio antes del %).
function traficoWppPctDesdeTexto(v) {
  if (v === null || v === undefined) return null;
  var s = String(v).trim();
  if (s === '') return null;
  var m = s.match(/^(-?\d+(?:[.,]\d+)?)\s*%?$/);
  if (!m) return null;
  var n = parseFloat(m[1].replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

// ASA / ATA / TOTAL WHATSAPP / etc.: numero, venga como numero o como texto
// (la plantilla real trae ASA/ATA con separador de miles, ej. "9,230.35").
function traficoWppNumero(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  var s = String(v).trim().replace(/,/g, '');
  var n = Number(s);
  return Number.isFinite(n) ? n : null;
}

// ── Parseo de filas (aoa = array-of-arrays, fila 0 = encabezados) ───────
// Devuelve { error } si falta una columna obligatoria (no procesa nada), o
// { filas, avisos, colas, periodos } con las filas validas + un aviso por
// cada fila descartada y por que (mismo patron que trafico-logic.js).
function traficoWppParseFilas(aoa) {
  if (!aoa || !aoa.length) return { error: 'El archivo esta vacio.' };
  var map = traficoWppColIndexMap(aoa[0]);
  var faltantes = TRAFICO_WPP_COLUMNAS_OBLIGATORIAS.filter(function (c) { return map[c.key] === undefined; });
  if (faltantes.length) {
    return {
      error: 'Faltan columnas obligatorias: ' + faltantes.map(function (c) { return c.label; }).join(', ') +
        '. Sube el archivo tal cual la plantilla oficial (hoja DATA), sin recortar columnas.',
    };
  }

  var filas = [];
  var avisos = [];
  var colasSet = {};
  var periodosSet = {};

  for (var i = 1; i < aoa.length; i++) {
    var row = aoa[i];
    if (!row || row.every(function (v) { return v === '' || v == null; })) continue;
    var filaNum = i + 1;

    var colaWhatsapp = row[map.colaWhatsapp] == null ? '' : String(row[map.colaWhatsapp]).trim();
    var fechaInicio = traficoWppParseFecha(row[map.fechaInicio]);
    var fechaFin = traficoWppParseFecha(row[map.fechaFin]);
    var totalWhatsapp = traficoWppNumero(row[map.totalWhatsapp]);
    var contestados = traficoWppNumero(row[map.contestados]);

    if (!colaWhatsapp) { avisos.push('Fila ' + filaNum + ': NOMBRE_COLA_WHATSAPP vacio, se omitio.'); continue; }
    if (traficoWppEsFilaTotal(colaWhatsapp)) { avisos.push('Fila ' + filaNum + ': NOMBRE_COLA_WHATSAPP "' + colaWhatsapp + '" parece una fila TOTAL/resumen de la base, se omitio (nunca se suma como si fuera una cola real).'); continue; }
    if (!fechaInicio) { avisos.push('Fila ' + filaNum + ' (' + colaWhatsapp + '): FECHA INICIO invalida o vacia, se omitio.'); continue; }
    if (!fechaFin) { avisos.push('Fila ' + filaNum + ' (' + colaWhatsapp + '): FECHA FIN invalida o vacia, se omitio.'); continue; }
    if (fechaFin < fechaInicio) { avisos.push('Fila ' + filaNum + ' (' + colaWhatsapp + '): FECHA FIN (' + fechaFin + ') es anterior a FECHA INICIO (' + fechaInicio + '), se omitio.'); continue; }
    if (totalWhatsapp === null || totalWhatsapp < 0) { avisos.push('Fila ' + filaNum + ' (' + colaWhatsapp + '): TOTAL WHATSAPP invalido, se omitio.'); continue; }
    if (contestados === null || contestados < 0) { avisos.push('Fila ' + filaNum + ' (' + colaWhatsapp + '): WHATSAPP CONTESTADOS invalido, se omitio.'); continue; }
    if (contestados > totalWhatsapp) { avisos.push('Fila ' + filaNum + ' (' + colaWhatsapp + '): contestados (' + contestados + ') supera el total (' + totalWhatsapp + '), se omitio.'); continue; }

    var fila = {
      colaWhatsapp: colaWhatsapp,
      fechaInicio: fechaInicio,
      fechaFin: fechaFin,
      totalWhatsapp: Math.round(totalWhatsapp),
      contestados: Math.round(contestados),
    };
    var opcionales = [
      ['abandonados', traficoWppNumero, Math.round],
      ['serviceLevel10secPct', traficoWppPctDesdeTexto, null],
      ['serviceLevel20secPct', traficoWppPctDesdeTexto, null],
      ['serviceLevel30secPct', traficoWppPctDesdeTexto, null],
      ['asaSegundos', traficoWppNumero, null],
      ['ataSegundos', traficoWppNumero, null],
    ];
    opcionales.forEach(function (spec) {
      var key = spec[0], parse = spec[1], post = spec[2];
      if (map[key] === undefined) return; // columna no vino en el archivo -> no se toca
      var val = parse(row[map[key]]);
      if (val !== null) fila[key] = post ? post(val) : val;
    });

    filas.push(fila);
    colasSet[colaWhatsapp] = true;
    periodosSet[fechaInicio + '_' + fechaFin] = true;
  }

  if (filas.length === 0) return { error: 'El archivo no tiene filas de datos validas.' };
  return {
    filas: filas,
    avisos: avisos,
    colas: Object.keys(colasSet).sort(),
    periodos: Object.keys(periodosSet).sort(),
  };
}

// ── Agregado de KPIs para el resumen de un periodo (suma volumenes primero,
// recalcula % desde esa suma -- nunca promedia los % de las colas). Los
// SERVICE_LEVEL_* y ASA/ATA se agregan como promedio PONDERADO por
// TOTAL WHATSAPP, mismo criterio que traficoAgregar en trafico-logic.js. ──
function traficoWppResumen(filas) {
  var out = { totalWhatsapp: 0, contestados: 0, abandonados: 0, _tieneAbandonados: false };
  var PCT_PONDERADOS = ['serviceLevel10secPct', 'serviceLevel20secPct', 'serviceLevel30secPct'];
  var NUM_PONDERADOS = ['asaSegundos', 'ataSegundos'];
  PCT_PONDERADOS.concat(NUM_PONDERADOS).forEach(function (k) { out['_suma_' + k] = 0; out['_peso_' + k] = 0; });

  filas.forEach(function (f) {
    var peso = Number(f.totalWhatsapp) || 0;
    out.totalWhatsapp += peso;
    out.contestados += Number(f.contestados) || 0;
    if (f.abandonados != null) { out.abandonados += f.abandonados; out._tieneAbandonados = true; }
    PCT_PONDERADOS.concat(NUM_PONDERADOS).forEach(function (k) {
      if (f[k] != null && peso > 0) { out['_suma_' + k] += f[k] * peso; out['_peso_' + k] += peso; }
    });
  });

  var r2 = function (n) { return Math.round(n * 100) / 100; };
  var res = {
    totalWhatsapp: out.totalWhatsapp,
    contestados: out.contestados,
    abandonados: out._tieneAbandonados ? out.abandonados : null,
    nivelAtencionPct: out.totalWhatsapp > 0 ? r2((out.contestados / out.totalWhatsapp) * 100) : null,
    tasaAbandonoPct: (out.totalWhatsapp > 0 && out._tieneAbandonados) ? r2((out.abandonados / out.totalWhatsapp) * 100) : null,
  };
  PCT_PONDERADOS.concat(NUM_PONDERADOS).forEach(function (k) {
    res[k] = out['_peso_' + k] > 0 ? r2(out['_suma_' + k] / out['_peso_' + k]) : null;
  });
  return res;
}

// Doble modo: global en el navegador, require() en Node para las pruebas.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    TRAFICO_WPP_COLUMNAS: TRAFICO_WPP_COLUMNAS,
    TRAFICO_WPP_COLUMNAS_OBLIGATORIAS: TRAFICO_WPP_COLUMNAS_OBLIGATORIAS,
    traficoWppColIndexMap: traficoWppColIndexMap,
    traficoWppEsFilaTotal: traficoWppEsFilaTotal,
    traficoWppFechaDesdeSerial: traficoWppFechaDesdeSerial,
    traficoWppParseFecha: traficoWppParseFecha,
    traficoWppPctDesdeTexto: traficoWppPctDesdeTexto,
    traficoWppNumero: traficoWppNumero,
    traficoWppParseFilas: traficoWppParseFilas,
    traficoWppResumen: traficoWppResumen,
  };
}
