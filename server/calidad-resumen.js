// calidad-resumen.js — Fase 172 (pedido de Edwin): "Calidad: resumen por
// asesor" de Mobilize. Una fila por asesor y mes (monitoreos, puntaje
// promedio, fallos criticos), cargada desde la plantilla de Edwin. La carga
// reemplaza SOLO el mes elegido. Clasificacion y alerta no se guardan: se
// recalculan con los numeros (mismas reglas que calidad-resumen-logic.js).
'use strict';
const { respaldarAntesDeCambiar } = require('./cargas-versiones');

const CAMPOS_FILA = ['agente', 'monitoreos', 'puntaje', 'fallos'];

function nowStr() {
  const d = new Date();
  const pad = (n) => (n < 10 ? '0' + n : '' + n);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function clasificacion(p) { return p < 70 ? 'Crítico' : p < 90 ? 'No crítico' : 'Sobresaliente'; }
function alerta(f) { return f === 0 ? 'Sin fallos críticos' : f === 1 ? 'Alerta' : 'Crítico frecuente'; }

function filaArrayAObjeto(arr) {
  const o = {};
  CAMPOS_FILA.forEach((k, i) => { o[k] = arr[i]; });
  return o;
}

function impactoCalidadResumen(db, { campana, mes, filas }) {
  const existentes = db.prepare('SELECT COUNT(*) AS n FROM calidad_resumen_asesor WHERE campana = ? AND mes = ?').get(campana, mes).n;
  const objs = filas.map(filaArrayAObjeto);
  return { mes, filasExistentes: existentes, filasNuevas: objs.length, monitoreos: objs.reduce((a, f) => a + f.monitoreos, 0) };
}

// Reemplaza el mes completo de ese cliente en una transaccion (con respaldo
// de 30 dias para Deshacer, Fase 153).
function cargarCalidadResumen(db, { campana, mes, archivoNombre, cargadoPorNombre, filas }) {
  const ts = nowStr();
  const objs = filas.map(filaArrayAObjeto);
  const del = db.prepare('DELETE FROM calidad_resumen_asesor WHERE campana = ? AND mes = ?');
  const ins = db.prepare(`INSERT INTO calidad_resumen_asesor (campana, mes, agente, monitoreos, puntaje, fallos, archivoNombre, cargadoPorNombre, createdAt)
    VALUES (@campana, @mes, @agente, @monitoreos, @puntaje, @fallos, @archivoNombre, @cargadoPorNombre, @createdAt)`);
  let borradas = 0;
  db.transaction(() => {
    respaldarAntesDeCambiar(db, 'calidad_resumen_asesor', { campana, meses: [mes], guardadoPorNombre: cargadoPorNombre });
    borradas = del.run(campana, mes).changes;
    for (const f of objs) {
      ins.run({ campana, mes, agente: f.agente, monitoreos: f.monitoreos, puntaje: f.puntaje, fallos: f.fallos,
        archivoNombre: archivoNombre || '', cargadoPorNombre: cargadoPorNombre || '-', createdAt: ts });
    }
  })();
  return { mes, insertadas: objs.length, borradas };
}

function calidadResumenOpciones(db, campana) {
  return { meses: db.prepare('SELECT DISTINCT mes AS v FROM calidad_resumen_asesor WHERE campana = ? ORDER BY v').all(campana).map((r) => r.v) };
}

// Todo el resumen del cliente, por mes: { meses: [{ mes, monitoreos, promedio, asesores: [...] }] }.
// promedio = ponderado por # de monitoreos.
function calidadResumenPorMes(db, campana) {
  const filas = db.prepare('SELECT mes, agente, monitoreos, puntaje, fallos FROM calidad_resumen_asesor WHERE campana = ? ORDER BY mes, agente').all(campana);
  const porMes = new Map();
  for (const f of filas) {
    if (!porMes.has(f.mes)) porMes.set(f.mes, []);
    porMes.get(f.mes).push({ agente: f.agente, monitoreos: f.monitoreos, puntaje: f.puntaje, fallos: f.fallos,
      clasificacion: clasificacion(f.puntaje), alerta: alerta(f.fallos) });
  }
  return {
    meses: [...porMes.entries()].map(([mes, asesores]) => {
      const total = asesores.reduce((a, x) => a + x.monitoreos, 0);
      const suma = asesores.reduce((a, x) => a + x.monitoreos * x.puntaje, 0);
      return { mes, monitoreos: total, promedio: total ? Math.round((suma / total) * 100) / 100 : null,
        fallos: asesores.reduce((a, x) => a + x.fallos, 0), asesores };
    }),
  };
}

module.exports = { CAMPOS_FILA, clasificacion, alerta, impactoCalidadResumen, cargarCalidadResumen, calidadResumenOpciones, calidadResumenPorMes };
