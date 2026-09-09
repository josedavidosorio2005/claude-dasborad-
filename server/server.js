// server.js — API REST de InConexion Platform.
//
// La app se construye en createApp() para poder montarla en pruebas sin abrir
// un puerto. El arranque real (listen + graceful shutdown) solo ocurre cuando
// este archivo se ejecuta directamente (node server.js).
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');

const config = require('./config');
const db = require('./db');
const { signToken, requireAuth, requirePermission } = require('./auth');
const { validate, schemas } = require('./validation');

const MASTER_ADMIN_USER = config.masterAdminUser;
const MASTER_ADMIN_PASSWORD_HASH = config.masterAdminPasswordHash;

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

// Envuelve handlers async para que cualquier rechazo llegue al middleware de errores.
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// ── Helpers ──────────────────────────────────────────────────
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

function nowStr() {
  const d = new Date();
  const pad = (n) => (n < 10 ? '0' + n : '' + n);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function logEvent(accion, targetRow, actorLabel, detalle) {
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
    actorLabel,
    detalle || ''
  );
}

function actorLabel(actor) {
  return `${actor.nombre} (@${actor.user})`;
}

// ── CORS ─────────────────────────────────────────────────────
// Lista blanca explicita. Nunca origin:true. En dev sin CORS_ORIGIN se permite
// localhost; en produccion config.js ya obligo a definir CORS_ORIGIN.
function buildCorsOptions() {
  const allowed = new Set(config.corsOrigins);
  return {
    credentials: true,
    origin(origin, cb) {
      // Peticiones same-origin / curl / apps nativas no mandan Origin.
      if (!origin) return cb(null, true);
      if (allowed.has(origin)) return cb(null, true);
      if (
        !config.isProduction &&
        /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin)
      ) {
        return cb(null, true);
      }
      return cb(new Error(`Origen no permitido por CORS: ${origin}`));
    },
  };
}

