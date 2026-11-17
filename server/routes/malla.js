// routes/malla.js — Fase 358: «Malla de turnos» (reglas en ../malla.js). Cada cambio queda en el
// Historial (campaña, semana y grupo). Sin caché.
'use strict';
const express = require('express');
const db = require('../db');
const { requireActor } = require('../auth');
const { fechaLimitesHoyColombia } = require('../fecha-limites');
const M = require('../malla');
const { wrap, actorLabel, logEvent } = require('./shared');

const router = express.Router();
router.use('/malla', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
const L = M.L;
const ahoraIso = () => new Date().toISOString();
const idValido = (v) => /^[1-9]\d{0,9}$/.test(String(v));
const campanaDe = (v) => (typeof v === 'string' ? v.trim() : '');
const soloClaves = (b, permitidas) => b && typeof b === 'object' && !Array.isArray(b) && Object.keys(b).every((k) => permitidas.includes(k));
const log = (accion, campana, grupo, req, detalle) => logEvent(accion, { nombre: grupo || '-', user: '-', rol: campana }, actorLabel(req.actor), detalle);

// Grupo existente y permiso de edición (404 si no existe o no lo puede ver; 403 si solo lee).
function grupoEditable(req, res) {
  if (!idValido(req.params.id)) { res.status(404).json({ error: 'Grupo no encontrado' }); return null; }
  const g = M.obtener(db, Number(req.params.id));
  if (!g || !M.puedeLeer(req.actor, g.campana)) { res.status(404).json({ error: 'Grupo no encontrado' }); return null; }
  if (!M.puedeEditar(req.actor, g.campana)) { res.status(403).json({ error: 'Solo el supervisor de la campaña o el administrador editan la malla' }); return null; }
  return g;
}

router.get('/malla/campanas', requireActor, wrap((req, res) => {
  const campanas = M.campanasDe(db, req.actor);
  res.json({ campanas: campanas.map((c) => ({ nombre: c, puedeEditar: M.puedeEditar(req.actor, c) })), hoy: fechaLimitesHoyColombia(), semanaActual: L.mallaLunesDe(fechaLimitesHoyColombia()) });
}));

router.get('/malla', requireActor, wrap((req, res) => {
  const campana = campanaDe(req.query.campana), lunes = String(req.query.semana || '');
  if (!campana || !L.mallaEsLunes(lunes)) return res.status(400).json({ error: 'Elige la campaña y una semana (su lunes, AAAA-MM-DD)' });
  if (!M.puedeLeer(req.actor, campana)) return res.status(403).json({ error: 'Sin acceso a la malla de esta campaña' });
  res.json({ campana, semana: lunes, grupos: M.semana(db, campana, lunes), asesoras: M.asesorasDe(db, campana), puedeEditar: M.puedeEditar(req.actor, campana) });
}));

router.post('/malla/grupos', requireActor, wrap((req, res) => {
  const b = req.body || {};
  if (!soloClaves(b, ['campana', 'semana', 'nombre', 'horario'])) return res.status(400).json({ error: 'Datos no válidos' });
  const campana = campanaDe(b.campana);
  if (!campana || !L.mallaEsLunes(b.semana)) return res.status(400).json({ error: 'Elige la campaña y una semana (su lunes)' });
  if (!M.puedeEditar(req.actor, campana)) return res.status(403).json({ error: 'Solo el supervisor de la campaña o el administrador editan la malla' });
  if (!L.mallaNombreValido(b.nombre)) return res.status(400).json({ error: 'El nombre del grupo debe tener entre 1 y ' + L.MALLA_NOMBRE_MAX + ' caracteres' });
  const h = L.mallaValidarHorario(b.horario);
  if (!h.ok) return res.status(400).json({ error: h.error });
  if (db.prepare('SELECT 1 FROM malla_grupos WHERE campana = ? AND semana = ? AND nombre = ?').get(campana, b.semana, b.nombre.trim())) return res.status(409).json({ error: 'Ya hay un grupo con ese nombre en esta semana' });
  const g = M.crear(db, { campana, semana: b.semana, nombre: b.nombre, horario: h.horario }, actorLabel(req.actor), ahoraIso());
  log('MALLA_GRUPO_CREADO', campana, g.nombre, req, 'semana ' + g.semana);
  res.status(201).json({ grupo: Object.assign(g, { asesoras: [] }) });
}));

router.put('/malla/grupos/:id', requireActor, wrap((req, res) => {
  const g = grupoEditable(req, res);
  if (!g) return;
  const b = req.body || {};
  if (!soloClaves(b, ['nombre', 'horario'])) return res.status(400).json({ error: 'Datos no válidos' });
  const cambios = {};
  if (b.nombre !== undefined) {
    if (!L.mallaNombreValido(b.nombre)) return res.status(400).json({ error: 'El nombre del grupo debe tener entre 1 y ' + L.MALLA_NOMBRE_MAX + ' caracteres' });
    const dup = db.prepare('SELECT 1 FROM malla_grupos WHERE campana = ? AND semana = ? AND nombre = ? AND id != ?').get(g.campana, g.semana, b.nombre.trim(), g.id);
    if (dup) return res.status(409).json({ error: 'Ya hay un grupo con ese nombre en esta semana' });
    cambios.nombre = b.nombre;
  }
  if (b.horario !== undefined) {
    const h = L.mallaValidarHorario(b.horario);
    if (!h.ok) return res.status(400).json({ error: h.error });
    cambios.horario = h.horario;
  }
  const n = M.editar(db, g, cambios, ahoraIso());
  log('MALLA_GRUPO_EDITADO', g.campana, n.nombre, req, 'semana ' + g.semana);
  res.json({ grupo: M.semana(db, g.campana, g.semana).find((x) => x.id === g.id) });
}));

router.delete('/malla/grupos/:id', requireActor, wrap((req, res) => {
  const g = grupoEditable(req, res);
  if (!g) return;
  M.borrar(db, g);
  log('MALLA_GRUPO_BORRADO', g.campana, g.nombre, req, 'semana ' + g.semana);
  res.json({ ok: true });
}));

router.put('/malla/grupos/:id/asesoras', requireActor, wrap((req, res) => {
  const g = grupoEditable(req, res);
  if (!g) return;
  const b = req.body || {};
  if (!soloClaves(b, ['asesoras']) || !Array.isArray(b.asesoras) || b.asesoras.length > 500 || !b.asesoras.every((x) => Number.isInteger(x) && x > 0)) return res.status(400).json({ error: 'Lista de asesoras no válida' });
  const r = M.asignar(db, g, [...new Set(b.asesoras)]);
  if (r.error) return res.status(400).json({ error: r.error });
  log('MALLA_ASIGNACION', g.campana, g.nombre, req, 'semana ' + g.semana + ' · ' + r.grupo.asesoras.length + ' asesora(s)');
  res.json({ grupo: r.grupo });
}));

router.post('/malla/copiar', requireActor, wrap((req, res) => {
  const b = req.body || {};
  if (!soloClaves(b, ['campana', 'desde', 'hasta', 'reemplazar'])) return res.status(400).json({ error: 'Datos no válidos' });
  const campana = campanaDe(b.campana);
  if (!campana || !L.mallaEsLunes(b.desde) || !L.mallaEsLunes(b.hasta)) return res.status(400).json({ error: 'Elige la campaña y las dos semanas (sus lunes)' });
  if (b.desde === b.hasta) return res.status(400).json({ error: 'Elige una semana distinta a la de origen' });
  if (!M.puedeEditar(req.actor, campana)) return res.status(403).json({ error: 'Solo el supervisor de la campaña o el administrador editan la malla' });
  const r = M.copiar(db, campana, b.desde, b.hasta, b.reemplazar === true, actorLabel(req.actor), ahoraIso());
  if (r.error) return res.status(r.status).json({ error: r.error, codigo: r.codigo, grupos: r.grupos });
  log('MALLA_COPIADA', campana, '-', req, 'de ' + b.desde + ' a ' + b.hasta + ' · ' + r.grupos + ' grupo(s), ' + r.asesoras + ' asesora(s)' + (r.reemplazados ? ' · reemplazó ' + r.reemplazados + ' grupo(s)' : ''));
  res.json({ ok: true, grupos: r.grupos, asesoras: r.asesoras, reemplazados: r.reemplazados });
}));

// La asesora: su turno de esta semana y de la siguiente (solo lo suyo).
router.get('/malla/mia', requireActor, wrap((req, res) => {
  if (req.actor.rol !== 'ASESOR' || !req.actor.id || !req.actor.asesorCampana) return res.json({ semanas: [] });
  const actual = L.mallaLunesDe(fechaLimitesHoyColombia());
  const semanas = [actual, L.mallaSumarSemanas(actual, 1)].map((s) => ({ semana: s, turno: M.turnoDe(db, req.actor.id, req.actor.asesorCampana, s) }));
  res.json({ campana: req.actor.asesorCampana, semanas });
}));

module.exports = router;
