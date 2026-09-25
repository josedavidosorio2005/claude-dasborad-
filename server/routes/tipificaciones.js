// routes/tipificaciones.js — Tipificacion de ORLANT (Fase 77, pedido de
// Edwin/Jairo). Mismo patron que routes/agendas.js: el servidor NUNCA abre
// el Excel, solo recibe filas ya parseadas desde el navegador, y el
// dashboard NUNCA descarga filas crudas -- todos los GET de lectura
// devuelven agregados ya calculados en SQL (tipificaciones.js), nunca la
// tabla completa (~15.000 filas/mes solo Llamadas).
//
// Montado bajo '/calidad/tipificacion' para heredar el middleware de
// no-cache de '/calidad' (mismo motivo que routes/agendas.js) -- se monta
// en server.js despues de routes/agendas. El limite de tamano de body mas
// grande para /carga y /carga/impacto vive en server.js (Fase 77, ver
// RUTAS_TIPIFICACION_LIMITE_MAYOR), no aqui.
const express = require('express');
const db = require('../db');
const { requireActor, campaignAccess, canLoadData } = require('../auth');
const { validate, schemas } = require('../validation');
const {
  impactoTipificaciones,
  cargarTipificaciones,
  tipificacionesPorTipo,
  tipificacionesOpciones,
} = require('../tipificaciones');
const { wrap, logEvent, actorLabel } = require('./shared');

const router = express.Router();

// Valores distintos para los filtros (Agente, Skill) + si hay datos
// (meses.length) para ESTE canal -- lo usa el panel para pintar los
// desplegables y para el mensaje "Sin datos de X cargados para este
// periodo" cuando un canal esta vacio.
router.get(
  '/calidad/tipificacion/opciones',
  requireActor,
  validate(schemas.tipificacionOpcionesQuery, 'query'),
  wrap((req, res) => {
    if (!campaignAccess(req.actor, req.query.campana)) {
      return res.status(403).json({ error: 'Sin acceso a los datos de esta campana' });
    }
    res.json(tipificacionesOpciones(db, req.query.campana, req.query.canal));
  })
);

// Grafica: conteo por tipificacion, ya agrupado top10+Otras (respeta todos
// los filtros: mes/rango + agente/skill).
router.get(
  '/calidad/tipificacion/por-tipo',
  requireActor,
  validate(schemas.tipificacionFiltrosQuery, 'query'),
  wrap((req, res) => {
    if (!campaignAccess(req.actor, req.query.campana)) {
      return res.status(403).json({ error: 'Sin acceso a los datos de esta campana' });
    }
    res.json(tipificacionesPorTipo(db, req.query));
  })
);

// Impacto de una carga ANTES de guardarla (no escribe nada): cuenta cuantas
// filas de ESTE canal ya existen en el rango [primera..ultima fecha] del
// archivo que se esta por subir.
router.post(
  '/calidad/tipificacion/carga/impacto',
  requireActor,
  validate(schemas.tipificacionCargaBody),
  wrap((req, res) => {
    if (!canLoadData(req.actor)) {
      return res.status(403).json({ error: 'Se requiere el permiso de Cargar Datos para calcular el impacto de una carga' });
    }
    const b = req.body;
    if (!campaignAccess(req.actor, b.campana)) {
      return res.status(403).json({ error: 'Sin acceso a los datos de esta campana' });
    }
    res.json(impactoTipificaciones(db, { campana: b.campana, canal: b.canal, filas: b.filas }));
  })
);

router.post(
  '/calidad/tipificacion/carga',
  requireActor,
  validate(schemas.tipificacionCargaBody),
  wrap((req, res) => {
    if (!canLoadData(req.actor)) {
      return res.status(403).json({ error: 'Se requiere el permiso de Cargar Datos para subir tipificacion' });
    }
    const b = req.body;
    if (!campaignAccess(req.actor, b.campana)) {
      return res.status(403).json({ error: 'Sin acceso a los datos de esta campana' });
    }
    const resultado = cargarTipificaciones(db, {
      campana: b.campana,
      canal: b.canal,
      archivoNombre: b.archivoNombre || '',
      cargadoPorNombre: req.actor.nombre || '-',
      filas: b.filas,
    });
    logEvent(
      'TIPIFICACION_CARGA',
      { nombre: `${resultado.insertadas} fila(s) (${b.canal})`, user: '-', rol: b.campana },
      actorLabel(req.actor),
      `${resultado.desde} a ${resultado.hasta} (${resultado.borradas} reemplazada(s))`
    );
    res.status(201).json(resultado);
  })
);

module.exports = router;
