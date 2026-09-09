// db.js — Base de datos SQLite (archivo local, sin necesidad de servidor de BD aparte)
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const Database = require('better-sqlite3');
const config = require('./config');
const { PLANTILLAS } = require('./calidad-plantillas-seed');
const { CONFIGS } = require('./dashboard-config-seed');

const DB_PATH =
  config.dbPath || path.join(__dirname, 'data', 'inconexion.db');

const CLIENTES_LIST = [
  'ORLANT',
  'HOSPITAL LA MARIA',
  'CLINICA AURORA',
  'TELEVENTAS SURA',
  'TELEVENTAS COMFAMA',
  'PANTERA MAIKERS',
  'ANDRES YEPES',
  'MOVILIZE',
  'SASCHA FITNESS',
  'ALBERTO LINERO GO',
  'INFONDO',
  'BIVETT',
];

const CAMPANAS_CALIDAD = [
  'ORLANT',
  'HOSPITAL LA MARIA',
  'CLINICA AURORA',
  'TELEVENTAS SURA',
  'TELEVENTAS COMFAMA',
  'ANDRES YEPES',
  'MOVILIZE',
  'SASCHA FITNESS',
  'INFONDO',
  'BIVETT',
  'CONSULTORIO JULIAN MOLANO',
  'CARTERA INTERNA',
];

function withScopedPerms(base, prefix, values) {
  const out = { ...base };
  values.forEach((v) => {
    out[prefix + v] = true;
  });
  return out;
}

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

CREATE TABLE IF NOT EXISTS schema_migrations (
  name TEXT PRIMARY KEY,
  appliedAt TEXT NOT NULL
);

-- ── Modulo de Calidad ────────────────────────────────────────
-- Plantilla de calificacion por campana (items, pesos, criticos, motor).
-- Unica fuente de verdad del formato de evaluacion; el frontend la consume por API.
CREATE TABLE IF NOT EXISTS calidad_plantillas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campana TEXT NOT NULL UNIQUE,
  engine TEXT NOT NULL DEFAULT 'standard',
  items TEXT NOT NULL,               -- JSON: [{n,cat,label,weight,critico}]
  activo INTEGER NOT NULL DEFAULT 1,
  updatedAt TEXT NOT NULL
);

-- Un monitoreo de calidad por asesor/campana/fecha, con sus respuestas y el
-- puntaje resultante. El puntaje/clasificacion/fallos los calcula el servidor
-- a partir de la plantilla + respuestas (calidad-logic.js), nunca el cliente.
CREATE TABLE IF NOT EXISTS monitoreos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campana TEXT NOT NULL,
  asesor TEXT NOT NULL,
  fecha TEXT NOT NULL,               -- YYYY-MM-DD
  mes TEXT NOT NULL,                 -- YYYY-MM (derivado de fecha; indexado)
  canal TEXT NOT NULL DEFAULT 'LLAMADA',   -- LLAMADA | WPP
  idLlamada TEXT,
  telefono TEXT,
  codificacion TEXT,
  evaluador TEXT NOT NULL,           -- nombre visible del evaluador
  evaluadorUserId INTEGER,           -- users.id de quien lo registro (trazabilidad)
  answers TEXT NOT NULL,             -- JSON: { "1":"SI", "2":"NO", ... }
  puntaje REAL,
  clasificacion TEXT,
  fallos INTEGER,
  nivelCritico TEXT,
  observaciones TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT,
  FOREIGN KEY (evaluadorUserId) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_monitoreos_campana_mes ON monitoreos(campana, mes);
CREATE INDEX IF NOT EXISTS idx_monitoreos_evaluador ON monitoreos(evaluadorUserId);

-- Programacion mensual de metas de monitoreo por lider/campana (cronograma).
-- Las metas derivadas (por asesor, diaria, semanales) se calculan al vuelo.
CREATE TABLE IF NOT EXISTS cronograma_metas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campana TEXT NOT NULL,
  mes TEXT NOT NULL,                 -- YYYY-MM
  liderId INTEGER,                   -- users.id (rol CALIDAD/SUPERVISOR); NULL = "Sin asignar"
  liderNombre TEXT NOT NULL,
  metaGrupal INTEGER NOT NULL,
  asesores INTEGER NOT NULL DEFAULT 1,
  diasLaborales INTEGER NOT NULL DEFAULT 19,
  whatsapp INTEGER NOT NULL DEFAULT 0,
  pctWhatsapp INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  UNIQUE(campana, mes, liderId),
  FOREIGN KEY (liderId) REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_cronograma_campana_mes ON cronograma_metas(campana, mes);

