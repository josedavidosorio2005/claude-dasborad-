// dashboard-export-tipos.js — Fase 85. Lista CERRADA de los tipos de panel
// que el boton "Exportar" del dashboard generico (dashboard-generic.js,
// _gdDatosPanelesTab) sabe convertir a filas exportables. Vive en su propio
// archivo (sin DOM, doble modo global/Node) porque dashboard-generic.js
// ejecuta codigo de DOM al cargarse y no se puede requerir() desde Node --
// ver server/tests/dashboard-generic-export-fase85-lista-cerrada.test.js,
// que compara esta lista contra los tipos de panel que de verdad usa cada
// cliente sembrado (server/dashboard-config-seed.js). Si un tipo nuevo se
// agrega a algun panel y no se le da soporte aqui Y en
// _gdDatosPanelesTab, esa prueba falla.
var GD_EXPORT_TIPOS_SOPORTADOS = [
  'kpi_row', 'calidad_kpis', 'calidad_pie', 'calidad_bar_asesores', 'trafico_combo', 'trafico_whatsapp_combo',
  'agendas_panel', 'efectividad_agendamiento_panel', 'tipificacion_panel', 'inasistencia_panel', 'efectividad_citas_panel', 'salida_panel', 'nota_kpi', 'pie', 'tabla', 'line', 'bar', 'area', 'combo',
];

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { GD_EXPORT_TIPOS_SOPORTADOS: GD_EXPORT_TIPOS_SOPORTADOS };
}
