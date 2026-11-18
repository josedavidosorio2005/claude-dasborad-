// routes/wolkvox.js — Fase W2 (docs/plan-api-wolkvox.md): «Probar conexión» con Wolkvox.
// SOLO el administrador completo (isFullAdmin) y SOLO en una campaña interna que tenga operacion
// de Wolkvox (hoy, la replica oculta «MOBILIZE PRUEBAS API»). El Mobilize real y los demas
// clientes no tienen nada aqui: para ellos, 404.
// La respuesta al navegador trae code, msg, cuantas filas y los NOMBRES de los campos; nunca un
// valor de los datos, ni el token, ni el servidor, ni la URL.
'use strict';
const express = require('express');
const db = require('../db');
const { requireActor, isFullAdmin } = require('../auth');
const { esCampanaInterna } = require('../clientes-registro');
const { fechaLimitesHoyColombia } = require('../fecha-limites');
const { wrap, actorLabel, logEvent } = require('./shared');
const wv = require('../wolkvox');

const router = express.Router();

// Espera minima entre dos pruebas de la misma operacion (cuida las 3000 consultas del dia).
const ESPERA_ENTRE_PRUEBAS_MS = 30000;
const _ultimaPrueba = new Map();

// Valida quien pide y para que campaña. Devuelve la operacion, o responde y devuelve null.
function operacionPermitida(req, res, campana) {
  if (!isFullAdmin(req.actor)) { res.status(403).json({ error: 'Solo el administrador' }); return null; }
  const op = typeof campana === 'string' ? wv.operacionDeCampana(campana) : null;
  if (!op || !esCampanaInterna(db, campana)) { res.status(404).json({ error: 'Esta campaña no tiene conexión con Wolkvox' }); return null; }
  return op;
}

// Ayer en hora Colombia (AAAA-MM-DD).
function ayerColombia(ahora) {
  const d = ahora instanceof Date ? ahora : new Date();
  return fechaLimitesHoyColombia(new Date(d.getTime() - 24 * 60 * 60 * 1000));
}

router.get(
  '/wolkvox/estado',
  requireActor,
  wrap((req, res) => {
    const op = operacionPermitida(req, res, req.query.campana);
    if (!op) return;
    res.json({
      configurado: wv.estaConfigurado(op),
      diagnostico: wv.diagnostico(op), // solo si/no: token encontrado, servidor encontrado, servidor con formato valido
      usoHoy: wv.usoDelDia(db, op),
      tope: wv.topeDiario(),
      limiteLicencia: wv.LIMITE_LICENCIA_DIA,
      fechaSugerida: ayerColombia(),
      reportes: Object.keys(wv.REPORTES),
      reportesNombres: wv.REPORTES, // Fase A5: para la lista de «Probar»
      auto: require('../wolkvox-auto').estado(db), // Fase A1: horarios, interruptor al arrancar, ultima corrida (sin secretos)
    });
  })
);

router.post(
  '/wolkvox/probar',
  requireActor,
  wrap(async (req, res) => {
    const b = req.body || {};
    const op = operacionPermitida(req, res, b.campana);
    if (!op) return;
    const dia = typeof b.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(b.fecha) ? b.fecha : ayerColombia();
    if (dia > fechaLimitesHoyColombia()) return res.status(400).json({ error: 'La fecha no puede ser futura', codigo: 'rango' });
    const antes = _ultimaPrueba.get(op) || 0;
    const espera = antes + ESPERA_ENTRE_PRUEBAS_MS - Date.now();
    if (espera > 0) return res.status(429).json({ error: 'Espera ' + Math.ceil(espera / 1000) + ' s antes de volver a probar', codigo: 'espera' });
    _ultimaPrueba.set(op, Date.now());

    // Fase A2 (18/11): el mismo formato que funcionó desde el PC y que usa la consulta automática:
    // skill_1 del DIA COMPLETO (00:00:00 a 23:59:59). Antes era cdr_1 de 08:00 a 08:59 (404 en prod).
    const dateIni = wv.fechaWolkvox(dia, '00:00:00');
    const dateEnd = wv.fechaWolkvox(dia, '23:59:59');
    // Fase A5: el reporte se elige de la lista cerrada (wv.REPORTES); por defecto skill_1.
    // (nombres de skill en la respuesta solo para los reportes skill_*)
    const api = b.reporte === undefined ? 'skill_1' : b.reporte;
    if (typeof api !== 'string' || !Object.prototype.hasOwnProperty.call(wv.REPORTES, api)) return res.status(400).json({ error: 'Ese reporte no está en la lista', codigo: 'reporte' });
    try {
      const r = await wv.consultarReporte({ db, operacion: op, api, dateIni, dateEnd, fetchImpl: req.app.locals.wolkvoxFetch });
      const s = wv.resumenSinValores(r.cuerpo);
      logEvent('WOLKVOX_PRUEBA', null, actorLabel(req.actor), op + ' · ' + api + ' · ' + dia + ' · ' + r.httpStatus + ' · ' + s.filas + ' filas');
      res.json({ ok: true, reporte: api, dia, desde: '00:00', hasta: '23:59', httpStatus: r.httpStatus, code: s.code, msg: s.msg, filas: s.filas, campos: s.campos, skills: api.startsWith('skill_') ? wv.nombresDeSkill(r.cuerpo) : [], duracionMs: r.duracionMs, usoHoy: wv.usoDelDia(db, op), tope: wv.topeDiario(), limiteLicencia: wv.LIMITE_LICENCIA_DIA });
    } catch (e) {
      if (!(e instanceof wv.WolkvoxError)) throw e;
      // Fase W3: + el codigo de la causa de red (solo el codigo).
      logEvent('WOLKVOX_PRUEBA', null, actorLabel(req.actor), op + ' · ' + api + ' · ' + dia + ' · error ' + e.codigo + (e.causa ? ' (' + e.causa + ')' : '') + (e.httpStatus ? ' ' + e.httpStatus : '') + (e.wolkvoxCode ? ' code ' + e.wolkvoxCode : ''));
      const status = e.codigo === 'sin_configurar' ? 409 : e.codigo === 'tope' || e.codigo === 'limite_wolkvox' ? 429 : e.codigo === 'rango' || e.codigo === 'reporte' ? 400 : 502;
      res.status(status).json({ ok: false, error: e.message, codigo: e.codigo, causa: e.causa || null, httpStatus: e.httpStatus || null, wolkvoxCode: e.wolkvoxCode || null, wolkvoxMsg: e.wolkvoxMsg || null, usoHoy: wv.usoDelDia(db, op), tope: wv.topeDiario(), limiteLicencia: wv.LIMITE_LICENCIA_DIA });
    }
  })
);

