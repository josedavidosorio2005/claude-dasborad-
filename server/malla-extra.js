// malla-extra.js — Fase 373 (reunión con Edwin, 19/11): en la «Malla de turnos»,
//  - NOVEDADES: un comentario ligado a una asesora de un grupo en una semana (opcionalmente a un día),
//    p. ej. «cita médica, entra a las 9:00 el jueves». La asesora lo ve en «Mi malla». No se borran:
//    se quitan (quedan en el historial de «Novedades de la semana» con quién y cuándo).
//  - HORARIO ESPECIAL: el horario de UNA asesora en uno o varios días de la semana (o descanso), sin
//    crear un grupo nuevo. Pesa sobre el horario de su grupo en «Mi malla» y en la puntualidad.
// Solo para asesoras que están en un grupo de esa campaña y semana. Escribe quien edita la malla de la
// campaña (malla.js puedeEditar). El Historial general NUNCA lleva el texto de la novedad (puede
// traer datos de salud): solo la semana y el día.
'use strict';
const L = require('../public/js/malla-logic.js');

const TEXTO_MAX = 300;

function crearTablas(db) {
  db.exec(`
CREATE TABLE IF NOT EXISTS malla_novedades (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campana TEXT NOT NULL, semana TEXT NOT NULL, asesorId INTEGER NOT NULL, fecha TEXT,
  texto TEXT NOT NULL, creadoPor TEXT NOT NULL DEFAULT '', createdAt TEXT NOT NULL,
  quitadaPor TEXT, quitadaEn TEXT
);
CREATE INDEX IF NOT EXISTS idx_malla_novedades_semana ON malla_novedades(campana, semana);
CREATE INDEX IF NOT EXISTS idx_malla_novedades_asesor ON malla_novedades(asesorId, semana);
CREATE TABLE IF NOT EXISTS malla_ajustes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campana TEXT NOT NULL, asesorId INTEGER NOT NULL, fecha TEXT NOT NULL,
  entrada TEXT, salida TEXT,
  creadoPor TEXT NOT NULL DEFAULT '', createdAt TEXT NOT NULL,
  UNIQUE(campana, asesorId, fecha)
);
CREATE INDEX IF NOT EXISTS idx_malla_ajustes_fecha ON malla_ajustes(campana, fecha);`);
}

// ¿Está la asesora en un grupo de esa campaña y semana? -> { grupo } o null
function grupoDeAsesora(db, campana, semana, asesorId) {
  return db.prepare(`SELECT g.id, g.nombre FROM malla_grupos g JOIN malla_asignaciones a ON a.grupoId = g.id
                     WHERE g.campana = ? AND g.semana = ? AND a.asesorId = ?`).get(campana, semana, asesorId) || null;
}
function _diasDeSemana(semana) { return L.MALLA_DIAS.map((d) => L.mallaFechaDelDia(semana, d.n)); }

// ── Novedades ──
function novedadesSemana(db, campana, semana, opts) {
  const todas = !!(opts && opts.incluirQuitadas);
  return db.prepare(`SELECT n.*, u.nombre AS asesorNombre FROM malla_novedades n LEFT JOIN users u ON u.id = n.asesorId
                     WHERE n.campana = ? AND n.semana = ?${todas ? '' : ' AND n.quitadaEn IS NULL'} ORDER BY COALESCE(n.fecha, n.semana), n.id`)
    .all(campana, semana).map(_novedad);
}
function novedadesDeAsesora(db, asesorId, campana, semana) {
  return db.prepare(`SELECT n.*, NULL AS asesorNombre FROM malla_novedades n WHERE n.asesorId = ? AND n.campana = ? AND n.semana = ? AND n.quitadaEn IS NULL
                     ORDER BY COALESCE(n.fecha, n.semana), n.id`).all(asesorId, campana, semana)
    .map((r) => { const x = _novedad(r); delete x.creadoPor; delete x.asesorNombre; return x; }); // la asesora no necesita saber quién la escribió
}
function _novedad(r) {
  return { id: r.id, asesorId: r.asesorId, asesorNombre: r.asesorNombre, fecha: r.fecha || null, texto: r.texto, creadoPor: r.creadoPor, createdAt: r.createdAt,
    quitada: r.quitadaEn ? { por: r.quitadaPor, en: r.quitadaEn } : null };
}
function crearNovedad(db, b, quien, ahora) {
  if (!b || typeof b !== 'object' || Object.keys(b).some((k) => !['campana', 'semana', 'asesorId', 'fecha', 'texto'].includes(k))) return { error: 'Datos no válidos' };
  if (!L.mallaEsLunes(b.semana)) return { error: 'Elige una semana (su lunes)' };
  if (!Number.isInteger(b.asesorId)) return { error: 'Elige la asesora' };
  const g = grupoDeAsesora(db, b.campana, b.semana, b.asesorId);
  if (!g) return { error: 'La asesora no está en un grupo de esta semana' };
  const fecha = b.fecha === undefined || b.fecha === null || b.fecha === '' ? null : b.fecha;
  if (fecha !== null && !_diasDeSemana(b.semana).includes(fecha)) return { error: 'El día debe ser de esta semana' };
  const texto = typeof b.texto === 'string' ? b.texto.trim().replace(/\s+/g, ' ') : '';
  if (texto.length < 3 || texto.length > TEXTO_MAX) return { error: 'Escribe la novedad (3 a ' + TEXTO_MAX + ' caracteres)' };
  const id = Number(db.prepare('INSERT INTO malla_novedades (campana, semana, asesorId, fecha, texto, creadoPor, createdAt) VALUES (?,?,?,?,?,?,?)')
    .run(b.campana, b.semana, b.asesorId, fecha, texto, quien, ahora).lastInsertRowid);
  return { novedad: obtenerNovedad(db, id) };
}
function obtenerNovedad(db, id) {
  const r = db.prepare('SELECT n.*, u.nombre AS asesorNombre FROM malla_novedades n LEFT JOIN users u ON u.id = n.asesorId WHERE n.id = ?').get(id);
  return r ? Object.assign(_novedad(r), { campana: r.campana, semana: r.semana }) : null;
}
function quitarNovedad(db, n, quien, ahora) {
  if (n.quitada) return { error: 'Esa novedad ya se quitó' };
  db.prepare('UPDATE malla_novedades SET quitadaPor = ?, quitadaEn = ? WHERE id = ?').run(quien, ahora, n.id);
  return { novedad: obtenerNovedad(db, n.id) };
}

