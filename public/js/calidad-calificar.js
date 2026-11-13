// calidad-calificar.js — Fase 254 (plan de Calidad B3). Formulario "Calificar"
// para las plantillas nuevas (las que traen sus campos), igual al HTML de
// Edwin: datos de la llamada, items por categoria con SI / NO / N/A,
// "Ver criterio", calificacion definitiva en vivo, motivo automatico,
// "Sugerir observacion" y aviso "Faltan items por calificar". Las plantillas
// de siempre (ORLANT, la generica) siguen con el formulario de antes.
// El servidor vuelve a calcular y a validar todo al guardar.
var _cc2 = { answers: {}, editId: null, plantilla: null };
// Fase 322: campos que van en `extras` (lista cerrada del servidor, calidad-campos.js).
var CC2_EXTRAS = ['placa', 'tipoLlamada', 'idAgente', 'idContacto', 'tipificacionSistema', 'estrategia', 'causa', 'motivoTexto', 'cedula'];

// Plantilla que usa el formulario: la elegida o, sin elegir, la principal
// usable (o la primera usable) de la campaña.
function cc2PlantillaActual(camp) {
  var p = (typeof _calPlantillaDe === 'function') ? _calPlantillaDe(camp) : null;
  if (p) return p;
  var us = calPlantillasUsables(camp);
  return us.find(function (x) { return x.principal; }) || us[0] || null;
}

// Fase 340: el UNICO formulario «Calificar» (el viejo se retiro). true = lo dibujo con una plantilla.
// Sin una plantilla que este usuario pueda usar en la campaña, un aviso claro (nunca otro formulario).
function cc2Sync() {
  var nuevo = document.getElementById('cf2');
  if (!nuevo) return false;
  nuevo.hidden = false;
  var p = cc2PlantillaActual(_ccampana);
  if (!p) {
    _cc2.plantilla = null;
    nuevo.innerHTML = '<div class="aurora-card"><p class="ca-vacio">' + esc(cc2AvisoSinPlantilla(_ccampana)) + '</p></div>';
    return false;
  }
  if (!_cc2.plantilla || _cc2.plantilla.id !== p.id) { _cc2.answers = {}; if (!_cc2.editId) _cc2.editId = null; }
  _cc2.plantilla = p;
  cc2Render();
  return true;
}

// Fase 340: por que no hay formulario (antes se caia al formulario viejo con la plantilla principal).
function cc2AvisoSinPlantilla(camp) {
  var todas = (typeof CAL_PLANTILLAS_TODAS !== 'undefined' ? CAL_PLANTILLAS_TODAS : []).filter(function (p) { return p.campana === camp && p.activo !== false; });
  if (!todas.length) return 'Esta campaña todavía no tiene una plantilla de Calidad. El administrador la importa en Calidad › Plantillas.';
  var principal = todas.find(function (p) { return p.principal; }) || todas[0];
  // Fase 342: la principal se habilita sola a quien califica la campaña; si sale esto, falta el acceso a la campaña.
  return 'Tu usuario no tiene habilitada la plantilla «' + (principal.nombre || camp) + '» para calificar en ' + camp + '. Pídele al administrador que revise tu acceso a la campaña en Usuarios.';
}
// Fase 340: lleva al panel Calificar sin pasar por la regla de pestañas (Reportes edita sin poder calificar).
function cc2MostrarPanel() {
  _ctab = 'nuevo';
  document.querySelectorAll('#calidad-modal .atab').forEach(function (el) { el.classList.toggle('atab-active', el.dataset.ctab === 'nuevo'); });
  document.querySelectorAll('#calidad-modal .atab-panel').forEach(function (el) { el.classList.toggle('visible', el.id === 'cpanel-nuevo'); });
}

function _cc2Asesores() {
  return (typeof users !== 'undefined' ? users : []).filter(function (u) { return u.rol === 'ASESOR' && u.asesorCampana === _ccampana && u.active; })
    .sort(function (a, b) { return a.nombre.localeCompare(b.nombre); });
}

