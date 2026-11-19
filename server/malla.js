// malla.js — Fase 358 (pedido de Edwin, 17/11): «Malla de turnos». Reglas y consultas; las rutas
// viven en routes/malla.js. Quién:
//  - editar (crear/editar/borrar grupos, asignar asesoras, copiar semana): ADMIN, o SUPERVISOR con
//    acceso a la campaña;
//  - leer la malla de una campaña: además REPORTES con acceso a la campaña;
//  - la asesora ve solo SU turno (su campaña). El cliente no ve nada de la malla.
'use strict';
const { isFullAdmin, campaignAccess } = require('./auth');
const { leerRegistro } = require('./clientes-registro');
const L = require('../public/js/malla-logic.js');
const X = require('./malla-extra'); // Fase 373
// Fase 373 (Edwin 19/11): cada grupo con un color distinto (serie 1 a 8 de la paleta, por su orden en la semana).
const COLORES = 8;

function puedeEditar(actor, campana) {
  return isFullAdmin(actor) || (!!actor && actor.rol === 'SUPERVISOR' && campaignAccess(actor, campana));
}
function puedeLeer(actor, campana) {
  return puedeEditar(actor, campana) || (!!actor && actor.rol === 'REPORTES' && campaignAccess(actor, campana));
}
// Campañas en las que esta persona puede ver la malla (solo activas del registro).
function campanasDe(db, actor) {
  return leerRegistro(db).map((c) => c.nombre).filter((n) => puedeLeer(actor, n));
}

// Fase 363: la replica «MOBILIZE PRUEBAS API» usa las asesoras de MOBILIZE, solo para leerlas
// (sus cuentas no cambian); ver puntualidad.js. El resto, las asesoras de su propia campaña.
function asesorasDe(db, campana) {
  return require('./puntualidad').asesorasDe(db, campana);
}

function _grupo(r) {
  let h = {};
  try { h = JSON.parse(r.horario); } catch (e) { h = {}; }
  return { id: r.id, campana: r.campana, semana: r.semana, nombre: r.nombre, horario: h, updatedAt: r.updatedAt };
}

function semana(db, campana, lunes) {
  const grupos = db.prepare('SELECT * FROM malla_grupos WHERE campana = ? AND semana = ? ORDER BY nombre').all(campana, lunes).map(_grupo);
  const asig = db.prepare('SELECT a.grupoId, u.id, u.nombre FROM malla_asignaciones a JOIN users u ON u.id = a.asesorId WHERE a.grupoId = ? ORDER BY u.nombre');
  grupos.forEach((g, i) => { g.asesoras = asig.all(g.id).map((x) => ({ id: x.id, nombre: x.nombre })); g.color = (i % COLORES) + 1; });
  return grupos;
}

function obtener(db, id) {
  const r = db.prepare('SELECT * FROM malla_grupos WHERE id = ?').get(id);
  return r ? _grupo(r) : null;
}

function crear(db, b, actorLabel, ahora) {
  const r = db.prepare('INSERT INTO malla_grupos (campana, semana, nombre, horario, creadoPor, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?)')
    .run(b.campana, b.semana, b.nombre.trim(), JSON.stringify(b.horario), actorLabel, ahora, ahora);
  return obtener(db, Number(r.lastInsertRowid));
}

function editar(db, g, cambios, ahora) {
  db.prepare('UPDATE malla_grupos SET nombre = ?, horario = ?, updatedAt = ? WHERE id = ?')
    .run(cambios.nombre !== undefined ? cambios.nombre.trim() : g.nombre, JSON.stringify(cambios.horario !== undefined ? cambios.horario : g.horario), ahora, g.id);
  return obtener(db, g.id);
}

function borrar(db, g) {
  db.transaction(() => {
    db.prepare('DELETE FROM malla_asignaciones WHERE grupoId = ?').run(g.id);
    db.prepare('DELETE FROM malla_grupos WHERE id = ?').run(g.id);
  })();
}

