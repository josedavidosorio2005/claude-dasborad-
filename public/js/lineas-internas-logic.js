// lineas-internas-logic.js — Fase 311 (10/11/2026, Clinica Aurora): pestaña
// «Gestión líneas internas» (la operacion interna de la clinica en Wolkvox),
// montada APARTE de las pestañas actuales de Aurora. Tres bases propias:
//   - flujo:    HistQueue (flujo de llamadas por area/skill y dia).
//   - cdr:      HistCDR   (tipificacion de llamadas; SKILL_NAME «-» = salida).
//   - whatsapp: HistChat  (tipificacion de WhatsApp; el skill viene solo con codigo).
// Logica PURA (sin DOM), doble modo global/Node. Cada columna se busca por
// NOMBRE de encabezado (auNormEncabezado), nunca por posicion. Solo se leen las
// columnas de los mapas de abajo: telefono, cedula, CUSTOMER_ID, CONN_ID,
// comentarios y demas datos sensibles NUNCA salen del navegador. Al servidor
// llegan solo conteos agregados.
'use strict';

var _liAu = (typeof module !== 'undefined' && module.exports && typeof auNormEncabezado === 'undefined')
  ? require('./agendas-usuaria-logic.js')
  : { auNormEncabezado: auNormEncabezado, auFecha: auFecha };

// ── MAPA CODIGO DE SKILL -> NOMBRE (lo unico que se toca si el supervisor
// cambia o agrega un skill). `alias`: como lo escribe la base de flujo
// (SKILL_NAME), comparado sin tildes ni mayusculas. En pantalla siempre sale
// `nombre`; un codigo que no este aqui sale como «Skill <codigo>».
var LI_SKILLS = [
  { codigo: '4170', nombre: 'Área Enfermería', alias: ['AREA ENFERMERIA'] },
  { codigo: '4165', nombre: 'Área Farmacia', alias: ['AREA FARMACIA'] },
  { codigo: '4169', nombre: 'Área Patología', alias: ['AREA PATOLOGIA'] },
  { codigo: '4166', nombre: 'Área Programación', alias: ['AREA PROGRAMACION'] },
  { codigo: '4171', nombre: 'Área Reportes Médicos', alias: ['AREA REPORTES MEDICOS'] },
];
// Las llamadas de salida del CDR traen SKILL_ID y SKILL_NAME «-» (sin area).
var LI_SKILL_SALIDA = 'SALIDA';
var LI_NOMBRE_SALIDA = 'Llamadas de salida';
// Filas de prueba que no se cuentan (igual que la Tipificación de Aurora).
var LI_EXCLUIR = ['PRUEBA'];

var LI_MAPA_FLUJO = [
  { key: 'skill', etiqueta: 'Skill', obligatoria: false, sinonimos: ['skill name', 'skill', 'area', 'nombre de skill'] },
  { key: 'skillId', etiqueta: 'Skill id', obligatoria: false, sinonimos: ['skill id'] },
  { key: 'fecha', etiqueta: 'Fecha', obligatoria: true, sinonimos: ['date', 'fecha'] },
  { key: 'total', etiqueta: 'Llamadas entrantes', obligatoria: true, sinonimos: ['inbound calls', 'total llamadas', 'llamadas recibidas'] },
  { key: 'contestadas', etiqueta: 'Contestadas', obligatoria: true, sinonimos: ['answer calls', 'contestadas', 'llamadas contestadas'] },
  { key: 'abandonadas', etiqueta: 'Abandonadas', obligatoria: true, sinonimos: ['abandon calls', 'abandonadas', 'llamadas abandonadas'] },
  { key: 'nivelServicio', etiqueta: 'Nivel de servicio', obligatoria: false, sinonimos: ['service level 20sec', 'nivel de servicio'] },
];
var LI_MAPA_CDR = [
  { key: 'agente', etiqueta: 'Agente', obligatoria: true, sinonimos: ['agent name', 'agente'] },
  { key: 'fecha', etiqueta: 'Fecha', obligatoria: true, sinonimos: ['date', 'fecha'] },
  { key: 'tipificacion', etiqueta: 'Tipificación', obligatoria: true, sinonimos: ['description cod act', 'tipificacion'] },
  { key: 'skill', etiqueta: 'Skill', obligatoria: true, sinonimos: ['skill name', 'nombre de skill', 'skill'] },
  { key: 'skillId', etiqueta: 'Skill id', obligatoria: false, sinonimos: ['skill id'] },
];
// HistChat: el dia sale de DATE_CLOSE (Wolkvox arma el reporte por cierre, Fase 185).
var LI_MAPA_WHATSAPP = [
  { key: 'agente', etiqueta: 'Agente', obligatoria: true, sinonimos: ['agent name', 'agente'] },
  { key: 'fecha', etiqueta: 'Fecha de cierre', obligatoria: true, sinonimos: ['date close', 'date', 'fecha'] },
  { key: 'tipificacion', etiqueta: 'Tipificación', obligatoria: true, sinonimos: ['description cod act', 'tipificacion'] },
  { key: 'skillId', etiqueta: 'Skill', obligatoria: true, sinonimos: ['skill id', 'skill'] },
];

