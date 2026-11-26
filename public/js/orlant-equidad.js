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

// Pedido de Edwin (26/11, aclarado por el usuario): en la pestaña del Dashboard de ORLANT, Equidad sale como un
// CUADRO con el título «Equidad profesionales»; al hacer clic abre la vista de siempre (por mes, con sus 3 pestañas)
// en su propia pantalla (#eq-overlay). No cambia la carga ni los datos. Puro: arma el cuadro (un <button>).
function equidadCuadroHtml(datos) {
  var d = datos || {};
  var bases = (d.grupos || []).map(function (g) { return g.nombre; }).filter(Boolean);
  var total = Number(d.total) || 0;
  var detalle = total ? total.toLocaleString('es-CO') + ' citas cargadas' + ((d.meses || []).length ? ' · ' + d.meses.length + ' mes' + (d.meses.length === 1 ? '' : 'es') : '') : 'Todavía no hay citas cargadas';
  var e = typeof esc === 'function' ? esc : function (v) { return String(v); };
  return '<button type="button" class="aurora-card eq-cuadro" onclick="openOrlantEquidad()" aria-describedby="eq-cuadro-sub">' +
    '<span class="aurora-card-title eq-cuadro-titulo">Equidad profesionales</span>' +
    '<span class="eq-cuadro-sub" id="eq-cuadro-sub">Citas por profesional, por mes' + (bases.length ? ': ' + e(bases.join(', ')) : '') + '</span>' +
    '<span class="eq-cuadro-dato">' + e(detalle) + '</span>' +
    '<span class="eq-cuadro-abrir" aria-hidden="true">Abrir →</span></button>';
}

async function _equidadRenderPanel(p, i) {
  var host = document.getElementById('gd-p' + i); if (!host) return;
  var datos = _eqTab.datos;
  if (!datos) { try { datos = await _eqCargarEstado(); } catch (e) { datos = null; } }
  host.innerHTML = equidadCuadroHtml(datos);
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

// ── Pantalla de Equidad (#eq-overlay): la abre el cuadro de la pestaña del Dashboard de ORLANT (pedido de Edwin, 26/11).
// Muestra la vista de siempre (por mes, con sus 3 pestañas) con los datos al día. Quién la ve lo decide el servidor.
var _eqOv = { host: null, root: null, abierto: false };

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
  // Se abre encima del Dashboard: si el tablero sigue abierto, el fondo sigue sin scroll.
  var tablero = document.getElementById('gd-overlay');
  document.body.style.overflow = tablero && tablero.classList.contains('show') ? 'hidden' : '';
}

if (typeof module !== 'undefined' && module.exports) module.exports = { equidadCuadroHtml: equidadCuadroHtml };
