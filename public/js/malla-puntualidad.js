// malla-puntualidad.js — Fase 363 (Malla fase 2): pestaña «Puntualidad» de la ventana de la malla
// (ADMIN, supervisor de la campaña y Reportes) y «Mi puntualidad» en el Portal Asesor. Datos del
// login de Wolkvox (agent_7); el servidor calcula los estados (server/puntualidad.js) y decide los
// permisos. Todo texto se escapa (esc) o va por textContent.
'use strict';

var _mp = { vista: 'turnos', datos: null, agentes: null, tipos: null };
var MP_DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

function _mpEl(id) { return document.getElementById(id); }
function _mpMin(seg) {
  if (!seg) return '';
  if (seg < 60) return seg + ' s';
  var m = Math.floor(seg / 60), s = seg % 60;
  return m < 60 ? m + ' min' + (s ? ' ' + s + ' s' : '') : Math.floor(m / 60) + ' h ' + (m % 60) + ' min';
}

// Texto y clase de la celda de un día. Puro (se prueba en Node). El texto dice el estado; el color
// solo lo refuerza (WCAG 1.4.1).
function mpEstadoTexto(f, tipos) {
  tipos = tipos || {};
  switch (f.estado) {
    case 'a_tiempo': return { texto: '✓ A tiempo' + (f.primerLogin ? ' · ' + f.primerLogin.slice(0, 5) : ''), clase: 'vis-verde' };
    case 'tarde': return { texto: '! Tarde ' + _mpMin(f.tardeSeg) + (f.primerLogin ? ' · ' + f.primerLogin.slice(0, 5) : ''), clase: 'vis-amarillo' };
    case 'sin_ingreso': return { texto: '✕ Sin ingreso', clase: 'vis-rojo' };
    case 'excepcion': { var t = f.excepcion && (f.excepcion.tipo || f.excepcion); return { texto: tipos[t] || 'Excepción', clase: 'vis-gris' }; }
    case 'sin_enlace': return { texto: 'Sin enlace', clase: 'vis-gris' };
    case 'pendiente': return { texto: 'Pendiente', clase: 'vis-gris' };
    default: return { texto: '—', clase: '' };
  }
}
function mpSalidaTexto(f) { return f.salidaAnticipadaSeg ? 'Salió ' + _mpMin(f.salidaAnticipadaSeg) + ' antes' : ''; }

// Tabla asesora × día de la semana. Puro.
function mpTablaHtml(d) {
  if (!d.filas.length) return '<p class="vis-vacio">Nadie tiene turno esta semana (o la semana no tiene malla).</p>';
  var dias = [];
  for (var i = 0; i < 7; i++) dias.push(mallaFechaDelDia(d.semana, i + 1));
  var porAsesora = {}, orden = [];
  d.filas.forEach(function (f) {
    if (!porAsesora[f.userId]) { porAsesora[f.userId] = { nombre: f.nombre, dias: {} }; orden.push(f.userId); }
    porAsesora[f.userId].dias[f.fecha] = f;
  });
  orden.sort(function (a, b) { return porAsesora[a].nombre.localeCompare(porAsesora[b].nombre); });
  var cab = '<tr><th scope="col">Asesora</th>' + dias.map(function (f, i) { return '<th scope="col">' + MP_DIAS[i] + ' ' + esc(f.slice(8, 10)) + '</th>'; }).join('') + '</tr>';
  var filas = orden.map(function (id) {
    var a = porAsesora[id];
    return '<tr><th scope="row">' + esc(a.nombre) + '</th>' + dias.map(function (fecha) {
      var f = a.dias[fecha];
      if (!f) return '<td class="mp-descanso">—</td>';
      var e = mpEstadoTexto(f, d.tipos), s = mpSalidaTexto(f);
      return '<td><span class="vis-pill ' + e.clase + '">' + esc(e.texto) + '</span>' +
        '<span class="mp-turno">' + esc(f.entrada + '–' + f.salida) + '</span>' + (s ? '<span class="mp-salida">' + esc(s) + '</span>' : '') + '</td>';
    }).join('') + '</tr>';
  }).join('');
  return '<div class="table-wrap"><table class="mp-tabla"><thead>' + cab + '</thead><tbody>' + filas + '</tbody></table></div>';
}

