// orlant-equidad.js — «Equidad profesionales» de ORLANT (pedido de Edwin, llamada del 24/11/2026; reemplaza la
// propuesta con el formato de Isa de #937). Tres bases (Pólizas, Medicina prepagada y Particulares); cada carga
// reemplaza SOLO su base, todo o nada. Guarda sede, especialidad, profesional, fecha de la cita y, en Pólizas y
// Medicina prepagada, la entidad (nunca un dato del paciente). La lectura y la revisión de cada fila son las de
// public/js/equidad-logic.js (las mismas en el navegador y aquí).
// La lista de qué entidades son pólizas y cuáles prepagadas es configurable (equidad_entidades): Isa se la pasa a
// Edwin. Hoy solo avisa al cargar (no mueve ni borra filas).
'use strict';

const L = require('../public/js/equidad-logic.js');

const CAMPANA = 'ORLANT';

class EquidadError extends Error { constructor(msg, status) { super(msg); this.status = status || 400; } }

function asegurarTablas(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS equidad_citas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      grupo TEXT NOT NULL,
      sede TEXT NOT NULL,
      especialidad TEXT NOT NULL,
      profesional TEXT NOT NULL,
      fecha TEXT NOT NULL,
      entidad TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS idx_equidad_citas_grupo ON equidad_citas (grupo);
    CREATE TABLE IF NOT EXISTS equidad_cargas (
      grupo TEXT PRIMARY KEY,
      archivoNombre TEXT NOT NULL DEFAULT '',
      hoja TEXT NOT NULL DEFAULT '',
      filas INTEGER NOT NULL,
      cargadoEn TEXT NOT NULL,
      cargadoPor TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS equidad_entidades (
      entidadNorm TEXT PRIMARY KEY,
      entidad TEXT NOT NULL,
      grupo TEXT NOT NULL
    );
  `);
}

function mapaEntidades(db) {
  asegurarTablas(db);
  const m = {};
  db.prepare('SELECT entidadNorm, grupo FROM equidad_entidades').all().forEach((r) => { m[r.entidadNorm] = r.grupo; });
  return m;
}

function entidades(db) {
  asegurarTablas(db);
  const out = { polizas: [], prepagada: [] };
  db.prepare('SELECT entidad, grupo FROM equidad_entidades ORDER BY entidad COLLATE NOCASE').all().forEach((r) => { if (out[r.grupo]) out[r.grupo].push(r.entidad); });
  return out;
}

// { polizas: [nombres], prepagada: [nombres] } -> reemplaza la lista completa. Un nombre en las dos = error.
function guardarEntidades(db, cuerpo) {
  asegurarTablas(db);
  const filas = [];
  const vistos = {};
  for (const grupo of ['polizas', 'prepagada']) {
    const lista = (cuerpo && cuerpo[grupo]) || [];
    if (!Array.isArray(lista) || lista.length > 500) throw new EquidadError('Lista de entidades inválida');
    for (const e of lista) {
      const entidad = String(e == null ? '' : e).replace(/\s+/g, ' ').trim().slice(0, 120);
      if (!entidad) continue;
      const n = L.eqNorm(entidad);
      if (vistos[n] && vistos[n] !== grupo) throw new EquidadError('«' + entidad + '» está en las dos listas');
      if (vistos[n]) continue;
      vistos[n] = grupo;
      filas.push([n, entidad, grupo]);
    }
  }
  const ins = db.prepare('INSERT INTO equidad_entidades (entidadNorm, entidad, grupo) VALUES (?, ?, ?)');
  db.transaction(() => { db.prepare('DELETE FROM equidad_entidades').run(); filas.forEach((f) => ins.run(...f)); })();
  return entidades(db);
}

// Reemplaza la base de UN grupo. Devuelve { grupo, filas, reemplazadas, avisos }.
function cargar(db, grupo, cuerpo, actor) {
  asegurarTablas(db);
  if (!L.eqGrupo(grupo)) throw new EquidadError('Base desconocida');
  let filas;
  try { filas = L.eqValidarFilas(cuerpo && cuerpo.filas, grupo); } catch (e) { throw new EquidadError(e.message); }
  const archivoNombre = String((cuerpo && cuerpo.archivoNombre) || '').slice(0, 120);
  const hoja = String((cuerpo && cuerpo.hoja) || '').slice(0, 60);
  const ins = db.prepare('INSERT INTO equidad_citas (grupo, sede, especialidad, profesional, fecha, entidad) VALUES (?, ?, ?, ?, ?, ?)');
  let reemplazadas = 0;
  db.transaction(() => {
    reemplazadas = db.prepare('DELETE FROM equidad_citas WHERE grupo = ?').run(grupo).changes;
    filas.forEach((f) => ins.run(grupo, f.sede, f.esp, f.prof, f.fecha, f.ent));
    db.prepare(`INSERT INTO equidad_cargas (grupo, archivoNombre, hoja, filas, cargadoEn, cargadoPor) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(grupo) DO UPDATE SET archivoNombre = excluded.archivoNombre, hoja = excluded.hoja, filas = excluded.filas, cargadoEn = excluded.cargadoEn, cargadoPor = excluded.cargadoPor`)
      .run(grupo, archivoNombre, hoja, filas.length, new Date().toISOString(), String(actor || '').slice(0, 80));
  })();
  const otras = L.eqEntidadesDeOtraBase(filas, grupo, mapaEntidades(db));
  return { grupo, filas: filas.length, reemplazadas, otraBase: otras };
}

// Lo que pinta la pestaña: las 3 bases con sus filas (sede, especialidad, profesional, fecha, entidad).
function estado(db) {
  asegurarTablas(db);
  const cargas = {};
  db.prepare('SELECT grupo, archivoNombre, hoja, filas, cargadoEn FROM equidad_cargas').all().forEach((c) => { cargas[c.grupo] = c; });
  const sel = db.prepare('SELECT sede, especialidad AS esp, profesional AS prof, fecha, entidad AS ent FROM equidad_citas WHERE grupo = ? ORDER BY id');
  const grupos = L.EQ_GRUPOS.map((g) => {
    const c = cargas[g.id];
    return { id: g.id, nombre: g.nombre, conEntidad: g.conEntidad, archivo: c ? c.archivoNombre : '', hoja: c ? c.hoja : '', cargadoEn: c ? c.cargadoEn : '', filas: c ? sel.all(g.id) : [] };
  });
  return { grupos, total: grupos.reduce((a, g) => a + g.filas.length, 0) };
}

// Resumen para el Centro de cargas (sin filas).
function resumen(db) {
  asegurarTablas(db);
  const cargas = {};
  db.prepare('SELECT grupo, archivoNombre, filas, cargadoEn FROM equidad_cargas').all().forEach((c) => { cargas[c.grupo] = c; });
  const prof = {};
  db.prepare('SELECT grupo, COUNT(DISTINCT profesional) n, MIN(fecha) desde, MAX(fecha) hasta FROM equidad_citas GROUP BY grupo').all().forEach((r) => { prof[r.grupo] = r; });
  return {
    grupos: L.EQ_GRUPOS.map((g) => {
      const c = cargas[g.id], p = prof[g.id] || {};
      return { id: g.id, nombre: g.nombre, conEntidad: g.conEntidad, archivo: c ? c.archivoNombre : '', citas: c ? c.filas : 0, profesionales: p.n || 0, desde: p.desde || '', hasta: p.hasta || '', cargadoEn: c ? c.cargadoEn : '' };
    }),
    entidades: entidades(db),
  };
}

module.exports = { CAMPANA, EquidadError, asegurarTablas, cargar, estado, resumen, entidades, guardarEntidades, mapaEntidades };
