// routes/tickets.js — Fase 356: «Sugerencias / Tickets» (reglas en ../tickets.js).
// Ticket ajeno para quien no es gestor: 404 (no se revela que existe). Sin caché.
'use strict';
const express = require('express');
const db = require('../db');
const { requireActor } = require('../auth');
const { validate, schemas } = require('../validation');
const T = require('../tickets');
const { wrap, actorLabel, logEvent } = require('./shared');

const router = express.Router();
router.use('/tickets', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
// Fase STA (usuario, 20/11/2026): el CLIENTE de ORLANT (CLIENTES_DASH) no usa Tickets (solo el
// permiso: los tickets que existan no se borran).
router.use('/tickets', requireActor, (req, res, next) => (T.clienteSinTickets(req.actor) ? res.status(403).json({ error: 'Tickets no está disponible para esta cuenta' }) : next()));

const ahoraIso = () => new Date().toISOString();
const idValido = (v) => /^[1-9]\d{0,9}$/.test(String(v));
const TIPO_LBL = { SUGERENCIA: 'Sugerencia', PROBLEMA: 'Problema', PREGUNTA: 'Pregunta' };

// Busca el ticket y aplica la regla de ver: 404 si no existe o no es suyo (ni gestor).
function ticketVisible(req, res) {
  if (!idValido(req.params.id)) { res.status(404).json({ error: 'Ticket no encontrado' }); return null; }
  const t = T.obtener(db, Number(req.params.id));
  if (!t || !T.puedeVer(req.actor, t)) { res.status(404).json({ error: 'Ticket no encontrado' }); return null; }
  return t;
}

router.get('/tickets/campanas', requireActor, wrap((req, res) => {
  res.json({ campanas: T.campanasDe(db, req.actor), gestor: T.esGestor(req.actor), puedeBorrar: T.puedeBorrar(req.actor) });
}));

// Fase 364 (B2): tipos de ticket. Cualquiera con sesión ve los activos; ADMIN ve todos y los edita.
const { isFullAdmin } = require('../auth');
router.get('/tickets/tipos', requireActor, wrap((req, res) => {
  const todos = req.query.todos === '1' && isFullAdmin(req.actor);
  res.json({ tipos: T.tipos(db, { todos }), puedeEditar: isFullAdmin(req.actor) });
}));
router.post('/tickets/tipos', requireActor, wrap((req, res) => {
  if (!isFullAdmin(req.actor)) return res.status(403).json({ error: 'Solo el administrador edita los tipos de ticket' });
  const b = req.body || {};
  if (!b || typeof b !== 'object' || Object.keys(b).some((k) => k !== 'nombre') || !T.nombreTipoValido(b.nombre)) return res.status(400).json({ error: 'Escribe un nombre de 2 a 40 caracteres (letras, números, espacios)' });
  const r = T.crearTipo(db, b.nombre, new Date().toISOString());
  if (r.error) return res.status(409).json({ error: r.error });
  logEvent('TICKET_TIPO_CREADO', { nombre: r.tipo.nombre, user: '-', rol: 'tickets' }, actorLabel(req.actor), r.tipo.codigo);
  res.status(201).json(r);
}));
router.put('/tickets/tipos/:codigo', requireActor, wrap((req, res) => {
  if (!isFullAdmin(req.actor)) return res.status(403).json({ error: 'Solo el administrador edita los tipos de ticket' });
  const b = req.body || {};
  const permitidas = ['nombre', 'activo'];
  if (!b || typeof b !== 'object' || !Object.keys(b).length || Object.keys(b).some((k) => !permitidas.includes(k))) return res.status(400).json({ error: 'Datos no válidos' });
  if (b.nombre !== undefined && !T.nombreTipoValido(b.nombre)) return res.status(400).json({ error: 'Escribe un nombre de 2 a 40 caracteres (letras, números, espacios)' });
  if (b.activo !== undefined && typeof b.activo !== 'boolean') return res.status(400).json({ error: 'Datos no válidos' });
  const r = T.editarTipo(db, String(req.params.codigo || ''), b);
  if (r.error) return res.status(r.status || 400).json({ error: r.error });
  logEvent('TICKET_TIPO_EDITADO', { nombre: r.tipo.nombre, user: '-', rol: 'tickets' }, actorLabel(req.actor),
    r.tipo.codigo + (b.nombre !== undefined && r.antes.nombre !== r.tipo.nombre ? ' · antes: ' + r.antes.nombre : '') + (b.activo !== undefined ? ' · ' + (r.tipo.activo ? 'activo' : 'inactivo') : ''));
  res.json(r.tipo);
}));

router.get('/tickets/contador', requireActor, wrap((req, res) => {
  if (!T.esGestor(req.actor)) return res.status(403).json({ error: 'Solo el administrador o Reportes' });
  res.json({ nuevos: T.contarNuevos(db) });
}));

router.get('/tickets', requireActor, validate(schemas.ticketsListaQuery, 'query'), wrap((req, res) => {
  if (req.query.alcance === 'todos' && !T.esGestor(req.actor)) return res.status(403).json({ error: 'Solo el administrador o Reportes ven todos los tickets' });
  res.json({ tickets: T.listar(db, req.actor, req.query).map((t) => T.publico(t, req.actor)) });
}));

router.get('/tickets/:id', requireActor, wrap((req, res) => {
  const t = ticketVisible(req, res);
  if (!t) return;
  const respuestas = T.respuestasDe(db, t.id);
  res.json({ ticket: T.publico(Object.assign({}, t, { respuestas: respuestas.length }), req.actor), respuestas: respuestas.map((r) => T.respuestaPublica(r, req.actor)) });
}));

router.post('/tickets', requireActor, validate(schemas.ticketCrearBody), wrap((req, res) => {
  const b = req.body;
  if (!T.tipoActivo(db, b.tipo)) return res.status(400).json({ error: 'Elige el tipo' }); // Fase 364: de la lista editable
  if (!T.campanaPermitida(db, req.actor, b.campana)) return res.status(400).json({ error: 'Elige una de tus campañas o «General (plataforma)»' });
  const t = T.crear(db, req.actor, b, ahoraIso());
  res.status(201).json({ ticket: T.publico(Object.assign({}, t, { respuestas: 0 }), req.actor) });
}));

router.post('/tickets/:id/respuestas', requireActor, validate(schemas.ticketRespuestaBody), wrap((req, res) => {
  const t = ticketVisible(req, res);
  if (!t) return;
  // Contestan el gestor y el autor (en el suyo); ticketVisible ya dejó solo a esos dos.
  const respuestas = T.responder(db, req.actor, t, req.body.texto, ahoraIso());
  res.status(201).json({ respuestas: respuestas.map((r) => T.respuestaPublica(r, req.actor)) });
}));

router.put('/tickets/:id/estado', requireActor, validate(schemas.ticketEstadoBody), wrap((req, res) => {
  const t = ticketVisible(req, res);
  if (!t) return;
  if (!T.esGestor(req.actor)) return res.status(403).json({ error: 'Solo el administrador o Reportes cambian el estado' });
  const n = T.cambiarEstado(db, t, req.body.estado, ahoraIso());
  res.json({ ticket: T.publico(Object.assign({}, n, { respuestas: T.respuestasDe(db, n.id).length }), req.actor) });
}));

router.delete('/tickets/:id', requireActor, wrap((req, res) => {
  const t = ticketVisible(req, res);
  if (!t) return;
  if (!T.puedeBorrar(req.actor)) return res.status(403).json({ error: 'Solo el administrador borra tickets' });
  T.borrar(db, t);
  // Historial: quién, cuándo y el número; nunca la descripción ni las respuestas.
  logEvent('TICKET_BORRADO', { nombre: 'Ticket #' + t.id, user: '-', rol: t.campana }, actorLabel(req.actor),
    'ticket #' + t.id + ' (' + (TIPO_LBL[t.tipo] || t.tipo) + ', ' + (t.campana === T.GENERAL ? T.ETIQUETA_GENERAL : t.campana) + ') borrado');
  res.json({ ok: true });
}));

module.exports = router;
