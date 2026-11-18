// activos.js — Fase 369 (E1): «Inventario de sistemas» (interfaz). Pestañas Panel, Elementos,
// Registrar y Ajustes. El servidor decide los permisos (server/activos.js: ADMIN y SISTEMAS). Todo
// texto se escapa (esc) o va por textContent.
'use strict';

var _ac = { config: null, tab: 'panel', lista: [], sel: null };
function _acEl(id) { return document.getElementById(id); }
function _acError(m) { var e = _acEl('ac-error'); e.textContent = m || ''; e.classList.toggle('hidden', !m); }
function _acEstadoNombre(c) { var e = ((_ac.config && _ac.config.estados) || []).find(function (x) { return x.codigo === c; }); return e ? e.nombre : c; }
function _acTipo(c) { return ((_ac.config && _ac.config.tipos) || []).find(function (t) { return t.codigo === c; }) || null; }
var AC_CLASE_ESTADO = { libre: 'vis-verde', en_uso: 'vis-gris', en_reparacion: 'vis-amarillo', malo: 'vis-rojo', de_baja: 'vis-gris' };

async function activosAbrir() {
  _acError('');
  try { _ac.config = await apiRequest('GET', '/activos/config'); }
  catch (e) { showToast('No se pudo abrir el Inventario de sistemas: ' + (e.message || ''), 'error'); return; }
  openModal('activos-overlay');
  activosTab('panel');
}
function activosCerrar() { closeModal('activos-overlay'); }

