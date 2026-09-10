// gestion-humana.js — InConexion Platform. Modulo de Gestion Humana (Fase 10).
// Registro de personal por campana. Alimenta el dashboard GESTION_HUMANA
// (rotacion, ingresos/salidas por mes, costo de nomina, rentabilidad por campana).
// Se carga como <script src> global y en orden; funciones globales.
// Todo valor de datos en innerHTML pasa por esc() (ver public/js/esc.js).

var _ghPersonal = [];
var _ghResumen = null;
var _ghEditId = null;

// ── CARGA ──────────────────────────────────────────────────
async function loadGhData(){
  try{ _ghPersonal = (await apiRequest('GET','/gh/personal')) || []; }
  catch(e){ _ghPersonal = []; showToast('Error cargando personal: '+e.message); }
  try{ _ghResumen = await apiRequest('GET','/gh/resumen'); }
  catch(e){ _ghResumen = null; }
}

// ── SECCION (panel admin) + OVERLAY (roles no-admin) ───────
async function renderGestionHumanaSection(){
  await loadGhData();
  renderGhStats();
  renderGhTabla();
}

// Overlay usado desde el dashboard de un usuario con rol GESTION_HUMANA.
async function openGestionHumana(){
  if(!(isFullAdmin() || (currentUser && currentUser.perms && currentUser.perms.GestionHumana))){
    showToast('No tienes acceso al modulo de Gestion Humana'); return;
  }
  document.getElementById('gestionhumana-overlay').classList.add('show');
  await loadGhData();
  renderGhStats();
  renderGhTabla();
}
function closeGestionHumana(){ document.getElementById('gestionhumana-overlay').classList.remove('show'); }
document.getElementById('gestionhumana-overlay').addEventListener('click',function(e){ if(e.target===this) closeGestionHumana(); });

function _ghSetHtml(ids, html){
  ids.forEach(function(id){ var el=document.getElementById(id); if(el) el.innerHTML=html; });
}

function renderGhStats(){
  var r = _ghResumen;
  if(!r){ return; }
  var costo = Number(r.costoNominaMes || 0).toLocaleString('es-CO');
  var html =
    '<div class="stat-card"><div class="stat-num">'+r.activos+'</div><div class="stat-label">Personal activo</div></div>'+
    '<div class="stat-card" style="border-left-color:#e67e22"><div class="stat-num">'+r.retirados+'</div><div class="stat-label">Retirados</div></div>'+
    '<div class="stat-card" style="border-left-color:#8e44ad"><div class="stat-num">'+r.campanas+'</div><div class="stat-label">Campanas</div></div>'+
    '<div class="stat-card" style="border-left-color:#27ae60"><div class="stat-num">$'+costo+'</div><div class="stat-label">Costo nomina / mes</div></div>';
  _ghSetHtml(['gh-admin-stats','gh-ov-kpis'], html);
}

function renderGhTabla(){
  var rows = _ghPersonal.slice().sort(function(a,b){
    return (a.campana||'').localeCompare(b.campana||'') || (a.nombre||'').localeCompare(b.nombre||'');
  });
  var html = '<tr><th>Nombre</th><th>Cargo</th><th>Campana</th><th>Ingreso</th><th>Salida</th><th>Estado</th><th>Costo/mes</th><th></th></tr>';
  if(rows.length === 0){
    html += '<tr><td colspan="8" style="text-align:center;color:#7a9ba8">Sin personal registrado. Agrega la primera persona.</td></tr>';
  } else {
    rows.forEach(function(p){
      var estado = p.activo
        ? '<span class="kpi-green" style="font-weight:600">Activo</span>'
        : '<span class="kpi-red" style="font-weight:600">Retirado</span>';
      var costo = p.costo_mes ? '$'+Number(p.costo_mes).toLocaleString('es-CO') : '-';
      html += '<tr>'+
        '<td><strong>'+esc(p.nombre)+'</strong>'+(p.documento?'<br><span style="font-size:0.74rem;color:#7a9ba8">'+esc(p.documento)+'</span>':'')+'</td>'+
        '<td>'+esc(p.cargo||'-')+'</td>'+
        '<td>'+esc(p.campana)+'</td>'+
        '<td>'+esc(p.fecha_ingreso)+'</td>'+
        '<td>'+esc(p.fecha_salida||'-')+'</td>'+
        '<td>'+estado+'</td>'+
        '<td>'+costo+'</td>'+
        '<td><button class="btn-sm btn-edit" onclick="ghEditarPersona('+p.id+')">Editar</button> '+
        '<button class="btn-sm btn-delete" onclick="ghEliminarPersona('+p.id+')">Eliminar</button></td></tr>';
    });
  }
  _ghSetHtml(['gh-admin-tbody','gh-ov-table'], html);
}

