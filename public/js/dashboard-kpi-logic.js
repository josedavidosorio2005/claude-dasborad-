// dashboard-kpi-logic.js — Fase 88. Doble modo (global/Node), sin DOM --
// mismo motivo que dashboard-export-tipos.js: dashboard-generic.js ejecuta
// codigo de DOM al cargarse y no se puede requerir() desde Node.
//
// gdPorcentajeMeta(cur, meta) era ANTES dos copias independientes del
// mismo calculo: una en _gdKpiCardHtml (la tarjeta en pantalla, con el
// guard correcto) y otra en _gdDatosKpis (el export a Excel/PDF, SIN el
// guard de `cur` -- con `cur` null pero `meta` configurada, `null / meta`
// daba 0, y el export mostraba "% Meta: 0" como si la meta estuviera en
// 0% de cumplimiento en vez de "sin dato"). Hallazgo real del barrido de
// la Fase 88. Ahora las dos llaman a esta MISMA funcion.
function gdPorcentajeMeta(cur, meta) {
  if (meta === null || meta === undefined || meta === 0) return null;
  if (cur === null || cur === undefined) return null;
  return Math.round((cur / meta) * 1000) / 10;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { gdPorcentajeMeta: gdPorcentajeMeta };
}
