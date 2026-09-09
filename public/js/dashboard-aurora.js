// dashboard-aurora.js — InConexion Platform. Extraído de index.html (antes un único <script>).
// Se carga como <script src> global y en orden; todas las funciones son globales
// y se invocan desde manejadores del HTML. No cambiar el orden de carga.

// CLINICA AURORA DASHBOARD
// ═══════════════════════════════════════════════════════════
var AURORA_DATA = {
  dias: ['1/6','2/6','3/6','4/6','5/6','6/6','9/6','10/6','11/6','12/6','13/6','16/6','17/6','18/6','19/6','20/6','22/6','23/6','24/6','25/6','26/6','27/6','30/6'],
  llamDia:  [52,37,50,51,28,9,72,36,58,45,9,40,47,36,39,7,62,33,46,36,48,4,64],
  contPct:  [98,97,100,96,100,100,94,97,95,89,87,95,100,94,92,71,97,100,97,97,92,100,95],
  abanPct:  [2,3,0,4,0,0,6,3,5,13,11,5,0,6,8,29,3,3,3,0,8,0,5],
  ahtSec:   [199,232,196,183,168,176,170,197,185,224,196,190,177,186,192,255,206,188,188,158,184,181,165],
  wppDia:   [69,72,49,38,38,17,81,54,49,21,8,70,66,56,55,9,78,59,46,42,44,13,78],
  agLl:     [39,15,33,16,17,4,38,19,27,26,7,30,33,16,22,5,29,33,30,26,26,9,25],
  agWpp:    [48,34,41,17,29,8,52,29,33,25,5,46,31,35,40,4,43,41,25,28,24,7,43],
  agTot:    [87,49,74,33,46,12,90,48,60,51,12,76,64,51,62,9,72,74,55,54,50,16,68],
  wolkvoxM: ['nov-25','dic-25','ene-26','feb-26','mar-26','abr-26','may-26','jun-26'],
  wolkvoxV: [888,931,1444,1462,1142,1246,1144,1213],
  espLbl:   ['Dermat.Gral','Derm/Cir.Mohs','Radiologia','Derm.Oncol','Derm.Estetica','Med.Soporte','Derm.Pediatr','Aux.Enferm','Med.Altern','Cosmetol'],
  espVal:   [1136,120,81,54,50,32,27,19,11,4],
  asesLbl:  ['Natalia Quintero','Camila Mendoza','Johana Zapata','Mariana Sanchez','Anabel Botero'],
  asesVal:  [582,456,440,47,9],
  inasistM: ['Enero','Febrero','Marzo','Abril','Mayo','Junio'],
  inasistV: [3.2,3.9,2.5,1.5,1.8,2.3],
  inasistEspLbl: ['Med.Altern','Derm.Gral','Derm.Estetica','Med.Soporte','Anestesiologia','Aux.Enferm','Derm.Oncol','Radiologia','Derm/Cir.Mohs','Cosmetol','Derm.Pediatr','Enfermero'],
  inasistEspVal: [7.1,5.5,3.4,2.9,2.8,1.7,1.7,1.6,1.2,0,0,0],
  tipLeLbl: ['AGENDA_INCONEXION','ESCALAR_PROGRAMACION','PACIENTE_NO_TOMA','INFO_GENERAL','CONF_CITA','OTROS'],
  tipLeVal: [37,12,9,8,7,27],
  tipLsLbl: ['NO_CONTESTAN','CONFIRMACION_CITA','AGENDA_INCONEXION','PACIENTE_NO_TOMA','OTROS'],
  tipLsVal: [53,32,6,3,6],
  tipWeLbl: ['AGENDA_INCONEXION','NO_CONTESTAN','PACIENTE_NO_TOMA','CONF_CITA','INFO_GENERAL','OTROS'],
  tipWeVal: [44,13,9,8,7,19],
  tipWsLbl: ['CONFIRMACION_CITA','AGENDA_INCONEXION','CITA_CANCELADA','NO_CONTESTAN','OTROS'],
  tipWsVal: [83,6,5,3,3],
  encLbl: ['Leido','Entregado','Fallido'],
  encVal: [78,17,5],
  salLlDias: ['1/6','2/6','3/6','4/6','5/6','6/6','9/6','10/6','11/6','12/6','13/6','16/6','17/6','18/6','19/6','20/6','22/6','23/6','24/6','25/6','26/6','27/6','30/6'],
  salLlVal:  [170,182,222,105,175,31,163,165,96,150,46,144,178,130,158,24,133,161,146,153,139,55,150],
  salWppDias:['1/6','2/6','3/6','4/6','5/6','8/6','9/6','10/6','11/6','12/6','13/6','15/6','16/6','17/6','18/6','19/6','21/6','22/6','23/6','24/6','25/6','26/6','27/6','29/6','30/6'],
  salWppVal: [223,206,172,190,100,74,3,242,123,147,7,2,169,196,147,132,81,3,153,198,122,168,132,51,3,45],
  mgrM: ['oct-25','nov-25','dic-25','ene-26','feb-26','mar-26','abr-26','may-26','jun-26'],
  mgrV: [18,904,955,1394,1597,1624,1688,1505,1534],
  mgrPct: [null,null,6,46,15,2,4,-11,2],
  errM: ['oct-25','nov-25','dic-25','ene-26','feb-26','mar-26','abr-26','may-26','jun-26'],
  errV: [5,6,2,5,7,1,3,8,12],
  histM: ['oct-25','nov-25','dic-25','ene-26','feb-26','mar-26','abr-26','may-26','jun-26'],
  histLl:  [151,1008,822,1071,1043,923,1001,860,909],
  histWpp: [0,1972,834,1256,1188,1126,1306,1129,1112],
  histTot: [151,2980,1656,2327,2231,2049,2307,1989,2021],
  sabFechas: ['6/6','13/6','20/6','27/6'],
  sabLl:  [9,9,7,4],
  sabWpp: [17,8,9,13]
};

