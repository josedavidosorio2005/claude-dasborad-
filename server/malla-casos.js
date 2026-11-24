// malla-casos.js — Fase M1 (pedido 6 de Edwin, 23/11; alcance A+B+C aprobado por el usuario el 24/11,
// ver docs/propuesta-malla-casos-especiales.md): «Casos especiales» de la malla de turnos.
//  A. Tipos de excepción editables por el ADMIN (antes 3 fijos: incapacidad, vacaciones, permiso).
//     Cada tipo dice si cuenta como «día trabajado» en el resumen de puntualidad. Un tipo no se
//     borra: se desactiva (las excepciones viejas siguen mostrando su nombre).
// Solo agrega tablas (IF NOT EXISTS); no cambia nada de lo guardado.
'use strict';

const MAX_TIPOS = 30;
// Los 3 de siempre (mismo código que ya guardan las excepciones) y los que faltaban (propuesta A).
const TIPOS_SEMILLA = [
  ['incapacidad', 'Incapacidad', 0], ['vacaciones', 'Vacaciones', 0], ['permiso', 'Permiso', 0],
  ['licencia', 'Licencia (maternidad, paternidad, luto)', 0], ['calamidad', 'Calamidad doméstica', 0],
  ['capacitacion', 'Capacitación', 1], ['compensatorio', 'Compensatorio', 0], ['suspension', 'Suspensión', 0],
  ['dia_familia', 'Día de la familia', 0],
];

function crearTablas(db) {
  db.exec(`
CREATE TABLE IF NOT EXISTS malla_tipos_excepcion (
  codigo TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  activo INTEGER NOT NULL DEFAULT 1,
  cuentaTrabajado INTEGER NOT NULL DEFAULT 0,
  orden INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL
);`);
  const ins = db.prepare('INSERT OR IGNORE INTO malla_tipos_excepcion (codigo, nombre, activo, cuentaTrabajado, orden, createdAt) VALUES (?, ?, 1, ?, ?, ?)');
  const ahora = new Date().toISOString();
  TIPOS_SEMILLA.forEach((t, i) => ins.run(t[0], t[1], t[2], i + 1, ahora));
}

