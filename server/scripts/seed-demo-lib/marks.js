// marks.js — Ledger de idempotencia del seed de demo.
//
// Cada fila logica que el seed crea (un monitoreo, una carga, un item de
// inventario...) se marca aqui con una clave DETERMINISTICA antes de tocar la
// tabla real. Volver a correr el seed:
//   - si la clave ya esta marcada: no vuelve a insertar (evita duplicados en
//     tablas sin UNIQUE natural, como monitoreos o inventario_movimientos).
//   - si la tabla real tiene su propio UNIQUE (dashboard_cargas,
//     cronograma_metas, calidad_nivel_servicio...): se hace upsert contra esa
//     tabla igual que el endpoint real, y la marca solo registra el rowId
//     resultante para poder borrarlo despues.
//
// `npm run seed:demo:limpiar` borra EXACTAMENTE (tabla, rowId) de aqui y
// nada mas: nunca toca una fila que el seed no haya marcado.
'use strict';

function ensureMarksTable(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS seed_demo_marcas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tabla TEXT NOT NULL,
      clave TEXT NOT NULL,
      rowId INTEGER NOT NULL,
      createdAt TEXT NOT NULL,
      UNIQUE(tabla, clave)
    );
  `);
}

// ¿Ya se marco esta clave? Devuelve el rowId marcado, o null.
function marked(db, tabla, clave) {
  const row = db
    .prepare('SELECT rowId FROM seed_demo_marcas WHERE tabla = ? AND clave = ?')
    .get(tabla, clave);
  return row ? row.rowId : null;
}

// Registra/actualiza la marca (tabla, clave) -> rowId.
function mark(db, tabla, clave, rowId) {
  db.prepare(
    `INSERT INTO seed_demo_marcas (tabla, clave, rowId, createdAt) VALUES (?,?,?,?)
     ON CONFLICT(tabla, clave) DO UPDATE SET rowId = excluded.rowId, createdAt = excluded.createdAt`
  ).run(tabla, clave, rowId, new Date().toISOString());
}

// Categoria B (sin UNIQUE natural relevante): si la clave ya esta marcada, no
// hace nada (devuelve {created:false}); si no, ejecuta insertFn() (debe
// devolver el id de la fila insertada), marca y devuelve {created:true,id}.
function seedOnce(db, tabla, clave, insertFn) {
  const existing = marked(db, tabla, clave);
  if (existing !== null) return { created: false, id: existing };
  const id = insertFn();
  mark(db, tabla, clave, id);
  return { created: true, id };
}

// Categoria A (la tabla real tiene su propio UNIQUE que coincide con `clave`,
// ej. dashboard_cargas por cliente+seccion+periodo, cronograma_metas por
// campana+mes+liderId, gerencia_kpis por periodo+nombre): igual que seedOnce,
// pero ADEMAS comprueba con `checkExisting()` si ya hay una fila REAL para esa
// clave que nosotros no sembramos (un admin subio ese periodo a mano antes de
// correr el seed). En ese caso no se inserta ni se marca — nunca se pisa ni se
// adopta un dato que no es nuestro, para que seed:demo:limpiar jamas lo borre.
// Devuelve {created,id} o {created:false, skipped:true, id} si era ajeno.
function seedOnceGuarded(db, tabla, clave, { checkExisting, insertFn }) {
  const existing = marked(db, tabla, clave);
  if (existing !== null) return { created: false, id: existing };
  const ajeno = checkExisting();
  if (ajeno) return { created: false, skipped: true, id: ajeno };
  const id = insertFn();
  mark(db, tabla, clave, id);
  return { created: true, id };
}

// Cuenta cuantas marcas hay por tabla (para el resumen final del seed).
function countByTabla(db) {
  return db
    .prepare('SELECT tabla, COUNT(*) AS n FROM seed_demo_marcas GROUP BY tabla ORDER BY tabla')
    .all();
}

// Borra EXACTAMENTE lo marcado: por cada tabla, DELETE ... WHERE id IN
// (rowIds marcados). Orden pensado para que las FK (ON DELETE CASCADE/SET
// NULL) no dejen huerfanos visibles a medio borrado, aunque SQLite ya las
// resuelve solo. Devuelve { tabla: borrados } y limpia la propia tabla de marcas.
const ORDEN_LIMPIEZA = [
  'dashboard_cargas',
  'calidad_nivel_servicio_diario',
  'calidad_nivel_servicio',
  'monitoreos',
  'cronograma_metas',
  'inventario_movimientos',
  'inventario_items',
  'gerencia_kpis',
  'gestion_humana_personal',
  'users',
];

function limpiarTodo(db) {
  const resultado = {};
  const tx = db.transaction(() => {
    for (const tabla of ORDEN_LIMPIEZA) {
      const rows = db.prepare('SELECT id, rowId FROM seed_demo_marcas WHERE tabla = ?').all(tabla);
      if (!rows.length) continue;
      const del = db.prepare(`DELETE FROM ${tabla} WHERE id = ?`);
      let borrados = 0;
      for (const r of rows) {
        const info = del.run(r.rowId);
        borrados += info.changes;
      }
      db.prepare('DELETE FROM seed_demo_marcas WHERE tabla = ?').run(tabla);
      resultado[tabla] = borrados;
    }
    // Por si quedara alguna tabla marcada fuera de ORDEN_LIMPIEZA (no deberia).
    const restantes = db.prepare('SELECT DISTINCT tabla FROM seed_demo_marcas').all();
    for (const { tabla } of restantes) {
      const rows = db.prepare('SELECT rowId FROM seed_demo_marcas WHERE tabla = ?').all(tabla);
      const del = db.prepare(`DELETE FROM ${tabla} WHERE id = ?`);
      let borrados = 0;
      for (const r of rows) {
        try {
          const info = del.run(r.rowId);
          borrados += info.changes;
        } catch (_) {
          /* tabla desconocida: se ignora, no deberia pasar */
        }
      }
      db.prepare('DELETE FROM seed_demo_marcas WHERE tabla = ?').run(tabla);
      resultado[tabla] = (resultado[tabla] || 0) + borrados;
    }
  });
  tx();
  return resultado;
}

module.exports = { ensureMarksTable, marked, mark, seedOnce, seedOnceGuarded, countByTabla, limpiarTodo };
