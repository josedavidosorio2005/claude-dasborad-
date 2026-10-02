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

// Fase 113 (tema A): fecha+hora completa en Colombia ('DD/MM/AAAA HH:MM:SS'),
// para el registro de inicios de sesion -- mismo offset fijo UTC-5 que el
// resto de este archivo. El servidor (AWS) corre en UTC; el helper generico
// de historial (nowStr, routes/shared.js) usa la hora LOCAL DEL PROCESO, que
// en produccion es UTC, no Colombia -- por eso el registro de login no lo
// reusa y pide la hora aqui, donde ya se resuelve correctamente.
function fechaLimitesAhoraColombiaStr(ahora) {
  const d = ahora instanceof Date ? ahora : new Date();
  const bogota = new Date(d.getTime() - 5 * 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${pad(bogota.getUTCDate())}/${pad(bogota.getUTCMonth() + 1)}/${bogota.getUTCFullYear()} ` +
    `${pad(bogota.getUTCHours())}:${pad(bogota.getUTCMinutes())}:${pad(bogota.getUTCSeconds())}`
  );
}

// Primer y ultimo dia de un mes 'AAAA-MM' como 'AAAA-MM-DD' (sin hora).
// Fase 88: reemplaza filtros `substr(columna,1,7) = @mes` (no sargables,
// nunca usan la parte de fecha de un indice compuesto) por un rango
// directo `columna >= @desde AND columna <= @hasta` sobre la MISMA
// columna indexada -- mismo resultado, ahora aprovechando el indice.
// Si la columna guarda tambien hora ('AAAA-MM-DD HH:MM:SS'), el caller
// debe agregar ' 23:59:59' a `hasta` para no perder filas del ultimo dia
// (ver agendas.js).
function fechaLimitesRangoDeMes(mes) {
  const y = parseInt(mes.slice(0, 4), 10);
  const m = parseInt(mes.slice(5, 7), 10);
  const ultimoDia = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { desde: mes + '-01', hasta: mes + '-' + String(ultimoDia).padStart(2, '0') };
}

module.exports = {
  fechaLimitesHoyColombia,
  fechaLimitesFinDeMesActual,
  fechaLimitesEsFutura,
  fechaLimitesRangoDeMes,
  fechaLimitesAhoraColombiaStr,
};
