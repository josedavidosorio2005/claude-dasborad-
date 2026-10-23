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
var GD_TIPOS_AUTONOMOS = ['trafico_combo', 'trafico_whatsapp_combo', 'agendas_panel', 'efectividad_agendamiento_panel', 'inasistencia_panel', 'efectividad_citas_panel', 'tipificacion_panel', 'salida_panel', 'calidad_kpis', 'calidad_pie', 'calidad_bar_asesores', 'llamadas_unicas_panel', 'encuesta_panel'];

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

// Fase 145 (pedido de Edwin): el aviso amarillo "Este dashboard todavia no
// tiene datos cargados" (renderGenericBanner, dashboard-generic.js) solo
// mira las cargas GENERICAS (_gd.cargas) -- Mobilize usa solo paneles
// autonomos (Trafico, Llamadas Unicas/Salida, Tipificacion, Calidad), que
// leen sus propios datos y ya traen su aviso de "sin datos", asi que el
// aviso salia aunque si habia datos. Ahora solo sale si el dashboard tiene
// algo que DEPENDE de las cargas genericas (tarjetas KPI de arriba o algun
// panel no autonomo, en cualquier pestana, incluso oculta) y no hay
// ninguna carga.
function gdDependeDeCargasGenericas(layout) {
  var l = layout || {};
  if ((l.kpis || []).length) return true;
  return (l.tabs || []).some(function (t) {
    return ((t && t.panels) || []).some(function (p) { return GD_TIPOS_AUTONOMOS.indexOf(p && p.tipo) === -1; });
  });
}
function gdMostrarAvisoSinCargas(layout, hayCargas) {
  return !hayCargas && gdDependeDeCargasGenericas(layout);
}

// Fase 153 (P3, Clinica Aurora): un cliente creado desde la plantilla trae
// TODAS sus pestanas ocultas. Las de Agendas/Inasistencia/Citas/Salida/
// Tipificacion ya se destapaban solas al tener datos; esto hace lo mismo
// con cualquier pestana que tenga un panel de `tipo` para esa campana
// (Flujo de Llamadas/WhatsApp). Solo en memoria, nunca se guarda. A ORLANT
// y MOBILIZE no les cambia nada: esas pestanas ya estan visibles.
function gdDestaparPorDatos(layout, tipo, campana) {
  var n = 0;
  ((layout && layout.tabs) || []).forEach(function (t) {
    var tiene = ((t && t.panels) || []).some(function (p) { return p && p.tipo === tipo && p.campana === campana; });
    if (tiene && t.oculta) { t.oculta = false; n++; }
  });
  return n;
}

