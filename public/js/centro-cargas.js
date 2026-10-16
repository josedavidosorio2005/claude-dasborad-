// centro-cargas.js — Fase 153 (P2, MAQUETA para revisar con Edwin): el
// "Centro de cargas". Cargar Datos → cliente → tarjetas de modulos → meses.
//
// MAQUETA: lee de verdad cuantos registros hay en cada mes
// (GET /centro-cargas/:cliente) y descarga las plantillas oficiales, pero
// Subir/Reemplazar/Eliminar/Descargar lo cargado solo muestran el dialogo
// que tendra la version final: NO guardan ni borran nada. La pantalla
// anterior de Cargar Datos sigue disponible desde el encabezado.
'use strict';

var _cc = { cliente: null, anio: null, modulos: [], modulo: null, foco: null };

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
  if (!canLoadData()) { showToast('No tienes permiso para cargar datos.', 'error'); return; }
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
function ccVolverTarjetas() { _cc.modulo = null; _ccRender(); }

function _ccModuloActual() {
  return _cc.modulos.filter(function (m) { return m.id === _cc.modulo; })[0];
}

function _ccRenderModulo() {
  var m = _ccModuloActual();
  var mesActual = _ccMesActual();
  document.getElementById('cc-migas').innerHTML = '<a role="button" tabindex="0" onclick="ccVolverTarjetas()">' + esc(_cc.cliente) + '</a> <span aria-hidden="true">›</span> <span aria-current="page">' + esc(m.nombre) + '</span>';
  var html = '<button type="button" class="btn-cancel cc-volver" onclick="ccVolverTarjetas()">' + iconoSvg('arrow-left') + ' Módulos</button>';
  m.cargas.forEach(function (c, ci) {
    var huecos = centroHuecos(c, mesActual);
    html += '<section class="cc-carga" aria-labelledby="cc-carga-' + ci + '">' +
      '<div class="cc-carga-cab"><h3 id="cc-carga-' + ci + '">' + esc(c.nombre) + ' <span class="cc-carga-anio">' + _cc.anio + '</span></h3>' +
      (c.plantilla
        ? '<button type="button" class="btn-cancel cc-btn" onclick="ccDescargarPlantilla(\'' + esc(c.plantilla) + '\')">' + iconoSvg('download') + ' Descargar plantilla</button>'
        : '<span class="cc-nota">La plantilla de Calidad se descarga desde Calidad (depende de los ítems de cada campaña).</span>') +
      '</div>';
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
      if (x.registros > 0) {
        html += '<button type="button" class="cc-accion" onclick="ccDescargarCargado(' + ci + ',' + mi + ')" aria-label="Descargar lo cargado de ' + nombre + '" title="Descargar lo cargado">' + iconoSvg('download') + '</button>' +
          '<button type="button" class="cc-accion cc-accion-peligro" onclick="ccEliminar(' + ci + ',' + mi + ')" aria-label="Eliminar la base de ' + nombre + '" title="Eliminar la base">' + iconoSvg('trash-2') + '</button>';
      }
      html += '</div></div>';
    });
    html += '</div></section>';
  });
  document.getElementById('cc-body').innerHTML = html;
}

// ── Dialogos (maqueta: no guardan ni borran nada) ─────────────────────
function _ccDialogo(titulo, cuerpo, botones) {
  var d = document.getElementById('cc-dialogo');
  d.innerHTML = '<div class="cc-dialogo-caja" role="dialog" aria-modal="true" aria-labelledby="cc-dialogo-titulo">' +
    '<h3 id="cc-dialogo-titulo">' + titulo + '</h3>' + cuerpo +
    '<p class="cc-maqueta">Maqueta para revisar con Edwin: en esta versión no se guarda ni se borra nada.</p>' +
    '<div class="modal-btns">' + botones + '</div></div>';
  d.classList.add('show');
  var b = d.querySelector('button:last-child'); if (b) b.focus();
}
function _ccCerrarDialogo() {
  var d = document.getElementById('cc-dialogo');
  if (d) { d.classList.remove('show'); d.innerHTML = ''; }
}

function ccSubir(ci, mi) {
  var m = _ccModuloActual(), c = m.cargas[ci], x = c.meses[mi];
  var nombreMes = centroNombreMes(x.mes);
  var cuerpo = x.registros > 0
    ? '<p>Vas a <strong>reemplazar</strong> la base de <strong>' + esc(nombreMes) + '</strong> de ' + esc(c.nombre) + ' (' + esc(centroTextoRegistros(x.registros)) + ') por la del archivo nuevo.</p>' +
      '<p class="cc-tranquilo">La base anterior se guarda 30 días: si algo sale mal, la recuperas con <strong>Deshacer</strong>.</p>'
    : '<p>Vas a subir la base de <strong>' + esc(nombreMes) + '</strong> de ' + esc(c.nombre) + '.</p>';
  cuerpo += '<label class="cc-archivo">' + iconoSvg('file-spreadsheet') + ' <span>Elegir archivo (.xlsx)…</span><input type="file" accept=".xlsx,.xls" onchange="ccArchivoElegido(this)"></label>' +
    '<p class="cc-nota" id="cc-archivo-nota">Antes de guardar verás la vista previa de siempre: cuántos registros entran, cuántos se reemplazan y si hay filas de otro mes.</p>';
  _ccDialogo(x.registros > 0 ? 'Reemplazar ' + esc(nombreMes) : 'Subir ' + esc(nombreMes), cuerpo,
    '<button type="button" class="btn-cancel" onclick="_ccCerrarDialogo()">Cancelar</button>');
}
function ccArchivoElegido(input) {
  var f = input.files && input.files[0];
  var nota = document.getElementById('cc-archivo-nota');
  if (f && nota) nota.textContent = 'Archivo elegido: ' + f.name + '. En la versión final aquí aparece la vista previa con los conteos antes de guardar.';
}

function ccEliminar(ci, mi) {
  var m = _ccModuloActual(), c = m.cargas[ci], x = c.meses[mi];
  var nombreMes = centroNombreMes(x.mes);
  _ccDialogo('¿Eliminar la base de ' + esc(nombreMes) + '?',
    '<p>Se eliminan <strong>' + esc(centroTextoRegistros(x.registros)) + '</strong> de ' + esc(c.nombre) + ' de <strong>' + esc(nombreMes) + '</strong> (' + esc(_cc.cliente) + '). Los demás meses no se tocan.</p>' +
    (x.archivo ? '<p class="cc-nota">Archivo cargado: ' + esc(x.archivo) + (x.cargadoPor ? ', por ' + esc(x.cargadoPor) : '') + '.</p>' : '') +
    '<p class="cc-tranquilo">Queda en el Historial y la base se guarda 30 días: la puedes recuperar con <strong>Deshacer</strong>.</p>',
    '<button type="button" class="btn-cancel" onclick="_ccCerrarDialogo()">Cancelar</button>' +
    '<button type="button" class="btn-primary cc-btn-peligro" onclick="_ccCerrarDialogo();showToast(\'Maqueta: no se eliminó nada.\')">Eliminar ' + esc(nombreMes.split(' ')[0].toLowerCase()) + '</button>');
}

function ccDescargarCargado(ci, mi) {
  var m = _ccModuloActual(), c = m.cargas[ci], x = c.meses[mi];
  showToast('Maqueta: en la versión final se descarga un Excel con los ' + centroTextoRegistros(x.registros) + ' de ' + centroNombreMes(x.mes) + '.');
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
