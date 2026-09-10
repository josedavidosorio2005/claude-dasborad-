// mis-resultados.js — InConexion Platform. Extraído de index.html (antes un único <script>).
// Se carga como <script src> global y en orden; todas las funciones son globales
// y se invocan desde manejadores del HTML. No cambiar el orden de carga.

// ═══════════════════════════════════════════════════════════
// MIS RESULTADOS DE CALIDAD — rol ASESOR (consulta en tiempo real)
// ═══════════════════════════════════════════════════════════
var _mrc = {};
var _misMonitoreosList = [];
function mrmk(id,cfg){
  var el=document.getElementById(id); if(!el) return;
  if(_mrc[id]) try{_mrc[id].destroy();}catch(e){}
  _mrc[id]=new Chart(el,cfg);
}
// Los monitoreos del asesor logueado — MIGRADO A SERVIDOR: GET /api/monitoreos/mios
// (el servidor empareja por nombre y devuelve solo los del usuario autenticado).
var _misMonitoreosAll = [];
async function loadMisMonitoreos(){
  try{
    _misMonitoreosAll = (await apiRequest('GET','/monitoreos/mios')) || [];
  }catch(e){ _misMonitoreosAll = []; showToast('No se pudieron cargar tus resultados: '+e.message); }
  _misMonitoreosAll.sort(function(a,b){ return (a.fecha||'').localeCompare(b.fecha||''); });
}
function calMisMonitoreos(){ return _misMonitoreosAll; }

var _mrMesFiltro = '';
function onMrMesChange(){
  _mrMesFiltro = document.getElementById('mr-mes-sel').value;
  renderMisResultados();
}
async function renderMisResultados(){
  await calLoadPlantillas();
  await loadMisMonitoreos();
  var allArr = calMisMonitoreos();
  var mesSel = document.getElementById('mr-mes-sel');
  if(mesSel){
    var months = calAvailableMonths(allArr);
    if(_mrMesFiltro && months.indexOf(_mrMesFiltro)===-1) _mrMesFiltro = '';
    mesSel.innerHTML = calMonthSelectOptions(months, _mrMesFiltro);
    mesSel.value = _mrMesFiltro;
  }
  var arr = calFilterByMonth(allArr, _mrMesFiltro);
  var total = arr.length;
  var promedio = total ? Math.round((arr.reduce(function(a,m){return a+m.puntaje;},0)/total)*10)/10 : 0;
  var sobresaliente = arr.filter(function(m){return m.puntaje>=90;}).length;
  var noCritico = arr.filter(function(m){return m.puntaje>=70 && m.puntaje<90;}).length;
  var critico = arr.filter(function(m){return m.puntaje<70;}).length;
  var fallosTotal = arr.reduce(function(a,m){return a+(m.fallos||0);},0);
  var clasifGeneral = total===0 ? '—' : (promedio<70?'🔴 CRITICO':promedio<90?'🟡 NO CRITICO':'🟢 SOBRESALIENTE');

  document.getElementById('mr-kpis').innerHTML =
    '<div class="aurora-kpi"><div class="kv">'+total+'</div><div class="kl">Monitoreos Realizados'+(_mrMesFiltro?' ('+_mrMesFiltro+')':'')+'</div></div>'+
    '<div class="aurora-kpi '+(promedio>=90?'kpi-green':promedio>=70?'kpi-org':'kpi-red')+'"><div class="kv">'+(total?promedio:'—')+'</div><div class="kl">Puntaje Promedio</div></div>'+
    '<div class="aurora-kpi '+(promedio>=90?'kpi-green':promedio>=70?'kpi-org':'kpi-red')+'"><div class="kv" style="font-size:1rem">'+clasifGeneral+'</div><div class="kl">Clasificacion General</div></div>'+
    '<div class="aurora-kpi kpi-red"><div class="kv">'+fallosTotal+'</div><div class="kl">Total Fallos Criticos</div></div>';

  mrmk('mr-ch-clasif',{type:'doughnut',data:{labels:['Sobresaliente','No Critico','Critico'],datasets:[{data:[sobresaliente,noCritico,critico],backgroundColor:[CG,CO,CR]}]},options:loPie()});

  var labels = arr.map(function(m,i){ return m.fecha || ('#'+(i+1)); });
  var puntajes = arr.map(function(m){ return m.puntaje; });
  mrmk('mr-ch-tendencia',{type:'line',data:{labels:labels.length?labels:['Sin datos'],datasets:[{label:'Puntaje',data:puntajes.length?puntajes:[0],borderColor:CM,backgroundColor:'rgba(26,122,158,0.1)',tension:0.3,pointRadius:4,borderWidth:2.5,fill:true}]},options:lo(null,50)});

  var rows = arr.slice().reverse();
  _misMonitoreosList = rows;
  var html = '<tr><th>Fecha</th><th>Campana</th><th>Evaluador</th><th>Puntaje</th><th>Clasificacion</th><th>Nivel Critico</th><th></th></tr>';
  if(rows.length===0){
    html += '<tr><td colspan="7" style="text-align:center;color:#7a9ba8">'+(_mrMesFiltro?'No tienes monitoreos en '+_mrMesFiltro:'Aun no tienes monitoreos de calidad registrados')+'</td></tr>';
  } else {
    rows.forEach(function(m,i){
      html += '<tr><td>'+esc(m.fecha||'-')+'</td><td>'+esc(m.campana)+'</td><td>'+esc(m.evaluador||'-')+'</td><td class="peak">'+m.puntaje+'</td><td>'+m.clasificacion+'</td><td>'+m.nivelCritico+'</td>'+
        '<td><button class="btn-sm btn-edit" onclick="verDetalleMonitoreo('+i+')">Ver Detalle</button></td></tr>';
    });
  }
  document.getElementById('mr-table').innerHTML = html;
}

