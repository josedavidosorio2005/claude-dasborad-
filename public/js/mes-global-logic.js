// mes-global-logic.js — InConexion Platform (Fase 86, tema 3).
//
// Logica pura compartida por el selector "MES" de arriba (_gd.mesSel,
// dashboard-generic.js) y los 5 paneles autonomos que se sincronizan con
// el (Trafico Llamadas/WhatsApp, Agendas, Tipificacion, Calidad): que tipos
// de panel son "autonomos" (tienen su propia ventana de tiempo, por eso
// "Comparar contra" no les aplica) y como calcular el ultimo dia de un mes
// arbitrario para deslizar la ventana movil de 12 meses de Trafico/Calidad.
//
// Doble modo: global en el navegador, require() en Node para las pruebas.
'use strict';

// Tipos de panel con su PROPIA ventana de tiempo (no calculan un "periodo
// anterior" como los paneles de resumen -- kpi_row/line/bar/pie/combo/
// tabla/nota_kpi, todos via _gdResolverComp). Si un cliente futuro suma un
// tipo de panel autonomo nuevo y se olvida agregarlo aqui, "Comparar
// contra" quedaria visible donde no aplica -- ver la prueba de lista
// cerrada en mes-global-logic.test.js.
var GD_TIPOS_AUTONOMOS = ['trafico_combo', 'trafico_whatsapp_combo', 'agendas_panel', 'tipificacion_panel', 'calidad_kpis', 'calidad_pie'];

// true si TODOS los paneles visibles (de la pestana o sub-pestana activa)
// son de tipo autonomo -- en ese caso "Comparar contra" se esconde y se
// muestra una nota discreta en su lugar (dashboard-generic.js,
// _gdActualizarCompararContra). Una lista vacia nunca cuenta como "todos
// autonomos" (no hay nada que esconder).
function gdTodosAutonomos(panelesVisibles) {
  var lista = panelesVisibles || [];
  if (!lista.length) return false;
  return lista.every(function (p) { return GD_TIPOS_AUTONOMOS.indexOf(p && p.tipo) !== -1; });
}

// Ultimo dia de un mes ('AAAA-MM' -> 'AAAA-MM-DD') -- usado por las 3
// pestanas de TENDENCIA (Trafico Llamadas/WhatsApp, Calidad) al
// sincronizarse con el selector MES de arriba: el mes elegido se vuelve el
// FIN de la ventana movil de 12 meses (se mantiene el diseno de tendencia
// de la Fase 68, solo cambia donde termina).
function gdFinDeMes(mesStr) {
  var y = parseInt(mesStr.slice(0, 4), 10), m = parseInt(mesStr.slice(5, 7), 10);
  var ultimoDia = new Date(Date.UTC(y, m, 0)).getUTCDate(); // dia 0 del mes siguiente = ultimo del actual
  return mesStr + '-' + String(ultimoDia).padStart(2, '0');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    GD_TIPOS_AUTONOMOS: GD_TIPOS_AUTONOMOS,
    gdTodosAutonomos: gdTodosAutonomos,
    gdFinDeMes: gdFinDeMes,
  };
}
