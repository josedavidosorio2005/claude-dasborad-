// calidad-sondeo.js — InConexion Platform (Fase 236).
// Consulta periodica de Calidad (ver calidad-sondeo-logic.js para el criterio).
// Un solo temporizador de 30 s que casi nunca pide nada: sin sesion o con la
// pestaña del navegador oculta no hace nada, y cada consulta respeta su
// intervalo (asesor 3 min, dashboard 5 min). Al volver a la pestaña, consulta
// enseguida. Nada se escribe: solo GET.
'use strict';

var _calSondeo = { timer: null, ultimaAsesor: 0, ultimaDash: 0, enCurso: false };

// Fase 239 (visto al verificar la 236 en produccion): con el administrador
// MAESTRO, currentUser es null a proposito (session.js); la sesion se mide
// solo por el token. El aviso del asesor sigue mirando currentUser.rol.
function _calSondeoConSesion() {
  return typeof authToken !== 'undefined' && !!authToken;
}

// Campañas de los paneles de monitoreos (calidad_kpis/pie/bar_asesores) de la
// pestaña abierta del dashboard. El Resumen de calidad (Excel) no se sondea.
function _calSondeoCampanasPestana() {
  if (typeof _gd === 'undefined' || !_gd || !_gd.cliente || !_gd.config || !_gd.tab) return [];
  var ov = document.getElementById('gd-overlay');
  if (!ov || !ov.classList.contains('show')) return [];
  var tab = ((_gd.config.layout && _gd.config.layout.tabs) || []).find(function (t) { return t.key === _gd.tab; });
  var camps = [];
  ((tab && tab.panels) || []).forEach(function (p) {
    if (/^calidad_(kpis|pie|bar_asesores)$/.test(p.tipo) && p.campana && camps.indexOf(p.campana) === -1) camps.push(p.campana);
  });
  return camps;
}

async function calSondeoTick(forzar) {
  if (_calSondeo.enCurso) return;
  var base = { conSesion: _calSondeoConSesion(), visible: document.visibilityState !== 'hidden', forzar: !!forzar, ahora: Date.now() };
  _calSondeo.enCurso = true;
  try {
    // 1) Portal del asesor: el aviso "Tienes N monitoreos nuevos".
    if (typeof currentUser !== 'undefined' && currentUser && currentUser.rol === 'ASESOR' && typeof calCargarAlertaNuevos === 'function' &&
        calSondeoToca(Object.assign({ ultima: _calSondeo.ultimaAsesor, intervalo: CAL_SONDEO_ASESOR_MS }, base))) {
      _calSondeo.ultimaAsesor = base.ahora;
      var antes = typeof _misMonitoreosNuevos !== 'undefined' ? _misMonitoreosNuevos : 0;
      await calCargarAlertaNuevos();
      var sec = document.getElementById('asesor-section-calidad');
      if (_misMonitoreosNuevos > antes && sec && sec.style.display !== 'none' && typeof renderMisResultados === 'function') await renderMisResultados();
    }
    // 2) Dashboard de cliente con la pestaña Calidad abierta.
    var camps = _calSondeoCampanasPestana();
    if (camps.length && calSondeoToca(Object.assign({ ultima: _calSondeo.ultimaDash, intervalo: CAL_SONDEO_DASH_MS }, base))) {
      _calSondeo.ultimaDash = base.ahora;
      var tabAntes = _gd.tab;
      var cambio = false;
      for (var k = 0; k < camps.length; k++) {
        var nuevos;
        try { nuevos = (await apiRequest('GET', '/monitoreos?campana=' + encodeURIComponent(camps[k]))) || []; } catch (e) { continue; }
        var cache = calCampCache(camps[k]);
        if (calSondeoFirma(nuevos) !== calSondeoFirma(cache.monitoreos)) { cache.monitoreos = nuevos; cambio = true; }
      }
      if (cambio && _gd && _gd.tab === tabAntes && typeof renderGenericTab === 'function') renderGenericTab(_gd.tab);
    }
  } finally {
    _calSondeo.enCurso = false;
  }
}

function calSondeoIniciar() {
  if (_calSondeo.timer) return;
  _calSondeo.timer = setInterval(function () { calSondeoTick(false); }, 30000);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') calSondeoTick(true);
  });
}
// Al cerrar sesion: la proxima persona arranca de cero.
function calSondeoReiniciar() {
  _calSondeo.ultimaAsesor = 0;
  _calSondeo.ultimaDash = 0;
}

if (typeof document !== 'undefined' && typeof module === 'undefined') calSondeoIniciar();
