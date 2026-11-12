// charts.js — InConexion Platform.
// Helpers de Chart.js (paleta + opciones base) compartidos por el dashboard
// generico (dashboard-generic.js), el modulo de Calidad y el portal Asesor.
// Se carga como <script src> global y en orden. No cambiar el orden de carga.

// Fase 87 (tema C, "unificar tipo de letra"): sin esto, Chart.js dibuja
// ejes/leyendas/etiquetas de dato con su propia fuente por defecto
// ('Helvetica Neue'/Arial), distinta de la que usa el resto de la interfaz
// (--font-sans en styles.css). TEXTO_FUENTE (texto-formato-logic.js, se
// carga antes que este archivo) es la fuente unica del mismo valor para los
// dos -- cambiar la tipografia del dashboard es cambiar TEXTO_FUENTE ahi Y
// --font-sans en styles.css (Chart.js no puede leer una variable CSS).
// Fase 147 (pedido de Edwin, reunion 14/10: "las fechas con nombre, no con
// numero"): toda grafica con etiquetas AAAA-MM o AAAA-MM-DD las muestra como
// "Septiembre 2026" / "15 sep" (periodoLegible, mes-nombre-logic.js) en el
// eje y en el tooltip. Solo cambia lo que se VE: los datos, los filtros y las
// exportaciones siguen con AAAA-MM. Un solo lugar para Mobilize y ORLANT.
var CHART_RE_PERIODO = /^\d{4}-\d{2}(-\d{2})?$/;
function chartEtiquetasLegibles(labels) {
  if (!Array.isArray(labels) || typeof periodoLegible !== 'function') return labels;
  return labels.map(function (l) { return (typeof l === 'string' && CHART_RE_PERIODO.test(l)) ? periodoLegible(l) : l; });
}
if (typeof Chart !== 'undefined' && typeof Chart.register === 'function') {
  Chart.register({
    id: 'periodoLegible',
    beforeUpdate: function (chart) {
      if (chart && chart.data && Array.isArray(chart.data.labels)) chart.data.labels = chartEtiquetasLegibles(chart.data.labels);
    },
  });
}
if (typeof Chart !== 'undefined') {
  // Fase 268 (revision del 05/11): los ejes con el mismo formato de numero que
  // las tarjetas ("1.000", no "1,000"). Sin esto Chart.js usa el idioma del
  // navegador (en-US en muchos equipos) para las marcas de los ejes.
  Chart.defaults.locale = 'es-CO';
  Chart.defaults.font.family = (typeof TEXTO_FUENTE !== 'undefined') ? TEXTO_FUENTE : "'Segoe UI', system-ui, -apple-system, Roboto, sans-serif";
  // Fase 136 (PR 6, F03): hallazgo real de la auditoria de la Fase 135 --
  // 0 modulos configuraban animation en ningun `new Chart(...)`, asi que
  // cada grafica usaba el default de Chart.js (~1000ms, easeOutQuart).
  // En esta app TODA grafica se crea con `new Chart(...)` fresco --
  // nunca `.update()` sobre una instancia existente (renderGenericTab,
  // dashboard-generic.js, siempre hace `.destroy()` + recrea) -- asi que
  // ese default de 1000ms se repetia en CADA cambio de mes/filtro/tema,
  // no solo la primera vez que se abre un dashboard. 200ms (--dur-medium
  // en CSS, mismo valor que la transicion de pestanas del PR 6) es lo
  // bastante corto para no sentirse como demora al cambiar de mes/filtro
  // (la regla de "nada que retrase ver un numero", Paso 4 de la
  // auditoria) y lo bastante presente para que una grafica nueva no
  // aparezca de golpe. Config CENTRAL -- un solo lugar para los ~20
  // `new Chart(...)` de toda la app (dashboard-generic.js, calidad.js,
  // charts.js), ninguno la sobreescribe hoy. Respeta prefers-reduced-
  // motion/data-motion="off" -- Chart.js dibuja en <canvas>, la regla
  // CSS global de apagado (styles.css) NO lo alcanza (no es transition/
  // animation CSS), asi que se chequea aqui aparte. Limite conocido:
  // esto se lee UNA vez al cargar la pagina -- si alguien cambia
  // data-motion a mano a mitad de sesion (sin recargar), los charts que
  // ya existen no se enteran hasta el proximo refresco de pagina.
  var _reducirMovimiento = false;
  try {
    _reducirMovimiento = document.documentElement.getAttribute('data-motion') === 'off' ||
      (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  } catch (e) {}
  Chart.defaults.animation.duration = _reducirMovimiento ? 0 : 200;
}

// Fase 133: CG/CO/CR = semaforo (cumple / cerca / no cumple). Solo para ESTADOS: nunca son
// una serie. Contraste >= 3:1 contra las superficies (objeto grafico, WCAG 1.4.11).
var CG='#1f9d55',CR='#e74c3c',CO='#c26a00';

// Fase 345: la PALETA (series y tonos de texto) vive en UN solo archivo, public/css/paleta.css
// (paleta 3 «Segura para daltonismo», elegida el 12/11/2026). Aqui no hay ningun color de serie
// escrito: aplicarTemaCharts() la lee de las variables CSS del tema actual.
//   PC        = series 1..12, en ese orden en toda la plataforma (paletaColorPara elige el
//               INDICE por la etiqueta; el color de cada indice sale de aqui).
//   PC_EXTRA  = series 13..20, solo tortas de mas de 12 porciones (Tipificacion).
//   CD/CM/CP  = series 1/2/3 (los usan graficas viejas por nombre: mismo orden de la paleta).
//   SERIE_*   = roles de colorSerie(): principal 1, secundaria 2, linea 3, no conectada 4.
//   PALETA_TEXTO = tono para TEXTO de cada serie base (>= 4,5:1): ver colorTextoSerie().
var PC=[], PC_EXTRA=[], PALETA_TEXTO=[], CD, CM, CP;
var SERIE_PRINCIPAL, SERIE_SECUNDARIA, SERIE_SECUNDARIA_BORDE=null, SERIE_LINEA, SERIE_NO_CONECTADA;
var PALETA_RESPALDO=['#0072B2']; // solo si paleta.css no cargo (nunca deberia pasar)
function _paletaDeCss(){
  try{
    var cs=getComputedStyle(document.documentElement), s=[], t=[];
    for(var i=1;i<=20;i++){ var v=cs.getPropertyValue('--serie-'+i).trim(); if(!v) return null; s.push(v); }
    for(var j=1;j<=6;j++) t.push(cs.getPropertyValue('--serie-texto-'+j).trim() || s[j-1]);
    return { series:s, texto:t };
  }catch(e){ return null; }
}

// Colores de eje/leyenda/fondo-de-datalabel -- reasignables por tema.
var CHART_GRID='#f0f4f8', CHART_TICK='#4f6f7d', CHART_DL_BG='rgba(255,255,255,0.75)';

// Puente con theme.js: reasigna la paleta (desde paleta.css) y el semaforo segun el tema
// actual. El resto de los archivos leen estas variables por NOMBRE al construir cada grafico.
// theme.js llama a esta funcion al cargar la pagina y en cada cambio de tema.
function aplicarTemaCharts(){
  var oscuro = typeof temaActual === 'function' && temaActual() === 'dark';
  var p = _paletaDeCss() || { series: PALETA_RESPALDO.slice(), texto: PALETA_RESPALDO.slice() };
  var sv = function(i){ return p.series[i] || p.series[0]; };
  PC = p.series.slice(0, 12); PC_EXTRA = p.series.slice(12, 20); PALETA_TEXTO = p.texto.slice();
  CD = sv(0); CM = sv(1); CP = sv(2);
  SERIE_PRINCIPAL = sv(0); SERIE_SECUNDARIA = sv(1); SERIE_SECUNDARIA_BORDE = null; SERIE_LINEA = sv(2); SERIE_NO_CONECTADA = sv(3);
  if(oscuro){
    CG='#4ade80'; CR='#f87171'; CO='#fbbf24';
    CHART_GRID='#23414c'; CHART_TICK='#8fb4bf'; CHART_DL_BG='rgba(19,44,53,0.78)';
  } else {
    CG='#1f9d55'; CR='#e74c3c'; CO='#c26a00';
    CHART_GRID='#f0f4f8'; CHART_TICK='#4f6f7d'; CHART_DL_BG='rgba(255,255,255,0.75)';
  }
  // Fase 214: el color por defecto de Chart.js (#666) sigue al tema.
  if(typeof Chart !== 'undefined' && Chart.defaults) Chart.defaults.color = CHART_TICK;
}
// Fase 214: las leyendas con generateLabels propio deben poner el color del texto.
function leyendaColorTexto(){ return CHART_TICK; }
// Fase 345: color para TEXTO (etiquetas de datos) de una serie. Si la serie ya llega a 4,5:1
// contra la tarjeta del tema se usa tal cual; si es una de las 6 base, su --serie-texto-N; si no,
// el color de los ejes. Asi el rosa del tema claro y el violeta del oscuro nunca quedan como texto.
function colorTextoSerie(hex){
  if(!hex || typeof hex !== 'string') return CHART_TICK;
  var fondo = (typeof temaActual === 'function' && temaActual() === 'dark') ? '#132c35' : '#ffffff';
  try{ if(typeof contrasteRazon === 'function' && contrasteRazon(hex, fondo) >= 4.5) return hex; }catch(e){}
  var i = PC.map(function(c){ return String(c).toUpperCase(); }).indexOf(hex.toUpperCase());
  if(i >= 0 && i < 6 && PALETA_TEXTO[i]) return PALETA_TEXTO[i];
  return CHART_TICK;
}
aplicarTemaCharts();

// Fase 152 (B1), Fase 345: color de SERIE por rol, siempre de la paleta (paleta.css) y en su
// orden: 'principal' = serie 1, 'secundaria' = serie 2, 'linea' = serie 3, 'noConectada' = serie 4.
// Nunca CG/CO/CR (semaforo, solo estados). Todas llegan a 3:1 contra la tarjeta: ya no hace falta
// el borde de la barra secundaria (estiloBarraSecundaria lo pone solo si SERIE_SECUNDARIA_BORDE).
// Medido en server/tests/fase345-paleta.test.js.
function colorSerie(rol){
  if(rol === 'secundaria') return SERIE_SECUNDARIA;
  if(rol === 'linea') return SERIE_LINEA;
  if(rol === 'noConectada') return SERIE_NO_CONECTADA;
  return SERIE_PRINCIPAL;
}
// Propiedades de una barra de la serie secundaria (relleno + borde de
// contraste en claro). Se mezclan en el dataset: Object.assign({...}, ...).
function estiloBarraSecundaria(){
  return SERIE_SECUNDARIA_BORDE
    ? { backgroundColor: SERIE_SECUNDARIA, borderColor: SERIE_SECUNDARIA_BORDE, borderWidth: 1 }
    : { backgroundColor: SERIE_SECUNDARIA, borderWidth: 0 };
}

// Fase 152 (B1): linea de meta punteada (dataset de linea, sin plugins
// nuevos). `valor` sale de un umbral configurado (pantalla Umbrales); sin
// umbral no se dibuja. Sin etiquetas de datos ni tooltip propio (el
// texto "Meta 90 %" va en la leyenda).
function datasetMeta(valor, etiqueta, n, yAxisID){
  return {
    type: 'line', label: etiqueta, esMeta: true,
    data: Array.apply(null, Array(n)).map(function(){ return valor; }),
    borderColor: CHART_TICK, backgroundColor: CHART_TICK, borderDash: [6, 4], borderWidth: 1.5,
    pointRadius: 0, pointHoverRadius: 0, fill: false, tension: 0, yAxisID: yAxisID || 'y',
    datalabels: { display: false }, order: 99,
  };
}
// Agrega la linea de meta (si hay umbral) y saca la meta del tooltip.
// unidad: ' %' u otra, solo para el texto de la leyenda.
function agregarLineaMeta(datasets, opciones, umbral, n, yAxisID, unidad){
  if(!umbral || umbral.verde === null || umbral.verde === undefined || !n) return;
  // Sin ningun dato real, la grafica debe seguir viendose "sin datos": la
  // meta sola no cuenta como dato.
  var hayDatos = datasets.some(function(d){ return (d.data || []).some(function(v){ return v !== null && v !== undefined; }); });
  if(!hayDatos) return;
  var menor = umbral.direccion === 'menor_es_mejor';
  var txt = (menor ? 'Meta máx. ' : 'Meta ') + String(umbral.verde).replace('.', ',') + (unidad || '');
  datasets.push(datasetMeta(Number(umbral.verde), txt, n, yAxisID));
  opciones.plugins = opciones.plugins || {};
  opciones.plugins.tooltip = opciones.plugins.tooltip || {};
  opciones.plugins.tooltip.filter = function(item){ return !item.dataset.esMeta; };
}

// Fase 133 (Parte 5, WCAG 1.1.1): un <canvas> es una imagen sin texto
// alternativo por defecto -- un lector de pantalla no anuncia nada de lo
// que dibuja Chart.js. Se llama DESPUES de crear cada Chart (los 3
// `new Chart(...)` de dashboard-generic.js/calidad.js/mis-resultados.js).
// El texto viene del titulo que YA esta visible al lado del canvas (el
// humano y el lector de pantalla terminan sabiendo lo mismo, nunca una
// descripcion inventada aparte) -- primero intenta el titulo del propio
// grafico (plugins.title.text, cuando el grafico lo trae), si no busca el
// encabezado visible mas cercano (.aurora-card-title/.aurora-chart-title
// en el mismo .aurora-card/contenedor), si no cae a un texto generico por
// tipo de grafico. Nunca lanza si falta algo (chart.config puede variar).
function gdEtiquetarCanvasChart(chartInstance){
  try{
    var el = chartInstance && chartInstance.canvas;
    if(!el) return;
    var titulo = null;
    try{ titulo = chartInstance.options && chartInstance.options.plugins && chartInstance.options.plugins.title && chartInstance.options.plugins.title.text; }catch(e){}
    if(!titulo){
      var cont = el.closest('.aurora-card') || el.closest('.aurora-chart-wrap') || el.parentElement;
      var h = cont && cont.querySelector('.aurora-card-title,.aurora-chart-title');
      if(h) titulo = h.textContent;
    }
    var tipoTxt = {bar:'de barras',line:'de lineas',doughnut:'circular',pie:'circular',radar:'de radar'}[chartInstance.config && chartInstance.config.type] || '';
    var label = 'Gráfica' + (tipoTxt?' '+tipoTxt:'') + (titulo?': '+String(titulo).trim():'');
    el.setAttribute('role','img');
    el.setAttribute('aria-label', label);
  }catch(e){}
}

function lo(t,xrot){
  return {responsive:true,maintainAspectRatio:false,
    plugins:{
      legend:{position:'bottom',labels:{font:{size:12},boxWidth:10,padding:6}},
      title:{display:!!t,text:t,font:{size:12,weight:'bold'},color:CD},
      datalabels:{
        display:true, align:'top', anchor:'top', offset:2,
        font:{size:12,weight:'bold'}, color:CD,
        backgroundColor:function(){return CHART_DL_BG;},
        borderRadius:2, padding:{top:1,bottom:1,left:2,right:2},
        formatter:function(v){return v===null||v===undefined?'':v;}
      }
    },
    scales:{
      y:{grid:{color:CHART_GRID},ticks:{font:{size:12},color:CHART_TICK}},
      x:{grid:{display:false},ticks:{font:{size:12},color:CHART_TICK,maxRotation:xrot||50}}
    },
    layout:{padding:{top:20}}
  };
}
// v+'%' sin redondear mostraba ruido de punto flotante (ej.
// "12.000000000002%") en rangos angostos -- gdFmtValor(v,'%') (mas abajo en
// este archivo, hoisted) ya redondea a 1 decimal, mismo criterio que loFmt().
function loPct(t){
  var o=lo(t);
  o.plugins.datalabels.formatter=function(v){return gdFmtValor(v,'%');};
  o.scales.y.ticks.callback=function(v){return gdFmtValor(v,'%');};
  return o;
}
function loPct2(xrot){
  var o=lo(null,xrot);
  o.plugins.datalabels.formatter=function(v){return gdFmtValor(v,'%');};
  o.scales.y.ticks.callback=function(v){return gdFmtValor(v,'%');};
  return o;
}
function loBar(t){ var o=lo(t); o.plugins.datalabels.align='end'; return o; }

// Datalabel "% del total del dataset" — misma formula que ya usa loPie()
// (factorizada aqui para no duplicarla), aplicada a una barra en vez de un
// pie (ej. "Ordenes STA por servicio/estado (año)": cada barra es un % del
// total del año, no solo la cantidad cruda).
function _loPctDeTotal(v, ctx){
  var s = ctx.chart.data.datasets[0].data.reduce(function(a,b){ return a+(b||0); }, 0);
  return s ? Math.round(v/s*100)+' %' : ''; // Fase 152 (B4): "12 %"
}
function loBarPct(t){
  var o=loBar(t);
  o.plugins.datalabels.formatter = _loPctDeTotal;
  return o;
}

// ── Formato legible de valores (miles, %, mm:ss) ────────────
// Se usa en ticks de eje y tooltips para que un dashboard se lea como
// herramienta de BI y no como volcado de numeros crudos.
function gdFmtValor(v, unidad){
  if(v===null || v===undefined || v==='') return '';
  var n = typeof v==='number' ? v : Number(v);
  if(!isFinite(n)) return String(v);
  // Fase 152 (B4): formato es-CO en graficas y tooltips -- coma decimal y
  // espacio antes del % ("95,1 %"), a lo sumo 1 decimal.
  if(unidad==='%') return (Math.round(n*10)/10).toLocaleString('es-CO', { maximumFractionDigits: 1 }) + ' %';
  if(unidad==='tiempo' || unidad==='tiempo_mmss'){ var m=Math.floor(n/60), s=Math.round(n%60); return m+':'+(s<10?'0':'')+s; }
  return Math.round(n*100)/100 === Math.round(n) ? Math.round(n).toLocaleString('es-CO') : (Math.round(n*100)/100).toLocaleString('es-CO');
}

// Fase 152 (cierre): porcentaje en formato es-CO para pantallas que no son
// graficas (Gerencia, Metas, vista previa de cargas): coma decimal, hasta 2
// decimales y espacio antes del % ("12,35 %"). '' si no hay valor.
function gdFmtPctEs(v){
  if(v===null || v===undefined || v==='') return '';
  var n = typeof v==='number' ? v : Number(v);
  if(!isFinite(n)) return String(v);
  return (Math.round(n*100)/100).toLocaleString('es-CO', { maximumFractionDigits: 2 }) + ' %';
}

// Aplica formato de eje Y + tooltip con el valor exacto a unas opciones base.
function loFmt(o, unidad){
  o = o || lo();
  o.plugins = o.plugins || {};
  o.plugins.tooltip = Object.assign({}, o.plugins.tooltip, {
    callbacks: {
      label: function(ctx){
        var lbl = ctx.dataset.label ? ctx.dataset.label + ': ' : '';
        return lbl + gdFmtValor(ctx.parsed.y != null ? ctx.parsed.y : ctx.parsed, unidad);
      }
    }
  });
  if(o.scales && o.scales.y){
    o.scales.y.ticks = o.scales.y.ticks || {};
    o.scales.y.ticks.callback = function(v){ return gdFmtValor(v, unidad); };
  }
  if(o.plugins.datalabels){
    o.plugins.datalabels.formatter = function(v){ return v===null||v===undefined?'':gdFmtValor(v, unidad); };
  }
  return o;
}
// Datalabels con auto-ocultado (Fase 45, pedido de Edwin: "que se vea el
// valor sin pasar el mouse", pero sin amontonarse en graficas con muchos
// puntos, ej. una linea diaria de varios meses de Trafico de Llamadas).
// El plugin vendorizado (chartjs-plugin-datalabels v2.2.0,
// public/js/vendor/) soporta la opcion nativa display:'auto', que oculta
// SOLO las etiquetas que se solaparian entre si (en orden de dataset/punto)
// en vez de mostrarlas todas ilegibles o quitarlas todas -- se adapta solo
// al ancho real del canvas, no a un conteo fijo de puntos que habria que
// ajustar a mano por tipo de grafica. Factorizado aca (no en trafico.js)
// para poder reusarlo en otros modulos sin duplicar el patron.
function loDatalabelsAuto(o, formatter){
  o.plugins = o.plugins || {};
  // Fase 164 (lote 2): si las opciones ya traen un filtro propio (ej. la
  // torta, que esconde las porciones chicas), se respeta y se le suma 'auto'.
  var previo = o.plugins.datalabels && o.plugins.datalabels.display;
  var display = typeof previo === 'function' ? function(ctx){ return previo(ctx) ? 'auto' : false; } : 'auto';
  o.plugins.datalabels = Object.assign({}, o.plugins.datalabels, { display:display });
  if(formatter) o.plugins.datalabels.formatter = formatter;
  return o;
}
// Fase 145 (pedido de Edwin): el % de cada porcion de una torta ya no es
// siempre blanco -- se elige por contraste con el color de ESA porcion
// (contrasteTextoSobreRelleno, contraste-logic.js): texto oscuro sobre
// porciones claras, blanco sobre oscuras, y un contorno fino del otro color
// solo si ninguno de los dos llega a 4.5:1. CHART_DL_OSCURO = --c-bg del
// tema oscuro (#0a1e25), el tono mas oscuro del sistema: es el que mas
// porciones deja en >=4.5:1 (con --c-text #2a4a58 casi ninguna llegaba).
// La paleta y la torta no cambian.
var CHART_DL_OSCURO='#0a1e25';
function _loPieDlEleccion(ctx){
  var bg = ctx && ctx.dataset ? ctx.dataset.backgroundColor : null;
  var relleno = Array.isArray(bg) ? bg[ctx.dataIndex] : bg;
  if(typeof contrasteTextoSobreRelleno !== 'function') return { color:'#fff', halo:null };
  return contrasteTextoSobreRelleno(relleno, CHART_DL_OSCURO, '#ffffff');
}
function _loPieDlColor(ctx){ return _loPieDlEleccion(ctx).color; }
function _loPieDlHalo(ctx){ return _loPieDlEleccion(ctx).halo || 'transparent'; }
function _loPieDlHaloAncho(ctx){ return _loPieDlEleccion(ctx).halo ? 3 : 0; }
// Fase 164 (lote 2, visto en produccion a 375 px): las porciones de menos del
// 5 % del total no llevan su "%" encima -- en una torta de 11 porciones las
// de 3-5 % montaban sus etiquetas unas sobre otras. Las demas van con
// 'auto' (el plugin esconde la que choque con otra), asi nunca se montan.
// El dato sigue en la leyenda, el tooltip y la tabla ("Ver datos").
var PIE_ETIQUETA_MIN_PCT = 5;
function loPieMostrarEtiqueta(valor, datos){
  var total = (datos || []).reduce(function(a, b){ return a + (Number(b) || 0); }, 0);
  return total > 0 && (Number(valor) || 0) / total * 100 >= PIE_ETIQUETA_MIN_PCT;
}
function _loPieDlMostrar(ctx){
  return loPieMostrarEtiqueta(ctx.dataset.data[ctx.dataIndex], ctx.dataset.data) ? 'auto' : false;
}
function loPie(t){
  return {responsive:true,maintainAspectRatio:false,
    plugins:{
      legend:{position:'right',labels:{font:{size:12},boxWidth:10,padding:4}},
      title:{display:!!t,text:t,font:{size:12},color:CD},
      datalabels:{display:_loPieDlMostrar,color:_loPieDlColor,textStrokeColor:_loPieDlHalo,textStrokeWidth:_loPieDlHaloAncho,font:{size:12,weight:'bold'}, formatter:_loPctDeTotal}
    }};
}
// ═══════════════════════════════════════════════════════════
// Nota: los dashboards de cliente se renderizan desde configuracion
// (dashboard-generic.js). Ya no hay un archivo/objeto de datos por cliente.
// ═══════════════════════════════════════════════════════════
