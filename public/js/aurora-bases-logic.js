// aurora-bases-logic.js — Fase 306 (10/11/2026, Clinica Aurora): lectura y
// calculos de las 2 bases nuevas, sin DOM (doble modo global/Node).
//   Inasistencia: «BASE PARA SACAR INASISTENCIAS» -> por especialidad,
//     % inasistencia = filas con ESTADO «No asistió» / total de filas × 100.
//   Encuestas:    «COMPILADO ENCUESTAS» -> encuestas por entidad y por fecha;
//     las filas sin entidad no se grafican.
// Cada columna se busca por NOMBRE (sin importar mayusculas, tildes, espacios,
// guiones bajos ni puntos; auNormEncabezado), nunca por posicion. Solo se leen
// las columnas de los mapas de abajo: nombres, cedulas, telefonos y
// observaciones de los pacientes NUNCA salen del navegador.
'use strict';

var _abAu = (typeof module !== 'undefined' && module.exports && typeof auNormEncabezado === 'undefined')
  ? require('./agendas-usuaria-logic.js')
  : { auNormEncabezado: auNormEncabezado, auFecha: auFecha };
// Texto de una celda: espacios normalizados, a lo sumo 160 letras ('' si vacia).
function _abTexto(v, vacio) { return String(v === null || v === undefined ? '' : v).replace(/\s+/g, ' ').trim().slice(0, 160) || vacio; }

// ── MAPAS DE ENCABEZADOS (el unico lugar que se toca si cambia un nombre) ──
var INA_MAPA_ENCABEZADOS = [
  { key: 'fecha', etiqueta: 'Fecha', obligatoria: true, sinonimos: ['fecha', 'fecha cita', 'fecha de la cita', 'fechacita'] },
  { key: 'especialidad', etiqueta: 'Especialidad', obligatoria: true, sinonimos: ['especialidad', 'especial'] },
  { key: 'estado', etiqueta: 'Estado', obligatoria: true, sinonimos: ['estado', 'estado cita', 'estado de la cita'] },
];
// Valores de ESTADO que cuentan como inasistencia (comparados sin tildes ni mayusculas).
var INA_ESTADOS_NO_ASISTIO = ['no asistio', 'no asistió', 'inasistencia', 'inasistio'];
var ENC_MAPA_ENCABEZADOS = [
  { key: 'fecha', etiqueta: 'Fecha', obligatoria: true, sinonimos: ['fecha', 'fecha encuesta', 'fecha de la encuesta'] },
  { key: 'entidad', etiqueta: 'Entidad', obligatoria: true, sinonimos: ['entidad', 'eps', 'aseguradora', 'nombre entidad'] },
];

function _abIndices(header, mapa) {
  var norm = (header || []).map(_abAu.auNormEncabezado);
  var map = {};
  mapa.forEach(function (c) {
    for (var s = 0; s < c.sinonimos.length && map[c.key] === undefined; s++) {
      var i = norm.indexOf(_abAu.auNormEncabezado(c.sinonimos[s]));
      if (i !== -1) map[c.key] = i;
    }
  });
  return map;
}
function _abFaltan(map, mapa) { return mapa.filter(function (c) { return c.obligatoria && map[c.key] === undefined; }); }
function _abEncabezado(aoa, mapa) {
  var mejor = null;
  for (var r = 0; r < Math.min(20, (aoa || []).length); r++) {
    var m = _abIndices(aoa[r], mapa);
    if (!_abFaltan(m, mapa).length) return { fila: r, map: m };
    if (!mejor || Object.keys(m).length > Object.keys(mejor).length) mejor = m;
  }
  return { fila: -1, faltan: _abFaltan(mejor || {}, mapa) };
}
function _abError(faltan, archivo) {
  return 'En el archivo «' + (archivo || 'sin nombre') + '» ' + (faltan.length === 1 ? 'falta la columna ' : 'faltan las columnas ') +
    faltan.map(function (c) { return '«' + c.etiqueta + '» (se busca como: ' + c.sinonimos.join(', ') + ')'; }).join('; ') + '.';
}
function _abVacia(row) { return !row || !row.some(function (c) { return c !== null && c !== undefined && String(c).trim() !== ''; }); }
function inaEsNoAsistio(estado) {
  var e = _abAu.auNormEncabezado(estado);
  return INA_ESTADOS_NO_ASISTIO.some(function (x) { return _abAu.auNormEncabezado(x) === e; });
}