-- ── Dashboards de cliente: datos operativos cargados por Excel (Fase 2) ──
-- Una fila = un archivo cargado para (cliente, seccion, periodo). Volver a
-- subir el mismo periodo reemplaza la fila (UNIQUE). La columna filas guarda el
-- contenido ya parseado y normalizado (JSON: array de objetos columna->valor).
CREATE TABLE IF NOT EXISTS dashboard_cargas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente TEXT NOT NULL,
  seccion TEXT NOT NULL,
  cadencia TEXT NOT NULL,            -- diaria | semanal | mensual
  periodo TEXT NOT NULL,             -- AAAA-MM | AAAA-MM-DD | AAAA-Www
  filas TEXT NOT NULL,               -- JSON
  archivoNombre TEXT,
  cargadoPor INTEGER,
  cargadoPorNombre TEXT,
  cargadoEn TEXT NOT NULL,
  UNIQUE(cliente, seccion, periodo),
  FOREIGN KEY (cargadoPor) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_dashboard_cargas_cliente ON dashboard_cargas(cliente, seccion);

-- Configuracion de cada dashboard de cliente (Fase 3): define, como datos, que
-- paneles tiene, en que orden y de que fuente sale cada uno. Crear un dashboard
-- nuevo = insertar una fila aqui (desde el panel de administracion), no escribir
-- codigo. Los 3 dashboards existentes se siembran desde dashboard-config-seed.js.
CREATE TABLE IF NOT EXISTS dashboards_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente TEXT NOT NULL UNIQUE,
  titulo TEXT NOT NULL,
  vista TEXT,                        -- JSON {campo,label,opciones[]} o NULL
  secciones TEXT NOT NULL,           -- JSON: plantillas de carga por Excel
  layout TEXT NOT NULL,              -- JSON: { kpis:[], tabs:[{key,label,panels:[]}] }
  activo INTEGER NOT NULL DEFAULT 1,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

-- ── Modulo de Inventario ─────────────────────────────────────
-- Items de stock: equipo, materiales, suministros de la operacion.
CREATE TABLE IF NOT EXISTS inventario_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'General',
  descripcion TEXT DEFAULT '',
  cantidad INTEGER NOT NULL DEFAULT 0,
  unidad TEXT NOT NULL DEFAULT 'un',
  ubicacion TEXT DEFAULT '',
  estado TEXT NOT NULL DEFAULT 'Disponible',  -- Disponible | En Uso | Mantenimiento | Dado de Baja
  proveedor TEXT DEFAULT '',
  costoUnitario REAL DEFAULT 0,
  observaciones TEXT DEFAULT '',
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_inv_items_categoria ON inventario_items(categoria);
CREATE INDEX IF NOT EXISTS idx_inv_items_estado ON inventario_items(estado);

-- Movimientos de stock: entradas, salidas, transferencias y ajustes.
CREATE TABLE IF NOT EXISTS inventario_movimientos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  itemId INTEGER NOT NULL,
  tipo TEXT NOT NULL,                -- Entrada | Salida | Ajuste | Transferencia
  cantidad INTEGER NOT NULL,
  fecha TEXT NOT NULL,               -- YYYY-MM-DD
  motivo TEXT DEFAULT '',
  destino TEXT DEFAULT '',           -- Para transferencias
  registradoPor INTEGER,
  registradoPorNombre TEXT DEFAULT '',
  createdAt TEXT NOT NULL,
  FOREIGN KEY (itemId) REFERENCES inventario_items(id) ON DELETE CASCADE,
  FOREIGN KEY (registradoPor) REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_inv_movimientos_item ON inventario_movimientos(itemId);
CREATE INDEX IF NOT EXISTS idx_inv_movimientos_fecha ON inventario_movimientos(fecha);

