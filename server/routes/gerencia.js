// routes/gerencia.js — Indicadores ejecutivos mensuales. Extraido de
// server.js (Radiografia InConexion, #3): solo se movio el cableado HTTP,
// sin tocar ninguna regla de negocio.
const express = require('express');
const db = require('../db');
const { requireActor, can, canLoadData } = require('../auth');
const { validate, schemas } = require('../validation');
const { wrap, nowStr, logEvent, actorLabel } = require('./shared');

const router = express.Router();

router.use('/gerencia', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

function toGerenciaKpi(row) {
  return {
    id: row.id, periodo: row.periodo, nombre: row.nombre, categoria: row.categoria,
    valor: row.valor, unidad: row.unidad || '', meta: row.meta,
    observaciones: row.observaciones || '', createdAt: row.createdAt, updatedAt: row.updatedAt,
  };
}

// KPIs de un periodo
router.get(
  '/gerencia/kpis',
  requireActor,
  wrap((req, res) => {
    if (!can(req.actor, 'Gerencia')) return res.status(403).json({ error: 'Sin acceso al modulo de Gerencia' });
    const { periodo, categoria } = req.query;
    let rows;
    if (periodo && categoria) {
      rows = db.prepare('SELECT * FROM gerencia_kpis WHERE periodo = ? AND categoria = ? ORDER BY categoria, nombre').all(periodo, categoria);
    } else if (periodo) {
      rows = db.prepare('SELECT * FROM gerencia_kpis WHERE periodo = ? ORDER BY categoria, nombre').all(periodo);
    } else if (categoria) {
      rows = db.prepare('SELECT * FROM gerencia_kpis WHERE categoria = ? ORDER BY periodo DESC, nombre').all(categoria);
    } else {
      rows = db.prepare('SELECT * FROM gerencia_kpis ORDER BY periodo DESC, categoria, nombre').all();
    }
    res.json(rows.map(toGerenciaKpi));
  })
);

// Periodos disponibles
router.get(
  '/gerencia/periodos',
  requireActor,
  wrap((req, res) => {
    if (!can(req.actor, 'Gerencia')) return res.status(403).json({ error: 'Sin acceso al modulo de Gerencia' });
    const rows = db.prepare('SELECT DISTINCT periodo FROM gerencia_kpis ORDER BY periodo DESC').all();
    res.json(rows.map((r) => r.periodo));
  })
);

// Resumen ejecutivo de un periodo
router.get(
  '/gerencia/resumen',
  requireActor,
  wrap((req, res) => {
    if (!can(req.actor, 'Gerencia')) return res.status(403).json({ error: 'Sin acceso al modulo de Gerencia' });
    const periodo = req.query.periodo || new Date().toISOString().slice(0, 7);
    const kpis = db.prepare('SELECT * FROM gerencia_kpis WHERE periodo = ? ORDER BY categoria, nombre').all(periodo);
    const porCategoria = {};
    kpis.forEach((k) => {
      if (!porCategoria[k.categoria]) porCategoria[k.categoria] = [];
      porCategoria[k.categoria].push(toGerenciaKpi(k));
    });
    const periodos = db.prepare('SELECT DISTINCT periodo FROM gerencia_kpis ORDER BY periodo DESC').all().map((r) => r.periodo);
    res.json({ periodo, kpis: kpis.map(toGerenciaKpi), porCategoria, periodos });
  })
);

// Crear / actualizar un KPI individual.
// Gerencia es SOLO LECTURA (feedback de Edwin 2.2): la escritura de KPIs
// ejecutivos exige el permiso de carga de datos (cargarDatos / admin), igual
// que el resto de datos que alimentan los dashboards.
router.post(
  '/gerencia/kpis',
  requireActor,
  validate(schemas.gerenciaKpiBody),
  wrap((req, res) => {
    if (!canLoadData(req.actor)) return res.status(403).json({ error: 'Gerencia es de solo lectura; cargar KPIs exige el permiso Cargar Datos' });
    const b = req.body;
    const now = nowStr();
    const existing = db.prepare('SELECT id FROM gerencia_kpis WHERE periodo = ? AND nombre = ?').get(b.periodo, b.nombre);
    if (existing) {
      db.prepare(
        `UPDATE gerencia_kpis SET categoria=?, valor=?, unidad=?, meta=?, observaciones=?, updatedAt=? WHERE id=?`
      ).run(b.categoria, b.valor, b.unidad, b.meta, b.observaciones, now, existing.id);
      const row = db.prepare('SELECT * FROM gerencia_kpis WHERE id = ?').get(existing.id);
      logEvent('GER_KPI_EDIT', { nombre: b.nombre, user: '-', rol: b.periodo }, actorLabel(req.actor), `Valor: ${b.valor}`);
      return res.json(toGerenciaKpi(row));
    }
    const info = db.prepare(
      `INSERT INTO gerencia_kpis (periodo, nombre, categoria, valor, unidad, meta, observaciones, createdAt, updatedAt)
       VALUES (@periodo,@nombre,@categoria,@valor,@unidad,@meta,@observaciones,@now,@now)`
    ).run({ ...b, now });
    const row = db.prepare('SELECT * FROM gerencia_kpis WHERE id = ?').get(info.lastInsertRowid);
    logEvent('GER_KPI', { nombre: b.nombre, user: '-', rol: b.periodo }, actorLabel(req.actor), `Valor: ${b.valor}`);
    res.status(201).json(toGerenciaKpi(row));
  })
);

// Actualizar un KPI
router.put(
  '/gerencia/kpis/:id',
  requireActor,
  validate(schemas.idParamSchema, 'params'),
  validate(schemas.gerenciaKpiUpdate),
  wrap((req, res) => {
    if (!canLoadData(req.actor)) return res.status(403).json({ error: 'Gerencia es de solo lectura; editar KPIs exige el permiso Cargar Datos' });
    const row = db.prepare('SELECT * FROM gerencia_kpis WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'KPI no encontrado' });
    const b = req.body;
    db.prepare(
      `UPDATE gerencia_kpis SET periodo=?, nombre=?, categoria=?, valor=?, unidad=?, meta=?, observaciones=?, updatedAt=? WHERE id=?`
    ).run(
      b.periodo ?? row.periodo, b.nombre ?? row.nombre, b.categoria ?? row.categoria,
      b.valor ?? row.valor, b.unidad ?? row.unidad, b.meta ?? row.meta,
      b.observaciones ?? row.observaciones, nowStr(), row.id
    );
    const updated = db.prepare('SELECT * FROM gerencia_kpis WHERE id = ?').get(row.id);
    logEvent('GER_KPI_EDIT', { nombre: updated.nombre, user: '-', rol: updated.periodo }, actorLabel(req.actor), '');
    res.json(toGerenciaKpi(updated));
  })
);

// Eliminar un KPI
router.delete(
  '/gerencia/kpis/:id',
  requireActor,
  validate(schemas.idParamSchema, 'params'),
  wrap((req, res) => {
    if (!canLoadData(req.actor)) return res.status(403).json({ error: 'Gerencia es de solo lectura; borrar KPIs exige el permiso Cargar Datos' });
    const row = db.prepare('SELECT * FROM gerencia_kpis WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'KPI no encontrado' });
    db.prepare('DELETE FROM gerencia_kpis WHERE id = ?').run(row.id);
    logEvent('GER_KPI_DEL', { nombre: row.nombre, user: '-', rol: row.periodo }, actorLabel(req.actor), '');
    res.json({ ok: true });
  })
);

// Carga masiva de KPIs desde Excel
router.post(
  '/gerencia/carga',
  requireActor,
  validate(schemas.gerenciaCargaBody),
  wrap((req, res) => {
    if (!canLoadData(req.actor)) return res.status(403).json({ error: 'Gerencia es de solo lectura; la carga de KPIs exige el permiso Cargar Datos' });
    const { periodo, kpis } = req.body;
    const now = nowStr();
    let upserted = 0;
    const insert = db.prepare(
      `INSERT INTO gerencia_kpis (periodo, nombre, categoria, valor, unidad, meta, observaciones, createdAt, updatedAt)
       VALUES (@periodo,@nombre,@categoria,@valor,@unidad,@meta,@observaciones,@now,@now)`
    );
    const tx = db.transaction((rows) => {
      for (const kpi of rows) {
        const existing = db.prepare('SELECT id FROM gerencia_kpis WHERE periodo = ? AND nombre = ?').get(periodo, kpi.nombre);
        if (existing) {
          db.prepare('UPDATE gerencia_kpis SET categoria=?, valor=?, unidad=?, meta=?, observaciones=?, updatedAt=? WHERE id=?')
            .run(kpi.categoria, kpi.valor, kpi.unidad || '', kpi.meta, kpi.observaciones || '', now, existing.id);
        } else {
          insert.run({ periodo, nombre: kpi.nombre, categoria: kpi.categoria, valor: kpi.valor, unidad: kpi.unidad || '', meta: kpi.meta, observaciones: kpi.observaciones || '', now });
        }
        upserted++;
      }
    });
    tx(kpis);
    logEvent('GER_CARGA', { nombre: `${upserted} KPIs`, user: '-', rol: periodo }, actorLabel(req.actor), `Carga masiva`);
    res.status(201).json({ ok: true, upserted });
  })
);

module.exports = router;
