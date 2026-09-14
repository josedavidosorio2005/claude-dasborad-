// trafico-skills.js — Mapeo SKILL_NAME (Volvox) -> campana/cliente
// (InConexion), y la carga de trafico que lo usa.
//
// Los nombres de skill los define Volvox, no nosotros, y van a cambiar. Este
// mapeo se administra desde el panel (nunca a mano en el codigo, ver
// GET/PUT /api/calidad/trafico/skills). Una skill que aparece por primera
// vez en una carga se registra automaticamente con campana=NULL ("todavia
// sin asignar") y sus filas quedan bajo la campana centinela SIN_ASIGNAR —
// nunca rompe la carga ni se pierde, solo espera a que el admin la mapee.
'use strict';

const { cargarNivelServicioDiario, recalcularMensual } = require('./nivel-servicio-diario');

const SIN_ASIGNAR = '(SIN ASIGNAR)';

function nowIso() {
  return new Date().toISOString();
}

// Asegura una fila en trafico_skill_mapeo por cada skill vista (si no
// existe, la crea con campana=NULL) y devuelve skillName -> campana
// resuelta (el mapeo real, o SIN_ASIGNAR si aun no esta mapeada).
function resolverCampanasPorSkill(db, skillNames) {
  const selectStmt = db.prepare('SELECT campana FROM trafico_skill_mapeo WHERE skillName = ?');
  const insertStmt = db.prepare(
    'INSERT INTO trafico_skill_mapeo (skillName, campana, createdAt, updatedAt) VALUES (?, NULL, ?, ?)'
  );
  const resultado = new Map();
  const ts = nowIso();
  for (const skillName of skillNames) {
    const row = selectStmt.get(skillName);
    if (!row) {
      insertStmt.run(skillName, ts, ts);
      resultado.set(skillName, SIN_ASIGNAR);
    } else {
      resultado.set(skillName, row.campana || SIN_ASIGNAR);
    }
  }
  return resultado;
}

// Sube filas de trafico ya parseadas (sin campana): resuelve la campana de
// cada una por su skill y reutiliza cargarNivelServicioDiario (un upsert por
// campana resuelta) — la MISMA logica de upsert + recalculo mensual que usa
// la carga diaria clasica, nunca una segunda forma de sumarlo.
function cargarTrafico(db, { archivoNombre, cargadoPorNombre, filas }) {
  const skillNames = [...new Set(filas.map((f) => f.skillName))];
  const campanaPorSkill = resolverCampanasPorSkill(db, skillNames);

  const porCampana = new Map();
  for (const f of filas) {
    const campana = campanaPorSkill.get(f.skillName);
    if (!porCampana.has(campana)) porCampana.set(campana, []);
    porCampana.get(campana).push(f);
  }

  let insertadas = 0;
  const resultadosPorCampana = [];
  for (const [campana, filasCampana] of porCampana) {
    const r = cargarNivelServicioDiario(db, { campana, archivoNombre, cargadoPorNombre, filas: filasCampana });
    insertadas += r.diario.insertadas;
    resultadosPorCampana.push({ campana, filas: r.diario.insertadas, meses: r.mensual.map((m) => m.mes) });
  }

  const skillsSinAsignar = skillNames.filter((s) => campanaPorSkill.get(s) === SIN_ASIGNAR);
  return { insertadas, campanas: [...porCampana.keys()], skillsSinAsignar, porCampana: resultadosPorCampana };
}

// Skills conocidas para el panel de mapeo del admin, con cuantas filas de
// trafico tiene cada una guardadas hoy. Las sin mapear (campana IS NULL)
// primero, para que el admin las vea de una.
function listarSkills(db) {
  return db
    .prepare(
      `SELECT m.skillName, m.campana, m.createdAt, m.updatedAt,
              (SELECT COUNT(*) FROM calidad_nivel_servicio_diario d WHERE d.skillName = m.skillName) AS filas
       FROM trafico_skill_mapeo m
       ORDER BY (m.campana IS NULL) DESC, m.skillName`
    )
    .all();
}

// Cambia el mapeo de una skill y RE-ATRIBUYE su data ya guardada (no hace
// falta volver a subir el archivo): mueve sus filas de
// calidad_nivel_servicio_diario de la campana anterior a la nueva, y
// recalcula el agregado mensual de AMBAS campanas (la vieja pierde esas
// llamadas del total, la nueva las gana) para cada mes afectado.
function remapearSkill(db, { skillName, campana }) {
  const ts = nowIso();
  const existing = db.prepare('SELECT 1 FROM trafico_skill_mapeo WHERE skillName = ?').get(skillName);
  if (existing) {
    db.prepare('UPDATE trafico_skill_mapeo SET campana = ?, updatedAt = ? WHERE skillName = ?').run(campana, ts, skillName);
  } else {
    db.prepare('INSERT INTO trafico_skill_mapeo (skillName, campana, createdAt, updatedAt) VALUES (?,?,?,?)').run(
      skillName,
      campana,
      ts,
      ts
    );
  }

  const nuevaCampana = campana || SIN_ASIGNAR;
  const filasAfectadas = db
    .prepare(
      'SELECT DISTINCT campana, substr(fecha,1,7) AS mes FROM calidad_nivel_servicio_diario WHERE skillName = ? AND campana != ?'
    )
    .all(skillName, nuevaCampana);
  if (!filasAfectadas.length) return { movidas: 0, mesesRecalculados: [] };

  const info = db
    .prepare('UPDATE calidad_nivel_servicio_diario SET campana = ? WHERE skillName = ? AND campana != ?')
    .run(nuevaCampana, skillName, nuevaCampana);

  const mesesPorCampanaVieja = new Map();
  const todosMeses = new Set();
  filasAfectadas.forEach((r) => {
    if (!mesesPorCampanaVieja.has(r.campana)) mesesPorCampanaVieja.set(r.campana, new Set());
    mesesPorCampanaVieja.get(r.campana).add(r.mes);
    todosMeses.add(r.mes);
  });

  const mesesRecalculados = [];
  for (const [camp, meses] of mesesPorCampanaVieja) {
    for (const mes of meses) {
      recalcularMensual(db, camp, mes, ts);
      mesesRecalculados.push({ campana: camp, mes });
    }
  }
  for (const mes of todosMeses) {
    recalcularMensual(db, nuevaCampana, mes, ts);
    mesesRecalculados.push({ campana: nuevaCampana, mes });
  }

  return { movidas: info.changes, mesesRecalculados };
}

module.exports = { SIN_ASIGNAR, resolverCampanasPorSkill, cargarTrafico, listarSkills, remapearSkill };
