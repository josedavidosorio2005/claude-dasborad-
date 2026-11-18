// wolkvox-modulos.js — llenar la réplica «MOBILIZE PRUEBAS API» con la API de Wolkvox, módulo por
// módulo (plan aprobado el 18/11/2026, docs/plan-api-wolkvox.md 10.5). Autorización escrita del
// usuario (CLAUDE.md): solo la réplica, NUNCA el MOBILIZE real; Calidad fuera.
//
// Reglas comunes (las mismas del Flujo, wolkvox-auto.js):
//  - cada módulo se enciende aparte: WOLKVOX_AUTO_MODULOS en SSM, lista separada por comas
//    (p. ej. «flujo_hora,cdr»), leída fresca antes de cada franja; sin la palabra, apagado;
//  - el reporte se convierte a las MISMAS columnas del Excel y pasa por el MISMO lector
//    (public/js/*-logic.js); se escribe con la campaña de la réplica y SIN tocar el mapeo de skills;
//  - todo o nada por mes; respaldo antes de reemplazar; sin reintentos; tope diario de consultas;
//  - filas sin llamadas fuera (decisión del usuario 18/11);
//  - Historial: solo mes, conteos y códigos. Nunca token, servidor, URL, cuerpo ni nombres.
'use strict';

const wv = require('./wolkvox');
const ing = require('./wolkvox-ingesta');
const { respaldarAntesDeCambiar } = require('./cargas-versiones');
const { esCampanaInterna } = require('./clientes-registro');
const FH = require('../public/js/flujo-hora-logic.js');

const CAMPANA = ing.CAMPANA_INGESTA;
const OPERACION = 'MOBILIZE';
const QUIEN = 'Consulta automática Wolkvox';

function _auto() { return require('./wolkvox-auto'); } // carga perezosa (wolkvox-auto también nos carga)

// Valor de una fila sin importar mayúsculas.
function _v(fila, clave) {
  for (const k of Object.keys(fila)) if (k.toLowerCase() === clave) return fila[k];
  return undefined;
}

// Una consulta de un tramo (dentro de un mes). Devuelve la lista `data` o lanza WolkvoxError.
async function _pedir(opts, api, desde, hasta) {
  let cuerpo;
  try {
    cuerpo = (await wv.consultarReporte({
      db: opts.db, operacion: OPERACION, api, env: opts.env, ahora: opts.ahora, fetchImpl: opts.fetchImpl, credenciales: opts.cred,
      dateIni: wv.fechaWolkvox(desde, '00:00:00'), dateEnd: wv.fechaWolkvox(hasta, '23:59:59'),
    })).cuerpo;
  } catch (e) {
    if (e instanceof wv.WolkvoxError && e.httpStatus === 404 && _auto().SIN_REGISTROS.test(e.wolkvoxMsg || '')) return { data: [], cuerpo: { data: [] } };
    throw e;
  }
  let data = cuerpo && cuerpo.data;
  if ((data === undefined || data === null || data === '') && _auto().SIN_REGISTROS.test(String((cuerpo && cuerpo.msg) || ''))) data = [];
  if (!Array.isArray(data)) throw Object.assign(new wv.WolkvoxError('respuesta_invalida', 'Wolkvox respondió sin la lista de datos'), { campos: wv.resumenSinValores(cuerpo).campos });
  return { data, cuerpo };
}

// ── Paso 1: skill_7 → Flujo por hora + AHT y espera del Flujo diario ──
// skill_7 trae una fila por día, hora y skill: date (AAAAMMDD), hour (0–23), skill_name,
// inbound_calls, answer_calls, abandon_calls, wait_time, aht, … Se arma la «hoja» del Excel por hora
// (DATE, HOUR, SKILL_NAME, INBOUND_CALLS, ANSWER_CALLS, ABANDON_CALLS) y pasa por flujoHoraParseFilas.
const COL_FH = ['DATE', 'HOUR', 'SKILL_NAME', 'INBOUND_CALLS', 'ANSWER_CALLS', 'ABANDON_CALLS'];
function hojaFlujoHora(data) {
  return [COL_FH].concat(data.map((r) => COL_FH.map((c) => {
    const v = _v(r || {}, c.toLowerCase());
    return v === undefined || v === null ? '' : v;
  })));
}
// AHT y espera de un día y skill a partir de sus horas: promedio ponderado (AHT por contestadas,
// espera por ingresadas). Solo horas con dato legible. -> Map('fecha|skill' -> { aht, espera })
function ahtEsperaDiarios(data) {
  const acc = new Map();
  const seg = _auto().aSegundos;
  for (const r of data) {
    if (!r || typeof r !== 'object') continue;
    const fecha = FH.flujoHoraParseFecha(_v(r, 'date'));
    const skill = String(_v(r, 'skill_name') == null ? '' : _v(r, 'skill_name')).trim().replace(/\s+/g, ' ');
    if (!fecha || !skill) continue;
    const k = fecha + '|' + skill;
    const a = acc.get(k) || { ahtSum: 0, ahtPeso: 0, espSum: 0, espPeso: 0 };
    const cont = Number(_v(r, 'answer_calls')) || 0;
    const ing2 = Number(_v(r, 'inbound_calls')) || 0;
    const aht = seg(_v(r, 'aht'));
    const esp = seg(_v(r, 'wait_time'));
    if (cont > 0 && Number.isFinite(aht)) { a.ahtSum += aht * cont; a.ahtPeso += cont; }
    if (ing2 > 0 && Number.isFinite(esp)) { a.espSum += esp * ing2; a.espPeso += ing2; }
    acc.set(k, a);
  }
  const out = new Map();
  for (const [k, a] of acc) {
    out.set(k, { aht: a.ahtPeso ? Math.round(a.ahtSum / a.ahtPeso) : null, espera: a.espPeso ? Math.round(a.espSum / a.espPeso) : null });
  }
  return out;
}

