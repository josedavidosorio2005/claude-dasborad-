// fecha-limites-logic.js — InConexion Platform (Fase 86, tema 2).
//
// Limites de fecha ACEPTABLE al cargar datos por Excel, compartidos por
// todos los parsers de carga (trafico, trafico-whatsapp, tipificacion,
// agendas, cargas genericas de seccion, calidad): una fecha posterior al
// ULTIMO DIA DEL MES EN CURSO (hora Colombia, UTC-5 fijo, sin horario de
// verano) se rechaza -- nunca "posterior a hoy", porque WhatsApp trae
// periodos cuya FECHA FIN puede ser legitimamente el fin del mes en
// curso (hallazgo real, Fase 85: una fila suelta con fecha 2030-06 en la
// base local corrio la ventana por defecto de Trafico/Agendas a un mes
// casi vacio). Una fecha anterior a 2020 es sospechosa (probable error de
// digitacion, ej. "2030" en vez de "2026") pero NO se bloquea, solo se
// advierte en la vista previa.
//
// Doble modo: global en el navegador, require() en Node para las pruebas
// y para los parsers del lado del servidor.
'use strict';

var FECHA_LIMITES_MINIMA_RAZONABLE = '2020-01-01';

// "Hoy" en Colombia (America/Bogota, UTC-5 fijo) como 'AAAA-MM-DD' -- sin
// depender de la zona horaria del proceso que corre (el servidor en AWS
// corre en UTC). `ahora` es inyectable (pruebas); por defecto new Date().
function fechaLimitesHoyColombia(ahora) {
  var d = ahora instanceof Date ? ahora : new Date();
  var bogota = new Date(d.getTime() - 5 * 60 * 60 * 1000);
  var y = bogota.getUTCFullYear();
  var m = String(bogota.getUTCMonth() + 1).padStart(2, '0');
  var day = String(bogota.getUTCDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

// Ultimo dia del MES EN CURSO (hora Colombia) como 'AAAA-MM-DD' -- el
// limite superior aceptado para cualquier fecha cargada o para la ventana
// por defecto de un panel (nunca "hoy": un periodo de WhatsApp puede
// terminar legitimamente el ultimo dia del mes).
function fechaLimitesFinDeMesActual(ahora) {
  var hoy = fechaLimitesHoyColombia(ahora);
  var y = parseInt(hoy.slice(0, 4), 10);
  var m = parseInt(hoy.slice(5, 7), 10);
  var ultimoDia = new Date(Date.UTC(y, m, 0)).getUTCDate(); // dia 0 del mes siguiente = ultimo del actual
  return hoy.slice(0, 8) + String(ultimoDia).padStart(2, '0');
}

// true si `fechaISO` ('AAAA-MM-DD', o con hora al final -- se usan los
// primeros 10 caracteres) es posterior al ultimo dia del mes en curso.
function fechaLimitesEsFutura(fechaISO, ahora) {
  if (!fechaISO || typeof fechaISO !== 'string') return false;
  return fechaISO.slice(0, 10) > fechaLimitesFinDeMesActual(ahora);
}

// true si `fechaISO` es anterior a FECHA_LIMITES_MINIMA_RAZONABLE --
// probable error de digitacion. Solo para ADVERTIR, nunca para bloquear.
function fechaLimitesEsSospechosaAntigua(fechaISO) {
  if (!fechaISO || typeof fechaISO !== 'string') return false;
  return fechaISO.slice(0, 10) < FECHA_LIMITES_MINIMA_RAZONABLE;
}

// Recorta una fecha ('AAAA-MM-DD') para que nunca supere el fin del mes en
// curso -- usado para que la ventana POR DEFECTO de un panel (ej. "ultimos
// 12 meses hasta el mas reciente con datos") nunca quede arrastrada por
// una fila con fecha futura que ya exista en la base (dato viejo/erroneo,
// carga anterior a este fix).
function fechaLimitesRecortar(fechaISO, ahora) {
  if (!fechaISO || typeof fechaISO !== 'string') return fechaISO;
  var limite = fechaLimitesFinDeMesActual(ahora);
  return fechaISO.slice(0, 10) > limite ? limite : fechaISO;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    FECHA_LIMITES_MINIMA_RAZONABLE: FECHA_LIMITES_MINIMA_RAZONABLE,
    fechaLimitesHoyColombia: fechaLimitesHoyColombia,
    fechaLimitesFinDeMesActual: fechaLimitesFinDeMesActual,
    fechaLimitesEsFutura: fechaLimitesEsFutura,
    fechaLimitesEsSospechosaAntigua: fechaLimitesEsSospechosaAntigua,
    fechaLimitesRecortar: fechaLimitesRecortar,
  };
}
