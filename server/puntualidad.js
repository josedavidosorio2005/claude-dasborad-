// puntualidad.js — Fase 363 (Malla fase 2, pedido de Edwin 17/11; plan aprobado por el usuario el
// 18/11): puntualidad con el reporte agent_7 (login/logout) de la API de Wolkvox en vez del Excel.
//
// Reglas decididas por el usuario:
//  - tolerancia cero: 1 segundo despues de la hora de entrada ya es «Tarde»;
//  - la entrada del dia es el PRIMER login (varias sesiones en un dia: la primera cuenta);
//  - dia con turno y sin login = «Sin ingreso»;
//  - salida anticipada (ultimo logout antes de la hora de salida) como DATO APARTE: el estado
//    principal es la entrada;
//  - el supervisor marca excepciones (incapacidad, vacaciones, permiso) por dia o por rango, con
//    Historial;
//  - el agente de Wolkvox se une al usuario por agent_id, y lo decide una persona (solo se sugiere
//    por nombre exacto); un turno sin agente enlazado es «Sin enlace», no «Sin ingreso»;
//  - el cliente no ve la puntualidad; la asesora solo la suya (cuando su campaña lo tenga);
//  - al principio SOLO la replica «MOBILIZE PRUEBAS API» (con las asesoras de MOBILIZE, solo para
//    leerlas). Ampliar = autorizacion nueva por escrito (CLAUDE.md).
'use strict';

const L = require('../public/js/malla-logic.js');
const { claveNombre } = require('./enlace-asesor');

// Campañas con puntualidad. operacion = de quien es el token de Wolkvox; asesorasDe = de que
// campaña salen las asesoras (la replica usa las de MOBILIZE, solo lectura); asesoraVe = si la
// asesora ve su puntualidad en el Portal Asesor (la replica: no, sus datos son de prueba).
const CAMPANAS = {
  'MOBILIZE PRUEBAS API': { operacion: 'MOBILIZE', asesorasDe: 'MOBILIZE', asesoraVe: false },
};
let _config = CAMPANAS;
function config(campana) { return Object.prototype.hasOwnProperty.call(_config, campana) ? _config[campana] : null; }
function campanasConPuntualidad() { return Object.keys(_config); }

const TIPOS_EXCEPCION = { incapacidad: 'Incapacidad', vacaciones: 'Vacaciones', permiso: 'Permiso' };
const MAX_DIAS_EXCEPCION = 62;
const MAX_DIAS_CONSULTA = 31;

