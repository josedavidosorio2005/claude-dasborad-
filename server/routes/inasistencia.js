// routes/inasistencia.js — Inasistencia de ORLANT (Fase 98, pedido urgente
// de Edwin). Mismo patron que routes/agendas.js: el servidor NUNCA abre el
// Excel, solo recibe filas ya parseadas desde el navegador. Todos los GET de
// lectura devuelven agregados ya calculados en SQL (inasistencia.js), nunca
// la tabla completa.
//
// Montado bajo '/calidad/inasistencia' para heredar el middleware de no-cache
// de '/calidad' -- se monta en server.js despues de routes/calidad.
const express = require('express');
const db = require('../db');
const { requireActor, campaignAccess, canLoadData } = require('../auth');
const { validate, schemas } = require('../validation');
const {
  impactoInasistencias, cargarInasistencias,
  inasistenciaResumen, inasistenciaPorEspecialidad, inasistenciaPorMes, inasistenciaOpciones,
} = require('../inasistencia');
const { wrap, logEvent, actorLabel } = require('./shared');

const router = express.Router();

// Valores distintos para cada filtro (Mes, Especialidad) + si hay datos
// (meses.length) -- lo usa tambien el dashboard para decidir si la pestana
// "Inasistencia" se muestra (ver dashboard-generic.js, _gdBootstrap).
router.get(
  '/calidad/inasistencia/opciones',
  requireActor,
  wrap((req, res) => {
    const campana = req.query.campana;
    if (!campana) return res.status(400).json({ error: 'Indica una campana' });
    if (!campaignAccess(req.actor, campana)) {
      return res.status(403).json({ error: 'Sin acceso a los datos de esta campana' });
    }
    res.json(inasistenciaOpciones(db, campana));
  })
);

// Resumen del mes (agregado, opcionalmente acotado a una especialidad) --
// tarjetas de "Por especialidad" (total del mes) y su comparacion contra el
// mes anterior (2 llamadas del navegador, una por mes).
router.get(
  '/calidad/inasistencia/resumen',
  requireActor,
  validate(schemas.inasistenciaFiltrosQuery, 'query'),
  wrap((req, res) => {
    if (!campaignAccess(req.actor, req.query.campana)) {
      return res.status(403).json({ error: 'Sin acceso a los datos de esta campana' });
    }
    if (!req.query.mes) return res.status(400).json({ error: 'Indica el mes' });
    res.json(inasistenciaResumen(db, req.query));
  })
);

// Filas por especialidad de un mes (barras/apilada de "Por especialidad" y
// tabla "Detalle" cuando el filtro esta en un solo mes).
router.get(
  '/calidad/inasistencia/especialidad',
  requireActor,
  validate(schemas.inasistenciaFiltrosQuery, 'query'),
  wrap((req, res) => {
    if (!campaignAccess(req.actor, req.query.campana)) {
      return res.status(403).json({ error: 'Sin acceso a los datos de esta campana' });
    }
    if (!req.query.mes) return res.status(400).json({ error: 'Indica el mes' });
    res.json(inasistenciaPorEspecialidad(db, req.query));
  })
);

// Filas por (mes, especialidad) de TODOS los meses con datos (respeta
// especialidad y rango, ignora el filtro de mes a proposito) -- linea "Por
// mes" y tabla "Detalle" cuando el filtro es un rango de varios meses.
router.get(
  '/calidad/inasistencia/mensual',
  requireActor,
  validate(schemas.inasistenciaFiltrosQuery, 'query'),
  wrap((req, res) => {
    if (!campaignAccess(req.actor, req.query.campana)) {
      return res.status(403).json({ error: 'Sin acceso a los datos de esta campana' });
    }
    res.json(inasistenciaPorMes(db, req.query));
  })
);

// Impacto de una carga ANTES de guardarla (no escribe nada): cuenta cuantas
// filas ya existen en los meses que trae el archivo que se esta por subir.
router.post(
  '/calidad/inasistencia/carga/impacto',
  requireActor,
  validate(schemas.inasistenciaCargaBody),
  wrap((req, res) => {
    if (!canLoadData(req.actor)) {
      return res.status(403).json({ error: 'Se requiere el permiso de Cargar Datos para calcular el impacto de una carga' });
    }
    const b = req.body;
    if (!campaignAccess(req.actor, b.campana)) {
      return res.status(403).json({ error: 'Sin acceso a los datos de esta campana' });
    }
    res.json(impactoInasistencias(db, { campana: b.campana, filas: b.filas }));
  })
);

router.post(
  '/calidad/inasistencia/carga',
  requireActor,
  validate(schemas.inasistenciaCargaBody),
  wrap((req, res) => {
    if (!canLoadData(req.actor)) {
      return res.status(403).json({ error: 'Se requiere el permiso de Cargar Datos para subir inasistencia' });
    }
    const b = req.body;
    if (!campaignAccess(req.actor, b.campana)) {
      return res.status(403).json({ error: 'Sin acceso a los datos de esta campana' });
    }
    const resultado = cargarInasistencias(db, {
      campana: b.campana,
      archivoNombre: b.archivoNombre || '',
      cargadoPorNombre: req.actor.nombre || '-',
      filas: b.filas,
    });
    logEvent(
      'INASISTENCIA_CARGA',
      { nombre: `${resultado.insertadas} fila(s)`, user: '-', rol: b.campana },
      actorLabel(req.actor),
      `${resultado.meses.join(', ')} (${resultado.borradas} reemplazada(s))`
    );
    res.status(201).json(resultado);
  })
);

module.exports = router;
