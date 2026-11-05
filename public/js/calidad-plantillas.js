// calidad-plantillas.js — Fase 253 (plan de Calidad B2). Pestaña "Plantillas"
// del modulo de Calidad, solo para el administrador: importar una plantilla
// desde su archivo (vista previa y confirmacion) y ver/activar sus versiones.
// El candado real es el servidor (POST /calidad/plantillas/importar, solo admin).
var _cplArchivo = null;      // objeto del archivo elegido (solo en memoria)
var _cplArchivoNombre = '';
var _cplPrincipal = false;

function _cplError(msg) {
  var el = document.getElementById('cpl-error');
  if (!el) return;
  el.textContent = msg || '';
  el.hidden = !msg;
}

async function calPlantillasRender() {
  var tbl = document.getElementById('cpl-tabla');
  if (!tbl) return;
  var lista;
  try { lista = (await apiRequest('GET', '/calidad/plantillas/admin')) || []; }
  catch (e) { tbl.innerHTML = '<tr><td>' + esc(e.message) + '</td></tr>'; return; }
  var html = '<tr><th>Campaña</th><th>Plantilla</th><th>Versión</th><th>Ítems</th><th>Principal</th><th>Estado</th><th>Monitoreos</th><th></th></tr>';
  var grupos = cplAgrupar(lista);
  if (!grupos.length) html += '<tr><td colspan="8" class="cpl-vacio">Todavía no hay plantillas.</td></tr>';
  grupos.forEach(function (g) {
    g.filas.forEach(function (p) {
      var accion = p.principal ? '' :
        '<button type="button" class="btn-sm ' + (p.activo ? 'btn-delete' : 'btn-edit') + '" onclick="calPlantillaActivo(' + p.id + ',' + (!p.activo) + ')">' + (p.activo ? 'Desactivar' : 'Activar') + '</button>';
      html += '<tr' + (p.activo ? '' : ' class="cpl-inactiva"') + '><td>' + esc(p.campana) + '</td><td>' + esc(p.nombre) + (p.campos ? '' : ' <span class="cpl-etq">formulario de siempre</span>') + '</td>' +
        '<td>' + esc(p.version || 1) + '</td><td>' + (p.items || []).length + '</td><td>' + (p.principal ? 'Sí' : '—') + '</td>' +
        '<td>' + (p.activo ? 'Activa' : 'Inactiva') + '</td><td>' + esc(p.monitoreos) + '</td><td>' + accion + '</td></tr>';
    });
  });
  tbl.innerHTML = html;
}

function calPlantillaArchivo(input) {
  _cplError('');
  var f = input.files && input.files[0];
  input.value = '';
  if (!f) return;
  var reader = new FileReader();
  reader.onload = function () {
    var r = cplLeerArchivo(reader.result, f.size);
    if (r.error) { _cplArchivo = null; _cplError(r.error); document.getElementById('cpl-preview').hidden = true; return; }
    _cplArchivo = r.archivo;
    _cplArchivoNombre = f.name;
    _cplPrincipal = false;
    calPlantillaPrevisualizar();
  };
  reader.onerror = function () { _cplError('No se pudo leer el archivo'); };
  reader.readAsText(f);
}

