// calidad-panel.js — Fase 256 (plan de Calidad B5). Panel
// "calidad_monitoreos_panel" de la pestaña Calidad del dashboard (hoy
// Mobilize): para quien ve el dashboard del cliente, el resultado de los
// monitoreos como en el HTML de Edwin -- indicadores, resultado por asesor,
// items mas afectados y el detalle de las llamadas con fallas (clic = detalle
// de cada monitoreo), mas el Diccionario. Sigue a MESES. Sale de CAL_DB (los
// mismos monitoreos que ya usa la pestaña; el telefono nunca llega al cliente,
// Fase 151). Los nombres de asesor solo si el registro lo permite
// (asesorVisibleCliente) o si quien mira es interno. Sin monitoreos: no se dibuja.

function _cmpVeAsesores(campana) {
  var interno = typeof currentUser === 'undefined' || !currentUser || currentUser.rol !== 'CLIENTES_DASH';
  return interno || (typeof LISTAS_REGISTRO !== 'undefined' && (LISTAS_REGISTRO.asesorVisibleCliente || []).indexOf(campana) !== -1);
}
function _cmpMonitoreos(camp) {
  var todos = (typeof CAL_DB !== 'undefined' && CAL_DB[camp] && CAL_DB[camp].monitoreos) || [];
  var meses = (typeof gdMesesTarjetasActual === 'function') ? gdMesesTarjetasActual() : [];
  return meses.length ? todos.filter(function (m) { return meses.indexOf(String(m.fecha || '').slice(0, 7)) !== -1; }) : todos;
}
var _cmpEstado = {}; // por campaña: plantilla elegida
var _cmpVerTodas = {}; // por campaña: mostrar todas las llamadas con fallas
function _cmpMostrarTodas(camp) { _cmpVerTodas[camp] = true; _cmpElegir(camp, _cmpEstado[camp]); }
function _cmpElegir(camp, v) { _cmpEstado[camp] = Number(v) || null; var tab = (_gd.config.layout.tabs || []).find(function (t) { return t.key === _gd.tab; }); if (tab) renderGenericTab(tab.key); }

function _cmpRender(p, i) {
  var el = document.getElementById('gd-p' + i); if (!el) return;
  var camp = p.campana;
  var todosCamp = (typeof CAL_DB !== 'undefined' && CAL_DB[camp] && CAL_DB[camp].monitoreos) || [];
  if (!todosCamp.length) { el.innerHTML = ''; el.style.display = 'none'; return; }
  el.style.display = '';
  var arrMes = _cmpMonitoreos(camp);
  var pls = (typeof CAL_PLANTILLAS_TODAS !== 'undefined' ? CAL_PLANTILLAS_TODAS : []);
  var conteo = {};
  arrMes.forEach(function (m) { var q = caPlantillaDe(m, pls); if (q) conteo[q.id] = (conteo[q.id] || 0) + 1; });
  var lista = pls.filter(function (q) { return q.campana === camp && conteo[q.id]; });
  var pl = lista.find(function (q) { return q.id === _cmpEstado[camp]; }) || lista.slice().sort(function (a, b) { return conteo[b.id] - conteo[a.id]; })[0] || null;
  var arr = pl ? arrMes.filter(function (m) { var q = caPlantillaDe(m, pls); return q && q.id === pl.id; }) : arrMes;
  var ve = _cmpVeAsesores(camp);
  var titulo = '<div class="aurora-card-title">Resultado de los monitoreos</div>';
  if (!arr.length) {
    el.innerHTML = '<div class="aurora-card">' + titulo + '<div class="gd-aviso-mes" role="status">Sin monitoreos de calidad en los meses elegidos.</div></div>';
    return;
  }
  var selector = lista.length > 1 ? '<label class="ca-filtro">Plantilla <select onchange="_cmpElegir(\'' + esc(camp) + '\', this.value)">' + lista.map(function (q) {
    return '<option value="' + q.id + '"' + (pl && q.id === pl.id ? ' selected' : '') + '>' + esc(q.nombre) + '</option>';
  }).join('') + '</select></label>' : '';
  var resumen = '';
  if (ve) {
    resumen = '<div class="aurora-card"><div class="aurora-card-title">Resultado por asesor</div><div style="overflow-x:auto"><table class="aurora-rank-table"><tr><th>#</th><th>Asesor</th><th>Monitoreos</th><th>Promedio</th><th>Clasificación</th><th>Fallos críticos</th><th>Alerta</th></tr>' +
      caResumenAsesores(arr).map(function (f, k) {
        return '<tr><td>' + (k + 1) + '</td><td><b>' + esc(textoFormatoNombre(f.asesor)) + '</b></td><td>' + f.monitoreos + '</td><td>' + _caPct(f.promedio) + '</td><td>' + _caPill(f.clase) + '</td><td>' + f.fallos + '</td><td>' + _caPill(f.alerta) + '</td></tr>';
      }).join('') + '</table></div></div>';
  }
  var fallas = arr.filter(function (m) { return _caTieneNo(m); }).sort(function (a, b) { return String(b.fecha || '').localeCompare(String(a.fecha || '')) || b.id - a.id; });
  var CMP_LIMITE = 50;
  var verTodas = !!_cmpVerTodas[camp];
  var filasFallas = (verTodas ? fallas : fallas.slice(0, CMP_LIMITE)).map(function (m) {
    var c = caClase(Number(m.puntaje));
    return '<tr class="ca-click" tabindex="0" role="button" aria-label="Ver el detalle del monitoreo del ' + esc(m.fecha || '') + '" onclick="_cmpVer(\'' + esc(camp) + '\',' + m.id + ')" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.preventDefault();_cmpVer(\'' + esc(camp) + '\',' + m.id + ')}">' +
      '<td>' + esc(m.fecha || '-') + '</td>' + (ve ? '<td><b>' + esc(textoFormatoNombre(m.asesor)) + '</b></td>' : '') + '<td>' + esc(m.idLlamada || '-') + '</td>' +
      '<td><span class="cc2-pill cc2-' + c.k + '">' + _caPct(m.puntaje) + '</span></td><td class="ca-mot">' + esc((m.extras && m.extras.motivo) || _cmpMotivo(m, pl)) + '</td></tr>';
  }).join('');
  el.innerHTML =
    '<div class="aurora-card cmp-cab">' + titulo +
      '<div class="ca-filtros">' + selector + (pl ? '<button type="button" class="btn-cancel cmp-dicc" onclick="_cmpDiccionario(\'' + esc(camp) + '\',' + pl.id + ')">Diccionario</button>' : '') + '</div>' +
      caKpisHtml(caKpis(arr)) + '</div>' +
    resumen + caAfectadosHtml(arr, pl, ve) +
    '<div class="aurora-card"><div class="aurora-card-title">Llamadas con fallas (' + fallas.length + ')</div>' +
      (fallas.length ? '<p class="cpl-ayuda">Haz clic en una llamada para ver su detalle.</p><div style="overflow-x:auto"><table class="aurora-rank-table"><tr><th>Fecha</th>' + (ve ? '<th>Asesor</th>' : '') + '<th>ID llamada</th><th>Nota</th><th>Motivo de afectación</th></tr>' + filasFallas + '</table></div>' +
          (fallas.length > CMP_LIMITE && !verTodas ? '<button type="button" class="btn-cancel cmp-dicc" data-camp="' + esc(camp) + '" onclick="_cmpMostrarTodas(this.dataset.camp)">Ver todas (' + fallas.length + ')</button>' : '')
        : '<p class="ca-vacio">Ninguna llamada con fallas en los meses elegidos.</p>') + '</div>';
}
// Motivo para monitoreos viejos (sin extras): los items en NO de su plantilla.
function _cmpMotivo(m, pl) {
  var items = (pl && pl.items) || [];
  return items.filter(function (it) { return (m.answers || {})[it.n] === 'NO'; }).map(function (it) { return it.n + '. ' + it.label; }).join(' · ');
}