// Deja en el grupo exactamente estas asesoras. Si alguna estaba en otro grupo de la misma campaña
// y semana, se mueve (una asesora, un solo turno por semana). Solo asesoras activas de la campaña.
function asignar(db, g, ids) {
  const validas = new Set(asesorasDe(db, g.campana).map((a) => a.id));
  const malas = ids.filter((id) => !validas.has(id));
  if (malas.length) return { error: 'Solo asesoras activas de la campaña ' + g.campana };
  db.transaction(() => {
    db.prepare('DELETE FROM malla_asignaciones WHERE grupoId = ?').run(g.id);
    const otros = db.prepare('SELECT id FROM malla_grupos WHERE campana = ? AND semana = ? AND id != ?').all(g.campana, g.semana, g.id).map((x) => x.id);
    const quitar = db.prepare('DELETE FROM malla_asignaciones WHERE grupoId = ? AND asesorId = ?');
    const ins = db.prepare('INSERT INTO malla_asignaciones (grupoId, asesorId) VALUES (?, ?)');
    for (const id of ids) {
      for (const o of otros) quitar.run(o, id);
      ins.run(g.id, id);
    }
  })();
  return { grupo: semana(db, g.campana, g.semana).find((x) => x.id === g.id) };
}

// Copia la malla de una semana a otra. Destino con malla: 409 salvo `reemplazar` (decisión del
// usuario: solo a semanas vacías, o reemplazar con confirmación). Se copian grupos, horarios y
// asesoras que sigan activas en la campaña.
function copiar(db, campana, desde, hasta, reemplazar, actorLabel, ahora) {
  const origen = semana(db, campana, desde);
  if (!origen.length) return { error: 'La semana de origen no tiene malla', status: 400 };
  const destino = db.prepare('SELECT COUNT(*) n FROM malla_grupos WHERE campana = ? AND semana = ?').get(campana, hasta).n;
  if (destino && !reemplazar) return { error: 'La semana de destino ya tiene malla', status: 409, codigo: 'DESTINO_CON_MALLA', grupos: destino };
  const activas = new Set(asesorasDe(db, campana).map((a) => a.id));
  let asesoras = 0;
  db.transaction(() => {
    const ids = db.prepare('SELECT id FROM malla_grupos WHERE campana = ? AND semana = ?').all(campana, hasta).map((x) => x.id);
    for (const id of ids) {
      db.prepare('DELETE FROM malla_asignaciones WHERE grupoId = ?').run(id);
      db.prepare('DELETE FROM malla_grupos WHERE id = ?').run(id);
    }
    const insG = db.prepare('INSERT INTO malla_grupos (campana, semana, nombre, horario, creadoPor, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?)');
    const insA = db.prepare('INSERT INTO malla_asignaciones (grupoId, asesorId) VALUES (?, ?)');
    for (const g of origen) {
      const nuevo = Number(insG.run(campana, hasta, g.nombre, JSON.stringify(g.horario), actorLabel, ahora, ahora).lastInsertRowid);
      for (const a of g.asesoras) if (activas.has(a.id)) { insA.run(nuevo, a.id); asesoras++; }
    }
  })();
  return { grupos: origen.length, asesoras, reemplazados: destino };
}

// El turno de una asesora en una semana (o null si no tiene).
function turnoDe(db, asesorId, campana, lunes) {
  const r = db.prepare(`SELECT g.* FROM malla_grupos g JOIN malla_asignaciones a ON a.grupoId = g.id
                         WHERE a.asesorId = ? AND g.campana = ? AND g.semana = ?`).get(asesorId, campana, lunes);
  if (!r) return null;
  const g = _grupo(r);
  // Fase 373: color del grupo (mismo orden que semana()) y horario especial de la asesora encima.
  const orden = db.prepare('SELECT id FROM malla_grupos WHERE campana = ? AND semana = ? ORDER BY nombre').all(campana, lunes).map((x) => x.id);
  const dias = L.MALLA_DIAS.map((d) => L.mallaFechaDelDia(lunes, d.n));
  const aj = X.aplicarAjustes(g.horario, lunes, X.ajustesDeAsesora(db, asesorId, campana, dias[0], dias[6]));
  return { semana: g.semana, grupo: g.nombre, horario: aj.horario, especiales: aj.especiales, color: (orden.indexOf(g.id) % COLORES) + 1 };
}

module.exports = { L, puedeEditar, puedeLeer, campanasDe, asesorasDe, semana, obtener, crear, editar, borrar, asignar, copiar, turnoDe };
