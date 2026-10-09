// routes/llamadas-unicas.js — Llamadas Unicas de Mobilize (Fase 138, PR3,
// pedido de Edwin 09/10/2026). Mismo patron que routes/tipificaciones.js:
// el servidor NUNCA abre el Excel, solo recibe filas ya parseadas y
// deduplicadas desde el navegador (el telefono NUNCA llega hasta aqui), y
// los GET de lectura devuelven agregados ya calculados en SQL.
//
// Montado bajo '/calidad/llamadas-unicas' para heredar el middleware de
// no-cache de '/calidad' (mismo motivo que routes/tipificaciones.js).
'use strict';
const path = require('path');
const express = require('express');
const db = require('../db');
const { requireActor, campaignAccess, canLoadData } = require('../auth');
const { validate, schemas } = require('../validation');
const {
  impactoLlamadasUnicas,
  cargarLlamadasUnicas,
  llamadasUnicasResumen,
  llamadasUnicasPorMes,
  llamadasUnicasOpciones,
} = require('../llamadas-unicas');
const { wrap, logEvent, actorLabel } = require('./shared');

const router = express.Router();

// Plantilla oficial (Fase 138, PR3, pedido de Edwin 09/10/2026): columnas
// EXACTAS del archivo real (AGENT_NAME, DATE, TELEPHONE, SKILL_NAME) + 1
// fila de ejemplo SINTETICA. Mismo patron que GET /calidad/trafico/plantilla
// (routes/trafico.js): sirve el ARCHIVO REAL guardado en server/plantillas/
// tal cual, nunca lo regenera con codigo.
const PLANTILLA_LLAMADAS_UNICAS_PATH = path.join(__dirname, '..', 'plantillas', 'PLANTILLA_LLAMADAS_UNICAS_MOBILIZE.xlsx');
router.get(
  '/calidad/llamadas-unicas/plantilla',
  requireActor,
  wrap((req, res) => {
    if (!canLoadData(req.actor)) {
      return res.status(403).json({ error: 'Se requiere el permiso de Cargar Datos para descargar la plantilla' });
    }
    res.download(PLANTILLA_LLAMADAS_UNICAS_PATH, 'PLANTILLA_LLAMADAS_UNICAS_MOBILIZE.xlsx', (err) => {
      if (err && !res.headersSent) {
        res.status(500).json({ error: 'No se pudo leer la plantilla en el servidor' });
      }
    });
  })
);

router.get(
  '/calidad/llamadas-unicas/opciones',
  requireActor,
  validate(schemas.llamadasUnicasOpcionesQuery, 'query'),
  wrap((req, res) => {
    if (!campaignAccess(req.actor, req.query.campana)) {
      return res.status(403).json({ error: 'Sin acceso a los datos de esta campana' });
    }
    res.json(llamadasUnicasOpciones(db, req.query.campana));
  })
);

// Tarjetas-resumen (contestadas/abandonadas/total), respeta los filtros.
router.get(
  '/calidad/llamadas-unicas/resumen',
  requireActor,
  validate(schemas.llamadasUnicasFiltrosQuery, 'query'),
  wrap((req, res) => {
    if (!campaignAccess(req.actor, req.query.campana)) {
      return res.status(403).json({ error: 'Sin acceso a los datos de esta campana' });
    }
    res.json(llamadasUnicasResumen(db, req.query));
  })
);

// Grafica de barras por mes, respeta los mismos filtros.
router.get(
  '/calidad/llamadas-unicas/por-mes',
  requireActor,
  validate(schemas.llamadasUnicasFiltrosQuery, 'query'),
  wrap((req, res) => {
    if (!campaignAccess(req.actor, req.query.campana)) {
      return res.status(403).json({ error: 'Sin acceso a los datos de esta campana' });
    }
    res.json(llamadasUnicasPorMes(db, req.query));
  })
);

// Impacto de una carga ANTES de guardarla (no escribe nada) -- usado por la
// vista previa del admin Y por el dry-run de la carga real ("OK cargar").
router.post(
  '/calidad/llamadas-unicas/carga/impacto',
  requireActor,
  validate(schemas.llamadasUnicasCargaBody),
  wrap((req, res) => {
    if (!canLoadData(req.actor)) {
      return res.status(403).json({ error: 'Se requiere el permiso de Cargar Datos para calcular el impacto de una carga' });
    }
    const b = req.body;
    if (!campaignAccess(req.actor, b.campana)) {
      return res.status(403).json({ error: 'Sin acceso a los datos de esta campana' });
    }
    res.json(impactoLlamadasUnicas(db, { campana: b.campana, filas: b.filas }));
  })
);

router.post(
  '/calidad/llamadas-unicas/carga',
  requireActor,
  validate(schemas.llamadasUnicasCargaBody),
  wrap((req, res) => {
    if (!canLoadData(req.actor)) {
      return res.status(403).json({ error: 'Se requiere el permiso de Cargar Datos para subir llamadas unicas' });
    }
    const b = req.body;
    if (!campaignAccess(req.actor, b.campana)) {
      return res.status(403).json({ error: 'Sin acceso a los datos de esta campana' });
    }
    const resultado = cargarLlamadasUnicas(db, {
      campana: b.campana,
      archivoNombre: b.archivoNombre || '',
      cargadoPorNombre: req.actor.nombre || '-',
      filas: b.filas,
    });
    logEvent(
      'LLAMADAS_UNICAS_CARGA',
      { nombre: `${resultado.insertadas} fila(s)`, user: '-', rol: b.campana },
      actorLabel(req.actor),
      `${resultado.desde} a ${resultado.hasta} (${resultado.borradas} reemplazada(s))`
    );
    res.status(201).json(resultado);
  })
);

module.exports = router;
