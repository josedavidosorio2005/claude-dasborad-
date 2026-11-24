// orlant-tablero.js — Fase N1 (plan docs/orlant/nuevo-dashboard/plan.md): datos del tablero nuevo
// de ORLANT con lo que YA se carga a mano (solo lectura, nada nuevo en la base):
//  - Inbound llamadas: calidad_nivel_servicio_diario (Tráfico de Llamadas, por día y skill).
//  - Inbound WhatsApp: trafico_whatsapp (por cola) + whatsapp_tiempos (segundos hasta contestar).
//  - Outbound: salidaCombinadaPorMes (salida por mes: archivo o CDR, General / 3P / sin clasificar).
//  - Citas: agendas (una fila por cita, General / 3P, por fecha de solicitud).
// La entrada no trae línea (General / 3P) hasta tener el mapa de skills (fase N2); la salida y
// las citas sí. Asesores y back office llegan con la API (N8) y con su definición (N10).
'use strict';
const { salidaCombinadaPorMes } = require('./salida-cdr');
const skillLinea = require('./skill-linea'); // Fase N2: línea de cada skill
const { traficoAbandonadasDe } = require('../public/js/trafico-logic.js'); // Fase N2: misma regla que la pestaña

const CAMPANA = 'ORLANT';
const GRANULARIDADES = ['dia', 'semana', 'mes'];
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

// Lunes de la semana de una fecha AAAA-MM-DD (en UTC, sin depender de la zona del servidor).
function lunesDe(fecha) {
  const d = new Date(fecha + 'T00:00:00Z');
  const dia = (d.getUTCDay() + 6) % 7; // 0 = lunes
  d.setUTCDate(d.getUTCDate() - dia);
  return d.toISOString().slice(0, 10);
}
function periodoDe(fecha, gran) {
  if (gran === 'mes') return fecha.slice(0, 7);
  if (gran === 'semana') return lunesDe(fecha);
  return fecha.slice(0, 10);
}
const pct = (a, b) => (b > 0 ? a / b : null);

function rangoValido(q) {
  const desde = FECHA.test(q.desde || '') ? q.desde : null;
  const hasta = FECHA.test(q.hasta || '') ? q.hasta : null;
  const gran = GRANULARIDADES.includes(q.gran) ? q.gran : 'mes';
  return { desde, hasta, gran };
}
function filtroFechas(col, desde, hasta) {
  const conds = [], args = [];
  if (desde) { conds.push(`substr(${col},1,10) >= ?`); args.push(desde); }
  if (hasta) { conds.push(`substr(${col},1,10) <= ?`); args.push(hasta); }
  return { sql: conds.length ? ' AND ' + conds.join(' AND ') : '', args };
}

function acumular(mapa, clave, inicial) {
  if (!mapa.has(clave)) mapa.set(clave, inicial());
  return mapa.get(clave);
}
const ordenar = (mapa) => [...mapa.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([periodo, v]) => ({ periodo, ...v }));

