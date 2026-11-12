// calidad-listas-logic.js — Fase 348 (reunion con Edwin del 12/11, punto C). Logica pura de las
// listas largas del Modulo de Calidad (Monitoreos, Detalle por mes, Calidad de encuestas): cuantas
// filas por pagina (10 por defecto, o 20) y que pagina se ve. Sin DOM: se prueba en node.
// La parte de la pagina (controles, estado por lista) vive en calidad-listas.js.
'use strict';

var CL_TAMANOS = [10, 20];
var CL_TAMANO_DEFECTO = 10;

// Cualquier valor que no sea 10 o 20 vuelve a 10.
function clTamano(v) {
  var n = Number(v);
  return CL_TAMANOS.indexOf(n) !== -1 ? n : CL_TAMANO_DEFECTO;
}

// Pagina segura (1..paginas) y el corte [desde, hasta) de la lista. Sin filas: 1 pagina vacia.
function clPaginar(total, pagina, porPagina) {
  var t = Math.max(0, Math.floor(Number(total)) || 0);
  var pp = clTamano(porPagina);
  var paginas = Math.max(1, Math.ceil(t / pp));
  var p = Math.floor(Number(pagina)) || 1;
  if (p < 1) p = 1;
  if (p > paginas) p = paginas;
  var desde = (p - 1) * pp;
  return { total: t, porPagina: pp, paginas: paginas, pagina: p, desde: desde, hasta: Math.min(desde + pp, t) };
}

// «11–20 de 53»; sin filas, «0 de 0».
function clTextoRango(pg) {
  if (!pg || !pg.total) return '0 de 0';
  return (pg.desde + 1) + '–' + pg.hasta + ' de ' + pg.total;
}

// Numeros de pagina para los botones: siempre la primera, la ultima y las vecinas de la actual;
// los huecos van como '…'. Ej.: (6, 12) -> [1, '…', 5, 6, 7, '…', 12].
function clPaginasVisibles(pagina, paginas) {
  var n = Math.max(1, Math.floor(Number(paginas)) || 1);
  var p = Math.min(Math.max(1, Math.floor(Number(pagina)) || 1), n);
  var set = {};
  [1, n, p - 1, p, p + 1].forEach(function (x) { if (x >= 1 && x <= n) set[x] = true; });
  var nums = Object.keys(set).map(Number).sort(function (a, b) { return a - b; });
  var out = [];
  nums.forEach(function (x, i) {
    if (i > 0) {
      var prev = nums[i - 1];
      if (x - prev === 2) out.push(prev + 1); // hueco de una sola pagina: se muestra el numero
      else if (x - prev > 2) out.push('…');
    }
    out.push(x);
  });
  return out;
}

// ---- Fase 348 (C2): buscador por ID, nombre del asesor, fecha de la llamada y telefono ----
// Sin tildes, sin mayusculas y sin el apostrofo inicial que Wolkvox pone a los ID.
function clNorm(s) {
  return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim().replace(/^'+/, '');
}
function clDigitos(s) { return String(s == null ? '' : s).replace(/\D+/g, ''); }

// 'AAAA-MM-DD' (con o sin hora) -> las formas en que alguien la escribe: 2026-11-05, 05/11/2026,
// 5/11/2026, 05/11, 5/11, 05-11-2026.
function clFechaVariantes(f) {
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(f || ''));
  if (!m) return f ? [clNorm(f)] : [];
  var a = m[1], mm = m[2], dd = m[3], d = String(Number(dd)), mn = String(Number(mm));
  return [a + '-' + mm + '-' + dd, dd + '/' + mm + '/' + a, d + '/' + mn + '/' + a, dd + '/' + mm, d + '/' + mn, d + '/' + mm, dd + '-' + mm + '-' + a];
}

// campos = { ids: [], nombres: [], fechas: [], telefonos: [] }. El telefono solo cuenta con
// opts.telefono (quien califica; ademas el servidor nunca manda el campo a los demas) y con 3 o
// mas cifras en la busqueda.
function clCoincide(campos, q, opts) {
  var t = clNorm(q);
  if (!t) return true;
  var c = campos || {};
  var en = function (arr, fn) { return (arr || []).some(function (v) { return v != null && v !== '' && fn(v); }); };
  if (en(c.ids, function (v) { return clNorm(v).indexOf(t) !== -1; })) return true;
  if (en(c.nombres, function (v) { return clNorm(v).indexOf(t) !== -1; })) return true;
  if (en(c.fechas, function (v) { return clFechaVariantes(v).some(function (x) { return x.indexOf(t) !== -1; }); })) return true;
  if (opts && opts.telefono) {
    var dq = clDigitos(t);
    if (dq.length >= 3 && dq.length === t.replace(/[\s()+.-]/g, '').length &&
      en(c.telefonos, function (v) { return clDigitos(v).indexOf(dq) !== -1; })) return true;
  }
  return false;
}
function clFiltrar(lista, q, extraer, opts) {
  if (!clNorm(q)) return (lista || []).slice();
  return (lista || []).filter(function (x) { return clCoincide(extraer(x), q, opts); });
}
// Campos de un monitoreo (Monitoreos y Detalle por mes).
function clCamposMonitoreo(m) {
  m = m || {};
  return { ids: [m.idLlamada, m.encuestaConnId, m.id != null ? String(m.id) : ''], nombres: [m.asesor], fechas: [m.fechaLlamada, m.fecha], telefonos: [m.telefono] };
}
// Campos de una fila de Calidad de encuestas.
function clCamposEncuesta(f) {
  f = f || {};
  var mon = f.monitoreo || {};
  return { ids: [f.connId], nombres: [f.agente], fechas: [f.fecha, mon.fecha], telefonos: [f.telefono] };
}
// Roles que ven y buscan el telefono (la misma lista de server/auth.js: puedeVerTelefono).
var CL_ROLES_TELEFONO = ['CALIDAD', 'SUPERVISOR', 'REPORTES'];
function clPuedeBuscarTelefono(usuario, esAdmin) {
  return !!esAdmin || (!!usuario && CL_ROLES_TELEFONO.indexOf(usuario.rol) !== -1);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CL_TAMANOS: CL_TAMANOS, CL_TAMANO_DEFECTO: CL_TAMANO_DEFECTO, clTamano: clTamano, clPaginar: clPaginar, clTextoRango: clTextoRango, clPaginasVisibles: clPaginasVisibles,
    clNorm: clNorm, clFechaVariantes: clFechaVariantes, clCoincide: clCoincide, clFiltrar: clFiltrar, clCamposMonitoreo: clCamposMonitoreo, clCamposEncuesta: clCamposEncuesta,
    CL_ROLES_TELEFONO: CL_ROLES_TELEFONO, clPuedeBuscarTelefono: clPuedeBuscarTelefono };
}
