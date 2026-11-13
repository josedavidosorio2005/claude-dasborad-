// wolkvox.js — Fase W2 (docs/plan-api-wolkvox.md): cliente de la API de Wolkvox, SOLO en el
// servidor y por ahora SOLO para la replica oculta «MOBILIZE PRUEBAS API».
//
// Reglas:
//  - El token y el servidor salen de process.env (WOLKVOX_<OPERACION>_TOKEN y
//    WOLKVOX_<OPERACION>_SERVIDOR). En produccion los pone ahi bootstrap.js desde AWS SSM
//    (secrets.js). En local (NODE_ENV=development) se pueden leer de un archivo ignorado por git,
//    server/data/wolkvox.local.env. En pruebas (NODE_ENV=test) nunca se lee ese archivo y nunca
//    se llama a la red: hay que inyectar `fetchImpl` y las credenciales.
//  - El token va SOLO en el encabezado `wolkvox-token`. Nunca se registra la URL, el token, el
//    servidor ni el cuerpo de la respuesta; los errores son textos fijos.
//  - Tiempo maximo de espera por consulta, fechas AAAAMMDDHHMMSS dentro del MISMO mes (lo exige
//    la API), y un contador de consultas por dia (hora Colombia) con un tope propio menor que el
//    limite de la licencia (3000 por dia por token), para dejar margen a las pruebas de Postman.
'use strict';

const fs = require('fs');
const path = require('path');
const { fechaLimitesHoyColombia } = require('./fecha-limites');

const LIMITE_LICENCIA_DIA = 3000;
const TOPE_POR_DEFECTO = 2800;
const TIEMPO_MAXIMO_POR_DEFECTO_MS = 30000;
const ARCHIVO_LOCAL = path.join(__dirname, 'data', 'wolkvox.local.env');

// Reportes que el cliente sabe pedir (se agregan uno por uno en las fases W3+).
const REPORTES = { cdr_1: 'Detalle de las llamadas (CDR)' };

// Campaña de la plataforma -> operacion de Wolkvox (de quien es el token). SOLO la replica.
const OPERACION_DE_CAMPANA = { 'MOBILIZE PRUEBAS API': 'MOBILIZE' };

class WolkvoxError extends Error {
  constructor(codigo, mensaje, httpStatus) {
    super(mensaje);
    this.name = 'WolkvoxError';
    this.codigo = codigo;
    if (httpStatus) this.httpStatus = httpStatus;
  }
}

