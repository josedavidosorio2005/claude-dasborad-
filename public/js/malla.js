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
// Fase 366 (D1): selector de mes y sus semanas (botones), para llegar a cualquier semana futura.
function mallaElegirMes() {
  var mes = (_mlEl('ml-mes') || {}).value;
  if (mes) mallaPintarSemanasMes(mes);
}
// Pedido de Edwin (24/11): las semanas del mes en una lista compacta (antes, una ficha por semana).
function mallaPintarSemanasMes(mes) {
  var s = _mlEl('ml-sem-sel');
  if (!s) return;
  s.textContent = '';
  var lista = mallaSemanasDelMes(mes);
  if (lista.indexOf(_ml.semana) === -1) {
    var o0 = document.createElement('option');
    o0.value = ''; o0.textContent = 'Elige una semana';
    s.appendChild(o0);
  }
  lista.forEach(function (l) {
    var o = document.createElement('option');
    o.value = l;
    o.textContent = mallaSemanaTexto(l).replace(/^Semana /, '') + (l === _ml.actual ? ' (esta semana)' : '');
    if (l === _ml.semana) o.selected = true;
    s.appendChild(o);
  });
}
function mallaElegirSemanaMes() {
  var v = (_mlEl('ml-sem-sel') || {}).value;
  if (v && v !== _ml.semana) { _ml.semana = v; mallaCargar(); }
}
// Fase 373 (Edwin 19/11): sin botón «Esta semana»; solo las flechas y el selector de mes.

async function mallaCargar() {
  _ml.campana = _mlEl('ml-campana').value || _ml.campana;
  _mlError(''); mallaCancelarCopia();
  _mlEl('ml-semana-txt').textContent = mallaSemanaTexto(_ml.semana) + (_ml.semana === _ml.actual ? ' (esta semana)' : '');
  // Fase 366: el selector de mes sigue a la semana que se ve (mes de su jueves: la semana «pertenece» ahí).
  var mesSem = mallaFechaDelDia(_ml.semana, 4).slice(0, 7);
  if (_mlEl('ml-mes')) { _mlEl('ml-mes').value = mesSem; mallaPintarSemanasMes(mesSem); }
  _mlEl('ml-grupos').innerHTML = '<p class="vis-vacio">Cargando…</p>';
  try {
    _ml.datos = await apiRequest('GET', '/malla?campana=' + encodeURIComponent(_ml.campana) + '&semana=' + encodeURIComponent(_ml.semana));
  } catch (e) { _ml.datos = null; _mlEl('ml-grupos').innerHTML = ''; _mlError(e.message || 'No se pudo cargar la malla'); return; }
  _mlEl('ml-acciones').classList.toggle('hidden', !_ml.datos.puedeEditar);
  var opts = '';
  for (var k = 1; k <= 4; k++) { var s = mallaSumarSemanas(_ml.semana, k); opts += '<option value="' + s + '">' + esc(mallaSemanaTexto(s)) + '</option>'; }
  _mlEl('ml-copiar-a').innerHTML = opts;
  _mlPintar();
  if (typeof mpTrasCargar === 'function') mpTrasCargar(); // Fase 363: pestaña «Puntualidad»
}

// Quién está en otro grupo de la misma semana (para avisar en la lista de asesoras).
function _mlGrupoDe(asesorId, menos) {
  var g = ((_ml.datos && _ml.datos.grupos) || []).find(function (x) { return x.id !== menos && x.asesoras.some(function (a) { return a.id === asesorId; }); });
  return g ? g.nombre : null;
}

