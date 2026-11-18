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
  res.json({ campanas: campanas.map((c) => ({ nombre: c, puedeEditar: M.puedeEditar(req.actor, c), puntualidad: !!P.config(c) })), hoy: fechaLimitesHoyColombia(), semanaActual: L.mallaLunesDe(fechaLimitesHoyColombia()) });
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

// ── Fase 363 (Malla fase 2): puntualidad con el login de Wolkvox (agent_7) ──
// Solo campañas con puntualidad (puntualidad.js: al principio solo la replica). Lee: quien lee la
// malla (ADMIN, SUPERVISOR de la campaña, REPORTES). Enlaces y excepciones: quien la edita. El
// cliente no tiene acceso a la malla. Todo cambio queda en el Historial.
const P = require('../puntualidad');
const fechaValida = (f) => typeof f === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(f) && new Date(f + 'T00:00:00Z').toISOString().slice(0, 10) === f;
const ahoraColombia = () => { const d = new Date(Date.now() - 5 * 3600 * 1000); return d.toISOString().slice(0, 10) + ' ' + d.toISOString().slice(11, 19); };
function campanaPuntualidad(req, res, campana, editar) {
  if (!campana || !P.config(campana)) { res.status(404).json({ error: 'Esta campaña no tiene puntualidad' }); return false; }
  if (!M.puedeLeer(req.actor, campana)) { res.status(403).json({ error: 'Sin acceso a la malla de esta campaña' }); return false; }
  if (editar && !M.puedeEditar(req.actor, campana)) { res.status(403).json({ error: 'Solo el supervisor de la campaña o el administrador' }); return false; }
  return true;
}

router.get('/malla/puntualidad', requireActor, wrap((req, res) => {
  const campana = campanaDe(req.query.campana), lunes = String(req.query.semana || '');
  if (!L.mallaEsLunes(lunes)) return res.status(400).json({ error: 'Elige una semana (su lunes, AAAA-MM-DD)' });
  if (!campanaPuntualidad(req, res, campana, false)) return;
  const r = P.calcular(db, campana, lunes, L.mallaFechaDelDia(lunes, 7), { ahora: ahoraColombia() });
  const editar = M.puedeEditar(req.actor, campana);
  if (!editar) { delete r.agentesSinEnlace; delete r.conLoginSinTurno; }
  res.json(Object.assign(r, { semana: lunes, puedeEditar: editar, tipos: P.TIPOS_EXCEPCION }));
}));

router.get('/malla/agentes', requireActor, wrap((req, res) => {
  const campana = campanaDe(req.query.campana);
  if (!campanaPuntualidad(req, res, campana, true)) return;
  res.json({ campana, agentes: P.agentes(db, campana, fechaLimitesHoyColombia()), asesoras: P.asesorasDe(db, campana) });
}));

