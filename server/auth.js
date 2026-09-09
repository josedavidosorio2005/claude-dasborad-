// auth.js — Emisión/verificación de JWT y checks de permisos server-side.
// IMPORTANTE: nunca confiamos solo en lo que decide la interfaz (el navegador);
// cada endpoint sensible vuelve a validar el permiso aquí, con los datos reales
// del usuario tal como están guardados en la base de datos.
const jwt = require('jsonwebtoken');
const db = require('./db');
const config = require('./config');

// La validez de JWT_SECRET (longitud minima, etc.) ya se garantiza en config.js
// al arrancar; aqui solo lo consumimos.
const JWT_SECRET = config.jwtSecret;
const JWT_EXPIRES_IN = config.jwtExpiresIn;

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

// Middleware: exige un token válido en el header Authorization: Bearer <token>
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No autenticado' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.auth = decoded; // { isMasterAdmin, userId, rol }
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Sesion invalida o expirada' });
  }
}

// Carga el usuario "actor" (quien hace la peticion) desde la BD, fresco.
function getActor(req) {
  if (req.auth.isMasterAdmin) {
    return { id: null, nombre: 'Administrador', user: config.masterAdminUser, rol: 'ADMIN', isMasterAdmin: true, perms: { isAdmin: true } };
  }
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.auth.userId);
  if (!row) return null;
  return { ...row, perms: JSON.parse(row.perms || '{}'), isMasterAdmin: false };
}

function isFullAdmin(actor) {
  return actor && (actor.isMasterAdmin || actor.rol === 'ADMIN');
}

function can(actor, action) {
  if (!actor) return false;
  if (isFullAdmin(actor)) return true;
  if (actor.rol !== 'AUX_ADMIN') return false;
  return actor.perms && actor.perms[action] === true;
}

// Middleware factory: exige que el actor sea admin o tenga el permiso indicado
function requirePermission(action) {
  return (req, res, next) => {
    const actor = getActor(req);
    if (!actor) return res.status(401).json({ error: 'No autenticado' });
    if (!actor.isMasterAdmin && !actor.active) {
      return res.status(403).json({ error: 'Usuario suspendido. Contacte al administrador.' });
    }
    if (!can(actor, action)) return res.status(403).json({ error: 'Sin permiso para esta accion' });
    req.actor = actor;
    next();
  };
}

module.exports = { signToken, requireAuth, getActor, isFullAdmin, can, requirePermission };
