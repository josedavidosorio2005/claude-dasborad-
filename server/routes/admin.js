// routes/admin.js — Fase 126: operaciones administrativas de un solo
// endpoint por ahora (borrado por rango de meses), separado de los demas
// routers por dominio porque no pertenece a ninguna base en particular --
// actua SOBRE varias.
const express = require('express');
const db = require('../db');
const { requireActor, isFullAdmin } = require('../auth');
const { validate, schemas } = require('../validation');
const { contarFilasRango, borrarRango } = require('../admin-borrado-rango');
const { wrap, logEvent, actorLabel } = require('./shared');

const router = express.Router();

// Borrado real de produccion por base + rango de meses (Fase 126, pedido
// explicito de Edwin de quitar los meses de prueba). Dry-run por defecto
// (`confirmar` ausente u false): solo cuenta, no borra nada. Para borrar
// de verdad hace falta `confirmar:true` Y que `filasEsperadas` coincida
// EXACTO con el conteo real -- si no coincide, 409 y no se toca nada.
router.post(
  '/admin/borrado-rango',
  requireActor,
  validate(schemas.borradoRangoBody),
  wrap((req, res) => {
    if (!isFullAdmin(req.actor)) {
      return res.status(403).json({ error: 'Solo el administrador puede borrar datos por rango' });
    }
    const b = req.body;
    const real = contarFilasRango(db, b);
    if (real !== b.filasEsperadas) {
      return res.status(409).json({
        error: 'El conteo real no coincide con filasEsperadas -- no se borro nada',
        real,
        esperado: b.filasEsperadas,
      });
    }
    if (!b.confirmar) {
      return res.json({
        dryRun: true,
        base: b.base,
        campana: b.campana,
        mesDesde: b.mesDesde,
        mesHasta: b.mesHasta,
        filas: real,
        mensaje: 'Dry-run: no se borro nada. Repite la misma peticion con confirmar:true para borrar de verdad.',
      });
    }
    const resultado = borrarRango(db, b);
    if (!resultado.ok) {
      // Conteo cambio entre el chequeo de arriba y el borrado (ventana muy
      // corta, pero posible) -- nunca se borro nada en ese caso.
      return res.status(409).json({
        error: 'El conteo real cambio justo antes de borrar -- no se borro nada',
        real: resultado.real,
        esperado: resultado.esperado,
      });
    }
    // Historial: SOLO conteos y el rango -- nunca una fila ni un nombre.
    logEvent(
      'ADMIN_BORRADO_RANGO',
      { nombre: `${resultado.borradas} fila(s)`, user: '-', rol: b.campana },
      actorLabel(req.actor),
      `${b.base} ${b.mesDesde}..${b.mesHasta}`
    );
    res.json({ ok: true, base: b.base, campana: b.campana, mesDesde: b.mesDesde, mesHasta: b.mesHasta, borradas: resultado.borradas });
  })
);

module.exports = router;
