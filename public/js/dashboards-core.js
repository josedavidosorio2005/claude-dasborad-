// dashboards-core.js — InConexion Platform. Extraído de index.html (antes un único <script>).
// Se carga como <script src> global y en orden; todas las funciones son globales
// y se invocan desde manejadores del HTML. No cambiar el orden de carga.

// USER DASHBOARD
// ═══════════════════════════════════════════════════════════
function renderDashGrid(){
  var grid=document.getElementById('dash-grid');
  grid.innerHTML=DASH_MODULES.map(function(m){
    var enabled=currentUser&&currentUser.perms[m.key]===true;
    // 3 estados distintos y reconocibles:
    //  - soon      -> módulo aún no construido: atenuado + "Próximamente" (sí clicable, explica)
    //  - sin acceso -> el rol no tiene permiso: atenuado + "Sin acceso" (no clicable)
    //  - normal     -> disponible
    var cls='dash-btn '+m.cls;
    var corner='';
    if(m.soon){ cls+=' mod-soon'; corner='<div class="dash-soon">Proximamente</div>'; }
    else if(!enabled){ cls+=' disabled-btn'; corner='<div class="dash-lock">Sin acceso</div>'; }
    return '<div class="'+cls+'" onclick="onDashBtn(\''+m.key+'\')">'+corner+
      '<div class="dash-icon">'+m.icon+'</div>'+
      '<div class="dash-label">'+m.label+'</div>'+
      '<div class="dash-sub">'+m.sub+'</div></div>';
  }).join('');
}

function onDashBtn(key){
  var m=DASH_MODULES.find(function(x){return x.key===key;});
  if(m&&m.soon){
    showToast('El modulo '+m.label+' todavia no esta disponible. Te avisaremos cuando este listo.');
    return;
  }
  if(key==='ClientesDash'){openClientsModal();return;}
  if(key==='Calidad'){openCalidad();return;}
  showToast('El modulo '+(m?m.label:key)+' todavia no esta disponible.');
}

function openClientsModal(){
  var grid=document.getElementById('clients-grid');
  var html='';
  for(var i=0;i<CLIENTES_LIST.length;i++){
    var c=CLIENTES_LIST[i];
    var hasPerm=!currentUser||currentUser.perms['cliente_'+c]!==false;
    var built=BUILT_CLIENT_DASHBOARDS.indexOf(c)!==-1;
    var cls='client-card';
    var tag='';
    if(!hasPerm){ cls+=' client-locked'; tag='<div class="client-lock-label">Sin acceso</div>'; }
    else if(!built){ cls+=' client-soon'; tag='<div class="client-soon-label">Proximamente</div>'; }
    // Se deja clicable salvo cuando no hay permiso: al pulsar un "próximamente" se explica el estado.
    var clickable=hasPerm;
    html+='<div class="'+cls+'"'+(clickable?' data-cliente="'+c+'" onclick="openClientByEl(this)"':'')+'>'+
      '<div class="client-name">'+c+'</div>'+tag+'</div>';
  }
  grid.innerHTML=html||'<div class="empty-state"><div class="es-icon">&#128193;</div>'+
    '<div class="es-title">Sin clientes asignados</div>'+
    '<div class="es-hint">Solicita al administrador acceso a los clientes que necesitas consultar.</div></div>';
  document.getElementById('clients-modal-overlay').classList.add('show');
}
function closeClientsModal(){document.getElementById('clients-modal-overlay').classList.remove('show');}
function openClientByEl(el){
  var c = el.dataset.cliente;
  if (c === 'CLINICA AURORA') { openAurora(); return; }
  if (c === 'ORLANT') { openOrlant(); return; }
  if (c === 'HOSPITAL LA MARIA') { openHLM(); return; }
  showToast('El dashboard de '+c+' esta en preparacion. Pronto lo veras aqui.');
}
document.getElementById('clients-modal-overlay').addEventListener('click',function(e){if(e.target===this)closeClientsModal();});

// ═══════════════════════════════════════════════════════════
