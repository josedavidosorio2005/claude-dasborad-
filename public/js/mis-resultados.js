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
  if(typeof gdEtiquetarCanvasChart === 'function') gdEtiquetarCanvasChart(_mrc[id]);
}
// Fase 136 (PR 7, F09): alterna entre el <canvas> real y un mensaje "Sin
// datos de <etiqueta> todavia." -- mismo texto que ya usa
// dashboard-generic.js para el resto de la plataforma (_gdAvisoSinDatos
// MesHtml), para que un hueco en blanco nunca se vea distinto segun la
// vista. Reconstruye el <canvas> con el MISMO id al volver a haber
// datos (si no, mrmk() no encontraria el elemento la proxima vez).
function mrMostrarSinDatosOCanvas(canvasId, hayDatos, etiqueta){
  var host = document.getElementById(canvasId);
  var wrap = host ? host.parentElement : document.querySelector('[data-mr-wrap-de="'+canvasId+'"]');
  if(!wrap) return;
  if(hayDatos){
    if(!document.getElementById(canvasId)){
      wrap.innerHTML = '<canvas id="'+canvasId+'"></canvas>';
    }
  } else {
    if(_mrc[canvasId]){ try{_mrc[canvasId].destroy();}catch(e){} delete _mrc[canvasId]; }
    wrap.setAttribute('data-mr-wrap-de', canvasId);
    wrap.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--c-text-muted);font-size:var(--fs-small);text-align:center;padding:0 16px">Sin datos de '+esc(etiqueta)+' todavia.</div>';
  }
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

