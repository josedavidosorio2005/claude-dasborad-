// encuesta-logic.js — InConexion Platform (Fase 147, Parte B, reunion con
// Edwin del 14/10/2026). Mobilize → pestaña "Encuesta": resultado de la
// encuesta de satisfaccion post-llamada (export de Wolkvox, Reportes →
// numeral 4, hoja "HistIVR..."). Logica PURA (sin DOM). Doble modo: global
// en el navegador, require() en Node para las pruebas
// (server/tests/fase147-b-encuesta.test.js).
//
// Decisiones (usuario, 14/10):
//   - El encabezado puede NO estar en la fila 1 (el archivo real trae una
//     fila de textos sueltos antes): se busca en las primeras filas.
//   - "-", "--" o celda vacia = sin respuesta (NULL). Un valor fuera de rango
//     (ej. 11 en la pregunta 1) tambien queda sin respuesta, con aviso.
//   - Solo se leen las columnas de ENCUESTA_COLUMNAS: el resto de datos del
//     cliente final se ignora aqui, en el navegador, y nunca viaja al servidor.
//     (Fase 344: el telefono ANI SI se lee, solo para Calidad -- ver abajo.)
//   - Los textos de las preguntas NO se leen del archivo (columnas J/K): son
//     configuracion (ENCUESTA_PREGUNTAS), con la ortografia corregida.
// Fase 193: la base de Edwin es ahora el export HistIVR COMPLETO (25
// columnas, encabezado en la fila 1): se sube tal cual. De ahi solo se leen
// las de ENCUESTA_COLUMNAS; AGENT_DNI, CUSTOMER_ID y el resto (Q05-Q10,
// RESULT, FEELING...) se ignoran por nombre. Desde la Fase 344 tambien se lee
// ANI (telefono), que solo ven quienes califican en Calidad.
'use strict';

var _encuestaFechaLimites = (typeof require === 'function') ? require('./fecha-limites-logic.js') : (typeof window !== 'undefined' ? window : this);

var ENCUESTA_COLUMNAS = [
  { key: 'agente', label: 'AGENT_NAME', obligatoria: true },
  { key: 'skill', label: 'SKILL_NAME', obligatoria: true },
  { key: 'fecha', label: 'DATE', obligatoria: true },
  { key: 'q1', label: 'Q01', obligatoria: true },
  { key: 'q2', label: 'Q02', obligatoria: true },
  { key: 'q3', label: 'Q03', obligatoria: true },
  { key: 'q4', label: 'Q04', obligatoria: true },
  { key: 'comentario', label: 'VOICE_MESSAGE', obligatoria: false },
  // Fase 184 (pedido del usuario, Mobilize): ID de la llamada, para ubicar
  // cada comentario en Wolkvox. Opcional: un archivo viejo sin CONN_ID deja
  // el campo vacio (nunca se cruza con el CDR).
  { key: 'connId', label: 'CONN_ID', obligatoria: false },
  // Fase 344 (pedido del usuario, 12/11): el telefono (ANI) se lee y se guarda para que
  // Calidad ubique la llamada. Lo ven solo quienes califican (CALIDAD, SUPERVISOR,
  // Reportes, administrador); el cliente y el asesor nunca. Opcional: sin ANI, '' .
  { key: 'telefono', label: 'ANI', obligatoria: false },
];
// Orden fijo del payload compacto -- debe coincidir con CAMPOS_FILA
// (server/encuestas.js) y encuestaFilaArraySchema (validation.js).
// Fase 331: + hora (HH:MM de DATE, '' si no se pudo leer) para ubicar la grabacion.
// Fase 344: + telefono (ANI, '' si no vino) al final.
var ENCUESTA_ORDEN_ARRAY = ['fecha', 'agente', 'skill', 'q1', 'q2', 'q3', 'q4', 'comentario', 'connId', 'hora', 'telefono'];
var ENCUESTA_CONN_ID_MAX = 100;
var ENCUESTA_TELEFONO_MAX = 40;
var ENCUESTA_COMENTARIO_MAX = 1000;

