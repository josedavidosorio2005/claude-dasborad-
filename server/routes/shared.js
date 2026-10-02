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

// extra (opcional): { ip, userAgent, fecha } -- usado SOLO por los eventos
// de inicio/cierre de sesion (routes/auth.js). `fecha` permite pasar la
// hora de Colombia ya calculada (fechaLimitesAhoraColombiaStr) en vez de la
// hora LOCAL DEL PROCESO que da nowStr() (correcta en dev, pero UTC en
// produccion -- el servidor de AWS corre en UTC, ver fecha-limites.js). El
// resto de acciones (ya existentes) no pasa `extra` y sigue exactamente
// igual que antes.
function logEvent(accion, targetRow, actorLabelStr, detalle, extra) {
  const opts = extra || {};
  db.prepare(
    `INSERT INTO historial (ts, fecha, accion, nombre, username, rol, actor, detalle, ip, userAgent)
     VALUES (?,?,?,?,?,?,?,?,?,?)`
  ).run(
    Date.now(),
    opts.fecha || nowStr(),
    accion,
    targetRow ? targetRow.nombre : '-',
    targetRow ? targetRow.user : '-',
    targetRow ? targetRow.rol : '-',
    actorLabelStr,
    detalle || '',
    opts.ip || null,
    opts.userAgent || null
  );
}

// Resume un User-Agent crudo a "Navegador / Sistema operativo" (ej. "Chrome
// / Windows") -- Fase 113 (tema A): el registro de inicios de sesion nunca
// guarda el User-Agent crudo completo (puede traer version exacta de SO/
// navegador, info redundante para auditoria), solo este resumen. Regex
// simples a proposito (sin dependencia nueva) -- el orden importa: Edge/
// Opera incluyen "Chrome/" en su propio User-Agent, asi que se revisan antes.
function summarizeUserAgent(ua) {
  if (!ua || typeof ua !== 'string') return 'Desconocido';
  let navegador = 'Otro';
  if (/Edg\//.test(ua)) navegador = 'Edge';
  else if (/OPR\//.test(ua) || /Opera/.test(ua)) navegador = 'Opera';
  else if (/Firefox\//.test(ua)) navegador = 'Firefox';
  else if (/Chrome\//.test(ua)) navegador = 'Chrome';
  else if (/Safari\//.test(ua)) navegador = 'Safari';

  let so = 'Desconocido';
  if (/Windows/.test(ua)) so = 'Windows';
  else if (/Android/.test(ua)) so = 'Android';
  else if (/iPhone|iPad|iPod|iOS/.test(ua)) so = 'iOS';
  else if (/Mac OS X/.test(ua)) so = 'Mac';
  else if (/Linux/.test(ua)) so = 'Linux';

  return `${navegador} / ${so}`;
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
    // Fase 113 (tema A): "Ultimo ingreso" en la lista de Usuarios. NULL para
    // una cuenta que no ha iniciado sesion desde este deploy (el frontend
    // muestra "Sin registro" para ese caso) -- ver routes/usuarios.js para el
    // filtro adicional que oculta este campo a quien no sea admin completo.
    lastLogin: row.last_login_at || null,
  };
}

module.exports = {
  wrap,
  nowStr,
  actorLabel,
  logEvent,
  summarizeUserAgent,
  toPublicUser,
  MASTER_ADMIN_USER,
  MASTER_ADMIN_PASSWORD_HASH,
};
