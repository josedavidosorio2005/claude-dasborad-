// orlant-equidad.js — «Equidad profesionales» de ORLANT (pedido de Edwin, llamada del 24/11/2026; reemplaza la
// propuesta con el formato de Isa de #937). Tres bases (Pólizas, Medicina prepagada y Particulares). Desde el 26/11
// (pedido de Edwin) cada base se carga POR MES: una carga reemplaza SOLO esa base en ese mes, todo o nada. Guarda sede, especialidad, profesional, fecha de la cita y, en Pólizas y
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
    CREATE TABLE IF NOT EXISTS equidad_opciones (
      clave TEXT PRIMARY KEY,
      valor TEXT NOT NULL,
      cambiadoEn TEXT NOT NULL,
      cambiadoPor TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS equidad_entidades (
      entidadNorm TEXT PRIMARY KEY,
      entidad TEXT NOT NULL,
      grupo TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS equidad_cargas_mes (
      grupo TEXT NOT NULL,
      mes TEXT NOT NULL,
      archivoNombre TEXT NOT NULL DEFAULT '',
      hoja TEXT NOT NULL DEFAULT '',
      filas INTEGER NOT NULL,
      cargadoEn TEXT NOT NULL,
      cargadoPor TEXT NOT NULL DEFAULT '',
      PRIMARY KEY (grupo, mes)
    );
  `);
  migrarPorMes(db);
}

// Migración idempotente (26/11/2026): lo cargado antes de «por mes» NO se pierde.
//  - cada cita toma el mes de SU fecha (columna `mes`); si un archivo traía varios meses, sus citas quedan repartidas
//    por su fecha (cada mes con su conteo en equidad_cargas_mes);
//  - cada base cargada se registra en los meses que trae, con el archivo, la fecha y quién la cargó.
// Se puede correr muchas veces: solo toca citas sin mes y meses sin registro. No borra nada (equidad_cargas queda).
function migrarPorMes(db) {
  const cols = new Set(db.prepare('PRAGMA table_info(equidad_citas)').all().map((c) => c.name));
  if (!cols.has('mes')) db.exec("ALTER TABLE equidad_citas ADD COLUMN mes TEXT NOT NULL DEFAULT ''");
  db.exec('CREATE INDEX IF NOT EXISTS idx_equidad_citas_grupo_mes ON equidad_citas (grupo, mes)');
  db.prepare("UPDATE equidad_citas SET mes = substr(fecha, 1, 7) WHERE mes = '' AND fecha GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]*'").run();
  const viejas = db.prepare('SELECT grupo, archivoNombre, hoja, cargadoEn, cargadoPor FROM equidad_cargas').all();
  if (!viejas.length) return;
  const porMes = db.prepare("SELECT mes, COUNT(*) n FROM equidad_citas WHERE grupo = ? AND mes <> '' GROUP BY mes");
  const ins = db.prepare('INSERT OR IGNORE INTO equidad_cargas_mes (grupo, mes, archivoNombre, hoja, filas, cargadoEn, cargadoPor) VALUES (?, ?, ?, ?, ?, ?, ?)');
  for (const c of viejas) for (const m of porMes.all(c.grupo)) ins.run(c.grupo, m.mes, c.archivoNombre, c.hoja, m.n, c.cargadoEn, c.cargadoPor);
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

// Carga UNA base en UN mes (pedido de Edwin, 26/11): reemplaza solo esa base en ese mes; los demás meses no se tocan.
// Todo o nada: si alguna cita no es de ese mes, no se carga nada y se dice de qué meses son.
// Devuelve { grupo, mes, filas, reemplazadas, otraBase }.
function cargar(db, grupo, cuerpo, actor) {
  asegurarTablas(db);
  if (!L.eqGrupo(grupo)) throw new EquidadError('Base desconocida');
  const mes = cuerpo && cuerpo.mes;
  if (!L.eqMesValido(mes)) throw new EquidadError('Elige el mes de la base (AAAA-MM)');
  let filas;
  try { filas = L.eqValidarFilas(cuerpo && cuerpo.filas, grupo); } catch (e) { throw new EquidadError(e.message); }
  const otrosMeses = Object.entries(L.eqMesesDe(filas)).filter(([m]) => m !== mes).sort();
  if (otrosMeses.length) {
    const n = otrosMeses.reduce((a, [, c]) => a + c, 0);
    throw new EquidadError(n + (n === 1 ? ' cita no es' : ' citas no son') + ' de ' + mes + ' (' + otrosMeses.map(([m, c]) => m + ': ' + c).join(', ') + '). No se cargó nada: revisa el archivo o el mes elegido.');
  }
  const archivoNombre = String((cuerpo && cuerpo.archivoNombre) || '').slice(0, 120);
  const hoja = String((cuerpo && cuerpo.hoja) || '').slice(0, 60);
  const ins = db.prepare('INSERT INTO equidad_citas (grupo, sede, especialidad, profesional, fecha, entidad, mes) VALUES (?, ?, ?, ?, ?, ?, ?)');
  let reemplazadas = 0;
  db.transaction(() => {
    reemplazadas = db.prepare('DELETE FROM equidad_citas WHERE grupo = ? AND mes = ?').run(grupo, mes).changes;
    filas.forEach((f) => ins.run(grupo, f.sede, f.esp, f.prof, f.fecha, f.ent, mes));
    db.prepare(`INSERT INTO equidad_cargas_mes (grupo, mes, archivoNombre, hoja, filas, cargadoEn, cargadoPor) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(grupo, mes) DO UPDATE SET archivoNombre = excluded.archivoNombre, hoja = excluded.hoja, filas = excluded.filas, cargadoEn = excluded.cargadoEn, cargadoPor = excluded.cargadoPor`)
      .run(grupo, mes, archivoNombre, hoja, filas.length, new Date().toISOString(), String(actor || '').slice(0, 80));
  })();
  const otras = L.eqEntidadesDeOtraBase(filas, grupo, mapaEntidades(db));
  return { grupo, mes, filas: filas.length, reemplazadas, otraBase: otras };
}

// Meses cargados de cada base: [{ mes, citas, archivo, cargadoEn, cargadoPor }] (el más nuevo primero).
function mesesCargados(db, grupo) {
  return db.prepare(`SELECT c.mes, COUNT(*) AS citas, m.archivoNombre AS archivo, m.cargadoEn, m.cargadoPor
    FROM equidad_citas c LEFT JOIN equidad_cargas_mes m ON m.grupo = c.grupo AND m.mes = c.mes
    WHERE c.grupo = ? AND c.mes <> '' GROUP BY c.mes ORDER BY c.mes DESC`).all(grupo)
    .map((r) => ({ mes: r.mes, citas: r.citas, archivo: r.archivo || '', cargadoEn: r.cargadoEn || '', cargadoPor: r.cargadoPor || '' }));
}

// Lo que pinta la pestaña: las 3 bases con sus filas (sede, especialidad, profesional, fecha, entidad).
function estado(db) {
  asegurarTablas(db);
  // 26/11: las citas salen de equidad_citas (todos los meses); el dashboard filtra por MESES. `meses` alimenta
  // el selector MESES del tablero.
  const sel = db.prepare('SELECT sede, especialidad AS esp, profesional AS prof, fecha, entidad AS ent FROM equidad_citas WHERE grupo = ? ORDER BY id');
  const todos = new Set();
  const grupos = L.EQ_GRUPOS.map((g) => {
    const meses = mesesCargados(db, g.id);
    meses.forEach((m) => todos.add(m.mes));
    const u = meses[0];
    return { id: g.id, nombre: g.nombre, conEntidad: g.conEntidad, archivo: u ? u.archivo : '', hoja: '', cargadoEn: u ? u.cargadoEn : '', meses: meses.map((m) => m.mes), filas: meses.length ? sel.all(g.id) : [] };
  });
  return { grupos, total: grupos.reduce((a, g) => a + g.filas.length, 0), meses: [...todos].sort() };
}

// Opción «la ve la cuenta cliente de ORLANT» (pregunta abierta a Edwin). APAGADA por defecto: sin fila = no.
// La enciende o apaga solo el administrador, desde «Cargar bases» (sin deploy).
function visibleParaCliente(db) {
  asegurarTablas(db);
  const r = db.prepare("SELECT valor FROM equidad_opciones WHERE clave = 'visibleCliente'").get();
  return !!r && r.valor === '1';
}
function cambiarVisibleParaCliente(db, valor, actor) {
  if (typeof valor !== 'boolean') throw new EquidadError('visibleCliente debe ser sí o no');
  asegurarTablas(db);
  db.prepare(`INSERT INTO equidad_opciones (clave, valor, cambiadoEn, cambiadoPor) VALUES ('visibleCliente', ?, ?, ?)
    ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, cambiadoEn = excluded.cambiadoEn, cambiadoPor = excluded.cambiadoPor`)
    .run(valor ? '1' : '0', new Date().toISOString(), String(actor || '').slice(0, 80));
  return visibleParaCliente(db);
}

// Resumen para el Centro de cargas (sin filas).
function resumen(db) {
  asegurarTablas(db);
  const prof = {};
  db.prepare('SELECT grupo, COUNT(*) citas, COUNT(DISTINCT profesional) n, MIN(fecha) desde, MAX(fecha) hasta FROM equidad_citas GROUP BY grupo').all().forEach((r) => { prof[r.grupo] = r; });
  return {
    grupos: L.EQ_GRUPOS.map((g) => {
      const p = prof[g.id] || {};
      const meses = mesesCargados(db, g.id);
      return { id: g.id, nombre: g.nombre, conEntidad: g.conEntidad, citas: p.citas || 0, profesionales: p.n || 0, desde: p.desde || '', hasta: p.hasta || '', meses };
    }),
    entidades: entidades(db),
    visibleCliente: visibleParaCliente(db),
  };
}

module.exports = { CAMPANA, EquidadError, asegurarTablas, cargar, estado, resumen, entidades, guardarEntidades, mapaEntidades, visibleParaCliente, cambiarVisibleParaCliente };
