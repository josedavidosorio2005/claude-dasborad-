// mes-global-logic.js — InConexion Platform (Fase 86, tema 3).
//
// Logica pura compartida por el selector "MES" de arriba (Fase 207: hoy MESES, antes _gd.mesSel;
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
var GD_TIPOS_AUTONOMOS = ['trafico_combo', 'trafico_whatsapp_combo', 'agendas_panel', 'efectividad_agendamiento_panel', 'inasistencia_panel', 'efectividad_citas_panel', 'tipificacion_panel', 'salida_panel', 'calidad_kpis', 'calidad_pie', 'calidad_bar_asesores', 'llamadas_unicas_panel', 'encuesta_panel', 'calidad_resumen_panel', 'flujo_hora_panel'];

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

// ── Fase 201: el MES de las tarjetas sale de MESES ───────────
// Ya no hay selector MES en el encabezado. El mes que siguen las tarjetas y
// los paneles que trabajan con un solo mes (antes "el MES de arriba") es el
// ULTIMO mes marcado en MESES; sin ninguno marcado ("Todos"), el mes por
// defecto de siempre (gdMesPorDefecto: el mas reciente con datos
// principales). Nunca un mes que no este en `mesesTodos`.
function gdMesDeMeses(mesesSel, porDefecto, mesesTodos) {
  var todos = mesesTodos || [];
  var marcados = (mesesSel || []).filter(function (m) { return todos.indexOf(m) !== -1; }).sort();
  return marcados.length ? marcados[marcados.length - 1] : (porDefecto || '');
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

// Fase 203 (pedido de Edwin, audios del 27 y 28/10): las tarjetas de resumen
// obedecen SOLO a MESES. Suman los meses marcados; sin ninguno ("Todos"),
// todos los meses con datos -- nunca un "mes actual" ni el mes por defecto.
// Devuelve los meses en orden ascendente ('AAAA-MM').
function gdMesesTarjetas(mesesSel, mesesTodos) {
  var todos = (mesesTodos || []).map(function (m) { return String(m).slice(0, 7); });
  var marcados = (mesesSel || []).map(function (m) { return String(m).slice(0, 7); })
    .filter(function (m) { return todos.indexOf(m) !== -1; });
  var lista = marcados.length ? marcados : todos;
  return lista.filter(function (m, k) { return lista.indexOf(m) === k; }).sort();
}
// Rango de fechas que cubre esos meses: del 1 del primero al ultimo dia del ultimo.
function gdRangoDeMeses(meses) {
  var l = (meses || []).slice().sort();
  if (!l.length) return { desde: '', hasta: '' };
  return { desde: l[0] + '-01', hasta: gdFinDeMes(l[l.length - 1]) };
}
// Suma `campos` de las filas de `lista` cuyo mes esta en `meses` (numerador y
// denominador sumados, nunca promedio de porcentajes). Un campo null en alguna
// fila incluida queda null (ej. "Pendiente" de la salida). `filas` = cuantas.
function gdSumarMeses(lista, getMes, meses, campos) {
  var set = {};
  (meses || []).forEach(function (m) { set[String(m).slice(0, 7)] = true; });
  var out = { filas: 0 };
  (campos || []).forEach(function (c) { out[c] = 0; });
  (lista || []).forEach(function (x) {
    if (!set[String(getMes(x) == null ? '' : getMes(x)).slice(0, 7)]) return;
    out.filas++;
    (campos || []).forEach(function (c) {
      if (out[c] === null) return;
      out[c] = (x[c] === null || x[c] === undefined) ? null : out[c] + Number(x[c] || 0);
    });
  });
  return out;
}
// Texto de los meses de las tarjetas: "Septiembre 2026" (uno marcado), "Ago
// 2026, Sep 2026" (varios) o "Todos los meses (Ago 2026 – Oct 2026)".
function gdMesesTarjetasTexto(meses, esTodos, nombreMes) {
  var l = (meses || []).slice().sort();
  if (!l.length) return 'Sin datos';
  var largo = function (m) { return nombreMes ? String(nombreMes(m)) : m; };
  if (esTodos) {
    return 'Todos los meses (' + (l.length === 1 ? largo(l[0])
      : gdMesesTexto([l[0]], nombreMes) + ' – ' + gdMesesTexto([l[l.length - 1]], nombreMes)) + ')';
  }
  return l.length === 1 ? largo(l[0]) : gdMesesTexto(l, nombreMes);
}
// Fase 207: lista CERRADA de tipos de panel que siguen a MESES (todas las
// campañas, y las que se creen despues, heredan esto porque usan estos
// mismos tipos). Un tipo de panel nuevo tiene que entrar aqui y leer
// gdMesesTarjetasActual()/gdRangoTarjetasActual() -- la prueba
// fase207-meses-todas-campanas.test.js falla si _gdRenderPanel dibuja un
// tipo que no esta en esta lista, o si algun modulo vuelve a leer un "mes
// de las tarjetas" (_gd.mesSel) o el "ultimo mes" por defecto.
var GD_TIPOS_SIGUEN_MESES = ['kpi_row', 'line', 'bar', 'area', 'pie', 'combo', 'tabla', 'nota_kpi',
  'trafico_combo', 'trafico_whatsapp_combo', 'agendas_panel', 'efectividad_agendamiento_panel', 'inasistencia_panel',
  'efectividad_citas_panel', 'tipificacion_panel', 'salida_panel', 'calidad_kpis', 'calidad_pie', 'calidad_bar_asesores',
  'llamadas_unicas_panel', 'encuesta_panel', 'calidad_resumen_panel', 'flujo_hora_panel'];

// En el navegador: meses de las tarjetas del tablero abierto.
function gdMesesTarjetasActual() {
  if (typeof _gd === 'undefined' || !_gd) return [];
  return gdMesesTarjetas(_gd.mesesSel, _gd.periodos);
}
// Fase 207 (todas las campañas): rango Desde/Hasta de esos meses.
function gdRangoTarjetasActual() {
  return gdRangoDeMeses(gdMesesTarjetasActual());
}
// Fase 207: el mes si hay EXACTAMENTE uno marcado en MESES ('' con Todos o
// con varios). Solo para lo que compara contra el mes anterior ("vs.
// agosto", "Comparar contra") o lo que no se puede sumar entre meses.
function gdMesUnicoMarcado(mesesSel) {
  var sel = mesesSel !== undefined ? mesesSel : ((typeof _gd !== 'undefined' && _gd && _gd.mesesSel) || []);
  return sel.length === 1 ? String(sel[0]).slice(0, 7) : '';
}
// Fase 207: "parcial" si el mes en curso esta entre los meses de las
// tarjetas: "Octubre 2026 — mes en curso, parcial" (uno) o "Oct 2026 parcial".
function gdRotuloParcialMeses(meses, hoy, nombreMes) {
  var actual = gdMesActual(hoy);
  if (!actual || (meses || []).indexOf(actual) === -1) return '';
  if (meses.length === 1) return gdRotuloMesParcial(actual, hoy, null, nombreMes);
  return gdMesesTexto([actual], nombreMes) + ' parcial';
}
// Fase 207: filas de varias cargas agrupadas por categoria (`xk`): un campo
// se suma; una formula (a/b*100, a+b, a-b) suma sus dos terminos y luego se
// calcula. Devuelve filas nuevas { [xk]: categoria, ...campos sumados }.
function gdAgruparFilasPorCategoria(filas, xk, f) {
  var orden = [], por = {};
  var campos = f && f.formula ? [f.a, f.b] : [f && f.campo];
  (filas || []).forEach(function (r) {
    var k = r[xk];
    if (k === undefined || k === null || k === '') return;
    if (!por[k]) { por[k] = {}; por[k][xk] = k; campos.forEach(function (c) { por[k][c] = null; }); orden.push(k); }
    campos.forEach(function (c) {
      var v = r[c];
      if (v === null || v === undefined || v === '') return;
      por[k][c] = (por[k][c] || 0) + (Number(String(v).replace(',', '.')) || 0);
    });
  });
  return orden.map(function (k) { return por[k]; });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    gdMesesTarjetas: gdMesesTarjetas,
    gdRangoDeMeses: gdRangoDeMeses,
    gdSumarMeses: gdSumarMeses,
    gdMesesTarjetasTexto: gdMesesTarjetasTexto,
    GD_TIPOS_SIGUEN_MESES: GD_TIPOS_SIGUEN_MESES,
    gdMesesTarjetasActual: gdMesesTarjetasActual,
    gdRangoTarjetasActual: gdRangoTarjetasActual,
    gdMesUnicoMarcado: gdMesUnicoMarcado,
    gdRotuloParcialMeses: gdRotuloParcialMeses,
    gdAgruparFilasPorCategoria: gdAgruparFilasPorCategoria,
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
    gdMesDeMeses: gdMesDeMeses,
    gdDependeDeCargasGenericas: gdDependeDeCargasGenericas,
    gdDestaparPorDatos: gdDestaparPorDatos,
    gdTodasLasPestanasOcultas: gdTodasLasPestanasOcultas,
    gdMostrarAvisoSinCargas: gdMostrarAvisoSinCargas,
  };
}
