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
// Fase 347 (B3, pedido del usuario 12/11): borrar un error queda solo para el administrador y
// Reportes con acceso al cliente; el supervisor registra y edita, pero ya no borra.
function puedeBorrar(actor, campana) { return isFullAdmin(actor) || (!!actor && actor.rol === 'REPORTES' && campaignAccess(actor, campana)); }
// Fase 352 (D): borrar el plan de accion del mes, mismo permiso que borrar un error.
const MSG_BORRAR_PLAN = 'Solo el administrador o Reportes pueden borrar el plan de acción';
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
  res.json({ ...errores.resumen(db, campana), puedeEditar: puedeEditar(req.actor, campana), puedeBorrar: puedeBorrar(req.actor, campana) });
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

// Fase 286: un solo «Guardar» — el error (nuevo o editado) y el plan de accion del mes
// en una sola transaccion. Mismo permiso y mismo historial que las rutas de abajo.
router.post('/calidad/errores/guardar', requireActor, validate(schemas.errorGuardarBody), wrap((req, res) => {
  const b = req.body;
  if (!guardiaEscritura(req, res, b.campana)) return;
  if (b.plan !== undefined && !String(b.plan || '').trim() && !puedeBorrar(req.actor, b.campana)) return res.status(403).json({ error: MSG_BORRAR_PLAN }); // Fase 352 (D)
  const r = errores.guardarJunto(db, b.campana, b, req.actor, nowStr());
  if (r.noExiste) return res.status(404).json({ error: 'Error no encontrado' });
  if (r.error) return res.status(400).json({ error: r.error });
  if (r.creado) logEvent('ERROR_AGENDAMIENTO_CREADO', { nombre: r.creado.fila.asesor, user: '-', rol: b.campana }, actorLabel(req.actor), detalleLog(r.creado.fila));
  if (r.edicion) logEvent('ERROR_AGENDAMIENTO_EDITADO', { nombre: r.edicion.fila.asesor, user: '-', rol: b.campana }, actorLabel(req.actor), detalleLog(r.edicion.antes) + ' -> ' + detalleLog(r.edicion.fila));
  if (r.plan) logEvent('ERRORES_PLAN_ACCION', { nombre: b.mes, user: '-', rol: b.campana }, actorLabel(req.actor), r.plan.borrado ? `plan de ${b.mes} borrado` : `plan de ${b.mes} guardado`);
  res.json({ ok: true, registro: r.creado ? r.creado.fila : (r.edicion ? r.edicion.fila : null), plan: r.plan ? (r.plan.plan || null) : undefined });
}));

// Fase 352 (D, reunion con Edwin del 13/11): el plan de accion del mes es aparte de los errores
// («Plan de acción del mes»). Mismos permisos que Errores: el supervisor y el administrador lo
// escriben y lo editan; borrarlo (dejarlo vacio) queda para el administrador y Reportes.
router.put('/calidad/errores/plan', requireActor, validate(schemas.errorPlanBody), wrap((req, res) => {
  const b = req.body;
  if (!guardiaEscritura(req, res, b.campana)) return;
  if (!String(b.texto || '').trim() && !puedeBorrar(req.actor, b.campana)) return res.status(403).json({ error: MSG_BORRAR_PLAN });
  const r = errores.guardarPlan(db, b.campana, b.mes, b.texto, req.actor, nowStr());
  if (r.error) return res.status(400).json({ error: r.error });
  logEvent('ERRORES_PLAN_ACCION', { nombre: b.mes, user: '-', rol: b.campana }, actorLabel(req.actor), r.borrado ? `plan de ${b.mes} borrado` : `plan de ${b.mes} guardado`);
  res.json(r.plan || { campana: b.campana, mes: b.mes, texto: '' });
}));

router.delete('/calidad/errores/plan', requireActor, validate(schemas.errorPlanBorrarQuery, 'query'), wrap((req, res) => {
  const { campana, mes } = req.query;
  if (!puedeBorrar(req.actor, campana)) return res.status(403).json({ error: MSG_BORRAR_PLAN });
  if (!tieneModulo(campana)) return res.status(404).json({ error: 'Este cliente no tiene la pestaña Errores' });
  const r = errores.guardarPlan(db, campana, mes, '', req.actor, nowStr());
  if (r.error) return res.status(400).json({ error: r.error });
  logEvent('ERRORES_PLAN_ACCION', { nombre: mes, user: '-', rol: campana }, actorLabel(req.actor), 'plan de ' + mes + ' borrado');
  res.json({ ok: true, borrado: true });
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
  if (!puedeBorrar(req.actor, actual.campana)) return res.status(403).json({ error: 'Solo el administrador o Reportes pueden borrar errores' }); // Fase 347
  if (!tieneModulo(actual.campana)) return res.status(404).json({ error: 'Este cliente no tiene la pestaña Errores' });
  const r = errores.borrar(db, req.params.id);
  logEvent('ERROR_AGENDAMIENTO_BORRADO', { nombre: r.fila.asesor, user: '-', rol: actual.campana }, actorLabel(req.actor), detalleLog(r.fila));
  res.json({ ok: true });
}));

module.exports = router;