function _cc2Campo(c) {
  var id = 'cc2-f-' + c.k;
  var req = (c.k === 'asesor' || c.k === 'fecha' || c.k === 'observaciones') ? ' *' : '';
  var lbl = '<span class="cc2-lt">' + esc(c.etiqueta) + req + '</span>';
  if (c.k === 'asesor') {
    // Fase 270 (pedido de Edwin, 05/11): lista desplegable con los usuarios
    // ASESOR activos de la campaña (ya no texto libre), como el formulario de
    // siempre (populateCalAsesorSelect): el nombre queda EXACTO y enlazado a
    // su usuario (asesorUserId), asi le llega a "Mis resultados".
    var ases = _cc2Asesores();
    if (!ases.length) {
      return '<label class="cc2-f">' + lbl + '<select id="' + id + '" disabled><option value="">—</option></select>' +
        '<small class="cc2-hint">Esta campaña no tiene usuarios ASESOR. Créalos en Usuarios (rol ASESOR, con esta campaña) para poder calificarlos.</small></label>';
    }
    return '<label class="cc2-f">' + lbl + '<select id="' + id + '" required onchange="_cc2AsesorElegido()"><option value="">Selecciona un asesor…</option>' +
      ases.map(function (u) { return '<option value="' + esc(u.nombre) + '" data-user-id="' + esc(u.id) + '">' + esc(textoFormatoNombre(u.nombre)) + '</option>'; }).join('') +
      '</select><small class="cc2-hint" id="cc2-asesor-info" hidden></small></label>';
  }
  // Fase 337: «Fecha del monitoreo» editable para quien califica: hoy por defecto, fechas pasadas
  // si, futuras no (el servidor vuelve a revisarlo).
  if (c.k === 'fecha') return '<label class="cc2-f"><span class="cc2-lt">Fecha del monitoreo *</span><input type="date" id="' + id + '" value="' + esc(calFechaHoyLocal()) + '" max="' + esc(calFechaHoyLocal()) + '" min="2020-01-01" required></label>';
  if (c.k === 'evaluador') return '<label class="cc2-f">' + lbl + '<input type="text" id="' + id + '" value="' + esc(currentUser ? currentUser.nombre : 'Administrador') + '" disabled></label>';
  // Fase 318: canal auditado del formulario de siempre de ORLANT (se guarda en `canal`).
  if (c.k === 'canal') return '<label class="cc2-f">' + lbl + '<select id="' + id + '"><option value="LLAMADA">Llamada</option><option value="WPP">WhatsApp / Chat</option></select></label>';
  if (c.k === 'tipoLlamada') return '<label class="cc2-f">' + lbl + '<select id="' + id + '"><option value="">Selecciona…</option><option>Entrada</option><option>Salida</option></select></label>';
  if (c.k === 'codificacion') {
    var activas = calCodificacionesActivas(_ccampana);
    if (activas.length) return '<label class="cc2-f">' + lbl + '<select id="' + id + '"><option value="">Selecciona…</option>' + activas.map(function (v) { return '<option value="' + esc(v) + '">' + esc(v) + '</option>'; }).join('') + '</select></label>';
    return '<label class="cc2-f">' + lbl + '<input type="text" id="' + id + '" maxlength="200" placeholder="Escribe el código" spellcheck="false"></label>';
  }
  if (c.k === 'motivo') return '<label class="cc2-f cc2-wide">' + '<span class="cc2-lt">' + esc(c.etiqueta) + ' (automático)</span><input type="text" id="' + id + '" readonly></label>';
  // Fase 322 (SURA): cedula del cliente (se guarda enmascarada) y textos libres.
  if (c.k === 'cedula') return '<label class="cc2-f">' + lbl + '<input type="text" id="' + id + '" inputmode="numeric" maxlength="20" autocomplete="off" spellcheck="false"><small class="cc2-hint">Se guarda solo con los últimos 4 dígitos.</small></label>';
  // Fase 352: textos largos (retroalimentacion) hasta CC2_TEXTO_LARGO_MAX, casilla alta que se agranda, con contador.
  if (c.k === 'motivoTexto' || c.k === 'estrategia' || c.k === 'causa') return _cc2TextoLargo(id, lbl, 4);
  if (c.k === 'observaciones') return _cc2TextoLargo(id, lbl, 6);
  var extra = c.k === 'placa' ? ' maxlength="20" autocapitalize="characters" spellcheck="false"' : (c.k === 'telefono' ? ' inputmode="tel" maxlength="40"' : ' maxlength="60"');
  return '<label class="cc2-f">' + lbl + '<input type="text" id="' + id + '"' + extra + '></label>';
}