router.put('/malla/agentes/:agentId', requireActor, wrap((req, res) => {
  const b = req.body || {};
  if (!soloClaves(b, ['campana', 'userId'])) return res.status(400).json({ error: 'Datos no válidos' });
  const campana = campanaDe(b.campana), agentId = String(req.params.agentId || '');
  if (!campanaPuntualidad(req, res, campana, true)) return;
  if (!/^[A-Za-z0-9_.-]{1,40}$/.test(agentId) || !db.prepare('SELECT 1 FROM wolkvox_login_diario WHERE operacion = ? AND agentId = ? LIMIT 1').get(P.config(campana).operacion, agentId)) return res.status(404).json({ error: 'Agente no encontrado' });
  const antes = db.prepare('SELECT e.userId, u.nombre FROM malla_agente_enlace e LEFT JOIN users u ON u.id = e.userId WHERE e.campana = ? AND e.agentId = ?').get(campana, agentId);
  if (b.userId === null) {
    if (!antes) return res.json({ ok: true });
    db.prepare('DELETE FROM malla_agente_enlace WHERE campana = ? AND agentId = ?').run(campana, agentId);
    log('MALLA_ENLACE_QUITADO', campana, antes.nombre || '-', req, 'agente ' + agentId);
    return res.json({ ok: true });
  }
  if (!Number.isInteger(b.userId) || !P.asesorasDe(db, campana).some((a) => a.id === b.userId)) return res.status(400).json({ error: 'Elige una asesora activa de la campaña' });
  const otro = db.prepare('SELECT agentId FROM malla_agente_enlace WHERE campana = ? AND userId = ? AND agentId != ?').get(campana, b.userId, agentId);
  if (otro) return res.status(409).json({ error: 'Esa asesora ya está enlazada al agente ' + otro.agentId });
  db.prepare(`INSERT INTO malla_agente_enlace (campana, agentId, userId, creadoPor, createdAt) VALUES (?,?,?,?,?)
              ON CONFLICT(campana, agentId) DO UPDATE SET userId = excluded.userId, creadoPor = excluded.creadoPor, createdAt = excluded.createdAt`).run(campana, agentId, b.userId, actorLabel(req.actor), ahoraIso());
  const nombre = (db.prepare('SELECT nombre FROM users WHERE id = ?').get(b.userId) || {}).nombre || '-';
  log('MALLA_ENLACE', campana, nombre, req, 'agente ' + agentId + (antes && antes.userId !== b.userId ? ' (antes: ' + (antes.nombre || '-') + ')' : ''));
  res.json({ ok: true });
}));

router.post('/malla/excepciones', requireActor, wrap((req, res) => {
  const b = req.body || {};
  if (!soloClaves(b, ['campana', 'userId', 'desde', 'hasta', 'tipo'])) return res.status(400).json({ error: 'Datos no válidos' });
  const campana = campanaDe(b.campana);
  if (!campanaPuntualidad(req, res, campana, true)) return;
  if (!Object.prototype.hasOwnProperty.call(P.TIPOS_EXCEPCION, b.tipo)) return res.status(400).json({ error: 'Elige el tipo: incapacidad, vacaciones o permiso' });
  const hasta = b.hasta === undefined || b.hasta === '' ? b.desde : b.hasta;
  if (!fechaValida(b.desde) || !fechaValida(hasta) || hasta < b.desde) return res.status(400).json({ error: 'Revisa las fechas (desde y hasta, AAAA-MM-DD)' });
  if (P.diasEntre(b.desde, hasta).length > P.MAX_DIAS_EXCEPCION) return res.status(400).json({ error: 'Máximo ' + P.MAX_DIAS_EXCEPCION + ' días por excepción' });
  const a = P.asesorasDe(db, campana).find((x) => x.id === b.userId);
  if (!Number.isInteger(b.userId) || !a) return res.status(400).json({ error: 'Elige una asesora activa de la campaña' });
  const r = db.prepare('INSERT INTO malla_excepciones (campana, userId, desde, hasta, tipo, creadoPor, createdAt) VALUES (?,?,?,?,?,?,?)').run(campana, a.id, b.desde, hasta, b.tipo, actorLabel(req.actor), ahoraIso());
  log('MALLA_EXCEPCION', campana, a.nombre, req, P.TIPOS_EXCEPCION[b.tipo] + ' · ' + b.desde + (hasta !== b.desde ? ' a ' + hasta : ''));
  res.status(201).json({ id: Number(r.lastInsertRowid) });
}));

router.delete('/malla/excepciones/:id', requireActor, wrap((req, res) => {
  if (!idValido(req.params.id)) return res.status(404).json({ error: 'Excepción no encontrada' });
  const e = db.prepare('SELECT e.*, u.nombre FROM malla_excepciones e LEFT JOIN users u ON u.id = e.userId WHERE e.id = ?').get(Number(req.params.id));
  if (!e || !P.config(e.campana) || !M.puedeLeer(req.actor, e.campana)) return res.status(404).json({ error: 'Excepción no encontrada' });
  if (!M.puedeEditar(req.actor, e.campana)) return res.status(403).json({ error: 'Solo el supervisor de la campaña o el administrador' });
  db.prepare('DELETE FROM malla_excepciones WHERE id = ?').run(e.id);
  log('MALLA_EXCEPCION_QUITADA', e.campana, e.nombre || '-', req, (P.TIPOS_EXCEPCION[e.tipo] || e.tipo) + ' · ' + e.desde + (e.hasta !== e.desde ? ' a ' + e.hasta : ''));
  res.json({ ok: true });
}));

