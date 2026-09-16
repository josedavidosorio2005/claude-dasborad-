#!/usr/bin/env node
// scripts/verificar-consistencia-dashboards.js — Red de seguridad de solo
// lectura para el gotcha documentado en docs/ARQUITECTURA.md §3:
// `dashboards_config` es un snapshot que se siembra "solo si el cliente no
// existe todavia", asi que si el codigo fuente agrega/renombra un campo de
// KPI (`layout.kpis[].fuente.campo`, etc.) o una columna de seccion
// (`secciones[s].columnas[].key`), las filas ya sembradas en una base que
// lleva tiempo corriendo (incluida produccion) NO se actualizan solas.
//
// Decision de diseno (2026-09-16, ver docs/ARQUITECTURA.md §3): este script
// NO escribe nada ni "arregla" nada automaticamente. Un backfill automatico
// que reescriba `dashboards_config` en silencio es riesgoso porque esa misma
// tabla tambien guarda ediciones manuales de un administrador hechas desde
// el constructor visual (el bug real de 2026-09-16 fue justamente un admin
// editando esa configuracion) -- un script que "corrige" el JSON por su
// cuenta podria pisar una personalizacion intencional. Por eso el backfill
// sigue siendo manual y explicito via `runOnceMigration` en server/db.js
// (ver plantilla en ese archivo), y este script es solo el detector: se
// corre a mano o via el workflow "Diagnostico - datos subidos no se ven en
// el dashboard (produccion)" cada vez que se agregue/renombre un campo de
// KPI o columna, y despues de cualquier incidente similar.
//
// Uso:
//   node scripts/verificar-consistencia-dashboards.js
//   (exit code 1 si encuentra algun problema, 0 si todo esta consistente)
const db = require('../db');

function chequearFuente(f, columnasPorSeccion, dondeEtiqueta, problemas) {
  if (!f || typeof f !== 'object') return;
  if (!f.s) return;
  const cols = columnasPorSeccion[f.s];
  if (cols === undefined) {
    problemas.push(dondeEtiqueta + ': referencia la seccion "' + f.s + '" que NO existe en secciones');
    return;
  }
  const camposUsados = [];
  if (f.campo) camposUsados.push(f.campo);
  if (f.formula) {
    if (f.a) camposUsados.push(f.a);
    if (f.b) camposUsados.push(f.b);
  }
  if (f.campos) camposUsados.push(...f.campos);
  camposUsados.forEach((campo) => {
    if (cols.indexOf(campo) === -1) {
      problemas.push(
        dondeEtiqueta + ': usa el campo "' + campo + '" de la seccion "' + f.s + '", pero esa seccion solo tiene columnas [' + cols.join(', ') + ']'
      );
    }
  });
}

function verificarDashboardsConfig() {
  const rows = db.prepare('SELECT cliente, secciones, layout, updatedAt FROM dashboards_config WHERE activo = 1 ORDER BY cliente').all();
  return rows.map((row) => {
    let secciones = {};
    let layout = {};
    try { secciones = JSON.parse(row.secciones || '{}'); } catch (e) {}
    try { layout = JSON.parse(row.layout || '{}'); } catch (e) {}

    const columnasPorSeccion = {};
    Object.keys(secciones).forEach((s) => {
      columnasPorSeccion[s] = (secciones[s].columnas || []).map((c) => c.key);
    });

    const problemas = [];
    (layout.kpis || []).forEach((k, i) => {
      chequearFuente(k.fuente, columnasPorSeccion, `kpi[${i}] "${k.titulo}".fuente`, problemas);
      if (k.meta && typeof k.meta === 'object') chequearFuente(k.meta, columnasPorSeccion, `kpi[${i}] "${k.titulo}".meta`, problemas);
    });
    (layout.tabs || []).forEach((tab, ti) => {
      (tab.panels || []).forEach((p, pi) => {
        const etiqueta = `tab[${ti}:${tab.key}].panel[${pi}:${p.titulo || p.tipo}]`;
        chequearFuente(p.fuente, columnasPorSeccion, etiqueta + '.fuente', problemas);
        (p.series || []).forEach((s, si) => chequearFuente(s.fuente, columnasPorSeccion, `${etiqueta}.series[${si}]`, problemas));
        (p.barras || []).forEach((b, bi) => chequearFuente(b.fuente, columnasPorSeccion, `${etiqueta}.barras[${bi}]`, problemas));
        if (p.linea) chequearFuente(p.linea.fuente, columnasPorSeccion, etiqueta + '.linea', problemas);
      });
    });

    return { cliente: row.cliente, updatedAt: row.updatedAt, problemas };
  });
}

if (require.main === module) {
  const reporte = verificarDashboardsConfig();
  const conProblemas = reporte.filter((r) => r.problemas.length > 0);
  if (conProblemas.length === 0) {
    console.log(`OK: ${reporte.length} dashboards activos, sin inconsistencias entre KPIs/paneles y las columnas de sus secciones.`);
    process.exit(0);
  }
  console.log(`ENCONTRADAS INCONSISTENCIAS en ${conProblemas.length} de ${reporte.length} dashboards (revisar si necesitan un backfill manual, ver docs/ARQUITECTURA.md §3):\n`);
  conProblemas.forEach((r) => {
    console.log(`--- ${r.cliente} (updatedAt: ${r.updatedAt}) ---`);
    r.problemas.forEach((p) => console.log('  - ' + p));
  });
  process.exit(1);
}

module.exports = { verificarDashboardsConfig };
