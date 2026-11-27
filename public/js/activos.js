// activos.js — Fase 369 (E1): «Inventario de sistemas» (interfaz). Pestañas Panel, Elementos,
// Registrar y Ajustes. El servidor decide los permisos (server/activos.js: ADMIN y SISTEMAS). Todo
// texto se escapa (esc) o va por textContent.
'use strict';

var _ac = { config: null, tab: 'panel', lista: [], sel: null, ambito: 'sistemas', resumen: null };
// Fase 376 (I1, diseño de Edwin): menú lateral con el ciclo de cada elemento. «sec» = título de sección.
var AC_MENU = {
  sistemas: [['sec', 'Menú'], ['panel', 'Panel general'], ['sec', 'Ciclo de elementos'], ['registrar', 'Registrar ingreso', '1'], ['libres', 'Libres', '2'], ['asignados', 'Asignados', '3'],
    ['reparacion', 'En reparación', '4'], ['malos', 'Malos', '5'], ['sec', 'Gestión'], ['elementos', 'Inventario'], ['agentes', 'Agentes'], ['admin', 'Equipos administrables'], ['actas', 'Actas'], ['historial', 'Historial'], ['ajustes', 'Ajustes y datos']], // Fase 379: + Actas; Fase 380: + administrables; Fase 381: + Historial
  inmuebles: [['sec', 'Menú'], ['panel', 'Panel general'], ['sec', 'Ciclo de elementos'], ['registrar', 'Registrar ingreso', '1'], ['libres', 'Libres', '2'],
    ['reparacion', 'En reparación', '3'], ['malos', 'Malos', '4'], ['sec', 'Gestión'], ['elementos', 'Inventario'], ['historial', 'Historial'], ['ajustes', 'Ajustes y datos']], // Fase 381: + Historial
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
  elementos: ['Inventario', 'Equipos, componentes y tecnologías: una tarjeta por tipo y la lista completa, con filtros por tipo, estado, sede, operación, propietario y rendimiento.'],
  agentes: ['Agentes', 'Quién tiene cada elemento: asignar, devolver y cambiar, con actas.'],
  novedadesgh: ['Novedades de Gestión Humana', 'Agentes con elementos asignados que en Talento humano aparecen retirados, ausentes hoy o por ausentarse en los próximos 7 días. Solo lectura: los cambios se hacen en Talento humano; aquí se recogen o se revisan los equipos.'],
  admin: ['Equipos administrables', 'Red e infraestructura: servidores, switches, DVR / NVR, routers y firewalls, access points y UPS. Se registran en «Registrar ingreso»; el código se asigna solo según el tipo.'],
  historial: ['Historial', 'Todo lo que pasó en el inventario: ingresos, asignaciones, devoluciones, cambios de estado, ediciones e importaciones. Filtra por fechas, acción o código y descárgalo en Excel o PDF.'],
  actas: ['Actas', 'Cada movimiento (entrega, devolución, cambio, envío a reparación, recibo de reparación, elemento malo o baja) crea su acta. Imprímela, hazla firmar y súbela escaneada.'],
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
  var n = { libres: pe.libre, asignados: pe.en_uso, reparacion: pe.en_reparacion, malos: pe.malo, elementos: resumen ? resumen.total : null, actas: resumen && resumen.actasPorFirmar !== undefined ? resumen.actasPorFirmar : null,
    novedadesgh: resumen && resumen.novedadesGH ? resumen.novedadesGH.retirados + resumen.novedadesGH.ausentes : null }; // Fase GH4
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
  if (tab === 'novedadesgh' && _ac.ambito !== 'inmuebles') { _ac.actasPestana = 'novedades'; tab = 'actas'; } // Fase GH5d: las novedades viven en Actas, como Edwin
  if (_ac.ambito === 'inmuebles' && (tab === 'agentes' || tab === 'asignados' || tab === 'actas' || tab === 'admin' || tab === 'novedadesgh')) tab = 'panel'; // inmuebles no se asignan a agentes
  _ac.tab = tab;
  _acError('');
  var seccion = AC_VISTA_ESTADO[tab] ? 'elementos' : tab; // las vistas por estado usan la lista de elementos
  ['panel', 'elementos', 'agentes', 'registrar', 'ajustes', 'actas', 'admin', 'historial'].forEach(function (t) { _acEl('ac-p-' + t).classList.toggle('hidden', t !== seccion); });
  var txt = AC_VISTA_TXT[tab];
  _acEl('ac-vista-cab').innerHTML = '<h4 class="ac-vista-tit">' + esc(txt[0]) + '</h4><p class="vis-ayuda">' + esc(txt[1]) + '</p>' + (tab === 'registrar' ? activosFlujoHtml(_ac.ambito) : '') /* Fase GH5: el panel de Edwin no lleva el flujo */;
  _acRefrescarMenu();
  var main = document.querySelector('#activos-overlay .ac-main'); if (main) main.scrollTop = 0;
  if (tab === 'panel') _acPanel();
  if (seccion === 'elementos') { _ac.estadoFijo = AC_VISTA_ESTADO[tab] || null; _acEl('ac-f-estado-ig').classList.toggle('hidden', !!_ac.estadoFijo); activosCerrarDetalleSinBuscar(); _acFiltrosYLista(); _acInvTipos(); }
  if (tab === 'agentes') _acAgentes();
  if (tab === 'registrar') _acFormulario();
  if (tab === 'ajustes') _acAjustes();
  if (tab === 'actas') { activosActasPestana(_ac.actasPestana || 'pendiente'); _ac.actasPestana = null; } // Fase 379; GH5d: pestañas
  if (tab === 'admin') { _ac.adSubtipo = ''; activosAdminBuscar(); } // Fase 380
  if (tab === 'historial') activosHistorialBuscar(); // Fase 381
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
  // Fase 377 (I2): rendimiento por RAM (torres y portátiles); cada tarjeta abre el inventario con ese filtro.
  var rend = r.porRendimiento ? '<h4 class="ac-sub">Rendimiento según la RAM (sin los dados de baja)</h4><div class="ac-kpis">' + (config.rendimientos || []).map(function (x) {
    return '<button type="button" class="ac-kpi ac-rend-kpi" onclick="activosVerRendimiento(\'' + x.codigo + '\')"><b>' + (r.porRendimiento[x.codigo] || 0) + '</b><span class="vis-pill ' + AC_CLASE_REND[x.codigo] + '">' + esc(x.nombre) + '</span><span class="vis-ayuda">' + esc(x.ayuda) + '</span></button>';
  }).join('') + '</div>' : '';
  return tarjetas + rend + '<div class="table-wrap"><table class="vis-tabla"><thead><tr><th scope="col">Tipo</th>' + est.map(function (e) { return '<th scope="col" class="vis-num">' + esc(e.nombre) + '</th>'; }).join('') + '</tr></thead><tbody>' + filas + '</tbody></table></div>' +
    (sedes ? '<h4 class="ac-sub">Por sede (sin los dados de baja)</h4><ul class="ac-sedes">' + sedes + '</ul>' : '');
}
async function _acPanel() {
  var c = _acEl('ac-p-panel');
  c.innerHTML = '<p class="vis-vacio">Cargando…</p>';
  // Fase GH5: panel del diseño de Edwin (activosPanel2Html); activosPanelHtml queda para quien lo use.
  try { c.innerHTML = activosPanel2Html(await apiRequest('GET', '/activos/panel?ambito=' + _ac.ambito + (_ac.panelTipo ? '&tipo=' + encodeURIComponent(_ac.panelTipo) : ''))); }
  catch (e) { c.innerHTML = ''; _acError(e.message); }
}

