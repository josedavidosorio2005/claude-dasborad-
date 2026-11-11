// fase274-calidad-como-html.test.js — Fase 274 (pedido de Edwin, 06/11):
// "Resultado de los monitoreos" (Calidad de Mobilize, Aurora y HLM) como la
// vista "Resultados del equipo" del HTML de Edwin (Calidad InConexion.html).
//
// La REFERENCIA de abajo es la logica del HTML transcrita (no se copia el HTML
// al repo): klass (l. 764), calc modelo 'weighted' (l. 737-750), fallosOf
// (l. 753), renderRes (l. 983-1023), drawPie (l. 1048), renderResAs
// (l. 1080-1090), renderDetMes (l. 1052-1060), keyName/normName (l. 768, 1209).
// Se compara contra public/js/calidad-equipo-logic.js con monitoreos
// sinteticos (asesores inventados, varias semillas) y contra la nota que
// calcula el servidor (computeScore, motor standard).
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const fs = require('fs');

const CE = require(path.join(__dirname, '..', '..', 'public', 'js', 'calidad-equipo-logic.js'));
const { computeScore } = require(path.join(__dirname, '..', 'calidad-logic.js'));

// ── Referencia: el HTML de Edwin, transcrito ───────────────────────────
const REF = (() => {
  const klass = (n) => { if (n == null) return ['na', 'Incompleto']; if (n < 70) return ['bad', 'Crítico']; if (n < 90) return ['warn', 'No crítico']; return ['ok', 'Sobresaliente']; };
  const pct = (n) => (n == null ? '—' : (Math.round(n * 10) / 10).toString().replace('.', ',') + '%');
  const normName = (s) => String(s || '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase().replace(/(^|\s)(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
  const keyName = (s) => normName(s).toLowerCase();
  // PL.model === 'weighted'
  function deduction(it, v) { if (v == null || v === '') return null; return v === 'NO' ? (it.tipo === 'C' ? 20 : it.w) : 0; }
  function calc(ITEMS, items) {
    items = items || {};
    const missing = ITEMS.filter((i) => !items[i.k]);
    const failedCrit = ITEMS.filter((i) => i.tipo === 'C' && items[i.k] === 'NO');
    let total = 0;
    ITEMS.forEach((i) => { const d = deduction(i, items[i.k]); if (d) total += d; });
    return { nota: missing.length ? null : Math.max(0, Math.min(100, 100 - total)), fallos: failedCrit.length };
  }
  function renderRes(rows, ITEMS, mesSet, asesSet) {
    const fallosOf = (r) => ITEMS.filter((i) => i.tipo === 'C' && r.items?.[i.k] === 'NO').length;
    const inMes = (r) => mesSet.has((r.fecha || '').slice(0, 7));
    const inAses = (r) => !asesSet.size || asesSet.has(r.asesor);
    const rs = rows.filter((r) => r.nota != null && inMes(r) && inAses(r));
    const by = {};
    rs.forEach((r) => { const k = r.asesor.toLowerCase(); (by[k] = by[k] || { name: r.asesor, n: [] }).n.push(r.nota); });
    const fb = {}; rs.forEach((r) => { const k = r.asesor.toLowerCase(); fb[k] = (fb[k] || 0) + fallosOf(r); });
    const ag = Object.entries(by).map(([key, a]) => ({ name: a.name, cnt: a.n.length, avg: a.n.reduce((s, x) => s + x, 0) / a.n.length, zero: a.n.filter((x) => x === 0).length, fallos: fb[key] || 0 })).sort((a, b) => b.avg - a.avg);
    const avg = rs.length ? rs.reduce((s, r) => s + r.nota, 0) / rs.length : null;
    const kpis = { total: rs.length, promedio: pct(avg), color: avg == null ? 'muted' : klass(avg)[0], critico: rs.filter((r) => fallosOf(r) > 0).length, asesores: ag.length };
    const tabla = ag.map((a, i) => [i + 1, a.name, a.cnt, pct(a.avg), klass(a.avg)[1], a.fallos]);
    const fails = ITEMS.map((it) => ({ it, c: rs.filter((r) => r.items?.[it.k] === 'NO').length })).sort((a, b) => b.c - a.c);
    const bars = rs.length ? fails.map((f) => [f.it.n, f.it.name + (f.it.tipo === 'C' ? ' ⚠' : ''), f.c, pct(f.c / rs.length * 100)]) : [];
    const agN = [...ag].sort((a, b) => a.name.localeCompare(b.name));
    const linea = agN.map((a) => [a.name, pct(a.avg), a.cnt]);
    const byMes = {}; rs.forEach((r) => { const m = r.fecha.slice(0, 7); (byMes[m] = byMes[m] || []).push(r.nota); });
    const ms = Object.keys(byMes).sort();
    const porMes = ms.map((m) => [m, pct(byMes[m].reduce((x, y) => x + y, 0) / byMes[m].length), byMes[m].length]);
    const tot = rs.length;
    const torta = [['ok', 'Sobresaliente', '90–100%'], ['warn', 'No crítico', '70–89%'], ['bad', 'Crítico', '0–69%']].map(([k, l, r]) => ({ k, l, r, n: rs.filter((x) => klass(x.nota)[0] === k).length }))
      .map((c) => [c.k, c.l, c.r, c.n, tot ? pct(c.n / tot * 100) : null]);
    return { kpis, tabla, bars, linea, porMes, torta };
  }
  function renderResAs(rows, ITEMS, raMes, q0) {
    const fallosOf = (r) => ITEMS.filter((i) => i.tipo === 'C' && r.items?.[i.k] === 'NO').length;
    const q = keyName(q0);
    const by = {};
    rows.filter((r) => r.nota != null && (raMes === 'all' || (r.fecha || '').slice(0, 7) === raMes)).forEach((r) => { const k = keyName(r.asesor); (by[k] = by[k] || { name: r.asesor, n: [], f: 0 }).n.push(r.nota); by[k].f += fallosOf(r); });
    const ag = Object.values(by).filter((a) => !q || keyName(a.name).includes(q)).sort((a, b) => a.name.localeCompare(b.name));
    return ag.map((a, i) => { const avg = a.n.reduce((x, y) => x + y, 0) / a.n.length; const al = a.f === 0 ? ['ok', '✅ Sin fallos críticos'] : a.f === 1 ? ['warn', '⚠ Alerta'] : ['bad', '🚨 Crítico frecuente']; return [i + 1, a.name, a.n.length, pct(avg), klass(avg)[1], al[1], a.f]; });
  }
  function renderDetMes(rows, dmMes, q0) {
    const q = keyName(q0);
    const list = rows.filter((r) => (dmMes === 'all' || (r.fecha || '').slice(0, 7) === dmMes) && (!q || keyName(r.asesor).includes(q)))
      .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '') || (b.creado || 0) - (a.creado || 0));
    const done = list.filter((r) => r.nota != null); const avg = done.length ? done.reduce((s, r) => s + r.nota, 0) / done.length : null;
    return { ids: list.map((r) => r.id), kpis: [list.length, pct(avg), avg == null ? '—' : klass(avg)[1], list.length - done.length] };
  }
  return { calc, renderRes, renderResAs, renderDetMes };
})();

