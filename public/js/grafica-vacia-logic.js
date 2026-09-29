// grafica-vacia-logic.js — Fase 90 (hallazgo real: la pastilla "Nivel de
// Servicio" de Trafico de WhatsApp quedaba en blanco, sin ningun mensaje,
// cuando su unica serie (5 min) no tenia dato para el periodo).
//
// Doble modo (global/Node), sin DOM -- extrae la logica de DECISION que
// usan _gdChart (dashboard-generic.js) y _traficoDibujarSL (trafico.js)
// para poder probarla con node:test; la insercion real del aviso en el
// DOM (que contenedor exacto, .aurora-card vs .aurora-chart-wrap) sigue
// en esos archivos, verificada con Playwright (no tienen doble modo: usan
// document/Chart/etc como variables globales del navegador).
'use strict';

// gdGraficaEstaVacia(cfg): true si NINGUN dataset del grafico tiene al
// menos un valor no-null/no-undefined -- misma condicion que ya usaba
// _gdChart. Con 2 series (ej. WhatsApp: 5 min + 20s) y una sola vacia, el
// grafico NO se considera vacio (sigue dibujando la que si tiene dato).
function gdGraficaEstaVacia(cfg) {
  return !cfg || !cfg.data || !cfg.data.labels || cfg.data.labels.length === 0 ||
    (cfg.data.datasets || []).every(function (d) {
      return !(d.data || []).some(function (v) { return v !== null && v !== undefined; });
    });
}

// gdSerieSinDatoAvisoNecesario(datosPrincipal, datosSecundaria): true si
// la serie PRINCIPAL no tiene NINGUN dato en el periodo pero la
// SECUNDARIA si -- el caso exacto del hallazgo real (WhatsApp: 5 min sin
// cargar, 20s si). El grafico entero no esta vacio (gdGraficaEstaVacia
// daria false), asi que el aviso generico de "Sin datos cargados" nunca
// se dispara -- hace falta un aviso especifico, dentro del area del
// grafico, sin tapar la serie que si tiene dato.
function gdSerieSinDatoAvisoNecesario(datosPrincipal, datosSecundaria) {
  var principalVacia = !(datosPrincipal || []).some(function (v) { return v !== null && v !== undefined; });
  var secundariaConDato = (datosSecundaria || []).some(function (v) { return v !== null && v !== undefined; });
  return principalVacia && secundariaConDato;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    gdGraficaEstaVacia: gdGraficaEstaVacia,
    gdSerieSinDatoAvisoNecesario: gdSerieSinDatoAvisoNecesario,
  };
}
