// ver-observacion.js — Fase 352 (B, reunion con Edwin del 13/11). En las listas de Calidad la
// observacion de un monitoreo ya no se escribe completa en la fila (con la Fase 352 A puede tener
// hasta 2000 caracteres): un boton «Ver observación» la abre en una ventana con X arriba, que cierra
// tambien con clic afuera y con Escape (solo esta ventana: la de abajo sigue abierta).
//
// Solo muestra lo que ya llego del servidor: si quien mira no recibe la observacion (la cuenta de
// cliente, por ejemplo), no hay boton. Todo se pinta con textContent.

// Boton para una celda. Sin observacion, «—».
function verObsBotonHtml(texto, contexto) {
  var t = String(texto == null ? '' : texto).trim();
  if (!t) return '—';
  return '<button type="button" class="btn-sm vobs-btn" data-vobs="' + esc(t) + '" data-vobs-ctx="' + esc(contexto || '') + '"' +
    ' onclick="event.stopPropagation();verObsAbrir(this)" onkeydown="if(event.key===\'Enter\'||event.key===\' \'){event.stopPropagation();}">Ver observación</button>';
}
// ¿Alguna fila trae observacion? (para poner la columna solo si hace falta).
function verObsHay(lista) { return (lista || []).some(function (m) { return m && String(m.observaciones || '').trim() !== ''; }); }

var _vobsDisparador = null;
function verObsAbrir(btn) {
  if (!btn) return;
  var ov = document.getElementById('vobs-ov');
  if (!ov) {
    ov = document.createElement('div');
    ov.className = 'cc2-ov vobs-ov'; ov.id = 'vobs-ov'; ov.hidden = true;
    ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-labelledby', 'vobs-t');
    ov.innerHTML = '<div class="cc2-dlg vobs-dlg"><div class="cmp-dlg-cab"><div><h3 id="vobs-t">Observación</h3><p class="cpl-ayuda" id="vobs-ctx"></p></div>' +
      '<button type="button" class="cmp-x" id="vobs-x" aria-label="Cerrar" title="Cerrar (Esc)" onclick="verObsCerrar()"><span aria-hidden="true">×</span></button></div>' +
      '<div class="vobs-texto" id="vobs-texto" tabindex="0"></div></div>';
    ov.addEventListener('click', function (e) { if (e.target === ov) verObsCerrar(); });
  }
  // Dentro de la ventana o del panel abierto: lo de afuera queda inerte mientras haya un dialogo.
  var host = btn.closest('.cc2-ov, .modal-overlay, #calidad-overlay, #stv-modal, #gd-overlay') || document.body;
  if (host.id === 'vobs-ov') host = host.parentNode || document.body;
  if (ov.parentNode !== host) host.appendChild(ov);
  document.getElementById('vobs-texto').textContent = btn.getAttribute('data-vobs') || '';
  var ctx = btn.getAttribute('data-vobs-ctx') || '';
  var pc = document.getElementById('vobs-ctx'); pc.textContent = ctx; pc.hidden = !ctx;
  _vobsDisparador = btn;
  ov.hidden = false;
  document.getElementById('vobs-x').focus();
}
function verObsCerrar() {
  var ov = document.getElementById('vobs-ov');
  if (ov) ov.hidden = true;
  if (_vobsDisparador && _vobsDisparador.isConnected) _vobsDisparador.focus();
  _vobsDisparador = null;
}

// Escape cierra SOLO esta ventana. Escucha en el document en fase de CAPTURA y este archivo carga
// antes que calidad-panel.js: corre primero y corta a los demas (la ventana del panel tambien escucha
// Escape en captura), asi la ventana de abajo sigue abierta.
if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  document.addEventListener('keydown', function (e) {
    var ov = document.getElementById('vobs-ov');
    if (e.key === 'Escape' && ov && !ov.hidden) { e.preventDefault(); e.stopImmediatePropagation(); verObsCerrar(); }
  }, true);
}

if (typeof module !== 'undefined' && module.exports) module.exports = { verObsHay: verObsHay };
