// mes-nombre-logic.js — InConexion Platform (Fase 111, ORLANT: 2 bases
// nuevas de Edwin -- EFECTIVIDAD_AGENDAMIENTO.xlsx y CITAS_ATENDIDAS.xlsx --
// ninguna trae una columna AÑO, solo el nombre del mes en español, ej.
// "SEPTIEMBRE").
//
// Logica PURA (sin DOM), extraida para compartirse entre
// efectividad-agendamiento-logic.js y citas-atendidas-logic.js (las 2
// bases nuevas de esta fase) -- mismo criterio que ya existia para
// Inasistencia ANTES de la Fase 108 (cuando ese archivo todavia traia un
// agregado por MES+especialidad, no una fila por cita): sin columna AÑO,
// se infiere el AÑO MAS RECIENTE en que ese mes no es futuro (hora
// Colombia) -- nunca un mes que todavia no ha llegado. Recuperada tal
// cual de `git show f1e1147:public/js/inasistencia-logic.js` (removida en
// la Fase 108 al cambiar el formato de Inasistencia, nunca borrada del
// historial de git).
//
// Doble modo como el resto de *-logic.js de este repo: global en el
// navegador, require() en Node para las pruebas.
'use strict';

var _mesNombreFechaLimites = (typeof require === 'function') ? require('./fecha-limites-logic.js') : (typeof window !== 'undefined' ? window : this);

var MES_NOMBRE_A_NUM = {
  ENERO: '01', FEBRERO: '02', MARZO: '03', ABRIL: '04', MAYO: '05', JUNIO: '06',
  JULIO: '07', AGOSTO: '08', SEPTIEMBRE: '09', SETIEMBRE: '09', OCTUBRE: '10', NOVIEMBRE: '11', DICIEMBRE: '12',
};

// Serial de Excel (sin hora) -> 'AAAA-MM' -- aritmetica directa sobre UTC,
// nunca Date+cellDates de SheetJS (puede desplazar el mes por la zona
// horaria del sistema). Mismo criterio que agendasFechaHoraDesdeSerial/
// _inasistenciaSerialAMes (ya removida de inasistencia-logic.js, Fase 108).
function _mesNombreSerialAMes(serial) {
  var n = Number(serial);
  if (!Number.isFinite(n)) return null;
  var ms = Math.round((n - 25569) * 86400000);
  var d = new Date(ms);
  if (isNaN(d.getTime())) return null;
  var y = d.getUTCFullYear();
  if (y < 1970 || y > 2200) return null;
  var pad2 = function (x) { return (x < 10 ? '0' : '') + x; };
  return y + '-' + pad2(d.getUTCMonth() + 1);
}

// MES (texto/serial/ya 'AAAA-MM') + AÑO opcional -> 'AAAA-MM', o null si no
// se pudo reconocer. Con nombre de mes en texto: si viene `valorAnio`, se
// usa tal cual; si no, se infiere el AÑO MAS RECIENTE en que ese mes no es
// futuro (hora Colombia) -- igual que "nunca despues del mes en curso" de
// agendas/tipificacion/inasistencia (Fase 86).
function mesNombreAAAAMM(valorMes, valorAnio, ahora) {
  if (valorMes === null || valorMes === undefined || valorMes === '') return null;
  if (typeof valorMes === 'number') return _mesNombreSerialAMes(valorMes);
  if (typeof valorMes !== 'string') return null;
  var t = valorMes.trim();
  if (/^\d{4}-\d{2}$/.test(t)) return t;
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 7);
  if (/^\d+(\.\d+)?$/.test(t)) return _mesNombreSerialAMes(Number(t));
  var nombre = t.toUpperCase();
  var mm = MES_NOMBRE_A_NUM[nombre];
  if (!mm) return null;
  var anioTexto = (valorAnio !== undefined && valorAnio !== null && String(valorAnio).trim() !== '')
    ? String(valorAnio).trim().replace(/\.0$/, '') : null;
  if (anioTexto && /^\d{4}$/.test(anioTexto)) return anioTexto + '-' + mm;
  var hoy = _mesNombreFechaLimites.fechaLimitesHoyColombia(ahora);
  var anioActual = parseInt(hoy.slice(0, 4), 10);
  var mesActual = hoy.slice(5, 7);
  return (mm > mesActual) ? (String(anioActual - 1) + '-' + mm) : (String(anioActual) + '-' + mm);
}

// Doble modo: global en el navegador, require() en Node para las pruebas.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { MES_NOMBRE_A_NUM: MES_NOMBRE_A_NUM, mesNombreAAAAMM: mesNombreAAAAMM };
}
