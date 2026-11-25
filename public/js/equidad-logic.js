// equidad-logic.js — «Equidad profesionales» de ORLANT (pedido de Edwin, llamada del 24/11/2026). Lógica PURA
// (sin DOM): doble modo, global en el navegador y require() en Node (pruebas y servidor).
//
// Tres bases, una por pestaña: Pólizas, Medicina prepagada y Particulares. Mismos campos que el HTML de Edwin
// (CODIGO_SEDE, ESPNOM, MEDNOM, FECHA_CITA, NOMBRE_ENTIDAD), reconocidos por el encabezado sin importar
// mayúsculas ni tildes, en la primera hoja que los traiga (la tabla dinámica de Pólizas se ignora).
// Particulares NO trae «Entidad»: no es un error, y si una columna de entidad o de paciente llega en esa base,
// se descarta en memoria (ahí iría el nombre del paciente). Solo se guarda sede, especialidad, profesional,
// fecha y, en Pólizas y Medicina prepagada, la entidad.
'use strict';

var EQ_GRUPOS = [
  { id: 'polizas', nombre: 'Pólizas', conEntidad: true },
  { id: 'prepagada', nombre: 'Medicina prepagada', conEntidad: true },
  { id: 'particulares', nombre: 'Particulares', conEntidad: false },
];
// Columnas aceptadas (las mismas del HTML de Edwin).
var EQ_COLS = {
  sede: ['CODIGO_SEDE', 'SEDE'],
  esp: ['ESPNOM', 'ESPECIALIDAD'],
  prof: ['MEDNOM', 'PROFESIONAL', 'MEDICO', 'NOMBRE_MEDICO'],
  fecha: ['FECHA_CITA', 'FECHA'],
  ent: ['NOMBRE_ENTIDAD', 'ENTIDAD'],
};
var EQ_MAX_FILAS = 50000;
var EQ_MAX_TEXTO = 120;
var EQ_TOLERANCIA = 0.2; // ±20 % del promedio, como el HTML de Edwin

function eqGrupo(id) { for (var i = 0; i < EQ_GRUPOS.length; i++) if (EQ_GRUPOS[i].id === id) return EQ_GRUPOS[i]; return null; }
function eqNorm(s) { return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim(); }
function eqLimpio(s) { return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().slice(0, EQ_MAX_TEXTO); }
function _eqPad(n) { return String(n).padStart(2, '0'); }

// Fecha de la cita -> 'AAAA-MM-DD' (Date, serial de Excel o texto AAAA-MM-DD / DD/MM/AAAA). '' si no se entiende.
function eqFecha(v) {
  if (v === null || v === undefined || v === '') return '';
  if (v instanceof Date) return isNaN(v.getTime()) ? '' : v.getFullYear() + '-' + _eqPad(v.getMonth() + 1) + '-' + _eqPad(v.getDate());
  if (typeof v === 'number' && isFinite(v)) { var d = new Date(Math.round((v - 25569) * 864e5)); return d.getUTCFullYear() + '-' + _eqPad(d.getUTCMonth() + 1) + '-' + _eqPad(d.getUTCDate()); }
  var s = String(v).trim();
  var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return m[1] + '-' + _eqPad(m[2]) + '-' + _eqPad(m[3]);
  m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (m) return m[3] + '-' + _eqPad(m[2]) + '-' + _eqPad(m[1]);
  return '';
}
function eqFechaValida(f) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f)) return false;
  var d = new Date(f + 'T00:00:00Z');
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === f;
}

