// malla.js — Fase 358 (pedido de Edwin, 17/11): «Malla de turnos» (interfaz). La ventana para el
// supervisor, ADMIN y Reportes (solo lectura), y «Mi malla» en el Portal Asesor. El servidor
// decide los permisos (server/malla.js). Todo texto se escapa (esc) o va por textContent.
'use strict';

var _ml = { campanas: [], campana: null, semana: null, actual: null, datos: null };
var ML_HORARIO_BASE = { 1: { entrada: '08:00', salida: '17:00' }, 2: { entrada: '08:00', salida: '17:00' }, 3: { entrada: '08:00', salida: '17:00' }, 4: { entrada: '08:00', salida: '17:00' }, 5: { entrada: '08:00', salida: '17:00' }, 6: null, 7: null };

function _mlEl(id) { return document.getElementById(id); }
function _mlError(msg) { var e = _mlEl('ml-error'); e.textContent = msg || ''; e.classList.toggle('hidden', !msg); }
function _mlNota(msg) { _mlEl('ml-nota').textContent = msg || ''; }

async function mallaAbrir() {
  _mlError(''); _mlNota('');
  try {
    var r = await apiRequest('GET', '/malla/campanas');
    _ml.campanas = r.campanas || [];
    _ml.actual = r.semanaActual;
    if (!_ml.semana) _ml.semana = r.semanaActual;
  } catch (e) { showToast('No se pudo abrir la malla: ' + (e.message || ''), 'error'); return; }
  if (!_ml.campanas.length) { showToast('No tienes campañas con malla de turnos.'); return; }
  if (!_ml.campana || !_ml.campanas.some(function (c) { return c.nombre === _ml.campana; })) _ml.campana = _ml.campanas[0].nombre;
  _mlEl('ml-campana').innerHTML = _ml.campanas.map(function (c) {
    return '<option value="' + esc(c.nombre) + '"' + (c.nombre === _ml.campana ? ' selected' : '') + '>' + esc(c.nombre) + '</option>';
  }).join('');
  openModal('modal-malla');
  await mallaCargar();
  setTimeout(function () { var s = _mlEl('ml-campana'); if (s) s.focus(); }, 60);
}
function mallaCerrar() { closeModal('modal-malla'); mallaCancelarCopia(); }

function mallaMoverSemana(n) { _ml.semana = mallaSumarSemanas(_ml.semana, n); mallaCargar(); }
function mallaIrHoy() { _ml.semana = _ml.actual; mallaCargar(); }

async function mallaCargar() {
  _ml.campana = _mlEl('ml-campana').value || _ml.campana;
  _mlError(''); mallaCancelarCopia();
  _mlEl('ml-semana-txt').textContent = mallaSemanaTexto(_ml.semana) + (_ml.semana === _ml.actual ? ' (esta semana)' : '');
  _mlEl('ml-grupos').innerHTML = '<p class="vis-vacio">Cargando…</p>';
  try {
    _ml.datos = await apiRequest('GET', '/malla?campana=' + encodeURIComponent(_ml.campana) + '&semana=' + encodeURIComponent(_ml.semana));
  } catch (e) { _ml.datos = null; _mlEl('ml-grupos').innerHTML = ''; _mlError(e.message || 'No se pudo cargar la malla'); return; }
  _mlEl('ml-acciones').classList.toggle('hidden', !_ml.datos.puedeEditar);
  var opts = '';
  for (var k = 1; k <= 4; k++) { var s = mallaSumarSemanas(_ml.semana, k); opts += '<option value="' + s + '">' + esc(mallaSemanaTexto(s)) + '</option>'; }
  _mlEl('ml-copiar-a').innerHTML = opts;
  _mlPintar();
}

// Quién está en otro grupo de la misma semana (para avisar en la lista de asesoras).
function _mlGrupoDe(asesorId, menos) {
  var g = (_ml.datos.grupos || []).find(function (x) { return x.id !== menos && x.asesoras.some(function (a) { return a.id === asesorId; }); });
  return g ? g.nombre : null;
}

