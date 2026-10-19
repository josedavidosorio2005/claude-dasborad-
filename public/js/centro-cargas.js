// centro-cargas.js — Fase 153 ("OK centro de cargas", Edwin aprobo el
// diseno del PR #456): el "Centro de cargas".
// Cargar Datos → cliente → tarjetas de modulos → meses del ano.
//
// PR 1: lectura. Cada mes muestra sus registros reales (GET
// /centro-cargas/:cliente), "Descargar lo cargado" baja un Excel con las
// filas de ese mes (xlsxFilasSeguras) y "Descargar plantilla" la plantilla
// oficial del modulo. Subir/Reemplazar abren por ahora la pantalla de
// carga de siempre con el cliente ya elegido (misma lectura y misma vista
// previa de impacto). PR 2: "Versiones guardadas" y Deshacer (30 dias).
// PR 3: Eliminar un mes (con confirmacion; la base se guarda 30 dias y el
// aviso de despues ofrece Deshacer). PR 4: Subir/Reemplazar desde el mes
// con el plan de ese modulo y solo las filas de ese mes (CENTRO_CARGA_PLAN). La pantalla anterior sigue disponible.
'use strict';

var _cc = { cliente: null, anio: null, modulos: [], modulo: null, foco: null, versiones: [], cargaSel: {} };

function _ccMesActual() {
  var c = new Date(Date.now() - 5 * 3600 * 1000);
  return c.getUTCFullYear() + '-' + (c.getUTCMonth() < 9 ? '0' : '') + (c.getUTCMonth() + 1);
}

function _ccClientesQuePuedeCargar() {
  return (typeof CLIENTES_LIST !== 'undefined' ? CLIENTES_LIST : []).filter(function (c) {
    if (isFullAdmin()) return true;
    var p = (currentUser && currentUser.perms) || {};
    return p['campana_' + c] === true || p['cliente_' + c] === true;
  });
}

async function openCentroCargas(cliente, moduloId) {
  if (!canLoadAnyModule()) { showToast('No tienes permiso para cargar datos.', 'error'); return; }
  // PR 5: la pantalla anterior (todas las hojas a la vez) es solo de quien tiene cargarDatos.
  var btnAnt = document.getElementById('cc-pantalla-anterior');
  if (btnAnt) btnAnt.classList.toggle('hidden', !canLoadData());
  var clientes = _ccClientesQuePuedeCargar();
  if (!clientes.length) { showToast('No tienes clientes asignados para cargar.', 'error'); return; }
  _cc.cliente = (cliente && clientes.indexOf(cliente) !== -1) ? cliente : (_cc.cliente && clientes.indexOf(_cc.cliente) !== -1 ? _cc.cliente : clientes[0]);
  _cc.anio = _cc.anio || Number(_ccMesActual().slice(0, 4));
  _cc.modulo = moduloId || null;
  var sel = document.getElementById('cc-cliente');
  sel.innerHTML = clientes.map(function (c) { return '<option value="' + esc(c) + '">' + esc(c) + '</option>'; }).join('');
  sel.value = _cc.cliente;
  var anioAct = Number(_ccMesActual().slice(0, 4));
  document.getElementById('cc-anio').innerHTML = [anioAct, anioAct - 1, anioAct - 2].map(function (a) { return '<option value="' + a + '">' + a + '</option>'; }).join('');
  document.getElementById('cc-anio').value = String(_cc.anio);
  document.getElementById('centro-overlay').classList.add('show');
  if (typeof motionAbrirModal === 'function') motionAbrirModal('centro-modal');
  await _ccCargar();
}

function closeCentroCargas() {
  _ccCerrarDialogo();
  var cerrar = function () { document.getElementById('centro-overlay').classList.remove('show'); };
  if (typeof motionCerrarModal === 'function') motionCerrarModal('centro-modal', cerrar); else cerrar();
}

function ccIrPantallaAnterior() {
  closeCentroCargas();
  setTimeout(function () { openCargas(); }, 50);
}

async function ccCambiarCliente() {
  _cc.cliente = document.getElementById('cc-cliente').value;
  _cc.modulo = null;
  await _ccCargar();
}
async function ccCambiarAnio() {
  _cc.anio = Number(document.getElementById('cc-anio').value);
  await _ccCargar();
}

