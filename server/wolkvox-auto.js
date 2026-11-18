// wolkvox-auto.js — Plan A de Wolkvox, fase A1 (18/11/2026): CONSULTA AUTOMATICA desde el
// servidor. Dos veces al dia (7:00 a.m. y 1:00 p.m., hora Colombia) pide `skill_1` un dia por
// consulta, del dia 1 del mes en curso hasta ayer (y, los dias 1 a 3, todo el mes anterior), y
// reemplaza el Flujo de ese mes en la replica oculta «MOBILIZE PRUEBAS API». SOLO esa replica y
// SOLO Flujo (autorizacion escrita del usuario, 18/11, ver CLAUDE.md). AHT y espera NO vienen en
// skill_1: se conservan los del archivo manual (reemplazarMesFlujo con `conservar`).
//
// Reglas:
//  - APAGADA por defecto. Antes de cada corrida se lee el interruptor WOLKVOX_AUTO_ACTIVO en SSM
//    (fresco, no el del arranque): solo con el valor «1» corre. Asi se apaga sin redesplegar.
//    Sin SSM (local) se lee de process.env. Si SSM no responde, NO corre.
//  - Tope: usa el contador diario de wolkvox.js (2.800 por defecto). Si lo que hay que pedir no
//    cabe en lo que queda del dia, no empieza (nunca deja un mes a medias).
//  - Todo o nada por mes: si un dia falla, ese mes NO se reemplaza. Antes de reemplazar, respaldo
//    del mes (Deshacer del Centro de cargas) y la misma validacion de la ingesta del agente.
//  - Si Wolkvox no responde (tiempo agotado, sin conexion, 401/403, 429...), se detiene la
//    corrida en la PRIMERA falla, lo anota y NO reintenta: la proxima oportunidad es la siguiente
//    franja (7:00 o 13:00).
//  - Logs e Historial: solo mes, dias, conteos, codigos y tiempos. Nunca token, servidor, URL,
//    cuerpo de la respuesta ni nombres de skills.
'use strict';

const wv = require('./wolkvox');
const ing = require('./wolkvox-ingesta');
const { esCampanaInterna } = require('./clientes-registro');
const { fechaLimitesHoyColombia } = require('./fecha-limites');

const CAMPANA = ing.CAMPANA_INGESTA; // 'MOBILIZE PRUEBAS API'
const OPERACION = 'MOBILIZE';
const API = 'skill_1';
const HORAS_COLOMBIA = [7, 13];
const ARCHIVO = 'API Wolkvox (consulta automática)';
const QUIEN = 'Consulta automática Wolkvox';
const ACCION_HISTORIAL = 'WOLKVOX_AUTO';
const CONSERVAR = ['ahtSegundos', 'waitTimeSegundos'];
const MAX_CONSULTAS_POR_CORRIDA = 70; // 31 + 31 y margen: nunca mas, pase lo que pase

// ── Fechas (Colombia = UTC-5 fijo, como fecha-limites.js) ──
function horaColombia(ahora) {
  const d = ahora instanceof Date ? ahora : new Date();
  return new Date(d.getTime() - 5 * 3600 * 1000).getUTCHours();
}
// 'AAAA-MM-DD 07' si ahora cae en una franja de consulta (la hora completa), si no null.
function franjaActual(ahora) {
  const h = horaColombia(ahora);
  if (!HORAS_COLOMBIA.includes(h)) return null;
  return fechaLimitesHoyColombia(ahora) + ' ' + String(h).padStart(2, '0');
}
function _mesAnterior(mes) {
  let [y, m] = mes.split('-').map(Number);
  m -= 1; if (m === 0) { m = 12; y -= 1; }
  return y + '-' + String(m).padStart(2, '0');
}
function _diasDe(mes, hastaDia) {
  const out = [];
  for (let d = 1; d <= hastaDia; d++) out.push(mes + '-' + String(d).padStart(2, '0'));
  return out;
}
// [{ mes, dias }]: primero el mes anterior (solo los dias 1 a 3), despues el mes en curso hasta
// AYER (el dia de hoy esta incompleto). El dia 1 el mes en curso no tiene dias que pedir.
function plan(ahora) {
  const hoy = fechaLimitesHoyColombia(ahora);
  const mes = hoy.slice(0, 7);
  const dia = Number(hoy.slice(8, 10));
  const out = [];
  if (dia <= 3) {
    const ant = _mesAnterior(mes);
    out.push({ mes: ant, dias: _diasDe(ant, Number(ing.ultimoDiaDelMes(ant).slice(8, 10))) });
  }
  if (dia > 1) out.push({ mes, dias: _diasDe(mes, dia - 1) });
  return out;
}