// Fase N2 (23/11/2026): entrada de llamadas con las MISMAS reglas que la pestaña «Tráfico de Llamadas»
// (public/js/trafico-logic.js): abandonadas por fila (las del archivo o, si no vinieron, ingresadas −
// contestadas), TMO (AHT) y ASA ponderados por contestadas. La línea (General / 3P) sale del «Mapa de
// skills» (skill-linea.js, Fase N6): un skill sin guardar va a «SIN_DEFINIR» (no entra en ninguna de
// las dos), y uno marcado «No cuenta» queda fuera de todo (se informa cuántas llamadas).
const LINEAS_ENTRADA = ['GENERAL', '3P', 'SIN_DEFINIR'];
function llamadas(db, campana, desde, hasta, gran) {
  const f = filtroFechas('fecha', desde, hasta);
  const filas = db.prepare(`SELECT fecha, skillName, totalLlamadas, contestadas, contestadas20sEstimado, llamadasAbandonadas, asaSegundos, ahtSegundos FROM calidad_nivel_servicio_diario WHERE campana = ?${f.sql}`).all(campana, ...f.args);
  const mapa = skillLinea.mapa(db, campana);
  const nuevo = () => ({ recibidas: 0, contestadas: 0, abandonadas: 0, ns20Num: 0, ns20Den: 0, tmoNum: 0, tmoDen: 0, asaNum: 0, asaDen: 0 });
  const serie = new Map(), skills = new Map(), tot = nuevo();
  const porLinea = Object.fromEntries(LINEAS_ENTRADA.map((l) => [l, { tot: nuevo(), serie: new Map() }]));
  const noCuenta = { recibidas: 0, skills: new Set() };
  for (const r of filas) {
    const linea = mapa.get(skillLinea.normalizarSkill(r.skillName) || '') || null;
    if (linea === 'NO_CUENTA') { noCuenta.recibidas += r.totalLlamadas; noCuenta.skills.add(r.skillName); continue; }
    const pl = porLinea[linea || 'SIN_DEFINIR'];
    const p = periodoDe(r.fecha, gran);
    for (const o of [tot, acumular(serie, p, nuevo), acumular(skills, r.skillName, nuevo), pl.tot, acumular(pl.serie, p, nuevo)]) {
      o.recibidas += r.totalLlamadas; o.contestadas += r.contestadas;
      o.abandonadas += traficoAbandonadasDe(r);
      if (r.contestadas20sEstimado !== null && r.contestadas20sEstimado !== undefined) { o.ns20Num += r.contestadas20sEstimado; o.ns20Den += r.totalLlamadas; }
      if (r.ahtSegundos !== null && r.ahtSegundos !== undefined && r.contestadas > 0) { o.tmoNum += r.ahtSegundos * r.contestadas; o.tmoDen += r.contestadas; }
      if (r.asaSegundos !== null && r.asaSegundos !== undefined && r.contestadas > 0) { o.asaNum += r.asaSegundos * r.contestadas; o.asaDen += r.contestadas; }
    }
  }
  const cerrar = (o) => ({
    recibidas: o.recibidas, contestadas: o.contestadas, abandonadas: o.abandonadas,
    nivelServicio20s: pct(o.ns20Num, o.ns20Den), nivelAtencion: pct(o.contestadas, o.recibidas), abandono: pct(o.abandonadas, o.recibidas),
    tmoSegundos: o.tmoDen > 0 ? o.tmoNum / o.tmoDen : null, asaSegundos: o.asaDen > 0 ? o.asaNum / o.asaDen : null,
  });
  const serieDe = (m) => ordenar(m).map((x) => ({ periodo: x.periodo, ...cerrar(x) }));
  return {
    total: cerrar(tot),
    serie: serieDe(serie),
    porSkill: [...skills.entries()].map(([skill, o]) => ({ skill, linea: mapa.get(skillLinea.normalizarSkill(skill) || '') || null, recibidas: o.recibidas, contestadas: o.contestadas, participacion: pct(o.recibidas, tot.recibidas) }))
      .sort((a, b) => b.recibidas - a.recibidas),
    porLinea: Object.fromEntries(LINEAS_ENTRADA.map((l) => [l, { total: cerrar(porLinea[l].tot), serie: serieDe(porLinea[l].serie) }])),
    noCuenta: { recibidas: noCuenta.recibidas, skills: noCuenta.skills.size },
    mapaVacio: mapa.size === 0,
  };
}

