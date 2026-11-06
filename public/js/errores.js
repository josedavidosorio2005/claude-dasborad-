// errores.js — Fase 284 (pedido de Edwin, 06/11): pestaña «Errores» (errores de
// agendamiento), panel "errores_panel". Modelo de Edwin («FLUJO ERRORES POR MES»):
// arriba la linea con los errores por mes (etiqueta en cada punto, sigue a MESES);
// abajo, el «Plan de acción» del mes y «Errores por asesor» del mes (nombre real con
// los alias de Usuarios del sistema), con «Ver observación» en cada error.
// El supervisor del cliente y el administrador ven «Agregar errores»: mes, asesora
// (lista de las asesoras del cliente), cantidad (1 = un error individual) y
// observacion; editar y borrar; y el «Plan de acción» del mes. El cliente solo mira.
// Todo sale de /calidad/errores (server/errores.js). Sin datos de pacientes.
'use strict';

var _errDatos = {};   // por campaña: ultima respuesta de /calidad/errores
var _errEstado = {};  // por campaña: { mes, clave } (mes que se mira abajo; clave = MESES aplicado)
var _errCtx = {};     // por campaña: { p, i }

function _errMesLbl(m) { return typeof mesNombreLargo === 'function' ? mesNombreLargo(m) : m; }
function _errHoyMes() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }

// Meses de la linea: los que tienen datos, filtrados por MESES (sin marcar = todos).
function erroresMesesVisibles(meses, marcados) {
  var m = (meses || []).slice().sort();
  return marcados && marcados.length ? m.filter(function (x) { return marcados.indexOf(x) !== -1; }) : m;
}

async function _erroresRenderPanel(p, i) {
  var host = document.getElementById('gd-p' + i); if (!host) return;
  var camp = p.campana;
  _errCtx[camp] = { p: p, i: i };
  host.innerHTML = '<div class="aurora-card"><div class="aurora-card-title">' + esc(p.titulo || 'Errores de agendamiento') + '</div><div class="loading-state"><span class="spinner" aria-hidden="true"></span>Cargando…</div></div>';
  var d = null;
  try { d = await apiRequest('GET', '/calidad/errores?campana=' + encodeURIComponent(camp)); } catch (e) { d = null; }
  if (!d) { host.innerHTML = '<div class="aurora-card"><div class="gd-vacio">No se pudieron leer los errores.</div></div>'; return; }
  _errDatos[camp] = d;
  _erroresPintar(camp);
}

function _erroresPintar(camp) {
  var c = _errCtx[camp], d = _errDatos[camp]; if (!c || !d) return;
  var host = document.getElementById('gd-p' + c.i); if (!host) return;
  var marcados = (typeof _gdMeses === 'function') ? _gdMeses().slice().sort() : [];
  var visibles = erroresMesesVisibles(d.meses, marcados);
  var clave = marcados.join(',') || 'todos';
  var st = _errEstado[camp];
  if (!st || st.clave !== clave || visibles.indexOf(st.mes) === -1) st = _errEstado[camp] = { clave: clave, mes: visibles[visibles.length - 1] || '' };
  var cs = esc(camp);
  var boton = d.puedeEditar ? '<button type="button" class="btn-primary err-agregar" data-camp="' + cs + '" onclick="erroresAbrirEditor(this.dataset.camp)">Agregar errores</button>' : '';
  var cab = '<div class="aurora-card-title err-cab"><span>Flujo de errores por mes</span>' + boton + '</div>';
  if (!visibles.length) {
    host.innerHTML = '<div class="aurora-card">' + cab + '<div class="gd-vacio" role="status">' +
      (d.meses.length ? 'No hay errores registrados en los meses elegidos.' : 'Todavía no hay errores registrados.' + (d.puedeEditar ? ' Usa «Agregar errores» para registrar los del mes.' : '')) + '</div></div>';
    return;
  }
  var mesSel = st.mes;
  var plan = d.planes[mesSel];
  var filas = (d.porAsesor[mesSel] || []);
  var selMes = '<label class="ca-filtro err-mes">Mes <select data-camp="' + cs + '" onchange="erroresElegirMes(this.dataset.camp, this.value)">' +
    visibles.slice().reverse().map(function (m) { return '<option value="' + esc(m) + '"' + (m === mesSel ? ' selected' : '') + '>' + esc(_errMesLbl(m)) + '</option>'; }).join('') + '</select></label>';
  var tabla = filas.length ? '<div style="overflow-x:auto"><table class="aurora-rank-table err-tabla"><tr><th>Asesora</th><th>Errores</th><th>Observación</th></tr>' + filas.map(function (a) {
    var obs = a.registros.map(function (r) {
      return '<button type="button" class="btn-sm err-ver" data-camp="' + cs + '" data-id="' + r.id + '" onclick="erroresVerObservacion(this.dataset.camp, +this.dataset.id)"' + (r.observacion ? '' : ' disabled title="Sin observación"') + '>Ver observación' + (a.registros.length > 1 ? ' (' + r.cantidad + ')' : '') + '</button>';
    }).join(' ');
    return '<tr><td><b>' + esc(textoFormatoNombre(a.asesor)) + '</b></td><td>' + a.errores + '</td><td class="err-obs">' + obs + '</td></tr>';
  }).join('') + '</table></div>' : '<p class="ca-vacio">Sin errores registrados en ' + esc(_errMesLbl(mesSel)) + '.</p>';
  host.innerHTML =
    '<div class="aurora-card">' + cab + '<div class="aurora-chart-wrap err-chart"><canvas id="err-c-' + c.i + '"></canvas></div></div>' +
    '<div class="err-mes-fila">' + selMes + '</div>' +
    '<div class="cmp-duo">' +
      '<div class="aurora-card"><div class="aurora-card-title">Plan de acción · ' + esc(_errMesLbl(mesSel)) + '</div>' +
        (plan && plan.texto ? '<div class="err-plan">' + esc(plan.texto) + '</div><p class="cpl-ayuda">Actualizado por ' + esc(plan.actualizadoPorNombre) + ' · ' + esc(plan.actualizadoEn) + '</p>' : '<p class="ca-vacio">Sin plan de acción para este mes.</p>') + '</div>' +
      '<div class="aurora-card"><div class="aurora-card-title">Errores por asesor · ' + esc(_errMesLbl(mesSel)) + '</div>' + tabla + '</div>' +
    '</div>';
  _erroresGrafica(c.i, d, visibles);
}