// ── Conversion de una fila de skill_1 a una fila del Flujo ──
// Los nombres de campo se buscan sin importar mayusculas, con alternativas (Wolkvox no publica
// el esquema de skill_1; B0 vio estos nombres en skill_3). Si falta skill, total o contestadas,
// la respuesta no sirve y el mes no se toca.
const CAMPOS = {
  skillName: ['skill_name', 'skill', 'name_skill', 'skillname', 'skill_description'],
  totalLlamadas: ['inbound_calls', 'calls_inbound', 'received_calls', 'total_calls', 'calls'],
  contestadas: ['answer_calls', 'answered_calls', 'calls_answered', 'attended_calls'],
  llamadasAbandonadas: ['abandon_calls', 'abandoned_calls', 'calls_abandon', 'calls_abandoned'],
  serviceLevel10secPct: ['service_level_10seg', 'service_level_10sec', 'service_level_10'], // Fase A4
  serviceLevel20secPct: ['service_level_20seg', 'service_level_20sec', 'service_level_20', 'service_level'],
  serviceLevel30secPct: ['service_level_30seg', 'service_level_30sec', 'service_level_30'], // Fase A4
  abandonPct: ['abandon', 'abandon_pct', 'abandon_percentage', 'abandonment'],
  asaSegundos: ['asa'],
  ataSegundos: ['ata'],
};
function _valor(fila, claves) {
  const porMinuscula = {};
  for (const k of Object.keys(fila)) porMinuscula[k.toLowerCase()] = fila[k];
  for (const c of claves) if (porMinuscula[c] !== undefined && porMinuscula[c] !== null && porMinuscula[c] !== '') return porMinuscula[c];
  return undefined;
}
function aEntero(v) {
  if (typeof v === 'number') return Number.isInteger(v) && v >= 0 ? v : NaN;
  if (typeof v !== 'string' || !/^\s*\d{1,9}\s*$/.test(v)) return NaN;
  return Number(v);
}
// «75.3 %», «75,3%», 75.3 -> 75.3
function aPorcentaje(v) {
  if (typeof v === 'number') return v;
  if (typeof v !== 'string') return NaN;
  const m = v.trim().match(/^(\d{1,3}(?:[.,]\d+)?)\s*%?$/);
  return m ? Number(m[1].replace(',', '.')) : NaN;
}
// «0:1:5», «00:01:05», 65 -> segundos
function aSegundos(v) {
  if (typeof v === 'number') return v;
  if (typeof v !== 'string') return NaN;
  const s = v.trim();
  if (/^\d+(\.\d+)?$/.test(s)) return Number(s);
  const m = s.match(/^(\d{1,4}):(\d{1,2}):(\d{1,2})$/);
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : NaN;
}
// -> { fila } | { omitida: true } (fila de total, sin skill) | { error }
function convertirFila(r, dia) {
  if (!r || typeof r !== 'object' || Array.isArray(r)) return { error: 'fila que no es un objeto' };
  const nombre = _valor(r, CAMPOS.skillName);
  const skillName = typeof nombre === 'string' ? nombre.trim() : nombre === undefined ? '' : String(nombre).trim();
  if (!skillName) return { omitida: true };
  const fila = { fecha: dia, skillName };
  const total = aEntero(_valor(r, CAMPOS.totalLlamadas));
  const cont = aEntero(_valor(r, CAMPOS.contestadas));
  if (Number.isNaN(total) || Number.isNaN(cont)) return { error: 'sin llamadas recibidas o contestadas' };
  fila.totalLlamadas = total;
  fila.contestadas = cont;
  const opc = [
    ['llamadasAbandonadas', aEntero], ['serviceLevel10secPct', aPorcentaje], ['serviceLevel20secPct', aPorcentaje], ['serviceLevel30secPct', aPorcentaje], ['abandonPct', aPorcentaje],
    ['asaSegundos', aSegundos], ['ataSegundos', aSegundos],
  ];
  for (const [campo, conv] of opc) {
    const v = _valor(r, CAMPOS[campo]);
    if (v === undefined) continue;
    const n = conv(v);
    if (!Number.isNaN(n)) fila[campo] = n; // un valor ilegible queda vacio (como en el Excel), nunca inventado
  }
  return { fila };
}

