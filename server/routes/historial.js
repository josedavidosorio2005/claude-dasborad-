// routes/historial.js — Historial de auditoria (append-only, nunca se
// borra desde la API). Extraido de server.js (Radiografia InConexion, #3):
// solo se movio el cableado HTTP, sin tocar ninguna regla de negocio.
const express = require('express');
const db = require('../db');
const { requireActor, isFullAdmin } = require('../auth');
const { wrap } = require('./shared');

const router = express.Router();

router.get(
  '/historial',
  requireActor,
  wrap((req, res) => {
    // Mismo criterio que el frontend (session.js: solo admin maestro o rol
    // ADMIN ven la pestana Historial) — antes esta ruta solo exigia un JWT
    // valido (requireAuth), sin ningun chequeo de rol, asi que cualquier
    // autenticado (incluida una cuenta ya suspendida, mientras su token
    // siguiera vigente) podia leer el log de auditoria completo.
    if (!isFullAdmin(req.actor)) {
      return res.status(403).json({ error: 'Sin permiso para ver el historial' });
    }
    const rows = db.prepare('SELECT * FROM historial ORDER BY ts DESC').all();
    res.json(rows);
  })
);

module.exports = router;
