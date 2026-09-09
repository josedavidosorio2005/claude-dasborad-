// dashboard-orlant.js — InConexion Platform. Extraído de index.html (antes un único <script>).
// Se carga como <script src> global y en orden; todas las funciones son globales
// y se invocan desde manejadores del HTML. No cambiar el orden de carga.

// CLINICA ORLANT DASHBOARD
// ═══════════════════════════════════════════════════════════
var ORLANT_DATA = {
  meses: ['Ene','Feb','Mar','Abr','May','Jun'],
  ll3pMes:  [4167,4164,4353,4361,4178,3853],
  wpp3pMes: [3299,3602,4375,4546,4208,4269],
  llGenMes: [12308,13098,14576,13909,12868,12481],
  wppGenMes:[1754,1703,2180,1892,2258,2635],

  salGenDias: ['D1','D2','D3','D4','D5','D6','D7','D8','D9','D10','D11','D12','D13','D14','D15','D16','D17','D18','D19','D20','D21','D22','D23'],
  salGenVal:  [186,234,246,275,198,20,265,302,330,266,38,255,249,299,280,43,305,298,259,270,199,42,270],
  sal3pDias: ['D1','D2','D3','D4','D5','D6','D7','D8','D9','D10','D11','D12','D13','D14','D15','D16','D17','D18','D19','D20','D21','D22'],
  sal3pVal:  [171,267,158,99,101,20,142,145,123,166,28,90,144,90,69,29,179,197,180,109,24,135],
  wppSalGenDias: ['D1','D2','D3','D4','D5','D6','D7','D8','D9','D10','D11','D12','D13','D14','D15','D16','D17','D18','D19','D20','D21','D22','D23'],
  wppSalGenVal:  [91,137,108,115,118,14,128,89,107,132,9,161,131,177,174,4,156,127,143,122,146,4,131],
  wppSal3pDias: ['D1','D2','D3','D4','D5','D6','D7','D8','D9','D10','D11','D12','D13','D14','D15','D16','D17','D18','D19','D20','D21','D22','D23','D24','D25','D26','D27'],
  wppSal3pVal:  [99,102,89,85,65,5,7,91,108,89,92,6,5,101,92,91,76,15,3,134,101,101,74,46,2,6,103],

  tip3pLbl: ['AGENDADA_InConexion','TRANSFERENCIA_AGENTE','NO_CONTESTAN','INFORMACION_3P','INFORMACION_SECRETARIA','CONFIRMACION_CITA','PACIENTE_NO_ACEPTA_CITA','OTROS'],
  tip3pVal: [28,26,14,7,5,4,3,13],
  tipGenLbl: ['AGENDADA_InConexion','INFORMACION_GENERAL','OTROS','CITA_CANCELADA','NO_CONTESTAN','SIN_AGENDA_POLISOMNOGRAFIA','INFO_AUDIOLOGIA_AUDIFONOS','RESTO'],
  tipGenVal: [32,12,8,7,7,5,4,25],

  ordmedGestion: [431,743,306,492,657,716],
  ordmedAgendas: [74,159,39,63,97,140],
  ordmedPct: [17,21,13,13,15,20],

  recupCancelado: [259,355,375,478,523,655],
  recupAtendido: [205,286,284,250,311,290],
  recupPct: [79,81,76,52,59,44],

  totAgendasMes: [10524,11630,12160,11449,10875,11918],
  agendasGeneral: [6546,7216,7531,7024,6543,7281],
  agendas3p: [3978,4414,4629,4425,4332,4637],

  inasistAudif: [5,4,5,4,4,4],
  inasistAudio: [5,6,6,6,7,5],
  inasistExam:  [5,5,7,6,6,6],
  inasistTotal: [6,6,7,6,7,6],

  staServicioLbl: ['Cat.1','Cat.2','Cat.3','Cat.4','Cat.5','Cat.6','Cat.7','Cat.8','Cat.9'],
  staServicioVal: [8752,2832,2305,2027,1886,1733,1424,388,310],
  staEstadoLbl: ['Facturado','Cumplida','En proceso','Agendada','Anulada','Sin contacto'],
  staEstadoVal: [9154,4542,4427,2735,580,219],
  staMesOrdenes: [2371,3826,4149,3836,3678,3797],
  staMesAgendada: [163,279,279,372,520,1122],
  staMesFactCump:[1928,2956,3060,2719,1969,1064],
  staMesPct: [81,77,74,71,54,28],

  staJunioLbl: ['Terapias','Consulta subespecializada','Examenes audiologicos','Examenes Especiales','Insumos unidad audifonos/implante'],
  staJunioCant: [527,373,301,114,23],
  staJunioAgendas: [51,69,59,42,7],
  staJunioPct: [10,18,20,37,30],

  efectCitasParaMes: [11972,13278,13996,13740,13377,14488],
  efectAtendidas: [9162,10188,10649,10279,10022,10831],
  efectPct: [77,77,76,75,75,75]
};

