// routes/usuarios.js — CRUD de usuarios. Extraido de server.js (Radiografia
// InConexion, #3): solo se movio el cableado HTTP, sin tocar ninguna regla
// de negocio.
const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { requireAuth, requirePermission, requireActor, isFullAdmin, can } = require('../auth');
const { validate, schemas } = require('../validation');
const { wrap, nowStr, logEvent, actorLabel, toPublicUser, MASTER_ADMIN_USER } = require('./shared');

const router = express.Router();

// Defaults de permisos ligados al rol (feedback de Edwin 2.1).
// El rol REPORTES es quien monta los datos que alimentan los dashboards, asi que
// siempre trae `cargarDatos: true` sin que nadie se lo asigne a mano — al crear
// el usuario y al cambiarle el rol a REPORTES.
function applyRolePermDefaults(rol, perms) {
  const p = perms && typeof perms === 'object' ? { ...perms } : {};
  if (rol === 'REPORTES') p.cargarDatos = true;
  return p;
}

// Fase 102 (escalada de privilegios, hallazgo real): ADMIN/AUX_ADMIN son un
// LIMITE ESTRUCTURAL, no un permiso puntual -- ya existia esta regla en el
// frontend (dashRolesVisibles, public/js/dashboards-logic.js: "un Auxiliar
// Admin no puede tocar ADMIN/AUX_ADMIN") pero el servidor nunca la volvia a
// exigir: bastaba el permiso puntual `crearUsuarios`/`editarUsuarios` (que
// puede tener CUALQUIER rol, ese es el proposito de AUX_ADMIN) para crear o
// editar un usuario con `rol: 'ADMIN'`, incluido el propio actor. Ahora solo
// un admin completo (isFullAdmin) puede asignar/mantener esos 2 roles.
const ROLES_ESTRUCTURALES = ['ADMIN', 'AUX_ADMIN'];
function puedeAsignarRol(actor, rol) {
  return !ROLES_ESTRUCTURALES.includes(rol) || isFullAdmin(actor);
}

router.get(
  '/users',
  requireActor,
  wrap((req, res) => {
    const rows = db.prepare('SELECT * FROM users ORDER BY id').all();
    // La matriz de permisos de TODOS los usuarios solo la ve quien administra
    // usuarios o permisos (o el admin). El resto recibe la lista con `perms`
    // vacio: los selects que la consumen (asesor, lider) usan id/nombre/rol/
    // asesorCampana, y las pantallas que necesitan `perms` ajenos (gestion de
    // permisos, cronograma de metas, matriz de Reportes) son de rol privilegiado.
    const fullView =
      isFullAdmin(req.actor) ||
      can(req.actor, 'gestionPermisos') ||
      can(req.actor, 'crearUsuarios') ||
      can(req.actor, 'editarUsuarios');
    res.json(
      rows.map(toPublicUser).map((u) => (fullView ? u : { ...u, perms: {} }))
    );
  })
);

router.post(
  '/users',
  requireAuth,
  requirePermission('crearUsuarios'),
  validate(schemas.createUserBody),
  wrap(async (req, res) => {
    const { nombre, user, password, rol, perms, asesorCampana } = req.body;
    if (user === MASTER_ADMIN_USER) return res.status(400).json({ error: 'Nombre de usuario reservado' });
    if (!puedeAsignarRol(req.actor, rol)) {
      return res.status(403).json({ error: 'Solo un administrador completo puede crear un usuario ADMIN o AUX_ADMIN' });
    }
    const exists = db.prepare('SELECT id FROM users WHERE user = ?').get(user);
    if (exists) return res.status(409).json({ error: 'Ese usuario ya existe' });

    const hash = await bcrypt.hash(password, 10);
    const info = db
      .prepare(
        `INSERT INTO users (nombre, user, rol, active, password_hash, perms, asesorCampana, createdAt)
         VALUES (?,?,?,1,?,?,?,?)`
      )
      .run(nombre, user, rol, hash, JSON.stringify(applyRolePermDefaults(rol, perms)), asesorCampana || null, nowStr());
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
    logEvent('CREADO', row, actorLabel(req.actor), `Rol: ${rol}`);
    res.status(201).json(toPublicUser(row));
  })
);

