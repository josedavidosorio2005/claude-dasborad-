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
const FH = require('../public/js/flujo-hora-logic.js');
const D = require('./wolkvox-destinos'); // Fase A24: réplica o MOBILIZE real (lista cerrada)

const CAMPANA = ing.CAMPANA_INGESTA;
// Fase N5: la operación de Wolkvox sale del destino (D.operacionDe), ya no de una constante.
const QUIEN = 'Consulta automática Wolkvox';

// ── Fase A26 (20/11/2026, pedido de Edwin): cuentas de PRUEBA de Wolkvox ──
// Fuera de todas las pestañas que traen asesor (Tipificación + Eficacia + únicas + salida conectada
// por cdr_1, no conectadas por cdr_5 y Encuesta por diagram_4), en la réplica y en el MOBILIZE real.
// Flujo, Flujo por hora y Abandonadas vienen por skill, sin asesor: no se pueden separar.
// Sin nombres en el repo: la cuenta se reconoce por su agent_id de Wolkvox (PRUEBA_IDS, cuando se
// conozca) o por la huella sha256 de su nombre normalizado (mayúsculas, sin tildes, espacios simples;
// el mismo criterio de los alias). Cada corrida anota en el Historial los agent_id que vio en esas
// filas (solo el id), para poder pasar a PRUEBA_IDS.
const crypto = require('crypto');
const { aliasNorm } = require('./alias-asesores');
const PRUEBA_HUELLAS = ['69301a2cd94b184d5f9b12040fe61126d6cbbdb9ae094ea454e355fa7861370e'];
// Fase A27 (20/11): agent_id de la cuenta de pruebas, visto en la corrida de octubre (Historial). La
// huella se queda como respaldo por si Wolkvox la recrea con otro id.
const PRUEBA_IDS = ['12319'];
let _pruebaHuellas = PRUEBA_HUELLAS, _pruebaIds = PRUEBA_IDS;
const _huella = (nombre) => crypto.createHash('sha256').update(aliasNorm(nombre), 'utf8').digest('hex');
function esCuentaPrueba(fila) {
  if (!fila || typeof fila !== 'object') return false;
  const id = _v(fila, 'agent_id');
  if (id !== undefined && id !== null && _pruebaIds.includes(String(id).trim())) return true;
  const nombre = _v(fila, 'agent_name');
  return !!(nombre && String(nombre).trim() && _pruebaHuellas.includes(_huella(nombre)));
}
// -> { data (sin las filas de prueba), quitadas, ids (agent_id vistos en esas filas, solo [A-Za-z0-9_.-]) }
function quitarCuentasPrueba(data, dest) {
  // Fase N6: la cuenta de pruebas es de MOBILIZE (su agent_id puede ser otra persona en ORLANT).
  if (dest !== undefined && !D.destino(dest).cuentasPrueba) return { data, quitadas: 0, ids: [] };
  const out = [];
  const ids = new Set();
  let quitadas = 0;
  for (const r of data) {
    if (!esCuentaPrueba(r)) { out.push(r); continue; }
    quitadas++;
    const id = String(_v(r, 'agent_id') == null ? '' : _v(r, 'agent_id')).trim();
    if (/^[A-Za-z0-9_.-]{1,40}$/.test(id)) ids.add(id);
  }
  return { data: out, quitadas, ids: [...ids].sort() };
}
const _textoPrueba = (pr) => (pr.quitadas ? ', ' + pr.quitadas + ' de la cuenta de prueba fuera' + (pr.ids.length ? ' (agent_id ' + pr.ids.slice(0, 5).join(', ') + ')' : '') : '');
// Un mes en el que Wolkvox solo trajo filas de la cuenta de prueba: se vacía (con respaldo) para que
// no queden las de antes. Los escritores de la carga no aceptan una lista vacía.
const _VACIAR = {
  tipificaciones: { filtro: { canal: 'LLAMADAS' }, extra: " AND canal = 'LLAMADAS'" },
  encuestas: { filtro: null, extra: '' },
  llamadas_no_conectadas: { filtro: null, extra: '' },
};
function vaciarMes(db, tabla, campana, mes) {
  const cfg = _VACIAR[tabla];
  if (!cfg) throw new Error('Tabla no permitida');
  const c = _campanaPermitida(campana);
  const desde = mes + '-01', hasta = ing.ultimoDiaDelMes(mes);
  let n = 0;
  db.transaction(() => {
    respaldarAntesDeCambiar(db, tabla, Object.assign({ campana: c, desde, hasta, guardadoPorNombre: QUIEN }, cfg.filtro ? { filtro: cfg.filtro } : {}));
    n = db.prepare('DELETE FROM ' + tabla + ' WHERE campana = ? AND fecha >= ? AND fecha <= ?' + cfg.extra).run(c, desde, hasta).changes;
  })();
  return n;
}
function _soloPrueba(opts, partes, res, tabla, mes, pr) {
  const n = vaciarMes(opts.db, tabla, opts.campana, mes);
  res.meses.push({ mes, filas: 0, reemplazadas: n, prueba: pr.quitadas });
  partes.push(mes + ': solo filas de la cuenta de prueba' + _textoPrueba(pr) + ', mes vaciado (borró ' + n + '), con respaldo');
}

function _auto() { return require('./wolkvox-auto'); } // carga perezosa (wolkvox-auto también nos carga)

// Fase A30: en un hueco del real, se vuelve a mirar JUSTO antes de escribir (sin await de por medio). Si
// la pestaña ya tiene filas en el mes (alguien cargó algo mientras se consultaba), no se toca.
function _huecoOcupado(opts, mes, partes, res) {
  if (!opts.huecoReal) return false;
  const ya = D.filasEnHueco(opts.db, mes, opts.huecoReal);
  if (!ya) return false;
  res.meses.push({ mes, estado: 'con_datos' });
  partes.push(mes + ': ya tiene ' + ya + ' filas (carga), no se toca');
  return true;
}

// Valor de una fila sin importar mayúsculas.
function _v(fila, clave) {
  for (const k of Object.keys(fila)) if (k.toLowerCase() === clave) return fila[k];
  return undefined;
}

