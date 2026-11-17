// tickets.js — Fase 356: «Sugerencias / Tickets». Reglas y consultas (las rutas viven en
// routes/tickets.js). Decisiones del usuario (17/11/2026):
//  - Cualquier usuario con sesión crea (tipo Sugerencia / Problema / Pregunta, campaña
//    obligatoria o «General (plataforma)», descripción de 1 a 2.000 caracteres, sin adjuntos)
//    y ve SOLO los suyos, con su estado y el hilo de respuestas; también contesta en el suyo.
//  - ADMIN y REPORTES («gestores») ven todos, cambian el estado (Nuevo, En revisión, Resuelto)
//    y responden. Solo ADMIN borra (borrado definitivo; el Historial guarda quién, cuándo y el
//    número, nunca la descripción).
//  - El autor no edita ni cancela.
'use strict';
const { isFullAdmin, campaignAccess } = require('./auth');
const { leerRegistro } = require('./clientes-registro');

const GENERAL = 'GENERAL';
const ETIQUETA_GENERAL = 'General (plataforma)';

function esGestor(actor) { return !!actor && (isFullAdmin(actor) || actor.rol === 'REPORTES'); }
function puedeBorrar(actor) { return !!actor && isFullAdmin(actor); }

// Dueño: por id; el administrador maestro (sin fila en users) por su usuario.
function esAutor(actor, t) {
  if (!actor || !t) return false;
  if (actor.id === null || actor.id === undefined) return t.autorId === null && t.autorUser === actor.user;
  return t.autorId === actor.id;
}
function puedeVer(actor, t) { return esGestor(actor) || esAutor(actor, t); }

// Campañas que esta persona puede elegir: las activas del registro a las que tiene acceso
// (la asesora, la suya), más «General (plataforma)». Nunca una campaña interna para quien no
// es administrador (campaignAccess ya lo niega).
function campanasDe(db, actor) {
  const nombres = leerRegistro(db).map((c) => c.nombre); // solo activos (leerRegistro)
  const visibles = nombres.filter((n) => campaignAccess(actor, n) || (actor && actor.rol === 'ASESOR' && actor.asesorCampana === n));
  return [{ valor: GENERAL, etiqueta: ETIQUETA_GENERAL }].concat(visibles.sort((a, b) => a.localeCompare(b, 'es')).map((n) => ({ valor: n, etiqueta: n })));
}
function campanaPermitida(db, actor, campana) {
  return campanasDe(db, actor).some((c) => c.valor === campana);
}

function _autor(actor) {
  return {
    autorId: actor.id === undefined ? null : actor.id,
    autorUser: String(actor.user || ''),
    autorNombre: String(actor.nombre || actor.user || ''),
    autorRol: String(actor.rol || ''),
  };
}

function crear(db, actor, b, ahora) {
  const a = _autor(actor);
  const r = db.prepare(
    `INSERT INTO tickets (tipo, campana, descripcion, estado, autorId, autorUser, autorNombre, autorRol, createdAt, updatedAt)
     VALUES (?, ?, ?, 'NUEVO', ?, ?, ?, ?, ?, ?)`
  ).run(b.tipo, b.campana, b.descripcion, a.autorId, a.autorUser, a.autorNombre, a.autorRol, ahora, ahora);
  return obtener(db, r.lastInsertRowid);
}

function obtener(db, id) {
  return db.prepare('SELECT * FROM tickets WHERE id = ?').get(id) || null;
}

// Lista: el autor solo lo suyo; el gestor, «mios» o «todos» con filtros.
function listar(db, actor, q) {
  const where = [];
  const params = [];
  const todos = esGestor(actor) && (q.alcance || 'todos') === 'todos';
  if (!todos) {
    if (actor.id === null || actor.id === undefined) { where.push('t.autorId IS NULL AND t.autorUser = ?'); params.push(actor.user); }
    else { where.push('t.autorId = ?'); params.push(actor.id); }
  }
  if (q.estado) { where.push('t.estado = ?'); params.push(q.estado); }
  if (q.tipo) { where.push('t.tipo = ?'); params.push(q.tipo); }
  if (q.campana) { where.push('t.campana = ?'); params.push(q.campana); }
  const sql = `SELECT t.*, (SELECT COUNT(*) FROM tickets_respuestas r WHERE r.ticketId = t.id) AS respuestas
               FROM tickets t ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
               ORDER BY t.id DESC LIMIT 500`;
  return db.prepare(sql).all(...params);
}

function respuestasDe(db, id) {
  return db.prepare('SELECT * FROM tickets_respuestas WHERE ticketId = ? ORDER BY id').all(id);
}

function responder(db, actor, ticket, texto, ahora) {
  const a = _autor(actor);
  db.transaction(() => {
    db.prepare(
      `INSERT INTO tickets_respuestas (ticketId, texto, autorId, autorUser, autorNombre, autorRol, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(ticket.id, texto, a.autorId, a.autorUser, a.autorNombre, a.autorRol, ahora);
    db.prepare('UPDATE tickets SET updatedAt = ? WHERE id = ?').run(ahora, ticket.id);
  })();
  return respuestasDe(db, ticket.id);
}

function cambiarEstado(db, ticket, estado, ahora) {
  db.prepare('UPDATE tickets SET estado = ?, updatedAt = ? WHERE id = ?').run(estado, ahora, ticket.id);
  return obtener(db, ticket.id);
}

function borrar(db, ticket) {
  db.transaction(() => {
    db.prepare('DELETE FROM tickets_respuestas WHERE ticketId = ?').run(ticket.id);
    db.prepare('DELETE FROM tickets WHERE id = ?').run(ticket.id);
  })();
}

function contarNuevos(db) {
  return db.prepare("SELECT COUNT(*) AS n FROM tickets WHERE estado = 'NUEVO'").get().n;
}

// Lo que sale al navegador: sin autorId ni autorUser (no hacen falta para mostrar).
function publico(t, actor) {
  if (!t) return null;
  return {
    id: t.id, tipo: t.tipo, campana: t.campana, descripcion: t.descripcion, estado: t.estado,
    autorNombre: t.autorNombre, autorRol: t.autorRol, createdAt: t.createdAt, updatedAt: t.updatedAt,
    respuestas: t.respuestas, esMio: esAutor(actor, t),
  };
}
function respuestaPublica(r, actor) {
  return { id: r.id, texto: r.texto, autorNombre: r.autorNombre, autorRol: r.autorRol, createdAt: r.createdAt, esMia: esAutor(actor, r) };
}

module.exports = {
  GENERAL, ETIQUETA_GENERAL,
  esGestor, puedeBorrar, esAutor, puedeVer, campanasDe, campanaPermitida,
  crear, obtener, listar, respuestasDe, responder, cambiarEstado, borrar, contarNuevos,
  publico, respuestaPublica,
};
