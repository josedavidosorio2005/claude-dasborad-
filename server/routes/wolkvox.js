// routes/wolkvox.js — Fase W2 (docs/plan-api-wolkvox.md): «Probar conexión» con Wolkvox.
// SOLO el administrador completo (isFullAdmin) y SOLO en una campaña interna que tenga operacion
// de Wolkvox (las replicas ocultas «MOBILIZE PRUEBAS API» y, desde la Fase N5, «ORLANT PRUEBAS
// API»). Los reales y los demas clientes no tienen nada aqui: para ellos, 404.
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
    // Fase N6: la consulta automática (y «Ejecutar ahora») es de las réplicas (destinos internos):
    // MOBILIZE y, desde la Fase N6, ORLANT (apagada hasta WOLKVOX_ORLANT_AUTO_ACTIVO=1).
    const wvAuto = require('../wolkvox-auto');
    const dest = require('../wolkvox-destinos').destinoInterno(req.query.campana);
    const autoDisponible = !!dest && dest.operacion === op;
    res.json({
      configurado: wv.estaConfigurado(op),
      diagnostico: wv.diagnostico(op), // solo si/no: token encontrado, servidor encontrado, servidor con formato valido
      usoHoy: wv.usoDelDia(db, op),
      tope: wv.topeDiario(),
      limiteLicencia: wv.LIMITE_LICENCIA_DIA,
      fechaSugerida: ayerColombia(),
      reportes: Object.keys(wv.REPORTES),
      reportesNombres: wv.REPORTES, // Fase A5: para la lista de «Probar»
      autoDisponible, // Fase N5
      auto: autoDisponible ? wvAuto.estado(db, undefined, dest) : null, // Fase A1: horarios, interruptor al arrancar, ultima corrida (sin secretos)
      agentesDisponible: autoDisponible && !!(dest && dest.filtros && dest.filtros.agentes), // Fase AU2: lista de agentes de Inconexión
      servidorEncontrado: wv.servidorDe(op) !== null, // Fase N5: basta para el «Diagnóstico de red» (sin token)
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
    // Fase A6: `rango: 'mes'` pide del 1 del mes de ese día hasta ese día (mismo mes, como exige
    // Wolkvox), para ver si un reporte acepta el mes completo en una sola consulta.
    if (b.rango !== undefined && b.rango !== 'dia' && b.rango !== 'mes') return res.status(400).json({ error: 'El rango es «dia» o «mes»', codigo: 'rango' });
    const desdeDia = b.rango === 'mes' ? dia.slice(0, 8) + '01' : dia;
    const dateIni = wv.fechaWolkvox(desdeDia, '00:00:00');
    const dateEnd = wv.fechaWolkvox(dia, '23:59:59');
    // Fase A5: el reporte se elige de la lista cerrada (wv.REPORTES); por defecto skill_1.
    // (nombres de skill en la respuesta solo para los reportes skill_*)
    const api = b.reporte === undefined ? 'skill_1' : b.reporte;
    if (typeof api !== 'string' || !Object.prototype.hasOwnProperty.call(wv.REPORTES, api)) return res.status(400).json({ error: 'Ese reporte no está en la lista', codigo: 'reporte' });
    try {
      const r = await wv.consultarReporte({ db, operacion: op, api, dateIni, dateEnd, fetchImpl: req.app.locals.wolkvoxFetch });
      const s = wv.resumenSinValores(r.cuerpo);
      logEvent('WOLKVOX_PRUEBA', null, actorLabel(req.actor), op + ' · ' + api + ' · ' + (desdeDia !== dia ? desdeDia + ' a ' : '') + dia + ' · ' + r.httpStatus + ' · ' + s.filas + ' filas');
      res.json({ ok: true, reporte: api, dia, desdeDia, desde: '00:00', hasta: '23:59', httpStatus: r.httpStatus, code: s.code, msg: s.msg, filas: s.filas, porDia: wv.filasPorDia(r.cuerpo), campos: s.campos, skills: api.startsWith('skill_') ? wv.nombresDeSkill(r.cuerpo) : [], duracionMs: r.duracionMs, usoHoy: wv.usoDelDia(db, op), tope: wv.topeDiario(), limiteLicencia: wv.LIMITE_LICENCIA_DIA });
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
// Fase AU4 (autorización escrita del usuario, 26/11/2026): la réplica de Aurora espera 2 min entre «Ejecutar ahora»
// (para cargar su histórico de 2026). Sale del destino (`esperaEjecutarMs`); los demás, 10 min como siempre.
const esperaDe = (dest) => (dest && dest.esperaEjecutarMs) || ESPERA_ENTRE_EJECUCIONES_MS;
const _ultimaEjecucion = new Map();
router.post(
  '/wolkvox/auto/ejecutar',
  requireActor,
  wrap(async (req, res) => {
    const b = req.body || {};
    const op = operacionPermitida(req, res, b.campana);
    if (!op) return;
    const wvAuto = require('../wolkvox-auto');
    const D = require('../wolkvox-destinos');
    // Fase N6: solo una réplica (destino interno) de la misma operación; nunca un real.
    const dest = D.destinoInterno(b.campana);
    if (!dest || dest.operacion !== op) return res.status(404).json({ error: 'Esta campaña no tiene consulta automática' });
    const modulo = b.modulo === undefined ? 'flujo' : b.modulo;
    if (modulo !== 'flujo' && modulo !== 'todos' && !Object.prototype.hasOwnProperty.call(require('../wolkvox-modulos').MODULOS, modulo)) return res.status(400).json({ error: 'Ese módulo no existe', codigo: 'parametro' });
    if (modulo !== 'todos' && !D.moduloPermitido(dest, modulo)) return res.status(400).json({ error: 'Ese módulo no está autorizado para esta campaña', codigo: 'parametro' });
    // Fase A20: `mes` (AAAA-MM) pide un mes pasado completo (hasta 12 atrás); «todos» exige mes.
    if (b.mes !== undefined && !wvAuto.planMes(b.mes)) return res.status(400).json({ error: 'mes debe ser AAAA-MM, un mes ya cerrado de los últimos ' + wvAuto.MESES_ATRAS_MAX, codigo: 'parametro' });
    if (modulo === 'todos' && b.mes === undefined) return res.status(400).json({ error: '«todos» necesita un mes', codigo: 'parametro' });
    let maxConsultas;
    if (b.maxConsultas !== undefined) {
      maxConsultas = Number(b.maxConsultas);
      if (!Number.isInteger(maxConsultas) || maxConsultas < 1 || maxConsultas > wvAuto.MAX_CONSULTAS_POR_CORRIDA) return res.status(400).json({ error: 'maxConsultas debe ser un entero de 1 a ' + wvAuto.MAX_CONSULTAS_POR_CORRIDA, codigo: 'parametro' });
    }
    const espera = (_ultimaEjecucion.get(op) || 0) + esperaDe(dest) - Date.now();
    if (espera > 0) return res.status(429).json({ error: 'Espera ' + Math.ceil(espera / 60000) + ' min antes de volver a ejecutar', codigo: 'espera' });
    _ultimaEjecucion.set(op, Date.now());
    const r = await wvAuto.ejecutarAhora({
      db, logEvent, actor: actorLabel(req.actor), maxConsultas, modulo, mes: b.mes, destino: dest,
      fetchImpl: req.app.locals.wolkvoxFetch, leerInterruptor: req.app.locals.wolkvoxInterruptor, leerValor: req.app.locals.wolkvoxValor,
    });
    if (r.estado === 'apagada') return res.status(409).json({ ok: false, codigo: 'apagada', error: r.porLista ? 'El Flujo está apagado (no está «flujo» en ' + dest.modulos + ' en SSM)' : modulo === 'flujo' || modulo === 'todos' || dest !== D.DESTINOS.replica ? 'La consulta automática está apagada (' + dest.interruptor + ' no es 1 en SSM)' : 'El módulo ' + modulo + ' está apagado (no está en ' + dest.modulos + ' en SSM)' });
    if (r.estado === 'no_permitido') return res.status(400).json({ ok: false, codigo: 'parametro', error: 'Ese módulo no está autorizado para esta campaña' });
    if (r.estado === 'ocupada') return res.status(409).json({ ok: false, codigo: 'ocupada', error: 'Ya hay una corrida en curso' });
    if (r.estado === 'sin_interruptor') return res.status(503).json({ ok: false, codigo: 'sin_interruptor', error: 'No se pudo leer el interruptor en SSM; no se consultó' });
    res.json({ ok: r.estado === 'ok', estado: r.estado, error: r.error || null, consultas: r.consultas, meses: r.meses, partes: r.partes, mes: b.mes || null, detalle: r.detalle, usoHoy: wv.usoDelDia(db, op), tope: wv.topeDiario() });
  })
);

// Fase A30 (20/11/2026): llenar a mano un HUECO del MOBILIZE real (lista cerrada HUECOS_REAL de
// wolkvox-destinos.js; autorización escrita del usuario en CLAUDE.md). Solo el administrador; exige
// WOLKVOX_REAL_ACTIVO=1 (leído fresco); una vez cada 10 min; cada pestaña una sola vez y solo si está
// vacía en el real. Responde solo conteos y códigos.
router.post(
  '/wolkvox/real/hueco',
  requireActor,
  wrap(async (req, res) => {
    if (!isFullAdmin(req.actor)) return res.status(403).json({ error: 'Solo el administrador' });
    const b = req.body || {};
    const D = require('../wolkvox-destinos');
    if (typeof b.mes !== 'string' || !Object.prototype.hasOwnProperty.call(D.HUECOS_REAL, b.mes)) return res.status(400).json({ error: 'Ese mes no está en la lista de huecos autorizados', codigo: 'parametro' });
    const clave = 'real-hueco';
    const espera = (_ultimaEjecucion.get(clave) || 0) + ESPERA_ENTRE_EJECUCIONES_MS - Date.now();
    if (espera > 0) return res.status(429).json({ error: 'Espera ' + Math.ceil(espera / 60000) + ' min antes de volver a ejecutar', codigo: 'espera' });
    _ultimaEjecucion.set(clave, Date.now());
    const r = await require('../wolkvox-auto').rellenarHuecoReal({
      db, logEvent, actor: actorLabel(req.actor), mes: b.mes,
      fetchImpl: req.app.locals.wolkvoxFetch, leerInterruptor: req.app.locals.wolkvoxInterruptor,
    });
    if (r.estado === 'apagada') return res.status(409).json({ ok: false, codigo: 'apagada', error: 'El MOBILIZE real está apagado (WOLKVOX_REAL_ACTIVO no es 1 en SSM)' });
    if (r.estado === 'ocupada') return res.status(409).json({ ok: false, codigo: 'ocupada', error: 'Ya hay una corrida en curso' });
    if (r.estado === 'sin_interruptor') return res.status(503).json({ ok: false, codigo: 'sin_interruptor', error: 'No se pudo leer el interruptor en SSM; no se consultó' });
    if (r.estado === 'no_permitido') return res.status(400).json({ ok: false, codigo: 'parametro', error: 'Ese mes no está en la lista de huecos autorizados' });
    res.json({ ok: r.estado === 'ok', estado: r.estado, error: r.error || null, consultas: r.consultas, partes: r.partes, mes: b.mes, detalle: r.detalle, usoHoy: wv.usoDelDia(db, 'MOBILIZE'), tope: wv.topeDiario() });
  })
);

// Fase AU2 (autorización escrita del usuario, 26/11/2026): lista EDITABLE de agentes de Inconexión de la réplica de
// Aurora (solo nombres). Solo el administrador completo y solo un destino interno con filtro de agentes. La
// Tipificación (llamadas y WhatsApp) de la consulta automática solo entra con los agentes elegidos aquí.
function destinoConAgentes(req, res, campana) {
  const op = operacionPermitida(req, res, campana);
  if (!op) return null;
  const D = require('../wolkvox-destinos');
  const dest = D.destinoInterno(campana);
  if (!dest || dest.operacion !== op || !(dest.filtros && dest.filtros.agentes)) { res.status(404).json({ error: 'Esta campaña no tiene lista de agentes' }); return null; }
  return dest;
}
router.get(
  '/wolkvox/agentes',
  requireActor,
  wrap((req, res) => {
    const dest = destinoConAgentes(req, res, req.query.campana);
    if (!dest) return;
    res.json({ campana: dest.campana, agentes: require('../wolkvox-agentes').listar(db, dest.campana) });
  })
);
router.put(
  '/wolkvox/agentes',
  requireActor,
  wrap((req, res) => {
    const b = req.body || {};
    const dest = destinoConAgentes(req, res, b.campana);
    if (!dest) return;
    let r;
    try { r = require('../wolkvox-agentes').guardar(db, dest.campana, b, actorLabel(req.actor)); } catch (e) { return res.status(400).json({ error: e.message, codigo: 'parametro' }); }
    logEvent('WOLKVOX_AGENTES', null, actorLabel(req.actor), dest.campana + ' · ' + r.incluidos + ' de ' + r.total + ' agentes elegidos como de Inconexión');
    res.json(Object.assign({ ok: true }, r, { agentes: require('../wolkvox-agentes').listar(db, dest.campana) }));
  })
);

module.exports = router;
module.exports._reiniciarEspera = () => { _ultimaPrueba.clear(); _ultimoDiagnostico.clear(); _ultimaEjecucion.clear(); }; // solo pruebas
