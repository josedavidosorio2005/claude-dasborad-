// cache-opciones.js — Fase 158: cache en memoria de las consultas de
// "opciones" de los dashboards (los valores de cada desplegable de filtro:
// meses, asesores, skills, sedes...). Esas consultas leen TODO el historial
// del cliente a proposito (un desplegable muestra todo lo cargado, no solo
// el mes elegido), tardan de 1 a 4 s con 12 meses y bloquean el unico hilo
// de Node; se piden cada vez que alguien abre una pestana.
//
// Clave: modulo + cliente (+ canal o permiso de ver asesores, segun la
// ruta) -- nunca se comparte una respuesta entre clientes ni entre quien
// ve asesores y quien no.
//
// Invalidacion: cualquier escritura en la base borra TODA la cache, sin
// depender de que cada ruta se acuerde de avisar. Se compara una "firma"
// hecha con dos contadores de SQLite antes de cada lectura:
//   - total_changes(): sube con cada fila insertada, cambiada o borrada por
//     ESTA conexion (cargar, eliminar, deshacer, borrado por rango, remapeo,
//     y cualquier ruta de escritura futura);
//   - PRAGMA data_version: cambia cuando OTRA conexion confirma cambios (un
//     script aparte contra la misma base).
// Si la firma cambio, se vacia la cache y se vuelve a calcular. Las
// escrituras de la plataforma son pocas (cargas, inicios de sesion), asi
// que la cache casi siempre acierta, y cuando no, el costo es el de antes.
'use strict';

const MAX_ENTRADAS = 1000; // tope de memoria: al pasarlo se vacia entera

const porDb = new WeakMap();

function estadoDe(db) {
  let e = porDb.get(db);
  if (!e) {
    e = { entradas: new Map(), firma: null, stmtCambios: db.prepare('SELECT total_changes() AS n') };
    porDb.set(db, e);
  }
  return e;
}

function firmaActual(db, e) {
  return db.pragma('data_version', { simple: true }) + ':' + e.stmtCambios.get().n;
}

// Devuelve una COPIA del valor guardado para `clave`, o lo calcula con
// `calcular()` si no esta o si la base cambio desde que se guardo.
function opcionesConCache(db, clave, calcular) {
  const e = estadoDe(db);
  const firma = firmaActual(db, e);
  if (firma !== e.firma) {
    e.entradas.clear();
    e.firma = firma;
  }
  if (!e.entradas.has(clave)) {
    if (e.entradas.size >= MAX_ENTRADAS) e.entradas.clear();
    e.entradas.set(clave, calcular());
  }
  return structuredClone(e.entradas.get(clave));
}

module.exports = { opcionesConCache };
