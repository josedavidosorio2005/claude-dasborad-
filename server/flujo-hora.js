// flujo-hora.js — Fase 196 (Mobilize): "Flujo por hora". Guarda el reporte de
// cola por hora de Wolkvox (una fila por dia + hora + skill) y lo devuelve
// sumado por dia + hora para los mapas de calor. Sin telefonos: el reporte no
// los trae. Reemplazo por periodo (primera a ultima fecha del archivo).
'use strict';

const { respaldarAntesDeCambiar } = require('./cargas-versiones');

function nowStr() {
  const d = new Date();
  const pad = (n) => (n < 10 ? '0' + n : '' + n);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// Orden fijo de la fila (= FLUJO_HORA_ORDEN_ARRAY de public/js/flujo-hora-logic.js).
const CAMPOS_FILA = ['fecha', 'hora', 'skill', 'ingresadas', 'contestadas', 'abandonadas'];

function _objetos(filas) {
  return filas.map((arr) => {
    const o = {};
    CAMPOS_FILA.forEach((k, i) => { o[k] = arr[i]; });
    return o;
  });
}

function _rango(filasObj) {
  let desde = filasObj[0].fecha;
  let hasta = filasObj[0].fecha;
  for (const f of filasObj) {
    if (f.fecha < desde) desde = f.fecha;
    if (f.fecha > hasta) hasta = f.fecha;
  }
  return { desde, hasta };
}

function impactoFlujoHora(db, { campana, filas }) {
  const filasObj = _objetos(filas);
  const { desde, hasta } = _rango(filasObj);
  const existentes = db.prepare('SELECT COUNT(*) AS n FROM flujo_hora WHERE campana = ? AND fecha >= ? AND fecha <= ?').get(campana, desde, hasta).n;
  const suma = (k) => filasObj.reduce((a, f) => a + f[k], 0);
  return { desde, hasta, filasExistentes: existentes, filasNuevas: filasObj.length,
    ingresadas: suma('ingresadas'), contestadas: suma('contestadas'), abandonadas: suma('abandonadas') };
}

function cargarFlujoHora(db, { campana, archivoNombre, cargadoPorNombre, filas }) {
  const ts = nowStr();
  const filasObj = _objetos(filas);
  const { desde, hasta } = _rango(filasObj);
  const del = db.prepare('DELETE FROM flujo_hora WHERE campana = ? AND fecha >= ? AND fecha <= ?');
  const insert = db.prepare(
    `INSERT INTO flujo_hora (campana, fecha, hora, skill, ingresadas, contestadas, abandonadas, archivoNombre, cargadoPorNombre, createdAt)
     VALUES (@campana, @fecha, @hora, @skill, @ingresadas, @contestadas, @abandonadas, @archivoNombre, @cargadoPorNombre, @createdAt)`
  );
  let borradas = 0;
  db.transaction(() => {
    respaldarAntesDeCambiar(db, 'flujo_hora', { campana, desde, hasta, guardadoPorNombre: cargadoPorNombre });
    borradas = del.run(campana, desde, hasta).changes;
    for (const f of filasObj) {
      insert.run({ campana, ...f, archivoNombre: archivoNombre || '', cargadoPorNombre: cargadoPorNombre || '-', createdAt: ts });
    }
  })();
  return { insertadas: filasObj.length, borradas, desde, hasta };
}

// Meses con datos y skills (para el estado vacio y el filtro de skill).
function flujoHoraOpciones(db, campana) {
  return {
    meses: db.prepare('SELECT DISTINCT substr(fecha,1,7) AS v FROM flujo_hora WHERE campana = ? ORDER BY v').all(campana).map((r) => r.v),
    skills: db.prepare('SELECT DISTINCT skill AS v FROM flujo_hora WHERE campana = ? ORDER BY v').all(campana).map((r) => r.v),
  };
}

// Un mes, sumado por dia + hora (todas las skills, o una). Sin mes: el ultimo con datos.
function flujoHoraMes(db, { campana, mes, skill }) {
  if (!mes) {
    const ultimo = db.prepare('SELECT MAX(substr(fecha,1,7)) AS m FROM flujo_hora WHERE campana = ?').get(campana).m;
    if (!ultimo) return [];
    mes = ultimo;
  }
  const params = { campana, desde: mes + '-01', hasta: mes + '-31' };
  let extra = '';
  if (skill) { extra = ' AND skill = @skill'; params.skill = skill; }
  return db
    .prepare(`SELECT fecha AS dia, hora, SUM(ingresadas) AS ingresadas, SUM(contestadas) AS contestadas, SUM(abandonadas) AS abandonadas
      FROM flujo_hora WHERE campana = @campana AND fecha >= @desde AND fecha <= @hasta${extra}
      GROUP BY fecha, hora ORDER BY fecha, hora`)
    .all(params);
}

module.exports = { CAMPOS_FILA, impactoFlujoHora, cargarFlujoHora, flujoHoraOpciones, flujoHoraMes };
