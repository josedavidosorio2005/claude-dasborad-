// trafico-logic.js — InConexion Platform.
//
// Logica PURA (sin DOM) del modulo de Trafico de Llamadas: parseo del export
// de Volvox (hoja DATA) y agregacion por dia/mes/anio para la grafica y los
// KPIs. Doble modo como esc.js: global en el navegador (se carga por
// <script>) y require() en Node para las pruebas
// (server/tests/trafico-logic.test.js), que corren esta MISMA logica contra
// el fixture real server/tests/fixtures/EJEMPLO.xlsx — nunca una version
// inventada.
//
// El servidor NUNCA abre el Excel: esto se ejecuta en el navegador (o en el
// proceso de test que simula el navegador), y el servidor solo recibe las
// filas ya parseadas como JSON (mismo patron que cargas.js / metas.js NSD).
'use strict';

// ── Columnas del export de Volvox (hoja DATA) ───────────────────────────
// El emparejamiento es por NOMBRE de columna (normalizado), nunca por
// posicion: si Volvox reordena o agrega columnas, esto sigue funcionando.
// Solo 4 son obligatorias; el resto, si faltan, la metrica queda NULL (no
// en 0 — 0% es un dato real, "sin dato" es otra cosa).
var TRAFICO_COLUMNAS = [
  { key: 'skillName', label: 'SKILL_NAME', obligatoria: true },
  { key: 'fecha', label: 'DATE', obligatoria: true },
  { key: 'totalLlamadas', label: 'TOTAL LLAMADAS', obligatoria: true },
  { key: 'contestadas', label: 'LLAMADAS CONTESTADAS', obligatoria: true },
  { key: 'llamadasAbandonadas', label: 'LLAMADAS ABANDONADAS' },
  { key: 'serviceLevel10secPct', label: 'SERVICE_LEVEL_10SEC' },
  { key: 'serviceLevel20secPct', label: 'SERVICE_LEVEL_20SEC' },
  { key: 'serviceLevel30secPct', label: 'SERVICE_LEVEL_30SEC' },
  { key: 'abandonPct', label: 'ABANDON' },
  { key: 'asaSegundos', label: 'ASA' },
  { key: 'ataSegundos', label: 'ATA' },
  { key: 'waitTimeSegundos', label: 'WAIT_TIME' },
  { key: 'ahtSegundos', label: 'AHT' },
  { key: 'nivelAtencionPct', label: 'NIVEL DE ATENCION' },
  { key: 'tasaAbandonoPct', label: 'TASA DE ABNDONO' }, // sic: asi viene de Volvox, no "corregir"
];
var TRAFICO_COLUMNAS_OBLIGATORIAS = TRAFICO_COLUMNAS.filter(function (c) { return c.obligatoria; });

function traficoNorm(s) {
  return String(s == null ? '' : s).trim().toLowerCase();
}

// Point 10 del pedido de Edwin: nunca confiar en una fila TOTAL/resumen de
// la base como si fuera una linea real — Volvox (o quien la genere) a veces
// deja una fila de cierre con SKILL_NAME tipo "TOTAL", "TOTAL GENERAL",
// "TOTALES", etc. Si esa fila tuviera ademas una fecha valida, se sumaria
// como una skill mas y duplicaria el conteo. Deteccion por palabra completa
// (no substring) para no descartar una skill real que solo contenga "total"
// como parte de un nombre mas largo por casualidad.
var TRAFICO_SKILL_TOTAL_RE = /^(gran\s+)?total(es)?(\s+general(es)?)?$/i;
function traficoEsFilaTotal(skillName) {
  return TRAFICO_SKILL_TOTAL_RE.test(String(skillName == null ? '' : skillName).trim());
}

function traficoColIndexMap(headerRow) {
  var map = {};
  (headerRow || []).forEach(function (h, i) {
    var n = traficoNorm(h);
    var col = TRAFICO_COLUMNAS.filter(function (c) { return traficoNorm(c.label) === n; })[0];
    if (col && map[col.key] === undefined) map[col.key] = i;
  });
  return map;
}

// ── Conversiones puras (cada una testeada por separado) ─────────────────

