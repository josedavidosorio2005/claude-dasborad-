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
