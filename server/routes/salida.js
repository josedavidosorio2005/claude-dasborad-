// routes/salida.js — Llamadas y WhatsApp de Salida de ORLANT (Fase 127,
// pedido textual de Edwin). Mismo patron que routes/efectividad-citas.js:
// el servidor NUNCA abre el Excel, solo recibe filas ya parseadas (y con
// el año YA resuelto, ver salida-logic.js) desde el navegador.
//
// Montado bajo '/calidad/salida' para heredar el middleware de no-cache
// de '/calidad' -- se monta en server.js despues de routes/efectividad-citas.
const express = require('express');
const db = require('../db');
// Fase 158: cache de /opciones (ver cache-opciones.js).
const { opcionesConCache } = require('../cache-opciones');
const { requireActor, campaignAccess, canLoadModule, isFullAdmin } = require('../auth');
const { asesoresSalidaDelMes, guardarLineasDelMes } = require('../salida-cdr');
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
    res.json(opcionesConCache(db, JSON.stringify(['salida', req.query.campana]), () => salidaOpciones(db, req.query.campana)));
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
    if (!canLoadModule(req.actor, 'salida')) {
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
    if (!canLoadModule(req.actor, 'salida')) {
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

// Fase 170: asesores con salidas en un mes (del CDR) y su linea 3P/General.
// Lo ve quien ve la campana; solo un administrador lo cambia.
router.get(
  '/calidad/salida/asesores',
  requireActor,
  validate(schemas.salidaAsesoresQuery, 'query'),
  wrap((req, res) => {
    if (!campaignAccess(req.actor, req.query.campana)) {
      return res.status(403).json({ error: 'Sin acceso a los datos de esta campana' });
    }
    res.json({ campana: req.query.campana, mes: req.query.mes, asesores: asesoresSalidaDelMes(db, req.query.campana, req.query.mes) });
  })
);

router.put(
  '/calidad/salida/asesores',
  requireActor,
  validate(schemas.salidaAsesoresBody),
  wrap((req, res) => {
    if (!isFullAdmin(req.actor)) {
      return res.status(403).json({ error: 'Solo un administrador puede asignar la línea de los asesores' });
    }
    const b = req.body;
    if (!campaignAccess(req.actor, b.campana)) {
      return res.status(403).json({ error: 'Sin acceso a los datos de esta campana' });
    }
    const r = guardarLineasDelMes(db, { campana: b.campana, mes: b.mes, asignaciones: b.asignaciones, guardadoPorNombre: actorLabel(req.actor) });
    const n3p = b.asignaciones.filter((a) => a.linea === '3P').length;
    const nGen = b.asignaciones.filter((a) => a.linea === 'GENERAL').length;
    logEvent('SALIDA_LINEAS_ASESOR', { nombre: b.campana, user: '-', rol: 'salida' }, actorLabel(req.actor),
      b.mes + ': ' + n3p + ' asesor(es) en 3P, ' + nGen + ' en General, ' + (b.asignaciones.length - n3p - nGen) + ' sin asignar');
    res.json({ ...r, asesores: asesoresSalidaDelMes(db, b.campana, b.mes) });
  })
);

module.exports = router;