var _ac = {};
var _tab = 'llamadas';

function openAurora(){
  document.getElementById('aurora-overlay').classList.add('show');
  setTimeout(renderCurrentTab,120);
}

function onAuroraMonthChange(){
  // Currently only Jun-26 is available. When more months are added,
  // this will filter the data arrays to the selected month's slice.
  var sel = document.getElementById('aurora-month-sel').value;
  var labels = {'jun-26':'Junio 2026'};
  var sub = document.getElementById('aurora-sub-label');
  if(sub) sub.textContent = 'Informe ' + (labels[sel]||sel) + ' — Clinica Aurora';
  // Destroy and re-render charts
  Object.keys(_ac).forEach(function(k){ try{_ac[k].destroy();}catch(e){} delete _ac[k]; });
  setTimeout(renderCurrentTab, 80);
}
function closeAurora(){
  document.getElementById('aurora-overlay').classList.remove('show');
  Object.keys(_ac).forEach(function(k){ try{_ac[k].destroy();}catch(e){} delete _ac[k]; });
}
document.getElementById('aurora-overlay').addEventListener('click',function(e){ if(e.target===this) closeAurora(); });

function switchTab(t){
  _tab = t;
  document.querySelectorAll('#aurora-modal .atab').forEach(function(el){ el.classList.toggle('atab-active', el.dataset.tab===t); });
  document.querySelectorAll('#aurora-modal .atab-panel').forEach(function(el){ el.classList.toggle('visible', el.id==='panel-'+t); });
  Object.keys(_ac).forEach(function(k){ try{_ac[k].destroy();}catch(e){} delete _ac[k]; });
  setTimeout(renderCurrentTab,80);
}
function renderCurrentTab(){ renderTab(_tab); }

// ═══════════════════════════════════════════════════════════
