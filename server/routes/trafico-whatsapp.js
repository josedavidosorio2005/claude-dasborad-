// routes/trafico-whatsapp.js — Trafico de WhatsApp (Fase 50, plantilla real
// confirmada por Edwin). Mismo patron que routes/trafico.js (voz): el
// servidor NUNCA abre el Excel, solo recibe filas ya parseadas en el
// navegador (public/js/trafico-whatsapp-logic.js). A diferencia de voz, aqui
// SI se manda `campana` explicito (alcance actual: solo ORLANT, sin
// ambiguedad de a que campana pertenece cada cola -- no hace falta el
// mapeo cola->campana que voz necesita para sus varias campanas).
//
// Montado bajo el mismo prefijo '/calidad/trafico/whatsapp' para heredar el
// middleware de no-cache de '/calidad' (ver routes/trafico.js, nota de
// orden de montaje) -- se monta en server.js DESPUES de routes/calidad.
const path = require('path');
const express = require('express');
const db = require('../db');
const { requireActor, campaignAccess, canLoadData } = require('../auth');
const { validate, schemas } = require('../validation');
const { cargarTraficoWhatsapp } = require('../trafico-whatsapp');
const { wrap, logEvent, actorLabel } = require('./shared');

const router = express.Router();

function toTraficoWppRow(row) {
  return {
    campana: row.campana,
    colaWhatsapp: row.colaWhatsapp,
    fechaInicio: row.fechaInicio,
    fechaFin: row.fechaFin,
    totalWhatsapp: row.totalWhatsapp,
    contestados: row.contestados,
    abandonados: row.abandonados,
    serviceLevel10secPct: row.serviceLevel10secPct,
    serviceLevel20secPct: row.serviceLevel20secPct,
    serviceLevel30secPct: row.serviceLevel30secPct,
    asaSegundos: row.asaSegundos,
    ataSegundos: row.ataSegundos,
    ahtSegundos: row.ahtSegundos,
  };
}

// Plantilla oficial de Trafico de WhatsApp (una sola, ORLANT por ahora).
// Sirve el ARCHIVO REAL guardado en server/plantillas/ tal cual, nunca lo
// regenera con codigo -- mismo criterio que PLANTILLA_TRAFICO_PATH en
// routes/trafico.js.
const PLANTILLA_TRAFICO_WPP_PATH = path.join(__dirname, '..', 'plantillas', 'PLANTILLA_TRAFICO_WHATSAPP_INCONEXION_VACIA.xlsx');
router.get(
  '/calidad/trafico/whatsapp/plantilla',
  requireActor,
  wrap((req, res) => {
    if (!canLoadData(req.actor)) {
      return res.status(403).json({ error: 'Se requiere el permiso de Cargar Datos para descargar la plantilla' });
    }
    res.download(PLANTILLA_TRAFICO_WPP_PATH, 'PLANTILLA_TRAFICO_WHATSAPP_INCONEXION_VACIA.xlsx', (err) => {
      if (err && !res.headersSent) {
        res.status(500).json({ error: 'No se pudo leer la plantilla en el servidor' });
      }
    });
  })
);

// Filas crudas para el panel del dashboard (el agregado/resumen por periodo
// lo hace el navegador -- public/js/trafico-whatsapp-logic.js).
router.get(
  '/calidad/trafico/whatsapp',
  requireActor,
  wrap((req, res) => {
    const campana = req.query.campana;
    if (!campana) return res.status(400).json({ error: 'Indica una campana' });
    if (!campaignAccess(req.actor, campana)) {
      return res.status(403).json({ error: 'Sin acceso a los datos de esta campana' });
    }
    const rows = db
      .prepare('SELECT * FROM trafico_whatsapp WHERE campana = ? ORDER BY fechaInicio, colaWhatsapp')
      .all(campana);
    res.json(rows.map(toTraficoWppRow));
  })
);

router.post(
  '/calidad/trafico/whatsapp/carga',
  requireActor,
  validate(schemas.traficoWppCargaBody),
  wrap((req, res) => {
    if (!canLoadData(req.actor)) {
      return res.status(403).json({ error: 'Se requiere el permiso de Cargar Datos para subir trafico de WhatsApp' });
    }
    const b = req.body;
    if (!campaignAccess(req.actor, b.campana)) {
      return res.status(403).json({ error: 'Sin acceso a los datos de esta campana' });
    }
    const resultado = cargarTraficoWhatsapp(db, {
      campana: b.campana,
      archivoNombre: b.archivoNombre || '',
      cargadoPorNombre: req.actor.nombre || '-',
      filas: b.filas,
    });
    logEvent(
      'TRAFICO_WHATSAPP_CARGA',
      { nombre: `${resultado.insertadas} fila(s)`, user: '-', rol: b.campana },
      actorLabel(req.actor),
      `${resultado.colas.length} cola(s): ${resultado.colas.join(', ')}`
    );
    res.status(201).json(resultado);
  })
);

module.exports = router;
