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
const {
  signToken,
  requireAuth,
  requirePermission,
  requireActor,
  isFullAdmin,
  can,
  campaignAccess,
  canEvaluateCampaign,
  canManageMonitoreos,
  canLoadData,
  requireDataLoader,
} = require('./auth');
const { validate, schemas } = require('./validation');
const calc = require('./calidad-logic');
const secciones = require('./dashboard-secciones');
const { ADAPTERS } = require('./dashboard-adapters');
const { cargarNivelServicioDiario } = require('./nivel-servicio-diario');
const traficoSkills = require('./trafico-skills');

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

// Defaults de permisos ligados al rol (feedback de Edwin 2.1).
// El rol REPORTES es quien monta los datos que alimentan los dashboards, asi que
// siempre trae `cargarDatos: true` sin que nadie se lo asigne a mano — al crear
// el usuario y al cambiarle el rol a REPORTES.
function applyRolePermDefaults(rol, perms) {
  const p = perms && typeof perms === 'object' ? { ...perms } : {};
  if (rol === 'REPORTES') p.cargarDatos = true;
  return p;
}

// ── Helpers del modulo de Calidad ────────────────────────────
function getPlantillaRow(campana) {
  return db
    .prepare('SELECT * FROM calidad_plantillas WHERE campana = ? AND activo = 1')
    .get(campana);
}

function toPlantilla(row) {
  return {
    campana: row.campana,
    engine: row.engine,
    items: JSON.parse(row.items || '[]'),
    updatedAt: row.updatedAt,
  };
}

function toMonitoreo(row) {
  return {
    id: row.id,
    campana: row.campana,
    asesor: row.asesor,
    fecha: row.fecha,
    mes: row.mes,
    canal: row.canal,
    idLlamada: row.idLlamada || '',
    telefono: row.telefono || '',
    codificacion: row.codificacion || '',
    evaluador: row.evaluador,
    evaluadorUserId: row.evaluadorUserId,
    answers: JSON.parse(row.answers || '{}'),
    puntaje: row.puntaje,
    clasificacion: row.clasificacion,
    fallos: row.fallos,
    nivelCritico: row.nivelCritico,
    observaciones: row.observaciones || '',
    createdAt: row.createdAt,
    updatedAt: row.updatedAt || null,
  };
}

function toMetaRow(row) {
  return calc.withDerived({
    id: row.id,
    campana: row.campana,
    mes: row.mes,
    liderId: row.liderId,
    liderNombre: row.liderNombre,
    metaGrupal: row.metaGrupal,
    asesores: row.asesores,
    diasLaborales: row.diasLaborales,
    whatsapp: !!row.whatsapp,
    pctWhatsapp: row.pctWhatsapp,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  });
}

