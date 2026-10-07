// inasistencia-logic.js — InConexion Platform (Fase 98, ORLANT, pedido
// urgente de Edwin; Fase 108, pedido textual de InCo: "la inasistencia va
// a ser por mes, que se pueda filtrar por sede, especialidad, nombre
// entidad").
//
// Logica PURA (sin DOM) de "Inasistencia" de ORLANT. Doble modo como
// agendas-logic.js: global en el navegador, require() en Node para las
// pruebas (server/tests/inasistencia-logic.test.js).
//
// Fase 108 — cambio de fondo: el archivo real de Edwin dejo de traer un
// agregado por mes+especialidad (formato viejo, Fase 98-106) y ahora trae
// UNA FILA POR CITA (hoja "Hoja1", no "INASISTENCIA"): SEDE, ESPECIALIDAD
// (o "ESPECIALIDA", sin la D), FECHA_CITA, NOMBRE ENTIDAD, CITEST (C =
// cancelada, I = inasistencia, P = pendiente, T = atendida). Decision de
// producto: el formato AGREGADO viejo (7 columnas MES/ESPECIALIDAD/
// CANCELADA/INASISTENCIA/PENDIENTE/ATENDIDAS/TOTAL) NO se sigue aceptando
// -- son 2 esquemas sin columnas en comun salvo ESPECIALIDAD, soportar los
// 2 a la vez habria significado 2 rutas de parseo/validacion/pruebas
// completas por mantener para un formato que ya nadie va a volver a
// generar (Edwin ya migro a Hoja1). Las filas YA CARGADAS con el formato
// viejo (Ago-26 de 3 especialidades, Sep-26 de 1) se conservan intactas
// (migracion de datos `inasistencias_sede_entidad_v1`, server/db.js, les
// asigna sede/entidad = 'SIN DATO') -- no se pierde nada, solo que una
// carga NUEVA tiene que venir en el formato nuevo.
//
// El navegador agrega las ~83.000 filas crudas a (mes, sede, especialidad,
// entidad) ANTES de armar el payload -- el servidor nunca ve una fila
// cruda (mismo patron que Agendas/Tipificacion). Por eso `filas` que
// devuelve `inasistenciaParseFilas` ya son filas AGREGADAS (como en el
// formato viejo), solo que ahora con `sede` y `entidad` ademas de `mes`/
// `especialidad`.
'use strict';

// fecha-limites-logic.js: global en el navegador, require() en Node.
var _inasistenciaFechaLimites = (typeof require === 'function') ? require('./fecha-limites-logic.js') : (typeof window !== 'undefined' ? window : this);
// agendas-logic.js: global en el navegador, require() en Node -- se reusa
// agendasAplicarPrivacidadEntidad TAL CUAL (Fase 78), nunca se duplica la
// formula de privacidad de NOMBRE_ENTIDAD.
var _inasistenciaAgendasLogic = (typeof require === 'function') ? require('./agendas-logic.js') : (typeof window !== 'undefined' ? window : this);

// ── Columnas de la hoja de Inasistencia (formato nuevo, Fase 108) ───────
// Emparejamiento por NOMBRE de columna, nunca por posicion. ESPECIALIDAD
// acepta tambien "ESPECIALIDA" (sin la D -- asi viene en el archivo real
// de Edwin, ver `labelAlt`). Las 5 son obligatorias: sin SEDE/FECHA_CITA/
// CITEST la fila no se puede ubicar en el tiempo ni clasificar; ESPECIALIDAD
// y NOMBRE ENTIDAD vacias se conservan igual con un valor "SIN ..." (nunca
// se descarta una cita real solo por eso, mismo criterio que "SIN ASESOR"
// de Agendas, Fase 104).
var INASISTENCIA_COLUMNAS = [
  { key: 'sede', label: 'SEDE', obligatoria: true },
  { key: 'especialidad', label: 'ESPECIALIDAD', labelAlt: ['ESPECIALIDA'], obligatoria: true },
  { key: 'fecha', label: 'FECHA_CITA', obligatoria: true },
  { key: 'entidad', label: 'NOMBRE ENTIDAD', obligatoria: true },
  { key: 'citest', label: 'CITEST', obligatoria: true },
];
var INASISTENCIA_COLUMNAS_OBLIGATORIAS = INASISTENCIA_COLUMNAS.filter(function (c) { return c.obligatoria; });
// Orden fijo para el payload compacto (arrays) -- ver inasistenciaFilaComoArray.
// Mismo orden que server/inasistencia.js (CAMPOS_FILA) y
// validation.js (inasistenciaFilaArraySchema).
var INASISTENCIA_ORDEN_ARRAY = ['mes', 'sede', 'especialidad', 'entidad', 'cancelada', 'inasistencia', 'pendiente', 'atendidas', 'total'];

