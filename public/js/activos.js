// activos.js — Fase 369 (E1): «Inventario de sistemas» (interfaz). Pestañas Panel, Elementos,
// Registrar y Ajustes. El servidor decide los permisos (server/activos.js: ADMIN y SISTEMAS). Todo
// texto se escapa (esc) o va por textContent.
'use strict';

var _ac = { config: null, tab: 'panel', lista: [], sel: null, ambito: 'sistemas', resumen: null };
// Fase 376 (I1, diseño de Edwin): menú lateral con el ciclo de cada elemento. «sec» = título de sección.
var AC_MENU = {
  sistemas: [['sec', 'Menú'], ['panel', 'Panel general'], ['sec', 'Ciclo de elementos'], ['registrar', 'Registrar ingreso', '1'], ['libres', 'Libres', '2'], ['asignados', 'Asignados', '3'],
    ['reparacion', 'En reparación', '4'], ['malos', 'Malos', '5'], ['sec', 'Gestión'], ['elementos', 'Inventario completo'], ['agentes', 'Agentes'], ['ajustes', 'Ajustes y datos']],
  inmuebles: [['sec', 'Menú'], ['panel', 'Panel general'], ['sec', 'Ciclo de elementos'], ['registrar', 'Registrar ingreso', '1'], ['libres', 'Libres', '2'],
    ['reparacion', 'En reparación', '3'], ['malos', 'Malos', '4'], ['sec', 'Gestión'], ['elementos', 'Inventario completo'], ['ajustes', 'Ajustes y datos']],
};
// Vistas por estado (juntan todos los tipos) y su texto.
var AC_VISTA_ESTADO = { libres: 'libre', asignados: 'en_uso', reparacion: 'en_reparacion', malos: 'malo' };
var AC_VISTA_TXT = {
  panel: ['Panel general', 'Cuántos elementos hay en cada estado y por tipo.'],
  registrar: ['Registrar ingreso', 'Paso 1 del ciclo. Registra cada elemento por separado; todo lo que registres queda en «Libres», listo para asignar.'],
  libres: ['Libres', 'Elementos disponibles para entregar.'],
  asignados: ['Asignados', 'Elementos entregados a un agente.'],
  reparacion: ['En reparación', 'Elementos pendientes por arreglo. Al repararse vuelven a «Libres».'],
  malos: ['Malos', 'Elementos que no se pueden entregar.'],
  elementos: ['Inventario completo', 'Todos los elementos, con filtros por tipo, estado, sede y operación.'],
  agentes: ['Agentes', 'Quién tiene cada elemento: asignar, devolver y cambiar, con actas.'],
  ajustes: ['Ajustes y datos', 'Listas, formularios por tipo y textos del acta.'],
};
var AC_TITULO = { sistemas: 'Inventario de sistemas', inmuebles: 'Inventario de inmuebles' };
function _acEl(id) { return document.getElementById(id); }
function _acError(m) { var e = _acEl('ac-error'); e.textContent = m || ''; e.classList.toggle('hidden', !m); }
function _acEstadoNombre(c) { var e = ((_ac.config && _ac.config.estados) || []).find(function (x) { return x.codigo === c; }); return e ? e.nombre : c; }
function _acTipo(c) { return ((_ac.config && _ac.config.tipos) || []).find(function (t) { return t.codigo === c; }) || null; }
var AC_CLASE_ESTADO = { libre: 'vis-verde', en_uso: 'vis-gris', en_reparacion: 'vis-amarillo', malo: 'vis-rojo', de_baja: 'vis-gris' };

