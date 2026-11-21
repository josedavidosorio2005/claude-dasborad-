// total-trafico.js — Fase 219 (pedido de Edwin, 30/10, ORLANT): pestaña
// "Total tráfico". Sale de lo ya cargado, sin archivo propio (mismo patron
// que la Efectividad de Citas de la Fase 212):
//   - llamadas de entrada: ingresadas y contestadas de Trafico de Llamadas
//     (calidad_nivel_servicio_diario);
//   - WhatsApp de entrada: ingresados y contestados de Trafico de WhatsApp
//     (trafico_whatsapp);
//   - llamadas y WhatsApp de salida: los de la pestaña de salida
//     (salidaCombinadaPorMes: General + 3P + sin clasificar).
// Decision de Edwin (opcion A): cada salida cuenta como contestada (la hizo el
// asesor); la tasa de contactabilidad (salidas conectadas) queda pendiente.
// Nivel de atencion = contestados ÷ ingresados; null si no hay ingresados.
// Fase B1 (plan de accion, entrega «mejoras» 27/11): + citas asignadas del mes
// (tabla agendas: General + 3P, las mismas filas de Agendamiento y de la
// Efectividad de Citas) y Efectividad de agendamiento = citas asignadas ÷
// interacciones atendidas y realizadas (= `contestados`: entrada contestada +
// todas las salidas, llamadas + WhatsApp). Un mes sin ninguna fila de agendas
// queda con citas = null («sin agendas cargadas»), nunca 0.
'use strict';

const { salidaCombinadaPorMes } = require('./salida-cdr');

function totalTraficoPorMes(db, campana) {
  const porMes = (sql) => new Map(db.prepare(sql).all(campana).map((r) => [r.mes, r]));
  const llam = porMes('SELECT substr(fecha,1,7) AS mes, SUM(totalLlamadas) AS ing, SUM(contestadas) AS con FROM calidad_nivel_servicio_diario WHERE campana = ? GROUP BY mes');
  const wpp = porMes('SELECT substr(fechaInicio,1,7) AS mes, SUM(totalWhatsapp) AS ing, SUM(contestados) AS con FROM trafico_whatsapp WHERE campana = ? GROUP BY mes');
  const sal = new Map(salidaCombinadaPorMes(db, campana).map((f) => [f.mes, f]));
  const citas = new Map(db.prepare(
    `SELECT substr(fechaSolicitud,1,7) AS mes, COUNT(*) AS n,
            SUM(CASE WHEN tipoLinea = 'GENERAL' THEN 1 ELSE 0 END) AS gen,
            SUM(CASE WHEN tipoLinea = '3P' THEN 1 ELSE 0 END) AS p3
       FROM agendas WHERE campana = ? GROUP BY mes`
  ).all(campana).map((r) => [r.mes, r]));
  const meses = [...new Set([...llam.keys(), ...wpp.keys(), ...sal.keys()])].sort();
  return meses.map((mes) => {
    const l = llam.get(mes) || {};
    const w = wpp.get(mes) || {};
    const s = sal.get(mes) || {};
    const llamadasEntrada = l.ing || 0;
    const llamadasContestadas = l.con || 0;
    const whatsappEntrada = w.ing || 0;
    const whatsappContestados = w.con || 0;
    const llamadasSalida = (s.llamadas3p || 0) + (s.llamadasGeneral || 0) + (s.llamadasSinAsignar || 0);
    const whatsappSalida = (s.wpp3p || 0) + (s.wppGeneral || 0) + (s.wppSinAsignar || 0);
    const ingresados = llamadasEntrada + whatsappEntrada + llamadasSalida + whatsappSalida;
    const contestados = llamadasContestadas + whatsappContestados + llamadasSalida + whatsappSalida;
    const c = citas.get(mes);
    const citasAsignadas = c ? c.n : null;
    return {
      mes,
      llamadasEntrada, llamadasContestadas, whatsappEntrada, whatsappContestados, llamadasSalida, whatsappSalida,
      ingresados, contestados,
      nivelAtencion: ingresados > 0 ? contestados / ingresados : null,
      citasAsignadas, citasGeneral: c ? c.gen : null, citas3p: c ? c.p3 : null,
      efectividadAgendamiento: citasAsignadas !== null && contestados > 0 ? citasAsignadas / contestados : null,
    };
  });
}

// Suma de varios meses (las tarjetas, con MESES): totales sumados, nunca el
// promedio de los porcentajes.
// Citas: solo los meses que tienen agendas cargadas, con los contestados de
// esos mismos meses (el % no mezcla meses sin agendas).
function totalTraficoSuma(filas) {
  const ingresados = filas.reduce((a, f) => a + f.ingresados, 0);
  const contestados = filas.reduce((a, f) => a + f.contestados, 0);
  const conCitas = filas.filter((f) => f.citasAsignadas !== null && f.citasAsignadas !== undefined);
  const citasAsignadas = conCitas.length ? conCitas.reduce((a, f) => a + f.citasAsignadas, 0) : null;
  const contestadosConCitas = conCitas.reduce((a, f) => a + f.contestados, 0);
  return {
    ingresados, contestados, nivelAtencion: ingresados > 0 ? contestados / ingresados : null,
    citasAsignadas, contestadosConCitas,
    efectividadAgendamiento: citasAsignadas !== null && contestadosConCitas > 0 ? citasAsignadas / contestadosConCitas : null,
    mesesSinCitas: filas.filter((f) => f.citasAsignadas === null || f.citasAsignadas === undefined).map((f) => f.mes),
  };
}

module.exports = { totalTraficoPorMes, totalTraficoSuma };
