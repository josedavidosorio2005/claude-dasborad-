// trafico-whatsapp.js — Logica de escritura del Trafico de WhatsApp (Fase 50).
// Mismo patron que nivel-servicio-diario.js (select-then-insert-or-update,
// una sola transaccion) pero sin agregado mensual: cada fila YA es un
// periodo completo (una cola por FECHA INICIO..FECHA FIN), asi que no hay
// nada que "sumar por dia" como en voz -- el dashboard lee estas filas
// directo (ver routes/trafico-whatsapp.js).
'use strict';

const { recalcularResumenOrlantDesdeTrafico } = require('./resumen-orlant-trafico');

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
        serviceLevel10secPct, serviceLevel20secPct, serviceLevel30secPct, serviceLevel5minPct, asaSegundos, ataSegundos, ahtSegundos,
        archivoNombre, cargadoPorNombre, createdAt)
     VALUES (@campana,@colaWhatsapp,@fechaInicio,@fechaFin,@totalWhatsapp,@contestados,@abandonados,
             @serviceLevel10secPct,@serviceLevel20secPct,@serviceLevel30secPct,@serviceLevel5minPct,@asaSegundos,@ataSegundos,@ahtSegundos,
             @archivoNombre,@cargadoPorNombre,@createdAt)`
  );
  const updateFila = db.prepare(
    `UPDATE trafico_whatsapp SET
       totalWhatsapp=@totalWhatsapp, contestados=@contestados, abandonados=@abandonados,
       serviceLevel10secPct=@serviceLevel10secPct, serviceLevel20secPct=@serviceLevel20secPct,
       serviceLevel30secPct=@serviceLevel30secPct, serviceLevel5minPct=@serviceLevel5minPct,
       asaSegundos=@asaSegundos, ataSegundos=@ataSegundos, ahtSegundos=@ahtSegundos,
       archivoNombre=@archivoNombre, cargadoPorNombre=@cargadoPorNombre, createdAt=@createdAt
     WHERE id=@id`
  );

  // Campos opcionales: si una fila no los trae, quedan NULL -- nunca 0 (dato
  // real distinto de "no vino"), mismo criterio que trafico/voz.
  const opcional = (v) => (v === undefined ? null : v);

  // Fase 115: misma logica de reemplazo por rango completo que Trafico de
  // Llamadas (nivel-servicio-diario.js) -- un periodo existente de una cola
  // cuyo fechaInicio cae dentro del rango de la carga pero no calza con
  // ningun periodo (fechaInicio+fechaFin exactos) del archivo nuevo se
  // borra, nunca queda huerfano.
  //
  // Fase 116 (hallazgo real, archivo diario de WhatsApp ago-sep/2026): el
  // rango NO puede ser [primera..ultima fechaInicio] de ESA cola dentro de
  // ESTE archivo -- WHATSAPP FONIATRIA no tuvo mensajes (Wolkvox no genera
  // fila) el 2026-08-01 ni el 02, asi que su propio rango arrancaba el
  // 2026-08-03 y el periodo viejo (2026-08-01..31, residuo del formato
  // anterior) quedaba FUERA de ese rango acotado -- sobrevivio sin
  // detectarse (confirmado en produccion: 1 fila huerfana de 31
  // WhatsApp/29 contestados inflando agosto). El rango correcto es el
  // GLOBAL del archivo completo (primera..ultima fechaInicio de CUALQUIER
  // fila, sin importar la cola) -- mismo criterio que el fix identico en
  // nivel-servicio-diario.js. Una cola que no aparece en el archivo sigue
  // sin tocarse en absoluto (el `for` de abajo solo recorre las colas
  // presentes).
  const fechasPorCola = new Map(); // colaWhatsapp -> Set(fechaInicio) de ESTA carga
  const periodosPorCola = new Map(); // colaWhatsapp -> Set("fechaInicio|fechaFin")
  let minFechaInicioGlobal = null, maxFechaInicioGlobal = null;
  filas.forEach((f) => {
    if (!fechasPorCola.has(f.colaWhatsapp)) {
      fechasPorCola.set(f.colaWhatsapp, new Set());
      periodosPorCola.set(f.colaWhatsapp, new Set());
    }
    fechasPorCola.get(f.colaWhatsapp).add(f.fechaInicio);
    periodosPorCola.get(f.colaWhatsapp).add(f.fechaInicio + '|' + f.fechaFin);
    if (minFechaInicioGlobal === null || f.fechaInicio < minFechaInicioGlobal) minFechaInicioGlobal = f.fechaInicio;
    if (maxFechaInicioGlobal === null || f.fechaInicio > maxFechaInicioGlobal) maxFechaInicioGlobal = f.fechaInicio;
  });
  const selectEnRango = db.prepare(
    'SELECT id, fechaInicio, fechaFin FROM trafico_whatsapp WHERE campana = ? AND colaWhatsapp = ? AND fechaInicio BETWEEN ? AND ?'
  );

  const colasVistas = new Set();
  const idsAfectados = [];
  const idsBorrados = [];
  const mesesBorrados = new Set();
  const tx = db.transaction((rows) => {
    for (const [colaWhatsapp] of fechasPorCola) {
      const periodosNuevos = periodosPorCola.get(colaWhatsapp);
      const aBorrar = selectEnRango
        .all(campana, colaWhatsapp, minFechaInicioGlobal, maxFechaInicioGlobal)
        .filter((r) => !periodosNuevos.has(r.fechaInicio + '|' + r.fechaFin));
      if (aBorrar.length) {
        const placeholders = aBorrar.map(() => '?').join(',');
        db.prepare(`DELETE FROM trafico_whatsapp WHERE id IN (${placeholders})`).run(...aBorrar.map((r) => r.id));
        aBorrar.forEach((r) => {
          idsBorrados.push(r.id);
          mesesBorrados.add(r.fechaInicio.slice(0, 7));
        });
      }
    }

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
        serviceLevel5minPct: opcional(f.serviceLevel5minPct),
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

  // Fase 71: cada carga de Trafico de WhatsApp para ORLANT recalcula tambien
  // wpp_3p/wpp_general/nivel_atencion_wpp_3p en el resumen mensual
  // (dashboard_cargas) -- mismo criterio que ya aplica Trafico de Llamadas
  // (Fase 39, trafico-skills.js) para llamadas_3p/nivel_atencion_3p/
  // llamadas_general/nivel_atencion_general, para los meses que esta carga
  // realmente toco.
  const resumenActualizado = [];
  if (campana === 'ORLANT') {
    const mesesTocados = new Set(filas.map((f) => f.fechaInicio.slice(0, 7)));
    mesesBorrados.forEach((mes) => mesesTocados.add(mes));
    for (const mes of mesesTocados) {
      resumenActualizado.push({ mes, ...recalcularResumenOrlantDesdeTrafico(db, mes) });
    }
  }

  return { insertadas: filas.length, ids: idsAfectados, borradas: idsBorrados.length, colas: [...colasVistas], resumenActualizado };
}

module.exports = { cargarTraficoWhatsapp };
