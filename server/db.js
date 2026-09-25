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

-- Nivel de servicio mensual por campana (feedback de Edwin, punto 3.2): % de
-- llamadas contestadas dentro de 20 segundos sobre el total de llamadas.
-- El % y la clasificacion (>=80% cumple) se calculan al vuelo, nunca se guardan.
CREATE TABLE IF NOT EXISTS calidad_nivel_servicio (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campana TEXT NOT NULL,
  mes TEXT NOT NULL,                 -- YYYY-MM
  contestadas20s INTEGER NOT NULL DEFAULT 0,
  llamadasTotales INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  UNIQUE(campana, mes)
);
CREATE INDEX IF NOT EXISTS idx_nivelservicio_campana_mes ON calidad_nivel_servicio(campana, mes);

-- Nivel de servicio DIARIO por campana/skill (Fase 1 del pedido de carga real):
-- una fila por (campana, fecha, skillName), tal cual viene del export del
-- conmutador/PBX. calidad_nivel_servicio (arriba) se recalcula a partir de la
-- suma de estas filas para el mes correspondiente cuando se sube un archivo.
-- Volver a subir el mismo dia para la misma campana/skill reemplaza la fila
-- (mismo criterio que dashboard_cargas), no duplica.
CREATE TABLE IF NOT EXISTS calidad_nivel_servicio_diario (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campana TEXT NOT NULL,
  fecha TEXT NOT NULL,               -- YYYY-MM-DD
  skillName TEXT NOT NULL,           -- SKILL_NAME tal cual vino del archivo (auditoria)
  totalLlamadas INTEGER NOT NULL DEFAULT 0,
  contestadas INTEGER NOT NULL DEFAULT 0,        -- LLAMADAS CONTESTADAS (total, no solo <=20s)
  serviceLevel20secPct REAL,          -- SERVICE_LEVEL_20SEC tal cual (ej. 87.03), puede venir null
  contestadas20sEstimado INTEGER,     -- round(serviceLevel20secPct/100 * totalLlamadas); null si el pct es null
  archivoNombre TEXT NOT NULL DEFAULT '',
  cargadoPorNombre TEXT NOT NULL DEFAULT '',
  createdAt TEXT NOT NULL,
  UNIQUE(campana, fecha, skillName)
);
CREATE INDEX IF NOT EXISTS idx_ns_diario_campana_fecha ON calidad_nivel_servicio_diario(campana, fecha);

-- Trafico de WhatsApp (Fase 50, plantilla real confirmada por Edwin): tabla
-- PROPIA, no una extension de calidad_nivel_servicio_diario -- el grano es
-- distinto (una fila = una cola por un PERIODO fechaInicio..fechaFin, nunca
-- un dia), y mezclar los dos en una sola tabla con un campo "canal" habria
-- forzado columnas nullable segun el canal (AHT no existe aqui, fechaFin no
-- existe en la de voz) y habria roto la logica de agregado diario/mensual
-- que ya existe para voz (trafico-logic.js: traficoAgregar espera UN dia por
-- fila). Alcance actual: solo ORLANT (una campana, sin ambiguedad de a que
-- campana pertenece cada cola), asi que a diferencia de voz no hace falta
-- una tabla de mapeo cola->campana -- campana se manda explicito al subir,
-- como el patron "clasico" de dashboard_cargas. Volver a subir la misma
-- (campana, colaWhatsapp, fechaInicio, fechaFin) reemplaza la fila, no duplica.
CREATE TABLE IF NOT EXISTS trafico_whatsapp (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campana TEXT NOT NULL,
  colaWhatsapp TEXT NOT NULL,          -- NOMBRE_COLA_WHATSAPP tal cual vino del archivo
  fechaInicio TEXT NOT NULL,           -- YYYY-MM-DD
  fechaFin TEXT NOT NULL,              -- YYYY-MM-DD
  totalWhatsapp INTEGER NOT NULL DEFAULT 0,
  contestados INTEGER NOT NULL DEFAULT 0,
  abandonados INTEGER,                 -- opcional; tasaAbandonoPct se recalcula desde este campo, nunca desde un % importado
  serviceLevel10secPct REAL,
  serviceLevel20secPct REAL,
  serviceLevel30secPct REAL,
  asaSegundos REAL,
  ataSegundos REAL,
  archivoNombre TEXT NOT NULL DEFAULT '',
  cargadoPorNombre TEXT NOT NULL DEFAULT '',
  createdAt TEXT NOT NULL,
  UNIQUE(campana, colaWhatsapp, fechaInicio, fechaFin)
);
CREATE INDEX IF NOT EXISTS idx_trafico_whatsapp_campana ON trafico_whatsapp(campana, fechaInicio);

-- Agendas de ORLANT (Fase 78, pedido de Jairo/Edwin): citas asignadas por
-- especialidad. Tabla PROPIA, no dashboard_cargas -- el grano es una fila
-- POR CITA (~7.500 filas/mes), asi que el dashboard nunca descarga filas
-- crudas: solo agregados ya calculados por el servidor (ver
-- routes/agendas.js). Volver a subir un archivo reemplaza por RANGO de
-- fechaSolicitud (primera..ultima del archivo que se sube) -- una cita no
-- trae un identificador propio, asi que no hay upsert posible fila a fila
-- (mismo criterio "reemplaza por periodo" de Trafico, aplicado a un rango
-- de fecha+hora en vez de un mes/skill).
--
-- PRIVACIDAD (obligatorio): 'entidad' NUNCA es el valor crudo de
-- NOMBRE_ENTIDAD del archivo -- el navegador ya la anonimiza ANTES de
-- mandar la carga (agendas-logic.js, agendasAplicarPrivacidadEntidad): si
-- aparece menos de 5 veces en el archivo que se sube, se guarda como
-- 'PARTICULAR / OTRA'; si viene vacia, 'SIN ENTIDAD'. El servidor nunca ve
-- ni guarda el nombre real de un paciente particular.
CREATE TABLE IF NOT EXISTS agendas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campana TEXT NOT NULL,
  asesor TEXT NOT NULL,              -- NOMBRE DE AGENTE
  sede TEXT NOT NULL,
  examen TEXT NOT NULL,              -- NOMBRE_EXAMEN
  especialidad TEXT NOT NULL,
  profesional TEXT NOT NULL,
  fechaSolicitud TEXT NOT NULL,      -- 'AAAA-MM-DD HH:MM:SS', hora local de Colombia (nunca convertida a UTC)
  tipoLinea TEXT NOT NULL,           -- 3P | GENERAL
  entidad TEXT NOT NULL,             -- ya anonimizada, ver nota de arriba
  archivoNombre TEXT NOT NULL DEFAULT '',
  cargadoPorNombre TEXT NOT NULL DEFAULT '',
  createdAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_agendas_campana_fecha ON agendas(campana, fechaSolicitud);
CREATE INDEX IF NOT EXISTS idx_agendas_campana_especialidad ON agendas(campana, especialidad);

