// ultima-actualizacion.js — Fase 131 (Parte 4, pedido explicito: "Ultima
// actualizacion: <fecha> <hora>" hora Colombia, visible en cada dashboard
// = la carga mas reciente de ESE cliente).
//
// No hay una sola tabla con "la ultima carga de cada cliente": cada tipo
// de dato real vive en su propia tabla (Trafico, Tipificacion, Agendas,
// Calidad, etc, cada una con su propio `campana`/`cliente` + createdAt),
// y "Gestion de base" (secciones genericas) vive aparte en
// `dashboard_cargas` (columna `cargadoEn`, no `createdAt`). Este archivo
// junta las 10 fuentes y devuelve la MAS RECIENTE para un cliente dado.
//
// `createdAt`/`cargadoEn` se guardan con la hora LOCAL DEL PROCESO
// (nowStr(), duplicado en cada modulo de carga -- ver agendas.js/
// tipificaciones.js/etc) -- en produccion (AWS) eso es UTC, NUNCA
// Colombia (mismo comentario que fechaLimitesAhoraColombiaStr,
// fecha-limites.js). Por eso cada fila se interpreta como UTC antes de
// convertirla a Colombia para mostrarla.
'use strict';

const { fechaLimitesAhoraColombiaStr } = require('./fecha-limites');

// {tabla, campoCampana, campoFecha} -- ORDER BY id DESC (nunca MAX(fecha)
// en SQL: 'DD/MM/AAAA HH:MM:SS' no ordena lexicograficamente por fecha
// real, ej. "05/10/2026..." > "20/09/2026..." como texto aunque octubre
// sea despues -- el id autoincremental SI refleja el orden real de
// inserción, que es lo que de verdad importa aqui ("la ultima carga").
const FUENTES = [
  { tabla: 'monitoreos', campoCampana: 'campana', campoFecha: 'createdAt' },
  { tabla: 'calidad_nivel_servicio_diario', campoCampana: 'campana', campoFecha: 'createdAt' },
  { tabla: 'trafico_whatsapp', campoCampana: 'campana', campoFecha: 'createdAt' },
  { tabla: 'agendas', campoCampana: 'campana', campoFecha: 'createdAt' },
  { tabla: 'tipificaciones', campoCampana: 'campana', campoFecha: 'createdAt' },
  { tabla: 'inasistencias', campoCampana: 'campana', campoFecha: 'createdAt' },
  { tabla: 'efectividad_agendamiento', campoCampana: 'campana', campoFecha: 'createdAt' },
  { tabla: 'efectividad_citas', campoCampana: 'campana', campoFecha: 'createdAt' },
  { tabla: 'salida_mensual', campoCampana: 'campana', campoFecha: 'createdAt' },
  { tabla: 'dashboard_cargas', campoCampana: 'cliente', campoFecha: 'cargadoEn' },
];

const RE_FECHA_PROCESO = /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})$/;

// Interpreta 'DD/MM/AAAA HH:MM:SS' (hora local DEL PROCESO, ver nowStr())
// como UTC -- null si no calza el formato (defensivo, nunca deberia pasar
// con datos propios de la plataforma).
function parseFechaProcesoComoUtc(str) {
  const m = RE_FECHA_PROCESO.exec(String(str || ''));
  if (!m) return null;
  const [, dd, mm, aaaa, hh, min, ss] = m;
  return new Date(Date.UTC(+aaaa, +mm - 1, +dd, +hh, +min, +ss));
}

// Fecha/hora de la carga mas reciente de `cliente`, ya en hora Colombia
// ('DD/MM/AAAA HH:MM:SS'), o null si el cliente no tiene ninguna carga
// todavia en ninguna de las 10 fuentes.
function obtenerUltimaActualizacion(db, cliente) {
  let masReciente = null; // Date (UTC)
  for (const f of FUENTES) {
    const row = db
      .prepare(`SELECT ${f.campoFecha} AS f FROM ${f.tabla} WHERE ${f.campoCampana} = ? ORDER BY id DESC LIMIT 1`)
      .get(cliente);
    if (!row) continue;
    const fecha = parseFechaProcesoComoUtc(row.f);
    if (fecha && (!masReciente || fecha > masReciente)) masReciente = fecha;
  }
  if (!masReciente) return { fechaColombia: null };
  return { fechaColombia: fechaLimitesAhoraColombiaStr(masReciente) };
}

module.exports = {
  FUENTES,
  parseFechaProcesoComoUtc,
  obtenerUltimaActualizacion,
};