function _liN(s) { return _liAu.auNormEncabezado(s); }
function _liTexto(v) { return String(v === null || v === undefined ? '' : v).replace(/\s+/g, ' ').trim().slice(0, 160); }
function _liVacia(row) { return !row || !row.some(function (c) { return c !== null && c !== undefined && String(c).trim() !== ''; }); }
function _liIndices(header, mapa) {
  var norm = (header || []).map(_liN), map = {};
  mapa.forEach(function (c) {
    for (var s = 0; s < c.sinonimos.length && map[c.key] === undefined; s++) {
      var i = norm.indexOf(_liN(c.sinonimos[s]));
      if (i !== -1) map[c.key] = i;
    }
  });
  return map;
}
function _liEncabezado(aoa, mapa) {
  var mejor = {};
  for (var r = 0; r < Math.min(20, (aoa || []).length); r++) {
    var m = _liIndices(aoa[r], mapa);
    var faltan = mapa.filter(function (c) { return c.obligatoria && m[c.key] === undefined; });
    if (!faltan.length) return { fila: r, map: m };
    if (Object.keys(m).length > Object.keys(mejor).length) mejor = m;
  }
  return { fila: -1, faltan: mapa.filter(function (c) { return c.obligatoria && mejor[c.key] === undefined; }) };
}
function _liError(faltan, archivo, hoja) {
  return 'En el archivo «' + (archivo || 'sin nombre') + '»' + (hoja ? ' (hoja «' + hoja + '»)' : '') + ' ' + (faltan.length === 1 ? 'falta la columna ' : 'faltan las columnas ') +
    faltan.map(function (c) { return '«' + c.etiqueta + '» (se busca como: ' + c.sinonimos.join(', ') + ')'; }).join('; ') + '.';
}
// Numero de una celda («93.55 %», «1,234», 12) o null.
function _liNum(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return isFinite(v) ? v : null;
  var t = String(v).replace('%', '').replace(/,/g, '').trim();
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null;
  return Number(t);
}
function _liEsExcluida(tipif) { var t = _liN(tipif); return LI_EXCLUIR.some(function (x) { return _liN(x) === t; }); }

// ── Skills: codigo o nombre de la base -> clave guardada / nombre visible ──
// Clave guardada: el CODIGO del mapa si se reconoce (por codigo o por alias del
// nombre); si no, el codigo crudo; si tampoco hay codigo, el nombre tal cual.
function liClaveSkill(codigo, nombre) {
  var c = _liTexto(codigo), n = _liTexto(nombre);
  for (var k = 0; k < LI_SKILLS.length; k++) {
    var s = LI_SKILLS[k];
    if (c && c === s.codigo) return s.codigo;
    if (n && (_liN(n) === _liN(s.nombre) || s.alias.some(function (a) { return _liN(a) === _liN(n); }))) return s.codigo;
  }
  if (c && c !== '-') return c;
  return n;
}
function liNombreSkill(clave) {
  var v = _liTexto(clave);
  if (v === LI_SKILL_SALIDA) return LI_NOMBRE_SALIDA;
  for (var k = 0; k < LI_SKILLS.length; k++) if (LI_SKILLS[k].codigo === v) return LI_SKILLS[k].nombre;
  if (/^\d+$/.test(v)) return 'Skill ' + v;
  return v || 'Sin skill';
}
function liSkillConocido(clave) { return LI_SKILLS.some(function (s) { return s.codigo === clave; }); }
// «---» y «-»: sin tipificacion; el resto con «_» como espacio y mayuscula inicial.
function liEtiquetaTipificacion(t) {
  var v = _liTexto(t);
  if (!v || /^-+$/.test(v)) return 'Sin tipificación';
  return v.replace(/_/g, ' ').toLowerCase().replace(/(^|\s)(\S)/g, function (m, a, b) { return a + b.toUpperCase(); });
}