// ── Datos sinteticos ───────────────────────────────────────────────────
function rnd(seed) { let s = seed; return (n) => { s = (s * 16807) % 2147483647; return s % n; }; }
// Plantilla tipo Mobilize (14 items, 5 criticos, pesos que suman 100), en las
// dos formas: SINCO (n, label, weight, critico) y HTML (k, n, name, tipo, w).
const PESOS = [5, 10, 10, 5, 5, 10, 5, 10, 5, 5, 10, 5, 5, 10];
const CRIT = [2, 3, 6, 8, 11];
const SINCO_ITEMS = PESOS.map((w, i) => ({ n: i + 1, label: 'Ítem ' + (i + 1), weight: w, critico: CRIT.includes(i + 1) }));
const HTML_ITEMS = SINCO_ITEMS.map((it) => ({ k: 'i' + it.n, n: it.n, name: it.label, tipo: it.critico ? 'C' : 'NC', w: it.weight }));
const PLANTILLA = { id: 1, motor: 'standard', items: SINCO_ITEMS };
const ASESORES = ['Ana Pérez', 'ana pérez', 'Bruno Díaz', 'Carla_Ruiz', 'Carla Ruiz', 'Diego Mora', 'Elena Gil', 'Fabio León'];
const MESES = ['2026-08', '2026-09', '2026-10', '2026-11'];

