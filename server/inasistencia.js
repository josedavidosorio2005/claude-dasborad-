// inasistencia.js — Inasistencia de ORLANT (Fase 98, pedido urgente de
// Edwin; Fase 108, pedido textual de InCo: "la inasistencia va a ser por
// mes, que se pueda filtrar por sede, especialidad, nombre entidad").
//
// Escritura (reemplazo por MES, no por rango de fecha -- el navegador ya
// agrego las ~83.000 filas crudas del archivo real a (mes, sede,
// especialidad, entidad) antes de mandar el payload) y agregacion
// filtrada. Mismo patron que agendas.js/tipificaciones.js: el servidor
// NUNCA descarga filas crudas al dashboard, todo lo que sale de aqui ya
// viene agrupado (ver routes/inasistencia.js).
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
const CAMPOS_FILA = ['mes', 'sede', 'especialidad', 'entidad', 'cancelada', 'inasistencia', 'pendiente', 'atendidas', 'total'];

function filaArrayAObjeto(arr) {
  const obj = {};
  CAMPOS_FILA.forEach((k, i) => { obj[k] = arr[i]; });
  return obj;
}

// Meses distintos que trae el archivo que se esta subiendo (ordenados) --
// define el CONJUNTO de meses que la carga va a REEMPLAZAR (a diferencia de
// Agendas, que reemplaza por RANGO continuo de fecha, aqui el archivo puede
// traer meses no consecutivos) y solo esos se reemplazan, ninguno de los
// que no vienen en el archivo.
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
// filas nuevas -- nunca duplica, gracias tambien al
// UNIQUE(campana,mes,sede,especialidad,entidad)).
function cargarInasistencias(db, { campana, archivoNombre, cargadoPorNombre, filas }) {
  const ts = nowStr();
  const filasObj = filas.map(filaArrayAObjeto);
  const meses = mesesDelArchivo(filasObj);

  const insert = db.prepare(
    `INSERT INTO inasistencias
       (campana, mes, sede, especialidad, entidad, cancelada, inasistencia, pendiente, atendidas, total, archivoNombre, cargadoPorNombre, createdAt)
     VALUES (@campana,@mes,@sede,@especialidad,@entidad,@cancelada,@inasistencia,@pendiente,@atendidas,@total,@archivoNombre,@cargadoPorNombre,@createdAt)`
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
        mes: f.mes, sede: f.sede, especialidad: f.especialidad, entidad: f.entidad,
        cancelada: f.cancelada, inasistencia: f.inasistencia, pendiente: f.pendiente, atendidas: f.atendidas, total: f.total,
        archivoNombre: archivoNombre || '', cargadoPorNombre: cargadoPorNombre || '-', createdAt: ts,
      });
    }
  });
  tx();

  return { insertadas: filasObj.length, borradas, meses };
}

// Construye la clausula WHERE comun a los 4 endpoints de lectura --
// `campana` siempre obligatoria, mes/sede/especialidad/entidad opcionales
// (un filtro vacio/ausente = "Todos", mismo criterio que el resto de la
// plataforma). `desde`/`hasta` acotan el RANGO de mes (inclusive) para las
// vistas de todos los meses.
function _whereFiltros({ campana, mes, sede, especialidad, entidad, desde, hasta }) {
  const clausulas = ['campana = @campana'];
  const params = { campana };
  if (mes) { clausulas.push('mes = @mes'); params.mes = mes; }
  if (sede) { clausulas.push('sede = @sede'); params.sede = sede; }
  if (especialidad) { clausulas.push('especialidad = @especialidad'); params.especialidad = especialidad; }
  if (entidad) { clausulas.push('entidad = @entidad'); params.entidad = entidad; }
  if (desde) { clausulas.push('mes >= @desde'); params.desde = desde; }
  if (hasta) { clausulas.push('mes <= @hasta'); params.hasta = hasta; }
  return { where: clausulas.join(' AND '), params };
}