function toNivelServicioRow(row) {
  const pct = calc.nivelServicioPct(row.contestadas20s, row.llamadasTotales);
  return {
    id: row.id,
    campana: row.campana,
    mes: row.mes,
    contestadas20s: row.contestadas20s,
    llamadasTotales: row.llamadasTotales,
    pct,
    cumple: calc.nivelServicioCumple(pct),
    umbral: calc.NIVEL_SERVICIO_UMBRAL,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// Registra un evento del modulo de Calidad en el historial (mismo append-only
// que usuarios). El "objetivo" es sintetico: nombre = asesor/lider, rol = campana.
function logCalEvent(accion, nombre, campana, actor, detalle) {
  logEvent(accion, { nombre: nombre || '-', user: '-', rol: campana || '-' }, actorLabel(actor), detalle || '');
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

  // ── Estado de datos de demostracion (scripts/seed-demo.js) ─────────────
  // Cualquier usuario autenticado puede leerlo: es lo que pinta el banner
  // "DATOS DE DEMOSTRACION" en el frontend, y debe verse en TODOS los roles,
  // no solo el administrador. `activo` sale de si hay algo marcado en
  // seed_demo_marcas — se enciende solo al sembrar y se apaga solo al
  // limpiar (seed:demo:limpiar), sin desplegar nada.
  api.get(
    '/seed-demo/estado',
    requireActor,
    wrap((req, res) => {
      res.set('Cache-Control', 'no-store');
      const row = db.prepare('SELECT COUNT(*) AS c FROM seed_demo_marcas').get();
      res.json({ activo: row.c > 0, marcas: row.c });
    })
  );

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
    requireActor,
    wrap((req, res) => {
      const rows = db.prepare('SELECT * FROM users ORDER BY id').all();
      // La matriz de permisos de TODOS los usuarios solo la ve quien administra
      // usuarios o permisos (o el admin). El resto recibe la lista con `perms`
      // vacio: los selects que la consumen (asesor, lider) usan id/nombre/rol/
      // asesorCampana, y las pantallas que necesitan `perms` ajenos (gestion de
      // permisos, cronograma de metas, matriz de Reportes) son de rol privilegiado.
      const fullView =
        isFullAdmin(req.actor) ||
        can(req.actor, 'gestionPermisos') ||
        can(req.actor, 'crearUsuarios') ||
        can(req.actor, 'editarUsuarios');
      res.json(
        rows.map(toPublicUser).map((u) => (fullView ? u : { ...u, perms: {} }))
      );
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
        .run(nombre, user, rol, hash, JSON.stringify(applyRolePermDefaults(rol, perms)), asesorCampana || null, nowStr());
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
      const effectiveRol = rol ?? row.rol;
      const basePerms = perms ?? JSON.parse(row.perms || '{}');
      db.prepare(
        `UPDATE users SET nombre=?, user=?, rol=?, password_hash=?, perms=?, asesorCampana=? WHERE id=?`
      ).run(
        nombre ?? row.nombre,
        user ?? row.user,
        effectiveRol,
        newHash,
        JSON.stringify(applyRolePermDefaults(effectiveRol, basePerms)),
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

  // Los datos de Calidad cambian con cada monitoreo/meta: nunca cachear las
  // respuestas (evita 304 con cuerpo viejo tras un POST).
  api.use(['/monitoreos', '/metas', '/calidad'], (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  // ══════════════════════════════════════════════════════════
  // CALIDAD — PLANTILLAS (formato de evaluacion por campana)
  // ══════════════════════════════════════════════════════════
  api.get(
    '/calidad/plantillas',
    requireActor,
    wrap((req, res) => {
      const rows = db
        .prepare('SELECT * FROM calidad_plantillas WHERE activo = 1 ORDER BY campana')
        .all();
      res.json(rows.map(toPlantilla));
    })
  );

  api.get(
    '/calidad/plantillas/:campana',
    requireActor,
    wrap((req, res) => {
      const row = getPlantillaRow(req.params.campana);
      if (!row) return res.status(404).json({ error: 'No hay plantilla para esa campana' });
      res.json(toPlantilla(row));
    })
  );

  // ══════════════════════════════════════════════════════════
  // CALIDAD — MONITOREOS
  // ══════════════════════════════════════════════════════════

  // Resumen por asesor + agregados de la campana/mes. Antes de /:id.
  api.get(
    '/monitoreos/resumen',
    requireActor,
    validate(schemas.calidadQuery, 'query'),
    wrap((req, res) => {
      const { campana, mes } = req.query;
      if (!campaignAccess(req.actor, campana)) {
        return res.status(403).json({ error: 'Sin acceso a los datos de esta campana' });
      }
      const rows = mes
        ? db.prepare('SELECT * FROM monitoreos WHERE campana = ? AND mes = ?').all(campana, mes)
        : db.prepare('SELECT * FROM monitoreos WHERE campana = ?').all(campana);
      const monitoreos = rows.map(toMonitoreo);
      res.json({
        campana,
        mes: mes || null,
        agregados: calc.resumenCampana(monitoreos),
        porAsesor: calc.resumenPorAsesor(monitoreos),
      });
    })
  );

  // Los monitoreos del asesor logueado (portal ASESOR). Empareja por nombre,
  // igual que el dropdown de asesores del formulario. Antes de /:id.
  api.get(
    '/monitoreos/mios',
    requireActor,
    wrap((req, res) => {
      const nombre = (req.actor.nombre || '').trim().toLowerCase();
      if (!nombre) return res.json([]);
      const rows = db
        .prepare(
          "SELECT * FROM monitoreos WHERE lower(trim(asesor)) = ? ORDER BY fecha DESC, id DESC"
        )
        .all(nombre);
      res.json(rows.map(toMonitoreo));
    })
  );

  api.get(
    '/monitoreos',
    requireActor,
    validate(schemas.calidadQuery, 'query'),
    wrap((req, res) => {
      const { campana, mes } = req.query;
      if (!campaignAccess(req.actor, campana)) {
        return res.status(403).json({ error: 'Sin acceso a los datos de esta campana' });
      }
      const rows = mes
        ? db
            .prepare('SELECT * FROM monitoreos WHERE campana = ? AND mes = ? ORDER BY id DESC')
            .all(campana, mes)
        : db.prepare('SELECT * FROM monitoreos WHERE campana = ? ORDER BY id DESC').all(campana);
      res.json(rows.map(toMonitoreo));
    })
  );

  api.post(
    '/monitoreos',
    requireActor,
    validate(schemas.createMonitoreoBody),
    wrap((req, res) => {
      const b = req.body;
      if (!canEvaluateCampaign(req.actor, b.campana)) {
        return res.status(403).json({ error: 'No tiene permiso para evaluar esta campana' });
      }
      const plantillaRow = getPlantillaRow(b.campana);
      if (!plantillaRow) {
        return res.status(400).json({ error: 'Esa campana no tiene plantilla de calificacion' });
      }
      const plantilla = toPlantilla(plantillaRow);
      const score = calc.computeScore(plantilla.items, b.answers, plantilla.engine);
      if (score.puntaje === null) {
        return res.status(400).json({ error: 'Responda al menos un item de la plantilla' });
      }
      const now = nowStr();
      const evaluador = b.evaluador || req.actor.nombre;
      const info = db
        .prepare(
          `INSERT INTO monitoreos
             (campana, asesor, fecha, mes, canal, idLlamada, telefono, codificacion,
              evaluador, evaluadorUserId, answers, puntaje, clasificacion, fallos,
              nivelCritico, observaciones, createdAt)
           VALUES (@campana,@asesor,@fecha,@mes,@canal,@idLlamada,@telefono,@codificacion,
                   @evaluador,@evaluadorUserId,@answers,@puntaje,@clasificacion,@fallos,
                   @nivelCritico,@observaciones,@createdAt)`
        )
        .run({
          campana: b.campana,
          asesor: b.asesor,
          fecha: b.fecha,
          mes: calc.monthKey(b.fecha),
          canal: b.canal,
          idLlamada: b.idLlamada || null,
          telefono: b.telefono || null,
          codificacion: b.codificacion || null,
          evaluador,
          evaluadorUserId: req.actor.isMasterAdmin ? null : req.actor.id,
          answers: JSON.stringify(b.answers),
          puntaje: score.puntaje,
          clasificacion: score.clasificacion,
          fallos: score.fallos,
          nivelCritico: score.nivelCritico,
          observaciones: b.observaciones || null,
          createdAt: now,
        });
      const row = db.prepare('SELECT * FROM monitoreos WHERE id = ?').get(info.lastInsertRowid);
      logCalEvent('MONITOREO', b.asesor, b.campana, req.actor, `Puntaje: ${score.puntaje}`);
      res.status(201).json(toMonitoreo(row));
    })
  );

  api.put(
    '/monitoreos/:id',
    requireActor,
    validate(schemas.idParamSchema, 'params'),
    validate(schemas.updateMonitoreoBody),
    wrap((req, res) => {
      const row = db.prepare('SELECT * FROM monitoreos WHERE id = ?').get(req.params.id);
      if (!row) return res.status(404).json({ error: 'Monitoreo no encontrado' });
      if (!canManageMonitoreos(req.actor, row.campana)) {
        return res
          .status(403)
          .json({ error: 'Solo el rol Reportes o el Administrador pueden editar un monitoreo guardado' });
      }
      const b = req.body;
      const plantilla = toPlantilla(getPlantillaRow(row.campana));
      const answers = b.answers || JSON.parse(row.answers || '{}');
      const score = calc.computeScore(plantilla.items, answers, plantilla.engine);
      if (score.puntaje === null) {
        return res.status(400).json({ error: 'Responda al menos un item de la plantilla' });
      }
      const fecha = b.fecha || row.fecha;
      db.prepare(
        `UPDATE monitoreos SET
           asesor=?, fecha=?, mes=?, canal=?, idLlamada=?, telefono=?, codificacion=?,
           evaluador=?, answers=?, puntaje=?, clasificacion=?, fallos=?, nivelCritico=?,
           observaciones=?, updatedAt=?
         WHERE id=?`
      ).run(
        b.asesor ?? row.asesor,
        fecha,
        calc.monthKey(fecha),
        b.canal ?? row.canal,
        (b.idLlamada ?? row.idLlamada) || null,
        (b.telefono ?? row.telefono) || null,
        (b.codificacion ?? row.codificacion) || null,
        b.evaluador ?? row.evaluador,
        JSON.stringify(answers),
        score.puntaje,
        score.clasificacion,
        score.fallos,
        score.nivelCritico,
        (b.observaciones ?? row.observaciones) || null,
        nowStr(),
        row.id
      );
      const updated = db.prepare('SELECT * FROM monitoreos WHERE id = ?').get(row.id);
      logCalEvent('MONITOREO_EDIT', updated.asesor, row.campana, req.actor, `Puntaje: ${score.puntaje}`);
      res.json(toMonitoreo(updated));
    })
  );

  api.delete(
    '/monitoreos/:id',
    requireActor,
    validate(schemas.idParamSchema, 'params'),
    wrap((req, res) => {
      const row = db.prepare('SELECT * FROM monitoreos WHERE id = ?').get(req.params.id);
      if (!row) return res.status(404).json({ error: 'Monitoreo no encontrado' });
      if (!canManageMonitoreos(req.actor, row.campana)) {
        return res
          .status(403)
          .json({ error: 'Solo el rol Reportes o el Administrador pueden eliminar un monitoreo guardado' });
      }
      db.prepare('DELETE FROM monitoreos WHERE id = ?').run(row.id);
      logCalEvent('MONITOREO_DEL', row.asesor, row.campana, req.actor, '');
      res.json({ ok: true });
    })
  );

  // ══════════════════════════════════════════════════════════
  // CALIDAD — CRONOGRAMA Y METAS
  // ══════════════════════════════════════════════════════════

  // Cumplimiento individual por lider (calculo reproducible en servidor). Antes de /:id.
  api.get(
    '/metas/cumplimiento',
    requireActor,
    validate(schemas.calidadQuery, 'query'),
    wrap((req, res) => {
      const { campana } = req.query;
      const mes = req.query.mes || new Date().toISOString().slice(0, 7);
      if (!campaignAccess(req.actor, campana)) {
        return res.status(403).json({ error: 'Sin acceso a los datos de esta campana' });
      }
      const cronograma = db
        .prepare('SELECT * FROM cronograma_metas WHERE campana = ?')
        .all(campana)
        .map(toMetaRow);
      const monitoreos = db
        .prepare('SELECT * FROM monitoreos WHERE campana = ?')
        .all(campana)
        .map(toMonitoreo);
      res.json({
        campana,
        mes,
        lideres: calc.lideresCumplimiento(monitoreos, cronograma, mes),
      });
    })
  );

  // La meta individual del usuario logueado para una campana/mes (con carry-forward).
  api.get(
    '/metas/mi-meta',
    requireActor,
    validate(schemas.calidadQuery, 'query'),
    wrap((req, res) => {
      const { campana } = req.query;
      const mes = req.query.mes || new Date().toISOString().slice(0, 7);
      if (req.actor.isMasterAdmin) return res.json({ campana, mes, meta: null });
      const cronograma = db
        .prepare('SELECT * FROM cronograma_metas WHERE campana = ?')
        .all(campana)
        .map(toMetaRow);
      res.json({
        campana,
        mes,
        meta: calc.metaForLiderInMonth(cronograma, mes, req.actor.id),
      });
    })
  );

  api.get(
    '/metas',
    requireActor,
    wrap((req, res) => {
      const campana = req.query.campana;
      if (campana) {
        if (!campaignAccess(req.actor, campana)) {
          return res.status(403).json({ error: 'Sin acceso a los datos de esta campana' });
        }
        const rows = db
          .prepare('SELECT * FROM cronograma_metas WHERE campana = ? ORDER BY mes DESC, liderNombre')
          .all(campana);
        return res.json(rows.map(toMetaRow));
      }
      // Sin campana: solo el administrador puede ver el cronograma completo.
      if (!isFullAdmin(req.actor)) {
        return res.status(403).json({ error: 'Indique una campana' });
      }
      const rows = db
        .prepare('SELECT * FROM cronograma_metas ORDER BY mes DESC, campana, liderNombre')
        .all();
      res.json(rows.map(toMetaRow));
    })
  );

  api.post(
    '/metas',
    requireActor,
    validate(schemas.metaBody),
    wrap((req, res) => {
      if (!isFullAdmin(req.actor)) {
        return res.status(403).json({ error: 'Solo el administrador puede configurar el cronograma' });
      }
      const b = req.body;
      const lider = db.prepare('SELECT * FROM users WHERE id = ?').get(b.liderId);
      if (!lider) return res.status(400).json({ error: 'Usuario responsable no encontrado' });
      if (lider.rol !== 'CALIDAD' && lider.rol !== 'SUPERVISOR') {
        return res
          .status(400)
          .json({ error: 'El responsable debe tener rol CALIDAD o SUPERVISOR' });
      }
      const now = nowStr();
      const existing = db
        .prepare('SELECT * FROM cronograma_metas WHERE campana = ? AND mes = ? AND liderId = ?')
        .get(b.campana, b.mes, b.liderId);
      if (existing) {
        db.prepare(
          `UPDATE cronograma_metas SET
             liderNombre=?, metaGrupal=?, asesores=?, diasLaborales=?, whatsapp=?, pctWhatsapp=?, updatedAt=?
           WHERE id=?`
        ).run(
          lider.nombre,
          b.metaGrupal,
          b.asesores,
          b.diasLaborales,
          b.whatsapp ? 1 : 0,
          b.pctWhatsapp,
          now,
          existing.id
        );
        const row = db.prepare('SELECT * FROM cronograma_metas WHERE id = ?').get(existing.id);
        logCalEvent('META_EDIT', lider.nombre, b.campana, req.actor, `${b.mes} — meta ${b.metaGrupal}`);
        return res.json(toMetaRow(row));
      }
      const info = db
        .prepare(
          `INSERT INTO cronograma_metas
             (campana, mes, liderId, liderNombre, metaGrupal, asesores, diasLaborales,
              whatsapp, pctWhatsapp, createdAt, updatedAt)
           VALUES (@campana,@mes,@liderId,@liderNombre,@metaGrupal,@asesores,@diasLaborales,
                   @whatsapp,@pctWhatsapp,@createdAt,@updatedAt)`
        )
        .run({
          campana: b.campana,
          mes: b.mes,
          liderId: b.liderId,
          liderNombre: lider.nombre,
          metaGrupal: b.metaGrupal,
          asesores: b.asesores,
          diasLaborales: b.diasLaborales,
          whatsapp: b.whatsapp ? 1 : 0,
          pctWhatsapp: b.pctWhatsapp,
          createdAt: now,
          updatedAt: now,
        });
      const row = db.prepare('SELECT * FROM cronograma_metas WHERE id = ?').get(info.lastInsertRowid);
      logCalEvent('META', lider.nombre, b.campana, req.actor, `${b.mes} — meta ${b.metaGrupal}`);
      res.status(201).json(toMetaRow(row));
    })
  );

  api.put(
    '/metas/:id',
    requireActor,
    validate(schemas.idParamSchema, 'params'),
    validate(schemas.updateMetaBody),
    wrap((req, res) => {
      if (!isFullAdmin(req.actor)) {
        return res.status(403).json({ error: 'Solo el administrador puede editar el cronograma' });
      }
      const row = db.prepare('SELECT * FROM cronograma_metas WHERE id = ?').get(req.params.id);
      if (!row) return res.status(404).json({ error: 'Meta no encontrada' });
      const b = req.body;
      let liderNombre = row.liderNombre;
      let liderId = row.liderId;
      if (b.liderId && b.liderId !== row.liderId) {
        const lider = db.prepare('SELECT * FROM users WHERE id = ?').get(b.liderId);
        if (!lider) return res.status(400).json({ error: 'Usuario responsable no encontrado' });
        if (lider.rol !== 'CALIDAD' && lider.rol !== 'SUPERVISOR') {
          return res.status(400).json({ error: 'El responsable debe tener rol CALIDAD o SUPERVISOR' });
        }
        liderNombre = lider.nombre;
        liderId = lider.id;
      }
      try {
        db.prepare(
          `UPDATE cronograma_metas SET
             campana=?, mes=?, liderId=?, liderNombre=?, metaGrupal=?, asesores=?,
             diasLaborales=?, whatsapp=?, pctWhatsapp=?, updatedAt=?
           WHERE id=?`
        ).run(
          b.campana ?? row.campana,
          b.mes ?? row.mes,
          liderId,
          liderNombre,
          b.metaGrupal ?? row.metaGrupal,
          b.asesores ?? row.asesores,
          b.diasLaborales ?? row.diasLaborales,
          b.whatsapp === undefined ? row.whatsapp : b.whatsapp ? 1 : 0,
          b.pctWhatsapp ?? row.pctWhatsapp,
          nowStr(),
          row.id
        );
      } catch (e) {
        // Ya existe otra meta para esa (campana, mes, liderId) -> conflicto amigable,
        // no un 500 generico (UNIQUE(campana, mes, liderId) en cronograma_metas).
        if (e && e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
          return res.status(409).json({ error: 'Ya existe una meta para esa campana, mes y lider responsable' });
        }
        throw e;
      }
      const updated = db.prepare('SELECT * FROM cronograma_metas WHERE id = ?').get(row.id);
      logCalEvent('META_EDIT', updated.liderNombre, updated.campana, req.actor, `${updated.mes}`);
      res.json(toMetaRow(updated));
    })
  );

  api.delete(
    '/metas/:id',
    requireActor,
    validate(schemas.idParamSchema, 'params'),
    wrap((req, res) => {
      if (!isFullAdmin(req.actor)) {
        return res.status(403).json({ error: 'Solo el administrador puede eliminar del cronograma' });
      }
      const row = db.prepare('SELECT * FROM cronograma_metas WHERE id = ?').get(req.params.id);
      if (!row) return res.status(404).json({ error: 'Meta no encontrada' });
      db.prepare('DELETE FROM cronograma_metas WHERE id = ?').run(row.id);
      logCalEvent('META_DEL', row.liderNombre, row.campana, req.actor, `${row.mes}`);
      res.json({ ok: true });
    })
  );

  // ══════════════════════════════════════════════════════════
  // CALIDAD — NIVEL DE SERVICIO (feedback de Edwin, punto 3.2)
  // % de llamadas contestadas en <=20s sobre el total, por campana/mes.
  // ══════════════════════════════════════════════════════════
  api.get(
    '/calidad/nivel-servicio',
    requireActor,
    wrap((req, res) => {
      const campana = req.query.campana;
      if (campana) {
        if (!campaignAccess(req.actor, campana)) {
          return res.status(403).json({ error: 'Sin acceso a los datos de esta campana' });
        }
        const rows = db
          .prepare('SELECT * FROM calidad_nivel_servicio WHERE campana = ? ORDER BY mes DESC')
          .all(campana);
        return res.json(rows.map(toNivelServicioRow));
      }
      // Sin campana: solo el administrador puede ver el listado completo.
      if (!isFullAdmin(req.actor)) {
        return res.status(403).json({ error: 'Indique una campana' });
      }
      const rows = db
        .prepare('SELECT * FROM calidad_nivel_servicio ORDER BY mes DESC, campana')
        .all();
      res.json(rows.map(toNivelServicioRow));
    })
  );

  api.post(
    '/calidad/nivel-servicio',
    requireActor,
    validate(schemas.nivelServicioBody),
    wrap((req, res) => {
      if (!isFullAdmin(req.actor)) {
        return res.status(403).json({ error: 'Solo el administrador puede cargar el nivel de servicio' });
      }
      const b = req.body;
      const now = nowStr();
      const existing = db
        .prepare('SELECT * FROM calidad_nivel_servicio WHERE campana = ? AND mes = ?')
        .get(b.campana, b.mes);
      if (existing) {
        db.prepare(
          'UPDATE calidad_nivel_servicio SET contestadas20s=?, llamadasTotales=?, updatedAt=? WHERE id=?'
        ).run(b.contestadas20s, b.llamadasTotales, now, existing.id);
        const row = db.prepare('SELECT * FROM calidad_nivel_servicio WHERE id = ?').get(existing.id);
        logCalEvent(
          'NIVEL_SERVICIO_EDIT',
          '-',
          b.campana,
          req.actor,
          `${b.mes} — ${b.contestadas20s}/${b.llamadasTotales}`
        );
        return res.json(toNivelServicioRow(row));
      }
      const info = db
        .prepare(
          `INSERT INTO calidad_nivel_servicio
             (campana, mes, contestadas20s, llamadasTotales, createdAt, updatedAt)
           VALUES (@campana,@mes,@contestadas20s,@llamadasTotales,@createdAt,@updatedAt)`
        )
        .run({
          campana: b.campana,
          mes: b.mes,
          contestadas20s: b.contestadas20s,
          llamadasTotales: b.llamadasTotales,
          createdAt: now,
          updatedAt: now,
        });
      const row = db.prepare('SELECT * FROM calidad_nivel_servicio WHERE id = ?').get(info.lastInsertRowid);
      logCalEvent(
        'NIVEL_SERVICIO',
        '-',
        b.campana,
        req.actor,
        `${b.mes} — ${b.contestadas20s}/${b.llamadasTotales}`
      );
      res.status(201).json(toNivelServicioRow(row));
    })
  );

  api.put(
    '/calidad/nivel-servicio/:id',
    requireActor,
    validate(schemas.idParamSchema, 'params'),
    validate(schemas.updateNivelServicioBody),
    wrap((req, res) => {
      if (!isFullAdmin(req.actor)) {
        return res.status(403).json({ error: 'Solo el administrador puede editar el nivel de servicio' });
      }
      const row = db.prepare('SELECT * FROM calidad_nivel_servicio WHERE id = ?').get(req.params.id);
      if (!row) return res.status(404).json({ error: 'Registro no encontrado' });
      const b = req.body;
      const contestadas20s = b.contestadas20s ?? row.contestadas20s;
      const llamadasTotales = b.llamadasTotales ?? row.llamadasTotales;
      if (contestadas20s > llamadasTotales) {
        return res.status(400).json({ error: 'Las llamadas contestadas no pueden superar el total' });
      }
      try {
        db.prepare(
          'UPDATE calidad_nivel_servicio SET campana=?, mes=?, contestadas20s=?, llamadasTotales=?, updatedAt=? WHERE id=?'
        ).run(
          b.campana ?? row.campana,
          b.mes ?? row.mes,
          contestadas20s,
          llamadasTotales,
          nowStr(),
          row.id
        );
      } catch (e) {
        // Ya existe otro registro para esa (campana, mes) -> conflicto amigable,
        // no un 500 generico (UNIQUE(campana, mes) en calidad_nivel_servicio).
        if (e && e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
          return res.status(409).json({ error: 'Ya existe un registro de nivel de servicio para esa campana y mes' });
        }
        throw e;
      }
      const updated = db.prepare('SELECT * FROM calidad_nivel_servicio WHERE id = ?').get(row.id);
      logCalEvent('NIVEL_SERVICIO_EDIT', '-', updated.campana, req.actor, `${updated.mes}`);
      res.json(toNivelServicioRow(updated));
    })
  );

  api.delete(
    '/calidad/nivel-servicio/:id',
    requireActor,
    validate(schemas.idParamSchema, 'params'),
    wrap((req, res) => {
      if (!isFullAdmin(req.actor)) {
        return res.status(403).json({ error: 'Solo el administrador puede eliminar el nivel de servicio' });
      }
      const row = db.prepare('SELECT * FROM calidad_nivel_servicio WHERE id = ?').get(req.params.id);
      if (!row) return res.status(404).json({ error: 'Registro no encontrado' });
      db.prepare('DELETE FROM calidad_nivel_servicio WHERE id = ?').run(row.id);
      logCalEvent('NIVEL_SERVICIO_DEL', '-', row.campana, req.actor, `${row.mes}`);
      res.json({ ok: true });
    })
  );

  // ── CARGA DIARIA (Fase 1 del pedido de carga real) ──────────
  // Recibe filas ya parseadas en el navegador desde el export del conmutador
  // (mismo patron que /dashboard/cargas: el servidor nunca parsea Excel). Por
  // cada fila upsertea calidad_nivel_servicio_diario por (campana, fecha,
  // skillName), y recalcula el agregado mensual de calidad_nivel_servicio a
  // partir de TODAS las filas diarias de ese mes (no solo las de este
  // archivo), asi que una vez que un mes tiene carga diaria, esta reemplaza
  // cualquier dato manual que hubiera para ese mes.
  api.post(
    '/calidad/nivel-servicio/carga-diaria',
    requireActor,
    validate(schemas.nivelServicioCargaDiariaBody),
    wrap((req, res) => {
      if (!isFullAdmin(req.actor)) {
        return res.status(403).json({ error: 'Solo el administrador puede cargar el nivel de servicio' });
      }
      const b = req.body;
      const resultado = cargarNivelServicioDiario(db, {
        campana: b.campana,
        archivoNombre: b.archivoNombre || '',
        cargadoPorNombre: req.actor.nombre || '-',
        filas: b.filas,
        now: nowStr(),
      });
      const mensual = resultado.mensual.map(toNivelServicioRow);

      logCalEvent(
        'NIVEL_SERVICIO_CARGA_DIARIA',
        '-',
        b.campana,
        req.actor,
        `${b.filas.length} fila(s) — ${resultado.mensual.length} mes(es) recalculado(s)`
      );
      res.status(201).json({ diario: { insertadas: resultado.diario.insertadas }, mensual });
    })
  );

  // ══════════════════════════════════════════════════════════
  // TRAFICO DE LLAMADAS — export real de Volvox (hoja DATA)
  // ══════════════════════════════════════════════════════════
  function toTraficoDiarioRow(row) {
    return {
      fecha: row.fecha,
      skillName: row.skillName,
      campana: row.campana,
      totalLlamadas: row.totalLlamadas,
      contestadas: row.contestadas,
      llamadasAbandonadas: row.llamadasAbandonadas,
      serviceLevel10secPct: row.serviceLevel10secPct,
      serviceLevel20secPct: row.serviceLevel20secPct,
      serviceLevel30secPct: row.serviceLevel30secPct,
      abandonPct: row.abandonPct,
      nivelAtencionPct: row.nivelAtencionPct,
      tasaAbandonoPct: row.tasaAbandonoPct,
      asaSegundos: row.asaSegundos,
      ataSegundos: row.ataSegundos,
      ahtSegundos: row.ahtSegundos,
      waitTimeSegundos: row.waitTimeSegundos,
    };
  }

  // Filas diarias crudas para la grafica de Trafico (el filtrado/agregado
  // por skill, rango de fechas y granularidad lo hace el navegador —
  // public/js/trafico-logic.js — asi que aqui se devuelve todo lo que haya
  // para la campana, sin recortar).
  api.get(
    '/calidad/nivel-servicio/diario',
    requireActor,
    wrap((req, res) => {
      const campana = req.query.campana;
      if (!campana) return res.status(400).json({ error: 'Indica una campana' });
      if (!campaignAccess(req.actor, campana)) {
        return res.status(403).json({ error: 'Sin acceso a los datos de esta campana' });
      }
      const rows = db
        .prepare('SELECT * FROM calidad_nivel_servicio_diario WHERE campana = ? ORDER BY fecha, skillName')
        .all(campana);
      res.json(rows.map(toTraficoDiarioRow));
    })
  );

  // Sube el export de Volvox ya parseado en el navegador (mismo patron que
  // /dashboard/cargas y la carga diaria de arriba: el servidor NUNCA abre el
  // Excel). A diferencia de esa carga clasica, aqui NO se manda `campana`:
  // un mismo archivo trae varias skills que pueden ser de campanas
  // distintas, y cada una se resuelve por su mapeo (trafico-skills.js). Una
  // skill nueva se guarda igual, bajo "(SIN ASIGNAR)", sin romper la carga.
  api.post(
    '/calidad/trafico/carga',
    requireActor,
    validate(schemas.traficoCargaBody),
    wrap((req, res) => {
      if (!isFullAdmin(req.actor)) {
        return res.status(403).json({ error: 'Solo el administrador puede cargar el trafico de llamadas' });
      }
      const b = req.body;
      const resultado = traficoSkills.cargarTrafico(db, {
        archivoNombre: b.archivoNombre || '',
        cargadoPorNombre: req.actor.nombre || '-',
        filas: b.filas,
      });
      logEvent(
        'TRAFICO_CARGA',
        { nombre: `${resultado.insertadas} fila(s)`, user: '-', rol: resultado.campanas.join(', ') },
        actorLabel(req.actor),
        resultado.skillsSinAsignar.length
          ? `${resultado.skillsSinAsignar.length} skill(s) sin asignar: ${resultado.skillsSinAsignar.join(', ')}`
          : ''
      );
      res.status(201).json(resultado);
    })
  );

  // Mapeo SKILL_NAME -> campana/cliente, administrable desde el panel.
  api.get(
    '/calidad/trafico/skills',
    requireActor,
    wrap((req, res) => {
      if (!isFullAdmin(req.actor)) {
        return res.status(403).json({ error: 'Solo el administrador puede ver el mapeo de skills' });
      }
      res.json(traficoSkills.listarSkills(db));
    })
  );

  api.put(
    '/calidad/trafico/skills/:skillName',
    requireActor,
    validate(schemas.traficoSkillMapeoBody),
    wrap((req, res) => {
      if (!isFullAdmin(req.actor)) {
        return res.status(403).json({ error: 'Solo el administrador puede editar el mapeo de skills' });
      }
      const skillName = req.params.skillName;
      const resultado = traficoSkills.remapearSkill(db, { skillName, campana: req.body.campana });
      logEvent(
        'TRAFICO_SKILL_MAPEO',
        { nombre: skillName, user: '-', rol: req.body.campana || '(sin asignar)' },
        actorLabel(req.actor),
        `${resultado.movidas} fila(s) reatribuidas, ${resultado.mesesRecalculados.length} mes(es) recalculado(s)`
      );
      res.json({ ok: true, ...resultado });
    })
  );

  // ══════════════════════════════════════════════════════════
  // DASHBOARDS DE CLIENTE — datos operativos cargados por Excel
  // ══════════════════════════════════════════════════════════
  api.use(['/dashboard', '/dashboards'], (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  function clienteAccess(actor, cliente) {
    if (isFullAdmin(actor)) return true;
    if (canLoadData(actor)) return true;
    if (!actor || !actor.perms) return false;
    return (
      actor.perms['cliente_' + cliente] === true || actor.perms['campana_' + cliente] === true
    );
  }

  function toCarga(row) {
    return {
      id: row.id,
      cliente: row.cliente,
      seccion: row.seccion,
      cadencia: row.cadencia,
      periodo: row.periodo,
      filas: JSON.parse(row.filas || '[]'),
      archivoNombre: row.archivoNombre || '',
      cargadoPorNombre: row.cargadoPorNombre || '',
      cargadoEn: row.cargadoEn,
    };
  }

  // ── Configuracion de dashboards (Fase 3): la fuente de verdad de que
  // secciones y paneles tiene cada dashboard de cliente.
  function getConfigRow(cliente) {
    return db.prepare('SELECT * FROM dashboards_config WHERE cliente = ? AND activo = 1').get(cliente);
  }
  function toConfig(row) {
    return {
      cliente: row.cliente,
      titulo: row.titulo,
      vista: row.vista ? JSON.parse(row.vista) : null,
      secciones: JSON.parse(row.secciones || '{}'),
      layout: JSON.parse(row.layout || '{}'),
      updatedAt: row.updatedAt,
    };
  }
  function seccionSpec(cliente, seccionKey) {
    const row = getConfigRow(cliente);
    if (!row) return null;
    const secs = JSON.parse(row.secciones || '{}');
    return secs[seccionKey] || null;
  }

  // Clientes que tienen dashboard configurado.
  api.get(
    '/dashboard/clientes',
    requireActor,
    wrap((req, res) => {
      const rows = db.prepare('SELECT cliente FROM dashboards_config WHERE activo = 1 ORDER BY cliente').all();
      res.json({ clientes: rows.map((r) => r.cliente) });
    })
  );

  // Definicion de las secciones de un cliente (para armar plantillas y el formulario de carga).
  api.get(
    '/dashboard/secciones/:cliente',
    requireActor,
    wrap((req, res) => {
      const row = getConfigRow(req.params.cliente);
      if (!row) return res.status(404).json({ error: 'Ese cliente no tiene dashboard configurado' });
      res.json({ cliente: req.params.cliente, secciones: JSON.parse(row.secciones || '{}') });
    })
  );

  // Cargas existentes (para la pantalla de carga). Solo quien puede cargar.
  api.get(
    '/dashboard/cargas',
    requireDataLoader,
    wrap((req, res) => {
      const { cliente, seccion } = req.query;
      let rows;
      if (cliente && seccion) {
        rows = db
          .prepare(
            'SELECT * FROM dashboard_cargas WHERE cliente = ? AND seccion = ? ORDER BY periodo DESC'
          )
          .all(cliente, seccion);
      } else if (cliente) {
        rows = db
          .prepare('SELECT * FROM dashboard_cargas WHERE cliente = ? ORDER BY seccion, periodo DESC')
          .all(cliente);
      } else {
        rows = db.prepare('SELECT * FROM dashboard_cargas ORDER BY cliente, seccion, periodo DESC').all();
      }
      res.json(rows.map(toCarga));
    })
  );

  // ── Configuracion de dashboards — CRUD (crear un dashboard = insertar aqui) ──
  api.get(
    '/dashboards/config',
    requireActor,
    wrap((req, res) => {
      if (!isFullAdmin(req.actor)) {
        return res.status(403).json({ error: 'Solo el administrador puede ver la configuracion de dashboards' });
      }
      const rows = db.prepare('SELECT * FROM dashboards_config ORDER BY cliente').all();
      res.json(
        rows.map((r) => {
          const layout = JSON.parse(r.layout || '{}');
          return {
            cliente: r.cliente,
            titulo: r.titulo,
            activo: !!r.activo,
            tabs: (layout.tabs || []).length,
            paneles: (layout.tabs || []).reduce((a, t) => a + (t.panels || []).length, 0),
            updatedAt: r.updatedAt,
          };
        })
      );
    })
  );

  api.get(
    '/dashboards/config/:cliente',
    requireActor,
    wrap((req, res) => {
      if (!isFullAdmin(req.actor)) {
        return res.status(403).json({ error: 'Solo el administrador puede ver la configuracion de dashboards' });
      }
      const row = getConfigRow(req.params.cliente);
      if (!row) return res.status(404).json({ error: 'Ese cliente no tiene dashboard configurado' });
      res.json(toConfig(row));
    })
  );

  api.post(
    '/dashboards/config',
    requireActor,
    validate(schemas.dashboardConfigBody),
    wrap((req, res) => {
      if (!isFullAdmin(req.actor)) {
        return res.status(403).json({ error: 'Solo el administrador puede crear dashboards' });
      }
      const b = req.body;
      if (db.prepare('SELECT id FROM dashboards_config WHERE cliente = ?').get(b.cliente)) {
        return res.status(409).json({ error: 'Ya existe un dashboard para ese cliente' });
      }
      const now = new Date().toISOString();
      db.prepare(
        `INSERT INTO dashboards_config (cliente, titulo, vista, secciones, layout, activo, createdAt, updatedAt)
         VALUES (@cliente,@titulo,@vista,@secciones,@layout,1,@now,@now)`
      ).run({
        cliente: b.cliente,
        titulo: b.titulo,
        vista: b.vista ? JSON.stringify(b.vista) : null,
        secciones: JSON.stringify(b.secciones),
        layout: JSON.stringify(b.layout),
        now,
      });
      logEvent('DASHBOARD_CONFIG', { nombre: b.cliente, user: '-', rol: 'dashboard' }, actorLabel(req.actor), b.titulo);
      res.status(201).json(toConfig(getConfigRow(b.cliente)));
    })
  );

  api.put(
    '/dashboards/config/:cliente',
    requireActor,
    validate(schemas.dashboardConfigBody),
    wrap((req, res) => {
      if (!isFullAdmin(req.actor)) {
        return res.status(403).json({ error: 'Solo el administrador puede editar dashboards' });
      }
      const row = db.prepare('SELECT * FROM dashboards_config WHERE cliente = ?').get(req.params.cliente);
      if (!row) return res.status(404).json({ error: 'Dashboard no encontrado' });
      const b = req.body;
      db.prepare(
        `UPDATE dashboards_config SET titulo=?, vista=?, secciones=?, layout=?, updatedAt=? WHERE cliente=?`
      ).run(
        b.titulo,
        b.vista ? JSON.stringify(b.vista) : null,
        JSON.stringify(b.secciones),
        JSON.stringify(b.layout),
        new Date().toISOString(),
        req.params.cliente
      );
      logEvent('DASHBOARD_CONFIG_EDIT', { nombre: req.params.cliente, user: '-', rol: 'dashboard' }, actorLabel(req.actor), b.titulo);
      res.json(toConfig(getConfigRow(req.params.cliente)));
    })
  );

  api.delete(
    '/dashboards/config/:cliente',
    requireActor,
    wrap((req, res) => {
      if (!isFullAdmin(req.actor)) {
        return res.status(403).json({ error: 'Solo el administrador puede eliminar dashboards' });
      }
      const row = db.prepare('SELECT * FROM dashboards_config WHERE cliente = ?').get(req.params.cliente);
      if (!row) return res.status(404).json({ error: 'Dashboard no encontrado' });
      db.prepare('DELETE FROM dashboards_config WHERE cliente = ?').run(req.params.cliente);
      db.prepare('DELETE FROM dashboard_cargas WHERE cliente = ?').run(req.params.cliente);
      logEvent('DASHBOARD_CONFIG_DEL', { nombre: req.params.cliente, user: '-', rol: 'dashboard' }, actorLabel(req.actor), '');
      res.json({ ok: true });
    })
  );

  // Todos los datos operativos de un cliente, agrupados por seccion (los lee el dashboard).
  api.get(
    '/dashboard/:cliente',
    requireActor,
    wrap((req, res) => {
      const cliente = req.params.cliente;

      // M4 (Fase A4): Inventario y Gerencia usan el mismo renderer generico, pero
      // sus datos salen de sus tablas propias (no de dashboard_cargas).
      const adapter = ADAPTERS[cliente];
      if (adapter) {
        if (!isFullAdmin(req.actor) && !can(req.actor, adapter.permiso)) {
          return res.status(403).json({ error: `Sin acceso al modulo de ${adapter.permiso}` });
        }
        return res.json({ cliente, config: adapter.config, secciones: adapter.build(db) });
      }

      if (!getConfigRow(cliente)) {
        return res.status(404).json({ error: 'Ese cliente no tiene dashboard configurado' });
      }
      if (!clienteAccess(req.actor, cliente)) {
        return res.status(403).json({ error: 'Sin acceso a este dashboard' });
      }
      const rows = db
        .prepare('SELECT * FROM dashboard_cargas WHERE cliente = ? ORDER BY periodo')
        .all(cliente);
      const porSeccion = {};
      rows.map(toCarga).forEach((c) => {
        (porSeccion[c.seccion] = porSeccion[c.seccion] || []).push(c);
      });
      res.json({ cliente, config: toConfig(getConfigRow(cliente)), secciones: porSeccion });
    })
  );

  api.post(
    '/dashboard/cargas',
    requireDataLoader,
    validate(schemas.cargaBody),
    wrap((req, res) => {
      const b = req.body;
      const spec = seccionSpec(b.cliente, b.seccion);
      if (!spec) return res.status(400).json({ error: 'Cliente o seccion desconocidos' });
      if (!secciones.periodoValido(spec.periodo, b.periodo)) {
        return res.status(400).json({
          error:
            spec.periodo === 'mes'
              ? 'El periodo debe tener formato AAAA-MM'
              : spec.periodo === 'dia'
                ? 'El periodo debe tener formato AAAA-MM-DD'
                : 'Formato de periodo invalido',
        });
      }
      const norm = secciones.normalizarFilas(spec, b.filas);
      if (!norm.ok) {
        return res.status(400).json({ error: norm.errores[0], detalles: norm.errores });
      }
      const now = nowStr();
      const existing = db
        .prepare('SELECT * FROM dashboard_cargas WHERE cliente = ? AND seccion = ? AND periodo = ?')
        .get(b.cliente, b.seccion, b.periodo);
      // Ya hay una carga para este cliente/seccion/periodo y no se pidio
      // reemplazar -> avisar, no sobrescribir en silencio (feedback Edwin 3.1).
      if (existing && !b.reemplazar) {
        return res.status(409).json({
          error: `Ya existe una carga para ${b.cliente} / ${b.seccion} / ${b.periodo}.`,
          yaExiste: true,
          cliente: b.cliente,
          seccion: b.seccion,
          periodo: b.periodo,
          cargadoPorNombre: existing.cargadoPorNombre,
          cargadoEn: existing.cargadoEn,
          filasActuales: (() => { try { return JSON.parse(existing.filas || '[]').length; } catch (_) { return null; } })(),
        });
      }
      const payload = {
        cliente: b.cliente,
        seccion: b.seccion,
        cadencia: b.cadencia,
        periodo: b.periodo,
        filas: JSON.stringify(norm.filas),
        archivoNombre: b.archivoNombre || null,
        cargadoPor: req.actor.isMasterAdmin ? null : req.actor.id,
        cargadoPorNombre: req.actor.nombre,
        cargadoEn: now,
      };
      let id;
      if (existing) {
        db.prepare(
          `UPDATE dashboard_cargas SET cadencia=@cadencia, filas=@filas, archivoNombre=@archivoNombre,
             cargadoPor=@cargadoPor, cargadoPorNombre=@cargadoPorNombre, cargadoEn=@cargadoEn
           WHERE id=@id`
        ).run({ ...payload, id: existing.id });
        id = existing.id;
      } else {
        const info = db
          .prepare(
            `INSERT INTO dashboard_cargas
               (cliente, seccion, cadencia, periodo, filas, archivoNombre, cargadoPor, cargadoPorNombre, cargadoEn)
             VALUES (@cliente,@seccion,@cadencia,@periodo,@filas,@archivoNombre,@cargadoPor,@cargadoPorNombre,@cargadoEn)`
          )
          .run(payload);
        id = info.lastInsertRowid;
      }
      const row = db.prepare('SELECT * FROM dashboard_cargas WHERE id = ?').get(id);
      logEvent(
        existing ? 'DASHBOARD_CARGA_EDIT' : 'DASHBOARD_CARGA',
        { nombre: b.cliente, user: '-', rol: b.seccion },
        actorLabel(req.actor),
        `${b.periodo} — ${norm.filas.length} fila(s)`
      );
      res.status(existing ? 200 : 201).json(toCarga(row));
    })
  );

  api.delete(
    '/dashboard/cargas/:id',
    requireDataLoader,
    validate(schemas.idParamSchema, 'params'),
    wrap((req, res) => {
      const row = db.prepare('SELECT * FROM dashboard_cargas WHERE id = ?').get(req.params.id);
      if (!row) return res.status(404).json({ error: 'Carga no encontrada' });
      db.prepare('DELETE FROM dashboard_cargas WHERE id = ?').run(row.id);
      logEvent(
        'DASHBOARD_CARGA_DEL',
        { nombre: row.cliente, user: '-', rol: row.seccion },
        actorLabel(req.actor),
        row.periodo
      );
      res.json({ ok: true });
    })
  );

  // ══════════════════════════════════════════════════════════
  // INVENTARIO — Items de stock y movimientos
  // ══════════════════════════════════════════════════════════
  api.use('/inventario', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

  function toInvItem(row) {
    return {
      id: row.id, nombre: row.nombre, categoria: row.categoria,
      descripcion: row.descripcion || '', cantidad: row.cantidad, unidad: row.unidad,
      ubicacion: row.ubicacion || '', estado: row.estado, proveedor: row.proveedor || '',
      costoUnitario: row.costoUnitario || 0, observaciones: row.observaciones || '',
      createdAt: row.createdAt, updatedAt: row.updatedAt,
    };
  }
  function toInvMovimiento(row) {
    return {
      id: row.id, itemId: row.itemId, tipo: row.tipo, cantidad: row.cantidad,
      fecha: row.fecha, motivo: row.motivo || '', destino: row.destino || '',
      registradoPorNombre: row.registradoPorNombre || '', createdAt: row.createdAt,
    };
  }

  // Listar items (con filtros opcionales por categoria y estado)
  api.get(
    '/inventario/items',
    requireActor,
    wrap((req, res) => {
      if (!can(req.actor, 'Inventario')) return res.status(403).json({ error: 'Sin acceso al modulo de Inventario' });
      const { categoria, estado } = req.query;
      let rows;
      if (categoria && estado) {
        rows = db.prepare('SELECT * FROM inventario_items WHERE categoria = ? AND estado = ? ORDER BY nombre').all(categoria, estado);
      } else if (categoria) {
        rows = db.prepare('SELECT * FROM inventario_items WHERE categoria = ? ORDER BY nombre').all(categoria);
      } else if (estado) {
        rows = db.prepare('SELECT * FROM inventario_items WHERE estado = ? ORDER BY nombre').all(estado);
      } else {
        rows = db.prepare('SELECT * FROM inventario_items ORDER BY categoria, nombre').all();
      }
      res.json(rows.map(toInvItem));
    })
  );

  // Resumen del inventario
  api.get(
    '/inventario/resumen',
    requireActor,
    wrap((req, res) => {
      if (!can(req.actor, 'Inventario')) return res.status(403).json({ error: 'Sin acceso al modulo de Inventario' });
      const total = db.prepare('SELECT COUNT(*) AS c FROM inventario_items').get().c;
      const totalUnidades = db.prepare('SELECT COALESCE(SUM(cantidad), 0) AS s FROM inventario_items').get().s;
      const valorTotal = db.prepare('SELECT COALESCE(SUM(cantidad * costoUnitario), 0) AS s FROM inventario_items').get().s;
      const porEstado = db.prepare('SELECT estado, COUNT(*) AS c FROM inventario_items GROUP BY estado').all();
      const porCategoria = db.prepare('SELECT categoria, COUNT(*) AS c, COALESCE(SUM(cantidad),0) AS unidades FROM inventario_items GROUP BY categoria ORDER BY categoria').all();
      const movimientosRecientes = db.prepare('SELECT * FROM inventario_movimientos ORDER BY id DESC LIMIT 10').all().map(toInvMovimiento);
      res.json({
        total, totalUnidades, valorTotal: Math.round(valorTotal * 100) / 100,
        porEstado, porCategoria, movimientosRecientes,
      });
    })
  );

  // Crear un item
  api.post(
    '/inventario/items',
    requireActor,
    validate(schemas.inventarioItemBody),
    wrap((req, res) => {
      if (!can(req.actor, 'Inventario')) return res.status(403).json({ error: 'Sin acceso al modulo de Inventario' });
      const b = req.body;
      const now = nowStr();
      const info = db.prepare(
        `INSERT INTO inventario_items (nombre, categoria, descripcion, cantidad, unidad, ubicacion, estado, proveedor, costoUnitario, observaciones, createdAt, updatedAt)
         VALUES (@nombre,@categoria,@descripcion,@cantidad,@unidad,@ubicacion,@estado,@proveedor,@costoUnitario,@observaciones,@now,@now)`
      ).run({ ...b, now });
      const row = db.prepare('SELECT * FROM inventario_items WHERE id = ?').get(info.lastInsertRowid);
      logEvent('INV_ITEM', { nombre: b.nombre, user: '-', rol: b.categoria }, actorLabel(req.actor), `Cantidad: ${b.cantidad}`);
      res.status(201).json(toInvItem(row));
    })
  );

  // Actualizar un item
  api.put(
    '/inventario/items/:id',
    requireActor,
    validate(schemas.idParamSchema, 'params'),
    validate(schemas.inventarioItemUpdate),
    wrap((req, res) => {
      if (!can(req.actor, 'Inventario')) return res.status(403).json({ error: 'Sin acceso al modulo de Inventario' });
      const row = db.prepare('SELECT * FROM inventario_items WHERE id = ?').get(req.params.id);
      if (!row) return res.status(404).json({ error: 'Item no encontrado' });
      const b = req.body;
      db.prepare(
        `UPDATE inventario_items SET nombre=?, categoria=?, descripcion=?, cantidad=?, unidad=?, ubicacion=?, estado=?, proveedor=?, costoUnitario=?, observaciones=?, updatedAt=? WHERE id=?`
      ).run(
        b.nombre ?? row.nombre, b.categoria ?? row.categoria, b.descripcion ?? row.descripcion,
        b.cantidad ?? row.cantidad, b.unidad ?? row.unidad, b.ubicacion ?? row.ubicacion,
        b.estado ?? row.estado, b.proveedor ?? row.proveedor, b.costoUnitario ?? row.costoUnitario,
        b.observaciones ?? row.observaciones, nowStr(), row.id
      );
      const updated = db.prepare('SELECT * FROM inventario_items WHERE id = ?').get(row.id);
      logEvent('INV_ITEM_EDIT', { nombre: updated.nombre, user: '-', rol: updated.categoria }, actorLabel(req.actor), '');
      res.json(toInvItem(updated));
    })
  );

  // Eliminar un item
  api.delete(
    '/inventario/items/:id',
    requireActor,
    validate(schemas.idParamSchema, 'params'),
    wrap((req, res) => {
      if (!can(req.actor, 'Inventario')) return res.status(403).json({ error: 'Sin acceso al modulo de Inventario' });
      const row = db.prepare('SELECT * FROM inventario_items WHERE id = ?').get(req.params.id);
      if (!row) return res.status(404).json({ error: 'Item no encontrado' });
      db.prepare('DELETE FROM inventario_items WHERE id = ?').run(row.id);
      logEvent('INV_ITEM_DEL', { nombre: row.nombre, user: '-', rol: row.categoria }, actorLabel(req.actor), '');
      res.json({ ok: true });
    })
  );

  // Movimientos de un item
  api.get(
    '/inventario/movimientos',
    requireActor,
    wrap((req, res) => {
      if (!can(req.actor, 'Inventario')) return res.status(403).json({ error: 'Sin acceso al modulo de Inventario' });
      const { itemId } = req.query;
      let rows;
      if (itemId) {
        rows = db.prepare('SELECT * FROM inventario_movimientos WHERE itemId = ? ORDER BY id DESC').all(itemId);
      } else {
        rows = db.prepare('SELECT * FROM inventario_movimientos ORDER BY id DESC LIMIT 200').all();
      }
      res.json(rows.map(toInvMovimiento));
    })
  );

  // Registrar un movimiento
  api.post(
    '/inventario/movimientos',
    requireActor,
    validate(schemas.inventarioMovimientoBody),
    wrap((req, res) => {
      if (!can(req.actor, 'Inventario')) return res.status(403).json({ error: 'Sin acceso al modulo de Inventario' });
      const b = req.body;
      const item = db.prepare('SELECT * FROM inventario_items WHERE id = ?').get(b.itemId);
      if (!item) return res.status(400).json({ error: 'Item no encontrado' });
      // Actualizar cantidad segun tipo de movimiento
      let nuevaCantidad = item.cantidad;
      if (b.tipo === 'Entrada' || b.tipo === 'Ajuste') {
        nuevaCantidad = b.tipo === 'Ajuste' ? b.cantidad : item.cantidad + b.cantidad;
      } else if (b.tipo === 'Salida') {
        if (item.cantidad < b.cantidad) {
          return res.status(400).json({ error: `Stock insuficiente. Disponible: ${item.cantidad} ${item.unidad}` });
        }
        nuevaCantidad = item.cantidad - b.cantidad;
      } else if (b.tipo === 'Transferencia') {
        if (item.cantidad < b.cantidad) {
          return res.status(400).json({ error: `Stock insuficiente para transferencia. Disponible: ${item.cantidad} ${item.unidad}` });
        }
        nuevaCantidad = item.cantidad - b.cantidad;
      }
      const now = nowStr();
      const tx = db.transaction(() => {
        db.prepare('UPDATE inventario_items SET cantidad = ?, updatedAt = ? WHERE id = ?').run(nuevaCantidad, now, b.itemId);
        const info = db.prepare(
          `INSERT INTO inventario_movimientos (itemId, tipo, cantidad, fecha, motivo, destino, registradoPor, registradoPorNombre, createdAt)
           VALUES (@itemId,@tipo,@cantidad,@fecha,@motivo,@destino,@registradoPor,@registradoPorNombre,@now)`
        ).run({
          itemId: b.itemId, tipo: b.tipo, cantidad: b.cantidad, fecha: b.fecha,
          motivo: b.motivo || '', destino: b.destino || '',
          registradoPor: req.actor.isMasterAdmin ? null : req.actor.id,
          registradoPorNombre: req.actor.nombre, now,
        });
        return info.lastInsertRowid;
      });
      const movId = tx();
      const mov = db.prepare('SELECT * FROM inventario_movimientos WHERE id = ?').get(movId);
      logEvent('INV_MOV', { nombre: item.nombre, user: '-', rol: b.tipo }, actorLabel(req.actor), `${b.tipo}: ${b.cantidad} ${item.unidad}`);
      res.status(201).json(toInvMovimiento(mov));
    })
  );

  // Carga masiva de items desde Excel
  api.post(
    '/inventario/carga-items',
    requireActor,
    validate(schemas.inventarioCargaBody),
    wrap((req, res) => {
      if (!can(req.actor, 'Inventario')) return res.status(403).json({ error: 'Sin acceso al modulo de Inventario' });
      const { items } = req.body;
      const now = nowStr();
      let creados = 0;
      const insert = db.prepare(
        `INSERT INTO inventario_items (nombre, categoria, descripcion, cantidad, unidad, ubicacion, estado, proveedor, costoUnitario, observaciones, createdAt, updatedAt)
         VALUES (@nombre,@categoria,@descripcion,@cantidad,@unidad,@ubicacion,@estado,@proveedor,@costoUnitario,@observaciones,@now,@now)`
      );
      const tx = db.transaction((rows) => {
        for (const item of rows) {
          insert.run({ ...item, now });
          creados++;
        }
      });
      tx(items);
      logEvent('INV_CARGA', { nombre: `${creados} items`, user: '-', rol: 'inventario' }, actorLabel(req.actor), `Carga masiva`);
      res.status(201).json({ ok: true, creados });
    })
  );

  // Carga masiva de movimientos desde Excel
  api.post(
    '/inventario/carga-movimientos',
    requireActor,
    validate(schemas.inventarioMovCargaBody),
    wrap((req, res) => {
      if (!can(req.actor, 'Inventario')) return res.status(403).json({ error: 'Sin acceso al modulo de Inventario' });
      const { movimientos } = req.body;
      const now = nowStr();
      let creados = 0;
      const insert = db.prepare(
        `INSERT INTO inventario_movimientos (itemId, tipo, cantidad, fecha, motivo, destino, registradoPor, registradoPorNombre, createdAt)
         VALUES (@itemId,@tipo,@cantidad,@fecha,@motivo,@destino,@registradoPor,@registradoPorNombre,@now)`
      );
      const tx = db.transaction((rows) => {
        for (const m of rows) {
          const item = db.prepare('SELECT * FROM inventario_items WHERE id = ?').get(m.itemId);
          if (!item) continue;
          // Actualizar stock
          let nuevaCantidad = item.cantidad;
          if (m.tipo === 'Entrada' || m.tipo === 'Ajuste') {
            nuevaCantidad = m.tipo === 'Ajuste' ? m.cantidad : item.cantidad + m.cantidad;
          } else if (m.tipo === 'Salida' || m.tipo === 'Transferencia') {
            nuevaCantidad = Math.max(0, item.cantidad - m.cantidad);
          }
          db.prepare('UPDATE inventario_items SET cantidad = ?, updatedAt = ? WHERE id = ?').run(nuevaCantidad, now, m.itemId);
          insert.run({
            itemId: m.itemId, tipo: m.tipo, cantidad: m.cantidad, fecha: m.fecha,
            motivo: m.motivo || '', destino: m.destino || '',
            registradoPor: req.actor.isMasterAdmin ? null : req.actor.id,
            registradoPorNombre: req.actor.nombre, now,
          });
          creados++;
        }
      });
      tx(movimientos);
      logEvent('INV_CARGA_MOV', { nombre: `${creados} movimientos`, user: '-', rol: 'inventario' }, actorLabel(req.actor), `Carga masiva`);
      res.status(201).json({ ok: true, creados });
    })
  );

  // ══════════════════════════════════════════════════════════
  // GERENCIA — Indicadores ejecutivos mensuales
  // ══════════════════════════════════════════════════════════
  api.use('/gerencia', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

  function toGerenciaKpi(row) {
    return {
      id: row.id, periodo: row.periodo, nombre: row.nombre, categoria: row.categoria,
      valor: row.valor, unidad: row.unidad || '', meta: row.meta,
      observaciones: row.observaciones || '', createdAt: row.createdAt, updatedAt: row.updatedAt,
    };
  }

  // KPIs de un periodo
  api.get(
    '/gerencia/kpis',
    requireActor,
    wrap((req, res) => {
      if (!can(req.actor, 'Gerencia')) return res.status(403).json({ error: 'Sin acceso al modulo de Gerencia' });
      const { periodo, categoria } = req.query;
      let rows;
      if (periodo && categoria) {
        rows = db.prepare('SELECT * FROM gerencia_kpis WHERE periodo = ? AND categoria = ? ORDER BY categoria, nombre').all(periodo, categoria);
      } else if (periodo) {
        rows = db.prepare('SELECT * FROM gerencia_kpis WHERE periodo = ? ORDER BY categoria, nombre').all(periodo);
      } else if (categoria) {
        rows = db.prepare('SELECT * FROM gerencia_kpis WHERE categoria = ? ORDER BY periodo DESC, nombre').all(categoria);
      } else {
        rows = db.prepare('SELECT * FROM gerencia_kpis ORDER BY periodo DESC, categoria, nombre').all();
      }
      res.json(rows.map(toGerenciaKpi));
    })
  );

  // Periodos disponibles
  api.get(
    '/gerencia/periodos',
    requireActor,
    wrap((req, res) => {
      if (!can(req.actor, 'Gerencia')) return res.status(403).json({ error: 'Sin acceso al modulo de Gerencia' });
      const rows = db.prepare('SELECT DISTINCT periodo FROM gerencia_kpis ORDER BY periodo DESC').all();
      res.json(rows.map((r) => r.periodo));
    })
  );

  // Resumen ejecutivo de un periodo
  api.get(
    '/gerencia/resumen',
    requireActor,
    wrap((req, res) => {
      if (!can(req.actor, 'Gerencia')) return res.status(403).json({ error: 'Sin acceso al modulo de Gerencia' });
      const periodo = req.query.periodo || new Date().toISOString().slice(0, 7);
      const kpis = db.prepare('SELECT * FROM gerencia_kpis WHERE periodo = ? ORDER BY categoria, nombre').all(periodo);
      const porCategoria = {};
      kpis.forEach((k) => {
        if (!porCategoria[k.categoria]) porCategoria[k.categoria] = [];
        porCategoria[k.categoria].push(toGerenciaKpi(k));
      });
      const periodos = db.prepare('SELECT DISTINCT periodo FROM gerencia_kpis ORDER BY periodo DESC').all().map((r) => r.periodo);
      res.json({ periodo, kpis: kpis.map(toGerenciaKpi), porCategoria, periodos });
    })
  );

  // Crear / actualizar un KPI individual.
  // Gerencia es SOLO LECTURA (feedback de Edwin 2.2): la escritura de KPIs
  // ejecutivos exige el permiso de carga de datos (cargarDatos / admin), igual
  // que el resto de datos que alimentan los dashboards.
  api.post(
    '/gerencia/kpis',
    requireActor,
    validate(schemas.gerenciaKpiBody),
    wrap((req, res) => {
      if (!canLoadData(req.actor)) return res.status(403).json({ error: 'Gerencia es de solo lectura; cargar KPIs exige el permiso Cargar Datos' });
      const b = req.body;
      const now = nowStr();
      const existing = db.prepare('SELECT id FROM gerencia_kpis WHERE periodo = ? AND nombre = ?').get(b.periodo, b.nombre);
      if (existing) {
        db.prepare(
          `UPDATE gerencia_kpis SET categoria=?, valor=?, unidad=?, meta=?, observaciones=?, updatedAt=? WHERE id=?`
        ).run(b.categoria, b.valor, b.unidad, b.meta, b.observaciones, now, existing.id);
        const row = db.prepare('SELECT * FROM gerencia_kpis WHERE id = ?').get(existing.id);
        logEvent('GER_KPI_EDIT', { nombre: b.nombre, user: '-', rol: b.periodo }, actorLabel(req.actor), `Valor: ${b.valor}`);
        return res.json(toGerenciaKpi(row));
      }
      const info = db.prepare(
        `INSERT INTO gerencia_kpis (periodo, nombre, categoria, valor, unidad, meta, observaciones, createdAt, updatedAt)
         VALUES (@periodo,@nombre,@categoria,@valor,@unidad,@meta,@observaciones,@now,@now)`
      ).run({ ...b, now });
      const row = db.prepare('SELECT * FROM gerencia_kpis WHERE id = ?').get(info.lastInsertRowid);
      logEvent('GER_KPI', { nombre: b.nombre, user: '-', rol: b.periodo }, actorLabel(req.actor), `Valor: ${b.valor}`);
      res.status(201).json(toGerenciaKpi(row));
    })
  );

  // Actualizar un KPI
  api.put(
    '/gerencia/kpis/:id',
    requireActor,
    validate(schemas.idParamSchema, 'params'),
    validate(schemas.gerenciaKpiUpdate),
    wrap((req, res) => {
      if (!canLoadData(req.actor)) return res.status(403).json({ error: 'Gerencia es de solo lectura; editar KPIs exige el permiso Cargar Datos' });
      const row = db.prepare('SELECT * FROM gerencia_kpis WHERE id = ?').get(req.params.id);
      if (!row) return res.status(404).json({ error: 'KPI no encontrado' });
      const b = req.body;
      db.prepare(
        `UPDATE gerencia_kpis SET periodo=?, nombre=?, categoria=?, valor=?, unidad=?, meta=?, observaciones=?, updatedAt=? WHERE id=?`
      ).run(
        b.periodo ?? row.periodo, b.nombre ?? row.nombre, b.categoria ?? row.categoria,
        b.valor ?? row.valor, b.unidad ?? row.unidad, b.meta ?? row.meta,
        b.observaciones ?? row.observaciones, nowStr(), row.id
      );
      const updated = db.prepare('SELECT * FROM gerencia_kpis WHERE id = ?').get(row.id);
      logEvent('GER_KPI_EDIT', { nombre: updated.nombre, user: '-', rol: updated.periodo }, actorLabel(req.actor), '');
      res.json(toGerenciaKpi(updated));
    })
  );

  // Eliminar un KPI
  api.delete(
    '/gerencia/kpis/:id',
    requireActor,
    validate(schemas.idParamSchema, 'params'),
    wrap((req, res) => {
      if (!canLoadData(req.actor)) return res.status(403).json({ error: 'Gerencia es de solo lectura; borrar KPIs exige el permiso Cargar Datos' });
      const row = db.prepare('SELECT * FROM gerencia_kpis WHERE id = ?').get(req.params.id);
      if (!row) return res.status(404).json({ error: 'KPI no encontrado' });
      db.prepare('DELETE FROM gerencia_kpis WHERE id = ?').run(row.id);
      logEvent('GER_KPI_DEL', { nombre: row.nombre, user: '-', rol: row.periodo }, actorLabel(req.actor), '');
      res.json({ ok: true });
    })
  );

  // Carga masiva de KPIs desde Excel
  api.post(
    '/gerencia/carga',
    requireActor,
    validate(schemas.gerenciaCargaBody),
    wrap((req, res) => {
      if (!canLoadData(req.actor)) return res.status(403).json({ error: 'Gerencia es de solo lectura; la carga de KPIs exige el permiso Cargar Datos' });
      const { periodo, kpis } = req.body;
      const now = nowStr();
      let upserted = 0;
      const insert = db.prepare(
        `INSERT INTO gerencia_kpis (periodo, nombre, categoria, valor, unidad, meta, observaciones, createdAt, updatedAt)
         VALUES (@periodo,@nombre,@categoria,@valor,@unidad,@meta,@observaciones,@now,@now)`
      );
      const tx = db.transaction((rows) => {
        for (const kpi of rows) {
          const existing = db.prepare('SELECT id FROM gerencia_kpis WHERE periodo = ? AND nombre = ?').get(periodo, kpi.nombre);
          if (existing) {
            db.prepare('UPDATE gerencia_kpis SET categoria=?, valor=?, unidad=?, meta=?, observaciones=?, updatedAt=? WHERE id=?')
              .run(kpi.categoria, kpi.valor, kpi.unidad || '', kpi.meta, kpi.observaciones || '', now, existing.id);
          } else {
            insert.run({ periodo, nombre: kpi.nombre, categoria: kpi.categoria, valor: kpi.valor, unidad: kpi.unidad || '', meta: kpi.meta, observaciones: kpi.observaciones || '', now });
          }
          upserted++;
        }
      });
      tx(kpis);
      logEvent('GER_CARGA', { nombre: `${upserted} KPIs`, user: '-', rol: periodo }, actorLabel(req.actor), `Carga masiva`);
      res.status(201).json({ ok: true, upserted });
    })
  );

  // ══════════════════════════════════════════════════════════
  // GESTION HUMANA (Fase 10) — registro de personal por campana
  // ══════════════════════════════════════════════════════════
  api.use('/gh', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

  function toGhPersonal(row) {
    return {
      id: row.id, nombre: row.nombre, documento: row.documento || '', cargo: row.cargo || '',
      campana: row.campana, supervisor: row.supervisor || '',
      fecha_ingreso: row.fecha_ingreso, fecha_salida: row.fecha_salida || null,
      motivo_salida: row.motivo_salida || '',
      costo_hora: row.costo_hora || 0, horas_mes: row.horas_mes || 0,
      salario: row.salario === null || row.salario === undefined ? null : row.salario,
      observaciones: row.observaciones || '',
      activo: !(row.fecha_salida && String(row.fecha_salida).trim()),
      costo_mes: Math.round((row.costo_hora || 0) * (row.horas_mes || 0) * 100) / 100,
      createdAt: row.createdAt, updatedAt: row.updatedAt,
    };
  }

  api.get(
    '/gh/personal',
    requireActor,
    wrap((req, res) => {
      if (!can(req.actor, 'GestionHumana')) return res.status(403).json({ error: 'Sin acceso al modulo de Gestion Humana' });
      const { campana, estado } = req.query;
      let rows = db.prepare('SELECT * FROM gestion_humana_personal ORDER BY campana, nombre').all();
      if (campana) rows = rows.filter((r) => r.campana === campana);
      if (estado === 'activo') rows = rows.filter((r) => !(r.fecha_salida && String(r.fecha_salida).trim()));
      if (estado === 'retirado') rows = rows.filter((r) => r.fecha_salida && String(r.fecha_salida).trim());
      res.json(rows.map(toGhPersonal));
    })
  );

  api.get(
    '/gh/resumen',
    requireActor,
    wrap((req, res) => {
      if (!can(req.actor, 'GestionHumana')) return res.status(403).json({ error: 'Sin acceso al modulo de Gestion Humana' });
      const rows = db.prepare('SELECT * FROM gestion_humana_personal').all();
      const activos = rows.filter((r) => !(r.fecha_salida && String(r.fecha_salida).trim()));
      const costoMes = (p) => (p.costo_hora || 0) * (p.horas_mes || 0);
      const porCampana = {};
      for (const p of activos) {
        const c = (porCampana[p.campana] = porCampana[p.campana] || { campana: p.campana, activos: 0, costo_mes: 0 });
        c.activos += 1; c.costo_mes += costoMes(p);
      }
      res.json({
        total: rows.length,
        activos: activos.length,
        retirados: rows.length - activos.length,
        campanas: Object.keys(porCampana).length,
        costoNominaMes: Math.round(activos.reduce((a, p) => a + costoMes(p), 0) * 100) / 100,
        porCampana: Object.values(porCampana).map((c) => ({ ...c, costo_mes: Math.round(c.costo_mes * 100) / 100 })),
      });
    })
  );

  api.post(
    '/gh/personal',
    requireActor,
    validate(schemas.ghPersonalBody),
    wrap((req, res) => {
      if (!can(req.actor, 'GestionHumana')) return res.status(403).json({ error: 'Sin acceso al modulo de Gestion Humana' });
      const b = req.body;
      const now = nowStr();
      const info = db.prepare(
        `INSERT INTO gestion_humana_personal
           (nombre, documento, cargo, campana, supervisor, fecha_ingreso, fecha_salida, motivo_salida, costo_hora, horas_mes, salario, observaciones, createdAt, updatedAt)
         VALUES (@nombre,@documento,@cargo,@campana,@supervisor,@fecha_ingreso,@fecha_salida,@motivo_salida,@costo_hora,@horas_mes,@salario,@observaciones,@now,@now)`
      ).run({ ...b, fecha_salida: b.fecha_salida || null, now });
      const row = db.prepare('SELECT * FROM gestion_humana_personal WHERE id = ?').get(info.lastInsertRowid);
      logEvent('GH_PERSONAL', { nombre: b.nombre, user: '-', rol: b.campana }, actorLabel(req.actor), b.fecha_salida ? 'Retirado' : 'Ingreso');
      res.status(201).json(toGhPersonal(row));
    })
  );

  api.put(
    '/gh/personal/:id',
    requireActor,
    validate(schemas.idParamSchema, 'params'),
    validate(schemas.ghPersonalUpdate),
    wrap((req, res) => {
      if (!can(req.actor, 'GestionHumana')) return res.status(403).json({ error: 'Sin acceso al modulo de Gestion Humana' });
      const row = db.prepare('SELECT * FROM gestion_humana_personal WHERE id = ?').get(req.params.id);
      if (!row) return res.status(404).json({ error: 'Persona no encontrada' });
      const b = req.body;
      const fechaSalida = b.fecha_salida !== undefined ? (b.fecha_salida || null) : row.fecha_salida;
      db.prepare(
        `UPDATE gestion_humana_personal SET nombre=?, documento=?, cargo=?, campana=?, supervisor=?, fecha_ingreso=?, fecha_salida=?, motivo_salida=?, costo_hora=?, horas_mes=?, salario=?, observaciones=?, updatedAt=? WHERE id=?`
      ).run(
        b.nombre ?? row.nombre, b.documento ?? row.documento, b.cargo ?? row.cargo,
        b.campana ?? row.campana, b.supervisor ?? row.supervisor,
        b.fecha_ingreso ?? row.fecha_ingreso, fechaSalida,
        b.motivo_salida ?? row.motivo_salida,
        b.costo_hora ?? row.costo_hora, b.horas_mes ?? row.horas_mes,
        b.salario !== undefined ? b.salario : row.salario,
        b.observaciones ?? row.observaciones, nowStr(), row.id
      );
      const updated = db.prepare('SELECT * FROM gestion_humana_personal WHERE id = ?').get(row.id);
      logEvent('GH_PERSONAL_EDIT', { nombre: updated.nombre, user: '-', rol: updated.campana }, actorLabel(req.actor), '');
      res.json(toGhPersonal(updated));
    })
  );

  api.delete(
    '/gh/personal/:id',
    requireActor,
    validate(schemas.idParamSchema, 'params'),
    wrap((req, res) => {
      if (!can(req.actor, 'GestionHumana')) return res.status(403).json({ error: 'Sin acceso al modulo de Gestion Humana' });
      const row = db.prepare('SELECT * FROM gestion_humana_personal WHERE id = ?').get(req.params.id);
      if (!row) return res.status(404).json({ error: 'Persona no encontrada' });
      db.prepare('DELETE FROM gestion_humana_personal WHERE id = ?').run(row.id);
      logEvent('GH_PERSONAL_DEL', { nombre: row.nombre, user: '-', rol: row.campana }, actorLabel(req.actor), '');
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