// ── Horario especial de una asesora ──
function ajustesSemana(db, campana, semana) {
  const dias = _diasDeSemana(semana);
  return db.prepare('SELECT a.*, u.nombre AS asesorNombre FROM malla_ajustes a LEFT JOIN users u ON u.id = a.asesorId WHERE a.campana = ? AND a.fecha BETWEEN ? AND ? ORDER BY a.fecha, a.asesorId')
    .all(campana, dias[0], dias[6]).map(_ajuste);
}
function _ajuste(r) {
  return { id: r.id, asesorId: r.asesorId, asesorNombre: r.asesorNombre, fecha: r.fecha, turno: r.entrada ? { entrada: r.entrada, salida: r.salida } : null, creadoPor: r.creadoPor, createdAt: r.createdAt };
}
function ajustesDeAsesora(db, asesorId, campana, desde, hasta) {
  const m = new Map();
  for (const r of db.prepare('SELECT * FROM malla_ajustes WHERE asesorId = ? AND campana = ? AND fecha BETWEEN ? AND ?').all(asesorId, campana, desde, hasta)) {
    m.set(r.fecha, r.entrada ? { entrada: r.entrada, salida: r.salida } : null);
  }
  return m;
}
// b: { campana, semana, asesorId, dias: [1..7], descanso: bool, entrada, salida }. Reemplaza el horario
// especial de esos días (los demás días no cambian).
function guardarAjuste(db, b, quien, ahora) {
  if (!b || typeof b !== 'object' || Object.keys(b).some((k) => !['campana', 'semana', 'asesorId', 'dias', 'descanso', 'entrada', 'salida'].includes(k))) return { error: 'Datos no válidos' };
  if (!L.mallaEsLunes(b.semana)) return { error: 'Elige una semana (su lunes)' };
  if (!Number.isInteger(b.asesorId) || !grupoDeAsesora(db, b.campana, b.semana, b.asesorId)) return { error: 'La asesora no está en un grupo de esta semana' };
  if (!Array.isArray(b.dias) || !b.dias.length || b.dias.length > 7 || !b.dias.every((d) => Number.isInteger(d) && d >= 1 && d <= 7)) return { error: 'Elige uno o más días' };
  let turno = null;
  if (b.descanso !== true) {
    const v = L.mallaValidarHorario({ 1: { entrada: b.entrada, salida: b.salida } });
    if (!v.ok) return { error: v.error.replace(/^Lunes: /, '') };
    turno = v.horario[1];
  }
  const fechas = [...new Set(b.dias)].sort().map((d) => L.mallaFechaDelDia(b.semana, d));
  const up = db.prepare(`INSERT INTO malla_ajustes (campana, asesorId, fecha, entrada, salida, creadoPor, createdAt) VALUES (?,?,?,?,?,?,?)
                         ON CONFLICT(campana, asesorId, fecha) DO UPDATE SET entrada = excluded.entrada, salida = excluded.salida, creadoPor = excluded.creadoPor, createdAt = excluded.createdAt`);
  db.transaction(() => { for (const f of fechas) up.run(b.campana, b.asesorId, f, turno ? turno.entrada : null, turno ? turno.salida : null, quien, ahora); })();
  return { fechas, turno };
}
function obtenerAjuste(db, id) {
  const r = db.prepare('SELECT a.*, u.nombre AS asesorNombre FROM malla_ajustes a LEFT JOIN users u ON u.id = a.asesorId WHERE a.id = ?').get(id);
  return r ? Object.assign(_ajuste(r), { campana: r.campana }) : null;
}
function quitarAjuste(db, a) { db.prepare('DELETE FROM malla_ajustes WHERE id = ?').run(a.id); }

// Horario de la semana con los ajustes encima: { horario, especiales: [n de los días ajustados] }.
function aplicarAjustes(horario, semana, ajustes) {
  const h = Object.assign({}, horario || {});
  const especiales = [];
  for (const d of L.MALLA_DIAS) {
    const f = L.mallaFechaDelDia(semana, d.n);
    if (ajustes.has(f)) { h[d.n] = ajustes.get(f); especiales.push(d.n); } // h[1] y h["1"] son la misma clave
  }
  return { horario: h, especiales };
}

module.exports = { TEXTO_MAX, crearTablas, grupoDeAsesora, novedadesSemana, novedadesDeAsesora, crearNovedad, obtenerNovedad, quitarNovedad,
  ajustesSemana, ajustesDeAsesora, guardarAjuste, obtenerAjuste, quitarAjuste, aplicarAjustes };
