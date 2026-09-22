// charts.js — InConexion Platform.
// Helpers de Chart.js (paleta + opciones base) compartidos por el dashboard
// generico (dashboard-generic.js), el modulo de Calidad y el portal Asesor.
// Se carga como <script src> global y en orden. No cambiar el orden de carga.

var CD='#0d4a5e',CM='#1a7a9e',CG='#27ae60',CR='#e74c3c',CO='#e67e22',CP='#8e44ad';
var PC=[CD,CM,CG,CO,CR,CP,'#16a085','#f39c12','#2980b9','#c0392b','#7f8c8d','#1abc9c'];

// Set alterno de la paleta categorica para modo oscuro (paleta-logic.js no
// cambia: sigue derivando el INDICE de forma determinista por hash de la
// etiqueta -- lo unico que cambia aqui es a que color resuelve cada
// indice, para que se distingan sobre un fondo oscuro).
var PC_DARK=['#5fc9ea','#7dd6f0','#4ade80','#fbbf24','#f87171','#c084fc','#2dd4bf','#fb923c','#60a5fa','#f472b6','#94a3b8','#34d399'];

// Colores de eje/leyenda/fondo-de-datalabel que lo()/loPie() usaban como
// literales sueltos -- ahora tambien reasignables por tema.
var CHART_GRID='#f0f4f8', CHART_TICK='#7a9ba8', CHART_DL_BG='rgba(255,255,255,0.75)';

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
    CD='#0d4a5e'; CM='#1a7a9e'; CG='#27ae60'; CR='#e74c3c'; CO='#e67e22'; CP='#8e44ad';
    PC=[CD,CM,CG,CO,CR,CP,'#16a085','#f39c12','#2980b9','#c0392b','#7f8c8d','#1abc9c'];
    CHART_GRID='#f0f4f8'; CHART_TICK='#7a9ba8'; CHART_DL_BG='rgba(255,255,255,0.75)';
  }
}
aplicarTemaCharts();

function lo(t,xrot){
  return {responsive:true,maintainAspectRatio:false,
    plugins:{
      legend:{position:'bottom',labels:{font:{size:8},boxWidth:10,padding:6}},
      title:{display:!!t,text:t,font:{size:9,weight:'bold'},color:CD},
      datalabels:{
        display:true, align:'top', anchor:'top', offset:2,
        font:{size:8,weight:'bold'}, color:CD,
        backgroundColor:function(){return CHART_DL_BG;},
        borderRadius:2, padding:{top:1,bottom:1,left:2,right:2},
        formatter:function(v){return v===null||v===undefined?'':v;}
      }
    },
    scales:{
      y:{grid:{color:CHART_GRID},ticks:{font:{size:8},color:CHART_TICK}},
      x:{grid:{display:false},ticks:{font:{size:7},color:CHART_TICK,maxRotation:xrot||50}}
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
      legend:{position:'right',labels:{font:{size:8},boxWidth:10,padding:4}},
      title:{display:!!t,text:t,font:{size:9},color:CD},
      datalabels:{display:true,color:'#fff',font:{size:8,weight:'bold'}, formatter:_loPctDeTotal}
    }};
}
// ═══════════════════════════════════════════════════════════
// Nota: los dashboards de cliente se renderizan desde configuracion
// (dashboard-generic.js). Ya no hay un archivo/objeto de datos por cliente.
// ═══════════════════════════════════════════════════════════
