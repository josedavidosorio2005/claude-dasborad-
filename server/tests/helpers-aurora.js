// helpers-aurora.js — Fase 220: como debe quedar Clinica Aurora despues de sus
// migraciones (creacion de la Fase 153 + fase220_aurora_trafico_visible_v1 +
// fase220_aurora_salida_v1). Lo usan las pruebas de Aurora y de HLM.
'use strict';

const { generarLayout, TABS_EXTRA } = require('../plantillas-cliente');

const AURORA = 'CLINICA AURORA';
// Fase 230: + whatsapp_tiempos (sub-vista de WhatsApp: no cambia las pestañas).
// Fase 259: + agendas_usuaria (pestaña "Agendas por usuaria", oculta hasta tener datos).
const AURORA_MODULOS = ['flujo_llamadas', 'flujo_whatsapp', 'whatsapp_tiempos', 'salida', 'agendas_usuaria', 'tipificacion', 'calidad'];

// Plantilla con los modulos de hoy, Trafico visible (Fase 220) y "Total tráfico" despues de Salida.
function auroraEsperada() {
  const cfg = generarLayout({ nombre: AURORA, titulo: 'Dashboard Clínica Aurora', modulos: AURORA_MODULOS, visibles: ['flujo_llamadas', 'flujo_whatsapp'] });
  const i = cfg.layout.tabs.findIndex((t) => t.key === 'salida');
  cfg.layout.tabs.splice(i + 1, 0, TABS_EXTRA.total_trafico.crear(AURORA));
  return cfg;
}

// Fase 229: Hospital La Maria despues de fase229_hlm_como_orlant_v1 (como
// Aurora + WhatsApp por rangos; todo oculto menos "Total tráfico").
const HLM = 'HOSPITAL LA MARIA';
const HLM_MODULOS = ['flujo_llamadas', 'flujo_whatsapp', 'whatsapp_tiempos', 'salida', 'tipificacion', 'calidad'];
function hlmEsperada() {
  const cfg = generarLayout({ nombre: HLM, titulo: 'Dashboard Hospital La María', modulos: HLM_MODULOS });
  const i = cfg.layout.tabs.findIndex((t) => t.key === 'salida');
  cfg.layout.tabs.splice(i + 1, 0, TABS_EXTRA.total_trafico.crear(HLM));
  return cfg;
}

module.exports = { AURORA, AURORA_MODULOS, auroraEsperada, HLM, HLM_MODULOS, hlmEsperada };