// ── Credenciales (nunca salen de este modulo) ──
let _archivoLocalLeido = false;
function _cargarArchivoLocal(env) {
  if (_archivoLocalLeido) return;
  _archivoLocalLeido = true;
  if ((env.NODE_ENV || 'development') !== 'development') return;
  let texto;
  try { texto = fs.readFileSync(ARCHIVO_LOCAL, 'utf8'); } catch (e) { return; }
  for (const linea of texto.split(/\r?\n/)) {
    const m = linea.match(/^\s*(WOLKVOX_[A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!m) continue;
    const valor = m[2].replace(/^(['"])(.*)\1$/, '$2');
    if (valor && (env[m[1]] === undefined || env[m[1]] === '')) env[m[1]] = valor;
  }
}

function _operacionValida(op) { return typeof op === 'string' && /^[A-Z0-9_]{1,40}$/.test(op); }

// { token, servidor } o null. `servidor` es solo el nombre corto (letras, numeros y guiones):
// nunca una URL, para que nadie pueda desviar la consulta a otro dominio.
function credenciales(operacion, env) {
  env = env || process.env;
  if (!_operacionValida(operacion)) return null;
  _cargarArchivoLocal(env);
  const token = env['WOLKVOX_' + operacion + '_TOKEN'];
  const servidor = env['WOLKVOX_' + operacion + '_SERVIDOR'];
  if (!token || !servidor) return null;
  if (!/^[a-z0-9-]{1,40}$/i.test(servidor)) return null;
  if (/[\r\n]/.test(token)) return null;
  return { token, servidor };
}
function estaConfigurado(operacion, env) { return credenciales(operacion, env) !== null; }

// ── Fechas: AAAAMMDDHHMMSS, 24 h, dentro del mismo mes ──
function _parteFecha(s) {
  if (typeof s !== 'string' || !/^\d{14}$/.test(s)) return null;
  const y = +s.slice(0, 4), mo = +s.slice(4, 6), d = +s.slice(6, 8), h = +s.slice(8, 10), mi = +s.slice(10, 12), se = +s.slice(12, 14);
  if (mo < 1 || mo > 12 || d < 1 || h > 23 || mi > 59 || se > 59) return null;
  const diasMes = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  if (d > diasMes) return null;
  return { y, mo };
}
// null si el rango sirve; si no, el motivo (texto para el administrador, sin datos).
function errorRango(dateIni, dateEnd) {
  const a = _parteFecha(dateIni), b = _parteFecha(dateEnd);
  if (!a || !b) return 'Las fechas deben ir como AAAAMMDDHHMMSS (24 horas) y ser fechas reales';
  if (dateIni > dateEnd) return 'La fecha inicial es posterior a la final';
  if (a.y !== b.y || a.mo !== b.mo) return 'La fecha inicial y la final deben estar en el mismo mes (lo exige Wolkvox)';
  return null;
}
// AAAA-MM-DD + HH:MM:SS -> AAAAMMDDHHMMSS
function fechaWolkvox(dia, hora) { return String(dia).replace(/-/g, '') + String(hora || '00:00:00').replace(/:/g, ''); }

// ── Contador de consultas por dia (hora Colombia) ──
function asegurarTablas(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS wolkvox_uso (
    operacion TEXT NOT NULL,
    dia TEXT NOT NULL,              -- AAAA-MM-DD, hora Colombia
    consultas INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (operacion, dia)
  )`);
}
function topeDiario(env) {
  env = env || process.env;
  const n = Number(env.WOLKVOX_MAX_CONSULTAS_DIA);
  const tope = Number.isInteger(n) && n > 0 ? n : TOPE_POR_DEFECTO;
  return Math.min(tope, LIMITE_LICENCIA_DIA);
}
function usoDelDia(db, operacion, ahora) {
  asegurarTablas(db);
  const r = db.prepare('SELECT consultas FROM wolkvox_uso WHERE operacion = ? AND dia = ?').get(operacion, fechaLimitesHoyColombia(ahora));
  return r ? r.consultas : 0;
}
// Cuenta la consulta ANTES de hacerla (si Wolkvox la recibe, gasta del limite aunque falle).
// false si ya se llego al tope del dia.
function reservarConsulta(db, operacion, ahora, env) {
  asegurarTablas(db);
  const dia = fechaLimitesHoyColombia(ahora);
  const tope = topeDiario(env);
  return db.transaction(() => {
    const r = db.prepare('SELECT consultas FROM wolkvox_uso WHERE operacion = ? AND dia = ?').get(operacion, dia);
    const n = r ? r.consultas : 0;
    if (n >= tope) return false;
    db.prepare(`INSERT INTO wolkvox_uso (operacion, dia, consultas) VALUES (?, ?, 1)
      ON CONFLICT(operacion, dia) DO UPDATE SET consultas = consultas + 1`).run(operacion, dia);
    return true;
  })();
}

// ── Consulta ──
function _fetchPorDefecto(env) {
  if ((env.NODE_ENV || 'development') === 'test') {
    return () => { throw new WolkvoxError('red', 'En pruebas no se llama a Wolkvox (falta inyectar fetchImpl)'); };
  }
  return (url, opts) => fetch(url, opts);
}

// Devuelve { httpStatus, cuerpo, duracionMs }. Lanza WolkvoxError con un codigo y un texto fijo.
async function consultarReporte(opts) {
  const { db, operacion, api, dateIni, dateEnd } = opts;
  const env = opts.env || process.env;
  const ahora = opts.ahora || new Date();
  if (!Object.prototype.hasOwnProperty.call(REPORTES, api)) throw new WolkvoxError('reporte', 'Ese reporte de Wolkvox no está habilitado');
  const eR = errorRango(dateIni, dateEnd);
  if (eR) throw new WolkvoxError('rango', eR);
  const cred = opts.credenciales || credenciales(operacion, env);
  if (!cred) throw new WolkvoxError('sin_configurar', 'Falta configurar el token o el servidor de Wolkvox de esta operación');
  if (!reservarConsulta(db, operacion, ahora, env)) throw new WolkvoxError('tope', 'Se llegó al tope de consultas a Wolkvox de hoy; se puede volver a probar mañana');

  const url = new URL('https://' + cred.servidor + '.wolkvox.com/api/v2/reports_manager.php');
  url.searchParams.set('api', api);
  url.searchParams.set('date_ini', dateIni);
  url.searchParams.set('date_end', dateEnd);
  const timeoutMs = opts.timeoutMs || Number(env.WOLKVOX_TIEMPO_MAXIMO_MS) || TIEMPO_MAXIMO_POR_DEFECTO_MS;
  const fetchImpl = opts.fetchImpl || _fetchPorDefecto(env);
  const t0 = Date.now();
  // Tiempo maximo para TODA la consulta (conexion + cuerpo). Temporizador propio (no
  // AbortSignal.timeout, que no mantiene vivo el proceso) y se limpia siempre al terminar.
  const ctrl = new AbortController();
  let agotado = false;
  const timer = setTimeout(() => { agotado = true; ctrl.abort(); }, timeoutMs);
  const errAgotado = () => new WolkvoxError('tiempo_agotado', 'Wolkvox no respondió a tiempo (' + Math.round(timeoutMs / 1000) + ' s)');
  try {
    let resp;
    try {
      resp = await fetchImpl(url.toString(), {
        method: 'GET',
        headers: { 'wolkvox-token': cred.token, Accept: 'application/json' },
        signal: ctrl.signal,
        redirect: 'error',
      });
    } catch (e) {
      // Nunca se reenvia e.message: puede traer la URL o el nombre del servidor.
      _log(operacion, api, agotado ? 'tiempo agotado' : 'sin conexión', null, Date.now() - t0);
      if (e instanceof WolkvoxError) throw e;
      throw agotado ? errAgotado() : new WolkvoxError('red', 'No se pudo conectar con Wolkvox');
    }
    const st = resp.status;
    if (st === 401 || st === 403) {
      _log(operacion, api, st, null, Date.now() - t0);
      throw new WolkvoxError('autorizacion', 'Wolkvox rechazó el token (' + st + '): revisa que el token esté vigente', st);
    }
    if (st === 429) {
      _log(operacion, api, st, null, Date.now() - t0);
      throw new WolkvoxError('limite_wolkvox', 'Wolkvox dice que se pasó el límite de consultas (429)', 429);
    }
    if (st < 200 || st >= 300) {
      _log(operacion, api, st, null, Date.now() - t0);
      throw new WolkvoxError('http', 'Wolkvox respondió ' + st, st);
    }
    let cuerpo;
    try { cuerpo = await resp.json(); } catch (e) { cuerpo = undefined; }
    const duracionMs = Date.now() - t0;
    if (agotado) { _log(operacion, api, 'tiempo agotado', null, duracionMs); throw errAgotado(); }
    if (!cuerpo || typeof cuerpo !== 'object' || Array.isArray(cuerpo)) {
      _log(operacion, api, st, null, duracionMs);
      throw new WolkvoxError('respuesta_invalida', 'Wolkvox respondió algo que no es el JSON esperado', st);
    }
    _log(operacion, api, st, Array.isArray(cuerpo.data) ? cuerpo.data.length : null, duracionMs);
    return { httpStatus: st, cuerpo, duracionMs };
  } finally {
    clearTimeout(timer);
  }
}

function _log(operacion, api, estado, filas, ms) {
  // Solo operacion, reporte, estado, filas y tiempo: nunca URL, token, servidor ni cuerpo.
  console.log('[wolkvox] ' + operacion + ' ' + api + ' ' + estado + (filas === null ? '' : ' ' + filas + ' filas') + ' ' + (ms / 1000).toFixed(1) + ' s');
}

// Lo unico que sale hacia el navegador de una respuesta: code, msg, cuantas filas y los NOMBRES
// de los campos. Nunca un valor de `data` (trae telefonos y nombres).
function resumenSinValores(cuerpo) {
  const data = Array.isArray(cuerpo && cuerpo.data) ? cuerpo.data : [];
  const campos = new Set();
  for (const fila of data) {
    if (!fila || typeof fila !== 'object' || Array.isArray(fila)) continue;
    for (const k of Object.keys(fila)) if (/^[A-Za-z0-9_]{1,64}$/.test(k)) campos.add(k);
  }
  const code = cuerpo && (typeof cuerpo.code === 'number' || typeof cuerpo.code === 'string') && /^[A-Za-z0-9_-]{1,12}$/.test(String(cuerpo.code)) ? String(cuerpo.code) : null;
  // msg: texto corto de Wolkvox («N records were found»); se recorta y se limpia de cualquier cosa
  // que no sea letras, numeros y puntuacion simple.
  const msg = cuerpo && typeof cuerpo.msg === 'string' ? cuerpo.msg.replace(/[^\p{L}\p{N} .,:;()%_-]/gu, '').slice(0, 120) : null;
  return { code, msg, filas: data.length, campos: [...campos].sort() };
}

function operacionDeCampana(campana) {
  return Object.prototype.hasOwnProperty.call(OPERACION_DE_CAMPANA, campana) ? OPERACION_DE_CAMPANA[campana] : null;
}

module.exports = {
  LIMITE_LICENCIA_DIA,
  TOPE_POR_DEFECTO,
  REPORTES,
  OPERACION_DE_CAMPANA,
  ARCHIVO_LOCAL,
  WolkvoxError,
  credenciales,
  estaConfigurado,
  errorRango,
  fechaWolkvox,
  asegurarTablas,
  topeDiario,
  usoDelDia,
  reservarConsulta,
  consultarReporte,
  resumenSinValores,
  operacionDeCampana,
  _reiniciarArchivoLocal: () => { _archivoLocalLeido = false; }, // solo pruebas
};
