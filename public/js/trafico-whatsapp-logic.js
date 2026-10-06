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

// fecha-limites-logic.js: global en el navegador, require() en Node --
// ver ese archivo para el criterio de "fecha futura".
var _traficoWppFechaLimites = (typeof require === 'function') ? require('./fecha-limites-logic.js') : (typeof window !== 'undefined' ? window : this);

// ── Columnas de la plantilla real de WhatsApp (hoja DATA) ───────────────
// Solo 5 obligatorias (cola + las 2 fechas del periodo + total + contestados);
// el resto, si falta, la metrica queda ausente (no en 0 — 0% es un dato real).
// ABANDONO (columna propia de la plantilla) NO se parsea aqui a proposito:
// mismo criterio que la Fase 45 aplico a voz (abandonPct) — la tasa de
// abandono se recalcula EXACTA desde abandonados/total en vez de confiar en
// el % que trae el archivo.
// AHT (Fase 68, Pedido 5 -- investigacion AHT, Edwin 23/09): la plantilla
// real de WhatsApp que el cliente ya aprobo (columnas de arriba) NO trae
// ningun campo de AHT/tiempo de conversacion -- confirmado contra esa
// especificacion aprobada (no hay acceso desde aqui al panel de Wolkvox en
// vivo para verificar si existe un campo asi mas alla de lo ya aprobado).
// Columna OPCIONAL nueva, mismo criterio de la reunion del 21/09 (cuando un
// dato no llega automatico, quien sube la informacion lo completa a mano en
// la misma plantilla): un archivo viejo sin esta columna sigue cargando
// exactamente igual (avisos.push solo pasa por columnas obligatorias).
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
  // Fase 87 (tema B, nota del jefe: "En WhatsApp el nivel de servicio es de
  // 5 minutos"): columna opcional nueva -- no estaba en la plantilla
  // aprobada (solo 10/20/30s). `aliases`: un archivo real de Wolkvox podria
  // traer el umbral configurado como SERVICE_LEVEL_300SEC (segundos, 300 =
  // 5 min) o alguien podria escribirlo a mano como "NIVEL DE SERVICIO 5
  // MIN" -- las 3 variantes se aceptan igual, ver traficoWppColIndexMap.
  { key: 'serviceLevel5minPct', label: 'SERVICE_LEVEL_5MIN', aliases: ['SERVICE_LEVEL_300SEC', 'NIVEL DE SERVICIO 5 MIN'] },
  { key: 'asaSegundos', label: 'ASA' },
  { key: 'ataSegundos', label: 'ATA' },
  { key: 'ahtSegundos', label: 'AHT' },
];
var TRAFICO_WPP_COLUMNAS_OBLIGATORIAS = TRAFICO_WPP_COLUMNAS.filter(function (c) { return c.obligatoria; });

// Fase 116 (archivo real de Edwin, ago-sep/2026): Wolkvox tambien exporta
// WhatsApp en el MISMO formato diario que usa voz (SKILL_NAME + DATE, una
// fila por cola y DIA -- no por periodo como la plantilla vieja de arriba),
// con columnas propias de volumen (INBOUND_CALLS/ANSWER_CALLS/ABANDON_CALLS
// en vez de TOTAL WHATSAPP/WHATSAPP CONTESTADOS/WHATSAPP ABANDONADOS). Lista
// SEPARADA (nunca se mezcla con TRAFICO_WPP_COLUMNAS de arriba): las 2
// conviven, traficoWppParseFilas detecta cual trae el archivo por el
// encabezado (ver traficoWppEsFormatoDiario) y delega al parser que
// corresponde -- un archivo con el formato viejo (periodo) sigue cargando
// exactamente igual que siempre.
// WAIT_TIME llega en este export (hora nativa de Excel) pero NUNCA se
// mapea aqui a proposito: Fase 68 (pedido explicito de Edwin) ya retiro
// Wait Time de la vista de Trafico de WhatsApp, y no hay columna
// `waitTimeSegundos` en la tabla `trafico_whatsapp` -- una columna que no
// esta en esta lista simplemente se ignora sin error (igual que ABANDON,
// que tampoco se lee aqui ni en voz desde la Fase 45).
var TRAFICO_WPP_COLUMNAS_DIARIO = [
  { key: 'colaWhatsapp', label: 'SKILL_NAME', obligatoria: true },
  { key: 'fecha', label: 'DATE', obligatoria: true },
  { key: 'totalWhatsapp', label: 'INBOUND_CALLS', obligatoria: true },
  { key: 'contestados', label: 'ANSWER_CALLS', obligatoria: true },
  { key: 'abandonados', label: 'ABANDON_CALLS' },
  { key: 'serviceLevel10secPct', label: 'SERVICE_LEVEL_10SEC' },
  { key: 'serviceLevel20secPct', label: 'SERVICE_LEVEL_20SEC' },
  { key: 'serviceLevel30secPct', label: 'SERVICE_LEVEL_30SEC' },
  { key: 'serviceLevel5minPct', label: 'SERVICE_LEVEL_5MIN', aliases: ['SERVICE_LEVEL_300SEC', 'NIVEL DE SERVICIO 5 MIN'] },
  { key: 'asaSegundos', label: 'ASA' },
  { key: 'ataSegundos', label: 'ATA' },
  { key: 'ahtSegundos', label: 'AHT' },
];
var TRAFICO_WPP_COLUMNAS_DIARIO_OBLIGATORIAS = TRAFICO_WPP_COLUMNAS_DIARIO.filter(function (c) { return c.obligatoria; });