// ── Fase 367 (D2): «Horarios» por archivo (Centro de cargas). Quien edita la malla de la campaña. ──
router.get('/malla/horarios', requireActor, wrap((req, res) => {
  const campana = campanaDe(req.query.campana);
  // Sin puntualidad o sin permiso de editar: «no disponible» (200), así el Centro de cargas no muestra la sección ni un error.
  if (!P.config(campana) || !M.puedeEditar(req.actor, campana)) return res.json({ disponible: false });
  const anio = /^\d{4}$/.test(String(req.query.anio || '')) ? String(req.query.anio) : fechaLimitesHoyColombia().slice(0, 4);
  res.json({ disponible: true, campana, anio, meses: P.resumenMeses(db, campana, anio) });
}));
router.post('/malla/horarios/carga', requireActor, wrap((req, res) => {
  const b = req.body || {};
  if (!soloClaves(b, ['campana', 'mes', 'archivoNombre', 'filas'])) return res.status(400).json({ error: 'Datos no válidos' });
  const campana = campanaDe(b.campana);
  if (!campanaPuntualidad(req, res, campana, true)) return;
  const filas = Array.isArray(b.filas) ? b.filas.map((f) => (f && typeof f === 'object' ? { agent_id: f.agent_id, agent_name: f.agent_name, date: f.date, login: f.login, logout: f.logout, login_time: f.login_time } : f)) : b.filas;
  const r = P.cargarArchivo(db, campana, String(b.mes || ''), filas);
  if (r.error) return res.status(400).json({ error: r.error });
  log('MALLA_HORARIOS_CARGA', campana, '-', req, String(b.mes) + ' · ' + r.dias.length + ' día(s) · ' + r.agentes + ' agente(s) · ' + r.sesiones + ' sesión(es) · ' + r.sinCoincidencia.length + ' sin coincidencia');
  res.status(201).json(r);
}));

// La asesora: SOLO su puntualidad (esta semana y la anterior), en las campañas que lo permiten
// (asesoraVe). La replica no lo permite: sus datos son de prueba.
router.get('/malla/mi-puntualidad', requireActor, wrap((req, res) => {
  if (req.actor.rol !== 'ASESOR' || !req.actor.id || !req.actor.asesorCampana) return res.json({ semanas: [] });
  const campana = P.campanasConPuntualidad().find((c) => { const cfg = P.config(c); return cfg.asesoraVe && cfg.asesorasDe === req.actor.asesorCampana; });
  if (!campana) return res.json({ semanas: [] });
  const actual = L.mallaLunesDe(fechaLimitesHoyColombia());
  const ahora = ahoraColombia();
  const semanas = [actual, L.mallaSumarSemanas(actual, -1)].map((s) => {
    const r = P.calcular(db, campana, s, L.mallaFechaDelDia(s, 7), { ahora, soloUserId: req.actor.id });
    return { semana: s, datosHasta: r.datosHasta, filas: r.filas.map((f) => ({ fecha: f.fecha, entrada: f.entrada, salida: f.salida, estado: f.estado, tardeSeg: f.tardeSeg, salidaAnticipadaSeg: f.salidaAnticipadaSeg, primerLogin: f.primerLogin, ultimoLogout: f.ultimoLogout, excepcion: f.excepcion ? f.excepcion.tipo : null })) };
  });
  res.json({ semanas, tipos: P.TIPOS_EXCEPCION });
}));

module.exports = router;