// -> { filas:[{mes,especialidad,total,noAsistio}], citas, noAsistio, estados:{ESTADO:n}, meses:{}, avisos, error }
function inaParse(aoa, archivo) {
  var h = _abEncabezado(aoa, INA_MAPA_ENCABEZADOS);
  if (h.fila === -1) return { error: _abError(h.faltan, archivo), filas: [] };
  var agg = {}, out = { citas: 0, noAsistio: 0, estados: {}, meses: {}, avisos: [], sinFecha: 0, sinEspecialidad: 0 };
  for (var i = h.fila + 1; i < aoa.length; i++) {
    var row = aoa[i];
    if (_abVacia(row)) continue;
    var f = _abAu.auFecha(row[h.map.fecha]);
    if (!f) { out.sinFecha++; continue; }
    var esp = _abTexto(row[h.map.especialidad], '');
    if (!esp) { out.sinEspecialidad++; continue; }
    var estado = _abTexto(row[h.map.estado], '(vacío)');
    out.estados[estado] = (out.estados[estado] || 0) + 1;
    var mes = f.slice(0, 7), k = mes + '\u0001' + esp;
    var a = agg[k] || (agg[k] = { mes: mes, especialidad: esp, total: 0, noAsistio: 0 });
    a.total++;
    if (inaEsNoAsistio(estado)) { a.noAsistio++; out.noAsistio++; }
    out.citas++;
    out.meses[mes] = (out.meses[mes] || 0) + 1;
  }
  if (out.sinFecha) out.avisos.push(out.sinFecha + ' fila(s) sin fecha válida: no se cuentan.');
  if (out.sinEspecialidad) out.avisos.push(out.sinEspecialidad + ' fila(s) sin especialidad: no se cuentan.');
  out.filas = Object.keys(agg).map(function (k) { return agg[k]; });
  return out;
}

// -> { filas:[{mes,fecha,entidad,n}], encuestas, sinEntidad, entidades:{}, meses:{}, avisos, error }
function encParse(aoa, archivo) {
  var h = _abEncabezado(aoa, ENC_MAPA_ENCABEZADOS);
  if (h.fila === -1) return { error: _abError(h.faltan, archivo), filas: [] };
  // La base de citas/inasistencias tambien trae fecha y entidad: si trae estado y
  // especialidad, es esa base y no el compilado de encuestas (Fase 306).
  var deCitas = _abIndices(aoa[h.fila], INA_MAPA_ENCABEZADOS);
  if (deCitas.estado !== undefined && deCitas.especialidad !== undefined) {
    return { error: 'El archivo «' + (archivo || 'sin nombre') + '» parece la base de citas o inasistencias (trae «Estado» y «Especialidad»), no el compilado de encuestas. Súbalo en «Inasistencia (Aurora)».', filas: [] };
  }
  var agg = {}, out = { encuestas: 0, sinEntidad: 0, sinFecha: 0, entidades: {}, meses: {}, avisos: [] };
  for (var i = h.fila + 1; i < aoa.length; i++) {
    var row = aoa[i];
    if (_abVacia(row)) continue;
    var f = _abAu.auFecha(row[h.map.fecha]);
    if (!f) { out.sinFecha++; continue; }
    var ent = _abTexto(row[h.map.entidad], '');
    if (!ent) { out.sinEntidad++; continue; } // las filas sin entidad no se grafican
    var k = f + '\u0001' + ent;
    var a = agg[k] || (agg[k] = { mes: f.slice(0, 7), fecha: f, entidad: ent, n: 0 });
    a.n++;
    out.encuestas++;
    out.entidades[ent] = (out.entidades[ent] || 0) + 1;
    out.meses[f.slice(0, 7)] = (out.meses[f.slice(0, 7)] || 0) + 1;
  }
  if (out.sinFecha) out.avisos.push(out.sinFecha + ' fila(s) sin fecha válida: no se cuentan.');
  if (out.sinEntidad) out.avisos.push(out.sinEntidad + ' encuesta(s) sin entidad: no se grafican.');
  out.filas = Object.keys(agg).map(function (k) { return agg[k]; });
  return out;
}

