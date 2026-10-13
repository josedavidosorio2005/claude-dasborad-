// routes/llamadas-salida.js — Llamadas de salida de Mobilize (Fase 141,
// Parte C). Mismo patron que routes/llamadas-unicas.js: el servidor nunca
// abre el Excel, solo recibe filas ya parseadas y deduplicadas desde el
// navegador (el telefono NUNCA llega), y los GET devuelven agregados.
//
// Nombres de asesor (decision del usuario, 13/10/2026): SOLO roles internos.
// A un rol cliente (CLIENTES_DASH) esta API nunca le devuelve nombres: sin
// `agentes` en /opciones, 403 si filtra por `agente`, 403 en /detalle.
//
// Montado bajo '/calidad/llamadas-salida' para heredar el no-cache de
// '/calidad' (mismo motivo que routes/llamadas-unicas.js).
'use strict';
const express = require('express');
const db = require('../db');
const { requireActor, campaignAccess, canLoadData } = require('../auth');
const { validate, schemas } = require('../validation');
const {
  impactoLlamadasSalida,
  cargarLlamadasSalida,
  llamadasSalidaResumen,
  llamadasSalidaPorMes,
  llamadasSalidaDetalle,
  llamadasSalidaOpciones,
} = require('../llamadas-salida');
const { wrap, logEvent, actorLabel } = require('./shared');

const router = express.Router();

// Mismo criterio que el panel de Llamadas Unicas (filtro Asesor): interno =
// todo rol que no sea el del cliente.
function esRolInterno(actor) {
  return !!actor && (actor.isMasterAdmin || actor.rol !== 'CLIENTES_DASH');
}

function sinAcceso(res) {
  return res.status(403).json({ error: 'Sin acceso a los datos de esta campana' });
}
function soloInternos(res) {
  return res.status(403).json({ error: 'El detalle por asesor solo esta disponible para el equipo interno' });
}

router.get(
  '/calidad/llamadas-salida/opciones',
  requireActor,
  validate(schemas.llamadasSalidaOpcionesQuery, 'query'),
  wrap((req, res) => {
    if (!campaignAccess(req.actor, req.query.campana)) return sinAcceso(res);
    res.json(llamadasSalidaOpciones(db, req.query.campana, { incluirAgentes: esRolInterno(req.actor) }));
  })
);

router.get(
  '/calidad/llamadas-salida/resumen',
  requireActor,
  validate(schemas.llamadasSalidaFiltrosQuery, 'query'),
  wrap((req, res) => {
    if (!campaignAccess(req.actor, req.query.campana)) return sinAcceso(res);
    if (req.query.agente && !esRolInterno(req.actor)) return soloInternos(res);
    res.json(llamadasSalidaResumen(db, req.query));
  })
);

router.get(
  '/calidad/llamadas-salida/por-mes',
  requireActor,
  validate(schemas.llamadasSalidaFiltrosQuery, 'query'),
  wrap((req, res) => {
    if (!campaignAccess(req.actor, req.query.campana)) return sinAcceso(res);
    if (req.query.agente && !esRolInterno(req.actor)) return soloInternos(res);
    res.json(llamadasSalidaPorMes(db, req.query));
  })
);

// Detalle por asesor y por dia -- solo roles internos.
router.get(
  '/calidad/llamadas-salida/detalle',
  requireActor,
  validate(schemas.llamadasSalidaFiltrosQuery, 'query'),
  wrap((req, res) => {
    if (!campaignAccess(req.actor, req.query.campana)) return sinAcceso(res);
    if (!esRolInterno(req.actor)) return soloInternos(res);
    res.json(llamadasSalidaDetalle(db, req.query));
  })
);

// Impacto de una carga ANTES de guardarla (no escribe nada).
router.post(
  '/calidad/llamadas-salida/carga/impacto',
  requireActor,
  validate(schemas.llamadasSalidaCargaBody),
  wrap((req, res) => {
    if (!canLoadData(req.actor)) {
      return res.status(403).json({ error: 'Se requiere el permiso de Cargar Datos para calcular el impacto de una carga' });
    }
    if (!campaignAccess(req.actor, req.body.campana)) return sinAcceso(res);
    res.json(impactoLlamadasSalida(db, { campana: req.body.campana, filas: req.body.filas }));
  })
);

router.post(
  '/calidad/llamadas-salida/carga',
  requireActor,
  validate(schemas.llamadasSalidaCargaBody),
  wrap((req, res) => {
    if (!canLoadData(req.actor)) {
      return res.status(403).json({ error: 'Se requiere el permiso de Cargar Datos para subir llamadas de salida' });
    }
    const b = req.body;
    if (!campaignAccess(req.actor, b.campana)) return sinAcceso(res);
    const resultado = cargarLlamadasSalida(db, {
      campana: b.campana,
      archivoNombre: b.archivoNombre || '',
      cargadoPorNombre: req.actor.nombre || '-',
      filas: b.filas,
    });
    logEvent(
      'LLAMADAS_SALIDA_CARGA',
      { nombre: `${resultado.insertadas} fila(s)`, user: '-', rol: b.campana },
      actorLabel(req.actor),
      `${resultado.desde} a ${resultado.hasta} (${resultado.borradas} reemplazada(s))`
    );
    res.status(201).json(resultado);
  })
);

module.exports = router;
