// routes/orlant-sta.js — Fase STA (20/11/2026): «Gestión STA» de ORLANT (ver orlant-sta.js).
// Quién puede qué (pedido del usuario):
//  - GESTOR (supervisor de ORLANT, ADMIN, GERENCIA): todo — base, histórico de cargas (descargar y
//    eliminar), asignar / devolver / pasar, gráficas, gestiones y tipificaciones.
//  - ASESOR de ORLANT: SOLO sus casos (bandeja, codificar, volver a llamar, histórico, indicadores).
//  - CLIENTE de ORLANT (CLIENTES_DASH): /resumen (agregados) y /estado?vista=cliente (la visual de
//    «Gráficas» de Edwin, solo lectura, con los casos recortados: ver estadoCliente).
//  - Nadie más (403).
'use strict';
const express = require('express');
const db = require('../db');
const { requireActor, campaignAccess, isFullAdmin } = require('../auth');
const STA = require('../orlant-sta');
const { wrap, logEvent, actorLabel } = require('./shared');

const router = express.Router();
const BASE = '/orlant/sta';

function esGestor(actor) {
  if (!actor) return false;
  if (isFullAdmin(actor) || actor.rol === 'GERENCIA') return true;
  return actor.rol === 'SUPERVISOR' && campaignAccess(actor, STA.CAMPANA);
}
function esAsesorSta(actor) {
  return !!actor && actor.rol === 'ASESOR' && actor.asesorCampana === STA.CAMPANA && Number.isInteger(Number(actor.id));
}
function esClienteSta(actor) {
  return !!actor && actor.rol === 'CLIENTES_DASH' && campaignAccess(actor, STA.CAMPANA);
}
const soloGestor = (req, res, next) => (esGestor(req.actor) ? next() : res.status(403).json({ error: 'Solo el supervisor de ORLANT o un administrativo' }));
const soloAsesor = (req, res, next) => (esAsesorSta(req.actor) ? next() : res.status(403).json({ error: 'Solo los asesores de ORLANT' }));

// Errores de negocio (StaError) con su código; el resto sigue a wrap (500).
function h(fn) {
  return wrap(async (req, res) => {
    try { await fn(req, res); } catch (e) {
      if (e instanceof STA.StaError) return res.status(e.status).json({ error: e.message });
      throw e;
    }
  });
}
const log = (req, accion, detalle) => logEvent(accion, null, actorLabel(req.actor), detalle);

