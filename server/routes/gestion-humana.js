// routes/gestion-humana.js — Gestión humana ANTERIOR (personal por campaña, Fase 10), RETIRADA en la Fase
// GH7 (23/11/2026, OK del usuario). La reemplaza «Talento humano» (la app de Edwin, /gh/estado, /gh/acceso,
// /gh/bitacora y /gh/archivos, que NO se tocan). Al retirarla en producción no tenía datos (0 registros en
// gestion_humana_personal, 0 eventos GH_PERSONAL* en el Historial y 0 usuarios con el rol GESTION_HUMANA).
// La tabla gestion_humana_personal y el rol GESTION_HUMANA (lo usa Talento humano) NO se borran: si algún día
// hiciera falta, se reactiva desde el historial de git (PR de la Fase GH7). /gh/personal* y /gh/resumen
// responden 410 con un aviso que lleva a Talento humano. Mismo patrón que el Inventario anterior (Fase 383).
const express = require('express');
const { requireActor } = require('../auth');

const router = express.Router();

// Sin caché para todo /gh (también lo usa Talento humano; antes lo ponía este mismo archivo).
router.use('/gh', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });

const AVISO = 'La Gestión humana anterior (personal por campaña) se retiró. Usa «Talento humano».';
const retirada = (req, res) => res.status(410).json({ error: AVISO, codigo: 'retirado' });
router.use('/gh/personal', requireActor, retirada);
router.use('/gh/resumen', requireActor, retirada);

module.exports = router;
module.exports.AVISO = AVISO;
