// routes/agendas-usuaria.js — Fase 259: "Agendas por usuaria" (Clinica Aurora).
// Mismo patron que routes/calidad-resumen.js: el navegador lee el reporte de
// citas y manda SOLO conteos agregados; los GET devuelven los datos con el
// nombre real resuelto (alias_asesores) al leer.
'use strict';
const express = require('express');
const db = require('../db');
const { opcionesConCache } = require('../cache-opciones');
const { requireActor, campaignAccess, canLoadModule, campanaDeCarga } = require('../auth');
const { validate, schemas } = require('../validation');
const { impactoAgendasUsuaria, cargarAgendasUsuaria, agendasUsuariaOpciones, agendasUsuariaDatos } = require('../agendas-usuaria');
const { wrap, logEvent, actorLabel } = require('./shared');
const { ocultaAsesores, seudonimos } = require('../privacidad-cliente'); // Fase 287 (#5)

const router = express.Router();
const sinAcceso = (res) => res.status(403).json({ error: 'Sin acceso a los datos de esta campana' });
router.use('/calidad/agendas-usuaria', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

router.get('/calidad/agendas-usuaria/opciones', requireActor, validate(schemas.agendasUsuariaQuery, 'query'), wrap((req, res) => {
  if (!campaignAccess(req.actor, req.query.campana)) return sinAcceso(res);
  res.json(opcionesConCache(db, JSON.stringify(['agendas-usuaria', req.query.campana]), () => agendasUsuariaOpciones(db, req.query.campana)));
}));

// Sin cache de opciones: el nombre depende de los alias, que cambian aparte.
router.get('/calidad/agendas-usuaria/datos', requireActor, validate(schemas.agendasUsuariaQuery, 'query'), wrap((req, res) => {
  if (!campaignAccess(req.actor, req.query.campana)) return sinAcceso(res);
  const d = agendasUsuariaDatos(db, req.query.campana);
  // Fase 287 (#5): el cliente que oculta nombres (Aurora, HLM) recibe "Asesor 1, 2..." y sin el usuario del sistema.
  if (ocultaAsesores(db, req.actor, req.query.campana)) {
    const alias = seudonimos(d.filas.map((f) => f.asesora));
    return res.json({ ...d, filas: d.filas.map((f) => ({ ...f, asesora: alias(f.asesora), usuario: '' })) });
  }
  res.json(d);
}));

router.post('/calidad/agendas-usuaria/carga/impacto', requireActor, validate(schemas.agendasUsuariaCargaBody), wrap((req, res) => {
  if (!canLoadModule(req.actor, 'agendas_usuaria', campanaDeCarga(req))) return res.status(403).json({ error: 'Se requiere el permiso de Cargar Datos para calcular el impacto de una carga' });
  if (!campaignAccess(req.actor, req.body.campana)) return sinAcceso(res);
  res.json(impactoAgendasUsuaria(db, req.body));
}));

router.post('/calidad/agendas-usuaria/carga', requireActor, validate(schemas.agendasUsuariaCargaBody), wrap((req, res) => {
  if (!canLoadModule(req.actor, 'agendas_usuaria', campanaDeCarga(req))) return res.status(403).json({ error: 'Se requiere el permiso de Cargar Datos para subir las agendas por usuaria' });
  const b = req.body;
  if (!campaignAccess(req.actor, b.campana)) return sinAcceso(res);
  const r = cargarAgendasUsuaria(db, { campana: b.campana, archivoNombre: b.archivoNombre || '', cargadoPorNombre: req.actor.nombre || '-', filas: b.filas });
  logEvent('AGENDAS_USUARIA_CARGA', { nombre: `${r.citas} cita(s)`, user: '-', rol: b.campana }, actorLabel(req.actor), `${r.meses.join(', ')} (${r.borradas} fila(s) reemplazada(s))`);
  res.status(201).json(r);
}));

module.exports = router;
