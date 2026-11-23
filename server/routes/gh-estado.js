// routes/gh-estado.js — Fase GH2: guardado de «Talento humano» (app de Gestión humana de Edwin) en el
// servidor. Administrador completo; rol GESTION_HUMANA solo con GH_ROL_ACTIVO=1. Sin caché. La
// bitácora y los logs nunca llevan el contenido (hay cédulas, salarios y diagnósticos).
'use strict';
const express = require('express');
const db = require('../db');
const { requireActor } = require('../auth');
const G = require('../gh-estado');
const { wrap, actorLabel } = require('./shared');

const router = express.Router();
router.use('/gh', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
function permitido(req, res) {
  if (!G.puede(req.actor)) { res.status(403).json({ error: 'Solo Gestión humana o el administrador' }); return false; }
  return true;
}

// ¿Esta persona entra a Talento humano? (la tarjeta del rol GESTION_HUMANA la pide al pintar el menú)
router.get('/gh/acceso', requireActor, wrap((req, res) => {
  res.json({ puede: G.puede(req.actor) });
}));

router.get('/gh/estado', requireActor, wrap((req, res) => {
  if (!permitido(req, res)) return;
  res.json({ claves: G.leerTodo(db) });
}));

router.put('/gh/estado/:clave', requireActor, wrap((req, res) => {
  if (!permitido(req, res)) return;
  const r = G.guardar(db, String(req.params.clave || ''), req.body, actorLabel(req.actor));
  if (r.status !== 200) return res.status(r.status).json(r.version !== undefined ? { error: r.error, version: r.version } : { error: r.error });
  res.json({ version: r.version });
}));

// Quién guardó y cuándo (sin contenido). Solo el administrador.
router.get('/gh/bitacora', requireActor, wrap((req, res) => {
  if (!require('../auth').isFullAdmin(req.actor)) return res.status(403).json({ error: 'Solo el administrador' });
  res.json(G.bitacora(db, req.query.limite));
}));

module.exports = router;
