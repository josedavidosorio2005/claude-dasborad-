// routes/malla.js — Fase 358: «Malla de turnos» (reglas en ../malla.js). Cada cambio queda en el
// Historial (campaña, semana y grupo). Sin caché.
'use strict';
const express = require('express');
const db = require('../db');
const { requireActor } = require('../auth');
const { fechaLimitesHoyColombia } = require('../fecha-limites');
const M = require('../malla');
const X = require('../malla-extra'); // Fase 373: novedades y horario especial
const C = require('../malla-casos'); // Fase M1: casos especiales (tipos de excepción, festivos)
const { isFullAdmin } = require('../auth');
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
  res.json({ campana, semana: lunes, grupos: M.semana(db, campana, lunes), asesoras: M.asesorasDe(db, campana), puedeEditar: M.puedeEditar(req.actor, campana),
    novedades: X.novedadesSemana(db, campana, lunes, { incluirQuitadas: true }), ajustes: X.ajustesSemana(db, campana, lunes), // Fase 373
    festivos: C.festivosDeSemana(db, lunes), puedeAdministrarFestivos: isFullAdmin(req.actor) }); // Fase M1 (B)
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
  const semanas = [actual, L.mallaSumarSemanas(actual, 1)].map((s) => ({ semana: s, turno: M.turnoDe(db, req.actor.id, req.actor.asesorCampana, s),
    novedades: X.novedadesDeAsesora(db, req.actor.id, req.actor.asesorCampana, s) })); // Fase 373: sus novedades
  res.json({ campana: req.actor.asesorCampana, semanas });
}));

// ── Fase 373 (Edwin 19/11): novedades por asesora y horario especial. Quien edita la malla de la
// campaña. El Historial nunca lleva el texto de la novedad (puede traer datos de salud).
const nombreDe = (id) => (db.prepare('SELECT nombre FROM users WHERE id = ?').get(id) || {}).nombre || '-';
router.post('/malla/novedades', requireActor, wrap((req, res) => {
  const b = req.body || {};
  const campana = campanaDe(b.campana);
  if (!campana) return res.status(400).json({ error: 'Elige la campaña' });
  if (!M.puedeEditar(req.actor, campana)) return res.status(403).json({ error: 'Solo el supervisor de la campaña o el administrador editan la malla' });
  const r = X.crearNovedad(db, Object.assign({}, b, { campana }), actorLabel(req.actor), ahoraIso());
  if (r.error) return res.status(400).json({ error: r.error });
  log('MALLA_NOVEDAD', campana, nombreDe(r.novedad.asesorId), req, 'semana ' + r.novedad.semana + (r.novedad.fecha ? ' · día ' + r.novedad.fecha : ''));
  res.status(201).json(r);
}));
router.delete('/malla/novedades/:id', requireActor, wrap((req, res) => {
  const n = idValido(req.params.id) ? X.obtenerNovedad(db, Number(req.params.id)) : null;
  if (!n || !M.puedeLeer(req.actor, n.campana)) return res.status(404).json({ error: 'Novedad no encontrada' });
  if (!M.puedeEditar(req.actor, n.campana)) return res.status(403).json({ error: 'Solo el supervisor de la campaña o el administrador editan la malla' });
  const r = X.quitarNovedad(db, n, actorLabel(req.actor), ahoraIso());
  if (r.error) return res.status(400).json({ error: r.error });
  log('MALLA_NOVEDAD_QUITADA', n.campana, nombreDe(n.asesorId), req, 'semana ' + n.semana + (n.fecha ? ' · día ' + n.fecha : ''));
  res.json(r);
}));
router.put('/malla/ajustes', requireActor, wrap((req, res) => {
  const b = req.body || {};
  const campana = campanaDe(b.campana);
  if (!campana) return res.status(400).json({ error: 'Elige la campaña' });
  if (!M.puedeEditar(req.actor, campana)) return res.status(403).json({ error: 'Solo el supervisor de la campaña o el administrador editan la malla' });
  const r = X.guardarAjuste(db, Object.assign({}, b, { campana }), actorLabel(req.actor), ahoraIso());
  if (r.error) return res.status(400).json({ error: r.error });
  // Fase M1 (C): una repetición se resume (primer y último día, cuántos) para no llenar el Historial.
  const dias = r.serie ? r.fechas[0] + ' a ' + r.fechas[r.fechas.length - 1] + ' · ' + r.fechas.length + ' día(s), se repite cada semana' : r.fechas.join(', ');
  log('MALLA_HORARIO_ESPECIAL', campana, nombreDe(b.asesorId), req, dias + ' · ' + L.mallaTurnoTexto(r.turno));
  res.json({ ok: true, fechas: r.fechas, turno: r.turno, serie: r.serie });
}));
// Fase M1 (C): quitar toda una repetición de horario especial.
router.delete('/malla/ajustes/serie/:serie', requireActor, wrap((req, res) => {
  const lista = X.ajustesDeSerie(db, String(req.params.serie || ''));
  if (!lista.length || !M.puedeLeer(req.actor, lista[0].campana)) return res.status(404).json({ error: 'Horario especial no encontrado' });
  if (!M.puedeEditar(req.actor, lista[0].campana)) return res.status(403).json({ error: 'Solo el supervisor de la campaña o el administrador editan la malla' });
  const n = X.quitarSerie(db, lista[0].serie);
  log('MALLA_HORARIO_ESPECIAL_QUITADO', lista[0].campana, nombreDe(lista[0].asesorId), req, lista[0].fecha + ' a ' + lista[lista.length - 1].fecha + ' · ' + n + ' día(s), toda la repetición');
  res.json({ ok: true, quitados: n });
}));
router.delete('/malla/ajustes/:id', requireActor, wrap((req, res) => {
  const a = idValido(req.params.id) ? X.obtenerAjuste(db, Number(req.params.id)) : null;
  if (!a || !M.puedeLeer(req.actor, a.campana)) return res.status(404).json({ error: 'Horario especial no encontrado' });
  if (!M.puedeEditar(req.actor, a.campana)) return res.status(403).json({ error: 'Solo el supervisor de la campaña o el administrador editan la malla' });
  X.quitarAjuste(db, a);
  log('MALLA_HORARIO_ESPECIAL_QUITADO', a.campana, nombreDe(a.asesorId), req, a.fecha);
  res.json({ ok: true });
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
  res.json(Object.assign(r, { semana: lunes, puedeEditar: editar, tipos: C.tiposMapa(db), tiposActivos: C.tipos(db), puedeAdministrarTipos: isFullAdmin(req.actor) })); // Fase M1 (A)
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
  if (!C.tipoActivo(db, b.tipo)) return res.status(400).json({ error: 'Elige un tipo de excepción de la lista' }); // Fase M1 (A): tipos editables
  const hasta = b.hasta === undefined || b.hasta === '' ? b.desde : b.hasta;
  if (!fechaValida(b.desde) || !fechaValida(hasta) || hasta < b.desde) return res.status(400).json({ error: 'Revisa las fechas (desde y hasta, AAAA-MM-DD)' });
  if (P.diasEntre(b.desde, hasta).length > P.MAX_DIAS_EXCEPCION) return res.status(400).json({ error: 'Máximo ' + P.MAX_DIAS_EXCEPCION + ' días por excepción' });
  const a = P.asesorasDe(db, campana).find((x) => x.id === b.userId);
  if (!Number.isInteger(b.userId) || !a) return res.status(400).json({ error: 'Elige una asesora activa de la campaña' });
  const r = db.prepare('INSERT INTO malla_excepciones (campana, userId, desde, hasta, tipo, creadoPor, createdAt) VALUES (?,?,?,?,?,?,?)').run(campana, a.id, b.desde, hasta, b.tipo, actorLabel(req.actor), ahoraIso());
  log('MALLA_EXCEPCION', campana, a.nombre, req, C.tiposMapa(db)[b.tipo] + ' · ' + b.desde + (hasta !== b.desde ? ' a ' + hasta : ''));
  res.status(201).json({ id: Number(r.lastInsertRowid) });
}));

