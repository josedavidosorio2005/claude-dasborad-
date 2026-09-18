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
const { recalcularResumenOrlantDesdeTrafico } = require('./resumen-orlant-trafico');

const SIN_ASIGNAR = '(SIN ASIGNAR)';

function nowIso() {
  return new Date().toISOString();
}

// Asegura una fila en trafico_skill_mapeo por cada skill vista (si no
// existe, la crea con campana=NULL) y devuelve skillName -> {campana, sede}
// resuelto (el mapeo real, o campana=SIN_ASIGNAR si aun no esta mapeada).
// `sede` es NULL para toda campana de una sola sede (la inmensa mayoria) y
// solo tiene valor para campanas multi-sede (ej. HOSPITAL LA MARIA:
// 'CASTILLA'/'SEDE33', los mismos codigos que dashboards_config.vista usa
// para esa misma campana — ver docs/ARQUITECTURA.md).
function resolverCampanasPorSkill(db, skillNames) {
  const selectStmt = db.prepare('SELECT campana, sede FROM trafico_skill_mapeo WHERE skillName = ?');
  const insertStmt = db.prepare(
    'INSERT INTO trafico_skill_mapeo (skillName, campana, sede, createdAt, updatedAt) VALUES (?, NULL, NULL, ?, ?)'
  );
  const resultado = new Map();
  const ts = nowIso();
  for (const skillName of skillNames) {
    const row = selectStmt.get(skillName);
    if (!row) {
      insertStmt.run(skillName, ts, ts);
      resultado.set(skillName, { campana: SIN_ASIGNAR, sede: null });
    } else {
      resultado.set(skillName, { campana: row.campana || SIN_ASIGNAR, sede: row.campana ? row.sede || null : null });
    }
  }
  return resultado;
}

// Sube filas de trafico ya parseadas (sin campana): resuelve la campana (y
// sede, si aplica) de cada una por su skill y reutiliza
// cargarNivelServicioDiario (un upsert por combinacion campana+sede
// resuelta) — la MISMA logica de upsert + recalculo mensual que usa la
// carga diaria clasica, nunca una segunda forma de sumarlo. Point 10 (nunca
// confiar en una fila TOTAL): ya lo filtra traficoParseFilas antes de que
// esta funcion vea las filas (public/js/trafico-logic.js), asi que aqui
// todas las filas que llegan ya pasaron esa validacion.
function cargarTrafico(db, { archivoNombre, cargadoPorNombre, filas }) {
  const skillNames = [...new Set(filas.map((f) => f.skillName))];
  const resueltoPorSkill = resolverCampanasPorSkill(db, skillNames);

  const porCampanaSede = new Map(); // clave "campana sede" -> filas
  for (const f of filas) {
    const { campana, sede } = resueltoPorSkill.get(f.skillName);
    const clave = campana + ' ' + (sede || '');
    if (!porCampanaSede.has(clave)) porCampanaSede.set(clave, { campana, sede, filas: [] });
    porCampanaSede.get(clave).filas.push(f);
  }

  let insertadas = 0;
  const campanasVistas = new Set();
  const resultadosPorCampana = [];
  for (const { campana, sede, filas: filasCampana } of porCampanaSede.values()) {
    const r = cargarNivelServicioDiario(db, { campana, sede, archivoNombre, cargadoPorNombre, filas: filasCampana });
    insertadas += r.diario.insertadas;
    campanasVistas.add(campana);
    resultadosPorCampana.push({ campana, sede, filas: r.diario.insertadas, meses: r.mensual.map((m) => m.mes) });
  }

  // Fase 39: cada carga de Trafico para ORLANT recalcula tambien
  // llamadas_3p/nivel_atencion_3p/llamadas_general/nivel_atencion_general en
  // el resumen mensual (dashboard_cargas) -- mismo lugar/momento donde ya se
  // recalcula el mensual de calidad_nivel_servicio arriba, para los meses
  // que esta carga realmente toco.
  const resumenActualizado = [];
  for (const { campana, meses } of resultadosPorCampana) {
    if (campana !== 'ORLANT') continue;
    for (const mes of meses) {
      resumenActualizado.push({ mes, ...recalcularResumenOrlantDesdeTrafico(db, mes) });
    }
  }

  const skillsSinAsignar = skillNames.filter((s) => resueltoPorSkill.get(s).campana === SIN_ASIGNAR);
  return { insertadas, campanas: [...campanasVistas], skillsSinAsignar, porCampana: resultadosPorCampana, resumenActualizado };
}

