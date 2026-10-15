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
//   - Solo se leen las columnas de ENCUESTA_COLUMNAS: si una version futura
//     del archivo trae telefonos o datos del cliente final, se ignoran aqui,
//     en el navegador, y nunca viajan al servidor.
//   - Los textos de las preguntas NO se leen del archivo (columnas J/K): son
//     configuracion (ENCUESTA_PREGUNTAS), con la ortografia corregida.
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
];
// Orden fijo del payload compacto -- debe coincidir con CAMPOS_FILA
// (server/encuestas.js) y encuestaFilaArraySchema (validation.js).
var ENCUESTA_ORDEN_ARRAY = ['fecha', 'agente', 'skill', 'q1', 'q2', 'q3', 'q4', 'comentario'];
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
    filas.push([fecha, _encuestaSinRespuesta(agente) ? '' : agente, _encuestaSinRespuesta(skill) ? '' : skill, resp.q1, resp.q2, resp.q3, resp.q4, comentario]);
    dias[fecha] = true;
  }
  var lista = Object.keys(dias).sort();
  return {
    filas: filas, avisos: avisos, conteos: encuestaConteos(filas), dias: lista.length,
    desde: lista[0] || null, hasta: lista[lista.length - 1] || null,
  };
}

// Plantilla oficial descargable: mismas columnas que el archivo de Wolkvox.
function encuestaPlantillaAoA() {
  return [ENCUESTA_COLUMNAS.map(function (c) { return c.label; })];
}

// FCR ("Solucion en primer contacto", Parte C): encuestas con Q03 = 1 sobre
// la base elegida en la config del panel. base 'total' = todas las encuestas
// del periodo (pedido de Edwin); 'respondieron' = solo las que contestaron
// Q03. pct null si la base es 0.
function encuestaFcr(si, total, respondieron, base) {
  var den = base === 'respondieron' ? respondieron : total;
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

// "6,7 %" / "75 %" (coma decimal, como el resto del tablero).
function encuestaFmtPct(v) {
  return v === null || v === undefined ? '—' : String(v).replace('.', ',') + ' %';
}

// "3 de 45 encuestas" (base total) o "3 de 4 que respondieron la pregunta 3".
function encuestaFcrFraccion(si, den, base) {
  return si + ' de ' + den + (base === 'respondieron' ? ' que respondieron la pregunta 3' : ' encuestas');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
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
    encuestaParseRespuesta: encuestaParseRespuesta,
    encuestaConteos: encuestaConteos,
    encuestaResumenTexto: encuestaResumenTexto,
    encuestaParseFilas: encuestaParseFilas,
    encuestaPlantillaAoA: encuestaPlantillaAoA,
    encuestaFcr: encuestaFcr,
    encuestaFcrTarjeta: encuestaFcrTarjeta,
    encuestaFmtPct: encuestaFmtPct,
    encuestaFcrFraccion: encuestaFcrFraccion,
  };
}
