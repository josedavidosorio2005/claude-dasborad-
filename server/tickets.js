// tickets.js — Fase 356: «Sugerencias / Tickets». Reglas y consultas (las rutas viven en
// routes/tickets.js). Decisiones del usuario (17/11/2026):
//  - Cualquier usuario con sesión crea (tipo Sugerencia / Problema / Pregunta, campaña
//    obligatoria o «General (plataforma)», descripción de 1 a 2.000 caracteres; desde el pedido 7
//    de Edwin, 23/11/2026: «Ruta de ingreso» opcional y 1 adjunto opcional, imagen o PDF de hasta 3 MB)
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

// ── Fase 364 (pedido de Edwin 18/11, B2): tipos de ticket editables por ADMIN ──
const TIPOS_BASE = ['SUGERENCIA', 'PROBLEMA', 'PREGUNTA']; // los que acepta la columna vieja `tipo`
const MAX_TIPOS = 30;
function tipos(db, { todos } = {}) {
  return db.prepare('SELECT codigo, nombre, activo FROM ticket_tipos' + (todos ? '' : ' WHERE activo = 1') + ' ORDER BY orden, nombre').all()
    .map((t) => ({ codigo: t.codigo, nombre: t.nombre, activo: t.activo === 1 }));
}
function tipoActivo(db, codigo) { return !!db.prepare('SELECT 1 FROM ticket_tipos WHERE codigo = ? AND activo = 1').get(codigo); }
function nombreTipoValido(n) { return typeof n === 'string' && n.trim().length >= 2 && n.trim().length <= 40 && /^[\p{L}\p{N} ./()&-]+$/u.test(n.trim()); }
// Código a partir del nombre: MAYÚSCULAS sin tildes, guiones bajos; único.
function codigoDe(db, nombre) {
  const base = nombre.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30) || 'TIPO';
  let c = base, i = 2;
  while (db.prepare('SELECT 1 FROM ticket_tipos WHERE codigo = ?').get(c)) c = base.slice(0, 26) + '_' + (i++);
  return c;
}
function crearTipo(db, nombre, ahora) {
  if (db.prepare('SELECT COUNT(*) n FROM ticket_tipos').get().n >= MAX_TIPOS) return { error: 'Máximo ' + MAX_TIPOS + ' tipos' };
  if (db.prepare('SELECT 1 FROM ticket_tipos WHERE lower(nombre) = lower(?)').get(nombre.trim())) return { error: 'Ya hay un tipo con ese nombre' };
  const codigo = codigoDe(db, nombre);
  const orden = (db.prepare('SELECT MAX(orden) m FROM ticket_tipos').get().m || 0) + 1;
  db.prepare('INSERT INTO ticket_tipos (codigo, nombre, activo, orden, createdAt) VALUES (?, ?, 1, ?, ?)').run(codigo, nombre.trim(), orden, ahora);
  return { tipo: { codigo, nombre: nombre.trim(), activo: true } };
}
function editarTipo(db, codigo, cambios) {
  const t = db.prepare('SELECT * FROM ticket_tipos WHERE codigo = ?').get(codigo);
  if (!t) return { error: 'Tipo no encontrado', status: 404 };
  if (cambios.nombre !== undefined) {
    if (db.prepare('SELECT 1 FROM ticket_tipos WHERE lower(nombre) = lower(?) AND codigo != ?').get(cambios.nombre.trim(), codigo)) return { error: 'Ya hay un tipo con ese nombre', status: 409 };
    db.prepare('UPDATE ticket_tipos SET nombre = ? WHERE codigo = ?').run(cambios.nombre.trim(), codigo);
  }
  if (cambios.activo !== undefined) {
    if (!cambios.activo && db.prepare('SELECT COUNT(*) n FROM ticket_tipos WHERE activo = 1 AND codigo != ?').get(codigo).n === 0) return { error: 'Debe quedar al menos un tipo activo', status: 400 };
    db.prepare('UPDATE ticket_tipos SET activo = ? WHERE codigo = ?').run(cambios.activo ? 1 : 0, codigo);
  }
  const n = db.prepare('SELECT codigo, nombre, activo FROM ticket_tipos WHERE codigo = ?').get(codigo);
  return { tipo: { codigo: n.codigo, nombre: n.nombre, activo: n.activo === 1 }, antes: t };
}

const _SELECT_TICKET = `SELECT t.*, COALESCE(t.tipoCodigo, t.tipo) AS tipoEfectivo,
  (SELECT nombre FROM ticket_tipos tt WHERE tt.codigo = COALESCE(t.tipoCodigo, t.tipo)) AS tipoNombre`;

