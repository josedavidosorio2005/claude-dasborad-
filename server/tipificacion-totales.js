// tipificacion-totales.js — Fase 267: la pestaña Tipificacion (ORLANT,
// Mobilize, Aurora, HLM) pide sus totales en UN solo pedido por mitad
// (Llamadas / WhatsApp), en vez de 3 a 6 pedidos en fila (la torta por
// tramo de meses, las tarjetas de salida mes a mes y las de linea por tramo).
//
// Las cifras son las MISMAS que antes: se calculan con las mismas funciones
// (tipificacionesPorTipo, tipificacionesResumenSalida, salidaPorLinea) y se
// suman con la misma regla que usaba el navegador (tipificacionSumarPorTipo,
// tipificacionSumarCampos y tipificacionTramosMeses de
// public/js/tipificacion-logic.js, copiadas aqui tal cual). La prueba
// fase267-tipificacion-totales.test.js compara el calculo viejo con este.
'use strict';

const { tipificacionesPorTipo, tipificacionesResumenSalida, usaClasificacionAsesores } = require('./tipificaciones');
const { salidaPorLinea } = require('./clasificacion-asesores');

// Meses 'AAAA-MM' -> tramos seguidos [{desde, hasta}] (ago+sep+oct = uno; ago+oct = dos).
function tramosDeMeses(meses) {
  const l = (meses || []).filter((m) => /^\d{4}-\d{2}$/.test(m)).filter((m, i, a) => a.indexOf(m) === i).sort();
  const sig = (m) => {
    let a = parseInt(m.slice(0, 4), 10);
    let n = parseInt(m.slice(5, 7), 10) + 1;
    if (n === 13) { a += 1; n = 1; }
    return a + '-' + (n < 10 ? '0' + n : '' + n);
  };
  const fin = (m) => {
    const d = new Date(Date.UTC(parseInt(m.slice(0, 4), 10), parseInt(m.slice(5, 7), 10), 0)).getUTCDate();
    return m + '-' + (d < 10 ? '0' + d : '' + d);
  };
  const tramos = [];
  l.forEach((m) => {
    const u = tramos[tramos.length - 1];
    if (u && sig(u.ultimo) === m) u.ultimo = m;
    else tramos.push({ primero: m, ultimo: m });
  });
  return tramos.map((t) => ({ desde: t.primero + '-01', hasta: fin(t.ultimo) }));
}

// Suma varias respuestas de por-tipo (una por tramo), sin "Otras".
function sumarPorTipo(partes) {
  const por = {};
  const orden = [];
  let total = 0;
  (partes || []).forEach((r) => {
    if (!r) return;
    total += r.total || 0;
    (r.todas || r.datos || []).forEach((x) => {
      if (x.esOtras) return;
      if (!(x.tipificacion in por)) { por[x.tipificacion] = 0; orden.push(x.tipificacion); }
      por[x.tipificacion] += x.cantidad || 0;
    });
  });
  const todas = orden.map((k) => ({ tipificacion: k, cantidad: por[k] })).sort((a, b) => b.cantidad - a.cantidad);
  return { datos: todas, todas, total };
}

function sumarCampos(partes, campos) {
  const base = Object.assign({}, (partes || [])[0] || {});
  campos.forEach((c) => {
    base[c] = (partes || []).reduce((a, r) => a + ((r && r[c]) || 0), 0);
  });
  return base;
}

const CAMPOS_SALIDA = ['total', 'conectadas', 'noConectadas', 'totalLlamadas'];
const CAMPOS_LINEAS = ['total', 'salida', 'general', 'p3', 'sinClasificar'];

// q: los filtros de siempre (campana, canal, mes | desde/hasta, agente, skill,
// tipoInteraccion, sentido, linea) + `meses` (lista 'AAAA-MM,...', solo cuando
// el periodo sale de varios meses de MESES) + `salida` / `lineas` ('1' = incluir).
function tipificacionTotales(db, q) {
  const base = { ...q };
  delete base.meses; delete base.salida; delete base.lineas;
  const meses = q.meses ? String(q.meses).split(',') : [];
  const tramos = meses.length > 1 ? tramosDeMeses(meses) : [];
  const porTramos = (fn) => (tramos.length > 1 ? tramos.map((t) => fn({ ...base, desde: t.desde, hasta: t.hasta })) : [fn(base)]);

  const partesTipo = porTramos((x) => tipificacionesPorTipo(db, x));
  const out = { canal: q.canal, porTipo: partesTipo.length === 1 ? partesTipo[0] : sumarPorTipo(partesTipo) };

  if (q.lineas === '1' && usaClasificacionAsesores(q.campana)) {
    // Mismos filtros de la mitad, nunca el de tipo ni el de linea (el reparto se ve completo).
    const sinFiltro = { ...base };
    delete sinFiltro.tipoInteraccion; delete sinFiltro.sentido; delete sinFiltro.linea;
    const partes = tramos.length > 1 ? tramos.map((t) => salidaPorLinea(db, { ...sinFiltro, desde: t.desde, hasta: t.hasta })) : [salidaPorLinea(db, sinFiltro)];
    out.lineas = partes.length === 1 ? partes[0] : sumarCampos(partes, CAMPOS_LINEAS);
  }

  if (q.salida === '1' && q.canal === 'LLAMADAS') {
    // Tarjetas de salida: mes/rango + agente/skill (nunca tipo, sentido ni linea).
    const filtroSalida = { campana: q.campana };
    if (base.desde || base.hasta) {
      if (base.desde) filtroSalida.desde = base.desde;
      if (base.hasta) filtroSalida.hasta = base.hasta;
    } else if (base.mes) filtroSalida.mes = base.mes;
    if (base.agente) filtroSalida.agente = base.agente;
    if (base.skill) filtroSalida.skill = base.skill;
    if (meses.length > 1) {
      const partes = meses.map((m) => {
        const x = { campana: q.campana, mes: m };
        if (base.agente) x.agente = base.agente;
        if (base.skill) x.skill = base.skill;
        return tipificacionesResumenSalida(db, x);
      });
      const suma = Object.assign({}, partes[0] || {});
      CAMPOS_SALIDA.forEach((c) => {
        if (suma[c] === undefined) return;
        suma[c] = partes.reduce((a, r) => a + ((r && r[c]) || 0), 0);
      });
      out.resumenSalida = suma;
    } else {
      out.resumenSalida = tipificacionesResumenSalida(db, filtroSalida);
    }
  }
  return out;
}

module.exports = { tipificacionTotales, tramosDeMeses, sumarPorTipo, sumarCampos };