// CITEST -> campo del sistema. Confirmado contra el agregado de control
// del pedido de InCo (archivo real de 83.006 filas, ene-ago 2026):
// C=16.433 cancelada, I=5.278 inasistencia, P=429 pendiente, T=60.866
// atendidas -- el % de inasistencia por mes calculado con este mapeo
// coincide exacto con la tabla de control fila por fila.
var INASISTENCIA_CITEST_CAMPO = { C: 'cancelada', I: 'inasistencia', P: 'pendiente', T: 'atendidas' };

// Umbral de rechazo de CITEST desconocido/vacio: por debajo de este %, las
// filas con CITEST invalido se omiten con un aviso (no se pierde un
// archivo bueno por unas pocas filas mal digitadas); por encima, la carga
// COMPLETA se rechaza (senal de que el archivo no es el formato esperado,
// o de un problema real en el origen) -- no hay un umbral parecido ya
// usado en este repo para copiar; se eligio 5% como piso razonable, mismo
// orden de magnitud que el resto de controles "no bloqueantes vs
// bloqueantes" de esta plataforma.
var INASISTENCIA_CITEST_UMBRAL_RECHAZO = 0.05;

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

// Serial de Excel (sin hora) -> 'AAAA-MM-DD' -- aritmetica directa sobre
// UTC, nunca Date+cellDates de SheetJS (puede desplazar el dia por la zona
// horaria del sistema). Mismo criterio que agendasFechaHoraDesdeSerial.
function _inasistenciaSerialAFecha(serial) {
  var n = Number(serial);
  if (!Number.isFinite(n)) return null;
  var ms = Math.round((n - 25569) * 86400000);
  var d = new Date(ms);
  if (isNaN(d.getTime())) return null;
  var y = d.getUTCFullYear();
  if (y < 1970 || y > 2200) return null;
  var pad2 = function (x) { return (x < 10 ? '0' : '') + x; };
  return y + '-' + pad2(d.getUTCMonth() + 1) + '-' + pad2(d.getUTCDate());
}

// Texto "dd/mm/aaaa" -> "aaaa-mm-dd" -- parseo MANUAL (nunca `new
// Date(texto)`: dd/mm/aaaa es ambiguo para el motor de fechas de JS, que
// asume mm/dd/aaaa en locale en-US -- Fase 90). Tambien acepta texto ya en
// formato ISO o un serial de Excel como texto.
var INASISTENCIA_FECHA_TEXTO_RE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
// Fase 129 (hallazgo real en producción con el archivo real de Edwin,
// 83.006 filas): la carga consolidada SIEMPRE lee el Excel con
// `cellNF:true` (necesario para Trafico, nunca para Inasistencia --
// cargas.js) -- en la version vendorizada de SheetJS de este repo, esa
// sola opción hace que una celda con formato de FECHA (sin importar
// cellDates, confirmado: cellDates:false NO lo revierte) llegue como un
// objeto `Date` nativo en vez del serial numerico de siempre. Antes de
// este fix, `inasistenciaParseFechaCita` solo sabia leer number/string,
// asi que TODAS las filas del archivo real quedaban con "FECHA_CITA
// invalida", disparando el rechazo completo de la carga ("Ninguna fila
// valida") -- un archivo perfectamente valido parecia "no reconocido".
// `Date.getFullYear/getMonth/getDate` (LOCALES, nunca getUTC*): SheetJS
// construye este objeto interpretando el serial con el reloj LOCAL del
// navegador (documentado así por la propia librería) -- leerlo con los
// getters LOCALES es la unica lectura que siempre redondea ida y vuelta
// al mismo año/mes/día sin importar en que zona horaria corra el
// navegador de quien sube el archivo (los getters UTC si pueden
// desplazar el día si el navegador no esta en UTC-5).
function _inasistenciaFechaDesdeDateLocal(d) {
  if (isNaN(d.getTime())) return null;
  var y = d.getFullYear();
  if (y < 1970 || y > 2200) return null;
  var pad2 = function (x) { return (x < 10 ? '0' : '') + x; };
  return y + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}