-- Mapeo SKILL_NAME (tal cual lo nombra Volvox) -> campana/cliente de
-- InConexion. Los nombres de skill los define Volvox y cambian con el
-- tiempo, asi que este mapeo se administra desde el panel (nunca a mano en
-- el codigo). campana=NULL significa "todavia sin asignar": una carga de
-- trafico para una skill nueva crea su fila aqui automaticamente (para que
-- el admin la vea y la mapee), y mientras tanto sus filas de
-- calidad_nivel_servicio_diario quedan bajo la campana centinela
-- '(SIN ASIGNAR)' — nunca se pierden ni rompen la carga.
CREATE TABLE IF NOT EXISTS trafico_skill_mapeo (
  skillName TEXT PRIMARY KEY,
  campana TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

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

-- ── Modulo de Gestion Humana (Fase 10 — feedback de Edwin) ───
-- Registro de personal por campana/area. Cada fila es una persona; fecha_salida
-- NULL = sigue activo. Alimenta el dashboard GESTION_HUMANA (rotacion, altas/
-- bajas por mes, costo de nomina y rentabilidad por campana).
--
-- costo_hora / horas_mes: dato NUEVO pedido por Edwin para la rentabilidad por
-- campana. Se guarda POR ASESOR (no por campana): la tabla ya es por persona, el
-- costo de una campana sale de sumar el de su gente activa, y asi soporta que
-- alguien cambie de campana o tenga una tarifa distinta. Costo mensual de una
-- persona = costo_hora * horas_mes.
CREATE TABLE IF NOT EXISTS gestion_humana_personal (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  documento TEXT DEFAULT '',           -- cedula / documento (opcional)
  cargo TEXT DEFAULT '',
  campana TEXT NOT NULL DEFAULT 'General',   -- campana / area asignada
  supervisor TEXT DEFAULT '',
  fecha_ingreso TEXT NOT NULL,         -- YYYY-MM-DD
  fecha_salida TEXT,                   -- YYYY-MM-DD o NULL (activo)
  motivo_salida TEXT DEFAULT '',
  costo_hora REAL NOT NULL DEFAULT 0,  -- moneda local / hora
  horas_mes REAL NOT NULL DEFAULT 192, -- horas contratadas al mes (jornada plena CO ~192)
  salario REAL,                        -- opcional, informativo
  observaciones TEXT DEFAULT '',
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_gh_personal_campana ON gestion_humana_personal(campana);
CREATE INDEX IF NOT EXISTS idx_gh_personal_ingreso ON gestion_humana_personal(fecha_ingreso);
CREATE INDEX IF NOT EXISTS idx_gh_personal_salida ON gestion_humana_personal(fecha_salida);

-- Ledger de scripts/seed-demo.js (datos de demostracion): que fila de que
-- tabla sembro, con una clave determinística propia, para poder borrar
-- EXACTAMENTE eso con seed:demo:limpiar. Se crea siempre aqui (no solo cuando
-- se corre el seed) para que GET /api/seed-demo/estado pueda consultarla en
-- cualquier base, incluida una que nunca se haya sembrado.
CREATE TABLE IF NOT EXISTS seed_demo_marcas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tabla TEXT NOT NULL,
  clave TEXT NOT NULL,
  rowId INTEGER NOT NULL,
  createdAt TEXT NOT NULL,
  UNIQUE(tabla, clave)
);

-- Umbrales de semaforo (color por dato) para las tarjetas KPI y celdas de
-- tabla de los dashboards de cliente. Una fila por (metrica, campana):
-- campana='' es el default GLOBAL para esa metrica; una fila con campana
-- especifica la sobreescribe solo para esa campana. Un admin los edita
-- desde el panel (pantalla "Umbrales") y los dashboards los leen en
-- caliente via GET /api/umbrales — cambiar un valor aqui se refleja sin
-- desplegar nada. direccion decide de que lado del umbral queda el verde:
-- 'mayor_es_mejor' (ej. nivel de atencion: verde si valor>=verde) o
-- 'menor_es_mejor' (ej. tasa de abandono: verde si valor<=verde).
CREATE TABLE IF NOT EXISTS umbrales_semaforo (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  metrica TEXT NOT NULL,
  campana TEXT NOT NULL DEFAULT '',
  verde REAL NOT NULL,
  amarillo REAL NOT NULL,
  direccion TEXT NOT NULL DEFAULT 'mayor_es_mejor',
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  UNIQUE(metrica, campana)
);
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

// Semilla de plantillas de calidad: idempotente por campana (igual criterio
// que dashboards_config arriba), asi que agregar una campana nueva a
// PLANTILLAS llega tambien a bases ya creadas (produccion incluida), sin
// tocar las que un admin haya editado desde la API.
{
  const now = new Date().toISOString();
  const insertPlantilla = db.prepare(
    `INSERT INTO calidad_plantillas (campana, engine, items, activo, updatedAt)
     VALUES (@campana, @engine, @items, 1, @updatedAt)`
  );
  const existePlantilla = db.prepare('SELECT 1 FROM calidad_plantillas WHERE campana = ?');
  const txp = db.transaction((rows) => {
    let n = 0;
    for (const p of rows) {
      if (existePlantilla.get(p.campana)) continue;
      insertPlantilla.run({
        campana: p.campana,
        engine: p.engine,
        items: JSON.stringify(p.items),
        updatedAt: now,
      });
      n++;
    }
    return n;
  });
  const nuevasPlantillas = txp(PLANTILLAS);
  if (nuevasPlantillas && !config.isTest) {
    console.log(`[db] ${nuevasPlantillas} plantilla(s) de calidad inicializadas.`);
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

// Fase "Trafico de llamadas" (export real de Volvox, hoja DATA): amplia
// calidad_nivel_servicio_diario con las columnas que trae el reporte y que
// el Fase 1 (carga-diaria) todavia no guardaba. Se decidio EXTENDER esta
// tabla en vez de crear una nueva porque ya comparte la misma llave natural
// (campana+fecha+skillName) y el mismo flujo de carga/recalculo mensual —
// una tabla aparte duplicaria esa logica sin necesidad (ver
// server/nivel-servicio-diario.js). Todas nullable: son opcionales en el
// archivo, y "sin dato" (NULL) es distinto de 0 (ej. 0% de nivel de
// atencion es un dato real). No se agregan directo al CREATE TABLE de
// arriba para que esta migracion funcione igual en una base nueva o en una
// que ya tenia filas (evita el error "duplicate column name").
runOnceMigration('calidad_nivel_servicio_diario_trafico_v1', () => {
  db.exec(`
    ALTER TABLE calidad_nivel_servicio_diario ADD COLUMN llamadasAbandonadas INTEGER;
    ALTER TABLE calidad_nivel_servicio_diario ADD COLUMN serviceLevel10secPct REAL;
    ALTER TABLE calidad_nivel_servicio_diario ADD COLUMN serviceLevel30secPct REAL;
    ALTER TABLE calidad_nivel_servicio_diario ADD COLUMN abandonPct REAL;
    ALTER TABLE calidad_nivel_servicio_diario ADD COLUMN nivelAtencionPct REAL;
    ALTER TABLE calidad_nivel_servicio_diario ADD COLUMN tasaAbandonoPct REAL;
    ALTER TABLE calidad_nivel_servicio_diario ADD COLUMN asaSegundos REAL;
    ALTER TABLE calidad_nivel_servicio_diario ADD COLUMN ataSegundos REAL;
    ALTER TABLE calidad_nivel_servicio_diario ADD COLUMN ahtSegundos INTEGER;
    ALTER TABLE calidad_nivel_servicio_diario ADD COLUMN waitTimeSegundos INTEGER;
  `);
  if (!config.isTest) {
    console.log('[db] Migracion calidad_nivel_servicio_diario_trafico_v1 aplicada.');
  }
});

// Backfill: agrega metrica:'nivel_atencion' a los KPIs "Nivel Atencion*" que
// YA EXISTEN en dashboards_config (ORLANT, CLINICA AURORA, HOSPITAL LA MARIA
// y los generados por plantilla). dashboards_config se siembra "solo si el
// cliente no existe todavia" (ver arriba) — en una base que ya tenia estos
// dashboards (como produccion), el `metrica` nuevo agregado al codigo fuente
// (dashboard-config-seed.js / dashboard-plantillas-cliente.js) NUNCA llega a
// esas filas sin este backfill. Se identifica por tener `semaforo` ya puesto
// (la senal que el KPI usa color) y sin `metrica` todavia — no toca nada que
// un admin haya editado despues (ya tendria su propio metrica o ninguno a
// proposito). Corre una sola vez.
runOnceMigration('dashboards_config_metrica_nivel_atencion_v1', () => {
  const rows = db.prepare('SELECT cliente, layout FROM dashboards_config').all();
  const update = db.prepare('UPDATE dashboards_config SET layout = ? WHERE cliente = ?');
  let tocados = 0;
  for (const row of rows) {
    let layout;
    try {
      layout = JSON.parse(row.layout);
    } catch (e) {
      continue;
    }
    let cambio = false;
    (layout.kpis || []).forEach((k) => {
      if (k && k.semaforo && !k.metrica && /nivel.*atencion/i.test(k.titulo || '')) {
        k.metrica = 'nivel_atencion';
        cambio = true;
      }
    });
    if (cambio) {
      update.run(JSON.stringify(layout), row.cliente);
      tocados++;
    }
  }
  if (!config.isTest && tocados) {
    console.log(`[db] Migracion dashboards_config_metrica_nivel_atencion_v1 aplicada (${tocados} dashboard(s)).`);
  }
});

// Backfill: agrega el tab "Trafico de Llamadas" (panel trafico_combo, sin
// campana fija -> se resuelve por sede en caliente, ver trafico.js) a
// HOSPITAL LA MARIA si ya existia en dashboards_config antes de este cambio
// (mismo motivo que la migracion de arriba: dashboards_config no se
// re-siembra solo). ORLANT y CLINICA AURORA no necesitan esto: su tab de
// trafico ya se agrego en la fase anterior (Volvox), antes de que existiera
// ninguna fila previa que backfillear.
runOnceMigration('dashboards_config_trafico_hlm_v1', () => {
  const row = db.prepare('SELECT cliente, layout FROM dashboards_config WHERE cliente = ?').get('HOSPITAL LA MARIA');
  if (!row) return; // no existe todavia -> ya sale completo del seed normal
  let layout;
  try {
    layout = JSON.parse(row.layout);
  } catch (e) {
    return;
  }
  const yaTiene = (layout.tabs || []).some((t) => (t.panels || []).some((p) => p.tipo === 'trafico_combo'));
  if (yaTiene) return;
  layout.tabs = layout.tabs || [];
  layout.tabs.push({ key: 'trafico', label: 'Trafico de Llamadas', panels: [{ tipo: 'trafico_combo' }] });
  db.prepare('UPDATE dashboards_config SET layout = ? WHERE cliente = ?').run(JSON.stringify(layout), 'HOSPITAL LA MARIA');
  if (!config.isTest) {
    console.log('[db] Migracion dashboards_config_trafico_hlm_v1 aplicada.');
  }
});

// Consolidacion de HOSPITAL LA MARIA: pasa de "2 campanas falsas" (el atajo
// que usaba el trafico Volvox: "HOSPITAL LA MARIA CASTILLA" / "...SEDE33"
// como si fueran campanas distintas) a UNA sola campana ("HOSPITAL LA
// MARIA") con `sede` como atributo de cada fila — el mismo patron que YA
// usaba dashboards_config.vista para los datos operativos (sede='CASTILLA'
// o 'SEDE33', los mismos codigos que sus opciones de vista). Pedido
// explicito de Edwin: nunca perder historico, solo re-etiquetar.
//
// calidad_nivel_servicio (mensual) tenia UNIQUE(campana, mes): con las 2
// sedes compartiendo ahora una sola campana, esa unicidad debe incluir sede
// o un mes con datos de ambas sedes chocaria (o peor, se pisarian entre si,
// ver recalcularMensual en nivel-servicio-diario.js). SQLite no permite
// ALTER TABLE para cambiar un UNIQUE existente, asi que la tabla se recrea
// (patron estandar de SQLite: crear tabla nueva, copiar, borrar la vieja,
// renombrar) ANTES de re-etiquetar filas, para que el retag de abajo nunca
// choque contra la unicidad vieja.
runOnceMigration('hlm_sede_consolidacion_v1', () => {
  const HLM_SEDES = { 'HOSPITAL LA MARIA CASTILLA': 'CASTILLA', 'HOSPITAL LA MARIA SEDE33': 'SEDE33' };
  const HLM = 'HOSPITAL LA MARIA';

  const tx = db.transaction(() => {
    // 1) monitoreos y trafico_skill_mapeo: agregar `sede` (nullable, sin
    // choque de unicidad en ninguna de las dos) via ALTER TABLE simple.
    const monitoreosCols = db.prepare("PRAGMA table_info(monitoreos)").all().map((c) => c.name);
    if (!monitoreosCols.includes('sede')) {
      db.exec('ALTER TABLE monitoreos ADD COLUMN sede TEXT');
    }
    const mapeoCols = db.prepare("PRAGMA table_info(trafico_skill_mapeo)").all().map((c) => c.name);
    if (!mapeoCols.includes('sede')) {
      db.exec('ALTER TABLE trafico_skill_mapeo ADD COLUMN sede TEXT');
    }
    const diarioCols = db.prepare("PRAGMA table_info(calidad_nivel_servicio_diario)").all().map((c) => c.name);
    if (!diarioCols.includes('sede')) {
      db.exec('ALTER TABLE calidad_nivel_servicio_diario ADD COLUMN sede TEXT');
    }

    // 2) calidad_nivel_servicio (mensual): recrear con sede + UNIQUE nueva.
    const mensualCols = db.prepare("PRAGMA table_info(calidad_nivel_servicio)").all().map((c) => c.name);
    if (!mensualCols.includes('sede')) {
      db.exec(`
        CREATE TABLE calidad_nivel_servicio_new (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          campana TEXT NOT NULL,
          mes TEXT NOT NULL,
          sede TEXT,
          contestadas20s INTEGER NOT NULL DEFAULT 0,
          llamadasTotales INTEGER NOT NULL DEFAULT 0,
          createdAt TEXT NOT NULL,
          updatedAt TEXT NOT NULL,
          UNIQUE(campana, mes, sede)
        );
        INSERT INTO calidad_nivel_servicio_new
          (id, campana, mes, sede, contestadas20s, llamadasTotales, createdAt, updatedAt)
        SELECT id, campana, mes, NULL, contestadas20s, llamadasTotales, createdAt, updatedAt
        FROM calidad_nivel_servicio;
        DROP TABLE calidad_nivel_servicio;
        ALTER TABLE calidad_nivel_servicio_new RENAME TO calidad_nivel_servicio;
        CREATE INDEX IF NOT EXISTS idx_nivelservicio_campana_mes ON calidad_nivel_servicio(campana, mes);
      `);
    }

    // 3) Re-etiquetar: las filas que hoy viven bajo las 2 campanas falsas
    // pasan a campana='HOSPITAL LA MARIA' + su sede real. Mismos puntajes/
    // numeros, solo cambia donde vive el dato de "cual sede es" — de la
    // columna campana a la columna sede.
    for (const [campanaVieja, sede] of Object.entries(HLM_SEDES)) {
      db.prepare('UPDATE calidad_nivel_servicio_diario SET campana = ?, sede = ? WHERE campana = ?').run(HLM, sede, campanaVieja);
      db.prepare('UPDATE calidad_nivel_servicio SET campana = ?, sede = ? WHERE campana = ?').run(HLM, sede, campanaVieja);
      db.prepare('UPDATE trafico_skill_mapeo SET campana = ?, sede = ? WHERE campana = ?').run(HLM, sede, campanaVieja);
    }
  });
  tx();

  if (!config.isTest) {
    console.log('[db] Migracion hlm_sede_consolidacion_v1 aplicada.');
  }
});

// Semilla de umbrales de semaforo por defecto (campana='' = global), para que
// el sistema no quede sin color mientras nadie los configura desde el panel.
// Valores iniciales razonables, documentados uno por uno (ajustables sin
// desplegar desde la pantalla de Umbrales):
//  - nivel_atencion: >=90% verde / 70-90% amarillo / <70% rojo (estandar de
//    contact center para nivel de servicio de atencion).
//  - tasa_abandono: <=5% verde / 5-10% amarillo / >10% rojo, menor es mejor.
//  - qa_promedio: >=90 verde / 70-90 amarillo / <70 rojo (mismo corte que ya
//    usaba Calidad antes de este cambio, ahora editable).
//  - service_level: >=80% verde / 65-80% amarillo / <65% rojo (contestadas
//    dentro del tiempo objetivo, ej. 20s, sobre el total).
//  - cumplimiento_meta: >=100% verde / 80-100% amarillo / <80% rojo (mismo
//    corte que ya usaba la barra de avance de meta, ahora editable).
runOnceMigration('umbrales_semaforo_seed_v1', () => {
  const now = new Date().toISOString();
  const insert = db.prepare(
    `INSERT OR IGNORE INTO umbrales_semaforo (metrica, campana, verde, amarillo, direccion, createdAt, updatedAt)
     VALUES (@metrica, '', @verde, @amarillo, @direccion, @now, @now)`
  );
  const defaults = [
    { metrica: 'nivel_atencion', verde: 90, amarillo: 70, direccion: 'mayor_es_mejor' },
    { metrica: 'tasa_abandono', verde: 5, amarillo: 10, direccion: 'menor_es_mejor' },
    { metrica: 'qa_promedio', verde: 90, amarillo: 70, direccion: 'mayor_es_mejor' },
    { metrica: 'service_level', verde: 80, amarillo: 65, direccion: 'mayor_es_mejor' },
    { metrica: 'cumplimiento_meta', verde: 100, amarillo: 80, direccion: 'mayor_es_mejor' },
  ];
  const tx = db.transaction((rows) => {
    rows.forEach((r) => insert.run({ ...r, now }));
  });
  tx(defaults);
  if (!config.isTest) {
    console.log('[db] Migracion umbrales_semaforo_seed_v1 aplicada (5 umbrales globales por defecto).');
  }
});

// ORLANT: gráficas del PDF de InCo (2026-09-18) — dashboards_config solo se
// siembra si el cliente TODAVIA no existe (ver arriba), y ORLANT ya existe en
// produccion, asi que editar dashboard-config-seed.js por si solo nunca
// llega a la fila real. Esta migracion mueve el layout de ORLANT en
// produccion a la MISMA forma que dashboard-config-seed.js define ahora
// (misma fuente unica de verdad: se lee de CONFIGS, no se repite el JSON a
// mano) — mismo criterio de las migraciones de arriba.
//
// Defensiva por tab: solo reemplaza un tab si su forma actual coincide con
// la "vieja" reconocible (antes de este cambio); si ya tiene la forma nueva
// (marca ya aplicada, o dashboard recien creado por el seed) o fue editada
// a mano a algo distinto, se deja intacta y se loguea — nunca se pisa una
// personalizacion sin poder reconocerla.
runOnceMigration('dashboards_config_orlant_pdf_graficas_v1', () => {
  const row = db.prepare('SELECT cliente, layout FROM dashboards_config WHERE cliente = ?').get('ORLANT');
  if (!row) return; // no existe todavia -> el seed ya la crea con la forma nueva
  let layout;
  try {
    layout = JSON.parse(row.layout);
  } catch (e) {
    return;
  }
  const target = CONFIGS.find((c) => c.cliente === 'ORLANT');
  if (!target) return;
  const targetTabs = {};
  (target.layout.tabs || []).forEach((t) => { targetTabs[t.key] = t; });

  const yaEsNuevo = {
    salida: (t) => (t.panels || []).some((p) => p.filtroSerie === true),
    tipificacion: (t) => (t.panels || []).some((p) => p.filtroCampo === 'linea'),
    agendamiento: (t) => (t.panels || []).some((p) => p.tipo === 'nota_kpi'),
    sta: (t) => (t.panels || [])[1] && (t.panels || [])[1].tipo === 'bar',
  };
  const esViejoReconocible = {
    salida: (t) => (t.panels || []).length === 4 && (t.panels || []).every((p) => p.tipo === 'line' && !p.filtroSerie),
    tipificacion: (t) => (t.panels || []).length === 2 && (t.panels || []).every((p) => p.tipo === 'pie' && !p.filtroCampo),
    agendamiento: (t) => (t.panels || []).length === 4,
    sta: (t) => (t.panels || []).length === 4 && (t.panels || [])[1] && (t.panels || [])[1].tipo === 'pie',
  };

  let tocado = false;
  (layout.tabs || []).forEach((tab) => {
    const chequeoNuevo = yaEsNuevo[tab.key];
    const chequeoViejo = esViejoReconocible[tab.key];
    if (!chequeoNuevo || !targetTabs[tab.key]) return; // no es uno de los 4 tabs que cambian
    if (chequeoNuevo(tab)) return; // ya tiene la forma nueva, nada que hacer
    if (!chequeoViejo(tab)) {
      if (!config.isTest) {
        console.log(`[db] Migracion dashboards_config_orlant_pdf_graficas_v1: tab "${tab.key}" no coincide con la forma esperada (vieja ni nueva) — se deja intacta, revisar a mano.`);
      }
      return;
    }
    tab.panels = JSON.parse(JSON.stringify(targetTabs[tab.key].panels));
    tocado = true;
  });

  if (tocado) {
    db.prepare('UPDATE dashboards_config SET layout = ?, updatedAt = ? WHERE cliente = ?').run(
      JSON.stringify(layout),
      new Date().toISOString(),
      'ORLANT'
    );
  }
  if (!config.isTest) {
    console.log(`[db] Migracion dashboards_config_orlant_pdf_graficas_v1 aplicada (tocado=${tocado}).`);
  }
});

// ORLANT: fix del pie de Tipificacion (categorias duplicadas en la leyenda,
// hallazgo real de la verificacion con InCo del 2026-09-18) — la migracion
// anterior (dashboards_config_orlant_pdf_graficas_v1) ya dejo el panel con
// filtroCampo:'linea' pero SIN filtroUnico (multi-select, 3P+General
// combinados por defecto = cada categoria duplicada). Esta migracion nueva
// mueve ESE tab especifico a la forma con filtroUnico:true (selector de una
// sola linea, igual patron que Salida). Misma fuente unica de verdad
// (CONFIGS) y mismo criterio defensivo que las migraciones anteriores.
runOnceMigration('dashboards_config_orlant_tipificacion_unico_v1', () => {
  const row = db.prepare('SELECT cliente, layout FROM dashboards_config WHERE cliente = ?').get('ORLANT');
  if (!row) return; // no existe todavia -> el seed ya la crea con la forma nueva
  let layout;
  try {
    layout = JSON.parse(row.layout);
  } catch (e) {
    return;
  }
  const target = CONFIGS.find((c) => c.cliente === 'ORLANT');
  if (!target) return;
  const targetTab = (target.layout.tabs || []).find((t) => t.key === 'tipificacion');
  if (!targetTab) return;

  const tab = (layout.tabs || []).find((t) => t.key === 'tipificacion');
  if (!tab) return;
  const yaEsNuevo = (tab.panels || []).some((p) => p.filtroUnico === true);
  if (yaEsNuevo) {
    if (!config.isTest) console.log('[db] Migracion dashboards_config_orlant_tipificacion_unico_v1: ya tenia filtroUnico, nada que hacer.');
    return;
  }
  const esViejoReconocible = (tab.panels || []).length === 1 && tab.panels[0].filtroCampo === 'linea' && !tab.panels[0].filtroUnico;
  if (!esViejoReconocible) {
    if (!config.isTest) {
      console.log('[db] Migracion dashboards_config_orlant_tipificacion_unico_v1: el tab "tipificacion" no coincide con la forma esperada (vieja ni nueva) — se deja intacta, revisar a mano.');
    }
    return;
  }

  tab.panels = JSON.parse(JSON.stringify(targetTab.panels));
  db.prepare('UPDATE dashboards_config SET layout = ?, updatedAt = ? WHERE cliente = ?').run(
    JSON.stringify(layout),
    new Date().toISOString(),
    'ORLANT'
  );
  if (!config.isTest) {
    console.log('[db] Migracion dashboards_config_orlant_tipificacion_unico_v1 aplicada.');
  }
});

// ORLANT: Fase 78 (Jairo/Edwin) — agrega el panel "Citas por Especialidad"
// (agendas reales de Edwin, tabla `agendas`) como PRIMER panel/subtab del
// tab "agendamiento" -- dashboards_config ya existe en produccion, asi que
// el panel nuevo en dashboard-config-seed.js no llega solo a la fila real
// (mismo motivo de las migraciones de ORLANT de mas abajo). Puramente
// aditivo: prepende un panel al array `panels` de siempre y corre +1 los
// `indices` de las sub-pestanas que ya existian -- no reordena ni borra
// ningun panel viejo. El tab sigue con `oculta:true` en la config guardada
// (dashboard-generic.js lo destapa en memoria segun si hay agendas
// cargadas, nunca aqui) -- esta migracion NO cambia esa regla.
//
// Va ANTES de dashboards_config_orlant_subpestanas_v1 (mas abajo) a
// proposito: esa migracion compara la cantidad de paneles del tab contra
// dashboard-config-seed.js para decidir si le agrega `subtabs` -- si esta
// migracion corriera despues, un ORLANT sembrado ANTES de la Fase 40 (sin
// subtabs todavia, con la cantidad VIEJA de paneles) quedaria con el
// conteo ya actualizado pero sin que la de subpestanas alcanzara a
// agrupar el panel nuevo. Corriendo primero, cuando la de subpestanas mire
// el tab ya tiene la forma final.
runOnceMigration('dashboards_config_orlant_agendas_panel_v1', () => {
  const row = db.prepare("SELECT cliente, layout FROM dashboards_config WHERE cliente = 'ORLANT'").get();
  if (!row) return; // no existe todavia -> el seed ya la crea con el panel nuevo
  let layout;
  try {
    layout = JSON.parse(row.layout);
  } catch (e) {
    return;
  }
  const tab = (layout.tabs || []).find((t) => t.key === 'agendamiento');
  if (!tab) return;
  if (tab.panels && tab.panels[0] && tab.panels[0].tipo === 'agendas_panel') return; // ya tiene la forma nueva

  const target = CONFIGS.find((c) => c.cliente === 'ORLANT');
  const targetTab = target && (target.layout.tabs || []).find((t) => t.key === 'agendamiento');
  if (!targetTab || !targetTab.panels || targetTab.panels[0].tipo !== 'agendas_panel') return;

  // Solo se aplica si la cantidad de paneles VIEJOS (todo menos el panel
  // nuevo que se va a agregar) coincide con lo que habia antes de esta
  // fase -- si no coincide, el tab fue editado a mano a algo distinto:
  // se deja intacta y se loguea, igual que las migraciones anteriores.
  const panelesActuales = (tab.panels || []).length;
  const panelesEsperadosViejos = targetTab.panels.length - 1;
  if (panelesActuales !== panelesEsperadosViejos) {
    if (!config.isTest) {
      console.log(`[db] Migracion dashboards_config_orlant_agendas_panel_v1: tab "agendamiento" tiene ${panelesActuales} panel(es), se esperaban ${panelesEsperadosViejos} — se deja intacta, revisar a mano.`);
    }
    return;
  }

  tab.panels = [JSON.parse(JSON.stringify(targetTab.panels[0]))].concat(tab.panels);
  if (tab.subtabs) {
    tab.subtabs = tab.subtabs.map((s) => Object.assign({}, s, { indices: s.indices.map((idx) => idx + 1) }));
    tab.subtabs = [JSON.parse(JSON.stringify(targetTab.subtabs[0]))].concat(tab.subtabs);
  }

  db.prepare('UPDATE dashboards_config SET layout = ?, updatedAt = ? WHERE cliente = ?').run(
    JSON.stringify(layout),
    new Date().toISOString(),
    'ORLANT'
  );
  if (!config.isTest) {
    console.log('[db] Migracion dashboards_config_orlant_agendas_panel_v1 aplicada.');
  }
});

// ORLANT: Fase 40 (2026-09-21) — "una grafica por pestana": agrupa las
// graficas de 5 pestanas (Flujo Mensual, Salida, Agendamiento,
// Inasistencia, Gestion STA) en sub-pestanas (`subtabs`, dashboard-
// generic.js) — mismo criterio que las migraciones anteriores de ORLANT:
// dashboards_config ya existe en produccion, asi que el campo nuevo en
// dashboard-config-seed.js no llega solo a la fila real.
//
// `subtabs` es puramente aditivo — agrupa los INDICES del mismo array
// `panels` de siempre, no lo toca ni lo reordena — asi que se agrega solo
// si el tab tiene la MISMA cantidad de paneles que la config actual espera
// (misma forma => mismos indices validos); si no coincide (fue editado a
// mano a algo distinto), se deja intacta y se loguea, igual que las
// migraciones anteriores.
runOnceMigration('dashboards_config_orlant_subpestanas_v1', () => {
  const row = db.prepare('SELECT cliente, layout FROM dashboards_config WHERE cliente = ?').get('ORLANT');
  if (!row) return; // no existe todavia -> el seed ya la crea con la forma nueva
  let layout;
  try {
    layout = JSON.parse(row.layout);
  } catch (e) {
    return;
  }
  const target = CONFIGS.find((c) => c.cliente === 'ORLANT');
  if (!target) return;
  const targetTabs = {};
  (target.layout.tabs || []).forEach((t) => { targetTabs[t.key] = t; });
  const CLAVES_CON_SUBPESTANAS = ['flujo', 'salida', 'agendamiento', 'inasistencia', 'sta'];

  let tocado = false;
  (layout.tabs || []).forEach((tab) => {
    if (CLAVES_CON_SUBPESTANAS.indexOf(tab.key) === -1) return;
    const targetTab = targetTabs[tab.key];
    if (!targetTab || !targetTab.subtabs) return;
    if (tab.subtabs) return; // ya tiene la forma nueva, nada que hacer
    const panelesActuales = (tab.panels || []).length;
    const panelesEsperados = (targetTab.panels || []).length;
    if (panelesActuales !== panelesEsperados) {
      if (!config.isTest) {
        console.log(`[db] Migracion dashboards_config_orlant_subpestanas_v1: tab "${tab.key}" tiene ${panelesActuales} panel(es), se esperaban ${panelesEsperados} — se deja intacta, revisar a mano.`);
      }
      return;
    }
    tab.subtabs = JSON.parse(JSON.stringify(targetTab.subtabs));
    tocado = true;
  });

  if (tocado) {
    db.prepare('UPDATE dashboards_config SET layout = ?, updatedAt = ? WHERE cliente = ?').run(
      JSON.stringify(layout),
      new Date().toISOString(),
      'ORLANT'
    );
  }
  if (!config.isTest) {
    console.log(`[db] Migracion dashboards_config_orlant_subpestanas_v1 aplicada (tocado=${tocado}).`);
  }
});

// ORLANT: Fase 40b (2026-09-21) — mientras se termina de organizar/llenar
// la informacion de 7 de las 9 pestanas, se ocultan del menu (TEMPORAL,
// ver PROGRESS.md) y solo quedan visibles Calidad y Trafico de Llamadas,
// que ya estan completas. `oculta: true` es un flag puramente aditivo
// (dashboard-generic.js: renderGenericTabs/_gdBootstrap la filtran del
// menu y de la pestana activa por defecto) — no toca panels/subtabs/datos
// de ninguna pestana, asi que a diferencia de las migraciones anteriores
// de ORLANT no hace falta verificar la forma de los paneles: se puede
// aplicar aunque una pestana haya sido personalizada. Mismo criterio de
// las migraciones anteriores: dashboards_config ya existe en produccion,
// asi que el campo nuevo del seed no llega solo a la fila real.
runOnceMigration('dashboards_config_orlant_ocultar_pestanas_v1', () => {
  const row = db.prepare('SELECT cliente, layout FROM dashboards_config WHERE cliente = ?').get('ORLANT');
  if (!row) return; // no existe todavia -> el seed ya la crea con la forma nueva
  let layout;
  try {
    layout = JSON.parse(row.layout);
  } catch (e) {
    return;
  }
  const CLAVES_A_OCULTAR = ['flujo', 'salida', 'tipificacion', 'agendamiento', 'inasistencia', 'sta', 'efectividad'];

  let tocado = false;
  (layout.tabs || []).forEach((tab) => {
    if (CLAVES_A_OCULTAR.indexOf(tab.key) === -1) return;
    if (tab.oculta) return; // ya tiene la forma nueva, nada que hacer
    tab.oculta = true;
    tocado = true;
  });

  if (tocado) {
    db.prepare('UPDATE dashboards_config SET layout = ?, updatedAt = ? WHERE cliente = ?').run(
      JSON.stringify(layout),
      new Date().toISOString(),
      'ORLANT'
    );
  }
  if (!config.isTest) {
    console.log(`[db] Migracion dashboards_config_orlant_ocultar_pestanas_v1 aplicada (tocado=${tocado}).`);
  }
});

// Backfill Fase 45 (pedido de Edwin): quita de la franja global de KPIs
// (arriba de las pestanas) los que duplicaban, en nombre, las tarjetas del
// resumen de "Trafico de Llamadas" (Total/Contestadas/Abandonadas/Nivel de
// Atencion) -- esa informacion ahora vive SOLO en el resumen de Trafico.
// Mismo motivo que las migraciones de arriba: dashboards_config no se
// re-siembra sola, asi que quitar estos KPIs de dashboard-config-seed.js
// nunca llega a una fila que ya existia (como produccion). AHT Promedio se
// deja "por ahora" (pedido explicito, no definitivo) -- no se toca aqui.
runOnceMigration('dashboards_config_trafico_kpis_duplicados_v1', () => {
  const A_QUITAR = {
    'CLINICA AURORA': ['Llamadas Entrada', 'Nivel Atencion', 'Abandonos'],
    'HOSPITAL LA MARIA': ['Llamadas Ingresadas', 'Nivel Atencion Llamadas', 'Llamadas Contestadas', 'Llamadas Abandonadas'],
  };
  let dashboardsTocados = 0;
  for (const cliente of Object.keys(A_QUITAR)) {
    const row = db.prepare('SELECT cliente, layout FROM dashboards_config WHERE cliente = ?').get(cliente);
    if (!row) continue; // no existe todavia -> el seed ya la crea con la forma nueva
    let layout;
    try {
      layout = JSON.parse(row.layout);
    } catch (e) {
      continue;
    }
    const titulosAQuitar = A_QUITAR[cliente];
    const antes = (layout.kpis || []).length;
    layout.kpis = (layout.kpis || []).filter((k) => titulosAQuitar.indexOf(k && k.titulo) === -1);
    if (layout.kpis.length === antes) continue; // ya tiene la forma nueva (o un admin ya los quito) -- nada que hacer
    db.prepare('UPDATE dashboards_config SET layout = ?, updatedAt = ? WHERE cliente = ?').run(
      JSON.stringify(layout),
      new Date().toISOString(),
      cliente
    );
    dashboardsTocados++;
  }
  if (!config.isTest) {
    console.log(`[db] Migracion dashboards_config_trafico_kpis_duplicados_v1 aplicada (${dashboardsTocados} dashboard(s)).`);
  }
});

// Agrega la pestaña "Trafico de WhatsApp" a ORLANT (Fase 50) para quien ya
// tenia dashboards_config sembrado antes de este cambio -- mismo motivo que
// las migraciones de arriba: dashboards_config solo se siembra la primera
// vez que un cliente no existe, asi que agregar la pestaña en
// dashboard-config-seed.js nunca llega sola a una fila que ya existia (como
// produccion). Idempotente por construccion: si la pestaña ya esta (porque
// el cliente se creo por primera vez DESPUES de este cambio, o porque la
// migracion ya corrio), no vuelve a agregarla.
runOnceMigration('dashboards_config_orlant_trafico_whatsapp_tab_v1', () => {
  const row = db.prepare("SELECT cliente, layout FROM dashboards_config WHERE cliente = 'ORLANT'").get();
  if (!row) return; // ORLANT no existe todavia -> el seed ya la crea con la pestaña nueva
  let layout;
  try {
    layout = JSON.parse(row.layout);
  } catch (e) {
    return;
  }
  const tabs = layout.tabs || [];
  if (tabs.some((t) => t && t.key === 'trafico_whatsapp')) return; // ya tiene la pestaña -- nada que hacer
  tabs.push({
    key: 'trafico_whatsapp',
    label: 'Trafico de WhatsApp',
    panels: [{ tipo: 'trafico_whatsapp_combo', campana: 'ORLANT' }],
  });
  layout.tabs = tabs;
  db.prepare('UPDATE dashboards_config SET layout = ?, updatedAt = ? WHERE cliente = ?').run(
    JSON.stringify(layout),
    new Date().toISOString(),
    'ORLANT'
  );
  if (!config.isTest) {
    console.log('[db] Migracion dashboards_config_orlant_trafico_whatsapp_tab_v1 aplicada.');
  }
});

// Quita de la franja global de KPIs de ORLANT (layout.kpis, arriba de las
// pestañas) las 4 tarjetas de WhatsApp -- Fase 54 (hallazgo real del
// usuario: mostraban "0" en producción). Investigado antes de tocar nada:
// esas 4 tarjetas ('WhatsApp 3P', 'Nivel Atencion WPP 3P', 'WhatsApp Linea
// General', 'WhatsApp Salida (Gral+3P)') NUNCA consultaron trafico_whatsapp
// -- salen de `ultimo('wpp_3p')`/`ultimo('wpp_general')`/etc., que leen la
// sección "resumen"/"salida" de Gestión de base (carga manual, mismo
// mecanismo que ya vimos en las Fases 52/53). El "0" no es un bug de
// conexión: es que nadie llena esos campos a mano ahí. Mismo patrón y
// mismo motivo exacto que `dashboards_config_trafico_kpis_duplicados_v1`
// (Fase 45) aplicó a CLINICA AURORA/HOSPITAL LA MARIA -- esa migración NO
// puede reutilizarse para ORLANT porque ya corrió en producción (un
// runOnceMigration nunca se re-ejecuta), así que esta es una nueva. Las
// tarjetas de Llamadas (mismo mecanismo, mismo riesgo) NO se tocan aquí:
// pedido explícito del usuario, fuera de alcance de esta fase.
runOnceMigration('dashboards_config_orlant_kpis_whatsapp_duplicados_v1', () => {
  const TITULOS_A_QUITAR = ['WhatsApp 3P', 'Nivel Atencion WPP 3P', 'WhatsApp Linea General', 'WhatsApp Salida (Gral+3P)'];
  const row = db.prepare("SELECT cliente, layout FROM dashboards_config WHERE cliente = 'ORLANT'").get();
  if (!row) return; // ORLANT no existe todavia -> el seed ya la crea sin estas 4 tarjetas
  let layout;
  try {
    layout = JSON.parse(row.layout);
  } catch (e) {
    return;
  }
  const antes = (layout.kpis || []).length;
  layout.kpis = (layout.kpis || []).filter((k) => TITULOS_A_QUITAR.indexOf(k && k.titulo) === -1);
  if (layout.kpis.length === antes) return; // ya tiene la forma nueva (o un admin ya las quito) -- nada que hacer
  db.prepare('UPDATE dashboards_config SET layout = ?, updatedAt = ? WHERE cliente = ?').run(
    JSON.stringify(layout),
    new Date().toISOString(),
    'ORLANT'
  );
  if (!config.isTest) {
    console.log('[db] Migracion dashboards_config_orlant_kpis_whatsapp_duplicados_v1 aplicada.');
  }
});

// Quita de la franja global de KPIs de SASCHA FITNESS y BIVETT ('Llamadas
// Entrada'/'Nivel de Atencion'/'Abandonos') las 3 tarjetas que duplican
// EXACTO lo que ya muestra su pestaña real de Trafico de Llamadas -- Fase
// 59, mismo criterio que la Fase 45 aplicó a CLINICA AURORA/HOSPITAL LA
// MARIA (`dashboards_config_trafico_kpis_duplicados_v1`, que no puede
// reusarse aquí porque ya corrió en producción) y que la Fase 54 aplicó a
// ORLANT para WhatsApp. Confirmado antes de esta migración que 'WhatsApp
// Entrada' NO se toca: ninguno de los dos clientes tiene módulo automático
// de Trafico de WhatsApp, así que esa tarjeta sigue siendo su única fuente
// real (mismo motivo por el que la Fase 45 tampoco tocó el 'WhatsApp
// Entrada' de CLINICA AURORA).
runOnceMigration('dashboards_config_sascha_bivett_kpis_duplicados_v1', () => {
  const TITULOS_A_QUITAR = ['Llamadas Entrada', 'Nivel de Atencion', 'Abandonos'];
  const CLIENTES = ['SASCHA FITNESS', 'BIVETT'];
  let dashboardsTocados = 0;
  for (const cliente of CLIENTES) {
    const row = db.prepare('SELECT cliente, layout FROM dashboards_config WHERE cliente = ?').get(cliente);
    if (!row) continue; // no existe todavia -> el seed ya la crea sin estas 3 tarjetas
    let layout;
    try {
      layout = JSON.parse(row.layout);
    } catch (e) {
      continue;
    }
    const antes = (layout.kpis || []).length;
    layout.kpis = (layout.kpis || []).filter((k) => TITULOS_A_QUITAR.indexOf(k && k.titulo) === -1);
    if (layout.kpis.length === antes) continue; // ya tiene la forma nueva (o un admin ya las quito) -- nada que hacer
    db.prepare('UPDATE dashboards_config SET layout = ?, updatedAt = ? WHERE cliente = ?').run(
      JSON.stringify(layout),
      new Date().toISOString(),
      cliente
    );
    dashboardsTocados++;
  }
  if (!config.isTest) {
    console.log(`[db] Migracion dashboards_config_sascha_bivett_kpis_duplicados_v1 aplicada (${dashboardsTocados} dashboard(s)).`);
  }
});

// Conecta la tarjeta "AHT Promedio" de la franja global al dato REAL de
// Trafico de Llamadas (Wolkvox) en los 6 clientes que ya usan esta
// plantilla con Trafico activo -- Fase 65 (hallazgo #3 de la auditoria de
// la Fase 64: el dato manual de Gestion de base podia desincronizarse del
// AHT real que ya se ve en la sub-pestaña "AHT" del panel de Trafico).
// Mismo motivo que las migraciones anteriores: dashboards_config solo se
// siembra la primera vez que un cliente se crea, asi que el cambio nuevo
// de dashboard-plantillas-cliente.js (kpiAhtPromedio) no le llega solo a
// las filas ya sembradas en produccion. NO quita la tarjeta (a diferencia
// de dashboards_config_sascha_bivett_kpis_duplicados_v1) -- solo reemplaza
// su `fuente`, conservando titulo/formato/clase tal cual.
runOnceMigration('dashboards_config_aht_real_trafico_v1', () => {
  const CLIENTES = ['TELEVENTAS SURA', 'TELEVENTAS COMFAMA', 'ANDRES YEPES', 'MOVILIZE', 'SASCHA FITNESS', 'BIVETT'];
  let dashboardsTocados = 0;
  for (const cliente of CLIENTES) {
    const row = db.prepare('SELECT cliente, layout FROM dashboards_config WHERE cliente = ?').get(cliente);
    if (!row) continue; // no existe todavia -> el seed ya la crea con la fuente nueva
    let layout;
    try {
      layout = JSON.parse(row.layout);
    } catch (e) {
      continue;
    }
    const kpiAht = (layout.kpis || []).find((k) => k && k.titulo === 'AHT Promedio');
    if (!kpiAht) continue; // este cliente no tiene esta tarjeta -- nada que hacer
    if (kpiAht.fuente && kpiAht.fuente.modo === 'trafico_aht') continue; // ya tiene la forma nueva
    kpiAht.fuente = { s: 'trafico', modo: 'trafico_aht', campana: cliente };
    db.prepare('UPDATE dashboards_config SET layout = ?, updatedAt = ? WHERE cliente = ?').run(
      JSON.stringify(layout),
      new Date().toISOString(),
      cliente
    );
    dashboardsTocados++;
  }
  if (!config.isTest) {
    console.log(`[db] Migracion dashboards_config_aht_real_trafico_v1 aplicada (${dashboardsTocados} dashboard(s)).`);
  }
});

// Vacia la franja global de KPIs de ORLANT (layout.kpis) por completo --
// Fase 68, Pedido 2 (Edwin, 23/09): las tarjetas de Llamadas/Nivel de
// Atencion ya estan abajo en la pestaña "Trafico de Llamadas" (filtrables
// por linea, Fase 65), Total Agendas volvera cuando se grafiquen agendas
// (pestaña "Agendamiento", hoy oculta), y las demas (Efec. Ordenamiento
// Medico, Recuperacion Cancelados, Llamadas Salida, % Citas Atendidas) no
// se usan asi. Mismo motivo que las migraciones anteriores:
// dashboards_config solo se siembra la primera vez que un cliente no
// existe, asi que dejar `kpis: []` en dashboard-config-seed.js nunca le
// llega solo a una fila que ya existia (como produccion). SOLO ORLANT --
// ningun otro cliente se toca. No borra ningun dato de Gestion de base: la
// hoja "resumen" se sigue guardando igual, esto solo cambia que se
// muestra arriba del dashboard.
runOnceMigration('dashboards_config_orlant_kpis_vacios_v1', () => {
  const row = db.prepare("SELECT cliente, layout FROM dashboards_config WHERE cliente = 'ORLANT'").get();
  if (!row) return; // ORLANT no existe todavia -> el seed ya la crea con kpis: []
  let layout;
  try {
    layout = JSON.parse(row.layout);
  } catch (e) {
    return;
  }
  if (!(layout.kpis || []).length) return; // ya esta vacio -- nada que hacer
  layout.kpis = [];
  db.prepare('UPDATE dashboards_config SET layout = ?, updatedAt = ? WHERE cliente = ?').run(
    JSON.stringify(layout),
    new Date().toISOString(),
    'ORLANT'
  );
  if (!config.isTest) {
    console.log('[db] Migracion dashboards_config_orlant_kpis_vacios_v1 aplicada.');
  }
});

// Columna AHT opcional en trafico_whatsapp (Fase 68, Pedido 5, Edwin
// 23/09): la plantilla aprobada de WhatsApp no trae hoy ningun campo de
// AHT/tiempo de conversacion -- columna nueva para cuando se complete a
// mano en la plantilla (mismo criterio de la reunion del 21/09: si un dato
// no llega automatico, quien sube la informacion lo completa a mano).
// No se agrega directo al CREATE TABLE de arriba para que esta migracion
// funcione igual en una base nueva o en una que ya tenia filas (evita el
// error "duplicate column name") -- mismo patron que
// calidad_nivel_servicio_diario_trafico_v1.
runOnceMigration('trafico_whatsapp_aht_v1', () => {
  db.exec('ALTER TABLE trafico_whatsapp ADD COLUMN ahtSegundos REAL');
  if (!config.isTest) {
    console.log('[db] Migracion trafico_whatsapp_aht_v1 aplicada.');
  }
});

// Marca las 7 metricas de trafico de la hoja "resumen" de ORLANT como
// opcional+autoTrafico (Fase 71, Edwin 24/09) -- igual que layout.kpis
// (dashboards_config_orlant_kpis_vacios_v1), dashboards_config.secciones
// solo se siembra la primera vez que un cliente no existe, asi que el
// cambio nuevo de dashboard-secciones.js (columnas opcional/autoTrafico +
// notasExtra en SECCIONES.ORLANT.resumen) nunca le llega solo a una fila
// ya sembrada (como produccion) -- sin esto, GET /dashboard/secciones/ORLANT
// (que lee dashboards_config.secciones, nunca el archivo en vivo) seguiria
// devolviendo las 7 columnas como obligatorias y la plantilla descargable
// las seguiria pidiendo, aunque el codigo ya no las exija. SOLO ORLANT.
// No borra ningun dato: dashboard_cargas no se toca, esto solo cambia el
// ESQUEMA que describe la hoja "resumen" (que columnas pide la plantilla,
// cuales son opcionales).
runOnceMigration('dashboards_config_orlant_resumen_trafico_opcional_v1', () => {
  const AUTO_TRAFICO_KEYS = ['llamadas_3p', 'wpp_3p', 'llamadas_general', 'wpp_general', 'nivel_atencion_3p', 'nivel_atencion_wpp_3p', 'nivel_atencion_general'];
  const NOTA_EXTRA =
    'Las 7 metricas de trafico (Llamadas 3P/Linea General, WhatsApp 3P/Linea General, ' +
    'Nivel Atencion 3P/WhatsApp 3P/Linea General) NO estan en esta hoja: se calculan solas, ' +
    'todos los meses, desde Trafico de Llamadas y Trafico de WhatsApp -- no hace falta llenarlas ' +
    'a mano (evita el trabajo doble y que los numeros no cuadren entre las dos cargas).';

  const row = db.prepare("SELECT cliente, secciones FROM dashboards_config WHERE cliente = 'ORLANT'").get();
  if (!row) return; // ORLANT no existe todavia -> el seed ya la crea con el esquema nuevo
  let secciones;
  try {
    secciones = JSON.parse(row.secciones);
  } catch (e) {
    return;
  }
  const resumen = secciones && secciones.resumen;
  if (!resumen || !Array.isArray(resumen.columnas)) return;

  let tocado = false;
  resumen.columnas.forEach((col) => {
    if (col && AUTO_TRAFICO_KEYS.includes(col.key) && !col.autoTrafico) {
      col.opcional = true;
      col.autoTrafico = true;
      tocado = true;
    }
  });
  if (JSON.stringify(resumen.notasExtra || []) !== JSON.stringify([NOTA_EXTRA])) {
    resumen.notasExtra = [NOTA_EXTRA];
    tocado = true;
  }
  if (!tocado) return; // ya tiene la forma nueva -- nada que hacer

  db.prepare('UPDATE dashboards_config SET secciones = ?, updatedAt = ? WHERE cliente = ?').run(
    JSON.stringify(secciones),
    new Date().toISOString(),
    'ORLANT'
  );
  if (!config.isTest) {
    console.log('[db] Migracion dashboards_config_orlant_resumen_trafico_opcional_v1 aplicada.');
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
