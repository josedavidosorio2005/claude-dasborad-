// calidad-logic.js — Calculos puros y reproducibles del modulo de Calidad.
//
// Estas funciones NO tocan la base de datos ni Express: reciben datos de entrada
// y devuelven un resultado. Se portaron 1:1 desde el frontend (public/js/calidad.js)
// para que el servidor sea la unica fuente de verdad de los numeros:
// mismo dato de entrada -> mismo resultado, sin importar que navegador lo pida.

'use strict';

// ── Motor de puntaje ────────────────────────────────────────
// Replica exacta de la formula de la plantilla Excel (ver public/js/calidad.js):
//   engine 'standard'  -> no critico: SI o N/A suma el peso completo; NO suma 0.
//                         critico:    SI o N/A suma el peso; NO suma (peso - 20)
//                         (puede quedar negativo) y cuenta como fallo.
//   engine 'sura'      -> solo SI suma el peso completo; NO y N/A no suman nada.
//                         Los criticos no penalizan el puntaje, solo cuentan fallos.
//   total = MAX(0, MIN(100, suma))
function computeScore(items, answers, engine) {
  engine = engine || 'standard';
  answers = answers || {};
  const answered = items.some((it) => answers[it.n]);
  if (!answered) {
    return { puntaje: null, clasificacion: '—', fallos: null, nivelCritico: '—' };
  }
  let sum = 0;
  let fallos = 0;
  items.forEach((it) => {
    const a = answers[it.n];
    if (engine === 'sura') {
      if (a === 'SI') sum += it.weight;
      if (it.critico && a === 'NO') fallos++;
    } else if (!it.critico) {
      if (a === 'N/A' || a === 'SI') sum += it.weight;
    } else if (a === 'N/A' || a === 'SI') {
      sum += it.weight;
    } else if (a === 'NO') {
      sum += it.weight - 20;
      fallos++;
    }
  });
  const puntaje = Math.max(0, Math.min(100, sum));
  const clasificacion =
    puntaje < 70 ? '🔴 CRITICO' : puntaje < 90 ? '🟡 NO CRITICO' : '🟢 SOBRESALIENTE';
  let nivelCritico;
  if (engine === 'sura') {
    nivelCritico =
      fallos === 0 ? '✅ SIN FALLOS CRITICOS' : fallos === 1 ? '⚠️ ALERTA' : '🚨 CRITICO FRECUENTE';
  } else {
    nivelCritico =
      fallos === 0
        ? '✅ SIN FALLOS CRITICOS'
        : fallos === 1
          ? '⚠️ ALERTA — 1 CRITICO'
          : '🚨 CRITICO ABSOLUTO';
  }
  return { puntaje, clasificacion, fallos, nivelCritico };
}

const r2 = (n) => Math.round(n * 100) / 100;

// ── Cronograma: valores derivados de una fila de meta ───────
// A partir de metaGrupal / asesores / diasLaborales calcula las metas
// por asesor, diaria y semanales. No se guardan en la BD: se calculan al vuelo.
function cronogramaDerived(row) {
  const metaGrupal = Number(row.metaGrupal) || 0;
  const asesores = Number(row.asesores) || 1;
  const diasLaborales = Number(row.diasLaborales) || 19;
  return {
    metaPorAsesor: r2(metaGrupal / asesores),
    metaDiaria: r2(metaGrupal / diasLaborales),
    semana1: r2(metaGrupal * 0.25),
    semana2: r2(metaGrupal * 0.5),
    semana3: r2(metaGrupal * 0.75),
    semana4: metaGrupal,
  };
}

// Devuelve una fila de cronograma con sus campos base + los derivados.
function withDerived(row) {
  return Object.assign({}, row, cronogramaDerived(row));
}

// ── Carry-forward de metas individuales ─────────────────────
// Busca la meta de un lider para un mes; si no hay una entrada exacta, toma la
// del mes anterior mas reciente que si tenga (igual que calGetCronogramaForLider).
// `rows` = todas las filas de cronograma_metas de una campana.
function metaForLiderInMonth(rows, mes, liderId) {
  if (liderId === undefined || liderId === null || liderId === '') return null;
  const candidatas = rows
    .filter((r) => String(r.liderId) === String(liderId) && r.mes <= mes)
    .sort((a, b) => b.mes.localeCompare(a.mes));
  return candidatas[0] ? withDerived(candidatas[0]) : null;
}

