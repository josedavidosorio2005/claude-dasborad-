// dashboard-hlm.js — InConexion Platform. Extraído de index.html (antes un único <script>).
// Se carga como <script src> global y en orden; todas las funciones son globales
// y se invocan desde manejadores del HTML. No cambiar el orden de carga.

// HOSPITAL LA MARIA DASHBOARD — SEDE CASTILLA & SEDE 33
// ═══════════════════════════════════════════════════════════
var HLM_CASTILLA = {
  kpis: [
    {v:'14.293', l:'Llamadas Ingresadas', cls:''},
    {v:'76%', l:'Nivel Atencion Llamadas', cls:'kpi-green'},
    {v:'11.030', l:'Llamadas Contestadas', cls:''},
    {v:'3.263', l:'Llamadas Abandonadas', cls:'kpi-red'},
    {v:'13.926', l:'WhatsApp Ingresados', cls:''},
    {v:'1.450', l:'Agendas via WhatsApp', cls:'kpi-pur'},
    {v:'2.109', l:'Agendas via Llamada', cls:'kpi-pur'},
    {v:'3.559', l:'Total Agendas (187/dia)', cls:'kpi-org'},
    {v:'03:19', l:'AHT Promedio', cls:'kpi-org'}
  ],
  dias: ['1/6','2/6','3/6','4/6','5/6','6/6','9/6','10/6','11/6','12/6','13/6','16/6','17/6','18/6','19/6','20/6','22/6','23/6','24/6','25/6','26/6','27/6','30/6'],
  llIng: [847,726,772,781,728,162,829,723,730,767,133,658,782,803,788,151,751,846,599,576,414,144,583],
  contPct: [84,84,78,80,90,88,82,77,74,74,88,71,77,78,78,87,74,83,68,73,48,49,72],
  abanPct: [16,16,22,20,10,12,18,23,26,26,12,29,23,22,22,13,26,17,32,27,52,51,28],
  wppIng: [418,731,843,767,698,357,468,774,888,614,108,669,680,655,757,204,697,513,605,696,754,629,401],
  agWpp: [103,73,62,62,30,7,86,71,79,71,7,113,79,60,43,3,101,87,115,56,38,9,95],
  agLl: [136,150,117,94,61,3,126,117,74,75,18,93,95,90,64,5,87,152,113,171,79,19,170],
  agTot: [239,223,179,156,91,10,212,188,153,146,25,206,174,150,107,8,188,239,228,227,117,28,265],
  ahtSec: [209,224,224,196,177,119,194,209,187,190,164,209,201,185,175,161,197,204,222,258,233,200,242],

  tipLbl: ['DEMANDA_INSATISFECHA','NO_CONTESTAN','AGENDA_InConexion','INFORMACION_GENERAL','OTROS','SAVIA_SALUD_CAIDO','RESTO_MENOR'],
  tipVal: [48,14,14,10,6,2,6],

  ivrLbl: ['Neurologia','Alergologia','Nutricion','Cuidados y Dolor Paliativo','Infectologia'],
  ivrVal: [170,33,19,19,7],

  demandaEspLbl: ['Neurologia','Urologia','Ortopedia','Otorrino','Ginecologia','Med.Interna','Dermatologia','Cardiologia','Alergologia','Dolor y CP','Neumologia','Nutricion'],
  demandaLl:  [1241,1088,688,620,613,592,333,322,200,150,270,106],
  demandaWpp: [834,693,596,542,511,516,311,296,266,147,128,103],

  entLlLbl: ['SAVIA_SALUD','COOSALUD','SOAT','SURA','SALUD_TOTAL','NUEVA_EPS'],
  entLlVal: [6680,4304,15,15,13,3],
  entWppLbl: ['SAVIA_SALUD','COOSALUD','SALUD_TOTAL','NUEVA_EPS','SOAT'],
  entWppVal: [8711,5293,61,33,27],

  titles: {
    llIng:'Tendencia Llamadas Ingresadas — Total: 14.293',
    contPct:'% Llamadas Contestadas — Promedio: 76% | Total: 11.030',
    abanPct:'% Llamadas Abandonadas — Total: 3.263',
    wppIng:'Tendencia WhatsApp Ingresados — Total: 13.926',
    agWpp:'Agendas via WhatsApp — Total: 1.450',
    agLl:'Agendas via Llamada — Total: 2.109',
    agTot:'Total Agendas WPP + Llamada — Total: 3.559 (187/dia)',
    aht:'AHT Hospital La Maria — Promedio: 03:19',
    tip:'Tipificacion Hospital La Maria — Llamada y WhatsApp',
    entLl:'Flujo Llamadas Identificadas por Entidad',
    entWpp:'Flujo WhatsApp Identificados por Entidad'
  },
  hasDemanda:true
};