router.delete('/malla/excepciones/:id', requireActor, wrap((req, res) => {
  if (!idValido(req.params.id)) return res.status(404).json({ error: 'Excepción no encontrada' });
  const e = db.prepare('SELECT e.*, u.nombre FROM malla_excepciones e LEFT JOIN users u ON u.id = e.userId WHERE e.id = ?').get(Number(req.params.id));
  if (!e || !P.config(e.campana) || !M.puedeLeer(req.actor, e.campana)) return res.status(404).json({ error: 'Excepción no encontrada' });
  if (!M.puedeEditar(req.actor, e.campana)) return res.status(403).json({ error: 'Solo el supervisor de la campaña o el administrador' });
  db.prepare('DELETE FROM malla_excepciones WHERE id = ?').run(e.id);
  log('MALLA_EXCEPCION_QUITADA', e.campana, e.nombre || '-', req, (C.tiposMapa(db)[e.tipo] || e.tipo) + ' · ' + e.desde + (e.hasta !== e.desde ? ' a ' + e.hasta : ''));
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
    // Pedido de Edwin (24/11): la vista de la asesora queda igual; la novedad que reemplaza a «Sin ingreso» es
    // solo para el supervisor (el texto lo escribió él y la asesora ya ve sus novedades en «Mi malla»).
    return { semana: s, datosHasta: r.datosHasta, filas: r.filas.map((f) => ({ fecha: f.fecha, entrada: f.entrada, salida: f.salida, estado: f.estado === 'novedad' ? 'sin_ingreso' : f.estado, tardeSeg: f.tardeSeg, salidaAnticipadaSeg: f.salidaAnticipadaSeg, primerLogin: f.primerLogin, ultimoLogout: f.ultimoLogout, excepcion: f.excepcion ? f.excepcion.tipo : null })) };
  });
  res.json({ semanas, tipos: C.tiposMapa(db) });
}));