// Resumen agregado (SUMA de todas las filas que apliquen) de un mes --
// respeta sede/especialidad/entidad si vienen. El % SIEMPRE se calcula
// ponderado sobre la suma (Σ(inasistencia+pendiente)/Σtotal), nunca como
// promedio de porcentajes por fila -- pedido explicito de InCo.
function inasistenciaResumen(db, { campana, mes, sede, especialidad, entidad }) {
  const { where, params } = _whereFiltros({ campana, mes, sede, especialidad, entidad });
  const row = db
    .prepare(
      `SELECT COALESCE(SUM(cancelada),0) AS cancelada, COALESCE(SUM(inasistencia),0) AS inasistencia,
              COALESCE(SUM(pendiente),0) AS pendiente, COALESCE(SUM(atendidas),0) AS atendidas, COALESCE(SUM(total),0) AS total
       FROM inasistencias WHERE ${where}`
    )
    .get(params);
  // 2 decimales (no 1): los numeros de control del pedido (ej. "7,45 %")
  // solo cuadran exacto con 2 decimales.
  const pct = row.total > 0 ? Math.round(((row.inasistencia + row.pendiente) / row.total) * 10000) / 100 : null;
  return { mes, cancelada: row.cancelada, inasistencia: row.inasistencia, pendiente: row.pendiente, atendidas: row.atendidas, total: row.total, pct };
}

// Filas por especialidad de UN mes -- fuente de la vista "Por especialidad"
// (respeta sede/entidad; nunca filtra por especialidad, el punto de esta
// vista es desglosar TODAS).
function inasistenciaPorEspecialidad(db, { campana, mes, sede, entidad }) {
  const { where, params } = _whereFiltros({ campana, mes, sede, entidad });
  return db
    .prepare(
      `SELECT especialidad, SUM(cancelada) AS cancelada, SUM(inasistencia) AS inasistencia,
              SUM(pendiente) AS pendiente, SUM(atendidas) AS atendidas, SUM(total) AS total
       FROM inasistencias WHERE ${where} GROUP BY especialidad ORDER BY especialidad ASC`
    )
    .all(params);
}

// Filas por (mes, especialidad) de TODOS los meses con datos -- ignora el
// filtro de mes a proposito (es una serie de tiempo, tiene que mostrar
// todos los meses), respeta sede/especialidad/entidad y el rango de meses
// (desde/hasta, 'AAAA-MM'). Fuente de la grafica "Resumen por mes"
// (inasistenciaAgregarPorMes, inasistencia-logic.js, agrega esto en el
// navegador sin volver a tocar sede/entidad -- ya vienen filtradas aqui).
function inasistenciaPorMes(db, { campana, sede, especialidad, entidad, desde, hasta }) {
  const { where, params } = _whereFiltros({ campana, sede, especialidad, entidad, desde, hasta });
  return db
    .prepare(
      `SELECT mes, especialidad, SUM(cancelada) AS cancelada, SUM(inasistencia) AS inasistencia,
              SUM(pendiente) AS pendiente, SUM(atendidas) AS atendidas, SUM(total) AS total
       FROM inasistencias WHERE ${where} GROUP BY mes, especialidad ORDER BY mes ASC, especialidad ASC`
    )
    .all(params);
}

// Valores distintos para cada desplegable de filtro (Mes, Sede,
// Especialidad, Entidad) -- tambien decide si la pestana "Inasistencia"
// tiene datos que mostrar (meses.length > 0), ver dashboard-generic.js.
// `entidades` no incluye 'SIN DATO' (las filas historicas migradas de
// antes de la Fase 108, que no tienen sede/entidad real) para no ensuciar
// el buscador con un valor que no es una entidad real.
function inasistenciaOpciones(db, campana) {
  return {
    meses: db.prepare('SELECT DISTINCT mes AS v FROM inasistencias WHERE campana = ? ORDER BY v').all(campana).map((r) => r.v),
    sedes: db.prepare("SELECT DISTINCT sede AS v FROM inasistencias WHERE campana = ? AND sede != 'SIN DATO' ORDER BY v").all(campana).map((r) => r.v),
    especialidades: db.prepare('SELECT DISTINCT especialidad AS v FROM inasistencias WHERE campana = ? ORDER BY v').all(campana).map((r) => r.v),
    entidades: db.prepare("SELECT DISTINCT entidad AS v FROM inasistencias WHERE campana = ? AND entidad != 'SIN DATO' ORDER BY v").all(campana).map((r) => r.v),
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
