// routes/historial.js — Historial de auditoria (append-only, nunca se
// borra desde la API). Extraido de server.js (Radiografia InConexion, #3):
// solo se movio el cableado HTTP, sin tocar ninguna regla de negocio.
//
// 25/11/2026 (medición local: con un año de filas, ~44 mil, la respuesta pesaba 14 MB y el servidor
// tardaba 0,44 s en armarla, sin atender a nadie más): se mandan solo las LIMITE más recientes, con
// filtros por tipo y fecha aplicados aquí. Sin parámetros responde un arreglo, como antes (pruebas y
// scripts de revisión lo leen así); con `con_total=1`, { filas, total, totalFiltrado, limite, recortado }.
// Las alertas de seguridad (routes/seguridad.js) leen la tabla directo y no cambian.
const express = require('express');
const db = require('../db');
const { requireActor, isFullAdmin } = require('../auth');
const { wrap } = require('./shared');
const { fechaLimitesAhoraColombiaStr } = require('../fecha-limites');

const router = express.Router();

const LIMITE = 5000;
// Fase 113 (tema A) + Fase 178: «Inicios de sesión» agrupa los eventos de autenticación.
const LOGINS = ['LOGIN_OK', 'LOGIN_FALLIDO', 'LOGIN_BLOQUEADO', 'LOGOUT'];
const RE_TIPO = /^(__LOGINS__|[A-Z][A-Z0-9_]{0,59})$/;
const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const DIA_MS = 24 * 60 * 60 * 1000;

// Inicio del día AAAA-MM-DD en hora de Colombia (UTC-5 fijo, sin horario de verano), en ms.
function inicioDiaColombia(fecha) {
  return Date.parse(fecha + 'T00:00:00-05:00');
}

// Traduce los parámetros a un WHERE. Devuelve { where, params } o { error }.
function filtros(q) {
  const cond = [], params = [];
  const tipo = q.tipo == null ? '' : String(q.tipo);
  if (tipo) {
    if (!RE_TIPO.test(tipo)) return { error: 'Tipo de evento no válido' };
    if (tipo === '__LOGINS__') { cond.push('accion IN (' + LOGINS.map(() => '?').join(',') + ')'); params.push(...LOGINS); }
    else { cond.push('accion = ?'); params.push(tipo); }
  }
  for (const [clave, op, extra] of [['desde', '>=', 0], ['hasta', '<', DIA_MS]]) {
    const v = q[clave] == null ? '' : String(q[clave]);
    if (!v) continue;
    const ms = RE_FECHA.test(v) ? inicioDiaColombia(v) : NaN;
    if (!Number.isFinite(ms) || new Date(ms + 5 * 3600 * 1000).toISOString().slice(0, 10) !== v) return { error: 'Fecha no válida (AAAA-MM-DD)' };
    cond.push('ts ' + op + ' ?'); params.push(ms + extra);
  }
  return { where: cond.length ? ' WHERE ' + cond.join(' AND ') : '', params };
}

// Fase 292 (#15): la hora de cada fila sale de `ts` (el instante exacto) en hora de Colombia.
const conFecha = (r) => (r.ts ? { ...r, fecha: fechaLimitesAhoraColombiaStr(new Date(Number(r.ts))) } : r);

router.get(
  '/historial/total',
  requireActor,
  wrap((req, res) => {
    if (!isFullAdmin(req.actor)) return res.status(403).json({ error: 'Sin permiso para ver el historial' });
    res.json({ total: db.prepare('SELECT COUNT(*) n FROM historial').get().n });
  })
);

router.get(
  '/historial',
  requireActor,
  wrap((req, res) => {
    // Mismo criterio que el frontend (session.js: solo admin maestro o rol
    // ADMIN ven la pestana Historial) — antes esta ruta solo exigia un JWT
    // valido (requireAuth), sin ningun chequeo de rol, asi que cualquier
    // autenticado (incluida una cuenta ya suspendida, mientras su token
    // siguiera vigente) podia leer el log de auditoria completo.
    if (!isFullAdmin(req.actor)) {
      return res.status(403).json({ error: 'Sin permiso para ver el historial' });
    }
    const f = filtros(req.query || {});
    if (f.error) return res.status(400).json({ error: f.error });
    // Fase 117: `id` (AUTOINCREMENT) desempata las filas con el mismo `ts`.
    const filas = db.prepare('SELECT * FROM historial' + f.where + ' ORDER BY ts DESC, id DESC LIMIT ?').all(...f.params, LIMITE).map(conFecha);
    if (String(req.query.con_total || '') !== '1') return res.json(filas);
    const total = db.prepare('SELECT COUNT(*) n FROM historial').get().n;
    const totalFiltrado = f.where ? db.prepare('SELECT COUNT(*) n FROM historial' + f.where).get(...f.params).n : total;
    res.json({ filas, total, totalFiltrado, limite: LIMITE, recortado: totalFiltrado > filas.length });
  })
);

module.exports = router;
module.exports.LIMITE = LIMITE;
module.exports.filtros = filtros;
