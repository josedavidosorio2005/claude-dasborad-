// salida-cdr.js — Fase 170 (pedido de Edwin, reunion del 23/10/2026). La
// pestaña "Llamadas y WhatsApp de salida" de ORLANT se calcula con lo que
// guarda la Tipificacion de los 2 CDR (Fase 168), en vez del archivo mensual
// de Edwin, para los meses que ya tienen CDR:
//   - Llamadas de salida = Tipificacion de LLAMADAS con skill LLAMADAS DE
//     SALIDA (el "-" del HistCDR sin internalcall ni filas sin tipo).
//   - WhatsApp de salida = Tipificacion de WHATSAPP con tipoInteraccion
//     outbound_ma (SKILL_ID 0 del HistChat).
// Cada salida se reparte en 3P o General segun la linea del ASESOR en ese
// mes (tabla asesor_linea, la edita un administrador en la pestaña). Un
// asesor sin linea en ese mes va a "Sin asignar" (suma al total, no a 3P ni
// a General) y la pestaña lo avisa.
// Se decide POR CANAL: si un mes tiene el CDR de llamadas pero no el de
// WhatsApp (o al reves), el canal sin CDR sigue saliendo del archivo
// mensual (salida_mensual). Los meses sin ningun CDR, igual que siempre.
//
// Fase 187 (OK de Edwin, 26/10: una sola clasificacion de asesores): con
// parametros.salidaUsaClasificacion = true en el registro del cliente, la
// linea de cada asesor sale de la clasificacion POR CLIENTE de Tipificacion
// (tabla asesor_clasificacion, Fase 186), igual para todos los meses, y la
// linea mes a mes (asesor_linea) deja de usarse. asesor_linea no se borra.
// Sin el parametro, todo sigue igual que en la Fase 170.
'use strict';

const { leerRegistro } = require('./clientes-registro');
function usaClasificacionPorCliente(db, campana) {
  const c = leerRegistro(db).find((x) => x.nombre === campana);
  return !!(c && c.parametros && c.parametros.salidaUsaClasificacion === true);
}
// { agente: '3P'|'GENERAL' } de la clasificacion por cliente.
function clasificacionPorCliente(db, campana) {
  const out = {};
  db.prepare('SELECT agente, linea FROM asesor_clasificacion WHERE campana = ?').all(campana).forEach((f) => { out[f.agente] = f.linea; });
  return out;
}

// Fase 183: lazy, para no crear un require circular si tipificaciones.js llega a usar este modulo.
function salidaPorGuion(c) { return require('./tipificaciones').salidaPorGuion(c); }
function condSalidaLlamadasSql(c) { return require('./tipificaciones').condSalidaLlamadasSql(c); }

const LINEAS = ['3P', 'GENERAL'];
const SKILL_SALIDA_LLAMADAS = 'LLAMADAS DE SALIDA';
// Fase 177: una llamada con ese skill pero con un tipo que no es de salida
// (inbound, otro) no cuenta. Sin tipo (archivo sin TYPE_INTERACTION) si.
const TIPO_SALIDA_LLAMADAS = "(tipoInteraccion IS NULL OR tipoInteraccion = 'outbound_ma')";

// Salidas por asesor y mes (todas o de un mes): [{ mes, agente, llamadas, wpp }].
function salidasPorAsesor(db, campana, mes) {
  const filtroMes = mes ? ' AND substr(fecha,1,7) = @mes' : '';
  // Fase 183: ORLANT cuenta el "-" del CDR con cualquier tipo y deja las out_pre en su skill.
  const condLlam = salidaPorGuion(campana) ? condSalidaLlamadasSql(campana) : `skill = @skillLlam AND ${TIPO_SALIDA_LLAMADAS}`;
  return db.prepare(`
    SELECT substr(fecha,1,7) AS mes, agente,
      SUM(CASE WHEN canal = 'LLAMADAS' AND ${condLlam} THEN 1 ELSE 0 END) AS llamadas,
      SUM(CASE WHEN canal = 'WHATSAPP' AND tipoInteraccion = 'outbound_ma' THEN 1 ELSE 0 END) AS wpp
    FROM tipificaciones
    WHERE campana = @campana${filtroMes}
      AND ((canal = 'LLAMADAS' AND ${condLlam}) OR (canal = 'WHATSAPP' AND tipoInteraccion = 'outbound_ma'))
    GROUP BY mes, agente
    ORDER BY mes, agente`).all({ campana, mes: mes || null, skillLlam: SKILL_SALIDA_LLAMADAS });
}

