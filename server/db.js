// db.js — Base de datos SQLite (archivo local, sin necesidad de servidor de BD aparte)
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const config = require('./config');

const DB_PATH =
  config.dbPath || path.join(__dirname, 'data', 'inconexion.db');

// ── Apertura robusta ────────────────────────────────────────
// Si el directorio no se puede crear o el archivo no es accesible (disco de solo
// lectura, permisos, ruta invalida), fallamos con un mensaje claro en vez de
// arrancar con una BD rota.
let db;
try {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
} catch (err) {
  process.stderr.write(
    '\n[db] No se pudo abrir la base de datos SQLite.\n' +
      `     Ruta: ${DB_PATH}\n` +
      `     Motivo: ${err.message}\n\n` +
      '     Revisa que el directorio exista, tenga permisos de escritura y que\n' +
      '     el disco no sea de solo lectura. En Docker, monta un volumen sobre\n' +
      '     server/data/ (ver docker-compose.yml).\n\n'
  );
  process.exit(1);
}

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  user TEXT NOT NULL UNIQUE,
  rol TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  password_hash TEXT NOT NULL,
  perms TEXT NOT NULL DEFAULT '{}',
  asesorCampana TEXT,
  createdAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS historial (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts INTEGER NOT NULL,
  fecha TEXT NOT NULL,
  accion TEXT NOT NULL,
  nombre TEXT,
  username TEXT,
  rol TEXT,
  actor TEXT,
  detalle TEXT
);
`);

// Semilla inicial: solo se ejecuta si la tabla users está vacía.
// Las contraseñas de ejemplo se hashean con bcrypt (nunca texto plano).
const count = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
if (count === 0) {
  const insert = db.prepare(`
    INSERT INTO users (nombre, user, rol, active, password_hash, perms, asesorCampana, createdAt)
    VALUES (@nombre, @user, @rol, @active, @password_hash, @perms, @asesorCampana, @createdAt)
  `);
  const seedUsers = [
    { nombre: 'Carlos Rodriguez', user: 'crodriguez', rol: 'CALIDAD', password: 'calidad123',
      perms: { Calidad: true, Inventario: false, Gerencia: false, ClientesDash: false } },
    { nombre: 'Maria Lopez', user: 'mlopez', rol: 'INVENTARIO', password: 'inv123',
      perms: { Calidad: false, Inventario: true, Gerencia: false, ClientesDash: false } },
    { nombre: 'Jorge Herrera', user: 'jherrera', rol: 'GERENCIA', password: 'ger123',
      perms: { Calidad: true, Inventario: false, Gerencia: true, ClientesDash: false } },
    { nombre: 'Ana Gomez', user: 'agomez', rol: 'CLIENTES_DASH', password: 'cli123',
      perms: { Calidad: false, Inventario: false, Gerencia: false, ClientesDash: true } },
    { nombre: 'Laura Rios', user: 'lrios', rol: 'AUX_ADMIN', password: 'aux123',
      perms: { crearUsuarios: false, editarUsuarios: false, cambiarPassword: false,
               suspenderUsuarios: false, eliminarUsuarios: false, gestionPermisos: false } },
    { nombre: 'Pedro Suarez', user: 'psuarez', rol: 'ADMIN', password: 'admin456',
      perms: { isAdmin: true } }
  ];
  const now = new Date();
  const pad = n => (n < 10 ? '0' + n : '' + n);
  const nowStr = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

  const tx = db.transaction((rows) => {
    for (const r of rows) {
      insert.run({
        nombre: r.nombre,
        user: r.user,
        rol: r.rol,
        active: 1,
        password_hash: bcrypt.hashSync(r.password, 10),
        perms: JSON.stringify(r.perms),
        asesorCampana: null,
        createdAt: nowStr
      });
    }
  });
  tx(seedUsers);
  if (!config.isTest) {
    console.log('[db] Base de datos inicializada con usuarios de ejemplo (contrasenas hasheadas con bcrypt).');
    console.log('[db] IMPORTANTE: cambia estas contrasenas de ejemplo antes de usar en produccion.');
  }
}

// Cierre ordenado (graceful shutdown / tests). Idempotente.
function closeDb() {
  try {
    if (db && db.open) db.close();
  } catch (_) {
    /* ya cerrada */
  }
}

module.exports = db;
module.exports.closeDb = closeDb;
module.exports.DB_PATH = DB_PATH;
