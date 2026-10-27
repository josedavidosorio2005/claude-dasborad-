// routes/flujo-hora.js — Fase 196 (Mobilize): "Flujo por hora". Mismo patron
// que routes/calidad-resumen.js: lecturas con acceso a la campaña y carga con
// el permiso del modulo (impacto -> carga). Montado bajo /calidad para heredar
// el no-cache.
'use strict';
const express = require('express');
const db = require('../db');
const { opcionesConCache } = require('../cache-opciones');
const { requireActor, campaignAccess, canLoadModule } = require('../auth');
const { validate, schemas } = require('../validation');
const { impactoFlujoHora, cargarFlujoHora, flujoHoraOpciones, flujoHoraMes } = require('../flujo-hora');
const { wrap, logEvent, actorLabel } = require('./shared');

const router = express.Router();
const sinAcceso = (res) => res.status(403).json({ error: 'Sin acceso a los datos de esta campana' });

router.get('/calidad/flujo-hora/opciones', requireActor, validate(schemas.flujoHoraOpcionesQuery, 'query'), wrap((req, res) => {
  if (!campaignAccess(req.actor, req.query.campana)) return sinAcceso(res);
  res.json(opcionesConCache(db, JSON.stringify(['flujo-hora', req.query.campana]), () => flujoHoraOpciones(db, req.query.campana)));
}));

router.get('/calidad/flujo-hora/mes', requireActor, validate(schemas.flujoHoraMesQuery, 'query'), wrap((req, res) => {
  if (!campaignAccess(req.actor, req.query.campana)) return sinAcceso(res);
  res.json(flujoHoraMes(db, req.query));
}));

router.post('/calidad/flujo-hora/carga/impacto', requireActor, validate(schemas.flujoHoraCargaBody), wrap((req, res) => {
  if (!canLoadModule(req.actor, 'flujo_hora')) return res.status(403).json({ error: 'Se requiere el permiso de Cargar Datos para calcular el impacto de una carga' });
  if (!campaignAccess(req.actor, req.body.campana)) return sinAcceso(res);
  res.json(impactoFlujoHora(db, { campana: req.body.campana, filas: req.body.filas }));
}));

router.post('/calidad/flujo-hora/carga', requireActor, validate(schemas.flujoHoraCargaBody), wrap((req, res) => {
  if (!canLoadModule(req.actor, 'flujo_hora')) return res.status(403).json({ error: 'Se requiere el permiso de Cargar Datos para subir el flujo por hora' });
  const b = req.body;
  if (!campaignAccess(req.actor, b.campana)) return sinAcceso(res);
  const r = cargarFlujoHora(db, { campana: b.campana, archivoNombre: b.archivoNombre || '', cargadoPorNombre: req.actor.nombre || '-', filas: b.filas });
  logEvent('FLUJO_HORA_CARGA', { nombre: `${r.insertadas} fila(s)`, user: '-', rol: b.campana }, actorLabel(req.actor), `${r.desde} a ${r.hasta} (${r.borradas} reemplazada(s))`);
  res.status(201).json(r);
}));

module.exports = router;