var _oc = {};
var _otab = 'flujo';

function openOrlant(){
  loadCalData();
  document.getElementById('orlant-overlay').classList.add('show');
  setTimeout(renderOrlantCurrentTab,120);
}
function onOrlantMonthChange(){
  var sel = document.getElementById('orlant-month-sel').value;
  var labels = {'jun-26':'Junio 2026'};
  var sub = document.getElementById('orlant-sub-label');
  if(sub) sub.textContent = 'Informe Gestion ' + (labels[sel]||sel) + ' — Clinica Orlant';
  Object.keys(_oc).forEach(function(k){ try{_oc[k].destroy();}catch(e){} delete _oc[k]; });
  setTimeout(renderOrlantCurrentTab, 80);
}
function closeOrlant(){
  document.getElementById('orlant-overlay').classList.remove('show');
  Object.keys(_oc).forEach(function(k){ try{_oc[k].destroy();}catch(e){} delete _oc[k]; });
}
document.getElementById('orlant-overlay').addEventListener('click',function(e){ if(e.target===this) closeOrlant(); });

function switchOrlantTab(t){
  _otab = t;
  document.querySelectorAll('#orlant-modal .atab').forEach(function(el){ el.classList.toggle('atab-active', el.dataset.otab===t); });
  document.querySelectorAll('#orlant-modal .atab-panel').forEach(function(el){ el.classList.toggle('visible', el.id==='opanel-'+t); });
  Object.keys(_oc).forEach(function(k){ try{_oc[k].destroy();}catch(e){} delete _oc[k]; });
  setTimeout(renderOrlantCurrentTab,80);
}
function renderOrlantCurrentTab(){ renderOrlantTab(_otab); }

function omk(id,cfg){
  var el=document.getElementById(id); if(!el) return;
  if(_oc[id]) try{_oc[id].destroy();}catch(e){}
  _oc[id]=new Chart(el,cfg);
}