// Mensaje de Wolkvox que dice «sin registros» (en 200 sin `data`, o en un 404).
const SIN_REGISTROS = /no\s+(records|data|results)|0\s+records|sin\s+(registros|datos)/i;
// Respuesta de un dia -> { filas, omitidas, sinLlamadas } o lanza WolkvoxError('respuesta_invalida').
// Fase A4 (decision del usuario, 18/11): las filas con 0 llamadas se descartan (no se excluye
// ninguna skill por nombre: si una empieza a recibir llamadas, aparece sola).
function filasDelDia(cuerpo, dia) {
  let data = cuerpo && cuerpo.data;
  if (data === undefined || data === null || data === '') {
    // Dia sin llamadas: Wolkvox puede no mandar `data`. Solo se acepta si lo dice el mensaje.
    const msg = cuerpo && typeof cuerpo.msg === 'string' ? cuerpo.msg : '';
    if (SIN_REGISTROS.test(msg)) data = [];
  }
  if (!Array.isArray(data)) throw new wv.WolkvoxError('respuesta_invalida', 'Wolkvox respondió sin la lista de datos');
  const filas = [];
  let omitidas = 0, sinLlamadas = 0;
  for (const r of data) {
    const c = convertirFila(r, dia);
    if (c.error) {
      const e = new wv.WolkvoxError('respuesta_invalida', 'Una fila de Wolkvox no trae los campos esperados (' + c.error + ')');
      e.campos = wv.resumenSinValores(cuerpo).campos; // solo NOMBRES de campos, para ajustar el lector
      throw e;
    }
    if (c.omitida) omitidas++;
    else if (c.fila.totalLlamadas === 0) sinLlamadas++;
    else filas.push(c.fila);
  }
  return { filas, omitidas, sinLlamadas };
}

// ── Registro de corridas ──
function asegurarTablas(db) {
  wv.asegurarTablas(db);
  db.exec(`CREATE TABLE IF NOT EXISTS wolkvox_auto_corridas (
    franja TEXT PRIMARY KEY,       -- 'AAAA-MM-DD HH' hora Colombia, o 'manual <ts>'
    inicio TEXT NOT NULL,
    fin TEXT,
    estado TEXT NOT NULL,          -- corriendo | ok | error | parcial | omitida
    consultas INTEGER NOT NULL DEFAULT 0,
    detalle TEXT
  )`);
}
function franjaYaCorrida(db, franja) {
  asegurarTablas(db);
  return !!db.prepare('SELECT 1 FROM wolkvox_auto_corridas WHERE franja = ?').get(franja);
}
function ultimaCorrida(db) {
  asegurarTablas(db);
  return db.prepare('SELECT franja, inicio, fin, estado, consultas, detalle FROM wolkvox_auto_corridas ORDER BY inicio DESC LIMIT 1').get() || null;
}

// ── Interruptor ──
function _activo(valor) { return typeof valor === 'string' && valor.trim() === '1'; }
// Lee WOLKVOX_AUTO_ACTIVO fresco de SSM (mismo camino y permiso que bootstrap: por prefijo).
// Sin SSM_PARAM_PREFIX (local), de process.env. Lanza si SSM falla: quien llama NO corre.
// Fase 363: `nombre` permite leer otro interruptor (WOLKVOX_LOGIN_ACTIVO, agent_7).
async function leerInterruptor(env, nombre) {
  env = env || process.env;
  nombre = nombre || 'WOLKVOX_AUTO_ACTIVO';
  if (!/^WOLKVOX_[A-Z_]{1,40}$/.test(nombre)) return false;
  const prefix = env.SSM_PARAM_PREFIX;
  if (!prefix) return _activo(env[nombre]);
  const { SSMClient, GetParametersByPathCommand } = require('@aws-sdk/client-ssm');
  const client = new SSMClient({ region: env.AWS_REGION || env.AWS_DEFAULT_REGION || 'us-east-1' });
  const conBarra = prefix.endsWith('/') ? prefix : prefix + '/';
  let siguiente, valor;
  do {
    const out = await client.send(new GetParametersByPathCommand({ Path: conBarra, WithDecryption: true, Recursive: false, MaxResults: 10, NextToken: siguiente }));
    for (const p of out.Parameters || []) if (p.Name === conBarra + nombre) valor = p.Value;
    siguiente = out.NextToken;
  } while (siguiente);
  return _activo(valor);
}