// Textos para mostrar (pedido del usuario, ortografia corregida). `valores`
// = respuestas posibles, en el orden del eje X (todas, aunque tengan 0).
var ENCUESTA_PREGUNTAS = [
  { key: 'q1', n: 1, min: 0, max: 10,
    texto: 'En una escala de 0 a 10, donde 0 significa nada probable y 10 extremadamente probable, ¿qué tan probable es que recomiende nuestros servicios a un familiar, amigo o colega?' },
  { key: 'q2', n: 2, min: 1, max: 5,
    texto: 'En una escala de 1 a 5, donde 5 significa muy satisfecho y 1 muy insatisfecho, ¿qué tan satisfecho está con la atención recibida hoy?' },
  { key: 'q3', n: 3, min: 1, max: 2, etiquetas: { 1: 'Sí', 2: 'No' },
    texto: '¿Su solicitud fue resuelta en este primer contacto? (1 = Sí, 2 = No)' },
  { key: 'q4', n: 4, min: 1, max: 5,
    texto: 'En una escala de 1 a 5, donde 5 significa muy fácil y 1 muy difícil, ¿qué tan fácil fue obtener la ayuda que necesitaba?' },
];
var ENCUESTA_PREGUNTA_COMENTARIOS = '¿Tiene algún comentario o sugerencia que nos permita mejorar nuestro servicio?';

function encuestaValoresPosibles(pregunta) {
  var out = [];
  for (var v = pregunta.min; v <= pregunta.max; v++) out.push(v);
  return out;
}

function encuestaEtiquetaValor(pregunta, v) {
  return (pregunta.etiquetas && pregunta.etiquetas[v]) ? pregunta.etiquetas[v] : String(v);
}

function _encuestaNorm(v) {
  return String(v == null ? '' : v).trim().replace(/\s+/g, ' ');
}

function encuestaColIndexMap(headerRow) {
  var map = {};
  (headerRow || []).forEach(function (h, i) {
    var n = _encuestaNorm(h).toUpperCase().replace(/\s+/g, '_');
    var col = ENCUESTA_COLUMNAS.filter(function (c) { return c.label === n; })[0];
    if (col && map[col.key] === undefined) map[col.key] = i;
  });
  return map;
}

function _encuestaTieneObligatorias(map) {
  return ENCUESTA_COLUMNAS.every(function (c) { return !c.obligatoria || map[c.key] !== undefined; });
}

// Indice de la fila de encabezado dentro de las primeras `maxFilas` (el
// archivo real la trae en la fila 2), o -1.
function encuestaBuscarEncabezado(aoa, maxFilas) {
  var tope = Math.min((aoa || []).length, maxFilas || 20);
  for (var i = 0; i < tope; i++) {
    if (_encuestaTieneObligatorias(encuestaColIndexMap(aoa[i]))) return i;
  }
  return -1;
}

function _pad2(x) { return (x < 10 ? '0' : '') + x; }

// DATE -> 'AAAA-MM-DD' o null. SheetJS entrega un Date nativo armado con el
// reloj LOCAL del navegador: getters locales, nunca getUTC* (mismo criterio
// que llamadasUnicasParseFecha, Fase 139). Tambien serial de Excel y texto
// "dd/mm/aaaa[ hh:mm]" o "aaaa-mm-dd[ hh:mm]".
function encuestaParseFecha(v) {
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return null;
    var y = v.getFullYear();
    if (y < 1970 || y > 2200) return null;
    return y + '-' + _pad2(v.getMonth() + 1) + '-' + _pad2(v.getDate());
  }
  if (typeof v === 'number' && isFinite(v)) {
    var d = new Date(Math.round((Math.floor(v) - 25569) * 86400000));
    if (isNaN(d.getTime())) return null;
    var yy = d.getUTCFullYear();
    if (yy < 1970 || yy > 2200) return null;
    return yy + '-' + _pad2(d.getUTCMonth() + 1) + '-' + _pad2(d.getUTCDate());
  }
  if (typeof v === 'string') {
    var t = v.trim();
    var m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T]\d{1,2}:\d{2}(?::\d{2})?)?$/.exec(t);
    if (m) return m[1] + '-' + m[2] + '-' + m[3];
    m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?$/.exec(t);
    if (m) {
      var dd = parseInt(m[1], 10), mm = parseInt(m[2], 10);
      if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
      return m[3] + '-' + _pad2(mm) + '-' + _pad2(dd);
    }
  }
  return null;
}