function _erroresGrafica(i, d, visibles) {
  if (typeof _gdChart !== 'function' || typeof lo !== 'function') return;
  var por = {}; d.porMes.forEach(function (x) { por[x.mes] = x.errores; });
  var o = lo(null, 40);
  o.plugins.legend = { display: false };
  o.plugins.datalabels.formatter = function (v) { return v; };
  o.scales.y.beginAtZero = true;
  o.scales.y.ticks.precision = 0;
  o.scales.x.offset = true;
  o.layout = { padding: { top: 24, right: 16, left: 6 } };
  _gdChart('err-c-' + i, { type: 'line', data: { labels: visibles.map(_errMesLbl), datasets: [{ label: 'Errores', data: visibles.map(function (m) { return por[m] || 0; }),
    borderColor: CM, backgroundColor: CM, borderWidth: 2.5, tension: 0, pointRadius: 4.5, pointBackgroundColor: CHART_DL_BG, pointBorderWidth: 2 }] }, options: o });
}

function erroresElegirMes(camp, mes) { if (_errEstado[camp]) _errEstado[camp].mes = mes; _erroresPintar(camp); }

// ── Dialogo (dentro del tablero) ──
function _errDialogo() {
  var ov = document.getElementById('err-ov');
  if (!ov) {
    ov = document.createElement('div');
    ov.className = 'cc2-ov'; ov.id = 'err-ov'; ov.hidden = true;
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-labelledby', 'err-ov-t');
    ov.innerHTML = '<div class="cc2-dlg ca-dlg-ancho"><h3 id="err-ov-t"></h3><div id="err-ov-b"></div><div class="modal-btns"><button type="button" class="btn-cancel" onclick="erroresCerrar()">Cerrar</button></div></div>';
    ov.addEventListener('click', function (e) { if (e.target === ov) erroresCerrar(); });
  }
  var host = document.getElementById('gd-overlay') || document.body;
  if (ov.parentNode !== host) host.appendChild(ov);
  return ov;
}
var _errFoco = null;
function _errAbrir(titulo, html) {
  var ov = _errDialogo();
  if (ov.hidden) _errFoco = document.activeElement;
  document.getElementById('err-ov-t').textContent = titulo;
  document.getElementById('err-ov-b').innerHTML = html;
  ov.hidden = false;
  var f = ov.querySelector('select, input, textarea, button'); if (f) f.focus();
}
function erroresCerrar() {
  var ov = document.getElementById('err-ov'); if (ov) ov.hidden = true;
  if (_errFoco && _errFoco.focus) _errFoco.focus();
}
if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('keydown', function (e) {
    var ov = document.getElementById('err-ov');
    if (e.key === 'Escape' && ov && !ov.hidden) { e.stopPropagation(); erroresCerrar(); }
  }, true);
}