// ── Lector de agent_7 ──
// Una fila por sesion: agent_id, agent_name, agent_dni, date, login, logout, login_time.
// login/logout: «AAAA-MM-DD HH:MM:SS» (o solo la hora, con la fecha en `date`).
function _fechaDe(v) {
  const s = String(v == null ? '' : v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[1] + '-' + m[2] + '-' + m[3];
  m = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  return m ? m[1] + '-' + m[2] + '-' + m[3] : null;
}
function _pad(n) { return (n < 10 ? '0' : '') + n; }
// -> 'AAAA-MM-DD HH:MM:SS' o null
function momento(valor, fechaFila) {
  const s = String(valor == null ? '' : valor).trim();
  if (!s || /^0{4}-0{2}-0{2}/.test(s) || s === '---') return null;
  let m = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (m) return m[1] + ' ' + _pad(+m[2]) + ':' + m[3] + ':' + (m[4] || '00');
  m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  const f = _fechaDe(fechaFila);
  if (m && f) return f + ' ' + _pad(+m[1]) + ':' + m[2] + ':' + (m[3] || '00');
  return null;
}
function segundosDe(v) {
  if (typeof v === 'number' && Number.isFinite(v) && v >= 0) return Math.round(v);
  const m = String(v == null ? '' : v).trim().match(/^(\d{1,4}):(\d{1,2}):(\d{1,2})$/);
  return m ? +m[1] * 3600 + +m[2] * 60 + +m[3] : null;
}
function _valor(fila, clave) {
  for (const k of Object.keys(fila)) if (k.toLowerCase() === clave) return fila[k];
  return undefined;
}

// data de agent_7 -> { dias: Map('fecha|agentId' -> resumen) } o { error } (texto sin valores).
function resumirSesiones(data) {
  if (!Array.isArray(data)) return { error: 'sin lista de datos' };
  const dias = new Map();
  for (const r of data) {
    if (!r || typeof r !== 'object' || Array.isArray(r)) return { error: 'fila que no es un objeto' };
    const agentId = String(_valor(r, 'agent_id') == null ? '' : _valor(r, 'agent_id')).trim();
    const login = momento(_valor(r, 'login'), _valor(r, 'date'));
    if (!/^[A-Za-z0-9_.-]{1,40}$/.test(agentId) || !login) return { error: 'fila sin agent_id o sin login legible' };
    const logout = momento(_valor(r, 'logout'), _valor(r, 'date'));
    const fecha = login.slice(0, 10); // sin turnos nocturnos: el dia lo da el login
    const k = fecha + '|' + agentId;
    const nombre = String(_valor(r, 'agent_name') == null ? '' : _valor(r, 'agent_name')).trim().slice(0, 120);
    const seg = segundosDe(_valor(r, 'login_time'));
    const d = dias.get(k) || { fecha, agentId, agentName: nombre, primerLogin: login, ultimoLogout: null, sesiones: 0, segundos: null };
    if (login < d.primerLogin) d.primerLogin = login;
    if (logout && (!d.ultimoLogout || logout > d.ultimoLogout)) d.ultimoLogout = logout;
    d.sesiones++;
    if (seg !== null) d.segundos = (d.segundos || 0) + seg;
    if (!d.agentName && nombre) d.agentName = nombre;
    dias.set(k, d);
  }
  return { dias };
}

// Reemplaza los dias [desdeDia..hastaDia] de la operacion con el resumen (todo o nada) y mueve el
// «hasta» de los datos. Es una copia que se puede volver a pedir a Wolkvox: no lleva respaldo.
function guardarResumen(db, operacion, desdeDia, hastaDia, dias, hastaMomento, ahoraIso) {
  let n = 0;
  db.transaction(() => {
    db.prepare('DELETE FROM wolkvox_login_diario WHERE operacion = ? AND fecha BETWEEN ? AND ?').run(operacion, desdeDia, hastaDia);
    const ins = db.prepare('INSERT INTO wolkvox_login_diario (operacion, fecha, agentId, agentName, primerLogin, ultimoLogout, sesiones, segundos) VALUES (?,?,?,?,?,?,?,?)');
    for (const d of dias.values()) {
      if (d.fecha < desdeDia || d.fecha > hastaDia) continue;
      ins.run(operacion, d.fecha, d.agentId, d.agentName, d.primerLogin, d.ultimoLogout, d.sesiones, d.segundos);
      n++;
    }
    const prev = db.prepare('SELECT hasta FROM wolkvox_login_hasta WHERE operacion = ?').get(operacion);
    if (!prev || hastaMomento > prev.hasta) {
      db.prepare('INSERT INTO wolkvox_login_hasta (operacion, hasta, actualizado) VALUES (?,?,?) ON CONFLICT(operacion) DO UPDATE SET hasta = excluded.hasta, actualizado = excluded.actualizado').run(operacion, hastaMomento, ahoraIso);
    }
  })();
  return n;
}

// ── Asesoras, enlaces y excepciones ──
function asesorasDe(db, campana) {
  const cfg = config(campana);
  const fuente = cfg ? cfg.asesorasDe : campana;
  return db.prepare("SELECT id, nombre FROM users WHERE rol = 'ASESOR' AND active = 1 AND asesorCampana = ? ORDER BY nombre").all(fuente);
}
function enlaces(db, campana) {
  return db.prepare('SELECT agentId, userId FROM malla_agente_enlace WHERE campana = ?').all(campana);
}
// Agentes vistos en los ultimos 62 dias de la operacion, con su enlace y una sugerencia (nombre
// EXACTO con una sola asesora, nunca por parecido).
function agentes(db, campana, hoy) {
  const cfg = config(campana);
  const desde = _sumarDias(hoy, -62);
  const vistos = db.prepare(`SELECT agentId, MAX(fecha) ultimaFecha, COUNT(*) dias FROM wolkvox_login_diario
                             WHERE operacion = ? AND fecha >= ? GROUP BY agentId`).all(cfg.operacion, desde);
  const nombreDe = db.prepare('SELECT agentName FROM wolkvox_login_diario WHERE operacion = ? AND agentId = ? ORDER BY fecha DESC LIMIT 1');
  const ases = asesorasDe(db, campana);
  const porClave = new Map();
  for (const a of ases) { const k = claveNombre(a.nombre); porClave.set(k, porClave.has(k) ? null : a); }
  const enl = new Map(enlaces(db, campana).map((e) => [e.agentId, e.userId]));
  const usados = new Set(enl.values());
  return vistos.map((v) => {
    const agentName = (nombreDe.get(cfg.operacion, v.agentId) || {}).agentName || '';
    const s = porClave.get(claveNombre(agentName));
    return {
      agentId: v.agentId, agentName, ultimaFecha: v.ultimaFecha, dias: v.dias,
      userId: enl.has(v.agentId) ? enl.get(v.agentId) : null,
      sugerencia: !enl.has(v.agentId) && s && !usados.has(s.id) ? s.id : null,
    };
  }).sort((a, b) => (a.userId === null) - (b.userId === null) || a.agentName.localeCompare(b.agentName));
}
function excepcionesEnRango(db, campana, desde, hasta) {
  return db.prepare(`SELECT e.id, e.userId, e.desde, e.hasta, e.tipo, u.nombre FROM malla_excepciones e LEFT JOIN users u ON u.id = e.userId
                     WHERE e.campana = ? AND e.desde <= ? AND e.hasta >= ? ORDER BY e.desde, u.nombre`).all(campana, hasta, desde);
}

// ── Fechas ──
function _sumarDias(f, n) { const d = new Date(f + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); }
function diasEntre(desde, hasta) { const out = []; for (let f = desde; f <= hasta; f = _sumarDias(f, 1)) out.push(f); return out; }
function _diaSemana(f) { const n = new Date(f + 'T00:00:00Z').getUTCDay(); return n === 0 ? 7 : n; }
function _difSeg(a, b) { return Math.round((Date.parse(a.replace(' ', 'T') + 'Z') - Date.parse(b.replace(' ', 'T') + 'Z')) / 1000); }

// Estado de un dia con turno. Puro (se prueba solo). `hastaDatos`: hasta cuando hay datos de login.
function estadoDelDia({ fecha, turno, enlazado, login, excepcion, ahora, hastaDatos }) {
  const entrada = fecha + ' ' + turno.entrada + ':00';
  const salida = fecha + ' ' + turno.salida + ':00';
  const out = { estado: null, tardeSeg: null, salidaAnticipadaSeg: null };
  if (excepcion) { out.estado = 'excepcion'; return out; }
  if (!enlazado) { out.estado = 'sin_enlace'; return out; }
  if (login) {
    out.estado = login.primerLogin <= entrada ? 'a_tiempo' : 'tarde';
    if (out.estado === 'tarde') out.tardeSeg = _difSeg(login.primerLogin, entrada);
    // Dato aparte: solo con el dia cubierto por los datos hasta la hora de salida.
    if (hastaDatos && hastaDatos >= salida && login.ultimoLogout && login.ultimoLogout < salida) out.salidaAnticipadaSeg = _difSeg(salida, login.ultimoLogout);
    return out;
  }
  // Sin login: solo es «Sin ingreso» si ya paso la hora de entrada Y los datos llegan hasta despues.
  if (ahora < entrada || !hastaDatos || hastaDatos < entrada) { out.estado = 'pendiente'; return out; }
  out.estado = 'sin_ingreso';
  return out;
}

// Puntualidad de una campaña en [desde..hasta] (maximo 31 dias). `soloUserId`: la asesora.
function calcular(db, campana, desde, hasta, opts) {
  opts = opts || {};
  const cfg = config(campana);
  const ahora = opts.ahora; // 'AAAA-MM-DD HH:MM:SS' hora Colombia
  const hastaDatos = (db.prepare('SELECT hasta FROM wolkvox_login_hasta WHERE operacion = ?').get(cfg.operacion) || {}).hasta || null;
  const enl = enlaces(db, campana);
  const agentDe = new Map(enl.map((e) => [e.userId, e.agentId]));
  const userDe = new Map(enl.map((e) => [e.agentId, e.userId]));
  const logins = new Map();
  for (const r of db.prepare('SELECT * FROM wolkvox_login_diario WHERE operacion = ? AND fecha BETWEEN ? AND ?').all(cfg.operacion, desde, hasta)) logins.set(r.fecha + '|' + r.agentId, r);
  const exc = excepcionesEnRango(db, campana, desde, hasta);
  const turnoStmt = db.prepare(`SELECT g.horario, g.nombre grupo FROM malla_grupos g JOIN malla_asignaciones a ON a.grupoId = g.id WHERE g.campana = ? AND g.semana = ? AND a.asesorId = ?`);
  const asesorasSemana = db.prepare(`SELECT DISTINCT u.id, u.nombre FROM malla_grupos g JOIN malla_asignaciones a ON a.grupoId = g.id JOIN users u ON u.id = a.asesorId WHERE g.campana = ? AND g.semana = ?`);
  const filas = [];
  const conTurno = new Set();
  const resumen = { a_tiempo: 0, tarde: 0, sin_ingreso: 0, excepcion: 0, sin_enlace: 0, pendiente: 0, salidaAnticipada: 0 };
  for (const fecha of diasEntre(desde, hasta)) {
    const lunes = L.mallaLunesDe(fecha);
    const n = _diaSemana(fecha);
    let lista = asesorasSemana.all(campana, lunes);
    if (opts.soloUserId) lista = lista.filter((a) => a.id === opts.soloUserId);
    for (const a of lista) {
      const t = turnoStmt.get(campana, lunes, a.id);
      if (!t) continue;
      let h = {};
      try { h = JSON.parse(t.horario); } catch (e) { h = {}; }
      const turno = h[n] || h[String(n)];
      if (!turno) continue;
      const agentId = agentDe.get(a.id) || null;
      const login = agentId ? logins.get(fecha + '|' + agentId) || null : null;
      if (agentId) conTurno.add(fecha + '|' + agentId);
      const e = exc.find((x) => x.userId === a.id && x.desde <= fecha && x.hasta >= fecha) || null;
      const st = estadoDelDia({ fecha, turno, enlazado: !!agentId, login, excepcion: e, ahora, hastaDatos });
      resumen[st.estado]++;
      if (st.salidaAnticipadaSeg) resumen.salidaAnticipada++;
      filas.push({
        userId: a.id, nombre: a.nombre, fecha, grupo: t.grupo, entrada: turno.entrada, salida: turno.salida, estado: st.estado,
        tardeSeg: st.tardeSeg, salidaAnticipadaSeg: st.salidaAnticipadaSeg,
        primerLogin: login ? login.primerLogin.slice(11) : null, ultimoLogout: login && login.ultimoLogout ? login.ultimoLogout.slice(11) : null,
        sesiones: login ? login.sesiones : 0, excepcion: e ? { id: e.id, tipo: e.tipo } : null,
      });
    }
  }
  const out = { campana, desde, hasta, datosHasta: hastaDatos, filas, resumen };
  if (!opts.soloUserId) {
    // Informativo: logins de agentes enlazados en dias sin turno, y agentes sin enlace con login.
    const sinTurno = [], sinEnlace = new Map();
    for (const r of logins.values()) {
      const u = userDe.get(r.agentId);
      if (u === undefined) { const x = sinEnlace.get(r.agentId) || { agentId: r.agentId, agentName: r.agentName, dias: 0 }; x.dias++; sinEnlace.set(r.agentId, x); }
      else if (!conTurno.has(r.fecha + '|' + r.agentId)) sinTurno.push({ userId: u, fecha: r.fecha, primerLogin: r.primerLogin.slice(11) });
    }
    out.conLoginSinTurno = sinTurno;
    out.agentesSinEnlace = [...sinEnlace.values()];
    out.excepciones = exc;
  }
  return out;
}

module.exports = {
  CAMPANAS, TIPOS_EXCEPCION, MAX_DIAS_EXCEPCION, MAX_DIAS_CONSULTA,
  config, campanasConPuntualidad, momento, segundosDe, resumirSesiones, guardarResumen,
  asesorasDe, enlaces, agentes, excepcionesEnRango, diasEntre, estadoDelDia, calcular,
  _configurarParaPruebas: (c) => { _config = c || CAMPANAS; },
};