// ── Pedido 7 de Edwin (23/11/2026): 1 adjunto opcional, imagen (PNG/JPG) o PDF, hasta 3 MB ──
// El tipo sale del CONTENIDO (firma del archivo), nunca de la extensión ni de lo que diga el navegador.
const ADJUNTO_MAX_BYTES = 3 * 1024 * 1024;
const ADJUNTO_EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'application/pdf': 'pdf' };
function _tipoPorFirma(buf) {
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 5 && buf.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';
  return null;
}
// Nombre seguro para mostrar y descargar: sin rutas ni caracteres raros, con la extensión del tipo real.
function _nombreAdjunto(nombre, tipo) {
  const base = String(nombre || '').split(/[\\/]/).pop().replace(/\.[^.]*$/, '')
    .normalize('NFC').replace(/[^\p{L}\p{N} ._()-]+/gu, '_').replace(/\s+/g, ' ').trim().slice(0, 80) || 'adjunto';
  return base + '.' + ADJUNTO_EXT[tipo];
}
// { nombre, datos(base64) } → { nombre, tipo, buf } o { error }.
function leerAdjunto(adj) {
  const b64 = adj && adj.datos;
  if (typeof b64 !== 'string' || !b64.length || !/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return { error: 'Adjunto no válido: sube una imagen (PNG o JPG) o un PDF, hasta 3 MB' };
  const buf = Buffer.from(b64, 'base64');
  if (buf.length > ADJUNTO_MAX_BYTES) return { error: 'El adjunto pesa más de 3 MB' };
  const tipo = buf.length >= 16 ? _tipoPorFirma(buf) : null;
  if (!tipo) return { error: 'El adjunto debe ser una imagen (PNG o JPG) o un PDF' };
  return { nombre: _nombreAdjunto(adj.nombre, tipo), tipo, buf };
}
function rutaLimpia(v) {
  const s = typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim() : '';
  return s || null;
}

function crear(db, actor, b, ahora, adjunto) {
  const a = _autor(actor);
  let id;
  db.transaction(() => {
    const r = db.prepare(
      `INSERT INTO tickets (tipo, tipoCodigo, campana, descripcion, rutaIngreso, estado, autorId, autorUser, autorNombre, autorRol, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, 'NUEVO', ?, ?, ?, ?, ?, ?)`
    ).run(TIPOS_BASE.includes(b.tipo) ? b.tipo : 'SUGERENCIA', b.tipo, b.campana, b.descripcion, rutaLimpia(b.rutaIngreso), a.autorId, a.autorUser, a.autorNombre, a.autorRol, ahora, ahora);
    id = r.lastInsertRowid;
    if (adjunto) {
      db.prepare('INSERT INTO tickets_adjuntos (ticketId, nombre, tipo, bytes, datos, createdAt) VALUES (?, ?, ?, ?, ?, ?)')
        .run(id, adjunto.nombre, adjunto.tipo, adjunto.buf.length, adjunto.buf, ahora);
    }
  })();
  return obtener(db, id);
}

function obtener(db, id) {
  return db.prepare(_SELECT_TICKET + `, a.nombre AS adjNombre, a.tipo AS adjTipo, a.bytes AS adjBytes
    FROM tickets t LEFT JOIN tickets_adjuntos a ON a.ticketId = t.id WHERE t.id = ?`).get(id) || null;
}
function adjuntoDe(db, id) {
  return db.prepare('SELECT nombre, tipo, bytes, datos FROM tickets_adjuntos WHERE ticketId = ?').get(id) || null;
}
const ADJUNTOS_POR_DIA = 20;
function adjuntosRecientes(db, actor, desdeIso) {
  const a = _autor(actor);
  const quien = a.autorId === null ? ['t.autorId IS NULL AND t.autorUser = ?', a.autorUser] : ['t.autorId = ?', a.autorId];
  return db.prepare(`SELECT COUNT(*) n FROM tickets_adjuntos x JOIN tickets t ON t.id = x.ticketId WHERE ${quien[0]} AND x.createdAt >= ?`).get(quien[1], desdeIso).n;
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
  if (q.tipo) { where.push('COALESCE(t.tipoCodigo, t.tipo) = ?'); params.push(q.tipo); }
  if (q.campana) { where.push('t.campana = ?'); params.push(q.campana); }
  const sql = `${_SELECT_TICKET}, (SELECT COUNT(*) FROM tickets_respuestas r WHERE r.ticketId = t.id) AS respuestas,
               (SELECT a.tipo FROM tickets_adjuntos a WHERE a.ticketId = t.id) AS adjTipo
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
    db.prepare('DELETE FROM tickets_adjuntos WHERE ticketId = ?').run(ticket.id); // pedido 7 (23/11)
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
    id: t.id, tipo: t.tipoEfectivo || t.tipo, tipoNombre: t.tipoNombre || null, campana: t.campana, descripcion: t.descripcion, estado: t.estado,
    autorNombre: t.autorNombre, autorRol: t.autorRol, createdAt: t.createdAt, updatedAt: t.updatedAt,
    respuestas: t.respuestas, esMio: esAutor(actor, t),
    // Pedido 7 (23/11/2026): la ruta y los datos del adjunto (nunca su contenido: va por /adjunto).
    rutaIngreso: t.rutaIngreso || null,
    adjunto: t.adjTipo ? (t.adjNombre ? { nombre: t.adjNombre, tipo: t.adjTipo, bytes: t.adjBytes } : { tipo: t.adjTipo }) : null,
  };
}
function respuestaPublica(r, actor) {
  return { id: r.id, texto: r.texto, autorNombre: r.autorNombre, autorRol: r.autorRol, createdAt: r.createdAt, esMia: esAutor(actor, r) };
}

// Fase STA (usuario, 20/11/2026): el cliente de ORLANT (CLIENTES_DASH con acceso a ORLANT) sin Tickets.
function clienteSinTickets(actor) {
  if (!actor || actor.rol !== 'CLIENTES_DASH' || !actor.perms) return false;
  return actor.perms.campana_ORLANT === true || actor.perms.cliente_ORLANT === true;
}

module.exports = {
  clienteSinTickets,
  GENERAL, ETIQUETA_GENERAL,
  esGestor, puedeBorrar, esAutor, puedeVer, campanasDe, campanaPermitida,
  TIPOS_BASE, tipos, tipoActivo, nombreTipoValido, crearTipo, editarTipo, // Fase 364
  crear, obtener, listar, respuestasDe, responder, cambiarEstado, borrar, contarNuevos,
  ADJUNTO_MAX_BYTES, ADJUNTOS_POR_DIA, leerAdjunto, adjuntoDe, adjuntosRecientes, // pedido 7 (23/11)
  publico, respuestaPublica,
};
