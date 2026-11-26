// wolkvox-prueba.js — Fase W2 (docs/plan-api-wolkvox.md): botón «Probar conexión» con Wolkvox
// en el encabezado del tablero. SOLO para el administrador completo y SOLO en una campaña interna
// (las réplicas ocultas «MOBILIZE PRUEBAS API», «ORLANT PRUEBAS API» y, desde la Fase AU1,
// «CLINICA AURORA PRUEBAS API»); el servidor lo vuelve a
// exigir (403/404).
// Muestra code, msg, cuántas filas y los NOMBRES de los campos: nunca un valor. Todo lo que llega
// del servidor se pinta con textContent.

function wvPruebaVisible(cliente) {
  var admin = typeof isFullAdmin === 'function' && isFullAdmin();
  var interno = typeof esClienteInterno === 'function' && esClienteInterno(cliente);
  return !!(admin && interno);
}

function wvPruebaPintarBoton(cliente) {
  var b = document.getElementById('gd-wolkvox-btn');
  if (b) b.classList.toggle('hidden', !wvPruebaVisible(cliente));
}

var _wvCampana = null;

function _wvEl(id) { return document.getElementById(id); }
function _wvTexto(id, t) { var e = _wvEl(id); if (e) e.textContent = t; }

function _wvPintarEstado(e) {
  _wvTexto('wv-estado-config', e.configurado ? 'Sí' : 'No');
  // Diagnostico (solo si/no, nunca valores): que revisar en SSM o en el archivo local.
  var d = e.diagnostico, sn = function (v) { return v ? 'Sí' : 'No'; };
  var diag = _wvEl('wv-diagnostico');
  if (diag) diag.classList.toggle('hidden', !!e.configurado || !d);
  if (d) { _wvTexto('wv-d-token', sn(d.tokenEncontrado)); _wvTexto('wv-d-servidor', sn(d.servidorEncontrado)); _wvTexto('wv-d-formato', sn(d.servidorFormatoValido)); }
  _wvTexto('wv-estado-uso', e.usoHoy + ' de ' + e.tope + ' (límite de Wolkvox: ' + e.limiteLicencia + ' por día)');
  var btn = _wvEl('wv-probar-btn');
  if (btn) btn.disabled = !e.configurado;
  // Fase N5: «Ejecutar ahora» solo en la réplica de MOBILIZE (la de ORLANT no tiene consulta automática).
  var auto = _wvEl('wv-auto-btn');
  if (auto) auto.classList.toggle('hidden', e.autoDisponible === false);
}

async function wvPruebaAbrir() {
  if (typeof _gd === 'undefined' || !_gd || !wvPruebaVisible(_gd.cliente)) return;
  _wvCampana = _gd.cliente;
  _wvTexto('wv-campana', _wvCampana);
  _wvLimpiarResultado();
  openModal('modal-wolkvox');
  var f = _wvEl('wv-fecha');
  try {
    var e = await apiRequest('GET', '/wolkvox/estado?campana=' + encodeURIComponent(_wvCampana));
    _wvPintarEstado(e);
    if (f && !f.value) f.value = e.fechaSugerida;
    wvLlenarReportes(_wvEl('wv-reporte'), e.reportesNombres); // Fase A5
    if (f) f.max = e.fechaSugerida;
  } catch (err) {
    _wvError(err.message);
  }
  if (f) f.focus();
}

function wvPruebaCerrar() {
  closeModal('modal-wolkvox');
  var b = _wvEl('gd-wolkvox-btn');
  if (b) b.focus();
}

function _wvLimpiarResultado() {
  var r = _wvEl('wv-resultado'); if (r) r.classList.add('hidden');
  var rd = _wvEl('wv-red'); if (rd) rd.classList.add('hidden'); // Fase W3
  var au = _wvEl('wv-auto'); if (au) au.classList.add('hidden'); // Fase A3
  var e = _wvEl('wv-error'); if (e) { e.classList.add('hidden'); e.textContent = ''; }
  var c = _wvEl('wv-campos'); if (c) c.textContent = '';
}

function _wvError(msg) {
  var e = _wvEl('wv-error');
  if (!e) return;
  e.textContent = msg;
  e.classList.remove('hidden');
}