function inasistenciaParseFechaCita(v) {
  if (v instanceof Date) return _inasistenciaFechaDesdeDateLocal(v);
  if (typeof v === 'number') return _inasistenciaSerialAFecha(v);
  if (typeof v === 'string') {
    var t = v.trim();
    if (t === '') return null;
    if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
    if (/^\d+(\.\d+)?$/.test(t)) return _inasistenciaSerialAFecha(Number(t));
    var m = INASISTENCIA_FECHA_TEXTO_RE.exec(t);
    if (!m) return null;
    var dd = parseInt(m[1], 10), mm = parseInt(m[2], 10), aaaa = parseInt(m[3], 10);
    if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
    var pad2 = function (x) { return (x < 10 ? '0' : '') + x; };
    return aaaa + '-' + pad2(mm) + '-' + pad2(dd);
  }
  return null;
}

// ── Parseo de filas (aoa = array-of-arrays, fila 0 = encabezados) ───────
// Devuelve { error } si falta una columna obligatoria o si demasiadas
// filas traen un CITEST desconocido, o { filas, avisos, entidadesAgrupadas,
// entidadesSinDato } -- `filas` YA vienen agregadas a (mes, sede,
// especialidad, entidad) con sus 5 conteos, listas para
// inasistenciaFilaComoArray. Fila vacia se ignora. NUNCA se deduplican
// filas exactamente repetidas (a proposito, Fase 88 es opt-in por modulo):
// sin id de cita, 2 citas con la misma sede/especialidad/fecha/entidad/
// estado son 2 citas reales, no un error de carga.
function inasistenciaParseFilas(aoa, ahora) {
  if (!aoa || !aoa.length) return { error: 'El archivo esta vacio.' };
  var map = inasistenciaColIndexMap(aoa[0]);
  var faltantes = INASISTENCIA_COLUMNAS_OBLIGATORIAS.filter(function (c) { return map[c.key] === undefined; });
  if (faltantes.length) {
    return {
      error: 'Faltan columnas obligatorias: ' + faltantes.map(function (c) { return c.label; }).join(', ') +
        '. Sube la hoja de Inasistencia tal cual la exporta el sistema de Edwin (SEDE, ESPECIALIDAD, FECHA_CITA, ' +
        'NOMBRE ENTIDAD, CITEST), sin recortar columnas.',
    };
  }

  var crudas = [];
  var avisos = [];
  var sedeSinDato = 0, especialidadSinDato = 0, citestDesconocidos = 0;
  var totalFilasConDatos = 0;

  for (var i = 1; i < aoa.length; i++) {
    var row = aoa[i];
    if (!row || row.every(function (v) { return v === '' || v === null || v === undefined; })) continue;
    var filaNum = i + 1;
    totalFilasConDatos++;

    var sedeCruda = inasistenciaNormTexto(row[map.sede]).toUpperCase();
    var especialidadCruda = inasistenciaNormTexto(row[map.especialidad]).toUpperCase();
    var entidad = inasistenciaNormTexto(row[map.entidad]);
    var fecha = inasistenciaParseFechaCita(row[map.fecha]);
    var citestCrudo = inasistenciaNormTexto(row[map.citest]).toUpperCase();

    var sede = sedeCruda || 'SIN SEDE';
    if (!sedeCruda) sedeSinDato++;
    var especialidad = especialidadCruda || 'SIN ESPECIALIDAD';
    if (!especialidadCruda) especialidadSinDato++;

    if (!fecha) {
      avisos.push('Fila ' + filaNum + ': FECHA_CITA invalida o vacia, se omitio.');
      continue;
    }
    if (_inasistenciaFechaLimites.fechaLimitesEsFutura(fecha, ahora)) {
      avisos.push('Fila ' + filaNum + ': FECHA_CITA ' + fecha + ' esta en el futuro, se omitio.');
      continue;
    }
    if (_inasistenciaFechaLimites.fechaLimitesEsSospechosaAntigua(fecha)) {
      avisos.push('Fila ' + filaNum + ': FECHA_CITA ' + fecha + ' es anterior a 2020, revisa si esta bien digitada (no se omitio).');
    }
    var campo = INASISTENCIA_CITEST_CAMPO[citestCrudo];
    if (!campo) {
      citestDesconocidos++;
      avisos.push('Fila ' + filaNum + ': CITEST "' + citestCrudo + '" no reconocido (debe ser C/I/P/T), se omitio.');
      continue;
    }

    crudas.push({ mes: fecha.slice(0, 7), sede: sede, especialidad: especialidad, entidad: entidad, citestCampo: campo });
  }

  if (totalFilasConDatos > 0 && (citestDesconocidos / totalFilasConDatos) > INASISTENCIA_CITEST_UMBRAL_RECHAZO) {
    return {
      error: citestDesconocidos + ' de ' + totalFilasConDatos + ' fila(s) (' +
        Math.round((citestDesconocidos / totalFilasConDatos) * 100) + '%) traen un CITEST desconocido (debe ser C/I/P/T) -- ' +
        'revisa si este es realmente el archivo de Inasistencia. La carga se cancelo, no se guardo nada.',
    };
  }
  if (!crudas.length) return { error: 'Ninguna fila valida (revisa los avisos anteriores).', avisos: avisos };

  // Privacidad (Fase 78, agendasAplicarPrivacidadEntidad TAL CUAL, nunca
  // duplicada): la frecuencia se cuenta sobre TODAS las filas crudas de
  // ESTE archivo (antes de agregar) -- 2 veces del mismo archivo con la
  // misma entidad siguen juntas en "PARTICULAR / OTRA" o visibles, segun
  // el conteo total de ESTE archivo.
  var priv = _inasistenciaAgendasLogic.agendasAplicarPrivacidadEntidad(crudas);

  // Agregar a (mes, sede, especialidad, entidadFinal) con los 5 conteos.
  var agg = {};
  priv.filas.forEach(function (f) {
    var k = f.mes + '|' + f.sede + '|' + f.especialidad + '|' + f.entidad;
    if (!agg[k]) agg[k] = { mes: f.mes, sede: f.sede, especialidad: f.especialidad, entidad: f.entidad, cancelada: 0, inasistencia: 0, pendiente: 0, atendidas: 0, total: 0 };
    agg[k][f.citestCampo]++;
    agg[k].total++;
  });
  var filasAgregadas = Object.keys(agg).sort().map(function (k) { return agg[k]; });

  if (sedeSinDato > 0) avisos.push(sedeSinDato + ' fila(s) sin SEDE -- se guardaron igual, agrupadas como "SIN SEDE".');
  if (especialidadSinDato > 0) avisos.push(especialidadSinDato + ' fila(s) sin ESPECIALIDAD -- se guardaron igual, agrupadas como "SIN ESPECIALIDAD".');
  if (priv.entidadesAgrupadas > 0 || priv.entidadesSinDato > 0) {
    avisos.push(
      priv.entidadesAgrupadas + ' fila(s) con entidad agrupada por privacidad (menos de 5 citas de esa entidad en este archivo, ' +
      '"PARTICULAR / OTRA"), ' + priv.entidadesSinDato + ' sin entidad ("SIN ENTIDAD").'
    );
  }

  return {
    filas: filasAgregadas, avisos: avisos,
    entidadesAgrupadas: priv.entidadesAgrupadas, entidadesSinDato: priv.entidadesSinDato,
  };
}