// Fase 331: DATE -> 'HH:MM' o '' (sin hora). Mismo criterio que encuestaParseFecha:
// Date nativo con getters locales; serial de Excel por su fraccion del dia; texto
// "aaaa-mm-dd hh:mm[:ss]" o "dd/mm/aaaa hh:mm[:ss]". Un archivo sin hora deja ''.
function encuestaParseHora(v) {
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return '';
    return _pad2(v.getHours()) + ':' + _pad2(v.getMinutes());
  }
  if (typeof v === 'number' && isFinite(v)) {
    var frac = v - Math.floor(v);
    if (frac <= 0) return '';
    var min = Math.floor(Math.round(frac * 86400) / 60) % 1440;
    return _pad2(Math.floor(min / 60)) + ':' + _pad2(min % 60);
  }
  if (typeof v === 'string') {
    var m = /[ T](\d{1,2}):(\d{2})(?::\d{2})?$/.exec(v.trim());
    if (m && parseInt(m[1], 10) < 24 && parseInt(m[2], 10) < 60) return _pad2(parseInt(m[1], 10)) + ':' + m[2];
  }
  return '';
}

function _encuestaSinRespuesta(v) {
  if (v === null || v === undefined) return true;
  var t = String(v).trim();
  return t === '' || /^-+$/.test(t);
}

// Respuesta de una pregunta: { valor: entero | null, fueraDeRango: bool }.
function encuestaParseRespuesta(v, pregunta) {
  if (_encuestaSinRespuesta(v)) return { valor: null, fueraDeRango: false };
  var n = typeof v === 'number' ? v : Number(String(v).trim().replace(',', '.'));
  if (!isFinite(n) || Math.floor(n) !== n || n < pregunta.min || n > pregunta.max) return { valor: null, fueraDeRango: true };
  return { valor: n, fueraDeRango: false };
}

// Conteos de un conjunto de filas compactas (para la vista previa).
function encuestaConteos(filas) {
  var out = { total: (filas || []).length, comentarios: 0, preguntas: {} };
  ENCUESTA_PREGUNTAS.forEach(function (p) {
    var c = { sinRespuesta: 0, valores: {} };
    encuestaValoresPosibles(p).forEach(function (v) { c.valores[v] = 0; });
    out.preguntas[p.key] = c;
  });
  (filas || []).forEach(function (f) {
    ENCUESTA_PREGUNTAS.forEach(function (p) {
      var v = f[ENCUESTA_ORDEN_ARRAY.indexOf(p.key)];
      if (v === null || v === undefined) out.preguntas[p.key].sinRespuesta++;
      else out.preguntas[p.key].valores[v]++;
    });
    if (f[7]) out.comentarios++;
  });
  return out;
}

// Texto corto de la vista previa: "P1: 9→3, 10→2, sin respuesta 40 · ...".
function encuestaResumenTexto(conteos) {
  return ENCUESTA_PREGUNTAS.map(function (p) {
    var c = conteos.preguntas[p.key];
    var partes = encuestaValoresPosibles(p).filter(function (v) { return c.valores[v]; })
      .map(function (v) { return encuestaEtiquetaValor(p, v) + '→' + c.valores[v]; });
    partes.push('sin respuesta ' + c.sinRespuesta);
    return 'P' + p.n + ': ' + partes.join(', ');
  }).join(' · ') + ' · ' + conteos.comentarios + ' comentario(s)';
}

