// routes/efectividad-citas.js — Efectividad de Citas Atendidas de ORLANT
// (Fase 111, pedido textual de InCo). Mismo patron que
// routes/efectividad-agendamiento.js/inasistencia.js: el servidor NUNCA
// abre el Excel, solo recibe filas ya parseadas desde el navegador.
//
// Montado bajo '/calidad/efectividad-citas' para heredar el middleware de
// no-cache de '/calidad' -- se monta en server.js despues de
// routes/efectividad-agendamiento.
const express = require('express');
const db = require('../db');
const { requireActor, campaignAccess, canLoadData } = require('../auth');
const { validate, schemas } = require('../validation');
const {
  impactoEfectividadCitas, cargarEfectividadCitas,
  efectividadCitasOpciones, efectividadCitasPorMes,
} = require('../efectividad-citas');
const { wrap, logEvent, actorLabel } = require('./shared');

const router = express.Router();

router.get(
  '/calidad/efectividad-citas/opciones',
  requireActor,
  validate(schemas.efectividadCitasQuery, 'query'),
  wrap((req, res) => {
    if (!campaignAccess(req.actor, req.query.campana)) {
      return res.status(403).json({ error: 'Sin acceso a los datos de esta campana' });
    }
    res.json(efectividadCitasOpciones(db, req.query.campana));
  })
);

// Todos los meses con datos (sin filtros -- un total por mes, sin sede ni
// especialidad): tarjetas + grafica + tabla de "Efectividad de Citas".
router.get(
  '/calidad/efectividad-citas/mensual',
  requireActor,
  validate(schemas.efectividadCitasQuery, 'query'),
  wrap((req, res) => {
    if (!campaignAccess(req.actor, req.query.campana)) {
      return res.status(403).json({ error: 'Sin acceso a los datos de esta campana' });
    }
    res.json(efectividadCitasPorMes(db, req.query.campana));
  })
);

router.post(
  '/calidad/efectividad-citas/carga/impacto',
  requireActor,
  validate(schemas.efectividadCitasCargaBody),
  wrap((req, res) => {
    if (!canLoadData(req.actor)) {
      return res.status(403).json({ error: 'Se requiere el permiso de Cargar Datos para calcular el impacto de una carga' });
    }
    const b = req.body;
    if (!campaignAccess(req.actor, b.campana)) {
      return res.status(403).json({ error: 'Sin acceso a los datos de esta campana' });
    }
    res.json(impactoEfectividadCitas(db, { campana: b.campana, filas: b.filas }));
  })
);

router.post(
  '/calidad/efectividad-citas/carga',
  requireActor,
  validate(schemas.efectividadCitasCargaBody),
  wrap((req, res) => {
    if (!canLoadData(req.actor)) {
      return res.status(403).json({ error: 'Se requiere el permiso de Cargar Datos para subir Efectividad de citas' });
    }
    const b = req.body;
    if (!campaignAccess(req.actor, b.campana)) {
      return res.status(403).json({ error: 'Sin acceso a los datos de esta campana' });
    }
    const resultado = cargarEfectividadCitas(db, {
      campana: b.campana,
      archivoNombre: b.archivoNombre || '',
      cargadoPorNombre: req.actor.nombre || '-',
      filas: b.filas,
    });
    logEvent(
      'EFECTIVIDAD_CITAS_CARGA',
      { nombre: `${resultado.insertadas} fila(s)`, user: '-', rol: b.campana },
      actorLabel(req.actor),
      `${resultado.meses.join(', ')} (${resultado.borradas} reemplazada(s))`
    );
    res.status(201).json(resultado);
  })
);

module.exports = router;
