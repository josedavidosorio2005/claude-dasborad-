// calidad-analisis-logic.js — Fase 255 (plan de Calidad B4). Calculos puros
// para Resumen por asesor, Detalle por mes, Diccionario e "items mas
// afectados", como el HTML de Edwin. Sin DOM: lo usan el modulo de Calidad,
// la pestaña Calidad del dashboard y "Mis resultados" del asesor (B5).
// Los puntajes vienen ya calculados por el servidor (monitoreo.puntaje).

function caR1(n) { return Math.round(n * 10) / 10; }

// Plantilla con la que se hizo el monitoreo: la de su plantillaId o, en los
// viejos (NULL), la principal de su campaña.
function caPlantillaDe(m, plantillas) {
  var lista = plantillas || [];
  if (m.plantillaId) return lista.find(function (p) { return p.id === m.plantillaId; }) || null;
  return lista.find(function (p) { return p.campana === m.campana && p.principal; }) || null;
}

function caClase(nota) {
  if (nota === null || nota === undefined || isNaN(nota)) return { k: 'na', t: 'Sin datos' };
  if (nota < 70) return { k: 'bad', t: 'Crítico' };
  if (nota < 90) return { k: 'warn', t: 'No crítico' };
  return { k: 'ok', t: 'Sobresaliente' };
}

// Alerta del resumen sobre la suma de fallos criticos del asesor (plan, sec. I):
// 0 = sin fallos, 1 = Alerta, 2 o mas = Critico frecuente.
function caAlertaResumen(fallos) {
  if (!fallos) return { k: 'ok', t: 'Sin fallos críticos' };
  return fallos === 1 ? { k: 'warn', t: 'Alerta' } : { k: 'bad', t: 'Crítico frecuente' };
}

function caKpis(monitoreos) {
  var arr = monitoreos || [];
  var total = arr.length;
  var prom = total ? caR1(arr.reduce(function (s, m) { return s + (Number(m.puntaje) || 0); }, 0) / total) : null;
  var asesores = {};
  arr.forEach(function (m) { asesores[String(m.asesor || '').trim().toLowerCase()] = true; });
  return {
    total: total,
    promedio: prom,
    clase: caClase(prom),
    criticosAbsolutos: arr.filter(function (m) { return (m.fallos || 0) >= 2; }).length,
    asesores: Object.keys(asesores).filter(Boolean).length,
  };
}

// Una fila por asesor, de mayor a menor promedio.
function caResumenAsesores(monitoreos) {
  var by = {};
  (monitoreos || []).forEach(function (m) {
    var k = String(m.asesor || '').trim().toLowerCase();
    if (!k) return;
    if (!by[k]) by[k] = { asesor: m.asesor, notas: [], fallos: 0 };
    by[k].notas.push(Number(m.puntaje) || 0);
    by[k].fallos += m.fallos || 0;
  });
  return Object.keys(by).map(function (k) {
    var a = by[k];
    var prom = caR1(a.notas.reduce(function (s, x) { return s + x; }, 0) / a.notas.length);
    return { asesor: a.asesor, monitoreos: a.notas.length, promedio: prom, clase: caClase(prom), fallos: a.fallos, alerta: caAlertaResumen(a.fallos),
      mejor: Math.max.apply(null, a.notas), peor: Math.min.apply(null, a.notas) };
  }).sort(function (x, y) { return y.promedio - x.promedio || String(x.asesor).localeCompare(String(y.asesor)); });
}

// Items de la plantilla con cuantos monitoreos los fallaron (NO) y que
// asesores, de mas a menos fallado. Solo los monitoreos de ESA plantilla.
function caItemsAfectados(monitoreos, items) {
  var arr = monitoreos || [];
  return (items || []).map(function (it) {
    var fallaron = arr.filter(function (m) { return m.answers && m.answers[it.n] === 'NO'; });
    var nombres = {};
    fallaron.forEach(function (m) { var k = String(m.asesor || '').trim(); if (k) nombres[k] = (nombres[k] || 0) + 1; });
    return { it: it, fallos: fallaron.length, pct: arr.length ? caR1(fallaron.length / arr.length * 100) : 0,
      asesores: Object.keys(nombres).sort(function (a, b) { return nombres[b] - nombres[a] || a.localeCompare(b); }).map(function (n) { return { asesor: n, veces: nombres[n] }; }) };
  }).sort(function (a, b) { return b.fallos - a.fallos || a.it.n - b.it.n; });
}