// ── Una corrida ──
function _logHistorial(logEvent, detalle, actor) {
  console.log('[wolkvox-auto] ' + detalle);
  if (typeof logEvent === 'function') {
    try { logEvent(ACCION_HISTORIAL, null, actor || QUIEN, detalle); } catch (e) { console.error('[wolkvox-auto] no se pudo escribir en el Historial'); }
  }
}

// opts: { db, env, ahora, fetchImpl, logEvent, franja, credenciales (pruebas) }
// Devuelve { estado, consultas, meses: [{ mes, estado, ... }], error? }.
async function correrUnaVez(opts) {
  const { db } = opts;
  const env = opts.env || process.env;
  const ahora = opts.ahora || new Date();
  const franja = opts.franja || 'manual ' + new Date().toISOString();
  asegurarTablas(db);
  const iniciar = db.prepare('INSERT OR IGNORE INTO wolkvox_auto_corridas (franja, inicio, estado) VALUES (?, ?, ?)');
  if (iniciar.run(franja, new Date().toISOString(), 'corriendo').changes === 0) return { estado: 'ya_corrida', consultas: 0, meses: [] };
  const t0 = Date.now();
  const res = { estado: 'ok', consultas: 0, meses: [] };
  const partes = [];

  const terminar = () => {
    const seg = ((Date.now() - t0) / 1000).toFixed(1);
    const detalle = (opts.etiqueta ? opts.etiqueta + ' · ' : '') + CAMPANA + ' · ' + API + ' · ' + (partes.join(' · ') || 'nada que pedir') + ' · ' + res.consultas + ' consultas · ' + seg + ' s';
    db.prepare('UPDATE wolkvox_auto_corridas SET fin = ?, estado = ?, consultas = ?, detalle = ? WHERE franja = ?').run(new Date().toISOString(), res.estado, res.consultas, detalle, franja);
    _logHistorial(opts.logEvent, detalle, opts.actor);
    res.detalle = detalle;
    return res;
  };

  if (!esCampanaInterna(db, CAMPANA)) { res.estado = 'omitida'; partes.push('la réplica no existe'); return terminar(); }
  const cred = opts.credenciales || wv.credenciales(OPERACION, env);
  if (!cred) { res.estado = 'omitida'; partes.push('falta el token o el servidor de Wolkvox'); return terminar(); }

  const meses = plan(ahora);
  const necesarias = meses.reduce((n, m) => n + m.dias.length, 0);
  if (!necesarias) { res.estado = 'omitida'; return terminar(); }
  const maximo = Math.min(MAX_CONSULTAS_POR_CORRIDA, Number.isInteger(opts.maxConsultas) && opts.maxConsultas > 0 ? opts.maxConsultas : MAX_CONSULTAS_POR_CORRIDA);
  if (necesarias > maximo) { res.estado = 'omitida'; partes.push('demasiadas consultas (' + necesarias + ')'); return terminar(); }
  const usadas = wv.usoDelDia(db, OPERACION, ahora);
  const tope = wv.topeDiario(env);
  if (usadas + necesarias > tope) {
    res.estado = 'omitida';
    partes.push('no alcanza el tope del día (' + usadas + ' de ' + tope + ' usadas, faltan ' + necesarias + ')');
    return terminar();
  }

  for (const { mes, dias } of meses) {
    const filas = [];
    let omitidas = 0, sinLlamadas = 0;
    try {
      for (const dia of dias) {
        res.consultas++;
        let cuerpo;
        try {
          cuerpo = (await wv.consultarReporte({
            db, operacion: OPERACION, api: API, env, ahora, fetchImpl: opts.fetchImpl, credenciales: cred,
            dateIni: wv.fechaWolkvox(dia, '00:00:00'), dateEnd: wv.fechaWolkvox(dia, '23:59:59'),
          })).cuerpo;
        } catch (e) {
          // Fase A2: un 404 cuyo mensaje dice «sin registros» es un dia sin llamadas, no una falla.
          if (e instanceof wv.WolkvoxError && e.httpStatus === 404 && SIN_REGISTROS.test(e.wolkvoxMsg || '')) cuerpo = { data: [] };
          else throw e;
        }
        const d = filasDelDia(cuerpo, dia);
        omitidas += d.omitidas;
        sinLlamadas += d.sinLlamadas;
        filas.push(...d.filas);
      }
    } catch (e) {
      if (!(e instanceof wv.WolkvoxError)) throw e;
      // Primera falla: se detiene TODO (no se sigue con otros dias ni meses) y no se reintenta.
      res.estado = res.meses.some((m) => m.estado === 'ok') ? 'parcial' : 'error';
      res.error = e.codigo;
      res.meses.push({ mes, estado: 'error', codigo: e.codigo });
      partes.push(mes + ': error ' + e.codigo + (e.causa ? ' (' + e.causa + ')' : '') + (e.httpStatus ? ' ' + e.httpStatus : '') +
        (e.campos ? ' campos: ' + e.campos.join(',').slice(0, 300) : '') + ', mes sin cambios, sin reintento');
      return terminar();
    }
    const v = ing.validarCuerpo({ reporte: 'flujo', mes, filas });
    if (v.error) {
      res.meses.push({ mes, estado: filas.length ? 'invalido' : 'sin_filas' });
      partes.push(mes + ': ' + (filas.length ? 'no pasó la validación (' + v.error + ')' : 'Wolkvox no trajo filas con llamadas' + (sinLlamadas ? ' (' + sinLlamadas + ' en cero)' : '')) + ', mes sin cambios');
      if (filas.length) res.estado = 'error';
      continue;
    }
    const w = ing.reemplazarMesFlujo(db, { mes, filas: v.filas, cargadoPorNombre: QUIEN, archivoNombre: ARCHIVO, conservar: CONSERVAR });
    res.meses.push({ mes, estado: 'ok', dias: dias.length, sinLlamadas, filas: w.filas, skills: w.skills, reemplazadas: w.reemplazadas, conservados: w.conservados });
    partes.push(mes + ': ' + dias.length + ' días, ' + w.filas + ' filas, ' + w.skills + ' skills, reemplazó ' + w.reemplazadas +
      (w.conservados ? ', ' + w.conservados + ' AHT/espera del archivo' : '') + (omitidas ? ', ' + omitidas + ' filas de total omitidas' : '') + (sinLlamadas ? ', ' + sinLlamadas + ' filas sin llamadas descartadas' : '') + ', con respaldo');
  }
  return terminar();
}

