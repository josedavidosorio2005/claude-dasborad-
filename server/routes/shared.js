// routes/shared.js — Plumbing minimo compartido por varios routers de
// dominio (server/routes/*.js). Extraido de server.js al dividirlo en
// routers por dominio (Radiografia InConexion, #3): estos helpers no son
// logica de negocio (esa ya vivia separada en los *-logic.js) sino
// formateo de respuesta / registro de historial usado por mas de un
// dominio, asi que quedaron aqui en vez de duplicarse en cada router.
const db = require('../db');
const config = require('../config');

const MASTER_ADMIN_USER = config.masterAdminUser;
const MASTER_ADMIN_PASSWORD_HASH = config.masterAdminPasswordHash;

// Envuelve handlers async para que cualquier rechazo llegue al middleware de errores.
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function nowStr() {
  const d = new Date();
  const pad = (n) => (n < 10 ? '0' + n : '' + n);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function actorLabel(actor) {
  return `${actor.nombre} (@${actor.user})`;
}

function logEvent(accion, targetRow, actorLabelStr, detalle) {
  db.prepare(
    `INSERT INTO historial (ts, fecha, accion, nombre, username, rol, actor, detalle)
     VALUES (?,?,?,?,?,?,?,?)`
  ).run(
    Date.now(),
    nowStr(),
    accion,
    targetRow ? targetRow.nombre : '-',
    targetRow ? targetRow.user : '-',
    targetRow ? targetRow.rol : '-',
    actorLabelStr,
    detalle || ''
  );
}

function toPublicUser(row) {
  return {
    id: row.id,
    nombre: row.nombre,
    user: row.user,
    rol: row.rol,
    active: !!row.active,
    perms: JSON.parse(row.perms || '{}'),
    asesorCampana: row.asesorCampana || undefined,
    createdAt: row.createdAt,
  };
}

module.exports = {
  wrap,
  nowStr,
  actorLabel,
  logEvent,
  toPublicUser,
  MASTER_ADMIN_USER,
  MASTER_ADMIN_PASSWORD_HASH,
};