async function _ccCargar() {
  var body = document.getElementById('cc-body');
  body.innerHTML = '<div class="cc-cargando">Cargando…</div>';
  try {
    var r = await apiRequest('GET', '/centro-cargas/' + encodeURIComponent(_cc.cliente) + '?anio=' + _cc.anio);
    _cc.modulos = r.modulos || [];
    // PR 5: el servidor solo manda los modulos que puede cargar; un modulo pedido (atajo del tablero) que no esta, abre las tarjetas.
    if (_cc.modulo && !_cc.modulos.some(function (m) { return m.id === _cc.modulo; })) _cc.modulo = null;
    // PR 2: versiones guardadas (Deshacer, 30 dias) de este cliente.
    try { _cc.versiones = (await apiRequest('GET', '/centro-cargas/' + encodeURIComponent(_cc.cliente) + '/versiones')).versiones || []; }
    catch (e2) { _cc.versiones = []; }
  } catch (e) {
    body.innerHTML = '<div class="cc-aviso cc-aviso-error">' + esc(e.message) + '</div>';
    return;
  }
  if (_cc.modulo && !_cc.modulos.some(function (m) { return m.id === _cc.modulo; })) _cc.modulo = null;
  _ccRender();
}

function _ccRender() {
  var cm = document.getElementById('centro-modal'); if (cm) cm.scrollTop = 0;
  if (_cc.modulo) _ccRenderModulo(); else _ccRenderTarjetas();
}

function _ccRenderTarjetas() {
  var mesActual = _ccMesActual();
  var anterior = _ccMesAnterior(mesActual);
  document.getElementById('cc-migas').innerHTML = '<span aria-current="page">' + esc(_cc.cliente) + '</span>';
  if (!_cc.modulos.length) {
    document.getElementById('cc-body').innerHTML = '<div class="cc-aviso">Este cliente todavía no tiene módulos para cargar.</div>';
    return;
  }
  var html = '<p class="cc-intro">Elige qué quieres cargar. Cada módulo se carga con su propio archivo.</p><div class="cc-tarjetas">';
  _cc.modulos.forEach(function (m) {
    var r = centroResumenModulo(m, mesActual);
    var alDia = m.cargas.every(function (c) { return (c.meses.filter(function (x) { return x.mes === anterior; })[0] || {}).registros > 0; });
    var estado, clase;
    if (!r.mesesConDatos) { estado = 'Sin datos todavía'; clase = 'cc-pill-vacio'; }
    else if (String(_cc.anio) !== mesActual.slice(0, 4) || alDia) { estado = 'Al día'; clase = 'cc-pill-ok'; }
    else { estado = 'Falta ' + centroNombreMes(anterior).split(' ')[0].toLowerCase(); clase = 'cc-pill-falta'; }
    html += '<button type="button" class="cc-tarjeta" onclick="ccAbrirModulo(\'' + esc(m.id) + '\')">' +
      '<span class="cc-tarjeta-top"><span class="cc-tarjeta-icono">' + iconoSvg('file-spreadsheet') + '</span><span class="cc-pill ' + clase + '">' + esc(estado) + '</span></span>' +
      '<span class="cc-tarjeta-nombre">' + esc(m.nombre) + '</span>' +
      '<span class="cc-tarjeta-dato">' + (r.mesesConDatos ? r.mesesConDatos + (r.mesesConDatos === 1 ? ' mes' : ' meses') + ' con datos en ' + _cc.anio : 'Nada cargado en ' + _cc.anio) + '</span>' +
      (r.ultimaCarga ? '<span class="cc-tarjeta-sub">Última carga: ' + esc(centroFechaCorta(r.ultimaCarga)) + '</span>' : '') +
      (m.cargas.length > 1 ? '<span class="cc-tarjeta-sub">' + m.cargas.length + ' archivos: ' + esc(m.cargas.map(function (c) { return c.nombre; }).join(' y ')) + '</span>' : '') +
      '</button>';
  });
  document.getElementById('cc-body').innerHTML = html + '</div>';
}

function _ccMesAnterior(mes) {
  var a = Number(mes.slice(0, 4)), m = Number(mes.slice(5, 7)) - 1;
  if (m === 0) { a -= 1; m = 12; }
  return a + '-' + (m < 10 ? '0' : '') + m;
}