function traficoWppColIndexMapDiario(headerRow) {
  var map = {};
  (headerRow || []).forEach(function (h, i) {
    var n = traficoWppNorm(h);
    var col = TRAFICO_WPP_COLUMNAS_DIARIO.filter(function (c) {
      if (traficoWppNorm(c.label) === n) return true;
      return (c.aliases || []).some(function (a) { return traficoWppNorm(a) === n; });
    })[0];
    if (col && map[col.key] === undefined) map[col.key] = i;
  });
  return map;
}

// Detecta el formato DIARIO (Wolkvox real) por sus 2 columnas de volumen
// (INBOUND_CALLS/ANSWER_CALLS) -- unicas de este formato, nunca apareren en
// el formato viejo de periodo (TOTAL WHATSAPP/WHATSAPP CONTESTADOS) ni en
// Trafico de Llamadas (TOTAL LLAMADAS/LLAMADAS CONTESTADAS), asi que no hay
// riesgo de confundir los 3 formatos entre si.
function traficoWppEsFormatoDiario(headerRow) {
  var map = traficoWppColIndexMapDiario(headerRow);
  return map.totalWhatsapp !== undefined && map.contestados !== undefined;
}

function traficoWppNorm(s) {
  return String(s == null ? '' : s).trim().toLowerCase();
}

// Mismo criterio que traficoEsFilaTotal (trafico-logic.js): nunca confiar en
// una fila TOTAL/resumen de la base como si fuera una cola real.
var TRAFICO_WPP_COLA_TOTAL_RE = /^(gran\s+)?total(es)?(\s+general(es)?)?$/i;
function traficoWppEsFilaTotal(colaWhatsapp) {
  return TRAFICO_WPP_COLA_TOTAL_RE.test(String(colaWhatsapp == null ? '' : colaWhatsapp).trim());
}