function mallaGrupoHtml(g, puedeEditar, asesoras, idx, datos) { // datos: la semana (por defecto _ml.datos)
  var dis = puedeEditar ? '' : ' disabled';
  var pre = 'ml-g' + idx;
  var filas = MALLA_DIAS.map(function (d) {
    var t = g.horario ? g.horario[d.n] || g.horario[String(d.n)] : null;
    return '<tr><th scope="row"><span class="ml-dia-largo">' + d.largo + '</span><span class="ml-dia-corto" aria-hidden="true">' + d.corto + '</span></th>' +
      '<td><input type="checkbox" id="' + pre + '-t' + d.n + '" data-dia="' + d.n + '" class="ml-trabaja"' + (t ? ' checked' : '') + dis + ' aria-label="Trabaja el ' + d.largo.toLowerCase() + '"></td>' +
      '<td><input type="time" id="' + pre + '-e' + d.n + '" value="' + (t ? esc(t.entrada) : '') + '"' + dis + ' aria-label="Entrada del ' + d.largo.toLowerCase() + '"></td>' +
      '<td><input type="time" id="' + pre + '-s' + d.n + '" value="' + (t ? esc(t.salida) : '') + '"' + dis + ' aria-label="Salida del ' + d.largo.toLowerCase() + '"></td></tr>';
  }).join('');
  // Fase M1 (B): horario del grupo en los festivos (sin marcar: el festivo descansa, por defecto).
  var fe = g.horario && g.horario.festivo ? g.horario.festivo : null;
  filas += '<tr class="ml-fila-festivo"><th scope="row"><span class="ml-dia-largo">Festivos</span><span class="ml-dia-corto" aria-hidden="true">Fest.</span></th>' +
    '<td><input type="checkbox" id="' + pre + '-tf" class="ml-trabaja"' + (fe ? ' checked' : '') + dis + ' aria-label="Trabaja los festivos (sin marcar: descansa)"></td>' +
    '<td><input type="time" id="' + pre + '-ef" value="' + (fe ? esc(fe.entrada) : '') + '"' + dis + ' aria-label="Entrada en festivo"></td>' +
    '<td><input type="time" id="' + pre + '-sf" value="' + (fe ? esc(fe.salida) : '') + '"' + dis + ' aria-label="Salida en festivo"></td></tr>';
  var pausas = mallaPausasTablaHtml(g.horario, pre, dis);
  var marcadas = {};
  (g.asesoras || []).forEach(function (a) { marcadas[a.id] = true; });
  var lista = asesoras.length ? asesoras.map(function (a) {
    var otro = _mlGrupoDe(a.id, g.id);
    return '<label class="ml-asesora"><input type="checkbox" value="' + a.id + '"' + (marcadas[a.id] ? ' checked' : '') + dis + '> ' + esc(a.nombre) +
      (otro && !marcadas[a.id] ? ' <span class="ml-otro">(en ' + esc(otro) + ')</span>' : '') + '</label>';
  }).join('') : '<p class="vis-vacio">No hay asesoras activas en esta campaña.</p>';
  var color = g.color || ((idx % 8) + 1); // Fase 373: cada grupo con su color (serie 1 a 8)
  // Pedido de Edwin (24/11): más compacto. Cabecera (nombre + botones) en una fila; el horario y la lista de
  // asesoras lado a lado en pantallas anchas; la lista en un cuadro con su propio scroll.
  return '<section class="aurora-card ml-grupo ml-color-' + color + '" data-idx="' + idx + '" data-id="' + (g.id || '') + '" aria-labelledby="' + pre + '-tit"' +
    (puedeEditar ? ' oninput="mallaRecalcularHoras(' + idx + ')" onchange="mallaRecalcularHoras(' + idx + ')"' : '') + '>' +
    '<div class="ml-grupo-cab"><div class="ig"><label for="' + pre + '-nombre" id="' + pre + '-tit"><span class="ml-punto" aria-hidden="true"></span>Grupo</label><input type="text" id="' + pre + '-nombre" maxlength="' + MALLA_NOMBRE_MAX + '" value="' + esc(g.nombre || '') + '"' + dis + '></div>' +
    (puedeEditar ? '<div class="ml-grupo-btns"><button type="button" class="btn-cancel ml-borrar" onclick="mallaBorrarGrupo(' + idx + ')">' + (g.id ? 'Eliminar grupo' : 'Descartar') + '</button>' +
      '<button type="button" class="btn-primary" onclick="mallaGuardarGrupo(' + idx + ')">Guardar grupo</button></div>' : '') + '</div>' +
    '<div class="ml-grupo-cuerpo"><div class="ml-grupo-horario"><div class="table-wrap"><table class="ml-tabla" aria-describedby="' + pre + '-fest-ayuda"><thead><tr><th scope="col">Día</th><th scope="col"><span class="ml-dia-largo">Trabaja</span><span class="ml-dia-corto" aria-hidden="true">Trab.</span></th><th scope="col">Entrada</th><th scope="col">Salida</th></tr></thead><tbody>' + filas + '</tbody></table></div>' +
    '<p class="vis-ayuda ml-fest-ayuda" id="' + pre + '-fest-ayuda">Festivos: si no se marca, el grupo descansa los festivos. Un festivo en un día que el grupo no trabaja sigue siendo descanso.</p>' + pausas + '</div>' +
    '<fieldset class="ml-asesoras"><legend>Asesoras (' + (g.asesoras || []).length + ')</legend><div class="ml-asesoras-lista" tabindex="0" role="group" aria-label="Asesoras de la campaña (con scroll)">' + lista + '</div></fieldset></div>' +
    (g.id && (g.asesoras || []).length ? mallaCasosHtml(g, idx, puedeEditar, datos) : '') +
    '</section>';
}