// Fase 352 (reunion con Edwin del 13/11): mismo tope que el servidor (calidad-campos.js).
var CC2_TEXTO_LARGO_MAX = 2000;
function _cc2TextoLargo(id, lbl, filas) {
  return '<label class="cc2-f cc2-wide">' + lbl + '<textarea id="' + id + '" class="cc2-largo" maxlength="' + CC2_TEXTO_LARGO_MAX + '" rows="' + filas + '" data-cc2-max="' + CC2_TEXTO_LARGO_MAX + '" aria-describedby="' + id + '-cont"></textarea>' +
    '<small class="cc2-cont" id="' + id + '-cont">0 / ' + CC2_TEXTO_LARGO_MAX.toLocaleString('es-CO') + ' caracteres</small></label>';
}
// Texto del contador; al acercarse al tope (90 %), la clase cc2-cont-cerca.
function cc2ContadorTexto(n, max) { return Number(n || 0).toLocaleString('es-CO') + ' / ' + Number(max).toLocaleString('es-CO') + ' caracteres'; }
function cc2ActualizarContador(el) {
  if (!el || !el.getAttribute) return;
  var max = Number(el.getAttribute('data-cc2-max')) || CC2_TEXTO_LARGO_MAX;
  var c = document.getElementById(el.id + '-cont'); if (!c) return;
  var n = String(el.value || '').length;
  c.textContent = cc2ContadorTexto(n, max);
  c.classList.toggle('cc2-cont-cerca', n >= max * 0.9);
}
function cc2ActualizarContadores() { Array.prototype.forEach.call(document.querySelectorAll('textarea[data-cc2-max]'), cc2ActualizarContador); }
if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  document.addEventListener('input', function (e) { if (e.target && e.target.matches && e.target.matches('textarea[data-cc2-max]')) cc2ActualizarContador(e.target); });
}

function _cc2Eng() { return _cc2.plantilla ? _cc2.plantilla.engine : 'standard'; }
function _cc2Seg(it) {
  // Fase 322: los botones salen de cc2Opciones (SI/NO/N/A, o las opciones del item en el
  // motor descuento). Clase de color: SI verde, NO rojo, N/A gris, opcion parcial ambar.
  var cls = function (v) { return v === 'SI' ? 'y' : v === 'NO' ? 'n' : v === 'N/A' ? 'x' : 'o'; };
  return '<div class="cc2-seg' + (it.opciones && it.opciones.length ? ' cc2-seg-op' : '') + '" role="group" aria-label="' + esc(it.n + '. ' + it.label) + '">' + cc2Opciones(it, _cc2Eng()).map(function (o) {
    return '<button type="button" class="cc2-' + cls(o.v) + '" data-n="' + esc(it.n) + '" data-v="' + esc(o.v) + '" aria-pressed="false">' + esc(o.t) + '</button>';
  }).join('') + '</div>';
}