function ccAbrirModulo(id) { _cc.modulo = id; _ccRender(); }
function ccElegirCarga(ci) {
  _cc.cargaSel[_cc.modulo] = ci;
  _ccRender();
  var b = document.querySelectorAll('#cc-body .cc-selector-op')[ci];
  if (b) b.focus();
}
function ccVolverTarjetas() { _cc.modulo = null; _ccRender(); }

function _ccModuloActual() {
  return _cc.modulos.filter(function (m) { return m.id === _cc.modulo; })[0];
}

function _ccRenderModulo() {
  var m = _ccModuloActual();
  var mesActual = _ccMesActual();
  document.getElementById('cc-migas').innerHTML = '<a role="button" tabindex="0" onclick="ccVolverTarjetas()">' + esc(_cc.cliente) + '</a> <span aria-hidden="true">›</span> <span aria-current="page">' + esc(m.nombre) + '</span>';
  var html = '<button type="button" class="btn-cancel cc-volver" onclick="ccVolverTarjetas()">' + iconoSvg('arrow-left') + ' Módulos</button>';
  // Fase 155: con dos archivos, las dos opciones arriba y juntas; se ve una a la vez.
  var visible = centroCargaVisible(m, _cc.cargaSel[m.id]);
  if (m.cargas.length > 1) {
    html += '<div class="cc-selector" role="group" aria-label="Archivo a cargar en ' + esc(m.nombre) + '">' +
      '<span class="cc-selector-titulo">Este módulo lleva ' + m.cargas.length + ' archivos:</span>' +
      m.cargas.map(function (c, ci) {
        return '<button type="button" class="cc-selector-op' + (ci === visible ? ' on' : '') + '" aria-pressed="' + (ci === visible) + '" onclick="ccElegirCarga(' + ci + ')">' + esc(centroEtiquetaCarga(c)) + '</button>';
      }).join('') + '</div>';
  }
  m.cargas.forEach(function (c, ci) {
    if (ci !== visible) return;
    var huecos = centroHuecos(c, mesActual);
    html += '<section class="cc-carga" aria-labelledby="cc-carga-' + ci + '">' +
      '<div class="cc-carga-cab"><h3 id="cc-carga-' + ci + '">' + esc(c.nombre) + ' <span class="cc-carga-anio">' + _cc.anio + '</span></h3>' +
      '<span class="cc-carga-botones">' + (_ccVersionesDe(c.id).length ? '<button type="button" class="btn-cancel cc-btn" onclick="ccVerVersiones(' + ci + ')">' + iconoSvg('rotate-ccw') + ' Versiones guardadas (' + _ccVersionesDe(c.id).length + ')</button>' : '') +
      (c.plantilla
        ? '<button type="button" class="btn-cancel cc-btn" onclick="ccDescargarPlantilla(\'' + esc(c.plantilla) + '\')">' + iconoSvg('download') + ' Descargar plantilla</button>'
        : '<span class="cc-nota">La plantilla de Calidad se descarga desde Calidad (depende de los ítems de cada campaña).</span>') +
      '</span></div>';
    if (huecos.length) html += '<div class="cc-aviso cc-aviso-falta">Faltan meses entre los cargados: ' + esc(huecos.map(function (x) { return centroNombreMes(x).split(' ')[0]; }).join(', ')) + '.</div>';
    html += '<div class="cc-meses">';
    c.meses.forEach(function (x, mi) {
      var est = centroEstadoMes(x, mesActual);
      var nombre = centroNombreMes(x.mes).split(' ')[0];
      var etiqueta = { cargado: 'Cargado', vacio: 'Sin datos', en_curso: 'En curso', futuro: 'Próximo' }[est];
      html += '<div class="cc-mes cc-mes-' + est + (x.registros > 0 ? ' cc-mes-con' : '') + '">' +
        '<div class="cc-mes-cab"><span class="cc-mes-nombre">' + nombre + '</span><span class="cc-pill cc-pill-' + est + '">' + etiqueta + '</span></div>' +
        (x.registros > 0
          ? '<div class="cc-mes-num">' + esc(centroTextoRegistros(x.registros)) + '</div>' +
            '<div class="cc-mes-meta">' + esc(centroFechaCorta(x.ultimaCarga)) + (x.cargadoPor ? ' · ' + esc(x.cargadoPor) : '') + '</div>' +
            (x.archivo ? '<div class="cc-mes-archivo" title="' + esc(x.archivo) + '">' + esc(x.archivo) + '</div>' : '')
          : '<div class="cc-mes-num cc-mes-num-vacio">—</div>');
      html += '<div class="cc-mes-acciones">';
      if (est !== 'futuro') {
        html += '<button type="button" class="cc-accion cc-accion-primaria" onclick="ccSubir(' + ci + ',' + mi + ')">' + iconoSvg('upload') + (x.registros > 0 ? ' Reemplazar' : ' Subir') + '</button>';
      }
      if (x.registros > 0 && c.id !== 'calidad') {
        html += '<button type="button" class="cc-accion" onclick="ccDescargarCargado(' + ci + ',' + mi + ')" aria-label="Descargar lo cargado de ' + nombre + '" title="Descargar lo cargado">' + iconoSvg('download') + ' Descargar</button>';
        html += '<button type="button" class="cc-accion cc-accion-peligro cc-accion-icono" onclick="ccEliminar(' + ci + ',' + mi + ')" aria-label="Eliminar la base de ' + nombre + '" title="Eliminar la base de este mes">' + iconoSvg('trash-2') + '</button>';
      }
      html += '</div></div>';
    });
    html += '</div></section>';
  });
  document.getElementById('cc-body').innerHTML = html;
}