function mpResumenHtml(d) {
  var r = d.resumen || {};
  var p = [['vis-verde', '✓ A tiempo', r.a_tiempo], ['vis-amarillo', '! Tarde', r.tarde], ['vis-rojo', '✕ Sin ingreso', r.sin_ingreso],
    ['vis-gris', 'Excepción', r.excepcion], ['vis-gris', 'Sin enlace', r.sin_enlace], ['vis-gris', 'Pendiente', r.pendiente]];
  return '<div class="vis-resumen">' + p.map(function (x) { return '<span class="vis-pill ' + x[0] + '">' + x[1] + ': ' + (x[2] || 0) + '</span>'; }).join('') +
    (r.excepcionTrabajada ? '<span class="vis-pill vis-gris">Excepciones que cuentan como día trabajado: ' + r.excepcionTrabajada + '</span>' : '') + // Fase M1 (A)
    '<span class="vis-pill vis-gris">Salida anticipada: ' + (r.salidaAnticipada || 0) + '</span></div>' +
    '<p class="vis-ayuda">' + (d.datosHasta ? 'Login de Wolkvox hasta el ' + esc(d.datosHasta.slice(8, 10) + '/' + d.datosHasta.slice(5, 7) + ' ' + d.datosHasta.slice(11, 16)) + '. ' : 'Todavía no hay datos de login de Wolkvox. ') +
    'Tolerancia cero: 1 segundo después de la hora de entrada ya es «Tarde». Cuenta el primer login del día; la salida anticipada es un dato aparte.</p>';
}

// ── Pestañas de la ventana ──
function mpTrasCargar() {
  var c = (_ml.campanas || []).find(function (x) { return x.nombre === _ml.campana; });
  var hay = !!(c && c.puntualidad);
  _mpEl('ml-vistas').classList.toggle('hidden', !hay);
  if (!hay) _mp.vista = 'turnos';
  mpMostrar(_mp.vista, true);
}
function mpMostrar(vista, sinFoco) {
  _mp.vista = vista;
  var punt = vista === 'puntualidad';
  _mpEl('ml-vista-turnos').setAttribute('aria-pressed', String(!punt));
  _mpEl('ml-vista-punt').setAttribute('aria-pressed', String(punt));
  _mpEl('ml-grupos').classList.toggle('hidden', punt);
  if (punt) _mpEl('ml-acciones').classList.add('hidden');
  else if (_ml.datos) _mpEl('ml-acciones').classList.toggle('hidden', !_ml.datos.puedeEditar);
  _mpEl('ml-puntualidad').classList.toggle('hidden', !punt);
  if (punt) mpCargar();
  if (!sinFoco) _mpEl(punt ? 'ml-vista-punt' : 'ml-vista-turnos').focus();
}

async function mpCargar() {
  var c = _mpEl('ml-puntualidad');
  c.innerHTML = '<p class="vis-vacio">Cargando…</p>';
  try {
    _mp.datos = await apiRequest('GET', '/malla/puntualidad?campana=' + encodeURIComponent(_ml.campana) + '&semana=' + encodeURIComponent(_ml.semana));
  } catch (e) { c.innerHTML = '<p class="vis-vacio">' + esc(e.message || 'No se pudo cargar la puntualidad') + '</p>'; return; }
  var d = _mp.datos;
  var html = mpResumenHtml(d) + mpTablaHtml(d);
  if (d.puedeEditar) {
    html += mpExcepcionesHtml(d);
    if (d.puedeAdministrarTipos) html += '<div class="modal-btns"><button type="button" class="btn-cancel" id="mp-tipos-btn" aria-expanded="false" aria-controls="mp-tipos" onclick="mpTiposAbrir()">Tipos de excepción</button></div><div id="mp-tipos"></div>'; // Fase M1 (A)
    if ((d.agentesSinEnlace || []).length) html += '<p class="vis-ayuda">' + d.agentesSinEnlace.length + ' agente(s) de Wolkvox con login esta semana no están enlazados a una asesora.</p>';
    html += '<div class="modal-btns"><button type="button" class="btn-cancel" id="mp-agentes-btn" onclick="mpAgentesAbrir()">Enlazar agentes de Wolkvox</button></div><div id="mp-agentes"></div>';
  }
  c.innerHTML = html;
}