// Fase N2: tipificación de las llamadas de ENTRADA (canal Llamadas; la salida es skill «-», Fase 183),
// en el rango, por línea con el mismo «Mapa de skills». Las 15 más frecuentes y «Otras».
const TOP_TIPIFICACION = 15;
function tipificacionEntrada(db, campana, desde, hasta) {
  const f = filtroFechas('fecha', desde, hasta);
  const filas = db.prepare(`SELECT tipificacion, skill, COUNT(*) AS n FROM tipificaciones WHERE campana = ? AND canal = 'LLAMADAS' AND COALESCE(skill, '') <> '-'${f.sql} GROUP BY tipificacion, skill`).all(campana, ...f.args);
  const mapa = skillLinea.mapa(db, campana);
  const grupos = { total: new Map(), GENERAL: new Map(), '3P': new Map(), SIN_DEFINIR: new Map() };
  let fuera = 0;
  for (const r of filas) {
    const linea = mapa.get(skillLinea.normalizarSkill(r.skill || '') || '') || null;
    if (linea === 'NO_CUENTA') { fuera += r.n; continue; }
    const t = r.tipificacion || 'Sin tipificación';
    for (const g of [grupos.total, grupos[linea || 'SIN_DEFINIR']]) g.set(t, (g.get(t) || 0) + r.n);
  }
  const top = (m) => {
    const lista = [...m.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
    const total = lista.reduce((a, x) => a + x[1], 0);
    const filasTop = lista.slice(0, TOP_TIPIFICACION).map(([tipificacion, n]) => ({ tipificacion, n, participacion: pct(n, total) }));
    const resto = lista.slice(TOP_TIPIFICACION).reduce((a, x) => a + x[1], 0);
    if (resto) filasTop.push({ tipificacion: 'Otras (' + (lista.length - TOP_TIPIFICACION) + ')', n: resto, participacion: pct(resto, total) });
    return { total, filas: filasTop };
  };
  return { total: top(grupos.total), porLinea: { GENERAL: top(grupos.GENERAL), '3P': top(grupos['3P']), SIN_DEFINIR: top(grupos.SIN_DEFINIR) }, noCuenta: fuera };
}

// Cada fila de trafico_whatsapp es una cola por un PERÍODO (fechaInicio..fechaFin): un día con la base
// diaria de Wolkvox, o un mes con el reporte por rango. Para no inventar cifras:
//  - una fila entra al rango solo si cae COMPLETA dentro (si cruza el borde, se cuenta en «parciales»);
//  - entra a la serie solo si cabe en UN período de la granularidad (si no, «fueraDeGrano»; sigue en
//    el total). Así un mes cargado en una fila nunca aparece entero en el día 1.
// Abandono: con la columna `abandonados`, igual que la pestaña «Tráfico de WhatsApp» y el PDF
// (null si ninguna fila la trae); nunca recibidos − contestados.
function whatsapp(db, campana, desde, hasta, gran) {
  const conds = [], args = [];
  if (desde) { conds.push('fechaFin >= ?'); args.push(desde); }
  if (hasta) { conds.push('fechaInicio <= ?'); args.push(hasta); }
  const filas = db.prepare(`SELECT fechaInicio, fechaFin, totalWhatsapp, contestados, abandonados, asaSegundos FROM trafico_whatsapp WHERE campana = ?${conds.length ? ' AND ' + conds.join(' AND ') : ''}`).all(campana, ...args);
  const nuevo = () => ({ recibidos: 0, contestados: 0, abN: 0, conAb: false, asaNum: 0, asaDen: 0, r0a3: 0, r3a5: 0, rMas5: 0 });
  const serie = new Map(), tot = nuevo();
  let parciales = 0, fueraDeGrano = 0;
  for (const r of filas) {
    const ini = r.fechaInicio.slice(0, 10), fin = (r.fechaFin || r.fechaInicio).slice(0, 10);
    if ((desde && ini < desde) || (hasta && fin > hasta)) { parciales++; continue; }
    const destinos = [tot];
    const p = periodoDe(ini, gran);
    if (p === periodoDe(fin, gran)) destinos.push(acumular(serie, p, nuevo)); else fueraDeGrano++;
    for (const o of destinos) {
      o.recibidos += r.totalWhatsapp; o.contestados += r.contestados;
      if (r.abandonados !== null && r.abandonados !== undefined) { o.abN += r.abandonados; o.conAb = true; }
      if (r.asaSegundos !== null && r.asaSegundos !== undefined) { o.asaNum += r.asaSegundos * r.contestados; o.asaDen += r.contestados; }
    }
  }
  // Rangos de tiempo hasta contestar (Fase 142, una fila por conversación contestada, por día).
  const ft = filtroFechas('fecha', desde, hasta);
  const tiempos = db.prepare(`SELECT fecha, segundos FROM whatsapp_tiempos WHERE campana = ?${ft.sql}`).all(campana, ...ft.args);
  for (const t of tiempos) {
    for (const o of [tot, acumular(serie, periodoDe(t.fecha, gran), nuevo)]) {
      if (t.segundos <= 180) o.r0a3++; else if (t.segundos <= 300) o.r3a5++; else o.rMas5++;
    }
  }
  const cerrar = (o) => {
    const conTiempo = o.r0a3 + o.r3a5 + o.rMas5;
    const abandonados = o.conAb ? o.abN : null;
    return {
      recibidos: o.recibidos, contestados: o.contestados, abandonados,
      abandono: abandonados === null ? null : pct(abandonados, o.recibidos), atencion: pct(o.contestados, o.recibidos),
      asaSegundos: o.asaDen > 0 ? o.asaNum / o.asaDen : null,
      conTiempo, rango0a3: o.r0a3, rango3a5: o.r3a5, rangoMas5: o.rMas5, pct0a3: pct(o.r0a3, conTiempo),
    };
  };
  return { total: cerrar(tot), serie: ordenar(serie).map((s) => ({ periodo: s.periodo, ...cerrar(s) })), parciales, fueraDeGrano };
}

// La salida viene por mes: entra un mes si se cruza con el rango.
function outbound(db, campana, desde, hasta) {
  const meses = salidaCombinadaPorMes(db, campana).filter((m) => (!desde || m.mes >= desde.slice(0, 7)) && (!hasta || m.mes <= hasta.slice(0, 7)));
  const k = ['llamadasGeneral', 'llamadas3p', 'llamadasSinAsignar', 'wppGeneral', 'wpp3p', 'wppSinAsignar'];
  const total = Object.fromEntries(k.map((c) => [c, meses.reduce((a, m) => a + (m[c] || 0), 0)]));
  return { meses: meses.map((m) => Object.fromEntries([['mes', m.mes], ...k.map((c) => [c, m[c] || 0])])), total };
}

function citas(db, campana, desde, hasta, gran) {
  const f = filtroFechas('fechaSolicitud', desde, hasta);
  const filas = db.prepare(`SELECT substr(fechaSolicitud,1,10) AS fecha, tipoLinea FROM agendas WHERE campana = ?${f.sql}`).all(campana, ...f.args);
  const nuevo = () => ({ total: 0, general: 0, p3: 0 });
  const serie = new Map(), tot = nuevo();
  for (const r of filas) {
    for (const o of [tot, acumular(serie, periodoDe(r.fecha, gran), nuevo)]) {
      o.total++; if (r.tipoLinea === 'GENERAL') o.general++; else if (r.tipoLinea === '3P') o.p3++;
    }
  }
  return { total: tot, serie: ordenar(serie) };
}

function orlantTableroDatos(db, q = {}, campana = CAMPANA) {
  const { desde, hasta, gran } = rangoValido(q);
  return {
    campana, desde, hasta, gran,
    llamadas: llamadas(db, campana, desde, hasta, gran),
    tipificacionEntrada: tipificacionEntrada(db, campana, desde, hasta), // Fase N2
    whatsapp: whatsapp(db, campana, desde, hasta, gran),
    outbound: outbound(db, campana, desde, hasta),
    citas: citas(db, campana, desde, hasta, gran),
  };
}

module.exports = { orlantTableroDatos, lunesDe, periodoDe, rangoValido, GRANULARIDADES, CAMPANA };