// ── MODAL ──────────────────────────────────────────────────
function _ghSetForm(p){
  document.getElementById('gh-nombre').value = p ? p.nombre : '';
  document.getElementById('gh-documento').value = p ? (p.documento||'') : '';
  document.getElementById('gh-cargo').value = p ? (p.cargo||'') : '';
  document.getElementById('gh-campana').value = p ? p.campana : '';
  document.getElementById('gh-supervisor').value = p ? (p.supervisor||'') : '';
  document.getElementById('gh-ingreso').value = p ? p.fecha_ingreso : '';
  document.getElementById('gh-salida').value = p ? (p.fecha_salida||'') : '';
  document.getElementById('gh-motivo').value = p ? (p.motivo_salida||'') : '';
  document.getElementById('gh-costo-hora').value = p ? p.costo_hora : '';
  document.getElementById('gh-horas-mes').value = p ? p.horas_mes : 192;
  document.getElementById('gh-salario').value = (p && p.salario!=null) ? p.salario : '';
  document.getElementById('gh-observaciones').value = p ? (p.observaciones||'') : '';
}

function ghNuevaPersona(){
  _ghEditId = null;
  document.getElementById('gh-modal-title').textContent = 'Nueva persona';
  _ghSetForm(null);
  document.getElementById('gh-person-modal').classList.add('show');
}

function ghEditarPersona(id){
  var p = _ghPersonal.find(function(x){ return x.id===id; });
  if(!p){ showToast('Persona no encontrada'); return; }
  _ghEditId = id;
  document.getElementById('gh-modal-title').textContent = 'Editar persona';
  _ghSetForm(p);
  document.getElementById('gh-person-modal').classList.add('show');
}

function closeGhPersonModal(){ document.getElementById('gh-person-modal').classList.remove('show'); }

async function ghGuardarPersona(){
  var body = {
    nombre: document.getElementById('gh-nombre').value.trim(),
    documento: document.getElementById('gh-documento').value.trim(),
    cargo: document.getElementById('gh-cargo').value.trim(),
    campana: document.getElementById('gh-campana').value.trim() || 'General',
    supervisor: document.getElementById('gh-supervisor').value.trim(),
    fecha_ingreso: document.getElementById('gh-ingreso').value,
    fecha_salida: document.getElementById('gh-salida').value || null,
    motivo_salida: document.getElementById('gh-motivo').value.trim(),
    costo_hora: Number(document.getElementById('gh-costo-hora').value) || 0,
    horas_mes: Number(document.getElementById('gh-horas-mes').value) || 192,
    observaciones: document.getElementById('gh-observaciones').value.trim()
  };
  var sal = document.getElementById('gh-salario').value;
  if(sal !== '') body.salario = Number(sal) || 0;
  if(!body.nombre){ showToast('El nombre es obligatorio'); return; }
  if(!body.fecha_ingreso){ showToast('La fecha de ingreso es obligatoria'); return; }
  var btn = document.querySelector('#gh-person-modal .btn-primary');
  try{
    await withButtonLoading(btn, 'Guardando...', function(){
      return _ghEditId
        ? apiRequest('PUT','/gh/personal/'+_ghEditId, body)
        : apiRequest('POST','/gh/personal', body);
    });
  }catch(e){ showToast(e.message); return; }
  showToast(_ghEditId ? 'Persona actualizada' : 'Persona agregada');
  closeGhPersonModal();
  await loadGhData();
  renderGhStats();
  renderGhTabla();
}

async function ghEliminarPersona(id){
  var p = _ghPersonal.find(function(x){ return x.id===id; });
  if(!p) return;
  if(!confirm('Eliminar a "'+p.nombre+'" del registro de personal? Esto borra su historial de ingreso/salida.')) return;
  try{ await apiRequest('DELETE','/gh/personal/'+id); }
  catch(e){ showToast(e.message); return; }
  showToast('Persona eliminada');
  await loadGhData();
  renderGhStats();
  renderGhTabla();
}
