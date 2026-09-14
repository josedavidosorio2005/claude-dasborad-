// gerencia.js — KPIs ejecutivos mensuales de demo (gerencia_kpis), con meta y
// cumplimiento variable mes a mes (algunos meses por encima, otros por
// debajo) para que el % de cumplimiento y la tabla de indicadores no salgan
// planos ni siempre en 100%.
'use strict';

const { seedOnceGuarded } = require('./marks');
const { MESES, rngFromSeed, randFloat, round2 } = require('./util');

const OBS_DEMO = '[DEMO] Sembrado por seed-demo';

// Todos definidos como "mas alto = mejor" (asi valor>=meta => cumple, que es
// como el adaptador de Gerencia calcula el cumplimiento).
const KPIS = [
  { nombre: 'Ingresos Totales', categoria: 'Financiero', unidad: 'COP', base: 480_000_000, metaFactor: 1.0 },
  { nombre: 'Utilidad Neta', categoria: 'Financiero', unidad: 'COP', base: 62_000_000, metaFactor: 1.0 },
  { nombre: 'Margen Operativo', categoria: 'Financiero', unidad: '%', base: 18, metaFactor: 1.0, max: 100 },
  { nombre: 'Crecimiento de Cartera de Clientes', categoria: 'Financiero', unidad: '%', base: 4, metaFactor: 1.0 },
  { nombre: 'Ocupacion de Planta', categoria: 'Operativo', unidad: '%', base: 87, metaFactor: 1.0, max: 100 },
  { nombre: 'Productividad (gestiones/agente)', categoria: 'Operativo', unidad: 'gestiones', base: 145, metaFactor: 1.0 },
  { nombre: 'Cumplimiento Nivel de Servicio', categoria: 'Operativo', unidad: '%', base: 84, metaFactor: 1.0, max: 100 },
  { nombre: 'Ausentismo Controlado', categoria: 'Operativo', unidad: '%', base: 92, metaFactor: 1.0, max: 100 },
  { nombre: 'Puntaje Promedio de Calidad', categoria: 'Calidad', unidad: 'pts', base: 86, metaFactor: 1.0, max: 100 },
  { nombre: 'Satisfaccion del Cliente (CSAT)', categoria: 'Clientes', unidad: '%', base: 88, metaFactor: 1.0, max: 100 },
  { nombre: 'NPS Consolidado', categoria: 'Clientes', unidad: 'pts', base: 42, metaFactor: 1.0, max: 100 },
  { nombre: 'Retencion de Clientes', categoria: 'Clientes', unidad: '%', base: 93, metaFactor: 1.0, max: 100 },
];

function seedGerencia(db, { cargadoPorNombre }) {
  const insert = db.prepare(`
    INSERT INTO gerencia_kpis (periodo, nombre, categoria, valor, unidad, meta, observaciones, createdAt, updatedAt)
    VALUES (@periodo,@nombre,@categoria,@valor,@unidad,@meta,@observaciones,@now,@now)
  `);
  const selectExisting = db.prepare('SELECT id FROM gerencia_kpis WHERE periodo = ? AND nombre = ?');

  let creados = 0;
  MESES.forEach((mes, idxMes) => {
    KPIS.forEach((def) => {
      const rand = rngFromSeed('kpi|' + def.nombre + '|' + mes);
      const tendencia = 1 + (0.1 * idxMes) / (MESES.length - 1);
      let valor = round2(def.base * tendencia * (1 + randFloat(rand, -0.12, 0.12, 3)));
      if (def.max) valor = Math.min(def.max, valor);
      const meta = round2(def.base * (def.metaFactor || 1));
      const clave = `${mes}|${def.nombre}`;
      const result = seedOnceGuarded(db, 'gerencia_kpis', clave, {
        checkExisting: () => {
          const row = selectExisting.get(mes, def.nombre);
          return row ? row.id : null;
        },
        insertFn: () => {
          const info = insert.run({
            periodo: mes,
            nombre: def.nombre,
            categoria: def.categoria,
            valor,
            unidad: def.unidad,
            meta,
            observaciones: OBS_DEMO,
            now: new Date().toISOString(),
          });
          return info.lastInsertRowid;
        },
      });
      if (result.created) creados++;
    });
  });

  return { kpisCreados: creados };
}

module.exports = { seedGerencia, KPIS };
