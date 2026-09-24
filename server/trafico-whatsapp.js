// trafico-whatsapp.js — Logica de escritura del Trafico de WhatsApp (Fase 50).
// Mismo patron que nivel-servicio-diario.js (select-then-insert-or-update,
// una sola transaccion) pero sin agregado mensual: cada fila YA es un
// periodo completo (una cola por FECHA INICIO..FECHA FIN), asi que no hay
// nada que "sumar por dia" como en voz -- el dashboard lee estas filas
// directo (ver routes/trafico-whatsapp.js).
'use strict';

function nowStr() {
  const d = new Date();
  const pad = (n) => (n < 10 ? '0' + n : '' + n);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// Upsertea las filas de (campana, colaWhatsapp, fechaInicio, fechaFin).
// Volver a subir la misma cola+periodo reemplaza la fila, no duplica (mismo
// criterio que calidad_nivel_servicio_diario / dashboard_cargas).
function cargarTraficoWhatsapp(db, { campana, archivoNombre, cargadoPorNombre, filas }) {
  const ts = nowStr();

  const selectFila = db.prepare(
    'SELECT id FROM trafico_whatsapp WHERE campana = ? AND colaWhatsapp = ? AND fechaInicio = ? AND fechaFin = ?'
  );
  const insertFila = db.prepare(
    `INSERT INTO trafico_whatsapp
       (campana, colaWhatsapp, fechaInicio, fechaFin, totalWhatsapp, contestados, abandonados,
        serviceLevel10secPct, serviceLevel20secPct, serviceLevel30secPct, asaSegundos, ataSegundos, ahtSegundos,
        archivoNombre, cargadoPorNombre, createdAt)
     VALUES (@campana,@colaWhatsapp,@fechaInicio,@fechaFin,@totalWhatsapp,@contestados,@abandonados,
             @serviceLevel10secPct,@serviceLevel20secPct,@serviceLevel30secPct,@asaSegundos,@ataSegundos,@ahtSegundos,
             @archivoNombre,@cargadoPorNombre,@createdAt)`
  );
  const updateFila = db.prepare(
    `UPDATE trafico_whatsapp SET
       totalWhatsapp=@totalWhatsapp, contestados=@contestados, abandonados=@abandonados,
       serviceLevel10secPct=@serviceLevel10secPct, serviceLevel20secPct=@serviceLevel20secPct,
       serviceLevel30secPct=@serviceLevel30secPct, asaSegundos=@asaSegundos, ataSegundos=@ataSegundos, ahtSegundos=@ahtSegundos,
       archivoNombre=@archivoNombre, cargadoPorNombre=@cargadoPorNombre, createdAt=@createdAt
     WHERE id=@id`
  );

  // Campos opcionales: si una fila no los trae, quedan NULL -- nunca 0 (dato
  // real distinto de "no vino"), mismo criterio que trafico/voz.
  const opcional = (v) => (v === undefined ? null : v);

  const colasVistas = new Set();
  const idsAfectados = [];
  const tx = db.transaction((rows) => {
    for (const f of rows) {
      const params = {
        campana,
        colaWhatsapp: f.colaWhatsapp,
        fechaInicio: f.fechaInicio,
        fechaFin: f.fechaFin,
        totalWhatsapp: f.totalWhatsapp,
        contestados: f.contestados,
        abandonados: opcional(f.abandonados),
        serviceLevel10secPct: opcional(f.serviceLevel10secPct),
        serviceLevel20secPct: opcional(f.serviceLevel20secPct),
        serviceLevel30secPct: opcional(f.serviceLevel30secPct),
        asaSegundos: opcional(f.asaSegundos),
        ataSegundos: opcional(f.ataSegundos),
        ahtSegundos: opcional(f.ahtSegundos),
        archivoNombre: archivoNombre || '',
        cargadoPorNombre: cargadoPorNombre || '-',
        createdAt: ts,
      };
      const existing = selectFila.get(campana, f.colaWhatsapp, f.fechaInicio, f.fechaFin);
      if (existing) {
        updateFila.run({ ...params, id: existing.id });
        idsAfectados.push(existing.id);
      } else {
        const info = insertFila.run(params);
        idsAfectados.push(info.lastInsertRowid);
      }
      colasVistas.add(f.colaWhatsapp);
    }
  });
  tx(filas);

  return { insertadas: filas.length, ids: idsAfectados, colas: [...colasVistas] };
}

module.exports = { cargarTraficoWhatsapp };