function reemplazarMesFlujoHora(db, mes, filas) {
  const desde = mes + '-01', hasta = ing.ultimoDiaDelMes(mes);
  let borradas = 0;
  db.transaction(() => {
    respaldarAntesDeCambiar(db, 'flujo_hora', { campana: CAMPANA, desde, hasta, guardadoPorNombre: QUIEN });
    borradas = db.prepare('DELETE FROM flujo_hora WHERE campana = ? AND fecha BETWEEN ? AND ?').run(CAMPANA, desde, hasta).changes;
    const ins = db.prepare(`INSERT INTO flujo_hora (campana, fecha, hora, skill, ingresadas, contestadas, abandonadas, archivoNombre, cargadoPorNombre, createdAt)
                            VALUES (?,?,?,?,?,?,?,?,?,?)`);
    const ts = new Date().toISOString();
    for (const f of filas) ins.run(CAMPANA, f[0], f[1], f[2], f[3], f[4], f[5], 'API Wolkvox (skill_7)', QUIEN, ts);
  })();
  return borradas;
}

// Pone AHT y espera en las filas del Flujo diario de la réplica que ya existen (las escribe skill_1).
// Con respaldo del mes antes de cambiar. -> cuántas filas se actualizaron.
function actualizarAhtEspera(db, mes, porDia) {
  const desde = mes + '-01', hasta = ing.ultimoDiaDelMes(mes);
  let n = 0;
  db.transaction(() => {
    respaldarAntesDeCambiar(db, 'calidad_nivel_servicio_diario', { campana: CAMPANA, desde, hasta, guardadoPorNombre: QUIEN });
    const up = db.prepare('UPDATE calidad_nivel_servicio_diario SET ahtSegundos = ?, waitTimeSegundos = ? WHERE campana = ? AND fecha = ? AND skillName = ?');
    for (const [k, v] of porDia) {
      const [fecha, skill] = k.split('|');
      if (fecha < desde || fecha > hasta) continue;
      n += up.run(v.aht, v.espera, CAMPANA, fecha, skill).changes;
    }
  })();
  return n;
}

async function correrFlujoHora(opts, partes, res) {
  const meses = _auto().plan(opts.ahora);
  for (const { mes, dias } of meses) {
    res.consultas++;
    const { data, cuerpo } = await _pedir(opts, 'skill_7', dias[0], dias[dias.length - 1]);
    if (!data.length) { partes.push(mes + ': Wolkvox no trajo filas, sin cambios'); continue; }
    const p = FH.flujoHoraParseFilas(hojaFlujoHora(data));
    if (p.error || (p.avisos && p.avisos.length)) {
      res.estado = 'error'; res.error = 'respuesta_invalida';
      partes.push(mes + ': respuesta no esperada (' + (p.avisos && p.avisos.length ? p.avisos.length + ' filas inválidas' : 'faltan columnas') + '; campos: ' + wv.resumenSinValores(cuerpo).campos.join(',').slice(0, 300) + '), sin cambios');
      return;
    }
    const fuera = p.filas.filter((f) => f[0].slice(0, 7) !== mes || f[0] > dias[dias.length - 1]);
    if (fuera.length) { res.estado = 'error'; res.error = 'respuesta_invalida'; partes.push(mes + ': ' + fuera.length + ' filas fuera del rango pedido, sin cambios'); return; }
    const conLlamadas = p.filas.filter((f) => f[3] || f[4] || f[5]);
    if (!conLlamadas.length) { partes.push(mes + ': sin llamadas, sin cambios'); continue; }
    const reemplazadas = reemplazarMesFlujoHora(opts.db, mes, conLlamadas);
    const ahtN = actualizarAhtEspera(opts.db, mes, ahtEsperaDiarios(data));
    res.meses.push({ mes, filas: conLlamadas.length, sinLlamadas: p.filas.length - conLlamadas.length, reemplazadas, ahtEspera: ahtN });
    partes.push(mes + ': ' + conLlamadas.length + ' filas día-hora-skill (' + (p.filas.length - conLlamadas.length) + ' en cero fuera), reemplazó ' + reemplazadas + ', AHT/espera en ' + ahtN + ' filas del Flujo, con respaldo');
  }
}

