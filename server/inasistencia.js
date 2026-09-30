// inasistencia.js — Inasistencia de ORLANT (Fase 98, pedido urgente de
// Edwin): escritura (reemplazo por MES, no por rango de fecha -- el archivo
// real trae un total agregado por mes+especialidad, no una fila por cita)
// y agregacion filtrada. Mismo patron que agendas.js/tipificaciones.js: el
// servidor NUNCA descarga filas crudas al dashboard, todo lo que sale de
// aqui ya viene agrupado (ver routes/inasistencia.js).
'use strict';

function nowStr() {
  const d = new Date();
  const pad = (n) => (n < 10 ? '0' + n : '' + n);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// Orden FIJO del payload compacto (arrays, no objetos) -- debe coincidir
// EXACTO con INASISTENCIA_ORDEN_ARRAY (public/js/inasistencia-logic.js) y
// con inasistenciaFilaArraySchema (validation.js). Los 3 definen el mismo
// contrato; cambiar el orden en uno sin los otros 2 mezclaria columnas en
// silencio.
const CAMPOS_FILA = ['mes', 'especialidad', 'cancelada', 'inasistencia', 'pendiente', 'atendidas', 'total'];

function filaArrayAObjeto(arr) {
  const obj = {};
  CAMPOS_FILA.forEach((k, i) => { obj[k] = arr[i]; });
  return obj;
}

// Meses distintos que trae el archivo que se esta subiendo (ordenados) --
// define el CONJUNTO de meses que la carga va a REEMPLAZAR (a diferencia de
// Agendas, que reemplaza por RANGO continuo de fecha, aqui el archivo puede
// traer meses no consecutivos -- ej. solo Ago-26 y Sep-26 de un semestre --
// y solo esos 2 se reemplazan, ninguno de los que no vienen en el archivo).
function mesesDelArchivo(filasObj) {
  const set = new Set(filasObj.map((f) => f.mes));
  return Array.from(set).sort();
}

// Cuenta cuantas filas YA EXISTEN en los meses que este archivo reemplazaria
// -- no escribe nada. El frontend lo usa para pedir confirmacion explicita
// antes de guardar, mismo patron que impactoAgendas/impactoTipificaciones.
function impactoInasistencias(db, { campana, filas }) {
  const filasObj = filas.map(filaArrayAObjeto);
  const meses = mesesDelArchivo(filasObj);
  if (!meses.length) return { meses: [], filasExistentes: 0, filasNuevas: 0 };
  const placeholders = meses.map(() => '?').join(',');
  const existentes = db
    .prepare(`SELECT COUNT(*) AS n FROM inasistencias WHERE campana = ? AND mes IN (${placeholders})`)
    .get(campana, ...meses).n;
  return { meses, filasExistentes: existentes, filasNuevas: filasObj.length };
}

// Reemplaza por MES: borra todo lo que haya en los meses del archivo que se
// sube, despues inserta las filas nuevas -- una sola transaccion (o las dos
// cosas pasan, o ninguna). Volver a subir el MISMO archivo deja el mismo
// conteo (borra las filas viejas de esos meses exactos, inserta las mismas
// filas nuevas -- nunca duplica, gracias tambien al UNIQUE(campana,mes,especialidad)).
function cargarInasistencias(db, { campana, archivoNombre, cargadoPorNombre, filas }) {
  const ts = nowStr();
  const filasObj = filas.map(filaArrayAObjeto);
  const meses = mesesDelArchivo(filasObj);

  const insert = db.prepare(
    `INSERT INTO inasistencias
       (campana, mes, especialidad, cancelada, inasistencia, pendiente, atendidas, total, archivoNombre, cargadoPorNombre, createdAt)
     VALUES (@campana,@mes,@especialidad,@cancelada,@inasistencia,@pendiente,@atendidas,@total,@archivoNombre,@cargadoPorNombre,@createdAt)`
  );

  let borradas = 0;
  const tx = db.transaction(() => {
    if (meses.length) {
      const placeholders = meses.map(() => '?').join(',');
      borradas = db.prepare(`DELETE FROM inasistencias WHERE campana = ? AND mes IN (${placeholders})`).run(campana, ...meses).changes;
    }
    for (const f of filasObj) {
      insert.run({
        campana,
        mes: f.mes, especialidad: f.especialidad,
        cancelada: f.cancelada, inasistencia: f.inasistencia, pendiente: f.pendiente, atendidas: f.atendidas, total: f.total,
        archivoNombre: archivoNombre || '', cargadoPorNombre: cargadoPorNombre || '-', createdAt: ts,
      });
    }
  });
  tx();

  return { insertadas: filasObj.length, borradas, meses };
}

// Resumen agregado (SUMA de todas las filas que apliquen) de un mes --
// opcionalmente acotado a una especialidad. El % SIEMPRE se calcula
// ponderado sobre la suma (Σ(inasistencia+pendiente)/Σtotal), nunca como
// promedio de porcentajes por fila -- pedido explicito de Edwin.
function inasistenciaResumen(db, { campana, mes, especialidad }) {
  const clausulas = ['campana = @campana', 'mes = @mes'];
  const params = { campana, mes };
  if (especialidad) {
    clausulas.push('especialidad = @especialidad');
    params.especialidad = especialidad;
  }
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(cancelada),0) AS cancelada, COALESCE(SUM(inasistencia),0) AS inasistencia,
              COALESCE(SUM(pendiente),0) AS pendiente, COALESCE(SUM(atendidas),0) AS atendidas, COALESCE(SUM(total),0) AS total
       FROM inasistencias WHERE ${clausulas.join(' AND ')}`
    )
    .get(params);
  // 2 decimales (no 1): los numeros de control del pedido de Edwin (ej.
  // "4,16 %") solo cuadran exacto con 2 decimales -- 1 decimal redondearia
  // 4,1550...% a 4,2%, no a 4,16%.
  const pct = row.total > 0 ? Math.round(((row.inasistencia + row.pendiente) / row.total) * 10000) / 100 : null;
  return { mes, cancelada: row.cancelada, inasistencia: row.inasistencia, pendiente: row.pendiente, atendidas: row.atendidas, total: row.total, pct };
}

// Filas por especialidad de UN mes -- fuente de las tarjetas/graficas de
// "Por especialidad" y de la tabla "Detalle" cuando se filtra a un solo mes.
function inasistenciaPorEspecialidad(db, { campana, mes, especialidad }) {
  const clausulas = ['campana = @campana', 'mes = @mes'];
  const params = { campana, mes };
  if (especialidad) {
    clausulas.push('especialidad = @especialidad');
    params.especialidad = especialidad;
  }
  return db
    .prepare(
      `SELECT especialidad, cancelada, inasistencia, pendiente, atendidas, total
       FROM inasistencias WHERE ${clausulas.join(' AND ')} ORDER BY especialidad ASC`
    )
    .all(params);
}

// Filas por (mes, especialidad) de TODOS los meses con datos -- ignora el
// filtro de mes a proposito (misma logica que agendasPorMes/agendasPorLinea:
// es una serie de tiempo, tiene que mostrar todos los meses), respeta
// especialidad y el rango de meses (desde/hasta, 'AAAA-MM'). Fuente de la
// grafica de linea "Por mes" y de la tabla "Detalle" cuando se filtra a un
// rango de varios meses.
function inasistenciaPorMes(db, { campana, especialidad, desde, hasta }) {
  const clausulas = ['campana = @campana'];
  const params = { campana };
  if (especialidad) {
    clausulas.push('especialidad = @especialidad');
    params.especialidad = especialidad;
  }
  if (desde) {
    clausulas.push('mes >= @desde');
    params.desde = desde;
  }
  if (hasta) {
    clausulas.push('mes <= @hasta');
    params.hasta = hasta;
  }
  return db
    .prepare(
      `SELECT mes, especialidad, cancelada, inasistencia, pendiente, atendidas, total
       FROM inasistencias WHERE ${clausulas.join(' AND ')} ORDER BY mes ASC, especialidad ASC`
    )
    .all(params);
}

// Valores distintos para cada desplegable de filtro (Mes, Especialidad) --
// tambien decide si la pestana "Inasistencia" tiene datos que mostrar
// (meses.length > 0), ver dashboard-generic.js.
function inasistenciaOpciones(db, campana) {
  return {
    meses: db.prepare('SELECT DISTINCT mes AS v FROM inasistencias WHERE campana = ? ORDER BY v').all(campana).map((r) => r.v),
    especialidades: db.prepare('SELECT DISTINCT especialidad AS v FROM inasistencias WHERE campana = ? ORDER BY v').all(campana).map((r) => r.v),
  };
}

module.exports = {
  CAMPOS_FILA,
  filaArrayAObjeto,
  mesesDelArchivo,
  impactoInasistencias,
  cargarInasistencias,
  inasistenciaResumen,
  inasistenciaPorEspecialidad,
  inasistenciaPorMes,
  inasistenciaOpciones,
};
