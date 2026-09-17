// routes/umbrales.js — Umbrales de semaforo (color por dato en los
// dashboards). Extraido de server.js (Radiografia InConexion, #3): solo se
// movio el cableado HTTP, sin tocar ninguna regla de negocio.
const express = require('express');
const db = require('../db');
const { requireActor, isFullAdmin } = require('../auth');
const { validate, schemas } = require('../validation');
const { wrap, nowStr } = require('./shared');

const router = express.Router();

function toUmbralRow(row) {
  return {
    id: row.id,
    metrica: row.metrica,
    campana: row.campana || '',
    verde: row.verde,
    amarillo: row.amarillo,
    direccion: row.direccion,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// UMBRALES DE SEMAFORO (color por dato en los dashboards) — configurables
// desde el panel de administracion, sin desplegar. Lectura abierta a
// cualquier actor autenticado (los dashboards los necesitan para pintar);
// escritura solo administrador. Ver server/db.js para el diseño de
// (metrica, campana='') = default global vs. override por campana.
router.get(
  '/umbrales',
  requireActor,
  wrap((req, res) => {
    res.set('Cache-Control', 'no-store');
    const rows = db.prepare('SELECT * FROM umbrales_semaforo ORDER BY metrica, campana').all();
    res.json(rows.map(toUmbralRow));
  })
);

router.post(
  '/umbrales',
  requireActor,
  validate(schemas.umbralBody),
  wrap((req, res) => {
    if (!isFullAdmin(req.actor)) {
      return res.status(403).json({ error: 'Solo el administrador puede configurar umbrales' });
    }
    const b = req.body;
    const now = nowStr();
    const existing = db
      .prepare('SELECT * FROM umbrales_semaforo WHERE metrica = ? AND campana = ?')
      .get(b.metrica, b.campana);
    if (existing) {
      db.prepare(
        `UPDATE umbrales_semaforo SET verde=?, amarillo=?, direccion=?, updatedAt=? WHERE id=?`
      ).run(b.verde, b.amarillo, b.direccion, now, existing.id);
      const row = db.prepare('SELECT * FROM umbrales_semaforo WHERE id = ?').get(existing.id);
      return res.json(toUmbralRow(row));
    }
    const info = db
      .prepare(
        `INSERT INTO umbrales_semaforo (metrica, campana, verde, amarillo, direccion, createdAt, updatedAt)
         VALUES (@metrica,@campana,@verde,@amarillo,@direccion,@createdAt,@updatedAt)`
      )
      .run({ ...b, createdAt: now, updatedAt: now });
    const row = db.prepare('SELECT * FROM umbrales_semaforo WHERE id = ?').get(info.lastInsertRowid);
    res.status(201).json(toUmbralRow(row));
  })
);

router.put(
  '/umbrales/:id',
  requireActor,
  validate(schemas.idParamSchema, 'params'),
  validate(schemas.updateUmbralBody),
  wrap((req, res) => {
    if (!isFullAdmin(req.actor)) {
      return res.status(403).json({ error: 'Solo el administrador puede editar umbrales' });
    }
    const row = db.prepare('SELECT * FROM umbrales_semaforo WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Umbral no encontrado' });
    const b = req.body;
    try {
      db.prepare(
        `UPDATE umbrales_semaforo SET metrica=?, campana=?, verde=?, amarillo=?, direccion=?, updatedAt=? WHERE id=?`
      ).run(
        b.metrica ?? row.metrica,
        b.campana ?? row.campana,
        b.verde ?? row.verde,
        b.amarillo ?? row.amarillo,
        b.direccion ?? row.direccion,
        nowStr(),
        row.id
      );
    } catch (e) {
      if (e && e.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        return res.status(409).json({ error: 'Ya existe un umbral para esa metrica y campana' });
      }
      throw e;
    }
    const updated = db.prepare('SELECT * FROM umbrales_semaforo WHERE id = ?').get(row.id);
    res.json(toUmbralRow(updated));
  })
);

router.delete(
  '/umbrales/:id',
  requireActor,
  validate(schemas.idParamSchema, 'params'),
  wrap((req, res) => {
    if (!isFullAdmin(req.actor)) {
      return res.status(403).json({ error: 'Solo el administrador puede eliminar umbrales' });
    }
    const row = db.prepare('SELECT * FROM umbrales_semaforo WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Umbral no encontrado' });
    db.prepare('DELETE FROM umbrales_semaforo WHERE id = ?').run(row.id);
    res.json({ ok: true });
  })
);

module.exports = router;