// { 'AAAA-MM': { agente: '3P'|'GENERAL' } }
function lineasPorMes(db, campana, mes) {
  const filas = mes
    ? db.prepare('SELECT mes, agente, linea FROM asesor_linea WHERE campana = ? AND mes = ?').all(campana, mes)
    : db.prepare('SELECT mes, agente, linea FROM asesor_linea WHERE campana = ?').all(campana);
  const out = {};
  for (const f of filas) {
    if (!out[f.mes]) out[f.mes] = {};
    out[f.mes][f.agente] = f.linea;
  }
  return out;
}

// Totales por mes calculados del CDR: { 'AAAA-MM': { llamadas3p, ..., cdrLlamadas, cdrWpp, asesoresSinAsignar } }
function salidaCdrPorMes(db, campana) {
  const porCliente = usaClasificacionPorCliente(db, campana) ? clasificacionPorCliente(db, campana) : null;
  const lineas = porCliente ? {} : lineasPorMes(db, campana);
  const out = {};
  for (const s of salidasPorAsesor(db, campana)) {
    const m = out[s.mes] || (out[s.mes] = {
      llamadas3p: 0, llamadasGeneral: 0, llamadasSinAsignar: 0, wpp3p: 0, wppGeneral: 0, wppSinAsignar: 0,
      cdrLlamadas: false, cdrWpp: false, asesoresSinAsignar: [],
    });
    const linea = (porCliente ? porCliente[s.agente] : (lineas[s.mes] || {})[s.agente]) || null;
    const suf = linea === '3P' ? '3p' : linea === 'GENERAL' ? 'General' : 'SinAsignar';
    m['llamadas' + suf] += s.llamadas;
    m['wpp' + suf] += s.wpp;
    if (s.llamadas) m.cdrLlamadas = true;
    if (s.wpp) m.cdrWpp = true;
    if (!linea) m.asesoresSinAsignar.push(s.agente);
  }
  return out;
}

// Une el archivo mensual (salida_mensual) con lo calculado del CDR, por canal.
// Cada fila: { mes, llamadas3p, llamadasGeneral, llamadasSinAsignar, wpp3p,
// wppGeneral, wppSinAsignar, fuenteLlamadas, fuenteWpp, asesoresSinAsignar }.
function salidaCombinadaPorMes(db, campana) {
  const archivo = {};
  db.prepare('SELECT mes, llamadas3p, llamadasGeneral, wpp3p, wppGeneral FROM salida_mensual WHERE campana = ? ORDER BY mes ASC')
    .all(campana).forEach((f) => { archivo[f.mes] = f; });
  const cdr = salidaCdrPorMes(db, campana);
  // Fase 187: la pestaña dice "Sin clasificar" (y no "Sin asignar") y manda a Tipificacion.
  const extra = usaClasificacionPorCliente(db, campana) ? { lineaPorCliente: true } : {};
  const meses = [...new Set([...Object.keys(archivo), ...Object.keys(cdr)])].sort();
  return meses.map((mes) => {
    const a = archivo[mes] || null;
    const c = cdr[mes] || null;
    const usaLlam = !!(c && c.cdrLlamadas);
    const usaWpp = !!(c && c.cdrWpp);
    return {
      mes,
      llamadas3p: usaLlam ? c.llamadas3p : (a ? a.llamadas3p : 0),
      llamadasGeneral: usaLlam ? c.llamadasGeneral : (a ? a.llamadasGeneral : 0),
      llamadasSinAsignar: usaLlam ? c.llamadasSinAsignar : 0,
      wpp3p: usaWpp ? c.wpp3p : (a ? a.wpp3p : 0),
      wppGeneral: usaWpp ? c.wppGeneral : (a ? a.wppGeneral : 0),
      wppSinAsignar: usaWpp ? c.wppSinAsignar : 0,
      fuenteLlamadas: usaLlam ? 'cdr' : (a ? 'archivo' : null),
      fuenteWpp: usaWpp ? 'cdr' : (a ? 'archivo' : null),
      asesoresSinAsignar: c ? c.asesoresSinAsignar.length : 0,
      ...extra,
    };
  }).filter((f) => f.fuenteLlamadas || f.fuenteWpp);
}

