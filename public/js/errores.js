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

function _errMarcados() { return (typeof _gdMeses === 'function') ? _gdMeses().slice().sort() : []; }
function _errClave() { return _errMarcados().join(',') || 'todos'; }
// Fase 286: el mes que se acaba de guardar no se ve porque MESES (arriba) tiene
// marcados otros meses: se avisa, con un boton para ver todos los meses.
function erroresAvisoFueraDeMeses(avisoMes, visibles, marcados) {
  return !!(avisoMes && marcados && marcados.length && visibles.indexOf(avisoMes) === -1);
}

function _erroresPintar(camp) {
  var c = _errCtx[camp], d = _errDatos[camp]; if (!c || !d) return;
  var host = document.getElementById('gd-p' + c.i); if (!host) return;
  var marcados = _errMarcados();
  var visibles = erroresMesesVisibles(d.meses, marcados);
  var clave = marcados.join(',') || 'todos';
  var st = _errEstado[camp];
  var avisoMes = (st && st.clave === clave) ? (st.avisoMes || '') : '';
  if (!st || st.clave !== clave || visibles.indexOf(st.mes) === -1) st = _errEstado[camp] = { clave: clave, mes: visibles[visibles.length - 1] || '', avisoMes: avisoMes };
  var cs = esc(camp);
  var boton = d.puedeEditar ? '<button type="button" class="btn-primary err-agregar" data-camp="' + cs + '" onclick="erroresAbrirEditor(this.dataset.camp)">Agregar errores</button>' : '';
  var cab = '<div class="aurora-card-title err-cab"><span>Flujo de errores por mes</span>' + boton + '</div>';
  var aviso = erroresAvisoFueraDeMeses(avisoMes, visibles, marcados)
    ? '<p class="err-aviso" role="status"><span>Se guardó en <b>' + esc(_errMesLbl(avisoMes)) + '</b>, que no está entre los meses elegidos en «Meses» (arriba).</span> <button type="button" class="btn-sm" onclick="gdMesesTodos()">Ver todos los meses</button></p>' : '';
  if (!visibles.length) {
    host.innerHTML = '<div class="aurora-card">' + cab + aviso + '<div class="gd-vacio" role="status">' +
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
    '<div class="aurora-card">' + cab + aviso + '<div class="aurora-chart-wrap err-chart"><canvas id="err-c-' + c.i + '"></canvas></div></div>' +
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
// Fase 286 (pedido de Edwin, 07/11):
//  - Un solo «Guardar»: el error (mes, asesora, cantidad, observacion) y el plan de
//    accion del mes se guardan juntos (/calidad/errores/guardar, una transaccion).
//    Sin asesora elegida se guarda solo el plan. Lo escrito nunca se borra al redibujar.
//  - Los errores ya registrados van en una sub-pestaña aparte («Errores del mes»),
//    filtrada por el mes elegido, compacta y con scroll, con Editar y Borrar (Borrar
//    sigue pidiendo confirmacion: primer clic «¿Borrar?», segundo clic borra).
//  - Al guardar o borrar, la pestaña Errores de atras se actualiza sola.
var _errEd = { camp: null, mes: '', id: null, asesoras: [], vista: 'registrar', borrador: null, planes: {} };
async function erroresAbrirEditor(camp, mes) {
  var st = _errEstado[camp] || {};
  _errEd = { camp: camp, mes: mes || st.mes || _errHoyMes(), id: null, asesoras: [], vista: 'registrar', borrador: null, planes: {} };
  try { _errEd.asesoras = ((await apiRequest('GET', '/calidad/errores/asesoras?campana=' + encodeURIComponent(camp))) || {}).asesoras || []; } catch (e) { _errEd.asesoras = []; }
  _errAbrir('Agregar errores · ' + camp, '<div id="err-ed"></div>');
  _errPintarEditor();
}
function _errPlanGuardado(mes) { var d = _errDatos[_errEd.camp] || { planes: {} }; return ((d.planes || {})[mes] || {}).texto || ''; }
function _errRegistrosMes(mes) {
  var d = _errDatos[_errEd.camp] || { porAsesor: {} };
  var regs = []; ((d.porAsesor || {})[mes] || []).forEach(function (a) { a.registros.forEach(function (r) { regs.push(r); }); });
  return regs.sort(function (a, b) { return a.id - b.id; });
}
// Lo que hay escrito en el formulario (para no perderlo al redibujar).
function _errLeerFormulario() {
  var as = document.getElementById('err-f-asesor'); if (!as) return;
  _errEd.borrador = { asesor: as.value, cantidad: document.getElementById('err-f-cant').value, observacion: document.getElementById('err-f-obs').value };
  var pl = document.getElementById('err-f-plan'); if (pl) _errEd.planes[_errEd.mes] = pl.value;
}
function _errPintarEditor(mensaje) {
  var host = document.getElementById('err-ed'); if (!host) return;
  var edit = _errEd.id ? _errRegistro(_errEd.camp, _errEd.id) : null;
  var bo = _errEd.borrador || { asesor: '', cantidad: '1', observacion: '' };
  var regs = _errRegistrosMes(_errEd.mes);
  var plan = Object.prototype.hasOwnProperty.call(_errEd.planes, _errEd.mes) ? _errEd.planes[_errEd.mes] : _errPlanGuardado(_errEd.mes);
  var asesoras = _errEd.asesoras.slice();
  if (bo.asesor && asesoras.indexOf(bo.asesor) === -1) asesoras.unshift(bo.asesor);
  var mesLbl = esc(_errMesLbl(_errEd.mes));
  var enLista = _errEd.vista === 'lista';
  var tab = function (clave, id, texto) {
    var on = _errEd.vista === clave;
    return '<button type="button" role="tab" class="gd-subtab-btn' + (on ? ' on' : '') + '" id="err-tab-' + id + '" aria-controls="err-pan-' + id + '" aria-selected="' + on + '" tabindex="' + (on ? '0' : '-1') + '" data-vista="' + clave + '" onclick="erroresVista(this.dataset.vista)" onkeydown="erroresTeclaTab(event)">' + texto + '</button>';
  };
  host.innerHTML =
    (mensaje ? '<p class="err-msg" role="status">' + esc(mensaje) + '</p>' : '') +
    '<div class="ca-filtros err-form"><label class="ca-filtro">Mes <input type="month" id="err-f-mes" value="' + esc(_errEd.mes) + '" onchange="erroresCambiaMesEditor(this.value)"></label></div>' +
    '<div class="gd-subtabs err-tabs" role="tablist" aria-label="Errores de ' + mesLbl + '">' +
      tab('registrar', 'reg', edit ? 'Editar error' : 'Registrar') +
      tab('lista', 'lista', 'Errores del mes (' + regs.length + ')') +
    '</div>' +
    // Registrar: error + plan, un solo «Guardar».
    '<div role="tabpanel" id="err-pan-reg" aria-labelledby="err-tab-reg"' + (enLista ? ' hidden' : '') + '>' +
      '<div class="ca-filtros err-form">' +
        '<label class="ca-filtro">Asesora <select id="err-f-asesor">' +
          '<option value="">' + (asesoras.length ? '— Elige la asesora —' : 'Sin asesoras: regístralas en Usuarios del sistema') + '</option>' +
          asesoras.map(function (a) { return '<option value="' + esc(a) + '"' + (bo.asesor === a ? ' selected' : '') + '>' + esc(textoFormatoNombre(a)) + '</option>'; }).join('') +
        '</select></label>' +
        '<label class="ca-filtro">Cantidad <input type="number" id="err-f-cant" min="1" max="500" step="1" value="' + esc(String(bo.cantidad || '1')) + '" inputmode="numeric"></label>' +
      '</div>' +
      '<p class="cpl-ayuda">Cantidad 1 = un error individual. Para varios errores iguales, pon la cantidad y una sola observación.</p>' +
      '<label class="ca-filtro err-obs-campo">Observación <textarea id="err-f-obs" maxlength="1000" rows="3" placeholder="Qué pasó">' + esc(bo.observacion || '') + '</textarea></label>' +
      '<label class="ca-filtro err-obs-campo err-plan-lbl">Plan de acción de ' + mesLbl + ' <textarea id="err-f-plan" class="err-plan-campo" maxlength="4000" rows="4" placeholder="Qué se va a hacer este mes para corregir los errores">' + esc(plan) + '</textarea></label>' +
      '<p class="cpl-ayuda">«Guardar» guarda juntos el error y el plan de acción. Para guardar solo el plan, deja la asesora sin elegir.</p>' +
      '<div class="modal-btns" style="justify-content:flex-start">' +
        '<button type="button" class="btn-primary err-guardar" onclick="erroresGuardar()">Guardar</button>' +
        (edit ? '<button type="button" class="btn-cancel" onclick="erroresCancelarEdicion()">Cancelar edición</button>' : '') +
      '</div>' +
    '</div>' +
    // Errores del mes: compacto, con scroll, Editar y Borrar.
    '<div role="tabpanel" id="err-pan-lista" aria-labelledby="err-tab-lista"' + (enLista ? '' : ' hidden') + '>' +
      (regs.length ? '<div class="err-lista" tabindex="0" aria-label="Errores registrados en ' + mesLbl + '"><table class="aurora-rank-table err-lista-tabla"><thead><tr><th>Asesora</th><th>Cant.</th><th>Observación</th><th><span class="sr-only">Acciones</span></th></tr></thead><tbody>' + regs.map(function (r) {
        return '<tr><td>' + esc(textoFormatoNombre(r.asesor)) + '<div class="cpl-ayuda">' + esc(r.creadoPorNombre) + (r.editadoPorNombre ? ' (editó ' + esc(r.editadoPorNombre) + ')' : '') + '</div></td><td>' + r.cantidad + '</td><td class="ca-mot">' + esc(r.observacion || '—') + '</td>' +
          '<td class="err-acc"><button type="button" class="btn-sm" onclick="erroresEditar(' + r.id + ')">Editar</button> <button type="button" class="btn-sm err-borrar" data-id="' + r.id + '" onclick="erroresBorrar(this)">Borrar</button></td></tr>';
      }).join('') + '</tbody></table></div>' : '<p class="ca-vacio">Sin errores en ' + mesLbl + '.</p>') +
    '</div>';
}
function erroresVista(v) {
  _errLeerFormulario();
  _errEd.vista = v === 'lista' ? 'lista' : 'registrar';
  _errPintarEditor();
  var t = document.getElementById(_errEd.vista === 'lista' ? 'err-tab-lista' : 'err-tab-reg'); if (t) t.focus();
}
// Flechas izquierda/derecha, Inicio y Fin entre las 2 sub-pestañas (patron WAI-ARIA).
function erroresTeclaTab(e) {
  var k = e.key;
  if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].indexOf(k) === -1) return;
  e.preventDefault();
  var dest = (k === 'Home') ? 'registrar' : (k === 'End') ? 'lista' : (_errEd.vista === 'lista' ? 'registrar' : 'lista');
  erroresVista(dest);
}
function erroresCambiaMesEditor(v) {
  if (!/^\d{4}-\d{2}$/.test(v)) return;
  _errLeerFormulario();
  _errEd.mes = v;
  _errPintarEditor();
}
function erroresEditar(id) {
  var r = _errRegistro(_errEd.camp, id); if (!r) return;
  _errLeerFormulario();
  _errEd.id = id; _errEd.mes = r.mes; _errEd.vista = 'registrar';
  _errEd.borrador = { asesor: r.asesor, cantidad: String(r.cantidad), observacion: r.observacion || '' };
  _errPintarEditor();
  var f = document.getElementById('err-f-asesor'); if (f) f.focus();
}
function erroresCancelarEdicion() {
  _errLeerFormulario();
  _errEd.id = null; _errEd.borrador = { asesor: '', cantidad: '1', observacion: '' };
  _errPintarEditor();
}
// Vuelve a leer los errores y redibuja la pestaña de atras (sin cambiar de pestaña) y el editor.
async function _errRecargar(mensaje, mesGuardado, avisar) {
  var camp = _errEd.camp;
  try { _errDatos[camp] = await apiRequest('GET', '/calidad/errores?campana=' + encodeURIComponent(camp)); } catch (e) {}
  var st = _errEstado[camp] || (_errEstado[camp] = { clave: _errClave(), mes: '' });
  if (mesGuardado) st.mes = mesGuardado;
  st.avisoMes = avisar ? mesGuardado : '';
  _erroresPintar(camp);
  _errPintarEditor(mensaje);
}
async function erroresGuardar() {
  _errLeerFormulario();
  var bo = _errEd.borrador, mes = _errEd.mes;
  var plan = _errEd.planes[mes];
  var planCambio = plan !== undefined && plan.trim() !== _errPlanGuardado(mes).trim();
  var cuerpo = { campana: _errEd.camp, mes: mes };
  if (bo.asesor) {
    var cant = parseInt(bo.cantidad, 10);
    if (!(cant >= 1 && cant <= 500)) { showToast('La cantidad debe ser un número entre 1 y 500', 'error'); return; }
    cuerpo.error = { asesor: bo.asesor, cantidad: cant, observacion: bo.observacion };
    if (_errEd.id) cuerpo.error.id = _errEd.id;
  } else if (bo.observacion.trim() || _errEd.id) {
    showToast('Elige la asesora del error', 'error'); return;
  }
  if (planCambio) cuerpo.plan = plan;
  if (!cuerpo.error && !planCambio) { showToast('Elige la asesora o escribe el plan de acción', 'error'); return; }
  var btn = document.querySelector('#err-ed .err-guardar'); if (btn) btn.disabled = true;
  try { await apiRequest('POST', '/calidad/errores/guardar', cuerpo); }
  catch (e) { if (btn) btn.disabled = false; showToast(e.message, 'error'); return; }
  var partes = [];
  if (cuerpo.error) partes.push((_errEd.id ? 'error actualizado' : (cuerpo.error.cantidad === 1 ? '1 error' : cuerpo.error.cantidad + ' errores')) + ' de ' + textoFormatoNombre(cuerpo.error.asesor));
  if (planCambio) partes.push(plan.trim() ? 'plan de acción' : 'plan de acción borrado');
  _errEd.id = null;
  _errEd.borrador = { asesor: '', cantidad: '1', observacion: '' };
  delete _errEd.planes[mes];
  await _errRecargar('Guardado en ' + _errMesLbl(mes) + ': ' + partes.join(' y ') + '.', mes, true);
}
async function erroresBorrar(btn) {
  if (btn.dataset.armado !== '1') { btn.dataset.armado = '1'; btn.textContent = '¿Borrar?'; btn.setAttribute('aria-label', 'Confirmar: borrar este error'); setTimeout(function () { if (btn.isConnected) { btn.dataset.armado = ''; btn.textContent = 'Borrar'; btn.removeAttribute('aria-label'); } }, 3500); return; }
  var id = +btn.dataset.id;
  btn.disabled = true;
  try { await apiRequest('DELETE', '/calidad/errores/' + id); } catch (e) { btn.disabled = false; showToast(e.message, 'error'); return; }
  _errLeerFormulario();
  if (_errEd.id === id) { _errEd.id = null; _errEd.borrador = { asesor: '', cantidad: '1', observacion: '' }; }
  await _errRecargar('Error borrado.', _errEd.mes, false);
  var t = document.getElementById('err-tab-lista'); if (t) t.focus();
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
  module.exports = { erroresMesesVisibles: erroresMesesVisibles, erroresAvisoFueraDeMeses: erroresAvisoFueraDeMeses };
}