async function activosAbrir(ambito) {
  _acError('');
  _ac.ambito = ambito === 'inmuebles' ? 'inmuebles' : 'sistemas';
  try { _ac.config = await apiRequest('GET', '/activos/config?ambito=' + _ac.ambito); }
  catch (e) { showToast('No se pudo abrir el ' + AC_TITULO[_ac.ambito] + ': ' + (e.message || ''), 'error'); return; }
  _acEl('activos-title').textContent = AC_TITULO[_ac.ambito];
  var sel = _acEl('ac-r-tipo'); if (sel) sel.innerHTML = ''; // los tipos cambian según el inventario
  openModal('activos-overlay');
  _acMotivos();
  activosTab('panel');
}
function activosAbrirInmuebles() { return activosAbrir('inmuebles'); } // Fase 376: tarjeta «Inventario de inmuebles»
// Menú lateral con los conteos de cada estado (del resumen).
function activosMenuHtml(ambito, actual, resumen) {
  var pe = (resumen && resumen.porEstado) || {};
  var n = { libres: pe.libre, asignados: pe.en_uso, reparacion: pe.en_reparacion, malos: pe.malo, elementos: resumen ? resumen.total : null };
  return (AC_MENU[ambito] || AC_MENU.sistemas).map(function (x) {
    if (x[0] === 'sec') return '<p class="ac-menu-sec">' + esc(x[1]) + '</p>';
    var c = n[x[0]];
    return '<button type="button" class="ac-menu-btn" data-ac-vista="' + x[0] + '"' + (x[0] === actual ? ' aria-current="page"' : '') + ' onclick="activosTab(\'' + x[0] + '\')">' +
      (x[2] ? '<span class="ac-paso" aria-hidden="true">' + x[2] + '</span>' : '') + '<span class="ac-menu-txt">' + esc(x[1]) + '</span>' +
      (c !== undefined && c !== null ? '<span class="ac-menu-n">' + Number(c) + '</span>' : '') + '</button>';
  }).join('');
}
// El ciclo de un elemento (diseño de Edwin), con los pasos que llevan a su vista.
function activosFlujoHtml(ambito) {
  var pasos = ambito === 'inmuebles' ? [['registrar', 'Registrar ingreso'], ['libres', 'Libres'], ['reparacion', 'En reparación / malo'], ['libres', 'Reparado → vuelve a libres']]
    : [['registrar', 'Registrar ingreso'], ['libres', 'Equipos libres'], ['asignados', 'Asignar a un agente'], ['reparacion', 'En reparación / malo'], ['libres', 'Reparado → vuelve a libres']];
  return '<ol class="ac-flujo" aria-label="Ciclo de un elemento">' + pasos.map(function (p, i) {
    return '<li><button type="button" class="ac-flujo-paso" onclick="activosTab(\'' + p[0] + '\')"><span class="ac-paso" aria-hidden="true">' + (i + 1) + '</span>' + esc(p[1]) + '</button></li>';
  }).join('') + '</ol>';
}
async function _acRefrescarMenu() {
  try { _ac.resumen = await apiRequest('GET', '/activos/resumen?ambito=' + _ac.ambito); } catch (e) { /* el menú sigue sin conteos */ }
  _acEl('ac-menu').innerHTML = activosMenuHtml(_ac.ambito, _ac.tab, _ac.resumen);
}
function activosCerrar() { closeModal('activos-overlay'); }