const MODULOS = {
  flujo_hora: { api: 'skill_7', descripcion: 'Flujo por hora + AHT y espera', correr: correrFlujoHora },
};
function modulosDe(valor) {
  return String(valor == null ? '' : valor).split(',').map((s) => s.trim().toLowerCase()).filter((s) => Object.prototype.hasOwnProperty.call(MODULOS, s));
}

// Una corrida de un módulo (programada o «Ejecutar ahora»). Registro en wolkvox_auto_corridas y
// Historial WOLKVOX_MODULO. Devuelve { estado, consultas, meses, detalle, error? }.
async function correrModulo(nombre, opts) {
  const mod = MODULOS[nombre];
  const { db } = opts;
  const env = opts.env || process.env;
  const ahora = opts.ahora || new Date();
  const A = _auto();
  A.asegurarTablas(db);
  const franja = (opts.franja || 'manual ' + new Date().toISOString()) + ' ' + nombre;
  if (db.prepare('INSERT OR IGNORE INTO wolkvox_auto_corridas (franja, inicio, estado) VALUES (?, ?, ?)').run(franja, new Date().toISOString(), 'corriendo').changes === 0) return { estado: 'ya_corrida', consultas: 0, meses: [] };
  const t0 = Date.now();
  const res = { estado: 'ok', consultas: 0, meses: [] };
  const partes = [];
  const terminar = () => {
    const detalle = (opts.etiqueta ? opts.etiqueta + ' · ' : '') + CAMPANA + ' · ' + nombre + ' (' + mod.api + ') · ' + (partes.join(' · ') || 'nada que pedir') + ' · ' + res.consultas + ' consultas · ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s';
    db.prepare('UPDATE wolkvox_auto_corridas SET fin = ?, estado = ?, consultas = ?, detalle = ? WHERE franja = ?').run(new Date().toISOString(), res.estado, res.consultas, detalle, franja);
    console.log('[wolkvox-modulos] ' + detalle);
    if (typeof opts.logEvent === 'function') { try { opts.logEvent('WOLKVOX_MODULO', null, opts.actor || QUIEN, detalle); } catch (e) { console.error('[wolkvox-modulos] no se pudo escribir en el Historial'); } }
    res.detalle = detalle;
    return res;
  };
  if (!esCampanaInterna(db, CAMPANA)) { res.estado = 'omitida'; partes.push('la réplica no existe'); return terminar(); }
  const cred = opts.credenciales || wv.credenciales(OPERACION, env);
  if (!cred) { res.estado = 'omitida'; partes.push('falta el token o el servidor de Wolkvox'); return terminar(); }
  const meses = A.plan(ahora);
  if (!meses.length) { res.estado = 'omitida'; return terminar(); }
  if (wv.usoDelDia(db, OPERACION, ahora) + meses.length * (mod.consultasPorMes || 1) > wv.topeDiario(env)) { res.estado = 'omitida'; partes.push('no alcanza el tope del día'); return terminar(); }
  try {
    await mod.correr({ db, env, ahora, fetchImpl: opts.fetchImpl, cred }, partes, res);
  } catch (e) {
    if (!(e instanceof wv.WolkvoxError)) throw e;
    res.estado = res.meses.length ? 'parcial' : 'error';
    res.error = e.codigo;
    partes.push('error ' + e.codigo + (e.causa ? ' (' + e.causa + ')' : '') + (e.httpStatus ? ' ' + e.httpStatus : '') + (e.campos ? ' campos: ' + e.campos.join(',').slice(0, 300) : '') + ', sin cambios, sin reintento');
  }
  return terminar();
}

module.exports = { MODULOS, modulosDe, correrModulo, hojaFlujoHora, ahtEsperaDiarios, reemplazarMesFlujoHora, actualizarAhtEspera };
