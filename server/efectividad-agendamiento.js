// efectividad-agendamiento.js — Efectividad de Agendamiento de ORLANT
// (Fase 111, pedido textual de Edwin: "el ranking va a ser efectividad por
// agendamiento"). Escritura (reemplazo por MES) y ranking -- mismo patron
// que inasistencia.js: el servidor NUNCA descarga filas crudas al
// dashboard, el navegador ya agrego el archivo a (mes, asesor) antes de
// mandar el payload.
'use strict';

const { aplicarAliasAFilas } = require('./alias-asesores');
const { respaldarAntesDeCambiar } = require('./cargas-versiones');

function nowStr() {
  const d = new Date();
  const pad = (n) => (n < 10 ? '0' + n : '' + n);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// Orden FIJO del payload compacto (arrays) -- debe coincidir EXACTO con
// EFECTIVIDAD_AGENDAMIENTO_ORDEN_ARRAY (public/js/efectividad-agendamiento-logic.js)
// y con efectividadAgendamientoFilaArraySchema (validation.js).
const CAMPOS_FILA = ['mes', 'asesor', 'gestiones', 'agendas'];

function filaArrayAObjeto(arr) {
  const obj = {};
  CAMPOS_FILA.forEach((k, i) => { obj[k] = arr[i]; });
  return obj;
}

// Meses distintos que trae el archivo que se esta subiendo (ordenados) --
// define el conjunto de meses que la carga va a REEMPLAZAR, mismo criterio
// que inasistencia.js.
function mesesDelArchivo(filasObj) {
  const set = new Set(filasObj.map((f) => f.mes));
  return Array.from(set).sort();
}

// Fase 122 (defensa en profundidad): esta tabla tiene UNIQUE(campana, mes,
// asesor) -- si el alias de asesor hiciera que 2 filas del MISMO mes
// terminaran con el MISMO nombre canonico (el archivo real de Edwin nunca
// trae esto hoy: un alias solo reemplaza una variante de escritura, no
// junta 2 asesores ya separados en el mismo archivo), se suman
// gestiones/agendas en vez de dejar que el INSERT choque contra el
// UNIQUE. Sin colision, el comportamiento es identico a simplemente usar
// las filas tal cual.
function fusionarPorMesAsesor(filasObj) {
  const porClave = new Map();
  const orden = [];
  filasObj.forEach((f) => {
    const clave = f.mes + ' ' + f.asesor;
    if (!porClave.has(clave)) {
      porClave.set(clave, Object.assign({}, f));
      orden.push(clave);
    } else {
      const acc = porClave.get(clave);
      acc.gestiones += f.gestiones;
      acc.agendas += f.agendas;
    }
  });
  return orden.map((clave) => porClave.get(clave));
}

// Cuenta cuantas filas YA EXISTEN en los meses que este archivo
// reemplazaria -- no escribe nada (confirmacion antes de guardar).
function impactoEfectividadAgendamiento(db, { campana, filas }) {
  const filasObj = filas.map(filaArrayAObjeto);
  const meses = mesesDelArchivo(filasObj);
  if (!meses.length) return { meses: [], filasExistentes: 0, filasNuevas: 0 };
  const placeholders = meses.map(() => '?').join(',');
  const existentes = db
    .prepare(`SELECT COUNT(*) AS n FROM efectividad_agendamiento WHERE campana = ? AND mes IN (${placeholders})`)
    .get(campana, ...meses).n;
  // Fase 122: transparencia del alias de asesor ANTES de confirmar la carga.
  const alias = aplicarAliasAFilas(db, campana, filasObj, 'asesor');
  const filasFinal = fusionarPorMesAsesor(alias.filas);
  return {
    meses, filasExistentes: existentes, filasNuevas: filasFinal.length,
    filasUnificadasPorAlias: alias.filasUnificadas, asesoresUnificadosPorAlias: alias.asesoresUnificados,
  };
}

// Reemplaza por MES: borra todo lo que haya en los meses del archivo que se
// sube, despues inserta las filas nuevas -- una sola transaccion. Volver a
// subir el MISMO archivo deja el mismo conteo (nunca duplica, gracias
// tambien al UNIQUE(campana,mes,asesor)).
function cargarEfectividadAgendamiento(db, { campana, archivoNombre, cargadoPorNombre, filas }) {
  const ts = nowStr();
  let filasObj = filas.map(filaArrayAObjeto);
  // Fase 122: alias de nombre de asesor ANTES de guardar, fusionando por
  // (mes,asesor) si hiciera falta (ver fusionarPorMesAsesor).
  filasObj = fusionarPorMesAsesor(aplicarAliasAFilas(db, campana, filasObj, 'asesor').filas);
  const meses = mesesDelArchivo(filasObj);

  const insert = db.prepare(
    `INSERT INTO efectividad_agendamiento
       (campana, mes, asesor, gestiones, agendas, archivoNombre, cargadoPorNombre, createdAt)
     VALUES (@campana,@mes,@asesor,@gestiones,@agendas,@archivoNombre,@cargadoPorNombre,@createdAt)`
  );

  let borradas = 0;
  const tx = db.transaction(() => {
    if (meses.length) {
      const placeholders = meses.map(() => '?').join(',');
      // Fase 153 (Centro de cargas, PR 2): guarda el/los mes(es) completo(s) antes de cambiarlos (Deshacer 30 dias).
      respaldarAntesDeCambiar(db, 'efectividad_agendamiento', { campana, meses, guardadoPorNombre: cargadoPorNombre });
      borradas = db.prepare(`DELETE FROM efectividad_agendamiento WHERE campana = ? AND mes IN (${placeholders})`).run(campana, ...meses).changes;
    }
    for (const f of filasObj) {
      insert.run({
        campana,
        mes: f.mes, asesor: f.asesor, gestiones: f.gestiones, agendas: f.agendas,
        archivoNombre: archivoNombre || '', cargadoPorNombre: cargadoPorNombre || '-', createdAt: ts,
      });
    }
  });
  tx();

  return { insertadas: filasObj.length, borradas, meses };
}

// Valores distintos de Mes + si hay datos (meses.length) -- tambien lo usa
// el dashboard para decidir si el ranking tiene algo que mostrar en el mes
// elegido arriba (ver public/js/efectividad-agendamiento.js).
function efectividadAgendamientoOpciones(db, campana) {
  return {
    meses: db.prepare('SELECT DISTINCT mes AS v FROM efectividad_agendamiento WHERE campana = ? ORDER BY v').all(campana).map((r) => r.v),
  };
}

// Ranking de un mes: puesto por EFECTIVIDAD (agendas/gestiones) de mayor a
// menor -- empate = mas gestiones primero (pedido textual de Edwin); el
// SIGUIENTE puesto tras un empate SALTA (competicion, 1,1,3 -- nunca
// 1,1,2), mismo criterio de "puesto" que agendasRankingPuro (Fase 104).
// `equipo` es el agregado del mes completo: totalGestiones, totalAgendas,
// efectividad PONDERADA (Σagendas/Σgestiones, nunca el promedio simple de
// los % de cada asesor -- ver control Sep-26, PROGRESS.md Fase 111).
// Fase 207: con `meses` (lista ya validada) suma gestiones y agendas por
// asesor en esos meses y el puesto sale de los totales sumados.
function efectividadAgendamientoRanking(db, { campana, mes, meses }) {
  const lista = meses ? String(meses).split(',') : [mes];
  const filas = db
    .prepare('SELECT asesor, SUM(gestiones) AS gestiones, SUM(agendas) AS agendas FROM efectividad_agendamiento WHERE campana = ? AND mes IN (' + lista.map(() => '?').join(', ') + ') GROUP BY asesor')
    .all(campana, ...lista);

  const conPct = filas.map((f) => ({
    asesor: f.asesor,
    gestiones: f.gestiones,
    agendas: f.agendas,
    efectividad: f.gestiones > 0 ? f.agendas / f.gestiones : 0,
  }));
  // Orden para asignar puesto: efectividad desc, empate -> gestiones desc,
  // empate total -> alfabetico (determinista, nunca depende del orden de
  // insercion/SQL).
  conPct.sort((a, b) => {
    if (b.efectividad !== a.efectividad) return b.efectividad - a.efectividad;
    if (b.gestiones !== a.gestiones) return b.gestiones - a.gestiones;
    return a.asesor < b.asesor ? -1 : a.asesor > b.asesor ? 1 : 0;
  });
  let puestoActual = 0, vistos = 0;
  let prevEf = null, prevGest = null;
  const conPuesto = conPct.map((f) => {
    vistos++;
    if (prevEf === null || f.efectividad !== prevEf || f.gestiones !== prevGest) {
      puestoActual = vistos;
      prevEf = f.efectividad;
      prevGest = f.gestiones;
    }
    return Object.assign({ puesto: puestoActual }, f);
  });

  const totalGestiones = conPct.reduce((s, f) => s + f.gestiones, 0);
  const totalAgendas = conPct.reduce((s, f) => s + f.agendas, 0);
  const efectividadEquipo = totalGestiones > 0 ? totalAgendas / totalGestiones : 0;

  return {
    filas: conPuesto,
    equipo: { gestiones: totalGestiones, agendas: totalAgendas, efectividad: efectividadEquipo },
  };
}

module.exports = {
  CAMPOS_FILA,
  filaArrayAObjeto,
  mesesDelArchivo,
  impactoEfectividadAgendamiento,
  cargarEfectividadAgendamiento,
  efectividadAgendamientoOpciones,
  efectividadAgendamientoRanking,
};