function activosTab(tab) {
  if (!AC_VISTA_TXT[tab]) tab = 'panel';
  if (_ac.ambito === 'inmuebles' && (tab === 'agentes' || tab === 'asignados')) tab = 'panel'; // inmuebles no se asignan a agentes
  _ac.tab = tab;
  _acError('');
  var seccion = AC_VISTA_ESTADO[tab] ? 'elementos' : tab; // las vistas por estado usan la lista de elementos
  ['panel', 'elementos', 'agentes', 'registrar', 'ajustes'].forEach(function (t) { _acEl('ac-p-' + t).classList.toggle('hidden', t !== seccion); });
  var txt = AC_VISTA_TXT[tab];
  _acEl('ac-vista-cab').innerHTML = '<h4 class="ac-vista-tit">' + esc(txt[0]) + '</h4><p class="vis-ayuda">' + esc(txt[1]) + '</p>' + (tab === 'panel' || tab === 'registrar' ? activosFlujoHtml(_ac.ambito) : '');
  _acRefrescarMenu();
  var main = document.querySelector('#activos-overlay .ac-main'); if (main) main.scrollTop = 0;
  if (tab === 'panel') _acPanel();
  if (seccion === 'elementos') { _ac.estadoFijo = AC_VISTA_ESTADO[tab] || null; _acEl('ac-f-estado-ig').classList.toggle('hidden', !!_ac.estadoFijo); activosCerrarDetalleSinBuscar(); _acFiltrosYLista(); }
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
  try { c.innerHTML = activosPanelHtml(await apiRequest('GET', '/activos/resumen?ambito=' + _ac.ambito), _ac.config); }
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
  _acEl('ac-f-operacion').innerHTML = _acOpciones(_ac.config.listas.operaciones, _acEl('ac-f-operacion').value, 'Todas las operaciones'); // Fase 376
  activosBuscar();
}
async function activosBuscar() {
  var q = ['ambito=' + _ac.ambito]; // Fase 376: solo el inventario abierto
  ['tipo', 'sede', 'operacion'].forEach(function (k) { var v = _acEl('ac-f-' + k).value; if (v) q.push(k + '=' + encodeURIComponent(v)); });
  var est = _ac.estadoFijo || _acEl('ac-f-estado').value; if (est) q.push('estado=' + encodeURIComponent(est)); // vista por estado o filtro
  var t = _acEl('ac-f-q').value.trim(); if (t) q.push('q=' + encodeURIComponent(t));
  var c = _acEl('ac-lista');
  c.innerHTML = '<p class="vis-vacio">Cargando…</p>';
  try { _ac.lista = (await apiRequest('GET', '/activos?' + q.join('&'))).activos; c.innerHTML = activosListaHtml(_ac.lista, _ac.config); }
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
      '<div class="ig ac-motivo"><label for="ac-motivo">Motivo / diagnóstico</label><input type="text" id="ac-motivo" maxlength="300" list="ac-motivos-lista" placeholder="Ej.: no enciende, pantalla dañada, reparado…"></div><button type="submit" class="btn-primary">Cambiar estado</button></form>' : '') +
    '<h4 class="ac-sub">Historial</h4><ul class="ac-hist">' + hist + '</ul><div class="modal-btns"><button type="button" class="btn-cancel" onclick="activosCerrarDetalle()">Volver a la lista</button></div></section>';
  _acEl('ac-detalle').classList.remove('hidden');
  _acEl('ac-lista-zona').classList.add('hidden');
  _acEl('ac-detalle').scrollIntoView({ block: 'start' });
}
function activosCerrarDetalle() { activosCerrarDetalleSinBuscar(); activosBuscar(); _acRefrescarMenu(); }
function activosCerrarDetalleSinBuscar() { _acEl('ac-detalle').classList.add('hidden'); _acEl('ac-lista-zona').classList.remove('hidden'); }
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
  _acEl('ac-r-campos').innerHTML = t ? t.campos.filter(function (c) { return !c.oculto; }).map(activosCampoHtml).join('') : ''; // Fase 372: sin los ocultos
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
  ['sedes', 'operaciones', 'proveedores', 'motivos'].forEach(function (l) { _acEl('ac-l-' + l).value = (_ac.config.listas[l] || []).join('\n'); });
  _acTipos(); _acTextos(); // Fase 372 (E4)
}
// Fase 372: los motivos frecuentes se sugieren en los campos de motivo (datalist); el motivo sigue libre.
function _acMotivos() {
  var d = _acEl('ac-motivos-lista');
  if (d) d.innerHTML = ((_ac.config && _ac.config.listas && _ac.config.listas.motivos) || []).map(function (m) { return '<option value="' + esc(m) + '"></option>'; }).join('');
}
async function activosGuardarLista(l) {
  _acError('');
  var valores = _acEl('ac-l-' + l).value.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
  try {
    var r = await apiRequest('PUT', '/activos/listas/' + l, { valores: valores });
    _ac.config.listas[l] = r.valores;
    if (l === 'motivos') _acMotivos();
    showToast('Lista guardada', 'ok');
  } catch (e) { _acError(e.message); }
}