// ── Excepciones ──
function mpExcepcionesHtml(d) {
  var ases = {}, lista = [];
  d.filas.forEach(function (f) { if (!ases[f.userId]) { ases[f.userId] = f.nombre; lista.push({ id: f.userId, nombre: f.nombre }); } });
  lista.sort(function (a, b) { return a.nombre.localeCompare(b.nombre); });
  // Fase M1 (A): el formulario ofrece los tipos ACTIVOS; la lista de abajo nombra también los inactivos.
  var tipos = (d.tiposActivos || Object.keys(d.tipos || {}).map(function (c) { return { codigo: c, nombre: d.tipos[c] }; }));
  var actuales = (d.excepciones || []).map(function (e) {
    return '<li>' + esc((e.nombre || '-') + ' · ' + (d.tipos[e.tipo] || e.tipo) + ' · ' + e.desde + (e.hasta !== e.desde ? ' a ' + e.hasta : '')) +
      ' <button type="button" class="btn-cancel mp-quitar" onclick="mpQuitarExcepcion(' + Number(e.id) + ')">Quitar</button></li>';
  }).join('');
  return '<section class="aurora-card mp-exc" aria-labelledby="mp-exc-tit"><div class="aurora-card-title" id="mp-exc-tit">Excepciones (incapacidad, vacaciones, licencias y otras)</div>' +
    (lista.length ? '<div class="mp-exc-form">' +
      '<div class="ig"><label for="mp-exc-asesora">Asesora</label><select id="mp-exc-asesora">' + lista.map(function (a) { return '<option value="' + a.id + '">' + esc(a.nombre) + '</option>'; }).join('') + '</select></div>' +
      '<div class="ig"><label for="mp-exc-tipo">Tipo</label><select id="mp-exc-tipo">' + tipos.map(function (t) { return '<option value="' + esc(t.codigo) + '">' + esc(t.nombre) + '</option>'; }).join('') + '</select></div>' +
      '<div class="ig"><label for="mp-exc-desde">Desde</label><input type="date" id="mp-exc-desde" value="' + esc(d.semana) + '"></div>' +
      '<div class="ig"><label for="mp-exc-hasta">Hasta (opcional)</label><input type="date" id="mp-exc-hasta"></div>' +
      '<button type="button" class="btn-primary" onclick="mpAgregarExcepcion()">Agregar excepción</button></div>' : '<p class="vis-vacio">Nadie tiene turno esta semana.</p>') +
    (actuales ? '<ul class="mp-exc-lista">' + actuales + '</ul>' : '<p class="vis-ayuda">Sin excepciones esta semana.</p>') + '</section>';
}
async function mpAgregarExcepcion() {
  _mlError(''); _mlNota('');
  var b = { campana: _ml.campana, userId: Number(_mpEl('mp-exc-asesora').value), tipo: _mpEl('mp-exc-tipo').value, desde: _mpEl('mp-exc-desde').value, hasta: _mpEl('mp-exc-hasta').value || undefined };
  try { await apiRequest('POST', '/malla/excepciones', b); showToast('Excepción guardada', 'ok'); await mpCargar(); _mlNota('Excepción guardada.'); }
  catch (e) { _mlError(e.message || 'No se pudo guardar la excepción'); }
}
async function mpQuitarExcepcion(id) {
  if (!window.confirm('¿Quitar esta excepción?')) return;
  try { await apiRequest('DELETE', '/malla/excepciones/' + id); showToast('Excepción quitada', 'ok'); await mpCargar(); }
  catch (e) { _mlError(e.message || 'No se pudo quitar'); }
}

