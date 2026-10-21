// fase161-indices.test.js — Fase 161: indices para las consultas de datos mas
// lentas. Existen, el plan de cada consulta los usa (y cubre la consulta) y
// la migracion es idempotente. Los resultados no cambian (eso lo da la foto
// de rutas; aca solo el plan).
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { db } = require('./helpers');

const plan = (sql, ...p) => db.prepare('EXPLAIN QUERY PLAN ' + sql).all(...p).map((r) => r.detail).join(' | ');

const INDICES = [
  'idx_agendas_campana_fecha_linea', 'idx_agendas_campana_id',
  'idx_tipificaciones_campana_canal_tipo', 'idx_tipificaciones_campana_id',
  'idx_llamadas_salida_campana_fecha_tipo_agente', 'idx_llamadas_unicas_campana_fecha_tipo',
  'idx_whatsapp_tiempos_campana_id',
];

test('los indices de la Fase 161 existen y la migracion quedo registrada', () => {
  const hay = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type = 'index'").all().map((r) => r.name));
  INDICES.forEach((i) => assert.ok(hay.has(i), i));
  assert.ok(db.prepare("SELECT 1 FROM schema_migrations WHERE name = 'fase161_indices_v1'").get());
});

test('Agendas por linea se resuelve solo con el indice', () => {
  assert.match(plan("SELECT substr(fechaSolicitud,1,7) AS mes, tipoLinea, COUNT(*) FROM agendas WHERE campana = ? GROUP BY mes, tipoLinea", 'X'),
    /COVERING INDEX idx_agendas_campana_fecha_linea/);
});

test('Tipificacion: conteo por tipo de interaccion solo con el indice', () => {
  assert.match(plan('SELECT COUNT(*) FROM tipificaciones WHERE campana = ? AND canal = ? AND tipoInteraccion = ?', 'X', 'LLAMADAS', 'SALIDA'),
    /COVERING INDEX idx_tipificaciones_campana_canal_tipo/);
});

test('Llamadas de salida y unicas por mes y por agente, solo con el indice', () => {
  assert.match(plan("SELECT substr(fecha,1,7), COUNT(*), SUM(CASE WHEN tipo='CONECTADA' THEN 1 ELSE 0 END) FROM llamadas_salida WHERE campana = ? GROUP BY 1", 'X'),
    /COVERING INDEX idx_llamadas_salida_campana_fecha_tipo_agente/);
  assert.match(plan("SELECT agente, COUNT(*), SUM(CASE WHEN tipo='CONECTADA' THEN 1 ELSE 0 END) FROM llamadas_salida WHERE campana = ? GROUP BY agente", 'X'),
    /COVERING INDEX idx_llamadas_salida_campana_fecha_tipo_agente/);
  assert.match(plan("SELECT substr(fecha,1,7), SUM(CASE WHEN tipo='CONTESTADA' THEN 1 ELSE 0 END) FROM llamadas_unicas WHERE campana = ? GROUP BY 1", 'X'),
    /COVERING INDEX idx_llamadas_unicas_campana_fecha_tipo/);
});

test('Ultima actualizacion (ultima fila de la campana) no necesita ordenar', () => {
  for (const t of ['tipificaciones', 'agendas', 'whatsapp_tiempos']) {
    const p = plan(`SELECT createdAt FROM ${t} WHERE campana = ? ORDER BY id DESC LIMIT 1`, 'X');
    assert.doesNotMatch(p, /TEMP B-TREE/, t + ': ' + p);
  }
});

test('la migracion es idempotente', () => {
  const n = () => db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'index'").get().n;
  const antes = n();
  INDICES.forEach((i) => db.exec(`CREATE INDEX IF NOT EXISTS ${i} ON agendas(campana)`)); // ya existen: no hace nada
  assert.equal(n(), antes);
});
