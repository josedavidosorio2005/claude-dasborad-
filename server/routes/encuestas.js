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
// Fase 158: cache de /opciones (ver cache-opciones.js).
const { opcionesConCache } = require('../cache-opciones');
const { requireActor, campaignAccess, canLoadModule, campanaDeCarga, canVerCalidadEncuestas, canEvaluateCampaign, puedeVerTelefono } = require('../auth');
const encMon = require('../encuesta-monitoreo'); // Fase 331
const { validate, schemas } = require('../validation');
const {
  impactoEncuestas,
  cargarEncuestas,
  encuestasOpciones,
  encuestasResumen,
  encuestasComentarios,
  encuestasFcrPorMes,
  filaArrayAObjeto,
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
    const incluirAgentes = puedeVerAsesores(req.actor, req.query.campana);
    res.json(opcionesConCache(db, JSON.stringify(['encuestas', req.query.campana, incluirAgentes]), () => encuestasOpciones(db, req.query.campana, { incluirAgentes })));
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
    if (!canLoadModule(req.actor, 'encuesta', campanaDeCarga(req))) {
      return res.status(403).json({ error: 'Se requiere el permiso de Cargar Datos para calcular el impacto de una carga' });
    }
    if (!campaignAccess(req.actor, req.body.campana)) return sinAcceso(res);
    const imp = impactoEncuestas(db, { campana: req.body.campana, filas: req.body.filas });
    // Fase 344: que pasaria con Calidad de encuestas (pendientes, resueltas y vinculos) -- solo conteos.
    imp.calidadEncuestas = encMon.impactoRecarga(db, { campana: req.body.campana, desde: imp.desde, hasta: imp.hasta, filasNuevas: req.body.filas.map(filaArrayAObjeto) });
    res.json(imp);
  })
);

router.post(
  '/calidad/encuestas/carga',
  requireActor,
  validate(schemas.encuestasCargaBody),
  wrap((req, res) => {
    if (!canLoadModule(req.actor, 'encuesta', campanaDeCarga(req))) {
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

// ══════════════════════════════════════════════════════════
// Fase 331: Calidad de encuestas (Mobilize). Llamadas con la encuesta mal
// calificada (reglas por pregunta en encuesta_monitoreo_reglas), una fila por
// CONN_ID, con su monitoreo si ya se califico. Solo quien tiene acceso al
// Modulo de Calidad de la campaña; nunca el ASESOR ni la cuenta de cliente.
// Fase 344: con el telefono (ANI) de la encuesta SOLO para quien puede verlo
// (puedeVerTelefono: CALIDAD, SUPERVISOR, Reportes, administrador). Gerencia y los
// lideres con el modulo ven la lista sin el.
// ══════════════════════════════════════════════════════════
function sinCalidadEncuestas(res) {
  return res.status(403).json({ error: 'Calidad de encuestas solo está disponible para el equipo de Calidad de la campaña' });
}

router.get(
  '/calidad/encuestas/monitoreo',
  requireActor,
  validate(schemas.encuestaMonitoreoQuery, 'query'),
  wrap((req, res) => {
    if (!canVerCalidadEncuestas(req.actor, req.query.campana)) return sinCalidadEncuestas(res);
    const verTelefono = puedeVerTelefono(req.actor);
    const r = encMon.listar(db, req.query, req.actor, { verTelefono });
    res.json(Object.assign(r, { verTelefono, activa: r.reglas.length > 0, puedeCalificar: canEvaluateCampaign(req.actor, req.query.campana), bloqueoMinutos: encMon.BLOQUEO_MS / 60000 }));
  })
);

// Contador de la pestaña (la alerta): solo el numero de pendientes.
router.get(
  '/calidad/encuestas/monitoreo/conteo',
  requireActor,
  validate(schemas.encuestasOpcionesQuery, 'query'),
  wrap((req, res) => {
    if (!canVerCalidadEncuestas(req.actor, req.query.campana)) return sinCalidadEncuestas(res);
    const activa = encMon.campanaTieneReglas(db, req.query.campana);
    res.json({ activa, pendientes: activa ? encMon.contarPendientes(db, req.query.campana) : 0 });
  })
);

// Abrir una llamada para calificarla (o renovar el bloqueo propio).
router.post(
  '/calidad/encuestas/monitoreo/bloqueo',
  requireActor,
  validate(schemas.encuestaMonitoreoBloqueoBody),
  wrap((req, res) => {
    const { campana, connId } = req.body;
    if (!canVerCalidadEncuestas(req.actor, campana)) return sinCalidadEncuestas(res);
    if (!canEvaluateCampaign(req.actor, campana)) return res.status(403).json({ error: 'No tiene permiso para calificar en esta campaña' });
    const r = encMon.bloquear(db, { campana, connId, actor: req.actor });
    if (!r.ok) return res.status(r.status).json({ error: r.error, bloqueadoPor: r.bloqueadoPor || null, resuelta: !!r.resuelta });
    if (r.llamada) {
      if (puedeVerTelefono(req.actor)) r.llamada.telefono = r.llamada.telefono || '';
      else delete r.llamada.telefono; // Fase 344
    }
    res.json(r);
  })
);

// Cancelar: libera el bloqueo propio.
router.post(
  '/calidad/encuestas/monitoreo/liberar',
  requireActor,
  validate(schemas.encuestaMonitoreoBloqueoBody),
  wrap((req, res) => {
    const { campana, connId } = req.body;
    if (!canVerCalidadEncuestas(req.actor, campana)) return sinCalidadEncuestas(res);
    const r = encMon.liberar(db, { campana, connId, actor: req.actor });
    if (!r.ok) return res.status(r.status).json({ error: r.error, bloqueadoPor: r.bloqueadoPor || null });
    res.json(r);
  })
);

module.exports = router;
