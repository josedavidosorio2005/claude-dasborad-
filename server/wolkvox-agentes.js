// wolkvox-agentes.js — Fase AU2 (autorización escrita del usuario, 26/11/2026, CLAUDE.md): filtros de la réplica
// «CLINICA AURORA PRUEBAS API» con la API de Wolkvox (mapeo de Edwin del 26/11):
//  - qué skills entran en cada reporte (D.FILTROS_AURORA, por nombre normalizado: mayúsculas y sin tildes);
//  - la lista EDITABLE de agentes de Inconexión (solo la Tipificación de llamadas y de WhatsApp se filtra por
//    agente; el tráfico de WhatsApp no). Mientras la lista esté vacía, la Tipificación no se escribe, pero cada
//    corrida anota los agentes que vio (solo el nombre) para que el administrador los elija;
//  - el mapa skill_id → nombre de la operación, que sale de las respuestas de skill_1 (chat_1 solo trae skill_id).
// Solo nombres de agentes y de skills: ningún dato de pacientes ni teléfonos.
'use strict';

const NOMBRE_MAX = 120;

function norm(v) {
  return String(v == null ? '' : v).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
}
function nombreLimpio(v) {
  const s = String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim();
  return s.length && s.length <= NOMBRE_MAX ? s : '';
}

function asegurarTablas(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS wolkvox_agentes (
      campana TEXT NOT NULL,
      nombre TEXT NOT NULL,
      incluido INTEGER NOT NULL DEFAULT 0,
      vistoEn TEXT,
      cambiadoEn TEXT,
      cambiadoPor TEXT NOT NULL DEFAULT '',
      PRIMARY KEY (campana, nombre)
    );
    CREATE TABLE IF NOT EXISTS wolkvox_skills_vistas (
      operacion TEXT NOT NULL,
      skillId TEXT NOT NULL,
      skillName TEXT NOT NULL,
      vistoEn TEXT NOT NULL,
      PRIMARY KEY (operacion, skillId)
    );
  `);
}

// ── Agentes ──
// Anota los agentes vistos en una corrida (nuevos quedan SIN elegir). Devuelve cuántos nombres distintos vio.
function registrarVistos(db, campana, nombres) {
  asegurarTablas(db);
  const ahora = new Date().toISOString();
  const unicos = [...new Set((nombres || []).map(nombreLimpio).filter(Boolean))];
  const ins = db.prepare('INSERT INTO wolkvox_agentes (campana, nombre, incluido, vistoEn) VALUES (?, ?, 0, ?) ON CONFLICT(campana, nombre) DO UPDATE SET vistoEn = excluded.vistoEn');
  db.transaction(() => { for (const n of unicos) ins.run(campana, n, ahora); })();
  return unicos.length;
}
// Set de nombres normalizados de los agentes ELEGIDOS.
function incluidos(db, campana) {
  asegurarTablas(db);
  return new Set(db.prepare('SELECT nombre FROM wolkvox_agentes WHERE campana = ? AND incluido = 1').all(campana).map((r) => norm(r.nombre)));
}
function listar(db, campana) {
  asegurarTablas(db);
  return db.prepare('SELECT nombre, incluido, vistoEn, cambiadoEn FROM wolkvox_agentes WHERE campana = ? ORDER BY nombre COLLATE NOCASE').all(campana)
    .map((r) => ({ nombre: r.nombre, incluido: r.incluido === 1, visto: !!r.vistoEn }));
}
// Guarda la lista: `incluidos` (nombres elegidos; los que ya existen y no vienen quedan sin elegir) y `agregar`
// (nombres nuevos escritos a mano, que quedan elegidos). Devuelve { incluidos, total } o lanza Error con mensaje claro.
function guardar(db, campana, cuerpo, quien) {
  asegurarTablas(db);
  const b = cuerpo || {};
  if (!Array.isArray(b.incluidos) || b.incluidos.length > 500) throw new Error('incluidos debe ser una lista de nombres (hasta 500)');
  const agregar = b.agregar === undefined ? [] : b.agregar;
  if (!Array.isArray(agregar) || agregar.length > 50) throw new Error('agregar debe ser una lista de nombres (hasta 50)');
  const elegir = new Set();
  for (const n of b.incluidos.concat(agregar)) {
    const l = nombreLimpio(n);
    if (!l) throw new Error('Hay un nombre vacío o de más de ' + NOMBRE_MAX + ' caracteres');
    elegir.add(norm(l));
  }
  const ahora = new Date().toISOString();
  db.transaction(() => {
    for (const n of agregar) db.prepare('INSERT OR IGNORE INTO wolkvox_agentes (campana, nombre, incluido) VALUES (?, ?, 1)').run(campana, nombreLimpio(n));
    for (const r of db.prepare('SELECT nombre, incluido FROM wolkvox_agentes WHERE campana = ?').all(campana)) {
      const quiere = elegir.has(norm(r.nombre)) ? 1 : 0;
      if (quiere !== r.incluido) db.prepare('UPDATE wolkvox_agentes SET incluido = ?, cambiadoEn = ?, cambiadoPor = ? WHERE campana = ? AND nombre = ?').run(quiere, ahora, String(quien || '').slice(0, 120), campana, r.nombre);
    }
  })();
  const lista = listar(db, campana);
  return { incluidos: lista.filter((a) => a.incluido).length, total: lista.length };
}

// ── Skills (id → nombre) de la operación, desde skill_1 ──
function registrarSkills(db, operacion, data) {
  asegurarTablas(db);
  if (!Array.isArray(data)) return 0;
  const ahora = new Date().toISOString();
  const up = db.prepare('INSERT INTO wolkvox_skills_vistas (operacion, skillId, skillName, vistoEn) VALUES (?, ?, ?, ?) ON CONFLICT(operacion, skillId) DO UPDATE SET skillName = excluded.skillName, vistoEn = excluded.vistoEn');
  let n = 0;
  db.transaction(() => {
    for (const r of data) {
      if (!r || typeof r !== 'object') continue;
      const id = String(r.skill_id == null ? '' : r.skill_id).trim();
      const nombre = nombreLimpio(r.skill_name);
      if (!/^[0-9A-Za-z_-]{1,40}$/.test(id) || !nombre) continue;
      up.run(operacion, id, nombre, ahora); n++;
    }
  })();
  return n;
}
function mapaSkills(db, operacion) {
  asegurarTablas(db);
  return new Map(db.prepare('SELECT skillId, skillName FROM wolkvox_skills_vistas WHERE operacion = ?').all(operacion).map((r) => [r.skillId, r.skillName]));
}

// ── Filtros (puros) ──
const enLista = (lista, valor) => (lista || []).map(norm).includes(norm(valor));

module.exports = { NOMBRE_MAX, norm, nombreLimpio, asegurarTablas, registrarVistos, incluidos, listar, guardar, registrarSkills, mapaSkills, enLista };