router.use(BASE, (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

// Qué ve quien pregunta: el navegador decide la vista con «vista».
router.get(BASE + '/estado', requireActor, h((req, res) => {
  // Pedido de Edwin (23/11/2026): la pestaña STA del Dashboard pide «vista=cliente» (solo «Gráficas»,
  // casos recortados). La ven el cliente de ORLANT y quienes gestionan el STA (mismo Dashboard).
  if (req.query.vista === 'cliente') {
    if (!esGestor(req.actor) && !esClienteSta(req.actor)) return res.status(403).json({ error: 'Sin acceso a las gráficas STA' });
    return res.json(Object.assign({ vista: 'cliente' }, STA.estadoCliente(db)));
  }
  if (esGestor(req.actor)) return res.json(Object.assign({ vista: 'supervisor' }, STA.estadoSupervisor(db)));
  if (esAsesorSta(req.actor)) return res.json(Object.assign({ vista: 'asesor', yo: { id: Number(req.actor.id), nombre: req.actor.nombre || '' } }, STA.estadoAsesor(db, req.actor.id)));
  return res.status(403).json({ error: 'Sin acceso a Gestión STA' });
}));

router.get(BASE + '/resumen', requireActor, h((req, res) => {
  if (!esGestor(req.actor) && !esClienteSta(req.actor)) return res.status(403).json({ error: 'Sin acceso al resumen STA' });
  res.json(STA.resumen(db));
}));

// ── Supervisor ──
router.post(BASE + '/cargas', requireActor, soloGestor, h((req, res) => {
  const b = req.body || {};
  const r = STA.cargar(db, { archivo: b.archivo, filas: b.filas, columnas: b.columnas, archivoB64: b.archivoB64, por: actorLabel(req.actor) });
  log(req, 'STA_CARGA', `${STA.CAMPANA} · ${r.leidas} filas: ${r.nuevos} nuevos, ${r.dup} ya existían, ${r.actEst} actualizados, ${r.sinNum} sin número`);
  res.json(r);
}));
router.get(BASE + '/cargas', requireActor, soloGestor, h((req, res) => res.json({ cargas: STA.cargas(db) })));
router.get(BASE + '/cargas/:id/archivo', requireActor, soloGestor, h((req, res) => {
  const a = STA.archivoDeCarga(db, req.params.id);
  res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.set('Content-Disposition', 'attachment; filename*=UTF-8\'\'' + encodeURIComponent(a.nombre));
  res.send(a.contenido);
}));
router.delete(BASE + '/cargas/:id', requireActor, soloGestor, h((req, res) => {
  const r = STA.borrarCarga(db, req.params.id, req.query.conservar === '1');
  log(req, 'STA_CARGA_ELIMINAR', `${STA.CAMPANA} · carga ${Number(req.params.id)}: ${r.eliminados} casos eliminados, ${r.conservados} gestionados conservados`);
  res.json(r);
}));
router.post(BASE + '/asignar', requireActor, soloGestor, h((req, res) => {
  const b = req.body || {};
  const r = STA.asignar(db, { agenteId: b.agenteId, cantidad: b.cantidad, filtros: b.filtros });
  log(req, 'STA_ASIGNAR', `${STA.CAMPANA} · ${r.asignados} de ${r.pedidos} pedidos (${r.disponibles} disponibles) al asesor ${Number(b.agenteId)}`);
  res.json(r);
}));
router.post(BASE + '/devolver', requireActor, soloGestor, h((req, res) => {
  const b = req.body || {};
  const r = STA.devolver(db, { agenteId: b.agenteId, cantidad: b.cantidad, numeros: b.numeros });
  log(req, 'STA_DEVOLVER', `${STA.CAMPANA} · ${r.devueltos} casos del asesor ${Number(b.agenteId)} a libres`);
  res.json(r);
}));
// Pedido de Edwin (23/11/2026): regresar gestionados a disponibles (por codificación o marcados).
router.post(BASE + '/gestionados/regresar', requireActor, soloGestor, h((req, res) => {
  const b = req.body || {};
  const r = STA.regresarGestionados(db, { tipi: b.tipi, numeros: b.numeros, por: actorLabel(req.actor) });
  log(req, 'STA_REGRESAR', `${STA.CAMPANA} · ${r.regresados} gestionados regresados a disponibles · ` + (Array.isArray(b.numeros) ? 'marcados uno a uno' : 'codificación «' + String(b.tipi).slice(0, 80) + '»'));
  res.json(r);
}));
router.post(BASE + '/pasar', requireActor, soloGestor, h((req, res) => {
  const b = req.body || {};
  const r = STA.pasar(db, { agenteId: b.agenteId, destinoId: b.destinoId, cantidad: b.cantidad, numeros: b.numeros });
  log(req, 'STA_PASAR', `${STA.CAMPANA} · ${r.pasados} casos del asesor ${Number(b.agenteId)} al ${Number(b.destinoId)}`);
  res.json(r);
}));
router.put(BASE + '/config/tipis', requireActor, soloGestor, h((req, res) => {
  const c = STA.cambiarTipis(db, req.body);
  log(req, 'STA_TIPIS', `${STA.CAMPANA} · ${c.tipis.length} tipificaciones, ${c.efectivas.length} efectivas`);
  res.json(c);
}));

// ── Asesor ──
router.post(BASE + '/casos/:numero/codificar', requireActor, soloAsesor, h((req, res) => {
  res.json({ caso: STA.codificar(db, req.actor.id, req.params.numero, req.body) });
}));
router.post(BASE + '/casos/:numero/rellamada', requireActor, soloAsesor, h((req, res) => {
  res.json(STA.avisoRellamada(db, req.actor.id, req.params.numero, (req.body || {}).accion));
}));

module.exports = router;
module.exports.esGestor = esGestor;
module.exports.esAsesorSta = esAsesorSta;
module.exports.esClienteSta = esClienteSta;