// Fila (objeto) -> array en INASISTENCIA_ORDEN_ARRAY, para el payload
// compacto que se manda al servidor -- ver server/inasistencia.js.
function inasistenciaFilaComoArray(f) {
  return INASISTENCIA_ORDEN_ARRAY.map(function (k) { return f[k]; });
}

// Meses distintos (ordenados) entre las filas ya parseadas -- para el
// mensaje de confirmacion de carga ("Se cargará como Ene-26 ... Ago-26").
function inasistenciaMesesDeFilas(filas) {
  var set = {};
  (filas || []).forEach(function (f) { set[f.mes] = true; });
  return Object.keys(set).sort();
}

// % ponderado = (inasistencia+pendiente)/total, 2 decimales -- formula
// UNICA reusada por el navegador (panel, export) y el servidor
// (server/inasistencia.js hace la misma cuenta en SQL) para que nunca
// queden 2 redondeos distintos del mismo numero. total<=0 -> null (nunca
// se inventa un 0%).
function inasistenciaPctPonderado(inasistencia, pendiente, total) {
  if (!total || total <= 0) return null;
  return Math.round(((inasistencia + pendiente) / total) * 10000) / 100;
}

// % ponderado de TODO un conjunto de filas/meses ya agregados (Fase 108:
// tarjeta de "Resumen por mes" con el total del PERIODO filtrado completo,
// no de un solo mes) -- Σ(inasistencia+pendiente) / Σtotal, reusando
// inasistenciaPctPonderado, nunca el promedio simple de los % de cada mes.
function inasistenciaPonderadoTotal(filas) {
  var tot = { inasistencia: 0, pendiente: 0, total: 0 };
  (filas || []).forEach(function (f) {
    tot.inasistencia += f.inasistencia; tot.pendiente += f.pendiente; tot.total += f.total;
  });
  return { inasistencia: tot.inasistencia, pendiente: tot.pendiente, total: tot.total, pct: inasistenciaPctPonderado(tot.inasistencia, tot.pendiente, tot.total) };
}

