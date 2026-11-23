// routes/orlant-tablero.js — Fase N1: tablero nuevo de ORLANT (solo lectura). Mientras se
// valida, SOLO el administrador completo (isFullAdmin): ni supervisores, ni el cliente.
const express = require('express');
const db = require('../db');
const { requireActor, isFullAdmin } = require('../auth');
const { orlantTableroDatos } = require('../orlant-tablero');
const { wrap } = require('./shared');

const router = express.Router();

router.get('/orlant/tablero', requireActor, wrap((req, res) => {
  if (!isFullAdmin(req.actor)) return res.status(403).json({ error: 'Solo el administrador ve el tablero nuevo de ORLANT' });
  res.set('Cache-Control', 'no-store');
  res.json(orlantTableroDatos(db, req.query || {}));
}));

module.exports = router;
