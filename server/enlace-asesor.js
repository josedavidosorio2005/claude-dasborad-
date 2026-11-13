// enlace-asesor.js — Fase 353 (reporte de Edwin, 13/11): un monitoreo llega al Portal Asesor
// por el id del usuario (monitoreos.asesorUserId) o, sin id, solo si el nombre es EXACTO
// (sin distinguir mayusculas ni espacios al borde) en la misma campaña (GET /monitoreos/mios).
// Una letra de diferencia («ll» contra «l») dejaba a la asesora en 0.
//
// Este modulo NUNCA enlaza por parecido: solo por nombre exacto con UN unico usuario ASESOR
// activo de la campaña. El parecido (tildes, mayusculas, espacios, orden, 1 o 2 letras) solo se
// usa para SUGERIR; enlazar un nombre parecido lo decide el administrador en «Enlazar monitoreos
// a usuario» (POST /calidad/enlace).
'use strict';

function normNombre(s) {
  return String(s == null ? '' : s)
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-zñ ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
const ordenNombre = (s) => normNombre(s).split(' ').filter(Boolean).sort().join(' ');
const exacto = (s) => String(s == null ? '' : s).trim().toLowerCase();

// Distancia de edicion con tope (mas de 2 no interesa).
function distancia(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 3;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

// Que tan parecido es el texto de un monitoreo al nombre de un usuario. 0 = exacto
// (lo que ya enlaza el portal); null = no se parece. Menor = mas parecido.
const TIPOS = ['igual', 'mayúsculas, tildes o espacios', 'orden de los nombres', '1 letra', '2 letras'];
function nivelParecido(texto, nombre) {
  if (exacto(texto) === exacto(nombre)) return 0;
  const a = normNombre(texto), b = normNombre(nombre);
  if (!a || !b) return null;
  if (a === b) return 1;
  if (ordenNombre(texto) === ordenNombre(nombre)) return 2;
  const d = distancia(a, b);
  if (d === 1) return 3;
  if (d === 2) return 4;
  return null;
}

// La sugerencia para un texto entre los usuarios de la campaña: el mas parecido, y solo si
// no hay empate entre dos usuarios distintos (si hay empate, no se sugiere nadie).
function sugerencia(texto, usuarios) {
  let mejor = null, empate = false;
  for (const u of usuarios || []) {
    const n = nivelParecido(texto, u.nombre);
    if (n === null) continue;
    if (!mejor || n < mejor.nivel) { mejor = { nivel: n, u }; empate = false; }
    else if (n === mejor.nivel && u.id !== mejor.u.id) empate = true;
  }
  if (!mejor || empate) return null;
  return { userId: mejor.u.id, nombre: mejor.u.nombre, tipo: TIPOS[mejor.nivel] };
}

// Usuarios ASESOR activos de una campaña (los que pueden recibir monitoreos).
function asesoresDeCampana(db, campana) {
  return db.prepare("SELECT id, nombre FROM users WHERE rol = 'ASESOR' AND active = 1 AND asesorCampana = ? ORDER BY nombre").all(campana);
}

// Id del usuario si el nombre coincide EXACTO con un unico usuario ASESOR activo de la
// campaña; null si no hay ninguno o hay mas de uno (nunca adivina).
function idPorNombreExacto(db, campana, nombre) {
  if (!campana || !exacto(nombre)) return null;
  const rows = db.prepare(
    "SELECT id FROM users WHERE rol = 'ASESOR' AND active = 1 AND asesorCampana = ? AND lower(trim(nombre)) = lower(trim(?)) LIMIT 2"
  ).all(campana, nombre);
  return rows.length === 1 ? rows[0].id : null;
}

// Para la vista previa de una carga: los nombres que NO quedarian enlazados, cuantas filas
// tiene cada uno y la sugerencia (si hay una sola parecida).
function revisarNombres(db, campana, nombres) {
  const usuarios = asesoresDeCampana(db, campana);
  const conteo = new Map();
  (nombres || []).forEach((n) => { const k = String(n == null ? '' : n).trim(); if (k) conteo.set(k, (conteo.get(k) || 0) + 1); });
  const out = [];
  for (const [asesor, filas] of conteo) {
    if (idPorNombreExacto(db, campana, asesor)) continue;
    out.push({ asesor, filas, sugerencia: sugerencia(asesor, usuarios) });
  }
  return out.sort((a, b) => b.filas - a.filas || a.asesor.localeCompare(b.asesor));
}

// Monitoreos SIN usuario de una campaña, agrupados por el texto del asesor (para la herramienta
// del administrador). `exacto`: ya llega al portal por nombre (igual se puede enlazar por id).
function pendientes(db, campana) {
  const usuarios = asesoresDeCampana(db, campana);
  const rows = db.prepare('SELECT asesor, mes, COUNT(*) AS n FROM monitoreos WHERE campana = ? AND asesorUserId IS NULL GROUP BY asesor, mes').all(campana);
  const grupos = new Map();
  rows.forEach((r) => {
    const g = grupos.get(r.asesor) || { asesor: r.asesor, total: 0, meses: {} };
    g.total += r.n; g.meses[r.mes] = (g.meses[r.mes] || 0) + r.n;
    grupos.set(r.asesor, g);
  });
  const lista = [...grupos.values()].map((g) => Object.assign(g, { sugerencia: sugerencia(g.asesor, usuarios) }));
  // Primero los que tienen sugerencia (los que hay que revisar), despues el resto; por nombre.
  lista.sort((a, b) => (a.sugerencia ? 0 : 1) - (b.sugerencia ? 0 : 1) || a.asesor.localeCompare(b.asesor));
  return { usuarios, pendientes: lista };
}

// Fase 353 (C): enlaza por id los monitoreos sin usuario cuyo nombre coincide EXACTO con un
// unico usuario ASESOR activo de su campaña (hoy ya llegan al portal por nombre; con el id no
// se pierden si luego se corrige el nombre del usuario). No cambia el texto, la nota ni la fecha.
const SQL_EXACTO_UNICO = `
  asesorUserId IS NULL AND (
    SELECT COUNT(*) FROM users u
    WHERE u.rol = 'ASESOR' AND u.active = 1 AND u.asesorCampana = monitoreos.campana
      AND lower(trim(u.nombre)) = lower(trim(monitoreos.asesor))
  ) = 1`;
function contarExactos(db) {
  return db.prepare('SELECT campana, COUNT(*) AS n FROM monitoreos WHERE ' + SQL_EXACTO_UNICO + ' GROUP BY campana ORDER BY campana').all();
}
function enlazarExactos(db) {
  const r = db.prepare(
    `UPDATE monitoreos SET asesorUserId = (
       SELECT u.id FROM users u
       WHERE u.rol = 'ASESOR' AND u.active = 1 AND u.asesorCampana = monitoreos.campana
         AND lower(trim(u.nombre)) = lower(trim(monitoreos.asesor))
     ) WHERE ` + SQL_EXACTO_UNICO
  ).run();
  return r.changes;
}

module.exports = { normNombre, nivelParecido, sugerencia, asesoresDeCampana, idPorNombreExacto, revisarNombres, pendientes, contarExactos, enlazarExactos };
