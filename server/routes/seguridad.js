// routes/seguridad.js — Fase 113 (tema A): aviso al admin sobre actividad de
// login sospechosa, calculado EN VIVO sobre el Historial (sin tabla ni
// estado propio -- no hay "marcar como visto": si la condicion ya no es
// cierta, el aviso deja de salir solo). Dos condiciones, ambas pedidas por
// el usuario:
//   - 10 o mas intentos fallidos (misma cuenta) en las ultimas 24h.
//   - Login EXITOSO en una cuenta ADMIN/AUX_ADMIN desde una IP que esa
//     cuenta nunca habia usado antes para entrar (sin correo, solo el aviso
//     en el panel -- mismo patron visual que la alerta de Calidad).
const express = require('express');
const db = require('../db');
const { requireActor, isFullAdmin } = require('../auth');
const { wrap } = require('./shared');

const router = express.Router();

const VENTANA_24H_MS = 24 * 60 * 60 * 1000;

router.get(
  '/seguridad/alertas',
  requireActor,
  wrap((req, res) => {
    // Mismo criterio que el Historial (routes/historial.js): solo admin
    // maestro o rol ADMIN, nunca AUX_ADMIN.
    if (!isFullAdmin(req.actor)) {
      return res.status(403).json({ error: 'Sin permiso para ver las alertas de seguridad' });
    }

    const desde = Date.now() - VENTANA_24H_MS;

    const fallosMasivos = db
      .prepare(
        `SELECT username, COUNT(*) AS intentos FROM historial
         WHERE accion = 'LOGIN_FALLIDO' AND ts >= ?
         GROUP BY username HAVING COUNT(*) >= 10
         ORDER BY intentos DESC`
      )
      .all(desde)
      .map((r) => ({ username: r.username, intentos: r.intentos }));

    // IPs nuevas en logins ADMIN/AUX_ADMIN: se recorren TODOS los logins
    // exitosos de cuentas administrativas en orden cronologico, marcando la
    // primera vez que se ve cada (username, ip) -- si esa primera vez cae
    // dentro de las ultimas 24h, se reporta. Una cuenta nueva cuyo PRIMER
    // login de siempre cae en esta ventana tambien se reporta (no hay forma
    // de distinguir "IP nunca vista" de "cuenta nunca vista" sin una base
    // previa, y es preferible avisar de mas en ese caso que dejarlo pasar).
    const loginsAdmin = db
      .prepare(
        `SELECT username, ip, ts FROM historial
         WHERE accion = 'LOGIN_OK' AND rol IN ('ADMIN','AUX_ADMIN') AND ip IS NOT NULL
         ORDER BY ts ASC`
      )
      .all();
    const ipsConocidas = new Map(); // username -> Set<ip>
    const ipsNuevasAdmin = [];
    for (const fila of loginsAdmin) {
      const vistas = ipsConocidas.get(fila.username) || new Set();
      const esNueva = !vistas.has(fila.ip);
      if (esNueva) {
        if (fila.ts >= desde) ipsNuevasAdmin.push({ username: fila.username, ip: fila.ip, ts: fila.ts });
        vistas.add(fila.ip);
      }
      ipsConocidas.set(fila.username, vistas);
    }

    res.json({ fallosMasivos, ipsNuevasAdmin });
  })
);

module.exports = router;
