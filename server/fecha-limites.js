// fecha-limites.js — InConexion Platform (Fase 86, tema 2).
//
// Version servidor de public/js/fecha-limites-logic.js (misma logica,
// duplicada a proposito en vez de cruzar el limite public/<->server: cada
// lado del repo depende solo de sus propios modulos). Usado como defensa
// en el servidor (nunca solo en el navegador) en validation.js y
// dashboard-secciones.js: una fecha posterior al ultimo dia del mes en
// curso (hora Colombia, UTC-5 fijo) se rechaza en CUALQUIER carga por
// Excel -- nunca "posterior a hoy", porque WhatsApp trae periodos cuya
// FECHA FIN puede ser legitimamente el fin del mes en curso.
'use strict';

// "Hoy" en Colombia (America/Bogota, UTC-5 fijo) como 'AAAA-MM-DD' -- el
// servidor (AWS) corre en UTC, por eso no se usa la zona horaria del
// proceso. `ahora` es inyectable (pruebas); por defecto new Date().
function fechaLimitesHoyColombia(ahora) {
  const d = ahora instanceof Date ? ahora : new Date();
  const bogota = new Date(d.getTime() - 5 * 60 * 60 * 1000);
  const y = bogota.getUTCFullYear();
  const m = String(bogota.getUTCMonth() + 1).padStart(2, '0');
  const day = String(bogota.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Ultimo dia del MES EN CURSO (hora Colombia) como 'AAAA-MM-DD'.
function fechaLimitesFinDeMesActual(ahora) {
  const hoy = fechaLimitesHoyColombia(ahora);
  const y = parseInt(hoy.slice(0, 4), 10);
  const m = parseInt(hoy.slice(5, 7), 10);
  const ultimoDia = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return hoy.slice(0, 8) + String(ultimoDia).padStart(2, '0');
}

// true si `fechaISO` es posterior al ultimo dia del mes en curso.
function fechaLimitesEsFutura(fechaISO, ahora) {
  if (!fechaISO || typeof fechaISO !== 'string') return false;
  return fechaISO.slice(0, 10) > fechaLimitesFinDeMesActual(ahora);
}

module.exports = {
  fechaLimitesHoyColombia,
  fechaLimitesFinDeMesActual,
  fechaLimitesEsFutura,
};
