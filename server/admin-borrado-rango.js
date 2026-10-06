// admin-borrado-rango.js — Fase 126, Parte 1.5/2 (pedido explicito del
// usuario, Edwin: "Todos los datos que yo no le haya pasado... como
// pruebas en las plantillas, todo eso hay que quitarlo"). Borrado real de
// produccion por base + rango de meses, SOLO administrador, SOLO campana
// ORLANT (candado explicito: nunca Aurora/HLM/otro cliente por este
// camino), con dry-run por defecto y un conteo esperado obligatorio que
// aborta SIN BORRAR NADA si no coincide con lo real.
//
// `TABLAS` es un mapa FIJO (no derivado de `req.body`): la clave `base`
// que manda el cliente pasa primero por el enum de validation.js, y solo
// esa clave ya validada se usa para indexar este mapa -- el texto SQL de
// tabla/columna que termina en la query SIEMPRE sale de aqui, nunca del
// cuerpo de la peticion, así que no hay inyeccion SQL posible aunque la
// consulta se arme con template strings.
const TABLAS = {
  agendas: { tabla: 'agendas', columnaMes: 'substr(fechaSolicitud,1,7)', extra: '' },
  tipificacion_llamadas: { tabla: 'tipificaciones', columnaMes: 'substr(fecha,1,7)', extra: " AND canal = 'LLAMADAS'" },
  tipificacion_whatsapp: { tabla: 'tipificaciones', columnaMes: 'substr(fecha,1,7)', extra: " AND canal = 'WHATSAPP'" },
  trafico_llamadas: { tabla: 'calidad_nivel_servicio_diario', columnaMes: 'substr(fecha,1,7)', extra: '' },
  trafico_whatsapp: { tabla: 'trafico_whatsapp', columnaMes: 'substr(fechaInicio,1,7)', extra: '' },
  inasistencia: { tabla: 'inasistencias', columnaMes: 'mes', extra: '' },
  efectividad_agendamiento: { tabla: 'efectividad_agendamiento', columnaMes: 'mes', extra: '' },
  efectividad_citas: { tabla: 'efectividad_citas', columnaMes: 'mes', extra: '' },
  // Fase 127: misma forma exacta que efectividad_citas (mes directo, sin
  // substr), agregado al mapa por consistencia con el resto de bases --
  // no se usa en esta fase (no hay nada que borrar todavia).
  salida: { tabla: 'salida_mensual', columnaMes: 'mes', extra: '' },
};

const BASES_VALIDAS = Object.keys(TABLAS);

function contarFilasRango(db, { base, campana, mesDesde, mesHasta }) {
  const cfg = TABLAS[base];
  if (!cfg) throw new Error('base invalida: ' + base);
  const sql = `SELECT COUNT(*) AS n FROM ${cfg.tabla} WHERE campana = ? AND ${cfg.columnaMes} >= ? AND ${cfg.columnaMes} <= ?${cfg.extra}`;
  return db.prepare(sql).get(campana, mesDesde, mesHasta).n;
}

// Borra SOLO si el conteo real coincide exacto con `filasEsperadas` (ya
// verificado por el caller antes de llamar aqui, pero se revalida dentro
// de la MISMA transaccion por si algo cambio entre el conteo y el borrado
// -- ninguna fila se toca si no coincide, incluso en esa ventana corta).
// Devuelve { ok:false, motivo:'conteo-no-coincide', real, esperado } sin
// borrar nada, o { ok:true, borradas } tras borrar.
function borrarRango(db, { base, campana, mesDesde, mesHasta, filasEsperadas }) {
  const cfg = TABLAS[base];
  if (!cfg) throw new Error('base invalida: ' + base);
  return db.transaction(() => {
    const real = contarFilasRango(db, { base, campana, mesDesde, mesHasta });
    if (real !== filasEsperadas) {
      return { ok: false, motivo: 'conteo-no-coincide', real, esperado: filasEsperadas };
    }
    const sql = `DELETE FROM ${cfg.tabla} WHERE campana = ? AND ${cfg.columnaMes} >= ? AND ${cfg.columnaMes} <= ?${cfg.extra}`;
    const info = db.prepare(sql).run(campana, mesDesde, mesHasta);
    return { ok: true, borradas: info.changes };
  })();
}

module.exports = { TABLAS, BASES_VALIDAS, contarFilasRango, borrarRango };
