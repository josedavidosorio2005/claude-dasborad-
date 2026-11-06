// routes/errores.js — Fase 284: pestaña «Errores» (errores de agendamiento).
//  - Leer (la pestaña): quien tiene acceso al cliente, tambien la cuenta del cliente.
//  - Agregar / editar / borrar errores y escribir el «Plan de acción» del mes: el
//    administrador o el SUPERVISOR de ese cliente. Nunca la cuenta del cliente.
//  - Solo clientes con el modulo `errores` en el registro (hoy CLINICA AURORA).
// Cada cambio queda en el historial (quien y que), sin el texto de la observacion.
'use strict';
const express = require('express');
const db = require('../db');
const { requireActor, isFullAdmin, campaignAccess } = require('../auth');
const { validate, schemas } = require('../validation');
const errores = require('../errores');
const { leerRegistro } = require('../clientes-registro');
const { wrap, nowStr, actorLabel, logEvent } = require('./shared');

const router = express.Router();
router.use('/calidad/errores', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

function tieneModulo(campana) {
  const c = leerRegistro(db).find((x) => x.nombre === campana);
  return !!(c && (c.modulos || []).includes('errores'));
}
function puedeVer(actor, campana) { return isFullAdmin(actor) || campaignAccess(actor, campana); }
function puedeEditar(actor, campana) { return isFullAdmin(actor) || (actor && actor.rol === 'SUPERVISOR' && campaignAccess(actor, campana)); }
// Primero el acceso (403) y despues el modulo (404): quien no tiene acceso no se entera
// de que clientes tienen la pestaña.
function guardiaLectura(req, res, campana) {
  if (!puedeVer(req.actor, campana)) { res.status(403).json({ error: 'Sin acceso a este cliente' }); return false; }
  if (!tieneModulo(campana)) { res.status(404).json({ error: 'Este cliente no tiene la pestaña Errores' }); return false; }
  return true;
}
function guardiaEscritura(req, res, campana) {
  if (!puedeEditar(req.actor, campana)) { res.status(403).json({ error: 'Solo el supervisor del cliente o el administrador registra errores' }); return false; }
  if (!tieneModulo(campana)) { res.status(404).json({ error: 'Este cliente no tiene la pestaña Errores' }); return false; }
  return true;
}
const detalleLog = (f) => `mes ${f.mes}, asesora "${f.asesor}", cantidad ${f.cantidad}`;

router.get('/calidad/errores', requireActor, validate(schemas.erroresQuery, 'query'), wrap((req, res) => {
  const { campana } = req.query;
  if (!guardiaLectura(req, res, campana)) return;
  res.json({ ...errores.resumen(db, campana), puedeEditar: puedeEditar(req.actor, campana) });
}));

router.get('/calidad/errores/asesoras', requireActor, validate(schemas.erroresQuery, 'query'), wrap((req, res) => {
  const { campana } = req.query;
  if (!guardiaEscritura(req, res, campana)) return;
  res.json({ asesoras: errores.asesorasDe(db, campana) });
}));

router.post('/calidad/errores', requireActor, validate(schemas.errorCrearBody), wrap((req, res) => {
  const b = req.body;
  if (!guardiaEscritura(req, res, b.campana)) return;
  const r = errores.crear(db, b.campana, b, req.actor, nowStr());
  if (r.error) return res.status(400).json({ error: r.error });
  logEvent('ERROR_AGENDAMIENTO_CREADO', { nombre: r.fila.asesor, user: '-', rol: b.campana }, actorLabel(req.actor), detalleLog(r.fila));
  res.status(201).json(r.fila);
}));

router.put('/calidad/errores/plan', requireActor, validate(schemas.errorPlanBody), wrap((req, res) => {
  const b = req.body;
  if (!guardiaEscritura(req, res, b.campana)) return;
  const r = errores.guardarPlan(db, b.campana, b.mes, b.texto, req.actor, nowStr());
  if (r.error) return res.status(400).json({ error: r.error });
  logEvent('ERRORES_PLAN_ACCION', { nombre: b.mes, user: '-', rol: b.campana }, actorLabel(req.actor), r.borrado ? `plan de ${b.mes} borrado` : `plan de ${b.mes} guardado`);
  res.json(r.plan || { campana: b.campana, mes: b.mes, texto: '' });
}));

router.put('/calidad/errores/:id', requireActor, validate(schemas.idParamSchema, 'params'), validate(schemas.errorEditarBody), wrap((req, res) => {
  const actual = db.prepare('SELECT campana FROM errores_agendamiento WHERE id = ?').get(req.params.id);
  if (!actual) return res.status(404).json({ error: 'Error no encontrado' });
  if (!guardiaEscritura(req, res, actual.campana)) return;
  const r = errores.editar(db, req.params.id, req.body, req.actor, nowStr());
  if (r.error) return res.status(400).json({ error: r.error });
  logEvent('ERROR_AGENDAMIENTO_EDITADO', { nombre: r.fila.asesor, user: '-', rol: actual.campana }, actorLabel(req.actor), detalleLog(r.antes) + ' -> ' + detalleLog(r.fila));
  res.json(r.fila);
}));

router.delete('/calidad/errores/:id', requireActor, validate(schemas.idParamSchema, 'params'), wrap((req, res) => {
  const actual = db.prepare('SELECT campana FROM errores_agendamiento WHERE id = ?').get(req.params.id);
  if (!actual) return res.status(404).json({ error: 'Error no encontrado' });
  if (!guardiaEscritura(req, res, actual.campana)) return;
  const r = errores.borrar(db, req.params.id);
  logEvent('ERROR_AGENDAMIENTO_BORRADO', { nombre: r.fila.asesor, user: '-', rol: actual.campana }, actorLabel(req.actor), detalleLog(r.fila));
  res.json({ ok: true });
}));

module.exports = router;