// ── Fase 363 (Malla fase 2): login/logout de los agentes (agent_7) ──
// Autorizacion escrita del usuario (18/11): solo para la replica «MOBILIZE PRUEBAS API» al
// principio. Interruptor propio WOLKVOX_LOGIN_ACTIVO=1 (SSM). Una consulta por tramo: del 1 del mes
// en curso hasta AHORA (los logins de hoy cuentan) y, los dias 1 a 3, todo el mes anterior. Todo o
// nada por tramo; sin reintentos; Historial WOLKVOX_LOGIN solo con conteos.
const API_LOGIN = 'agent_7';
function planLogin(ahora) {
  ahora = ahora || new Date();
  const hoy = fechaLimitesHoyColombia(ahora);
  const d = new Date(ahora.getTime() - 5 * 3600 * 1000);
  const hora = String(d.getUTCHours()).padStart(2, '0') + ':' + String(d.getUTCMinutes()).padStart(2, '0') + ':' + String(d.getUTCSeconds()).padStart(2, '0');
  const mes = hoy.slice(0, 7);
  const out = [];
  if (Number(hoy.slice(8, 10)) <= 3) {
    const ant = _mesAnterior(mes);
    out.push({ mes: ant, desde: ant + '-01', hasta: ing.ultimoDiaDelMes(ant), hastaMomento: ing.ultimoDiaDelMes(ant) + ' 23:59:59' });
  }
  out.push({ mes, desde: mes + '-01', hasta: hoy, hastaMomento: hoy + ' ' + hora });
  return out;
}
async function correrLogin(opts) {
  const P = require('./puntualidad');
  const { db } = opts;
  const env = opts.env || process.env;
  const ahora = opts.ahora || new Date();
  const franja = (opts.franja || 'manual ' + new Date().toISOString()) + ' login';
  asegurarTablas(db);
  if (db.prepare('INSERT OR IGNORE INTO wolkvox_auto_corridas (franja, inicio, estado) VALUES (?, ?, ?)').run(franja, new Date().toISOString(), 'corriendo').changes === 0) return { estado: 'ya_corrida', consultas: 0 };
  const t0 = Date.now();
  const res = { estado: 'ok', consultas: 0, tramos: [] };
  const partes = [];
  const terminar = () => {
    const detalle = (opts.etiqueta ? opts.etiqueta + ' · ' : '') + CAMPANA + ' · ' + API_LOGIN + ' · ' + (partes.join(' · ') || 'nada que pedir') + ' · ' + res.consultas + ' consultas · ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s';
    db.prepare('UPDATE wolkvox_auto_corridas SET fin = ?, estado = ?, consultas = ?, detalle = ? WHERE franja = ?').run(new Date().toISOString(), res.estado, res.consultas, detalle, franja);
    console.log('[wolkvox-auto] ' + detalle);
    if (typeof opts.logEvent === 'function') { try { opts.logEvent('WOLKVOX_LOGIN', null, opts.actor || QUIEN, detalle); } catch (e) { console.error('[wolkvox-auto] no se pudo escribir en el Historial'); } }
    res.detalle = detalle;
    return res;
  };
  const cfg = P.config(CAMPANA);
  if (!cfg || !esCampanaInterna(db, CAMPANA)) { res.estado = 'omitida'; partes.push('la réplica no existe o no tiene puntualidad'); return terminar(); }
  const cred = opts.credenciales || wv.credenciales(cfg.operacion, env);
  if (!cred) { res.estado = 'omitida'; partes.push('falta el token o el servidor de Wolkvox'); return terminar(); }
  const tramos = planLogin(ahora);
  if (wv.usoDelDia(db, cfg.operacion, ahora) + tramos.length > wv.topeDiario(env)) { res.estado = 'omitida'; partes.push('no alcanza el tope del día'); return terminar(); }
  for (const t of tramos) {
    let cuerpo;
    try {
      res.consultas++;
      cuerpo = (await wv.consultarReporte({
        db, operacion: cfg.operacion, api: API_LOGIN, env, ahora, fetchImpl: opts.fetchImpl, credenciales: cred,
        dateIni: wv.fechaWolkvox(t.desde, '00:00:00'), dateEnd: wv.fechaWolkvox(t.hasta, t.hastaMomento.slice(11)),
      })).cuerpo;
    } catch (e) {
      if (!(e instanceof wv.WolkvoxError)) throw e;
      if (e.httpStatus === 404 && SIN_REGISTROS.test(e.wolkvoxMsg || '')) cuerpo = { data: [] };
      else {
        res.estado = res.tramos.length ? 'parcial' : 'error';
        res.error = e.codigo;
        partes.push(t.mes + ': error ' + e.codigo + (e.causa ? ' (' + e.causa + ')' : '') + (e.httpStatus ? ' ' + e.httpStatus : '') + ', sin cambios, sin reintento');
        return terminar();
      }
    }
    let data = cuerpo && cuerpo.data;
    if ((data === undefined || data === null || data === '') && SIN_REGISTROS.test(String((cuerpo && cuerpo.msg) || ''))) data = [];
    const r = P.resumirSesiones(data);
    if (r.error) {
      res.estado = 'error';
      res.error = 'respuesta_invalida';
      partes.push(t.mes + ': respuesta no esperada (' + r.error + '; campos: ' + wv.resumenSinValores(cuerpo).campos.join(',').slice(0, 300) + '), sin cambios');
      return terminar();
    }
    // Sin sesiones: no se toca lo guardado ni se mueve el «hasta» (como el Flujo con un mes vacío);
    // si no, un día sin datos de Wolkvox se vería como «Sin ingreso».
    if (!r.dias.size) { res.tramos.push({ mes: t.mes, filas: 0, agentes: 0, sesiones: 0 }); partes.push(t.mes + ': Wolkvox no trajo sesiones, sin cambios'); continue; }
    const n = P.guardarResumen(db, cfg.operacion, t.desde, t.hasta, r.dias, t.hastaMomento, new Date().toISOString());
    const agentesN = new Set([...r.dias.values()].map((x) => x.agentId)).size;
    const sesiones = [...r.dias.values()].reduce((s, x) => s + x.sesiones, 0);
    res.tramos.push({ mes: t.mes, filas: n, agentes: agentesN, sesiones });
    partes.push(t.mes + ': ' + sesiones + ' sesiones, ' + agentesN + ' agentes, ' + n + ' agente-días');
  }
  return terminar();
}

