// horarios-logic.js — Fase 367 (pedido de Edwin 18/11, D2): lector del reporte de Login/Logout de
// Wolkvox («HistAgent»: DATE, AGENT_ID, LOGIN, LOGOUT, LOGIN_TIME, AGENT_NAME, AGENT_DNI). Lógica
// pura (navegador y Node). Convierte las fechas de Excel a texto «AAAA-MM-DD HH:MM:SS» (hora tal
// cual, sin zona) y arma las filas con los MISMOS nombres de campo de la API (agent_7), para que el
// servidor las pase por el mismo lector. AGENT_DNI (documento) nunca se envía.
'use strict';

var HORARIOS_COLUMNAS = ['DATE', 'AGENT_ID', 'LOGIN', 'LOGOUT', 'LOGIN_TIME', 'AGENT_NAME'];

function _hPad(n) { return (n < 10 ? '0' : '') + n; }
// Número de serie de Excel (días desde 1899-12-30, con fracción del día) -> «AAAA-MM-DD HH:MM:SS».
function horariosSerialATexto(v) {
  if (typeof v !== 'number' || !isFinite(v) || v < 1) return null;
  var ms = Math.round((v - 25569) * 86400) * 1000;
  var d = new Date(ms);
  if (isNaN(d.getTime())) return null;
  return d.getUTCFullYear() + '-' + _hPad(d.getUTCMonth() + 1) + '-' + _hPad(d.getUTCDate()) + ' ' + _hPad(d.getUTCHours()) + ':' + _hPad(d.getUTCMinutes()) + ':' + _hPad(d.getUTCSeconds());
}
// Fracción de día (LOGIN_TIME) -> «H:MM:SS».
function horariosDuracionATexto(v) {
  if (typeof v === 'string') return v.trim();
  if (typeof v !== 'number' || !isFinite(v) || v < 0) return '';
  var s = Math.round((v - Math.floor(v)) * 86400) + Math.floor(v) * 86400;
  return Math.floor(s / 3600) + ':' + _hPad(Math.floor((s % 3600) / 60)) + ':' + _hPad(s % 60);
}
function _hFecha(v) {
  if (typeof v === 'number') return horariosSerialATexto(v);
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v.getFullYear() + '-' + _hPad(v.getMonth() + 1) + '-' + _hPad(v.getDate()) + ' ' + _hPad(v.getHours()) + ':' + _hPad(v.getMinutes()) + ':' + _hPad(v.getSeconds());
  var t = String(v == null ? '' : v).trim();
  return t || null;
}

// aoa (hoja como arreglo de arreglos, con valores crudos) -> { filas, dias, mesUnico } o { error }.
function horariosFilasDesdeHoja(aoa) {
  if (!aoa || !aoa.length) return { error: 'El archivo está vacío.' };
  var enc = (aoa[0] || []).map(function (h) { return String(h == null ? '' : h).trim().toUpperCase(); });
  var idx = {};
  HORARIOS_COLUMNAS.forEach(function (c) { idx[c] = enc.indexOf(c); });
  var faltan = HORARIOS_COLUMNAS.filter(function (c) { return idx[c] < 0; });
  if (faltan.length) return { error: 'Faltan columnas: ' + faltan.join(', ') + '. Sube el reporte de Login/Logout de Wolkvox tal cual.' };
  var filas = [], dias = {};
  for (var i = 1; i < aoa.length; i++) {
    var r = aoa[i];
    if (!r || r.every(function (v) { return v === null || v === undefined || v === ''; })) continue;
    var login = _hFecha(r[idx.LOGIN]);
    if (!login) return { error: 'Fila ' + (i + 1) + ': LOGIN vacío o ilegible.' };
    var f = {
      agent_id: String(r[idx.AGENT_ID] == null ? '' : r[idx.AGENT_ID]).trim(),
      agent_name: String(r[idx.AGENT_NAME] == null ? '' : r[idx.AGENT_NAME]).trim(),
      date: (_hFecha(r[idx.DATE]) || login).slice(0, 10),
      login: login,
      logout: _hFecha(r[idx.LOGOUT]) || '',
      login_time: horariosDuracionATexto(r[idx.LOGIN_TIME]),
    };
    filas.push(f);
    dias[login.slice(0, 10)] = true;
  }
  if (!filas.length) return { error: 'El archivo no trae filas.' };
  var listaDias = Object.keys(dias).sort();
  var meses = {};
  listaDias.forEach(function (d) { meses[d.slice(0, 7)] = true; });
  var mesesLista = Object.keys(meses);
  return { filas: filas, dias: listaDias, mesUnico: mesesLista.length === 1 ? mesesLista[0] : null };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { HORARIOS_COLUMNAS: HORARIOS_COLUMNAS, horariosSerialATexto: horariosSerialATexto, horariosDuracionATexto: horariosDuracionATexto, horariosFilasDesdeHoja: horariosFilasDesdeHoja };
}