// Pedido de Edwin (24/11): pausa activa 1 (mañana, 15 min), almuerzo (hora y 30 min o 1 h) y pausa activa 2
// (tarde, 10 min) por día, con las horas del día y el total de la semana (salida − entrada − almuerzo). Si la
// semana no suma 42 h sale un aviso, sin bloquear. Todo opcional: los horarios ya guardados siguen igual.
function mallaPausasTablaHtml(h, pre, dis) {
  h = h || {};
  var filas = MALLA_DIAS.map(function (d) {
    var t = h[d.n] || h[String(d.n)] || null;
    var ds = t ? dis : ' disabled';
    var am = t && t.almuerzo ? Number(t.almuerzoMin) : 60;
    var dl = d.largo.toLowerCase();
    return '<tr data-dia="' + d.n + '"' + (t ? '' : ' class="ml-descanso"') + '><th scope="row"><span class="ml-dia-largo">' + d.largo + '</span><span class="ml-dia-corto" aria-hidden="true">' + d.corto + '</span></th>' +
      '<td data-etq="Pausa 1"><input type="time" id="' + pre + '-p1' + d.n + '" value="' + (t && t.pausa1 ? esc(t.pausa1) : '') + '"' + ds + ' aria-label="Pausa activa 1 del ' + dl + ' (15 min, en la mañana)"></td>' +
      '<td data-etq="Almuerzo"><span class="ml-alm"><input type="time" id="' + pre + '-al' + d.n + '" value="' + (t && t.almuerzo ? esc(t.almuerzo) : '') + '"' + ds + ' aria-label="Hora del almuerzo del ' + dl + '">' +
        '<select id="' + pre + '-am' + d.n + '"' + ds + ' aria-label="Duración del almuerzo del ' + dl + '">' +
        MALLA_ALMUERZO_OPCIONES.map(function (m) { return '<option value="' + m + '"' + (m === am ? ' selected' : '') + '>' + (m === 60 ? '1 h' : m + ' min') + '</option>'; }).join('') + '</select></span></td>' +
      '<td data-etq="Pausa 2"><input type="time" id="' + pre + '-p2' + d.n + '" value="' + (t && t.pausa2 ? esc(t.pausa2) : '') + '"' + ds + ' aria-label="Pausa activa 2 del ' + dl + ' (10 min, en la tarde)"></td>' +
      '<td data-etq="Horas" class="ml-horas-dia" id="' + pre + '-hd' + d.n + '">' + (t ? mallaHorasTexto(mallaMinutosDia(t)) : '—') + '</td></tr>';
  }).join('');
  var s = mallaHorasSemana(h);
  var aviso = mallaAvisoHoras(h);
  return '<details class="ml-pausas" open><summary>Pausas, almuerzo y horas</summary>' +
    '<div class="table-wrap"><table class="ml-tabla ml-tabla-pausas"><thead><tr><th scope="col">Día</th><th scope="col">Pausa activa 1 <span class="ml-dur">15 min</span></th><th scope="col">Almuerzo</th><th scope="col">Pausa activa 2 <span class="ml-dur">10 min</span></th><th scope="col">Horas</th></tr></thead><tbody>' + filas + '</tbody></table></div>' +
    '<p class="ml-horas-semana" id="' + pre + '-hs">Total de la semana: <strong>' + mallaHorasTexto(s.minutos) + '</strong></p>' +
    '<p class="ml-horas-aviso' + (aviso ? '' : ' hidden') + '" id="' + pre + '-ha" role="status">' + esc(aviso) + '</p></details>';
}
// Lee del formulario el horario del grupo (también pausas y almuerzo) sin validar.
function _mlLeerHorario(pre) {
  var h = {}, val = function (id) { var e = _mlEl(id); return e ? e.value : ''; };
  MALLA_DIAS.forEach(function (d) {
    if (!_mlEl(pre + '-t' + d.n).checked) { h[d.n] = null; return; }
    var t = { entrada: val(pre + '-e' + d.n), salida: val(pre + '-s' + d.n) };
    if (val(pre + '-p1' + d.n)) t.pausa1 = val(pre + '-p1' + d.n);
    if (val(pre + '-al' + d.n)) { t.almuerzo = val(pre + '-al' + d.n); t.almuerzoMin = Number(val(pre + '-am' + d.n)) || 60; }
    if (val(pre + '-p2' + d.n)) t.pausa2 = val(pre + '-p2' + d.n);
    h[d.n] = t;
  });
  return h;
}
// Al escribir: horas por día, total y aviso; habilita las pausas solo en los días que se trabaja.
function mallaRecalcularHoras(idx) {
  var pre = 'ml-g' + idx;
  if (!_mlEl(pre + '-hs')) return;
  var h = _mlLeerHorario(pre);
  MALLA_DIAS.forEach(function (d) {
    var t = h[d.n];
    ['-p1', '-al', '-am', '-p2'].forEach(function (k) { var e = _mlEl(pre + k + d.n); if (e) e.disabled = !t; });
    var fila = _mlEl(pre + '-hd' + d.n);
    if (fila) { fila.textContent = t ? mallaHorasTexto(mallaMinutosDia(t)) : '—'; fila.parentNode.classList.toggle('ml-descanso', !t); }
  });
  var s = mallaHorasSemana(h), aviso = mallaAvisoHoras(h);
  _mlEl(pre + '-hs').innerHTML = 'Total de la semana: <strong>' + mallaHorasTexto(s.minutos) + '</strong>';
  var a = _mlEl(pre + '-ha');
  a.textContent = aviso; a.classList.toggle('hidden', !aviso);
}

