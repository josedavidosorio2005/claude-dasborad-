// orlant-equidad.js — «Equidad profesionales» de ORLANT (pedido de Edwin, 24/11/2026): pestaña del Dashboard de
// ORLANT (panel equidad_panel) que monta el HTML de Edwin (orlant-equidad-app.js) en un Shadow DOM, con las bases
// de /api/orlant/equidad/estado. Oculta hasta que haya citas cargadas y quien mira tenga acceso (el servidor responde
// 403 al resto, y entonces la pestaña sigue oculta).
'use strict';

var _eqTab = { datos: null };

function _eqHojaCss() {
  var v = (typeof window !== 'undefined' && window.__BUILD_ID__) ? '?v=' + encodeURIComponent(window.__BUILD_ID__) : '';
  return '<link rel="stylesheet" href="css/orlant-equidad-app.css' + v + '">';
}

function _eqCargarEstado() {
  return apiRequest('GET', '/orlant/equidad/estado').then(function (r) { _eqTab.datos = r; return r; });
}

// Al abrir el tablero: si hay citas y hay acceso, se destapa la pestaña (en memoria). No aporta meses.
function equidadDestapar(tabs) {
  return _eqCargarEstado().then(function (r) {
    if (r && r.total > 0) { var t = (tabs || []).find(function (x) { return x.key === 'equidad'; }); if (t) t.oculta = false; }
    return [];
  }).catch(function () { return []; });
}

async function _equidadRenderPanel(p, i) {
  var host = document.getElementById('gd-p' + i); if (!host) return;
  if (typeof eqCrearApp !== 'function') { host.innerHTML = '<div class="aurora-card"><div class="gd-vacio" role="status">No se pudo abrir Equidad profesionales.</div></div>'; return; }
  var cont = document.createElement('div');
  cont.className = 'eq-host';
  host.innerHTML = '';
  host.appendChild(cont);
  var root = cont.attachShadow({ mode: 'open' });
  root.innerHTML = _eqHojaCss() + EQ_MARKUP;
  var datos = _eqTab.datos;
  var app = eqCrearApp(root, { estado: function () { return datos ? Promise.resolve(datos) : _eqCargarEstado(); } });
  try { await app.iniciar(); } catch (e) { /* el app ya pintó el aviso */ }
}

// «Exportar»: por base, los profesionales con sus citas, % del promedio y estado (mismos cálculos que la pestaña,
// sin filtros). Solo agregados por profesional.
async function _gdExportarEquidad() {
  var r = _eqTab.datos;
  if (!r) { try { r = await _eqCargarEstado(); } catch (e) { r = null; } }
  if (!r || !r.total) return [{ titulo: 'Equidad profesionales', tipo: 'aviso', filas: [], mensaje: 'Todavía no hay bases cargadas.' }];
  var out = [];
  r.grupos.forEach(function (g) {
    if (!g.filas.length) return;
    var a = eqAnalizar(g.filas);
    out.push({ titulo: 'Equidad profesionales · ' + g.nombre + ' · índice de equidad ' + (a.equidad * 100).toFixed(1).replace('.', ',') + ' %', tipo: 'tabla',
      filas: a.lista.map(function (p) { return { Profesional: p.prof, Citas: p.n, 'Vs. promedio': Math.round(p.devp * 100) + ' %', Estado: EQ_ESTADO_TEXTO[p.estado] }; }) });
  });
  return out;
}

// ── Pedido de Edwin (reunión 26/11/2026): tarjeta «Equidad profesionales» en el menú principal, igual que
// «Gestión STA». Al hacer clic abre la vista de siempre (por mes, con sus 3 pestañas) en su propia pantalla.
// No cambia la carga ni los datos, y la pestaña del Dashboard de ORLANT sigue igual. Quién la ve lo decide el
// servidor: la tarjeta solo aparece si GET /orlant/equidad/estado responde (admin, gerencia, supervisor o
// quien carga de ORLANT; el cliente de ORLANT solo si la opción está encendida).
var EQ_TARJETA = { key: 'equidad', label: 'Equidad profesionales', sub: 'ORLANT: citas por profesional, por mes', icon: 'i-users', accion: 'openOrlantEquidad' };
var _eqOv = { host: null, root: null, abierto: false };

// Antes de preguntar al servidor: ¿podría verla? (así quien no tiene nada que ver con ORLANT no hace la consulta).
function eqPodriaVerTarjeta(user, esFullAdmin) {
  if (esFullAdmin) return true;
  if (!user) return false;
  if (user.rol === 'GERENCIA') return true;
  var p = user.perms || {};
  return p.campana_ORLANT === true || p.cliente_ORLANT === true || p.supervisa_ORLANT === true;
}

// La pone en el menú (después de «Gestión STA» / «ORLANT · Tablero nuevo» si están) cuando el servidor la deja ver.
function eqPintarTarjeta(grid, tarjetaHtml, user, esFullAdmin) {
  if (!grid || typeof tarjetaHtml !== 'function' || !eqPodriaVerTarjeta(user, esFullAdmin)) return Promise.resolve(false);
  return _eqCargarEstado().then(function () {
    if (!document.body.contains(grid) || grid.querySelector('[data-entrada="equidad"]')) return false;
    var html = tarjetaHtml(EQ_TARJETA);
    var ancla = grid.querySelector('[data-entrada="orlant_tablero"]') || grid.querySelector('[data-entrada="sta"]');
    if (ancla) ancla.insertAdjacentHTML('afterend', html);
    else {
      var cal = grid.querySelector('[onclick="onDashBtn(\'Calidad\')"]');
      if (cal) cal.insertAdjacentHTML('afterend', html); else grid.insertAdjacentHTML('beforeend', html);
    }
    return true;
  }).catch(function () { return false; });
}

async function openOrlantEquidad() {
  var overlay = document.getElementById('eq-overlay');
  if (!overlay) return;
  overlay.classList.add('show');
  if (typeof motionAbrirDialogo === 'function') motionAbrirDialogo(overlay);
  document.body.style.overflow = 'hidden';
  _eqOv.abierto = true;
  if (!_eqOv.host) {
    _eqOv.host = document.getElementById('eq-host');
    _eqOv.root = _eqOv.host.shadowRoot || _eqOv.host.attachShadow({ mode: 'open' });
  }
  if (typeof eqCrearApp !== 'function') { _eqOv.root.innerHTML = '<p role="status">No se pudo abrir Equidad profesionales.</p>'; return; }
  // Cada vez que se abre: la vista de siempre, con los datos al día.
  _eqOv.root.innerHTML = _eqHojaCss() + EQ_MARKUP;
  var app = eqCrearApp(_eqOv.root, { estado: _eqCargarEstado });
  try { await app.iniciar(); } catch (e) { if (typeof showToast === 'function') showToast('No se pudo abrir Equidad profesionales: ' + e.message); }
}

function closeOrlantEquidad() {
  _eqOv.abierto = false;
  var overlay = document.getElementById('eq-overlay');
  if (!overlay) return;
  overlay.classList.remove('show');
  if (typeof motionCerrarDialogo === 'function') motionCerrarDialogo(overlay);
  document.body.style.overflow = '';
}

if (typeof module !== 'undefined' && module.exports) module.exports = { EQ_TARJETA: EQ_TARJETA, eqPodriaVerTarjeta: eqPodriaVerTarjeta };
