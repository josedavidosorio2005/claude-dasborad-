// wolkvox-prueba.js — Fase W2 (docs/plan-api-wolkvox.md): botón «Probar conexión» con Wolkvox
// en el encabezado del tablero. SOLO para el administrador completo y SOLO en una campaña interna
// (la réplica oculta «MOBILIZE PRUEBAS API»); el servidor lo vuelve a exigir (403/404).
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
  _wvTexto('wv-estado-config', e.configurado ? 'Sí' : 'No — falta guardar el token y el servidor');
  _wvTexto('wv-estado-uso', e.usoHoy + ' de ' + e.tope + ' (límite de Wolkvox: ' + e.limiteLicencia + ' por día)');
  var btn = _wvEl('wv-probar-btn');
  if (btn) btn.disabled = !e.configurado;
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
  try {
    var r = await withButtonLoading(btn, 'Probando…', function () {
      return apiRequest('POST', '/wolkvox/probar', { campana: _wvCampana, fecha: fecha });
    });
    _wvLimpiarResultado();
    _wvTexto('wv-r-http', String(r.httpStatus));
    _wvTexto('wv-r-code', r.code === null ? '—' : r.code);
    _wvTexto('wv-r-msg', r.msg === null ? '—' : r.msg);
    _wvTexto('wv-r-filas', r.filas + ' (' + r.dia + ', ' + r.desde + ' a ' + r.hasta + ')');
    _wvTexto('wv-r-tiempo', (r.duracionMs / 1000).toFixed(1) + ' s');
    var lista = _wvEl('wv-campos');
    if (r.campos.length === 0) {
      var li0 = document.createElement('li');
      li0.textContent = 'Sin filas en esa hora: no hay nombres de campos para mostrar. Prueba otro día.';
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

// Esc, Tab dentro de la ventana, fondo inerte y foco de vuelta: motion-helpers.js
// (MOTION_DIALOGOS_SIMPLES). Aqui solo el clic en el fondo, como los demas dialogos simples.
document.addEventListener('click', function (e) {
  var m = document.getElementById('modal-wolkvox');
  if (m && e.target === m) wvPruebaCerrar();
});

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { wvPruebaVisible: wvPruebaVisible };
}
