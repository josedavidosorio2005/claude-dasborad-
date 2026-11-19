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
function hojaCdr(data) {
  return [CDR_COLUMNAS.map((c) => c[1])].concat(data.map((r) => {
    const salida = _SALIDA.includes(String(_v(r || {}, 'type_interaction') || '').trim().toLowerCase());
    return CDR_COLUMNAS.map(([api]) => {
      const v = _v(r || {}, api);
      if (salida && (api === 'skill_name' || api === 'skill_id') && (v === undefined || v === null || String(v).trim() === '')) return '-';
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
  let sinAgente = 0, sinTip = 0, guion = 0;
  for (const r of data) {
    const t = String(_v(r || {}, 'type_interaction') || '').trim().toLowerCase();
    const k = /^[a-z_]{1,24}$/.test(t) ? t : (t ? 'otro' : 'vacio');
    tipos[k] = (tipos[k] || 0) + 1;
    if (!String(_v(r || {}, 'agent_name') || '').trim()) sinAgente++;
    if (!String(_v(r || {}, 'description_cod_act') || '').trim()) sinTip++;
    if (String(_v(r || {}, 'skill_name') || '').trim() === '-') guion++;
  }
  const lista = Object.entries(tipos).sort((a, b) => b[1] - a[1]);
  const extra = lista.length > 6 ? lista.slice(6).reduce((n, x) => n + x[1], 0) : 0;
  return 'API ' + data.length + ' filas: ' + lista.slice(0, 6).map(([k, n]) => k + ' ' + n).join(', ') + (extra ? ', otros ' + extra : '') +
    '; sin asesor ' + sinAgente + ', sin tipificación ' + sinTip + ', skill «-» ' + guion + formaCdr(data);
}
function opcionesCdrMobilize() {
  return { codificacionesExcluidas: T.TIPIFICACION_CDR_EXCLUIR_POR_DEFECTO, marcarUnicasDia: true, conservarSalidaGuion: true };
}

async function correrCdr(opts, partes, res) {
  const { cargarTipificaciones } = require('./tipificaciones');
  const meses = _auto().plan(opts.ahora);
  for (const { mes, dias } of meses) {
    let data = [];
    let campos = [];
    // Fase A9 (18/11): cdr_1 acepta el mes completo (prueba autorizada: 1–17/11 en una consulta,
    // 80 filas): una sola consulta por mes, del 1 a ayer.
    {
      res.consultas++;
      const r = await _pedir(opts, 'cdr_1', dias[0], dias[dias.length - 1]);
      data = r.data;
      if (r.data.length) campos = wv.resumenSinValores(r.cuerpo).campos;
    }
    if (!data.length) { partes.push(mes + ': Wolkvox no trajo llamadas, sin cambios'); continue; }
    const conteo = conteoCdr(data); // Fase A12: solo números
    let p = T.tipificacionParseFilas(hojaCdr(data), null, 'LLAMADAS', opcionesCdrMobilize());
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
    const w = cargarTipificaciones(opts.db, {
      campana: CAMPANA, canal: 'LLAMADAS', archivoNombre: 'API Wolkvox (cdr_1)', cargadoPorNombre: QUIEN, filas,
      desde: mes + '-01', hasta: ing.ultimoDiaDelMes(mes),
    });
    const unicas = p.unicasDia ? p.unicasDia.unicas : null;
    res.meses.push({ mes, filas: w.insertadas, reemplazadas: w.borradas, excluidas: p.excluidas || 0, unicas, salida: p.salida || 0 });
    partes.push(mes + ': ' + w.insertadas + ' llamadas (' + (p.salida || 0) + ' de salida' + (unicas !== null ? ', ' + unicas + ' únicas de ingreso' : '') + (p.excluidas ? ', ' + p.excluidas + ' de prueba fuera' : '') + '), reemplazó ' + w.borradas + ', con respaldo · ' + conteo);
    p = null;
  }
}

// ── Paso 3 (Fase A11): diagram_4 → Encuesta (la hoja «HistIVR» del manual, mismas 25 columnas) ──
// Solo entran asesor, skill, fecha y hora, y Q01–Q04. NUNCA el teléfono (ANI), AGENT_DNI, CUSTOMER_ID,
// el comentario (VOICE_MESSAGE) ni el CONN_ID: en la réplica Calidad de encuestas queda sin teléfono ni
// comentarios (pedido del usuario, 18/11: los datos sensibles nunca se guardan). Una consulta por mes.
const EN = require('../public/js/encuesta-logic.js');
const ENCUESTA_COLUMNAS_API = [['agent_name', 'AGENT_NAME'], ['skill_name', 'SKILL_NAME'], ['q01', 'Q01'], ['q02', 'Q02'], ['q03', 'Q03'], ['q04', 'Q04']];
const ENCUESTA_DESCARTADAS = ['ani', 'agent_dni', 'agent_id', 'customer_id', 'conn_id', 'voice_message', 'voice_message_duration', 'feeling', 'result', 'skill_id', 'type_interaction', 'q05', 'q06', 'q07', 'q08', 'q09', 'q10'];
function hojaEncuesta(data) {
  const cab = ['AGENT_NAME', 'SKILL_NAME', 'DATE', 'Q01', 'Q02', 'Q03', 'Q04'];
  return [cab].concat(data.map((r) => {
    const g = (k) => { const v = _v(r || {}, k); return v === undefined || v === null ? '' : v; };
    let fecha = String(g('date')).trim();
    const hora = String(g('time')).trim();
    if (fecha && !fecha.includes(':') && /^\d{1,2}:\d{2}/.test(hora)) fecha += ' ' + hora;
    return [g('agent_name'), g('skill_name'), fecha, g('q01'), g('q02'), g('q03'), g('q04')];
  }));
}

async function correrEncuesta(opts, partes, res) {
  const { cargarEncuestas } = require('./encuestas');
  for (const { mes, dias } of _auto().plan(opts.ahora)) {
    res.consultas++;
    let { data, cuerpo } = await _pedir(opts, 'diagram_4', dias[0], dias[dias.length - 1]);
    if (!data.length) { partes.push(mes + ': Wolkvox no trajo encuestas, sin cambios'); continue; }
    const campos = wv.resumenSinValores(cuerpo).campos;
    let p = EN.encuestaParseFilas(hojaEncuesta(data));
    data = null; cuerpo = null; // lo crudo (teléfonos, comentarios) no se queda en memoria
    if (p.error) {
      res.estado = 'error'; res.error = 'respuesta_invalida';
      partes.push(mes + ': respuesta no esperada (' + String(p.error).slice(0, 120) + '; campos: ' + campos.join(',').slice(0, 300) + '), sin cambios');
      return;
    }
    const filas = p.filas.map((f) => { const x = f.slice(); x[7] = ''; x[8] = ''; x[10] = ''; return x; }); // sin comentario, conn_id ni teléfono
    const fuera = filas.filter((f) => String(f[0]).slice(0, 7) !== mes);
    if (fuera.length) { res.estado = 'error'; res.error = 'respuesta_invalida'; partes.push(mes + ': ' + fuera.length + ' encuestas fuera del mes, sin cambios'); return; }
    if (!filas.length) { partes.push(mes + ': ninguna encuesta válida, sin cambios'); continue; }
    const w = cargarEncuestas(opts.db, { campana: CAMPANA, archivoNombre: 'API Wolkvox (diagram_4)', cargadoPorNombre: QUIEN, filas, desde: mes + '-01', hasta: ing.ultimoDiaDelMes(mes) });
    res.meses.push({ mes, filas: w.insertadas, reemplazadas: w.borradas });
    partes.push(mes + ': ' + w.insertadas + ' encuestas (' + (p.avisos.length ? p.avisos.length + ' avisos, ' : '') + 'reemplazó ' + w.borradas + ', con respaldo)');
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
  const { cargarLlamadasNoConectadas } = require('./llamadas-salida');
  for (const { mes, dias } of _auto().plan(opts.ahora)) {
    res.consultas++;
    let { data } = await _pedir(opts, 'cdr_5', dias[0], dias[dias.length - 1]);
    if (!data.length) { partes.push(mes + ': Wolkvox no trajo no conectadas, sin cambios'); continue; }
    let p = LS.llamadasNoConectadasParseFilas(hojaNoConectadas(data));
    data = null; // teléfonos y demás datos crudos no se guardan ni se quedan en memoria
    if (p.error) { res.estado = 'error'; res.error = 'respuesta_invalida'; partes.push(mes + ': respuesta no esperada (' + String(p.error).slice(0, 120) + '), sin cambios'); return; }
    const fuera = p.filas.filter((f) => String(f[0]).slice(0, 7) !== mes);
    if (fuera.length) { res.estado = 'error'; res.error = 'respuesta_invalida'; partes.push(mes + ': ' + fuera.length + ' llamadas fuera del mes, sin cambios'); return; }
    const w = cargarLlamadasNoConectadas(opts.db, { campana: CAMPANA, archivoNombre: 'API Wolkvox (cdr_5)', cargadoPorNombre: QUIEN, filas: p.filas, desde: mes + '-01', hasta: ing.ultimoDiaDelMes(mes) });
    res.meses.push({ mes, filas: w.insertadas, reemplazadas: w.borradas });
    partes.push(mes + ': ' + w.insertadas + ' no conectadas (reemplazó ' + w.borradas + ', con respaldo)');
    p = null;
  }
}

const MODULOS = {
  flujo_hora: { api: 'skill_7', descripcion: 'Flujo por hora + AHT y espera', correr: correrFlujoHora },
  cdr: { api: 'cdr_1', descripcion: 'Tipificación, Eficacia, únicas contestadas y conectadas de salida', correr: correrCdr },
  encuesta: { api: 'diagram_4', descripcion: 'Encuesta (HistIVR) sin teléfono ni comentarios', correr: correrEncuesta }, // Fase A11
  no_conectadas: { api: 'cdr_5', descripcion: 'Llamadas de salida no conectadas (sin teléfono)', correr: correrNoConectadas }, // Fase A15
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

module.exports = { conteoCdr, MODULOS, modulosDe, correrModulo, hojaFlujoHora, ahtEsperaDiarios, reemplazarMesFlujoHora, actualizarAhtEspera, hojaCdr, CDR_COLUMNAS, CDR_DESCARTADAS, opcionesCdrMobilize, hojaEncuesta, ENCUESTA_DESCARTADAS, hojaNoConectadas, NC_DESCARTADAS };