// ── Elementos ──
function _acOpciones(lista, sel, vacio) {
  return (vacio ? '<option value="">' + esc(vacio) + '</option>' : '') + lista.map(function (o) { var v = o.codigo || o; var n = o.plural || o.nombre || o; return '<option value="' + esc(v) + '"' + (v === sel ? ' selected' : '') + '>' + esc(n) + '</option>'; }).join('');
}
function _acFiltrosYLista() {
  _acEl('ac-f-tipo').innerHTML = _acOpciones(_ac.config.tipos, _ac.tipoInicial || _acEl('ac-f-tipo').value, 'Todos los tipos');
  _ac.tipoInicial = null; // Fase GH5b
  _acEl('ac-f-estado').innerHTML = _acOpciones(_ac.config.estados, _acEl('ac-f-estado').value, 'Todos los estados');
  _acEl('ac-f-sede').innerHTML = _acOpciones(_ac.config.listas.sedes, _acEl('ac-f-sede').value, 'Todas las sedes');
  _acEl('ac-f-operacion').innerHTML = _acOpciones(_ac.config.listas.operaciones, _acEl('ac-f-operacion').value, 'Todas las operaciones'); // Fase 376
  // Fase 377 (I2): «Sin sede/operación/propietario», propietario y rendimiento por RAM (solo si algún tipo lleva RAM).
  _acSinValor('ac-f-sede', 'Sin sede'); _acSinValor('ac-f-operacion', 'Sin operación');
  _acEl('ac-f-proveedor').innerHTML = _acOpciones(_ac.config.listas.proveedores || [], _acEl('ac-f-proveedor').value, 'Todos');
  _acSinValor('ac-f-proveedor', 'Sin propietario');
  var conRam = (_ac.config.tipos || []).some(function (t) { return t.campos.some(function (c) { return c.k === 'ram_gb'; }); });
  _acEl('ac-f-rend-ig').classList.toggle('hidden', !conRam);
  _acEl('ac-f-rend').innerHTML = _acOpciones((_ac.config.rendimientos || []).map(function (r) { return { codigo: r.codigo, nombre: r.nombre + ' (' + r.ayuda + ')' }; }), _ac.rendInicial || _acEl('ac-f-rend').value, 'Todos');
  _ac.rendInicial = null;
  activosBuscar();
}
// Agrega la opción «__none» (sin valor) al final de un filtro, conservando lo elegido.
function _acSinValor(id, txt) {
  var s = _acEl(id), v = s.getAttribute('data-v') || '';
  s.insertAdjacentHTML('beforeend', '<option value="__none">' + esc(txt) + '</option>');
  if (v === '__none') s.value = '__none';
}
function activosLimpiarFiltros() {
  ['tipo', 'estado', 'sede', 'operacion', 'proveedor', 'rend', 'q'].forEach(function (k) { var el = _acEl('ac-f-' + k); el.value = ''; el.removeAttribute('data-v'); });
  _acEl('ac-f-pend').checked = false; _acEl('ac-f-dup').checked = false;
  activosBuscar();
}
// Parámetros de la búsqueda (exportada para las pruebas).
function activosConsulta(f) {
  var q = ['ambito=' + f.ambito]; // Fase 376: solo el inventario abierto
  ['tipo', 'sede', 'operacion', 'proveedor', 'rend'].forEach(function (k) { if (f[k]) q.push(k + '=' + encodeURIComponent(f[k])); });
  if (f.estado) q.push('estado=' + encodeURIComponent(f.estado)); // vista por estado o filtro
  if (f.q) q.push('q=' + encodeURIComponent(f.q));
  if (f.pend) q.push('pend=1');
  if (f.dup) q.push('dup=1');
  return q.join('&');
}
async function activosBuscar() {
  var f = { ambito: _ac.ambito, estado: _ac.estadoFijo || _acEl('ac-f-estado').value, q: _acEl('ac-f-q').value.trim(), pend: _acEl('ac-f-pend').checked, dup: _acEl('ac-f-dup').checked };
  ['tipo', 'sede', 'operacion', 'proveedor', 'rend'].forEach(function (k) { var el = _acEl('ac-f-' + k); f[k] = el.value; el.setAttribute('data-v', el.value); });
  var c = _acEl('ac-lista');
  c.innerHTML = '<p class="vis-vacio">Cargando…</p>';
  try {
    _ac.lista = (await apiRequest('GET', '/activos?' + activosConsulta(f))).activos;
    c.innerHTML = activosListaHtml(_ac.lista, _ac.config, _ac.tab);
    _acEl('ac-conteo').textContent = activosConteoTexto(_ac.lista, _ac.config); // Fase GH5c: con el detalle por tipo, como Edwin
  } catch (e) { c.innerHTML = ''; _acError(e.message); }
}
var AC_CLASE_REND = { bajo: 'vis-rojo', medio: 'vis-amarillo', alto: 'vis-verde', sin: 'vis-gris' };
function activosRendHtml(a, config) {
  if (!a.rendimiento) return '';
  var r = ((config && config.rendimientos) || []).find(function (x) { return x.codigo === a.rendimiento; });
  var ram = a.datos && typeof a.datos.ram_gb === 'number' ? a.datos.ram_gb + ' GB' : 'sin RAM registrada';
  return '<span class="vis-pill ' + (AC_CLASE_REND[a.rendimiento] || '') + '" title="' + esc(ram) + '">' + esc(r ? r.nombre : a.rendimiento) + '</span>';
}
// Fase GH5c: columnas de Edwin. Tipo (etiqueta), Código, Nombre, Equipo, Procesador, RAM, Sede y
// Operación; Asignados suma Agente, Cédula y «Asignado desde»; la vista completa, Estado y Agente.
// Acciones directas: «Estado» (cambiar estado) y, en Asignados, «Recibir»; «Ver» abre el detalle.
function activosListaHtml(lista, config, vista) {
  if (!lista.length) return '<p class="vis-vacio">Ningún elemento coincide.</p>';
  var tipoN = function (c) { var t = config.tipos.find(function (x) { return x.codigo === c; }); return t ? t.nombre : c; };
  var estN = function (c) { var e = config.estados.find(function (x) { return x.codigo === c; }); return e ? e.nombre : c; };
  var d = function (a) { return a.datos || {}; };
  var conProc = lista.some(function (a) { return d(a).procesador; });
  var conRend = lista.some(function (a) { return a.rendimiento; }); // Fase 377: RAM solo si algún elemento la lleva
  var conNombre = lista.some(function (a) { return d(a).nombre_equipo; });
  var asig = vista === 'asignados', completa = !AC_VISTA_ESTADO[vista];
  var th = function (t) { return '<th scope="col">' + esc(t) + '</th>'; };
  var cab = th('Tipo') + th('Código') + (conNombre ? th('Nombre') : '') + th('Equipo') + (conProc ? th('Procesador') : '') + (conRend ? th('RAM') : '') + th('Sede') + th('Operación') +
    (completa ? th('Estado') + th('Agente') : '') + (asig ? th('Agente') + th('Cédula') + th('Asignado desde') : '') + th('Acciones');
  return '<div class="table-wrap"><table class="vis-tabla acl-tabla"><thead><tr>' + cab + '</tr></thead><tbody>' +
    lista.map(function (a) {
      var id = Number(a.id), x = d(a), g = a.agente || {};
      var equipo = esc([a.marca, a.modelo].filter(Boolean).join(' ')) + (a.serial ? '<small class="acl-serial">S/N ' + esc(a.serial) + '</small>' : '');
      var ram = conRend ? '<td class="vis-num">' + (typeof x.ram_gb === 'number' ? esc(x.ram_gb) + ' GB ' : '') + activosRendHtml(a, config) + '</td>' : '';
      var acc = '<button type="button" class="btn-cancel ac-btn" onclick="activosVer(' + id + ')" aria-label="Ver ' + esc(a.codigo) + '">Ver</button>' +
        (a.estado !== 'de_baja' ? '<button type="button" class="btn-cancel ac-btn" onclick="activosAccionEstado(' + id + ')" aria-label="Cambiar estado de ' + esc(a.codigo) + '">Estado</button>' : '') +
        (asig && a.agente ? '<button type="button" class="btn-primary ac-btn" onclick="activosAccionRecibir(' + id + ')" aria-label="Recibir ' + esc(a.codigo) + '">Recibir</button>' : '');
      return '<tr><td><span class="acl-tipo" data-tipo="' + esc(a.tipo) + '">' + esc(tipoN(a.tipo)) + '</span></td><th scope="row">' + esc(a.codigo) + '</th>' +
        (conNombre ? '<td>' + esc(x.nombre_equipo || '') + '</td>' : '') + '<td>' + equipo + '</td>' + (conProc ? '<td>' + esc(x.procesador || '') + '</td>' : '') + ram +
        '<td>' + esc(a.sede) + '</td><td>' + esc(a.operacion) + '</td>' +
        (completa ? '<td><span class="vis-pill ' + (AC_CLASE_ESTADO[a.estado] || '') + '">' + esc(estN(a.estado)) + '</span></td><td>' + esc(g.nombre || '') + '</td>' : '') +
        (asig ? '<td>' + esc(g.nombre || '') + '</td><td>' + esc(g.documento || '') + '</td><td>' + (g.desde ? esc(_acFecha(g.desde)) : '') + '</td>' : '') +
        '<td><div class="acl-acc">' + acc + '</div></td></tr>';
    }).join('') + '</tbody></table></div>';
}
// Acciones directas de la lista: abren el detalle ya en el formulario que corresponde.
async function activosAccionEstado(id) {
  await activosVer(id);
  var s = _acEl('ac-nuevo-estado'); if (s) { try { s.scrollIntoView({ block: 'center' }); } catch (e) { /* sin scroll */ } s.focus(); }
}
async function activosAccionRecibir(id) {
  await activosVer(id);
  if (_ac.sel && _ac.sel.agente) await activosGestion('quitar');
}
// Fase GH5c: vista «Inventario» con una tarjeta por tipo (libres, en uso, reparación y malos).
function activosInvTiposHtml(tipos, porTipo, actual) {
  var activos = tipos.filter(function (t) { return t.activo !== false; });
  var chips = '<div class="acp-chips" role="group" aria-label="Ver tipo"><button type="button" class="acp-chip' + (!actual ? ' on' : '') + '" aria-pressed="' + String(!actual) + '" onclick="activosInvTipo(\'\')">Todos</button>' +
    activos.map(function (t) { return '<button type="button" class="acp-chip' + (actual === t.codigo ? ' on' : '') + '" aria-pressed="' + String(actual === t.codigo) + '" onclick="activosInvTipo(\'' + esc(t.codigo) + '\')">' + esc(t.plural || t.nombre) + '</button>'; }).join('') + '</div>';
  var est = [['libre', 'Libres'], ['en_uso', 'En uso'], ['en_reparacion', 'Reparación'], ['malo', 'Malos']];
  var cards = activos.map(function (t) {
    var x = porTipo[t.codigo] || {}, total = Object.keys(x).reduce(function (a, k) { return a + (x[k] || 0); }, 0);
    return '<article class="acp-card aci-card' + (actual === t.codigo ? ' aci-sel' : '') + '"><div class="acr-top"><h4><span class="acl-tipo" data-tipo="' + esc(t.codigo) + '">' + esc(t.nombre) + '</span></h4><b class="aci-total" title="Total">' + total + '</b></div>' +
      '<dl class="aci-est">' + est.map(function (e) { return '<div><dt>' + esc(e[1]) + '</dt><dd>' + (x[e[0]] || 0) + '</dd></div>'; }).join('') + '</dl>' +
      '<button type="button" class="acp-btn" onclick="activosInvTipo(\'' + esc(t.codigo) + '\')">Ver detalle</button></article>';
  }).join('');
  return chips + '<div class="acr-grid aci-grid">' + cards + '</div>';
}
async function _acInvTipos() {
  var c = _acEl('ac-inv-tipos'); if (!c) return;
  c.classList.toggle('hidden', _ac.tab !== 'elementos');
  if (_ac.tab !== 'elementos') return;
  try { var r = await apiRequest('GET', '/activos/resumen?ambito=' + _ac.ambito); c.innerHTML = activosInvTiposHtml(_ac.config.tipos, r.porTipo || {}, _acEl('ac-f-tipo').value); }
  catch (e) { _acError(e.message); }
}
function activosInvTipo(codigo) { _acEl('ac-f-tipo').value = codigo || ''; activosBuscar(); _acInvTipos(); }

