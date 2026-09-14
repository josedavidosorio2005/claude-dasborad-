// users.js — Usuarios de demo, uno por rol (ALL_ROLES de validation.js), con
// permisos por campana/cliente ya puestos para poder probar la matriz de
// permisos y abrir los 12 dashboards de cliente de una.
'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { seedOnce } = require('./marks');

const TABLA = 'users';
const PREFIJO = 'demo_';

// Nombre EXACTO del asesor demo: debe coincidir con uno de los asesores que
// calidad.js siembra en ORLANT (mismo string, sin importar mayusculas/tilde
// para el matching de /monitoreos/mios, pero se guarda igual en ambos sitios
// para que "Mis Resultados" del usuario ASESOR de demo muestre datos reales).
const ASESOR_DEMO_NOMBRE = 'Daniel Osorio Vega';
const ASESOR_DEMO_CAMPANA = 'ORLANT';

function nowStr() {
  const d = new Date();
  const pad = (n) => (n < 10 ? '0' + n : '' + n);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function withScopedPerms(base, prefix, values) {
  const out = { ...base };
  values.forEach((v) => {
    out[prefix + v] = true;
  });
  return out;
}

function randomPassword() {
  // 16 caracteres legibles (sin ambiguos 0/O/1/l/I), cumple PASSWORD_MIN=8.
  const alfabeto = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  const bytes = crypto.randomBytes(16);
  let out = '';
  for (let i = 0; i < 16; i++) out += alfabeto[bytes[i] % alfabeto.length];
  return out;
}

function demoUserDefs(clientesList, campanasCalidad) {
  return [
    {
      key: 'admin',
      nombre: 'Demo Administrador',
      rol: 'ADMIN',
      perms: { isAdmin: true },
    },
    {
      key: 'aux_admin',
      nombre: 'Demo Auxiliar Admin',
      rol: 'AUX_ADMIN',
      perms: {
        crearUsuarios: true,
        editarUsuarios: true,
        cambiarPassword: true,
        suspenderUsuarios: false,
        eliminarUsuarios: false,
        gestionPermisos: false,
      },
    },
    {
      key: 'calidad',
      nombre: 'Demo Calidad',
      rol: 'CALIDAD',
      perms: withScopedPerms({ Calidad: true }, 'campana_', campanasCalidad),
    },
    {
      key: 'inventario',
      nombre: 'Demo Inventario',
      rol: 'INVENTARIO',
      perms: { Inventario: true },
    },
    {
      key: 'gerencia',
      nombre: 'Demo Gerencia',
      rol: 'GERENCIA',
      perms: withScopedPerms({ Calidad: true, Gerencia: true }, 'campana_', campanasCalidad),
    },
    {
      key: 'gestion_humana',
      nombre: 'Demo Gestion Humana',
      rol: 'GESTION_HUMANA',
      perms: { GestionHumana: true },
    },
    {
      key: 'clientes_dash',
      nombre: 'Demo Dashboard Clientes',
      rol: 'CLIENTES_DASH',
      perms: withScopedPerms({ ClientesDash: true }, 'cliente_', clientesList),
    },
    {
      key: 'supervisor',
      nombre: 'Demo Supervisor',
      rol: 'SUPERVISOR',
      perms: {
        ...withScopedPerms({ ClientesDash: true }, 'cliente_', clientesList),
        ...withScopedPerms({ Calidad: true }, 'campana_', campanasCalidad),
      },
    },
    {
      key: 'asesor',
      nombre: ASESOR_DEMO_NOMBRE,
      rol: 'ASESOR',
      asesorCampana: ASESOR_DEMO_CAMPANA,
      perms: {},
    },
    {
      key: 'reportes',
      nombre: 'Demo Reportes',
      rol: 'REPORTES',
      perms: withScopedPerms({ Calidad: true, cargarDatos: true }, 'campana_', campanasCalidad),
    },
  ];
}

// Crea (o reutiliza) los usuarios de demo. Devuelve:
//   { porRol: { CALIDAD: {id,nombre,user}, ... }, creadosConPassword: [{user,password,rol}] }
// `creadosConPassword` solo trae los que se CREARON en esta corrida (para
// imprimir la contrasena una sola vez; en una relacion ya existente no se
// toca ni se vuelve a mostrar, porque el hash no se puede revertir a texto plano).
function seedUsers(db, { clientesList, campanasCalidad }) {
  const defs = demoUserDefs(clientesList, campanasCalidad);
  const porRol = {};
  const creadosConPassword = [];

  const insertUser = db.prepare(`
    INSERT INTO users (nombre, user, rol, active, password_hash, perms, asesorCampana, createdAt)
    VALUES (@nombre, @user, @rol, 1, @password_hash, @perms, @asesorCampana, @createdAt)
  `);

  for (const def of defs) {
    const user = PREFIJO + def.key;
    let password = null;
    const { created, id } = seedOnce(db, TABLA, user, () => {
      password = randomPassword();
      const info = insertUser.run({
        nombre: def.nombre,
        user,
        rol: def.rol,
        password_hash: bcrypt.hashSync(password, 10),
        perms: JSON.stringify(def.perms),
        asesorCampana: def.asesorCampana || null,
        createdAt: nowStr(),
      });
      return info.lastInsertRowid;
    });
    const row = db.prepare('SELECT id, nombre, user, rol FROM users WHERE id = ?').get(id);
    if (!row) continue; // marca huerfana (fila borrada a mano) — se ignora, seed:demo:limpiar ya la habria limpiado
    porRol[def.rol] = row;
    if (created) creadosConPassword.push({ user, password, rol: def.rol, nombre: def.nombre });
  }

  return { porRol, creadosConPassword, ASESOR_DEMO_NOMBRE, ASESOR_DEMO_CAMPANA };
}

// Regenera la contrasena de TODOS los usuarios demo_* ya sembrados (marcados
// en seed_demo_marcas, tabla 'users'), sin tocar nombre/rol/perms/asesorCampana
// ni ningun otro dato sembrado. Para usarse cuando una contrasena de demo se
// filtro (p.ej. en un log de CI) y hay que invalidarla de verdad, no solo
// dejar de imprimirla de ahi en adelante. Devuelve { rotadas: [{user,password,rol,nombre}] }.
function rotarClaves(db) {
  const marcas = db.prepare("SELECT rowId FROM seed_demo_marcas WHERE tabla = ?").all(TABLA);
  const update = db.prepare('UPDATE users SET password_hash = ? WHERE id = ?');
  const rotadas = [];
  for (const m of marcas) {
    const row = db.prepare('SELECT id, nombre, user, rol FROM users WHERE id = ?').get(m.rowId);
    if (!row) continue; // marca huerfana (usuario borrado a mano) — se ignora
    const password = randomPassword();
    update.run(bcrypt.hashSync(password, 10), row.id);
    rotadas.push({ user: row.user, password, rol: row.rol, nombre: row.nombre });
  }
  return { rotadas };
}

module.exports = { seedUsers, rotarClaves, ASESOR_DEMO_NOMBRE, ASESOR_DEMO_CAMPANA, randomPassword };