// Calificacion por mes (para la vista del asesor y del supervisor).
function caPorMes(monitoreos) {
  var by = {};
  (monitoreos || []).forEach(function (m) {
    var mes = String(m.fecha || '').slice(0, 7);
    if (!mes) return;
    (by[mes] = by[mes] || []).push(Number(m.puntaje) || 0);
  });
  return Object.keys(by).sort().map(function (mes) {
    var n = by[mes];
    var prom = caR1(n.reduce(function (s, x) { return s + x; }, 0) / n.length);
    return { mes: mes, monitoreos: n.length, promedio: prom, clase: caClase(prom) };
  });
}

// Cuantos monitoreos hay en cada clasificacion (torta).
function caPorClasificacion(monitoreos) {
  var o = { ok: 0, warn: 0, bad: 0 };
  (monitoreos || []).forEach(function (m) { var k = caClase(Number(m.puntaje)).k; if (o[k] !== undefined) o[k]++; });
  return o;
}

// Filtro del Detalle por mes: mes ('' = todos) y texto del asesor.
function caFiltrar(monitoreos, mes, texto) {
  var q = String(texto || '').trim().toLowerCase();
  return (monitoreos || []).filter(function (m) {
    if (mes && String(m.fecha || '').slice(0, 7) !== mes) return false;
    return !q || String(m.asesor || '').toLowerCase().indexOf(q) !== -1;
  }).sort(function (a, b) { return String(b.fecha || '').localeCompare(String(a.fecha || '')) || b.id - a.id; });
}

// Reglas del diccionario (cabecera) para una plantilla ponderada.
function caReglasDiccionario(p) {
  var items = (p && p.items) || [];
  var crit = items.filter(function (it) { return it.critico; }).length;
  // Fase 322: motor descuento (Televentas SURA).
  if (p && p.engine === 'descuento') {
    var peor = Math.max(0, 100 - items.filter(function (it) { return !it.critico; }).reduce(function (s, it) { return s + (Number(it.weight) || 0); }, 0));
    return [items.length + ' ítems · ' + crit + ' críticos · se parte de 100 %', 'Crítico: un NO deja la nota en 0 %', 'No crítico: un NO (o la opción elegida) descuenta su porcentaje · sin N/A', 'Peor nota sin fallar críticos: ' + peor + ' %'];
  }
  return [
    items.length + ' ítems · ' + crit + ' críticos · los pesos suman 100',
    'Crítico: un NO resta 20 puntos',
    'SI o N/A suman el peso del ítem · NO en un no crítico pierde su peso',
    '1 crítico fallado = Alerta · 2 o más = Crítico absoluto',
  ];
}

// Impacto en la nota de cada respuesta (tarjeta del diccionario).
function caImpacto(it, engine) {
  // Fase 322: motor descuento: cada respuesta con su descuento.
  if (engine === 'descuento') {
    if (it.critico) return [['SI', '0 %'], ['NO', 'nota 0 %']];
    if (it.opciones && it.opciones.length) return it.opciones.map(function (o) { return [o.t, o.descuento ? '−' + o.descuento + ' %' : '0 %']; });
    return [['SI', '0 %'], ['NO', '−' + (Number(it.descuento) || 0) + ' %']];
  }
  return [['SI', '+' + it.weight], ['N/A', it.admiteNA === false ? 'No aplica' : '+' + it.weight], ['NO', it.critico ? String(it.weight - 20) : '0']];
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { caPlantillaDe: caPlantillaDe, caClase: caClase, caAlertaResumen: caAlertaResumen, caKpis: caKpis, caResumenAsesores: caResumenAsesores,
    caItemsAfectados: caItemsAfectados, caPorMes: caPorMes, caPorClasificacion: caPorClasificacion, caFiltrar: caFiltrar, caReglasDiccionario: caReglasDiccionario, caImpacto: caImpacto };
}