// Devuelve { error } si falta una columna obligatoria. Si no:
// { filas, avisos, conteos, dias, desde, hasta }.
function encuestaParseFilas(aoa) {
  if (!aoa || !aoa.length) return { error: 'El archivo esta vacio.' };
  var h = encuestaBuscarEncabezado(aoa, 20);
  if (h === -1) {
    var mapPrimera = encuestaColIndexMap(aoa[0]);
    var faltantes = ENCUESTA_COLUMNAS.filter(function (c) { return c.obligatoria && mapPrimera[c.key] === undefined; });
    return { error: 'Faltan columnas obligatorias: ' + faltantes.map(function (c) { return c.label; }).join(', ') + '.' };
  }
  var map = encuestaColIndexMap(aoa[h]);
  var filas = [];
  var avisos = [];
  var dias = {};
  for (var i = h + 1; i < aoa.length; i++) {
    var row = aoa[i];
    if (!row || row.every(function (v) { return v === '' || v === null || v === undefined; })) continue;
    var filaNum = i + 1;
    var fecha = encuestaParseFecha(row[map.fecha]);
    if (!fecha) { avisos.push('Fila ' + filaNum + ': DATE invalida o vacia, se omitio.'); continue; }
    if (_encuestaFechaLimites.fechaLimitesEsFutura(fecha)) { avisos.push('Fila ' + filaNum + ': DATE ' + fecha + ' esta en el futuro, se omitio.'); continue; }
    var resp = {};
    ENCUESTA_PREGUNTAS.forEach(function (p) {
      var r = encuestaParseRespuesta(row[map[p.key]], p);
      if (r.fueraDeRango) avisos.push('Fila ' + filaNum + ': ' + ENCUESTA_COLUMNAS.filter(function (c) { return c.key === p.key; })[0].label +
        ' fuera de rango (' + p.min + ' a ' + p.max + '), se tomo como sin respuesta.');
      resp[p.key] = r.valor;
    });
    var comentario = map.comentario === undefined || _encuestaSinRespuesta(row[map.comentario]) ? '' : _encuestaNorm(row[map.comentario]);
    if (comentario.length > ENCUESTA_COMENTARIO_MAX) {
      avisos.push('Fila ' + filaNum + ': comentario de mas de ' + ENCUESTA_COMENTARIO_MAX + ' caracteres, se recorto.');
      comentario = comentario.slice(0, ENCUESTA_COMENTARIO_MAX);
    }
    var agente = _encuestaNorm(row[map.agente]).slice(0, 200);
    var skill = _encuestaNorm(row[map.skill]).slice(0, 200);
    var connId = map.connId === undefined || _encuestaSinRespuesta(row[map.connId]) ? '' : _encuestaNorm(row[map.connId]).slice(0, ENCUESTA_CONN_ID_MAX);
    var telefono = map.telefono === undefined || _encuestaSinRespuesta(row[map.telefono]) ? '' : _encuestaNorm(row[map.telefono]).slice(0, ENCUESTA_TELEFONO_MAX);
    filas.push([fecha, _encuestaSinRespuesta(agente) ? '' : agente, _encuestaSinRespuesta(skill) ? '' : skill, resp.q1, resp.q2, resp.q3, resp.q4, comentario, connId, encuestaParseHora(row[map.fecha]), telefono]);
    dias[fecha] = true;
  }
  if (map.connId === undefined && filas.length) avisos.push('El archivo no trae la columna CONN_ID: los comentarios quedan sin ID de llamada.');
  var lista = Object.keys(dias).sort();
  // Fase 193: para la vista previa -- que columnas del archivo se usaron,
  // cuantas se ignoraron y cuantas filas traen ID de llamada.
  var columnasUsadas = ENCUESTA_COLUMNAS.filter(function (c) { return map[c.key] !== undefined; }).map(function (c) { return c.label; });
  var columnasArchivo = (aoa[h] || []).filter(function (x) { return _encuestaNorm(x) !== ''; }).length;
  return {
    filas: filas, avisos: avisos, conteos: encuestaConteos(filas), dias: lista.length,
    desde: lista[0] || null, hasta: lista[lista.length - 1] || null,
    columnasUsadas: columnasUsadas, columnasIgnoradas: Math.max(0, columnasArchivo - columnasUsadas.length),
    conConnId: filas.filter(function (f) { return !!f[8]; }).length,
    conTelefono: filas.filter(function (f) { return !!f[10]; }).length, // Fase 344
  };
}

