// nivel-servicio-diario.js — Logica de escritura compartida para la carga
// diaria de Nivel de Servicio (conmutador). Unica fuente de verdad: la usan
// POST /api/calidad/nivel-servicio/carga-diaria (server.js) y
// scripts/seed-demo.js, asi que hay una sola manera de upsertear filas
// diarias y recalcular el agregado mensual, nunca dos.
'use strict';

function nowStr() {
  const d = new Date();
  const pad = (n) => (n < 10 ? '0' + n : '' + n);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// Upsertea las filas diarias de (campana, fecha, skillName) y recalcula el
// agregado mensual de calidad_nivel_servicio para cada mes afectado, a partir
// de TODAS las filas diarias de ese mes (no solo las de esta llamada).
// Devuelve { diario: { insertadas }, mensual: [ {id,campana,mes,contestadas20s,llamadasTotales,createdAt,updatedAt}, ... ] }
// (filas crudas de calidad_nivel_servicio, sin el pct/cumple derivado — eso lo
// agrega el caller con calidad-logic si lo necesita, igual que toNivelServicioRow).
function cargarNivelServicioDiario(db, { campana, archivoNombre, cargadoPorNombre, filas, now }) {
  const ts = now || nowStr();

  const selectDiario = db.prepare(
    'SELECT id FROM calidad_nivel_servicio_diario WHERE campana = ? AND fecha = ? AND skillName = ?'
  );
  const insertDiario = db.prepare(
    `INSERT INTO calidad_nivel_servicio_diario
       (campana, fecha, skillName, totalLlamadas, contestadas, serviceLevel20secPct,
        contestadas20sEstimado, archivoNombre, cargadoPorNombre, createdAt)
     VALUES (@campana,@fecha,@skillName,@totalLlamadas,@contestadas,@serviceLevel20secPct,
             @contestadas20sEstimado,@archivoNombre,@cargadoPorNombre,@createdAt)`
  );
  const updateDiario = db.prepare(
    `UPDATE calidad_nivel_servicio_diario SET
       totalLlamadas=@totalLlamadas, contestadas=@contestadas,
       serviceLevel20secPct=@serviceLevel20secPct, contestadas20sEstimado=@contestadas20sEstimado,
       archivoNombre=@archivoNombre, cargadoPorNombre=@cargadoPorNombre, createdAt=@createdAt
     WHERE id=@id`
  );

  const mesesAfectados = new Set();
  const idsDiario = [];
  const tx = db.transaction((rows) => {
    for (const f of rows) {
      const pct = f.serviceLevel20secPct === undefined ? null : f.serviceLevel20secPct;
      const estimado = pct === null ? null : Math.round((pct / 100) * f.totalLlamadas);
      const params = {
        campana,
        fecha: f.fecha,
        skillName: f.skillName,
        totalLlamadas: f.totalLlamadas,
        contestadas: f.contestadas,
        serviceLevel20secPct: pct,
        contestadas20sEstimado: estimado,
        archivoNombre: archivoNombre || '',
        cargadoPorNombre: cargadoPorNombre || '-',
        createdAt: ts,
      };
      const existing = selectDiario.get(campana, f.fecha, f.skillName);
      if (existing) {
        updateDiario.run({ ...params, id: existing.id });
        idsDiario.push(existing.id);
      } else {
        const info = insertDiario.run(params);
        idsDiario.push(info.lastInsertRowid);
      }
      mesesAfectados.add(f.fecha.slice(0, 7));
    }
  });
  tx(filas);

  const selectMensual = db.prepare('SELECT * FROM calidad_nivel_servicio WHERE campana = ? AND mes = ?');
  const insertMensual = db.prepare(
    `INSERT INTO calidad_nivel_servicio (campana, mes, contestadas20s, llamadasTotales, createdAt, updatedAt)
     VALUES (?,?,?,?,?,?)`
  );
  const updateMensual = db.prepare(
    'UPDATE calidad_nivel_servicio SET contestadas20s=?, llamadasTotales=?, updatedAt=? WHERE id=?'
  );
  const mensualActualizados = [];
  for (const mes of mesesAfectados) {
    const filasMes = db
      .prepare(
        'SELECT totalLlamadas, contestadas20sEstimado FROM calidad_nivel_servicio_diario WHERE campana = ? AND substr(fecha,1,7) = ?'
      )
      .all(campana, mes);
    const llamadasTotalesMes = filasMes.reduce((a, r) => a + (r.totalLlamadas || 0), 0);
    const contestadas20sMes = filasMes.reduce(
      (a, r) => a + (r.contestadas20sEstimado === null || r.contestadas20sEstimado === undefined ? 0 : r.contestadas20sEstimado),
      0
    );
    const existingMes = selectMensual.get(campana, mes);
    if (existingMes) {
      updateMensual.run(contestadas20sMes, llamadasTotalesMes, ts, existingMes.id);
    } else {
      insertMensual.run(campana, mes, contestadas20sMes, llamadasTotalesMes, ts, ts);
    }
    mensualActualizados.push(selectMensual.get(campana, mes));
  }
  mensualActualizados.sort((a, b) => a.mes.localeCompare(b.mes));

  return {
    diario: { insertadas: filas.length, ids: idsDiario },
    mensual: mensualActualizados,
  };
}

module.exports = { cargarNivelServicioDiario };