var HLM_SEDE33 = {
  kpis: [
    {v:'1.602', l:'Llamadas Ingresadas', cls:''},
    {v:'90%', l:'Nivel Atencion Llamadas', cls:'kpi-green'},
    {v:'1.467', l:'Llamadas Contestadas', cls:''},
    {v:'135', l:'Llamadas Abandonadas', cls:'kpi-red'},
    {v:'6.704', l:'Llamadas Salida', cls:''},
    {v:'362', l:'WhatsApp Salida', cls:''},
    {v:'288', l:'Total Agendas', cls:'kpi-pur'},
    {v:'1:44', l:'AHT Promedio', cls:'kpi-org'}
  ],
  dias: ['1/6','2/6','3/6','4/6','5/6','6/6','9/6','10/6','11/6','12/6','13/6','16/6','17/6','18/6','19/6','20/6','22/6','23/6','24/6','25/6','26/6','27/6','30/6'],
  llIng: [83,79,104,106,81,21,81,69,103,103,11,81,72,82,80,21,68,93,47,68,56,17,76],
  contPct: [99,92,97,94,84,100,96,97,95,94,82,100,97,98,84,76,87,94,100,76,68,88,80],
  abanPct: [1,8,3,6,16,0,4,3,5,6,18,0,3,2,16,24,13,6,0,24,32,12,20],
  ahtSec: [112,111,89,96,90,79,111,124,90,95,77,99,101,79,92,118,139,89,94,88,155,124,150],

  diasSalida: ['1/6','2/6','3/6','4/6','5/6','9/6','10/6','11/6','12/6','13/6','16/6','17/6','18/6','19/6','20/6','22/6','23/6','24/6','25/6','26/6','27/6','30/6'],
  wppIng: [419,373,376,427,389,367,391,298,403,36,390,366,353,246,135,267,335,305,368,175,96,189],

  diasWpp: ['1/6','2/6','3/6','4/6','5/6','9/6','10/6','11/6','12/6','13/6','16/6','17/6','18/6','19/6','22/6','23/6','24/6','25/6','26/6','30/6'],
  wppSal: [49,54,59,44,10,54,6,10,4,1,4,10,4,3,4,6,16,16,3,5],

  diasAg: ['1/6','2/6','3/6','4/6','5/6','9/6','10/6','11/6','12/6','13/6','16/6','17/6','18/6','19/6','22/6','23/6','24/6','25/6','26/6','27/6','30/6'],
  agTot: [14,14,11,5,3,15,12,10,35,8,46,23,10,4,10,10,8,11,19,1,19],

  tipLbl: ['NO_CONTESTAN','CONFIRMACION_CITA','TRANSFERENCIA_AGENTE','INFORMACION_GENERAL','AGENDA_InConexion','FALLA_EN_LINEA','PACIENTE_CUELGA_LA_LLAMADA','CITA_CANCELADA'],
  tipVal: [52,27,10,5,3,1,1,1],

  entLlLbl: ['SAVIA_SALUD','COOSALUD','NUEVA_EPS','SURA','SOAT'],
  entLlVal: [7804,258,22,7,1],

  titles: {
    llIng:'Tendencia Llamadas Ingresadas — Total: 1.602 (69/dia)',
    contPct:'% Llamadas Contestadas — Promedio: 90% | Total: 1.467',
    abanPct:'% Llamadas Abandonadas — Total: 135',
    wppIng:'Total Llamadas de Salida (Confirmac./Agend./Inasist.) — Total: 6.704',
    agWpp:'WhatsApp de Salida (Confirmac./Agend./Inasist.) — Total: 362',
    agLl:'Cantidad de Agendas via Llamada y WhatsApp — Total: 288',
    agTot:'Cantidad de Agendas por Dia — Total: 288',
    aht:'AHT Hospital La Maria Sede 33 — Promedio: 1:44',
    tip:'Tipificacion Sede 33 — Llamadas de Entrada y Salida',
    entLl:'Flujo de Llamadas Identificadas por Entidad — Sede 33',
    entWpp:''
  },
  hasDemanda:false
};

var _hc = {};
var _htab = 'llamadas';
var _hsede = 'castilla';

function HLM_D(){ return _hsede==='castilla' ? HLM_CASTILLA : HLM_SEDE33; }

