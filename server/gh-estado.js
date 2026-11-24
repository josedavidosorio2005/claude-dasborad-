// gh-estado.js — Fase GH2 (plan de Gestión humana, docs/gestion-humana/plan.md §1): «Talento humano»
// (la app de Edwin) guarda en el servidor en vez del navegador. Un documento por clave, las mismas
// claves que usaba en localStorage, con `version` para que una pestaña vieja no pise lo nuevo (409).
// La bitácora (gh_bitacora) dice quién guardó qué clave y cuándo, NUNCA el contenido.
//
// Quién entra: el administrador completo siempre; el rol GESTION_HUMANA solo con el interruptor
// GH_ROL_ACTIVO=1 (SSM, lo crea el usuario con su OK; sin él, el rol no entra ni ve la tarjeta).
'use strict';

const BASE = 'inconexion_gh_empleados_v1';
// Lista CERRADA: solo los datos. Las marcas internas de la app (_init*, _impdemo, _lastcopy) se quedan
// en el navegador de cada quien.
const CLAVES = Object.freeze([BASE, BASE + '_vac', BASE + '_nov', BASE + '_aus', BASE + '_auscfg', BASE + '_cfg']);
const MAX_BYTES = 6 * 1024 * 1024; // por clave (el cuerpo de esta ruta admite 8 MB)

function crearTablas(db) {
  db.exec(`
CREATE TABLE IF NOT EXISTS gh_estado (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL,
  version INTEGER NOT NULL,
  actualizadoPor TEXT NOT NULL DEFAULT '',
  actualizadoAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS gh_bitacora (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  clave TEXT NOT NULL,
  version INTEGER NOT NULL,
  usuario TEXT NOT NULL DEFAULT '',
  fecha TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  elementos INTEGER
);
CREATE INDEX IF NOT EXISTS idx_gh_bitacora_fecha ON gh_bitacora(fecha);
`);
}

function rolActivo(env) { return (env || process.env).GH_ROL_ACTIVO === '1'; }

// auth se carga aquí (no arriba): db.js carga este archivo y auth.js necesita db.js.
function puede(actor, env) {
  if (!actor) return false;
  if (require('./auth').isFullAdmin(actor)) return true;
  return actor.rol === 'GESTION_HUMANA' && rolActivo(env);
}

function esClave(c) { return CLAVES.includes(c); }

function leerTodo(db) {
  const out = {};
  for (const r of db.prepare('SELECT clave, valor, version FROM gh_estado').all()) {
    if (esClave(r.clave)) out[r.clave] = { valor: r.valor, version: r.version };
  }
  return out;
}

// Guarda una clave si `version` es la que hay (0 = todavía no existe). Todo o nada.
function guardar(db, clave, cuerpo, quien) {
  if (!esClave(clave)) return { status: 400, error: 'Clave no permitida' };
  const b = cuerpo || {};
  const version = b.version;
  if (!Number.isInteger(version) || version < 0) return { status: 400, error: 'Falta la versión' };
  if (typeof b.valor !== 'string') return { status: 400, error: 'El valor debe ser texto' };
  const bytes = Buffer.byteLength(b.valor, 'utf8');
  if (bytes > MAX_BYTES) return { status: 413, error: 'Demasiado grande para guardar (máximo 6 MB por sección)' };
  let dato;
  try { dato = JSON.parse(b.valor); } catch (e) { return { status: 400, error: 'El valor no es JSON válido' }; }
  if (dato === null || typeof dato !== 'object') return { status: 400, error: 'El valor debe ser una lista u objeto' };
  const ahora = new Date().toISOString();
  return db.transaction(() => {
    const fila = db.prepare('SELECT version FROM gh_estado WHERE clave = ?').get(clave);
    const actual = fila ? fila.version : 0;
    if (actual !== version) return { status: 409, error: 'Otra persona guardó cambios antes', version: actual };
    const nueva = actual + 1;
    db.prepare(`INSERT INTO gh_estado (clave, valor, version, actualizadoPor, actualizadoAt) VALUES (?,?,?,?,?)
      ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, version = excluded.version, actualizadoPor = excluded.actualizadoPor, actualizadoAt = excluded.actualizadoAt`)
      .run(clave, b.valor, nueva, quien || '', ahora);
    db.prepare('INSERT INTO gh_bitacora (clave, version, usuario, fecha, bytes, elementos) VALUES (?,?,?,?,?,?)')
      .run(clave, nueva, quien || '', ahora, bytes, Array.isArray(dato) ? dato.length : null);
    return { status: 200, version: nueva };
  })();
}

function bitacora(db, limite) {
  const n = Math.min(Math.max(Number(limite) || 200, 1), 500);
  return db.prepare('SELECT clave, version, usuario, fecha, bytes, elementos FROM gh_bitacora ORDER BY id DESC LIMIT ?').all(n);
}

module.exports = { BASE, CLAVES, MAX_BYTES, crearTablas, rolActivo, puede, esClave, leerTodo, guardar, bitacora };
