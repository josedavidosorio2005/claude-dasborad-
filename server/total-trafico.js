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
'use strict';

const { salidaCombinadaPorMes } = require('./salida-cdr');

function totalTraficoPorMes(db, campana) {
  const porMes = (sql) => new Map(db.prepare(sql).all(campana).map((r) => [r.mes, r]));
  const llam = porMes('SELECT substr(fecha,1,7) AS mes, SUM(totalLlamadas) AS ing, SUM(contestadas) AS con FROM calidad_nivel_servicio_diario WHERE campana = ? GROUP BY mes');
  const wpp = porMes('SELECT substr(fechaInicio,1,7) AS mes, SUM(totalWhatsapp) AS ing, SUM(contestados) AS con FROM trafico_whatsapp WHERE campana = ? GROUP BY mes');
  const sal = new Map(salidaCombinadaPorMes(db, campana).map((f) => [f.mes, f]));
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
    return {
      mes,
      llamadasEntrada, llamadasContestadas, whatsappEntrada, whatsappContestados, llamadasSalida, whatsappSalida,
      ingresados, contestados,
      nivelAtencion: ingresados > 0 ? contestados / ingresados : null,
    };
  });
}

// Suma de varios meses (las tarjetas, con MESES): totales sumados, nunca el
// promedio de los porcentajes.
function totalTraficoSuma(filas) {
  const ingresados = filas.reduce((a, f) => a + f.ingresados, 0);
  const contestados = filas.reduce((a, f) => a + f.contestados, 0);
  return { ingresados, contestados, nivelAtencion: ingresados > 0 ? contestados / ingresados : null };
}

module.exports = { totalTraficoPorMes, totalTraficoSuma };