// ═══════════════════════════════════════════════════════════
// Fase 95 (tema C): alerta de "monitoreo nuevo" al asesor. Se carga al
// entrar al portal (enterAsesorPage, session.js) -- esta app no persiste
// la sesion entre recargas (el token vive solo en memoria, ver api.js),
// asi que "al iniciar sesion" y "al recargar la app" son, en la practica,
// el mismo momento: cada recarga vuelve a la pantalla de login.
// ═══════════════════════════════════════════════════════════
var _misMonitoreosNuevos = 0;
async function calCargarAlertaNuevos(){
  try{
    var r = await apiRequest('GET','/monitoreos/mios/nuevos');
    _misMonitoreosNuevos = (r && r.count) || 0;
  }catch(e){ _misMonitoreosNuevos = 0; }
  renderAlertaNuevos();
}
function renderAlertaNuevos(){
  var banner = document.getElementById('asesor-alerta-nuevos');
  var badge = document.getElementById('asesor-menu-calidad-badge');
  if(!banner) return;
  if(_misMonitoreosNuevos > 0){
    var texto = document.getElementById('asesor-alerta-nuevos-texto');
    var plural = _misMonitoreosNuevos===1 ? '' : 's';
    if(texto) texto.textContent = 'Tienes '+_misMonitoreosNuevos+' monitoreo'+plural+' nuevo'+plural+' de calidad';
    banner.classList.remove('hidden');
    if(badge){ badge.textContent = _misMonitoreosNuevos; badge.classList.remove('hidden'); }
  } else {
    banner.classList.add('hidden');
    if(badge) badge.classList.add('hidden');
  }
}
function asesorVerAlertaNuevos(){
  showAsesorSection('calidad');
}
// Se llama al abrir el detalle de un monitoreo (verDetalleMonitoreo, abajo).
// Si ya estaba marcado, el servidor no hace nada (idempotente) -- igual se
// vuelve a pedir el contador por si este era el ultimo nuevo pendiente.
async function marcarMonitoreoVisto(id){
  try{ await apiRequest('PUT','/monitoreos/'+id+'/visto'); }catch(e){ return; }
  await calCargarAlertaNuevos();
}

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

  var promColorMr = promedio>=90?'verde':promedio>=70?'amarillo':'rojo';
  var promClsMr = promColorMr==='verde'?'kpi-green':promColorMr==='amarillo'?'kpi-org':'kpi-red';
  // "Clasificacion General" ya trae su propio icono+palabra (clasifGeneral,
  // arriba) -- WCAG 1.4.1 ya esta cubierto ahi, sin badge para no duplicar.
  document.getElementById('mr-kpis').innerHTML =
    '<div class="aurora-kpi"><div class="kv">'+total+'</div><div class="kl">Monitoreos Realizados'+(_mrMesFiltro?' ('+_mrMesFiltro+')':'')+'</div></div>'+
    '<div class="aurora-kpi '+promClsMr+'"><div class="kv">'+((typeof semaforoBadgeHtml === 'function')?semaforoBadgeHtml(promColorMr):'')+(total?promedio:'—')+'</div><div class="kl">Puntaje Promedio</div></div>'+
    '<div class="aurora-kpi '+promClsMr+'"><div class="kv" style="font-size:1rem">'+calEstadoHtml(clasifGeneral)+'</div><div class="kl">Clasificacion General</div></div>'+
    '<div class="aurora-kpi kpi-red"><div class="kv">'+fallosTotal+'</div><div class="kl">Total Fallos Criticos</div></div>';

  // Fase 136 (PR 7, F09 de la auditoria de la Fase 135): sin monitoreos,
  // un doughnut de 3 valores en 0 no dibuja ningun sector -- quedaba un
  // area en blanco sin explicacion, distinto del resto de la plataforma
  // (que SI avisa "Sin datos..." en ese caso, ver dashboard-generic.js
  // _gdAvisoSinDatosMesHtml). Mismo texto/patron, aplicado aqui porque
  // esta vista (portal Asesor) no pasa por ese motor de paneles.
  mrMostrarSinDatosOCanvas('mr-ch-clasif', total > 0, 'Distribucion de Clasificacion');
  if (total > 0) {
    mrmk('mr-ch-clasif',{type:'doughnut',data:{labels:['Sobresaliente','No Critico','Critico'],datasets:[{data:[sobresaliente,noCritico,critico],backgroundColor:[CG,CO,CR]}]},options:loDatalabelsAuto(loPie())});
  }

  var labels = arr.map(function(m,i){ return m.fecha || ('#'+(i+1)); });
  var puntajes = arr.map(function(m){ return m.puntaje; });
  mrmk('mr-ch-tendencia',{type:'line',data:{labels:labels.length?labels:['Sin datos'],datasets:[{label:'Puntaje',data:puntajes.length?puntajes:[0],borderColor:CM,backgroundColor:'rgba(26,122,158,0.1)',tension:0.3,pointRadius:4,borderWidth:2.5,fill:true}]},options:loDatalabelsAuto(lo(null,50))});

  mrRenderPorMesYReforzar(allArr, arr); // Fase 256

  var rows = arr.slice().reverse();
  _misMonitoreosList = rows;
  var html = '<tr><th>Fecha</th><th>Campana</th><th>Evaluador</th><th>Puntaje</th><th>Clasificacion</th><th>Nivel Critico</th><th></th></tr>';
  if(rows.length===0){
    html += '<tr><td colspan="7" style="text-align:center;color:var(--c-text-muted)">'+(_mrMesFiltro?'No tienes monitoreos en '+_mrMesFiltro:'Aun no tienes monitoreos de calidad registrados')+'</td></tr>';
  } else {
    rows.forEach(function(m,i){
      html += '<tr><td>'+esc(m.fecha||'-')+'</td><td>'+esc(m.campana)+'</td><td>'+esc(m.evaluador||'-')+'</td><td class="peak">'+m.puntaje+'</td><td>'+calEstadoHtml(m.clasificacion)+'</td><td>'+calEstadoHtml(m.nivelCritico)+'</td>'+
        '<td><button class="btn-sm btn-edit" onclick="verDetalleMonitoreo('+i+')">Ver Detalle</button></td></tr>';
    });
  }
  document.getElementById('mr-table').innerHTML = html;
}

