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
// `sede` es opcional (solo lo usan campanas con mas de una sede, ej.
// HOSPITAL LA MARIA — ver docs/ARQUITECTURA.md): se guarda como atributo de
// cada fila diaria y se propaga al agregado mensual, que se recalcula
// SIEMPRE filtrando tambien por sede — nunca sumando 2 sedes de la misma
// campana en un mismo agregado (ver recalcularMensual mas abajo).
// Devuelve { diario: { insertadas }, mensual: [ {id,campana,mes,sede,contestadas20s,llamadasTotales,createdAt,updatedAt}, ... ] }
// (filas crudas de calidad_nivel_servicio, sin el pct/cumple derivado — eso lo
// agrega el caller con calidad-logic si lo necesita, igual que toNivelServicioRow).
function cargarNivelServicioDiario(db, { campana, sede, archivoNombre, cargadoPorNombre, filas, now }) {
  const ts = now || nowStr();
  sede = sede || null;

  const selectDiario = db.prepare(
    'SELECT id FROM calidad_nivel_servicio_diario WHERE campana = ? AND fecha = ? AND skillName = ?'
  );
  const insertDiario = db.prepare(
    `INSERT INTO calidad_nivel_servicio_diario
       (campana, fecha, skillName, sede, totalLlamadas, contestadas, serviceLevel20secPct,
        contestadas20sEstimado, llamadasAbandonadas, serviceLevel10secPct, serviceLevel30secPct,
        abandonPct, nivelAtencionPct, tasaAbandonoPct, asaSegundos, ataSegundos, ahtSegundos,
        waitTimeSegundos, archivoNombre, cargadoPorNombre, createdAt)
     VALUES (@campana,@fecha,@skillName,@sede,@totalLlamadas,@contestadas,@serviceLevel20secPct,
             @contestadas20sEstimado,@llamadasAbandonadas,@serviceLevel10secPct,@serviceLevel30secPct,
             @abandonPct,@nivelAtencionPct,@tasaAbandonoPct,@asaSegundos,@ataSegundos,@ahtSegundos,
             @waitTimeSegundos,@archivoNombre,@cargadoPorNombre,@createdAt)`
  );
  const updateDiario = db.prepare(
    `UPDATE calidad_nivel_servicio_diario SET
       sede=@sede, totalLlamadas=@totalLlamadas, contestadas=@contestadas,
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

  // Fase 115: una carga reemplaza TODO el rango de fechas que trae, por
  // skill — no solo los dias presentes en el archivo (mismo criterio que ya
  // usan Agendas/Inasistencia, que reemplazan por rango/mes completo).
  // Hallazgo real: un residuo de una prueba vieja (Fase 67) sobrevivio sin
  // detectarse hasta la Fase 115 porque el upsert de siempre solo tocaba
  // las fechas presentes en cada archivo nuevo, nunca borraba una fecha que
  // dejara de venir.
  //
  // Fase 116 (hallazgo real, archivo de WhatsApp ago-sep/2026 -- mismo
  // defecto de fondo tambien presente aqui en voz, aunque ningun archivo
  // real lo haya expuesto todavia): el rango NO puede ser [primera..ultima
  // fecha] de ESA skill dentro de ESTE archivo -- si la skill no tiene
  // actividad (0 llamadas/mensajes, Wolkvox no genera fila) en los primeros
  // dias que el archivo SI cubre para OTRAS skills, el rango de esa skill
  // arranca mas tarde y una fila vieja anterior a su propio primer dia
  // sobrevive sin detectarse (igual que el residuo de la Fase 67, solo que
  // ahora el "hueco" es real, no un dato de prueba). El rango correcto es
  // el GLOBAL del archivo completo (primera..ultima fecha de CUALQUIER
  // fila, sin importar la skill) -- unico que de verdad representa "el
  // periodo que este archivo dice cubrir". Una skill que no aparece en el
  // archivo sigue sin tocarse en absoluto (el `for` de abajo solo recorre
  // las skills presentes); una skill presente nunca pierde una fecha fuera
  // del rango GLOBAL del archivo (ej. un archivo de julio nunca toca junio).
  const fechasPorSkill = new Map(); // skillName -> Set(fechas) de ESTA carga
  let minFechaGlobal = null, maxFechaGlobal = null;
  filas.forEach((f) => {
    if (!fechasPorSkill.has(f.skillName)) fechasPorSkill.set(f.skillName, new Set());
    fechasPorSkill.get(f.skillName).add(f.fecha);
    if (minFechaGlobal === null || f.fecha < minFechaGlobal) minFechaGlobal = f.fecha;
    if (maxFechaGlobal === null || f.fecha > maxFechaGlobal) maxFechaGlobal = f.fecha;
  });
  const selectEnRango = db.prepare(
    'SELECT id, fecha FROM calidad_nivel_servicio_diario WHERE campana = ? AND skillName = ? AND sede IS ? AND fecha BETWEEN ? AND ?'
  );

  const mesesAfectados = new Set();
  const idsDiario = [];
  const idsBorrados = [];
  const tx = db.transaction((rows) => {
    for (const [skillName, fechas] of fechasPorSkill) {
      const aBorrar = selectEnRango.all(campana, skillName, sede, minFechaGlobal, maxFechaGlobal).filter((r) => !fechas.has(r.fecha));
      if (aBorrar.length) {
        const placeholders = aBorrar.map(() => '?').join(',');
        db.prepare(`DELETE FROM calidad_nivel_servicio_diario WHERE id IN (${placeholders})`).run(...aBorrar.map((r) => r.id));
        aBorrar.forEach((r) => {
          idsBorrados.push(r.id);
          mesesAfectados.add(r.fecha.slice(0, 7));
        });
      }
    }

    for (const f of rows) {
      const pct = f.serviceLevel20secPct === undefined ? null : f.serviceLevel20secPct;
      const estimado = pct === null ? null : Math.round((pct / 100) * f.totalLlamadas);
      const params = {
        campana,
        fecha: f.fecha,
        skillName: f.skillName,
        sede,
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
    mensualActualizados.push(recalcularMensual(db, campana, mes, ts, sede));
  }
  mensualActualizados.sort((a, b) => a.mes.localeCompare(b.mes));

  return {
    diario: { insertadas: filas.length, ids: idsDiario, borradas: idsBorrados.length, idsBorrados },
    mensual: mensualActualizados,
  };
}

// Recalcula el agregado mensual de UNA (campana, mes, sede) a partir de
// TODAS las filas diarias que existan hoy para esa combinacion en
// calidad_nivel_servicio_diario. Es el nucleo que reutilizan tanto
// cargarNivelServicioDiario (arriba, para los meses que toco esta carga)
// como server/trafico-skills.js (para recalcular una campana/sede VIEJA y
// una NUEVA cuando se remapea una skill sin volver a subir el archivo) — una
// sola forma de sumarlo, nunca dos. `sede` es NULL para toda campana sin
// sedes (la inmensa mayoria); CRITICO: siempre se filtra tambien por sede
// (IS NULL o el valor exacto) para que 2 sedes de una misma campana (ej.
// HOSPITAL LA MARIA) nunca se sumen en un mismo agregado mensual ni se
// pisen entre si. Devuelve la fila cruda de calidad_nivel_servicio (o null
// si esa combinacion ya no tiene filas y nunca existio un agregado previo).
function recalcularMensual(db, campana, mes, now, sede) {
  const ts = now || nowStr();
  sede = sede || null;
  const filasMes = db
    .prepare(
      'SELECT totalLlamadas, contestadas20sEstimado FROM calidad_nivel_servicio_diario WHERE campana = ? AND substr(fecha,1,7) = ? AND sede IS ?'
    )
    .all(campana, mes, sede);
  const llamadasTotalesMes = filasMes.reduce((a, r) => a + (r.totalLlamadas || 0), 0);
  const contestadas20sMes = filasMes.reduce(
    (a, r) => a + (r.contestadas20sEstimado === null || r.contestadas20sEstimado === undefined ? 0 : r.contestadas20sEstimado),
    0
  );
  const existingMes = db
    .prepare('SELECT * FROM calidad_nivel_servicio WHERE campana = ? AND mes = ? AND sede IS ?')
    .get(campana, mes, sede);
  if (existingMes) {
    db.prepare('UPDATE calidad_nivel_servicio SET contestadas20s=?, llamadasTotales=?, updatedAt=? WHERE id=?').run(
      contestadas20sMes,
      llamadasTotalesMes,
      ts,
      existingMes.id
    );
  } else if (filasMes.length) {
    db.prepare(
      `INSERT INTO calidad_nivel_servicio (campana, mes, sede, contestadas20s, llamadasTotales, createdAt, updatedAt)
       VALUES (?,?,?,?,?,?,?)`
    ).run(campana, mes, sede, contestadas20sMes, llamadasTotalesMes, ts, ts);
  } else {
    return null; // nada que recalcular ni antes ni ahora
  }
  return db.prepare('SELECT * FROM calidad_nivel_servicio WHERE campana = ? AND mes = ? AND sede IS ?').get(campana, mes, sede);
}

module.exports = { cargarNivelServicioDiario, recalcularMensual };