function openHLM(){
  document.getElementById('hlm-overlay').classList.add('show');
  renderHLMKpis();
  updateHLMTabVisibility();
  setTimeout(renderHLMCurrentTab,120);
}
function closeHLM(){
  document.getElementById('hlm-overlay').classList.remove('show');
  Object.keys(_hc).forEach(function(k){ try{_hc[k].destroy();}catch(e){} delete _hc[k]; });
}
document.getElementById('hlm-overlay').addEventListener('click',function(e){ if(e.target===this) closeHLM(); });

function onHLMSedeChange(){
  _hsede = document.getElementById('hlm-sede-sel').value;
  var sub = document.getElementById('hlm-sub-label');
  var labels = {castilla:'Sede Castilla', sede33:'Sede 33'};
  if(sub) sub.textContent = 'Informe Cierre Junio 2026 — ' + labels[_hsede];
  renderHLMKpis();
  updateHLMTabVisibility();
  if(_htab==='demanda' && !HLM_D().hasDemanda) switchHLMTab('llamadas'); else {
    Object.keys(_hc).forEach(function(k){ try{_hc[k].destroy();}catch(e){} delete _hc[k]; });
    setTimeout(renderHLMCurrentTab,80);
  }
}
function updateHLMTabVisibility(){
  var btn = document.getElementById('htab-btn-demanda');
  if(btn) btn.style.display = HLM_D().hasDemanda ? '' : 'none';
  var wppNote = document.getElementById('hlm-title-entWpp');
  var wppCard = wppNote ? wppNote.closest('.aurora-card') : null;
  if(wppCard) wppCard.style.display = (_hsede==='castilla') ? '' : 'none';
}
function renderHLMKpis(){
  var strip = document.getElementById('hlm-kpis-strip');
  strip.innerHTML = HLM_D().kpis.map(function(k){
    return '<div class="aurora-kpi '+k.cls+'"><div class="kv">'+k.v+'</div><div class="kl">'+k.l+'</div></div>';
  }).join('');
}
function switchHLMTab(t){
  _htab = t;
  document.querySelectorAll('#hlm-modal .atab').forEach(function(el){ el.classList.toggle('atab-active', el.dataset.htab===t); });
  document.querySelectorAll('#hlm-modal .atab-panel').forEach(function(el){ el.classList.toggle('visible', el.id==='hpanel-'+t); });
  Object.keys(_hc).forEach(function(k){ try{_hc[k].destroy();}catch(e){} delete _hc[k]; });
  setTimeout(renderHLMCurrentTab,80);
}
function renderHLMCurrentTab(){ renderHLMTab(_htab); }

function hmk(id,cfg){
  var el=document.getElementById(id); if(!el) return;
  if(_hc[id]) try{_hc[id].destroy();}catch(e){}
  _hc[id]=new Chart(el,cfg);
}
function loPct2(xrot){
  var o=lo(null,xrot);
  o.plugins.datalabels.formatter=function(v){return v+'%';};
  o.scales.y.ticks.callback=function(v){return v+'%';};
  return o;
}
function hSetTitle(id,text){ var el=document.getElementById(id); if(el && text) el.textContent = text; }
function hFmtTime(v){ var m=Math.floor(v/60),s=v%60; return m+':'+(s<10?'0':'')+s; }