// Plantilla oficial descargable: mismas columnas que el archivo de Wolkvox.
function encuestaPlantillaAoA() {
  return [ENCUESTA_COLUMNAS.map(function (c) { return c.label; })];
}

// FCR ("Solucion en primer contacto", Parte C): encuestas con Q03 = 1 sobre
// la base elegida en la config del panel. base 'total' = todas las encuestas
// del periodo (pedido de Edwin); 'respondieron' = solo las que contestaron
// Q03; 'empezaron' (Fase 200, Mobilize) = solo las que contestaron la
// pregunta 1, es decir, las que empezaron la encuesta. pct null si la base es 0.
function encuestaFcr(si, total, respondieron, base, empezaron) {
  var den = base === 'respondieron' ? respondieron : base === 'empezaron' ? (empezaron || 0) : total;
  return { num: si, den: den, pct: den > 0 ? Math.round((si / den) * 1000) / 10 : null };
}

// Tarjeta FCR de Flujo de Llamadas (Parte C): el mes objetivo (el del final
// del rango del panel) y, aparte, los demas meses del rango que tienen
// encuestas. `porMes` = respuesta de GET /calidad/encuestas/fcr.
function encuestaFcrTarjeta(porMes, mesObjetivo) {
  var lista = (porMes || []).slice().sort(function (a, b) { return a.periodo < b.periodo ? -1 : 1; });
  var obj = lista.filter(function (m) { return m.periodo === mesObjetivo; })[0] || null;
  return {
    mes: mesObjetivo,
    sinEncuestas: !obj || !obj.total,
    pct: obj ? obj.pct : null,
    si: obj ? obj.si : 0,
    den: obj ? obj.den : 0,
    base: obj ? obj.base : null,
    otros: lista.filter(function (m) { return m.periodo !== mesObjetivo && m.total > 0; }),
  };
}

// Fase 203: tarjeta FCR / One & Done que SUMA los meses de MESES (`meses`):
// si y den sumados, pct = si / den (nunca promedio de porcentajes). `porMes`
// = los meses con encuestas de esos meses (para el detalle "Por mes").
function encuestaFcrTarjetaMeses(porMes, meses) {
  var set = {};
  (meses || []).forEach(function (m) { set[m] = true; });
  var lista = (porMes || []).filter(function (m) { return set[m.periodo] && m.total > 0; })
    .sort(function (a, b) { return a.periodo < b.periodo ? -1 : 1; });
  var si = 0, den = 0;
  lista.forEach(function (m) { si += m.si || 0; den += m.den || 0; });
  return {
    meses: (meses || []).slice().sort(),
    sinEncuestas: !lista.length,
    si: si,
    den: den,
    pct: den > 0 ? Math.round((si / den) * 1000) / 10 : null,
    base: lista.length ? lista[0].base : null,
    porMes: lista,
  };
}

// "6,7 %" / "75 %" (coma decimal, como el resto del tablero).
function encuestaFmtPct(v) {
  return v === null || v === undefined ? '—' : String(v).replace('.', ',') + ' %';
}

// "3 de 45 encuestas" (base total), "3 de 4 que respondieron la pregunta 3" o
// (Fase 200) "19 de 28 que contestaron la pregunta 1".
function encuestaFcrFraccion(si, den, base) {
  return si + ' de ' + den + (base === 'respondieron' ? ' que respondieron la pregunta 3' : base === 'empezaron' ? ' que contestaron la pregunta 1' : ' encuestas');
}

// Fase 200: base valida del FCR / One & Done ('total' si no se reconoce).
function encuestaFcrBase(base) {
  return base === 'respondieron' || base === 'empezaron' ? base : 'total';
}

// Fase 200: nota de la tarjeta FCR y de One & Done, segun la base.
function encuestaFcrNota(base) {
  var den = base === 'respondieron' ? 'las encuestas que respondieron la pregunta 3'
    : base === 'empezaron' ? 'las encuestas que contestaron la pregunta 1 (las que empezaron la encuesta)'
      : 'todas las encuestas del mes';
  return 'One & Done = encuestas con "Sí" en la pregunta 3 (la solicitud se resolvió en este primer contacto) ÷ ' + den + '.';
}

