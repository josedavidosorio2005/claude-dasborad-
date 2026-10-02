// routes/efectividad-agendamiento.js — Efectividad de Agendamiento de
// ORLANT (Fase 111, pedido textual de Edwin: "el ranking va a ser
// efectividad por agendamiento"). Mismo patron que routes/inasistencia.js:
// el servidor NUNCA abre el Excel, solo recibe filas ya parseadas desde el
// navegador; el GET de ranking devuelve el agregado YA calculado en
// servidor (puesto, % ponderado del equipo), nunca filas crudas.
//
// Montado bajo '/calidad/efectividad-agendamiento' para heredar el
// middleware de no-cache de '/calidad' -- se monta en server.js despues de
// routes/agendas.
const express = require('express');
const db = require('../db');
const { requireActor, campaignAccess, canLoadData } = require('../auth');
const { validate, schemas } = require('../validation');
const {
  impactoEfectividadAgendamiento, cargarEfectividadAgendamiento,
  efectividadAgendamientoOpciones, efectividadAgendamientoRanking,
} = require('../efectividad-agendamiento');
const { wrap, logEvent, actorLabel } = require('./shared');

const router = express.Router();

// Meses distintos (+ si hay datos) -- tambien lo usa el dashboard para
// decidir si "Ranking de Asesores" tiene algo que mostrar (ver
// dashboard-generic.js, _gdBootstrap).
router.get(
  '/calidad/efectividad-agendamiento/opciones',
  requireActor,
  validate(schemas.efectividadAgendamientoOpcionesQuery, 'query'),
  wrap((req, res) => {
    if (!campaignAccess(req.actor, req.query.campana)) {
      return res.status(403).json({ error: 'Sin acceso a los datos de esta campana' });
    }
    res.json(efectividadAgendamientoOpciones(db, req.query.campana));
  })
);

// Ranking de un mes: puesto por efectividad (agendas/gestiones) de mayor a
// menor, empate = mas gestiones primero. `equipo` trae el total del mes y
// la efectividad PONDERADA (nunca el promedio simple de los %).
router.get(
  '/calidad/efectividad-agendamiento/ranking',
  requireActor,
  validate(schemas.efectividadAgendamientoRankingQuery, 'query'),
  wrap((req, res) => {
    if (!campaignAccess(req.actor, req.query.campana)) {
      return res.status(403).json({ error: 'Sin acceso a los datos de esta campana' });
    }
    res.json(efectividadAgendamientoRanking(db, req.query));
  })
);

// Impacto de una carga ANTES de guardarla (no escribe nada).
router.post(
  '/calidad/efectividad-agendamiento/carga/impacto',
  requireActor,
  validate(schemas.efectividadAgendamientoCargaBody),
  wrap((req, res) => {
    if (!canLoadData(req.actor)) {
      return res.status(403).json({ error: 'Se requiere el permiso de Cargar Datos para calcular el impacto de una carga' });
    }
    const b = req.body;
    if (!campaignAccess(req.actor, b.campana)) {
      return res.status(403).json({ error: 'Sin acceso a los datos de esta campana' });
    }
    res.json(impactoEfectividadAgendamiento(db, { campana: b.campana, filas: b.filas }));
  })
);

router.post(
  '/calidad/efectividad-agendamiento/carga',
  requireActor,
  validate(schemas.efectividadAgendamientoCargaBody),
  wrap((req, res) => {
    if (!canLoadData(req.actor)) {
      return res.status(403).json({ error: 'Se requiere el permiso de Cargar Datos para subir Efectividad de agendamiento' });
    }
    const b = req.body;
    if (!campaignAccess(req.actor, b.campana)) {
      return res.status(403).json({ error: 'Sin acceso a los datos de esta campana' });
    }
    const resultado = cargarEfectividadAgendamiento(db, {
      campana: b.campana,
      archivoNombre: b.archivoNombre || '',
      cargadoPorNombre: req.actor.nombre || '-',
      filas: b.filas,
    });
    logEvent(
      'EFECTIVIDAD_AGENDAMIENTO_CARGA',
      { nombre: `${resultado.insertadas} fila(s)`, user: '-', rol: b.campana },
      actorLabel(req.actor),
      `Dashboard: carga de Efectividad de agendamiento (${resultado.meses.join(', ')}, ${resultado.borradas} reemplazada(s))`
    );
    res.status(201).json(resultado);
  })
);

module.exports = router;