function renderHLMTab(t){
  var D=HLM_D();
  if(t==='llamadas'){
    hSetTitle('hlm-title-llIng', D.titles.llIng);
    hSetTitle('hlm-title-contPct', D.titles.contPct);
    hSetTitle('hlm-title-abanPct', D.titles.abanPct);
    hSetTitle('hlm-title-wppIng', D.titles.wppIng);
    hmk('hch-ll-ing',{type:'line',data:{labels:D.dias,datasets:[{label:'Llamadas Ingresadas',data:D.llIng,borderColor:CD,backgroundColor:'rgba(13,74,94,0.08)',tension:0.3,pointRadius:2,borderWidth:2,fill:true}]},options:lo(null,60)});
    hmk('hch-ll-cont',{type:'line',data:{labels:D.dias,datasets:[{label:'% Contestadas',data:D.contPct,borderColor:CG,backgroundColor:'rgba(39,174,96,0.08)',tension:0.3,pointRadius:2,borderWidth:2,fill:true}]},options:loPct2(60)});
    hmk('hch-ll-aban',{type:'line',data:{labels:D.dias,datasets:[{label:'% Abandonadas',data:D.abanPct,borderColor:CR,backgroundColor:'rgba(231,76,60,0.08)',tension:0.3,pointRadius:2,borderWidth:2,fill:true}]},options:loPct2(60)});
    var wDias = D.diasSalida || D.dias;
    hmk('hch-wpp-ing',{type:'line',data:{labels:wDias,datasets:[{label:'WhatsApp / Salida',data:D.wppIng,borderColor:CM,backgroundColor:'rgba(26,122,158,0.08)',tension:0.3,pointRadius:2,borderWidth:2,fill:true}]},options:lo(null,60)});
  }
  else if(t==='agendamiento'){
    hSetTitle('hlm-title-agWpp', D.titles.agWpp);
    hSetTitle('hlm-title-agLl', D.titles.agLl);
    hSetTitle('hlm-title-agTot', D.titles.agTot);
    hSetTitle('hlm-title-aht', D.titles.aht);
    if(D.agWpp){
      hmk('hch-ag-wpp',{type:'line',data:{labels:D.dias,datasets:[{label:'Agendas WhatsApp',data:D.agWpp,borderColor:CM,backgroundColor:'rgba(26,122,158,0.08)',tension:0.3,pointRadius:2,borderWidth:2,fill:true}]},options:lo(null,60)});
      hmk('hch-ag-ll',{type:'line',data:{labels:D.dias,datasets:[{label:'Agendas Llamada',data:D.agLl,borderColor:CD,backgroundColor:'rgba(13,74,94,0.08)',tension:0.3,pointRadius:2,borderWidth:2,fill:true}]},options:lo(null,60)});
    } else {
      hmk('hch-ag-wpp',{type:'line',data:{labels:D.diasWpp,datasets:[{label:'WhatsApp Salida',data:D.wppSal,borderColor:CM,backgroundColor:'rgba(26,122,158,0.08)',tension:0.3,pointRadius:2,borderWidth:2,fill:true}]},options:lo(null,60)});
      hmk('hch-ag-ll',{type:'line',data:{labels:D.diasSalida,datasets:[{label:'Llamadas Salida',data:D.wppIng,borderColor:CD,backgroundColor:'rgba(13,74,94,0.08)',tension:0.3,pointRadius:2,borderWidth:2,fill:true}]},options:lo(null,60)});
    }
    var agDias = D.diasAg || D.dias;
    hmk('hch-ag-tot',{type:'line',data:{labels:agDias,datasets:[{label:'Total Agendas',data:D.agTot,borderColor:CG,backgroundColor:'rgba(39,174,96,0.1)',tension:0.3,pointRadius:3,borderWidth:2.5,fill:true}]},options:lo(null,60)});
    hmk('hch-aht',{type:'line',data:{labels:D.dias,datasets:[{label:'AHT (seg)',data:D.ahtSec,borderColor:CO,backgroundColor:'rgba(230,126,34,0.08)',tension:0.3,pointRadius:2,borderWidth:2,fill:true}]},
      options:(function(){var o=lo(null,60); o.plugins.datalabels.formatter=function(v){return hFmtTime(v);}; o.scales.y.ticks.callback=function(v){return hFmtTime(v);}; return o;})()
    });
  }
  else if(t==='tipificacion'){
    hSetTitle('hlm-title-tip', D.titles.tip);
    hmk('hch-tip',{type:'doughnut',data:{labels:D.tipLbl,datasets:[{data:D.tipVal,backgroundColor:PC}]},options:loPie()});
  }
  else if(t==='demanda'){
    if(!D.hasDemanda) return;
    hmk('hch-ivr',{type:'bar',data:{labels:D.ivrLbl,datasets:[{label:'Llamadas IVR sin agenda',data:D.ivrVal,backgroundColor:CR,borderRadius:3}]},options:loBar()});
    hmk('hch-demanda-esp',{type:'bar',data:{labels:D.demandaEspLbl,datasets:[
      {label:'Llamadas',data:D.demandaLl,backgroundColor:CD,borderRadius:3},
      {label:'WhatsApp',data:D.demandaWpp,backgroundColor:CM,borderRadius:3}
    ]},options:loBar()});
  }
  else if(t==='entidades'){
    hSetTitle('hlm-title-entLl', D.titles.entLl);
    hSetTitle('hlm-title-entWpp', D.titles.entWpp);
    hmk('hch-ent-ll',{type:'doughnut',data:{labels:D.entLlLbl,datasets:[{data:D.entLlVal,backgroundColor:PC}]},options:loPie()});
    if(D.entWppLbl){
      hmk('hch-ent-wpp',{type:'doughnut',data:{labels:D.entWppLbl,datasets:[{data:D.entWppVal,backgroundColor:PC}]},options:loPie()});
    }
  }
}

// ═══════════════════════════════════════════════════════════
// MODULO DE CALIDAD — evaluacion por campana (arranca con ORLANT)
