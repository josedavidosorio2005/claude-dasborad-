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

    // Una hora de un dia (08:00 a 08:59:59): pocos registros y siempre dentro del mismo mes.
    const dateIni = wv.fechaWolkvox(dia, '08:00:00');
    const dateEnd = wv.fechaWolkvox(dia, '08:59:59');
    const api = 'cdr_1';
    try {
      const r = await wv.consultarReporte({ db, operacion: op, api, dateIni, dateEnd, fetchImpl: req.app.locals.wolkvoxFetch });
      const s = wv.resumenSinValores(r.cuerpo);
      logEvent('WOLKVOX_PRUEBA', null, actorLabel(req.actor), op + ' · ' + api + ' · ' + dia + ' · ' + r.httpStatus + ' · ' + s.filas + ' filas');
      res.json({ ok: true, reporte: api, dia, desde: '08:00', hasta: '08:59', httpStatus: r.httpStatus, code: s.code, msg: s.msg, filas: s.filas, campos: s.campos, duracionMs: r.duracionMs, usoHoy: wv.usoDelDia(db, op), tope: wv.topeDiario(), limiteLicencia: wv.LIMITE_LICENCIA_DIA });
    } catch (e) {
      if (!(e instanceof wv.WolkvoxError)) throw e;
      logEvent('WOLKVOX_PRUEBA', null, actorLabel(req.actor), op + ' · ' + api + ' · ' + dia + ' · error ' + e.codigo);
      const status = e.codigo === 'sin_configurar' ? 409 : e.codigo === 'tope' || e.codigo === 'limite_wolkvox' ? 429 : e.codigo === 'rango' || e.codigo === 'reporte' ? 400 : 502;
      res.status(status).json({ ok: false, error: e.message, codigo: e.codigo, httpStatus: e.httpStatus || null, usoHoy: wv.usoDelDia(db, op), tope: wv.topeDiario(), limiteLicencia: wv.LIMITE_LICENCIA_DIA });
    }
  })
);

module.exports = router;
module.exports._reiniciarEspera = () => _ultimaPrueba.clear(); // solo pruebas
