// routes/orlant-equidad.js — «Equidad profesionales» de ORLANT (pedido de Edwin, 24/11/2026). Ver
// server/orlant-equidad.js.
//   GET  /api/orlant/equidad/estado      -> las 3 bases para la pestaña (quien ve el tablero de ORLANT, sin el cliente por ahora)
//   GET  /api/orlant/equidad/resumen     -> conteos para «Cargar bases» (quien carga)
//   POST /api/orlant/equidad/cargas/:grupo -> reemplaza esa base (quien carga)
//   PUT  /api/orlant/equidad/entidades   -> lista de entidades pólizas / prepagadas (quien carga)
'use strict';

const express = require('express');
const db = require('../db');
const { requireActor, campaignAccess, isFullAdmin } = require('../auth');
const EQ = require('../orlant-equidad');
const { wrap, logEvent, actorLabel } = require('./shared');

const router = express.Router();
const BASE = '/orlant/equidad';
// Pregunta abierta (Isa/Edwin): ¿la ve la cuenta cliente de ORLANT, con el nombre de los profesionales?
// Mientras no respondan, no: la pestaña queda para el administrador, gerencia y el supervisor de ORLANT.
const VISIBLE_PARA_CLIENTE = false;

function puedeCargar(a) {
  if (!a) return false;
  if (isFullAdmin(a)) return true;
  if (a.perms && a.perms.cargarDatos === true) return true;
  return a.rol === 'SUPERVISOR' && campaignAccess(a, EQ.CAMPANA);
}
function puedeVer(a) {
  if (!a) return false;
  if (puedeCargar(a) || a.rol === 'GERENCIA') return true;
  return VISIBLE_PARA_CLIENTE && a.rol === 'CLIENTES_DASH' && campaignAccess(a, EQ.CAMPANA);
}
const soloCarga = (req, res, next) => (puedeCargar(req.actor) ? next() : res.status(403).json({ error: 'Solo quien carga las bases de ORLANT' }));

function h(fn) {
  return wrap(async (req, res) => {
    try { await fn(req, res); } catch (e) {
      if (e instanceof EQ.EquidadError) return res.status(e.status).json({ error: e.message });
      throw e;
    }
  });
}

router.use(BASE, (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

router.get(BASE + '/estado', requireActor, h((req, res) => {
  if (!puedeVer(req.actor)) return res.status(403).json({ error: 'Sin acceso a Equidad profesionales' });
  res.json(EQ.estado(db));
}));

router.get(BASE + '/resumen', requireActor, soloCarga, h((req, res) => res.json(EQ.resumen(db))));

router.post(BASE + '/cargas/:grupo', requireActor, soloCarga, h((req, res) => {
  const r = EQ.cargar(db, req.params.grupo, req.body || {}, actorLabel(req.actor));
  // Historial: solo la base, cuántas citas y el nombre del archivo (nunca el contenido).
  logEvent('EQUIDAD_CARGA', null, actorLabel(req.actor), `ORLANT · ${r.grupo}: ${r.filas} citas (antes ${r.reemplazadas})`);
  res.json(r);
}));

router.put(BASE + '/entidades', requireActor, soloCarga, h((req, res) => {
  const r = EQ.guardarEntidades(db, req.body || {});
  logEvent('EQUIDAD_ENTIDADES', null, actorLabel(req.actor), `ORLANT · pólizas ${r.polizas.length}, prepagadas ${r.prepagada.length}`);
  res.json(r);
}));

module.exports = router;
module.exports.puedeVer = puedeVer;
module.exports.puedeCargar = puedeCargar;