// Fase 328: un item con mas de dos opciones propias (SURA: «Saludo y despedida», «Manejo de
// objeciones») se apila: texto arriba a todo el ancho, botones debajo en cuadricula. Los SI/NO
// (y SI/NO/N/A de ORLANT, Mobilize, Aurora y HLM) siguen con los botones a la derecha.
function cc2ItemApilado(it) { return !!(it && it.opciones && it.opciones.length > 2); }
// Fase 328: el numero y el «%» nunca quedan en lineas distintas (espacio duro U+00A0).
function cc2PctJunto(t) { return String(t).replace(/(\d) %/g, '$1\u00a0%'); }

function cc2Render() {
  var p = _cc2.plantilla;
  var b = cc2Bloques(cc2CamposDe(p));
  var itemsHtml = cc2PorCategoria(p.items).map(function (g) {
    return '<div class="cc2-cat">' + esc(g.cat) + '</div>' + g.items.map(function (it) {
      return '<div class="cc2-item' + (cc2ItemApilado(it) ? ' cc2-item-op' : '') + '" data-item="' + esc(it.n) + '"><span class="cc2-num">' + esc(it.n) + '</span>' +
        '<div class="cc2-iname"><b>' + esc(it.label) + '</b><small>' + esc(cc2PctJunto(cc2SubItem(it, _cc2Eng()))) +
        (it.descripcion || (it.vinetas && it.vinetas.length) ? ' · <button type="button" class="cc2-qbtn" onclick="cc2VerCriterio(' + Number(it.n) + ')">Ver criterio</button>' : '') +
        '</small></div>' + _cc2Seg(it) + '</div>';
    }).join('');
  }).join('');
  document.getElementById('cf2').innerHTML =
    '<div class="cc2-grid">' +
      '<div class="aurora-card cc2-form">' +
        calPlantillaSelectorHtml(_ccampana, !!_cc2.editId) +
        '<section class="cc2-sec"><div class="cc2-sec-h"><h3>Información general</h3><span class="cc2-tag">Datos de la llamada</span></div>' +
          '<div class="cc2-fields">' + b.generales.map(_cc2Campo).join('') + '</div></section>' +
        '<section class="cc2-sec"><div class="cc2-sec-h"><h3>Ítems de la plantilla</h3><span class="cc2-tag">' + (cc2EsDescuento(_cc2Eng()) ? '⚠ Crítico en NO: nota 0\u00a0% · sin N/A' : '⚠ Crítico: NO resta 20 pts · N/A = no aplica') + '</span></div>' +
          '<div class="cc2-items" id="cc2-items">' + itemsHtml + '</div></section>' +
        '<section class="cc2-sec"><div class="cc2-sec-h"><h3>Detalles adicionales</h3></div>' +
          '<div class="cc2-fields">' + b.detalle.map(_cc2Campo).join('') + '</div>' +
          (b.detalle.some(function (c) { return c.k === 'observaciones'; }) ? '<button type="button" class="btn-cancel cc2-sugerir" onclick="cc2Sugerir()">Sugerir observación</button>' : '') +
        '</section>' +
      '</div>' +
      '<aside class="aurora-card cc2-score" aria-live="polite">' +
        '<span class="cc2-tag">Calificación definitiva</span>' +
        '<div class="cc2-big" id="cc2-big">—</div>' +
        '<div><span class="cc2-pill cc2-na" id="cc2-pill">Sin calificar</span></div>' +
        '<div class="cc2-prog" id="cc2-prog"></div>' +
        '<div class="cc2-ded" id="cc2-ded" hidden></div>' +
        '<div class="cc2-editando" id="cc2-editando"' + (_cc2.editId ? '' : ' hidden') + '>Editando un monitoreo guardado</div>' +
        '<div class="cc2-actions"><button type="button" class="btn-primary" id="cc2-guardar" onclick="cc2Guardar()">' + (_cc2.editId ? 'Actualizar monitoreo' : 'Guardar monitoreo') + '</button>' +
          '<button type="button" class="btn-cancel" onclick="cc2Limpiar()">Limpiar</button></div>' +
        '<p class="cc2-note">Para guardar debes calificar los <b>' + p.items.length + ' ítems</b>' + (b.detalle.some(function (c) { return c.k === 'observaciones'; }) ? ' y escribir las observaciones' : '') + '.</p>' +
      '</aside>' +
    '</div>';
  cc2Pintar();
}