// ── Fase M1 (A): tipos de excepción (solo el ADMIN los cambia). Un tipo no se borra: se desactiva. ──
// Tabla de tipos con su formulario. Puro (se prueba en Node).
function mpTiposHtml(r) {
  var filas = (r.tipos || []).map(function (t, i) {
    return '<tr' + (t.activo ? '' : ' class="mp-tipo-inactivo"') + '><td><label class="sr-only" for="mp-tipo-n-' + i + '">Nombre del tipo</label>' +
      '<input type="text" id="mp-tipo-n-' + i + '" maxlength="50" value="' + esc(t.nombre) + '" data-codigo="' + esc(t.codigo) + '"></td>' +
      '<td><label class="mp-check"><input type="checkbox" id="mp-tipo-t-' + i + '"' + (t.cuentaTrabajado ? ' checked' : '') + '> Cuenta como día trabajado</label></td>' +
      '<td><label class="mp-check"><input type="checkbox" id="mp-tipo-a-' + i + '"' + (t.activo ? ' checked' : '') + '> Activo</label></td>' +
      '<td><button type="button" class="btn-cancel" onclick="mpTipoGuardar(' + i + ')">Guardar</button></td></tr>';
  }).join('');
  return '<section class="aurora-card mp-tipos" aria-labelledby="mp-tipos-tit"><div class="aurora-card-title" id="mp-tipos-tit">Tipos de excepción</div>' +
    '<p class="vis-ayuda">Un tipo no se borra: se desactiva, y las excepciones que ya lo usan conservan su nombre. «Cuenta como día trabajado» lo suma aparte en el resumen (por ejemplo, una capacitación).</p>' +
    '<div class="table-wrap"><table class="vis-tabla"><thead><tr><th scope="col">Nombre</th><th scope="col">Día trabajado</th><th scope="col">Estado</th><th scope="col"><span class="sr-only">Acción</span></th></tr></thead><tbody>' + filas + '</tbody></table></div>' +
    '<div class="mp-exc-form"><div class="ig"><label for="mp-tipo-nuevo">Tipo nuevo</label><input type="text" id="mp-tipo-nuevo" maxlength="50" placeholder="Ej.: Licencia de luto"></div>' +
    '<label class="mp-check"><input type="checkbox" id="mp-tipo-nuevo-t"> Cuenta como día trabajado</label>' +
    '<button type="button" class="btn-primary" onclick="mpTipoCrear()">Agregar tipo</button></div></section>';
}
async function mpTiposAbrir() {
  var c = _mpEl('mp-tipos'), b = _mpEl('mp-tipos-btn');
  if (c.innerHTML && b && b.getAttribute('aria-expanded') === 'true') { c.innerHTML = ''; b.setAttribute('aria-expanded', 'false'); return; }
  c.innerHTML = '<p class="vis-vacio">Cargando…</p>';
  try { _mp.tipos = await apiRequest('GET', '/malla/tipos-excepcion'); c.innerHTML = mpTiposHtml(_mp.tipos); if (b) b.setAttribute('aria-expanded', 'true'); }
  catch (e) { c.innerHTML = '<p class="vis-vacio">' + esc(e.message || 'No se pudieron cargar los tipos') + '</p>'; }
}
async function _mpTiposRecargar() { await mpCargar(); await mpTiposAbrir(); }
async function mpTipoGuardar(i) {
  _mlError(''); _mlNota('');
  var n = _mpEl('mp-tipo-n-' + i);
  var b = { nombre: n.value, cuentaTrabajado: _mpEl('mp-tipo-t-' + i).checked, activo: _mpEl('mp-tipo-a-' + i).checked };
  try { await apiRequest('PUT', '/malla/tipos-excepcion/' + encodeURIComponent(n.getAttribute('data-codigo')), b); showToast('Tipo guardado', 'ok'); await _mpTiposRecargar(); _mlNota('Tipo de excepción guardado.'); }
  catch (e) { _mlError(e.message || 'No se pudo guardar el tipo'); }
}
async function mpTipoCrear() {
  _mlError(''); _mlNota('');
  var b = { nombre: _mpEl('mp-tipo-nuevo').value, cuentaTrabajado: _mpEl('mp-tipo-nuevo-t').checked };
  try { await apiRequest('POST', '/malla/tipos-excepcion', b); showToast('Tipo agregado', 'ok'); await _mpTiposRecargar(); _mlNota('Tipo de excepción agregado.'); }
  catch (e) { _mlError(e.message || 'No se pudo agregar el tipo'); }
}