async function wvPruebaProbar() {
  // Si esta prueba falla (por ejemplo, «Espera 29 s»), el resultado anterior se queda a la vista.
  var errPrevio = _wvEl('wv-error'); if (errPrevio) { errPrevio.classList.add('hidden'); errPrevio.textContent = ''; }
  var btn = _wvEl('wv-probar-btn');
  var fecha = (_wvEl('wv-fecha') || {}).value || '';
  var reporte = (_wvEl('wv-reporte') || {}).value || 'skill_1'; // Fase A5
  var rango = (_wvEl('wv-rango') || {}).value || 'dia'; // Fase A6
  try {
    var r = await withButtonLoading(btn, 'Probando…', function () {
      return apiRequest('POST', '/wolkvox/probar', { campana: _wvCampana, fecha: fecha, reporte: reporte, rango: rango });
    });
    _wvLimpiarResultado();
    _wvTexto('wv-r-http', String(r.httpStatus));
    _wvTexto('wv-r-code', r.code === null ? '—' : r.code);
    _wvTexto('wv-r-msg', r.msg === null ? '—' : r.msg);
    _wvTexto('wv-r-filas', r.filas + ' (' + r.reporte + ', ' + (r.desdeDia && r.desdeDia !== r.dia ? r.desdeDia + ' a ' : '') + r.dia + ', ' + r.desde + ' a ' + r.hasta + ')');
    _wvTexto('wv-r-tiempo', (r.duracionMs / 1000).toFixed(1) + ' s');
    // Fase A2: nombres de skill (no son datos personales), solo con textContent.
    _wvTexto('wv-r-skills', Array.isArray(r.skills) && r.skills.length ? r.skills.join(' · ') : '—');
    var lista = _wvEl('wv-campos');
    if (r.campos.length === 0) {
      var li0 = document.createElement('li');
      li0.textContent = 'Sin filas ese día: no hay nombres de campos para mostrar. Prueba otro día.';
      lista.appendChild(li0);
    }
    r.campos.forEach(function (c) {
      var li = document.createElement('li');
      li.className = 'wv-campo';
      li.textContent = c;
      lista.appendChild(li);
    });
    _wvEl('wv-resultado').classList.remove('hidden');
    _wvPintarEstado({ configurado: true, usoHoy: r.usoHoy, tope: r.tope, limiteLicencia: r.limiteLicencia });
  } catch (err) {
    _wvError(err.message);
    if (err.data && typeof err.data.usoHoy === 'number') _wvTexto('wv-estado-uso', err.data.usoHoy + ' de ' + err.data.tope + ' (límite de Wolkvox: ' + err.data.limiteLicencia + ' por día)');
  }
}

// ── Fase W3: «Diagnóstico de red» ──
// Filas [titulo, texto] del resultado. Puro (se prueba en Node). Solo si/no, tiempos y codigos.
function wvRedFilas(d) {
  var paso = function (x) {
    if (!x) return 'No se probó';
    return x.ok ? 'Sí (' + x.ms + ' ms' + (x.protocolo ? ', ' + x.protocolo : '') + ')' : 'No (' + (x.codigo || 'DESCONOCIDO') + ', ' + x.ms + ' ms)';
  };
  var familia = function (f, nombre, filas) {
    if (!f || f.omitido) { filas.push(['Conexión ' + nombre + ' (puerto 443)', 'No se probó: ' + ((f && f.omitido) || 'sin datos')]); return; }
    filas.push(['Conexión ' + nombre + ' (puerto 443)', paso(f.tcp)]);
    filas.push(['Conexión segura ' + nombre + ' (TLS)', f.tls ? paso(f.tls) : 'No se probó: no abrió la conexión']);
  };
  var filas = [];
  var w = (d && d.wolkvox) || {};
  var dns = w.dns || {};
  filas.push(['Nombre del servidor (DNS)', dns.ok ? 'Sí: ' + dns.ipv4 + ' IPv4 y ' + dns.ipv6 + ' IPv6 (' + dns.ms + ' ms)' : 'No (' + (dns.codigo || 'DESCONOCIDO') + ', ' + (dns.ms || 0) + ' ms)']);
  familia(w.ipv4, 'IPv4', filas);
  familia(w.ipv6, 'IPv6', filas);
  var c = (d && d.control) || {};
  filas.push(['Control: salida a internet (IPv4)', c.dns && c.dns.ok ? (c.ipv4 && c.ipv4.tcp ? paso(c.ipv4.tcp) : 'No se probó') : 'No (DNS ' + ((c.dns && c.dns.codigo) || 'DESCONOCIDO') + ')']);
  return filas;
}