function generar(seed, n) {
  const r = rnd(seed);
  const sinco = [], html = [];
  for (let id = 1; id <= n; id++) {
    const mes = MESES[r(MESES.length)];
    const fecha = mes + '-' + String(1 + r(28)).padStart(2, '0');
    const asesor = ASESORES[r(ASESORES.length)];
    const incompleto = r(12) === 0;
    const answers = {};
    if (!incompleto) SINCO_ITEMS.forEach((it) => { const x = r(20); answers[it.n] = x < 3 ? 'NO' : x < 5 ? 'N/A' : 'SI'; });
    const sc = computeScore(SINCO_ITEMS, answers, 'standard');
    sinco.push({ id, fecha, asesor, answers, puntaje: sc.puntaje, fallos: sc.fallos });
    const items = {}; HTML_ITEMS.forEach((it) => { if (answers[it.n]) items[it.k] = answers[it.n]; });
    html.push({ id, fecha, asesor, items, nota: REF.calc(HTML_ITEMS, items).nota, creado: id });
  }
  return { sinco, html };
}

// ── Lo que muestra SINCO, en la misma forma que la referencia ──────────
function vistaSinco(sinco, meses, asesores) {
  const v = CE.ceResultado(sinco, { meses, asesores, plantilla: PLANTILLA });
  return {
    kpis: { total: v.kpis.total, promedio: CE.cePct(v.kpis.promedio), color: v.kpis.promedio == null ? 'muted' : v.kpis.clase.k, critico: v.kpis.critico, asesores: v.kpis.asesores },
    tabla: v.porAsesor.map((a, i) => [i + 1, a.name, a.cnt, CE.cePct(a.avg), a.clase.t, a.final]),
    bars: v.total ? v.items.map((x) => [x.it.n, x.it.label + (x.it.critico ? ' ⚠' : ''), x.c, CE.cePct(x.pct)]) : [],
    linea: v.lineaAsesor.map((a) => [a.name, CE.cePct(a.avg), a.cnt]),
    porMes: v.porMes.map((x) => [x.mes, CE.cePct(x.avg), x.monitoreos]),
    torta: v.torta.map((c) => [c.k, c.t, c.rango, c.n, v.total ? CE.cePct(c.pct) : null]),
  };
}

test('la nota de cada monitoreo (servidor, motor standard) es la del HTML (modelo weighted)', () => {
  for (const seed of [7, 11, 2026]) {
    const { sinco, html } = generar(seed, 300);
    sinco.forEach((m, i) => assert.equal(m.puntaje, html[i].nota, `semilla ${seed}, monitoreo ${m.id}`));
  }
});

const CASOS = [
  { nombre: 'un mes, todos los asesores', meses: ['2026-10'], asesores: null, ref: [] },
  { nombre: 'dos meses', meses: ['2026-09', '2026-10'], asesores: null, ref: [] },
  { nombre: 'todos los meses', meses: MESES, asesores: null, ref: [] },
  { nombre: 'un asesor', meses: MESES, asesores: ['Bruno Díaz'], ref: ['Bruno Díaz'] },
  { nombre: 'dos asesores (mayusculas distintas)', meses: ['2026-08', '2026-11'], asesores: ['Ana Pérez', 'ana pérez'], ref: ['Ana Pérez', 'ana pérez'] },
  { nombre: 'ningun asesor', meses: MESES, asesores: [], ref: ['\u0000'] },
  { nombre: 'mes sin monitoreos', meses: ['2026-01'], asesores: null, ref: [] },
];

for (const seed of [7, 11, 2026]) {
  for (const c of CASOS) {
    test(`Resultados del equipo = HTML · semilla ${seed} · ${c.nombre}`, () => {
      const { sinco, html } = generar(seed, 300);
      const ref = REF.renderRes(html, HTML_ITEMS, new Set(c.meses), new Set(c.ref));
      const sc = vistaSinco(sinco, c.meses, c.asesores);
      assert.deepEqual(sc.kpis, ref.kpis, 'tarjetas');
      assert.deepEqual(sc.tabla, ref.tabla, 'Resultado por asesor');
      assert.deepEqual(sc.bars, ref.bars, 'Ítems más afectados (todos los ítems)');
      assert.deepEqual(sc.linea, ref.linea, 'Calificación definitiva por asesor');
      assert.deepEqual(sc.porMes, ref.porMes, 'Calificación definitiva por mes');
      assert.deepEqual(sc.torta, ref.torta, 'Monitoreos por clasificación');
    });
  }
}