// ── Dialogos ─────────────────────────────────────────────────────────
function _ccDialogo(titulo, cuerpo, botones) {
  var d = document.getElementById('cc-dialogo');
  d.innerHTML = '<div class="cc-dialogo-caja" role="dialog" aria-modal="true" aria-labelledby="cc-dialogo-titulo">' +
    '<h3 id="cc-dialogo-titulo">' + titulo + '</h3>' + cuerpo +
    '<div class="modal-btns">' + botones + '</div></div>';
  d.classList.add('show');
  var b = d.querySelector('button:last-child'); if (b) b.focus();
}
function _ccCerrarDialogo() {
  var d = document.getElementById('cc-dialogo');
  if (d) { d.classList.remove('show'); d.innerHTML = ''; }
}

// Subir/Reemplazar (PR 1): la pantalla de carga de siempre, con el cliente
// ya elegido -- misma lectura, misma vista previa de impacto y la misma
// confirmacion antes de reemplazar. Al cerrarla, el Centro se vuelve a abrir
// en el mismo modulo con los conteos actualizados. PR 4: desde el mes
// (modulos de Mobilize primero), ver CENTRO_CARGA_PLAN.
var _ccVolverA = null;
function ccSubir(ci, mi) {
  var m = _ccModuloActual(), c = m.cargas[ci], x = c.meses[mi];
  _ccVolverA = { cliente: _cc.cliente, modulo: _cc.modulo };
  var cliente = _cc.cliente;
  // PR 4: las cargas de CENTRO_CARGA_PLAN suben con el plan de ese modulo y
  // solo las filas de ese mes; las demas, con la pantalla de siempre entera.
  var desdeMes = centroSubeDesdeMes(c.id);
  closeCentroCargas();
  setTimeout(async function () {
    _cargasFocoCentro = desdeMes ? { cliente: cliente, carga: c.id, mes: x.mes, nombre: c.nombre } : null;
    await openCargas();
    var sel = document.getElementById('carga-cliente');
    if (sel) { sel.value = cliente; await onCargaClienteChange(); }
    showToast((x.registros > 0 ? 'Reemplazar ' : 'Subir ') + centroNombreMes(x.mes) + ' de ' + c.nombre + ': elige el archivo aquí. ' +
      (desdeMes ? 'Solo se cargan las filas de ese mes. ' : '') + 'Antes de guardar verás cuántos registros entran y cuántos se reemplazan.');
  }, 60);
}
// Lo llama closeCargas (cargas.js) al cerrar la pantalla de carga.
function centroVolverTrasCarga() {
  if (!_ccVolverA) return;
  var v = _ccVolverA; _ccVolverA = null;
  setTimeout(function () { openCentroCargas(v.cliente, v.modulo); }, 60);
}

