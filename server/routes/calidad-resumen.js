// routes/calidad-resumen.js — Fase 172: "Calidad: resumen por asesor"
// (Mobilize). Mismo patron que routes/whatsapp-tiempos.js: el navegador lee
// el Excel y manda filas compactas; los GET devuelven el resumen ya armado.
'use strict';
const express = require('express');
const db = require('../db');
const { opcionesConCache } = require('../cache-opciones');
const { requireActor, campaignAccess, canLoadModule } = require('../auth');
const { validate, schemas } = require('../validation');
const { impactoCalidadResumen, cargarCalidadResumen, calidadResumenOpciones, calidadResumenPorMes } = require('../calidad-resumen');
const { wrap, logEvent, actorLabel } = require('./shared');

const router = express.Router();
const sinAcceso = (res) => res.status(403).json({ error: 'Sin acceso a los datos de esta campana' });

router.get('/calidad/calidad-resumen/opciones', requireActor, validate(schemas.calidadResumenQuery, 'query'), wrap((req, res) => {
  if (!campaignAccess(req.actor, req.query.campana)) return sinAcceso(res);
  res.json(opcionesConCache(db, JSON.stringify(['calidad-resumen', req.query.campana]), () => calidadResumenOpciones(db, req.query.campana)));
}));

router.get('/calidad/calidad-resumen/mensual', requireActor, validate(schemas.calidadResumenQuery, 'query'), wrap((req, res) => {
  if (!campaignAccess(req.actor, req.query.campana)) return sinAcceso(res);
  res.json(calidadResumenPorMes(db, req.query.campana));
}));

router.post('/calidad/calidad-resumen/carga/impacto', requireActor, validate(schemas.calidadResumenCargaBody), wrap((req, res) => {
  if (!canLoadModule(req.actor, 'calidad_resumen')) return res.status(403).json({ error: 'Se requiere el permiso de Cargar Datos para calcular el impacto de una carga' });
  if (!campaignAccess(req.actor, req.body.campana)) return sinAcceso(res);
  res.json(impactoCalidadResumen(db, req.body));
}));

router.post('/calidad/calidad-resumen/carga', requireActor, validate(schemas.calidadResumenCargaBody), wrap((req, res) => {
  if (!canLoadModule(req.actor, 'calidad_resumen')) return res.status(403).json({ error: 'Se requiere el permiso de Cargar Datos para subir el resumen de calidad' });
  const b = req.body;
  if (!campaignAccess(req.actor, b.campana)) return sinAcceso(res);
  const r = cargarCalidadResumen(db, { campana: b.campana, mes: b.mes, archivoNombre: b.archivoNombre || '', cargadoPorNombre: req.actor.nombre || '-', filas: b.filas });
  logEvent('CALIDAD_RESUMEN_CARGA', { nombre: `${r.insertadas} asesor(es)`, user: '-', rol: b.campana }, actorLabel(req.actor), `${r.mes} (${r.borradas} reemplazada(s))`);
  res.status(201).json(r);
}));

module.exports = router;
