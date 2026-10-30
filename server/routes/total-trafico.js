// routes/total-trafico.js — Fase 219: "Total tráfico" de ORLANT (solo
// lectura; sale de Trafico de Llamadas, Trafico de WhatsApp y la salida, ver
// server/total-trafico.js). Montado bajo '/calidad' para heredar el
// middleware de no-cache, igual que routes/efectividad-citas.js.
const express = require('express');
const db = require('../db');
const { requireActor, campaignAccess } = require('../auth');
const { validate, schemas } = require('../validation');
const { totalTraficoPorMes } = require('../total-trafico');
const { wrap } = require('./shared');

const router = express.Router();

router.get(
  '/calidad/total-trafico/mensual',
  requireActor,
  validate(schemas.salidaQuery, 'query'),
  wrap((req, res) => {
    if (!campaignAccess(req.actor, req.query.campana)) {
      return res.status(403).json({ error: 'Sin acceso a los datos de esta campana' });
    }
    res.json(totalTraficoPorMes(db, req.query.campana));
  })
);

module.exports = router;
