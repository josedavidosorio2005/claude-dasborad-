// agendas.js — Agendas de ORLANT (Fase 78, pedido de Jairo/Edwin): escritura
// (reemplazo por periodo) y agregacion filtrada. El servidor NUNCA descarga
// filas crudas al dashboard -- todo lo que sale de aqui hacia el navegador
// ya viene agrupado (ver routes/agendas.js).
'use strict';

const { fechaLimitesRangoDeMes } = require('./fecha-limites');
const { aplicarAliasAFilas } = require('./alias-asesores');

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
  // Fase 122: transparencia del alias de asesor ANTES de confirmar la carga.
  const alias = aplicarAliasAFilas(db, campana, filasObj, 'asesor');
  return {
    desde, hasta, filasExistentes: existentes, filasNuevas: filasObj.length,
    filasUnificadasPorAlias: alias.filasUnificadas, asesoresUnificadosPorAlias: alias.asesoresUnificados,
  };
}

// Reemplaza por PERIODO: borra todo lo que haya en [desde,hasta] del
// archivo que se sube, despues inserta las filas nuevas -- una sola
// transaccion (o las dos cosas pasan, o ninguna). Volver a subir el MISMO
// archivo deja el mismo conteo (borra las N filas viejas de ese rango
// exacto, inserta las mismas N filas nuevas -- nunca duplica).
function cargarAgendas(db, { campana, archivoNombre, cargadoPorNombre, filas }) {
  const ts = nowStr();
  let filasObj = filas.map(filaArrayAObjeto);
  // Fase 122: alias de nombre de asesor ANTES de guardar.
  filasObj = aplicarAliasAFilas(db, campana, filasObj, 'asesor').filas;
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
  // Fase 88: `fechaSolicitud` guarda tambien hora ('AAAA-MM-DD HH:MM:SS'),
  // por eso el codigo viejo comparaba con `substr(fechaSolicitud,1,7/10)`
  // -- no sargable, nunca aprovechaba idx_agendas_campana_fecha. El mismo
  // resultado se logra con un rango DIRECTO sobre la columna completa: el
  // limite "hasta" lleva ' 23:59:59' agregado para no perder filas del
  // ultimo dia (el limite "desde" no lo necesita: '2025-04-01' ya es menor
  // que cualquier hora de ese mismo dia en orden de texto).
  if (incluirMes && q.mes) {
    const rango = fechaLimitesRangoDeMes(q.mes);
    clausulas.push('fechaSolicitud >= @mesDesde AND fechaSolicitud <= @mesHasta');
    params.mesDesde = rango.desde;
    params.mesHasta = rango.hasta + ' 23:59:59';
  }
  if (q.desde) {
    clausulas.push('fechaSolicitud >= @desde');
    params.desde = q.desde;
  }
  if (q.hasta) {
    clausulas.push('fechaSolicitud <= @hasta');
    params.hasta = q.hasta + ' 23:59:59';
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

// Fase 94 (tema B, pedido de Edwin): "Agendas por línea" -- por mes, una
// serie para Línea General y otra para 3P, sacadas de `tipoLinea` de la
// tabla `agendas` (ya NO de la hoja "resumen", que Edwin dijo que nunca se
// llena). Mismo criterio que agendasPorMes: TODOS los meses con datos,
// ignora el filtro de mes (es una serie de tiempo), respeta los demas.
function agendasPorLinea(db, q) {
  const { where, params } = agendasWhereClausulas(q, false);
  return db
    .prepare(
      `SELECT substr(fechaSolicitud,1,7) AS mes, tipoLinea, COUNT(*) AS cantidad
       FROM agendas WHERE ${where} GROUP BY mes, tipoLinea ORDER BY mes ASC`
    )
    .all(params);
}

// ── Ranking de asesores (Fase 104, pedido de InCo) ──────────────────────
// Reemplaza a "Agendas por agente" (Fase 94): en vez de un top 12 + "Otros"
// sin posicion ni desglose, un ranking COMPLETO (todos los asesores, nunca
// se esconde a nadie en "Otros") con puesto, % del total, 3P/General por
// separado, promedio por dia trabajado y variacion contra el mes anterior.
// Todo agregado en SQL/servidor -- el navegador nunca descarga filas crudas
// de `agendas` (~7.500/mes), solo esta tabla ya resumida (una fila por
// asesor real).

// Clave de agrupacion insensible a mayusculas/tildes/espacios dobles --
// SOLO para decidir que filas son "el mismo asesor" al armar el ranking,
// nunca se escribe de vuelta a la base (la columna `asesor` guardada queda
// intacta, tal cual la trajo el archivo). SQLite no tiene una funcion
// nativa que saque tildes, por eso la normalizacion pasa por JS (ver
// agendasRankingCrudo: la consulta SQL agrupa por el valor CRUDO de
// `asesor`, y es aqui donde se funden las variantes que resultan
// equivalentes tras normalizar).
function agendasNombreNormalizado(nombre) {
  return String(nombre == null ? '' : nombre)
    .trim()
    .replace(/\s+/g, ' ')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase();
}

// 'AAAA-MM' -> 'AAAA-MM' del mes calendario anterior (diciembre de un anio
// -> noviembre del mismo anio; enero -> diciembre del anio anterior).
function agendasMesAnterior(mes) {
  const y = parseInt(mes.slice(0, 4), 10);
  const m = parseInt(mes.slice(5, 7), 10);
  const anterior = m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 };
  return `${anterior.y}-${String(anterior.m).padStart(2, '0')}`;
}

// Filas crudas agrupadas por (asesor TAL CUAL esta guardado, tipoLinea,
// dia) -- la granularidad minima que hace falta para: (a) fundir variantes
// de escritura del mismo asesor sin perder el detalle de tipoLinea/dia que
// necesita el resto del calculo, y (b) contar "dias distintos con agenda"
// correctamente incluso si el mismo dia aparece bajo 2 variantes de
// escritura del mismo asesor (ver agendasRankingPuro). Nunca es la tabla
// cruda completa: ya viene agrupada por SQL (GROUP BY), nunca una fila por
// agenda individual.
function agendasRankingCrudo(db, q) {
  const { where, params } = agendasWhereClausulas(q, true);
  return db
    .prepare(
      `SELECT asesor, tipoLinea, substr(fechaSolicitud,1,10) AS dia, COUNT(*) AS cantidad
       FROM agendas WHERE ${where} GROUP BY asesor, tipoLinea, dia`
    )
    .all(params);
}

// Reparte un total en porcentajes de 2 decimales que SUMAN EXACTO 100.00 --
// redondear cada fila por separado (ej. Math.round(x*100)/100) puede dar
// 99.98 o 100.02 por el redondeo independiente de cada una. Metodo del
// resto mayor (Hare-Niemeyer): se trabaja en centesimas de punto porcentual
// (enteros, sin arrastre de coma flotante) -- cada fila se queda con el
// piso de su porcentaje exacto, y las centesimas que faltan para llegar a
// 10000 se reparten de a una entre las filas con el resto mas grande.
function agendasRepartirPorcentajes(filas, totalGeneral) {
  if (!totalGeneral || totalGeneral <= 0) {
    filas.forEach((f) => { f.pct = 0; });
    return;
  }
  const exactos = filas.map((f) => (f.total / totalGeneral) * 10000);
  const base = exactos.map(Math.floor);
  const sumaBase = base.reduce((a, b) => a + b, 0);
  const faltante = 10000 - sumaBase;
  const restos = exactos.map((v, i) => ({ i, resto: v - base[i] })).sort((a, b) => b.resto - a.resto);
  for (let k = 0; k < faltante; k++) base[restos[k % restos.length].i] += 1;
  filas.forEach((f, i) => { f.pct = Math.round(base[i]) / 100; });
}

// Ranking SIN variacion (una sola "foto" del periodo que pide `q`) -- lo
// reusa agendasRanking() dos veces (mes actual + mes anterior) para poder
// calcular la variacion sin duplicar toda esta logica.
function agendasRankingPuro(db, q) {
  const crudo = agendasRankingCrudo(db, q);
  const grupos = new Map();
  let totalGeneral = 0;
  for (const f of crudo) {
    // "SIN ASESOR" es el valor que guarda el parseo del navegador cuando
    // NOMBRE DE AGENTE viene vacio (agendas-logic.js, Fase 104 -- antes esa
    // fila se descartaba en silencio). Se compara normalizado por si algun
    // dia llega con otra combinacion de mayusculas/espacios; un valor
    // realmente null/vacio (dato historico de antes de este cambio, o
    // cargado por otra via) cae en el mismo grupo.
    const esSinAsesor = f.asesor === null || f.asesor === undefined || String(f.asesor).trim() === '' || agendasNombreNormalizado(f.asesor) === 'SIN ASESOR';
    const key = esSinAsesor ? '__SIN_ASESOR__' : agendasNombreNormalizado(f.asesor);
    if (!grupos.has(key)) {
      grupos.set(key, { sinAsesor: esSinAsesor, variantes: new Map(), total: 0, cantidad3p: 0, cantidadGeneral: 0, dias: new Set() });
    }
    const g = grupos.get(key);
    if (!esSinAsesor) g.variantes.set(f.asesor, (g.variantes.get(f.asesor) || 0) + f.cantidad);
    g.total += f.cantidad;
    if (f.tipoLinea === '3P') g.cantidad3p += f.cantidad;
    else if (f.tipoLinea === 'GENERAL') g.cantidadGeneral += f.cantidad;
    g.dias.add(f.dia);
    totalGeneral += f.cantidad;
  }

  let variantesConHomonimos = 0;
  const filas = [];
  let filaSinAsesor = null;
  for (const g of grupos.values()) {
    let nombre = 'Sin asesor';
    if (!g.sinAsesor) {
      if (g.variantes.size > 1) variantesConHomonimos++;
      let mejor = null;
      let mejorCantidad = -1;
      // Nombre canonico a mostrar: la variante de escritura con MAS agendas
      // (la forma "mas usada" en el periodo); empate -> orden alfabetico,
      // para que el resultado sea determinista entre corridas.
      [...g.variantes.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)).forEach(([variante, cantidad]) => {
        if (cantidad > mejorCantidad) { mejor = variante; mejorCantidad = cantidad; }
      });
      nombre = mejor;
    }
    const diasDistintos = g.dias.size;
    const fila = {
      asesor: nombre,
      sinAsesor: g.sinAsesor,
      total: g.total,
      cantidad3p: g.cantidad3p,
      cantidadGeneral: g.cantidadGeneral,
      diasDistintos,
      promedioPorDia: diasDistintos > 0 ? Math.round((g.total / diasDistintos) * 100) / 100 : 0,
    };
    if (g.sinAsesor) filaSinAsesor = fila;
    else filas.push(fila);
  }

  // Mayor a menor; empate en total -> alfabetico (orden ESTABLE y
  // determinista, nunca depende del orden de insercion de SQLite).
  filas.sort((a, b) => (b.total - a.total) || (a.asesor < b.asesor ? -1 : a.asesor > b.asesor ? 1 : 0));

  // Puesto de competencia (1,2,2,4...): los empates comparten puesto, el
  // siguiente salta tantos lugares como personas empataron. "Sin asesor"
  // nunca compite por un puesto (no es un asesor real).
  let puestoActual = 0;
  filas.forEach((f, idx) => {
    if (idx === 0 || f.total !== filas[idx - 1].total) puestoActual = idx + 1;
    f.puesto = puestoActual;
  });

  const todas = filaSinAsesor ? filas.concat([Object.assign({ puesto: null }, filaSinAsesor)]) : filas;
  agendasRepartirPorcentajes(todas, totalGeneral);
  return { filas: todas, total: totalGeneral, variantesConHomonimos };
}

