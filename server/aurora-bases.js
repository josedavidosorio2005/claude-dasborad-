// aurora-bases.js — Fase 306 (10/11/2026, Clinica Aurora): dos bases nuevas de
// la clinica, cada una con su pestaña:
//   - inasistencia: «BASE PARA SACAR INASISTENCIAS» -> por mes y especialidad,
//     cuantas citas hay (total de filas) y cuantas «No asistió».
//   - encuestas:    «COMPILADO ENCUESTAS» -> por fecha y entidad, cuantas encuestas.
// Igual que Agendas: el navegador lee el archivo y manda SOLO conteos (nunca
// nombres, cedulas, telefonos ni observaciones). Una carga reemplaza los meses
// que trae, con respaldo para Deshacer (cargas-versiones).
'use strict';
const { respaldarAntesDeCambiar } = require('./cargas-versiones');

const TIPOS = {
  inasistencia: {
    tabla: 'aurora_inasistencia',
    columnas: ['mes', 'especialidad', 'total', 'noAsistio'],
    suma: 'total',
  },
  encuestas: {
    tabla: 'aurora_encuestas',
    columnas: ['mes', 'fecha', 'entidad', 'n'],
    suma: 'n',
  },
  // Fase 311: «Gestión líneas internas» (Wolkvox interno de la clinica), aparte de
  // las bases de siempre. Solo conteos: nada de telefonos, cedulas ni comentarios.
  flujo_li: {
    tabla: 'aurora_li_flujo',
    columnas: ['mes', 'fecha', 'skill', 'total', 'contestadas', 'abandonadas', 'nivelServicio'],
    suma: 'total',
  },
  cdr_li: {
    tabla: 'aurora_li_cdr',
    columnas: ['mes', 'agente', 'skill', 'tipo', 'tipificacion', 'n'],
    suma: 'n',
  },
  whatsapp_li: {
    tabla: 'aurora_li_whatsapp',
    columnas: ['mes', 'agente', 'skill', 'tipo', 'tipificacion', 'n'],
    suma: 'n',
  },
};

// Fase 311: tablas de «Gestión líneas internas» (migracion propia).
function crearTablasLineasInternas(db) {
  const tipif = (t) => `
    CREATE TABLE IF NOT EXISTS ${t} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campana TEXT NOT NULL,
      mes TEXT NOT NULL,
      agente TEXT NOT NULL,
      skill TEXT NOT NULL,
      tipo TEXT NOT NULL,
      tipificacion TEXT NOT NULL,
      n INTEGER NOT NULL,
      archivoNombre TEXT,
      cargadoPorNombre TEXT,
      createdAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_${t}_campana_mes ON ${t}(campana, mes);`;
  db.exec(`
    CREATE TABLE IF NOT EXISTS aurora_li_flujo (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campana TEXT NOT NULL,
      mes TEXT NOT NULL,
      fecha TEXT NOT NULL,
      skill TEXT NOT NULL,
      total INTEGER NOT NULL,
      contestadas INTEGER NOT NULL,
      abandonadas INTEGER NOT NULL,
      nivelServicio REAL,
      archivoNombre TEXT,
      cargadoPorNombre TEXT,
      createdAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_aurora_li_flujo_campana_mes ON aurora_li_flujo(campana, mes);
    ${tipif('aurora_li_cdr')}
    ${tipif('aurora_li_whatsapp')}
  `);
}

function crearTablas(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS aurora_inasistencia (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campana TEXT NOT NULL,
      mes TEXT NOT NULL,
      especialidad TEXT NOT NULL,
      total INTEGER NOT NULL,
      noAsistio INTEGER NOT NULL,
      archivoNombre TEXT,
      cargadoPorNombre TEXT,
      createdAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_aurora_inasistencia_campana_mes ON aurora_inasistencia(campana, mes);
    CREATE TABLE IF NOT EXISTS aurora_encuestas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      campana TEXT NOT NULL,
      mes TEXT NOT NULL,
      fecha TEXT NOT NULL,
      entidad TEXT NOT NULL,
      n INTEGER NOT NULL,
      archivoNombre TEXT,
      cargadoPorNombre TEXT,
      createdAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_aurora_encuestas_campana_mes ON aurora_encuestas(campana, mes);
  `);
}

function nowStr() {
  const d = new Date();
  const p = (n) => (n < 10 ? '0' + n : '' + n);
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
const mesesDe = (filas) => [...new Set(filas.map((f) => f.mes))].sort();

function impacto(db, tipo, { campana, filas }) {
  const t = TIPOS[tipo];
  return {
    meses: mesesDe(filas).map((mes) => ({
      mes,
      existentes: db.prepare(`SELECT COALESCE(SUM(${t.suma}), 0) AS n FROM ${t.tabla} WHERE campana = ? AND mes = ?`).get(campana, mes).n,
      nuevas: filas.filter((f) => f.mes === mes).reduce((s, f) => s + f[t.suma], 0),
    })),
  };
}

function cargar(db, tipo, { campana, archivoNombre, cargadoPorNombre, filas }) {
  const t = TIPOS[tipo];
  const meses = mesesDe(filas);
  const cols = t.columnas.concat(['campana', 'archivoNombre', 'cargadoPorNombre', 'createdAt']);
  const ins = db.prepare(`INSERT INTO ${t.tabla} (${cols.join(', ')}) VALUES (${cols.map((c) => '@' + c).join(', ')})`);
  const del = db.prepare(`DELETE FROM ${t.tabla} WHERE campana = ? AND mes = ?`);
  const ts = nowStr();
  let borradas = 0;
  db.transaction(() => {
    respaldarAntesDeCambiar(db, t.tabla, { campana, meses, guardadoPorNombre: cargadoPorNombre });
    for (const mes of meses) borradas += del.run(campana, mes).changes;
    for (const f of filas) {
      const r = { campana, archivoNombre: archivoNombre || '', cargadoPorNombre: cargadoPorNombre || '-', createdAt: ts };
      t.columnas.forEach((c) => { r[c] = f[c]; });
      ins.run(r);
    }
  })();
  return { meses, insertadas: filas.length, borradas, total: filas.reduce((s, f) => s + f[t.suma], 0) };
}

function opciones(db, tipo, campana) {
  return { meses: db.prepare(`SELECT DISTINCT mes AS v FROM ${TIPOS[tipo].tabla} WHERE campana = ? ORDER BY v`).all(campana).map((r) => r.v) };
}

function datos(db, tipo, campana) {
  const t = TIPOS[tipo];
  return { filas: db.prepare(`SELECT ${t.columnas.join(', ')} FROM ${t.tabla} WHERE campana = ? ORDER BY mes`).all(campana) };
}

module.exports = { TIPOS, crearTablas, crearTablasLineasInternas, impacto, cargar, opciones, datos };