// Candado comun: el programador y «Ejecutar ahora» nunca corren a la vez.
let _enCurso = false;

// ── Fase A3 (18/11): «Ejecutar ahora» (solo admin, desde la ruta) ──
// Misma corrida que la programada (mismo plan, tope, validacion, respaldo y sin reintentos), pero
// cuando la pide el administrador. Exige el interruptor encendido (leido fresco) y respeta el
// candado. `maxConsultas`: tope de ESTA corrida (si el plan necesita mas, no empieza).
// Devuelve el resultado de correrUnaVez, o { estado: 'ocupada' | 'apagada' | 'sin_interruptor' }.
async function ejecutarAhora(opts) {
  if (_enCurso) return { estado: 'ocupada' };
  _enCurso = true;
  try {
    const env = opts.env || process.env;
    let activo;
    try { activo = await (opts.leerInterruptor || leerInterruptor)(env); } catch (e) { return { estado: 'sin_interruptor' }; }
    if (!activo) return { estado: 'apagada' };
    return await correrUnaVez({
      db: opts.db, env, ahora: opts.ahora, fetchImpl: opts.fetchImpl, logEvent: opts.logEvent,
      franja: 'manual ' + new Date().toISOString(), etiqueta: 'Ejecutar ahora', actor: opts.actor, maxConsultas: opts.maxConsultas,
    });
  } finally {
    _enCurso = false;
  }
}