// ── Fase 147 (Parte D): sub-pestaña "One & Done" de Flujo de Llamadas ──
// Meses (AAAA-MM) del rango Desde/Hasta del panel; sin rango, los meses que
// trae `porMes`. Asi un mes del rango sin encuestas tambien aparece.
function encuestaMesesRango(desde, hasta, porMes) {
  var conDatos = (porMes || []).map(function (m) { return m.periodo; }).sort();
  var ini = desde ? String(desde).slice(0, 7) : conDatos[0];
  var fin = hasta ? String(hasta).slice(0, 7) : conDatos[conDatos.length - 1];
  if (!ini || !fin || ini > fin) return conDatos;
  var out = [];
  var a = Number(ini.slice(0, 4)), m = Number(ini.slice(5, 7));
  while (out.length < 120) {
    var p = a + '-' + (m < 10 ? '0' + m : '' + m);
    if (p > fin) break;
    out.push(p);
    m++;
    if (m > 12) { m = 1; a++; }
  }
  return out;
}

// Una barra por mes: % One & Done (Q03 = 1 / base) con su fraccion. Mes sin
// encuestas = { sinEncuestas: true, pct: null } (nunca 0 % inventado).
function encuestaOneAndDoneSerie(porMes, meses, base) {
  var porPeriodo = {};
  (porMes || []).forEach(function (m) { porPeriodo[m.periodo] = m; });
  return (meses || []).map(function (p) {
    var m = porPeriodo[p];
    if (!m || !m.total) return { periodo: p, sinEncuestas: true, pct: null, si: 0, den: 0, total: 0, respondieron: 0, empezaron: 0, base: base };
    var f = encuestaFcr(m.si, m.total, m.respondieron, base, m.empezaron);
    return { periodo: p, sinEncuestas: false, pct: f.pct, si: m.si, den: f.den, total: m.total, respondieron: m.respondieron, empezaron: m.empezaron || 0, base: base };
  });
}

// "Respuestas de la pregunta 3" del periodo: Si / No / Sin respuesta, en
// cantidad y en % sobre TODAS las encuestas del periodo.
function encuestaQ3Desglose(porMes) {
  var total = 0, si = 0, respondieron = 0;
  (porMes || []).forEach(function (m) { total += m.total || 0; si += m.si || 0; respondieron += m.respondieron || 0; });
  var pct = function (n) { return total > 0 ? Math.round((n / total) * 1000) / 10 : null; };
  var no = respondieron - si, sinRespuesta = total - respondieron;
  return { total: total, si: si, no: no, sinRespuesta: sinRespuesta, pctSi: pct(si), pctNo: pct(no), pctSinRespuesta: pct(sinRespuesta) };
}

// ── Fase 195: NPS de la pregunta 1 (0 a 10, "¿qué tan probable es que nos
// recomiende?"). Base = las encuestas que SÍ contestaron la pregunta 1 (no el
// total). Promotores 9-10, pasivos 7-8, detractores 0-6. NPS = % promotores -
// % detractores (de -100 a 100). `datos` = { respondieron, valores:
// [{ valor, cantidad }] } de /calidad/encuestas/resumen. Porcentajes con 1
// decimal; null si nadie contesto (nunca un 0 % inventado).
var ENCUESTA_NPS_PROMOTOR_MIN = 9;
var ENCUESTA_NPS_DETRACTOR_MAX = 6;
var ENCUESTA_NPS_NOTA = 'NPS = % de promotores (9 y 10) − % de detractores (0 a 6), sobre las encuestas que contestaron la pregunta 1. Los pasivos (7 y 8) no suman ni restan.';
function _encuestaPct1(n, base) { return base > 0 ? Math.round((n / base) * 1000) / 10 : null; }
function encuestaNps(datos) {
  var valores = (datos && datos.valores) || [];
  var base = valores.reduce(function (a, x) { return a + (x.cantidad || 0); }, 0);
  var suma = function (f) { return valores.filter(function (x) { return f(x.valor); }).reduce(function (a, x) { return a + (x.cantidad || 0); }, 0); };
  var promotores = suma(function (v) { return v >= ENCUESTA_NPS_PROMOTOR_MIN; });
  var detractores = suma(function (v) { return v <= ENCUESTA_NPS_DETRACTOR_MAX; });
  return {
    respondieron: base,
    porcentajes: valores.map(function (x) { return { valor: x.valor, cantidad: x.cantidad || 0, pct: _encuestaPct1(x.cantidad || 0, base) }; }),
    promotores: promotores, pasivos: base - promotores - detractores, detractores: detractores,
    pctPromotores: _encuestaPct1(promotores, base), pctDetractores: _encuestaPct1(detractores, base),
    nps: base > 0 ? Math.round(((promotores - detractores) / base) * 1000) / 10 : null,
  };
}