document.addEventListener('click', function (e) {
  var btn = e.target.closest && e.target.closest('#cf2 .cc2-seg button');
  if (!btn) return;
  var n = btn.dataset.n, v = btn.dataset.v;
  _cc2.answers[n] = _cc2.answers[n] === v ? undefined : v;
  if (!_cc2.answers[n]) delete _cc2.answers[n];
  var fila = btn.closest('.cc2-item'); if (fila) fila.classList.remove('cc2-missing');
  cc2Pintar();
});

function cc2Pintar() {
  var p = _cc2.plantilla; if (!p) return;
  var a = _cc2.answers;
  document.querySelectorAll('#cf2 .cc2-seg button').forEach(function (b) { b.setAttribute('aria-pressed', String(a[b.dataset.n] === b.dataset.v)); });
  var eng = p.engine;
  var nota = cc2Nota(p.items, a, eng);
  var falt = cc2Faltantes(p.items, a, eng);
  var completo = !falt.length;
  var cls = completo ? cc2Clase(nota) : (nota === null ? cc2Clase(null) : { k: cc2Clase(nota).k, t: 'Parcial · faltan ' + falt.length + ' ítem' + (falt.length === 1 ? '' : 's') });
  var big = document.getElementById('cc2-big');
  big.textContent = nota === null ? '—' : nota + '%';
  big.className = 'cc2-big cc2-c-' + (nota === null ? 'na' : cc2Clase(nota).k);
  var pill = document.getElementById('cc2-pill');
  pill.className = 'cc2-pill cc2-' + (completo ? cls.k : 'na');
  pill.textContent = cls.t;
  document.getElementById('cc2-prog').textContent = (p.items.length - falt.length) + ' de ' + p.items.length + ' ítems calificados';
  var ded = cc2Deducciones(p.items, a, eng);
  var h = ded.map(function (d) { return '<div' + (d.critico ? ' class="cc2-crit"' : '') + '><span>' + esc(d.it.n + '. ' + d.it.label) + (d.critico ? ' ⚠' : '') + '</span><span>' + (d.puntos === null ? 'nota\u00a00\u00a0%' : '−' + d.puntos) + '</span></div>'; }).join('');
  var al = cc2Alerta(ded.filter(function (d) { return d.critico; }).length, eng);
  if (al) h += '<div class="cc2-crit"><span class="cc2-pill cc2-' + al.k + '">' + esc(cc2PctJunto(al.t)) + '</span></div>';
  if (!h && completo) h = '<div><span>Sin afectaciones</span><span>100%</span></div>';
  var dEl = document.getElementById('cc2-ded'); dEl.innerHTML = h; dEl.hidden = !h;
  var mot = document.getElementById('cc2-f-motivo'); if (mot) mot.value = cc2Motivo(p.items, a, eng);
}

// Fase 270: al elegir el asesor se llenan sus datos (lo que la plataforma sabe
// de su usuario) y se avisa que queda enlazado a "Mis resultados".
function _cc2AsesorElegido() {
  var sel = document.getElementById('cc2-f-asesor');
  var info = document.getElementById('cc2-asesor-info');
  if (!sel || !info) return;
  var opt = sel.selectedOptions && sel.selectedOptions[0];
  var uid = opt ? opt.getAttribute('data-user-id') : null;
  var u = uid ? _cc2Asesores().find(function (x) { return String(x.id) === String(uid); }) : null;
  sel.classList.remove('cc2-invalid');
  if (!u) { info.hidden = !(opt && opt.value); info.textContent = opt && opt.value ? 'Sin usuario ASESOR: no le llega a "Mis resultados".' : ''; return; }
  info.hidden = false;
  info.textContent = 'Campaña ' + (u.asesorCampana || _ccampana) + (u.user ? ' · usuario ' + u.user : '') + ' · verá esta calificación en "Mis resultados".';
}

