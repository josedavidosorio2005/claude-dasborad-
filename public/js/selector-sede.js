// selector-sede.js — Fase 354 (reunion con Edwin del 13/11): Hospital La Maria por sede.
// Al tocar un cliente dividido en sedes (Dashboard Clientes o Portal Supervisor) se abre
// primero esta pantalla con un boton grande por sede; cada boton abre el tablero de ESA
// sede (su propia campaña: solo sus datos). Dentro del tablero, el encabezado dice en que
// sede se esta y «Cambiar sede» vuelve aqui. El administrador ve ademas «Sin sede»: el
// tablero del padre, con lo cargado antes de separar las sedes.
// La regla (que sedes ve cada quien) vive en sedes-logic.js, igual en el servidor.
'use strict';

var _selSedePadre = null;

function _selSedeRegistro() { return (typeof REGISTRO_CLIENTES !== 'undefined' && REGISTRO_CLIENTES) || []; }
function _selSedeEsAdmin() { return typeof isFullAdmin === 'function' && isFullAdmin(); }

// Nombre para mostrar del cliente padre (parametros.sedesNombre; si no, el nombre tal cual).
function selSedeNombrePadre(padre) {
  var c = _selSedeRegistro().find(function (x) { return x && x.nombre === padre; });
  return (c && c.parametros && c.parametros.sedesNombre) || padre;
}

function gdAbrirSelectorSede(padre) {
  _selSedePadre = padre;
  var reg = _selSedeRegistro();
  var perms = (typeof currentUser !== 'undefined' && currentUser && currentUser.perms) || {};
  var esAdmin = _selSedeEsAdmin();
  var sedes = sedesVisibles(reg, padre, perms, esAdmin);
  var nombre = selSedeNombrePadre(padre);
  document.getElementById('sede-modal-title').textContent = nombre;
  var grid = document.getElementById('sede-grid');
  grid.innerHTML = sedes.map(function (s) {
    return '<button type="button" class="sede-btn" data-sede="' + esc(s.campana) + '" onclick="gdAbrirSede(this.dataset.sede)">' +
      '<span class="sede-btn-ico" aria-hidden="true"><svg class="icono" aria-hidden="true" focusable="false"><use href="img/iconos/lucide.svg#i-map-pin"></use></svg></span>' +
      '<span class="sede-btn-nombre">' + esc(s.etiqueta) + '</span>' +
      '<span class="sede-btn-sub">Solo los datos de esta sede</span></button>';
  }).join('') || '<div class="empty-state"><div class="es-title">Sin sedes asignadas</div>' +
    '<div class="es-hint">Solicita al administrador acceso a una sede.</div></div>';
  var extra = document.getElementById('sede-sin-sede');
  extra.innerHTML = esAdmin
    ? '<button type="button" class="sede-sin-btn" onclick="gdAbrirSinSede()">Sin sede <span class="sede-sin-nota">· lo cargado antes de separar las sedes · solo administrador</span></button>'
    : '';
  if (typeof closeClientsModal === 'function') closeClientsModal();
  document.getElementById('sede-modal-overlay').classList.add('show');
}

function closeSelectorSede() {
  document.getElementById('sede-modal-overlay').classList.remove('show');
}

function gdAbrirSede(campana) {
  closeSelectorSede();
  openGenericDashboard(campana);
}

function gdAbrirSinSede() {
  if (!_selSedeEsAdmin() || !_selSedePadre) return;
  closeSelectorSede();
  openGenericDashboard(_selSedePadre);
}

// Encabezado del tablero: la sede en la que se esta y el boton para volver a elegir.
function gdPintarSede(cliente) {
  var reg = _selSedeRegistro();
  var pill = document.getElementById('gd-sede');
  var btn = document.getElementById('gd-cambiar-sede-btn');
  if (!pill || !btn) return;
  var padre = padreDeSede(reg, cliente);
  var esPadre = sedesDe(reg, cliente).length > 0;
  if (padre) {
    pill.textContent = sedeEtiqueta(reg, cliente);
    pill.className = 'gd-sede';
  } else if (esPadre) {
    pill.textContent = 'Sin sede · solo administrador';
    pill.className = 'gd-sede gd-sede-sin';
  }
  pill.classList.toggle('hidden', !(padre || esPadre));
  btn.classList.toggle('hidden', !(padre || esPadre));
  btn.dataset.padre = padre || (esPadre ? cliente : '');
}

function gdCambiarSede() {
  var btn = document.getElementById('gd-cambiar-sede-btn');
  var padre = btn && btn.dataset.padre;
  if (!padre) return;
  closeGenericDashboard();
  gdAbrirSelectorSede(padre);
}

(function () {
  var ov = typeof document !== 'undefined' && document.getElementById('sede-modal-overlay');
  if (ov) ov.addEventListener('click', function (e) { if (e.target === this) closeSelectorSede(); });
})();