function mallaGrupoHtml(g, puedeEditar, asesoras, idx) {
  var dis = puedeEditar ? '' : ' disabled';
  var pre = 'ml-g' + idx;
  var filas = MALLA_DIAS.map(function (d) {
    var t = g.horario ? g.horario[d.n] || g.horario[String(d.n)] : null;
    return '<tr><th scope="row"><span class="ml-dia-largo">' + d.largo + '</span><span class="ml-dia-corto" aria-hidden="true">' + d.corto + '</span></th>' +
      '<td><input type="checkbox" id="' + pre + '-t' + d.n + '" data-dia="' + d.n + '" class="ml-trabaja"' + (t ? ' checked' : '') + dis + ' aria-label="Trabaja el ' + d.largo.toLowerCase() + '"></td>' +
      '<td><input type="time" id="' + pre + '-e' + d.n + '" value="' + (t ? esc(t.entrada) : '') + '"' + dis + ' aria-label="Entrada del ' + d.largo.toLowerCase() + '"></td>' +
      '<td><input type="time" id="' + pre + '-s' + d.n + '" value="' + (t ? esc(t.salida) : '') + '"' + dis + ' aria-label="Salida del ' + d.largo.toLowerCase() + '"></td></tr>';
  }).join('');
  var marcadas = {};
  (g.asesoras || []).forEach(function (a) { marcadas[a.id] = true; });
  var lista = asesoras.length ? asesoras.map(function (a) {
    var otro = _mlGrupoDe(a.id, g.id);
    return '<label class="ml-asesora"><input type="checkbox" value="' + a.id + '"' + (marcadas[a.id] ? ' checked' : '') + dis + '> ' + esc(a.nombre) +
      (otro && !marcadas[a.id] ? ' <span class="ml-otro">(en ' + esc(otro) + ')</span>' : '') + '</label>';
  }).join('') : '<p class="vis-vacio">No hay asesoras activas en esta campaña.</p>';
  return '<section class="aurora-card ml-grupo" data-idx="' + idx + '" data-id="' + (g.id || '') + '" aria-labelledby="' + pre + '-tit">' +
    '<div class="ig"><label for="' + pre + '-nombre" id="' + pre + '-tit">Grupo</label><input type="text" id="' + pre + '-nombre" maxlength="' + MALLA_NOMBRE_MAX + '" value="' + esc(g.nombre || '') + '"' + dis + '></div>' +
    '<div class="table-wrap"><table class="ml-tabla"><thead><tr><th scope="col">Día</th><th scope="col"><span class="ml-dia-largo">Trabaja</span><span class="ml-dia-corto" aria-hidden="true">Trab.</span></th><th scope="col">Entrada</th><th scope="col">Salida</th></tr></thead><tbody>' + filas + '</tbody></table></div>' +
    '<fieldset class="ml-asesoras"><legend>Asesoras (' + (g.asesoras || []).length + ')</legend>' + lista + '</fieldset>' +
    (puedeEditar ? '<div class="modal-btns"><button type="button" class="btn-cancel ml-borrar" onclick="mallaBorrarGrupo(' + idx + ')">' + (g.id ? 'Eliminar grupo' : 'Descartar') + '</button>' +
      '<button type="button" class="btn-primary" onclick="mallaGuardarGrupo(' + idx + ')">Guardar grupo</button></div>' : '') +
    '</section>';
}

function _mlPintar() {
  var d = _ml.datos;
  if (!d.grupos.length) {
    _mlEl('ml-grupos').innerHTML = '<p class="vis-vacio">Esta semana no tiene malla todavía.' + (d.puedeEditar ? ' Crea un grupo o copia otra semana.' : '') + '</p>';
    return;
  }
  _mlEl('ml-grupos').innerHTML = d.grupos.map(function (g, i) { return mallaGrupoHtml(g, d.puedeEditar, d.asesoras, i); }).join('');
}

function mallaNuevoGrupo() {
  if (!_ml.datos || !_ml.datos.puedeEditar) return;
  _ml.datos.grupos.push({ id: null, nombre: '', horario: JSON.parse(JSON.stringify(ML_HORARIO_BASE)), asesoras: [] });
  _mlPintar();
  var i = _ml.datos.grupos.length - 1;
  var n = _mlEl('ml-g' + i + '-nombre'); if (n) { n.scrollIntoView({ block: 'center' }); n.focus(); }
}

function _mlLeerGrupo(idx) {
  var pre = 'ml-g' + idx, h = {};
  MALLA_DIAS.forEach(function (d) {
    h[d.n] = _mlEl(pre + '-t' + d.n).checked ? { entrada: _mlEl(pre + '-e' + d.n).value, salida: _mlEl(pre + '-s' + d.n).value } : null;
  });
  var sec = document.querySelector('.ml-grupo[data-idx="' + idx + '"]');
  var ids = Array.prototype.map.call(sec.querySelectorAll('.ml-asesoras input:checked'), function (x) { return Number(x.value); });
  return { nombre: _mlEl(pre + '-nombre').value.trim(), horario: h, asesoras: ids };
}

