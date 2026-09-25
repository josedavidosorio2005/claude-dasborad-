// routes/agendas.js — Agendas de ORLANT (Fase 78, pedido de Jairo/Edwin).
// Mismo patron que routes/trafico-whatsapp.js: el servidor NUNCA abre el
// Excel, solo recibe filas ya parseadas (y ya anonimizadas -- ver
// agendas-logic.js) desde el navegador. A diferencia de Trafico, aqui el
// dashboard NUNCA descarga filas crudas: todos los GET de lectura devuelven
// agregados ya calculados en SQL (agendas.js), nunca la tabla completa
// (~7.500 filas/mes).
//
// Montado bajo '/calidad/agendas' para heredar el middleware de no-cache de
// '/calidad' (mismo motivo que routes/trafico.js) -- se monta en server.js
// despues de routes/calidad.
const express = require('express');
const db = require('../db');
const { requireActor, campaignAccess, canLoadData } = require('../auth');
const { validate, schemas } = require('../validation');
const { impactoAgendas, cargarAgendas, agendasPorEspecialidad, agendasPorMes, agendasOpciones } = require('../agendas');
const { wrap, logEvent, actorLabel } = require('./shared');

const router = express.Router();

// Valores distintos para cada filtro (Mes, Asesor, Sede, Especialidad,
// Examen, Profesional, Entidad) + si hay datos (meses.length) -- lo usa
// tambien el dashboard para decidir si la pestana "Agendamiento" se
// muestra (ver dashboard-generic.js, _gdBootstrap).
router.get(
  '/calidad/agendas/opciones',
  requireActor,
  wrap((req, res) => {
    const campana = req.query.campana;
    if (!campana) return res.status(400).json({ error: 'Indica una campana' });
    if (!campaignAccess(req.actor, campana)) {
      return res.status(403).json({ error: 'Sin acceso a los datos de esta campana' });
    }
    res.json(agendasOpciones(db, campana));
  })
);

// Grafica principal: agendas por especialidad (respeta TODOS los filtros).
router.get(
  '/calidad/agendas/especialidad',
  requireActor,
  validate(schemas.agendasFiltrosQuery, 'query'),
  wrap((req, res) => {
    if (!campaignAccess(req.actor, req.query.campana)) {
      return res.status(403).json({ error: 'Sin acceso a los datos de esta campana' });
    }
    res.json(agendasPorEspecialidad(db, req.query));
  })
);

// Total de agendas por mes (respeta los demas filtros, ignora el de mes --
// pedido explicito de Edwin: esta grafica siempre muestra todos los meses).
router.get(
  '/calidad/agendas/mensual',
  requireActor,
  validate(schemas.agendasFiltrosQuery, 'query'),
  wrap((req, res) => {
    if (!campaignAccess(req.actor, req.query.campana)) {
      return res.status(403).json({ error: 'Sin acceso a los datos de esta campana' });
    }
    res.json(agendasPorMes(db, req.query));
  })
);

// Impacto de una carga ANTES de guardarla (no escribe nada): cuenta cuantas
// filas ya existen en el rango [primera..ultima fechaSolicitud] del
// archivo que se esta por subir. El frontend lo usa para pedir
// confirmacion explicita ("se reemplazaran N registros del dd/mm al
// dd/mm") antes de sobrescribir un periodo ya cargado.
router.post(
  '/calidad/agendas/carga/impacto',
  requireActor,
  validate(schemas.agendasCargaBody),
  wrap((req, res) => {
    if (!canLoadData(req.actor)) {
      return res.status(403).json({ error: 'Se requiere el permiso de Cargar Datos para calcular el impacto de una carga' });
    }
    const b = req.body;
    if (!campaignAccess(req.actor, b.campana)) {
      return res.status(403).json({ error: 'Sin acceso a los datos de esta campana' });
    }
    res.json(impactoAgendas(db, { campana: b.campana, filas: b.filas }));
  })
);

router.post(
  '/calidad/agendas/carga',
  requireActor,
  validate(schemas.agendasCargaBody),
  wrap((req, res) => {
    if (!canLoadData(req.actor)) {
      return res.status(403).json({ error: 'Se requiere el permiso de Cargar Datos para subir agendas' });
    }
    const b = req.body;
    if (!campaignAccess(req.actor, b.campana)) {
      return res.status(403).json({ error: 'Sin acceso a los datos de esta campana' });
    }
    const resultado = cargarAgendas(db, {
      campana: b.campana,
      archivoNombre: b.archivoNombre || '',
      cargadoPorNombre: req.actor.nombre || '-',
      filas: b.filas,
    });
    logEvent(
      'AGENDAS_CARGA',
      { nombre: `${resultado.insertadas} fila(s)`, user: '-', rol: b.campana },
      actorLabel(req.actor),
      `${resultado.desde} a ${resultado.hasta} (${resultado.borradas} reemplazada(s))`
    );
    res.status(201).json(resultado);
  })
);

module.exports = router;
