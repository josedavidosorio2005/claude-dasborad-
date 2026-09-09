// charts.js — InConexion Platform. Extraído de index.html (antes un único <script>).
// Se carga como <script src> global y en orden; todas las funciones son globales
// y se invocan desde manejadores del HTML. No cambiar el orden de carga.

var CD='#0d4a5e',CM='#1a7a9e',CG='#27ae60',CR='#e74c3c',CO='#e67e22',CP='#8e44ad';
var PC=[CD,CM,CG,CO,CR,CP,'#16a085','#f39c12','#2980b9','#c0392b','#7f8c8d','#1abc9c'];

function mk(id,cfg){
  var el=document.getElementById(id); if(!el) return;
  if(_ac[id]) try{_ac[id].destroy();}catch(e){}
  _ac[id]=new Chart(el,cfg);
}

function lo(t,xrot){
  var o={responsive:true,maintainAspectRatio:false,
    plugins:{
      legend:{position:'bottom',labels:{font:{size:8},boxWidth:10,padding:6}},
      title:{display:!!t,text:t,font:{size:9,weight:'bold'},color:CD},
      datalabels:{
        display:true,
        align:'top',
        anchor:'top',
        offset:2,
        font:{size:8,weight:'bold'},
        color:CD,
        backgroundColor:function(ctx){return 'rgba(255,255,255,0.75)';},
        borderRadius:2,
        padding:{top:1,bottom:1,left:2,right:2},
        formatter:function(v){return v===null||v===undefined?'':v;}
      }
    },
    scales:{
      y:{grid:{color:'#f0f4f8'},ticks:{font:{size:8},color:'#7a9ba8'},
         suggestedMax:function(ctx){
           // add 15% headroom so labels don't clip
           return undefined;
         }
      },
      x:{grid:{display:false},ticks:{font:{size:7},color:'#7a9ba8',maxRotation:xrot||50}}
    },
    layout:{padding:{top:20}}
  };
  return o;
}
function loPct(t){
  var o=lo(t);
  o.plugins.datalabels.formatter=function(v){return v+'%';};
  o.scales.y.ticks.callback=function(v){return v+'%';};
  return o;
}
function loBar(t){ var o=lo(t); o.plugins.datalabels.align='end'; return o; }
function loPie(t){
  return {responsive:true,maintainAspectRatio:false,
    plugins:{
      legend:{position:'right',labels:{font:{size:8},boxWidth:10,padding:4}},
      title:{display:!!t,text:t,font:{size:9},color:CD},
      datalabels:{display:true,color:'#fff',font:{size:8,weight:'bold'},
        formatter:function(v,ctx){var s=ctx.chart.data.datasets[0].data.reduce(function(a,b){return a+b;},0); return Math.round(v/s*100)+'%';}
      }
    }};
}