// ── Versiones guardadas y Deshacer (PR 2) ───────────────────────────
function _ccVersionesDe(cargaId) {
  return (_cc.versiones || []).filter(function (v) { return v.carga === cargaId && !v.restauradoEn; });
}
var CENTRO_MOTIVO = { 'reemplazo': 'antes de reemplazar', 'eliminacion': 'antes de eliminar', 'antes de deshacer': 'antes de deshacer' };
function ccVerVersiones(ci) {
  var c = _ccModuloActual().cargas[ci];
  var lista = _ccVersionesDe(c.id);
  var html = '<p class="cc-nota">Cada vez que un mes se reemplaza o se elimina, la base anterior se guarda 30 días. Deshacer devuelve ese mes a como estaba; lo que haya ahora también queda guardado.</p><ul class="cc-versiones">';
  lista.forEach(function (v) {
    html += '<li><div><strong>' + esc(centroNombreMes(v.mes)) + '</strong> · ' + esc(centroTextoRegistros(v.registros)) +
      '<div class="cc-nota">Guardada el ' + esc(centroFechaCorta(v.guardadoEn)) + ' (' + esc(CENTRO_MOTIVO[v.motivo] || v.motivo) + ')' +
      (v.archivoNombre ? ' · archivo ' + esc(v.archivoNombre) : '') + ' · vence el ' + esc(centroFechaCorta(v.expiraEn).slice(0, 10)) + '</div></div>' +
      '<button type="button" class="cc-accion" onclick="ccDeshacer(' + ci + ',' + v.id + ')">' + iconoSvg('rotate-ccw') + ' Deshacer</button></li>';
  });
  _ccDialogo('Versiones guardadas — ' + esc(c.nombre), html + '</ul>', '<button type="button" class="btn-cancel" onclick="_ccCerrarDialogo()">Cerrar</button>');
}
function ccDeshacer(ci, id) {
  var c = _ccModuloActual().cargas[ci];
  var v = (_cc.versiones || []).filter(function (x) { return x.id === id; })[0];
  if (!v) return;
  var ahora = (c.meses.filter(function (m) { return m.mes === v.mes; })[0] || {}).registros || 0;
  _ccDialogo('¿Deshacer ' + esc(centroNombreMes(v.mes)) + '?',
    '<p><strong>' + esc(centroNombreMes(v.mes)) + '</strong> de ' + esc(c.nombre) + ' (' + esc(_cc.cliente) + ') vuelve a como estaba el ' + esc(centroFechaCorta(v.guardadoEn)) + ': <strong>' + esc(centroTextoRegistros(v.registros)) + '</strong>.</p>' +
    '<p>Se reemplazan los <strong>' + esc(centroTextoRegistros(ahora)) + '</strong> que hay ahora en ese mes.</p>' +
    '<p class="cc-tranquilo">Lo que hay ahora también se guarda 30 días, y queda en el Historial.</p>',
    '<button type="button" class="btn-cancel" onclick="_ccCerrarDialogo()">Cancelar</button>' +
    '<button type="button" class="btn-primary" onclick="_ccConfirmarDeshacer(' + id + ')">Deshacer</button>');
}
async function _ccConfirmarDeshacer(id) {
  _ccCerrarDialogo();
  try {
    var r = await apiRequest('POST', '/centro-cargas/versiones/' + id + '/deshacer');
    showToast('Listo: volvieron ' + centroTextoRegistros(r.restauradas) + ' de ' + centroNombreMes(r.version.mes) + '.');
  } catch (e) { showToast(e.message, 'error'); }
  await _ccCargar();
}