// ── A) Flujo (HistQueue). Una o varias hojas: si una hoja no trae columna de
// skill, el area sale del nombre de la hoja. -> { filas:[{mes,fecha,skill,total,
// contestadas,abandonadas,nivelServicio}], total, contestadas, abandonadas, porSkill, avisos, error }
function liFlujoParse(hojas, archivo) {
  var agg = {}, out = { total: 0, contestadas: 0, abandonadas: 0, porSkill: {}, avisos: [], hojasLeidas: 0 };
  var errores = [], sinFecha = 0;
  (hojas || []).forEach(function (h) {
    var aoa = h.aoa || [];
    var e = _liEncabezado(aoa, LI_MAPA_FLUJO);
    if (e.fila === -1) { if (!_liVacia(aoa[0])) errores.push(_liError(e.faltan, archivo, h.nombre)); return; }
    out.hojasLeidas++;
    for (var i = e.fila + 1; i < aoa.length; i++) {
      var row = aoa[i];
      if (_liVacia(row)) continue;
      var f = _liAu.auFecha(row[e.map.fecha]);
      if (!f) { sinFecha++; continue; }
      var nombre = e.map.skill !== undefined ? row[e.map.skill] : h.nombre;
      var skill = liClaveSkill(e.map.skillId !== undefined ? row[e.map.skillId] : '', nombre);
      if (!skill) continue;
      var k = f + '\u0001' + skill;
      var a = agg[k] || (agg[k] = { mes: f.slice(0, 7), fecha: f, skill: skill, total: 0, contestadas: 0, abandonadas: 0, nivelServicio: null, _ns: [] });
      var t = _liNum(row[e.map.total]) || 0, c = _liNum(row[e.map.contestadas]) || 0, ab = _liNum(row[e.map.abandonadas]) || 0;
      a.total += t; a.contestadas += c; a.abandonadas += ab;
      var ns = e.map.nivelServicio !== undefined ? _liNum(row[e.map.nivelServicio]) : null;
      if (ns !== null) a._ns.push(ns);
      out.total += t; out.contestadas += c; out.abandonadas += ab;
      var ps = out.porSkill[skill] || (out.porSkill[skill] = { total: 0, contestadas: 0, abandonadas: 0 });
      ps.total += t; ps.contestadas += c; ps.abandonadas += ab;
    }
  });
  if (!out.hojasLeidas) return { error: errores[0] || 'El archivo no trae hojas con datos.', filas: [] };
  if (sinFecha) out.avisos.push(sinFecha + ' fila(s) sin fecha válida: no se cuentan.');
  out.filas = Object.keys(agg).map(function (k) {
    var a = agg[k];
    if (a._ns.length) a.nivelServicio = Math.round(a._ns.reduce(function (s, x) { return s + x; }, 0) / a._ns.length * 100) / 100;
    delete a._ns;
    return a;
  });
  var raros = Object.keys(out.porSkill).filter(function (s) { return !liSkillConocido(s); });
  if (raros.length) out.avisos.push('Skill(s) fuera del mapa de nombres: ' + raros.map(liNombreSkill).join(', ') + '.');
  return out;
}

