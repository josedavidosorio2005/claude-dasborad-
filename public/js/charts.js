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
if (typeof Chart !== 'undefined') {
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

// Fase 133: CG/CO bajaron de luminosidad (2.87/2.85:1 -> 3.49/3.92:1 contra
// blanco, mismo cambio y mismos valores que --c-success/--c-warning en
// styles.css -- un donut/barra de "verde/ambar" (ej. distribucion de
// Sobresaliente/No Critico/Critico) es un objeto grafico, WCAG 1.4.11 exige
// 3:1 igual que un control). CR ya pasaba (3.82), sin cambio.
var CD='#0d4a5e',CM='#1a7a9e',CG='#1f9d55',CR='#e74c3c',CO='#c26a00',CP='#8e44ad';

// Fase 133 (Parte 3, WCAG 1.4.1 + 1.4.11): PC/PC_DARK ya NO reusan CG/CO/CR
// (el mismo tono exacto del semaforo) en ninguna de sus 12 posiciones -- una
// grafica categorica (ej. "llamadas por skill") no puede parecer un
// semaforo de bien/regular/mal sin que nadie lo haya pedido. Paleta nueva
// generada con una busqueda real (maximizar la distancia perceptual minima
// CIELAB bajo vision tipica + 3 simulaciones de daltonismo -- ver
// public/js/contraste-logic.js), restringida a matices fuera del semaforo
// (teal/azul/indigo/purpura/magenta/marron) y con contraste >=3:1 contra
// las superficies donde se dibuja. Minimo real medido entre las primeras 8
// series: 20.1:1 ΔE en el peor caso (protanopia), muy por encima del
// ejemplo del prompt (ΔE>=12). Detalle completo en docs/sistema-de-diseno.md.
var PC=['#29564b','#a92dd2','#461a66','#9f8f60','#349db2','#734d26','#d22d80','#1f1f93','#734b9b','#b870db','#ac7c39','#602055'];

// Set alterno de la paleta categorica para modo oscuro (paleta-logic.js no
// cambia: sigue derivando el INDICE de forma determinista por hash de la
// etiqueta -- lo unico que cambia aqui es a que color resuelve cada
// indice, para que se distingan sobre un fondo oscuro). Misma busqueda que
// PC, minimo real medido: ΔE 17.5:1 (peor caso, tritanopia).
var PC_DARK=['#428a78','#a457db','#abeded','#d9c68c','#ac6939','#9898cd','#53c6a9','#a99670','#bf9540','#cb4da1','#adc7eb','#9e79d2'];

// Colores de eje/leyenda/fondo-de-datalabel que lo()/loPie() usaban como
// literales sueltos -- ahora tambien reasignables por tema. CHART_TICK
// (claro) baja igual que --c-text-muted en styles.css (2.97 -> 5.38:1).
var CHART_GRID='#f0f4f8', CHART_TICK='#4f6f7d', CHART_DL_BG='rgba(255,255,255,0.75)';

// Puente con theme.js: reasigna CD/CM/CG/CR/CO/CP/PC (y CHART_GRID/TICK/
// DL_BG) segun el tema actual. El resto de este archivo y de
// dashboard-generic.js/trafico.js/calidad.js/mis-resultados.js ya leen
// estas variables por NOMBRE en el momento de construir cada grafico (no
// las copian a una constante propia), asi que reasignarlas aca alcanza --
// no hace falta tocar esos call-sites uno por uno. theme.js llama a esta
// funcion al cargar la pagina y en cada toggle de tema.
function aplicarTemaCharts(){
  var oscuro = typeof temaActual === 'function' && temaActual() === 'dark';
  if(oscuro){
    CD='#5fc9ea'; CM='#7dd6f0'; CG='#4ade80'; CR='#f87171'; CO='#fbbf24'; CP='#c084fc';
    PC=PC_DARK;
    CHART_GRID='#23414c'; CHART_TICK='#8fb4bf'; CHART_DL_BG='rgba(19,44,53,0.78)';
  } else {
    CD='#0d4a5e'; CM='#1a7a9e'; CG='#1f9d55'; CR='#e74c3c'; CO='#c26a00'; CP='#8e44ad';
    PC=['#29564b','#a92dd2','#461a66','#9f8f60','#349db2','#734d26','#d22d80','#1f1f93','#734b9b','#b870db','#ac7c39','#602055'];
    CHART_GRID='#f0f4f8'; CHART_TICK='#4f6f7d'; CHART_DL_BG='rgba(255,255,255,0.75)';
  }
}
aplicarTemaCharts();

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
  return s ? Math.round(v/s*100)+'%' : '';
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
  if(unidad==='%') return (n % 1 !== 0 ? n.toFixed(1) : n) + '%';
  if(unidad==='tiempo' || unidad==='tiempo_mmss'){ var m=Math.floor(n/60), s=Math.round(n%60); return m+':'+(s<10?'0':'')+s; }
  return Math.round(n*100)/100 === Math.round(n) ? Math.round(n).toLocaleString('es-CO') : (Math.round(n*100)/100).toLocaleString('es-CO');
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
  o.plugins.datalabels = Object.assign({}, o.plugins.datalabels, { display:'auto' });
  if(formatter) o.plugins.datalabels.formatter = formatter;
  return o;
}
function loPie(t){
  return {responsive:true,maintainAspectRatio:false,
    plugins:{
      legend:{position:'right',labels:{font:{size:12},boxWidth:10,padding:4}},
      title:{display:!!t,text:t,font:{size:12},color:CD},
      datalabels:{display:true,color:'#fff',font:{size:12,weight:'bold'}, formatter:_loPctDeTotal}
    }};
}
// ═══════════════════════════════════════════════════════════
// Nota: los dashboards de cliente se renderizan desde configuracion
// (dashboard-generic.js). Ya no hay un archivo/objeto de datos por cliente.
// ═══════════════════════════════════════════════════════════
