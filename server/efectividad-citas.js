// efectividad-citas.js — Efectividad de Citas Atendidas de ORLANT (Fase
// 111, pedido textual de InCo): reemplaza lo que antes leia de
// citas_para_mes/citas_atendidas de la hoja "resumen" (nunca tuvo datos
// reales) por un total real del mes (CITAS_ATENDIDAS.xlsx). Escritura
// (reemplazo por MES) y lectura. Mismo patron que
// efectividad-agendamiento.js/inasistencia.js.
'use strict';

function nowStr() {
  const d = new Date();
  const pad = (n) => (n < 10 ? '0' + n : '' + n);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// Orden FIJO del payload compacto (arrays) -- debe coincidir EXACTO con
// CITAS_ATENDIDAS_ORDEN_ARRAY (public/js/citas-atendidas-logic.js) y con
// efectividadCitasFilaArraySchema (validation.js).
const CAMPOS_FILA = ['mes', 'agendas', 'atendidas'];

function filaArrayAObjeto(arr) {
  const obj = {};
  CAMPOS_FILA.forEach((k, i) => { obj[k] = arr[i]; });
  return obj;
}

function mesesDelArchivo(filasObj) {
  const set = new Set(filasObj.map((f) => f.mes));
  return Array.from(set).sort();
}

function impactoEfectividadCitas(db, { campana, filas }) {
  const filasObj = filas.map(filaArrayAObjeto);
  const meses = mesesDelArchivo(filasObj);
  if (!meses.length) return { meses: [], filasExistentes: 0, filasNuevas: 0 };
  const placeholders = meses.map(() => '?').join(',');
  const existentes = db
    .prepare(`SELECT COUNT(*) AS n FROM efectividad_citas WHERE campana = ? AND mes IN (${placeholders})`)
    .get(campana, ...meses).n;
  return { meses, filasExistentes: existentes, filasNuevas: filasObj.length };
}

function cargarEfectividadCitas(db, { campana, archivoNombre, cargadoPorNombre, filas }) {
  const ts = nowStr();
  const filasObj = filas.map(filaArrayAObjeto);
  const meses = mesesDelArchivo(filasObj);

  const insert = db.prepare(
    `INSERT INTO efectividad_citas
       (campana, mes, agendas, atendidas, archivoNombre, cargadoPorNombre, createdAt)
     VALUES (@campana,@mes,@agendas,@atendidas,@archivoNombre,@cargadoPorNombre,@createdAt)`
  );

  let borradas = 0;
  const tx = db.transaction(() => {
    if (meses.length) {
      const placeholders = meses.map(() => '?').join(',');
      borradas = db.prepare(`DELETE FROM efectividad_citas WHERE campana = ? AND mes IN (${placeholders})`).run(campana, ...meses).changes;
    }
    for (const f of filasObj) {
      insert.run({
        campana,
        mes: f.mes, agendas: f.agendas, atendidas: f.atendidas,
        archivoNombre: archivoNombre || '', cargadoPorNombre: cargadoPorNombre || '-', createdAt: ts,
      });
    }
  });
  tx();

  return { insertadas: filasObj.length, borradas, meses };
}

// Valores distintos de Mes + si hay datos -- tambien lo usa el dashboard
// para decidir si "Efectividad de Citas" tiene algo que mostrar.
function efectividadCitasOpciones(db, campana) {
  return {
    meses: db.prepare('SELECT DISTINCT mes AS v FROM efectividad_citas WHERE campana = ? ORDER BY v').all(campana).map((r) => r.v),
  };
}

// Todos los meses con datos, ordenados -- sin filtros (no hay sede/
// especialidad en esta base, un total por mes).
function efectividadCitasPorMes(db, campana) {
  return db
    .prepare('SELECT mes, agendas, atendidas FROM efectividad_citas WHERE campana = ? ORDER BY mes ASC')
    .all(campana);
}

module.exports = {
  CAMPOS_FILA,
  filaArrayAObjeto,
  mesesDelArchivo,
  impactoEfectividadCitas,
  cargarEfectividadCitas,
  efectividadCitasOpciones,
  efectividadCitasPorMes,
};