function _cc2Val(k) { var el = document.getElementById('cc2-f-' + k); return el ? String(el.value || '').trim() : ''; }

function cc2Sugerir() {
  var p = _cc2.plantilla; if (!p) return;
  var t = cc2SugerirObs(p.items, _cc2.answers, p.engine);
  if (t === null) { showToast('Califica los ' + p.items.length + ' ítems para sugerir la observación'); return; }
  var el = document.getElementById('cc2-f-observaciones'); if (el) { el.value = t.slice(0, CC2_TEXTO_LARGO_MAX); el.classList.remove('cc2-invalid'); cc2ActualizarContador(el); }
}

function cc2VerCriterio(n) {
  var p = _cc2.plantilla; if (!p) return;
  var it = p.items.find(function (x) { return Number(x.n) === Number(n); }); if (!it) return;
  document.getElementById('cc2-criterio-t').textContent = it.n + '. ' + it.label;
  document.getElementById('cc2-criterio-b').innerHTML = '<p class="cc2-crit-sub">' + esc(cc2PctJunto(cc2SubItem(it, _cc2Eng()))) + '</p>' +
    (it.descripcion ? '<p' + (cc2EsDescuento(p.engine) ? ' class="ca-desc-lineas"' : '') + '>' + esc(it.descripcion) + '</p>' : '') + // Fase 324: saltos de linea en el motor descuento
    (it.vinetas && it.vinetas.length ? '<ul>' + it.vinetas.map(function (v) { return '<li>' + esc(v) + '</li>'; }).join('') + '</ul>' : '');
  _cc2AbrirDialogo('cc2-ov-criterio');
}
var _cc2FocoPrevio = null;
function _cc2AbrirDialogo(id) {
  _cc2FocoPrevio = document.activeElement;
  var ov = document.getElementById(id);
  // Dentro de la ventana de Calidad, para quedar encima de ella (misma capa).
  var host = document.getElementById('calidad-overlay');
  if (host && ov.parentNode !== host) host.appendChild(ov);
  ov.hidden = false;
  var b = ov.querySelector('button'); if (b) b.focus();
}
function cc2CerrarDialogo(id) {
  document.getElementById(id).hidden = true;
  if (_cc2FocoPrevio && _cc2FocoPrevio.focus) _cc2FocoPrevio.focus();
}
document.addEventListener('keydown', function (e) {
  if (e.key !== 'Escape') return;
  ['cc2-ov-criterio', 'cc2-ov-faltan', 'ca-ov-detalle'].forEach(function (id) { var ov = document.getElementById(id); if (ov && !ov.hidden) { e.stopPropagation(); cc2CerrarDialogo(id); } });
}, true);
function cc2IrAFaltante() {
  document.getElementById('cc2-ov-faltan').hidden = true;
  var f = document.querySelector('#cf2 .cc2-item.cc2-missing');
  if (f) { f.scrollIntoView({ block: 'center', behavior: 'smooth' }); var b = f.querySelector('.cc2-seg button'); if (b) b.focus({ preventScroll: true }); return; }
  var o = document.getElementById('cc2-f-observaciones');
  if (o && o.classList.contains('cc2-invalid')) { o.scrollIntoView({ block: 'center', behavior: 'smooth' }); o.focus({ preventScroll: true }); }
}