async function wvDiagnosticoRed() {
  var errPrevio = _wvEl('wv-error'); if (errPrevio) { errPrevio.classList.add('hidden'); errPrevio.textContent = ''; }
  try {
    var d = await withButtonLoading(_wvEl('wv-red-btn'), 'Diagnosticando…', function () {
      return apiRequest('POST', '/wolkvox/diagnostico-red', { campana: _wvCampana });
    });
    var dl = _wvEl('wv-red-dl');
    dl.textContent = '';
    wvRedFilas(d).forEach(function (f) {
      var dt = document.createElement('dt'); dt.textContent = f[0];
      var dd = document.createElement('dd'); dd.textContent = f[1];
      dl.appendChild(dt); dl.appendChild(dd);
    });
    _wvEl('wv-red').classList.remove('hidden');
  } catch (err) {
    _wvError(err.message);
  }
}

// Fase A5: opciones del selector de reportes (solo los que el servidor permite), con textContent.
function wvLlenarReportes(sel, nombres) {
  if (!sel || !nombres || typeof nombres !== 'object') return;
  var actual = sel.value || 'skill_1';
  sel.textContent = '';
  Object.keys(nombres).sort().forEach(function (k) {
    var o = document.createElement('option');
    o.value = k;
    o.textContent = k + ' — ' + String(nombres[k]);
    sel.appendChild(o);
  });
  sel.value = Object.prototype.hasOwnProperty.call(nombres, actual) ? actual : 'skill_1';
}

// ── Fase A3: «Ejecutar ahora» de la consulta automática ──
// Filas [titulo, texto] del resultado. Puro (se prueba en Node). Solo conteos, meses y códigos.
function wvAutoFilas(r) {
  var filas = [['Estado', String((r && r.estado) || '—') + (r && r.error ? ' (' + r.error + ')' : '')], ['Consultas usadas', String((r && r.consultas) || 0)]];
  ((r && r.meses) || []).forEach(function (m) {
    var t = m.estado === 'ok' ? m.dias + ' días, ' + m.filas + ' filas, ' + m.skills + ' skills, reemplazó ' + m.reemplazadas + ' (con respaldo)' : m.estado + (m.codigo ? ' (' + m.codigo + ')' : '') + ', mes sin cambios';
    filas.push(['Mes ' + m.mes, t]);
  });
  if (r && typeof r.usoHoy === 'number') filas.push(['Consultas de hoy', r.usoHoy + ' de ' + r.tope]);
  return filas;
}

async function wvAutoEjecutar() {
  var errPrevio = _wvEl('wv-error'); if (errPrevio) { errPrevio.classList.add('hidden'); errPrevio.textContent = ''; }
  if (!confirm('Se pedirá a Wolkvox el Flujo del mes (un día por consulta) y se reemplazará el mes de ' + _wvCampana + ', con respaldo para Deshacer. ¿Continuar?')) return;
  try {
    var r = await withButtonLoading(_wvEl('wv-auto-btn'), 'Ejecutando…', function () {
      return apiRequest('POST', '/wolkvox/auto/ejecutar', { campana: _wvCampana });
    });
    var dl = _wvEl('wv-auto-dl');
    dl.textContent = '';
    wvAutoFilas(r).forEach(function (f) {
      var dt = document.createElement('dt'); dt.textContent = f[0];
      var dd = document.createElement('dd'); dd.textContent = f[1];
      dl.appendChild(dt); dl.appendChild(dd);
    });
    _wvEl('wv-auto').classList.remove('hidden');
  } catch (err) {
    _wvError(err.message);
  }
}

// Esc, Tab dentro de la ventana, fondo inerte y foco de vuelta: motion-helpers.js
// (MOTION_DIALOGOS_SIMPLES). Aqui solo el clic en el fondo, como los demas dialogos simples.
if (typeof document !== 'undefined') { // Fase W3: el archivo también se carga en Node (pruebas de wvRedFilas)
  document.addEventListener('click', function (e) {
    var m = document.getElementById('modal-wolkvox');
    if (m && e.target === m) wvPruebaCerrar();
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { wvPruebaVisible: wvPruebaVisible, wvRedFilas: wvRedFilas, wvAutoFilas: wvAutoFilas, wvLlenarReportes: wvLlenarReportes };
}