// ══════════════════════════════════════════════════════════════
// APP
// ══════════════════════════════════════════════════════════════
function createApp() {
  const app = express();

  // Detras de un reverse proxy (Caddy/Nginx) para que el rate-limit y los logs
  // vean la IP real del cliente y no la del proxy.
  app.set('trust proxy', config.trustProxy);
  app.disable('x-powered-by');

  // Cabeceras de seguridad + CSP explicito.
  // 'unsafe-inline' en script-src es necesario porque public/index.html usa ~105
  // manejadores onclick inline y estilos inline (refactorizarlos queda fuera de
  // alcance). cdnjs.cloudflare.com se permite por xlsx.full.min.js.
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: false,
        directives: {
          defaultSrc: ["'self'"],
          baseUri: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com'],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:'],
          fontSrc: ["'self'", 'data:'],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'self'"],
          formAction: ["'self'"],
          ...(config.isProduction ? { upgradeInsecureRequests: [] } : {}),
        },
      },
      crossOriginEmbedderPolicy: false,
    })
  );

  app.use(cors(buildCorsOptions()));
  app.use(express.json({ limit: '100kb' }));

  // Logging de accesos. morgan NO registra cuerpos ni el header Authorization.
  if (!config.isTest) {
    app.use(morgan(config.isProduction ? 'combined' : 'dev'));
  }

  // ── Rate limiting ──────────────────────────────────────────
  // Global sobre toda la API para frenar abuso; login mas estricto encima.
  const apiLimiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Demasiadas peticiones. Intenta de nuevo mas tarde.' },
  });
  const loginLimiter = rateLimit({
    windowMs: config.loginRateLimit.windowMs,
    max: config.loginRateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
    // Solo penaliza intentos FALLIDOS: un login correcto no gasta el cupo, asi
    // una oficina detras de una sola IP no se autobloquea al usar la app.
    skipSuccessfulRequests: true,
    message: { error: 'Demasiados intentos. Intenta de nuevo en unos minutos.' },
  });

  const api = express.Router();
  app.use('/api', apiLimiter, api);

  // ── Salud (publica) ───────────────────────────────────────
  api.get('/health', (req, res) => res.json({ ok: true }));

  // ══════════════════════════════════════════════════════════
  // AUTH
  // ══════════════════════════════════════════════════════════
  api.post(
    '/auth/login',
    loginLimiter,
    validate(schemas.loginBody),
    wrap(async (req, res) => {
      const { user, password } = req.body;

      // Admin maestro: su hash vive SOLO en variables de entorno.
      if (user === MASTER_ADMIN_USER) {
        const ok = await bcrypt.compare(password, MASTER_ADMIN_PASSWORD_HASH);
        if (!ok) return res.status(401).json({ error: 'Usuario o contrasena incorrectos' });
        const token = signToken({ isMasterAdmin: true, rol: 'ADMIN' });
        return res.json({
          token,
          user: { id: null, nombre: 'Administrador', user: MASTER_ADMIN_USER, rol: 'ADMIN', isMasterAdmin: true },
        });
      }

      const row = db.prepare('SELECT * FROM users WHERE user = ?').get(user);
      if (!row) return res.status(401).json({ error: 'Usuario o contrasena incorrectos' });
      const ok = await bcrypt.compare(password, row.password_hash);
      if (!ok) return res.status(401).json({ error: 'Usuario o contrasena incorrectos' });
      if (!row.active) return res.status(403).json({ error: 'Usuario suspendido. Contacte al administrador.' });

      const token = signToken({ isMasterAdmin: false, userId: row.id, rol: row.rol });
      res.json({ token, user: toPublicUser(row) });
    })
  );

  // ══════════════════════════════════════════════════════════
  // USUARIOS
  // ══════════════════════════════════════════════════════════
  api.get(
    '/users',
    requireAuth,
    wrap((req, res) => {
      const rows = db.prepare('SELECT * FROM users ORDER BY id').all();
      res.json(rows.map(toPublicUser));
    })
  );

  api.post(
    '/users',
    requireAuth,
    requirePermission('crearUsuarios'),
    validate(schemas.createUserBody),
    wrap(async (req, res) => {
      const { nombre, user, password, rol, perms, asesorCampana } = req.body;
      if (user === MASTER_ADMIN_USER) return res.status(400).json({ error: 'Nombre de usuario reservado' });
      const exists = db.prepare('SELECT id FROM users WHERE user = ?').get(user);
      if (exists) return res.status(409).json({ error: 'Ese usuario ya existe' });

      const hash = await bcrypt.hash(password, 10);
      const info = db
        .prepare(
          `INSERT INTO users (nombre, user, rol, active, password_hash, perms, asesorCampana, createdAt)
           VALUES (?,?,?,1,?,?,?,?)`
        )
        .run(nombre, user, rol, hash, JSON.stringify(perms || {}), asesorCampana || null, nowStr());
      const row = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
      logEvent('CREADO', row, actorLabel(req.actor), `Rol: ${rol}`);
      res.status(201).json(toPublicUser(row));
    })
  );

  api.put(
    '/users/:id',
    requireAuth,
    requirePermission('editarUsuarios'),
    validate(schemas.idParamSchema, 'params'),
    validate(schemas.updateUserBody),
    wrap(async (req, res) => {
      const id = req.params.id;
      const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
      if (!row) return res.status(404).json({ error: 'Usuario no encontrado' });

      const { nombre, user, rol, password, perms, asesorCampana } = req.body;
      if (user && user === MASTER_ADMIN_USER) return res.status(400).json({ error: 'Nombre de usuario reservado' });
      if (user) {
        const dupe = db.prepare('SELECT id FROM users WHERE user = ? AND id != ?').get(user, id);
        if (dupe) return res.status(409).json({ error: 'Ese usuario ya existe' });
      }

      const newHash = password ? await bcrypt.hash(password, 10) : row.password_hash;
      db.prepare(
        `UPDATE users SET nombre=?, user=?, rol=?, password_hash=?, perms=?, asesorCampana=? WHERE id=?`
      ).run(
        nombre ?? row.nombre,
        user ?? row.user,
        rol ?? row.rol,
        newHash,
        JSON.stringify(perms ?? JSON.parse(row.perms || '{}')),
        asesorCampana ?? row.asesorCampana,
        id
      );
      const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
      logEvent('EDITADO', updated, actorLabel(req.actor), 'Datos actualizados');
      res.json(toPublicUser(updated));
    })
  );

  api.put(
    '/users/:id/password',
    requireAuth,
    requirePermission('cambiarPassword'),
    validate(schemas.idParamSchema, 'params'),
    validate(schemas.changePasswordBody),
    wrap(async (req, res) => {
      const id = req.params.id;
      const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
      if (!row) return res.status(404).json({ error: 'Usuario no encontrado' });
      const hash = await bcrypt.hash(req.body.password, 10);
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, id);
      logEvent('PASSWORD', row, actorLabel(req.actor), 'Contrasena cambiada');
      res.json({ ok: true });
    })
  );

  api.put(
    '/users/:id/active',
    requireAuth,
    requirePermission('suspenderUsuarios'),
    validate(schemas.idParamSchema, 'params'),
    wrap((req, res) => {
      const id = req.params.id;
      const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
      if (!row) return res.status(404).json({ error: 'Usuario no encontrado' });
      const newActive = row.active ? 0 : 1;
      db.prepare('UPDATE users SET active = ? WHERE id = ?').run(newActive, id);
      logEvent(newActive ? 'ACTIVADO' : 'SUSPENDIDO', row, actorLabel(req.actor), '');
      res.json({ ok: true, active: !!newActive });
    })
  );

  api.put(
    '/users/:id/perms',
    requireAuth,
    requirePermission('gestionPermisos'),
    validate(schemas.idParamSchema, 'params'),
    validate(schemas.updatePermsBody),
    wrap((req, res) => {
      const id = req.params.id;
      const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
      if (!row) return res.status(404).json({ error: 'Usuario no encontrado' });
      db.prepare('UPDATE users SET perms = ? WHERE id = ?').run(JSON.stringify(req.body.perms), id);
      logEvent('PERMISOS', row, actorLabel(req.actor), 'Permisos actualizados');
      res.json({ ok: true });
    })
  );

  api.delete(
    '/users/:id',
    requireAuth,
    requirePermission('eliminarUsuarios'),
    validate(schemas.idParamSchema, 'params'),
    wrap((req, res) => {
      const id = req.params.id;
      const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
      if (!row) return res.status(404).json({ error: 'Usuario no encontrado' });
      db.prepare('DELETE FROM users WHERE id = ?').run(id);
      logEvent('ELIMINADO', row, actorLabel(req.actor), '');
      res.json({ ok: true });
    })
  );

  // ══════════════════════════════════════════════════════════
  // HISTORIAL (append-only, nunca se borra desde la API)
  // ══════════════════════════════════════════════════════════
  api.get(
    '/historial',
    requireAuth,
    wrap((req, res) => {
      const rows = db.prepare('SELECT * FROM historial ORDER BY ts DESC').all();
      res.json(rows);
    })
  );

  // 404 JSON para rutas de API desconocidas (antes del fallback SPA).
  api.use((req, res) => res.status(404).json({ error: 'Recurso no encontrado' }));

  // ── Frontend estatico + fallback SPA ──────────────────────
  app.use(express.static(PUBLIC_DIR));
  app.get('*', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));

  // ── Manejo de errores centralizado ────────────────────────
  // Loguea el detalle real en el servidor, responde generico al cliente.
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err && /CORS/.test(err.message || '')) {
      return res.status(403).json({ error: 'Origen no permitido' });
    }
    if (err && err.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Cuerpo de la peticion demasiado grande' });
    }
    if (err && (err.type === 'entity.parse.failed' || err instanceof SyntaxError)) {
      return res.status(400).json({ error: 'JSON invalido' });
    }
    console.error('[error]', req.method, req.originalUrl, '-', err && err.stack ? err.stack : err);
    res.status(500).json({ error: 'Error interno del servidor' });
  });

  return app;
}

// ══════════════════════════════════════════════════════════════
// ARRANQUE (solo si se ejecuta directamente)
// ══════════════════════════════════════════════════════════════
function start() {
  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(
      `InConexion backend escuchando en http://localhost:${config.port} (${config.nodeEnv})`
    );
  });

  let shuttingDown = false;
  function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`\n[shutdown] Recibido ${signal}. Cerrando ordenadamente...`);

    const guard = setTimeout(() => {
      console.error('[shutdown] Timeout. Forzando salida.');
      process.exit(1);
    }, 10000);
    guard.unref();

    server.close((err) => {
      if (err) {
        console.error('[shutdown] Error cerrando el servidor HTTP:', err.message);
        db.closeDb();
        return process.exit(1);
      }
      db.closeDb();
      console.log('[shutdown] Servidor HTTP y base de datos cerrados. Adios.');
      process.exit(0);
    });
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  return server;
}

if (require.main === module) {
  start();
}

module.exports = { createApp, start };
