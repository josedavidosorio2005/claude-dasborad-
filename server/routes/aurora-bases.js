// routes/aurora-bases.js — Fase 306: Inasistencia y Encuestas de Clinica Aurora
// (server/aurora-bases.js). Leer: acceso a la campaña. Cargar: el permiso del
// modulo (canLoadModule) y acceso a la campaña. El navegador manda solo conteos.
'use strict';
const express = require('express');
const db = require('../db');
const { requireActor, campaignAccess, canLoadModule } = require('../auth');
const { validate, schemas } = require('../validation');
const ab = require('../aurora-bases');
const { wrap, logEvent, actorLabel } = require('./shared');

const router = express.Router();
const sinAcceso = (res) => res.status(403).json({ error: 'Sin acceso a los datos de esta campana' });
const RUTAS = [
  { tipo: 'inasistencia', base: '/calidad/aurora-inasistencia', modulo: 'inasistencia_au', schema: schemas.auroraInasistenciaCargaBody, evento: 'AURORA_INASISTENCIA_CARGA', nombre: 'inasistencia' },
  { tipo: 'encuestas', base: '/calidad/aurora-encuestas', modulo: 'encuestas_au', schema: schemas.auroraEncuestasCargaBody, evento: 'AURORA_ENCUESTAS_CARGA', nombre: 'encuestas' },
];

for (const r of RUTAS) {
  router.use(r.base, (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
  router.get(r.base + '/opciones', requireActor, validate(schemas.agendasUsuariaQuery, 'query'), wrap((req, res) => {
    if (!campaignAccess(req.actor, req.query.campana)) return sinAcceso(res);
    res.json(ab.opciones(db, r.tipo, req.query.campana));
  }));
  router.get(r.base + '/datos', requireActor, validate(schemas.agendasUsuariaQuery, 'query'), wrap((req, res) => {
    if (!campaignAccess(req.actor, req.query.campana)) return sinAcceso(res);
    res.json(ab.datos(db, r.tipo, req.query.campana));
  }));
  router.post(r.base + '/carga/impacto', requireActor, validate(r.schema), wrap((req, res) => {
    if (!canLoadModule(req.actor, r.modulo)) return res.status(403).json({ error: 'Se requiere el permiso de Cargar Datos para calcular el impacto de una carga' });
    if (!campaignAccess(req.actor, req.body.campana)) return sinAcceso(res);
    res.json(ab.impacto(db, r.tipo, req.body));
  }));
  router.post(r.base + '/carga', requireActor, validate(r.schema), wrap((req, res) => {
    if (!canLoadModule(req.actor, r.modulo)) return res.status(403).json({ error: 'Se requiere el permiso de Cargar Datos para subir la base de ' + r.nombre });
    const b = req.body;
    if (!campaignAccess(req.actor, b.campana)) return sinAcceso(res);
    const out = ab.cargar(db, r.tipo, { campana: b.campana, archivoNombre: b.archivoNombre || '', cargadoPorNombre: req.actor.nombre || '-', filas: b.filas });
    logEvent(r.evento, { nombre: `${out.total} registro(s)`, user: '-', rol: b.campana }, actorLabel(req.actor), `${out.meses.join(', ')} (${out.borradas} fila(s) reemplazada(s))`);
    res.status(201).json(out);
  }));
}

module.exports = router;