router.put(
  '/users/:id',
  requireAuth,
  requirePermission('editarUsuarios'),
  validate(schemas.idParamSchema, 'params'),
  validate(schemas.updateUserBody),
  wrap(async (req, res) => {
    const id = req.params.id;
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!row) return res.status(404).json({ error: 'Usuario no encontrado' });

    const { nombre, user, rol, password, perms, asesorCampana } = req.body;
    if (user && user === MASTER_ADMIN_USER) return res.status(400).json({ error: 'Nombre de usuario reservado' });
    if (user) {
      const dupe = db.prepare('SELECT id FROM users WHERE user = ? AND id != ?').get(user, id);
      if (dupe) return res.status(409).json({ error: 'Ese usuario ya existe' });
    }
    if (rol !== undefined) {
      // Nadie cambia su propio rol por esta via -- ni siquiera un admin
      // completo (evita un auto-bloqueo o una auto-escalada sin que otra
      // persona lo revise). req.actor.id es null para el admin maestro, que
      // nunca tiene fila propia en `users`, asi que esta comparacion nunca
      // le aplica a el.
      if (req.actor.id != null && req.actor.id === id) {
        return res.status(403).json({ error: 'No puedes cambiar tu propio rol' });
      }
      if (!puedeAsignarRol(req.actor, rol)) {
        return res.status(403).json({ error: 'Solo un administrador completo puede asignar el rol ADMIN o AUX_ADMIN' });
      }
    }

    const newHash = password ? await bcrypt.hash(password, 10) : row.password_hash;
    const effectiveRol = rol ?? row.rol;
    const basePerms = perms ?? JSON.parse(row.perms || '{}');
    db.prepare(
      `UPDATE users SET nombre=?, user=?, rol=?, password_hash=?, perms=?, asesorCampana=? WHERE id=?`
    ).run(
      nombre ?? row.nombre,
      user ?? row.user,
      effectiveRol,
      newHash,
      JSON.stringify(applyRolePermDefaults(effectiveRol, basePerms)),
      asesorCampana ?? row.asesorCampana,
      id
    );
    const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    logEvent('EDITADO', updated, actorLabel(req.actor), 'Datos actualizados');
    res.json(toPublicUser(updated));
  })
);

router.put(
  '/users/:id/password',
  requireAuth,
  requirePermission('cambiarPassword'),
  validate(schemas.idParamSchema, 'params'),
  validate(schemas.changePasswordBody),
  wrap(async (req, res) => {
    const id = req.params.id;
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!row) return res.status(404).json({ error: 'Usuario no encontrado' });
    // Fase 102 (seguridad, hallazgo real): mismo limite que ya existia para
    // crear/editar (puedeAsignarRol) -- sin esto, cualquier actor con SOLO el
    // permiso puntual `cambiarPassword` (asignable a cualquier rol) podia
    // resetear la contrasena de un ADMIN/AUX_ADMIN existente e iniciar sesion
    // como esa cuenta, sin pasar nunca por el chequeo de rol.
    if (!puedeAsignarRol(req.actor, row.rol)) {
      return res.status(403).json({ error: 'Solo un administrador completo puede cambiar la contrasena de un usuario ADMIN o AUX_ADMIN' });
    }
    const hash = await bcrypt.hash(req.body.password, 10);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, id);
    logEvent('PASSWORD', row, actorLabel(req.actor), 'Contrasena cambiada');
    res.json({ ok: true });
  })
);

router.put(
  '/users/:id/active',
  requireAuth,
  requirePermission('suspenderUsuarios'),
  validate(schemas.idParamSchema, 'params'),
  wrap((req, res) => {
    const id = req.params.id;
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!row) return res.status(404).json({ error: 'Usuario no encontrado' });
    const newActive = row.active ? 0 : 1;
    db.prepare('UPDATE users SET active = ? WHERE id = ?').run(newActive, id);
    logEvent(newActive ? 'ACTIVADO' : 'SUSPENDIDO', row, actorLabel(req.actor), '');
    res.json({ ok: true, active: !!newActive });
  })
);

router.put(
  '/users/:id/perms',
  requireAuth,
  requirePermission('gestionPermisos'),
  validate(schemas.idParamSchema, 'params'),
  validate(schemas.updatePermsBody),
  wrap((req, res) => {
    const id = req.params.id;
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!row) return res.status(404).json({ error: 'Usuario no encontrado' });
    db.prepare('UPDATE users SET perms = ? WHERE id = ?').run(JSON.stringify(req.body.perms), id);
    logEvent('PERMISOS', row, actorLabel(req.actor), 'Permisos actualizados');
    res.json({ ok: true });
  })
);

router.delete(
  '/users/:id',
  requireAuth,
  requirePermission('eliminarUsuarios'),
  validate(schemas.idParamSchema, 'params'),
  wrap((req, res) => {
    const id = req.params.id;
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!row) return res.status(404).json({ error: 'Usuario no encontrado' });
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
    logEvent('ELIMINADO', row, actorLabel(req.actor), '');
    res.json({ ok: true });
  })
);

module.exports = router;