// ── Enlazar agentes de Wolkvox con asesoras ──
function mpAgentesHtml(r) {
  if (!r.agentes.length) return '<p class="vis-vacio">Todavía no hay agentes de Wolkvox (no hay datos de login).</p>';
  var opts = function (sel) {
    return '<option value="">Sin enlazar</option>' + r.asesoras.map(function (a) { return '<option value="' + a.id + '"' + (a.id === sel ? ' selected' : '') + '>' + esc(a.nombre) + '</option>'; }).join('');
  };
  return '<div class="table-wrap"><table class="vis-tabla"><thead><tr><th scope="col">Agente de Wolkvox</th><th scope="col">Asesora</th><th scope="col"><span class="sr-only">Acción</span></th></tr></thead><tbody>' +
    r.agentes.map(function (a, i) {
      var sel = a.userId !== null ? a.userId : a.sugerencia;
      return '<tr><td>' + esc(a.agentName || '(sin nombre)') + ' <span class="ml-otro">(' + esc(a.agentId) + ')</span></td>' +
        '<td><label class="sr-only" for="mp-ag-' + i + '">Asesora para ' + esc(a.agentName || a.agentId) + '</label><select id="mp-ag-' + i + '" data-agente="' + esc(a.agentId) + '">' + opts(sel) + '</select>' +
        (a.userId === null && a.sugerencia ? ' <span class="ml-otro">sugerida (mismo nombre)</span>' : '') + '</td>' +
        '<td><button type="button" class="btn-cancel" onclick="mpGuardarEnlace(' + i + ')">Guardar</button></td></tr>';
    }).join('') + '</tbody></table></div>';
}
async function mpAgentesAbrir() {
  var c = _mpEl('mp-agentes');
  c.innerHTML = '<p class="vis-vacio">Cargando…</p>';
  try { _mp.agentes = await apiRequest('GET', '/malla/agentes?campana=' + encodeURIComponent(_ml.campana)); c.innerHTML = mpAgentesHtml(_mp.agentes); }
  catch (e) { c.innerHTML = '<p class="vis-vacio">' + esc(e.message || 'No se pudieron cargar los agentes') + '</p>'; }
}
async function mpGuardarEnlace(i) {
  _mlError(''); _mlNota('');
  var s = _mpEl('mp-ag-' + i), v = s.value;
  try {
    await apiRequest('PUT', '/malla/agentes/' + encodeURIComponent(s.getAttribute('data-agente')), { campana: _ml.campana, userId: v ? Number(v) : null });
    showToast('Enlace guardado', 'ok'); _mlNota('Enlace guardado.');
    await mpCargar(); await mpAgentesAbrir();
  } catch (e) { _mlError(e.message || 'No se pudo guardar el enlace'); }
}