function closeDetalleMonitoreo(){
  document.getElementById('detalle-monitoreo-overlay').classList.remove('show');
}
document.getElementById('detalle-monitoreo-overlay').addEventListener('click',function(e){ if(e.target===this) closeDetalleMonitoreo(); });

function verDetalleMonitoreo(idx){
  var m = _misMonitoreosList[idx];
  if(!m) return;
  document.getElementById('dm-asesor').textContent = m.asesor || '-';
  document.getElementById('dm-fecha').textContent = m.fecha || '-';
  document.getElementById('dm-campana').textContent = m.campana || '-';
  document.getElementById('dm-evaluador').textContent = m.evaluador || '-';
  document.getElementById('dm-idllamada').textContent = m.idLlamada || '-';
  document.getElementById('dm-telefono').textContent = m.telefono || '-';
  document.getElementById('dm-codificacion').textContent = m.codificacion || '-';
  document.getElementById('dm-canal').textContent = m.canal==='WPP' ? '💬 WhatsApp / Chat' : '📞 Llamada';
  document.getElementById('dm-observaciones').textContent = m.observaciones || '-';

  document.getElementById('dm-preview').innerHTML =
    '<div class="qi-pill"><div class="qv">'+m.puntaje+'</div><div class="ql">PUNTAJE OBTENIDO</div></div>'+
    '<div class="qi-pill"><div class="qv" style="font-size:0.95rem">'+m.clasificacion+'</div><div class="ql">CLASIFICACION</div></div>'+
    '<div class="qi-pill"><div class="qv">'+m.fallos+'</div><div class="ql"># FALLOS CRITICOS</div></div>'+
    '<div class="qi-pill"><div class="qv" style="font-size:0.85rem">'+m.nivelCritico+'</div><div class="ql">NIVEL CRITICO</div></div>';

  var items = (CAL_PLANTILLAS[m.campana] && CAL_PLANTILLAS[m.campana].items) || [];
  var answers = m.answers || {};
  var cats = [];
  items.forEach(function(it){ if(cats.indexOf(it.cat)===-1) cats.push(it.cat); });
  var html = '';
  cats.forEach(function(cat){
    html += '<div class="qi-cat-header">'+esc(cat)+'</div>';
    items.filter(function(it){return it.cat===cat;}).forEach(function(it){
      var a = answers[it.n] || '';
      var badgeCls = a==='SI' ? 'qi-answer-si' : a==='NO' ? 'qi-answer-no' : a==='N/A' ? 'qi-answer-na' : 'qi-answer-blank';
      html += '<div class="qi-row">'+
        '<div class="qi-label">'+(it.critico?'<span class="qi-crit">&#9888;</span>':'')+esc(it.n)+'. '+esc(it.label)+'<span class="qi-weight">('+esc(it.weight)+'%)</span></div>'+
        '<span class="qi-answer-badge '+badgeCls+'">'+esc(a||'—')+'</span></div>';
    });
  });
  document.getElementById('dm-items-wrap').innerHTML = html;

  document.getElementById('detalle-monitoreo-overlay').classList.add('show');
}