// ── Eliminar un mes (PR 3) ──────────────────────────────────────────
function ccEliminar(ci, mi) {
  var c = _ccModuloActual().cargas[ci], x = c.meses[mi];
  var mes = centroNombreMes(x.mes);
  _ccDialogo('¿Eliminar ' + esc(mes) + '?',
    '<p>Se eliminan <strong>' + esc(centroTextoRegistros(x.registros)) + '</strong> de ' + esc(c.nombre) + ' de <strong>' + esc(mes) + '</strong> (' + esc(_cc.cliente) + '). Los demás meses no se tocan.</p>' +
    '<p class="cc-tranquilo">La base se guarda 30 días: si fue un error, la recuperas con Deshacer. Queda en el Historial.</p>',
    '<button type="button" class="btn-cancel" onclick="_ccCerrarDialogo()">Cancelar</button>' +
    '<button type="button" class="btn-primary cc-btn-peligro" onclick="_ccConfirmarEliminar(' + ci + ',' + mi + ')">' + iconoSvg('trash-2') + ' Eliminar</button>');
}
async function _ccConfirmarEliminar(ci, mi) {
  var c = _ccModuloActual().cargas[ci], x = c.meses[mi];
  _ccCerrarDialogo();
  var r;
  try {
    r = await apiRequest('DELETE', '/centro-cargas/' + encodeURIComponent(_cc.cliente) + '/' + encodeURIComponent(c.id) + '/' + x.mes);
  } catch (e) { showToast(e.message, 'error'); await _ccCargar(); return; }
  await _ccCargar();
  // Aviso de despues, con Deshacer a mano (el mes quedo vacio: deshacer no pisa nada).
  _ccDialogo('Listo: ' + esc(centroNombreMes(x.mes)) + ' quedó sin datos',
    '<p>Se eliminaron <strong>' + esc(centroTextoRegistros(r.eliminadas)) + '</strong> de ' + esc(c.nombre) + '. La base se guarda hasta el ' + esc(centroFechaCorta(r.version.expiraEn).slice(0, 10)) + '.</p>',
    '<button type="button" class="btn-cancel" onclick="_ccConfirmarDeshacer(' + r.version.id + ')">' + iconoSvg('rotate-ccw') + ' Deshacer</button>' +
    '<button type="button" class="btn-primary" onclick="_ccCerrarDialogo()">Entendido</button>');
}

// Descargar lo cargado: las filas de ese mes, tal como estan en la base.
async function ccDescargarCargado(ci, mi) {
  var m = _ccModuloActual(), c = m.cargas[ci], x = c.meses[mi];
  try {
    var r = await apiRequest('GET', '/centro-cargas/' + encodeURIComponent(_cc.cliente) + '/' + encodeURIComponent(c.id) + '/' + x.mes + '/datos');
    var aoa = [r.columnas].concat((r.filas || []).map(function (f) { return r.columnas.map(function (k) { return f[k]; }); }));
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(xlsxFilasSeguras(aoa)), 'DATOS');
    if (typeof xlsxAgregarAvisoDemo === 'function') xlsxAgregarAvisoDemo(wb);
    XLSX.writeFile(wb, centroNombreArchivoDescarga(_cc.cliente, c.id, x.mes));
    showToast('Se descargaron ' + centroTextoRegistros((r.filas || []).length) + ' de ' + centroNombreMes(x.mes) + '.');
  } catch (e) { showToast(e.message, 'error'); }
}

async function ccDescargarPlantilla(archivo) {
  try {
    var r = await fetch(API_BASE + '/centro-cargas-plantillas/' + encodeURIComponent(archivo), { headers: authToken ? { Authorization: 'Bearer ' + authToken } : {}, credentials: 'same-origin' });
    if (!r.ok) throw new Error('No se pudo descargar la plantilla.');
    var blob = await r.blob();
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = archivo; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  } catch (e) { showToast(e.message, 'error'); }
}

// Atajo desde el tablero: abre el Centro en ese cliente y en el modulo de la
// pestana activa (o en las tarjetas del cliente si la pestana es manual).
function centroAbrirDesdeTablero() {
  var tab = (_gd.config && _gd.config.layout ? (_gd.config.layout.tabs || []) : []).filter(function (t) { return t.key === _gd.tab; })[0];
  openCentroCargas(_gd.cliente, centroModuloDeTab(tab));
}

document.addEventListener('keydown', function (e) {
  if (e.key !== 'Escape') return;
  var d = document.getElementById('cc-dialogo');
  if (d && d.classList.contains('show')) { _ccCerrarDialogo(); e.stopPropagation(); return; }
  var o = document.getElementById('centro-overlay');
  if (o && o.classList.contains('show')) closeCentroCargas();
});