async function cc2Guardar() {
  var p = _cc2.plantilla; if (!p) return;
  var editando = !!_cc2.editId;
  if (!editando && !calCurrentPerm()) { showToast('No tiene permiso para evaluar esta campaña'); return; }
  var asesorSel = document.getElementById('cc2-f-asesor');
  var asesor = _cc2Val('asesor');
  if (asesorSel) asesorSel.classList.toggle('cc2-invalid', !asesor);
  if (!asesor) { showToast(asesorSel && asesorSel.disabled ? 'Esta campaña no tiene usuarios ASESOR: créalos en Usuarios' : 'Selecciona el asesor'); if (asesorSel) asesorSel.focus(); return; }
  document.querySelectorAll('#cf2 .cc2-item.cc2-missing').forEach(function (x) { x.classList.remove('cc2-missing'); });
  var falt = cc2Faltantes(p.items, _cc2.answers, p.engine);
  var pideObs = cc2CamposDe(p).some(function (c) { return c.k === 'observaciones'; });
  var obsEl = document.getElementById('cc2-f-observaciones');
  var sinObs = pideObs && !_cc2Val('observaciones');
  if (obsEl) obsEl.classList.toggle('cc2-invalid', sinObs);
  if (falt.length || sinObs) {
    falt.forEach(function (it) { var f = document.querySelector('#cf2 .cc2-item[data-item="' + it.n + '"]'); if (f) f.classList.add('cc2-missing'); });
    document.getElementById('cc2-faltan-t').textContent = !falt.length ? 'Faltan las observaciones' :
      (falt.length === 1 ? 'Falta 1 ítem por calificar' : 'Faltan ' + falt.length + ' ítems por calificar') + (sinObs ? ' y las observaciones' : '');
    document.getElementById('cc2-faltan-l').innerHTML = falt.map(function (it) { return '<li><b>' + esc(it.n) + '.</b> ' + esc(it.label) + '</li>'; }).join('') + (sinObs ? '<li><b>Observaciones</b> sin escribir</li>' : '');
    _cc2AbrirDialogo('cc2-ov-faltan');
    return;
  }
  // Fase 270: el id sale de la opcion elegida (data-user-id); un monitoreo viejo
  // con un nombre sin usuario se edita con ese mismo nombre, sin enlace.
  var optAs = asesorSel && asesorSel.selectedOptions && asesorSel.selectedOptions[0];
  var uidOpt = optAs ? optAs.getAttribute('data-user-id') : null;
  var au = uidOpt ? _cc2Asesores().find(function (u) { return String(u.id) === String(uidOpt); }) : null;
  var uid = au ? au.id : null;
  if (au) asesor = au.nombre;
  var answers = {};
  p.items.forEach(function (it) { answers[it.n] = _cc2.answers[it.n] || ''; });
  var extras = {};
  // Fase 322: + campos de SURA (el servidor guarda la cedula solo con sus ultimos 4 digitos).
  CC2_EXTRAS.forEach(function (k) { var v = _cc2Val(k); if (v) extras[k] = k === 'placa' ? v.toUpperCase() : v; });
  var body = {
    asesor: asesor,
    asesorUserId: uid ? Number(uid) : undefined,
    fecha: _cc2Val('fecha') || calFechaHoyLocal(),
    canal: _cc2Val('canal') || 'LLAMADA', // Fase 318: ORLANT elige el canal; las demas, Llamada como siempre
    idLlamada: _cc2Val('idLlamada'),
    // Fase 343: solo si el formulario tiene el campo; sin el, se omite y editar no borra el guardado.
    telefono: document.getElementById('cc2-f-telefono') ? _cc2Val('telefono') : undefined,
    codificacion: _cc2Val('codificacion'),
    observaciones: _cc2Val('observaciones'),
    answers: answers,
    extras: extras,
  };
  if (!editando) {
    body.campana = _ccampana; body.evaluador = currentUser ? currentUser.nombre : '';
    // Fase 318: con la plantilla principal sin campos propios (ORLANT), igual que el formulario
    // de siempre: sin plantillaId (el servidor usa la principal). Las demas, como antes.
    if (p.campos || !p.principal) body.plantillaId = p.id;
  }
  // Fase 331: monitoreo de una llamada de Calidad de encuestas (solo uno nuevo).
  var deEncuesta = !editando && typeof cenModoActivo === 'function' && cenModoActivo();
  if (deEncuesta) Object.assign(body, cenCampoGuardar());
  var btn = document.getElementById('cc2-guardar');
  try {
    await withButtonLoading(btn, 'Guardando...', function () {
      return editando ? apiRequest('PUT', '/monitoreos/' + _cc2.editId, body) : apiRequest('POST', '/monitoreos', body);
    });
  } catch (e) { showToast(e.message, 'error'); return; }
  showToast(editando ? 'Monitoreo actualizado' : 'Monitoreo guardado');
  cc2Limpiar();
  await loadCalData(_ccampana, _cmesFiltro || undefined);
  renderCalKpis();
  if (deEncuesta) cenDespuesDeGuardar(); // Fase 331: vuelve a la lista
}

