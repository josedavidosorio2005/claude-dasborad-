// routes/whatsapp-tiempos.js — ORLANT, WhatsApp: Nivel de Servicio por rangos
// de minutos (Fase 142, punto 4). Mismo patron que routes/llamadas-salida.js:
// el servidor nunca abre el Excel (recibe filas compactas ya parseadas en el
// navegador) y los GET devuelven agregados de SQL. Montado bajo '/calidad'
// para heredar el no-cache.
'use strict';
const express = require('express');
const db = require('../db');
const { requireActor, campaignAccess, canLoadData } = require('../auth');
const { validate, schemas } = require('../validation');
const {
  impactoWhatsappTiempos,
  cargarWhatsappTiempos,
  whatsappTiemposOpciones,
  whatsappTiemposRangos,
} = require('../whatsapp-tiempos');
const { wrap, logEvent, actorLabel } = require('./shared');

const router = express.Router();

function sinAcceso(res) {
  return res.status(403).json({ error: 'Sin acceso a los datos de esta campana' });
}

router.get(
  '/calidad/whatsapp-tiempos/opciones',
  requireActor,
  validate(schemas.whatsappTiemposOpcionesQuery, 'query'),
  wrap((req, res) => {
    if (!campaignAccess(req.actor, req.query.campana)) return sinAcceso(res);
    res.json(whatsappTiemposOpciones(db, req.query.campana));
  })
);

router.get(
  '/calidad/whatsapp-tiempos/rangos',
  requireActor,
  validate(schemas.whatsappTiemposRangosQuery, 'query'),
  wrap((req, res) => {
    if (!campaignAccess(req.actor, req.query.campana)) return sinAcceso(res);
    res.json(whatsappTiemposRangos(db, req.query));
  })
);

router.post(
  '/calidad/whatsapp-tiempos/carga/impacto',
  requireActor,
  validate(schemas.whatsappTiemposCargaBody),
  wrap((req, res) => {
    if (!canLoadData(req.actor)) {
      return res.status(403).json({ error: 'Se requiere el permiso de Cargar Datos para calcular el impacto de una carga' });
    }
    if (!campaignAccess(req.actor, req.body.campana)) return sinAcceso(res);
    res.json(impactoWhatsappTiempos(db, { campana: req.body.campana, filas: req.body.filas }));
  })
);

router.post(
  '/calidad/whatsapp-tiempos/carga',
  requireActor,
  validate(schemas.whatsappTiemposCargaBody),
  wrap((req, res) => {
    if (!canLoadData(req.actor)) {
      return res.status(403).json({ error: 'Se requiere el permiso de Cargar Datos para subir tiempos de WhatsApp' });
    }
    const b = req.body;
    if (!campaignAccess(req.actor, b.campana)) return sinAcceso(res);
    const resultado = cargarWhatsappTiempos(db, {
      campana: b.campana,
      archivoNombre: b.archivoNombre || '',
      cargadoPorNombre: req.actor.nombre || '-',
      filas: b.filas,
    });
    logEvent(
      'WHATSAPP_TIEMPOS_CARGA',
      { nombre: `${resultado.insertadas} fila(s)`, user: '-', rol: b.campana },
      actorLabel(req.actor),
      `${resultado.desde} a ${resultado.hasta} (${resultado.borradas} reemplazada(s))`
    );
    res.status(201).json(resultado);
  })
);

module.exports = router;