-- ── Modulo de Gerencia ───────────────────────────────────────
-- Indicadores ejecutivos mensuales cargados desde Excel.
-- Cada fila es un KPI con su valor para un periodo dado.
CREATE TABLE IF NOT EXISTS gerencia_kpis (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  periodo TEXT NOT NULL,             -- YYYY-MM
  nombre TEXT NOT NULL,              -- Nombre del KPI
  categoria TEXT NOT NULL DEFAULT 'General',
  valor REAL NOT NULL DEFAULT 0,
  unidad TEXT NOT NULL DEFAULT '',   -- %, USD, horas, llamadas, etc.
  meta REAL,                         -- Meta / target (null si no aplica)
  observaciones TEXT DEFAULT '',
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  UNIQUE(periodo, nombre)
);
CREATE INDEX IF NOT EXISTS idx_gerencia_periodo ON gerencia_kpis(periodo);
CREATE INDEX IF NOT EXISTS idx_gerencia_categoria ON gerencia_kpis(categoria);
`);

// Semilla de configuracion de dashboards: idempotente por cliente. Inserta las
// configuraciones de dashboard-config-seed.js que aun no existan en la tabla
// (asi las plantillas nuevas llegan tambien a bases ya creadas), sin tocar las
// que un admin haya editado.
{
  const now = new Date().toISOString();
  const insertCfg = db.prepare(
    `INSERT INTO dashboards_config (cliente, titulo, vista, secciones, layout, activo, createdAt, updatedAt)
     VALUES (@cliente, @titulo, @vista, @secciones, @layout, 1, @now, @now)`
  );
  const existe = db.prepare('SELECT 1 FROM dashboards_config WHERE cliente = ?');
  const txc = db.transaction((rows) => {
    let n = 0;
    for (const c of rows) {
      if (existe.get(c.cliente)) continue;
      insertCfg.run({
        cliente: c.cliente,
        titulo: c.titulo,
        vista: c.vista ? JSON.stringify(c.vista) : null,
        secciones: JSON.stringify(c.secciones),
        layout: JSON.stringify(c.layout),
        now,
      });
      n++;
    }
    return n;
  });
  const nuevos = txc(CONFIGS);
  if (nuevos && !config.isTest) {
    console.log(`[db] ${nuevos} dashboard(s) de cliente inicializados desde configuracion.`);
  }
}

// Semilla de plantillas de calidad: solo si la tabla esta vacia.
const plantillasCount = db.prepare('SELECT COUNT(*) AS c FROM calidad_plantillas').get().c;
if (plantillasCount === 0) {
  const now = new Date().toISOString();
  const insertPlantilla = db.prepare(
    `INSERT INTO calidad_plantillas (campana, engine, items, activo, updatedAt)
     VALUES (@campana, @engine, @items, 1, @updatedAt)`
  );
  const txp = db.transaction((rows) => {
    for (const p of rows) {
      insertPlantilla.run({
        campana: p.campana,
        engine: p.engine,
        items: JSON.stringify(p.items),
        updatedAt: now,
      });
    }
  });
  txp(PLANTILLAS);
  if (!config.isTest) {
    console.log(`[db] ${PLANTILLAS.length} plantillas de calidad inicializadas.`);
  }
}

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
      perms: withScopedPerms({ Calidad: true, Inventario: false, Gerencia: false, ClientesDash: false }, 'campana_', CAMPANAS_CALIDAD) },
    { nombre: 'Maria Lopez', user: 'mlopez', rol: 'INVENTARIO', password: 'inv123',
      perms: { Calidad: false, Inventario: true, Gerencia: false, ClientesDash: false } },
    { nombre: 'Jorge Herrera', user: 'jherrera', rol: 'GERENCIA', password: 'ger123',
      perms: withScopedPerms({ Calidad: true, Inventario: false, Gerencia: true, ClientesDash: false }, 'campana_', CAMPANAS_CALIDAD) },
    { nombre: 'Ana Gomez', user: 'agomez', rol: 'CLIENTES_DASH', password: 'cli123',
      perms: withScopedPerms({ Calidad: false, Inventario: false, Gerencia: false, ClientesDash: true }, 'cliente_', CLIENTES_LIST) },
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

function hasAnyPermWithPrefix(perms, prefix) {
  return Object.keys(perms || {}).some((k) => k.startsWith(prefix));
}

function addMissingScopedPerms(perms, prefix, values) {
  const next = { ...(perms || {}) };
  values.forEach((v) => {
    const key = prefix + v;
    if (next[key] === undefined) next[key] = true;
  });
  return next;
}

function runOnceMigration(name, fn) {
  const done = db.prepare('SELECT name FROM schema_migrations WHERE name = ?').get(name);
  if (done) return;
  fn();
  db.prepare('INSERT INTO schema_migrations (name, appliedAt) VALUES (?, ?)').run(
    name,
    new Date().toISOString()
  );
}

runOnceMigration('scoped_permissions_v1', () => {
  const rows = db.prepare('SELECT id, rol, perms FROM users').all();
  const update = db.prepare('UPDATE users SET perms = ? WHERE id = ?');
  const tx = db.transaction((usersToMigrate) => {
    for (const row of usersToMigrate) {
      let perms;
      try {
        perms = JSON.parse(row.perms || '{}');
      } catch (_) {
        perms = {};
      }
      let next = perms;
      if (
        (row.rol === 'CLIENTES_DASH' || row.rol === 'SUPERVISOR') &&
        perms.ClientesDash === true &&
        !hasAnyPermWithPrefix(perms, 'cliente_')
      ) {
        next = addMissingScopedPerms(next, 'cliente_', CLIENTES_LIST);
      }
      if (
        (row.rol === 'CALIDAD' || row.rol === 'REPORTES' || row.rol === 'SUPERVISOR' || row.rol === 'GERENCIA') &&
        perms.Calidad === true &&
        !hasAnyPermWithPrefix(perms, 'campana_')
      ) {
        next = addMissingScopedPerms(next, 'campana_', CAMPANAS_CALIDAD);
      }
      if (JSON.stringify(next) !== JSON.stringify(perms)) {
        update.run(JSON.stringify(next), row.id);
      }
    }
  });
  tx(rows);
  if (!config.isTest) {
    console.log('[db] Migracion scoped_permissions_v1 aplicada.');
  }
});

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