function renderTab(t){
  var D=AURORA_DATA;
  if(t==='llamadas'){
    mk('ch-ll-dia',{type:'line',data:{labels:D.dias,datasets:[{label:'Llamadas',data:D.llamDia,borderColor:CD,backgroundColor:'rgba(13,74,94,0.08)',tension:0.3,pointRadius:3,borderWidth:2,fill:true}]},options:lo()});
    mk('ch-ll-cont',{type:'line',data:{labels:D.dias,datasets:[{label:'% Contestadas',data:D.contPct,borderColor:CG,backgroundColor:'rgba(39,174,96,0.08)',tension:0.3,pointRadius:3,borderWidth:2,fill:true}]},options:loPct()});
    mk('ch-ll-aban',{type:'line',data:{labels:D.dias,datasets:[{label:'% Abandonadas',data:D.abanPct,borderColor:CR,backgroundColor:'rgba(231,76,60,0.08)',tension:0.3,pointRadius:3,borderWidth:2,fill:true}]},options:loPct()});
    mk('ch-aht',{type:'line',data:{labels:D.dias,datasets:[{label:'AHT (seg)',data:D.ahtSec,borderColor:CO,backgroundColor:'rgba(230,126,34,0.08)',tension:0.3,pointRadius:3,borderWidth:2,fill:true}]},
      options:(function(){var o=lo(); o.plugins.datalabels.formatter=function(v){var m=Math.floor(v/60),s=v%60;return '0:'+m+':'+(s<10?'0':'')+s;}; o.scales.y.ticks.callback=function(v){var m=Math.floor(v/60),s=v%60;return '0:'+m+':'+(s<10?'0':'')+s;}; return o;})()
    });
  }
  else if(t==='wpp'){
    mk('ch-wpp-dia',{type:'line',data:{labels:D.dias,datasets:[{label:'WPP Ingresados',data:D.wppDia,borderColor:CM,backgroundColor:'rgba(26,122,158,0.08)',tension:0.3,pointRadius:3,borderWidth:2,fill:true}]},options:lo()});
  }
  else if(t==='agendas'){
    mk('ch-ag-ll',{type:'line',data:{labels:D.dias,datasets:[{label:'Via Llamada',data:D.agLl,borderColor:CD,backgroundColor:'rgba(13,74,94,0.08)',tension:0.3,pointRadius:3,borderWidth:2}]},options:lo()});
    mk('ch-ag-wpp',{type:'line',data:{labels:D.dias,datasets:[{label:'Via WhatsApp',data:D.agWpp,borderColor:CM,backgroundColor:'rgba(26,122,158,0.08)',tension:0.3,pointRadius:3,borderWidth:2}]},options:lo()});
    mk('ch-ag-tot',{type:'line',data:{labels:D.dias,datasets:[{label:'Total',data:D.agTot,borderColor:CG,backgroundColor:'rgba(39,174,96,0.08)',tension:0.3,pointRadius:3,borderWidth:2,fill:true}]},options:lo()});
    mk('ch-wolkvox',{type:'line',data:{labels:D.wolkvoxM,datasets:[{label:'Agendas',data:D.wolkvoxV,borderColor:CD,backgroundColor:'rgba(13,74,94,0.1)',tension:0.3,pointRadius:5,borderWidth:2.5,fill:true}]},options:lo()});
    mk('ch-esp',{type:'bar',data:{labels:D.espLbl,datasets:[{label:'Agendas',data:D.espVal,backgroundColor:CM,borderRadius:3}]},
      options:(function(){var o=loBar(); o.indexAxis='y'; o.scales.x={ticks:{font:{size:7}}}; o.scales.y={ticks:{font:{size:7}}}; return o;})()});
    mk('ch-asesor',{type:'bar',data:{labels:D.asesLbl,datasets:[{label:'Agendas',data:D.asesVal,backgroundColor:[CD,CM,CG,CP,CO],borderRadius:3}]},options:loBar()});
    mk('ch-inasist',{type:'line',data:{labels:D.inasistM,datasets:[{label:'% Inasistencia',data:D.inasistV,borderColor:CR,backgroundColor:'rgba(231,76,60,0.1)',tension:0.3,pointRadius:5,borderWidth:2.5,fill:true}]},options:loPct()});
    mk('ch-inasist-esp',{type:'bar',data:{labels:D.inasistEspLbl,datasets:[{label:'% Inasist',data:D.inasistEspVal,backgroundColor:CR,borderRadius:3}]},
      options:(function(){var o=loBar(); o.indexAxis='y'; o.scales.x={ticks:{font:{size:7},callback:function(v){return v+'%';}}}; o.scales.y={ticks:{font:{size:7}}}; o.plugins.datalabels.formatter=function(v){return v+'%';}; return o;})()});
  }
  else if(t==='tipificacion'){
    mk('ch-tip-le',{type:'doughnut',data:{labels:D.tipLeLbl,datasets:[{data:D.tipLeVal,backgroundColor:PC}]},options:loPie()});
    mk('ch-tip-ls',{type:'doughnut',data:{labels:D.tipLsLbl,datasets:[{data:D.tipLsVal,backgroundColor:PC}]},options:loPie()});
    mk('ch-tip-we',{type:'doughnut',data:{labels:D.tipWeLbl,datasets:[{data:D.tipWeVal,backgroundColor:PC}]},options:loPie()});
    mk('ch-tip-ws',{type:'doughnut',data:{labels:D.tipWsLbl,datasets:[{data:D.tipWsVal,backgroundColor:PC}]},options:loPie()});
    mk('ch-encuestas',{type:'doughnut',data:{labels:D.encLbl,datasets:[{data:D.encVal,backgroundColor:[CD,CO,CG]}]},options:loPie()});
  }
  else if(t==='salida'){
    mk('ch-sal-ll',{type:'line',data:{labels:D.salLlDias,datasets:[{label:'Llamadas Salida',data:D.salLlVal,borderColor:CD,backgroundColor:'rgba(13,74,94,0.08)',tension:0.3,pointRadius:3,borderWidth:2,fill:true}]},options:lo()});
    mk('ch-sal-wpp',{type:'line',data:{labels:D.salWppDias,datasets:[{label:'WPP Salida',data:D.salWppVal,borderColor:CM,backgroundColor:'rgba(26,122,158,0.08)',tension:0.3,pointRadius:3,borderWidth:2,fill:true}]},options:lo()});
  }
  else if(t==='manager'){
    mk('ch-mgr',{type:'bar',data:{labels:D.mgrM,datasets:[
      {type:'bar',label:'Cantidad',data:D.mgrV,backgroundColor:CM,borderRadius:3,yAxisID:'y'},
      {type:'line',label:'% Incremento',data:D.mgrPct,borderColor:CO,borderWidth:2.5,pointRadius:5,tension:0.3,yAxisID:'y2',spanGaps:true}
    ]},options:(function(){
      var o=loBar();
      o.scales={y:{position:'left',grid:{color:'#f0f4f8'},ticks:{font:{size:8}}},y2:{position:'right',grid:{display:false},ticks:{font:{size:8},callback:function(v){return v!==null?v+'%':'';}}},x:{grid:{display:false},ticks:{font:{size:8}}}};
      o.plugins.datalabels={display:true,align:'end',anchor:'end',font:{size:8,weight:'bold'},color:CD,formatter:function(v,ctx){if(ctx.datasetIndex===1)return v!==null?v+'%':'';return v;}};
      return o;
    })()});
    mk('ch-err',{type:'line',data:{labels:D.errM,datasets:[{label:'Errores',data:D.errV,borderColor:CR,backgroundColor:'rgba(231,76,60,0.1)',tension:0.3,pointRadius:5,borderWidth:2.5,fill:true}]},options:lo()});
    mk('ch-hist-flujo',{type:'line',data:{labels:D.histM,datasets:[
      {label:'Llamadas',data:D.histLl,borderColor:CD,tension:0.3,pointRadius:4,borderWidth:2},
      {label:'WhatsApp',data:D.histWpp,borderColor:CO,tension:0.3,pointRadius:4,borderWidth:2},
      {label:'Total',data:D.histTot,borderColor:CG,tension:0.3,pointRadius:4,borderWidth:2.5}
    ]},options:lo()});
  }
  else if(t==='sabados'){
    mk('ch-sab-ll',{type:'line',data:{labels:D.sabFechas,datasets:[{label:'Llamadas Sab',data:D.sabLl,borderColor:CD,backgroundColor:'rgba(13,74,94,0.1)',tension:0.3,pointRadius:7,borderWidth:2.5}]},options:lo(null,0)});
    mk('ch-sab-wpp',{type:'line',data:{labels:D.sabFechas,datasets:[{label:'WPP Sab',data:D.sabWpp,borderColor:CM,backgroundColor:'rgba(26,122,158,0.1)',tension:0.3,pointRadius:7,borderWidth:2.5}]},options:lo(null,0)});
  }
  else if(t==='calidad'){
    renderAuroraCalidadTab();
  }
}
var _auroraCalMes = '';
function onAuroraCalMesChange(){
  _auroraCalMes = document.getElementById('aurora-cal-mes-sel').value;
  renderAuroraCalidadTab();
}
function renderAuroraCalidadTab(){
  if(typeof loadCalData==='function') loadCalData();
  var allArr = (CAL_DB['CLINICA AURORA'] && CAL_DB['CLINICA AURORA'].monitoreos) || [];
  var mesSel = document.getElementById('aurora-cal-mes-sel');
  if(mesSel){
    var months = calAvailableMonths(allArr);
    if(_auroraCalMes && months.indexOf(_auroraCalMes)===-1) _auroraCalMes = '';
    mesSel.innerHTML = calMonthSelectOptions(months, _auroraCalMes);
    mesSel.value = _auroraCalMes;
  }
  var arr = calFilterByMonth(allArr, _auroraCalMes);
  var total = arr.length;
  var promedio = total ? Math.round((arr.reduce(function(a,m){return a+m.puntaje;},0)/total)*10)/10 : 0;
  var sobresaliente = arr.filter(function(m){return m.puntaje>=90;}).length;
  var noCritico = arr.filter(function(m){return m.puntaje>=70 && m.puntaje<90;}).length;
  var critico = arr.filter(function(m){return m.puntaje<70;}).length;
  var clasifGeneral = total===0 ? '—' : (promedio<70?'🔴 CRITICO':promedio<90?'🟡 NO CRITICO':'🟢 SOBRESALIENTE');

  document.getElementById('aurora-cal-kpis').innerHTML =
    '<div class="aurora-kpi"><div class="kv">'+total+'</div><div class="kl">Monitoreos Realizados'+(_auroraCalMes?' ('+_auroraCalMes+')':'')+'</div></div>'+
    '<div class="aurora-kpi '+(promedio>=90?'kpi-green':promedio>=70?'kpi-org':'kpi-red')+'"><div class="kv">'+(total?promedio:'—')+'</div><div class="kl">Puntaje Promedio de Calidad</div></div>'+
    '<div class="aurora-kpi '+(promedio>=90?'kpi-green':promedio>=70?'kpi-org':'kpi-red')+'"><div class="kv" style="font-size:1rem">'+clasifGeneral+'</div><div class="kl">Clasificacion General</div></div>';

  mk('ch-cal-clasif',{type:'doughnut',data:{labels:['Sobresaliente','No Critico','Critico'],datasets:[{data:[sobresaliente,noCritico,critico],backgroundColor:[CG,CO,CR]}]},options:loPie()});
}
// ═══════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════
// Nota: ya no se cargan datos aqui. Ahora se requiere iniciar sesion
// primero (doLogin obtiene el token) y luego se piden los datos al
// backend con ese token. Ver funcion doLogin().
