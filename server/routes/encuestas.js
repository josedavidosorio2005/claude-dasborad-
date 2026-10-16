// routes/encuestas.js — Mobilize, Encuesta de satisfaccion (Fase 147,
// Parte B). Mismo patron que routes/whatsapp-tiempos.js: el servidor nunca
// abre el Excel (recibe filas compactas ya parseadas en el navegador) y los
// GET devuelven agregados de SQL (mas la lista de comentarios con texto).
//
// Nombres de asesor: misma regla que Llamadas de salida (puedeVerAsesores,
// "OK nombres para cliente" de la Fase 147): roles internos, y el cliente de
// las campañas con asesorVisibleCliente en el registro de clientes (hoy solo MOBILIZE).
// Siempre DESPUES de campaignAccess. Montado bajo '/calidad' para heredar el
// no-cache.
'use strict';
const express = require('express');
const db = require('../db');
const { requireActor, campaignAccess, canLoadData } = require('../auth');
const { validate, schemas } = require('../validation');
const {
  impactoEncuestas,
  cargarEncuestas,
  encuestasOpciones,
  encuestasResumen,
  encuestasComentarios,
  encuestasFcrPorMes,
} = require('../encuestas');
const { puedeVerAsesores } = require('./llamadas-salida');
const { wrap, logEvent, actorLabel } = require('./shared');

const router = express.Router();

function sinAcceso(res) {
  return res.status(403).json({ error: 'Sin acceso a los datos de esta campana' });
}
function soloInternos(res) {
  return res.status(403).json({ error: 'El filtro y el detalle por asesor no estan disponibles para este rol' });
}

router.get(
  '/calidad/encuestas/opciones',
  requireActor,
  validate(schemas.encuestasOpcionesQuery, 'query'),
  wrap((req, res) => {
    if (!campaignAccess(req.actor, req.query.campana)) return sinAcceso(res);
    res.json(encuestasOpciones(db, req.query.campana, { incluirAgentes: puedeVerAsesores(req.actor, req.query.campana) }));
  })
);

router.get(
  '/calidad/encuestas/resumen',
  requireActor,
  validate(schemas.encuestasFiltrosQuery, 'query'),
  wrap((req, res) => {
    if (!campaignAccess(req.actor, req.query.campana)) return sinAcceso(res);
    if (req.query.agente && !puedeVerAsesores(req.actor, req.query.campana)) return soloInternos(res);
    res.json(encuestasResumen(db, req.query));
  })
);

router.get(
  '/calidad/encuestas/comentarios',
  requireActor,
  validate(schemas.encuestasFiltrosQuery, 'query'),
  wrap((req, res) => {
    if (!campaignAccess(req.actor, req.query.campana)) return sinAcceso(res);
    const ver = puedeVerAsesores(req.actor, req.query.campana);
    if (req.query.agente && !ver) return soloInternos(res);
    res.json(encuestasComentarios(db, req.query, { incluirAgentes: ver }));
  })
);

// Parte C: FCR por mes (Flujo de Llamadas). Sin nombres.
router.get(
  '/calidad/encuestas/fcr',
  requireActor,
  validate(schemas.encuestasFcrQuery, 'query'),
  wrap((req, res) => {
    if (!campaignAccess(req.actor, req.query.campana)) return sinAcceso(res);
    res.json(encuestasFcrPorMes(db, req.query));
  })
);

router.post(
  '/calidad/encuestas/carga/impacto',
  requireActor,
  validate(schemas.encuestasCargaBody),
  wrap((req, res) => {
    if (!canLoadData(req.actor)) {
      return res.status(403).json({ error: 'Se requiere el permiso de Cargar Datos para calcular el impacto de una carga' });
    }
    if (!campaignAccess(req.actor, req.body.campana)) return sinAcceso(res);
    res.json(impactoEncuestas(db, { campana: req.body.campana, filas: req.body.filas }));
  })
);

router.post(
  '/calidad/encuestas/carga',
  requireActor,
  validate(schemas.encuestasCargaBody),
  wrap((req, res) => {
    if (!canLoadData(req.actor)) {
      return res.status(403).json({ error: 'Se requiere el permiso de Cargar Datos para subir encuestas' });
    }
    const b = req.body;
    if (!campaignAccess(req.actor, b.campana)) return sinAcceso(res);
    const resultado = cargarEncuestas(db, {
      campana: b.campana,
      archivoNombre: b.archivoNombre || '',
      cargadoPorNombre: req.actor.nombre || '-',
      filas: b.filas,
    });
    logEvent(
      'ENCUESTAS_CARGA',
      { nombre: `${resultado.insertadas} fila(s)`, user: '-', rol: b.campana },
      actorLabel(req.actor),
      `${resultado.desde} a ${resultado.hasta} (${resultado.borradas} reemplazada(s))`
    );
    res.status(201).json(resultado);
  })
);

module.exports = router;
