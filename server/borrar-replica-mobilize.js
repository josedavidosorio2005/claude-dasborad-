// borrar-replica-mobilize.js — Fase W10 (26/11/2026, pedido del usuario): borrar DEL TODO la réplica oculta
// «MOBILIZE PRUEBAS API» (solo fue para probar la API de Wolkvox; el MOBILIZE real ya se actualiza solo).
//
//  - inventario(db): SOLO LECTURA (el dry-run). Por cada tabla con columna `campana` o `cliente`, cuántas filas
//    son de la réplica y, como control, cuántas del MOBILIZE real; más su fila del registro, su tablero, el login
//    de agentes por API (wolkvox_login_diario, operación MOBILIZE: solo lo usó la réplica) y los permisos de
//    usuarios que la nombran. Nunca devuelve valores de los datos, solo conteos.
//  - borrar(db): en UNA transacción borra todo eso. Candados: el nombre es EXACTO (nunca LIKE); la fila tiene que
//    ser interna y réplica de MOBILIZE; si algún usuario la tiene como campaña de asesora, NO borra nada; al final
//    vuelve a contar el MOBILIZE real y, si cambió UNA sola cifra, lanza y la transacción se deshace.
//  - El Historial y el registro de corridas de Wolkvox (wolkvox_auto_corridas) NO se tocan: son la auditoría.
//  - El respaldo (VACUUM INTO, un archivo .db completo) lo hace db.js ANTES de llamar a borrar().
'use strict';

const NOMBRE = 'MOBILIZE PRUEBAS API';
const REAL = 'MOBILIZE';
// Tablas con `campana`/`cliente` que NO se tocan aunque nombren la réplica (auditoría o el propio registro).
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
// ¿Alguna otra campaña con puntualidad usa la operación MOBILIZE? (entonces el login no se borra).
function _loginSoloDeLaReplica() {
  const P = require('./puntualidad');
  return !P.campanasConPuntualidad().some((c) => P.config(c).operacion === REAL);
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

// Control: las cifras del MOBILIZE real en todas las tablas (para comparar antes y después).
function _controlReal(db) {
  const out = {};
  for (const { tabla, col } of _tablas(db)) out[tabla] = db.prepare('SELECT COUNT(*) n FROM ' + _q(tabla) + ' WHERE ' + col + ' = ?').get(REAL).n;
  out.__registro = db.prepare('SELECT COUNT(*) n FROM clientes_registro WHERE nombre = ?').get(REAL).n;
  out.__usuarios = db.prepare('SELECT COUNT(*) n FROM users WHERE asesorCampana = ?').get(REAL).n;
  return JSON.stringify(out);
}

// Borra la réplica. Devuelve { estado: 'nada' | 'no_permitido' | 'borrada', ... } con conteos.
function borrar(db) {
  const inv = inventario(db);
  if (!inv.existe) return { estado: 'nada' };
  if (!inv.puedeBorrar) return { estado: 'no_permitido', motivo: inv.usuariosAsesorasDeLaReplica ? 'hay usuarios con la réplica como campaña' : 'la fila no es una réplica interna de MOBILIZE', inventario: inv };
  const borradas = {};
  db.transaction(() => {
    const antes = _controlReal(db);
    for (const { tabla, col } of _tablas(db)) {
      const n = db.prepare('DELETE FROM ' + _q(tabla) + ' WHERE ' + col + ' = ?').run(NOMBRE).changes;
      if (n) borradas[tabla] = n;
    }
    if (inv.loginAgentes.seBorra && inv.loginAgentes.filas) borradas.wolkvox_login_diario = db.prepare('DELETE FROM wolkvox_login_diario WHERE operacion = ?').run(REAL).changes;
    let permisos = 0;
    for (const u of _permisos(db)) {
      const p = JSON.parse(db.prepare('SELECT perms FROM users WHERE id = ?').get(u.id).perms || '{}');
      for (const k of u.claves) delete p[k];
      db.prepare('UPDATE users SET perms = ? WHERE id = ?').run(JSON.stringify(p), u.id);
      permisos += u.claves.length;
    }
    if (permisos) borradas.permisos_de_usuarios = permisos;
    borradas.clientes_registro = db.prepare('DELETE FROM clientes_registro WHERE nombre = ?').run(NOMBRE).changes;
    // Control final: el MOBILIZE real tiene que quedar EXACTAMENTE igual (si no, se deshace todo).
    if (_controlReal(db) !== antes) throw new Error('El MOBILIZE real cambió durante el borrado: no se borra nada');
  })();
  return { estado: 'borrada', borradas, total: Object.values(borradas).reduce((a, n) => a + n, 0) };
}

module.exports = { NOMBRE, REAL, inventario, borrar };