// ── B) y C) Tipificacion (HistCDR / HistChat) -> { filas:[{mes,agente,skill,tipo,
// tipificacion,n}], registros, excluidas, porSkill:{clave:n}, avisos, error }
function _liTipifParse(hojas, archivo, canal) {
  var mapa = canal === 'whatsapp' ? LI_MAPA_WHATSAPP : LI_MAPA_CDR;
  var agg = {}, out = { registros: 0, excluidas: 0, porSkill: {}, porTipo: { entrada: 0, salida: 0 }, avisos: [], hojasLeidas: 0 };
  var errores = [], sinFecha = 0;
  (hojas || []).forEach(function (h) {
    var aoa = h.aoa || [];
    var e = _liEncabezado(aoa, mapa);
    if (e.fila === -1) { if (!_liVacia(aoa[0])) errores.push(_liError(e.faltan, archivo, h.nombre)); return; }
    out.hojasLeidas++;
    for (var i = e.fila + 1; i < aoa.length; i++) {
      var row = aoa[i];
      if (_liVacia(row)) continue;
      var f = _liAu.auFecha(row[e.map.fecha]);
      if (!f) { sinFecha++; continue; }
      var tipif = _liTexto(row[e.map.tipificacion]) || '-';
      if (_liEsExcluida(tipif)) { out.excluidas++; continue; }
      var skill, tipo = 'entrada';
      if (canal === 'whatsapp') {
        skill = liClaveSkill(row[e.map.skillId], '') || 'Sin skill';
      } else {
        var nom = _liTexto(row[e.map.skill]);
        var cod = e.map.skillId !== undefined ? _liTexto(row[e.map.skillId]) : '';
        if (nom === '-' || (!nom && (cod === '-' || !cod))) { skill = LI_SKILL_SALIDA; tipo = 'salida'; }
        else skill = liClaveSkill(cod, nom);
      }
      var agente = _liTexto(row[e.map.agente]) || 'Sin agente';
      var k = [f.slice(0, 7), agente, skill, tipo, tipif].join('\u0001');
      var a = agg[k] || (agg[k] = { mes: f.slice(0, 7), agente: agente, skill: skill, tipo: tipo, tipificacion: tipif, n: 0 });
      a.n++;
      out.registros++;
      out.porSkill[skill] = (out.porSkill[skill] || 0) + 1;
      out.porTipo[tipo]++;
    }
  });
  if (!out.hojasLeidas) return { error: errores[0] || 'El archivo no trae hojas con datos.', filas: [] };
  if (sinFecha) out.avisos.push(sinFecha + ' fila(s) sin fecha válida: no se cuentan.');
  if (out.excluidas) out.avisos.push(out.excluidas + ' fila(s) de prueba (' + LI_EXCLUIR.join(', ') + '): no se cuentan.');
  var raros = Object.keys(out.porSkill).filter(function (s) { return s !== LI_SKILL_SALIDA && !liSkillConocido(s); });
  if (raros.length) out.avisos.push('Skill(s) fuera del mapa de nombres: ' + raros.map(function (s) { return liNombreSkill(s) + ' (' + out.porSkill[s] + ')'; }).join(', ') + '.');
  out.filas = Object.keys(agg).map(function (k) { return agg[k]; });
  return out;
}
function liCdrParse(hojas, archivo) { return _liTipifParse(hojas, archivo, 'cdr'); }
function liWhatsappParse(hojas, archivo) { return _liTipifParse(hojas, archivo, 'whatsapp'); }