// Una hoja (arreglo de filas) -> { ok, filas, avisos } o { ok:false }. Busca el encabezado en las 15 primeras filas.
function eqLeerHoja(aoa, grupoId) {
  var g = eqGrupo(grupoId);
  if (!g) return { ok: false, error: 'Base desconocida' };
  aoa = aoa || [];
  for (var h = 0; h < Math.min(aoa.length, 15); h++) {
    var hdr = (aoa[h] || []).map(eqNorm);
    var idx = {};
    Object.keys(EQ_COLS).forEach(function (k) { idx[k] = hdr.findIndex(function (c) { return EQ_COLS[k].indexOf(c) !== -1; }); });
    if (idx.prof < 0 || idx.fecha < 0) continue;
    if (!g.conEntidad) idx.ent = -1; // Particulares: la entidad (o el paciente) nunca se lee
    var filas = [], sinFecha = 0;
    for (var i = h + 1; i < aoa.length; i++) {
      var r = aoa[i] || [];
      var prof = eqLimpio(r[idx.prof]);
      if (!prof) continue;
      var fecha = eqFecha(r[idx.fecha]);
      if (!eqFechaValida(fecha)) { sinFecha++; continue; }
      filas.push({
        sede: idx.sede >= 0 ? (eqLimpio(r[idx.sede]) || '(Sin sede)') : '(Sin sede)',
        esp: idx.esp >= 0 ? (eqLimpio(r[idx.esp]) || '(Sin especialidad)') : '(Sin especialidad)',
        prof: prof,
        fecha: fecha,
        ent: idx.ent >= 0 ? eqLimpio(r[idx.ent]) : '',
      });
    }
    var avisos = [];
    if (sinFecha) avisos.push(sinFecha + (sinFecha === 1 ? ' fila sin fecha de cita válida quedó' : ' filas sin fecha de cita válida quedaron') + ' fuera.');
    if (g.conEntidad && idx.ent < 0) avisos.push('El archivo no trae la columna de entidad (NOMBRE_ENTIDAD): el filtro de entidad queda vacío.');
    if (idx.sede < 0) avisos.push('El archivo no trae la columna de sede (CODIGO_SEDE).');
    if (idx.esp < 0) avisos.push('El archivo no trae la columna de especialidad (ESPNOM).');
    return { ok: true, filas: filas, avisos: avisos };
  }
  return { ok: false };
}

// Libro completo: la primera hoja que tenga profesional y fecha (como el HTML de Edwin).
// hojas = [{ nombre, aoa }].
function eqLeerLibro(hojas, grupoId) {
  for (var i = 0; i < (hojas || []).length; i++) {
    var r = eqLeerHoja(hojas[i].aoa, grupoId);
    if (r.error) return r;
    if (r.ok) {
      if (!r.filas.length) return { ok: false, error: 'La hoja «' + hojas[i].nombre + '» no tiene citas con profesional y fecha.' };
      if (r.filas.length > EQ_MAX_FILAS) return { ok: false, error: 'La base pasa de ' + EQ_MAX_FILAS + ' citas.' };
      r.hoja = hojas[i].nombre;
      return r;
    }
  }
  return { ok: false, error: 'No encontré una hoja con las columnas del profesional y la fecha de la cita (MEDNOM y FECHA_CITA).' };
}

// Revisión del servidor: cada fila con la forma exacta, textos acotados y fechas reales. Lanza Error si algo no cuadra.
function eqValidarFilas(filas, grupoId) {
  var g = eqGrupo(grupoId);
  if (!g) throw new Error('Base desconocida');
  if (!Array.isArray(filas) || !filas.length) throw new Error('La base no trae citas');
  if (filas.length > EQ_MAX_FILAS) throw new Error('La base pasa de ' + EQ_MAX_FILAS + ' citas');
  return filas.map(function (f, i) {
    if (!f || typeof f !== 'object') throw new Error('Fila ' + (i + 1) + ' inválida');
    var x = { sede: eqLimpio(f.sede) || '(Sin sede)', esp: eqLimpio(f.esp) || '(Sin especialidad)', prof: eqLimpio(f.prof), fecha: String(f.fecha || ''), ent: g.conEntidad ? eqLimpio(f.ent) : '' };
    if (!x.prof) throw new Error('Fila ' + (i + 1) + ' sin profesional');
    if (!eqFechaValida(x.fecha)) throw new Error('Fila ' + (i + 1) + ' con fecha inválida');
    return x;
  });
}