// ── Programador: revisa cada minuto si toca una franja ──
// deps (pruebas): { reloj, leerInterruptor, fetchImpl, logEvent, env, cadaMs }
function iniciar(db, deps) {
  deps = deps || {};
  const env = deps.env || process.env;
  const reloj = deps.reloj || (() => new Date());
  const leer = deps.leerInterruptor || leerInterruptor;
  const revisadas = new Set();
  async function tick() {
    if (_enCurso) return null;
    const ahora = reloj();
    const franja = franjaActual(ahora);
    if (!franja || revisadas.has(franja)) return null;
    revisadas.add(franja); // una sola revision por franja, este o no encendida
    if (revisadas.size > 20) revisadas.delete(revisadas.values().next().value);
    if (franjaYaCorrida(db, franja)) return null;
    _enCurso = true;
    try {
      let activo = false;
      try { activo = await leer(env); } catch (e) {
        console.error('[wolkvox-auto] no se pudo leer el interruptor en SSM (' + (e && e.name ? String(e.name).slice(0, 60) : 'error') + '); no se consulta');
        return null;
      }
      let r = null;
      if (activo) r = await correrUnaVez({ db, env, ahora, franja, fetchImpl: deps.fetchImpl, logEvent: deps.logEvent });
      // Fase 363: login de agentes (agent_7), con su propio interruptor. Apagado: no deja rastro.
      let login = false;
      try { login = await leer(env, 'WOLKVOX_LOGIN_ACTIVO'); } catch (e) { login = false; }
      if (login) await correrLogin({ db, env, ahora, franja, fetchImpl: deps.fetchImpl, logEvent: deps.logEvent });
      return r;
    } catch (e) {
      console.error('[wolkvox-auto] error inesperado en la corrida (' + (e && e.name ? String(e.name).slice(0, 60) : 'error') + ')');
      return null;
    } finally {
      _enCurso = false;
    }
  }
  const t = setInterval(() => { tick(); }, deps.cadaMs || 60 * 1000);
  t.unref();
  return { detener: () => clearInterval(t), tick };
}

// Para /wolkvox/estado (solo admin): horarios, interruptor al arrancar y la ultima corrida.
function estado(db, env) {
  env = env || process.env;
  return {
    horariosColombia: HORAS_COLOMBIA.map((h) => String(h).padStart(2, '0') + ':00'),
    reporte: API,
    activoAlArrancar: _activo(env.WOLKVOX_AUTO_ACTIVO),
    ultimaCorrida: ultimaCorrida(db),
  };
}

module.exports = {
  CAMPANA, OPERACION, API, HORAS_COLOMBIA, ARCHIVO, QUIEN, ACCION_HISTORIAL, MAX_CONSULTAS_POR_CORRIDA,
  horaColombia, franjaActual, plan, convertirFila, filasDelDia, aPorcentaje, aSegundos, aEntero,
  asegurarTablas, franjaYaCorrida, ultimaCorrida, leerInterruptor, correrUnaVez, iniciar, estado, ejecutarAhora, correrLogin, planLogin, API_LOGIN,
};
