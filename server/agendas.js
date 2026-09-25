// agendas.js — Agendas de ORLANT (Fase 78, pedido de Jairo/Edwin): escritura
// (reemplazo por periodo) y agregacion filtrada. El servidor NUNCA descarga
// filas crudas al dashboard -- todo lo que sale de aqui hacia el navegador
// ya viene agrupado (ver routes/agendas.js).
'use strict';

function nowStr() {
  const d = new Date();
  const pad = (n) => (n < 10 ? '0' + n : '' + n);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// Orden FIJO del payload compacto (arrays, no objetos) -- debe coincidir
// EXACTO con AGENDAS_ORDEN_ARRAY (public/js/agendas-logic.js) y con
// agendasFilaArraySchema (validation.js). Los 3 definen el mismo contrato;
// cambiar el orden en uno sin los otros 2 mezclaria columnas en silencio.
const CAMPOS_FILA = ['asesor', 'sede', 'examen', 'especialidad', 'profesional', 'fechaSolicitud', 'tipoLinea', 'entidad'];

function filaArrayAObjeto(arr) {
  const obj = {};
  CAMPOS_FILA.forEach((k, i) => { obj[k] = arr[i]; });
  return obj;
}

// Primera y ultima fechaSolicitud entre las filas del archivo que se esta
// subiendo -- define el periodo que la carga va a REEMPLAZAR.
function rangoFechas(filasObj) {
  let min = filasObj[0].fechaSolicitud;
  let max = filasObj[0].fechaSolicitud;
  for (const f of filasObj) {
    if (f.fechaSolicitud < min) min = f.fechaSolicitud;
    if (f.fechaSolicitud > max) max = f.fechaSolicitud;
  }
  return { desde: min, hasta: max };
}

// Cuenta cuantas filas YA EXISTEN en el rango que este archivo reemplazaria
// -- no escribe nada. El frontend lo usa para pedir confirmacion explicita
// ("se reemplazaran N registros del dd/mm al dd/mm") antes de guardar,
// mismo patron que POST /calidad/trafico/carga/impacto.
function impactoAgendas(db, { campana, filas }) {
  const filasObj = filas.map(filaArrayAObjeto);
  const { desde, hasta } = rangoFechas(filasObj);
  const existentes = db
    .prepare('SELECT COUNT(*) AS n FROM agendas WHERE campana = ? AND fechaSolicitud >= ? AND fechaSolicitud <= ?')
    .get(campana, desde, hasta).n;
  return { desde, hasta, filasExistentes: existentes, filasNuevas: filasObj.length };
}

// Reemplaza por PERIODO: borra todo lo que haya en [desde,hasta] del
// archivo que se sube, despues inserta las filas nuevas -- una sola
// transaccion (o las dos cosas pasan, o ninguna). Volver a subir el MISMO
// archivo deja el mismo conteo (borra las N filas viejas de ese rango
// exacto, inserta las mismas N filas nuevas -- nunca duplica).
function cargarAgendas(db, { campana, archivoNombre, cargadoPorNombre, filas }) {
  const ts = nowStr();
  const filasObj = filas.map(filaArrayAObjeto);
  const { desde, hasta } = rangoFechas(filasObj);

  const del = db.prepare('DELETE FROM agendas WHERE campana = ? AND fechaSolicitud >= ? AND fechaSolicitud <= ?');
  const insert = db.prepare(
    `INSERT INTO agendas
       (campana, asesor, sede, examen, especialidad, profesional, fechaSolicitud, tipoLinea, entidad, archivoNombre, cargadoPorNombre, createdAt)
     VALUES (@campana,@asesor,@sede,@examen,@especialidad,@profesional,@fechaSolicitud,@tipoLinea,@entidad,@archivoNombre,@cargadoPorNombre,@createdAt)`
  );

  let borradas = 0;
  const tx = db.transaction(() => {
    borradas = del.run(campana, desde, hasta).changes;
    for (const f of filasObj) {
      insert.run({
        campana,
        asesor: f.asesor, sede: f.sede, examen: f.examen, especialidad: f.especialidad,
        profesional: f.profesional, fechaSolicitud: f.fechaSolicitud, tipoLinea: f.tipoLinea, entidad: f.entidad,
        archivoNombre: archivoNombre || '', cargadoPorNombre: cargadoPorNombre || '-', createdAt: ts,
      });
    }
  });
  tx();

  return { insertadas: filasObj.length, borradas, desde, hasta };
}

// Arma la clausula WHERE + params a partir de los filtros de query (todos
// opcionales salvo campana -- un filtro ausente significa "Todos", igual
// que el resto de desplegables de la plataforma). `incluirMes:false` es el
// pedido explicito de Edwin para "Total de agendas por mes": esa grafica
// ignora a proposito el filtro de mes (tiene que mostrar TODOS los meses
// con datos), pero respeta los demas -- incluido el rango de dias.
function agendasWhereClausulas(q, incluirMes) {
  const clausulas = ['campana = @campana'];
  const params = { campana: q.campana };
  if (incluirMes && q.mes) {
    clausulas.push('substr(fechaSolicitud,1,7) = @mes');
    params.mes = q.mes;
  }
  if (q.desde) {
    clausulas.push('substr(fechaSolicitud,1,10) >= @desde');
    params.desde = q.desde;
  }
  if (q.hasta) {
    clausulas.push('substr(fechaSolicitud,1,10) <= @hasta');
    params.hasta = q.hasta;
  }
  ['asesor', 'sede', 'especialidad', 'examen', 'profesional', 'tipoLinea', 'entidad'].forEach((campo) => {
    if (q[campo]) {
      clausulas.push(campo + ' = @' + campo);
      params[campo] = q[campo];
    }
  });
  return { where: clausulas.join(' AND '), params };
}

// Grafica principal de Edwin: barras por especialidad, mayor a menor.
function agendasPorEspecialidad(db, q) {
  const { where, params } = agendasWhereClausulas(q, true);
  return db
    .prepare(`SELECT especialidad, COUNT(*) AS cantidad FROM agendas WHERE ${where} GROUP BY especialidad ORDER BY cantidad DESC`)
    .all(params);
}

// Total de agendas por mes -- TODOS los meses con datos, ignora el filtro
// de mes (ver agendasWhereClausulas).
function agendasPorMes(db, q) {
  const { where, params } = agendasWhereClausulas(q, false);
  return db
    .prepare(`SELECT substr(fechaSolicitud,1,7) AS mes, COUNT(*) AS cantidad FROM agendas WHERE ${where} GROUP BY mes ORDER BY mes ASC`)
    .all(params);
}

// Valores distintos para cada desplegable de filtro ("Todos" + seleccion) --
// SIN filtrar por los demas filtros (Edwin no pidio que un filtro angostara
// las opciones de otro; simplifica la UI y evita un ida-y-vuelta extra por
// cada cambio). Tambien sirve para decidir si la pestana "Agendamiento"
// tiene datos que mostrar (meses.length > 0), ver dashboard-generic.js.
function agendasOpciones(db, campana) {
  const distintos = (columna) =>
    db.prepare(`SELECT DISTINCT ${columna} AS v FROM agendas WHERE campana = ? ORDER BY v`).all(campana).map((r) => r.v);
  return {
    meses: db.prepare('SELECT DISTINCT substr(fechaSolicitud,1,7) AS v FROM agendas WHERE campana = ? ORDER BY v').all(campana).map((r) => r.v),
    asesores: distintos('asesor'),
    sedes: distintos('sede'),
    especialidades: distintos('especialidad'),
    examenes: distintos('examen'),
    profesionales: distintos('profesional'),
    entidades: distintos('entidad'),
    tiposLinea: ['3P', 'GENERAL'],
  };
}

module.exports = {
  CAMPOS_FILA,
  filaArrayAObjeto,
  impactoAgendas,
  cargarAgendas,
  agendasPorEspecialidad,
  agendasPorMes,
  agendasOpciones,
};
