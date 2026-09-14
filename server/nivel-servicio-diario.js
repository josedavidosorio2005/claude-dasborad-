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
        contestadas20sEstimado, llamadasAbandonadas, serviceLevel10secPct, serviceLevel30secPct,
        abandonPct, nivelAtencionPct, tasaAbandonoPct, asaSegundos, ataSegundos, ahtSegundos,
        waitTimeSegundos, archivoNombre, cargadoPorNombre, createdAt)
     VALUES (@campana,@fecha,@skillName,@totalLlamadas,@contestadas,@serviceLevel20secPct,
             @contestadas20sEstimado,@llamadasAbandonadas,@serviceLevel10secPct,@serviceLevel30secPct,
             @abandonPct,@nivelAtencionPct,@tasaAbandonoPct,@asaSegundos,@ataSegundos,@ahtSegundos,
             @waitTimeSegundos,@archivoNombre,@cargadoPorNombre,@createdAt)`
  );
  const updateDiario = db.prepare(
    `UPDATE calidad_nivel_servicio_diario SET
       totalLlamadas=@totalLlamadas, contestadas=@contestadas,
       serviceLevel20secPct=@serviceLevel20secPct, contestadas20sEstimado=@contestadas20sEstimado,
       llamadasAbandonadas=@llamadasAbandonadas, serviceLevel10secPct=@serviceLevel10secPct,
       serviceLevel30secPct=@serviceLevel30secPct, abandonPct=@abandonPct,
       nivelAtencionPct=@nivelAtencionPct, tasaAbandonoPct=@tasaAbandonoPct,
       asaSegundos=@asaSegundos, ataSegundos=@ataSegundos, ahtSegundos=@ahtSegundos,
       waitTimeSegundos=@waitTimeSegundos,
       archivoNombre=@archivoNombre, cargadoPorNombre=@cargadoPorNombre, createdAt=@createdAt
     WHERE id=@id`
  );

  // Campos opcionales del reporte de trafico (Volvox): si una fila no los
  // trae (el modo simple, pre-existente, solo manda fecha/skill/total/
  // contestadas/serviceLevel20secPct), quedan NULL — nunca 0, que es un
  // dato real y distinto de "no vino".
  const opcional = (v) => (v === undefined ? null : v);

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
        llamadasAbandonadas: opcional(f.llamadasAbandonadas),
        serviceLevel10secPct: opcional(f.serviceLevel10secPct),
        serviceLevel30secPct: opcional(f.serviceLevel30secPct),
        abandonPct: opcional(f.abandonPct),
        nivelAtencionPct: opcional(f.nivelAtencionPct),
        tasaAbandonoPct: opcional(f.tasaAbandonoPct),
        asaSegundos: opcional(f.asaSegundos),
        ataSegundos: opcional(f.ataSegundos),
        ahtSegundos: opcional(f.ahtSegundos),
        waitTimeSegundos: opcional(f.waitTimeSegundos),
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

  const mensualActualizados = [];
  for (const mes of mesesAfectados) {
    mensualActualizados.push(recalcularMensual(db, campana, mes, ts));
  }
  mensualActualizados.sort((a, b) => a.mes.localeCompare(b.mes));

  return {
    diario: { insertadas: filas.length, ids: idsDiario },
    mensual: mensualActualizados,
  };
}

// Recalcula el agregado mensual de UNA (campana, mes) a partir de TODAS las
// filas diarias que existan hoy para esa campana/mes en
// calidad_nivel_servicio_diario. Es el nucleo que reutilizan tanto
// cargarNivelServicioDiario (arriba, para los meses que toco esta carga)
// como server/trafico-skills.js (para recalcular una campana VIEJA y una
// NUEVA cuando se remapea una skill sin volver a subir el archivo) — una
// sola forma de sumarlo, nunca dos. Devuelve la fila cruda de
// calidad_nivel_servicio (o null si esa campana/mes ya no tiene filas y
// nunca existio un agregado previo).
function recalcularMensual(db, campana, mes, now) {
  const ts = now || nowStr();
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
  const existingMes = db.prepare('SELECT * FROM calidad_nivel_servicio WHERE campana = ? AND mes = ?').get(campana, mes);
  if (existingMes) {
    db.prepare('UPDATE calidad_nivel_servicio SET contestadas20s=?, llamadasTotales=?, updatedAt=? WHERE id=?').run(
      contestadas20sMes,
      llamadasTotalesMes,
      ts,
      existingMes.id
    );
  } else if (filasMes.length) {
    db.prepare(
      `INSERT INTO calidad_nivel_servicio (campana, mes, contestadas20s, llamadasTotales, createdAt, updatedAt)
       VALUES (?,?,?,?,?,?)`
    ).run(campana, mes, contestadas20sMes, llamadasTotalesMes, ts, ts);
  } else {
    return null; // nada que recalcular ni antes ni ahora
  }
  return db.prepare('SELECT * FROM calidad_nivel_servicio WHERE campana = ? AND mes = ?').get(campana, mes);
}

module.exports = { cargarNivelServicioDiario, recalcularMensual };