// ── Portal Asesor: «Mi puntualidad» (solo lo suyo) ──
function mpMiaHtml(r) {
  if (!r || !r.semanas || !r.semanas.length) return '';
  return '<div class="page-title mp-mia-tit">Mi puntualidad</div>' + r.semanas.map(function (s) {
    var titulo = mallaSemanaTexto(s.semana);
    if (!s.filas.length) return '<section class="aurora-card"><div class="aurora-card-title">' + esc(titulo) + '</div><p class="vis-vacio">Sin turnos esta semana.</p></section>';
    var filas = s.filas.map(function (f) {
      var e = mpMiaDia(f, r.tipos); // Fase 368: los mismos textos que en «Mi malla»
      if (!e) return '';
      return '<tr class="' + e.fila + '"><th scope="row">' + esc(f.fecha.slice(8, 10) + '/' + f.fecha.slice(5, 7)) + '</th><td>' + esc(f.entrada + '–' + f.salida) + '</td><td><span class="vis-pill ' + e.clase + '">' + esc(e.texto) + '</span></td></tr>';
    }).join('');
    return '<section class="aurora-card"><div class="aurora-card-title">' + esc(titulo) + '</div><div class="table-wrap"><table class="ml-tabla"><thead><tr><th scope="col">Día</th><th scope="col">Turno</th><th scope="col">Entrada</th></tr></thead><tbody>' + filas + '</tbody></table></div></section>';
  }).join('');
}
// Fase 368 (pedido de Edwin 18/11, D3): lo que ve la asesora en «Mi malla»: el día en verde con
// «Puntual» o en rojo con «Llegaste tarde» (y «Sin ingreso» en rojo). Puro.
function mpMiaDia(f, tipos) {
  switch (f.estado) {
    case 'a_tiempo': return { texto: '✓ Puntual', clase: 'vis-verde', fila: 'ml-dia-puntual' };
    case 'tarde': return { texto: '✕ Llegaste tarde' + (f.tardeSeg ? ' (' + _mpMin(f.tardeSeg) + ')' : ''), clase: 'vis-rojo', fila: 'ml-dia-tarde' };
    case 'sin_ingreso': return { texto: '✕ Sin ingreso', clase: 'vis-rojo', fila: 'ml-dia-tarde' };
    case 'excepcion': return { texto: (tipos || {})[f.excepcion] || 'Excepción', clase: 'vis-gris', fila: '' };
    default: return null; // pendiente o sin enlace: no se muestra nada a la asesora
  }
}
async function mpMiaRender() {
  var c = _mpEl('malla-mia-punt');
  if (!c) return;
  var r;
  try { r = await apiRequest('GET', '/malla/mi-puntualidad'); } catch (e) { c.innerHTML = ''; return; }
  // Esta semana: en la misma tabla de «Mi malla». La semana anterior: abajo, aparte.
  var usadas = {};
  ((r && r.semanas) || []).forEach(function (s) {
    s.filas.forEach(function (f) {
      var tr = document.querySelector('#malla-mia tr[data-fecha="' + f.fecha + '"]');
      var d = mpMiaDia(f, r.tipos);
      if (!tr || !d) return;
      usadas[f.fecha] = true;
      if (d.fila) tr.classList.add(d.fila);
      var celda = tr.querySelector('.ml-punt-celda');
      if (celda) { celda.textContent = ''; var sp = document.createElement('span'); sp.className = 'vis-pill ' + d.clase; sp.textContent = d.texto; celda.appendChild(sp); }
    });
  });
  var resto = { semanas: ((r && r.semanas) || []).map(function (s) { return { semana: s.semana, filas: s.filas.filter(function (f) { return !usadas[f.fecha]; }) }; }).filter(function (s) { return s.filas.some(function (f) { return mpMiaDia(f, r.tipos); }); }), tipos: r && r.tipos };
  c.innerHTML = mpMiaHtml(resto);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { mpEstadoTexto: mpEstadoTexto, mpSalidaTexto: mpSalidaTexto, mpTablaHtml: mpTablaHtml, mpResumenHtml: mpResumenHtml, mpMiaHtml: mpMiaHtml, mpMiaDia: mpMiaDia, mpAgentesHtml: mpAgentesHtml, mpTiposHtml: mpTiposHtml };
}
