// routes/eficacia.js — Fase 198 (Mobilize): "Eficacia" por mes, del CDR de
// Tipificacion. Solo lectura, con acceso a la campaña.
'use strict';
const express = require('express');
const db = require('../db');
const { requireActor, campaignAccess } = require('../auth');
const { validate, schemas } = require('../validation');
const { eficaciaPorMes } = require('../eficacia');
const { wrap } = require('./shared');

const router = express.Router();

router.get('/calidad/tipificacion/eficacia', requireActor, validate(schemas.eficaciaQuery, 'query'), wrap((req, res) => {
  if (!campaignAccess(req.actor, req.query.campana)) return res.status(403).json({ error: 'Sin acceso a los datos de esta campana' });
  res.json(eficaciaPorMes(db, req.query));
}));

module.exports = router;