// "4,16 %" -- 2 decimales, coma decimal (es-CO), con el simbolo de %. null -> "—".
function inasistenciaFmtPct(v) {
  if (v === null || v === undefined) return '—';
  return v.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' %';
}

// 'AAAA-MM' -> "Ago-26" (mismo formato corto que _agendasMesLbl/
// _tipificacionMesLbl) -- pura, usada por cargas.js (mensaje de
// confirmacion) e inasistencia.js (selector/tarjetas/graficas).
var INASISTENCIA_MESES_ABREV = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
function inasistenciaMesLbl(mes) {
  var partes = String(mes || '').split('-');
  return partes.length === 2 ? (INASISTENCIA_MESES_ABREV[parseInt(partes[1], 10) - 1] + '-' + partes[0].slice(2)) : String(mes || '');
}

// Agrega TODAS las especialidades de cada mes (Fase 101/106/108: "Resumen
// por mes" siempre suma TODAS las especialidades que dejaron pasar los
// filtros de sede/especialidad/entidad -- el filtrado en si lo hace el
// servidor, esta funcion solo agrega lo que ya llego) a partir de filas
// (mes, especialidad, conteos). El % de cada mes es PONDERADO sobre la
// suma real (inasistenciaPctPonderado), nunca el promedio simple de los %
// de cada especialidad -- con Ago-26 real (varias especialidades, tamaños
// muy distintos) el promedio simple da un numero mas alto y menos
// correcto que el ponderado. También guarda que especialidades aportaron
// datos ese mes (para los avisos de mes parcial/incompleto, ver
// inasistenciaAvisosPorMes).
function inasistenciaAgregarPorMes(filas) {
  var porMes = {};
  (filas || []).forEach(function (r) {
    if (!porMes[r.mes]) porMes[r.mes] = { mes: r.mes, cancelada: 0, inasistencia: 0, pendiente: 0, atendidas: 0, total: 0, especialidades: {} };
    var m = porMes[r.mes];
    m.cancelada += r.cancelada; m.inasistencia += r.inasistencia; m.pendiente += r.pendiente;
    m.atendidas += r.atendidas; m.total += r.total;
    m.especialidades[r.especialidad] = true;
  });
  return Object.keys(porMes).sort().map(function (mes) {
    var m = porMes[mes];
    return {
      mes: mes,
      cancelada: m.cancelada,
      inasistencia: m.inasistencia,
      pendiente: m.pendiente,
      atendidas: m.atendidas,
      total: m.total,
      inasistenciaPendiente: m.inasistencia + m.pendiente,
      pct: inasistenciaPctPonderado(m.inasistencia, m.pendiente, m.total),
      especialidades: Object.keys(m.especialidades).sort(),
    };
  });
}

