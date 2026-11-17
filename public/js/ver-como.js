// ver-como.js — Fase 357 (D, pedido de Edwin 17/11): «Ver como este usuario». Solo ADMIN (el
// servidor lo exige). Cambia, en esta misma pestaña, al token de SOLO LECTURA del usuario elegido
// (30 minutos) y muestra una franja fija para volver. El token del administrador se guarda solo
// en memoria y se recupera al volver. Nunca se ve ni se pide una contraseña.
'use strict';

var _verComo = null;   // { adminToken, adminDatos, nombre, rol, expira, timer }
var _loginDatos = null; // lo que devolvió el inicio de sesión del administrador (session.js)

function verComoActivo() { return !!_verComo; }

// Texto de la franja: «Viendo como Ana (CLIENTES_DASH) · solo lectura · hasta 3:45 p. m.»
function verComoTexto(nombre, rol, expiraIso) {
  var hasta = '';
  var d = new Date(expiraIso);
  if (!isNaN(d.getTime())) {
    try { hasta = d.toLocaleTimeString('es-CO', { timeZone: 'America/Bogota', hour: 'numeric', minute: '2-digit' }); } catch (e) { hasta = ''; }
  }
  return 'Viendo como ' + nombre + ' (' + rol + ') · solo lectura' + (hasta ? ' · hasta ' + hasta : '');
}

function _verComoPintar() {
  var b = document.getElementById('ver-como-banner');
  if (!b) return;
  b.classList.toggle('hidden', !_verComo);
  document.documentElement.classList.toggle('ver-como-activo', !!_verComo);
  if (_verComo) document.getElementById('ver-como-texto').textContent = verComoTexto(_verComo.nombre, _verComo.rol, _verComo.expira);
}

async function verComoIniciar(id) {
  if (_verComo || typeof isFullAdmin !== 'function' || !isFullAdmin() || !_loginDatos) return;
  var r;
  try { r = await apiRequest('POST', '/admin/ver-como/' + encodeURIComponent(id), {}); }
  catch (e) { showToast(e.message || 'No se pudo ver como este usuario', 'error'); return; }
  _verComo = { adminToken: authToken, adminDatos: _loginDatos, nombre: r.user.nombre, rol: r.user.rol, expira: r.expira, timer: null };
  var ms = Math.max(0, new Date(r.expira).getTime() - Date.now());
  _verComo.timer = setTimeout(function () { verComoVolver('Terminó el tiempo de «ver como» (30 minutos).'); }, ms);
  _verComoLimpiarPantalla();
  authToken = r.token;
  _verComoPintar();
  try { await _entrarTrasLogin({ user: r.user }); }
  catch (e) { showToast('No se pudo abrir la vista de este usuario: ' + (e.message || ''), 'error'); await verComoVolver(); return; }
  var btn = document.getElementById('ver-como-volver');
  if (btn) btn.focus();
}

async function verComoVolver(aviso) {
  if (!_verComo) return;
  var vc = _verComo;
  if (vc.timer) clearTimeout(vc.timer);
  try { await apiRequest('POST', '/admin/ver-como/fin', {}); } catch (e) { /* vencido o revocado: igual se vuelve */ }
  _verComo = null;
  _verComoLimpiarPantalla();
  authToken = vc.adminToken;
  _verComoPintar();
  await _entrarTrasLogin(vc.adminDatos);
  // Fase 357 (B): el administrador entra al menú de tarjetas; se vuelve a Usuarios, de donde salió.
  if (typeof enterAdminPanel === 'function') enterAdminPanel();
  if (typeof showSection === 'function' && document.getElementById('section-users')) showSection('users');
  if (aviso) showToast(aviso);
}

// Cierra tableros y ventanas abiertas antes de cambiar de usuario (como al cerrar sesión).
function _verComoLimpiarPantalla() {
  try { if (typeof closeGenericDashboard === 'function' && typeof _gd !== 'undefined' && _gd && _gd.cliente) closeGenericDashboard(); } catch (e) {}
  try { if (typeof closeCargas === 'function') closeCargas(); } catch (e) {}
  try { if (typeof closeCentroCargas === 'function') closeCentroCargas(); } catch (e) {}
  try { if (typeof closeClientsModal === 'function') closeClientsModal(); } catch (e) {}
  if (typeof gdReiniciarFiltros === 'function') gdReiniciarFiltros();
  if (typeof calSondeoReiniciar === 'function') calSondeoReiniciar();
  if (typeof ticketsAlSalir === 'function') ticketsAlSalir();
  if (typeof hideAllPages === 'function') hideAllPages();
}

// Al cerrar sesión desde «ver como»: termina la vista y deja el token del administrador para
// que doLogout cierre ESA sesión (session.js la llama al empezar).
function verComoAntesDeSalir() {
  if (!_verComo) return;
  var vc = _verComo;
  if (vc.timer) clearTimeout(vc.timer);
  apiRequest('POST', '/admin/ver-como/fin', {}).catch(function () {});
  _verComo = null;
  authToken = vc.adminToken;
  _verComoPintar();
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { verComoTexto: verComoTexto };
}
