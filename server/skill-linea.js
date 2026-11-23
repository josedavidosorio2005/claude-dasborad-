// skill-linea.js — Fase N6 (23/11/2026, docs/orlant/nuevo-dashboard/mapa-skills-propuesta.md): mapa
// de skills de Wolkvox a línea (General / 3P / no cuenta) de ORLANT, guardado en la plataforma y
// editable por el administrador mientras Edwin confirma. Es configuración: nunca se pide a Wolkvox.
//
// Reglas:
//  - Un skill sin fila en el mapa está «sin definir»: no se infiere en silencio. La pantalla muestra
//    una PROPUESTA (la regla del nombre que ya usa resumen-orlant-trafico.js: termina en «3P» o
//    «GENERAL»), pero solo cuenta lo que el administrador guarde.
//  - Una réplica interna usa el mapa de su campaña original (parametros.replicaDe).
//  - Cada guardado queda en el Historial (SKILL_LINEA): solo cuántos cambios, nunca valores de datos.
'use strict';

const { lineaDeSkill: lineaDeNombre } = require('./resumen-orlant-trafico');
const { replicaDe } = require('./clientes-registro');

const LINEAS = Object.freeze(['GENERAL', '3P', 'NO_CUENTA']);
const CAMPANAS_CON_MAPA = Object.freeze(['ORLANT']); // ampliar = decisión aparte
const MAX_SKILL = 120;

function asegurarTabla(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS skill_linea (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campana TEXT NOT NULL,
    skill TEXT NOT NULL,
    linea TEXT NOT NULL CHECK (linea IN ('GENERAL', '3P', 'NO_CUENTA')),
    guardadoPorNombre TEXT NOT NULL DEFAULT '',
    updatedAt TEXT NOT NULL,
    UNIQUE (campana, skill)
  )`);
}

// Nombre de skill tal como llega de Wolkvox, sin espacios de más. null si no sirve.
function normalizarSkill(s) {
  if (typeof s !== 'string') return null;
  const t = s.trim().replace(/\s+/g, ' ');
  if (!t || t.length > MAX_SKILL || /[\u0000-\u001f]/.test(t)) return null;
  return t;
}

// La campaña dueña del mapa: la misma o, si es una réplica interna, su original.
function campanaDelMapa(db, campana) {
  const original = replicaDe(db, campana);
  const c = original || campana;
  return CAMPANAS_CON_MAPA.includes(c) ? c : null;
}

// Map(skill -> linea) guardado para la campaña (o la original de una réplica).
function mapa(db, campana) {
  asegurarTabla(db);
  const c = campanaDelMapa(db, campana);
  if (!c) return new Map();
  return new Map(db.prepare('SELECT skill, linea FROM skill_linea WHERE campana = ?').all(c).map((r) => [r.skill, r.linea]));
}

// Para la pantalla: todos los skills conocidos (los del Tráfico de Llamadas de la campaña y de sus
// réplicas, y los ya guardados), con la línea guardada, la propuesta y cuántas filas hay.
function listar(db, campana) {
  asegurarTabla(db);
  const c = campanaDelMapa(db, campana);
  if (!c) return null;
  const replicas = db.prepare('SELECT nombre, parametros FROM clientes_registro').all()
    .filter((r) => { try { const p = JSON.parse(r.parametros || '{}'); return p.interno === true && p.replicaDe === c; } catch (e) { return false; } })
    .map((r) => r.nombre);
  const campanas = [c, ...replicas];
  const vistos = new Map();
  const marcas = campanas.map(() => '?').join(',');
  for (const r of db.prepare(`SELECT skillName AS skill, campana, COUNT(*) AS dias, MAX(fecha) AS ultimo FROM calidad_nivel_servicio_diario WHERE campana IN (${marcas}) GROUP BY skillName, campana`).all(...campanas)) {
    const k = normalizarSkill(r.skill);
    if (!k) continue;
    const v = vistos.get(k) || { skill: k, diasManual: 0, diasApi: 0, ultimo: null };
    if (r.campana === c) v.diasManual += r.dias; else v.diasApi += r.dias;
    if (!v.ultimo || r.ultimo > v.ultimo) v.ultimo = r.ultimo;
    vistos.set(k, v);
  }
  const guardado = mapa(db, c);
  for (const k of guardado.keys()) if (!vistos.has(k)) vistos.set(k, { skill: k, diasManual: 0, diasApi: 0, ultimo: null });
  const skills = [...vistos.values()].map((v) => Object.assign(v, {
    linea: guardado.get(v.skill) || null,
    propuesta: lineaDeNombre(v.skill),
  })).sort((a, b) => a.skill.localeCompare(b.skill, 'es'));
  return { campana: c, replicas, lineas: LINEAS.slice(), skills };
}

// cambios: [{ skill, linea }] con linea en LINEAS o null (null = volver a «sin definir»).
// Devuelve { guardados, quitados } o lanza Error con un texto para el administrador.
function guardar(db, campana, cambios, quien) {
  asegurarTabla(db);
  const c = campanaDelMapa(db, campana);
  if (!c) throw Object.assign(new Error('Esta campaña no tiene mapa de skills'), { status: 404 });
  if (!Array.isArray(cambios) || !cambios.length || cambios.length > 500) throw Object.assign(new Error('Envía de 1 a 500 cambios'), { status: 400 });
  const limpios = cambios.map((x) => {
    const skill = normalizarSkill(x && x.skill);
    if (!skill) throw Object.assign(new Error('Nombre de skill no válido'), { status: 400 });
    const linea = x.linea === null || x.linea === undefined || x.linea === '' ? null : x.linea;
    if (linea !== null && !LINEAS.includes(linea)) throw Object.assign(new Error('Línea no válida'), { status: 400 });
    return { skill, linea };
  });
  let guardados = 0, quitados = 0;
  const ts = new Date().toISOString();
  db.transaction(() => {
    const up = db.prepare(`INSERT INTO skill_linea (campana, skill, linea, guardadoPorNombre, updatedAt) VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(campana, skill) DO UPDATE SET linea = excluded.linea, guardadoPorNombre = excluded.guardadoPorNombre, updatedAt = excluded.updatedAt`);
    const del = db.prepare('DELETE FROM skill_linea WHERE campana = ? AND skill = ?');
    for (const x of limpios) {
      if (x.linea === null) quitados += del.run(c, x.skill).changes;
      else { up.run(c, x.skill, x.linea, String(quien || '').slice(0, 120), ts); guardados++; }
    }
  })();
  return { campana: c, guardados, quitados };
}

module.exports = { LINEAS, CAMPANAS_CON_MAPA, asegurarTabla, normalizarSkill, campanaDelMapa, mapa, listar, guardar };