// Fase M1 (B): aviso con los festivos de la semana. Puro.
function mallaFestivosSemanaTexto(lista) {
  if (!lista || !lista.length) return '';
  return 'Festivo' + (lista.length > 1 ? 's' : '') + ' esta semana: ' + lista.map(function (f) { return _mlDiaTexto(f.fecha) + ' (' + f.nombre + ')'; }).join(' · ') +
    '. Los grupos sin horario de festivo descansan ese día.';
}
function _mlPintar() {
  var d = _ml.datos;
  _mlEl('ml-novedades').classList.add('hidden');
  var fs = _mlEl('ml-festivos'), ftxt = mallaFestivosSemanaTexto(d.festivos);
  if (fs) { fs.textContent = ftxt; fs.classList.toggle('hidden', !ftxt); }
  var fb = _mlEl('ml-festivos-btn');
  if (fb) fb.classList.toggle('hidden', !d.puedeAdministrarFestivos);
  var fa = _mlEl('ml-festivos-admin');
  if (fa && !fa.classList.contains('hidden') && d.puedeAdministrarFestivos) mallaFestivosCargar();
  if (!d.grupos.length) {
    _mlEl('ml-grupos').innerHTML = '<p class="vis-vacio">Esta semana no tiene malla todavía.' + (d.puedeEditar ? ' Crea un grupo o copia otra semana.' : '') + '</p>';
    return;
  }
  _mlEl('ml-grupos').innerHTML = d.grupos.map(function (g, i) { return mallaGrupoHtml(g, d.puedeEditar, d.asesoras, i); }).join('');
  _mlNovedadesSemana();
}

function mallaNuevoGrupo() {
  if (!_ml.datos || !_ml.datos.puedeEditar) return;
  _ml.datos.grupos.push({ id: null, nombre: '', horario: JSON.parse(JSON.stringify(ML_HORARIO_BASE)), asesoras: [] });
  _mlPintar();
  var i = _ml.datos.grupos.length - 1;
  var n = _mlEl('ml-g' + i + '-nombre'); if (n) { n.scrollIntoView({ block: 'center' }); n.focus(); }
}

