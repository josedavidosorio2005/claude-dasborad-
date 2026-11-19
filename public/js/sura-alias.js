// sura-alias.js — Fase 374 (reunión con Edwin, 19/11): «Alias de asesores» del tablero Televentas,
// en Cargar Datos › SURA, solo para el administrador. Une los nombres con que una misma asesora aparece
// en distintas bases (p. ej. con y sin segundo nombre) SIN tocar los datos subidos: el tablero aplica
// el alias al abrirse (agFix). Lo guarda el servidor (config «agalias»), con Historial SURA_ALIAS_ASESOR.
'use strict';

var _sa = { cliente: null, alias: {}, nombres: [], gen: 0 };

// «lina_maria_piedrahita_parra» → «Lina Maria Piedrahita Parra» (solo para mostrar).
function suraAliasBonito(n) {
  return String(n || '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim().replace(/(^|\s)(\S)/g, function (m, a, b) { return a + b.toUpperCase(); });
}
// Mismo normalizado que el tablero (minúsculas, sin tildes, espacios → «_»).
function suraAliasNorm(s) {
  return String(s == null ? '' : s).trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '_');
}
function suraAliasHtml(alias, nombres) {
  var filas = Object.keys(alias || {}).sort().map(function (a) {
    return '<tr><th scope="row">' + esc(suraAliasBonito(a)) + '</th><td>' + esc(suraAliasBonito(alias[a])) + '</td>' +
      '<td><button type="button" class="btn-cancel sa-btn" data-quitar="' + esc(a) + '" aria-label="Quitar el alias de ' + esc(suraAliasBonito(a)) + '">Quitar</button></td></tr>';
  }).join('');
  return '<section class="cc-carga sa-alias" aria-labelledby="sa-tit"><div class="cc-carga-cab"><h3 id="sa-tit">Alias de asesores</h3></div>' +
    '<p class="cc-intro">Si una asesora aparece con varios nombres en las bases, únelos aquí en uno solo. Las bases no cambian: el tablero muestra el nombre final al abrirse. Solo el administrador.</p>' +
    (filas ? '<div class="table-wrap"><table class="vis-tabla sa-tabla"><thead><tr><th scope="col">Nombre en la base</th><th scope="col">Se muestra como</th><th scope="col"><span class="sr-only">Acciones</span></th></tr></thead><tbody>' + filas + '</tbody></table></div>'
      : '<p class="vis-vacio">Sin alias todavía.</p>') +
    '<form class="sa-form" id="sa-form"><div class="ig"><label for="sa-de">Nombre en la base</label><input id="sa-de" list="sa-nombres" maxlength="200" autocomplete="off"></div>' +
    '<div class="ig"><label for="sa-a">Unir en</label><input id="sa-a" list="sa-nombres" maxlength="200" autocomplete="off"></div>' +
    '<button type="submit" class="btn-primary sa-btn">Agregar alias</button></form>' +
    '<datalist id="sa-nombres">' + (nombres || []).map(function (n) { return '<option value="' + esc(suraAliasBonito(n)) + '"></option>'; }).join('') + '</datalist>' +
    '<p class="wv-error hidden" id="sa-error" role="alert"></p><p class="ml-nota" id="sa-nota" role="status" aria-live="polite"></p></section>';
}
// Pinta el editor debajo de la carga de SURA (solo administrador; el servidor también lo exige).
async function ccSuraAlias(contenedor, cliente) {
  if (!contenedor || typeof isFullAdmin !== 'function' || !isFullAdmin()) return;
  var gen = ++_sa.gen;
  _sa.cliente = cliente;
  var base = '/sura-televentas/' + encodeURIComponent(cliente);
  var r;
  try { r = await apiRequest('GET', base + '/resumen'); } catch (e) { return; }
  if (gen !== _sa.gen) return;
  _sa.alias = (r.config && r.config.agalias) || {};
  var host = document.getElementById('sa-host');
  if (!host) return;
  _saPintar(host);
  host.hidden = false;
  // Los nombres de las bases de ventas (para sugerir), en segundo plano.
  var meses = (r.bases || []).filter(function (b) { return b.tipo === 'ventas'; }).map(function (b) { return b.mes; });
  var nombres = {};
  for (var i = 0; i < meses.length; i++) {
    try {
      var d = await apiRequest('GET', base + '/bases/ventas/' + meses[i]);
      (d.rows || []).forEach(function (x) { if (x && x[0]) nombres[suraAliasNorm(x[0])] = 1; });
    } catch (e) { /* un mes sin base: se sigue */ }
    if (gen !== _sa.gen) return;
  }
  _sa.nombres = Object.keys(nombres).sort();
  var dl = document.getElementById('sa-nombres');
  if (dl) dl.innerHTML = _sa.nombres.map(function (n) { return '<option value="' + esc(suraAliasBonito(n)) + '"></option>'; }).join('');
}
function _saPintar(host) {
  host.innerHTML = suraAliasHtml(_sa.alias, _sa.nombres);
  host.querySelector('#sa-form').addEventListener('submit', function (ev) { ev.preventDefault(); _saAgregar(); });
  host.querySelectorAll('[data-quitar]').forEach(function (b) { b.addEventListener('click', function () { _saQuitar(b.getAttribute('data-quitar')); }); });
}
function _saMsg(err, nota) {
  var e = document.getElementById('sa-error'), n = document.getElementById('sa-nota');
  if (e) { e.textContent = err || ''; e.classList.toggle('hidden', !err); }
  if (n) n.textContent = nota || '';
}
async function _saGuardar(nuevo, nota) {
  try {
    var r = await apiRequest('PUT', '/sura-televentas/' + encodeURIComponent(_sa.cliente) + '/config/agalias', { valor: nuevo });
    _sa.alias = r.valor || nuevo;
    _saPintar(document.getElementById('sa-host'));
    _saMsg('', nota);
    showToast(nota, 'ok');
  } catch (e) { _saMsg(e.message || 'No se pudo guardar'); }
}
function _saAgregar() {
  var de = suraAliasNorm(document.getElementById('sa-de').value), a = suraAliasNorm(document.getElementById('sa-a').value);
  if (!de || !a) { _saMsg('Escribe los dos nombres'); return; }
  if (de === a) { _saMsg('Los dos nombres son iguales'); return; }
  var nuevo = Object.assign({}, _sa.alias);
  nuevo[de] = a;
  _saGuardar(nuevo, '«' + suraAliasBonito(de) + '» se mostrará como «' + suraAliasBonito(a) + '». Vuelve a abrir el tablero para verlo.');
}
function _saQuitar(de) {
  if (!window.confirm('¿Quitar el alias de «' + suraAliasBonito(de) + '»? Volverá a verse con su nombre de la base.')) return;
  var nuevo = Object.assign({}, _sa.alias);
  delete nuevo[de];
  _saGuardar(nuevo, 'Alias quitado.');
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { suraAliasBonito: suraAliasBonito, suraAliasNorm: suraAliasNorm, suraAliasHtml: suraAliasHtml };
}
