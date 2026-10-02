// dashboard-generic-export-fase85-lista-cerrada.test.js — Fase 85. El boton
// "Exportar" del dashboard generico (public/js/dashboard-generic.js,
// _gdDatosPanelesTab) solo sabe convertir a filas exportables los tipos de
// panel listados en GD_EXPORT_TIPOS_SOPORTADOS -- cualquier otro tipo cae en
// un aviso visible ("todavia no tiene soporte de exportacion"), nunca se
// ignora en silencio ni rompe el export.
//
// Esta prueba es la version Fase-85 del patron de "lista cerrada" de la
// Fase 84 (cargas-logic-fase84-plantilla-orlant.test.js): recorre los
// paneles REALES de cada cliente sembrado (server/dashboard-config-seed.js)
// y confirma que todo tipo de panel que de verdad se usa hoy esta cubierto.
// Si una fase futura agrega un tipo de panel nuevo a algun cliente y se
// olvida de darle soporte en _gdDatosPanelesTab/GD_EXPORT_TIPOS_SOPORTADOS,
// esta prueba EMPEZARA A FALLAR -- la correccion es agregar el tipo nuevo
// a ambos lugares a proposito, nunca borrar la prueba.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { GD_EXPORT_TIPOS_SOPORTADOS } = require('../../public/js/dashboard-export-tipos.js');
const { CONFIGS } = require('../dashboard-config-seed.js');

function tiposDePanelUsadosPorTodosLosClientes() {
  const tipos = new Set();
  for (const dash of CONFIGS) {
    const layout = dash.layout || {};
    for (const tab of layout.tabs || []) {
      for (const p of tab.panels || []) {
        if (p.tipo) tipos.add(p.tipo);
      }
    }
  }
  return tipos;
}

test('lista CERRADA de tipos de panel que "Exportar" sabe convertir a filas (falla si un cliente sembrado usa un tipo de panel nuevo sin soporte de exportacion)', () => {
  const usados = tiposDePanelUsadosPorTodosLosClientes();
  const soportados = new Set(GD_EXPORT_TIPOS_SOPORTADOS);
  const sinSoporte = [...usados].filter((t) => !soportados.has(t));
  assert.deepEqual(sinSoporte, [], `estos tipos de panel se usan en algun dashboard sembrado pero "Exportar" no los tiene en GD_EXPORT_TIPOS_SOPORTADOS: ${sinSoporte.join(', ')}`);
});

test('GD_EXPORT_TIPOS_SOPORTADOS cubre exactamente los tipos de panel de ORLANT (Tipificacion, Agendamiento, Efectividad de Agendamiento, Calidad, Trafico Llamadas, Trafico WhatsApp)', () => {
  const orlant = CONFIGS.find((d) => d.cliente === 'ORLANT');
  assert.ok(orlant, 'ORLANT debe existir en CONFIGS');
  const layout = orlant.layout;
  const tiposOrlant = new Set();
  for (const tab of layout.tabs || []) {
    for (const p of tab.panels || []) {
      if (p.tipo) tiposOrlant.add(p.tipo);
    }
  }
  const soportados = new Set(GD_EXPORT_TIPOS_SOPORTADOS);
  for (const t of tiposOrlant) {
    assert.ok(soportados.has(t), `ORLANT usa el tipo de panel "${t}" y no esta soportado por el exportador`);
  }
  // Las pestanas autonomas de ORLANT (Fases 77-78-98) deben estar cubiertas.
  for (const esperado of ['tipificacion_panel', 'agendas_panel', 'efectividad_agendamiento_panel', 'inasistencia_panel', 'efectividad_citas_panel', 'calidad_kpis', 'trafico_combo', 'trafico_whatsapp_combo']) {
    assert.ok(tiposOrlant.has(esperado), `este test asumia que ORLANT usa "${esperado}" -- revisar si el layout de ORLANT cambio`);
  }
});