// Para el editor: los asesores con salidas en ese mes, con su linea (o null).
function asesoresSalidaDelMes(db, campana, mes) {
  const lineas = lineasPorMes(db, campana, mes)[mes] || {};
  const conSalidas = salidasPorAsesor(db, campana, mes).map((s) => ({ agente: s.agente, llamadas: s.llamadas, wpp: s.wpp, linea: lineas[s.agente] || null }));
  // Asignados ese mes sin salidas (no se pierden al guardar de nuevo).
  const vistos = new Set(conSalidas.map((s) => s.agente));
  Object.keys(lineas).filter((a) => !vistos.has(a)).sort()
    .forEach((agente) => conSalidas.push({ agente, llamadas: 0, wpp: 0, linea: lineas[agente] }));
  return conSalidas;
}

// Guarda las lineas de un mes (reemplaza las de ese mes en una transaccion).
// linea null = sin asignar (no se guarda fila).
function guardarLineasDelMes(db, { campana, mes, asignaciones, guardadoPorNombre }) {
  const ahora = new Date().toISOString();
  const del = db.prepare('DELETE FROM asesor_linea WHERE campana = ? AND mes = ?');
  const ins = db.prepare('INSERT INTO asesor_linea (campana, mes, agente, linea, guardadoPorNombre, updatedAt) VALUES (?, ?, ?, ?, ?, ?)');
  let guardadas = 0;
  db.transaction(() => {
    del.run(campana, mes);
    for (const a of asignaciones) {
      if (!a.linea) continue;
      ins.run(campana, mes, a.agente, a.linea, guardadoPorNombre || '-', ahora);
      guardadas++;
    }
  })();
  return { mes, guardadas };
}

// Fase 187 (solo lectura): lo guardado mes a mes en asesor_linea, para
// decidir la migracion a la clasificacion por cliente sin perder nada.
// meses: [{ mes, asesores, p3, general }]; propuesta: { agente: linea } de los
// asesores con UNA sola linea en todos sus meses; conflictos: asesores con
// 3P en un mes y General en otro ({ agente, porMes: { mes: linea } });
// distintaDeClasificacion: asesores ya clasificados por cliente con otra linea.
function inventarioLineasPorMes(db, campana) {
  const filas = db.prepare('SELECT mes, agente, linea FROM asesor_linea WHERE campana = ? ORDER BY mes, agente').all(campana);
  const meses = {};
  const porAgente = {};
  for (const f of filas) {
    const m = meses[f.mes] || (meses[f.mes] = { mes: f.mes, asesores: 0, p3: 0, general: 0 });
    m.asesores++;
    if (f.linea === '3P') m.p3++; else m.general++;
    (porAgente[f.agente] || (porAgente[f.agente] = {}))[f.mes] = f.linea;
  }
  const clasif = clasificacionPorCliente(db, campana);
  const propuesta = {};
  const conflictos = [];
  const distintaDeClasificacion = [];
  Object.keys(porAgente).sort().forEach((agente) => {
    const lineas = [...new Set(Object.values(porAgente[agente]))];
    if (lineas.length > 1) { conflictos.push({ agente, porMes: porAgente[agente] }); return; }
    propuesta[agente] = lineas[0];
    if (clasif[agente] && clasif[agente] !== lineas[0]) distintaDeClasificacion.push({ agente, porMes: lineas[0], porCliente: clasif[agente] });
  });
  return { campana, usaClasificacionPorCliente: usaClasificacionPorCliente(db, campana), meses: Object.values(meses), propuesta, conflictos, distintaDeClasificacion };
}

module.exports = {
  usaClasificacionPorCliente,
  inventarioLineasPorMes,
  LINEAS,
  SKILL_SALIDA_LLAMADAS,
  salidasPorAsesor,
  salidaCdrPorMes,
  salidaCombinadaPorMes,
  asesoresSalidaDelMes,
  guardarLineasDelMes,
};