async function calPlantillaPrevisualizar() {
  if (!_cplArchivo) return;
  var card = document.getElementById('cpl-preview');
  var r;
  try { r = await apiRequest('POST', '/calidad/plantillas/importar', { archivo: _cplArchivo, principal: _cplPrincipal }); }
  catch (e) { card.hidden = true; _cplError(e.message); return; }
  _cplError('');
  var p = r.plantilla;
  var filas = p.items.map(function (it) {
    return '<tr><td>' + esc(it.n) + '</td><td>' + esc(it.cat) + '</td><td>' + esc(it.label) + '</td><td>' + esc(it.weight) + '</td>' +
      '<td>' + (it.critico ? '<span class="qi-crit" aria-hidden="true">&#9888;</span> Sí' : '—') + '</td><td>' + (it.admiteNA === false ? 'No' : 'Sí') + '</td>' +
      '<td class="cpl-desc">' + esc(it.descripcion || '') + '</td></tr>';
  }).join('');
  var plan = cplPlanTexto(r.plan, p.nombre, p.campana).map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('');
  var avisos = (r.avisos || []).length ? '<div class="cpl-avisos"><strong>Para revisar:</strong><ul>' + r.avisos.map(function (a) { return '<li>' + esc(a) + '</li>'; }).join('') + '</ul></div>' : '';
  var principalBloqueado = r.plan.principal && !_cplPrincipal; // el servidor la deja principal sí o sí (hereda o no hay otra)
  card.innerHTML =
    '<div class="aurora-card-title">Vista previa — ' + esc(_cplArchivoNombre) + '</div>' +
    '<div class="qi-preview cpl-resumen">' +
      '<div class="qi-pill"><div class="qv" style="font-size:1rem">' + esc(p.nombre) + '</div><div class="ql">PLANTILLA</div></div>' +
      '<div class="qi-pill"><div class="qv" style="font-size:1rem">' + esc(p.campana) + '</div><div class="ql">CAMPAÑA</div></div>' +
      '<div class="qi-pill"><div class="qv">' + r.resumen.items + '</div><div class="ql">ÍTEMS</div></div>' +
      '<div class="qi-pill"><div class="qv">' + r.resumen.criticos + '</div><div class="ql">CRÍTICOS</div></div>' +
      '<div class="qi-pill"><div class="qv">' + esc(r.resumen.sumaPesos) + '</div><div class="ql">SUMA DE PESOS</div></div>' +
    '</div>' +
    '<p class="cpl-campos"><strong>Campos del formulario:</strong> ' + p.campos.map(function (c) { return esc(c.etiqueta); }).join(' · ') + '</p>' +
    '<ul class="cpl-plan">' + plan + '</ul>' + avisos +
    '<div style="overflow-x:auto"><table class="aurora-rank-table cpl-items"><tr><th>#</th><th>Categoría</th><th>Ítem</th><th>Peso</th><th>Crítico</th><th>Admite N/A</th><th>Descripción</th></tr>' + filas + '</table></div>' +
    '<label class="cpl-check"><input type="checkbox" id="cpl-principal" ' + (r.plan.principal ? 'checked' : '') + (principalBloqueado ? ' disabled' : '') +
      ' onchange="_cplPrincipal=this.checked;calPlantillaPrevisualizar()"> Usar como plantilla principal de ' + esc(p.campana) + '</label>' +
    '<div class="modal-btns" style="margin-top:10px">' +
      '<button type="button" class="btn-cancel" onclick="calPlantillaDescartar()">Descartar</button>' +
      '<button type="button" class="btn-primary" id="cpl-confirmar" onclick="calPlantillaConfirmar()">Importar plantilla</button>' +
    '</div>';
  card.hidden = false;
}

function calPlantillaDescartar() {
  _cplArchivo = null; _cplPrincipal = false; _cplError('');
  var card = document.getElementById('cpl-preview');
  card.hidden = true; card.innerHTML = '';
}

async function calPlantillaConfirmar() {
  if (!_cplArchivo) return;
  var btn = document.getElementById('cpl-confirmar');
  var r;
  try {
    r = await withButtonLoading(btn, 'Importando...', function () {
      return apiRequest('POST', '/calidad/plantillas/importar', { archivo: _cplArchivo, principal: _cplPrincipal, confirmar: true });
    });
  } catch (e) { _cplError(e.message); return; }
  showToast('Plantilla "' + r.plantilla.nombre + '" importada (versión ' + r.plantilla.version + ')');
  calPlantillaDescartar();
  if (typeof _usersPlantillas !== 'undefined') _usersPlantillas = null; // el formulario de usuario vuelve a pedirlas
  await calLoadPlantillas(true);
  await calPlantillasRender();
}

async function calPlantillaActivo(id, activo) {
  try { await apiRequest('PUT', '/calidad/plantillas/' + id + '/activo', { activo: activo }); }
  catch (e) { showToast(e.message, 'error'); return; }
  showToast(activo ? 'Plantilla activada' : 'Plantilla desactivada');
  if (typeof _usersPlantillas !== 'undefined') _usersPlantillas = null;
  await calLoadPlantillas(true);
  await calPlantillasRender();
}
