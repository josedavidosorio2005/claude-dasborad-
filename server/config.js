// config.js — Configuracion central con validacion "fail-fast".
//
// Al arrancar, TODAS las variables de entorno se leen y validan aqui. Si falta
// algo critico o tiene un formato invalido, el proceso imprime un mensaje claro
// y termina con codigo 1 (no arranca "a medias"). El resto del codigo consume
// el objeto `config` ya validado y congelado, nunca `process.env` directamente.
// quiet: dotenv 17 imprime por defecto una linea promocionando dotenvx en
// cada arranque ("injected env (N) from .env // tip: ..."); no aporta nada
// util a los logs de produccion (CloudWatch) y no existia en dotenv 16.
require('dotenv').config({ quiet: true });

const { z } = require('zod');

const BCRYPT_HASH_RE = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

// Convierte "https://a.com, https://b.com" -> ["https://a.com","https://b.com"]
function parseOrigins(value) {
  if (!value) return [];
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

const isProd = (process.env.NODE_ENV || 'development') === 'production';

// Normaliza el valor de TRUST_PROXY al tipo que espera express:
//   'false' -> false | 'true' -> true | '2' -> 2 | 'loopback, 10.0.0.0/8' -> string
function normalizeTrustProxy(value) {
  const v = (value || '').trim();
  if (v === '' || v.toLowerCase() === 'false') return false;
  if (v.toLowerCase() === 'true') return true;
  if (/^\d+$/.test(v)) return Number(v);
  return v;
}

const schema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),

    PORT: z.coerce
      .number({ invalid_type_error: 'PORT debe ser un numero' })
      .int('PORT debe ser un entero')
      .min(1, 'PORT fuera de rango (1-65535)')
      .max(65535, 'PORT fuera de rango (1-65535)')
      .default(3000),

    JWT_SECRET: z
      .string({ required_error: 'JWT_SECRET es obligatorio' })
      .min(
        32,
        'JWT_SECRET debe tener al menos 32 caracteres. Genera uno con: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"'
      ),

    JWT_EXPIRES_IN: z.string().min(1).default('8h'),

    MASTER_ADMIN_USER: z.string().min(1).default('admin'),

    MASTER_ADMIN_PASSWORD_HASH: z
      .string({ required_error: 'MASTER_ADMIN_PASSWORD_HASH es obligatorio' })
      .regex(
        BCRYPT_HASH_RE,
        'MASTER_ADMIN_PASSWORD_HASH no tiene formato bcrypt valido ($2a$/$2b$...). Genera el hash con: node hash-password.js "tu-contrasena"'
      ),

    // String crudo; se transforma a array de origenes mas abajo.
    CORS_ORIGIN: z.string().optional(),

    DB_PATH: z.string().optional(),

    // Valor que se pasa tal cual a app.set('trust proxy', ...).
    // 'false' | 'true' | numero de saltos de proxy | lista de IPs/subredes.
    TRUST_PROXY: z.string().default(isProd ? '1' : 'false'),

    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(15 * 60 * 1000),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
    LOGIN_RATE_LIMIT_WINDOW_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(15 * 60 * 1000),
    LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),

    BACKUP_DIR: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production') {
      const origins = parseOrigins(env.CORS_ORIGIN);
      if (origins.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['CORS_ORIGIN'],
          message:
            'En produccion CORS_ORIGIN es obligatorio y debe listar tu dominio real, ej: CORS_ORIGIN=https://tuapp.com (nunca vacio ni "*")',
        });
        return;
      }
      for (const o of origins) {
        if (!/^https?:\/\/[^\s*]+$/.test(o) || o.includes('*')) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['CORS_ORIGIN'],
            message: `Origen CORS invalido: "${o}". Debe ser una URL http(s) explicita sin comodines.`,
          });
        }
      }
    }
  });

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const lines = parsed.error.issues.map((i) => {
    const key = i.path.join('.') || '(config)';
    return `  - ${key}: ${i.message}`;
  });
  process.stderr.write(
    '\n[config] No se puede arrancar: configuracion invalida o incompleta.\n' +
      'Revisa tu archivo .env (ver .env.example). Problemas encontrados:\n\n' +
      lines.join('\n') +
      '\n\n'
  );
  process.exit(1);
}

const env = parsed.data;

const config = Object.freeze({
  nodeEnv: env.NODE_ENV,
  isProduction: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
  port: env.PORT,

  jwtSecret: env.JWT_SECRET,
  jwtExpiresIn: env.JWT_EXPIRES_IN,

  masterAdminUser: env.MASTER_ADMIN_USER,
  masterAdminPasswordHash: env.MASTER_ADMIN_PASSWORD_HASH,

  corsOrigins: parseOrigins(env.CORS_ORIGIN),
  trustProxy: normalizeTrustProxy(env.TRUST_PROXY),

  dbPath: env.DB_PATH || null,

  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    max: env.RATE_LIMIT_MAX,
  },
  loginRateLimit: {
    windowMs: env.LOGIN_RATE_LIMIT_WINDOW_MS,
    max: env.LOGIN_RATE_LIMIT_MAX,
  },

  backupDir: env.BACKUP_DIR || null,
});

module.exports = config;
