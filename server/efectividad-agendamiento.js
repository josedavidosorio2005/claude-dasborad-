// efectividad-agendamiento.js — Efectividad de Agendamiento de ORLANT
// (Fase 111, pedido textual de Edwin: "el ranking va a ser efectividad por
// agendamiento"). Escritura (reemplazo por MES) y ranking -- mismo patron
// que inasistencia.js: el servidor NUNCA descarga filas crudas al
// dashboard, el navegador ya agrego el archivo a (mes, asesor) antes de
// mandar el payload.
'use strict';

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
  return { meses, filasExistentes: existentes, filasNuevas: filasObj.length };
}

// Reemplaza por MES: borra todo lo que haya en los meses del archivo que se
// sube, despues inserta las filas nuevas -- una sola transaccion. Volver a
// subir el MISMO archivo deja el mismo conteo (nunca duplica, gracias
// tambien al UNIQUE(campana,mes,asesor)).
function cargarEfectividadAgendamiento(db, { campana, archivoNombre, cargadoPorNombre, filas }) {
  const ts = nowStr();
  const filasObj = filas.map(filaArrayAObjeto);
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
function efectividadAgendamientoRanking(db, { campana, mes }) {
  const filas = db
    .prepare('SELECT asesor, gestiones, agendas FROM efectividad_agendamiento WHERE campana = ? AND mes = ?')
    .all(campana, mes);

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
