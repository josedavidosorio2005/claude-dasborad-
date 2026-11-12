// calidad-calificar-logic.js — Fase 254 (plan de Calidad B3). Logica pura del
// formulario "Calificar" de las plantillas nuevas, igual al HTML de Edwin:
// descuentos por item, faltantes, motivo, observacion sugerida y textos.
// El puntaje que vale es el del servidor (calidad-logic.js); esto es la vista
// mientras se califica. Motor "ponderado" (standard): NO en critico resta 20,
// NO en no critico resta su peso; SI y N/A no restan.

// Fase 322: motor "descuento" (Televentas SURA). Se parte de 100 %: un critico en NO deja
// la nota en 0 %; un no critico en NO resta su `descuento`; un item con `opciones` resta
// el descuento de la opcion elegida ('SI' = cumple). Sin N/A. Igual que el servidor
// (server/calidad-logic.js, computeScoreDescuento). Los demas motores no cambian.
function cc2EsDescuento(engine) { return engine === 'descuento'; }
// Respuestas que admite el item: [{ v, t }] (botones del formulario).
function cc2Opciones(it, engine) {
  if (it.opciones && it.opciones.length) return it.opciones.map(function (o) { return { v: o.v, t: o.t }; });
  var ops = [{ v: 'SI', t: 'SI' }, { v: 'NO', t: 'NO' }];
  if (!cc2EsDescuento(engine) && it.admiteNA !== false) ops.push({ v: 'N/A', t: 'N/A' });
  return ops;
}
function _cc2DescuentoDe(it, v) {
  if (!v) return 0;
  if (it.opciones && it.opciones.length) { var o = it.opciones.filter(function (x) { return x.v === v; })[0]; return o ? Number(o.descuento) || 0 : 0; }
  return v === 'NO' ? Number(it.descuento) || 0 : 0;
}

// Items que faltan: sin respuesta, o una respuesta que el item no admite (N/A donde no va).
function cc2Faltantes(items, answers, engine) {
  var a = answers || {};
  return (items || []).filter(function (it) {
    var v = a[it.n];
    if (it.opciones && it.opciones.length) return !cc2Opciones(it, engine).some(function (o) { return o.v === v; }); // Fase 322
    if (cc2EsDescuento(engine)) return v !== 'SI' && v !== 'NO';
    if (v !== 'SI' && v !== 'NO' && v !== 'N/A') return true;
    return v === 'N/A' && it.admiteNA === false;
  });
}

// [{ it, puntos, critico, opcion }] por cada item que descuenta, en orden.
// Motor standard: cada NO (critico 20, no critico su peso). Motor descuento: los NO y las
// opciones con descuento; un critico en NO va con puntos null (la nota queda en 0 %).
function cc2Deducciones(items, answers, engine) {
  var a = answers || {};
  if (cc2EsDescuento(engine)) {
    return (items || []).map(function (it) {
      var v = a[it.n];
      if (it.critico) return v === 'NO' ? { it: it, puntos: null, critico: true } : null;
      var d = _cc2DescuentoDe(it, v);
      if (!d) return null;
      var o = it.opciones ? it.opciones.filter(function (x) { return x.v === v; })[0] : null;
      return { it: it, puntos: d, critico: false, opcion: o ? o.t : null };
    }).filter(Boolean);
  }
  return (items || []).filter(function (it) { return a[it.n] === 'NO'; }).map(function (it) {
    return { it: it, puntos: it.critico ? 20 : Number(it.weight) || 0, critico: !!it.critico };
  });
}

// Nota visible: completa = 100 - descuentos (0..100); sin respuestas = null.
function cc2Nota(items, answers, engine) {
  var a = answers || {};
  var alguno = (items || []).some(function (it) { return a[it.n]; });
  if (!alguno) return null;
  var ded = cc2Deducciones(items, a, engine);
  if (cc2EsDescuento(engine) && ded.some(function (d) { return d.critico; })) return 0;
  var total = ded.reduce(function (s, d) { return s + d.puntos; }, 0);
  return Math.max(0, Math.min(100, Math.round((100 - total) * 100) / 100));
}

// 'bad' (<70), 'warn' (<90), 'ok' (>=90) y su texto.
function cc2Clase(nota) {
  if (nota === null || nota === undefined) return { k: 'na', t: 'Sin calificar' };
  if (nota < 70) return { k: 'bad', t: 'Crítico' };
  if (nota < 90) return { k: 'warn', t: 'No crítico' };
  return { k: 'ok', t: 'Sobresaliente' };
}

// Alerta por criticos fallados en un monitoreo (igual que el servidor). Con el motor
// descuento no hay alerta aparte: un critico en NO ya deja la nota en 0 %.
function cc2Alerta(fallos, engine) {
  if (!fallos) return null;
  if (cc2EsDescuento(engine)) return { k: 'bad', t: 'Crítico en NO: nota 0 %' };
  return fallos === 1 ? { k: 'warn', t: 'Alerta — 1 crítico' } : { k: 'bad', t: 'Crítico absoluto' };
}

// Texto bajo el nombre del item.
function cc2SubItem(it, engine) {
  if (cc2EsDescuento(engine)) {
    if (it.critico) return '⚠ Crítico · NO = nota 0 %';
    if (it.opciones && it.opciones.length) return it.opciones.slice(1).map(function (o) { return o.t + ' −' + o.descuento + ' %'; }).join(' · ');
    return 'NO = −' + (Number(it.descuento) || 0) + ' %';
  }
  return it.critico ? '⚠ Crítico · peso ' + it.weight + '% · NO = −20 pts' : 'Peso ' + it.weight + '% · NO = −' + it.weight + ' pts';
}