// Dialogo propio dentro del tablero (#gd-overlay deja inerte todo lo de afuera).
function _cmpDialogo() {
  var ov = document.getElementById('cmp-ov');
  if (!ov) {
    ov = document.createElement('div');
    ov.className = 'cc2-ov'; ov.id = 'cmp-ov'; ov.hidden = true;
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-labelledby', 'cmp-ov-t');
    ov.innerHTML = '<div class="cc2-dlg ca-dlg-ancho"><h3 id="cmp-ov-t"></h3><div id="cmp-ov-b"></div><div class="modal-btns"><button type="button" class="btn-primary" onclick="_cmpCerrar()">Cerrar</button></div></div>';
    ov.addEventListener('click', function (e) { if (e.target === ov) _cmpCerrar(); });
  }
  var host = document.getElementById('gd-overlay') || document.body;
  if (ov.parentNode !== host) host.appendChild(ov);
  return ov;
}
var _cmpFoco = null;
function _cmpAbrir(titulo, html) {
  var ov = _cmpDialogo();
  _cmpFoco = document.activeElement;
  document.getElementById('cmp-ov-t').textContent = titulo;
  document.getElementById('cmp-ov-b').innerHTML = html;
  ov.hidden = false;
  ov.querySelector('.modal-btns button').focus();
}
function _cmpCerrar() {
  var ov = document.getElementById('cmp-ov'); if (ov) ov.hidden = true;
  if (_cmpFoco && _cmpFoco.focus) _cmpFoco.focus();
}
document.addEventListener('keydown', function (e) {
  var ov = document.getElementById('cmp-ov');
  if (e.key === 'Escape' && ov && !ov.hidden) { e.stopPropagation(); _cmpCerrar(); }
}, true);
function _cmpVer(camp, id) {
  var m = ((CAL_DB[camp] || {}).monitoreos || []).find(function (x) { return x.id === id; });
  if (!m) return;
  var pls = (typeof CAL_PLANTILLAS_TODAS !== 'undefined' ? CAL_PLANTILLAS_TODAS : []);
  var copia = Object.assign({}, m);
  if (!_cmpVeAsesores(camp)) copia.asesor = '';
  _cmpAbrir('Detalle del monitoreo · ' + (m.fecha || ''), caDetalleHtml(copia, caPlantillaDe(m, pls)));
}
function _cmpDiccionario(camp, plId) {
  var pls = (typeof CAL_PLANTILLAS_TODAS !== 'undefined' ? CAL_PLANTILLAS_TODAS : []);
  var pl = pls.find(function (q) { return q.id === plId; });
  if (pl) _cmpAbrir('Diccionario · ' + pl.nombre, caDiccionarioHtml(pl));
}