// "Ene-26 a Sep-26" (o "Ago-26" si solo hay un mes, o "" sin meses) -- para
// que la tarjeta del periodo (Fase 109) diga explicitamente el RANGO que
// esta promediando, en vez de poder confundirse con el mes del selector
// global de arriba. `agregado` es la salida de inasistenciaAgregarPorMes
// (YA respeta los filtros de sede/especialidad/entidad).
function inasistenciaRangoLbl(agregado) {
  if (!agregado || !agregado.length) return '';
  var a = inasistenciaMesLbl(agregado[0].mes);
  var b = inasistenciaMesLbl(agregado[agregado.length - 1].mes);
  return a === b ? a : (a + ' a ' + b);
}

// Clasifica cada mes del "Resumen por mes" para avisar sin confundir (Fase
// 109, hallazgo real: Sep-26 quedo del formato viejo -- Fase 98-106, sede/
// entidad='SIN DATO' -- mientras Ene-26 a Ago-26 ya vienen del archivo
// nuevo de InCo, una fila por cita):
//   - 'parcial': el mes es 100% formato viejo (`mesesFormatoViejo`, que
//     trae el servidor en /opciones -- TODAS sus filas tienen sede/
//     entidad='SIN DATO'). Nunca se clasifica TAMBIEN como 'incompleto'
//     para el mismo mes -- ya queda explicado por si solo.
//   - 'incompleto': el mes trae MENOS especialidades que el mas completo
//     del rango YA FILTRADO, pero SI tiene sede/entidad real (ej. un mes
//     recien empezado) -- mismo criterio que antes de esta fase.
//   - 'sinDatosFiltro': el mes tiene datos en general (esta en
//     `mesesTodos`, la lista SIN filtrar de /opciones) pero el filtro de
//     sede/especialidad/entidad activo lo dejo sin ninguna fila -- por
//     eso no aparece en `agregado`.
// `agregado` es la salida de inasistenciaAgregarPorMes (YA filtrada);
// `mesesTodos`/`mesesFormatoViejo` son el universo SIN filtrar (campos de
// /calidad/inasistencia/opciones) -- nunca se recalculan aqui, siempre
// vienen del servidor.
function inasistenciaAvisosPorMes(agregado, mesesTodos, mesesFormatoViejo) {
  var lista = agregado || [];
  var esFormatoViejo = {};
  (mesesFormatoViejo || []).forEach(function (m) { esFormatoViejo[m] = true; });
  var max = lista.reduce(function (a, m) { return Math.max(a, (m.especialidades || []).length); }, 0);

  var avisos = lista
    .filter(function (m) { return (m.especialidades || []).length > 0; })
    .map(function (m) {
      if (esFormatoViejo[m.mes]) return { mes: m.mes, tipo: 'parcial', especialidades: m.especialidades };
      if (max && m.especialidades.length < max) return { mes: m.mes, tipo: 'incompleto', especialidades: m.especialidades };
      return null;
    })
    .filter(function (a) { return a; });

  var mesesPresentes = {};
  lista.forEach(function (m) { mesesPresentes[m.mes] = true; });
  (mesesTodos || []).forEach(function (mes) {
    if (!mesesPresentes[mes]) avisos.push({ mes: mes, tipo: 'sinDatosFiltro' });
  });

  return avisos.sort(function (a, b) { return a.mes < b.mes ? -1 : a.mes > b.mes ? 1 : 0; });
}