// ── A. Tipos de excepción ──
function _tipo(r) { return { codigo: r.codigo, nombre: r.nombre, activo: r.activo === 1, cuentaTrabajado: r.cuentaTrabajado === 1 }; }
function tipos(db, opts) {
  const todos = !!(opts && opts.todos);
  return db.prepare('SELECT * FROM malla_tipos_excepcion' + (todos ? '' : ' WHERE activo = 1') + ' ORDER BY orden, nombre').all().map(_tipo);
}
// { codigo: nombre } de TODOS los tipos (también los inactivos: las excepciones viejas los usan).
function tiposMapa(db) {
  const m = {};
  for (const t of tipos(db, { todos: true })) m[t.codigo] = t.nombre;
  return m;
}
function tipoActivo(db, codigo) {
  return typeof codigo === 'string' && !!db.prepare('SELECT 1 FROM malla_tipos_excepcion WHERE codigo = ? AND activo = 1').get(codigo);
}
function codigosQueCuentanTrabajado(db) {
  return new Set(db.prepare('SELECT codigo FROM malla_tipos_excepcion WHERE cuentaTrabajado = 1').all().map((r) => r.codigo));
}
function nombreTipoValido(n) {
  return typeof n === 'string' && n.trim().length >= 3 && n.trim().length <= 50 && /^[\p{L}\p{N} ,./()&-]+$/u.test(n.trim());
}
// Código a partir del nombre: minúsculas sin tildes, con guiones bajos; único.
function codigoDe(db, nombre) {
  const base = nombre.trim().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30) || 'tipo';
  let c = base, i = 2;
  while (db.prepare('SELECT 1 FROM malla_tipos_excepcion WHERE codigo = ?').get(c)) c = base.slice(0, 26) + '_' + (i++);
  return c;
}
function crearTipo(db, b, ahora) {
  if (!b || typeof b !== 'object' || Object.keys(b).some((k) => !['nombre', 'cuentaTrabajado'].includes(k))) return { error: 'Datos no válidos' };
  if (!nombreTipoValido(b.nombre)) return { error: 'El nombre debe tener entre 3 y 50 caracteres (letras, números y signos simples)' };
  if (b.cuentaTrabajado !== undefined && typeof b.cuentaTrabajado !== 'boolean') return { error: 'Datos no válidos' };
  if (db.prepare('SELECT COUNT(*) n FROM malla_tipos_excepcion').get().n >= MAX_TIPOS) return { error: 'Máximo ' + MAX_TIPOS + ' tipos' };
  if (db.prepare('SELECT 1 FROM malla_tipos_excepcion WHERE lower(nombre) = lower(?)').get(b.nombre.trim())) return { error: 'Ya hay un tipo con ese nombre', status: 409 };
  const codigo = codigoDe(db, b.nombre);
  const orden = (db.prepare('SELECT MAX(orden) m FROM malla_tipos_excepcion').get().m || 0) + 1;
  db.prepare('INSERT INTO malla_tipos_excepcion (codigo, nombre, activo, cuentaTrabajado, orden, createdAt) VALUES (?, ?, 1, ?, ?, ?)')
    .run(codigo, b.nombre.trim(), b.cuentaTrabajado ? 1 : 0, orden, ahora);
  return { tipo: _tipo(db.prepare('SELECT * FROM malla_tipos_excepcion WHERE codigo = ?').get(codigo)) };
}
function editarTipo(db, codigo, b) {
  const t = db.prepare('SELECT * FROM malla_tipos_excepcion WHERE codigo = ?').get(codigo);
  if (!t) return { error: 'Tipo no encontrado', status: 404 };
  if (!b || typeof b !== 'object' || !Object.keys(b).length || Object.keys(b).some((k) => !['nombre', 'activo', 'cuentaTrabajado'].includes(k))) return { error: 'Datos no válidos' };
  if (b.nombre !== undefined && !nombreTipoValido(b.nombre)) return { error: 'El nombre debe tener entre 3 y 50 caracteres (letras, números y signos simples)' };
  if ((b.activo !== undefined && typeof b.activo !== 'boolean') || (b.cuentaTrabajado !== undefined && typeof b.cuentaTrabajado !== 'boolean')) return { error: 'Datos no válidos' };
  if (b.nombre !== undefined && db.prepare('SELECT 1 FROM malla_tipos_excepcion WHERE lower(nombre) = lower(?) AND codigo != ?').get(b.nombre.trim(), codigo)) return { error: 'Ya hay un tipo con ese nombre', status: 409 };
  if (b.activo === false && db.prepare('SELECT COUNT(*) n FROM malla_tipos_excepcion WHERE activo = 1 AND codigo != ?').get(codigo).n === 0) return { error: 'Debe quedar al menos un tipo activo' };
  db.prepare('UPDATE malla_tipos_excepcion SET nombre = ?, activo = ?, cuentaTrabajado = ? WHERE codigo = ?').run(
    b.nombre !== undefined ? b.nombre.trim() : t.nombre, b.activo !== undefined ? (b.activo ? 1 : 0) : t.activo,
    b.cuentaTrabajado !== undefined ? (b.cuentaTrabajado ? 1 : 0) : t.cuentaTrabajado, codigo);
  return { tipo: _tipo(db.prepare('SELECT * FROM malla_tipos_excepcion WHERE codigo = ?').get(codigo)), antes: _tipo(t) };
}

module.exports = { MAX_TIPOS, TIPOS_SEMILLA, crearTablas, tipos, tiposMapa, tipoActivo, codigosQueCuentanTrabajado, crearTipo, editarTipo };
