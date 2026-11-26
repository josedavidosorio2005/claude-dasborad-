// inventario-replica-mobilize.js — Fase W10a (26/11/2026, pedido del usuario): SOLO LECTURA. El dry-run del borrado
// de la réplica oculta «MOBILIZE PRUEBAS API» (el borrado va aparte, en el PR de la Fase W10, y lo mergea el usuario
// tras su «OK borrar»). Aquí no hay ninguna escritura: solo SELECT COUNT(*).
//
//  - inventario(db): por cada tabla con columna `campana` o `cliente`, cuántas filas son de la réplica y, como
//    control, cuántas del MOBILIZE real; su fila del registro, el login de agentes por API (wolkvox_login_diario,
//    operación MOBILIZE: solo lo usó la réplica), las asesoras y los permisos de usuarios que la nombran, y cuánto
//    Historial la nombra (eso NO se borraría). Nunca devuelve valores de los datos, solo conteos.
'use strict';

const NOMBRE = 'MOBILIZE PRUEBAS API';
const REAL = 'MOBILIZE';
// Tablas con `campana`/`cliente` que el borrado NO tocaría aunque nombren la réplica (auditoría o el propio registro).
const NO_TOCAR = new Set(['historial', 'clientes_registro', 'users', 'schema_migrations', 'wolkvox_auto_corridas']);

function _tablas(db) {
  const out = [];
  for (const { name } of db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all()) {
    if (NO_TOCAR.has(name)) continue;
    const cols = db.prepare('PRAGMA table_info("' + name.replace(/"/g, '""') + '")').all().map((c) => c.name);
    const col = cols.includes('campana') ? 'campana' : (cols.includes('cliente') ? 'cliente' : null);
    if (col) out.push({ tabla: name, col });
  }
  return out;
}
const _q = (t) => '"' + t.replace(/"/g, '""') + '"';
function _existe(db, tabla) { return !!db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(tabla); }

function _registro(db) {
  const r = db.prepare('SELECT nombre, parametros, dashboard, activo FROM clientes_registro WHERE nombre = ?').get(NOMBRE);
  if (!r) return null;
  let p = {};
  try { p = r.parametros ? JSON.parse(r.parametros) : {}; } catch (e) { p = {}; }
  return { interna: p.interno === true, replicaDe: p.replicaDe || null, dashboard: r.dashboard, activo: r.activo };
}
// Usuarios cuyos permisos nombran la réplica (claves «…_MOBILIZE PRUEBAS API»). Solo ids y claves.
function _permisos(db) {
  const out = [];
  for (const u of db.prepare('SELECT id, perms FROM users WHERE perms LIKE ?').all('%' + NOMBRE + '%')) {
    let p = {};
    try { p = JSON.parse(u.perms || '{}'); } catch (e) { continue; }
    const claves = Object.keys(p).filter((k) => k.endsWith('_' + NOMBRE));
    if (claves.length) out.push({ id: u.id, claves });
  }
  return out;
}
// ¿Alguna OTRA campaña con puntualidad usa la operación MOBILIZE? (entonces el login no se borraría).
function _loginSoloDeLaReplica() {
  const P = require('./puntualidad');
  return !P.campanasConPuntualidad().some((c) => c !== NOMBRE && P.config(c).operacion === REAL);
}

// SOLO LECTURA: el dry-run.
function inventario(db) {
  const reg = _registro(db);
  const tablas = [];
  for (const { tabla, col } of _tablas(db)) {
    const replica = db.prepare('SELECT COUNT(*) n FROM ' + _q(tabla) + ' WHERE ' + col + ' = ?').get(NOMBRE).n;
    const real = db.prepare('SELECT COUNT(*) n FROM ' + _q(tabla) + ' WHERE ' + col + ' = ?').get(REAL).n;
    if (replica || real) tablas.push({ tabla, columna: col, replica, real });
  }
  const login = _existe(db, 'wolkvox_login_diario') ? db.prepare('SELECT COUNT(*) n FROM wolkvox_login_diario WHERE operacion = ?').get(REAL).n : 0;
  const asesoras = db.prepare('SELECT COUNT(*) n FROM users WHERE asesorCampana = ?').get(NOMBRE).n;
  const permisos = _permisos(db);
  const historial = db.prepare('SELECT COUNT(*) n FROM historial WHERE detalle LIKE ?').get('%' + NOMBRE + '%').n;
  return {
    campana: NOMBRE, existe: !!reg, registro: reg,
    tablas, totalFilasReplica: tablas.reduce((a, t) => a + t.replica, 0),
    loginAgentes: { tabla: 'wolkvox_login_diario', operacion: REAL, filas: login, seBorra: _loginSoloDeLaReplica() },
    usuariosAsesorasDeLaReplica: asesoras,
    usuariosConPermisoDeLaReplica: permisos.length,
    seQueda: { historialQueLaNombra: historial, nota: 'El Historial y el registro de corridas de Wolkvox no se tocan (auditoría).' },
    puedeBorrar: !!reg && reg.interna && reg.replicaDe === REAL && asesoras === 0,
  };
}

module.exports = { NOMBRE, REAL, inventario };