function renderOrlantTab(t){
  var D=ORLANT_DATA;
  if(t==='flujo'){
    omk('och-ll3p',{type:'line',data:{labels:D.meses,datasets:[{label:'Llamadas 3P',data:D.ll3pMes,borderColor:CD,backgroundColor:'rgba(13,74,94,0.08)',tension:0.3,pointRadius:5,borderWidth:2.5,fill:true}]},options:lo()});
    omk('och-wpp3p',{type:'line',data:{labels:D.meses,datasets:[{label:'WhatsApp 3P',data:D.wpp3pMes,borderColor:CM,backgroundColor:'rgba(26,122,158,0.08)',tension:0.3,pointRadius:5,borderWidth:2.5,fill:true}]},options:lo()});
    omk('och-llgen',{type:'line',data:{labels:D.meses,datasets:[{label:'Llamadas Linea General',data:D.llGenMes,borderColor:CR,backgroundColor:'rgba(231,76,60,0.08)',tension:0.3,pointRadius:5,borderWidth:2.5,fill:true}]},options:lo()});
    omk('och-wppgen',{type:'line',data:{labels:D.meses,datasets:[{label:'WhatsApp Linea General',data:D.wppGenMes,borderColor:CG,backgroundColor:'rgba(39,174,96,0.08)',tension:0.3,pointRadius:5,borderWidth:2.5,fill:true}]},options:lo()});
  }
  else if(t==='salida'){
    omk('och-salgen',{type:'line',data:{labels:D.salGenDias,datasets:[{label:'Llamadas Salida L.General',data:D.salGenVal,borderColor:CD,backgroundColor:'rgba(13,74,94,0.08)',tension:0.3,pointRadius:2,borderWidth:2,fill:true}]},options:lo(null,60)});
    omk('och-sal3p',{type:'line',data:{labels:D.sal3pDias,datasets:[{label:'Llamadas Salida 3P',data:D.sal3pVal,borderColor:CM,backgroundColor:'rgba(26,122,158,0.08)',tension:0.3,pointRadius:2,borderWidth:2,fill:true}]},options:lo(null,60)});
    omk('och-wppsalgen',{type:'line',data:{labels:D.wppSalGenDias,datasets:[{label:'WPP Salida L.General',data:D.wppSalGenVal,borderColor:CG,backgroundColor:'rgba(39,174,96,0.08)',tension:0.3,pointRadius:2,borderWidth:2,fill:true}]},options:lo(null,60)});
    omk('och-wppsal3p',{type:'line',data:{labels:D.wppSal3pDias,datasets:[{label:'WPP Salida 3P',data:D.wppSal3pVal,borderColor:CO,backgroundColor:'rgba(230,126,34,0.08)',tension:0.3,pointRadius:2,borderWidth:2,fill:true}]},options:lo(null,60)});
  }
  else if(t==='tipificacion'){
    omk('och-tip3p',{type:'doughnut',data:{labels:D.tip3pLbl,datasets:[{data:D.tip3pVal,backgroundColor:PC}]},options:loPie()});
    omk('och-tipgen',{type:'doughnut',data:{labels:D.tipGenLbl,datasets:[{data:D.tipGenVal,backgroundColor:PC}]},options:loPie()});
  }
  else if(t==='agendamiento'){
    omk('och-ordmed',{type:'bar',data:{labels:D.meses,datasets:[
      {type:'bar',label:'Gestionados',data:D.ordmedGestion,backgroundColor:CM,borderRadius:3,yAxisID:'y'},
      {type:'bar',label:'Agendas',data:D.ordmedAgendas,backgroundColor:CD,borderRadius:3,yAxisID:'y'},
      {type:'line',label:'% Efectividad',data:D.ordmedPct,borderColor:CO,borderWidth:2.5,pointRadius:5,tension:0.3,yAxisID:'y2'}
    ]},options:(function(){
      var o=loBar();
      o.scales={y:{position:'left',grid:{color:'#f0f4f8'},ticks:{font:{size:8}}},y2:{position:'right',grid:{display:false},ticks:{font:{size:8},callback:function(v){return v+'%';}}},x:{grid:{display:false},ticks:{font:{size:8}}}};
      o.plugins.datalabels={display:true,align:'end',anchor:'end',font:{size:7,weight:'bold'},color:CD,formatter:function(v,ctx){if(ctx.datasetIndex===2)return v+'%';return v;}};
      return o;
    })()});
    omk('och-recup',{type:'bar',data:{labels:D.meses,datasets:[
      {type:'bar',label:'Cancelado',data:D.recupCancelado,backgroundColor:CR,borderRadius:3,yAxisID:'y'},
      {type:'bar',label:'Atendido',data:D.recupAtendido,backgroundColor:CG,borderRadius:3,yAxisID:'y'},
      {type:'line',label:'% Efectividad',data:D.recupPct,borderColor:CO,borderWidth:2.5,pointRadius:5,tension:0.3,yAxisID:'y2'}
    ]},options:(function(){
      var o=loBar();
      o.scales={y:{position:'left',grid:{color:'#f0f4f8'},ticks:{font:{size:8}}},y2:{position:'right',grid:{display:false},ticks:{font:{size:8},callback:function(v){return v+'%';}}},x:{grid:{display:false},ticks:{font:{size:8}}}};
      o.plugins.datalabels={display:true,align:'end',anchor:'end',font:{size:7,weight:'bold'},color:CD,formatter:function(v,ctx){if(ctx.datasetIndex===2)return v+'%';return v;}};
      return o;
    })()});
    omk('och-totagendas',{type:'line',data:{labels:D.meses,datasets:[{label:'Total Agendas',data:D.totAgendasMes,borderColor:CP,backgroundColor:'rgba(142,68,173,0.1)',tension:0.3,pointRadius:5,borderWidth:2.5,fill:true}]},options:lo()});
    omk('och-agendasmes',{type:'bar',data:{labels:D.meses,datasets:[
      {label:'Linea General',data:D.agendasGeneral,backgroundColor:CD,borderRadius:3},
      {label:'Linea 3P',data:D.agendas3p,backgroundColor:CM,borderRadius:3}
    ]},options:loBar()});
  }
  else if(t==='inasistencia'){
    omk('och-inasist-audif',{type:'line',data:{labels:D.meses,datasets:[{label:'% Inasistencia Audifonos',data:D.inasistAudif,borderColor:CR,backgroundColor:'rgba(231,76,60,0.1)',tension:0.3,pointRadius:5,borderWidth:2.5,fill:true}]},options:loPct()});
    omk('och-inasist-audio',{type:'line',data:{labels:D.meses,datasets:[{label:'% Inasistencia Audiologia',data:D.inasistAudio,borderColor:CO,backgroundColor:'rgba(230,126,34,0.1)',tension:0.3,pointRadius:5,borderWidth:2.5,fill:true}]},options:loPct()});
    omk('och-inasist-exam',{type:'line',data:{labels:D.meses,datasets:[{label:'% Inasistencia Examenes',data:D.inasistExam,borderColor:CM,backgroundColor:'rgba(26,122,158,0.1)',tension:0.3,pointRadius:5,borderWidth:2.5,fill:true}]},options:loPct()});
    omk('och-inasist-total',{type:'line',data:{labels:D.meses,datasets:[{label:'% Inasistencia Total',data:D.inasistTotal,borderColor:CD,backgroundColor:'rgba(13,74,94,0.1)',tension:0.3,pointRadius:5,borderWidth:2.5,fill:true}]},options:loPct()});
  }
  else if(t==='sta'){
    omk('och-sta-servicio',{type:'bar',data:{labels:D.staServicioLbl,datasets:[{label:'Ordenes',data:D.staServicioVal,backgroundColor:CM,borderRadius:3}]},
      options:(function(){var o=loBar(); o.indexAxis='y'; o.scales.x={ticks:{font:{size:7}}}; o.scales.y={ticks:{font:{size:7}}}; return o;})()});
    omk('och-sta-estado',{type:'doughnut',data:{labels:D.staEstadoLbl,datasets:[{data:D.staEstadoVal,backgroundColor:PC}]},options:loPie()});
    omk('och-sta-mes',{type:'bar',data:{labels:D.meses,datasets:[
      {type:'bar',label:'Ordenes Cargadas',data:D.staMesOrdenes,backgroundColor:CD,borderRadius:3,yAxisID:'y'},
      {type:'bar',label:'Facturado+Cumplida',data:D.staMesFactCump,backgroundColor:CG,borderRadius:3,yAxisID:'y'},
      {type:'line',label:'% Efectividad',data:D.staMesPct,borderColor:CO,borderWidth:2.5,pointRadius:5,tension:0.3,yAxisID:'y2'}
    ]},options:(function(){
      var o=loBar();
      o.scales={y:{position:'left',grid:{color:'#f0f4f8'},ticks:{font:{size:8}}},y2:{position:'right',grid:{display:false},ticks:{font:{size:8},callback:function(v){return v+'%';}}},x:{grid:{display:false},ticks:{font:{size:8}}}};
      o.plugins.datalabels={display:true,align:'end',anchor:'end',font:{size:7,weight:'bold'},color:CD,formatter:function(v,ctx){if(ctx.datasetIndex===2)return v+'%';return v;}};
      return o;
    })()});
    omk('och-sta-junio',{type:'bar',data:{labels:D.staJunioLbl,datasets:[
      {type:'bar',label:'Cantidad',data:D.staJunioCant,backgroundColor:CM,borderRadius:3,yAxisID:'y'},
      {type:'line',label:'% Efectividad',data:D.staJunioPct,borderColor:CO,borderWidth:2.5,pointRadius:5,tension:0.3,yAxisID:'y2'}
    ]},options:(function(){
      var o=loBar();
      o.scales={y:{position:'left',grid:{color:'#f0f4f8'},ticks:{font:{size:7}}},y2:{position:'right',grid:{display:false},ticks:{font:{size:8},callback:function(v){return v+'%';}}},x:{grid:{display:false},ticks:{font:{size:6},maxRotation:60}}};
      o.plugins.datalabels={display:true,align:'end',anchor:'end',font:{size:7,weight:'bold'},color:CD,formatter:function(v,ctx){if(ctx.datasetIndex===1)return v+'%';return v;}};
      return o;
    })()});
  }
  else if(t==='efectividad'){
    omk('och-efect',{type:'bar',data:{labels:D.meses,datasets:[
      {type:'bar',label:'Citas para el Mes',data:D.efectCitasParaMes,backgroundColor:CD,borderRadius:3,yAxisID:'y'},
      {type:'bar',label:'Total Atendidas',data:D.efectAtendidas,backgroundColor:CG,borderRadius:3,yAxisID:'y'},
      {type:'line',label:'% Efectividad',data:D.efectPct,borderColor:CO,borderWidth:2.5,pointRadius:5,tension:0.3,yAxisID:'y2'}
    ]},options:(function(){
      var o=loBar();
      o.scales={y:{position:'left',grid:{color:'#f0f4f8'},ticks:{font:{size:8}}},y2:{position:'right',grid:{display:false},ticks:{font:{size:8},callback:function(v){return v+'%';}}},x:{grid:{display:false},ticks:{font:{size:8}}}};
      o.plugins.datalabels={display:true,align:'end',anchor:'end',font:{size:7,weight:'bold'},color:CD,formatter:function(v,ctx){if(ctx.datasetIndex===2)return v+'%';return v;}};
      return o;
    })()});
  }
  else if(t==='calidad'){
    renderOrlantCalidadTab();
  }
}