// Lista de entidades configurable (Isa la pasa a Edwin): { 'NOMBRE NORMALIZADO': 'polizas'|'prepagada' }.
// Devuelve las entidades de la base que la lista asigna a OTRA base (aviso, no bloquea).
function eqEntidadesDeOtraBase(filas, grupoId, mapa) {
  var cont = {};
  (filas || []).forEach(function (f) {
    if (!f.ent) return;
    var dest = mapa && mapa[eqNorm(f.ent)];
    if (dest && dest !== grupoId) cont[f.ent] = (cont[f.ent] || 0) + 1;
  });
  return Object.keys(cont).sort(function (a, b) { return a.localeCompare(b, 'es'); }).map(function (e) { return { entidad: e, citas: cont[e], base: mapa[eqNorm(e)] }; });
}

// Cálculos del HTML de Edwin (analyze): por profesional, promedio equitativo, 1 − Gini y la clasificación
// sobreasignado / equitativo / baja asignación con ±20 %.
function eqGini(vals) {
  var v = vals.filter(function (x) { return x >= 0; }).sort(function (a, b) { return a - b; });
  var n = v.length; if (n < 2) return 0;
  var s = v.reduce(function (a, b) { return a + b; }, 0); if (!s) return 0;
  var cum = 0; v.forEach(function (x, i) { cum += (i + 1) * x; });
  return (2 * cum) / (n * s) - (n + 1) / n;
}
function eqAnalizar(filas, tol) {
  tol = tol == null ? EQ_TOLERANCIA : tol;
  var mapa = {};
  (filas || []).forEach(function (r) { var p = mapa[r.prof] || (mapa[r.prof] = { prof: r.prof, n: 0 }); p.n++; });
  var lista = Object.keys(mapa).map(function (k) { return mapa[k]; });
  var total = (filas || []).length;
  var ideal = lista.length ? total / lista.length : 0;
  lista.forEach(function (p) {
    p.devp = ideal ? (p.n - ideal) / ideal : 0;
    p.estado = p.devp > tol ? 'over' : (p.devp < -tol ? 'under' : 'ok');
  });
  lista.sort(function (a, b) { return b.n - a.n || a.prof.localeCompare(b.prof, 'es'); });
  var g = eqGini(lista.map(function (p) { return p.n; }));
  return { total: total, profesionales: lista.length, ideal: ideal, equidad: 1 - g, lista: lista };
}

var EQ_ESTADO_TEXTO = { ok: 'Equitativo', over: 'Sobreasignado', under: 'Baja asignación' };

// ── Pedido de Edwin (26/11/2026): cada base se carga POR MES ──
// Mes = «AAAA-MM» de la fecha de la cita. eqMesesDe cuenta las citas por mes; eqFiltrarMeses deja las de los meses
// pedidos (lista vacía = todos, el acumulado).
function eqMesValido(m) { return typeof m === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(m); }
function eqMesDe(fecha) { var m = String(fecha || '').slice(0, 7); return eqMesValido(m) ? m : ''; }
function eqMesesDe(filas) {
  var c = {};
  (filas || []).forEach(function (f) { var m = eqMesDe(f && f.fecha); if (m) c[m] = (c[m] || 0) + 1; });
  return c;
}
function eqFiltrarMeses(filas, meses) {
  if (!meses || !meses.length) return (filas || []).slice();
  var s = {}; meses.forEach(function (m) { s[m] = true; });
  return (filas || []).filter(function (f) { return s[eqMesDe(f && f.fecha)]; });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { EQ_GRUPOS: EQ_GRUPOS, EQ_COLS: EQ_COLS, EQ_MAX_FILAS: EQ_MAX_FILAS, EQ_TOLERANCIA: EQ_TOLERANCIA, EQ_ESTADO_TEXTO: EQ_ESTADO_TEXTO,
    eqGrupo: eqGrupo, eqNorm: eqNorm, eqFecha: eqFecha, eqFechaValida: eqFechaValida, eqLeerHoja: eqLeerHoja, eqLeerLibro: eqLeerLibro,
    eqValidarFilas: eqValidarFilas, eqEntidadesDeOtraBase: eqEntidadesDeOtraBase, eqGini: eqGini, eqAnalizar: eqAnalizar,
    eqMesValido: eqMesValido, eqMesDe: eqMesDe, eqMesesDe: eqMesesDe, eqFiltrarMeses: eqFiltrarMeses };
}
