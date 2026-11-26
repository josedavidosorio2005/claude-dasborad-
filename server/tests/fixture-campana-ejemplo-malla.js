// fixture-campana-ejemplo-malla.js — Fase W10 (26/11/2026): la réplica «MOBILIZE PRUEBAS API» se borró del código y
// de producción. Las pruebas de la malla y la puntualidad la usaban como campaña de ejemplo (con las asesoras de
// MOBILIZE, solo lectura): aquí se vuelve a armar SOLO en la base temporal de la prueba, con su configuración de
// puntualidad de entonces. No es código de la app.
'use strict';
const db = require('../db');
const P = require('../puntualidad');
const R = 'MOBILIZE PRUEBAS API';
function montar() {
  db.crearReplicaMobilizeApi();
  P._configurarParaPruebas({
    [R]: { operacion: 'MOBILIZE', asesorasDe: 'MOBILIZE', asesoraVe: false },
    SURA: { operacion: 'ARCHIVO_SURA', asesorasDe: 'SURA', asesoraVe: true },
  });
  return R;
}
module.exports = { montar, R };
