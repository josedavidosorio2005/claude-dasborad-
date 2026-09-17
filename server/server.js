// server.js — API REST de InConexion Platform.
//
// La app se construye en createApp() para poder montarla en pruebas sin abrir
// un puerto. El arranque real (listen + graceful shutdown) solo ocurre cuando
// este archivo se ejecuta directamente (node server.js).
//
// Las rutas viven en routes/*.js, un router de Express por dominio (auth,
// usuarios, calidad, umbrales, trafico, dashboards, inventario, gerencia,
// gestion-humana, historial) — server.js solo hace el setup de la app
// (seguridad, CORS, rate limiting, estatico) y monta cada router en el mismo
// ORDEN en que las rutas vivian antes en este archivo (Radiografia
// InConexion, #3): el router de Calidad va antes que el de Trafico a
// proposito porque su middleware de no-cache usa el prefijo '/calidad', que
// tambien cubre las rutas /calidad/trafico/* del router de Trafico — igual
// que en el monolito original, donde ese middleware (definido junto a
// Calidad) ya alcanzaba a esas rutas de Trafico, definidas mas abajo en el
// mismo archivo. Ningun otro par de routers comparte prefijo, asi que el
// resto del orden no afecta el comportamiento.
const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const config = require('./config');
const db = require('./db');
const { requireActor } = require('./auth');
const { wrap } = require('./routes/shared');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

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

  // Compresion gzip/brotli a nivel de Express. En produccion Caddy YA
  // comprime (`encode gzip zstd` en deploy/Caddyfile, verificado en vivo con
  // curl -H "Accept-Encoding: gzip" contra produccion) asi que esto es
  // redundante ahi -- pero deja la respuesta comprimida tambien cuando la app
  // corre SIN ese proxy delante (dev local, el smoke test de CI que le pega
  // directo al contenedor en :3000, o si el reverse proxy cambia a futuro).
  app.use(compression());

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
  // Global sobre toda la API para frenar abuso; login mas estricto encima
  // (ese limitador vive junto a la ruta de login, en routes/auth.js).
  const apiLimiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Demasiadas peticiones. Intenta de nuevo mas tarde.' },
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
  //
  // DECISION (Cartera con datos reales, resto en demo): el banner se queda
  // GLOBAL, no por campana. Hacerlo por campana exigiria agregar columnas de
  // alcance a seed_demo_marcas y reescribir esta ruta con un filtro por
  // cliente/campana en cada dashboard — un cambio real de schema, no solo de
  // lectura. Mientras Cartera sea la unica campana con datos reales, el
  // banner sigue mostrandose en TODA la app (incluida Cartera) hasta que se
  // limpien los datos de demo de las 11 campanas restantes con
  // `seed:demo:limpiar` — evita el riesgo de que alguien vea un dashboard
  // sin el aviso y asuma que es real cuando solo Cartera lo es.
  api.get(
    '/seed-demo/estado',
    requireActor,
    wrap((req, res) => {
      res.set('Cache-Control', 'no-store');
      const row = db.prepare('SELECT COUNT(*) AS c FROM seed_demo_marcas').get();
      res.json({ activo: row.c > 0, marcas: row.c });
    })
  );

  // ── Routers por dominio (routes/*.js) ──────────────────────
  // Ver la nota de orden al inicio del archivo: calidad debe montarse antes
  // que trafico.
  api.use(require('./routes/auth'));
  api.use(require('./routes/usuarios'));
  api.use(require('./routes/calidad'));
  api.use(require('./routes/umbrales'));
  api.use(require('./routes/trafico'));
  api.use(require('./routes/dashboards'));
  api.use(require('./routes/inventario'));
  api.use(require('./routes/gerencia'));
  api.use(require('./routes/gestion-humana'));
  api.use(require('./routes/historial'));

  // 404 JSON para rutas de API desconocidas (antes del fallback SPA).
  api.use((req, res) => res.status(404).json({ error: 'Recurso no encontrado' }));

  // ── Frontend estatico + fallback SPA ──────────────────────
  // Cache por tipo de archivo (Radiografia InConexion, #3):
  //   - index.html: SIEMPRE revalida (no-cache). Es el punto de entrada de la
  //     SPA y los JS/CSS que referencia no llevan hash en el nombre, asi que
  //     el navegador tiene que volver a pedirlo en cada visita para no quedar
  //     atascado en una version vieja tras un deploy.
  //   - public/img/*: 7 dias. Son el logo y el icono del navbar (Fase 15),
  //     cambian muy rara vez y de forma planeada -- si algun dia se
  //     reemplazan, renombrar el archivo (no solo sobrescribirlo) invalida el
  //     cache de inmediato en vez de esperar a que expire.
  //   - el resto (css/js): 5 minutos. Sin fingerprint/hash en el nombre no es
  //     seguro cachear mas tiempo (un deploy que cambie un .js quedaria
  //     "atascado" para quien ya lo tenga en cache) pero 5 minutos evita la
  //     ida y vuelta de revalidacion en recargas seguidas dentro de la misma
  //     sesion de trabajo, con una ventana de staleness minima tras un deploy.
  app.use(
    express.static(PUBLIC_DIR, {
      setHeaders(res, filePath) {
        const rel = path.relative(PUBLIC_DIR, filePath).split(path.sep).join('/');
        if (rel === 'index.html') {
          res.set('Cache-Control', 'no-cache');
        } else if (rel.startsWith('img/')) {
          res.set('Cache-Control', 'public, max-age=604800');
        } else {
          res.set('Cache-Control', 'public, max-age=300');
        }
      },
    })
  );
  app.get('/{*splat}', (req, res) => {
    res.set('Cache-Control', 'no-cache');
    res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
  });

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
