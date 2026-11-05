// alias-admin.js — Fase 259. Admin › "Usuarios del sistema → asesora": lista,
// alta, edicion y baja de alias_asesores (routes/alias-asesores.js, solo
// administrador) para cualquier cliente. Todo texto pasa por esc().
var _aliasLista = [];
var _aliasEditando = null;

function aliasRenderSection() {
  var sel = document.getElementById('alias-campana');
  if (!sel) return;
  var lista = (typeof CLIENTES_LIST !== 'undefined' ? CLIENTES_LIST : []).slice();
  var actual = sel.value || (lista.indexOf('CLINICA AURORA') !== -1 ? 'CLINICA AURORA' : lista[0]);
  sel.innerHTML = lista.map(function (c) { return '<option value="' + esc(c) + '"' + (c === actual ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('');
  aliasCargar();
}

async function aliasCargar() {
  var camp = (document.getElementById('alias-campana') || {}).value;
  var tbl = document.getElementById('alias-tabla');
  if (!camp || !tbl) return;
  _aliasEditando = null;
  try { _aliasLista = (await apiRequest('GET', '/alias-asesores?campana=' + encodeURIComponent(camp))) || []; }
  catch (e) { tbl.innerHTML = '<tr><td>' + esc(e.message) + '</td></tr>'; return; }
  aliasPintar();
}

function aliasPintar() {
  var tbl = document.getElementById('alias-tabla');
  var html = '<tr><th>Usuario del sistema</th><th>Asesora</th><th>Registrado</th><th></th></tr>';
  if (!_aliasLista.length) html += '<tr><td colspan="4" class="ca-vacio">Este cliente todavía no tiene usuarios registrados.</td></tr>';
  _aliasLista.forEach(function (a) {
    if (_aliasEditando === a.id) {
      html += '<tr><td><input type="text" id="alias-ed-alias" value="' + esc(a.alias) + '" maxlength="120" aria-label="Usuario del sistema"></td>' +
        '<td><input type="text" id="alias-ed-nombre" value="' + esc(a.canonico) + '" maxlength="120" aria-label="Nombre de la asesora"></td><td>' + esc(a.createdAt || '') + '</td>' +
        '<td class="alias-acciones"><button type="button" class="btn-sm btn-edit" onclick="aliasGuardarEdicion(' + a.id + ')">Guardar</button> <button type="button" class="btn-sm" onclick="aliasCancelar()">Cancelar</button></td></tr>';
    } else {
      html += '<tr><td><b>' + esc(a.alias) + '</b></td><td>' + esc(a.canonico) + '</td><td>' + esc(a.createdAt || '') + (a.createdPorNombre ? ' · ' + esc(a.createdPorNombre) : '') + '</td>' +
        '<td class="alias-acciones"><button type="button" class="btn-sm btn-edit" onclick="aliasEditar(' + a.id + ')">Editar</button> <button type="button" class="btn-sm btn-delete" onclick="aliasBorrar(' + a.id + ')">Borrar</button></td></tr>';
    }
  });
  tbl.innerHTML = html;
  if (_aliasEditando) { var i = document.getElementById('alias-ed-nombre'); if (i) i.focus(); }
}

function _aliasCacheFuera() { if (typeof _auCache !== 'undefined') _auCache = {}; }

async function aliasAgregar() {
  var camp = document.getElementById('alias-campana').value;
  var alias = document.getElementById('alias-nuevo-alias').value.trim();
  var nombre = document.getElementById('alias-nuevo-nombre').value.trim();
  if (!alias || !nombre) { showToast('Escribe el usuario del sistema y el nombre de la asesora'); return; }
  try {
    var r = await apiRequest('POST', '/alias-asesores', { campana: camp, alias: alias, canonico: nombre });
    document.getElementById('alias-nuevo-alias').value = '';
    document.getElementById('alias-nuevo-nombre').value = '';
    showToast(r && r.advertencia ? 'Registrado. ' + r.advertencia : 'Registrado');
  } catch (e) { showToast(e.message, 'error'); return; }
  _aliasCacheFuera();
  aliasCargar();
}
function aliasEditar(id) { _aliasEditando = id; aliasPintar(); }
function aliasCancelar() { _aliasEditando = null; aliasPintar(); }
async function aliasGuardarEdicion(id) {
  var alias = document.getElementById('alias-ed-alias').value.trim();
  var nombre = document.getElementById('alias-ed-nombre').value.trim();
  if (!alias || !nombre) { showToast('Escribe el usuario del sistema y el nombre de la asesora'); return; }
  try { await apiRequest('PUT', '/alias-asesores/' + id, { alias: alias, canonico: nombre }); }
  catch (e) { showToast(e.message, 'error'); return; }
  showToast('Guardado');
  _aliasCacheFuera();
  aliasCargar();
}
async function aliasBorrar(id) {
  var a = _aliasLista.find(function (x) { return x.id === id; });
  if (!a || !confirm('¿Borrar "' + a.alias + '" → "' + a.canonico + '"? Los dashboards volverán a mostrar el usuario del sistema.')) return;
  try { await apiRequest('DELETE', '/alias-asesores/' + id); }
  catch (e) { showToast(e.message, 'error'); return; }
  showToast('Borrado');
  _aliasCacheFuera();
  aliasCargar();
}