// Ordena filas "por especialidad" (de un solo mes) de mayor a menor %,
// marcando con `baseBaja:true` las que tienen MENOS citas que `umbral` en
// ese mes (Fase 108, pedido explicito: una especialidad con pocas citas da
// un % extremo y enganoso -- ej. 1 de 2 citas = 50%) -- esas se mandan al
// final, en vez de orden normal por %, para que no parezcan las "peores"
// cuando en realidad es una base casi sin datos. `umbral` por defecto 30
// (documentado en el reporte de la Fase 108: suficiente para que el %
// deje de moverse en saltos de varios puntos por una sola cita mas o
// menos, sin ser tan alto que esconda especialidades reales con volumen
// moderado). Nunca expone el conteo real en el resultado (Fase 106: solo
// porcentaje en pantalla) -- el llamador decide que mostrar con la marca.
function inasistenciaOrdenarBaseBaja(filas, umbral) {
  var u = (typeof umbral === 'number' && umbral > 0) ? umbral : 30;
  var marcadas = (filas || []).map(function (f) {
    return { especialidad: f.especialidad, pct: f.pct, baseBaja: (f.total || 0) < u };
  });
  var normales = marcadas.filter(function (f) { return !f.baseBaja; }).sort(function (a, b) { return (b.pct || 0) - (a.pct || 0); });
  var bajas = marcadas.filter(function (f) { return f.baseBaja; }).sort(function (a, b) { return (b.pct || 0) - (a.pct || 0); });
  return normales.concat(bajas);
}

// Doble modo: global en el navegador, require() en Node para las pruebas.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    INASISTENCIA_COLUMNAS: INASISTENCIA_COLUMNAS,
    INASISTENCIA_COLUMNAS_OBLIGATORIAS: INASISTENCIA_COLUMNAS_OBLIGATORIAS,
    INASISTENCIA_ORDEN_ARRAY: INASISTENCIA_ORDEN_ARRAY,
    INASISTENCIA_CITEST_CAMPO: INASISTENCIA_CITEST_CAMPO,
    INASISTENCIA_CITEST_UMBRAL_RECHAZO: INASISTENCIA_CITEST_UMBRAL_RECHAZO,
    inasistenciaColIndexMap: inasistenciaColIndexMap,
    inasistenciaNormTexto: inasistenciaNormTexto,
    inasistenciaParseFechaCita: inasistenciaParseFechaCita,
    inasistenciaParseFilas: inasistenciaParseFilas,
    inasistenciaFilaComoArray: inasistenciaFilaComoArray,
    inasistenciaMesesDeFilas: inasistenciaMesesDeFilas,
    inasistenciaMesLbl: inasistenciaMesLbl,
    inasistenciaPctPonderado: inasistenciaPctPonderado,
    inasistenciaPonderadoTotal: inasistenciaPonderadoTotal,
    inasistenciaFmtPct: inasistenciaFmtPct,
    inasistenciaAgregarPorMes: inasistenciaAgregarPorMes,
    inasistenciaRangoLbl: inasistenciaRangoLbl,
    inasistenciaAvisosPorMes: inasistenciaAvisosPorMes,
    inasistenciaOrdenarBaseBaja: inasistenciaOrdenarBaseBaja,
  };
}
