// routes/auth.js — Login. Extraido de server.js (Radiografia InConexion, #3):
// solo se movio el cableado HTTP, sin tocar ninguna regla de negocio.
const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const config = require('../config');
const db = require('../db');
const { signToken } = require('../auth');
const { validate, schemas } = require('../validation');
const { wrap, toPublicUser, MASTER_ADMIN_USER, MASTER_ADMIN_PASSWORD_HASH } = require('./shared');

const router = express.Router();

// Mismo limitador de login que tenia server.js: solo penaliza intentos
// FALLIDOS (skipSuccessfulRequests), asi una oficina detras de una sola IP
// no se autobloquea al usar la app.
const loginLimiter = rateLimit({
  windowMs: config.loginRateLimit.windowMs,
  max: config.loginRateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Demasiados intentos. Intenta de nuevo en unos minutos.' },
});

router.post(
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

module.exports = router;
