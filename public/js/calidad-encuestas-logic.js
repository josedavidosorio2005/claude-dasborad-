// calidad-encuestas-logic.js — Fase 331 (pedido del supervisor, Mobilize).
// Logica pura de la pestaña "Calidad de encuestas" del Modulo de Calidad (y del
// boton "Monitoreo" de la Encuesta del dashboard): textos de las preguntas mal
// calificadas, buscar el asesor de la plataforma que corresponde al agente de
// Wolkvox y etiquetas de estado. Sin DOM: se prueba en node.
'use strict';

var _cenPreguntas = (typeof require === 'function')
  ? require('./encuesta-logic.js').ENCUESTA_PREGUNTAS
  : (typeof ENCUESTA_PREGUNTAS !== 'undefined' ? ENCUESTA_PREGUNTAS : []);

function _cenPregunta(key) {
  return (_cenPreguntas || []).filter(function (p) { return p.key === key; })[0] || null;
}

// 'q3' -> 'P3'
function cenPreguntaCorta(key) {
  var p = _cenPregunta(key);
  return p ? 'P' + p.n : String(key || '').toUpperCase();
}

// Valor como lo dijo el cliente: Si/No en la pregunta de Si/No, el numero en las demas.
function cenValorTexto(key, valor) {
  var p = _cenPregunta(key);
  if (p && p.etiquetas && p.etiquetas[valor]) return p.etiquetas[valor];
  return String(valor);
}

// [{pregunta:'q1', valor:3}, {pregunta:'q3', valor:2}] -> 'P1: 3 · P3: No'
function cenFallasTexto(fallas) {
  return (fallas || []).map(function (f) { return cenPreguntaCorta(f.pregunta) + ': ' + cenValorTexto(f.pregunta, f.valor); }).join(' · ');
}

// Fase 336: ID de la llamada para MOSTRAR y COPIAR. Wolkvox exporta el CONN_ID con un apostrofo
// al inicio (marca de texto de Excel: '8751.4872...). Se quita solo al verlo y al copiarlo; el dato
// guardado y el cruce (bloqueo, encuestaConnId) siguen con el valor original.
function cenIdVisible(id) {
  return String(id == null ? '' : id).replace(/^[\s'‘’`´]+/, '').trim();
}

// Nombre normalizado para comparar: sin tildes, sin mayusculas, espacios simples.
function cenNormNombre(s) {
  var t = String(s == null ? '' : s).trim().toLowerCase().replace(/\s+/g, ' ');
  return t.normalize ? t.normalize('NFD').replace(/[̀-ͯ]/g, '') : t;
}

// Usuario ASESOR (activo, de la lista que ya filtro la campaña) cuyo nombre
// coincide con el agente de la encuesta; null si no hay uno solo que coincida
// (el evaluador lo elige de la lista).
function cenBuscarAsesor(agente, asesores) {
  var n = cenNormNombre(agente);
  if (!n) return null;
  var hallados = (asesores || []).filter(function (u) { return u && cenNormNombre(u.nombre) === n; });
  return hallados.length === 1 ? hallados[0] : null;
}

// '2026-09-01' -> '01/09/2026'
function cenFecha(f) {
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(f || ''));
  return m ? m[3] + '/' + m[2] + '/' + m[1] : (f || '—');
}

// Texto de la columna de accion/estado de una fila.
function cenEstadoFila(fila, puedeCalificar) {
  if (!fila) return { tipo: 'nada', texto: '' };
  if (fila.estado === 'resuelta') return { tipo: 'resuelta', texto: 'Resuelta' };
  if (fila.bloqueo && !fila.bloqueo.propio) return { tipo: 'bloqueada', texto: 'La está calificando otra persona' };
  if (!puedeCalificar) return { tipo: 'lectura', texto: 'Pendiente' };
  return { tipo: 'calificar', texto: fila.bloqueo && fila.bloqueo.propio ? 'Seguir calificando' : 'Calificar' };
}

// Aviso discreto de las mal calificadas sin ID de llamada (no entran a la lista).
function cenAvisoSinId(n) {
  if (!n) return '';
  return n === 1
    ? '1 encuesta mal calificada no trae ID de la llamada y no se puede ubicar en Wolkvox; no aparece en la lista.'
    : n + ' encuestas mal calificadas no traen ID de la llamada y no se pueden ubicar en Wolkvox; no aparecen en la lista.';
}

// Fase 331 (PR 3): lista de Monitoreos filtrada por origen ('' = todos, 'manual', 'encuesta').
// Los monitoreos viejos sin origen cuentan como 'manual'. Solo filtra lo que se lista.
function cenOrigenDe(m) { return m && m.origen === 'encuesta' ? 'encuesta' : 'manual'; }
function cenFiltrarPorOrigen(lista, origen) {
  var o = origen === 'encuesta' || origen === 'manual' ? origen : '';
  return (lista || []).filter(function (m) { return !o || cenOrigenDe(m) === o; });
}
function cenNotaOrigen(lista) {
  var n = (lista || []).filter(function (m) { return cenOrigenDe(m) === 'encuesta'; }).length;
  if (!n) return '';
  return (n === 1 ? '1 monitoreo viene' : n + ' monitoreos vienen') + ' de Calidad de encuestas. Por ahora cuentan en los promedios igual que los demás.';
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { cenIdVisible: cenIdVisible, cenOrigenDe: cenOrigenDe, cenFiltrarPorOrigen: cenFiltrarPorOrigen, cenNotaOrigen: cenNotaOrigen, cenPreguntaCorta: cenPreguntaCorta, cenValorTexto: cenValorTexto, cenFallasTexto: cenFallasTexto,
    cenNormNombre: cenNormNombre, cenBuscarAsesor: cenBuscarAsesor, cenFecha: cenFecha, cenEstadoFila: cenEstadoFila, cenAvisoSinId: cenAvisoSinId };
}