// Una consulta de un tramo (dentro de un mes). Devuelve la lista `data` o lanza WolkvoxError.
// Fase A22 (19/11, OK del usuario): skill_2 responde 404 en un mes SIN abandonadas (septiembre: 0 en el
// Flujo) con un mensaje que SIN_REGISTROS no reconoce. Para skill_2, todo 404 = «sin registros».
const _404_ES_VACIO = ['skill_2'];
async function _pedir(opts, api, desde, hasta) {
  let cuerpo;
  try {
    cuerpo = (await wv.consultarReporte({
      db: opts.db, operacion: D.operacionDe(opts.destino), api, env: opts.env, ahora: opts.ahora, fetchImpl: opts.fetchImpl, credenciales: opts.cred,
      dateIni: wv.fechaWolkvox(desde, '00:00:00'), dateEnd: wv.fechaWolkvox(hasta, '23:59:59'),
    })).cuerpo;
  } catch (e) {
    if (e instanceof wv.WolkvoxError && e.httpStatus === 404 && (_404_ES_VACIO.includes(api) || _auto().SIN_REGISTROS.test(e.wolkvoxMsg || ''))) return { data: [], cuerpo: { data: [] } };
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

// Fase A24: `campana` (por defecto la réplica) solo de la lista cerrada de wolkvox-destinos.js.
function _campanaPermitida(campana) {
  const c = campana === undefined ? CAMPANA : campana;
  if (!D.CAMPANAS_PERMITIDAS.includes(c)) throw new Error('Campaña no permitida para Wolkvox');
  return c;
}
function reemplazarMesFlujoHora(db, mes, filas, campana) {
  const CAMPANA = _campanaPermitida(campana);
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
function actualizarAhtEspera(db, mes, porDia, campana) {
  const CAMPANA = _campanaPermitida(campana);
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
  const meses = _auto().planDe(opts);
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
    if (_huecoOcupado(opts, mes, partes, res)) continue;
    const reemplazadas = reemplazarMesFlujoHora(opts.db, mes, conLlamadas, opts.campana);
    // Fase A30: en un hueco, el AHT/espera del Flujo solo se completa si TODO el Flujo del mes vino de la
    // API (nunca se toca un Flujo cargado a mano).
    const ahtN = opts.huecoReal && D.flujoConCargaManual(opts.db, mes, _auto().ARCHIVO) ? 0 : actualizarAhtEspera(opts.db, mes, ahtEsperaDiarios(data), opts.campana);
    res.meses.push({ mes, filas: conLlamadas.length, sinLlamadas: p.filas.length - conLlamadas.length, reemplazadas, ahtEspera: ahtN });
    partes.push(mes + ': ' + conLlamadas.length + ' filas día-hora-skill (' + (p.filas.length - conLlamadas.length) + ' en cero fuera), reemplazó ' + reemplazadas + ', AHT/espera en ' + ahtN + ' filas del Flujo, con respaldo');
  }
}

// ── Paso 2: cdr_1 → Tipificación (canal Llamadas), de donde salen Eficacia, las contestadas únicas
// y las conectadas de salida ──
// Se arma la hoja del Excel del CDR SOLO con las columnas que la plataforma lee; los datos sensibles
// (cliente, comentarios, conn_id, destino, costo, ids) NUNCA entran. TELEPHONE entra solo para que el
// lector marque en memoria la primera llamada de cada número por día (unicaDia) y nunca se guarda.
// Mismas opciones que la carga manual de MOBILIZE (public/js/cargas.js): excluir «PRUEBA», marcar
// únicas del día y conservar toda fila de salida («-»). Una consulta por mes (Fase A9).
const T = require('../public/js/tipificacion-logic.js');
const CDR_COLUMNAS = [ // [columna de la API, columna del Excel]
  ['agent_name', 'AGENT_NAME'], ['date', 'DATE'], ['description_cod_act', 'DESCRIPTION_COD_ACT'], ['skill_name', 'SKILL_NAME'],
  ['time_min', 'TIME_MIN'], ['time_seg', 'TIME_SEC'], ['cod_act', 'COD_ACT'], ['type_interaction', 'TYPE_INTERACTION'],
  ['hang_up', 'HUNG_UP'], ['skill_id', 'SKILL_ID'], ['telephone', 'TELEPHONE'],
];
const CDR_DESCARTADAS = ['agent_id', 'campaign_id', 'cod_act_2', 'comment', 'conn_id', 'cost', 'customer_id', 'description_cod_act_2', 'destiny'];
// Fase A14 (19/11): en la API, las llamadas de salida (outbound_ma / out_pre) llegan SIN skill; en el
// export manual traen «-», que el lector ya convierte en «Llamadas de salida». Sin skill, el lector las
// omitía como «falta un dato» (corrida del 19/11: 47 de 93 filas). Se completa con «-» SOLO si es de salida.
const _SALIDA = ['outbound_ma', 'out_pre'];
// Fase A16 (19/11): una llamada puede llegar SIN tipificación (corrida del 19/11: 1 de 93, entrada del 04/11
// que el manual trae como «Otros_motivos»). El lector la omitía y faltaba en Eficacia y únicas. Se completa
// con «-», el marcador del export manual que la plataforma muestra como «Sin tipificación».
// Fase A22 (19/11, OK del usuario): comparación jul–oct con el MOBILIZE real: el real cuenta como
// «Otros_motivos» lo que la API trae SIN tipificación y lo que trae como TIMEOUTACW (el asesor no tipificó
// a tiempo). Se agrupan igual (antes, A16, «-»). Eficacia y únicas no cambian (no es un código positivo).
const TIPIFICACION_OTROS = 'Otros_motivos';
const _COMO_OTROS = ['timeoutacw'];
const _vacio = (v) => v === undefined || v === null || String(v).trim() === '';
function hojaCdr(data, perfil) {
  const pf = perfil || PERFILES_CDR.mobilize;
  const cols = pf.telefono ? CDR_COLUMNAS : CDR_COLUMNAS.filter((c) => c[0] !== 'telephone'); // N6: ORLANT ni lo lee
  return [cols.map((c) => c[1])].concat(data.map((r) => {
    const salida = _SALIDA.includes(String(_v(r || {}, 'type_interaction') || '').trim().toLowerCase());
    return cols.map(([api]) => {
      const v = _v(r || {}, api);
      if (salida && (api === 'skill_name' || api === 'skill_id') && _vacio(v)) return '-';
      if (pf.otros && api === 'description_cod_act' && (_vacio(v) || _COMO_OTROS.includes(String(v).trim().toLowerCase()))) return TIPIFICACION_OTROS;
      return v === undefined || v === null ? '' : v;
    });
  }));
}
// Fase A12 (19/11): conteos SIN valores de lo que trae cdr_1, para saber por qué no entran llamadas de
// salida sin gastar consultas: por tipo de interacción (solo nombres del sistema, [a-z_], hasta 6) y
// cuántas filas no traen asesor o tipificación (el lector las omite) o traen la skill «-».
// Fase A13 (19/11): por tipo de interacción, cuántas filas llegan SIN skill (el lector las omite como
// «falta un dato») y la FORMA de la fecha (dígitos → 9, letras → a; nunca el valor), para saber por
// qué la salida no entra sin gastar consultas. Solo inbound y salida (outbound_ma/out_pre).
function formaCdr(data) {
  const por = {};
  for (const r of data) {
    const t = String(_v(r || {}, 'type_interaction') || '').trim().toLowerCase();
    if (!['inbound', 'outbound_ma', 'out_pre'].includes(t)) continue;
    const x = por[t] || (por[t] = { sinSkill: 0, formas: {} });
    if (!String(_v(r || {}, 'skill_name') == null ? '' : _v(r || {}, 'skill_name')).trim()) x.sinSkill++;
    const d = _v(r || {}, 'date');
    const f = d === null || d === undefined || d === '' ? 'vacía' : typeof d === 'number' ? 'número' : String(d).slice(0, 25).replace(/[0-9]/g, '9').replace(/[A-Za-z]/g, 'a');
    x.formas[f] = (x.formas[f] || 0) + 1;
  }
  const partes = Object.keys(por).sort().map((t) => t + ': sin skill ' + por[t].sinSkill + ', fecha ' +
    Object.entries(por[t].formas).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([f, n]) => '«' + f + '» ' + n).join(' / '));
  return partes.length ? ' · ' + partes.join('; ') : '';
}
function conteoCdr(data) {
  const tipos = {};
  let sinAgente = 0, sinTip = 0, guion = 0, sinTipConCod = 0, sinTipConCod2 = 0;
  for (const r of data) {
    const t = String(_v(r || {}, 'type_interaction') || '').trim().toLowerCase();
    const k = /^[a-z_]{1,24}$/.test(t) ? t : (t ? 'otro' : 'vacio');
    tipos[k] = (tipos[k] || 0) + 1;
    if (!String(_v(r || {}, 'agent_name') || '').trim()) sinAgente++;
    if (!String(_v(r || {}, 'description_cod_act') || '').trim()) {
      sinTip++;
      // Fase A16: solo si traen otro código (nunca el valor), para saber de dónde sacar la tipificación.
      if (!_vacio(_v(r || {}, 'cod_act'))) sinTipConCod++;
      if (!_vacio(_v(r || {}, 'description_cod_act_2'))) sinTipConCod2++;
    }
    if (String(_v(r || {}, 'skill_name') || '').trim() === '-') guion++;
  }
  const lista = Object.entries(tipos).sort((a, b) => b[1] - a[1]);
  const extra = lista.length > 6 ? lista.slice(6).reduce((n, x) => n + x[1], 0) : 0;
  return 'API ' + data.length + ' filas: ' + lista.slice(0, 6).map(([k, n]) => k + ' ' + n).join(', ') + (extra ? ', otros ' + extra : '') +
    '; sin asesor ' + sinAgente + ', sin tipificación ' + sinTip + (sinTip ? ' (con COD_ACT ' + sinTipConCod + ', con otra descripción ' + sinTipConCod2 + ')' : '') + ', skill «-» ' + guion + formaCdr(data);
}
function opcionesCdrMobilize() {
  return { codificacionesExcluidas: T.TIPIFICACION_CDR_EXCLUIR_POR_DEFECTO, marcarUnicasDia: true, conservarSalidaGuion: true };
}
// Fase N6: el CDR de cada destino se lee como la carga manual de su cliente (public/js/cargas.js).
// ORLANT: sin opciones (no excluye «PRUEBA», no marca únicas, no lee el teléfono) y sin agrupar
// «sin tipificación»/TIMEOUTACW como «Otros_motivos» (eso fue una decisión de MOBILIZE, Fase A22).
const PERFILES_CDR = {
  mobilize: { opciones: opcionesCdrMobilize, otros: true, telefono: true },
  orlant: { opciones: () => undefined, otros: false, telefono: false },
};
function perfilCdr(dest) { return PERFILES_CDR[D.destino(dest).perfilCdr] || PERFILES_CDR.mobilize; }

// Fase AU2 (mapeo de Edwin, 26/11): en la réplica de Aurora el CDR solo deja la skill de entrada y «-» (la salida,
// que cdr_1 trae sin skill) y solo los agentes de Inconexión elegidos en la lista editable. Los agentes vistos (solo
// el nombre) quedan anotados para elegirlos. Sin agentes elegidos no se escribe nada (lo dice el Historial).
function _skillCdr(r) {
  const salida = _SALIDA.includes(String(_v(r, 'type_interaction') || '').trim().toLowerCase());
  const s = _v(r, 'skill_name');
  return salida && _vacio(s) ? '-' : (s == null ? '' : String(s));
}
function filtrarCdrAurora(db, dest, data) {
  const AG = require('./wolkvox-agentes');
  const f = dest.filtros;
  const enSkill = data.filter((r) => AG.enLista(f.cdrSkills, _skillCdr(r || {})));
  const otrasSkills = data.length - enSkill.length;
  const vistos = AG.registrarVistos(db, dest.campana, enSkill.map((r) => _v(r || {}, 'agent_name')));
  const elegidos = AG.incluidos(db, dest.campana);
  if (!elegidos.size) return { data: [], otrasSkills, otrosAgentes: 0, aviso: otrasSkills + ' de otras skills fuera; ' + vistos + ' agentes vistos y ninguno elegido como de Inconexión (elígelos en «Agentes de Inconexión»)' };
  const out = enSkill.filter((r) => elegidos.has(AG.norm(_v(r || {}, 'agent_name'))));
  return { data: out, otrasSkills, otrosAgentes: enSkill.length - out.length, aviso: out.length ? null : otrasSkills + ' de otras skills y ' + (enSkill.length - out.length) + ' de otros agentes fuera; ninguna de los agentes elegidos' };
}

// Fase AU3: los días del mes en tramos de `n` días seguidos (sin `n`: el mes completo en uno).
function tramosCdr(dias, n) {
  if (!n || !(n > 0)) return [dias];
  const out = [];
  for (let i = 0; i < dias.length; i += n) out.push(dias.slice(i, i + n));
  return out;
}
// Consultas de cdr_1 que gasta un mes de 31 días en ese destino (para el tope del día).
function consultasCdrPorMes(dest) {
  return tramosCdr(new Array(31).fill(0), dest && dest.cdrDiasPorConsulta).length;
}
async function correrCdr(opts, partes, res) {
  const { cargarTipificaciones } = require('./tipificaciones');
  const meses = _auto().planDe(opts);
  for (const { mes, dias } of meses) {
    let data = [];
    let campos = [];
    // Fase A9 (18/11): cdr_1 acepta el mes completo (prueba autorizada: 1–17/11 en una consulta,
    // 80 filas): una sola consulta por mes, del 1 a ayer.
    // Fase AU3 (26/11): si el destino lo pide (Aurora, cdrDiasPorConsulta), el mes va por tramos de N días;
    // las filas se juntan en memoria y el mes se escribe una sola vez: si un tramo falla, el mes queda sin cambios.
    for (const tramo of tramosCdr(dias, D.destino(opts.destino).cdrDiasPorConsulta)) {
      res.consultas++;
      const r = await _pedir(opts, 'cdr_1', tramo[0], tramo[tramo.length - 1]);
      for (const x of r.data) data.push(x);
      if (r.data.length && !campos.length) campos = wv.resumenSinValores(r.cuerpo).campos;
    }
    if (!data.length) { partes.push(mes + ': Wolkvox no trajo llamadas, sin cambios'); continue; }
    const prC = quitarCuentasPrueba(data, opts.destino); // Fase A26 (N6: solo MOBILIZE)
    data = prC.data;
    if (!data.length) { if (opts.huecoReal) { partes.push(mes + ': solo filas de la cuenta de prueba' + _textoPrueba(prC) + ', sin cambios'); continue; } _soloPrueba(opts, partes, res, 'tipificaciones', mes, prC); continue; }
    let filtroAu = null;
    if (D.destino(opts.destino).filtros) { // Fase AU2: Aurora
      filtroAu = filtrarCdrAurora(opts.db, D.destino(opts.destino), data);
      data = filtroAu.data;
      if (filtroAu.aviso) { partes.push(mes + ': ' + filtroAu.aviso + ', sin cambios'); continue; }
    }
    const conteo = conteoCdr(data); // Fase A12: solo números
    const pf = perfilCdr(opts.destino); // Fase N6
    let p = T.tipificacionParseFilas(hojaCdr(data, pf), null, 'LLAMADAS', pf.opciones());
    data = null; // los teléfonos y demás datos crudos no se guardan ni se quedan en memoria
    if (p.error) {
      res.estado = 'error'; res.error = 'respuesta_invalida';
      partes.push(mes + ': respuesta no esperada (' + String(p.error).slice(0, 120) + '; campos: ' + campos.join(',').slice(0, 300) + '), sin cambios');
      return;
    }
    const filas = p.filas.map(T.tipificacionFilaComoArray);
    const fuera = filas.filter((f) => String(f[1]).slice(0, 7) !== mes);
    if (fuera.length) { res.estado = 'error'; res.error = 'respuesta_invalida'; partes.push(mes + ': ' + fuera.length + ' llamadas fuera del mes, sin cambios'); return; }
    if (!filas.length) { partes.push(mes + ': ninguna llamada válida, sin cambios'); continue; }
    if (_huecoOcupado(opts, mes, partes, res)) continue;
    const w = cargarTipificaciones(opts.db, {
      campana: opts.campana, canal: 'LLAMADAS', archivoNombre: 'API Wolkvox (cdr_1)', cargadoPorNombre: QUIEN, filas,
      desde: mes + '-01', hasta: ing.ultimoDiaDelMes(mes),
    });
    const unicas = p.unicasDia ? p.unicasDia.unicas : null;
    res.meses.push({ mes, filas: w.insertadas, reemplazadas: w.borradas, excluidas: p.excluidas || 0, unicas, salida: p.salida || 0, prueba: prC.quitadas });
    partes.push(mes + ': ' + w.insertadas + ' llamadas (' + (p.salida || 0) + ' de salida' + (unicas !== null ? ', ' + unicas + ' únicas de ingreso' : '') + (p.excluidas ? ', ' + p.excluidas + ' de prueba fuera' : '') + _textoPrueba(prC) +
      (filtroAu ? ', ' + filtroAu.otrasSkills + ' de otras skills y ' + filtroAu.otrosAgentes + ' de otros agentes fuera' : '') + '), reemplazó ' + w.borradas + ', con respaldo · ' + conteo);
    p = null;
  }
}

// ── Paso 3 (Fase A11): diagram_4 → Encuesta (la hoja «HistIVR» del manual, mismas 25 columnas) ──
// Solo entran asesor, skill, fecha y hora, y Q01–Q04. NUNCA el teléfono (ANI), AGENT_DNI, CUSTOMER_ID,
// el comentario (VOICE_MESSAGE) ni el CONN_ID: en la réplica Calidad de encuestas queda sin teléfono ni
// comentarios (pedido del usuario, 18/11: los datos sensibles nunca se guardan). Una consulta por mes.
// Fase A33 (autorización escrita del usuario, 24/11/2026): en el MOBILIZE REAL (destino con `encuestaConnId`)
// también entra el CONN_ID, SOLO el ID de la llamada, para que Calidad de encuestas enlace las mal calificadas
// con sus monitoreos. El teléfono (ANI), los comentarios y lo demás se siguen descartando. La réplica, igual que antes.
const EN = require('../public/js/encuesta-logic.js');
const ENCUESTA_COLUMNAS_API = [['agent_name', 'AGENT_NAME'], ['skill_name', 'SKILL_NAME'], ['q01', 'Q01'], ['q02', 'Q02'], ['q03', 'Q03'], ['q04', 'Q04']];
const ENCUESTA_DESCARTADAS = ['ani', 'agent_dni', 'agent_id', 'customer_id', 'conn_id', 'voice_message', 'voice_message_duration', 'feeling', 'result', 'skill_id', 'type_interaction', 'q05', 'q06', 'q07', 'q08', 'q09', 'q10'];
function hojaEncuesta(data, conConnId) {
  const cab = ['AGENT_NAME', 'SKILL_NAME', 'DATE', 'Q01', 'Q02', 'Q03', 'Q04'].concat(conConnId ? ['CONN_ID'] : []);
  return [cab].concat(data.map((r) => {
    const g = (k) => { const v = _v(r || {}, k); return v === undefined || v === null ? '' : v; };
    let fecha = String(g('date')).trim();
    const hora = String(g('time')).trim();
    if (fecha && !fecha.includes(':') && /^\d{1,2}:\d{2}/.test(hora)) fecha += ' ' + hora;
    return [g('agent_name'), g('skill_name'), fecha, g('q01'), g('q02'), g('q03'), g('q04')].concat(conConnId ? [String(g('conn_id')).trim()] : []);
  }));
}

async function correrEncuesta(opts, partes, res) {
  const { cargarEncuestas } = require('./encuestas');
  const conConnId = require('./wolkvox-destinos').destino(opts.destino).encuestaConnId === true; // Fase A33: solo el real
  for (const { mes, dias } of _auto().planDe(opts)) {
    res.consultas++;
    let { data, cuerpo } = await _pedir(opts, 'diagram_4', dias[0], dias[dias.length - 1]);
    if (!data.length) { partes.push(mes + ': Wolkvox no trajo encuestas, sin cambios'); continue; }
    const prE = quitarCuentasPrueba(data); // Fase A26
    data = prE.data;
    if (!data.length) { cuerpo = null; _soloPrueba(opts, partes, res, 'encuestas', mes, prE); continue; }
    const campos = wv.resumenSinValores(cuerpo).campos;
    let p = EN.encuestaParseFilas(hojaEncuesta(data, conConnId));
    data = null; cuerpo = null; // lo crudo (teléfonos, comentarios) no se queda en memoria
    if (p.error) {
      res.estado = 'error'; res.error = 'respuesta_invalida';
      partes.push(mes + ': respuesta no esperada (' + String(p.error).slice(0, 120) + '; campos: ' + campos.join(',').slice(0, 300) + '), sin cambios');
      return;
    }
    const filas = p.filas.map((f) => { const x = f.slice(); x[7] = ''; if (!conConnId) x[8] = ''; x[10] = ''; return x; }); // sin comentario ni teléfono; conn_id solo en el real (A33)
    const fuera = filas.filter((f) => String(f[0]).slice(0, 7) !== mes);
    if (fuera.length) { res.estado = 'error'; res.error = 'respuesta_invalida'; partes.push(mes + ': ' + fuera.length + ' encuestas fuera del mes, sin cambios'); return; }
    if (!filas.length) { partes.push(mes + ': ninguna encuesta válida, sin cambios'); continue; }
    const w = cargarEncuestas(opts.db, { campana: opts.campana, archivoNombre: 'API Wolkvox (diagram_4)', cargadoPorNombre: QUIEN, filas, desde: mes + '-01', hasta: ing.ultimoDiaDelMes(mes) });
    res.meses.push({ mes, filas: w.insertadas, reemplazadas: w.borradas, prueba: prE.quitadas });
    partes.push(mes + ': ' + w.insertadas + ' encuestas (' + (p.avisos.length ? p.avisos.length + ' avisos, ' : '') + 'reemplazó ' + w.borradas + _textoPrueba(prE) + ', con respaldo)');
    p = null;
  }
}

// ── Fase A15 (19/11): cdr_5 → Llamadas de salida, NO conectadas (el reporte «5. Detalle de las llamadas no
// conectadas» del Manager que hoy se sube a mano). Coincide con el manual (04/11: 2, 10/11: 7). Solo entran
// fecha y asesor; NUNCA el teléfono, el destino, el cliente ni el conn_id. Una consulta por mes.
const LS = require('../public/js/llamadas-salida-logic.js');
const NC_DESCARTADAS = ['telephone', 'destiny', 'customer_id', 'conn_id', 'campaign_id', 'agent_id', 'type_interaction'];
function hojaNoConectadas(data) {
  return [['AGENT_NAME', 'DATE', 'RING_TIME', 'RESULT']].concat(data.map((r) => ['agent_name', 'date', 'ring_time', 'result'].map((k) => {
    const v = _v(r || {}, k);
    return v === undefined || v === null ? '' : v;
  })));
}
async function correrNoConectadas(opts, partes, res) {
  const { cargarLlamadasNoConectadas, marcarNoConectadasConsultado } = require('./llamadas-salida');
  // Fase A32: la consulta del mes terminó bien -> el mes queda «consultado» (0 si no dejó filas).
  const marcar = (mes, filas) => marcarNoConectadasConsultado(opts.db, { campana: opts.campana, mes, filas, archivoNombre: 'API Wolkvox (cdr_5)' });
  for (const { mes, dias } of _auto().planDe(opts)) {
    if (_huecoOcupado(opts, mes, partes, res)) continue; // Fase A32: hueco del real (julio de 2026)
    res.consultas++;
    let { data } = await _pedir(opts, 'cdr_5', dias[0], dias[dias.length - 1]);
    if (!data.length) { marcar(mes, 0); partes.push(mes + ': Wolkvox no trajo no conectadas, sin cambios (mes consultado: 0)'); continue; }
    const prN = quitarCuentasPrueba(data, opts.destino); // Fase A26 (N6: solo MOBILIZE)
    data = prN.data;
    if (!data.length) {
      if (_huecoOcupado(opts, mes, partes, res)) continue;
      // En un hueco (vacío por definición) no hay nada que vaciar: solo se anota el mes, como cdr.
      if (opts.huecoReal) { res.meses.push({ mes, filas: 0, reemplazadas: 0, prueba: prN.quitadas }); partes.push(mes + ': solo filas de la cuenta de prueba' + _textoPrueba(prN) + ', mes consultado: 0 no conectadas'); }
      else _soloPrueba(opts, partes, res, 'llamadas_no_conectadas', mes, prN);
      marcar(mes, 0); continue;
    }
    let p = LS.llamadasNoConectadasParseFilas(hojaNoConectadas(data));
    data = null; // teléfonos y demás datos crudos no se guardan ni se quedan en memoria
    if (p.error) { res.estado = 'error'; res.error = 'respuesta_invalida'; partes.push(mes + ': respuesta no esperada (' + String(p.error).slice(0, 120) + '), sin cambios'); return; }
    const fuera = p.filas.filter((f) => String(f[0]).slice(0, 7) !== mes);
    if (fuera.length) { res.estado = 'error'; res.error = 'respuesta_invalida'; partes.push(mes + ': ' + fuera.length + ' llamadas fuera del mes, sin cambios'); return; }
    if (_huecoOcupado(opts, mes, partes, res)) continue; // Fase A32: se vuelve a mirar justo antes de escribir
    const w = cargarLlamadasNoConectadas(opts.db, { campana: opts.campana, archivoNombre: 'API Wolkvox (cdr_5)', cargadoPorNombre: QUIEN, filas: p.filas, desde: mes + '-01', hasta: ing.ultimoDiaDelMes(mes) });
    marcar(mes, w.insertadas);
    res.meses.push({ mes, filas: w.insertadas, reemplazadas: w.borradas, prueba: prN.quitadas });
    partes.push(mes + ': ' + w.insertadas + ' no conectadas (reemplazó ' + w.borradas + _textoPrueba(prN) + ', con respaldo)');
    p = null;
  }
}

// ── Fase A19: skill_2 → Llamadas únicas: abandonadas ──
// skill_2 = Manager «Skills & Servicios › 2. Detalle de llamadas abandonadas» (mismas columnas del
// Excel: date, ani, skill_name, result, type_interaction, conn_id, customer_id, skill_id,
// abandon_time). Pasa por llamadasAbandonadasParseFilas, el lector de la carga manual: el teléfono
// (ANI) se usa SOLO en memoria para la clave día+teléfono y nunca se guarda; conn_id, customer_id,
// skill_id y abandon_time ni siquiera entran a la hoja.
const LU = require('../public/js/llamadas-unicas-logic.js');
const AB_COLUMNAS = [['date', 'DATE'], ['ani', 'ANI'], ['skill_name', 'SKILL_NAME'], ['result', 'RESULT'], ['type_interaction', 'TYPE_INTERACTION']];
const AB_DESCARTADAS = ['conn_id', 'customer_id', 'skill_id', 'abandon_time'];
function hojaAbandonadas(data) {
  return [AB_COLUMNAS.map((c) => c[1])].concat(data.map((r) => AB_COLUMNAS.map(([k]) => {
    const v = _v(r || {}, k);
    return v === undefined || v === null ? '' : v;
  })));
}
async function correrAbandonadas(opts, partes, res) {
  const { cargarLlamadasAbandonadas } = require('./llamadas-unicas');
  for (const { mes, dias } of _auto().planDe(opts)) {
    res.consultas++;
    let { data } = await _pedir(opts, 'skill_2', dias[0], dias[dias.length - 1]);
    if (!data.length) { partes.push(mes + ': Wolkvox no trajo abandonadas, sin cambios'); continue; }
    const llegaron = data.length;
    let p = LU.llamadasAbandonadasParseFilas(hojaAbandonadas(data));
    data = null; // teléfonos y demás datos crudos no se guardan ni se quedan en memoria
    if (p.error) {
      // Ninguna fila válida (p. ej. todas con RESULT distinto de ABANDON): el mes no cambia, sin error.
      if (/^Ninguna llamada abandonada/.test(p.error)) { partes.push(mes + ': ' + llegaron + ' filas, 0 abandonadas válidas (' + (p.avisos || []).length + ' avisos), sin cambios'); continue; }
      res.estado = 'error'; res.error = 'respuesta_invalida'; partes.push(mes + ': respuesta no esperada (' + String(p.error).slice(0, 120) + '), sin cambios'); return;
    }
    const fuera = p.filas.filter((f) => String(f[0]).slice(0, 7) !== mes);
    if (fuera.length) { res.estado = 'error'; res.error = 'respuesta_invalida'; partes.push(mes + ': ' + fuera.length + ' llamadas fuera del mes, sin cambios'); return; }
    if (_huecoOcupado(opts, mes, partes, res)) continue;
    const w = cargarLlamadasAbandonadas(opts.db, { campana: opts.campana, archivoNombre: 'API Wolkvox (skill_2)', cargadoPorNombre: QUIEN, filas: p.filas, desde: mes + '-01', hasta: ing.ultimoDiaDelMes(mes) });
    res.meses.push({ mes, filas: w.insertadas, reemplazadas: w.borradas, repetidas: p.duplicadosQuitados });
    partes.push(mes + ': ' + llegaron + ' filas → ' + w.insertadas + ' abandonadas únicas (' + p.duplicadosQuitados + ' repetidas día+teléfono, ' + p.avisos.length + ' avisos; reemplazó ' + w.borradas + ', con respaldo)');
    p = null;
  }
}

// ── Fase N3 (autorización escrita del usuario, 24/11/2026): chat_1 → WhatsApp de ENTRADA, solo la réplica de ORLANT ──
// chat_1 = una fila por chat atendido por personas (32 columnas; sondeo del 24/11: 624 chats el 23/11 y 8.180
// del 1 al 23/11 en UNA consulta). Los datos del cliente (WA_DESCARTADAS) se descartan EN MEMORIA y nunca se
// guardan. Se arma, por día y cola (skill_id → nombre con el mapa «Skills de WhatsApp»; 0 = salida, fuera):
//  - trafico_whatsapp: recibidos, contestados (con asesor) y ASA (promedio de first_response_time de los
//    contestados). Abandonados: NULL — ¿Edwin? (chat_1 no trae la columna; NUNCA recibidos − contestados).
//  - whatsapp_tiempos: una fila por chat contestado con su first_response_time (rangos 0–3 / 3–5 / >5 min).
// Reemplaza el mes (respaldo antes, todo o nada: las dos tablas en una transacción).
const WA_DESCARTADAS = ['customer_name', 'customer_email', 'customer_phone', 'comment', 'comments', 'extra_field'];
const WA_SKILL_SALIDA = '0';
// Segundos desde un número, «123.4» o «HH:MM:SS»; null si no se entiende (¿Edwin?: unidad por confirmar con datos).
function _waSegundos(v) {
  if (v === undefined || v === null || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) && v >= 0 ? Math.round(v) : null;
  const s = String(v).trim();
  if (/^\d+(\.\d+)?$/.test(s)) return Math.round(Number(s));
  const h = s.match(/^(\d{1,3}):(\d{2}):(\d{2})$/);
  return h ? Number(h[1]) * 3600 + Number(h[2]) * 60 + Number(h[3]) : null;
}
// «2026-11-23 08:15:02», «2026-11-23T08:15:02» o «20261123081502» → { fecha, hora } (hora local de Wolkvox).
function _waFechaHora(v) {
  const s = String(v == null ? '' : v).trim();
  const m = s.match(/^(\d{4})-?(\d{2})-?(\d{2})(?:[ T]?(\d{2}):?(\d{2}))?/);
  if (!m) return null;
  const fecha = m[1] + '-' + m[2] + '-' + m[3];
  const d = new Date(fecha + 'T00:00:00Z');
  if (isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== fecha) return null; // fecha real
  const hora = m[4] !== undefined ? Number(m[4]) : 0;
  return hora <= 23 ? { fecha, hora } : null;
}
const _waConAsesor = (f) => { const a = String(_v(f, 'agent_id') == null ? '' : _v(f, 'agent_id')).trim(); const n = String(_v(f, 'agent_name') == null ? '' : _v(f, 'agent_name')).trim(); return (a !== '' && a !== '0') || n !== ''; };
// Puro (se prueba): data cruda → { trafico, tiempos, salida, sinFecha, sinTiempo }. No guarda nada crudo.
function hojaWhatsapp(data, mapaSkills) {
  const nombre = (id) => (mapaSkills && mapaSkills.get(id)) || ('Skill ' + id);
  const grupos = new Map(); const tiempos = [];
  let salida = 0, sinFecha = 0, sinTiempo = 0;
  for (const fila of data) {
    for (const k of Object.keys(fila)) if (WA_DESCARTADAS.includes(k.toLowerCase())) delete fila[k]; // en memoria
    const skill = String(_v(fila, 'skill_id') == null ? '' : _v(fila, 'skill_id')).trim();
    if (skill === WA_SKILL_SALIDA) { salida++; continue; }
    const fh = _waFechaHora(_v(fila, 'date'));
    if (!fh) { sinFecha++; continue; }
    const cola = nombre(skill || '?');
    const k = fh.fecha + '|' + cola;
    if (!grupos.has(k)) grupos.set(k, { colaWhatsapp: cola, fecha: fh.fecha, recibidos: 0, contestados: 0, asaN: 0, asaD: 0 });
    const g = grupos.get(k);
    g.recibidos++;
    if (!_waConAsesor(fila)) continue;
    g.contestados++;
    const seg = _waSegundos(_v(fila, 'first_response_time'));
    if (seg === null) { sinTiempo++; continue; }
    g.asaN += seg; g.asaD++;
    tiempos.push([cola, fh.fecha, fh.hora, seg]);
  }
  const trafico = [...grupos.values()].sort((a, b) => (a.fecha + a.colaWhatsapp).localeCompare(b.fecha + b.colaWhatsapp)).map((g) => ({
    colaWhatsapp: g.colaWhatsapp, fechaInicio: g.fecha, fechaFin: g.fecha, totalWhatsapp: g.recibidos, contestados: g.contestados,
    abandonados: null, // ¿Edwin?: chat_1 no trae el abandono
    serviceLevel10secPct: null, serviceLevel20secPct: null, serviceLevel30secPct: null, serviceLevel5minPct: null,
    asaSegundos: g.asaD ? Math.round((g.asaN / g.asaD) * 10) / 10 : null, ataSegundos: null, ahtSegundos: null,
  }));
  return { trafico, tiempos, salida, sinFecha, sinTiempo };
}
async function correrWhatsapp(opts, partes, res) {
  const { cargarTraficoWhatsapp } = require('./trafico-whatsapp');
  const { cargarWhatsappTiempos } = require('./whatsapp-tiempos');
  const { listarSkillsWhatsapp } = require('./skills-whatsapp');
  const base = require('./clientes-registro').replicaDe(opts.db, opts.campana) || opts.campana; // el mapa es del cliente original
  const mapa = new Map(listarSkillsWhatsapp(opts.db, base).map((s) => [String(s.codigo), s.nombre]));
  const dest = D.destino(opts.destino);
  // Fase AU2: en Aurora el nombre de cada skill_id sale también de las respuestas de skill_1 (Flujo) de la operación.
  if (dest.filtros) for (const [id, n] of require('./wolkvox-agentes').mapaSkills(opts.db, dest.operacion)) if (!mapa.has(id)) mapa.set(id, n);
  const ARCHIVO = 'API Wolkvox (chat_1)';
  for (const { mes, dias } of _auto().planDe(opts)) {
    res.consultas++;
    let { data } = await _pedir(opts, 'chat_1', dias[0], dias[dias.length - 1]);
    if (!data.length) { partes.push(mes + ': Wolkvox no trajo chats, sin cambios'); continue; }
    const llegaron = data.length;
    let tipAu = null;
    if (dest.filtros) { // Fase AU2: solo los 3 skills de WhatsApp; la Tipificación además solo con los agentes elegidos
      const f = filtrarChatsAurora(opts.db, dest, data, mapa);
      if (f.aviso) { partes.push(mes + ': ' + f.aviso + ', sin cambios'); continue; }
      data = f.data;
      tipAu = f.tipificacion;
    }
    let h = hojaWhatsapp(data, mapa);
    data = null; // datos del cliente y demás datos crudos no se guardan ni se quedan en memoria
    // Fase AU3 (26/11, OK del usuario): Wolkvox puede traer chats que empezaron en otro mes (octubre de Aurora trajo 3
    // grupos día-cola de otro mes, p. ej. abiertos el 30/09 y cerrados en octubre). Esos chats se descartan y se dicen;
    // el mes solo se rechaza si NINGÚN chat cae en el mes pedido.
    const enMes = h.trafico.filter((t) => t.fechaInicio.slice(0, 7) === mes);
    const fuera = h.trafico.length - enMes.length;
    const chatsFuera = h.trafico.filter((t) => t.fechaInicio.slice(0, 7) !== mes).reduce((a, t) => a + t.totalWhatsapp, 0);
    if (fuera && !enMes.length) { res.estado = 'error'; res.error = 'respuesta_invalida'; partes.push(mes + ': ' + fuera + ' grupos de chats fuera del mes y ninguno dentro, sin cambios'); return; }
    if (fuera) { h.trafico = enMes; h.tiempos = h.tiempos.filter((t) => String(t[1]).slice(0, 7) === mes); }
    if (!h.trafico.length) { partes.push(mes + ': ' + llegaron + ' chats, ninguno de entrada con fecha (' + h.salida + ' de salida, ' + h.sinFecha + ' sin fecha), sin cambios'); continue; }
    let wT = { insertadas: 0, borradas: 0 }, wTi = { insertadas: 0, borradas: 0 }, wTip = null;
    const tipFilas = tipAu ? tipificacionChatsMes(tipAu.hoja, mes) : null;
    if (tipFilas && tipFilas.error) { res.estado = 'error'; res.error = 'respuesta_invalida'; partes.push(mes + ': tipificación de WhatsApp no esperada (' + String(tipFilas.error).slice(0, 120) + '), sin cambios'); return; }
    // Fase AU5: en Aurora, abandonadas y ATA de cada día-cola salen de skill_1 (lo guardó el Flujo), nunca de una resta.
    const completadas = dest.filtros && dest.filtros.waSkills ? require('./wolkvox-wa-skill1').completarTrafico(opts.db, opts.campana, mes, h.trafico) : null;
    opts.db.transaction(() => {
      wT = cargarTraficoWhatsapp(opts.db, { campana: opts.campana, archivoNombre: ARCHIVO, cargadoPorNombre: QUIEN, filas: h.trafico });
      if (h.tiempos.length) wTi = cargarWhatsappTiempos(opts.db, { campana: opts.campana, archivoNombre: ARCHIVO, cargadoPorNombre: QUIEN, filas: h.tiempos });
      if (tipFilas && tipFilas.filas.length) {
        wTip = require('./tipificaciones').cargarTipificaciones(opts.db, { campana: opts.campana, canal: 'WHATSAPP', archivoNombre: ARCHIVO, cargadoPorNombre: QUIEN, filas: tipFilas.filas, desde: mes + '-01', hasta: ing.ultimoDiaDelMes(mes) });
      }
    })();
    const recibidos = h.trafico.reduce((a, t) => a + t.totalWhatsapp, 0), contestados = h.trafico.reduce((a, t) => a + t.contestados, 0);
    res.meses.push({ mes, filas: h.trafico.length, tiempos: h.tiempos.length });
    if (completadas !== null) partes.push(mes + ': abandonadas y ATA de skill_1 en ' + completadas + ' de ' + h.trafico.length + ' filas día-cola' + (completadas ? '' : ' (corre el Flujo del mes para traerlas)'));
    partes.push(mes + ': ' + llegaron + ' chats → ' + recibidos + ' de entrada (' + contestados + ' con asesor) en ' + h.trafico.length + ' filas día-cola, ' + h.tiempos.length + ' tiempos de primera respuesta; ' + h.salida + ' de salida y ' + h.sinFecha + ' sin fecha fuera, ' + h.sinTiempo + ' sin tiempo' + (chatsFuera ? ', ' + chatsFuera + ' chats de otro mes fuera' : '') + (completadas ? '' : '; abandono sin dato (¿Edwin?)') +
      (tipAu ? '; ' + tipAu.otrasSkills + ' de otras skills fuera; tipificación: ' + (tipAu.sinAgentes ? tipAu.vistos + ' agentes vistos y ninguno elegido, sin escribir' : (wTip ? wTip.insertadas : 0) + ' chats de ' + tipAu.agentesElegidos + ' agentes (' + tipAu.otrosAgentes + ' de otros agentes fuera' + (tipFilas && tipFilas.fuera ? ', ' + tipFilas.fuera + ' de otro mes' : '') + ')') : '') + '; con respaldo');
    h = null;
  }
}

// Fase AU2 (mapeo de Edwin, 26/11): chats de la réplica de Aurora. Tráfico y tiempos: solo los 3 skills de WhatsApp,
// SIN filtro de agente. Tipificación de WhatsApp: esos 3 skills y solo los agentes de Inconexión elegidos (los vistos
// quedan anotados). Si no se conoce ningún skill_id de esos 3 (el mapa sale del Flujo, skill_1), no se escribe nada.
const CHAT_TIPIF_COLUMNAS = [['agent_name', 'AGENT_NAME'], ['date', 'DATE'], ['date_close', 'DATE_CLOSE'], ['description_cod_act', 'DESCRIPTION_COD_ACT'], ['skill_name', 'SKILL_NAME'], ['cod_act', 'COD_ACT'], ['skill_id', 'SKILL_ID'], ['channel', 'CHANNEL']];
function filtrarChatsAurora(db, dest, data, mapa) {
  const AG = require('./wolkvox-agentes');
  const f = dest.filtros;
  const ids = new Set([...mapa].filter(([, n]) => AG.enLista(f.waSkills, n)).map(([id]) => id));
  if (!ids.size) return { aviso: 'no se conoce el skill_id de ' + f.waSkills.join(', ') + ' (enciende «flujo» para que skill_1 los traiga, o llena «Skills de WhatsApp»)' };
  const enSkill = data.filter((r) => ids.has(String(_v(r || {}, 'skill_id') == null ? '' : _v(r || {}, 'skill_id')).trim()));
  const otrasSkills = data.length - enSkill.length;
  const conAgente = enSkill.filter((r) => !_vacio(_v(r || {}, 'agent_name')));
  const vistos = AG.registrarVistos(db, dest.campana, conAgente.map((r) => _v(r, 'agent_name')));
  const elegidos = AG.incluidos(db, dest.campana);
  const deInconexion = elegidos.size ? conAgente.filter((r) => elegidos.has(AG.norm(_v(r, 'agent_name')))) : [];
  // La hoja de Tipificación lleva SOLO estas columnas (ni cliente, ni teléfono, ni comentarios).
  const hoja = [CHAT_TIPIF_COLUMNAS.map((c) => c[1])].concat(deInconexion.map((r) => CHAT_TIPIF_COLUMNAS.map(([api]) => {
    if (api === 'skill_name') return mapa.get(String(_v(r, 'skill_id')).trim()) || '';
    const v = _v(r, api);
    return v === undefined || v === null ? '' : v;
  })));
  return {
    data: enSkill,
    tipificacion: { hoja, otrasSkills, vistos, sinAgentes: !elegidos.size, agentesElegidos: elegidos.size, otrosAgentes: conAgente.length - deInconexion.length },
  };
}
// Hoja de chats → filas de Tipificación del mes (las de otro mes quedan fuera y se cuentan).
function tipificacionChatsMes(hoja, mes) {
  if (hoja.length < 2) return { filas: [], fuera: 0 };
  const p = T.tipificacionParseFilas(hoja, null, 'WHATSAPP');
  if (p.error) return { error: p.error };
  const todas = p.filas.map(T.tipificacionFilaComoArray);
  const filas = todas.filter((f) => String(f[1]).slice(0, 7) === mes);
  return { filas, fuera: todas.length - filas.length };
}

const MODULOS = {
  flujo_hora: { api: 'skill_7', descripcion: 'Flujo por hora + AHT y espera', correr: correrFlujoHora },
  cdr: { api: 'cdr_1', descripcion: 'Tipificación, Eficacia, únicas contestadas y conectadas de salida', correr: correrCdr },
  encuesta: { api: 'diagram_4', descripcion: 'Encuesta (HistIVR) sin teléfono ni comentarios', correr: correrEncuesta }, // Fase A11
  no_conectadas: { api: 'cdr_5', descripcion: 'Llamadas de salida no conectadas (sin teléfono)', correr: correrNoConectadas }, // Fase A15
  abandonadas: { api: 'skill_2', descripcion: 'Llamadas únicas: abandonadas (sin teléfono)', correr: correrAbandonadas }, // Fase A19
  whatsapp: { api: 'chat_1', descripcion: 'WhatsApp de entrada (tráfico por cola y primera respuesta) sin datos del cliente', correr: correrWhatsapp }, // Fase N3: réplica de ORLANT; Fase AU2: + réplica de Aurora (también Tipificación de WhatsApp)
};
function modulosDe(valor) {
  return String(valor == null ? '' : valor).split(',').map((s) => s.trim().toLowerCase()).filter((s) => Object.prototype.hasOwnProperty.call(MODULOS, s));
}

// Una corrida de un módulo (programada o «Ejecutar ahora»). Registro en wolkvox_auto_corridas y
// Historial WOLKVOX_MODULO. Devuelve { estado, consultas, meses, detalle, error? }.
async function correrModulo(nombre, opts) {
  const mod = MODULOS[nombre];
  const { db } = opts;
  const dest = D.destino(opts.destino); // Fase A24: lanza si no es de la lista cerrada
  const CAMPANA = dest.campana;
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
  if (!D.campanaLista(db, dest)) { res.estado = 'omitida'; partes.push(dest.clave === 'replica' ? 'la réplica no existe' : 'la campaña no existe o es interna'); return terminar(); }
  // Fase N6: cada destino solo corre sus módulos autorizados (ORLANT: flujo_hora, cdr, no_conectadas).
  if (!D.moduloPermitido(dest, nombre)) { res.estado = 'omitida'; partes.push('módulo no autorizado para esta campaña'); return terminar(); }
  const OPERACION = dest.operacion; // Fase N5: del destino
  const cred = opts.credenciales || wv.credenciales(OPERACION, env);
  if (!cred) { res.estado = 'omitida'; partes.push('falta el token o el servidor de Wolkvox'); return terminar(); }
  const meses = A.planDe({ mes: opts.mes, ahora, destino: dest, huecoReal: opts.huecoReal });
  if (!meses.length) { res.estado = 'omitida'; partes.push(opts.mes ? 'mes no válido (' + String(opts.mes).slice(0, 7) + ')' : 'nada que pedir'); return terminar(); }
  if (wv.usoDelDia(db, OPERACION, ahora) + meses.length * (nombre === 'cdr' ? consultasCdrPorMes(dest) : (mod.consultasPorMes || 1)) > wv.topeDiario(env)) { res.estado = 'omitida'; partes.push('no alcanza el tope del día'); return terminar(); }
  try {
    await mod.correr({ db, env, ahora, mes: opts.mes, fetchImpl: opts.fetchImpl, cred, destino: dest, campana: CAMPANA, huecoReal: opts.huecoReal }, partes, res);
  } catch (e) {
    if (!(e instanceof wv.WolkvoxError)) throw e;
    res.estado = res.meses.length ? 'parcial' : 'error';
    res.error = e.codigo;
    partes.push('error ' + e.codigo + (e.causa ? ' (' + e.causa + ')' : '') + (e.httpStatus ? ' ' + e.httpStatus : '') + (e.campos ? ' campos: ' + e.campos.join(',').slice(0, 300) : '') + ', sin cambios, sin reintento');
  }
  return terminar();
}

module.exports = {
  tramosCdr, consultasCdrPorMes, // Fase AU3
  hojaWhatsapp, WA_DESCARTADAS, // Fase N3
  // Fase A26: cuentas de prueba (las listas solo se cambian en pruebas)
  esCuentaPrueba, quitarCuentasPrueba, vaciarMes, PRUEBA_HUELLAS, PRUEBA_IDS,
  _configurarPruebaParaPruebas: (huellas, ids) => { _pruebaHuellas = huellas || PRUEBA_HUELLAS; _pruebaIds = ids || PRUEBA_IDS; },
  _huellaParaPruebas: _huella,
  conteoCdr, MODULOS, modulosDe, correrModulo, perfilCdr, PERFILES_CDR, hojaFlujoHora, ahtEsperaDiarios, reemplazarMesFlujoHora, actualizarAhtEspera, hojaCdr, CDR_COLUMNAS, CDR_DESCARTADAS, opcionesCdrMobilize, hojaEncuesta, ENCUESTA_DESCARTADAS, hojaNoConectadas, NC_DESCARTADAS, hojaAbandonadas, AB_DESCARTADAS };