// ── Cumplimiento individual por lider ──────────────────────
// Para cada lider con meta vigente ese mes (via carry-forward), calcula su
// cumplimiento desglosado por canal (Llamada / WhatsApp) segun el % de WhatsApp
// a auditar configurado. Portado de calLideresCumplimiento().
//
// Emparejamiento monitoreo<->lider: por evaluadorUserId === liderId. Es mas
// robusto que el emparejamiento por nombre del frontend original (un nombre
// escrito a mano podia no coincidir); el userId lo fija el servidor con la
// sesion autenticada de quien crea el monitoreo.
function lideresCumplimiento(monitoreos, cronogramaRows, mes) {
  const liderIds = new Set();
  cronogramaRows
    .filter((r) => r.mes <= mes && r.liderId != null)
    .forEach((r) => liderIds.add(String(r.liderId)));

  return [...liderIds]
    .map((lid) => {
      const row = metaForLiderInMonth(cronogramaRows, mes, lid);
      if (!row) return null;
      const mis = monitoreos.filter(
        (m) => monthKey(m.fecha) === mes && String(m.evaluadorUserId) === String(lid)
      );
      const realizados = mis.length;
      const realizadosWpp = mis.filter((m) => m.canal === 'WPP').length;
      const realizadosLlamada = realizados - realizadosWpp;
      const pctWpp = row.pctWhatsapp || 0;
      const metaWpp = row.whatsapp ? Math.round((row.metaGrupal * pctWpp) / 100) : 0;
      const metaLlamada = row.metaGrupal - metaWpp;
      const pct = row.metaGrupal
        ? Math.round(Math.min(100, (realizados / row.metaGrupal) * 100))
        : 0;
      const pctWppCompl = metaWpp
        ? Math.round(Math.min(100, (realizadosWpp / metaWpp) * 100))
        : null;
      const pctLlamadaCompl = metaLlamada
        ? Math.round(Math.min(100, (realizadosLlamada / metaLlamada) * 100))
        : null;
      return {
        liderId: Number(lid),
        liderNombre: row.liderNombre,
        meta: row.metaGrupal,
        realizados,
        pct,
        auditaWpp: !!row.whatsapp,
        metaWpp,
        realizadosWpp,
        pctWppCompl,
        metaLlamada,
        realizadosLlamada,
        pctLlamadaCompl,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.liderNombre.localeCompare(b.liderNombre));
}

// ── Resumen por asesor ─────────────────────────────────────
// Portado de renderCalResumenTable(): promedio de puntaje, total de fallos y
// alerta por asesor, para el conjunto de monitoreos que se le pasa.
function resumenPorAsesor(monitoreos) {
  const byAsesor = {};
  monitoreos.forEach((m) => {
    if (!byAsesor[m.asesor]) byAsesor[m.asesor] = { count: 0, sum: 0, fallos: 0 };
    byAsesor[m.asesor].count++;
    byAsesor[m.asesor].sum += m.puntaje;
    byAsesor[m.asesor].fallos += m.fallos || 0;
  });
  return Object.keys(byAsesor)
    .map((nombre) => {
      const d = byAsesor[nombre];
      const prom = Math.round((d.sum / d.count) * 10) / 10;
      const clasificacion =
        prom < 70 ? '🔴 CRITICO' : prom < 90 ? '🟡 NO CRITICO' : '🟢 SOBRESALIENTE';
      const alerta =
        d.fallos === 0
          ? '✅ SIN FALLOS CRITICOS'
          : d.fallos <= 1
            ? '⚠️ ALERTA'
            : '🚨 CRITICO FRECUENTE';
      return {
        asesor: nombre,
        monitoreos: d.count,
        promedio: prom,
        clasificacion,
        fallosCriticos: d.fallos,
        alerta,
      };
    })
    .sort((a, b) => a.asesor.localeCompare(b.asesor));
}

// ── KPIs agregados de una campana/mes ─────────────────────
// Portado de renderCalKpis() / renderCalReportes() (parte agregada).
function resumenCampana(monitoreos) {
  const total = monitoreos.length;
  const promedio = total
    ? Math.round((monitoreos.reduce((a, m) => a + m.puntaje, 0) / total) * 10) / 10
    : 0;
  return {
    total,
    promedio,
    criticosAbsolutos: monitoreos.filter((m) => (m.fallos || 0) >= 2).length,
    sobresaliente: monitoreos.filter((m) => m.puntaje >= 90).length,
    noCritico: monitoreos.filter((m) => m.puntaje >= 70 && m.puntaje < 90).length,
    critico: monitoreos.filter((m) => m.puntaje < 70).length,
  };
}

function monthKey(dateStr) {
  if (!dateStr) return null;
  return String(dateStr).slice(0, 7); // YYYY-MM
}

// ── Nivel de servicio (feedback de Edwin, punto 3.2) ────────
// Formula acordada con el usuario: % de llamadas contestadas en <=20 segundos
// sobre el total de llamadas del mes/campana. Umbral de cumplimiento: 80%.
const NIVEL_SERVICIO_UMBRAL = 80;

function nivelServicioPct(contestadas20s, llamadasTotales) {
  const totales = Number(llamadasTotales) || 0;
  if (totales <= 0) return null;
  return Math.round(((Number(contestadas20s) || 0) / totales) * 1000) / 10;
}

function nivelServicioCumple(pct) {
  if (pct === null || pct === undefined) return null;
  return pct >= NIVEL_SERVICIO_UMBRAL;
}

module.exports = {
  computeScore,
  cronogramaDerived,
  withDerived,
  metaForLiderInMonth,
  lideresCumplimiento,
  resumenPorAsesor,
  resumenCampana,
  monthKey,
  NIVEL_SERVICIO_UMBRAL,
  nivelServicioPct,
  nivelServicioCumple,
};