function cc2Limpiar() {
  var salirEdicion = !!_cc2.editId;
  _cc2.answers = {}; _cc2.editId = null;
  if (salirEdicion) _calPlantillaElegida[_ccampana] = null;
  cc2Sync();
}

// Editar un monitoreo hecho con una plantilla nueva (quien lo califico,
// Reportes o el administrador; el servidor decide).
function cc2Editar(m) {
  var p = CAL_PLANTILLAS_TODAS.find(function (x) { return x.id === m.plantillaId; }) ||
    // Fase 318: los monitoreos viejos sin plantillaId son de la principal de su campaña.
    (m.plantillaId == null ? CAL_PLANTILLAS_TODAS.find(function (x) { return x.campana === m.campana && x.principal; }) : null);
  if (!p || !cc2CamposDe(p)) return false;
  _calPlantillaElegida[_ccampana] = p.id;
  _cc2.editId = m.id;
  _cc2.plantilla = p;
  _cc2.answers = {};
  Object.keys(m.answers || {}).forEach(function (k) { if (m.answers[k]) _cc2.answers[k] = m.answers[k]; });
  if (calCanEvaluate()) switchCalTab('nuevo'); else cc2MostrarPanel(); // Fase 340: Reportes tambien llega al formulario
  cc2Sync();
  var set = function (k, v) { var el = document.getElementById('cc2-f-' + k); if (el && v != null) el.value = v; };
  // Fase 270: si el asesor del monitoreo no esta en la lista (nombre viejo o
  // usuario inactivo), se agrega como opcion para no perderlo al editar.
  var selA = document.getElementById('cc2-f-asesor');
  if (selA && m.asesor && !Array.prototype.some.call(selA.options, function (o) { return o.value === m.asesor; })) {
    var o = document.createElement('option'); o.value = m.asesor; o.textContent = textoFormatoNombre(m.asesor) + ' (sin usuario)';
    selA.appendChild(o); selA.disabled = false;
  }
  set('asesor', m.asesor); _cc2AsesorElegido(); set('fecha', m.fecha); set('idLlamada', m.idLlamada); set('telefono', m.telefono); // Fase 343
  set('codificacion', m.codificacion); set('observaciones', m.observaciones); set('evaluador', m.evaluador);
  set('canal', m.canal || 'LLAMADA'); // Fase 318
  var ex = m.extras || {};
  CC2_EXTRAS.forEach(function (k) { set(k, ex[k]); }); // Fase 322
  cc2ActualizarContadores(); // Fase 352
  cc2Pintar();
  showToast('Editando el monitoreo de ' + textoFormatoNombre(m.asesor) + ' (' + (m.fecha || '-') + ')');
  return true;
}

// Puede editar este monitoreo desde la lista (el servidor vuelve a revisar).
function cc2PuedeEditar(m) {
  if (calCanManageMonitoreos()) return true;
  var p = CAL_PLANTILLAS_TODAS.find(function (x) { return x.id === m.plantillaId; });
  return !!(p && p.campos && currentUser && currentUser.rol === 'CALIDAD' && m.evaluadorUserId === currentUser.id);
}

// Fase 340: lo que antes hacia el formulario viejo (calidad.js), ahora con el unico formulario.
function resetCalForm() { if (typeof cc2Limpiar === 'function') cc2Limpiar(); }