// true si el dashboard tiene pestanas pero ninguna visible (cliente nuevo
// sin datos todavia): el tablero muestra un aviso en vez de quedar en blanco.
function gdTodasLasPestanasOcultas(layout) {
  var tabs = (layout && layout.tabs) || [];
  return tabs.length > 0 && tabs.every(function (t) { return t && t.oculta; });
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

// Fase 90 (tema B, hallazgo real: el selector "MES" de arriba solo miraba
// dashboard_cargas -- Agendas/Tipificacion/Trafico Llamadas/Trafico
// WhatsApp/Calidad viven en sus PROPIAS tablas, nunca ahi, asi que la
// lista de meses podia faltarle meses enteros y el mes por defecto podia
// caer en uno que ni siquiera fuera una opcion del selector).
//
// gdMesesUnion(listasDeMeses): listasDeMeses es un array de arrays de
// valores 'AAAA-MM' o 'AAAA-MM-DD' (se recorta a los primeros 7
// caracteres) -- devuelve la UNION, sin duplicados, ordenada de mas
// reciente a mas antiguo. Cualquier valor vacio/invalido se ignora.
function gdMesesUnion(listasDeMeses) {
  var set = {};
  (listasDeMeses || []).forEach(function (lista) {
    (lista || []).forEach(function (v) {
      if (!v || typeof v !== 'string' || v.length < 7) return;
      set[v.slice(0, 7)] = true;
    });
  });
  return Object.keys(set).sort().reverse();
}

// gdMesPorDefecto(mesesPrincipales, mesesTodos): el mes por defecto al
// abrir el dashboard es el MAS RECIENTE con datos de Trafico de Llamadas
// o Tipificacion (los datos mensuales PRINCIPALES, `mesesPrincipales` --
// ya la union de los 2, ordenada de mas reciente a mas antiguo). Si el
// cliente no tiene ninguno de esos, el mes mas reciente con CUALQUIER
// dato (`mesesTodos`). Nunca un mes que no este en `mesesTodos` -- eso
// evitaria que el selector (que solo ofrece `mesesTodos` como opciones)
// quedara en blanco por un mes "fantasma" que ni siquiera es una opcion.
function gdMesPorDefecto(mesesPrincipales, mesesTodos) {
  var todos = mesesTodos || [];
  var principales = mesesPrincipales || [];
  if (principales.length && todos.indexOf(principales[0]) !== -1) return principales[0];
  return todos[0] || '';
}

// ── Fase 152 (B3): mes en curso = parcial ───────────────────
// `hoy` es 'AAAA-MM-DD' (fecha local de quien mira; la app se usa en
// Colombia). Un mes que todavia no termina se marca "parcial" y sus
// tarjetas no se comparan contra el mes anterior.
function gdMesActual(hoy) {
  var m = /^(\d{4})-(\d{2})/.exec(String(hoy || ''));
  return m ? m[1] + '-' + m[2] : '';
}
function gdEsMesEnCurso(mes, hoy) {
  return !!mes && mes === gdMesActual(hoy);
}
// Mes anterior de 'AAAA-MM' ('2026-01' -> '2025-12').
function gdMesAnterior(mes) {
  var m = /^(\d{4})-(\d{2})$/.exec(String(mes || ''));
  if (!m) return '';
  var a = parseInt(m[1], 10);
  var n = parseInt(m[2], 10) - 1;
  if (n === 0) { a -= 1; n = 12; }
  return a + '-' + (n < 10 ? '0' + n : '' + n);
}
// Si el rango [desde, hasta] (AAAA-MM-DD) es exactamente UN mes calendario
// (del dia 1 al ultimo dia, o del 1 en adelante si es el mes en curso),
// devuelve 'AAAA-MM'; si no, ''. Solo entonces tiene sentido "vs. mes
// anterior".
function gdMesDelRango(desde, hasta, hoy) {
  var d = /^(\d{4}-\d{2})-01$/.exec(String(desde || ''));
  if (!d || String(hasta || '').slice(0, 7) !== d[1]) return '';
  if (String(hasta) === gdFinDeMes(d[1])) return d[1];
  return gdEsMesEnCurso(d[1], hoy) ? d[1] : '';
}
// Rotulo del mes en curso: 'Septiembre 2026 — parcial, hasta el día 15'
// (ultimoDia = ultimo dia con datos, cuando la fuente es diaria) o
// 'Septiembre 2026 — mes en curso, parcial' (fuente mensual o sin dia).
// '' si el mes ya cerro. `nombreMes` = mesNombreLargo (mes-nombre-logic.js).
function gdRotuloMesParcial(mes, hoy, ultimoDia, nombreMes) {
  if (!gdEsMesEnCurso(mes, hoy)) return '';
  var nombre = typeof nombreMes === 'function' ? nombreMes(mes) : mes;
  var dia = /^\d{4}-\d{2}-(\d{2})$/.exec(String(ultimoDia || ''));
  if (dia && String(ultimoDia).slice(0, 7) === mes) return nombre + ' — parcial, hasta el día ' + parseInt(dia[1], 10);
  return nombre + ' — mes en curso, parcial';
}
// Fecha local 'AAAA-MM-DD' de un Date (por defecto, ahora).
function gdHoyLocal(fecha) {
  var f = fecha || new Date();
  var mm = f.getMonth() + 1;
  var dd = f.getDate();
  return f.getFullYear() + '-' + (mm < 10 ? '0' + mm : mm) + '-' + (dd < 10 ? '0' + dd : dd);
}

// Fase 167 (pedido de Edwin): filtro "Meses" del tablero -- elegir varios
// meses sueltos (ej. septiembre y octubre, sin agosto) para VER LADO A LADO
// en las graficas y tablas que van por mes. No suma meses ni cambia el MES
// de arriba (tarjetas, comparacion). mesesSel vacio = todos los meses.
// getMes(item) puede devolver 'AAAA-MM' o 'AAAA-MM-DD' (se mira el mes).
function gdFiltrarPorMes(lista, getMes, mesesSel) {
  var arr = lista || [];
  if (!mesesSel || !mesesSel.length) return arr;
  var elegidos = {};
  mesesSel.forEach(function (m) { elegidos[String(m).slice(0, 7)] = true; });
  return arr.filter(function (x) { return !!elegidos[String(getMes(x) == null ? '' : getMes(x)).slice(0, 7)]; });
}

// Lo usan los modulos de panel: aplica el filtro "Meses" del tablero abierto
// (_gd.mesesSel, dashboard-generic.js); sin tablero, la lista tal cual.
function gdAplicarFiltroMeses(lista, getMes) {
  var sel = (typeof _gd !== 'undefined' && _gd && _gd.mesesSel) || [];
  return gdFiltrarPorMes(lista, getMes, sel);
}

// Texto del boton "Meses": "Todos" o los meses elegidos en orden, con el
// nombre corto (nombreMes('2026-09') -> 'Septiembre 2026' -> 'Sep 2026').
function gdMesesTexto(mesesSel, nombreMes) {
  if (!mesesSel || !mesesSel.length) return 'Todos';
  return mesesSel.slice().sort().map(function (m) {
    var n = nombreMes ? String(nombreMes(m)) : m;
    var partes = n.split(' ');
    return partes.length === 2 ? partes[0].slice(0, 3) + ' ' + partes[1] : n;
  }).join(', ');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    gdFiltrarPorMes: gdFiltrarPorMes,
    gdMesesTexto: gdMesesTexto,
    gdAplicarFiltroMeses: gdAplicarFiltroMeses,
    gdMesActual: gdMesActual,
    gdEsMesEnCurso: gdEsMesEnCurso,
    gdMesAnterior: gdMesAnterior,
    gdMesDelRango: gdMesDelRango,
    gdRotuloMesParcial: gdRotuloMesParcial,
    gdHoyLocal: gdHoyLocal,
    GD_TIPOS_AUTONOMOS: GD_TIPOS_AUTONOMOS,
    gdTodosAutonomos: gdTodosAutonomos,
    gdFinDeMes: gdFinDeMes,
    gdMesesUnion: gdMesesUnion,
    gdMesPorDefecto: gdMesPorDefecto,
    gdDependeDeCargasGenericas: gdDependeDeCargasGenericas,
    gdDestaparPorDatos: gdDestaparPorDatos,
    gdTodasLasPestanasOcultas: gdTodasLasPestanasOcultas,
    gdMostrarAvisoSinCargas: gdMostrarAvisoSinCargas,
  };
}