// ── Vistas ──
function _liDelMes(filas, meses) {
  return (filas || []).filter(function (r) { return !meses || !meses.length || meses.indexOf(r.mes) !== -1; });
}
// Botones del flujo: Todas + los 5 del mapa (aunque no traigan datos) + los
// que traiga la base fuera del mapa. -> [{ v, t, conDatos }]
function liBotonesFlujo(filas, meses) {
  var con = {};
  _liDelMes(filas, meses).forEach(function (r) { con[r.skill] = true; });
  var lista = [{ v: '', t: 'Todas', conDatos: Object.keys(con).length > 0 }];
  LI_SKILLS.forEach(function (s) { lista.push({ v: s.codigo, t: s.nombre, conDatos: !!con[s.codigo] }); });
  Object.keys(con).filter(function (k) { return !liSkillConocido(k); }).sort().forEach(function (k) { lista.push({ v: k, t: liNombreSkill(k), conDatos: true }); });
  return lista;
}
// Totales y nivel de servicio (promedio simple de SERVICE_LEVEL_20SEC de las
// filas con dato, mismo criterio que Tráfico de Llamadas).
function _liResumir(arr) {
  var r = { total: 0, contestadas: 0, abandonadas: 0, nivelServicio: null }, ns = [];
  arr.forEach(function (x) { r.total += x.total; r.contestadas += x.contestadas; r.abandonadas += x.abandonadas; if (x.nivelServicio !== null && x.nivelServicio !== undefined) ns.push(x.nivelServicio); });
  if (ns.length) r.nivelServicio = Math.round(ns.reduce(function (s, x) { return s + x; }, 0) / ns.length * 100) / 100;
  return r;
}
// skill '' = Todas: una barra por area; un skill: una barra por dia.
function liFlujoSerie(filas, meses, skill) {
  var arr = _liDelMes(filas, meses).filter(function (r) { return !skill || r.skill === skill; });
  var grupos = {}, porArea = !skill;
  arr.forEach(function (r) { var k = porArea ? r.skill : r.fecha; (grupos[k] || (grupos[k] = [])).push(r); });
  var claves = Object.keys(grupos);
  if (porArea) {
    var orden = LI_SKILLS.map(function (s) { return s.codigo; });
    claves.sort(function (a, b) { var x = orden.indexOf(a), y = orden.indexOf(b); x = x === -1 ? 99 : x; y = y === -1 ? 99 : y; return x - y || (a < b ? -1 : 1); });
  } else claves.sort();
  return { porArea: porArea, resumen: _liResumir(arr),
    puntos: claves.map(function (k) { var s = _liResumir(grupos[k]); s.clave = k; s.etiqueta = porArea ? liNombreSkill(k) : k; return s; }) };
}
// Filtro de la torta: { agente, skill, tipo } ('' = todos).
function _liFiltrar(filas, meses, f) {
  f = f || {};
  return _liDelMes(filas, meses).filter(function (r) {
    return (!f.agente || r.agente === f.agente) && (!f.skill || r.skill === f.skill) && (!f.tipo || r.tipo === f.tipo);
  });
}
// -> [{ tipificacion, cantidad }] de mayor a menor, y el total.
function liTorta(filas, meses, filtro) {
  var acc = {}, total = 0;
  _liFiltrar(filas, meses, filtro).forEach(function (r) { acc[r.tipificacion] = (acc[r.tipificacion] || 0) + r.n; total += r.n; });
  var todas = Object.keys(acc).map(function (k) { return { tipificacion: k, cantidad: acc[k] }; })
    .sort(function (a, b) { return b.cantidad - a.cantidad || (a.tipificacion < b.tipificacion ? -1 : 1); });
  return { todas: todas, total: total };
}
// Opciones de los filtros (con los demas filtros aplicados, menos el propio).
function liOpciones(filas, meses, filtro, campo) {
  var f = Object.assign({}, filtro || {}); f[campo] = '';
  var vistos = {};
  _liFiltrar(filas, meses, f).forEach(function (r) { vistos[r[campo]] = true; });
  var l = Object.keys(vistos);
  var cmp = function (a, b) { return String(a.t).localeCompare(String(b.t), 'es', { sensitivity: 'base' }); };
  if (campo === 'skill') return l.map(function (v) { return { v: v, t: liNombreSkill(v) }; }).sort(cmp);
  return l.map(function (v) { return { v: v, t: v }; }).sort(cmp);
}

// Texto de la confirmacion de carga (lo que se leyo del archivo).
function liResumenCarga(tipo, r) {
  var skills = function (m, f) { return Object.keys(m).map(function (k) { return liNombreSkill(k) + ' ' + f(m[k]); }).join(', '); };
  if (tipo === 'flujo_li') return r.total + ' llamada(s): ' + r.contestadas + ' contestada(s), ' + r.abandonadas + ' abandonada(s). Por área: ' + skills(r.porSkill, function (x) { return x.total; });
  return r.registros + ' registro(s)' + (tipo === 'cdr_li' ? ' (' + r.porTipo.entrada + ' de entrada, ' + r.porTipo.salida + ' de salida)' : '') + '. Por skill: ' + skills(r.porSkill, function (x) { return x; });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { LI_SKILLS: LI_SKILLS, LI_SKILL_SALIDA: LI_SKILL_SALIDA, LI_EXCLUIR: LI_EXCLUIR,
    LI_MAPA_FLUJO: LI_MAPA_FLUJO, LI_MAPA_CDR: LI_MAPA_CDR, LI_MAPA_WHATSAPP: LI_MAPA_WHATSAPP,
    liClaveSkill: liClaveSkill, liNombreSkill: liNombreSkill, liEtiquetaTipificacion: liEtiquetaTipificacion,
    liFlujoParse: liFlujoParse, liCdrParse: liCdrParse, liWhatsappParse: liWhatsappParse,
    liBotonesFlujo: liBotonesFlujo, liFlujoSerie: liFlujoSerie, liTorta: liTorta, liOpciones: liOpciones, liResumenCarga: liResumenCarga };
}
