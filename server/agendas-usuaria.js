// agendas-usuaria.js — Fase 259 (pedido de Edwin, reunion 05/11, Clinica
// Aurora): "Agendas por usuaria". Guarda SOLO conteos agregados que arma el
// navegador desde el reporte de citas de la clinica (ningun dato de
// paciente llega al servidor): una fila por (mes de la cita, dia de
// confirmacion, sede, usuario, canal, tipo de cita, tipo de paciente, rol)
// con su cantidad. La carga reemplaza los meses que trae (con respaldo para
// Deshacer). El nombre real de la asesora NO se guarda: se resuelve al leer
// con alias_asesores de la campaña (si se corrige un alias, cambian tambien
// los meses ya cargados).
'use strict';
const { respaldarAntesDeCambiar } = require('./cargas-versiones');
const { cargarAliasMapa, resolverAlias } = require('./alias-asesores');

const TABLA = 'agendas_usuaria';

function nowStr() {
  const d = new Date();
  const pad = (n) => (n < 10 ? '0' + n : '' + n);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function mesesDe(filas) { return [...new Set(filas.map((f) => f.mes))].sort(); }

// Fase 301: que reemplaza una carga en UN mes. Si todas sus filas de ese mes
// traen `base`: solo esas bases (y lo cargado antes sin base, que ya queda
// cubierto por las bases nuevas); las otras bases del mes se quedan. Si alguna
// fila viene sin base (la carga de siempre, un solo archivo): el mes entero.
function alcanceDelMes(filas, mes) {
  const delMes = filas.filter((f) => f.mes === mes);
  const bases = [...new Set(delMes.map((f) => f.base || ''))];
  if (bases.includes('')) return { completo: true, bases: [] };
  return { completo: false, bases: bases.sort() };
}
function whereAlcance(alcance) {
  if (alcance.completo) return { sql: '', params: [] };
  return { sql: ` AND (base = '' OR base IN (${alcance.bases.map(() => '?').join(', ')}))`, params: alcance.bases };
}

function impactoAgendasUsuaria(db, { campana, filas }) {
  const meses = mesesDe(filas);
  return {
    meses: meses.map((mes) => {
      const delMes = filas.filter((f) => f.mes === mes);
      const alcance = alcanceDelMes(filas, mes);
      const w = whereAlcance(alcance);
      const r = {
        mes,
        citasExistentes: db.prepare(`SELECT COALESCE(SUM(n), 0) AS n FROM ${TABLA} WHERE campana = ? AND mes = ? AND rol = 'confirma'${w.sql}`).get(campana, mes, ...w.params).n,
        citasNuevas: delMes.reduce((s, f) => s + f.n, 0),
      };
      if (!alcance.completo) r.bases = alcance.bases; // Fase 301: solo esas bases (sin el campo = el mes entero, como siempre)
      return r;
    }),
  };
}

// Reemplaza cada mes que trae la carga, en una transaccion, con respaldo
// de 30 dias para Deshacer (mismo criterio que las demas cargas mensuales).
function cargarAgendasUsuaria(db, { campana, archivoNombre, cargadoPorNombre, filas }) {
  const ts = nowStr();
  const meses = mesesDe(filas);
  // Fase 265: columnas nuevas (fechaCita, fechaSolicitud, especialidad); las de
  // la Fase 259 (dia/canal/tipoCita/tipoPaciente) quedan vacias en las filas nuevas.
  // Fase 301: `base` ('' en la carga de siempre).
  const ins = db.prepare(`INSERT INTO ${TABLA} (campana, mes, dia, sede, usuario, canal, tipoCita, tipoPaciente, rol, n, fechaCita, fechaSolicitud, especialidad, base, archivoNombre, cargadoPorNombre, createdAt)
    VALUES (@campana, @mes, '', @sede, @usuario, '', '', '', 'confirma', @n, @fechaCita, @fechaSolicitud, @especialidad, @base, @archivoNombre, @cargadoPorNombre, @createdAt)`);
  let borradas = 0;
  const porBase = {};
  db.transaction(() => {
    // Respaldo del mes COMPLETO (Deshacer devuelve el mes como estaba).
    respaldarAntesDeCambiar(db, TABLA, { campana, meses, guardadoPorNombre: cargadoPorNombre });
    for (const mes of meses) {
      const w = whereAlcance(alcanceDelMes(filas, mes));
      borradas += db.prepare(`DELETE FROM ${TABLA} WHERE campana = ? AND mes = ?${w.sql}`).run(campana, mes, ...w.params).changes;
    }
    for (const f of filas) {
      const base = f.base || '';
      porBase[base] = (porBase[base] || 0) + f.n;
      ins.run(Object.assign({}, f, { base, campana, archivoNombre: archivoNombre || '', cargadoPorNombre: cargadoPorNombre || '-', createdAt: ts }));
    }
  })();
  const r = { meses, insertadas: filas.length, borradas, citas: filas.reduce((s, f) => s + f.n, 0) };
  if (Object.keys(porBase).some((b) => b !== '')) r.porBase = porBase; // Fase 301
  return r;
}

function agendasUsuariaOpciones(db, campana) {
  return { meses: db.prepare(`SELECT DISTINCT mes AS v FROM ${TABLA} WHERE campana = ? ORDER BY v`).all(campana).map((r) => r.v) };
}

// Todas las filas de la campaña con `asesora` = nombre real (alias de la
// campaña) o el codigo tal cual si no tiene alias.
function agendasUsuariaDatos(db, campana) {
  const mapa = cargarAliasMapa(db, campana);
  // Fase 265: solo las confirmaciones (las filas "crea" de la Fase 259 ya no se muestran).
  const filas = db.prepare(`SELECT mes, fechaCita, fechaSolicitud, sede, usuario, especialidad, n FROM ${TABLA} WHERE campana = ? AND rol = 'confirma' ORDER BY mes, fechaCita`).all(campana);
  return { filas: filas.map((f) => Object.assign(f, { asesora: resolverAlias(mapa, f.usuario) })) };
}

module.exports = { TABLA, alcanceDelMes, impactoAgendasUsuaria, cargarAgendasUsuaria, agendasUsuariaOpciones, agendasUsuariaDatos };