function closeDetalleMonitoreo(){
  var cerrarReal = function(){ document.getElementById('detalle-monitoreo-overlay').classList.remove('show'); };
  if (typeof motionCerrarModal === 'function') motionCerrarModal('detalle-monitoreo-modal', cerrarReal);
  else cerrarReal();
}
document.getElementById('detalle-monitoreo-overlay').addEventListener('click',function(e){ if(e.target===this) closeDetalleMonitoreo(); });

function verDetalleMonitoreo(idx){
  var m = _misMonitoreosList[idx];
  if(!m) return;
  document.getElementById('dm-asesor').textContent = m.asesor ? textoFormatoNombre(m.asesor) : '-';
  document.getElementById('dm-fecha').textContent = m.fecha || '-';
  document.getElementById('dm-campana').textContent = m.campana || '-';
  document.getElementById('dm-evaluador').textContent = m.evaluador || '-';
  document.getElementById('dm-idllamada').textContent = m.idLlamada || '-';
  document.getElementById('dm-telefono').textContent = m.telefono || '-';
  document.getElementById('dm-codificacion').textContent = m.codificacion || '-';
  document.getElementById('dm-canal').innerHTML = calEstadoHtml(m.canal==='WPP' ? '💬 WhatsApp / Chat' : '📞 Llamada');
  document.getElementById('dm-observaciones').textContent = m.observaciones || '-';

  document.getElementById('dm-preview').innerHTML =
    '<div class="qi-pill"><div class="qv">'+m.puntaje+'</div><div class="ql">PUNTAJE OBTENIDO</div></div>'+
    '<div class="qi-pill"><div class="qv" style="font-size:0.95rem">'+calEstadoHtml(m.clasificacion)+'</div><div class="ql">CLASIFICACION</div></div>'+
    '<div class="qi-pill"><div class="qv">'+m.fallos+'</div><div class="ql"># FALLOS CRITICOS</div></div>'+
    '<div class="qi-pill"><div class="qv" style="font-size:0.85rem">'+calEstadoHtml(m.nivelCritico)+'</div><div class="ql">NIVEL CRITICO</div></div>';

  // Fase 256: la plantilla con la que se hizo el monitoreo (version incluida); si no, la principal.
  var plM = (typeof caPlantillaDe === 'function' && typeof CAL_PLANTILLAS_TODAS !== 'undefined') ? caPlantillaDe(m, CAL_PLANTILLAS_TODAS) : null;
  var items = (plM && plM.items) || (CAL_PLANTILLAS[m.campana] && CAL_PLANTILLAS[m.campana].items) || [];
  var answers = m.answers || {};
  var cats = [];
  items.forEach(function(it){ if(cats.indexOf(it.cat)===-1) cats.push(it.cat); });
  var html = '';
  cats.forEach(function(cat){
    html += '<div class="qi-cat-header">'+esc(cat)+'</div>';
    items.filter(function(it){return it.cat===cat;}).forEach(function(it){
      var a = answers[it.n] || '';
      // Fase 322: en una plantilla de descuento, la opcion elegida con su texto y el impacto del item.
      var opc = (it.opciones || []).filter(function(o){ return o.v===a; })[0];
      var textoResp = opc ? opc.t : (a||'—');
      var badgeCls = a==='SI' ? 'qi-answer-si' : (a==='NO' || (opc && opc.descuento)) ? 'qi-answer-no' : a==='N/A' ? 'qi-answer-na' : 'qi-answer-blank';
      var desc = plM && plM.engine==='descuento' && typeof cc2SubItem==='function';
      html += '<div class="qi-row">'+
        '<div class="qi-label">'+(it.critico?'<span class="qi-crit">&#9888;</span>':'')+esc(it.n)+'. '+esc(it.label)+'<span class="qi-weight">('+esc(desc ? cc2SubItem(it, 'descuento') : it.weight+'%')+')</span></div>'+
        '<span class="qi-answer-badge '+badgeCls+'">'+esc(textoResp)+'</span></div>';
    });
  });
  var motivoM = m.extras && (m.extras.motivo || m.extras.motivoTexto); // Fase 322: + motivo en texto libre (SURA)
  document.getElementById('dm-items-wrap').innerHTML = (motivoM ? '<p class="mr-motivo"><strong>Motivo de afectación:</strong> '+esc(motivoM)+'</p>' : '') + html;

  document.getElementById('detalle-monitoreo-overlay').classList.add('show');
  if (typeof motionAbrirModal === 'function') motionAbrirModal('detalle-monitoreo-modal');
  marcarMonitoreoVisto(m.id);
}

