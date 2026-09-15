// semaforo-logic.js — InConexion Platform.
//
// Logica PURA (sin DOM) del motor de umbrales de semaforo (color por dato),
// compartida por los 12+ dashboards de cliente via dashboard-generic.js y
// por Calidad via calidad.js. Doble modo como trafico-logic.js/esc.js: global
// en el navegador y require() en Node para las pruebas
// (server/tests/semaforo-logic.test.js).
'use strict';

// 'verde'|'amarillo'|'rojo'|null. umbral = { verde, amarillo, direccion }.
// direccion: 'mayor_es_mejor' (default) o 'menor_es_mejor'. null si el valor
// no es un numero o no hay umbral — nunca se inventa un color sin config.
function semaforoColorDe(valor, umbral) {
  if (!umbral) return null;
  var n = valor === null || valor === undefined ? null : Number(valor);
  if (n === null || isNaN(n)) return null;
  var mayor = umbral.direccion !== 'menor_es_mejor';
  if (mayor) return n >= umbral.verde ? 'verde' : (n >= umbral.amarillo ? 'amarillo' : 'rojo');
  return n <= umbral.verde ? 'verde' : (n <= umbral.amarillo ? 'amarillo' : 'rojo');
}

// Busca en una lista de filas umbrales_semaforo (id,metrica,campana,verde,
// amarillo,direccion) la que aplica: override por campana primero, si no el
// default global (campana==='' o null/undefined).
function semaforoUmbralPara(umbrales, metrica, campana) {
  if (!umbrales || !umbrales.length) return null;
  var porCampana = campana
    ? umbrales.find(function (u) { return u.metrica === metrica && u.campana === campana; })
    : null;
  if (porCampana) return porCampana;
  return umbrales.find(function (u) { return u.metrica === metrica && !u.campana; }) || null;
}

// Identificador de metrica a partir de un titulo de KPI (minusculas, sin
// tildes, espacios/simbolos -> "_"). Usado como fallback cuando el KPI no
// trae un `metrica` explicito en su configuracion.
function semaforoMetricaKey(titulo) {
  var sinTildes = String(titulo || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
  return sinTildes.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function semaforoClaseCss(color) {
  return color === 'verde' ? 'kpi-green' : color === 'amarillo' ? 'kpi-org' : color === 'rojo' ? 'kpi-red' : '';
}

// Doble modo: global en el navegador, require() en Node para las pruebas.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    semaforoColorDe: semaforoColorDe,
    semaforoUmbralPara: semaforoUmbralPara,
    semaforoMetricaKey: semaforoMetricaKey,
    semaforoClaseCss: semaforoClaseCss,
  };
}
