// campanas.js — deriva, a partir de la configuracion real de los dashboards
// (CONFIGS), que campanas tienen pestana de Calidad — para no mantener esa
// lista a mano en un segundo sitio (seed-demo.js y sus tests la comparten).
'use strict';

function campanasConCalidadTab(configs) {
  const set = new Set();
  for (const cfg of configs) {
    for (const tab of cfg.layout.tabs || []) {
      for (const p of tab.panels || []) {
        if (p.tipo && p.tipo.indexOf('calidad') === 0 && p.campana) set.add(p.campana);
      }
    }
  }
  return [...set].sort();
}

module.exports = { campanasConCalidadTab };
