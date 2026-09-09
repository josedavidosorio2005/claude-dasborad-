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
  return !!(actor.perms && actor.perms[action] === true);
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

// Middleware: carga el actor fresco en req.actor (sin exigir un permiso concreto).
// Lo usan los endpoints del modulo de Calidad, que despues hacen sus propios
// chequeos por campana con los helpers de abajo.
function requireActor(req, res, next) {
  if (!req.auth) {
    // Permite usar requireActor sin encadenar requireAuth antes.
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'No autenticado' });
    try {
      req.auth = jwt.verify(token, JWT_SECRET);
    } catch (e) {
      return res.status(401).json({ error: 'Sesion invalida o expirada' });
    }
  }
  const actor = getActor(req);
  if (!actor) return res.status(401).json({ error: 'No autenticado' });
  if (!actor.isMasterAdmin && !actor.active) {
    return res.status(403).json({ error: 'Usuario suspendido. Contacte al administrador.' });
  }
  req.actor = actor;
  next();
}

// ── Permisos del modulo de Calidad (verificados SIEMPRE en el servidor) ──
// Reflejan exactamente las reglas del frontend (public/js/calidad.js), pero
// ahora la decision la toma el servidor con los datos reales del usuario.

// Puede VER los datos de una campana (monitoreos, resumenes, cronograma).
// Acceso: administrador, quien tiene el permiso de esa campana (roles CALIDAD /
// SUPERVISOR / REPORTES / GERENCIA) o quien tiene el permiso del cliente con el
// mismo nombre (rol CLIENTES_DASH / SUPERVISOR) — este ultimo para que el
// dashboard del cliente pueda leer sus resultados de calidad (Fase 2).
function campaignAccess(actor, campana) {
  if (isFullAdmin(actor)) return true;
  if (!actor || !actor.perms) return false;
  return (
    actor.perms['campana_' + campana] === true || actor.perms['cliente_' + campana] === true
  );
}

// Puede CREAR monitoreos nuevos en una campana (rol CALIDAD o SUPERVISOR con
// acceso a esa campana). Equivale a calCurrentPerm().
function canEvaluateCampaign(actor, campana) {
  if (isFullAdmin(actor)) return true;
  if (!actor || (actor.rol !== 'CALIDAD' && actor.rol !== 'SUPERVISOR')) return false;
  return actor.perms && actor.perms['campana_' + campana] === true;
}

// Puede EDITAR / ELIMINAR un monitoreo ya guardado: solo rol REPORTES con acceso
// a la campana, o el administrador. Equivale a calCanManageMonitoreos().
function canManageMonitoreos(actor, campana) {
  if (isFullAdmin(actor)) return true;
  if (!actor || actor.rol !== 'REPORTES') return false;
  return actor.perms && actor.perms['campana_' + campana] === true;
}

// Puede CARGAR datos operativos de los dashboards (Excel). Permiso `cargarDatos`
// asignable a cualquier rol desde Gestion de Usuarios, o administrador.
function canLoadData(actor) {
  if (isFullAdmin(actor)) return true;
  return !!(actor && actor.perms && actor.perms.cargarDatos === true);
}

function requireDataLoader(req, res, next) {
  requireActor(req, res, () => {
    if (!canLoadData(req.actor)) {
      return res.status(403).json({ error: 'Sin permiso para cargar datos de dashboards' });
    }
    next();
  });
}

module.exports = {
  signToken,
  requireAuth,
  getActor,
  isFullAdmin,
  can,
  requirePermission,
  requireActor,
  campaignAccess,
  canEvaluateCampaign,
  canManageMonitoreos,
  canLoadData,
  requireDataLoader,
};
