// calidad-calificar-logic.js — Fase 254 (plan de Calidad B3). Logica pura del
// formulario "Calificar" de las plantillas nuevas, igual al HTML de Edwin:
// descuentos por item, faltantes, motivo, observacion sugerida y textos.
// El puntaje que vale es el del servidor (calidad-logic.js); esto es la vista
// mientras se califica. Motor "ponderado" (standard): NO en critico resta 20,
// NO en no critico resta su peso; SI y N/A no restan.

// Items que faltan: sin respuesta, o N/A donde la plantilla no lo admite.
function cc2Faltantes(items, answers) {
  var a = answers || {};
  return (items || []).filter(function (it) {
    var v = a[it.n];
    if (v !== 'SI' && v !== 'NO' && v !== 'N/A') return true;
    return v === 'N/A' && it.admiteNA === false;
  });
}

// [{ it, puntos, critico }] por cada NO, en orden.
function cc2Deducciones(items, answers) {
  var a = answers || {};
  return (items || []).filter(function (it) { return a[it.n] === 'NO'; }).map(function (it) {
    return { it: it, puntos: it.critico ? 20 : Number(it.weight) || 0, critico: !!it.critico };
  });
}

// Nota visible: completa = 100 - descuentos (0..100); sin respuestas = null.
function cc2Nota(items, answers) {
  var a = answers || {};
  var alguno = (items || []).some(function (it) { return a[it.n]; });
  if (!alguno) return null;
  var ded = cc2Deducciones(items, a).reduce(function (s, d) { return s + d.puntos; }, 0);
  return Math.max(0, Math.min(100, Math.round((100 - ded) * 100) / 100));
}

// 'bad' (<70), 'warn' (<90), 'ok' (>=90) y su texto.
function cc2Clase(nota) {
  if (nota === null || nota === undefined) return { k: 'na', t: 'Sin calificar' };
  if (nota < 70) return { k: 'bad', t: 'Crítico' };
  if (nota < 90) return { k: 'warn', t: 'No crítico' };
  return { k: 'ok', t: 'Sobresaliente' };
}

// Alerta por criticos fallados en un monitoreo (igual que el servidor).
function cc2Alerta(fallos) {
  if (!fallos) return null;
  return fallos === 1 ? { k: 'warn', t: 'Alerta — 1 crítico' } : { k: 'bad', t: 'Crítico absoluto' };
}

// Texto bajo el nombre del item.
function cc2SubItem(it) {
  return it.critico ? '⚠ Crítico · peso ' + it.weight + '% · NO = −20 pts' : 'Peso ' + it.weight + '% · NO = −' + it.weight + ' pts';
}

// "Motivo de afectacion": los items en NO, en orden (mismo texto que guarda el servidor).
function cc2Motivo(items, answers) {
  return cc2Deducciones(items, answers).map(function (d) { return d.it.n + '. ' + d.it.label; }).join(' · ');
}

// "Sugerir observacion" del HTML de Edwin. null si faltan items.
function cc2SugerirObs(items, answers) {
  if (cc2Faltantes(items, answers).length) return null;
  var ded = cc2Deducciones(items, answers);
  if (!ded.length) return '¡Felicitaciones! Llamada con cumplimiento total del protocolo de calidad.';
  return ded.map(function (d) {
    return 'Ítem ' + d.it.n + ' – ' + d.it.label + ': no cumple' + (d.critico ? ' (ítem crítico, −20 pts).' : ' (−' + d.puntos + ' pts).');
  }).join('\n');
}

// Items agrupados por categoria, respetando el orden de la plantilla.
function cc2PorCategoria(items) {
  var out = [];
  (items || []).forEach(function (it) {
    var ult = out[out.length - 1];
    if (!ult || ult.cat !== it.cat) out.push({ cat: it.cat, items: [it] });
    else ult.items.push(it);
  });
  return out;
}

// Campos del formulario de la plantilla, en 2 bloques: "Información general"
// (lo de la llamada) y "Detalles adicionales" (motivo y observaciones).
var CC2_DETALLE = ['motivo', 'observaciones'];
function cc2Bloques(campos) {
  var lista = campos || [];
  return {
    generales: lista.filter(function (c) { return CC2_DETALLE.indexOf(c.k) === -1; }),
    detalle: lista.filter(function (c) { return CC2_DETALLE.indexOf(c.k) !== -1; }),
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { cc2Faltantes: cc2Faltantes, cc2Deducciones: cc2Deducciones, cc2Nota: cc2Nota, cc2Clase: cc2Clase, cc2Alerta: cc2Alerta,
    cc2SubItem: cc2SubItem, cc2Motivo: cc2Motivo, cc2SugerirObs: cc2SugerirObs, cc2PorCategoria: cc2PorCategoria, cc2Bloques: cc2Bloques };
}