// "Motivo de afectacion": los items que descuentan, en orden (mismo texto que guarda el servidor).
function cc2Motivo(items, answers, engine) {
  return cc2Deducciones(items, answers, engine).map(function (d) { return d.it.n + '. ' + d.it.label + (d.opcion ? ' (' + d.opcion + ')' : ''); }).join(' · ');
}

// "Sugerir observacion" del HTML de Edwin. null si faltan items.
function cc2SugerirObs(items, answers, engine) {
  if (cc2Faltantes(items, answers, engine).length) return null;
  var ded = cc2Deducciones(items, answers, engine);
  if (!ded.length) return '¡Felicitaciones! Llamada con cumplimiento total del protocolo de calidad.';
  return ded.map(function (d) {
    if (cc2EsDescuento(engine)) return 'Ítem ' + d.it.n + ' – ' + d.it.label + ': ' + (d.critico ? 'no cumple (ítem crítico: la nota queda en 0 %).' : (d.opcion ? d.opcion.toLowerCase() : 'no cumple') + ' (−' + d.puntos + ' %).');
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

// Fase 318 (pedido de Edwin): plantillas que NO traen `campos` pero usan el formulario
// comun «Calificar» (el de Mobilize/Aurora) con estos campos. La plantilla no se toca:
// son los mismos datos del formulario de siempre de ORLANT (incluido el canal auditado).
// Otra campaña: agregar su entrada. Las de motor de descuento (SURA) no.
var CC2_CAMPOS_POR_CAMPANA = {
  ORLANT: [
    { k: 'asesor', etiqueta: 'Nombre del asesor' },
    { k: 'fecha', etiqueta: 'Fecha' },
    { k: 'idLlamada', etiqueta: 'ID / Llamada - Wpp' },
    { k: 'telefono', etiqueta: '# Teléfono' },
    { k: 'codificacion', etiqueta: 'Codificación' },
    { k: 'evaluador', etiqueta: 'Evaluador' },
    { k: 'canal', etiqueta: 'Canal auditado' },
    { k: 'observaciones', etiqueta: 'Observaciones generales' },
  ],
};
// Fase 340: un solo formulario. Una plantilla sin `campos` ni entrada en CC2_CAMPOS_POR_CAMPANA usa
// estos campos (los del formulario de antes, con telefono: Fase 343). El formulario viejo ya no existe.
var CC2_CAMPOS_GENERICOS = [
  { k: 'asesor', etiqueta: 'Nombre del asesor' },
  { k: 'fecha', etiqueta: 'Fecha' },
  { k: 'idLlamada', etiqueta: 'ID / Llamada - Wpp' },
  { k: 'telefono', etiqueta: '# Teléfono' },
  { k: 'codificacion', etiqueta: 'Codificación' },
  { k: 'evaluador', etiqueta: 'Evaluador' },
  { k: 'canal', etiqueta: 'Canal auditado' },
  { k: 'observaciones', etiqueta: 'Observaciones generales' },
];
// Campos con que se dibuja el formulario comun para esta plantilla (null solo sin plantilla).
// Fase 343 (corrige la Fase 340): el telefono SI se usa en Calidad para ubicar la llamada. Sale en las
// plantillas que lo traen (y en ORLANT y las genericas), siempre justo despues del ID de la llamada.
function cc2CamposDe(p) {
  if (!p) return null;
  var lista = (p.campos || CC2_CAMPOS_POR_CAMPANA[p.campana] || CC2_CAMPOS_GENERICOS).filter(Boolean);
  var tel = lista.filter(function (c) { return c.k === 'telefono'; })[0];
  var iId = lista.map(function (c) { return c.k; }).indexOf('idLlamada');
  if (!tel || iId === -1) return lista.slice();
  var sin = lista.filter(function (c) { return c !== tel; });
  sin.splice(sin.map(function (c) { return c.k; }).indexOf('idLlamada') + 1, 0, tel);
  return sin;
}

// Campos del formulario de la plantilla, en 2 bloques: "Información general"
// (lo de la llamada) y "Detalles adicionales" (motivo y observaciones).
var CC2_DETALLE = ['motivo', 'motivoTexto', 'estrategia', 'causa', 'observaciones']; // Fase 322: + textos libres de SURA
function cc2Bloques(campos) {
  var lista = campos || [];
  return {
    generales: lista.filter(function (c) { return CC2_DETALLE.indexOf(c.k) === -1; }),
    detalle: lista.filter(function (c) { return CC2_DETALLE.indexOf(c.k) !== -1; }),
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { cc2EsDescuento: cc2EsDescuento, cc2Opciones: cc2Opciones, cc2Faltantes: cc2Faltantes, cc2Deducciones: cc2Deducciones, cc2Nota: cc2Nota, cc2Clase: cc2Clase, cc2Alerta: cc2Alerta,
    cc2SubItem: cc2SubItem, cc2Motivo: cc2Motivo, cc2SugerirObs: cc2SugerirObs, cc2PorCategoria: cc2PorCategoria, cc2Bloques: cc2Bloques,
    CC2_CAMPOS_POR_CAMPANA: CC2_CAMPOS_POR_CAMPANA, CC2_CAMPOS_GENERICOS: CC2_CAMPOS_GENERICOS, cc2CamposDe: cc2CamposDe };
}