// ── Fase M1 (B): festivos de Colombia. Los lee quien lee alguna malla; agregar o quitar: solo el ADMIN
// completo (cambia la puntualidad de todas las campañas). Todo cambio queda en el Historial.
router.get('/malla/festivos', requireActor, wrap((req, res) => {
  if (!M.campanasDe(db, req.actor).length) return res.status(403).json({ error: 'Sin acceso a la malla' });
  const anio = /^\d{4}$/.test(String(req.query.anio || '')) ? Number(req.query.anio) : Number(fechaLimitesHoyColombia().slice(0, 4));
  if (anio < 2000 || anio > 2100) return res.status(400).json({ error: 'Año no válido' });
  const admin = isFullAdmin(req.actor);
  res.json({ anio, festivos: C.festivosDelAnio(db, anio, { incluirQuitados: admin }), puedeAdministrar: admin });
}));
router.post('/malla/festivos', requireActor, wrap((req, res) => {
  if (!isFullAdmin(req.actor)) return res.status(403).json({ error: 'Solo el administrador cambia los festivos' });
  const r = C.agregarFestivo(db, req.body, actorLabel(req.actor), ahoraIso());
  if (r.error) return res.status(r.status || 400).json({ error: r.error });
  log('MALLA_FESTIVO', '-', r.festivo.nombre, req, r.festivo.fecha + (r.restaurado ? ' · vuelve el festivo de ley' : ' · agregado'));
  res.status(201).json(r);
}));
router.delete('/malla/festivos/:fecha', requireActor, wrap((req, res) => {
  if (!isFullAdmin(req.actor)) return res.status(403).json({ error: 'Solo el administrador cambia los festivos' });
  const r = C.quitarFestivo(db, String(req.params.fecha || ''), actorLabel(req.actor), ahoraIso());
  if (r.error) return res.status(r.status || 400).json({ error: r.error });
  log('MALLA_FESTIVO_QUITADO', '-', r.festivo.nombre, req, r.festivo.fecha + (r.festivo.origen === 'ley' ? ' · festivo de ley quitado' : ' · agregado quitado'));
  res.json({ ok: true });
}));

// ── Fase M1 (A): tipos de excepción. Los lee quien lee alguna malla; los crea y edita solo el ADMIN
// completo. Un tipo no se borra: se desactiva. Todo cambio queda en el Historial.
router.get('/malla/tipos-excepcion', requireActor, wrap((req, res) => {
  if (!M.campanasDe(db, req.actor).length) return res.status(403).json({ error: 'Sin acceso a la malla' });
  res.json({ tipos: C.tipos(db, { todos: true }), puedeAdministrar: isFullAdmin(req.actor) });
}));
router.post('/malla/tipos-excepcion', requireActor, wrap((req, res) => {
  if (!isFullAdmin(req.actor)) return res.status(403).json({ error: 'Solo el administrador cambia los tipos de excepción' });
  const r = C.crearTipo(db, req.body, ahoraIso());
  if (r.error) return res.status(r.status || 400).json({ error: r.error });
  log('MALLA_TIPO_EXCEPCION', '-', r.tipo.nombre, req, 'creado' + (r.tipo.cuentaTrabajado ? ' · cuenta como día trabajado' : ''));
  res.status(201).json(r);
}));
router.put('/malla/tipos-excepcion/:codigo', requireActor, wrap((req, res) => {
  if (!isFullAdmin(req.actor)) return res.status(403).json({ error: 'Solo el administrador cambia los tipos de excepción' });
  const codigo = String(req.params.codigo || '');
  if (!/^[a-z0-9_]{1,40}$/.test(codigo)) return res.status(404).json({ error: 'Tipo no encontrado' });
  const r = C.editarTipo(db, codigo, req.body);
  if (r.error) return res.status(r.status || 400).json({ error: r.error });
  const cambios = [];
  if (r.antes.nombre !== r.tipo.nombre) cambios.push('nombre: ' + r.antes.nombre + ' → ' + r.tipo.nombre);
  if (r.antes.activo !== r.tipo.activo) cambios.push(r.tipo.activo ? 'activado' : 'desactivado');
  if (r.antes.cuentaTrabajado !== r.tipo.cuentaTrabajado) cambios.push(r.tipo.cuentaTrabajado ? 'cuenta como día trabajado' : 'no cuenta como día trabajado');
  log('MALLA_TIPO_EXCEPCION_EDITADO', '-', r.tipo.nombre, req, cambios.join(' · ') || 'sin cambios');
  res.json({ tipo: r.tipo });
}));

module.exports = router;