// Skills conocidas para el panel de mapeo del admin, con cuantas filas de
// trafico tiene cada una guardadas hoy. Las sin mapear (campana IS NULL)
// primero, para que el admin las vea de una.
function listarSkills(db) {
  return db
    .prepare(
      `SELECT m.skillName, m.campana, m.sede, m.createdAt, m.updatedAt,
              (SELECT COUNT(*) FROM calidad_nivel_servicio_diario d WHERE d.skillName = m.skillName) AS filas
       FROM trafico_skill_mapeo m
       ORDER BY (m.campana IS NULL) DESC, m.skillName`
    )
    .all();
}

// Cambia el mapeo de una skill (campana + sede opcional) y RE-ATRIBUYE su
// data ya guardada (no hace falta volver a subir el archivo): mueve sus
// filas de calidad_nivel_servicio_diario a la combinacion campana+sede
// nueva, y recalcula el agregado mensual de AMBAS combinaciones (la vieja
// pierde esas llamadas del total, la nueva las gana) para cada mes
// afectado. `sede` se ignora (queda NULL) si `campana` no es una campana
// multi-sede — lo decide el caller (server.js), que ya conoce el catalogo.
function remapearSkill(db, { skillName, campana, sede }) {
  const ts = nowIso();
  sede = campana ? sede || null : null;
  const existing = db.prepare('SELECT 1 FROM trafico_skill_mapeo WHERE skillName = ?').get(skillName);
  if (existing) {
    db.prepare('UPDATE trafico_skill_mapeo SET campana = ?, sede = ?, updatedAt = ? WHERE skillName = ?').run(campana, sede, ts, skillName);
  } else {
    db.prepare('INSERT INTO trafico_skill_mapeo (skillName, campana, sede, createdAt, updatedAt) VALUES (?,?,?,?,?)').run(
      skillName,
      campana,
      sede,
      ts,
      ts
    );
  }

  const nuevaCampana = campana || SIN_ASIGNAR;
  const filasAfectadas = db
    .prepare(
      `SELECT DISTINCT campana, sede, substr(fecha,1,7) AS mes FROM calidad_nivel_servicio_diario
       WHERE skillName = ? AND (campana != ? OR sede IS NOT ?)`
    )
    .all(skillName, nuevaCampana, sede);
  if (!filasAfectadas.length) return { movidas: 0, mesesRecalculados: [] };

  const info = db
    .prepare('UPDATE calidad_nivel_servicio_diario SET campana = ?, sede = ? WHERE skillName = ? AND (campana != ? OR sede IS NOT ?)')
    .run(nuevaCampana, sede, skillName, nuevaCampana, sede);

  const mesesPorCombinacionVieja = new Map(); // "campana sede" -> Set(meses)
  const todosMeses = new Set();
  filasAfectadas.forEach((r) => {
    const clave = r.campana + ' ' + (r.sede || '');
    if (!mesesPorCombinacionVieja.has(clave)) mesesPorCombinacionVieja.set(clave, { campana: r.campana, sede: r.sede, meses: new Set() });
    mesesPorCombinacionVieja.get(clave).meses.add(r.mes);
    todosMeses.add(r.mes);
  });

  const mesesRecalculados = [];
  for (const { campana: camp, sede: sd, meses } of mesesPorCombinacionVieja.values()) {
    for (const mes of meses) {
      recalcularMensual(db, camp, mes, ts, sd);
      mesesRecalculados.push({ campana: camp, sede: sd, mes });
    }
  }
  for (const mes of todosMeses) {
    recalcularMensual(db, nuevaCampana, mes, ts, sede);
    mesesRecalculados.push({ campana: nuevaCampana, sede, mes });
  }

  // Fase 39: remapear una skill de/hacia ORLANT (ej. de "(SIN ASIGNAR)" a
  // ORLANT tras subir un archivo con una skill nueva, el caso real de la
  // Fase 36) cambia que filas cuentan como trafico de ORLANT ese mes -- hay
  // que recalcular el resumen igual que en una carga nueva, o quedaria
  // desactualizado hasta la proxima carga de Trafico.
  const mesesOrlant = new Set(mesesRecalculados.filter((m) => m.campana === 'ORLANT').map((m) => m.mes));
  mesesOrlant.forEach((mes) => recalcularResumenOrlantDesdeTrafico(db, mes, ts));

  return { movidas: info.changes, mesesRecalculados };
}

module.exports = { SIN_ASIGNAR, resolverCampanasPorSkill, cargarTrafico, listarSkills, remapearSkill };
