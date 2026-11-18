// routes/activos.js — Fase 369 (E1): «Inventario de sistemas». Solo ADMIN y SISTEMAS. Cada cambio
// queda en el historial del elemento y en el Historial general (sin datos personales). Sin caché.
'use strict';
const express = require('express');
const db = require('../db');
const { requireActor } = require('../auth');
const A = require('../activos');
const { wrap, actorLabel, logEvent } = require('./shared');

const router = express.Router();
router.use('/activos', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
function permitido(req, res) {
  if (!A.puede(req.actor)) { res.status(403).json({ error: 'Solo Sistemas o el administrador' }); return false; }
  return true;
}
const idValido = (v) => /^[1-9]\d{0,9}$/.test(String(v));
const log = (accion, a, req, detalle) => logEvent(accion, { nombre: a ? a.tipo + ' ' + a.codigo : '-', user: '-', rol: 'activos' }, actorLabel(req.actor), detalle || '');

router.get('/activos/config', requireActor, wrap((req, res) => {
  if (!permitido(req, res)) return;
  res.json({ estados: A.ESTADOS, tipos: A.tipos(db), listas: Object.fromEntries(Object.keys(A.LISTAS).map((k) => [k, A.lista(db, k)])) });
}));
router.get('/activos/resumen', requireActor, wrap((req, res) => {
  if (!permitido(req, res)) return;
  res.json(A.resumen(db));
}));
router.get('/activos', requireActor, wrap((req, res) => {
  if (!permitido(req, res)) return;
  const q = {};
  for (const k of ['tipo', 'estado', 'sede', 'q']) if (typeof req.query[k] === 'string' && req.query[k].trim()) q[k] = req.query[k].trim();
  res.json({ activos: A.listar(db, q) });
}));
router.post('/activos', requireActor, wrap((req, res) => {
  if (!permitido(req, res)) return;
  const v = A.validar(db, req.body, { nuevo: true });
  if (v.error) return res.status(400).json({ error: v.error });
  const r = A.crear(db, v.valores, actorLabel(req.actor));
  if (r.error) return res.status(r.status || 400).json({ error: r.error });
  log('ACTIVO_INGRESO', r.activo, req, 'estado ' + r.activo.estado);
  res.status(201).json(r);
}));
router.put('/activos/:id', requireActor, wrap((req, res) => {
  if (!permitido(req, res)) return;
  const a = idValido(req.params.id) ? A.obtener(db, Number(req.params.id)) : null;
  if (!a) return res.status(404).json({ error: 'Elemento no encontrado' });
  const b = req.body || {};
  if ('tipo' in b || 'codigo' in b || 'estado' in b) return res.status(400).json({ error: 'El tipo, el código y el estado no se editan aquí' });
  const v = A.validar(db, b, { nuevo: false, tipo: a.tipo });
  if (v.error) return res.status(400).json({ error: v.error });
  const n = A.editar(db, a, v.valores, actorLabel(req.actor));
  log('ACTIVO_EDICION', n, req);
  res.json({ activo: n });
}));
router.post('/activos/:id/estado', requireActor, wrap((req, res) => {
  if (!permitido(req, res)) return;
  const a = idValido(req.params.id) ? A.obtener(db, Number(req.params.id)) : null;
  if (!a) return res.status(404).json({ error: 'Elemento no encontrado' });
  const b = req.body || {};
  const r = A.cambiarEstado(db, a, b.estado, b.motivo, actorLabel(req.actor));
  if (r.error) return res.status(400).json({ error: r.error });
  log('ACTIVO_ESTADO', r.activo, req, a.estado + ' → ' + r.activo.estado);
  res.json(r);
}));
router.get('/activos/:id/historial', requireActor, wrap((req, res) => {
  if (!permitido(req, res)) return;
  const a = idValido(req.params.id) ? A.obtener(db, Number(req.params.id)) : null;
  if (!a) return res.status(404).json({ error: 'Elemento no encontrado' });
  res.json({ activo: a, historial: A.historial(db, a.id) });
}));
router.put('/activos/listas/:lista', requireActor, wrap((req, res) => {
  if (!permitido(req, res)) return;
  const nombre = String(req.params.lista || '');
  if (!Object.prototype.hasOwnProperty.call(A.LISTAS, nombre)) return res.status(404).json({ error: 'Lista no encontrada' });
  const b = req.body || {};
  if (!Array.isArray(b.valores) || b.valores.length > 200 || !b.valores.every((v) => typeof v === 'string' && v.trim().length >= 1 && v.trim().length <= 120)) return res.status(400).json({ error: 'Escribe un valor por línea (hasta 200, de 1 a 120 caracteres)' });
  const valores = [...new Set(b.valores.map((v) => v.trim()))];
  const r = A.guardarLista(db, nombre, valores);
  logEvent('ACTIVO_LISTA', { nombre: A.LISTAS[nombre], user: '-', rol: 'activos' }, actorLabel(req.actor), r.length + ' valor(es)');
  res.json({ lista: nombre, valores: r });
}));

// ── Fase 370 (E2): agentes y asignación por elemento. El Historial general solo lleva el id del
// agente (sin nombre ni documento); el historial del elemento sí dice a quién se asignó.
const logAg = (accion, g, req, detalle) => logEvent(accion, { nombre: 'agente #' + g.id, user: '-', rol: 'activos' }, actorLabel(req.actor), detalle || '');
router.get('/activos/agentes', requireActor, wrap((req, res) => {
  if (!permitido(req, res)) return;
  const q = { todos: req.query.todos === '1' };
  if (typeof req.query.q === 'string' && req.query.q.trim()) q.q = req.query.q.trim();
  res.json({ agentes: A.agentes(db, q) });
}));
router.post('/activos/agentes', requireActor, wrap((req, res) => {
  if (!permitido(req, res)) return;
  const v = A.validarAgente(db, req.body, true);
  if (v.error) return res.status(400).json({ error: v.error });
  const r = A.crearAgente(db, v.valores);
  if (r.error) return res.status(r.status || 400).json({ error: r.error });
  logAg('ACTIVO_AGENTE', r.agente, req, 'creado');
  res.status(201).json(r);
}));
function agentePorId(req, res) {
  const g = idValido(req.params.id) ? A.agente(db, Number(req.params.id)) : null;
  if (!g) res.status(404).json({ error: 'Agente no encontrado' });
  return g;
}
router.get('/activos/agentes/:id', requireActor, wrap((req, res) => {
  if (!permitido(req, res)) return;
  const g = agentePorId(req, res); if (!g) return;
  res.json(A.agenteDetalle(db, g));
}));
router.put('/activos/agentes/:id', requireActor, wrap((req, res) => {
  if (!permitido(req, res)) return;
  const g = agentePorId(req, res); if (!g) return;
  const v = A.validarAgente(db, req.body, false);
  if (v.error) return res.status(400).json({ error: v.error });
  const r = A.editarAgente(db, g, v.valores);
  if (r.error) return res.status(r.status || 400).json({ error: r.error });
  logAg('ACTIVO_AGENTE', r.agente, req, 'editado' + (v.valores.activo === 0 ? ' (inactivo)' : ''));
  res.json(r);
}));
function activoPorId(req, res) {
  const a = idValido(req.params.id) ? A.obtener(db, Number(req.params.id)) : null;
  if (!a) res.status(404).json({ error: 'Elemento no encontrado' });
  return a;
}
router.post('/activos/:id/asignar', requireActor, wrap((req, res) => {
  if (!permitido(req, res)) return;
  const a = activoPorId(req, res); if (!a) return;
  const r = A.asignar(db, a, (req.body || {}).agenteId, actorLabel(req.actor));
  if (r.error) return res.status(400).json({ error: r.error });
  log('ACTIVO_ASIGNACION', r.activo, req, 'a agente #' + r.agente.id);
  res.json({ activo: r.activo });
}));
router.post('/activos/:id/devolver', requireActor, wrap((req, res) => {
  if (!permitido(req, res)) return;
  const a = activoPorId(req, res); if (!a) return;
  const b = req.body || {};
  const r = A.devolver(db, a, b.estado, b.motivo, actorLabel(req.actor));
  if (r.error) return res.status(400).json({ error: r.error });
  log('ACTIVO_DEVOLUCION', r.activo, req, 'queda ' + r.activo.estado);
  res.json(r);
}));
router.post('/activos/:id/cambiar', requireActor, wrap((req, res) => {
  if (!permitido(req, res)) return;
  const a = activoPorId(req, res); if (!a) return;
  const b = req.body || {};
  const r = A.cambiarElemento(db, a, b.nuevoId, b.estado, b.motivo, actorLabel(req.actor));
  if (r.error) return res.status(400).json({ error: r.error });
  log('ACTIVO_CAMBIO', r.anterior, req, 'por ' + r.activo.codigo + '; queda ' + r.anterior.estado);
  res.json(r);
}));

module.exports = router;