// Fase 256 (plan de Calidad B5, como "Mis resultados" del HTML de Edwin):
// calificacion por mes (todos los meses) e items a reforzar del periodo
// elegido -- los que mas fallo el asesor, con la descripcion del diccionario.
function mrRenderPorMesYReforzar(todos, delPeriodo){
  var pm = document.getElementById('mr-por-mes');
  var rf = document.getElementById('mr-reforzar');
  if(!pm || !rf || typeof caPorMes !== 'function') return;
  var meses = caPorMes(todos).slice().reverse();
  pm.innerHTML = meses.length ? '<div style="overflow-x:auto"><table class="aurora-rank-table mr-mes-tabla"><tr><th>Mes</th><th>Monitoreos</th><th>Promedio</th><th>Clasificación</th></tr>' + meses.map(function(x){
    return '<tr><td>'+esc(typeof mesNombreLargo === 'function' ? mesNombreLargo(x.mes) : x.mes)+'</td><td>'+x.monitoreos+'</td><td>'+x.promedio+'%</td><td><span class="cc2-pill cc2-'+x.clase.k+'">'+esc(x.clase.t)+'</span></td></tr>';
  }).join('') + '</table></div>' : '<p class="ca-vacio">Aún no tienes monitoreos.</p>';
  var pls = typeof CAL_PLANTILLAS_TODAS !== 'undefined' ? CAL_PLANTILLAS_TODAS : [];
  var porPl = {};
  (delPeriodo || []).forEach(function(m){ var p = caPlantillaDe(m, pls); if(p){ (porPl[p.id] = porPl[p.id] || { p: p, arr: [] }).arr.push(m); } });
  var grupos = Object.keys(porPl).map(function(k){ return porPl[k]; }).sort(function(a, b){ return b.arr.length - a.arr.length; });
  var lista = [];
  grupos.forEach(function(g){ caItemsAfectados(g.arr, g.p.items).forEach(function(x){ if(x.fallos > 0) lista.push(x); }); });
  lista.sort(function(a, b){ return b.fallos - a.fallos; });
  rf.innerHTML = lista.length ? '<ul class="mr-reforzar">' + lista.slice(0, 8).map(function(x){
    return '<li><details><summary><span>'+esc(x.it.n+'. '+x.it.label)+(x.it.critico ? ' ⚠' : '')+'</span><span class="mr-reforzar-n">'+x.fallos+(x.fallos === 1 ? ' vez' : ' veces')+'</span></summary>' +
      (x.it.descripcion ? '<p>'+esc(x.it.descripcion)+'</p>' : '') + (x.it.vinetas && x.it.vinetas.length ? '<ul>'+x.it.vinetas.map(function(v){ return '<li>'+esc(v)+'</li>'; }).join('')+'</ul>' : '') + '</details></li>';
  }).join('') + '</ul>' : '<p class="ca-vacio">'+((delPeriodo || []).length ? '¡Muy bien! No fallaste ningún ítem en este periodo.' : 'Sin monitoreos en este periodo.')+'</p>';
}