// Serial de Excel (dias desde 1899-12-30, incluye el bug del "29-feb-1900"
// que Excel replica a proposito) -> 'YYYY-MM-DD'. Aritmetica directa sobre
// UTC (25569 = serial de 1970-01-01): NUNCA se usa Date+cellDates de
// SheetJS para esto, porque en algunos entornos esa via interpreta el
// serial con la zona horaria local y puede desplazar el dia calendario.
function traficoFechaDesdeSerial(serial) {
  var n = Number(serial);
  if (!Number.isFinite(n)) return null;
  var d = new Date(Math.round((n - 25569) * 86400000));
  if (isNaN(d.getTime())) return null;
  var y = d.getUTCFullYear();
  if (y < 1970 || y > 2200) return null;
  var m = d.getUTCMonth() + 1, day = d.getUTCDate();
  return y + '-' + (m < 10 ? '0' : '') + m + '-' + (day < 10 ? '0' : '') + day;
}

// DATE: normalmente serial numerico (fecha nativa de Excel). Defensivamente
// tambien acepta texto ya formateado, por si algun export viene distinto.
function traficoParseFecha(v) {
  if (typeof v === 'number') return traficoFechaDesdeSerial(v);
  if (v instanceof Date && !isNaN(v)) {
    return v.getUTCFullYear() + '-' + String(v.getUTCMonth() + 1).padStart(2, '0') + '-' + String(v.getUTCDate()).padStart(2, '0');
  }
  if (typeof v === 'string') {
    var t = v.trim();
    if (t === '') return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
    if (/^\d+(\.\d+)?$/.test(t)) return traficoFechaDesdeSerial(Number(t));
    var d2 = new Date(t);
    if (!isNaN(d2)) return d2.toISOString().slice(0, 10);
  }
  return null;
}

// WAIT_TIME / AHT: hora nativa de Excel = fraccion de dia (0.002488... ->
// 3:35 -> 215s). Vacio -> null (no 0 segundos, que seria un dato real).
function traficoSegundosDesdeFraccionDia(v) {
  if (v === null || v === undefined || v === '') return null;
  var n = typeof v === 'number' ? v : Number(String(v).trim().replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 86400);
}