var _orlantCalMes = '';
function onOrlantCalMesChange(){
  _orlantCalMes = document.getElementById('orlant-cal-mes-sel').value;
  renderOrlantCalidadTab();
}
function renderOrlantCalidadTab(){
  if(typeof loadCalData==='function') loadCalData();
  var allArr = (CAL_DB.ORLANT && CAL_DB.ORLANT.monitoreos) || [];
  var mesSel = document.getElementById('orlant-cal-mes-sel');
  if(mesSel){
    var months = calAvailableMonths(allArr);
    if(_orlantCalMes && months.indexOf(_orlantCalMes)===-1) _orlantCalMes = '';
    mesSel.innerHTML = calMonthSelectOptions(months, _orlantCalMes);
    mesSel.value = _orlantCalMes;
  }
  var arr = calFilterByMonth(allArr, _orlantCalMes);
  var total = arr.length;
  var promedio = total ? Math.round((arr.reduce(function(a,m){return a+m.puntaje;},0)/total)*10)/10 : 0;
  var sobresaliente = arr.filter(function(m){return m.puntaje>=90;}).length;
  var noCritico = arr.filter(function(m){return m.puntaje>=70 && m.puntaje<90;}).length;
  var critico = arr.filter(function(m){return m.puntaje<70;}).length;
  var clasifGeneral = total===0 ? '—' : (promedio<70?'🔴 CRITICO':promedio<90?'🟡 NO CRITICO':'🟢 SOBRESALIENTE');

  document.getElementById('orlant-cal-kpis').innerHTML =
    '<div class="aurora-kpi"><div class="kv">'+total+'</div><div class="kl">Monitoreos Realizados'+(_orlantCalMes?' ('+_orlantCalMes+')':'')+'</div></div>'+
    '<div class="aurora-kpi '+(promedio>=90?'kpi-green':promedio>=70?'kpi-org':'kpi-red')+'"><div class="kv">'+(total?promedio:'—')+'</div><div class="kl">Puntaje Promedio de Calidad</div></div>'+
    '<div class="aurora-kpi '+(promedio>=90?'kpi-green':promedio>=70?'kpi-org':'kpi-red')+'"><div class="kv" style="font-size:1rem">'+clasifGeneral+'</div><div class="kl">Clasificacion General</div></div>';

  omk('och-cal-clasif',{type:'doughnut',data:{labels:['Sobresaliente','No Critico','Critico'],datasets:[{data:[sobresaliente,noCritico,critico],backgroundColor:[CG,CO,CR]}]},options:loPie()});
}

// ═══════════════════════════════════════════════════════════