// ── Ajustes › Formularios por tipo y textos del acta (Fase 372, E4) ──
var AC_TIPO_CAMPO = { texto: 'Texto', numero: 'Número', lista: 'Lista' };
function activosTiposHtml(tipos) {
  return '<div class="table-wrap"><table class="vis-tabla ac-tipos-tabla"><thead><tr><th scope="col">Tipo</th><th scope="col" class="vis-num">Campos</th><th scope="col"><span class="sr-only">Acciones</span></th></tr></thead><tbody>' +
    tipos.map(function (t) {
      var visibles = t.campos.filter(function (c) { return !c.oculto; }).length, ocultos = t.campos.length - visibles;
      return '<tr><th scope="row">' + esc(t.nombre) + (t.activo ? '' : '<span class="vis-pill vis-gris">Desactivado</span>') + '</th><td class="vis-num">' + visibles + (ocultos ? ' (+' + ocultos + ' oculto' + (ocultos > 1 ? 's' : '') + ')' : '') + '</td><td><div class="ac-acciones">' +
        '<button type="button" class="btn-cancel ac-btn" onclick="activosEditarTipo(\'' + esc(t.codigo) + '\')">Editar</button>' +
        '<button type="button" class="btn-cancel ac-btn" onclick="activosActivarTipo(\'' + esc(t.codigo) + '\',' + (!t.activo) + ')">' + (t.activo ? 'Desactivar' : 'Activar') + '</button></div></td></tr>';
    }).join('') + '</tbody></table></div><button type="button" class="btn-primary ac-btn" onclick="activosEditarTipo(null)">Nuevo tipo</button>';
}
function _acTipos() {
  _acEl('ac-tipos').innerHTML = activosTiposHtml(_ac.config.tiposTodos || []);
  _acEl('ac-tipo-editor').classList.add('hidden');
  _acEl('ac-tipos').classList.remove('hidden');
}
// Una fila del editor. Los campos ya guardados llevan su clave (data-k) y su tipo de dato fijo.
function activosCampoEditorHtml(c, i) {
  var nuevo = !c.k, id = 'ac-ce-' + i;
  var tipo = nuevo ? '<select id="' + id + '-t" data-ce="t" onchange="activosCampoTipo(this)">' + Object.keys(AC_TIPO_CAMPO).map(function (k) { return '<option value="' + k + '"' + (c.t === k ? ' selected' : '') + '>' + AC_TIPO_CAMPO[k] + '</option>'; }).join('') + '</select>'
    : '<span class="ac-ce-fijo"><span class="vis-pill vis-gris" id="' + id + '-t" data-ce="t" data-t="' + esc(c.t) + '">' + esc(AC_TIPO_CAMPO[c.t] || c.t) + '</span></span>';
  return '<li class="ac-ce" data-k="' + esc(c.k || '') + '">' +
    '<div class="ig"><label for="' + id + '-l">Nombre del campo</label><input type="text" id="' + id + '-l" data-ce="l" maxlength="60" value="' + esc(c.l || '') + '"></div>' +
    '<div class="ig">' + (nuevo ? '<label for="' + id + '-t">Tipo de dato</label>' : '<span class="ac-ce-etq">Tipo de dato</span>') + tipo + '</div>' +
    '<div class="ig ac-ce-o' + ((c.t || 'texto') === 'lista' ? '' : ' hidden') + '"><label for="' + id + '-o">Opciones (una por línea)</label><textarea id="' + id + '-o" data-ce="o" rows="3">' + esc((c.o || []).join('\n')) + '</textarea></div>' +
    '<label class="ac-check"><input type="checkbox" data-ce="oculto"' + (c.oculto ? ' checked' : '') + '> Oculto</label>' +
    '<div class="ac-acciones"><button type="button" class="btn-cancel ac-btn" onclick="activosMoverCampo(this,-1)" aria-label="Subir campo">↑</button><button type="button" class="btn-cancel ac-btn" onclick="activosMoverCampo(this,1)" aria-label="Bajar campo">↓</button>' +
    (nuevo ? '<button type="button" class="btn-cancel ac-btn" onclick="this.closest(\'.ac-ce\').remove()">Quitar</button>' : '') + '</div></li>';
}
function activosEditorTipoHtml(t) {
  var nuevo = !t;
  t = t || { nombre: '', plural: '', campos: [] };
  return '<form class="aurora-card ac-tipo-form" onsubmit="activosGuardarTipo(event)" data-codigo="' + esc(t.codigo || '') + '"><div class="aurora-card-title">' + (nuevo ? 'Nuevo tipo' : 'Editar ' + esc(t.nombre)) + '</div>' +
    '<div class="ac-filtros"><div class="ig"><label for="ac-te-nombre">Nombre</label><input type="text" id="ac-te-nombre" maxlength="40" value="' + esc(t.nombre) + '"></div>' +
    '<div class="ig"><label for="ac-te-plural">Plural</label><input type="text" id="ac-te-plural" maxlength="40" value="' + esc(t.plural) + '"></div></div>' +
    '<p class="vis-ayuda">Además de los campos de siempre (código, marca, modelo, serial, sede, operación, proveedor y observaciones).</p>' +
    '<ol class="ac-ce-lista" id="ac-te-campos">' + t.campos.map(activosCampoEditorHtml).join('') + '</ol>' +
    '<button type="button" class="btn-cancel ac-btn" onclick="activosAgregarCampo()">Agregar campo</button>' +
    '<div class="modal-btns"><button type="submit" class="btn-primary">Guardar</button><button type="button" class="btn-cancel" onclick="_acTipos()">Cancelar</button></div></form>';
}
function activosEditarTipo(codigo) {
  _acError('');
  var t = codigo ? (_ac.config.tiposTodos || []).find(function (x) { return x.codigo === codigo; }) : null;
  var ed = _acEl('ac-tipo-editor');
  ed.innerHTML = activosEditorTipoHtml(t);
  _acEl('ac-tipos').classList.add('hidden');
  ed.classList.remove('hidden');
  _acEl('ac-te-nombre').focus();
}
var _acCampoN = 0;
function activosAgregarCampo() {
  var l = _acEl('ac-te-campos');
  l.insertAdjacentHTML('beforeend', activosCampoEditorHtml({ t: 'texto' }, 'n' + (++_acCampoN)));
  l.lastElementChild.querySelector('[data-ce="l"]').focus();
}
function activosCampoTipo(sel) { sel.closest('.ac-ce').querySelector('.ac-ce-o').classList.toggle('hidden', sel.value !== 'lista'); }
function activosMoverCampo(btn, d) {
  var li = btn.closest('.ac-ce'), otro = d < 0 ? li.previousElementSibling : li.nextElementSibling;
  if (!otro) return;
  if (d < 0) li.parentNode.insertBefore(li, otro); else li.parentNode.insertBefore(otro, li);
  btn.focus();
}
// Lee el editor: los campos guardados van con su clave (el servidor no deja cambiar su tipo de dato).
function activosLeerCampos(raiz) {
  return Array.prototype.map.call(raiz.querySelectorAll('.ac-ce'), function (li) {
    var c = { l: li.querySelector('[data-ce="l"]').value };
    var t = li.querySelector('[data-ce="t"]');
    var tipo = t.tagName === 'SELECT' ? t.value : t.getAttribute('data-t');
    if (li.getAttribute('data-k')) c.k = li.getAttribute('data-k'); else c.t = tipo;
    if (tipo === 'lista') c.o = li.querySelector('[data-ce="o"]').value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
    if (li.querySelector('[data-ce="oculto"]').checked) c.oculto = true;
    return c;
  });
}
async function activosGuardarTipo(ev) {
  ev.preventDefault();
  _acError('');
  var form = ev.target, codigo = form.getAttribute('data-codigo');
  var b = { nombre: _acEl('ac-te-nombre').value, plural: _acEl('ac-te-plural').value, campos: activosLeerCampos(form) };
  try {
    await apiRequest(codigo ? 'PUT' : 'POST', '/activos/config/tipos' + (codigo ? '/' + encodeURIComponent(codigo) : '?ambito=' + _ac.ambito), b);
    showToast(codigo ? 'Formulario guardado' : 'Tipo creado', 'ok');
    await _acRecargarConfig();
  } catch (e) { _acError(e.message); }
}
async function activosActivarTipo(codigo, activo) {
  _acError('');
  try {
    await apiRequest('PUT', '/activos/config/tipos/' + encodeURIComponent(codigo) + '/activo', { activo: activo });
    showToast(activo ? 'Tipo activado' : 'Tipo desactivado', 'ok');
    await _acRecargarConfig();
  } catch (e) { _acError(e.message); }
}
async function _acRecargarConfig() {
  _ac.config = await apiRequest('GET', '/activos/config?ambito=' + _ac.ambito);
  var sel = _acEl('ac-r-tipo'); if (sel) sel.innerHTML = ''; // Registrar vuelve a armar la lista de tipos
  _acTipos();
}
function _acTextos() {
  var t = _ac.config.textos || {}, n = _ac.config.textosNombres || {};
  _acEl('ac-textos').innerHTML = Object.keys(n).map(function (k) {
    return '<div class="ig"><label for="ac-tx-' + esc(k) + '">' + esc(n[k]) + '</label><textarea id="ac-tx-' + esc(k) + '" rows="5" maxlength="1500">' + esc(t[k] || '') + '</textarea>' +
      '<button type="button" class="btn-cancel ac-btn" onclick="activosGuardarTexto(\'' + esc(k) + '\')">Guardar texto</button></div>';
  }).join('');
}
async function activosGuardarTexto(k) {
  _acError('');
  try {
    var r = await apiRequest('PUT', '/activos/config/textos/' + encodeURIComponent(k), { valor: _acEl('ac-tx-' + k).value });
    _ac.config.textos[k] = r.valor;
    showToast('Texto guardado', 'ok');
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
    '<h4 class="ac-sub">Actas</h4><div id="ac-actas"><p class="vis-vacio">Cargando…</p></div>' + '<h4 class="ac-sub">Historial de asignaciones</h4>' + (hist ? '<ul class="ac-hist">' + hist + '</ul>' : '<p class="vis-vacio">Sin movimientos.</p>') +
    '<div class="modal-btns">' + (g.activo ? (r.elementos.length ? '' : '<button type="button" class="btn-cancel" onclick="activosActivarAgente(false)">Marcar inactivo</button>') : '<button type="button" class="btn-cancel" onclick="activosActivarAgente(true)">Volver a activar</button>') +
    '<button type="button" class="btn-cancel" onclick="activosCerrarAgente()">Volver a la lista</button></div></section>';
  _acEl('ac-ag-zona').classList.add('hidden');
  _acEl('ac-ag-detalle').classList.remove('hidden');
  if (g.activo) activosLibresParaAsignar();
  _acActas(); // Fase 371
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
    '<div class="ig ac-motivo"><label for="ac-so-motivo">Motivo</label><input type="text" id="ac-so-motivo" maxlength="300" list="ac-motivos-lista" placeholder="Ej.: se dañó el micrófono, retiro del agente…"></div>' +
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

// ── Actas (Fase 371, E3): entrega y devolución. El PDF se arma imprimiendo («Guardar como PDF»);
// la firmada (escaneada) se sube y se guarda en S3 privado; solo se descarga desde la plataforma. ──
function activosActaPrintHtml(acta) {
  var entrega = acta.tipo === 'entrega';
  var fecha = new Date(acta.fecha).toLocaleString('es-CO', { timeZone: 'America/Bogota' });
  var g = acta.agente || {};
  var filas = (acta.elementos || []).map(function (e, i) {
    return '<tr><td>' + (i + 1) + '</td><td>' + esc(e.tipo) + '</td><td>' + esc(e.codigo) + '</td><td>' + esc([e.marca, e.modelo].filter(Boolean).join(' ')) + '</td><td>' + esc(e.serial || '') + '</td>' +
      (entrega ? '' : '<td>' + esc(e.queda || '') + '</td><td>' + esc(e.motivo || '') + '</td>') + '</tr>';
  }).join('');
  // Fase 372: cada acta trae su copia del texto (Ajustes); las anteriores a la Fase 372 usan el de siempre.
  var texto = acta.texto ? acta.texto : entrega
    ? 'Recibo los elementos de esta acta en buen estado, para uso exclusivo de mis funciones. Me comprometo a cuidarlos y a devolverlos cuando se me pidan o al terminar mi vinculación, y a informar a Sistemas cualquier daño o pérdida.'
    : 'Se reciben de vuelta los elementos de esta acta, en el estado que se indica en cada uno.';
  return '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Acta de ' + esc(acta.tipoNombre.toLowerCase()) + ' ' + Number(acta.numero) + '</title>' +
    '<style>@page{size:A4;margin:16mm}body{font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;font-size:12px;line-height:1.45}' +
    'h1{font-size:18px;margin:0 0 4px}.sub{color:#555;margin:0 0 16px}dl{display:grid;grid-template-columns:140px 1fr;gap:4px 12px;margin:0 0 16px}dt{font-weight:bold}dd{margin:0}' +
    'table{width:100%;border-collapse:collapse;margin:0 0 16px}th,td{border:1px solid #999;padding:5px 6px;text-align:left;vertical-align:top}th{background:#eee}' +
    '.firmas{display:grid;grid-template-columns:1fr 1fr;gap:48px;margin-top:56px}.firma{border-top:1px solid #1a1a1a;padding-top:6px}.pie{margin-top:32px;color:#666;font-size:10px}</style></head><body>' +
    '<h1>Acta de ' + esc(acta.tipoNombre.toLowerCase()) + ' N.º ' + Number(acta.numero) + '</h1>' +
    '<p class="sub">Inventario de sistemas · InConexión · ' + esc(fecha) + '</p>' +
    '<dl><dt>Agente</dt><dd>' + esc(g.nombre || '') + '</dd><dt>Documento</dt><dd>' + esc(g.documento || '') + '</dd><dt>Sede</dt><dd>' + esc(g.sede || '') + '</dd><dt>Operación</dt><dd>' + esc(g.operacion || '') + '</dd></dl>' +
    '<table><thead><tr><th>#</th><th>Elemento</th><th>Código</th><th>Marca / modelo</th><th>Serial</th>' + (entrega ? '' : '<th>Queda</th><th>Motivo</th>') + '</tr></thead><tbody>' + filas + '</tbody></table>' +
    '<p>' + esc(texto) + '</p>' +
    '<div class="firmas"><div class="firma">Firma de quien entrega<br>Nombre:<br>Documento:</div><div class="firma">Firma de quien recibe<br>Nombre:<br>Documento:</div></div>' +
    '<p class="pie">Generada por ' + esc(acta.quien || '') + '. Firmada, se escanea en PDF y se sube en la plataforma (Inventario de sistemas → Agentes → Actas).</p>' +
    '</body></html>';
}
function activosImprimirActa(acta) {
  var w = window.open('', '_blank');
  if (!w) { showToast('Permite las ventanas emergentes para imprimir el acta.', 'error'); return; }
  w.document.open();
  w.document.write(activosActaPrintHtml(acta));
  w.document.close();
  setTimeout(function () { try { w.focus(); w.print(); } catch (e) { /* ventana cerrada */ } }, 300);
}
async function _acActas() {
  var g = _ac.agente && _ac.agente.agente;
  var c = _acEl('ac-actas');
  if (!g || !c) return;
  var r;
  try { r = await apiRequest('GET', '/activos/agentes/' + g.id + '/actas'); } catch (e) { _acError(e.message); return; }
  _ac.actas = r;
  var lista = r.actas.length ? '<div class="table-wrap"><table class="vis-tabla"><thead><tr><th scope="col">N.º</th><th scope="col">Tipo</th><th scope="col">Fecha</th><th scope="col">Elementos</th><th scope="col">Firmada</th><th scope="col"><span class="sr-only">Acciones</span></th></tr></thead><tbody>' +
    r.actas.map(function (a) {
      var acciones = '<button type="button" class="btn-cancel ac-btn" onclick="activosImprimirActaId(' + Number(a.id) + ')">Imprimir / PDF</button>';
      if (a.firmada) acciones += '<button type="button" class="btn-cancel ac-btn" onclick="activosDescargarFirmada(' + Number(a.id) + ')">Ver firmada</button>';
      if (r.firmadasActivas) acciones += '<label class="btn-cancel ac-btn ac-subir">' + (a.firmada ? 'Reemplazar firmada' : 'Subir firmada') + '<input type="file" accept="application/pdf" class="sr-only" onchange="activosSubirFirmada(' + Number(a.id) + ', this)"></label>';
      return '<tr><th scope="row">' + Number(a.numero) + '</th><td>' + esc(a.tipoNombre) + '</td><td>' + esc(_acFecha(a.fecha)) + '</td><td class="vis-num">' + a.elementos.length + '</td><td>' +
        (a.firmada ? '<span class="vis-pill vis-verde">Sí</span>' : '<span class="vis-pill vis-gris">No</span>') + '</td><td><div class="ac-acciones">' + acciones + '</div></td></tr>';
    }).join('') + '</tbody></table></div>' : '<p class="vis-vacio">Aún no hay actas de este agente.</p>';
  var aviso = r.firmadasActivas ? '' : '<p class="vis-ayuda">Subir el acta firmada se activa cuando el administrador configure el almacenamiento privado (S3).</p>';
  c.innerHTML = lista + aviso +
    '<form class="ac-asig-form" onsubmit="activosCrearActa(event)"><h5 class="ac-sub ac-form-titulo">Nueva acta</h5>' +
    '<div class="ig"><label for="ac-acta-tipo">Tipo</label><select id="ac-acta-tipo" onchange="activosActaCandidatos()"><option value="entrega">Entrega (lo que tiene asignado)</option><option value="devolucion">Devolución (lo que ya entregó)</option></select></div>' +
    '<fieldset class="ac-acta-elems" id="ac-acta-elems"><legend>Elementos</legend></fieldset>' +
    '<button type="submit" class="btn-primary">Crear e imprimir</button></form>';
  activosActaCandidatos();
}
function activosActaCandidatos() {
  var tipo = _acEl('ac-acta-tipo').value;
  var l = (_ac.actas && _ac.actas[tipo]) || [];
  var tipoN = function (c) { var t = _acTipo(c); return t ? t.nombre : c; };
  _acEl('ac-acta-elems').innerHTML = '<legend>Elementos</legend>' + (l.length ? l.map(function (x) {
    return '<label class="ac-check"><input type="checkbox" value="' + Number(x.id) + '" checked> ' + esc(tipoN(x.tipo)) + ' ' + esc(x.codigo) + (x.queda ? ' · queda ' + esc(_acEstadoNombre(x.queda)) : '') + '</label>';
  }).join('') : '<p class="vis-vacio">' + (tipo === 'entrega' ? 'No tiene elementos asignados.' : 'No ha devuelto elementos.') + '</p>');
}
async function activosCrearActa(ev) {
  ev.preventDefault();
  _acError('');
  var ids = Array.prototype.map.call(document.querySelectorAll('#ac-acta-elems input:checked'), function (i) { return Number(i.value); });
  if (!ids.length) { _acError('Elige los elementos del acta'); return; }
  // La ventana se abre en el mismo clic (si no, el navegador la bloquea) y se llena al crear el acta.
  var w = window.open('', '_blank');
  try {
    var r = await apiRequest('POST', '/activos/agentes/' + _ac.agente.agente.id + '/actas', { tipo: _acEl('ac-acta-tipo').value, activoIds: ids });
    showToast('Acta N.º ' + r.acta.numero + ' creada', 'ok');
    if (w) { w.document.open(); w.document.write(activosActaPrintHtml(r.acta)); w.document.close(); setTimeout(function () { try { w.focus(); w.print(); } catch (e) { /* cerrada */ } }, 300); }
    else showToast('Permite las ventanas emergentes para imprimir el acta.', 'error');
    _acActas();
  } catch (e) { if (w) w.close(); _acError(e.message); }
}
async function activosImprimirActaId(id) {
  var a = (_ac.actas && _ac.actas.actas || []).find(function (x) { return x.id === id; });
  if (a) activosImprimirActa(a);
}
function _acLeerBase64(file) {
  return new Promise(function (ok, mal) {
    var fr = new FileReader();
    fr.onload = function () { ok(String(fr.result).split(',')[1] || ''); };
    fr.onerror = function () { mal(new Error('No se pudo leer el archivo')); };
    fr.readAsDataURL(file);
  });
}
async function activosSubirFirmada(id, input) {
  _acError('');
  var f = input.files && input.files[0];
  input.value = '';
  if (!f) return;
  if (f.size > 5 * 1024 * 1024) { _acError('El PDF pesa más de 5 MB'); return; }
  try {
    await apiRequest('POST', '/activos/actas/' + id + '/firmada', { pdf: await _acLeerBase64(f) });
    showToast('Acta firmada guardada', 'ok');
    _acActas();
  } catch (e) { _acError(e.message); }
}
async function activosDescargarFirmada(id) {
  _acError('');
  try {
    var res = await fetch(API_BASE + '/activos/actas/' + id + '/firmada', { headers: apiHeaders(false) });
    if (!res.ok) { var d = null; try { d = await res.json(); } catch (e) { /* sin cuerpo */ } throw new Error((d && d.error) || friendlyHttpError(res.status)); }
    var url = URL.createObjectURL(await res.blob());
    var a = document.createElement('a');
    a.href = url; a.download = 'acta-firmada-' + id + '.pdf';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 10000);
  } catch (e) { _acError(e.message); }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { activosMenuHtml: activosMenuHtml, activosFlujoHtml: activosFlujoHtml, AC_MENU: AC_MENU, AC_VISTA_ESTADO: AC_VISTA_ESTADO, activosTiposHtml: activosTiposHtml, activosCampoEditorHtml: activosCampoEditorHtml, activosEditorTipoHtml: activosEditorTipoHtml, activosLeerCampos: activosLeerCampos, activosPanelHtml: activosPanelHtml, activosListaHtml: activosListaHtml, activosCampoHtml: activosCampoHtml, activosAgentesHtml: activosAgentesHtml, activosActaPrintHtml: activosActaPrintHtml };
}