// Fase 344: texto para confirmar una carga, con lo que le pasaria a Calidad de encuestas
// (c = impacto.calidadEncuestas del servidor, o null si la campaña no tiene esa funcion).
function encuestaImpactoCalidadTexto(c, filasNuevas) {
  if (!c) return '';
  var t = 'Calidad de encuestas: pendientes ' + c.pendientesAntes + ' → ' + c.pendientesDespues +
    '; resueltas ' + c.resueltasAntes + ' → ' + c.resueltasDespues + '.';
  if (c.monitoreosSinLlamada > 0) {
    t += '\nATENCIÓN: ' + c.monitoreosSinLlamada + ' monitoreo(s) ya hechos quedarían sin su llamada en la lista (ese ID no viene en el archivo). ' +
      'Los monitoreos no se borran, pero revisa que sea el archivo correcto antes de continuar.';
  }
  t += '\nTeléfono (ANI): ' + (c.conTelefono || 0) + ' de ' + (filasNuevas || 0) + ' fila(s).';
  return t;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    ENCUESTA_NPS_NOTA: ENCUESTA_NPS_NOTA,
    encuestaNps: encuestaNps,
    encuestaMesesRango: encuestaMesesRango,
    encuestaOneAndDoneSerie: encuestaOneAndDoneSerie,
    encuestaQ3Desglose: encuestaQ3Desglose,
    ENCUESTA_COLUMNAS: ENCUESTA_COLUMNAS,
    ENCUESTA_ORDEN_ARRAY: ENCUESTA_ORDEN_ARRAY,
    ENCUESTA_COMENTARIO_MAX: ENCUESTA_COMENTARIO_MAX,
    ENCUESTA_PREGUNTAS: ENCUESTA_PREGUNTAS,
    ENCUESTA_PREGUNTA_COMENTARIOS: ENCUESTA_PREGUNTA_COMENTARIOS,
    encuestaValoresPosibles: encuestaValoresPosibles,
    encuestaEtiquetaValor: encuestaEtiquetaValor,
    encuestaColIndexMap: encuestaColIndexMap,
    encuestaBuscarEncabezado: encuestaBuscarEncabezado,
    encuestaParseFecha: encuestaParseFecha,
    encuestaParseHora: encuestaParseHora, // Fase 331
    encuestaParseRespuesta: encuestaParseRespuesta,
    encuestaConteos: encuestaConteos,
    encuestaResumenTexto: encuestaResumenTexto,
    encuestaParseFilas: encuestaParseFilas,
    encuestaPlantillaAoA: encuestaPlantillaAoA,
    encuestaFcr: encuestaFcr,
    encuestaFcrTarjeta: encuestaFcrTarjeta,
    encuestaFcrTarjetaMeses: encuestaFcrTarjetaMeses,
    encuestaFmtPct: encuestaFmtPct,
    encuestaFcrFraccion: encuestaFcrFraccion,
    encuestaFcrBase: encuestaFcrBase,
    encuestaFcrNota: encuestaFcrNota,
    encuestaImpactoCalidadTexto: encuestaImpactoCalidadTexto, // Fase 344
  };
}
