// helpers-aurora.js — Fase 220: como debe quedar Clinica Aurora despues de sus
// migraciones (creacion de la Fase 153 + fase220_aurora_trafico_visible_v1 +
// fase220_aurora_salida_v1). Lo usan las pruebas de Aurora y de HLM.
'use strict';

const { generarLayout, TABS_EXTRA } = require('../plantillas-cliente');

const AURORA = 'CLINICA AURORA';
const AURORA_MODULOS = ['flujo_llamadas', 'flujo_whatsapp', 'salida', 'tipificacion', 'calidad'];

// Plantilla con los modulos de hoy, Trafico visible (Fase 220) y "Total tráfico" despues de Salida.
function auroraEsperada() {
  const cfg = generarLayout({ nombre: AURORA, titulo: 'Dashboard Clínica Aurora', modulos: AURORA_MODULOS, visibles: ['flujo_llamadas', 'flujo_whatsapp'] });
  const i = cfg.layout.tabs.findIndex((t) => t.key === 'salida');
  cfg.layout.tabs.splice(i + 1, 0, TABS_EXTRA.total_trafico.crear(AURORA));
  return cfg;
}

module.exports = { AURORA, AURORA_MODULOS, auroraEsperada };
