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

// ── Fase 357 (D, pedido de Edwin 17/11): «Ver como este usuario» ──
// Solo un ADMIN completo, nunca hacia otro ADMIN ni una cuenta suspendida. Entrega un token del
// usuario elegido, de SOLO LECTURA (auth.bloqueoSoloLecturaVerComo) y por 30 minutos; nunca la
// contraseña. El Historial guarda el inicio y el fin (quién, a quién, cuándo).
const { VER_COMO_MINUTOS, firmarTokenVerComo, permisosDeCuenta, revocarToken } = require('../auth');
const { toPublicUser } = require('./shared');

router.post(
  '/admin/ver-como/fin',
  requireActor,
  wrap((req, res) => {
    const vc = req.auth && req.auth.verComo;
    if (!vc || !req.auth.soloLectura) return res.status(400).json({ error: 'No estás viendo como otro usuario' });
    revocarToken(req.auth); // el token «ver como» deja de servir de inmediato
    logEvent('VER_COMO_FIN', req.actor, (vc.adminNombre || 'Administrador') + ' (@' + vc.adminUser + ')', 'Terminó de ver la plataforma como este usuario');
    res.json({ ok: true });
  })
);

router.post(
  '/admin/ver-como/:id',
  requireActor,
  wrap((req, res) => {
    if (!isFullAdmin(req.actor) || (req.auth && req.auth.soloLectura)) return res.status(403).json({ error: 'Solo el administrador puede ver como otro usuario' });
    if (!/^[1-9]\d{0,9}$/.test(String(req.params.id))) return res.status(404).json({ error: 'Usuario no encontrado' });
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(req.params.id));
    if (!row) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (row.rol === 'ADMIN') return res.status(403).json({ error: 'No se puede ver como otro administrador' });
    if (!row.active) return res.status(400).json({ error: 'La cuenta está suspendida' });
    const token = firmarTokenVerComo(row, req.actor);
    const pub = toPublicUser(row);
    pub.perms = permisosDeCuenta(row.rol, pub.perms);
    pub.debeCambiarPassword = false; // solo lectura: no se le pide cambiar la clave
    const expira = new Date(Date.now() + VER_COMO_MINUTOS * 60 * 1000).toISOString();
    logEvent('VER_COMO_INICIO', row, actorLabel(req.actor), 'Ver como este usuario, solo lectura, ' + VER_COMO_MINUTOS + ' minutos');
    res.json({ token, user: pub, expira, minutos: VER_COMO_MINUTOS });
  })
);

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
