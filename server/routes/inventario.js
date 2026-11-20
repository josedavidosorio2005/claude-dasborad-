// routes/inventario.js — Inventario ANTERIOR (stock y movimientos), RETIRADO en la Fase 383 (20/11/2026,
// Edwin aprobó pasarse al Inventario de sistemas; OK del usuario). Al retirarlo no tenía datos (0 ítems,
// 0 movimientos y ningún evento INV_* en el Historial). Las tablas inventario_items e
// inventario_movimientos NO se borran: si algún día hiciera falta, se reactiva desde el historial de git
// (PR de la Fase 383). Toda ruta /inventario/* responde 410 con un aviso que lleva al Inventario de sistemas.
const express = require('express');
const { requireActor } = require('../auth');

const router = express.Router();

const AVISO = 'El Inventario anterior se retiró. Usa el «Inventario de sistemas».';
router.use('/inventario', requireActor, (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.status(410).json({ error: AVISO, codigo: 'retirado' });
});

module.exports = router;
module.exports.AVISO = AVISO;