// Detalle: datos, cambio de estado con motivo e historial.
async function activosVer(id) {
  _acError('');
  var r;
  try { r = await apiRequest('GET', '/activos/' + id + '/historial'); } catch (e) { _acError(e.message); return; }
  _ac.sel = r.activo; _ac.selHist = r.historial; // Fase INV5: para la ficha imprimible
  var a = r.activo, t = _acTipo(a.tipo) || { campos: [], nombre: a.tipo };
  var datos = t.campos.filter(function (c) { return a.datos[c.k] !== undefined; }).map(function (c) { return '<dt>' + esc(c.l) + '</dt><dd>' + esc(a.datos[c.k]) + '</dd>'; }).join('');
  var opciones = _ac.config.estados.filter(function (e) { return e.codigo !== a.estado && (e.codigo !== 'en_uso' || a.tipo === 'ADMINISTRABLE'); });
  var hist = r.historial.map(function (h) { return '<li><b>' + esc(h.accion) + '</b> · ' + esc(new Date(h.fecha).toLocaleString('es-CO', { timeZone: 'America/Bogota' })) + (h.estadoAntes && h.estadoDespues && h.estadoAntes !== h.estadoDespues ? ' · ' + esc(_acEstadoNombre(h.estadoAntes)) + ' → ' + esc(_acEstadoNombre(h.estadoDespues)) : '') + (h.motivo ? ' · ' + esc(h.motivo) : '') + ' · ' + esc(h.quien) + '</li>'; }).join('');
  _acEl('ac-detalle').innerHTML = '<section class="aurora-card"><div class="aurora-card-title">' + esc(t.nombre) + ' ' + esc(a.codigo) + ' · <span class="vis-pill ' + AC_CLASE_ESTADO[a.estado] + '">' + esc(_acEstadoNombre(a.estado)) + '</span></div>' +
    '<dl class="wv-estado"><dt>Marca</dt><dd>' + esc(a.marca || '—') + '</dd><dt>Modelo</dt><dd>' + esc(a.modelo || '—') + '</dd><dt>Serial</dt><dd>' + esc(a.serial || '—') + '</dd><dt>Sede</dt><dd>' + esc(a.sede || '—') + '</dd><dt>Operación</dt><dd>' + esc(a.operacion || '—') + '</dd><dt>Propietario / proveedor</dt><dd>' + esc(a.proveedor || '—') + '</dd>' + (a.rendimiento ? '<dt>Rendimiento</dt><dd>' + activosRendHtml(a, _ac.config) + '</dd>' : '') + (a.agente ? '<dt>Asignado a</dt><dd>' + esc(a.agente.nombre) + '</dd>' : '') + datos + (a.observaciones ? '<dt>Observaciones</dt><dd>' + esc(a.observaciones) + '</dd>' : '') + '</dl>' +
    activosGestionHtml(a, _ac.ambito) + '<div id="ac-gestion"></div>' + // Fase 378 (I3): asignar, reasignar, cambiar y quitar desde el elemento
    (a.estado !== 'de_baja' && opciones.length ? '<form class="ac-estado-form" onsubmit="activosCambiarEstado(event)"><div class="ig"><label for="ac-nuevo-estado">Cambiar estado a</label><select id="ac-nuevo-estado" onchange="activosEstadoTecnico()">' + _acOpciones(opciones) + '</select></div>' +
      '<div class="ig ac-motivo"><label for="ac-motivo">Motivo / diagnóstico</label><input type="text" id="ac-motivo" maxlength="300" list="ac-motivos-lista" placeholder="Ej.: no enciende, pantalla dañada, reparado…"></div>' +
      '<div class="ig" id="ac-tecnico-ig"><label for="ac-tecnico">Técnico o proveedor</label><input type="text" id="ac-tecnico" maxlength="80" placeholder="Ej.: soporte interno"></div>' +
      (a.agente ? '<p class="vis-ayuda ac-form-titulo">Está asignado a ' + esc(a.agente.nombre) + ': al cambiar el estado se registra la devolución.</p>' : '') + '<button type="submit" class="btn-primary">Cambiar estado</button></form>' : '') +
    '<h4 class="ac-sub">Historial</h4><ul class="ac-hist">' + hist + '</ul><div class="modal-btns"><button type="button" class="btn-cancel" onclick="activosImprimirFicha()">Imprimir ficha</button><button type="button" class="btn-cancel" onclick="activosCerrarDetalle()">Volver a la lista</button></div></section>'; // Fase INV5: ficha imprimible
  _acEl('ac-detalle').classList.remove('hidden');
  _acEl('ac-lista-zona').classList.add('hidden');
  _acEl('ac-detalle').scrollIntoView({ block: 'start' });
  if (_acEl('ac-nuevo-estado')) activosEstadoTecnico();
}
// ── Fase 378 (I3, diseño de Edwin): gestión desde el elemento ──
// Libre → «Asignar a un agente»; asignado → Reasignar, Cambiar elemento o Quitar asignación, y «Ver agente».
// Los inmuebles y los equipos administrables no se asignan.
function activosGestionHtml(a, ambito) {
  if (ambito === 'inmuebles' || a.tipo === 'ADMINISTRABLE' || a.estado === 'de_baja') return '';
  if (a.agente) {
    return '<div class="ac-gestion-cab"><p class="ac-gestion-txt">Asignado a <b>' + esc(a.agente.nombre) + '</b></p>' +
      '<button type="button" class="btn-cancel ac-btn" onclick="activosIrAgente(' + Number(a.agente.id) + ')">Ver agente</button></div>' +
      '<div class="ac-acciones" role="group" aria-label="Asignación">' +
      [['reasignar', 'Reasignar a otro agente'], ['cambiar', 'Cambiar elemento'], ['quitar', 'Quitar asignación']].map(function (x) {
        return '<button type="button" class="btn-cancel ac-btn" data-ac-gestion="' + x[0] + '" onclick="activosGestion(\'' + x[0] + '\')">' + esc(x[1]) + '</button>';
      }).join('') + '</div>';
  }
  if (a.estado !== 'libre') return '<p class="vis-ayuda">Para asignarlo, primero márcalo como «Libre».</p>';
  return '<div class="ac-acciones"><button type="button" class="btn-primary ac-btn" data-ac-gestion="asignar" onclick="activosGestion(\'asignar\')">Asignar a un agente</button></div>';
}
// Selector de agente: los activos y «Agente nuevo…» (nombre, cédula y operación).
function activosAgenteSelectHtml(agentes, excluirId, operaciones) {
  return '<div class="ig"><label for="ac-g-agente">Agente</label><select id="ac-g-agente" onchange="activosAgenteNuevoToggle()"><option value="">Elige un agente…</option>' +
    agentes.filter(function (g) { return g.id !== excluirId; }).map(function (g) { return '<option value="' + Number(g.id) + '">' + esc(g.nombre) + (g.documento ? ' · ' + esc(g.documento) : '') + '</option>'; }).join('') +
    '<option value="__nuevo">➕ Agente nuevo…</option></select></div>' +
    '<div class="ac-g-nuevo hidden" id="ac-g-nuevo"><div class="ig"><label for="ac-g-nombre">Nombre completo</label><input type="text" id="ac-g-nombre" maxlength="80" autocomplete="off"></div>' +
    '<div class="ig"><label for="ac-g-doc">Cédula</label><input type="text" id="ac-g-doc" maxlength="20" inputmode="numeric" autocomplete="off" aria-describedby="ac-g-doc-aviso" onchange="activosCedulaGh(\'ac-g-doc\',\'ac-g-nombre\',\'ac-g-doc-aviso\')"><p class="ac-gh-aviso" id="ac-g-doc-aviso" role="status" aria-live="polite"></p></div>' +
    '<div class="ig"><label for="ac-g-op">Operación</label><select id="ac-g-op">' + _acOpciones(operaciones || [], null, '—') + '</select></div></div>';
}
// Pedido de Edwin (25/11/2026): al cambiar la cédula de un agente nuevo, su nombre desde Talento humano. Si no está,
// se deja escribir el nombre a mano con el aviso «No se encontró en Talento humano». El nombre traído se puede
// corregir; si el usuario ya había escrito otro, no se pisa. Nada de la cédula va a la consola ni a un toast.
function activosCedulaAviso(r) { // puro (pruebas): texto y clase del aviso
  if (!r) return { texto: '', clase: '' };
  if (r.error) return { texto: r.error, clase: 'no' };
  return r.encontrado ? { texto: 'Nombre tomado de Talento humano.', clase: 'si' } : { texto: 'No se encontró en Talento humano. Escribe el nombre a mano.', clase: 'no' };
}
async function activosCedulaGh(idDoc, idNombre, idAviso) {
  var doc = _acEl(idDoc), nom = _acEl(idNombre), av = _acEl(idAviso);
  if (!doc || !nom || !av) return;
  var v = String(doc.value || '').trim();
  var pintar = function (r) { var a = activosCedulaAviso(r); av.textContent = a.texto; av.className = 'ac-gh-aviso' + (a.clase ? ' ' + a.clase : ''); };
  if (v.length < 3) { pintar(null); return; }
  var r;
  try { r = await apiRequest('POST', '/activos/gh-nombre', { documento: v }); }
  catch (e) { pintar({ error: e.status === 429 ? 'Demasiadas búsquedas de cédula. Espera unos minutos.' : 'No se pudo buscar en Talento humano.' }); return; }
  if (String(doc.value || '').trim() !== v) return; // cambió mientras buscaba
  if (r && r.encontrado && (!nom.value.trim() || nom.dataset.gh === '1')) {
    nom.value = r.nombre; nom.dataset.gh = '1';
    // Si después lo corrigen a mano, ya no es «de Talento humano»: otra búsqueda no lo pisa.
    nom.oninput = function () { nom.dataset.gh = ''; };
  }
  pintar(r);
}
function activosAgenteNuevoToggle() { _acEl('ac-g-nuevo').classList.toggle('hidden', _acEl('ac-g-agente').value !== '__nuevo'); }
// Cuerpo de la petición con el agente elegido o el nuevo (exportada para las pruebas).
function activosAgenteBody(valor, nuevo) {
  if (valor === '__nuevo') return { agenteNuevo: { nombre: nuevo.nombre, documento: nuevo.documento, operacion: nuevo.operacion } };
  return Number(valor) ? { agenteId: Number(valor) } : null;
}
function activosEstadoTecnico() { var s = _acEl('ac-nuevo-estado'); _acEl('ac-tecnico-ig').classList.toggle('hidden', !s || s.value !== 'en_reparacion'); }
function activosIrAgente(id) { activosTab('agentes'); activosVerAgente(id); }
async function activosGestion(modo) {
  _acError('');
  var a = _ac.sel, c = _acEl('ac-gestion');
  document.querySelectorAll('#ac-detalle [data-ac-gestion]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-ac-gestion') === modo)); });
  var estados = _ac.config.estados.filter(function (e) { return ['libre', 'en_reparacion', 'malo'].indexOf(e.codigo) !== -1; });
  var html = '', boton = { asignar: 'Asignar', reasignar: 'Reasignar', cambiar: 'Cambiar elemento', quitar: 'Quitar asignación' }[modo];
  try {
    if (modo === 'asignar' || modo === 'reasignar') {
      var ags = (await apiRequest('GET', '/activos/agentes')).agentes || [];
      html = activosAgenteSelectHtml(ags, a.agente ? a.agente.id : null, _ac.config.listas.operaciones);
      if (modo === 'reasignar') html += '<div class="ig ac-motivo"><label for="ac-g-motivo">Motivo</label><input type="text" id="ac-g-motivo" maxlength="300" list="ac-motivos-lista" placeholder="Ej.: cambio de puesto"></div>';
    } else if (modo === 'cambiar') {
      var libres = await _acLibres(a.tipo);
      if (!libres.length) { _acError('No hay otro elemento libre de este tipo para el cambio'); c.innerHTML = ''; return; }
      html = '<div class="ig"><label for="ac-g-nuevoel">Elemento que recibe</label><select id="ac-g-nuevoel">' + _acOpcionesElem(libres) + '</select></div>';
    }
    if (modo === 'cambiar' || modo === 'quitar') {
      html += '<div class="ig"><label for="ac-g-estado">' + esc(a.codigo) + ' queda</label><select id="ac-g-estado">' + _acOpciones(estados) + '</select></div>' +
        '<div class="ig ac-motivo"><label for="ac-g-motivo">Motivo</label><input type="text" id="ac-g-motivo" maxlength="300" list="ac-motivos-lista" placeholder="Ej.: daño, retiro del agente, vacaciones…"></div>';
    }
  } catch (e) { _acError(e.message); return; }
  c.innerHTML = '<form class="ac-asig-form" onsubmit="activosGestionEnviar(event,\'' + modo + '\')"><h5 class="ac-sub ac-form-titulo">' + esc(boton) + ' · ' + esc(a.codigo) + '</h5>' + html +
    '<button type="submit" class="btn-primary">' + esc(boton) + '</button><button type="button" class="btn-cancel" onclick="activosGestionCancelar()">Cancelar</button></form>';
  var f = c.querySelector('select, input'); if (f) f.focus();
}
function activosGestionCancelar() { _acEl('ac-gestion').innerHTML = ''; document.querySelectorAll('#ac-detalle [data-ac-gestion]').forEach(function (b) { b.removeAttribute('aria-pressed'); }); }
async function activosGestionEnviar(ev, modo) {
  ev.preventDefault();
  _acError('');
  var a = _ac.sel, b = {}, ruta = modo === 'quitar' ? 'devolver' : modo;
  if (modo === 'asignar' || modo === 'reasignar') {
    var sel = activosAgenteBody(_acEl('ac-g-agente').value, { nombre: (_acEl('ac-g-nombre') || {}).value, documento: (_acEl('ac-g-doc') || {}).value, operacion: (_acEl('ac-g-op') || {}).value });
    if (!sel) { _acError('Elige un agente o «Agente nuevo…»'); return; }
    b = sel;
  }
  if (modo === 'cambiar') b.nuevoId = Number(_acEl('ac-g-nuevoel').value);
  if (modo === 'cambiar' || modo === 'quitar') b.estado = _acEl('ac-g-estado').value;
  if (_acEl('ac-g-motivo')) b.motivo = _acEl('ac-g-motivo').value;
  try {
    var r = await apiRequest('POST', '/activos/' + a.id + '/' + ruta, b);
    showToast({ asignar: 'Elemento asignado', reasignar: 'Elemento reasignado', cambiar: 'Elemento cambiado', quitar: 'Asignación quitada' }[modo] + (r && r.agenteCreado ? ' (agente nuevo creado)' : '') + activosActasAviso(r && r.actas), 'ok');
    await activosVer(a.id);
    _acRefrescarMenu();
  } catch (e) { _acError(e.message); }
}
// ── Fase 380 (I5, diseño de Edwin): vista «Equipos administrables» ──
// Mismos estados del inventario, con los nombres del diseño para la red.
var AC_ESTADO_ADMIN = { libre: 'Disponible', en_uso: 'Activo', en_reparacion: 'En mantenimiento', malo: 'Fuera de servicio', de_baja: 'Dado de baja' };
function activosAdminHtml(lista) {
  if (!lista.length) return '<p class="vis-vacio">Ningún equipo administrable con estos filtros. Regístralos en «Registrar ingreso».</p>';
  return '<div class="table-wrap"><table class="vis-tabla"><thead><tr><th scope="col">Código</th><th scope="col">Tipo</th><th scope="col">Marca / modelo</th><th scope="col">Serial</th><th scope="col">Dirección IP</th><th scope="col">Sede</th><th scope="col">Ubicación</th><th scope="col">Responsable</th><th scope="col">Estado</th><th scope="col"><span class="sr-only">Acciones</span></th></tr></thead><tbody>' +
    lista.map(function (a) {
      var d = a.datos || {};
      return '<tr><th scope="row">' + esc(a.codigo) + '</th><td>' + esc(d.subtipo || '') + '</td><td>' + esc([a.marca, a.modelo].filter(Boolean).join(' ')) + '</td><td>' + esc(a.serial) + '</td><td class="ac-ip">' + esc(d.ip || '') + '</td>' +
        '<td>' + esc(a.sede) + '</td><td>' + esc(d.ubicacion || '') + '</td><td>' + esc(d.responsable || '') + '</td><td><span class="vis-pill ' + (AC_CLASE_ESTADO[a.estado] || '') + '">' + esc(AC_ESTADO_ADMIN[a.estado] || a.estado) + '</span></td>' +
        '<td><button type="button" class="btn-cancel ac-btn" onclick="activosAdminVer(' + Number(a.id) + ')">Ver</button></td></tr>';
    }).join('') + '</tbody></table></div>';
}
function activosAdminKpisHtml(todos) {
  var n = function (e) { return todos.filter(function (a) { return a.estado === e; }).length; };
  return '<div class="ac-kpis"><div class="ac-kpi"><b>' + todos.length + '</b><span>Registrados</span></div>' + Object.keys(AC_ESTADO_ADMIN).map(function (e) {
    return '<button type="button" class="ac-kpi ac-rend-kpi" onclick="activosAdminFiltrarEstado(\'' + e + '\')"><b>' + n(e) + '</b><span class="vis-pill ' + AC_CLASE_ESTADO[e] + '">' + esc(AC_ESTADO_ADMIN[e]) + '</span></button>';
  }).join('') + '</div>';
}
function activosAdminSubtiposHtml(todos, subtipos, actual) {
  return [''].concat(subtipos).map(function (s) {
    var c = s ? todos.filter(function (a) { return (a.datos || {}).subtipo === s; }).length : todos.length;
    return '<button type="button" class="btn-cancel ac-btn" aria-pressed="' + String(s === actual) + '" onclick="activosAdminSubtipo(this.dataset.s)" data-s="' + esc(s) + '">' + esc(s || 'Todos') + ' (' + c + ')</button>';
  }).join('');
}
function activosAdminFiltrarEstado(e) { _acEl('ac-ad-estado').value = e; activosAdminBuscar(); }
function activosAdminSubtipo(s) { _ac.adSubtipo = s || ''; activosAdminBuscar(); }
async function activosAdminBuscar() {
  _acError('');
  var sedeSel = _acEl('ac-ad-sede'), estSel = _acEl('ac-ad-estado');
  var sv = sedeSel.value, ev = estSel.value;
  sedeSel.innerHTML = _acOpciones(_ac.config.listas.sedes, sv, 'Todas') + '<option value="__none"' + (sv === '__none' ? ' selected' : '') + '>Sin sede</option>';
  estSel.innerHTML = '<option value="">Todos</option>' + Object.keys(AC_ESTADO_ADMIN).map(function (e) { return '<option value="' + e + '"' + (e === ev ? ' selected' : '') + '>' + esc(AC_ESTADO_ADMIN[e]) + '</option>'; }).join('');
  var c = _acEl('ac-ad-lista');
  c.innerHTML = '<p class="vis-vacio">Cargando…</p>';
  try {
    var todos = (await apiRequest('GET', '/activos?ambito=sistemas&tipo=ADMINISTRABLE')).activos;
    var t = _acTipo('ADMINISTRABLE'), sub = t ? (t.campos.find(function (x) { return x.k === 'subtipo'; }) || {}).o || [] : [];
    var q = _acEl('ac-ad-q').value.trim().toLowerCase();
    var l = todos.filter(function (a) {
      if (_ac.adSubtipo && (a.datos || {}).subtipo !== _ac.adSubtipo) return false;
      if (sedeSel.value && (sedeSel.value === '__none' ? a.sede : a.sede !== sedeSel.value)) return false;
      if (estSel.value && a.estado !== estSel.value) return false;
      return !q || [a.codigo, a.marca, a.modelo, a.serial, a.sede, (a.datos || {}).ip, (a.datos || {}).responsable, (a.datos || {}).ubicacion].join(' ').toLowerCase().indexOf(q) !== -1;
    });
    _ac.adLista = l; // Fase 381: para Excel/PDF
    var base = todos.filter(function (a) { return !_ac.adSubtipo || (a.datos || {}).subtipo === _ac.adSubtipo; });
    _acEl('ac-ad-kpis').innerHTML = activosAdminKpisHtml(base);
    _acEl('ac-ad-subtipos').innerHTML = activosAdminSubtiposHtml(todos, sub, _ac.adSubtipo || '');
    _acEl('ac-ad-conteo').textContent = l.length + (l.length === 1 ? ' equipo' : ' equipos') + ' con estos filtros (de ' + todos.length + ')';
    c.innerHTML = activosAdminHtml(l);
  } catch (e) { c.innerHTML = ''; _acError(e.message); }
}
function activosAdminVer(id) { activosTab('elementos'); activosVer(id); }
// ── Fase 381 (I6, diseño de Edwin): historial general, Excel/PDF de cada vista e importación ──
var AC_ESTADO_TXT = { libre: 'Libre', en_uso: 'Asignado', en_reparacion: 'En reparación', malo: 'Malo', de_baja: 'De baja' };
// Columnas y filas (texto plano) de cada vista, con lo que la vista muestra ahora (filtros incluidos).
function activosFilasExport(vista, lista, config) {
  var tipoN = function (c) { var t = ((config && config.tipos) || []).find(function (x) { return x.codigo === c; }); return t ? t.nombre : c; };
  var f = function (x) { return x ? _acFecha(x) : ''; };
  if (vista === 'admin') return { titulo: 'Equipos administrables', cols: ['Código', 'Tipo', 'Marca', 'Modelo', 'Serial', 'Dirección IP', 'Sede', 'Ubicación', 'Responsable', 'Estado'],
    filas: lista.map(function (a) { var d = a.datos || {}; return [a.codigo, d.subtipo || '', a.marca || '', a.modelo || '', a.serial || '', d.ip || '', a.sede || '', d.ubicacion || '', d.responsable || '', AC_ESTADO_ADMIN[a.estado] || a.estado]; }) };
  // Fase INV5 (HTML de Edwin): hoja «Agentes y equipos asignados».
  if (vista === 'agentes') return { titulo: 'Agentes y equipos asignados', cols: ['Nombre', 'Documento', 'Operación', 'Sede', 'Equipos asignados', 'Estado'],
    filas: lista.map(function (g) { return [g.nombre, g.documento || '', g.operacion || '', g.sede || '', (g.equipos || []).map(function (e) { return e.tipo + ' ' + e.codigo; }).join(', '), g.activo ? 'Activo' : 'Inactivo']; }) };
  if (vista === 'actas') return { titulo: 'Actas', cols: ['N.º', 'Tipo', 'Fecha', 'Agente', 'Elementos', 'Motivo', 'Estado'],
    filas: lista.map(function (a) { return [a.numero, a.tipoNombre, f(a.fecha), a.agente ? a.agente.nombre : '', a.elementos.map(function (e) { return e.tipo + ' ' + e.codigo; }).join(', '), a.motivo || '', a.estado === 'anulada' ? 'Anulada' : a.firmada ? 'Firmada' : a.atrasada ? 'Atrasada' : 'Por firmar']; }) };
  if (vista === 'historial') return { titulo: 'Historial del inventario', cols: ['Fecha', 'Tipo', 'Código', 'Acción', 'Antes', 'Después', 'Motivo', 'Quién'],
    filas: lista.map(function (h) { return [f(h.fecha), tipoN(h.tipo), h.codigo, h.accion, AC_ESTADO_TXT[h.estadoAntes] || h.estadoAntes || '', AC_ESTADO_TXT[h.estadoDespues] || h.estadoDespues || '', h.motivo || '', h.quien || '']; }) };
  return { titulo: 'Inventario', cols: ['Código', 'Tipo', 'Estado', 'Marca', 'Modelo', 'Serial', 'RAM (GB)', 'Sede', 'Operación', 'Propietario / proveedor', 'Agente'],
    filas: lista.map(function (a) { var d = a.datos || {}; return [a.codigo, tipoN(a.tipo), AC_ESTADO_TXT[a.estado] || a.estado, a.marca || '', a.modelo || '', a.serial || '', typeof d.ram_gb === 'number' ? d.ram_gb : '', a.sede || '', a.operacion || '', a.proveedor || '', a.agente ? a.agente.nombre : '']; }) };
}
// Página para imprimir / guardar como PDF (todo escapado, sin scripts).
// ── Fase INV5 (HTML de Edwin, «printFicha»): ficha imprimible de un elemento ──
// Todos sus datos en pares, la asignación actual y el historial. Si está asignado, con las firmas de Edwin.
function activosFichaPrintHtml(a, tipo, historial, estadoN, cuando) {
  tipo = tipo || { nombre: a.tipo, campos: [] };
  var pares = [['Código', a.codigo], ['Tipo', tipo.nombre], ['Estado', estadoN(a.estado)], ['Marca', a.marca], ['Modelo', a.modelo], ['Serial', a.serial], ['Sede', a.sede], ['Operación', a.operacion], ['Propietario / proveedor', a.proveedor]]
    .concat((tipo.campos || []).filter(function (c) { return a.datos && a.datos[c.k] !== undefined && a.datos[c.k] !== ''; }).map(function (c) { return [c.l, a.datos[c.k]]; }));
  var tabla = function (titulo, l) {
    var filas = [];
    for (var i = 0; i < l.length; i += 2) filas.push('<tr><td class="k">' + esc(l[i][0]) + '</td><td>' + esc(l[i][1] === null || l[i][1] === undefined || l[i][1] === '' ? '—' : l[i][1]) + '</td>' + (l[i + 1] ? '<td class="k">' + esc(l[i + 1][0]) + '</td><td>' + esc(l[i + 1][1] === null || l[i + 1][1] === undefined || l[i + 1][1] === '' ? '—' : l[i + 1][1]) + '</td>' : '<td class="k"></td><td></td>') + '</tr>');
    return '<table class="fic"><tr><th colspan="4">' + esc(titulo) + '</th></tr>' + filas.join('') + '</table>';
  };
  var g = a.agente;
  var fecha = function (x) { return x ? new Date(x).toLocaleString('es-CO', { timeZone: 'America/Bogota' }) : ''; };
  var hist = (historial || []).slice(0, 20) /* llega del más nuevo al más viejo */.map(function (h) { return '<tr><td>' + esc(fecha(h.fecha)) + '</td><td>' + esc(h.accion) + '</td><td>' + esc(h.estadoAntes && h.estadoDespues && h.estadoAntes !== h.estadoDespues ? estadoN(h.estadoAntes) + ' → ' + estadoN(h.estadoDespues) : '') + '</td><td>' + esc(h.motivo || '') + '</td><td>' + esc(h.quien || '') + '</td></tr>'; }).join('');
  return '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Ficha ' + esc(tipo.nombre) + ' ' + esc(a.codigo) + '</title>' +
    '<style>@page{size:A4;margin:14mm}body{font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;font-size:11px;line-height:1.4}.ph{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #1a1a1a;padding-bottom:6px;margin-bottom:12px}' +
    'h1{font-size:17px;margin:0 0 2px}.cod{font-size:16px;font-weight:bold}table{width:100%;border-collapse:collapse;margin:0 0 12px}th,td{border:1px solid #999;padding:4px 6px;text-align:left;vertical-align:top}th{background:#eee}td.k{font-weight:bold;width:22%;background:#fafafa}' +
    '.firmas{display:grid;grid-template-columns:1fr 1fr;gap:48px;margin-top:48px}.firma{border-top:1px solid #1a1a1a;padding-top:6px}.pie{margin-top:24px;color:#666;font-size:9px}</style></head><body>' +
    '<div class="ph"><div><h1>Ficha de ' + esc(String(tipo.nombre).toLowerCase()) + '</h1><div>InConexion® · Inventario de sistemas</div></div><div style="text-align:right">Código <span class="cod">' + esc(a.codigo) + '</span><br>Impreso: ' + esc(cuando) + '</div></div>' +
    tabla('Datos del elemento', pares) +
    (g ? tabla('Asignación actual', [['Agente', g.nombre], ['Documento', g.documento], ['Asignado desde', fecha(g.desde)]]) : '') +
    (a.observaciones ? '<table><tr><th>Observaciones</th></tr><tr><td>' + esc(a.observaciones) + '</td></tr></table>' : '') +
    (hist ? '<table><thead><tr><th colspan="5">Historial (últimos movimientos)</th></tr><tr><th>Fecha</th><th>Acción</th><th>Estado</th><th>Motivo</th><th>Quién</th></tr></thead><tbody>' + hist + '</tbody></table>' : '') +
    (g ? '<p>Quien recibe declara que el elemento se entrega en buen estado y se compromete a su cuidado y uso adecuado para las labores asignadas.</p><div class="firmas"><div class="firma">Entrega (Sistemas)<br>Nombre:<br>Fecha:</div><div class="firma">Recibe (agente): ' + esc(g.nombre) + '<br>Documento: ' + esc(g.documento || '') + '<br>Fecha:</div></div>' : '') +
    '<p class="pie">Ficha informativa. Las entregas y devoluciones se firman en su acta (Inventario de sistemas → Actas).</p></body></html>';
}
function activosImprimirFicha() {
  var a = _ac.sel; if (!a) return;
  var w = window.open('', '_blank');
  if (!w) { showToast('Permite las ventanas emergentes para imprimir la ficha.', 'error'); return; }
  w.document.open(); w.document.write(activosFichaPrintHtml(a, _acTipo(a.tipo), _ac.selHist, _acEstadoNombre, new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' }))); w.document.close();
  setTimeout(function () { try { w.focus(); w.print(); } catch (e) { /* ventana cerrada */ } }, 300);
}
function activosReportePrintHtml(t, cuando) {
  return '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>' + esc(t.titulo) + '</title>' +
    '<style>@page{size:A4 landscape;margin:12mm}body{font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;font-size:10px}h1{font-size:15px;margin:0 0 2px}p{margin:0 0 10px;color:#555}' +
    'table{border-collapse:collapse;width:100%}th,td{border:1px solid #bbb;padding:3px 5px;text-align:left;vertical-align:top}th{background:#eef2f4}</style></head><body>' +
    '<h1>' + esc(t.titulo) + '</h1><p>InConexión · ' + esc(cuando) + ' · ' + t.filas.length + (t.filas.length === 1 ? ' fila' : ' filas') + '</p>' +
    '<table><thead><tr>' + t.cols.map(function (c) { return '<th>' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>' +
    t.filas.map(function (r) { return '<tr>' + r.map(function (v) { return '<td>' + esc(v === null || v === undefined ? '' : v) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></body></html>';
}
function activosExportar(vista, formato) {
  var lista = { elementos: _ac.lista, admin: _ac.adLista, actas: _ac.actasLista, historial: _ac.histLista, agentes: _ac.agLista }[vista] || []; // Fase INV5: agentes
  if (!lista.length) { showToast('No hay filas para descargar con estos filtros.', 'error'); return; }
  var t = activosFilasExport(vista, lista, _ac.config);
  if (vista === 'elementos') t.titulo = (_ac.ambito === 'inmuebles' ? 'Inventario de inmuebles' : 'Inventario de sistemas') + ' · ' + (_ac.tab === 'ajustes' ? 'Todo' : (AC_VISTA_TXT[_ac.tab] || [''])[0]); // GH5d: «Exportar todo» desde Ajustes
  var hoy = new Date().toLocaleDateString('es-CO', { timeZone: 'America/Bogota' });
  if (formato === 'pdf') {
    var w = window.open('', '_blank');
    if (!w) { showToast('Permite las ventanas emergentes para descargar el PDF.', 'error'); return; }
    w.document.open(); w.document.write(activosReportePrintHtml(t, hoy)); w.document.close();
    setTimeout(function () { try { w.focus(); w.print(); } catch (e) { /* ventana cerrada */ } }, 300);
    return;
  }
  if (typeof XLSX === 'undefined') { showToast('No se pudo cargar el generador de Excel.', 'error'); return; }
  var ws = XLSX.utils.aoa_to_sheet([t.cols].concat(xlsxFilasSeguras(t.filas)));
  ws['!cols'] = t.cols.map(function (c) { return { wch: Math.max(10, c.length + 2) }; });
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, t.titulo.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31));
  XLSX.writeFile(wb, t.titulo.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '.xlsx');
}
// Historial general.
function activosHistorialHtml(lista, config) {
  if (!lista.length) return '<p class="vis-vacio">Nada en el historial con estos filtros.</p>';
  var t = activosFilasExport('historial', lista, config);
  return '<div class="table-wrap"><table class="vis-tabla"><thead><tr>' + t.cols.map(function (c) { return '<th scope="col">' + esc(c) + '</th>'; }).join('') + '</tr></thead><tbody>' +
    t.filas.map(function (r, i) {
      return '<tr><td>' + esc(r[0]) + '</td><td>' + esc(r[1]) + '</td><th scope="row"><button type="button" class="ac-link" onclick="activosAdminVer(' + Number(lista[i].activoId) + ')">' + esc(r[2]) + '</button></th>' +
        r.slice(3).map(function (v) { return '<td>' + esc(v) + '</td>'; }).join('') + '</tr>';
    }).join('') + '</tbody></table></div>';
}
async function activosHistorialBuscar() {
  _acError('');
  var q = ['ambito=' + _ac.ambito];
  [['desde', 'ac-h-desde'], ['hasta', 'ac-h-hasta'], ['accion', 'ac-h-accion'], ['q', 'ac-h-q']].forEach(function (p) { var v = _acEl(p[1]).value.trim(); if (v) q.push(p[0] + '=' + encodeURIComponent(v)); });
  var c = _acEl('ac-h-lista');
  c.innerHTML = '<p class="vis-vacio">Cargando…</p>';
  try {
    var r = await apiRequest('GET', '/activos/historial?' + q.join('&'));
    _ac.histLista = r.historial;
    var sel = _acEl('ac-h-accion'), v = sel.value;
    sel.innerHTML = '<option value="">Todas</option>' + r.acciones.map(function (a) { return '<option' + (a === v ? ' selected' : '') + '>' + esc(a) + '</option>'; }).join('');
    _acEl('ac-h-conteo').textContent = r.historial.length + (r.historial.length === 1 ? ' movimiento' : ' movimientos') + ' con estos filtros' + (r.historial.length >= 2000 ? ' (se muestran los 2.000 más recientes; acota las fechas)' : '');
    c.innerHTML = activosHistorialHtml(r.historial, _ac.config);
  } catch (e) { c.innerHTML = ''; _acError(e.message); }
}
// Importación: el navegador lee el Excel y manda las filas; el servidor revisa y, al confirmar, guarda.
function activosImportarColumnas(t) {
  var fijas = ['Código', 'Marca', 'Modelo', 'Serial', 'Sede', 'Operación', 'Propietario / proveedor', 'Estado', 'Observaciones'];
  return fijas.concat(((t && t.campos) || []).filter(function (c) { return !c.oculto; }).map(function (c) { return c.l; }));
}
function activosImportarPlantilla() {
  var t = _acTipo(_acEl('ac-imp-tipo').value);
  if (!t) { showToast('Elige el tipo de elemento.', 'error'); return; }
  if (typeof XLSX === 'undefined') { showToast('No se pudo cargar el generador de Excel.', 'error'); return; }
  var ws = XLSX.utils.aoa_to_sheet([activosImportarColumnas(t)]);
  var wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Elementos');
  XLSX.writeFile(wb, 'plantilla-' + t.codigo.toLowerCase() + '.xlsx');
}
function activosImportarResultadoHtml(r, confirmado) {
  var errores = r.detalle.filter(function (d) { return !d.ok; });
  var cab = confirmado ? '<p class="vis-ayuda" role="status">Se importaron ' + Number(r.importadas) + ' elemento(s).' + (errores.length ? ' ' + errores.length + ' fila(s) con error quedaron fuera.' : '') + '</p>'
    : '<p class="vis-ayuda" role="status">Revisión: <b>' + Number(r.validas) + '</b> fila(s) listas y <b>' + Number(r.errores) + '</b> con error. Columnas reconocidas: ' + esc(r.columnas.join(', ') || 'ninguna') + '.</p>';
  var tabla = errores.length ? '<div class="table-wrap"><table class="vis-tabla"><thead><tr><th scope="col">Fila</th><th scope="col">Código</th><th scope="col">Error</th></tr></thead><tbody>' +
    errores.slice(0, 200).map(function (d) { return '<tr><td class="vis-num">' + Number(d.fila) + '</td><td>' + esc(d.codigo) + '</td><td>' + esc(d.error) + '</td></tr>'; }).join('') + '</tbody></table></div>' : '';
  var boton = !confirmado && r.validas ? '<button type="button" class="btn-primary ac-btn" onclick="activosImportarConfirmar()">Importar ' + Number(r.validas) + ' elemento(s)</button>' : '';
  return cab + tabla + boton;
}
async function activosImportarRevisar(input) {
  _acError('');
  var f = input.files && input.files[0], res = _acEl('ac-imp-res');
  _ac.importar = null;
  res.innerHTML = '';
  if (!f) return;
  if (f.size > 5 * 1024 * 1024) { _acError('El archivo pesa más de 5 MB.'); input.value = ''; return; }
  try {
    var wb = XLSX.read(new Uint8Array(await f.arrayBuffer()), { type: 'array' });
    var filas = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, blankrows: false, defval: null });
    var b = { tipo: _acEl('ac-imp-tipo').value, filas: filas.slice(0, 2001) };
    var r = await apiRequest('POST', '/activos/importar', b);
    _ac.importar = b;
    res.innerHTML = activosImportarResultadoHtml(r, false);
  } catch (e) { _acError(e.message); }
  input.value = '';
}
async function activosImportarConfirmar() {
  if (!_ac.importar) return;
  try {
    var r = await apiRequest('POST', '/activos/importar', Object.assign({}, _ac.importar, { confirmar: true }));
    _ac.importar = null;
    _acEl('ac-imp-res').innerHTML = activosImportarResultadoHtml(r, true);
    showToast('Importados: ' + r.importadas, 'ok');
    _acRefrescarMenu();
  } catch (e) { _acError(e.message); }
}
// Fase 377: desde el Panel, el inventario completo filtrado por un rendimiento.
function activosVerRendimiento(codigo) {
  ['tipo', 'estado', 'sede', 'operacion', 'proveedor', 'rend', 'q'].forEach(function (k) { var el = _acEl('ac-f-' + k); el.value = ''; el.removeAttribute('data-v'); });
  _acEl('ac-f-pend').checked = false; _acEl('ac-f-dup').checked = false;
  _ac.rendInicial = codigo;
  activosTab('elementos');
}
function activosCerrarDetalle() { activosCerrarDetalleSinBuscar(); activosBuscar(); _acRefrescarMenu(); }
function activosCerrarDetalleSinBuscar() { _acEl('ac-detalle').classList.add('hidden'); _acEl('ac-lista-zona').classList.remove('hidden'); }
async function activosCambiarEstado(ev) {
  ev.preventDefault();
  _acError('');
  try {
    _ac.ultimoEstado = await apiRequest('POST', '/activos/' + _ac.sel.id + '/estado', { estado: _acEl('ac-nuevo-estado').value, motivo: _acEl('ac-motivo').value, tecnico: _acEl('ac-tecnico').value });
    var rr = _ac.ultimoEstado; showToast('Estado cambiado' + activosActasAviso(rr && rr.actas), 'ok');
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
  _ac.regTipo = null; _acEl('ac-r-form').classList.add('hidden'); activosRegistrarTarjetas(); // Fase GH5b
}
function activosCambioTipo() {
  var esAdm = _acEl('ac-r-tipo').value === 'ADMINISTRABLE'; // Fase 380: código automático
  _acEl('ac-r-codigo').required = !esAdm; _acEl('ac-r-codigo-ayuda').classList.toggle('hidden', !esAdm);
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
    showToast('Registrado: ' + r.activo.codigo + (r.aviso ? '. Ojo: ' + r.aviso : ''), r.aviso ? 'warning' : 'ok');
    _acEl('ac-r-form').reset();
    _acEl('ac-r-tipo').value = b.tipo; // Fase GH5b: sigue en el tipo elegido
    activosCambioTipo();
    activosRegistrarTarjetas();
    _acEl('ac-r-nota').textContent = 'Se registró ' + r.activo.codigo + '. Puedes registrar el siguiente.';
  } catch (e) { _acError(e.message); }
}

// ── Ajustes: listas ──
function _acAjustes() {
  ['sedes', 'operaciones', 'proveedores', 'motivos'].forEach(function (l) { _acEl('ac-l-' + l).value = (_ac.config.listas[l] || []).join('\n'); });
  _acTipos(); _acTextos(); // Fase 372 (E4)
  _acEl('ac-imp-tipo').innerHTML = _acOpciones(_ac.config.tipos.filter(function (t) { return t.activo !== false; })); // Fase 381
  _acEl('ac-imp-res').innerHTML = '';
  _acEl('ac-aj-estados').innerHTML = activosAjEstadosHtml(_ac.config.estados); // Fase GH5d
}
// Fase GH5d: tarjeta «Estados» (solo lectura) y «Exportar todo a Excel».
function activosAjEstadosHtml(estados) {
  return (estados || []).map(function (e) { return '<li><span class="vis-pill ' + (AC_CLASE_ESTADO[e.codigo] || 'vis-gris') + '">' + esc(e.nombre) + '</span></li>'; }).join('');
}
function activosAjustesExcel() { _ac.panelTipo = ''; activosPanelExcel(); }
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
  q.push('equipos=1'); // Fase INV5: para la hoja «Agentes y equipos asignados»
  try { _ac.agLista = (await apiRequest('GET', '/activos/agentes?' + q.join('&'))).agentes; c.innerHTML = activosAgentesHtml(_ac.agLista); }
  catch (e) { _ac.agLista = []; c.innerHTML = ''; _acError(e.message); }
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
// Fase 379 (I4): un formato por tipo (título, columnas y quién firma). Sin agente (reparación, malo,
// baja o recibo de un elemento libre) no va el bloque del agente.
var AC_ACTA_FIRMAS = {
  entrega: ['Entrega (Sistemas)', 'Recibe (agente)'], devolucion: ['Devuelve (agente)', 'Recibe (Sistemas)'], cambio: ['Entrega (Sistemas)', 'Recibe (agente)'],
  reparacion: ['Entrega (Sistemas)', 'Recibe (técnico o proveedor)'], retorno: ['Entrega (técnico o proveedor)', 'Recibe (Sistemas)'],
  malo: ['Reporta (Sistemas)', 'Visto bueno (coordinación)'], baja: ['Elabora (Sistemas)', 'Aprueba (administración)'],
};
var AC_TEXTO_BASE = {
  entrega: 'Recibo los elementos de esta acta en buen estado, para uso exclusivo de mis funciones. Me comprometo a cuidarlos y a devolverlos cuando se me pidan o al terminar mi vinculación, y a informar a Sistemas cualquier daño o pérdida.',
  devolucion: 'Se reciben de vuelta los elementos de esta acta, en el estado que se indica en cada uno.',
};
function activosActaPrintHtml(acta) {
  var tipo = acta.tipo;
  var fecha = new Date(acta.fecha).toLocaleString('es-CO', { timeZone: 'America/Bogota' });
  var g = acta.agente && acta.agente.nombre ? acta.agente : null;
  var els = acta.elementos || [];
  var conDir = tipo === 'cambio' && els.some(function (e) { return e.dir; });
  var conQueda = els.some(function (e) { return e.queda; });
  var conMotivo = els.some(function (e) { return e.motivo; });
  var filas = els.map(function (e, i) {
    return '<tr><td>' + (i + 1) + '</td>' + (conDir ? '<td>' + esc(e.dir === 'recibe' ? 'Recibe' : e.dir === 'devuelve' ? 'Devuelve' : '') + '</td>' : '') + '<td>' + esc(e.tipo) + '</td><td>' + esc(e.codigo) + '</td><td>' + esc([e.marca, e.modelo].filter(Boolean).join(' ')) + '</td><td>' + esc(e.serial || '') + '</td>' +
      (conQueda ? '<td>' + esc(e.queda || '') + '</td>' : '') + (conMotivo ? '<td>' + esc(e.motivo || '') + '</td>' : '') + '</tr>';
  }).join('');
  // Fase 372: cada acta trae su copia del texto (Ajustes); las anteriores usan el de siempre.
  var texto = acta.texto ? acta.texto : (AC_TEXTO_BASE[tipo] || AC_TEXTO_BASE.devolucion);
  var firmas = AC_ACTA_FIRMAS[tipo] || ['Firma de quien entrega', 'Firma de quien recibe'];
  var titulo = 'Acta de ' + String(acta.tipoNombre || tipo).toLowerCase();
  return '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>' + esc(titulo) + ' ' + Number(acta.numero) + '</title>' +
    '<style>@page{size:A4;margin:16mm}body{font-family:Arial,Helvetica,sans-serif;color:#1a1a1a;font-size:12px;line-height:1.45}' +
    'h1{font-size:18px;margin:0 0 4px}.sub{color:#555;margin:0 0 16px}dl{display:grid;grid-template-columns:140px 1fr;gap:4px 12px;margin:0 0 16px}dt{font-weight:bold}dd{margin:0}' +
    'table{width:100%;border-collapse:collapse;margin:0 0 16px}th,td{border:1px solid #999;padding:5px 6px;text-align:left;vertical-align:top}th{background:#eee}' +
    '.firmas{display:grid;grid-template-columns:1fr 1fr;gap:48px;margin-top:56px}.firma{border-top:1px solid #1a1a1a;padding-top:6px}.pie{margin-top:32px;color:#666;font-size:10px}.anulada{color:#a00;font-weight:bold}</style></head><body>' +
    '<h1>' + esc(titulo) + ' N.º ' + Number(acta.numero) + '</h1>' +
    '<p class="sub">Inventario de sistemas · InConexión · ' + esc(fecha) + '</p>' +
    (acta.anulada ? '<p class="anulada">ANULADA: ' + esc(acta.anulada.motivo || '') + '</p>' : '') +
    '<dl>' + (g ? '<dt>Agente</dt><dd>' + esc(g.nombre || '') + '</dd><dt>Documento</dt><dd>' + esc(g.documento || '') + '</dd><dt>Sede</dt><dd>' + esc(g.sede || acta.sede || '') + '</dd><dt>Operación</dt><dd>' + esc(g.operacion || '') + '</dd>' : '<dt>Sede</dt><dd>' + esc(acta.sede || '') + '</dd>') +
    (acta.motivo ? '<dt>Motivo</dt><dd>' + esc(acta.motivo) + '</dd>' : '') + (acta.tecnico ? '<dt>Técnico o proveedor</dt><dd>' + esc(acta.tecnico) + '</dd>' : '') + '</dl>' +
    '<table><thead><tr><th>#</th>' + (conDir ? '<th>Movimiento</th>' : '') + '<th>Elemento</th><th>Código</th><th>Marca / modelo</th><th>Serial</th>' + (conQueda ? '<th>Queda</th>' : '') + (conMotivo ? '<th>Motivo</th>' : '') + '</tr></thead><tbody>' + filas + '</tbody></table>' +
    '<p>' + esc(texto) + '</p>' +
    '<div class="firmas"><div class="firma">' + esc(firmas[0]) + '<br>Nombre:<br>Documento:</div><div class="firma">' + esc(firmas[1]) + '<br>Nombre:<br>Documento:</div></div>' +
    '<p class="pie">Generada por ' + esc(acta.quien || '') + (acta.auto ? ' (automática)' : '') + '. Firmada, se escanea en PDF y se sube en la plataforma (Inventario de sistemas → Actas).</p>' +
    '</body></html>';
}

// ── Fase 379 (I4): vista «Actas» (todas, automáticas y manuales) ──
function activosActasAviso(actas) {
  var l = (actas || []).filter(Boolean);
  if (!l.length) return '';
  return '. ' + (l.length === 1 ? 'Acta N.º ' + Number(l[0].numero) + ' creada' : 'Actas N.º ' + l.map(function (a) { return Number(a.numero); }).join(' y ') + ' creadas') + ' (en «Actas»)';
}
var AC_CLASE_ACTA = { pendiente: 'vis-amarillo', firmada: 'vis-verde', anulada: 'vis-gris' };
var AC_ESTADO_ACTA = { pendiente: 'Por firmar', firmada: 'Firmada', anulada: 'Anulada' };
function activosActasKpisHtml(r) {
  return '<div class="ac-kpis">' + [['pendiente', 'Por firmar', r.pendientes, 'vis-amarillo'], ['atrasada', 'Atrasadas', r.atrasadas, 'vis-rojo'], ['firmada', 'Firmadas', r.firmadas, 'vis-verde'], ['anulada', 'Anuladas', r.anuladas, 'vis-gris']].map(function (k) {
    return '<button type="button" class="ac-kpi ac-rend-kpi" onclick="activosActasFiltrar(\'' + k[0] + '\')"><b>' + Number(k[2] || 0) + '</b><span class="vis-pill ' + k[3] + '">' + esc(k[1]) + '</span></button>';
  }).join('') + '</div>';
}
function activosActasHtml(lista, firmadasActivas, diasAtraso) {
  if (!lista.length) return '<p class="vis-vacio">Ninguna acta con estos filtros. Se crean solas al asignar, devolver, cambiar o cambiar de estado un elemento.</p>';
  return '<div class="table-wrap"><table class="vis-tabla"><thead><tr><th scope="col">N.º</th><th scope="col">Tipo</th><th scope="col">Fecha</th><th scope="col">Agente</th><th scope="col">Elementos</th><th scope="col">Motivo</th><th scope="col">Estado</th><th scope="col"><span class="sr-only">Acciones</span></th></tr></thead><tbody>' +
    lista.map(function (a) {
      var acc = '<button type="button" class="btn-cancel ac-btn" onclick="activosActaImprimirLista(' + Number(a.id) + ')">Imprimir / PDF</button>';
      if (a.firmada) acc += '<button type="button" class="btn-cancel ac-btn" onclick="activosDescargarFirmada(' + Number(a.id) + ')">Ver firmada</button>';
      if (a.estado === 'pendiente' && firmadasActivas) acc += '<label class="btn-cancel ac-btn ac-subir">Subir firmada<input type="file" accept="application/pdf" class="sr-only" onchange="activosSubirFirmadaLista(' + Number(a.id) + ', this)"></label>';
      if (a.estado === 'pendiente') acc += '<button type="button" class="btn-cancel ac-btn" onclick="activosActaAnularForm(' + Number(a.id) + ')">Anular</button>';
      var elems = (a.elementos || []).map(function (e) { return e.tipo + ' ' + e.codigo; }).join(', ');
      return '<tr><th scope="row">' + Number(a.numero) + '</th><td>' + esc(a.tipoNombre) + (a.auto ? '' : ' <span class="vis-ayuda">(manual)</span>') + '</td><td>' + esc(new Date(a.fecha).toLocaleDateString('es-CO', { timeZone: 'America/Bogota' })) + '</td>' +
        '<td>' + esc(a.agente ? a.agente.nombre : '—') + '</td><td>' + esc(elems) + '</td><td>' + esc(a.motivo || '') + (a.tecnico ? ' · ' + esc(a.tecnico) : '') + '</td>' +
        '<td><span class="vis-pill ' + (a.atrasada ? 'vis-rojo' : AC_CLASE_ACTA[a.estado]) + '">' + esc(a.atrasada ? 'Atrasada (' + Number(diasAtraso) + '+ días hábiles)' : AC_ESTADO_ACTA[a.estado]) + '</span></td>' +
        '<td><div class="ac-acciones">' + acc + '</div></td></tr>';
    }).join('') + '</tbody></table></div>';
}
function activosActasFiltrar(estado) { _acEl('ac-ac-estado').value = estado; activosActasPestana(estado === 'pendiente' || estado === 'firmada' ? estado : 'todas', true); }
// Fase GH5d (diseño de Edwin): pestañas «Actas pendientes», «Actas firmadas», «Todas» y «Novedades de GH».
var AC_ACTAS_PEST = [['pendiente', 'Actas pendientes'], ['firmada', 'Actas firmadas'], ['todas', 'Todas'], ['novedades', 'Novedades de GH']];
function activosActasPestanasHtml(actual, nNovedades) {
  return AC_ACTAS_PEST.map(function (x) {
    var on = x[0] === actual;
    return '<button type="button" class="acp-chip' + (on ? ' on' : '') + '" aria-pressed="' + String(on) + '" onclick="activosActasPestana(\'' + x[0] + '\')">' + esc(x[1]) +
      (x[0] === 'novedades' && nNovedades ? ' (' + Number(nNovedades) + ')' : '') + '</button>';
  }).join('');
}
function activosActasPestana(p, sinTocarEstado) {
  _ac.actasPest = p;
  var res = _ac.resumen && _ac.resumen.novedadesGH, nNov = res ? res.retirados + res.ausentes : 0;
  _acEl('ac-ac-pestanas').innerHTML = activosActasPestanasHtml(p, nNov);
  var nov = p === 'novedades';
  _acEl('ac-ac-zona').classList.toggle('hidden', nov);
  _acEl('ac-p-novedadesgh').classList.toggle('hidden', !nov);
  if (nov) { activosNovedadesGH(); return; }
  if (!sinTocarEstado) _acEl('ac-ac-estado').value = p === 'todas' ? '' : p;
  activosActasBuscar();
}
function activosActaManual() { activosTab('agentes'); _acError(''); var q = _acEl('ac-ag-q'); if (q) q.focus(); }
async function activosActasBuscar() {
  _acError('');
  var q = [];
  ['estado', 'tipo'].forEach(function (k) { var v = _acEl('ac-ac-' + k).value; if (v) q.push(k + '=' + encodeURIComponent(v)); });
  var t = _acEl('ac-ac-q').value.trim(); if (t) q.push('q=' + encodeURIComponent(t));
  var c = _acEl('ac-ac-lista');
  c.innerHTML = '<p class="vis-vacio">Cargando…</p>';
  try {
    var r = await apiRequest('GET', '/activos/actas' + (q.length ? '?' + q.join('&') : ''));
    _ac.actasLista = r.actas;
    var sel = _acEl('ac-ac-tipo'), v = sel.value;
    sel.innerHTML = '<option value="">Todos</option>' + Object.keys(r.tipos).map(function (k) { return '<option value="' + esc(k) + '"' + (k === v ? ' selected' : '') + '>' + esc(r.tipos[k]) + '</option>'; }).join('');
    _acEl('ac-actas-kpis').innerHTML = activosActasKpisHtml(r.resumen);
    _acEl('ac-ac-conteo').textContent = r.actas.length + (r.actas.length === 1 ? ' acta' : ' actas') + ' con estos filtros' + (r.firmadasActivas ? '' : '. Subir la firmada se activa cuando el administrador configure el almacenamiento privado (S3).');
    c.innerHTML = activosActasHtml(r.actas, r.firmadasActivas, r.diasAtraso);
  } catch (e) { c.innerHTML = ''; _acError(e.message); }
}
function activosActaImprimirLista(id) { var a = (_ac.actasLista || []).find(function (x) { return x.id === id; }); if (a) activosImprimirActa(a); }
async function activosSubirFirmadaLista(id, input) { await activosSubirFirmada(id, input); activosActasBuscar(); }
function activosActaAnularForm(id) {
  var a = (_ac.actasLista || []).find(function (x) { return x.id === id; }); if (!a) return;
  _acEl('ac-ac-anular').innerHTML = '<form class="ac-asig-form" onsubmit="activosActaAnular(event,' + Number(id) + ')"><h5 class="ac-sub ac-form-titulo">Anular el acta N.º ' + Number(a.numero) + ' (no se borra: queda marcada como anulada)</h5>' +
    '<div class="ig ac-motivo"><label for="ac-ac-motivo">Motivo</label><input type="text" id="ac-ac-motivo" maxlength="300" placeholder="Ej.: se creó por error"></div>' +
    '<button type="submit" class="btn-primary">Anular</button><button type="button" class="btn-cancel" onclick="activosActaAnularCancelar()">Cancelar</button></form>';
  _acEl('ac-ac-motivo').focus();
}
function activosActaAnularCancelar() { _acEl('ac-ac-anular').innerHTML = ''; }
async function activosActaAnular(ev, id) {
  ev.preventDefault();
  _acError('');
  try {
    await apiRequest('POST', '/activos/actas/' + id + '/anular', { motivo: _acEl('ac-ac-motivo').value });
    showToast('Acta anulada', 'ok');
    activosActaAnularCancelar();
    activosActasBuscar();
    _acRefrescarMenu();
  } catch (e) { _acError(e.message); }
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
  module.exports = { activosMenuHtml: activosMenuHtml, activosFlujoHtml: activosFlujoHtml, AC_MENU: AC_MENU, AC_VISTA_ESTADO: AC_VISTA_ESTADO, activosTiposHtml: activosTiposHtml, activosCampoEditorHtml: activosCampoEditorHtml, activosEditorTipoHtml: activosEditorTipoHtml, activosLeerCampos: activosLeerCampos, activosPanelHtml: activosPanelHtml, activosListaHtml: activosListaHtml, activosConsulta: activosConsulta, activosRendHtml: activosRendHtml, activosGestionHtml: activosGestionHtml, activosAgenteSelectHtml: activosAgenteSelectHtml, activosAgenteBody: activosAgenteBody, activosActasHtml: activosActasHtml, activosActasKpisHtml: activosActasKpisHtml, activosActasAviso: activosActasAviso, activosFilasExport: activosFilasExport, activosReportePrintHtml: activosReportePrintHtml, activosHistorialHtml: activosHistorialHtml, activosImportarColumnas: activosImportarColumnas, activosImportarResultadoHtml: activosImportarResultadoHtml, activosAdminHtml: activosAdminHtml, activosAdminKpisHtml: activosAdminKpisHtml, activosAdminSubtiposHtml: activosAdminSubtiposHtml, AC_ESTADO_ADMIN: AC_ESTADO_ADMIN, activosCampoHtml: activosCampoHtml, activosAgentesHtml: activosAgentesHtml, activosActaPrintHtml: activosActaPrintHtml };
}

// ── Fase GH4 (plan de Gestión humana): «Novedades desde Gestión Humana» (diseño de Edwin) ──
// Solo lectura de Talento humano: el servidor (gh-novedades.js) manda lo mínimo — agente, un texto
// con fechas y sus elementos —, nunca salario, cargo ni el tipo de novedad.
var AC_GH_SECCIONES = [
  ['retirados', 'vis-rojo', 'Retirados con elementos a su nombre', 'Ya no están en la empresa: pide la entrega y regístrala en «Agentes» con «Devolver» (sale el acta de devolución).'],
  ['ausentes', 'vis-amarillo', 'Ausentes hoy con elementos asignados', 'Solo informativo: el elemento sigue asignado y no hay acta. Se puede aprovechar para mantenimiento.'],
  ['proximos', 'vis-gris', 'Se ausentarán en los próximos 7 días', 'Para planear mantenimientos: el elemento quedará sin uso. No requiere acta.'],
];
function activosNovedadesGHHtml(r, config) {
  var tipoN = function (c) { var t = ((config && config.tipos) || []).find(function (x) { return x.codigo === c; }); return t ? t.nombre : c; };
  var fila = function (x, conBoton) {
    var el = x.elementos.map(function (a) { return esc(tipoN(a.tipo)) + ' ' + esc(a.codigo); }).join(' · ');
    return '<li class="ac-gh-fila"><div class="ac-gh-txt"><b>' + esc(x.agente.nombre) + '</b>' + (x.agente.documento ? ' <span class="vis-ayuda">CC ' + esc(x.agente.documento) + '</span>' : '') +
      (x.estado ? '<span class="ac-gh-estado">' + esc(x.estado.txt) + '</span>' : '') +
      '<span class="vis-ayuda">' + x.elementos.length + ' elemento(s): ' + el + '</span></div>' +
      '<button type="button" class="' + (conBoton ? 'btn-primary' : 'btn-cancel') + ' ac-btn" onclick="activosNovedadesGHVer(' + Number(x.agente.id) + ')">' + (conBoton ? 'Recibir elementos' : 'Ver agente') + '</button></li>';
  };
  if (!r.empleadosGH) return '<p class="vis-vacio">Talento humano aún no tiene empleados registrados. Cuando los tenga, aquí aparecerán los agentes con elementos que estén retirados o ausentes.</p>';
  var total = r.retirados.length + r.ausentes.length + r.proximos.length;
  var html = AC_GH_SECCIONES.filter(function (s) { return r[s[0]].length; }).map(function (s) {
    return '<section class="aurora-card ac-gh-sec"><h4 class="ac-sub"><span class="vis-pill ' + s[1] + '">' + r[s[0]].length + '</span> ' + esc(s[2]) + '</h4><p class="vis-ayuda">' + esc(s[3]) + '</p><ul class="ac-gh-lista">' +
      r[s[0]].map(function (x) { return fila(x, s[0] === 'retirados'); }).join('') + '</ul></section>';
  }).join('');
  if (!total) html = '<p class="vis-vacio">Ninguna persona con elementos asignados está retirada ni ausente hoy, ni se ausentará en los próximos 7 días.</p>';
  if (r.sinRegistro.length) {
    html += '<details class="aurora-card ac-gh-sec"><summary><span class="vis-pill vis-gris">' + r.sinRegistro.length + '</span> Con elementos pero sin registro en Gestión Humana</summary>' +
      '<p class="vis-ayuda">Revisa el documento del agente o pide su registro en Talento humano.</p><ul class="ac-gh-lista">' + r.sinRegistro.map(function (x) { return fila(x, false); }).join('') + '</ul></details>';
  }
  return html;
}
async function activosNovedadesGH() {
  var c = _acEl('ac-p-novedadesgh');
  c.innerHTML = '<p class="vis-vacio">Cargando…</p>';
  try { c.innerHTML = activosNovedadesGHHtml(await apiRequest('GET', '/activos/novedades-gh'), _ac.config); }
  catch (e) { c.innerHTML = ''; _acError(e.message); }
}
function activosNovedadesGHVer(id) { activosTab('agentes'); activosVerAgente(id); }
if (typeof module !== 'undefined' && module.exports) module.exports.activosNovedadesGHHtml = activosNovedadesGHHtml;

// ── Fase GH5 (pedido del usuario, 23/11): «Panel general» igual al diseño de Edwin ──
// Chips «Ver gráficas de», tarjetas con detalle, dona por estado y por RAM, barras por tipo/sede/operación,
// marcas, valor, renta, calidad de los datos y movimientos de 6 meses. Datos: GET /activos/panel.
var ACP_ESTADOS = [['en_uso', 'En uso'], ['libre', 'Libres'], ['en_reparacion', 'En reparación'], ['malo', 'Malos'], ['de_baja', 'Dados de baja']];
var ACP_REND = [['bajo', 'Bajo (menos de 8 GB)'], ['medio', 'Medio (8 a 15 GB)'], ['alto', 'Alto (16 GB o más)'], ['sin', 'Sin dato (RAM no registrada)']];
var ACP_MOV = [['ingresos', 'Ingresos'], ['asignaciones', 'Asignaciones'], ['devoluciones', 'Devoluciones'], ['danos', 'Daños y reparaciones']];
function _acpPct(n, t) { return t ? Math.round(n * 1000 / t) / 10 : 0; }
function _acpMiles(n) { return '$ ' + Math.round(n || 0).toLocaleString('es-CO'); }
function _acpLeyenda(items, pref) { return '<div class="acp-ley">' + items.map(function (x) { return '<span><i class="acp-c-' + pref + x[0] + '"></i>' + esc(x[1]) + '</span>'; }).join('') + '</div>'; }
function _acpCard(titulo, ayuda, cuerpo, pie, extra) { return '<article class="acp-card' + (extra ? ' ' + extra : '') + '"><h4>' + esc(titulo) + '</h4>' + (ayuda ? '<p class="acp-ayuda">' + esc(ayuda) + '</p>' : '') + cuerpo + (pie ? '<div class="acp-pie">' + pie + '</div>' : '') + '</article>'; }
function _acpBtn(txt, onclick) { return '<button type="button" class="acp-btn" onclick="' + onclick + '">' + esc(txt) + '</button>'; }
// Dona con conic-gradient: segmentos [clase, n]; los colores salen de los tokens (clases acp-c-*).
function _acpDona(seg, total, etiqueta, pref) {
  var acc = 0, partes = [];
  seg.forEach(function (s) { if (!s[1] || !total) return; var a = acc * 100 / total; acc += s[1]; partes.push('var(--acp-' + pref + s[0] + ') ' + a.toFixed(2) + '% ' + (acc * 100 / total).toFixed(2) + '%'); });
  var fondo = partes.length ? 'conic-gradient(' + partes.join(',') + ')' : 'var(--c-border-soft)';
  return '<div class="acp-dona" role="img" aria-label="' + esc(etiqueta + ': ' + total) + '" style="background:' + fondo + '"><div><b>' + total + '</b><span>' + esc(etiqueta) + '</span></div></div>';
}
function _acpFilasEstado(seg, total, pref) {
  return '<ul class="acp-filas">' + seg.map(function (s) { return '<li><i class="acp-c-' + pref + s[0] + '"></i><span>' + esc(s[2]) + '</span><b>' + s[1] + '</b><small>' + _acpPct(s[1], total) + '%</small></li>'; }).join('') + '</ul>';
}
// Barra apilada por estado (tipo, sede u operación).
function _acpApiladas(filas, max) {
  if (!filas.length) return '<p class="acp-vacio">Sin datos.</p>';
  return '<div class="acp-barras">' + filas.map(function (f) {
    return '<div class="acp-bar"><span class="acp-bar-n" title="' + esc(f.nombre) + '">' + esc(f.nombre) + '</span><div class="acp-bar-t">' +
      ACP_ESTADOS.map(function (e) { var n = f.porEstado[e[0]] || 0; return n ? '<i class="acp-c-e' + e[0] + '" style="width:' + (n * 100 / max).toFixed(2) + '%" title="' + esc(e[1] + ': ' + n) + '"></i>' : ''; }).join('') +
      '</div><b>' + f.total + '</b></div>';
  }).join('') + '</div>';
}
function _acpSimples(filas, clase, fmt) {
  var max = Math.max.apply(null, filas.map(function (f) { return f.v; }).concat([0]));
  return '<div class="acp-barras">' + filas.map(function (f) {
    return '<div class="acp-bar"><span class="acp-bar-n" title="' + esc(f.nombre) + '">' + esc(f.nombre) + '</span><div class="acp-bar-t"><i class="' + clase + '" style="width:' + (max ? f.v * 100 / max : 0).toFixed(2) + '%"></i></div><b>' + esc(fmt ? fmt(f.v) : String(f.v)) + '</b></div>';
  }).join('') + '</div>';
}
// Líneas de los últimos 6 meses (SVG; cada serie con su clase de color).
function _acpMovimientos(m) {
  var W = 600, H = 170, px = 26, py = 14, max = Math.max(4, Math.max.apply(null, m.reduce(function (a, x) { return a.concat(ACP_MOV.map(function (s) { return x[s[0]]; })); }, [0])));
  var X = function (i) { return px + i * (W - 2 * px) / Math.max(1, m.length - 1); }, Y = function (v) { return H - py - v * (H - 2 * py) / max; };
  var ejes = [0, 0.5, 1].map(function (f) { var v = Math.round(max * f); return '<line x1="' + px + '" x2="' + (W - px) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" class="acp-eje"/><text x="2" y="' + (Y(v) + 4) + '" class="acp-txt">' + v + '</text>'; }).join('');
  var series = ACP_MOV.map(function (s) {
    var pts = m.map(function (x, i) { return X(i).toFixed(1) + ',' + Y(x[s[0]]).toFixed(1); });
    return '<polyline class="acp-l-' + s[0] + '" fill="none" points="' + pts.join(' ') + '"/>' + m.map(function (x, i) { return '<circle class="acp-l-' + s[0] + '" cx="' + X(i).toFixed(1) + '" cy="' + Y(x[s[0]]).toFixed(1) + '" r="3.5"><title>' + esc(s[1] + ' ' + x.mes + ': ' + x[s[0]]) + '</title></circle>'; }).join('');
  }).join('');
  var MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
  var etiq = m.map(function (x, i) { return '<text x="' + X(i).toFixed(1) + '" y="' + (H + 12) + '" text-anchor="middle" class="acp-txt">' + MES[Number(x.mes.slice(5)) - 1] + ' ' + x.mes.slice(2, 4) + '</text>'; }).join('');
  return '<svg class="acp-mov" viewBox="0 0 ' + W + ' ' + (H + 18) + '" role="img" aria-label="Movimientos de los últimos 6 meses">' + ejes + series + etiq + '</svg>';
}
function activosPanel2Html(p) {
  var e = p.porEstado, enUso = e.en_uso || 0, vivos = p.total - (e.de_baja || 0);
  var chips = '<div class="acp-chips" role="group" aria-label="Ver gráficas de"><span class="acp-chips-t">Ver gráficas de:</span>' +
    [{ codigo: '', nombre: 'Todos' }].concat(p.tipos).map(function (t) { var on = (p.tipo || '') === t.codigo; return '<button type="button" class="acp-chip' + (on ? ' on' : '') + '" aria-pressed="' + on + '" onclick="activosPanelTipo(\'' + esc(t.codigo) + '\')">' + (on ? '✓ ' : '') + esc(t.nombre) + '</button>'; }).join('') + '</div>';
  var cab = '<div class="acp-cab"><div class="acp-acc">' + _acpBtn('Excel', 'activosPanelExcel()') + _acpBtn('Registrar ingreso', "activosTab('registrar')") + '</div>' + chips + '</div>';
  var tipoN = function (c) { return p.porTipo.filter(function (t) { return t.codigo === c; })[0]; };
  var kpi = function (tit, n, sub, tab) { return '<button type="button" class="acp-kpi" onclick="activosTab(\'' + tab + '\')"><span>' + esc(tit) + '</span><b>' + n + '</b><small>' + esc(sub) + '</small></button>'; };
  var kpis = [kpi('Equipos asignados', enUso, p.agentes.conEquipo + ' agentes con equipo', 'asignados'), kpi('Libres', e.libre || 0, 'Equipos y elementos disponibles', 'libres'),
    kpi('En reparación', e.en_reparacion || 0, 'Pendientes por arreglo', 'reparacion'), kpi('Malos', e.malo || 0, 'No se pueden entregar', 'malos')];
  ['TORRE', 'PORTATIL'].forEach(function (c) { var t = tipoN(c); if (t) kpis.push(kpi(t.nombre, t.total, (t.porEstado.en_uso || 0) + ' asignados · ' + (t.porEstado.libre || 0) + ' libres', 'elementos')); });
  if (!p.tipo) { kpis.push(kpi('Agentes', p.agentes.activos, p.agentes.conEquipo + ' con equipo asignado', 'agentes')); if (p.actasPendientes !== null) kpis.push(kpi('Actas pendientes', p.actasPendientes, 'Por completar o firmar', 'actas')); }
  if (!p.total) return cab + '<div class="acp-kpis">' + kpis.join('') + '</div><p class="vis-vacio">Aún no hay elementos. Regístralos en «Registrar ingreso».</p>';
  var segE = ACP_ESTADOS.map(function (x) { return [x[0], e[x[0]] || 0, x[1]]; });
  var g = [];
  g.push(_acpCard('¿En qué estado están los equipos y elementos?', 'Cuántos están en uso, libres, en reparación, malos o dados de baja.',
    '<div class="acp-dona-w">' + _acpDona(segE, p.total, 'elementos', 'e') + _acpFilasEstado(segE, p.total, 'e') + '</div>',
    '<span>' + _acpPct(enUso, p.total) + '% en uso · ' + (e.libre || 0) + ' libres para entregar</span>' + _acpBtn('Ver libres', "activosTab('libres')")));
  if (p.porRendimiento) {
    var r = p.porRendimiento, tr = ACP_REND.reduce(function (a, x) { return a + (r[x[0]] || 0); }, 0), segR = ACP_REND.map(function (x) { return [x[0], r[x[0]] || 0, x[1]]; });
    g.push(_acpCard('Rendimiento según la memoria RAM', 'Torres y portátiles. Bajo: menos de 8 GB · Medio: 8 a 15 GB · Alto: 16 GB o más.',
      '<div class="acp-dona-w">' + _acpDona(segR, tr, 'equipos', 'r') + _acpFilasEstado(segR, tr, 'r') + '</div>',
      '<span>' + (r.bajo ? r.bajo + ' con rendimiento bajo' : 'Ningún equipo con rendimiento bajo') + '</span>' + _acpBtn('Ver rendimiento bajo', "activosVerRendimiento('bajo')")));
  }
  var maxT = Math.max.apply(null, p.porTipo.map(function (t) { return t.total; }).concat([1]));
  var ley = _acpLeyenda(ACP_ESTADOS, 'e');
  g.push(_acpCard('¿Cuántos hay de cada tipo?', 'Todos los elementos registrados, por tipo y estado.', ley + _acpApiladas(p.porTipo, maxT),
    '<span>' + p.total + ' elementos en total</span>' + _acpBtn('Ver inventario', "activosTab('elementos')")));
  var maxS = Math.max.apply(null, p.porSede.map(function (t) { return t.total; }).concat([1]));
  var sinS = p.porSede.filter(function (s) { return s.sin; })[0];
  g.push(_acpCard('Elementos por sede', 'Cantidad por sede, separada por estado (sin los dados de baja).', ley + _acpApiladas(p.porSede, maxS),
    '<span>' + (sinS ? sinS.total : 0) + ' sin sede registrada</span>' + _acpBtn('Ver datos', "activosTab('elementos')")));
  var maxO = Math.max.apply(null, p.porOperacion.map(function (t) { return t.total; }).concat([1]));
  var sinO = p.porOperacion.filter(function (s) { return s.sin; })[0];
  g.push(_acpCard('Elementos por operación', 'Por departamento u operación donde están, separada por estado.', ley + _acpApiladas(p.porOperacion, maxO),
    '<span>' + (sinO ? sinO.total : 0) + ' sin operación asignada</span>' + _acpBtn('Ver datos', "activosTab('elementos')")));
  g.push(_acpCard('Marcas más comunes', 'Marcas de todos los elementos.', _acpSimples(p.marcas.map(function (m) { return { nombre: m.nombre, v: m.n }; }), 'acp-c-marca'),
    '<span>' + p.total + ' registrados</span>' + _acpBtn('Ver datos', "activosTab('elementos')")));
  g.push(_acpCard('Valor del inventario por elemento', 'Suma del precio de compra de los elementos propios de InConexion (sin los dados de baja ni los rentados).',
    _acpSimples(p.valor.porTipo.map(function (v) { return { nombre: v.nombre, v: v.valor }; }), 'acp-c-valor', _acpMiles),
    '<span>Total: <b>' + _acpMiles(p.valor.total) + '</b> · ' + p.valor.sinPrecio + ' propio(s) sin precio</span>' + _acpBtn('Ver datos', "activosTab('elementos')")));
  g.push(_acpCard('Renta mensual por elemento', 'Lo que se paga cada mes por elementos de proveedores diferentes a InConexion, por proveedor.',
    p.renta.porProveedor.length ? _acpSimples(p.renta.porProveedor.map(function (x) { return { nombre: x.proveedor, v: x.valor }; }), 'acp-c-renta', _acpMiles) : '<p class="acp-vacio">No hay elementos rentados con precio de renta registrado.</p>',
    '<span>Total al mes: <b>' + _acpMiles(p.renta.total) + '</b> · ' + p.renta.n + ' elemento(s) de proveedores</span>'));
  g.push(_acpCard('Calidad de los datos', 'Datos que conviene completar o corregir.', '<ul class="acp-cal">' + p.calidad.map(function (c) {
    return '<li><span>' + esc(c.l) + '</span><b class="acp-cal-n' + (c.n ? ' hay' : '') + '">' + c.n + '</b>' + (c.n && c.ir ? _acpBtn('Ver', "activosTab('" + c.ir + "')") : c.n ? _acpBtn('Ver', "activosTab('elementos')") : '') + '</li>';
  }).join('') + '</ul>'));
  var mm = p.movimientos[p.movimientos.length - 1];
  g.push(_acpCard('Movimientos de los últimos 6 meses', 'Lo que ingresa, se asigna, se devuelve o se daña cada mes.', _acpLeyenda(ACP_MOV, 'l') + _acpMovimientos(p.movimientos),
    '<span>Este mes: ' + mm.ingresos + ' ingresos · ' + mm.asignaciones + ' asignaciones · ' + mm.devoluciones + ' devoluciones · ' + mm.danos + ' daños y reparaciones</span>' + _acpBtn('Ver historial', "activosTab('historial')"), 'acp-ancha'));
  return cab + '<div class="acp-kpis">' + kpis.join('') + '</div><div class="acp-grid">' + g.join('') + '</div>' + (vivos < 0 ? '' : '');
}
function activosPanelTipo(codigo) { _ac.panelTipo = codigo || ''; _acPanel(); }
async function activosPanelExcel() {
  try { _ac.lista = (await apiRequest('GET', '/activos?ambito=' + _ac.ambito + (_ac.panelTipo ? '&tipo=' + encodeURIComponent(_ac.panelTipo) : ''))).activos; activosExportar('elementos', 'excel'); }
  catch (e) { _acError(e.message); }
}
// Fase GH5c: «N elementos con estos filtros · 4 monitor · 2 portátil» (como la línea de resumen de Edwin).
function activosConteoTexto(lista, config) {
  var n = {}; lista.forEach(function (a) { n[a.tipo] = (n[a.tipo] || 0) + 1; });
  var partes = ((config && config.tipos) || []).filter(function (t) { return n[t.codigo]; }).map(function (t) { return n[t.codigo] + ' ' + String(t.nombre).toLowerCase(); });
  return lista.length + (lista.length === 1 ? ' elemento' : ' elementos') + ' con estos filtros' + (partes.length > 1 ? ' · ' + partes.join(' · ') : '');
}
// ── Fase GH5b: «Registrar ingreso» con una tarjeta por tipo (diseño de Edwin) ──
var ACR_AYUDA = { TORRE: 'CPU de escritorio: procesador, RAM y disco. Entra a Libres y se asigna al agente.', MONITOR: 'Pantalla con su código y serial.',
  PORTATIL: 'Propio (InConexion) o de un proveedor.', DIADEMA: 'Diadema o headset para el agente.', TECLADO: 'Teclado con su código y serial.', MOUSE: 'Mouse con su código y serial.',
  ADMINISTRABLE: 'Servidor, switch, DVR/NVR, router o firewall, access point o UPS. El código se asigna solo según el tipo.' };
function activosRegistrarTarjetasHtml(tipos, porTipo, ultimos) {
  var cab = '<div class="acr-cab"><button type="button" class="acp-btn" onclick="activosNuevaTecnologia()">+ Nueva tecnología</button><button type="button" class="acp-btn" onclick="activosIrImportar()">Importar desde Excel</button></div>';
  var tarjetas = tipos.filter(function (t) { return t.activo !== false; }).map(function (t) {
    var x = porTipo[t.codigo] || {}, total = Object.keys(x).reduce(function (a, k) { return a + (x[k] || 0); }, 0);
    var c = esc(t.codigo);
    return '<article class="acp-card acr-card"><div class="acr-top"><h4>' + esc(t.nombre) + '</h4><button type="button" class="acr-edit" onclick="activosEditarFormulario(\'' + c + '\')">Editar formulario</button></div>' +
      (ACR_AYUDA[t.codigo] ? '<p class="acp-ayuda">' + esc(ACR_AYUDA[t.codigo]) + '</p>' : '') +
      '<p class="acr-n">' + total + ' registrados' + (t.codigo === 'ADMINISTRABLE' ? '' : ' · ' + (x.libre || 0) + ' libres') + '</p>' +
      '<div class="acr-acc"><button type="button" class="btn-primary ac-btn" onclick="activosRegistrarTipo(\'' + c + '\')">+ Registrar</button><button type="button" class="acp-btn" onclick="activosVerTipo(\'' + c + '\')">' + (t.codigo === 'ADMINISTRABLE' ? 'Ver equipos' : 'Ver inventario') + '</button></div></article>';
  }).join('');
  var nueva = '<article class="acp-card acr-card acr-nueva"><h4>Nueva tecnología</h4><p class="acp-ayuda">¿Llegó un tipo de equipo que no está en la lista (celulares, tablets, impresoras…)? Crea su formulario aquí.</p><div class="acr-acc"><button type="button" class="acp-btn" onclick="activosNuevaTecnologia()">+ Crear formulario</button></div></article>';
  var ult = '<article class="acp-card acr-ultimos"><h4>Últimos ingresos</h4>' + (ultimos && ultimos.length ? '<ul class="acr-lista">' + ultimos.map(function (h) {
    return '<li><b>' + esc(h.codigo) + '</b><span>' + esc(((_ac.config && _acTipo(h.tipo)) || { nombre: h.tipo }).nombre) + '</span><small>' + esc(String(h.fecha || '').slice(0, 16).replace('T', ' ')) + (h.quien ? ' · ' + esc(h.quien) : '') + '</small></li>';
  }).join('') + '</ul>' : '<p class="acp-ayuda">Todavía no hay ingresos registrados.</p>') + '</article>';
  return cab + '<div class="acr-grid">' + tarjetas + nueva + '</div>' + ult;
}
async function activosRegistrarTarjetas() {
  var c = _acEl('ac-r-tarjetas'); if (!c) return;
  try {
    var r = await Promise.all([apiRequest('GET', '/activos/resumen?ambito=' + _ac.ambito), apiRequest('GET', '/activos/historial?ambito=' + _ac.ambito + '&accion=Ingreso')]);
    c.innerHTML = activosRegistrarTarjetasHtml(_ac.config.tipos, r[0].porTipo || {}, (r[1].historial || []).slice(0, 5));
  } catch (e) { _acError(e.message); }
}
function activosRegistrarTipo(codigo) {
  _ac.regTipo = codigo; _acEl('ac-r-tipo').value = codigo; activosCambioTipo();
  var f = _acEl('ac-r-form'); f.classList.remove('hidden');
  try { f.scrollIntoView({ block: 'start', behavior: 'smooth' }); } catch (e) { /* sin scroll suave */ }
  var cod = _acEl('ac-r-codigo'); if (cod && !cod.disabled) cod.focus();
}
function activosVerTipo(codigo) {
  ['tipo', 'estado', 'sede', 'operacion', 'proveedor', 'rend', 'q'].forEach(function (k) { var el = _acEl('ac-f-' + k); el.value = ''; el.removeAttribute('data-v'); });
  _acEl('ac-f-pend').checked = false; _acEl('ac-f-dup').checked = false;
  if (codigo === 'ADMINISTRABLE' && _ac.ambito === 'sistemas') { activosTab('admin'); return; }
  _ac.tipoInicial = codigo; activosTab('elementos');
}
function activosEditarFormulario(codigo) { activosTab('ajustes'); activosEditarTipo(codigo); }
function activosNuevaTecnologia() { activosTab('ajustes'); activosEditarTipo(null); }
function activosIrImportar() { activosTab('ajustes'); var s = _acEl('ac-imp-tipo'); if (s) { try { s.scrollIntoView({ block: 'center' }); } catch (e) { /* */ } s.focus(); } }
if (typeof module !== 'undefined' && module.exports) { module.exports.activosPanel2Html = activosPanel2Html; module.exports.activosRegistrarTarjetasHtml = activosRegistrarTarjetasHtml; module.exports.activosConteoTexto = activosConteoTexto; module.exports.activosListaHtml = activosListaHtml; module.exports.activosInvTiposHtml = activosInvTiposHtml; module.exports.activosActasPestanasHtml = activosActasPestanasHtml; module.exports.activosAjEstadosHtml = activosAjEstadosHtml; }
if (typeof module !== 'undefined' && module.exports) module.exports.activosCedulaAviso = activosCedulaAviso; // 25/11: aviso de la cédula (pruebas)
if (typeof module !== 'undefined' && module.exports) { module.exports.activosFichaPrintHtml = activosFichaPrintHtml; module.exports.activosFilasExport = activosFilasExport; } // Fase INV5 (pruebas)
