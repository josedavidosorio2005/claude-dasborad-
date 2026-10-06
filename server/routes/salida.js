// routes/salida.js — Llamadas y WhatsApp de Salida de ORLANT (Fase 127,
// pedido textual de Edwin). Mismo patron que routes/efectividad-citas.js:
// el servidor NUNCA abre el Excel, solo recibe filas ya parseadas (y con
// el año YA resuelto, ver salida-logic.js) desde el navegador.
//
// Montado bajo '/calidad/salida' para heredar el middleware de no-cache
// de '/calidad' -- se monta en server.js despues de routes/efectividad-citas.
const express = require('express');
const db = require('../db');
const { requireActor, campaignAccess, canLoadData } = require('../auth');
const { validate, schemas } = require('../validation');
const {
  impactoSalida, cargarSalida,
  salidaOpciones, salidaPorMes,
} = require('../salida');
const { wrap, logEvent, actorLabel } = require('./shared');

const router = express.Router();

// Valores distintos de Mes + si hay datos -- tambien lo usa el dashboard
// para decidir si la pestaña "Salida" se destapa.
router.get(
  '/calidad/salida/opciones',
  requireActor,
  validate(schemas.salidaQuery, 'query'),
  wrap((req, res) => {
    if (!campaignAccess(req.actor, req.query.campana)) {
      return res.status(403).json({ error: 'Sin acceso a los datos de esta campana' });
    }
    res.json(salidaOpciones(db, req.query.campana));
  })
);

// Todos los meses con datos, ordenados.
router.get(
  '/calidad/salida/mensual',
  requireActor,
  validate(schemas.salidaQuery, 'query'),
  wrap((req, res) => {
    if (!campaignAccess(req.actor, req.query.campana)) {
      return res.status(403).json({ error: 'Sin acceso a los datos de esta campana' });
    }
    res.json(salidaPorMes(db, req.query.campana));
  })
);

// Impacto de una carga ANTES de guardarla (no escribe nada).
router.post(
  '/calidad/salida/carga/impacto',
  requireActor,
  validate(schemas.salidaCargaBody),
  wrap((req, res) => {
    if (!canLoadData(req.actor)) {
      return res.status(403).json({ error: 'Se requiere el permiso de Cargar Datos para calcular el impacto de una carga' });
    }
    const b = req.body;
    if (!campaignAccess(req.actor, b.campana)) {
      return res.status(403).json({ error: 'Sin acceso a los datos de esta campana' });
    }
    res.json(impactoSalida(db, { campana: b.campana, filas: b.filas }));
  })
);

router.post(
  '/calidad/salida/carga',
  requireActor,
  validate(schemas.salidaCargaBody),
  wrap((req, res) => {
    if (!canLoadData(req.actor)) {
      return res.status(403).json({ error: 'Se requiere el permiso de Cargar Datos para subir Salida' });
    }
    const b = req.body;
    if (!campaignAccess(req.actor, b.campana)) {
      return res.status(403).json({ error: 'Sin acceso a los datos de esta campana' });
    }
    const resultado = cargarSalida(db, {
      campana: b.campana,
      archivoNombre: b.archivoNombre || '',
      cargadoPorNombre: req.actor.nombre || '-',
      filas: b.filas,
    });
    logEvent(
      'SALIDA_CARGA',
      { nombre: `${resultado.insertadas} fila(s)`, user: '-', rol: b.campana },
      actorLabel(req.actor),
      `${resultado.meses.join(', ')} (${resultado.borradas} reemplazada(s))`
    );
    res.status(201).json(resultado);
  })
);

module.exports = router;