// ── Vistas ──
function _abDelMes(filas, meses) {
  return (filas || []).filter(function (r) { return !meses || !meses.length || meses.indexOf(r.mes) !== -1; });
}
// % inasistencia por especialidad (sumando los meses elegidos), de mayor a menor.
function inaPorEspecialidad(filas, meses) {
  var acc = {};
  _abDelMes(filas, meses).forEach(function (r) {
    var a = acc[r.especialidad] || (acc[r.especialidad] = { especialidad: r.especialidad, total: 0, noAsistio: 0 });
    a.total += r.total; a.noAsistio += r.noAsistio;
  });
  return Object.keys(acc).map(function (k) {
    var a = acc[k];
    a.pct = a.total ? Math.round(a.noAsistio / a.total * 1000) / 10 : 0;
    return a;
  }).sort(function (x, y) { return y.pct - x.pct || y.total - x.total || (x.especialidad < y.especialidad ? -1 : 1); });
}
// Encuestas por entidad, de mayor a menor.
function encPorEntidad(filas, meses) {
  var acc = {};
  _abDelMes(filas, meses).forEach(function (r) { acc[r.entidad] = (acc[r.entidad] || 0) + r.n; });
  return Object.keys(acc).map(function (k) { return { entidad: k, n: acc[k] }; })
    .sort(function (x, y) { return y.n - x.n || (x.entidad < y.entidad ? -1 : 1); });
}
// Encuestas por fecha (linea de tiempo).
function encPorFecha(filas, meses) {
  var acc = {};
  _abDelMes(filas, meses).forEach(function (r) { acc[r.fecha] = (acc[r.fecha] || 0) + r.n; });
  return Object.keys(acc).sort().map(function (k) { return { fecha: k, n: acc[k] }; });
}
// ── Fase 320 (pedido de Edwin, 10/11): vistas por mes ──
// Meses que se muestran: los elegidos en MESES que tienen datos; sin eleccion, todos.
function abMesesConDatos(filas, meses) {
  var con = {};
  _abDelMes(filas, meses).forEach(function (r) { con[r.mes] = true; });
  return Object.keys(con).sort();
}
// % de inasistencia por mes = «No asistió» del mes ÷ total de citas del mes (la misma
// formula de siempre, aplicada a cada mes). -> [{ mes, total, noAsistio, pct }]
function inaPorMes(filas, meses) {
  var acc = {};
  _abDelMes(filas, meses).forEach(function (r) {
    var a = acc[r.mes] || (acc[r.mes] = { mes: r.mes, total: 0, noAsistio: 0 });
    a.total += r.total; a.noAsistio += r.noAsistio;
  });
  return Object.keys(acc).sort().map(function (k) {
    var a = acc[k];
    a.pct = a.total ? Math.round(a.noAsistio / a.total * 1000) / 10 : 0;
    return a;
  });
}
// Promedio de los meses (promedio simple de los % mensuales), 1 decimal; null sin meses.
function abPromedio(valores) {
  var v = (valores || []).filter(function (x) { return x !== null && x !== undefined && isFinite(x); });
  if (!v.length) return null;
  return Math.round(v.reduce(function (s, x) { return s + x; }, 0) / v.length * 10) / 10;
}
// Encuestas por mes. -> [{ mes, n }]
function encPorMes(filas, meses) {
  var acc = {};
  _abDelMes(filas, meses).forEach(function (r) { acc[r.mes] = (acc[r.mes] || 0) + r.n; });
  return Object.keys(acc).sort().map(function (k) { return { mes: k, n: acc[k] }; });
}

// "5,7 %"
function abPct(v) { return (Math.round(v * 10) / 10).toLocaleString('es-CO', { maximumFractionDigits: 1, minimumFractionDigits: 1 }) + ' %'; }

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { INA_MAPA_ENCABEZADOS: INA_MAPA_ENCABEZADOS, ENC_MAPA_ENCABEZADOS: ENC_MAPA_ENCABEZADOS, INA_ESTADOS_NO_ASISTIO: INA_ESTADOS_NO_ASISTIO,
    inaEsNoAsistio: inaEsNoAsistio, inaParse: inaParse, encParse: encParse, inaPorEspecialidad: inaPorEspecialidad,
    encPorEntidad: encPorEntidad, encPorFecha: encPorFecha, abPct: abPct,
    abMesesConDatos: abMesesConDatos, inaPorMes: inaPorMes, abPromedio: abPromedio, encPorMes: encPorMes }; // Fase 320
}