function _errRegistro(camp, id) {
  var d = _errDatos[camp]; if (!d) return null;
  var out = null;
  Object.keys(d.porAsesor).forEach(function (m) { d.porAsesor[m].forEach(function (a) { a.registros.forEach(function (r) { if (r.id === id) out = r; }); }); });
  return out;
}
function erroresVerObservacion(camp, id) {
  var r = _errRegistro(camp, id); if (!r) return;
  _errAbrir('Observación · ' + textoFormatoNombre(r.asesor) + ' · ' + _errMesLbl(r.mes),
    '<p class="err-plan">' + esc(r.observacion || 'Sin observación.') + '</p>' +
    '<p class="cpl-ayuda">' + r.cantidad + ' error' + (r.cantidad === 1 ? '' : 'es') + ' · registrado por ' + esc(r.creadoPorNombre) + ' · ' + esc(r.creadoEn) +
    (r.editadoEn ? ' · editado por ' + esc(r.editadoPorNombre) + ' · ' + esc(r.editadoEn) : '') + '</p>');
}

// Editor: agregar / editar / borrar errores y el plan de accion del mes.
var _errEd = { camp: null, mes: '', id: null, asesoras: [] };
async function erroresAbrirEditor(camp, mes) {
  var st = _errEstado[camp] || {};
  _errEd = { camp: camp, mes: mes || st.mes || _errHoyMes(), id: null, asesoras: [] };
  try { _errEd.asesoras = ((await apiRequest('GET', '/calidad/errores/asesoras?campana=' + encodeURIComponent(camp))) || {}).asesoras || []; } catch (e) { _errEd.asesoras = []; }
  _errAbrir('Agregar errores · ' + camp, '<div id="err-ed"></div>');
  _errPintarEditor();
}
function _errPintarEditor(mensaje) {
  var host = document.getElementById('err-ed'); if (!host) return;
  var d = _errDatos[_errEd.camp] || { porAsesor: {}, planes: {} };
  var edit = _errEd.id ? _errRegistro(_errEd.camp, _errEd.id) : null;
  var regs = []; (d.porAsesor[_errEd.mes] || []).forEach(function (a) { a.registros.forEach(function (r) { regs.push(r); }); });
  regs.sort(function (a, b) { return a.id - b.id; });
  var plan = (d.planes[_errEd.mes] || {}).texto || '';
  var asesoras = _errEd.asesoras.slice();
  if (edit && asesoras.indexOf(edit.asesor) === -1) asesoras.unshift(edit.asesor);
  host.innerHTML =
    (mensaje ? '<p class="err-msg" role="status">' + esc(mensaje) + '</p>' : '') +
    '<div class="ca-filtros err-form">' +
      '<label class="ca-filtro">Mes <input type="month" id="err-f-mes" value="' + esc(_errEd.mes) + '" onchange="erroresCambiaMesEditor(this.value)"></label>' +
      '<label class="ca-filtro">Asesora <select id="err-f-asesor">' + (asesoras.length ? asesoras.map(function (a) { return '<option value="' + esc(a) + '"' + (edit && edit.asesor === a ? ' selected' : '') + '>' + esc(textoFormatoNombre(a)) + '</option>'; }).join('') : '<option value="">Sin asesoras: regístralas en Usuarios del sistema</option>') + '</select></label>' +
      '<label class="ca-filtro">Cantidad <input type="number" id="err-f-cant" min="1" max="500" step="1" value="' + (edit ? edit.cantidad : 1) + '" inputmode="numeric"></label>' +
    '</div>' +
    '<p class="cpl-ayuda">Cantidad 1 = un error individual. Para varios errores iguales, pon la cantidad y una sola observación.</p>' +
    '<label class="ca-filtro err-obs-campo">Observación <textarea id="err-f-obs" maxlength="1000" rows="3" placeholder="Qué pasó (sin nombres, documentos ni teléfonos de pacientes)">' + esc(edit ? edit.observacion : '') + '</textarea></label>' +
    '<div class="modal-btns" style="justify-content:flex-start">' +
      '<button type="button" class="btn-primary" onclick="erroresGuardarError()">' + (edit ? 'Guardar cambios' : 'Agregar error') + '</button>' +
      (edit ? '<button type="button" class="btn-cancel" onclick="_errEd.id=null;_errPintarEditor()">Cancelar edición</button>' : '') + '</div>' +
    '<h4 class="err-sub">Errores de ' + esc(_errMesLbl(_errEd.mes)) + ' (' + regs.length + ')</h4>' +
    (regs.length ? '<div style="overflow-x:auto"><table class="aurora-rank-table"><tr><th>Asesora</th><th>Cantidad</th><th>Observación</th><th>Registro</th><th></th></tr>' + regs.map(function (r) {
      return '<tr><td>' + esc(textoFormatoNombre(r.asesor)) + '</td><td>' + r.cantidad + '</td><td class="ca-mot">' + esc(r.observacion || '—') + '</td><td class="cpl-ayuda">' + esc(r.creadoPorNombre) + (r.editadoPorNombre ? ' (editó ' + esc(r.editadoPorNombre) + ')' : '') + '</td>' +
        '<td style="white-space:nowrap"><button type="button" class="btn-sm" onclick="erroresEditar(' + r.id + ')">Editar</button> <button type="button" class="btn-sm err-borrar" data-id="' + r.id + '" onclick="erroresBorrar(this)">Borrar</button></td></tr>';
    }).join('') + '</table></div>' : '<p class="ca-vacio">Sin errores en este mes.</p>') +
    '<h4 class="err-sub">Plan de acción de ' + esc(_errMesLbl(_errEd.mes)) + '</h4>' +
    '<textarea id="err-f-plan" class="err-plan-campo" aria-label="Plan de acción del mes" maxlength="4000" rows="4" placeholder="Qué se va a hacer este mes para corregir los errores">' + esc(plan) + '</textarea>' +
    '<div class="modal-btns" style="justify-content:flex-start"><button type="button" class="btn-primary" onclick="erroresGuardarPlan()">Guardar plan de acción</button></div>';
}
function erroresCambiaMesEditor(v) { if (/^\d{4}-\d{2}$/.test(v)) { _errEd.mes = v; _errEd.id = null; _errPintarEditor(); } }
function erroresEditar(id) { var r = _errRegistro(_errEd.camp, id); if (!r) return; _errEd.id = id; _errEd.mes = r.mes; _errPintarEditor(); }
async function _errRecargar(mensaje) {
  try { _errDatos[_errEd.camp] = await apiRequest('GET', '/calidad/errores?campana=' + encodeURIComponent(_errEd.camp)); } catch (e) {}
  // La pestaña muestra el mes que se acaba de registrar (si esta entre los de MESES).
  if (_errEstado[_errEd.camp]) _errEstado[_errEd.camp].mes = _errEd.mes;
  _erroresPintar(_errEd.camp);
  _errPintarEditor(mensaje);
}
async function erroresGuardarError() {
  var cuerpo = { mes: document.getElementById('err-f-mes').value, asesor: document.getElementById('err-f-asesor').value,
    cantidad: parseInt(document.getElementById('err-f-cant').value, 10), observacion: document.getElementById('err-f-obs').value };
  if (!cuerpo.asesor) { showToast('Elige la asesora', 'error'); return; }
  if (!(cuerpo.cantidad >= 1)) { showToast('La cantidad debe ser 1 o más', 'error'); return; }
  try {
    if (_errEd.id) await apiRequest('PUT', '/calidad/errores/' + _errEd.id, cuerpo);
    else await apiRequest('POST', '/calidad/errores', Object.assign({ campana: _errEd.camp }, cuerpo));
  } catch (e) { showToast(e.message, 'error'); return; }
  var era = !!_errEd.id; _errEd.id = null; _errEd.mes = cuerpo.mes;
  await _errRecargar(era ? 'Error actualizado.' : 'Error agregado.');
}
async function erroresBorrar(btn) {
  if (btn.dataset.armado !== '1') { btn.dataset.armado = '1'; btn.textContent = '¿Borrar?'; setTimeout(function () { if (btn.isConnected) { btn.dataset.armado = ''; btn.textContent = 'Borrar'; } }, 3500); return; }
  try { await apiRequest('DELETE', '/calidad/errores/' + btn.dataset.id); } catch (e) { showToast(e.message, 'error'); return; }
  _errEd.id = null;
  await _errRecargar('Error borrado.');
}
async function erroresGuardarPlan() {
  try { await apiRequest('PUT', '/calidad/errores/plan', { campana: _errEd.camp, mes: _errEd.mes, texto: document.getElementById('err-f-plan').value }); }
  catch (e) { showToast(e.message, 'error'); return; }
  await _errRecargar('Plan de acción guardado.');
}

// Exportar: errores por mes y por asesora del mes que se mira (sin las observaciones).
function erroresFilasExport(camp) {
  var d = _errDatos[camp]; if (!d) return [];
  var marcados = (typeof _gdMeses === 'function') ? _gdMeses().slice().sort() : [];
  var vis = erroresMesesVisibles(d.meses, marcados);
  var mes = (_errEstado[camp] || {}).mes || vis[vis.length - 1];
  var por = {}; d.porMes.forEach(function (x) { por[x.mes] = x.errores; });
  return [
    { titulo: 'Flujo de errores por mes', tipo: 'tabla', filas: vis.map(function (m) { return { Mes: _errMesLbl(m), Errores: por[m] || 0 }; }) },
    { titulo: 'Errores por asesor · ' + (mes ? _errMesLbl(mes) : ''), tipo: 'tabla', filas: ((d.porAsesor[mes] || [])).map(function (a) { return { Asesora: a.asesor, Errores: a.errores }; }) },
  ];
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { erroresMesesVisibles: erroresMesesVisibles };
}
