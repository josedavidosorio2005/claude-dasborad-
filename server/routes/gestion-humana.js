// routes/gestion-humana.js — Registro de personal por campana (Fase 10).
// Extraido de server.js (Radiografia InConexion, #3): solo se movio el
// cableado HTTP, sin tocar ninguna regla de negocio.
const express = require('express');
const db = require('../db');
const { requireActor, can } = require('../auth');
const { validate, schemas } = require('../validation');
const { wrap, nowStr, logEvent, actorLabel } = require('./shared');

const router = express.Router();

router.use('/gh', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

function toGhPersonal(row) {
  return {
    id: row.id, nombre: row.nombre, documento: row.documento || '', cargo: row.cargo || '',
    campana: row.campana, supervisor: row.supervisor || '',
    fecha_ingreso: row.fecha_ingreso, fecha_salida: row.fecha_salida || null,
    motivo_salida: row.motivo_salida || '',
    costo_hora: row.costo_hora || 0, horas_mes: row.horas_mes || 0,
    salario: row.salario === null || row.salario === undefined ? null : row.salario,
    observaciones: row.observaciones || '',
    activo: !(row.fecha_salida && String(row.fecha_salida).trim()),
    costo_mes: Math.round((row.costo_hora || 0) * (row.horas_mes || 0) * 100) / 100,
    createdAt: row.createdAt, updatedAt: row.updatedAt,
  };
}

router.get(
  '/gh/personal',
  requireActor,
  wrap((req, res) => {
    if (!can(req.actor, 'GestionHumana')) return res.status(403).json({ error: 'Sin acceso al modulo de Gestion Humana' });
    const { campana, estado } = req.query;
    let rows = db.prepare('SELECT * FROM gestion_humana_personal ORDER BY campana, nombre').all();
    if (campana) rows = rows.filter((r) => r.campana === campana);
    if (estado === 'activo') rows = rows.filter((r) => !(r.fecha_salida && String(r.fecha_salida).trim()));
    if (estado === 'retirado') rows = rows.filter((r) => r.fecha_salida && String(r.fecha_salida).trim());
    res.json(rows.map(toGhPersonal));
  })
);

router.get(
  '/gh/resumen',
  requireActor,
  wrap((req, res) => {
    if (!can(req.actor, 'GestionHumana')) return res.status(403).json({ error: 'Sin acceso al modulo de Gestion Humana' });
    const rows = db.prepare('SELECT * FROM gestion_humana_personal').all();
    const activos = rows.filter((r) => !(r.fecha_salida && String(r.fecha_salida).trim()));
    const costoMes = (p) => (p.costo_hora || 0) * (p.horas_mes || 0);
    const porCampana = {};
    for (const p of activos) {
      const c = (porCampana[p.campana] = porCampana[p.campana] || { campana: p.campana, activos: 0, costo_mes: 0 });
      c.activos += 1; c.costo_mes += costoMes(p);
    }
    res.json({
      total: rows.length,
      activos: activos.length,
      retirados: rows.length - activos.length,
      campanas: Object.keys(porCampana).length,
      costoNominaMes: Math.round(activos.reduce((a, p) => a + costoMes(p), 0) * 100) / 100,
      porCampana: Object.values(porCampana).map((c) => ({ ...c, costo_mes: Math.round(c.costo_mes * 100) / 100 })),
    });
  })
);

router.post(
  '/gh/personal',
  requireActor,
  validate(schemas.ghPersonalBody),
  wrap((req, res) => {
    if (!can(req.actor, 'GestionHumana')) return res.status(403).json({ error: 'Sin acceso al modulo de Gestion Humana' });
    const b = req.body;
    const now = nowStr();
    const info = db.prepare(
      `INSERT INTO gestion_humana_personal
         (nombre, documento, cargo, campana, supervisor, fecha_ingreso, fecha_salida, motivo_salida, costo_hora, horas_mes, salario, observaciones, createdAt, updatedAt)
       VALUES (@nombre,@documento,@cargo,@campana,@supervisor,@fecha_ingreso,@fecha_salida,@motivo_salida,@costo_hora,@horas_mes,@salario,@observaciones,@now,@now)`
    ).run({ ...b, fecha_salida: b.fecha_salida || null, now });
    const row = db.prepare('SELECT * FROM gestion_humana_personal WHERE id = ?').get(info.lastInsertRowid);
    logEvent('GH_PERSONAL', { nombre: b.nombre, user: '-', rol: b.campana }, actorLabel(req.actor), b.fecha_salida ? 'Retirado' : 'Ingreso');
    res.status(201).json(toGhPersonal(row));
  })
);

router.put(
  '/gh/personal/:id',
  requireActor,
  validate(schemas.idParamSchema, 'params'),
  validate(schemas.ghPersonalUpdate),
  wrap((req, res) => {
    if (!can(req.actor, 'GestionHumana')) return res.status(403).json({ error: 'Sin acceso al modulo de Gestion Humana' });
    const row = db.prepare('SELECT * FROM gestion_humana_personal WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Persona no encontrada' });
    const b = req.body;
    const fechaSalida = b.fecha_salida !== undefined ? (b.fecha_salida || null) : row.fecha_salida;
    db.prepare(
      `UPDATE gestion_humana_personal SET nombre=?, documento=?, cargo=?, campana=?, supervisor=?, fecha_ingreso=?, fecha_salida=?, motivo_salida=?, costo_hora=?, horas_mes=?, salario=?, observaciones=?, updatedAt=? WHERE id=?`
    ).run(
      b.nombre ?? row.nombre, b.documento ?? row.documento, b.cargo ?? row.cargo,
      b.campana ?? row.campana, b.supervisor ?? row.supervisor,
      b.fecha_ingreso ?? row.fecha_ingreso, fechaSalida,
      b.motivo_salida ?? row.motivo_salida,
      b.costo_hora ?? row.costo_hora, b.horas_mes ?? row.horas_mes,
      b.salario !== undefined ? b.salario : row.salario,
      b.observaciones ?? row.observaciones, nowStr(), row.id
    );
    const updated = db.prepare('SELECT * FROM gestion_humana_personal WHERE id = ?').get(row.id);
    logEvent('GH_PERSONAL_EDIT', { nombre: updated.nombre, user: '-', rol: updated.campana }, actorLabel(req.actor), '');
    res.json(toGhPersonal(updated));
  })
);

router.delete(
  '/gh/personal/:id',
  requireActor,
  validate(schemas.idParamSchema, 'params'),
  wrap((req, res) => {
    if (!can(req.actor, 'GestionHumana')) return res.status(403).json({ error: 'Sin acceso al modulo de Gestion Humana' });
    const row = db.prepare('SELECT * FROM gestion_humana_personal WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Persona no encontrada' });
    db.prepare('DELETE FROM gestion_humana_personal WHERE id = ?').run(row.id);
    logEvent('GH_PERSONAL_DEL', { nombre: row.nombre, user: '-', rol: row.campana }, actorLabel(req.actor), '');
    res.json({ ok: true });
  })
);

module.exports = router;