async function mallaGuardarGrupo(idx) {
  _mlError(''); _mlNota('');
  var g = _ml.datos.grupos[idx], v = _mlLeerGrupo(idx);
  if (!mallaNombreValido(v.nombre)) { _mlError('Escribe el nombre del grupo'); _mlEl('ml-g' + idx + '-nombre').focus(); return; }
  var h = mallaValidarHorario(v.horario);
  if (!h.ok) { _mlError(h.error); return; }
  try {
    var id = g.id;
    if (!id) id = (await apiRequest('POST', '/malla/grupos', { campana: _ml.campana, semana: _ml.semana, nombre: v.nombre, horario: h.horario })).grupo.id;
    else await apiRequest('PUT', '/malla/grupos/' + id, { nombre: v.nombre, horario: h.horario });
    await apiRequest('PUT', '/malla/grupos/' + id + '/asesoras', { asesoras: v.asesoras });
    showToast('Grupo «' + v.nombre + '» guardado', 'ok');
    await mallaCargar();
    _mlNota('Grupo «' + v.nombre + '» guardado.');
  } catch (e) { _mlError(e.message || 'No se pudo guardar el grupo'); }
}

async function mallaBorrarGrupo(idx) {
  var g = _ml.datos.grupos[idx];
  if (!g.id) { _ml.datos.grupos.splice(idx, 1); _mlPintar(); return; }
  if (!window.confirm('¿Eliminar el grupo «' + g.nombre + '» de esta semana? Sus asesoras quedan sin turno.')) return;
  try { await apiRequest('DELETE', '/malla/grupos/' + g.id); showToast('Grupo eliminado', 'ok'); await mallaCargar(); }
  catch (e) { _mlError(e.message || 'No se pudo eliminar'); }
}

async function mallaCopiar(reemplazar) {
  _mlError(''); _mlNota('');
  var hasta = _mlEl('ml-copiar-a').value;
  try {
    var r = await apiRequest('POST', '/malla/copiar', { campana: _ml.campana, desde: _ml.semana, hasta: hasta, reemplazar: reemplazar === true });
    mallaCancelarCopia();
    _mlNota('Se copiaron ' + r.grupos + ' grupo(s) y ' + r.asesoras + ' asignación(es) a la ' + mallaSemanaTexto(hasta).toLowerCase() + '.');
    showToast('Semana copiada', 'ok');
  } catch (e) {
    if (e.data && e.data.codigo === 'DESTINO_CON_MALLA') {
      _mlEl('ml-confirmar-txt').textContent = 'La ' + mallaSemanaTexto(hasta).toLowerCase() + ' ya tiene ' + e.data.grupos + ' grupo(s). ¿Reemplazarla con esta semana?';
      _mlEl('ml-confirmar').classList.remove('hidden');
      _mlEl('ml-reemplazar-btn').focus();
      return;
    }
    _mlError(e.message || 'No se pudo copiar');
  }
}
function mallaCancelarCopia() { var c = _mlEl('ml-confirmar'); if (c) c.classList.add('hidden'); }

// ── Portal Asesor: «Mi malla» ──
function mallaMiaHtml(r) {
  if (!r || !r.semanas || !r.semanas.length) return '<p class="vis-vacio">No tienes malla asignada.</p>';
  return r.semanas.map(function (s, i) {
    var titulo = (i === 0 ? 'Esta semana' : 'Semana siguiente') + ' · ' + mallaSemanaTexto(s.semana).replace(/^Semana /, '');
    if (!s.turno) return '<section class="aurora-card"><div class="aurora-card-title">' + esc(titulo) + '</div><p class="vis-vacio">Todavía no tienes turno asignado.</p></section>';
    var filas = MALLA_DIAS.map(function (d) {
      var t = s.turno.horario[d.n] || s.turno.horario[String(d.n)] || null;
      var f = mallaFechaDelDia(s.semana, d.n);
      return '<tr' + (t ? '' : ' class="ml-descanso"') + '><th scope="row">' + d.largo + ' ' + esc(f.slice(8, 10) + '/' + f.slice(5, 7)) + '</th><td>' + esc(mallaTurnoTexto(t)) + '</td></tr>';
    }).join('');
    return '<section class="aurora-card"><div class="aurora-card-title">' + esc(titulo) + '</div><p class="ml-nota">Grupo: <strong>' + esc(s.turno.grupo) + '</strong></p>' +
      '<div class="table-wrap"><table class="ml-tabla ml-tabla-mia"><thead><tr><th scope="col">Día</th><th scope="col">Horario</th></tr></thead><tbody>' + filas + '</tbody></table></div></section>';
  }).join('');
}
async function mallaMiaRender() {
  var c = _mlEl('malla-mia');
  if (!c) return;
  c.innerHTML = '<p class="vis-vacio">Cargando…</p>';
  try { c.innerHTML = mallaMiaHtml(await apiRequest('GET', '/malla/mia')); }
  catch (e) { c.innerHTML = '<p class="vis-vacio">' + esc(e.message || 'No se pudo cargar tu malla') + '</p>'; }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { mallaMiaHtml: mallaMiaHtml, mallaGrupoHtml: mallaGrupoHtml };
}