function _mlLeerGrupo(idx) {
  var pre = 'ml-g' + idx, h = _mlLeerHorario(pre); // pedido de Edwin (24/11): con pausas y almuerzo
  if (_mlEl(pre + '-tf') && _mlEl(pre + '-tf').checked) h.festivo = { entrada: _mlEl(pre + '-ef').value, salida: _mlEl(pre + '-sf').value }; // Fase M1 (B)
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

// ── Fase 373 (Edwin 19/11): novedades por asesora y horario especial de una asesora ──
function _mlDiaTexto(fecha) {
  if (!fecha) return 'Toda la semana';
  var d = MALLA_DIAS.find(function (x) { return mallaFechaDelDia(mallaLunesDe(fecha), x.n) === fecha; });
  return (d ? d.largo + ' ' : '') + fecha.slice(8, 10) + '/' + fecha.slice(5, 7);
}
function _mlFechaHora(iso) { try { return new Date(iso).toLocaleString('es-CO', { timeZone: 'America/Bogota', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } }
// Por asesora del grupo: sus horarios especiales y novedades de la semana, con los botones para agregar.
function mallaCasosHtml(g, idx, puedeEditar, datos) {
  var d = datos || _ml.datos || {};
  var filas = (g.asesoras || []).map(function (a) {
    var aj = (d.ajustes || []).filter(function (x) { return x.asesorId === a.id; });
    var nv = (d.novedades || []).filter(function (x) { return x.asesorId === a.id && !x.quitada; });
    var chips = aj.map(function (x) {
      return '<li class="ml-chip">' + esc(_mlDiaTexto(x.fecha)) + ': ' + esc(mallaTurnoTexto(x.turno)) + (x.serie ? ' <span class="ml-rep">· se repite</span>' : '') + // Fase M1 (C)
        (puedeEditar ? ' <button type="button" class="ml-chip-x" onclick="mallaQuitarAjuste(' + Number(x.id) + ')" aria-label="Quitar el horario especial del ' + esc(_mlDiaTexto(x.fecha)) + ' de ' + esc(a.nombre) + '">×</button>' : '') +
        (puedeEditar && x.serie ? ' <button type="button" class="btn-cancel ml-btn ml-rep-quitar" onclick="mallaQuitarSerie(\'' + esc(x.serie) + '\')" aria-label="Quitar todas las semanas de este horario especial de ' + esc(a.nombre) + '">Quitar todas las semanas</button>' : '') + '</li>';
    }).concat(nv.map(function (x) {
      return '<li class="ml-chip ml-chip-nov">' + esc(_mlDiaTexto(x.fecha)) + ': ' + esc(x.texto) +
        (puedeEditar ? ' <button type="button" class="ml-chip-x" onclick="mallaQuitarNovedad(' + Number(x.id) + ')" aria-label="Quitar la novedad de ' + esc(a.nombre) + '">×</button>' : '') + '</li>';
    })).join('');
    return '<li class="ml-caso"><div class="ml-caso-cab"><strong>' + esc(a.nombre) + '</strong>' +
      // Pedido de Edwin (24/11): botón pequeño «Agregar novedad» por fila.
      (puedeEditar ? '<span class="ml-caso-btns"><button type="button" class="btn-sm ml-btn-sm" onclick="mallaFormCaso(' + idx + ',' + Number(a.id) + ',\'novedad\')" aria-label="Agregar novedad a ' + esc(a.nombre) + '">+ Agregar novedad</button>' +
        '<button type="button" class="btn-sm ml-btn-sm" onclick="mallaFormCaso(' + idx + ',' + Number(a.id) + ',\'horario\')" aria-label="Horario especial de ' + esc(a.nombre) + '">Horario especial</button></span>' : '') + '</div>' +
      (chips ? '<ul class="ml-chips">' + chips + '</ul>' : '') + '<div class="ml-caso-form" id="ml-g' + idx + '-caso-' + Number(a.id) + '"></div></li>';
  }).join('');
  return '<details class="ml-casos"' + (d.ajustes && d.ajustes.length || d.novedades && d.novedades.length ? ' open' : '') + '><summary>Novedades y horarios especiales</summary><ul class="ml-casos-lista">' + filas + '</ul></details>';
}
function mallaFormCaso(idx, asesorId, tipo) {
  document.querySelectorAll('.ml-caso-form').forEach(function (c) { c.innerHTML = ''; });
  var c = _mlEl('ml-g' + idx + '-caso-' + asesorId);
  if (!c) return;
  var pre = 'ml-cf-' + idx + '-' + asesorId;
  if (tipo === 'novedad') {
    c.innerHTML = '<form class="ml-form-caso" onsubmit="mallaGuardarNovedad(event,' + asesorId + ')"><div class="ig"><label for="' + pre + '-dia">Día</label><select id="' + pre + '-dia"><option value="">Toda la semana</option>' +
      MALLA_DIAS.map(function (d) { var f = mallaFechaDelDia(_ml.semana, d.n); return '<option value="' + f + '">' + d.largo + ' ' + f.slice(8, 10) + '/' + f.slice(5, 7) + '</option>'; }).join('') + '</select></div>' +
      '<div class="ig ml-form-texto"><label for="' + pre + '-txt">Novedad</label><input type="text" id="' + pre + '-txt" maxlength="300" placeholder="Ej.: cita médica, entra a las 9:00 el jueves"></div>' +
      '<div class="modal-btns"><button type="submit" class="btn-primary">Guardar novedad</button><button type="button" class="btn-cancel" onclick="this.closest(\'.ml-caso-form\').innerHTML=\'\'">Cancelar</button></div></form>';
  } else {
    c.innerHTML = '<form class="ml-form-caso" onsubmit="mallaGuardarAjuste(event,' + asesorId + ')"><fieldset class="ml-dias"><legend>Días</legend>' +
      MALLA_DIAS.map(function (d) { var f = mallaFechaDelDia(_ml.semana, d.n); return '<label class="ml-asesora"><input type="checkbox" value="' + d.n + '"> ' + d.corto + ' ' + f.slice(8, 10) + '/' + f.slice(5, 7) + '</label>'; }).join('') + '</fieldset>' +
      '<label class="ml-asesora"><input type="checkbox" id="' + pre + '-desc" onchange="mallaDescansoCaso(this)"> Descanso</label>' +
      '<div class="ig"><label for="' + pre + '-e">Entrada</label><input type="time" id="' + pre + '-e" value="09:00"></div>' +
      '<div class="ig"><label for="' + pre + '-s">Salida</label><input type="time" id="' + pre + '-s" value="18:00"></div>' +
      // Fase M1 (C): los mismos días, cada semana, hasta una fecha (máximo 26 semanas).
      '<div class="ig"><label for="' + pre + '-rep">Repetir cada semana hasta (opcional)</label><input type="date" id="' + pre + '-rep" min="' + esc(mallaFechaDelDia(_ml.semana, 7)) + '" max="' + esc(mallaFechaDelDia(mallaSumarSemanas(_ml.semana, 25), 7)) + '" aria-describedby="' + pre + '-rep-ayuda"></div>' +
      '<p class="vis-ayuda ml-rep-ayuda" id="' + pre + '-rep-ayuda">Ej.: estudia y todos los martes entra a las 10:00. Se crea en cada semana hasta esa fecha (máximo 26 semanas); se puede quitar toda la repetición de una vez.</p>' +
      '<div class="modal-btns"><button type="submit" class="btn-primary">Guardar horario especial</button><button type="button" class="btn-cancel" onclick="this.closest(\'.ml-caso-form\').innerHTML=\'\'">Cancelar</button></div></form>';
  }
  var primero = c.querySelector('select, input'); if (primero) primero.focus();
}
function mallaDescansoCaso(chk) {
  chk.closest('form').querySelectorAll('input[type=time]').forEach(function (i) { i.disabled = chk.checked; });
}
async function mallaGuardarNovedad(ev, asesorId) {
  ev.preventDefault();
  _mlError(''); _mlNota('');
  var f = ev.target, dia = f.querySelector('select').value, texto = f.querySelector('input[type=text]').value;
  try {
    await apiRequest('POST', '/malla/novedades', { campana: _ml.campana, semana: _ml.semana, asesorId: asesorId, fecha: dia || null, texto: texto });
    showToast('Novedad guardada', 'ok');
    await mallaCargar();
  } catch (e) { _mlError(e.message || 'No se pudo guardar la novedad'); }
}
async function mallaGuardarAjuste(ev, asesorId) {
  ev.preventDefault();
  _mlError(''); _mlNota('');
  var f = ev.target;
  var dias = Array.prototype.map.call(f.querySelectorAll('.ml-dias input:checked'), function (x) { return Number(x.value); });
  if (!dias.length) { _mlError('Elige uno o más días'); return; }
  var desc = f.querySelector('input[id$="-desc"]').checked;
  var b = { campana: _ml.campana, semana: _ml.semana, asesorId: asesorId, dias: dias, descanso: desc };
  if (!desc) { b.entrada = f.querySelector('input[id$="-e"]').value; b.salida = f.querySelector('input[id$="-s"]').value; }
  var rep = f.querySelector('input[id$="-rep"]'); // Fase M1 (C)
  if (rep && rep.value) b.repetirHasta = rep.value;
  try {
    var r = await apiRequest('PUT', '/malla/ajustes', b);
    showToast('Horario especial guardado', 'ok');
    await mallaCargar();
    if (r && r.serie) _mlNota('Horario especial guardado en ' + r.fechas.length + ' día(s), hasta el ' + _mlDiaTexto(r.fechas[r.fechas.length - 1]) + '.');
  } catch (e) { _mlError(e.message || 'No se pudo guardar el horario especial'); }
}
async function mallaQuitarAjuste(id) {
  if (!window.confirm('¿Quitar este horario especial? Ese día vuelve al horario de su grupo.')) return;
  try { await apiRequest('DELETE', '/malla/ajustes/' + id); showToast('Horario especial quitado', 'ok'); await mallaCargar(); }
  catch (e) { _mlError(e.message || 'No se pudo quitar'); }
}
// Fase M1 (C): quita todos los días de una repetición (también los de otras semanas).
async function mallaQuitarSerie(serie) {
  if (!window.confirm('¿Quitar este horario especial en TODAS las semanas en que se repite? Esos días vuelven al horario de su grupo.')) return;
  try { var r = await apiRequest('DELETE', '/malla/ajustes/serie/' + encodeURIComponent(serie)); showToast('Repetición quitada', 'ok'); await mallaCargar(); _mlNota('Se quitaron ' + r.quitados + ' día(s) del horario especial.'); }
  catch (e) { _mlError(e.message || 'No se pudo quitar'); }
}
async function mallaQuitarNovedad(id) {
  if (!window.confirm('¿Quitar esta novedad? La asesora deja de verla; queda en el historial de la semana.')) return;
  try { await apiRequest('DELETE', '/malla/novedades/' + id); showToast('Novedad quitada', 'ok'); await mallaCargar(); }
  catch (e) { _mlError(e.message || 'No se pudo quitar'); }
}
// Historial de «Novedades de la semana»: todas, también las quitadas (tachadas), con quién y cuándo.
function mallaNovedadesSemanaHtml(lista) {
  var h = '<h4 class="aurora-card-title" id="ml-novedades-tit">Novedades de la semana</h4>';
  if (!lista || !lista.length) return h + '<p class="vis-vacio">Sin novedades esta semana.</p>';
  return h + '<ul class="ml-hist-nov">' + lista.map(function (n) {
    return '<li' + (n.quitada ? ' class="ml-nov-quitada"' : '') + '><strong>' + esc(n.asesorNombre || '') + '</strong> · ' + esc(_mlDiaTexto(n.fecha)) + ': ' +
      (n.quitada ? '<s>' + esc(n.texto) + '</s>' : esc(n.texto)) +
      '<span class="ml-nov-meta">' + esc(n.creadoPor || '') + ' · ' + esc(_mlFechaHora(n.createdAt)) + (n.quitada ? ' · quitada por ' + esc(n.quitada.por) + ' · ' + esc(_mlFechaHora(n.quitada.en)) : '') + '</span></li>';
  }).join('') + '</ul>';
}
function _mlNovedadesSemana() {
  var c = _mlEl('ml-novedades');
  if (!c || !_ml.datos) return;
  c.innerHTML = mallaNovedadesSemanaHtml(_ml.datos.novedades);
  c.classList.remove('hidden');
}
// «Mi malla»: las novedades de la asesora en esa semana.
function mallaMisNovedadesHtml(lista) {
  if (!lista || !lista.length) return '';
  return '<div class="ml-mis-nov"><h5 class="ml-mis-nov-tit">Novedades de la semana</h5><ul>' + lista.map(function (n) {
    return '<li><strong>' + esc(_mlDiaTexto(n.fecha)) + ':</strong> ' + esc(n.texto) + '</li>';
  }).join('') + '</ul></div>';
}

// ── Fase M1 (B): festivos del año (solo el ADMIN agrega o quita; el resto, de ley). ──
function mallaFestivosHtml(r) {
  var filas = (r.festivos || []).map(function (f) {
    var txt = _mlDiaTexto(f.fecha) + '/' + f.fecha.slice(0, 4) + ' · ' + f.nombre + (f.origen === 'manual' ? ' (agregado)' : '');
    return '<li' + (f.quitado ? ' class="ml-fest-quitado"' : '') + '>' + (f.quitado ? '<s>' + esc(txt) + '</s> <span class="ml-otro">(quitado)</span>' : esc(txt)) +
      (r.puedeAdministrar ? (f.quitado
        ? ' <button type="button" class="btn-cancel ml-btn" onclick="mallaFestivoPoner(\'' + esc(f.fecha) + '\')">Volver a poner</button>'
        : ' <button type="button" class="btn-cancel ml-btn" onclick="mallaFestivoQuitar(\'' + esc(f.fecha) + '\')" aria-label="Quitar el festivo del ' + esc(_mlDiaTexto(f.fecha)) + '">Quitar</button>') : '') + '</li>';
  }).join('');
  return '<h4 class="aurora-card-title" id="ml-festivos-tit">Festivos de ' + esc(String(r.anio)) + '</h4>' +
    '<p class="vis-ayuda">Calendario de Colombia (Ley Emiliani). Quitar o agregar un festivo cambia la malla y la puntualidad de todas las campañas.</p>' +
    '<ul class="ml-fest-lista">' + filas + '</ul>' +
    (r.puedeAdministrar ? '<form class="ml-form-caso" onsubmit="mallaFestivoAgregar(event)"><div class="ig"><label for="ml-fest-fecha">Fecha</label><input type="date" id="ml-fest-fecha" required></div>' +
      '<div class="ig ml-form-texto"><label for="ml-fest-nombre">Nombre</label><input type="text" id="ml-fest-nombre" maxlength="60" placeholder="Ej.: Día cívico"></div>' +
      '<div class="modal-btns"><button type="submit" class="btn-primary">Agregar festivo</button></div></form>' : '');
}
async function mallaFestivosCargar() {
  var c = _mlEl('ml-festivos-admin');
  c.innerHTML = '<p class="vis-vacio">Cargando…</p>';
  try { c.innerHTML = mallaFestivosHtml(await apiRequest('GET', '/malla/festivos?anio=' + encodeURIComponent(mallaFechaDelDia(_ml.semana, 4).slice(0, 4)))); }
  catch (e) { c.innerHTML = '<p class="vis-vacio">' + esc(e.message || 'No se pudieron cargar los festivos') + '</p>'; }
}
function mallaFestivosAbrir() {
  var c = _mlEl('ml-festivos-admin'), b = _mlEl('ml-festivos-btn');
  var abrir = c.classList.contains('hidden');
  c.classList.toggle('hidden', !abrir);
  b.setAttribute('aria-expanded', String(abrir));
  if (abrir) mallaFestivosCargar(); else c.innerHTML = '';
}
async function mallaFestivoAgregar(ev) {
  ev.preventDefault();
  _mlError(''); _mlNota('');
  try { await apiRequest('POST', '/malla/festivos', { fecha: _mlEl('ml-fest-fecha').value, nombre: _mlEl('ml-fest-nombre').value }); showToast('Festivo agregado', 'ok'); await mallaCargar(); _mlNota('Festivo agregado.'); }
  catch (e) { _mlError(e.message || 'No se pudo agregar el festivo'); }
}
async function mallaFestivoQuitar(fecha) {
  if (!window.confirm('¿Quitar el festivo del ' + _mlDiaTexto(fecha) + '? Ese día vuelve a ser un día normal en la malla y la puntualidad.')) return;
  try { await apiRequest('DELETE', '/malla/festivos/' + encodeURIComponent(fecha)); showToast('Festivo quitado', 'ok'); await mallaCargar(); }
  catch (e) { _mlError(e.message || 'No se pudo quitar el festivo'); }
}
async function mallaFestivoPoner(fecha) {
  try { await apiRequest('POST', '/malla/festivos', { fecha: fecha }); showToast('Festivo de nuevo', 'ok'); await mallaCargar(); }
  catch (e) { _mlError(e.message || 'No se pudo volver a poner el festivo'); }
}

// ── Portal Asesor: «Mi malla» ──
function mallaMiaHtml(r) {
  if (!r || !r.semanas || !r.semanas.length) return '<p class="vis-vacio">No tienes malla asignada.</p>';
  return r.semanas.map(function (s, i) {
    var titulo = (i === 0 ? 'Esta semana' : 'Semana siguiente') + ' · ' + mallaSemanaTexto(s.semana).replace(/^Semana /, '');
    var nov = mallaMisNovedadesHtml(s.novedades); // Fase 373
    if (!s.turno) return '<section class="aurora-card"><div class="aurora-card-title">' + esc(titulo) + '</div><p class="vis-vacio">Todavía no tienes turno asignado.</p>' + nov + '</section>';
    var esp = s.turno.especiales || [];
    var filas = MALLA_DIAS.map(function (d) {
      var t = s.turno.horario[d.n] || s.turno.horario[String(d.n)] || null;
      var f = mallaFechaDelDia(s.semana, d.n);
      var especial = esp.indexOf(d.n) !== -1 ? ' <span class="vis-pill vis-amarillo ml-especial">Horario especial</span>' : '';
      var fest = s.turno.festivos && (s.turno.festivos[d.n] || s.turno.festivos[String(d.n)]); // Fase M1 (B)
      if (fest) especial = ' <span class="vis-pill vis-gris ml-festivo">Festivo: ' + esc(fest) + '</span>' + especial;
      // Pedido de Edwin (24/11): pausas y almuerzo del día en una línea discreta, solo si el grupo los tiene.
      var pz = mallaPausasTexto(t);
      return '<tr data-fecha="' + esc(f) + '"' + (t ? '' : ' class="ml-descanso"') + '><th scope="row">' + d.largo + ' ' + esc(f.slice(8, 10) + '/' + f.slice(5, 7)) + '</th><td>' + esc(mallaTurnoTexto(t)) + especial +
        (pz ? '<span class="ml-mia-pausas">' + esc(pz) + '</span>' : '') + '</td><td class="ml-punt-celda"></td></tr>'; // Fase 368: celda de puntualidad
    }).join('');
    var hs = mallaHorasSemana(s.turno.horario);
    return '<section class="aurora-card ml-mia ml-color-' + (s.turno.color || 1) + '"><div class="aurora-card-title">' + esc(titulo) + '</div><p class="ml-nota"><span class="ml-punto" aria-hidden="true"></span>Grupo: <strong>' + esc(s.turno.grupo) + '</strong></p>' +
      '<div class="table-wrap"><table class="ml-tabla ml-tabla-mia"><thead><tr><th scope="col">Día</th><th scope="col">Horario</th><th scope="col"><span class="sr-only">Puntualidad</span></th></tr></thead><tbody>' + filas + '</tbody></table></div>' +
      // El total solo con el horario del grupo: un horario especial no trae almuerzo y daría otra cuenta.
      (esp.length ? '' : '<p class="ml-mia-total">Horas de la semana: <strong>' + mallaHorasTexto(hs.minutos) + '</strong></p>') + nov + '</section>';
  }).join('');
}
async function mallaMiaRender() {
  var c = _mlEl('malla-mia');
  if (!c) return;
  c.innerHTML = '<p class="vis-vacio">Cargando…</p>';
  try { c.innerHTML = mallaMiaHtml(await apiRequest('GET', '/malla/mia')); }
  catch (e) { c.innerHTML = '<p class="vis-vacio">' + esc(e.message || 'No se pudo cargar tu malla') + '</p>'; }
  if (typeof mpMiaRender === 'function') mpMiaRender(); // Fase 363: «Mi puntualidad»
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { mallaFestivosHtml: mallaFestivosHtml, mallaFestivosSemanaTexto: mallaFestivosSemanaTexto, mallaMiaHtml: mallaMiaHtml, mallaGrupoHtml: mallaGrupoHtml, mallaPausasTablaHtml: mallaPausasTablaHtml, mallaCasosHtml: mallaCasosHtml, mallaNovedadesSemanaHtml: mallaNovedadesSemanaHtml, mallaMisNovedadesHtml: mallaMisNovedadesHtml };
}