// SERVICE_LEVEL_10/20/30SEC y ABANDON: texto "86.49 %" / "1.62%" (con o sin
// espacio antes del %, ambos formatos aparecen en el mismo archivo).
function traficoPctDesdeTexto(v) {
  if (v === null || v === undefined) return null;
  var s = String(v).trim();
  if (s === '') return null;
  var m = s.match(/^(-?\d+(?:[.,]\d+)?)\s*%?$/);
  if (!m) return null;
  var n = parseFloat(m[1].replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

// NIVEL DE ATENCION / TASA DE ABNDONO: fraccion decimal (0.9838 -> 98.38).
function traficoPctDesdeFraccion(v) {
  if (v === null || v === undefined || v === '') return null;
  var n = typeof v === 'number' ? v : Number(String(v).trim().replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100 * 100) / 100;
}

// ASA / ATA / TOTAL LLAMADAS / etc.: numero, venga como numero o como texto.
function traficoNumero(v) {
  if (v === null || v === undefined || v === '') return null;
  var n = typeof v === 'number' ? v : Number(String(v).trim().replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

// ── Parseo de filas (aoa = array-of-arrays, como devuelve
// XLSX.utils.sheet_to_json(ws, {header:1}), fila 0 = encabezados) ───────
//
// Devuelve { error } si falta una columna obligatoria (no procesa nada), o
// { filas, avisos, skills, meses } con las filas validas + un aviso por
// cada fila descartada y por que (mismo patron que cargas.js / NSD).
function traficoParseFilas(aoa) {
  if (!aoa || !aoa.length) return { error: 'El archivo esta vacio.' };
  var map = traficoColIndexMap(aoa[0]);
  var faltantes = TRAFICO_COLUMNAS_OBLIGATORIAS.filter(function (c) { return map[c.key] === undefined; });
  if (faltantes.length) {
    return {
      error: 'Faltan columnas obligatorias: ' + faltantes.map(function (c) { return c.label; }).join(', ') +
        '. Sube el archivo tal cual lo descargas de Volvox (hoja DATA), sin recortar columnas.',
    };
  }

  var filas = [];
  var avisos = [];
  var skillsSet = {};
  var mesesSet = {};

  for (var i = 1; i < aoa.length; i++) {
    var row = aoa[i];
    if (!row || row.every(function (v) { return v === '' || v == null; })) continue;
    var filaNum = i + 1;

    var fecha = traficoParseFecha(row[map.fecha]);
    var skillName = row[map.skillName] == null ? '' : String(row[map.skillName]).trim();
    var totalLlamadas = traficoNumero(row[map.totalLlamadas]);
    var contestadas = traficoNumero(row[map.contestadas]);

    // MES/AÑO son redundantes con DATE y no alcanzan para reconstruir un
    // dia completo (no hay dia-del-mes en ellas) — si DATE no es valida, la
    // fila se descarta explicando por que, en vez de inventar un dia.
    if (!fecha) { avisos.push('Fila ' + filaNum + ': DATE invalida o vacia (MES/AÑO no bastan para reconstruir el dia), se omitio.'); continue; }
    if (!skillName) { avisos.push('Fila ' + filaNum + ' (' + fecha + '): SKILL_NAME vacio, se omitio.'); continue; }
    if (traficoEsFilaTotal(skillName)) { avisos.push('Fila ' + filaNum + ' (' + fecha + '): SKILL_NAME "' + skillName + '" parece una fila TOTAL/resumen de la base, se omitio (nunca se suma como si fuera una linea real).'); continue; }
    if (totalLlamadas === null || totalLlamadas < 0) { avisos.push('Fila ' + filaNum + ' (' + fecha + ', ' + skillName + '): TOTAL LLAMADAS invalido, se omitio.'); continue; }
    if (contestadas === null || contestadas < 0) { avisos.push('Fila ' + filaNum + ' (' + fecha + ', ' + skillName + '): LLAMADAS CONTESTADAS invalido, se omitio.'); continue; }
    if (contestadas > totalLlamadas) { avisos.push('Fila ' + filaNum + ' (' + fecha + ', ' + skillName + '): contestadas (' + contestadas + ') supera el total (' + totalLlamadas + '), se omitio.'); continue; }

    var fila = {
      fecha: fecha,
      skillName: skillName,
      totalLlamadas: Math.round(totalLlamadas),
      contestadas: Math.round(contestadas),
    };
    var opcionales = [
      ['llamadasAbandonadas', traficoNumero, Math.round],
      ['serviceLevel10secPct', traficoPctDesdeTexto, null],
      ['serviceLevel20secPct', traficoPctDesdeTexto, null],
      ['serviceLevel30secPct', traficoPctDesdeTexto, null],
      ['abandonPct', traficoPctDesdeTexto, null],
      ['asaSegundos', traficoNumero, null],
      ['ataSegundos', traficoNumero, null],
      ['waitTimeSegundos', traficoSegundosDesdeFraccionDia, null],
      ['ahtSegundos', traficoSegundosDesdeFraccionDia, null],
      ['nivelAtencionPct', traficoPctDesdeFraccion, null],
      ['tasaAbandonoPct', traficoPctDesdeFraccion, null],
    ];
    opcionales.forEach(function (spec) {
      var key = spec[0], parse = spec[1], post = spec[2];
      if (map[key] === undefined) return; // columna no vino en el archivo -> no se toca (queda ausente, no null explicito)
      var val = parse(row[map[key]]);
      if (val !== null) fila[key] = post ? post(val) : val;
    });

    filas.push(fila);
    skillsSet[skillName] = true;
    mesesSet[fecha.slice(0, 7)] = true;
  }

  if (filas.length === 0) return { error: 'El archivo no tiene filas de datos validas.' };
  return {
    filas: filas,
    avisos: avisos,
    skills: Object.keys(skillsSet).sort(),
    meses: Object.keys(mesesSet).sort(),
  };
}

// ── Agregacion por granularidad (dia/mes/anio) + combinar/separar skills ──
//
// SIEMPRE suma los volumenes primero y recalcula los % desde esa suma —
// nunca promedia los % diarios. `nivelAtencionPct` y `tasaAbandonoPct` (las
// dos que importan para la grafica principal y sus KPIs) se recalculan de
// forma EXACTA como contestadas/total y abandonadas/total del periodo ya
// agregado. Los demas % que reporta Volvox (SERVICE_LEVEL_*, ABANDON) no
// tienen un numerador propio disponible aqui, asi que se agregan como
// promedio PONDERADO por TOTAL LLAMADAS del periodo (mejor aproximacion
// posible sin inventar datos; sigue sin ser un promedio simple de %).
function traficoPeriodoDe(fecha, granularidad) {
  if (granularidad === 'anio') return fecha.slice(0, 4);
  if (granularidad === 'mes') return fecha.slice(0, 7);
  return fecha;
}

function traficoFiltrarFilas(filas, opts) {
  opts = opts || {};
  var skills = opts.skills && opts.skills.length ? opts.skills : null;
  return filas.filter(function (f) {
    if (skills && skills.indexOf(f.skillName) === -1) return false;
    if (opts.sede && f.sede !== opts.sede) return false;
    if (opts.desde && f.fecha < opts.desde) return false;
    if (opts.hasta && f.fecha > opts.hasta) return false;
    return true;
  });
}

function traficoAgregar(filas, opts) {
  opts = opts || {};
  var granularidad = opts.granularidad || 'dia';
  var combinar = opts.combinar !== false;

  var buckets = {};
  var orden = [];
  var PCT_PONDERADOS = ['serviceLevel10secPct', 'serviceLevel20secPct', 'serviceLevel30secPct', 'abandonPct'];
  var NUM_PONDERADOS = ['asaSegundos', 'ataSegundos', 'ahtSegundos', 'waitTimeSegundos'];

  filas.forEach(function (f) {
    var periodo = traficoPeriodoDe(f.fecha, granularidad);
    var clave = combinar ? periodo : periodo + ' ' + f.skillName;
    if (!buckets[clave]) {
      var b0 = {
        periodo: periodo, skillName: combinar ? null : f.skillName,
        totalLlamadas: 0, contestadas: 0, llamadasAbandonadas: 0, _tieneAbandonadas: false,
      };
      PCT_PONDERADOS.concat(NUM_PONDERADOS).forEach(function (k) { b0['_suma_' + k] = 0; b0['_peso_' + k] = 0; });
      buckets[clave] = b0;
      orden.push(clave);
    }
    var b = buckets[clave];
    var peso = Number(f.totalLlamadas) || 0;
    b.totalLlamadas += peso;
    b.contestadas += Number(f.contestadas) || 0;
    if (f.llamadasAbandonadas != null) { b.llamadasAbandonadas += f.llamadasAbandonadas; b._tieneAbandonadas = true; }
    PCT_PONDERADOS.concat(NUM_PONDERADOS).forEach(function (k) {
      if (f[k] != null && peso > 0) { b['_suma_' + k] += f[k] * peso; b['_peso_' + k] += peso; }
    });
  });

  var r2 = function (n) { return Math.round(n * 100) / 100; };
  var promedioPonderado = function (b, k) { return b['_peso_' + k] > 0 ? r2(b['_suma_' + k] / b['_peso_' + k]) : null; };

  return orden.map(function (clave) {
    var b = buckets[clave];
    var out = {
      periodo: b.periodo,
      skillName: b.skillName,
      totalLlamadas: b.totalLlamadas,
      contestadas: b.contestadas,
      llamadasAbandonadas: b._tieneAbandonadas ? b.llamadasAbandonadas : null,
      nivelAtencionPct: b.totalLlamadas > 0 ? r2((b.contestadas / b.totalLlamadas) * 100) : null,
      tasaAbandonoPct: (b.totalLlamadas > 0 && b._tieneAbandonadas) ? r2((b.llamadasAbandonadas / b.totalLlamadas) * 100) : null,
    };
    PCT_PONDERADOS.concat(NUM_PONDERADOS).forEach(function (k) { out[k] = promedioPonderado(b, k); });
    return out;
  }).sort(function (a, b) {
    if (a.periodo !== b.periodo) return a.periodo < b.periodo ? -1 : 1;
    return (a.skillName || '').localeCompare(b.skillName || '');
  });
}

// Doble modo: global en el navegador, require() en Node para las pruebas.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    TRAFICO_COLUMNAS: TRAFICO_COLUMNAS,
    TRAFICO_COLUMNAS_OBLIGATORIAS: TRAFICO_COLUMNAS_OBLIGATORIAS,
    traficoColIndexMap: traficoColIndexMap,
    traficoEsFilaTotal: traficoEsFilaTotal,
    traficoFechaDesdeSerial: traficoFechaDesdeSerial,
    traficoParseFecha: traficoParseFecha,
    traficoSegundosDesdeFraccionDia: traficoSegundosDesdeFraccionDia,
    traficoPctDesdeTexto: traficoPctDesdeTexto,
    traficoPctDesdeFraccion: traficoPctDesdeFraccion,
    traficoNumero: traficoNumero,
    traficoParseFilas: traficoParseFilas,
    traficoPeriodoDe: traficoPeriodoDe,
    traficoFiltrarFilas: traficoFiltrarFilas,
    traficoAgregar: traficoAgregar,
  };
}