function activosTab(tab) {
  _ac.tab = tab;
  _acError('');
  document.querySelectorAll('[data-ac-tab]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.acTab === tab)); });
  ['panel', 'elementos', 'agentes', 'registrar', 'ajustes'].forEach(function (t) { _acEl('ac-p-' + t).classList.toggle('hidden', t !== tab); });
  if (tab === 'panel') _acPanel();
  if (tab === 'elementos') _acFiltrosYLista();
  if (tab === 'agentes') _acAgentes();
  if (tab === 'registrar') _acFormulario();
  if (tab === 'ajustes') _acAjustes();
}

// ── Panel ──
function activosPanelHtml(r, config) {
  var est = config.estados;
  var tarjetas = '<div class="ac-kpis">' + '<div class="ac-kpi"><b>' + r.total + '</b><span>Total</span></div>' +
    est.map(function (e) { return '<div class="ac-kpi"><b>' + (r.porEstado[e.codigo] || 0) + '</b><span class="vis-pill ' + AC_CLASE_ESTADO[e.codigo] + '">' + esc(e.nombre) + '</span></div>'; }).join('') + '</div>';
  if (r.agentes) tarjetas += '<p class="vis-ayuda">Agentes activos: <b>' + r.agentes.activos + '</b> · con elementos asignados: <b>' + r.agentes.conElementos + '</b></p>';
  if (!r.total) return tarjetas + '<p class="vis-vacio">Aún no hay elementos. Regístralos en «Registrar».</p>';
  var filas = config.tipos.filter(function (t) { return r.porTipo[t.codigo]; }).map(function (t) {
    var x = r.porTipo[t.codigo];
    return '<tr><th scope="row">' + esc(t.plural) + '</th>' + est.map(function (e) { return '<td class="vis-num">' + (x[e.codigo] || 0) + '</td>'; }).join('') + '</tr>';
  }).join('');
  var sedes = (r.porSede || []).map(function (s) { return '<li>' + esc(s.sede) + ': <b>' + s.n + '</b></li>'; }).join('');
  return tarjetas + '<div class="table-wrap"><table class="vis-tabla"><thead><tr><th scope="col">Tipo</th>' + est.map(function (e) { return '<th scope="col" class="vis-num">' + esc(e.nombre) + '</th>'; }).join('') + '</tr></thead><tbody>' + filas + '</tbody></table></div>' +
    (sedes ? '<h4 class="ac-sub">Por sede (sin los dados de baja)</h4><ul class="ac-sedes">' + sedes + '</ul>' : '');
}
async function _acPanel() {
  var c = _acEl('ac-p-panel');
  c.innerHTML = '<p class="vis-vacio">Cargando…</p>';
  try { c.innerHTML = activosPanelHtml(await apiRequest('GET', '/activos/resumen'), _ac.config); }
  catch (e) { c.innerHTML = ''; _acError(e.message); }
}

// ── Elementos ──
function _acOpciones(lista, sel, vacio) {
  return (vacio ? '<option value="">' + esc(vacio) + '</option>' : '') + lista.map(function (o) { var v = o.codigo || o; var n = o.plural || o.nombre || o; return '<option value="' + esc(v) + '"' + (v === sel ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('');
}
function _acFiltrosYLista() {
  _acEl('ac-f-tipo').innerHTML = _acOpciones(_ac.config.tipos, _acEl('ac-f-tipo').value, 'Todos los tipos');
  _acEl('ac-f-estado').innerHTML = _acOpciones(_ac.config.estados, _acEl('ac-f-estado').value, 'Todos los estados');
  _acEl('ac-f-sede').innerHTML = _acOpciones(_ac.config.listas.sedes, _acEl('ac-f-sede').value, 'Todas las sedes');
  activosBuscar();
}
async function activosBuscar() {
  var q = [];
  ['tipo', 'estado', 'sede'].forEach(function (k) { var v = _acEl('ac-f-' + k).value; if (v) q.push(k + '=' + encodeURIComponent(v)); });
  var t = _acEl('ac-f-q').value.trim(); if (t) q.push('q=' + encodeURIComponent(t));
  var c = _acEl('ac-lista');
  c.innerHTML = '<p class="vis-vacio">Cargando…</p>';
  try { _ac.lista = (await apiRequest('GET', '/activos' + (q.length ? '?' + q.join('&') : ''))).activos; c.innerHTML = activosListaHtml(_ac.lista, _ac.config); }
  catch (e) { c.innerHTML = ''; _acError(e.message); }
}
function activosListaHtml(lista, config) {
  if (!lista.length) return '<p class="vis-vacio">Ningún elemento coincide.</p>';
  var tipoN = function (c) { var t = config.tipos.find(function (x) { return x.codigo === c; }); return t ? t.nombre : c; };
  var estN = function (c) { var e = config.estados.find(function (x) { return x.codigo === c; }); return e ? e.nombre : c; };
  return '<div class="table-wrap"><table class="vis-tabla"><thead><tr><th scope="col">Código</th><th scope="col">Tipo</th><th scope="col">Estado</th><th scope="col">Marca / modelo</th><th scope="col">Serial</th><th scope="col">Sede</th><th scope="col">Agente</th><th scope="col"><span class="sr-only">Acciones</span></th></tr></thead><tbody>' +
    lista.map(function (a) {
      return '<tr><th scope="row">' + esc(a.codigo) + '</th><td>' + esc(tipoN(a.tipo)) + '</td><td><span class="vis-pill ' + (AC_CLASE_ESTADO[a.estado] || '') + '">' + esc(estN(a.estado)) + '</span></td><td>' + esc([a.marca, a.modelo].filter(Boolean).join(' ')) + '</td><td>' + esc(a.serial) + '</td><td>' + esc(a.sede) + '</td><td>' + esc(a.agente ? a.agente.nombre : '') + '</td>' +
        '<td><button type="button" class="btn-cancel ac-btn" onclick="activosVer(' + Number(a.id) + ')">Ver</button></td></tr>';
    }).join('') + '</tbody></table></div>';
}

// Detalle: datos, cambio de estado con motivo e historial.
async function activosVer(id) {
  _acError('');
  var r;
  try { r = await apiRequest('GET', '/activos/' + id + '/historial'); } catch (e) { _acError(e.message); return; }
  _ac.sel = r.activo;
  var a = r.activo, t = _acTipo(a.tipo) || { campos: [], nombre: a.tipo };
  var datos = t.campos.filter(function (c) { return a.datos[c.k] !== undefined; }).map(function (c) { return '<dt>' + esc(c.l) + '</dt><dd>' + esc(a.datos[c.k]) + '</dd>'; }).join('');
  var opciones = _ac.config.estados.filter(function (e) { return e.codigo !== a.estado && (e.codigo !== 'en_uso' || a.tipo === 'ADMINISTRABLE'); });
  var hist = r.historial.map(function (h) { return '<li><b>' + esc(h.accion) + '</b> · ' + esc(new Date(h.fecha).toLocaleString('es-CO', { timeZone: 'America/Bogota' })) + (h.estadoAntes && h.estadoDespues && h.estadoAntes !== h.estadoDespues ? ' · ' + esc(_acEstadoNombre(h.estadoAntes)) + ' → ' + esc(_acEstadoNombre(h.estadoDespues)) : '') + (h.motivo ? ' · ' + esc(h.motivo) : '') + ' · ' + esc(h.quien) + '</li>'; }).join('');
  _acEl('ac-detalle').innerHTML = '<section class="aurora-card"><div class="aurora-card-title">' + esc(t.nombre) + ' ' + esc(a.codigo) + ' · <span class="vis-pill ' + AC_CLASE_ESTADO[a.estado] + '">' + esc(_acEstadoNombre(a.estado)) + '</span></div>' +
    '<dl class="wv-estado"><dt>Marca</dt><dd>' + esc(a.marca || '—') + '</dd><dt>Modelo</dt><dd>' + esc(a.modelo || '—') + '</dd><dt>Serial</dt><dd>' + esc(a.serial || '—') + '</dd><dt>Sede</dt><dd>' + esc(a.sede || '—') + '</dd><dt>Operación</dt><dd>' + esc(a.operacion || '—') + '</dd><dt>Proveedor</dt><dd>' + esc(a.proveedor || '—') + '</dd>' + (a.agente ? '<dt>Asignado a</dt><dd>' + esc(a.agente.nombre) + '</dd>' : '') + datos + (a.observaciones ? '<dt>Observaciones</dt><dd>' + esc(a.observaciones) + '</dd>' : '') + '</dl>' +
    (a.agente ? '<p class="vis-ayuda">Para devolverlo o cambiarlo, ve a «Agentes» y abre a ' + esc(a.agente.nombre) + '.</p>' : '') +
    (!a.agente && a.estado !== 'de_baja' && opciones.length ? '<form class="ac-estado-form" onsubmit="activosCambiarEstado(event)"><div class="ig"><label for="ac-nuevo-estado">Cambiar estado a</label><select id="ac-nuevo-estado">' + _acOpciones(opciones) + '</select></div>' +
      '<div class="ig ac-motivo"><label for="ac-motivo">Motivo / diagnóstico</label><input type="text" id="ac-motivo" maxlength="300" placeholder="Ej.: no enciende, pantalla dañada, reparado…"></div><button type="submit" class="btn-primary">Cambiar estado</button></form>' : '') +
    '<h4 class="ac-sub">Historial</h4><ul class="ac-hist">' + hist + '</ul><div class="modal-btns"><button type="button" class="btn-cancel" onclick="activosCerrarDetalle()">Volver a la lista</button></div></section>';
  _acEl('ac-detalle').classList.remove('hidden');
  _acEl('ac-lista-zona').classList.add('hidden');
  _acEl('ac-detalle').scrollIntoView({ block: 'start' });
}
function activosCerrarDetalle() { _acEl('ac-detalle').classList.add('hidden'); _acEl('ac-lista-zona').classList.remove('hidden'); activosBuscar(); }
async function activosCambiarEstado(ev) {
  ev.preventDefault();
  _acError('');
  try {
    await apiRequest('POST', '/activos/' + _ac.sel.id + '/estado', { estado: _acEl('ac-nuevo-estado').value, motivo: _acEl('ac-motivo').value });
    showToast('Estado cambiado', 'ok');
    await activosVer(_ac.sel.id);
  } catch (e) { _acError(e.message); }
}

// ── Registrar ──
function activosCampoHtml(c) {
  var id = 'ac-d-' + c.k;
  if (c.t === 'lista') return '<div class="ig"><label for="' + id + '">' + esc(c.l) + '</label><select id="' + id + '" data-campo="' + esc(c.k) + '"><option value="">—</option>' + c.o.map(function (o) { return '<option>' + esc(o) + '</option>'; }).join('') + '</select></div>';
  return '<div class="ig"><label for="' + id + '">' + esc(c.l) + '</label><input type="' + (c.t === 'numero' ? 'number' : 'text') + '" id="' + id + '" data-campo="' + esc(c.k) + '"' + (c.t === 'numero' ? ' min="0" step="1"' : ' maxlength="120"') + '></div>';
}
function _acFormulario() {
  var sel = _acEl('ac-r-tipo');
  if (!sel.options.length) sel.innerHTML = _acOpciones(_ac.config.tipos.map(function (t) { return { codigo: t.codigo, nombre: t.nombre }; }));
  ['sede', 'operacion', 'proveedor'].forEach(function (k) {
    var l = { sede: 'sedes', operacion: 'operaciones', proveedor: 'proveedores' }[k];
    _acEl('ac-r-' + k).innerHTML = _acOpciones(_ac.config.listas[l], null, _ac.config.listas[l].length ? '—' : 'Agrega ' + l + ' en Ajustes');
  });
  activosCambioTipo();
}
function activosCambioTipo() {
  var t = _acTipo(_acEl('ac-r-tipo').value);
  _acEl('ac-r-campos').innerHTML = t ? t.campos.map(activosCampoHtml).join('') : '';
}
async function activosRegistrar(ev) {
  ev.preventDefault();
  _acError('');
  var datos = {};
  document.querySelectorAll('#ac-r-campos [data-campo]').forEach(function (el) { if (el.value !== '') datos[el.dataset.campo] = el.type === 'number' ? Number(el.value) : el.value; });
  var b = { tipo: _acEl('ac-r-tipo').value, codigo: _acEl('ac-r-codigo').value, estado: _acEl('ac-r-estado').value, marca: _acEl('ac-r-marca').value, modelo: _acEl('ac-r-modelo').value, serial: _acEl('ac-r-serial').value,
    sede: _acEl('ac-r-sede').value, operacion: _acEl('ac-r-operacion').value, proveedor: _acEl('ac-r-proveedor').value, observaciones: _acEl('ac-r-obs').value, datos: datos };
  try {
    var r = await apiRequest('POST', '/activos', b);
    showToast('Registrado: ' + r.activo.codigo, 'ok');
    _acEl('ac-r-form').reset();
    activosCambioTipo();
    _acEl('ac-r-nota').textContent = 'Se registró ' + r.activo.codigo + '. Puedes registrar el siguiente.';
  } catch (e) { _acError(e.message); }
}

// ── Ajustes: listas ──
function _acAjustes() {
  ['sedes', 'operaciones', 'proveedores'].forEach(function (l) { _acEl('ac-l-' + l).value = (_ac.config.listas[l] || []).join('\n'); });
}
async function activosGuardarLista(l) {
  _acError('');
  var valores = _acEl('ac-l-' + l).value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
  try {
    var r = await apiRequest('PUT', '/activos/listas/' + l, { valores: valores });
    _ac.config.listas[l] = r.valores;
    showToast('Lista guardada', 'ok');
  } catch (e) { _acError(e.message); }
}

// ── Agentes (Fase 370, E2): quién tiene cada elemento. Asignar, devolver y cambiar, uno por uno. ──
function _acAgentes() {
  _acEl('ac-ag-sede').innerHTML = _acOpciones(_ac.config.listas.sedes, null, '—');
  _acEl('ac-ag-operacion').innerHTML = _acOpciones(_ac.config.listas.operaciones, null, '—');
  activosCerrarAgente();
}
function activosAgentesHtml(lista) {
  if (!lista.length) return '<p class="vis-vacio">Aún no hay agentes. Agrégalos arriba.</p>';
  return '<div class="table-wrap"><table class="vis-tabla"><thead><tr><th scope="col">Agente</th><th scope="col">Documento</th><th scope="col">Sede</th><th scope="col">Operación</th><th scope="col" class="vis-num">Elementos</th><th scope="col"><span class="sr-only">Acciones</span></th></tr></thead><tbody>' +
    lista.map(function (g) {
      return '<tr><th scope="row">' + esc(g.nombre) + (g.activo ? '' : ' <span class="vis-pill vis-gris">Inactivo</span>') + '</th><td>' + esc(g.documento) + '</td><td>' + esc(g.sede) + '</td><td>' + esc(g.operacion) + '</td><td class="vis-num">' + Number(g.elementos || 0) + '</td>' +
        '<td><button type="button" class="btn-cancel ac-btn" onclick="activosVerAgente(' + Number(g.id) + ')">Ver</button></td></tr>';
    }).join('') + '</tbody></table></div>';
}
async function activosBuscarAgentes() {
  var q = [];
  var t = _acEl('ac-ag-q').value.trim(); if (t) q.push('q=' + encodeURIComponent(t));
  if (_acEl('ac-ag-todos').checked) q.push('todos=1');
  var c = _acEl('ac-ag-lista');
  c.innerHTML = '<p class="vis-vacio">Cargando…</p>';
  try { c.innerHTML = activosAgentesHtml((await apiRequest('GET', '/activos/agentes' + (q.length ? '?' + q.join('&') : ''))).agentes); }
  catch (e) { c.innerHTML = ''; _acError(e.message); }
}
async function activosCrearAgente(ev) {
  ev.preventDefault();
  _acError('');
  try {
    var r = await apiRequest('POST', '/activos/agentes', { nombre: _acEl('ac-ag-nombre').value, documento: _acEl('ac-ag-documento').value, sede: _acEl('ac-ag-sede').value, operacion: _acEl('ac-ag-operacion').value });
    showToast('Agente agregado: ' + r.agente.nombre, 'ok');
    _acEl('ac-ag-form').reset();
    activosBuscarAgentes();
  } catch (e) { _acError(e.message); }
}
function activosCerrarAgente() { _ac.agente = null; _acEl('ac-ag-detalle').classList.add('hidden'); _acEl('ac-ag-zona').classList.remove('hidden'); activosBuscarAgentes(); }
function _acFecha(x) { return new Date(x).toLocaleDateString('es-CO', { timeZone: 'America/Bogota' }); }
function _acOpcionesElem(l) { return _acOpciones(l.map(function (a) { return { codigo: String(a.id), nombre: a.codigo + (a.marca ? ' · ' + a.marca : '') }; })); }
async function activosVerAgente(id) {
  _acError('');
  var r;
  try { r = await apiRequest('GET', '/activos/agentes/' + id); } catch (e) { _acError(e.message); return; }
  _ac.agente = r;
  var g = r.agente;
  var tipoN = function (c) { var t = _acTipo(c); return t ? t.nombre : c; };
  var elems = r.elementos.length ? '<div class="table-wrap"><table class="vis-tabla"><thead><tr><th scope="col">Elemento</th><th scope="col">Marca / modelo</th><th scope="col">Serial</th><th scope="col"><span class="sr-only">Acciones</span></th></tr></thead><tbody>' +
    r.elementos.map(function (a) {
      return '<tr><th scope="row">' + esc(tipoN(a.tipo)) + ' ' + esc(a.codigo) + '</th><td>' + esc([a.marca, a.modelo].filter(Boolean).join(' ')) + '</td><td>' + esc(a.serial) + '</td>' +
        '<td><div class="ac-acciones"><button type="button" class="btn-cancel ac-btn" onclick="activosFormSoltar(' + Number(a.id) + ',\'devolver\')">Devolver</button><button type="button" class="btn-cancel ac-btn" onclick="activosFormSoltar(' + Number(a.id) + ',\'cambiar\')">Cambiar elemento</button></div></td></tr>';
    }).join('') + '</tbody></table></div>' : '<p class="vis-vacio">No tiene elementos asignados.</p>';
  var hist = r.asignaciones.map(function (s) {
    return '<li>' + esc(tipoN(s.tipo)) + ' ' + esc(s.codigo) + ' · desde ' + esc(_acFecha(s.desde)) + (s.hasta ? ' hasta ' + esc(_acFecha(s.hasta)) + (s.motivoFin ? ' · ' + esc(s.motivoFin) : '') : ' · actual') + '</li>';
  }).join('');
  var tiposAsignables = _ac.config.tipos.filter(function (t) { return t.codigo !== 'ADMINISTRABLE'; }).map(function (t) { return { codigo: t.codigo, nombre: t.nombre }; });
  _acEl('ac-ag-detalle').innerHTML = '<section class="aurora-card"><div class="aurora-card-title">' + esc(g.nombre) + (g.activo ? '' : ' · <span class="vis-pill vis-gris">Inactivo</span>') + '</div>' +
    '<dl class="wv-estado"><dt>Documento</dt><dd>' + esc(g.documento || '—') + '</dd><dt>Sede</dt><dd>' + esc(g.sede || '—') + '</dd><dt>Operación</dt><dd>' + esc(g.operacion || '—') + '</dd></dl>' +
    '<h4 class="ac-sub">Elementos asignados</h4>' + elems + '<div id="ac-soltar"></div>' +
    (g.activo ? '<form class="ac-asig-form" onsubmit="activosAsignar(event)"><div class="ig"><label for="ac-as-tipo">Asignar: tipo</label><select id="ac-as-tipo" onchange="activosLibresParaAsignar()">' + _acOpciones(tiposAsignables) + '</select></div>' +
      '<div class="ig"><label for="ac-as-elem">Elemento libre</label><select id="ac-as-elem"></select></div><button type="submit" class="btn-primary">Asignar</button></form>' : '') +
    '<h4 class="ac-sub">Historial de asignaciones</h4>' + (hist ? '<ul class="ac-hist">' + hist + '</ul>' : '<p class="vis-vacio">Sin movimientos.</p>') +
    '<div class="modal-btns">' + (g.activo ? (r.elementos.length ? '' : '<button type="button" class="btn-cancel" onclick="activosActivarAgente(false)">Marcar inactivo</button>') : '<button type="button" class="btn-cancel" onclick="activosActivarAgente(true)">Volver a activar</button>') +
    '<button type="button" class="btn-cancel" onclick="activosCerrarAgente()">Volver a la lista</button></div></section>';
  _acEl('ac-ag-zona').classList.add('hidden');
  _acEl('ac-ag-detalle').classList.remove('hidden');
  if (g.activo) activosLibresParaAsignar();
}
async function _acLibres(tipo) { return (await apiRequest('GET', '/activos?estado=libre&tipo=' + encodeURIComponent(tipo))).activos.filter(function (a) { return !a.agente; }); }
async function activosLibresParaAsignar() {
  var sel = _acEl('ac-as-elem');
  try {
    var l = await _acLibres(_acEl('ac-as-tipo').value);
    sel.innerHTML = l.length ? _acOpcionesElem(l) : '<option value="">No hay libres de este tipo</option>';
  } catch (e) { _acError(e.message); }
}
async function activosAsignar(ev) {
  ev.preventDefault();
  _acError('');
  var id = Number(_acEl('ac-as-elem').value);
  if (!id) { _acError('Elige un elemento libre'); return; }
  try {
    await apiRequest('POST', '/activos/' + id + '/asignar', { agenteId: _ac.agente.agente.id });
    showToast('Elemento asignado', 'ok');
    await activosVerAgente(_ac.agente.agente.id);
  } catch (e) { _acError(e.message); }
}
function activosCancelarSoltar() { _acEl('ac-soltar').innerHTML = ''; }
// Devolver o cambiar: cómo queda el elemento que entrega (libre, en reparación o malo) y el motivo.
async function activosFormSoltar(id, modo) {
  _acError('');
  var a = _ac.agente.elementos.find(function (x) { return x.id === id; });
  if (!a) return;
  var cambiar = modo === 'cambiar';
  var nuevos = '';
  if (cambiar) {
    var l;
    try { l = await _acLibres(a.tipo); } catch (e) { _acError(e.message); return; }
    if (!l.length) { _acError('No hay otro elemento libre de este tipo para el cambio'); return; }
    nuevos = '<div class="ig"><label for="ac-so-nuevo">Elemento nuevo</label><select id="ac-so-nuevo">' + _acOpcionesElem(l) + '</select></div>';
  }
  var estados = _ac.config.estados.filter(function (e) { return ['libre', 'en_reparacion', 'malo'].indexOf(e.codigo) !== -1; });
  _acEl('ac-soltar').innerHTML = '<form class="ac-asig-form" onsubmit="activosSoltar(event,' + Number(id) + ',\'' + (cambiar ? 'cambiar' : 'devolver') + '\')"><h5 class="ac-sub ac-form-titulo">' + (cambiar ? 'Cambiar ' : 'Devolver ') + esc(a.codigo) + '</h5>' + nuevos +
    '<div class="ig"><label for="ac-so-estado">' + esc(a.codigo) + ' queda</label><select id="ac-so-estado">' + _acOpciones(estados) + '</select></div>' +
    '<div class="ig ac-motivo"><label for="ac-so-motivo">Motivo</label><input type="text" id="ac-so-motivo" maxlength="300" placeholder="Ej.: se dañó el micrófono, retiro del agente…"></div>' +
    '<button type="submit" class="btn-primary">' + (cambiar ? 'Cambiar' : 'Devolver') + '</button><button type="button" class="btn-cancel" onclick="activosCancelarSoltar()">Cancelar</button></form>';
  _acEl('ac-so-motivo').focus();
}
async function activosSoltar(ev, id, modo) {
  ev.preventDefault();
  _acError('');
  var b = { estado: _acEl('ac-so-estado').value, motivo: _acEl('ac-so-motivo').value };
  if (modo === 'cambiar') b.nuevoId = Number(_acEl('ac-so-nuevo').value);
  try {
    await apiRequest('POST', '/activos/' + id + '/' + modo, b);
    showToast(modo === 'cambiar' ? 'Elemento cambiado' : 'Elemento devuelto', 'ok');
    await activosVerAgente(_ac.agente.agente.id);
  } catch (e) { _acError(e.message); }
}
async function activosActivarAgente(activo) {
  _acError('');
  try {
    await apiRequest('PUT', '/activos/agentes/' + _ac.agente.agente.id, { activo: activo });
    showToast(activo ? 'Agente activo' : 'Agente inactivo', 'ok');
    await activosVerAgente(_ac.agente.agente.id);
  } catch (e) { _acError(e.message); }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { activosPanelHtml: activosPanelHtml, activosListaHtml: activosListaHtml, activosCampoHtml: activosCampoHtml, activosAgentesHtml: activosAgentesHtml };
}