// Fase W3 (17/11): «Diagnóstico de red». Mismo permiso que «Probar conexión» (admin + réplica
// interna). Solo DNS, conexión TCP al 443 y saludo TLS: no envía token ni petición HTTP y no
// gasta consultas del día. Una vez cada 30 s. Queda en el Historial (solo códigos).
const _ultimoDiagnostico = new Map();
router.post(
  '/wolkvox/diagnostico-red',
  requireActor,
  wrap(async (req, res) => {
    const b = req.body || {};
    const op = operacionPermitida(req, res, b.campana);
    if (!op) return;
    const espera = (_ultimoDiagnostico.get(op) || 0) + ESPERA_ENTRE_PRUEBAS_MS - Date.now();
    if (espera > 0) return res.status(429).json({ error: 'Espera ' + Math.ceil(espera / 1000) + ' s antes de volver a diagnosticar', codigo: 'espera' });
    _ultimoDiagnostico.set(op, Date.now());
    try {
      const d = await wv.diagnosticarRed({ operacion: op, red: req.app.locals.wolkvoxRed });
      logEvent('WOLKVOX_DIAGNOSTICO_RED', null, actorLabel(req.actor), op + ' · ' + wv.resumenDiagnostico(d));
      res.json(Object.assign({ ok: true }, d));
    } catch (e) {
      if (!(e instanceof wv.WolkvoxError)) throw e;
      res.status(e.codigo === 'sin_configurar' ? 409 : 502).json({ ok: false, error: e.message, codigo: e.codigo });
    }
  })
);

// Fase A3 (18/11): «Ejecutar ahora» de la consulta automatica. Mismo permiso (admin + replica
// interna). Exige el interruptor WOLKVOX_AUTO_ACTIVO=1 (leido fresco de SSM), una vez cada 10 min,
// y `maxConsultas` opcional (1 a 62) como tope de esta corrida. Queda en el Historial
// (WOLKVOX_AUTO, «Ejecutar ahora», con quien la pidio). Responde solo conteos y codigos.
const ESPERA_ENTRE_EJECUCIONES_MS = 10 * 60 * 1000;
const _ultimaEjecucion = new Map();
router.post(
  '/wolkvox/auto/ejecutar',
  requireActor,
  wrap(async (req, res) => {
    const b = req.body || {};
    const op = operacionPermitida(req, res, b.campana);
    if (!op) return;
    const wvAuto = require('../wolkvox-auto');
    if (op !== wvAuto.OPERACION || b.campana !== wvAuto.CAMPANA) return res.status(404).json({ error: 'Esta campaña no tiene consulta automática' });
    let maxConsultas;
    if (b.maxConsultas !== undefined) {
      maxConsultas = Number(b.maxConsultas);
      if (!Number.isInteger(maxConsultas) || maxConsultas < 1 || maxConsultas > wvAuto.MAX_CONSULTAS_POR_CORRIDA) return res.status(400).json({ error: 'maxConsultas debe ser un entero de 1 a ' + wvAuto.MAX_CONSULTAS_POR_CORRIDA, codigo: 'parametro' });
    }
    const espera = (_ultimaEjecucion.get(op) || 0) + ESPERA_ENTRE_EJECUCIONES_MS - Date.now();
    if (espera > 0) return res.status(429).json({ error: 'Espera ' + Math.ceil(espera / 60000) + ' min antes de volver a ejecutar', codigo: 'espera' });
    _ultimaEjecucion.set(op, Date.now());
    const r = await wvAuto.ejecutarAhora({
      db, logEvent, actor: actorLabel(req.actor), maxConsultas,
      fetchImpl: req.app.locals.wolkvoxFetch, leerInterruptor: req.app.locals.wolkvoxInterruptor,
    });
    if (r.estado === 'apagada') return res.status(409).json({ ok: false, codigo: 'apagada', error: 'La consulta automática está apagada (WOLKVOX_AUTO_ACTIVO no es 1 en SSM)' });
    if (r.estado === 'ocupada') return res.status(409).json({ ok: false, codigo: 'ocupada', error: 'Ya hay una corrida en curso' });
    if (r.estado === 'sin_interruptor') return res.status(503).json({ ok: false, codigo: 'sin_interruptor', error: 'No se pudo leer el interruptor en SSM; no se consultó' });
    res.json({ ok: r.estado === 'ok', estado: r.estado, error: r.error || null, consultas: r.consultas, meses: r.meses, detalle: r.detalle, usoHoy: wv.usoDelDia(db, op), tope: wv.topeDiario() });
  })
);

module.exports = router;
module.exports._reiniciarEspera = () => { _ultimaPrueba.clear(); _ultimoDiagnostico.clear(); _ultimaEjecucion.clear(); }; // solo pruebas
