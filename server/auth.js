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

// Fase 102 (endurecimiento, defensa en profundidad): fija el algoritmo en
// vez de dejar que `jsonwebtoken` decida por defecto -- con un secreto de
// texto plano la libreria ya solo acepta HS256/384/512 (nunca `alg:none` ni
// confusion RS<->HS), asi que esto no cambia ningun comportamiento real,
// solo deja de depender de un default implicito de una dependencia externa.
const JWT_ALGORITHM = 'HS256';

function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN, algorithm: JWT_ALGORITHM });
}

// Middleware: exige un token válido en el header Authorization: Bearer <token>
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No autenticado' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET, { algorithms: [JWT_ALGORITHM] });
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
  // Fase 113 (tema B): un token firmado ANTES de un cambio de contrasena
  // (propio o por reseteo de admin) trae una tokenVersion vieja -- se
  // incrementa token_version en BD al cambiar la contrasena, asi que
  // comparar aqui invalida ese token de inmediato en la SIGUIENTE peticion,
  // sin necesidad de guardar una lista de tokens revocados. Se trata igual
  // que "actor no encontrado" (401 generico) para no distinguir el motivo.
  if (req.auth.tokenVersion !== row.token_version) return null;
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
      req.auth = jwt.verify(token, JWT_SECRET, { algorithms: [JWT_ALGORITHM] });
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
// Campanas multi-sede (HOSPITAL LA MARIA: Castilla/Sede33 — ver
// docs/ARQUITECTURA.md): desde la consolidacion de sede (2026-09-15) la
// sede es un ATRIBUTO del dato (columna `sede`), no una campana distinta,
// asi que ya no hace falta ningun mapeo especial aqui: quien tiene
// campana_HOSPITAL LA MARIA / cliente_HOSPITAL LA MARIA ve AMBAS sedes (el
// filtro de sede en el dashboard/panel es solo de visualizacion, no una
// frontera de permisos — decision explicita: el modelo de permisos de esta
// plataforma nunca tuvo granularidad por sede en ningun otro modulo, y
// dashboards_config.vista ya trataba a HOSPITAL LA MARIA como un solo
// dashboard con ambas sedes visibles desde antes de esta migracion).
function campaignAccess(actor, campana) {
  if (isFullAdmin(actor)) return true;
  if (!actor || !actor.perms) return false;
  return actor.perms['campana_' + campana] === true || actor.perms['cliente_' + campana] === true;
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
