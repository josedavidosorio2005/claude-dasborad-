// routes/alias-asesores.js — Fase 122 (reunion con Edwin, 2026-10-05):
// alta/baja/lista de alias de nombre de asesor, SOLO administrador. Mismo
// patron que el catalogo de codificaciones de Calidad (routes/calidad.js,
// Fase 95 tema B): Zod + auditado en el historial + Cache-Control: no-store.
//
// Las 3 entradas iniciales (NATALIA TAMAYO CORREA -> ISABEL CORREA,
// ESTEFANIA GIRLADO SUAZA -> ESTEFANIA GIRALDO SUAZA, MICHELL GARCIA
// SERNA_falla -> MICHELL GARCIA SERNA) se cargan por ESTE endpoint con la
// sesion real del usuario administrador -- nunca por migracion ni seed del
// repo (un nombre real de asesor no puede vivir en el codigo fuente).
'use strict';
const express = require('express');
const db = require('../db');
const { requireActor, isFullAdmin } = require('../auth');
const { validate, schemas } = require('../validation');
const { aliasNorm } = require('../alias-asesores');
const { wrap, nowStr, actorLabel, logEvent } = require('./shared');

const router = express.Router();

router.use('/alias-asesores', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

// Lectura: solo administrador (mismo criterio que el resto de catalogos de
// administracion -- esto no es un dato que necesite ver el formulario de
// carga, solo la pantalla de administracion).
router.get(
  '/alias-asesores',
  requireActor,
  validate(schemas.aliasAsesorQuery, 'query'),
  wrap((req, res) => {
    if (!isFullAdmin(req.actor)) {
      return res.status(403).json({ error: 'Solo el administrador puede ver los alias de asesor' });
    }
    const rows = db
      .prepare('SELECT id, campana, alias, canonico, createdAt, createdPorNombre FROM alias_asesores WHERE campana = ? ORDER BY lower(alias)')
      .all(req.query.campana);
    res.json(rows);
  })
);

// Alta. Reglas (pedido explicito de InCo):
//  - un alias no puede apuntar a si mismo.
//  - un alias nunca puede apuntar a OTRO alias (sin cadenas, sin ciclos):
//    se rechaza si el `canonico` propuesto ya esta registrado como el
//    `alias` de otra fila de esta campana.
//  - no puede repetirse el mismo alias dos veces en la misma campana
//    (comparacion normalizada: mayusculas, sin tildes, espacios
//    colapsados).
//  - si el `canonico` no aparece todavia en ningun archivo cargado de esta
//    campana, se advierte en la respuesta pero NO se bloquea (puede ser un
//    asesor nuevo que todavia no tiene datos).
router.post(
  '/alias-asesores',
  requireActor,
  validate(schemas.aliasAsesorBody),
  wrap((req, res) => {
    if (!isFullAdmin(req.actor)) {
      return res.status(403).json({ error: 'Solo el administrador puede administrar alias de asesor' });
    }
    const { campana, alias, canonico } = req.body;
    if (aliasNorm(alias) === aliasNorm(canonico)) {
      return res.status(400).json({ error: 'Un alias no puede apuntar a si mismo' });
    }
    const existentes = db.prepare('SELECT alias FROM alias_asesores WHERE campana = ?').all(campana);
    if (existentes.some((r) => aliasNorm(r.alias) === aliasNorm(canonico))) {
      return res.status(400).json({
        error: 'El nombre canonico ya es el alias de otra fila -- un alias nunca puede apuntar a otro alias (sin cadenas, sin ciclos)',
      });
    }
    if (existentes.some((r) => aliasNorm(r.alias) === aliasNorm(alias))) {
      return res.status(409).json({ error: 'Ya existe un alias con ese nombre para esta campana' });
    }

    const conocidos = new Set();
    db.prepare('SELECT DISTINCT agente AS v FROM tipificaciones WHERE campana = ?').all(campana).forEach((r) => conocidos.add(aliasNorm(r.v)));
    db.prepare('SELECT DISTINCT asesor AS v FROM agendas WHERE campana = ?').all(campana).forEach((r) => conocidos.add(aliasNorm(r.v)));
    db.prepare('SELECT DISTINCT asesor AS v FROM efectividad_agendamiento WHERE campana = ?').all(campana).forEach((r) => conocidos.add(aliasNorm(r.v)));
    const advertencia = (conocidos.size > 0 && !conocidos.has(aliasNorm(canonico)))
      ? 'El nombre canonico no aparece todavia en ningun archivo cargado de esta campana -- se creo igual.'
      : undefined;

    const createdAt = nowStr();
    const info = db
      .prepare('INSERT INTO alias_asesores (campana, alias, canonico, createdAt, createdPorNombre) VALUES (?,?,?,?,?)')
      .run(campana, alias, canonico, createdAt, req.actor.nombre || '-');
    logEvent(
      'ALIAS_ASESOR_CREADO',
      { nombre: alias, user: '-', rol: campana },
      actorLabel(req.actor),
      `alias "${alias}" -> "${canonico}"`
    );
    res.status(201).json({ id: info.lastInsertRowid, campana, alias, canonico, createdAt, advertencia });
  })
);

// Baja (borrado real -- no hay "desactivar"; el alias no queda referenciado
// desde ninguna fila ya guardada, a diferencia del catalogo de
// codificaciones de Calidad, asi que no hay nada que proteger con un
// soft-delete).
router.delete(
  '/alias-asesores/:id',
  requireActor,
  validate(schemas.idParamSchema, 'params'),
  wrap((req, res) => {
    if (!isFullAdmin(req.actor)) {
      return res.status(403).json({ error: 'Solo el administrador puede administrar alias de asesor' });
    }
    const row = db.prepare('SELECT * FROM alias_asesores WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Alias no encontrado' });
    db.prepare('DELETE FROM alias_asesores WHERE id = ?').run(row.id);
    logEvent(
      'ALIAS_ASESOR_BORRADO',
      { nombre: row.alias, user: '-', rol: row.campana },
      actorLabel(req.actor),
      `alias "${row.alias}" -> "${row.canonico}"`
    );
    res.json({ ok: true });
  })
);

module.exports = router;
