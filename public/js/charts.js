// charts.js — InConexion Platform.
// Helpers de Chart.js (paleta + opciones base) compartidos por el dashboard
// generico (dashboard-generic.js), el modulo de Calidad y el portal Asesor.
// Se carga como <script src> global y en orden. No cambiar el orden de carga.

var CD='#0d4a5e',CM='#1a7a9e',CG='#27ae60',CR='#e74c3c',CO='#e67e22',CP='#8e44ad';
var PC=[CD,CM,CG,CO,CR,CP,'#16a085','#f39c12','#2980b9','#c0392b','#7f8c8d','#1abc9c'];

function lo(t,xrot){
  return {responsive:true,maintainAspectRatio:false,
    plugins:{
      legend:{position:'bottom',labels:{font:{size:8},boxWidth:10,padding:6}},
      title:{display:!!t,text:t,font:{size:9,weight:'bold'},color:CD},
      datalabels:{
        display:true, align:'top', anchor:'top', offset:2,
        font:{size:8,weight:'bold'}, color:CD,
        backgroundColor:function(){return 'rgba(255,255,255,0.75)';},
        borderRadius:2, padding:{top:1,bottom:1,left:2,right:2},
        formatter:function(v){return v===null||v===undefined?'':v;}
      }
    },
    scales:{
      y:{grid:{color:'#f0f4f8'},ticks:{font:{size:8},color:'#7a9ba8'}},
      x:{grid:{display:false},ticks:{font:{size:7},color:'#7a9ba8',maxRotation:xrot||50}}
    },
    layout:{padding:{top:20}}
  };
}
function loPct(t){
  var o=lo(t);
  o.plugins.datalabels.formatter=function(v){return v+'%';};
  o.scales.y.ticks.callback=function(v){return v+'%';};
  return o;
}
function loPct2(xrot){
  var o=lo(null,xrot);
  o.plugins.datalabels.formatter=function(v){return v+'%';};
  o.scales.y.ticks.callback=function(v){return v+'%';};
  return o;
}
function loBar(t){ var o=lo(t); o.plugins.datalabels.align='end'; return o; }

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
function loPie(t){
  return {responsive:true,maintainAspectRatio:false,
    plugins:{
      legend:{position:'right',labels:{font:{size:8},boxWidth:10,padding:4}},
      title:{display:!!t,text:t,font:{size:9},color:CD},
      datalabels:{display:true,color:'#fff',font:{size:8,weight:'bold'},
        formatter:function(v,ctx){var s=ctx.chart.data.datasets[0].data.reduce(function(a,b){return a+b;},0); return s?Math.round(v/s*100)+'%':'';}
      }
    }};
}
function hFmtTime(v){ var m=Math.floor(v/60),s=v%60; return m+':'+(s<10?'0':'')+s; }

// ═══════════════════════════════════════════════════════════
// Nota: los dashboards de cliente se renderizan desde configuracion
// (dashboard-generic.js). Ya no hay un archivo/objeto de datos por cliente.
// ═══════════════════════════════════════════════════════════