// Ranking completo: la foto del periodo pedido + variacion contra el mes
// calendario anterior (solo tiene sentido si `q.mes` esta fijo a un mes
// puntual -- con "Todos los meses" o un rango de fechas a mano no hay un
// "mes anterior" univoco, así que la variacion queda "-" para todos).
function agendasRanking(db, q) {
  const actual = agendasRankingPuro(db, q);
  if (!q.mes) {
    actual.filas.forEach((f) => { f.variacion = null; });
    return actual;
  }
  // La variacion compara MES COMPLETO contra MES COMPLETO -- nunca mezclada
  // con un rango de fechas manual que el usuario haya puesto ADEMAS del mes.
  const qAnterior = Object.assign({}, q, { mes: agendasMesAnterior(q.mes), desde: undefined, hasta: undefined });
  const anterior = agendasRankingPuro(db, qAnterior);
  const porNombreAnterior = new Map();
  anterior.filas.forEach((f) => { if (!f.sinAsesor) porNombreAnterior.set(agendasNombreNormalizado(f.asesor), f.total); });
  actual.filas.forEach((f) => {
    if (f.sinAsesor) { f.variacion = null; return; }
    const totalAnterior = porNombreAnterior.get(agendasNombreNormalizado(f.asesor));
    f.variacion = totalAnterior === undefined ? null : f.total - totalAnterior;
  });
  return actual;
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
  agendasPorLinea,
  agendasOpciones,
  agendasNombreNormalizado,
  agendasMesAnterior,
  agendasRankingCrudo,
  agendasRankingPuro,
  agendasRanking,
};
