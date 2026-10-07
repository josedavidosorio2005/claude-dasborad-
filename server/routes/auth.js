// routes/auth.js — Login. Extraido de server.js (Radiografia InConexion, #3):
// solo se movio el cableado HTTP, sin tocar ninguna regla de negocio.
const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const config = require('../config');
const db = require('../db');
const { signToken, requireActor } = require('../auth');
const { validate, schemas } = require('../validation');
const { fechaLimitesAhoraColombiaStr } = require('../fecha-limites');
const {
  wrap,
  logEvent,
  summarizeUserAgent,
  toPublicUser,
  MASTER_ADMIN_USER,
  MASTER_ADMIN_PASSWORD_HASH,
} = require('./shared');

const router = express.Router();

// Fase 72 (hallazgo N1): antes, un login con un `user` que NO existe
// respondia 401 de inmediato (sin bcrypt.compare), mientras que un `user`
// que si existe pero con password incorrecta si hacia el bcrypt.compare
// (mas lento). Eso deja un canal de tiempo: alguien con acceso de red
// preciso podria inferir que usuarios existen midiendo cuanto tarda cada
// intento. Se genera un hash dummy una sola vez al arrancar (nunca se
// compara contra una password real, solo sirve para igualar el tiempo).
const DUMMY_HASH_PARA_TIMING = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 10);

// Fase 130 (Parte 7, hallazgo real: "demasiados intentos" bloqueaba a toda
// una oficina por el error de UNA sola persona, porque la llave era solo
// la IP): ahora la llave es IP + usuario INTENTADO (el que viene en el
// body, nunca uno ya resuelto en BD -- este middleware corre ANTES de
// validate()/el handler, asi que toma el texto crudo tal cual llego).
// Alguien que se equivoca de contrasena en SU cuenta ya no frena a nadie
// mas de su oficina, y un intento contra un usuario que ni existe cuenta
// aparte de un intento contra uno real. Sigue penalizando SOLO fallidos
// (skipSuccessfulRequests) -- un login correcto nunca cuenta.
function claveLoginPorIpYUsuario(req) {
  const usuarioIntentado = typeof req.body?.user === 'string' ? req.body.user.trim().toLowerCase().slice(0, 100) : '';
  // ipKeyGenerator (no req.ip crudo): normaliza IPv6 a su subred, igual que
  // el keyGenerator por defecto de la libreria -- evita el aviso
  // ERR_ERL_KEY_GEN_IPV6 (alguien podria variar su IPv6 dentro de la misma
  // subred para esquivar el limite si se compara el string tal cual).
  return `${ipKeyGenerator(req.ip)}:${usuarioIntentado}`;
}

// Mensaje claro de cuanto falta para reintentar (minutos, en vez del texto
// generico "en unos minutos" de antes) -- `req.rateLimit.resetTime` lo
// calcula express-rate-limit a partir de la ventana configurada.
function manejarLoginBloqueado(req, res, _next, options) {
  const resetTime = req.rateLimit && req.rateLimit.resetTime;
  const minutos = resetTime ? Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 60000)) : null;
  res.status(options.statusCode).json({
    error: minutos
      ? `Demasiados intentos. Intenta de nuevo en ${minutos} minuto${minutos === 1 ? '' : 's'}.`
      : 'Demasiados intentos. Intenta de nuevo en unos minutos.',
  });
}

const loginLimiter = rateLimit({
  windowMs: config.loginRateLimit.windowMs,
  max: config.loginRateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: claveLoginPorIpYUsuario,
  handler: manejarLoginBloqueado,
});

// Fase 113 (tema A): cada intento de login queda en el Historial (exitoso o
// fallido), visible SOLO para el administrador completo (ver
// routes/historial.js). El mensaje de error que recibe quien intenta
// iniciar sesion NUNCA cambia por esto -- sigue siendo el mismo texto
// generico de siempre para los 3 motivos (usuario no existe/contrasena
// incorrecta/suspendido); el motivo real solo se guarda en el registro que
// ve el admin, nunca se expone en la respuesta HTTP ni en el tiempo de
// respuesta (el N1 de la Fase 72 sigue intacto: logEvent es una insercion
// sincrona local, no agrega una espera perceptible).
function registrarLogin(req, accion, targetRow, detalle) {
  logEvent(accion, targetRow, 'Sistema (autenticacion)', detalle, {
    ip: req.ip,
    userAgent: summarizeUserAgent(req.get('user-agent')),
    fecha: fechaLimitesAhoraColombiaStr(),
  });
}