// Fase 87 (tema B): el emparejamiento por nombre ahora tambien acepta
// `aliases` ademas del `label` principal -- un encabezado real de Wolkvox
// puede variar (SERVICE_LEVEL_5MIN vs SERVICE_LEVEL_300SEC), y ninguna de
// las columnas de antes de esta fase define `aliases` (queda `undefined`,
// el `some` de un array vacio da `false`), asi que el resto sigue
// emparejando exactamente igual que siempre.
function traficoWppColIndexMap(headerRow) {
  var map = {};
  (headerRow || []).forEach(function (h, i) {
    var n = traficoWppNorm(h);
    var col = TRAFICO_WPP_COLUMNAS.filter(function (c) {
      if (traficoWppNorm(c.label) === n) return true;
      return (c.aliases || []).some(function (a) { return traficoWppNorm(a) === n; });
    })[0];
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

// AHT: hora nativa de Excel = fraccion de dia (0.002488... -> 3:35 -> 215s),
// mismo formato ya usado por WAIT_TIME/AHT en la plantilla de voz
// (traficoSegundosDesdeFraccionDia, trafico-logic.js) -- pedido explicito
// del cliente (Fase 67: "formato de HORA de Excel, nunca segundos como
// numero"). Vacio -> null (no 0 segundos, que seria un dato real).
function traficoWppSegundosDesdeFraccionDia(v) {
  if (v === null || v === undefined || v === '') return null;
  var n = typeof v === 'number' ? v : Number(String(v).trim().replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 86400);
}

// Fase 88: mismos helpers que trafico-logic.js (duplicados a proposito,
// mismo criterio que el resto de este archivo "gemelo") -- referencia de
// celda sin depender de la libreria XLSX, y clasificacion por FORMATO
// real de la celda (nunca por su valor).
function traficoWppCeldaRef(fila0based, col0based) {
  var col = '';
  var n = col0based;
  do {
    col = String.fromCharCode(65 + (n % 26)) + col;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return col + (fila0based + 1);
}
function traficoWppClasificarCeldaNumerica(ws, fila0based, col0based) {
  if (!ws) return null;
  var cell = ws[traficoWppCeldaRef(fila0based, col0based)];
  if (!cell || cell.t !== 'n') return null;
  return (cell.z && cell.z.indexOf('%') !== -1) ? 'porcentaje' : 'numero';
}

// SERVICE_LEVEL_10/20/30SEC/5MIN: texto "31.73 %" (con o sin espacio antes
// del %) -- ese camino NO CAMBIA con la Fase 88. `clasificacion`
// (opcional): ver traficoPctDesdeTexto (trafico-logic.js) para el detalle
// completo -- mismo criterio exacto, solo importa cuando `v` es NUMERO.
function traficoWppPctDesdeTexto(v, clasificacion) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number' && clasificacion === 'porcentaje') {
    return Number.isFinite(v) ? Math.round(v * 10000) / 100 : null;
  }
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
//
// `ws` (Fase 88, opcional): ver traficoParseFilas (trafico-logic.js) --
// mismo criterio exacto, worksheet crudo de SheetJS con cellNF:true.
//
// Fase 116: esta es la version PERIODO (plantilla vieja, una cola por
// FECHA INICIO..FECHA FIN) -- ver traficoWppParseFilas (dispatcher, mas
// abajo) para el formato DIARIO nuevo (Wolkvox real).
function traficoWppParseFilasPeriodo(aoa, ws) {
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

  // Fase 88: mismo criterio que traficoParseFilas -- ver ese comentario
  // para el detalle completo.
  if (ws) {
    ['serviceLevel10secPct', 'serviceLevel20secPct', 'serviceLevel30secPct', 'serviceLevel5minPct'].forEach(function (key) {
      if (map[key] === undefined) return;
      var col = TRAFICO_WPP_COLUMNAS.filter(function (c) { return c.key === key; })[0];
      var valoresSinFormato = [];
      for (var r = 1; r < aoa.length; r++) {
        var raw = aoa[r] ? aoa[r][map[key]] : undefined;
        if (typeof raw !== 'number') continue;
        if (traficoWppClasificarCeldaNumerica(ws, r, map[key]) === 'numero') valoresSinFormato.push(raw);
      }
      if (valoresSinFormato.length && valoresSinFormato.every(function (v) { return v <= 1; })) {
        avisos.push(
          'La columna "' + col.label + '" trae valores numericos <= 1 sin formato de porcentaje en Excel ' +
          '(ej. 0.56) -- no se adivino si son fracciones (x100) o ya estan en escala 0-100. Revisa esta columna antes de confirmar.'
        );
      }
    });
  }

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
    // Fase 86 (tema 2): solo FECHA FIN se compara contra el limite -- un
    // periodo puede terminar legitimamente el ultimo dia del mes en curso;
    // FECHA INICIO nunca es mas tardia que FECHA FIN (ya lo exige el check
    // de arriba), asi que queda cubierta sola.
    if (_traficoWppFechaLimites.fechaLimitesEsFutura(fechaFin)) { avisos.push('Fila ' + filaNum + ' (' + colaWhatsapp + '): FECHA FIN ' + fechaFin + ' esta en el futuro, se omitio.'); continue; }
    if (_traficoWppFechaLimites.fechaLimitesEsSospechosaAntigua(fechaInicio)) { avisos.push('Fila ' + filaNum + ' (' + colaWhatsapp + '): FECHA INICIO ' + fechaInicio + ' es anterior a 2020, revisa si esta bien digitada (no se omitio).'); }

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
      ['serviceLevel5minPct', traficoWppPctDesdeTexto, null],
      ['asaSegundos', traficoWppNumero, null],
      ['ataSegundos', traficoWppNumero, null],
      ['ahtSegundos', traficoWppSegundosDesdeFraccionDia, null],
    ];
    opcionales.forEach(function (spec) {
      var key = spec[0], parse = spec[1], post = spec[2];
      if (map[key] === undefined) return; // columna no vino en el archivo -> no se toca
      var clasif = ws ? traficoWppClasificarCeldaNumerica(ws, i, map[key]) : null;
      var val = parse(row[map[key]], clasif);
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

// Fase 116: formato DIARIO (export real de Wolkvox, SKILL_NAME + DATE, una
// fila por cola y DIA) -- produce la MISMA forma de fila que el formato
// periodo (fechaInicio/fechaFin), con fechaInicio===fechaFin===ese dia, para
// que el resto del pipeline (traficoWppFiltrarFilas,
// traficoWppAgregarPorPeriodo, y el reemplazo por rango del backend --
// cargarTraficoWhatsapp, Fase 115) funcione IGUAL sin tener que saber de que
// formato vino cada fila.
//
// DATE: traficoWppParseFecha ya maneja un objeto Date boxeado (rama
// `instanceof Date`, getters UTC) -- a diferencia de WAIT_TIME/AHT (Fase
// 115), aqui NO hace falta recuperar el valor crudo de `ws`: el boxeo de
// SheetJS para una celda de SOLO FECHA (sin hora) corre la medianoche local
// a UTC, pero nunca cruza el dia calendario para la zona de Colombia
// (UTC-5), asi que los getters UTC siguen dando el dia correcto --
// verificado contra el archivo real (DATE crudo 46235 / "8/1/26" -> boxeado
// "2026-08-01T05:00:00.000Z" -> getUTCDate()=1, correcto).
//
// ASA/ATA/AHT: a diferencia del formato periodo (hora nativa de Excel,
// fraccion de dia), aqui Wolkvox los exporta como TEXTO en SEGUNDOS con
// separador de miles ingles (ej. "27,554.56" = 27554,56 segundos) -- se usa
// traficoWppNumero (quita TODAS las comas) para los 3, nunca
// traficoWppSegundosDesdeFraccionDia. AHT viene "----" en todas las filas
// reales de hoy (Number("----") no es finito -> null, nunca 0).
function traficoWppParseFilasDiario(aoa, ws) {
  var map = traficoWppColIndexMapDiario(aoa[0]);
  var faltantes = TRAFICO_WPP_COLUMNAS_DIARIO_OBLIGATORIAS.filter(function (c) { return map[c.key] === undefined; });
  if (faltantes.length) {
    return {
      error: 'Faltan columnas obligatorias: ' + faltantes.map(function (c) { return c.label; }).join(', ') +
        '. Sube el archivo tal cual lo exporta Wolkvox, sin recortar columnas.',
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
    var fecha = traficoWppParseFecha(row[map.fecha]);
    var totalWhatsapp = traficoWppNumero(row[map.totalWhatsapp]);
    var contestados = traficoWppNumero(row[map.contestados]);

    if (!colaWhatsapp) { avisos.push('Fila ' + filaNum + ': SKILL_NAME vacio, se omitio.'); continue; }
    if (traficoWppEsFilaTotal(colaWhatsapp)) { avisos.push('Fila ' + filaNum + ': SKILL_NAME "' + colaWhatsapp + '" parece una fila TOTAL/resumen de la base, se omitio (nunca se suma como si fuera una cola real).'); continue; }
    if (!fecha) { avisos.push('Fila ' + filaNum + ' (' + colaWhatsapp + '): DATE invalida o vacia, se omitio.'); continue; }
    if (totalWhatsapp === null || totalWhatsapp < 0) { avisos.push('Fila ' + filaNum + ' (' + fecha + ', ' + colaWhatsapp + '): INBOUND_CALLS invalido, se omitio.'); continue; }
    if (contestados === null || contestados < 0) { avisos.push('Fila ' + filaNum + ' (' + fecha + ', ' + colaWhatsapp + '): ANSWER_CALLS invalido, se omitio.'); continue; }
    if (contestados > totalWhatsapp) { avisos.push('Fila ' + filaNum + ' (' + fecha + ', ' + colaWhatsapp + '): ANSWER_CALLS (' + contestados + ') supera INBOUND_CALLS (' + totalWhatsapp + '), se omitio.'); continue; }
    if (_traficoWppFechaLimites.fechaLimitesEsFutura(fecha)) { avisos.push('Fila ' + filaNum + ' (' + colaWhatsapp + '): DATE ' + fecha + ' esta en el futuro, se omitio.'); continue; }
    if (_traficoWppFechaLimites.fechaLimitesEsSospechosaAntigua(fecha)) { avisos.push('Fila ' + filaNum + ' (' + colaWhatsapp + '): DATE ' + fecha + ' es anterior a 2020, revisa si esta bien digitada (no se omitio).'); }

    var fila = {
      colaWhatsapp: colaWhatsapp,
      fechaInicio: fecha,
      fechaFin: fecha,
      totalWhatsapp: Math.round(totalWhatsapp),
      contestados: Math.round(contestados),
    };
    var opcionales = [
      ['abandonados', traficoWppNumero, Math.round],
      ['serviceLevel10secPct', traficoWppPctDesdeTexto, null],
      ['serviceLevel20secPct', traficoWppPctDesdeTexto, null],
      ['serviceLevel30secPct', traficoWppPctDesdeTexto, null],
      ['serviceLevel5minPct', traficoWppPctDesdeTexto, null],
      ['asaSegundos', traficoWppNumero, null],
      ['ataSegundos', traficoWppNumero, null],
      ['ahtSegundos', traficoWppNumero, null],
    ];
    opcionales.forEach(function (spec) {
      var key = spec[0], parse = spec[1], post = spec[2];
      if (map[key] === undefined) return;
      var val = parse(row[map[key]]);
      if (val !== null) fila[key] = post ? post(val) : val;
    });

    filas.push(fila);
    colasSet[colaWhatsapp] = true;
    periodosSet[fecha + '_' + fecha] = true;
  }

  if (filas.length === 0) return { error: 'El archivo no tiene filas de datos validas.' };
  return {
    filas: filas,
    avisos: avisos,
    colas: Object.keys(colasSet).sort(),
    periodos: Object.keys(periodosSet).sort(),
  };
}

// Dispatcher publico: detecta el formato por el encabezado (Fase 116) y
// delega al parser que corresponde -- ver traficoWppEsFormatoDiario.
function traficoWppParseFilas(aoa, ws) {
  if (!aoa || !aoa.length) return { error: 'El archivo esta vacio.' };
  if (traficoWppEsFormatoDiario(aoa[0])) return traficoWppParseFilasDiario(aoa, ws);
  return traficoWppParseFilasPeriodo(aoa, ws);
}

// ── Filtro por cola + rango de fechas (Fase 68, Pedido 5) ───────────────
// Mismo nombre de opciones que traficoFiltrarFilas (trafico-logic.js:
// `skills`/`desde`/`hasta`) para que el codigo de UI compartido (trafico.js)
// pueda leer/escribir el estado de filtros igual sin importar el canal --
// aqui `skills` selecciona colas, no SKILL_NAME de Volvox. La diferencia de
// fondo es de FECHA: en voz cada fila tiene un solo dia (`f.fecha`) asi que
// el filtro es una comparacion directa; aqui cada fila es un PERIODO
// (fechaInicio..fechaFin), asi que "Desde"/"Hasta" incluye cualquier
// periodo que SE SOLAPE con el rango elegido (no exige que el periodo
// quede totalmente adentro) -- mismo criterio intuitivo de cualquier
// filtro de rango de fechas sobre eventos con duracion.
function traficoWppFiltrarFilas(filas, opts) {
  opts = opts || {};
  var skills = opts.skills && opts.skills.length ? opts.skills : null;
  return filas.filter(function (f) {
    if (skills && skills.indexOf(f.colaWhatsapp) === -1) return false;
    if (opts.desde && f.fechaFin < opts.desde) return false;
    if (opts.hasta && f.fechaInicio > opts.hasta) return false;
    return true;
  });
}

// ── Agregado por granularidad (mes/año) + combinar/separar colas ───────
// Cada fila YA es UNA cola para UN periodo completo (fechaInicio..fechaFin)
// -- a diferencia de traficoAgregar (trafico-logic.js), que suma muchas
// filas DIARIAS, aqui "agregar" es sobre todo AGRUPAR por mes/año (y sumar
// si mas de una fila cae en el mismo periodo agrupado, ej. dos archivos
// del mismo mes cargados por separado). Sin 'dia': estos datos no tienen
// granularidad diaria (ver Pedido 5, nota de grano de datos) -- el llamador
// (trafico-whatsapp.js) nunca ofrece esa opcion en el desplegable.
//
// Forma de salida EXACTAMENTE IGUAL a traficoAgregar (periodo/skillName/
// totalLlamadas/contestadas/llamadasAbandonadas/nivelAtencionPct/
// tasaAbandonoPct/serviceLevel10-30secPct/asaSegundos/ataSegundos/
// ahtSegundos/waitTimeSegundos), a proposito: asi las mismas funciones de
// dibujo de graficas de Trafico de Llamadas (trafico.js) se reusan tal
// cual para Trafico de WhatsApp (Fase 68, Pedido 5) sin tener que conocer
// de que canal viene el dato. `skillName` aqui es el nombre de la cola;
// `waitTimeSegundos` siempre null (WhatsApp no tiene ese dato). Mismo
// criterio de traficoAgregar: SIEMPRE suma volumenes primero y recalcula
// el % desde esa suma; SERVICE_LEVEL_*/ASA/ATA/AHT se agregan como
// promedio ponderado por TOTAL WHATSAPP.
function traficoWppPeriodoDe(fechaInicio, granularidad) {
  if (granularidad === 'anio') return fechaInicio.slice(0, 4);
  return fechaInicio.slice(0, 7); // 'mes' -- unico grano real disponible hoy
}

function traficoWppAgregarPorPeriodo(filas, opts) {
  opts = opts || {};
  var granularidad = opts.granularidad || 'mes';
  var combinar = opts.combinar !== false;

  var buckets = {};
  var orden = [];
  var PCT_PONDERADOS = ['serviceLevel10secPct', 'serviceLevel20secPct', 'serviceLevel30secPct', 'serviceLevel5minPct'];
  // Fase 77 (mismo hallazgo de Edwin que trafico-logic.js/traficoAgregar):
  // AHT/ASA son tiempo por WhatsApp CONTESTADO, no por total -- un chat
  // abandonado nunca lo atiende un agente.
  // Fase 120 (mismo hallazgo real que trafico-logic.js/traficoAgregar,
  // verificado contra el archivo real de WhatsApp ago-sep/2026): ATA es un
  // tiempo por WhatsApp ABANDONADO, no por total -- ponderarlo por total
  // diluye el promedio con periodos de mucho volumen y pocos abandonos.
  // Ahora pondera por abandonados, igual que AHT/ASA ponderan por
  // contestados.
  var PONDERADOS_POR_TOTAL = [];
  var PONDERADOS_POR_CONTESTADAS = ['asaSegundos', 'ahtSegundos'];
  var PONDERADOS_POR_ABANDONADOS = ['ataSegundos'];
  var NUM_PONDERADOS = PONDERADOS_POR_TOTAL.concat(PONDERADOS_POR_CONTESTADAS).concat(PONDERADOS_POR_ABANDONADOS);

  filas.forEach(function (f) {
    var periodo = traficoWppPeriodoDe(f.fechaInicio, granularidad);
    var clave = combinar ? periodo : periodo + ' ' + f.colaWhatsapp;
    if (!buckets[clave]) {
      var b0 = {
        periodo: periodo, skillName: combinar ? null : f.colaWhatsapp,
        totalLlamadas: 0, contestadas: 0, llamadasAbandonadas: 0, _tieneAbandonadas: false,
      };
      PCT_PONDERADOS.concat(NUM_PONDERADOS).forEach(function (k) { b0['_suma_' + k] = 0; b0['_peso_' + k] = 0; });
      buckets[clave] = b0;
      orden.push(clave);
    }
    var b = buckets[clave];
    var pesoTotal = Number(f.totalWhatsapp) || 0;
    var pesoContestadas = Number(f.contestados) || 0;
    var pesoAbandonados = Number(f.abandonados) || 0;
    b.totalLlamadas += pesoTotal;
    b.contestadas += pesoContestadas;
    if (f.abandonados != null) { b.llamadasAbandonadas += f.abandonados; b._tieneAbandonadas = true; }
    PCT_PONDERADOS.concat(PONDERADOS_POR_TOTAL).forEach(function (k) {
      if (f[k] != null && pesoTotal > 0) { b['_suma_' + k] += f[k] * pesoTotal; b['_peso_' + k] += pesoTotal; }
    });
    PONDERADOS_POR_ABANDONADOS.forEach(function (k) {
      if (f[k] != null && pesoAbandonados > 0) { b['_suma_' + k] += f[k] * pesoAbandonados; b['_peso_' + k] += pesoAbandonados; }
    });
    PONDERADOS_POR_CONTESTADAS.forEach(function (k) {
      if (f[k] != null && pesoContestadas > 0) { b['_suma_' + k] += f[k] * pesoContestadas; b['_peso_' + k] += pesoContestadas; }
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
      waitTimeSegundos: null,
    };
    PCT_PONDERADOS.concat(NUM_PONDERADOS).forEach(function (k) { out[k] = promedioPonderado(b, k); });
    return out;
  }).sort(function (a, b) {
    if (a.periodo !== b.periodo) return a.periodo < b.periodo ? -1 : 1;
    return (a.skillName || '').localeCompare(b.skillName || '');
  });
}

// Fase 87 (tema A, nota del jefe: "siempre tener visible el nivel de
// servicio, en Resumen"): mismo criterio EXACTO que traficoServiceLevelPromedioPeriodo
// (trafico-logic.js) pero ponderado por TOTAL WHATSAPP -- cada fila de este
// canal es una cola por PERIODO, no por dia, pero el peso correcto sigue
// siendo el volumen que entro (contestado o no), nunca solo lo contestado.
function traficoWppServiceLevelPromedioPeriodo(filas, campo) {
  var suma = 0, peso = 0;
  (filas || []).forEach(function (f) {
    var w = Number(f.totalWhatsapp) || 0;
    if (f[campo] != null && w > 0) { suma += f[campo] * w; peso += w; }
  });
  return peso > 0 ? Math.round((suma / peso) * 100) / 100 : null;
}

// Doble modo: global en el navegador, require() en Node para las pruebas.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    TRAFICO_WPP_COLUMNAS: TRAFICO_WPP_COLUMNAS,
    TRAFICO_WPP_COLUMNAS_OBLIGATORIAS: TRAFICO_WPP_COLUMNAS_OBLIGATORIAS,
    TRAFICO_WPP_COLUMNAS_DIARIO: TRAFICO_WPP_COLUMNAS_DIARIO,
    TRAFICO_WPP_COLUMNAS_DIARIO_OBLIGATORIAS: TRAFICO_WPP_COLUMNAS_DIARIO_OBLIGATORIAS,
    traficoWppColIndexMapDiario: traficoWppColIndexMapDiario,
    traficoWppEsFormatoDiario: traficoWppEsFormatoDiario,
    traficoWppParseFilasPeriodo: traficoWppParseFilasPeriodo,
    traficoWppParseFilasDiario: traficoWppParseFilasDiario,
    traficoWppColIndexMap: traficoWppColIndexMap,
    traficoWppEsFilaTotal: traficoWppEsFilaTotal,
    traficoWppFechaDesdeSerial: traficoWppFechaDesdeSerial,
    traficoWppParseFecha: traficoWppParseFecha,
    traficoWppPctDesdeTexto: traficoWppPctDesdeTexto,
    traficoWppCeldaRef: traficoWppCeldaRef,
    traficoWppClasificarCeldaNumerica: traficoWppClasificarCeldaNumerica,
    traficoWppNumero: traficoWppNumero,
    traficoWppSegundosDesdeFraccionDia: traficoWppSegundosDesdeFraccionDia,
    traficoWppParseFilas: traficoWppParseFilas,
    traficoWppFiltrarFilas: traficoWppFiltrarFilas,
    traficoWppPeriodoDe: traficoWppPeriodoDe,
    traficoWppAgregarPorPeriodo: traficoWppAgregarPorPeriodo,
    traficoWppServiceLevelPromedioPeriodo: traficoWppServiceLevelPromedioPeriodo,
  };
}