test('Resumen por asesor y Detalle por mes = HTML (mes, todos los meses y busqueda)', () => {
  for (const seed of [7, 11, 2026]) {
    const { sinco, html } = generar(seed, 300);
    for (const mes of ['2026-10', 'all']) {
      for (const q of ['', 'carla', 'ANA', 'zzz']) {
        const ra = CE.ceResumenAsesores(sinco, mes, q, SINCO_ITEMS).map((a, i) => [i + 1, a.name, a.cnt, CE.cePct(a.avg), a.clase.t, a.alerta.t, a.fallos]);
        assert.deepEqual(ra, REF.renderResAs(html, HTML_ITEMS, mes, q), `resumen ${seed} ${mes} "${q}"`);
        const d = CE.ceDetalleMes(sinco, mes, q);
        const r = REF.renderDetMes(html, mes, q);
        assert.deepEqual(d.lista.map((m) => m.id), r.ids, `detalle ${seed} ${mes} "${q}"`);
        assert.deepEqual([d.total, CE.cePct(d.promedio), d.promedio == null ? '—' : d.clase.t, d.incompletos], r.kpis);
      }
    }
  }
});

test('mes por defecto como el HTML: el actual si tiene datos; si no, el ultimo con datos', () => {
  const { sinco } = generar(7, 300);
  assert.equal(CE.ceMesPorDefecto(sinco, '2026-11'), '2026-11');
  assert.equal(CE.ceMesPorDefecto(sinco.filter((m) => !m.fecha.startsWith('2026-11')), '2026-11'), '2026-10');
  assert.equal(CE.ceMesPorDefecto([], '2026-11'), '2026-11');
});

test('modelo de descuento (como SURA en el HTML): «Notas en 0%» y «En 0%»', () => {
  const v = CE.ceResultado([{ fecha: '2026-10-01', asesor: 'A', puntaje: 0, answers: {} }, { fecha: '2026-10-02', asesor: 'A', puntaje: 80, answers: {} }],
    { meses: ['2026-10'], asesores: null, plantilla: { motor: 'sura', items: [] } });
  assert.equal(v.kpis.criticoLabel, 'Notas en 0% (crítico)');
  assert.equal(v.kpis.critico, 1);
  assert.equal(v.columnaFinal, 'En 0%');
  assert.equal(v.porAsesor[0].final, 1);
  const w = CE.ceResultado([], { meses: ['2026-10'], plantilla: PLANTILLA });
  assert.equal(w.kpis.criticoLabel, 'Con fallos en ítems críticos');
  assert.equal(w.columnaFinal, 'Fallos críticos');
});

test('el panel usa la logica nueva, conserva «Llamadas con fallas», respeta nombres y MESES', () => {
  const pub = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', f), 'utf8');
  const panel = pub('calidad-panel.js');
  for (const t of ['Calificación definitiva por asesor', 'Calificación definitiva por mes', 'Monitoreos por clasificación', 'Resultado por asesor', 'Ítems más afectados', 'Llamadas con fallas', 'Detalle por mes', 'Resumen por asesor', 'Diccionario']) {
    assert.ok(panel.includes(t), t);
  }
  assert.match(panel, /ceResultado\(/);
  assert.match(panel, /Escala: 0–69% Crítico · 70–89% No crítico · 90–100% Sobresaliente/);
  // Fase 335: salvo con mesesPropios (Televentas SURA), donde usa solo su filtro Mes.
  assert.ok(panel.includes("var marcados = (!p.mesesPropios && typeof _gdMeses === 'function') ? _gdMeses().slice().sort() : [];"), 'sigue a los meses marcados en MESES (no a todos con "Todos")');
  assert.match(panel, /asesorVisibleCliente/, 'respeta la regla de nombres para el cliente');
  const html = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'index.html'), 'utf8');
  assert.ok(html.indexOf('js/calidad-equipo-logic.js') !== -1 && html.indexOf('js/calidad-equipo-logic.js') < html.indexOf('js/calidad-panel.js'));
});