router.post(
  '/auth/login',
  loginLimiter,
  validate(schemas.loginBody),
  wrap(async (req, res) => {
    const { user, password } = req.body;

    // Admin maestro: su hash vive SOLO en variables de entorno.
    if (user === MASTER_ADMIN_USER) {
      const ok = await bcrypt.compare(password, MASTER_ADMIN_PASSWORD_HASH);
      if (!ok) {
        registrarLogin(req, 'LOGIN_FALLIDO', { nombre: '-', user, rol: '-' }, 'Contrasena incorrecta');
        return res.status(401).json({ error: 'Usuario o contrasena incorrectos' });
      }
      registrarLogin(req, 'LOGIN_OK', { nombre: 'Administrador', user: MASTER_ADMIN_USER, rol: 'ADMIN' }, '');
      const token = signToken({ isMasterAdmin: true, rol: 'ADMIN' });
      return res.json({
        token,
        user: { id: null, nombre: 'Administrador', user: MASTER_ADMIN_USER, rol: 'ADMIN', isMasterAdmin: true },
      });
    }

    const row = db.prepare('SELECT * FROM users WHERE user = ?').get(user);
    if (!row) {
      await bcrypt.compare(password, DUMMY_HASH_PARA_TIMING);
      registrarLogin(req, 'LOGIN_FALLIDO', { nombre: '-', user, rol: '-' }, 'Usuario no existe');
      return res.status(401).json({ error: 'Usuario o contrasena incorrectos' });
    }
    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) {
      registrarLogin(req, 'LOGIN_FALLIDO', row, 'Contrasena incorrecta');
      return res.status(401).json({ error: 'Usuario o contrasena incorrectos' });
    }
    if (!row.active) {
      registrarLogin(req, 'LOGIN_FALLIDO', row, 'Usuario suspendido');
      return res.status(403).json({ error: 'Usuario suspendido. Contacte al administrador.' });
    }

    const ahora = fechaLimitesAhoraColombiaStr();
    db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(ahora, row.id);
    registrarLogin(req, 'LOGIN_OK', row, '');

    const token = signToken({ isMasterAdmin: false, userId: row.id, rol: row.rol, tokenVersion: row.token_version });
    res.json({ token, user: toPublicUser({ ...row, last_login_at: ahora }) });
  })
);

// Fase 113 (tema B): limite de intentos propio (nunca comparte contador con
// loginLimiter) para que este endpoint no sirva para adivinar la contrasena
// ACTUAL por fuerza bruta -- requiere ya estar autenticado, asi que el
// riesgo es menor que el login publico, pero igual se acota.
const changePasswordLimiter = rateLimit({
  windowMs: config.loginRateLimit.windowMs,
  max: config.loginRateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Demasiados intentos. Intenta de nuevo en unos minutos.' },
});

// Fase 113 (tema B): "Cambiar mi contrasena", para cualquier usuario sobre
// si mismo (el admin maestro no tiene fila en `users` -- su contrasena vive
// en MASTER_ADMIN_PASSWORD_HASH, env var, y no se puede cambiar en caliente
// desde aqui). Al cambiar, se incrementa token_version: el propio token
// usado en esta peticion queda invalidado, por eso se firma y se devuelve
// uno NUEVO de una vez -- la sesion actual sigue abierta sin pedir login de
// nuevo (decision explicita, ver CLAUDE.md / reporte de la Fase 113), y
// cualquier OTRO token viejo de este usuario (otro dispositivo, una pestana
// vieja) deja de servir en su siguiente peticion.
router.put(
  '/auth/password',
  requireActor,
  changePasswordLimiter,
  validate(schemas.changeOwnPasswordBody),
  wrap(async (req, res) => {
    if (req.actor.isMasterAdmin) {
      return res.status(400).json({
        error: 'El administrador maestro no puede cambiar su contrasena desde aqui (vive en la configuracion del servidor).',
      });
    }
    const { currentPassword, newPassword } = req.body;
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.actor.id);
    if (!row) return res.status(401).json({ error: 'No autenticado' });

    const ok = await bcrypt.compare(currentPassword, row.password_hash);
    if (!ok) return res.status(401).json({ error: 'La contrasena actual no es correcta' });

    if (newPassword.toLowerCase() === row.user.toLowerCase()) {
      return res.status(400).json({ error: 'La nueva contrasena no puede ser igual al nombre de usuario' });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    db.prepare('UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE id = ?').run(hash, row.id);
    const actualizado = db.prepare('SELECT token_version FROM users WHERE id = ?').get(row.id);

    logEvent(
      'PASSWORD_PROPIA',
      row,
      'Sistema (autenticacion)',
      'Contrasena cambiada por el propio usuario',
      { fecha: fechaLimitesAhoraColombiaStr() }
    );

    const token = signToken({
      isMasterAdmin: false,
      userId: row.id,
      rol: row.rol,
      tokenVersion: actualizado.token_version,
    });
    res.json({ ok: true, token });
  })
);

// Fase 113 (tema A): "cierre de sesion, si existe ese flujo" -- antes no
// existia ningun endpoint de logout (JWT sin estado, el frontend solo
// limpiaba variables en memoria). Se agrega este endpoint minimo SOLO para
// poder registrarlo en el Historial; no revoca el token (eso ya lo cubre
// token_version al cambiar la contrasena, ver Fase 113 tema B) -- el token
// sigue siendo valido hasta su expiracion natural, igual que cualquier JWT
// sin estado, pero el cierre de sesion queda anotado para auditoria.
router.post(
  '/auth/logout',
  requireActor,
  wrap((req, res) => {
    const targetRow = req.actor.isMasterAdmin
      ? { nombre: 'Administrador', user: MASTER_ADMIN_USER, rol: 'ADMIN' }
      : req.actor;
    registrarLogin(req, 'LOGOUT', targetRow, '');
    res.json({ ok: true });
  })
);

module.exports = router;
