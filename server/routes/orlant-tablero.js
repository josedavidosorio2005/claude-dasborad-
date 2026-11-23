// routes/orlant-tablero.js — Fase N1: tablero nuevo de ORLANT (solo lectura). Mientras se
// valida, SOLO el administrador completo (isFullAdmin): ni supervisores, ni el cliente.
const express = require('express');
const db = require('../db');
const { requireActor, isFullAdmin } = require('../auth');
const { orlantTableroDatos } = require('../orlant-tablero');
const { wrap, actorLabel, logEvent } = require('./shared');
const skillLinea = require('../skill-linea');

const router = express.Router();

router.get('/orlant/tablero', requireActor, wrap((req, res) => {
  if (!isFullAdmin(req.actor)) return res.status(403).json({ error: 'Solo el administrador ve el tablero nuevo de ORLANT' });
  res.set('Cache-Control', 'no-store');
  res.json(orlantTableroDatos(db, req.query || {}));
}));

// Fase N6 (23/11/2026): mapa de skills de ORLANT a línea (General / 3P / no cuenta), editable por el
// administrador mientras Edwin confirma (docs/orlant/nuevo-dashboard/mapa-skills-propuesta.md).
router.get('/orlant/skills-linea', requireActor, wrap((req, res) => {
  if (!isFullAdmin(req.actor)) return res.status(403).json({ error: 'Solo el administrador' });
  res.set('Cache-Control', 'no-store');
  res.json(skillLinea.listar(db, 'ORLANT'));
}));
router.put('/orlant/skills-linea', requireActor, wrap((req, res) => {
  if (!isFullAdmin(req.actor)) return res.status(403).json({ error: 'Solo el administrador' });
  let r;
  try { r = skillLinea.guardar(db, 'ORLANT', (req.body || {}).cambios, actorLabel(req.actor)); } catch (e) {
    if (e && e.status) return res.status(e.status).json({ error: e.message });
    throw e;
  }
  logEvent('SKILL_LINEA', null, actorLabel(req.actor), 'ORLANT · mapa de skills a línea · ' + r.guardados + ' guardados, ' + r.quitados + ' vueltos a «sin definir»');
  res.json(Object.assign({ ok: true }, r, skillLinea.listar(db, 'ORLANT')));
}));

module.exports = router;
