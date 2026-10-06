// alias-asesores.js — Fase 122 (reunion con Edwin, 2026-10-05): tabla de
// alias de nombre de asesor (alias -> nombre canonico, por campana),
// aplicada en el SERVIDOR al guardar Tipificacion/Agendas/Efectividad de
// Agendamiento (ver routes/tipificaciones.js, routes/agendas.js,
// routes/efectividad-agendamiento.js) -- nunca en el navegador, nunca una
// migracion que reescriba datos ya cargados. Casos reales que la motivan:
// la misma persona llega con 2 nombres distintos entre archivos (ej.
// "LAURA EJEMPLO TORRES" en Efectividad de Agendamiento == "MARCELA
// EJEMPLO RUIZ" en Agendas) o con una errata puntual de tipeo en Wolkvox
// (ej. "DIANA EJEMPLO SUARZ", "PEDRO EJEMPLO LOPEZ_falla") -- nombres
// SIEMPRE ficticios en este archivo, nunca los reales de ORLANT.
//
// El alta/baja va por API (routes/alias-asesores.js), solo administrador --
// nunca por migracion ni seed del repo (un nombre real de asesor no puede
// vivir en el codigo fuente).
'use strict';

// Normalizacion para COMPARAR (nunca para guardar): mayusculas, sin
// tildes, espacios colapsados -- mismo criterio que agendasNombreNormalizado
// (server/agendas.js), duplicado a proposito: ese normalizador es SOLO para
// fundir variantes de escritura DENTRO del ranking (nunca toca lo
// guardado); este es para decidir si un nombre tiene alias ANTES de
// guardar.
function aliasNorm(s) {
  return String(s == null ? '' : s)
    .trim()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

// Mapa { aliasNormalizado: canonico } de TODOS los alias de una campana --
// una sola consulta por carga (nunca una consulta por fila, con archivos de
// miles de filas).
function cargarAliasMapa(db, campana) {
  const rows = db.prepare('SELECT alias, canonico FROM alias_asesores WHERE campana = ?').all(campana);
  const mapa = {};
  rows.forEach((r) => { mapa[aliasNorm(r.alias)] = r.canonico; });
  return mapa;
}

// `mapa` ya normalizado (ver cargarAliasMapa). Sin alias para ese nombre
// (normalizado) -> se devuelve tal cual, nunca se inventa ni se vacia.
function resolverAlias(mapa, nombreCrudo) {
  if (!mapa) return nombreCrudo;
  const hit = mapa[aliasNorm(nombreCrudo)];
  return hit === undefined ? nombreCrudo : hit;
}

// Aplica el mapa de alias de `campana` al campo `campo` de cada fila (nunca
// muta las filas originales), devolviendo ademas cuantas FILAS y cuantos
// NOMBRES ORIGINALES DISTINTOS se unificaron -- transparencia pedida para
// la confirmacion de la carga (Fase 122: "cantidad, no listado", el nombre
// real nunca sale en la respuesta).
function aplicarAliasAFilas(db, campana, filas, campo) {
  const mapa = cargarAliasMapa(db, campana);
  if (!Object.keys(mapa).length) return { filas, filasUnificadas: 0, asesoresUnificados: 0 };
  let filasUnificadas = 0;
  const nombresUnificados = new Set();
  const out = (filas || []).map((f) => {
    const original = f[campo];
    const canonico = resolverAlias(mapa, original);
    if (canonico === original) return f;
    filasUnificadas++;
    nombresUnificados.add(aliasNorm(original));
    const copia = Object.assign({}, f);
    copia[campo] = canonico;
    return copia;
  });
  return { filas: out, filasUnificadas, asesoresUnificados: nombresUnificados.size };
}

module.exports = { aliasNorm, cargarAliasMapa, resolverAlias, aplicarAliasAFilas };
