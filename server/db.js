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
  'MOBILIZE',
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
  'MOBILIZE',
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

-- Configuracion chica de la app, clave/valor (Fase 95, tema C): hoy solo
-- guarda desde que id de monitoreos cuenta la alerta de "monitoreo nuevo"
-- al asesor (ver migracion monitoreos_visto_por_asesor_v1 mas abajo).
CREATE TABLE IF NOT EXISTS app_config (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
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

-- Catalogo de codificaciones validas por campana (Fase 95, tema B). Mientras
-- una campana no tenga ninguna fila activa, el campo "codificacion" del
-- monitoreo sigue siendo texto libre (igual que hasta ahora); en cuanto
-- tiene al menos una, el formulario la vuelve un desplegable y el servidor
-- valida el valor contra esta lista (ver validation.js/routes/calidad.js).
-- Nunca se borra una fila (romperia monitoreos viejos que la usan como
-- texto): solo se desactiva/reactiva con activo 0/1.
CREATE TABLE IF NOT EXISTS calidad_codificaciones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campana TEXT NOT NULL,
  valor TEXT NOT NULL,
  activo INTEGER NOT NULL DEFAULT 1,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
-- Unicidad case/espacios-insensible por campana: pegar "POS" y "pos " no
-- debe crear 2 filas. Expresion en vez de UNIQUE(campana,valor) crudo.
CREATE UNIQUE INDEX IF NOT EXISTS idx_calidad_codificaciones_unica
  ON calidad_codificaciones(campana, lower(trim(valor)));
CREATE INDEX IF NOT EXISTS idx_calidad_codificaciones_campana_activo
  ON calidad_codificaciones(campana, activo);

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
-- Fase 88: GET /monitoreos/mios (portal personal del rol ASESOR) filtra
-- por "lower(trim(asesor)) = ?", sin cota de campana/mes -- sin este
-- indice de expresion hace SCAN completo de la tabla en cada visita
-- (confirmado con EXPLAIN QUERY PLAN). IF NOT EXISTS: se autoaplica en
-- cualquier base ya sembrada (incluida produccion) con el proximo deploy,
-- sin intervencion manual -- mismo criterio que el resto de indices de
-- este bloque.
CREATE INDEX IF NOT EXISTS idx_monitoreos_asesor_lower ON monitoreos(lower(trim(asesor)));

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
  -- serviceLevel5minPct (Fase 87, tema B) se agrega por migracion (ver
  -- trafico_whatsapp_service_level_5min_v1, mas abajo), mismo patron que
  -- ahtSegundos (trafico_whatsapp_aht_v1) -- nunca directo aqui, para que
  -- esta migracion funcione igual en una base nueva o en una que ya tenia
  -- filas.
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

-- Tipificacion de ORLANT (Fase 77, pedido de Edwin/Jairo): 1 sola tabla para
-- Llamadas y WhatsApp (mismo grano exacto en los 2 canales -- una fila por
-- interaccion tipificada), 'canal' distingue cuál es. Volumen mucho mayor
-- que Agendas (~15.000 filas/mes solo Llamadas, creciendo) -- el dashboard
-- NUNCA descarga filas crudas, solo agregados via server/tipificaciones.js
-- (ver routes/tipificaciones.js). hora/duracionMin son opcionales (no toda
-- fila trae HORA valida; TIME_MIN se guarda para una futura funcionalidad de
-- "duracion promedio", no se muestra todavia).
CREATE TABLE IF NOT EXISTS tipificaciones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campana TEXT NOT NULL,
  canal TEXT NOT NULL,               -- LLAMADAS | WHATSAPP
  agente TEXT NOT NULL,              -- AGENT_NAME
  fecha TEXT NOT NULL,               -- 'AAAA-MM-DD', hora local de Colombia (nunca convertida a UTC)
  hora TEXT,                         -- 'HH:MM:SS' o NULL si no se pudo leer (no bloquea la fila)
  duracionMin INTEGER,               -- TIME_MIN, guardado sin usar todavia
  tipificacion TEXT NOT NULL,        -- DESCRIPTION_COD_ACT, valor ORIGINAL tal cual (incluido "-")
  skill TEXT NOT NULL,               -- SKILL_NAME (Llamadas) / cola ya cruzada a nombre real (WhatsApp)
  archivoNombre TEXT NOT NULL DEFAULT '',
  cargadoPorNombre TEXT NOT NULL DEFAULT '',
  createdAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tipificaciones_campana_canal_fecha ON tipificaciones(campana, canal, fecha);

-- Inasistencia de ORLANT (Fase 98, pedido urgente de Edwin; Fase 108,
-- pedido textual de InCo: "que se pueda filtrar por sede, especialidad,
-- nombre entidad"): un total AGREGADO por (mes,sede,especialidad,entidad)
-- -- nunca una fila por cita/paciente, el navegador ya agrego las filas
-- crudas del archivo real antes de mandar el payload (ver
-- public/js/inasistencia-logic.js). Una carga REEMPLAZA los meses que trae
-- el archivo (server/inasistencia.js, cargarInasistencias) -- por eso el
-- UNIQUE incluye sede/especialidad/entidad: volver a subir el mismo
-- archivo actualiza las mismas filas, nunca duplica. Las filas cargadas
-- ANTES de esta fase (formato viejo, sin sede/entidad real) quedan con
-- sede='SIN DATO'/entidad='SIN DATO' (ver migracion
-- inasistencias_sede_entidad_v1 mas abajo -- esta definicion ya es la
-- forma FINAL, para que una base nueva nazca con ella directo).
CREATE TABLE IF NOT EXISTS inasistencias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campana TEXT NOT NULL,
  mes TEXT NOT NULL,                 -- 'AAAA-MM'
  sede TEXT NOT NULL,
  especialidad TEXT NOT NULL,
  entidad TEXT NOT NULL,
  cancelada INTEGER NOT NULL,
  inasistencia INTEGER NOT NULL,
  pendiente INTEGER NOT NULL,
  atendidas INTEGER NOT NULL,
  total INTEGER NOT NULL,            -- suma de los otros 4 (Fase 108: se calcula en el navegador al agregar)
  archivoNombre TEXT NOT NULL DEFAULT '',
  cargadoPorNombre TEXT NOT NULL DEFAULT '',
  createdAt TEXT NOT NULL,
  UNIQUE(campana, mes, sede, especialidad, entidad)
);
CREATE INDEX IF NOT EXISTS idx_inasistencias_campana_mes ON inasistencias(campana, mes);

-- Efectividad de Agendamiento (Fase 111, ORLANT, pedido de Edwin: "el
-- ranking va a ser efectividad por agendamiento"). Un agregado mensual YA
-- calculado por Edwin, por asesor -- gestiones/agendas, nunca el %
-- (EFECTIVIDAD del archivo NUNCA se guarda aqui, se recalcula siempre al
-- leer, ver server/efectividad-agendamiento.js). Reemplazo por MES, mismo
-- patron que inasistencias: UNIQUE(campana,mes,asesor) evita duplicar si
-- se vuelve a subir el mismo archivo.
CREATE TABLE IF NOT EXISTS efectividad_agendamiento (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campana TEXT NOT NULL,
  mes TEXT NOT NULL,                 -- 'AAAA-MM'
  asesor TEXT NOT NULL,
  gestiones INTEGER NOT NULL,
  agendas INTEGER NOT NULL,
  archivoNombre TEXT NOT NULL DEFAULT '',
  cargadoPorNombre TEXT NOT NULL DEFAULT '',
  createdAt TEXT NOT NULL,
  UNIQUE(campana, mes, asesor)
);
CREATE INDEX IF NOT EXISTS idx_efectividad_agendamiento_campana_mes ON efectividad_agendamiento(campana, mes);

-- Efectividad de Citas Atendidas (Fase 111, ORLANT): un total del mes
-- (agendas/atendidas, nunca el % -- se recalcula siempre, ver
-- server/efectividad-citas.js). Reemplaza lo que antes leia de
-- citas_para_mes/citas_atendidas de la hoja "resumen" (nunca tuvo datos
-- reales). Reemplazo por MES: UNIQUE(campana,mes) evita duplicar si se
-- vuelve a subir el mismo archivo.
CREATE TABLE IF NOT EXISTS efectividad_citas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campana TEXT NOT NULL,
  mes TEXT NOT NULL,                 -- 'AAAA-MM'
  agendas INTEGER NOT NULL,
  atendidas INTEGER NOT NULL,
  archivoNombre TEXT NOT NULL DEFAULT '',
  cargadoPorNombre TEXT NOT NULL DEFAULT '',
  createdAt TEXT NOT NULL,
  UNIQUE(campana, mes)
);
CREATE INDEX IF NOT EXISTS idx_efectividad_citas_campana_mes ON efectividad_citas(campana, mes);

-- Llamadas y WhatsApp de Salida (Fase 127, pedido de Edwin: "las llamadas
-- de salida estan muy bajas"). Un total AGREGADO por mes, ya separado por
-- linea (3P/General) y canal -- nunca una fila por llamada/chat (el
-- archivo real de Edwin, FLUJO_LLAMADAS_Y_WPP_DE_SALIDA_POR_MES.xlsx,
-- solo trae 1 fila por mes). Mismo patron EXACTO que efectividad_citas
-- (reemplazo por MES). El archivo nunca trae año -- 'mes' SIEMPRE llega
-- ya resuelto a 'AAAA-MM' desde el navegador (el usuario confirma el año
-- en el modal de impacto antes de guardar, ver public/js/salida-logic.js
-- y server/routes/salida.js); el servidor nunca adivina un año.
CREATE TABLE IF NOT EXISTS salida_mensual (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campana TEXT NOT NULL,
  mes TEXT NOT NULL,                 -- 'AAAA-MM'
  llamadas3p INTEGER NOT NULL,
  llamadasGeneral INTEGER NOT NULL,
  wpp3p INTEGER NOT NULL,
  wppGeneral INTEGER NOT NULL,
  archivoNombre TEXT NOT NULL DEFAULT '',
  cargadoPorNombre TEXT NOT NULL DEFAULT '',
  createdAt TEXT NOT NULL,
  UNIQUE(campana, mes)
);
CREATE INDEX IF NOT EXISTS idx_salida_mensual_campana_mes ON salida_mensual(campana, mes);

-- Alias de nombre de asesor (Fase 122, reunion con Edwin 2026-10-05): la
-- misma persona real puede llegar con mas de un nombre entre archivos (ej.
-- "LAURA EJEMPLO TORRES" en Efectividad de Agendamiento == "MARCELA
-- EJEMPLO RUIZ" en Agendas, nombres ficticios) o con una errata puntual de
-- tipeo en Wolkvox (ej. "DIANA EJEMPLO SUARZ"). Se aplica en el SERVIDOR al GUARDAR
-- Tipificacion/Agendas/Efectividad de Agendamiento (ver alias-asesores.js),
-- nunca reescribe en silencio datos que ya estan guardados -- cambiar un
-- alias es borrar y volver a crear (alta/baja simple, sin UPDATE).
CREATE TABLE IF NOT EXISTS alias_asesores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  campana TEXT NOT NULL,
  alias TEXT NOT NULL,
  canonico TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  createdPorNombre TEXT NOT NULL DEFAULT '-'
);
-- Unicidad case/espacios-insensible por campana (mismo criterio que
-- calidad_codificaciones): pegar "Isabel Correa" dos veces no debe crear 2
-- filas para el mismo alias.
CREATE UNIQUE INDEX IF NOT EXISTS idx_alias_asesores_unico
  ON alias_asesores(campana, lower(trim(alias)));

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

// Semilla inicial: solo se ejecuta si la tabla users está vacía Y nunca en
// produccion (Fase 110, hallazgo real URGENTE: estos 6 usuarios con
// contrasena fija en el codigo -- repo PUBLICO -- seguian activos en
// produccion con la contrasena de ejemplo intacta; cualquiera que leyera
// el repo podia entrar como ADMIN completo). En produccion el UNICO
// usuario inicial es el admin maestro (MASTER_ADMIN_USER/
// MASTER_ADMIN_PASSWORD_HASH, config.js -- ya es obligatorio y
// fail-fast en CUALQUIER entorno, asi que una produccion sin el
// configurado ya no arranca, nunca cae en crear usuarios de ejemplo en su
// lugar). En desarrollo/pruebas la semilla sigue igual -- varios tests
// (ver server/tests/helpers.js) dependen de estos 6 usuarios tal cual.
// Las contraseñas de ejemplo se hashean con bcrypt (nunca texto plano).
const count = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
if (count === 0 && !config.isProduction) {
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

// Red de seguridad (Fase 110, URGENTE): corre en CADA arranque, SOLO en
// produccion -- independiente del `count === 0` de arriba, porque una
// produccion ya afectada ANTES de este fix no tiene la tabla vacia (ya
// tiene estos 6 usuarios con su contrasena de ejemplo). Por cada uno que
// SIGA existiendo y activo, compara su hash contra la contrasena de
// ejemplo (bcrypt.compare, nunca en texto plano en la base ni en un log)
// -- si coincide, lo suspende solo y deja constancia en el Historial, sin
// la contrasena. Idempotente: una cuenta ya suspendida o con otra
// contrasena no se vuelve a tocar en el siguiente arranque. Nunca borra
// usuarios ni toca a nadie mas que estos 6 (lista cerrada, Fase 110).
const USUARIOS_EJEMPLO_INSEGUROS = [
  { user: 'crodriguez', password: 'calidad123' },
  { user: 'mlopez', password: 'inv123' },
  { user: 'jherrera', password: 'ger123' },
  { user: 'agomez', password: 'cli123' },
  { user: 'lrios', password: 'aux123' },
  { user: 'psuarez', password: 'admin456' },
];
if (config.isProduction) {
  const buscarActivo = db.prepare('SELECT * FROM users WHERE user = ? AND active = 1');
  const suspender = db.prepare('UPDATE users SET active = 0 WHERE id = ?');
  for (const u of USUARIOS_EJEMPLO_INSEGUROS) {
    const row = buscarActivo.get(u.user);
    if (!row) continue; // no existe o ya esta suspendido -- nada que hacer (idempotente)
    if (!bcrypt.compareSync(u.password, row.password_hash)) continue; // ya tiene otra contrasena
    suspender.run(row.id);
    const ts = new Date();
    const pad = (n) => (n < 10 ? '0' + n : '' + n);
    const fechaStr = `${pad(ts.getDate())}/${pad(ts.getMonth() + 1)}/${ts.getFullYear()} ${pad(ts.getHours())}:${pad(ts.getMinutes())}:${pad(ts.getSeconds())}`;
    db.prepare(
      `INSERT INTO historial (ts, fecha, accion, nombre, username, rol, actor, detalle)
       VALUES (?,?,?,?,?,?,?,?)`
    ).run(
      ts.getTime(),
      fechaStr,
      'SUSPENDIDO',
      row.nombre,
      row.user,
      row.rol,
      'Seguridad automatica (@arranque)',
      'Usuario suspendido automaticamente: tenia la contrasena de ejemplo publica'
    );
    // Nunca la contrasena -- solo el usuario, aqui y en el Historial de arriba.
    console.log(`[db] SEGURIDAD: usuario "${u.user}" suspendido automaticamente (contrasena de ejemplo detectada en produccion).`);
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

// Fase 84 (hallazgo real): la migracion _v1 de arriba SI corrio (esta en
// schema_migrations), pero autoTrafico/notasExtra de resumen aparecieron
// borrados igual -- porque seccionSpecSchema/columnaSchema
// (server/validation.js) nunca los declaraban, asi que CUALQUIER PUT
// /dashboards/config/ORLANT posterior (ej. la pantalla "Dashboards" del
// panel admin, guardando sin tocar "resumen") los volvia a borrar en
// silencio (Zod descarta cualquier campo no declarado). Se agregaron esos
// 2 campos al schema (arriba) -- eso evita que un PUT futuro los vuelva a
// borrar. Esta migracion repara el estado ACTUAL (necesaria ademas de la
// _v1: un runOnceMigration nunca se repite, asi que _v1 no se autocorrige
// sola). Misma logica exacta que _v1, nombre nuevo porque _v1 ya se
// consumio. Idempotente: si ya esta bien, no hace nada.
runOnceMigration('dashboards_config_orlant_resumen_trafico_opcional_v2', () => {
  const AUTO_TRAFICO_KEYS = ['llamadas_3p', 'wpp_3p', 'llamadas_general', 'wpp_general', 'nivel_atencion_3p', 'nivel_atencion_wpp_3p', 'nivel_atencion_general'];
  const NOTA_EXTRA =
    'Las 7 metricas de trafico (Llamadas 3P/Linea General, WhatsApp 3P/Linea General, ' +
    'Nivel Atencion 3P/WhatsApp 3P/Linea General) NO estan en esta hoja: se calculan solas, ' +
    'todos los meses, desde Trafico de Llamadas y Trafico de WhatsApp -- no hace falta llenarlas ' +
    'a mano (evita el trabajo doble y que los numeros no cuadren entre las dos cargas).';

  const row = db.prepare("SELECT cliente, secciones FROM dashboards_config WHERE cliente = 'ORLANT'").get();
  if (!row) return;
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
  if (!tocado) return;

  db.prepare('UPDATE dashboards_config SET secciones = ?, updatedAt = ? WHERE cliente = ?').run(
    JSON.stringify(secciones),
    new Date().toISOString(),
    'ORLANT'
  );
  if (!config.isTest) {
    console.log('[db] Migracion dashboards_config_orlant_resumen_trafico_opcional_v2 aplicada.');
  }
});

// ORLANT: Fase 77 (Jairo/Edwin) -- reemplaza el panel viejo del tab
// "tipificacion" (pie filtrable sobre la hoja "tipificacion" de
// dashboard_cargas, que nunca llego a tener datos reales de ORLANT) por el
// panel autonomo nuevo (tipificacion_panel, tabla `tipificaciones`). Mismo
// patron exacto que dashboards_config_orlant_tipificacion_unico_v1 (mas
// arriba): detecta la forma VIEJA reconocible, reemplaza `tab.panels` por
// el del seed actual. El tab sigue con `oculta:true` en la config guardada
// (dashboard-generic.js lo destapa en memoria segun si hay tipificaciones
// cargadas, nunca aqui). No tiene `subtabs` (ni antes ni ahora), asi que no
// hay ninguna dependencia de orden con dashboards_config_orlant_subpestanas_v1
// (esa migracion no toca este tab).
runOnceMigration('dashboards_config_orlant_tipificacion_panel_v1', () => {
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
  const yaEsNuevo = (tab.panels || []).some((p) => p.tipo === 'tipificacion_panel');
  if (yaEsNuevo) {
    if (!config.isTest) console.log('[db] Migracion dashboards_config_orlant_tipificacion_panel_v1: ya tenia tipificacion_panel, nada que hacer.');
    return;
  }
  const esViejoReconocible = (tab.panels || []).length === 1 && tab.panels[0].tipo === 'pie';
  if (!esViejoReconocible) {
    if (!config.isTest) {
      console.log('[db] Migracion dashboards_config_orlant_tipificacion_panel_v1: el tab "tipificacion" no coincide con la forma esperada (vieja ni nueva) — se deja intacta, revisar a mano.');
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
    console.log('[db] Migracion dashboards_config_orlant_tipificacion_panel_v1 aplicada.');
  }
});

// ORLANT: Fase 98 (pedido URGENTE de Edwin) -- reemplaza las 4 graficas de
// linea viejas del tab "inasistencia" (inasist_audifonos/audiologia/
// examenes/total, hoja "resumen" generica, que nunca tuvieron datos reales
// de ORLANT) por el panel autonomo nuevo (inasistencia_panel, tabla
// `inasistencias`). Mismo patron exacto que
// dashboards_config_orlant_tipificacion_panel_v1: detecta la forma VIEJA
// reconocible (4 paneles `line`, cada uno con la fuente inasist_* que le
// corresponde, en el mismo orden de siempre), reemplaza tab.panels Y
// tab.subtabs por los del seed actual. El tab sigue con `oculta:true` en la
// config guardada (dashboard-generic.js lo destapa en memoria segun si hay
// inasistencias cargadas, nunca aqui).
runOnceMigration('dashboards_config_orlant_inasistencia_panel_v1', () => {
  const row = db.prepare("SELECT cliente, layout FROM dashboards_config WHERE cliente = 'ORLANT'").get();
  if (!row) return; // no existe todavia -> el seed ya la crea con la forma nueva
  let layout;
  try {
    layout = JSON.parse(row.layout);
  } catch (e) {
    return;
  }
  const target = CONFIGS.find((c) => c.cliente === 'ORLANT');
  if (!target) return;
  const targetTab = (target.layout.tabs || []).find((t) => t.key === 'inasistencia');
  if (!targetTab) return;

  const tab = (layout.tabs || []).find((t) => t.key === 'inasistencia');
  if (!tab) return;
  const yaEsNuevo = (tab.panels || []).some((p) => p.tipo === 'inasistencia_panel');
  if (yaEsNuevo) {
    if (!config.isTest) console.log('[db] Migracion dashboards_config_orlant_inasistencia_panel_v1: ya tenia inasistencia_panel, nada que hacer.');
    return;
  }
  const CAMPOS_VIEJOS = ['inasist_audifonos', 'inasist_audiologia', 'inasist_examenes', 'inasist_total'];
  const esViejoReconocible = (tab.panels || []).length === 4 &&
    (tab.panels || []).every((p, i) => p.tipo === 'line' && p.series && p.series[0] && p.series[0].fuente && p.series[0].fuente.campo === CAMPOS_VIEJOS[i]);
  if (!esViejoReconocible) {
    if (!config.isTest) {
      console.log('[db] Migracion dashboards_config_orlant_inasistencia_panel_v1: el tab "inasistencia" no coincide con la forma esperada (vieja ni nueva) — se deja intacta, revisar a mano.');
    }
    return;
  }

  tab.panels = JSON.parse(JSON.stringify(targetTab.panels));
  tab.subtabs = JSON.parse(JSON.stringify(targetTab.subtabs));
  db.prepare('UPDATE dashboards_config SET layout = ?, updatedAt = ? WHERE cliente = ?').run(
    JSON.stringify(layout),
    new Date().toISOString(),
    'ORLANT'
  );
  if (!config.isTest) {
    console.log('[db] Migracion dashboards_config_orlant_inasistencia_panel_v1 aplicada.');
  }
});

// ORLANT: Fase 101 (pedido del jefe) -- la vista PRINCIPAL de Inasistencia
// pasa a ser "Por mes" (total de TODAS las especialidades juntas, sin
// filtro, una sola grafica comparando citas vs. inasistencias con el %
// ponderado); "Por especialidad" deja de ser la principal y pasa a incluir
// la linea de tendencia que antes vivia en "Por mes". Mismo patron exacto
// que dashboards_config_orlant_inasistencia_panel_v1: detecta la forma
// VIEJA reconocible (la de la Fase 98 -- 3 paneles `inasistencia_panel` con
// vista especialidad/mes/detalle, en ese orden, y subtabs
// porespecialidad/pormes/detalle), reemplaza tab.panels Y tab.subtabs por
// los del seed actual. El tab sigue con `oculta:true` en la config guardada
// (dashboard-generic.js lo destapa en memoria segun si hay inasistencias
// cargadas, nunca aqui).
runOnceMigration('dashboards_config_orlant_inasistencia_panel_v2', () => {
  const row = db.prepare("SELECT cliente, layout FROM dashboards_config WHERE cliente = 'ORLANT'").get();
  if (!row) return; // no existe todavia -> el seed ya la crea con la forma nueva
  let layout;
  try {
    layout = JSON.parse(row.layout);
  } catch (e) {
    return;
  }
  const target = CONFIGS.find((c) => c.cliente === 'ORLANT');
  if (!target) return;
  const targetTab = (target.layout.tabs || []).find((t) => t.key === 'inasistencia');
  if (!targetTab) return;

  const tab = (layout.tabs || []).find((t) => t.key === 'inasistencia');
  if (!tab) return;
  const yaEsNuevo = (tab.panels || []).some((p) => p.vista === 'pormes' || p.vista === 'porespecialidad');
  if (yaEsNuevo) {
    if (!config.isTest) console.log('[db] Migracion dashboards_config_orlant_inasistencia_panel_v2: ya tenia la forma nueva, nada que hacer.');
    return;
  }
  const VISTAS_VIEJAS = ['especialidad', 'mes', 'detalle'];
  const esViejoReconocible = (tab.panels || []).length === 3 &&
    (tab.panels || []).every((p, i) => p.tipo === 'inasistencia_panel' && p.vista === VISTAS_VIEJAS[i]);
  if (!esViejoReconocible) {
    if (!config.isTest) {
      console.log('[db] Migracion dashboards_config_orlant_inasistencia_panel_v2: el tab "inasistencia" no coincide con la forma esperada (Fase 98 ni Fase 101) — se deja intacta, revisar a mano.');
    }
    return;
  }

  tab.panels = JSON.parse(JSON.stringify(targetTab.panels));
  tab.subtabs = JSON.parse(JSON.stringify(targetTab.subtabs));
  db.prepare('UPDATE dashboards_config SET layout = ?, updatedAt = ? WHERE cliente = ?').run(
    JSON.stringify(layout),
    new Date().toISOString(),
    'ORLANT'
  );
  if (!config.isTest) {
    console.log('[db] Migracion dashboards_config_orlant_inasistencia_panel_v2 aplicada.');
  }
});

// ORLANT: Fase 106 (pedido de InCo, textual: "que en Inasistencia solo
// quede en porcentaje, por mes") -- se retiran las sub-pestañas "Por
// especialidad" y "Detalle" (y los conteos sueltos de "Por mes": total de
// citas, atendidas, canceladas, inasistencias, pendientes); Inasistencia
// pasa a un SOLO panel `inasistencia_panel` (vista:'pormes'), sin
// `subtabs` (`[]`): una tarjeta y una grafica, las dos solo con el % de
// inasistencia PONDERADO por mes. Mismo patron exacto que
// dashboards_config_orlant_inasistencia_panel_v1/v2: detecta la forma
// VIEJA reconocible (la de la Fase 101, ya aplicada en produccion -- 3
// paneles `inasistencia_panel` con vista pormes/porespecialidad/detalle,
// en ese orden), reemplaza tab.panels Y tab.subtabs por los del seed
// actual. El tab sigue con `oculta:true` en la config guardada
// (dashboard-generic.js lo destapa en memoria segun si hay inasistencias
// cargadas, nunca aqui). El calculo ponderado, la tabla `inasistencias` y
// su carga no cambian -- esto es solo forma de la config de paneles.
runOnceMigration('dashboards_config_orlant_inasistencia_panel_v3', () => {
  const row = db.prepare("SELECT cliente, layout FROM dashboards_config WHERE cliente = 'ORLANT'").get();
  if (!row) return; // no existe todavia -> el seed ya la crea con la forma nueva
  let layout;
  try {
    layout = JSON.parse(row.layout);
  } catch (e) {
    return;
  }
  const target = CONFIGS.find((c) => c.cliente === 'ORLANT');
  if (!target) return;
  const targetTab = (target.layout.tabs || []).find((t) => t.key === 'inasistencia');
  if (!targetTab) return;

  const tab = (layout.tabs || []).find((t) => t.key === 'inasistencia');
  if (!tab) return;
  const yaEsNuevo = (tab.panels || []).length === 1 &&
    (tab.panels || []).every((p) => p.vista === 'pormes') &&
    !((tab.subtabs || []).length);
  if (yaEsNuevo) {
    if (!config.isTest) console.log('[db] Migracion dashboards_config_orlant_inasistencia_panel_v3: ya tenia la forma nueva, nada que hacer.');
    return;
  }
  const VISTAS_VIEJAS = ['pormes', 'porespecialidad', 'detalle'];
  const esViejoReconocible = (tab.panels || []).length === 3 &&
    (tab.panels || []).every((p, i) => p.tipo === 'inasistencia_panel' && p.vista === VISTAS_VIEJAS[i]);
  if (!esViejoReconocible) {
    if (!config.isTest) {
      console.log('[db] Migracion dashboards_config_orlant_inasistencia_panel_v3: el tab "inasistencia" no coincide con la forma esperada (Fase 101 ni Fase 106) — se deja intacta, revisar a mano.');
    }
    return;
  }

  tab.panels = JSON.parse(JSON.stringify(targetTab.panels));
  tab.subtabs = JSON.parse(JSON.stringify(targetTab.subtabs || []));
  db.prepare('UPDATE dashboards_config SET layout = ?, updatedAt = ? WHERE cliente = ?').run(
    JSON.stringify(layout),
    new Date().toISOString(),
    'ORLANT'
  );
  if (!config.isTest) {
    console.log('[db] Migracion dashboards_config_orlant_inasistencia_panel_v3 aplicada.');
  }
});

// Columna SERVICE_LEVEL_5MIN opcional en trafico_whatsapp (Fase 87, tema B,
// nota del jefe: "En WhatsApp el nivel de servicio es de 5 minutos") --
// mismo patron que trafico_whatsapp_aht_v1 (no se agrega directo al CREATE
// TABLE de arriba para que esta migracion funcione igual en una base nueva
// o en una que ya tenia filas, evita "duplicate column name").
runOnceMigration('trafico_whatsapp_service_level_5min_v1', () => {
  db.exec('ALTER TABLE trafico_whatsapp ADD COLUMN serviceLevel5minPct REAL');
  if (!config.isTest) {
    console.log('[db] Migracion trafico_whatsapp_service_level_5min_v1 aplicada.');
  }
});

// Fase 87 (tema C, nota del jefe: "unificar tipo de letra / letra capital"):
// corrige tildes/capitalizacion en los textos de layout.tabs de ORLANT ya
// sembrado en produccion -- dashboards_config solo se siembra la primera
// vez que un cliente no existe (mismo motivo que las migraciones de texto
// anteriores, ej. dashboards_config_orlant_kpis_vacios_v1), asi que un
// cambio nuevo en dashboard-config-seed.js nunca le llega solo a una fila
// ya sembrada. Recorre TODO el arbol de layout.tabs (label/titulo/
// plantilla/notas, a cualquier profundidad) y reemplaza SOLO coincidencias
// EXACTAS del texto completo de cada campo (nunca un reemplazo de
// substring, que podria corromper un campo que solo contenga la palabra
// vieja como parte de un texto mas largo no listado aqui) -- si el texto ya
// fue editado a mano o no calza exacto, se deja intacto. SOLO ORLANT (otros
// clientes conservan su texto, ver PROGRESS.md de esta fase para la lista
// de los que quedarian distintos).
runOnceMigration('dashboards_config_orlant_texto_tildes_v1', () => {
  const row = db.prepare('SELECT cliente, titulo, layout FROM dashboards_config WHERE cliente = ?').get('ORLANT');
  if (!row) return; // no existe todavia -> el seed ya la crea con el texto nuevo
  let layout;
  try {
    layout = JSON.parse(row.layout);
  } catch (e) {
    return;
  }
  // `titulo` es una columna aparte de `layout` (el titulo grande del modal
  // del dashboard, dashboard-generic.js: _gd.config.titulo) -- mismo mapa,
  // coincidencia EXACTA.
  const tituloNuevo = row.titulo === 'Dashboard Clinica Orlant' ? 'Dashboard Clínica Orlant' : row.titulo;

  const MAPA_TEXTO = {
    'Llamadas Linea General por mes': 'Llamadas Línea General por mes',
    'WhatsApp Linea General por mes': 'WhatsApp Línea General por mes',
    'Llamadas Linea General': 'Llamadas Línea General',
    'WhatsApp Linea General': 'WhatsApp Línea General',
    'Linea General': 'Línea General',
    'Linea 3P': 'Línea 3P',
    'Tipificacion': 'Tipificación',
    'Ordenamiento medico': 'Ordenamiento médico',
    'Ordenamiento Medico': 'Ordenamiento Médico',
    'Efectividad del año — Ordenamiento medico 3P': 'Efectividad del año — Ordenamiento médico 3P',
    'De la estrategia de agendamiento por ordenamiento medico en consulta medica, se han gestionado un total de {gestionados} pacientes, de los cuales se han logrado agendar {agendados} — efectividad del año: {efectividad}%.':
      'De la estrategia de agendamiento por ordenamiento médico en consulta médica, se han gestionado un total de {gestionados} pacientes, de los cuales se han logrado agendar {agendados} — efectividad del año: {efectividad}%.',
    'Recuperacion de cancelados': 'Recuperación de cancelados',
    'Recuperacion de Cancelados': 'Recuperación de Cancelados',
    'Agendas por linea': 'Agendas por línea',
    'Agendas por Linea': 'Agendas por Línea',
    'Total agendas — variacion % mes a mes': 'Total agendas — variación % mes a mes',
    '% Variacion': '% Variación',
    'Variacion % Agendas': 'Variación % Agendas',
    'Audifonos': 'Audífonos',
    'Audiologia': 'Audiología',
    'Examenes': 'Exámenes',
    'Gestion STA': 'Gestión STA',
    'Ordenes por servicio (año)': 'Órdenes por servicio (año)',
    'Ordenes por Servicio (año)': 'Órdenes por Servicio (Año)',
    'Estado de ordenes cargadas al STA (año)': 'Estado de órdenes cargadas al STA (año)',
    'Estado de Ordenes (año)': 'Estado de Órdenes (Año)',
    'Ordenes Cargadas': 'Órdenes Cargadas',
    'Ordenes': 'Órdenes',
    'No incluye Cirugia, Pre-revisado de cirugia, Procedimiento menor ni Otros servicios — esos se gestionan aparte.':
      'No incluye Cirugía, Pre-revisado de cirugía, Procedimiento menor ni Otros servicios — esos se gestionan aparte.',
    'Citas para el mes': 'Citas para el Mes',
    'Distribucion de clasificacion': 'Distribución de clasificación',
    'Trafico de Llamadas': 'Tráfico de Llamadas',
    'Trafico de WhatsApp': 'Tráfico de WhatsApp',
  };

  function migrarValor(v) {
    return typeof v === 'string' && Object.prototype.hasOwnProperty.call(MAPA_TEXTO, v) ? MAPA_TEXTO[v] : v;
  }
  function migrarRecursivo(node) {
    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) {
        if (typeof node[i] === 'string') node[i] = migrarValor(node[i]);
        else migrarRecursivo(node[i]);
      }
    } else if (node && typeof node === 'object') {
      for (const k of Object.keys(node)) {
        if (typeof node[k] === 'string') node[k] = migrarValor(node[k]);
        else migrarRecursivo(node[k]);
      }
    }
  }
  migrarRecursivo(layout.tabs || []);

  db.prepare('UPDATE dashboards_config SET titulo = ?, layout = ?, updatedAt = ? WHERE cliente = ?').run(
    tituloNuevo,
    JSON.stringify(layout),
    new Date().toISOString(),
    'ORLANT'
  );
  if (!config.isTest) {
    console.log('[db] Migracion dashboards_config_orlant_texto_tildes_v1 aplicada.');
  }
});

// Fase 94 (tema A, pedido de Edwin): orden de las pestañas de ORLANT --
// Trafico de Llamadas -> Trafico de WhatsApp -> Agendamiento -> Tipificacion
// -> Calidad (hoy Calidad va primero). Solo reordena, nunca toca panels/
// subtabs/oculta de ninguna pestaña -- puramente un reacomodo del array
// `tabs` (el orden del array decide el orden del menu Y cual pestaña queda
// activa por defecto: `_gdTabsVisibles()[0]`, dashboard-generic.js). Mismo
// motivo de siempre: dashboards_config ya existe en produccion, asi que el
// orden nuevo del seed nunca le habria llegado solo.
runOnceMigration('dashboards_config_orlant_orden_pestanas_v1', () => {
  const row = db.prepare("SELECT cliente, layout FROM dashboards_config WHERE cliente = 'ORLANT'").get();
  if (!row) return; // no existe todavia -> el seed ya la crea con el orden nuevo
  let layout;
  try {
    layout = JSON.parse(row.layout);
  } catch (e) {
    return;
  }
  const ORDEN = ['trafico', 'trafico_whatsapp', 'agendamiento', 'tipificacion', 'calidad'];
  const tabs = layout.tabs || [];
  const porClave = {};
  tabs.forEach((t) => {
    if (t && t.key) porClave[t.key] = t;
  });
  // Si falta alguna de las 5 claves esperadas (config editada a mano a algo
  // distinto), se deja intacta y se loguea -- mismo criterio de las
  // migraciones anteriores de ORLANT.
  if (!ORDEN.every((k) => porClave[k])) {
    if (!config.isTest) {
      console.log('[db] Migracion dashboards_config_orlant_orden_pestanas_v1: faltan pestañas esperadas, se deja intacta.');
    }
    return;
  }
  const yaEnOrden = ORDEN.every((k, i) => tabs[i] && tabs[i].key === k);
  if (yaEnOrden) return; // ya tiene el orden nuevo, nada que hacer (dos corridas seguidas = mismo resultado)

  const resto = tabs.filter((t) => ORDEN.indexOf(t && t.key) === -1);
  layout.tabs = ORDEN.map((k) => porClave[k]).concat(resto);

  db.prepare('UPDATE dashboards_config SET layout = ?, updatedAt = ? WHERE cliente = ?').run(
    JSON.stringify(layout),
    new Date().toISOString(),
    'ORLANT'
  );
  if (!config.isTest) {
    console.log('[db] Migracion dashboards_config_orlant_orden_pestanas_v1 aplicada.');
  }
});

// Fase 98 (ORLANT, pedido URGENTE de Edwin): Inasistencia se para justo
// despues de Agendamiento (orden completo: Trafico de Llamadas -> Trafico
// de WhatsApp -> Agendamiento -> Inasistencia -> Tipificacion -> Calidad).
// dashboards_config_orlant_orden_pestanas_v1 (arriba) ya puso las primeras
// 5 pestañas en orden, pero corrio ANTES de que existiera este tab con la
// forma nueva -- produccion ya tiene ese layout aplicado, asi que el orden
// nuevo del seed no le llega solo. Esta migracion SOLO reubica
// 'inasistencia' (la saca de donde este y la inserta justo despues de
// 'agendamiento'), nunca toca panels/subtabs/oculta de ningun tab.
runOnceMigration('dashboards_config_orlant_orden_pestanas_v2', () => {
  const row = db.prepare("SELECT cliente, layout FROM dashboards_config WHERE cliente = 'ORLANT'").get();
  if (!row) return; // no existe todavia -> el seed ya la crea con el orden nuevo
  let layout;
  try {
    layout = JSON.parse(row.layout);
  } catch (e) {
    return;
  }
  const tabs = layout.tabs || [];
  const idxAgendamiento = tabs.findIndex((t) => t && t.key === 'agendamiento');
  const idxInasistencia = tabs.findIndex((t) => t && t.key === 'inasistencia');
  if (idxAgendamiento === -1 || idxInasistencia === -1) {
    if (!config.isTest) {
      console.log('[db] Migracion dashboards_config_orlant_orden_pestanas_v2: faltan pestañas esperadas, se deja intacta.');
    }
    return;
  }
  if (idxInasistencia === idxAgendamiento + 1) return; // ya esta en la posicion correcta (dos corridas seguidas = mismo resultado)

  const tabInasistencia = tabs.splice(idxInasistencia, 1)[0];
  const nuevoIdxAgendamiento = tabs.findIndex((t) => t && t.key === 'agendamiento');
  tabs.splice(nuevoIdxAgendamiento + 1, 0, tabInasistencia);
  layout.tabs = tabs;

  db.prepare('UPDATE dashboards_config SET layout = ?, updatedAt = ? WHERE cliente = ?').run(
    JSON.stringify(layout),
    new Date().toISOString(),
    'ORLANT'
  );
  if (!config.isTest) {
    console.log('[db] Migracion dashboards_config_orlant_orden_pestanas_v2 aplicada.');
  }
});

// Fase 94 (tema B, pedido de Edwin): Agendamiento de ORLANT queda SOLO con
// datos reales de la tabla `agendas` -- 4 sub-pestañas que comparten los
// mismos filtros (Por especialidad / Total agendas / Agendas por línea /
// Agendas por agente, ver public/js/agendas.js). "Ordenamiento Médico" y
// "Recuperación de Cancelados" (hoja "resumen", vacía) salen a sus propias
// pestañas ocultas -- MISMA config exacta, nada se borra ni se recalcula,
// solo cambia de donde cuelgan. "Variación % Agendas" se quita del todo
// (pedido explicito). dashboards_config ya existia en produccion (con la
// forma de la Fase 78: "Citas por Especialidad" + 6 paneles de "resumen"),
// asi que la forma nueva del seed nunca le habria llegado sola.
runOnceMigration('dashboards_config_orlant_agendamiento_edwin_v1', () => {
  const row = db.prepare("SELECT cliente, layout FROM dashboards_config WHERE cliente = 'ORLANT'").get();
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
  if (!targetTabs.agendamiento) return;

  const tabs = layout.tabs || [];
  const agenda = tabs.find((t) => t.key === 'agendamiento');
  if (!agenda) return;

  const yaEsNuevo = (agenda.panels || []).length > 0 && (agenda.panels || []).every((p) => p.tipo === 'agendas_panel');
  if (yaEsNuevo) return; // ya tiene la forma nueva, nada que hacer (dos corridas seguidas = mismo resultado)

  // Forma "vieja" reconocible (Fase 78 -> antes de esta fase): 7 paneles,
  // el primero "Citas por Especialidad" (agendas_panel). Si no coincide
  // (config editada a mano a algo distinto), se deja intacta y se loguea,
  // igual que las demas migraciones de ORLANT.
  const esViejoReconocible = (agenda.panels || []).length === 7 && agenda.panels[0] && agenda.panels[0].tipo === 'agendas_panel';
  if (!esViejoReconocible) {
    if (!config.isTest) {
      console.log(`[db] Migracion dashboards_config_orlant_agendamiento_edwin_v1: tab "agendamiento" tiene ${(agenda.panels || []).length} panel(es) en una forma no reconocida -- se deja intacta, revisar a mano.`);
    }
    return;
  }

  agenda.panels = JSON.parse(JSON.stringify(targetTabs.agendamiento.panels));
  agenda.subtabs = JSON.parse(JSON.stringify(targetTabs.agendamiento.subtabs));

  // Las 2 pestañas nuevas (ocultas) con la config EXACTA que tenian adentro
  // de Agendamiento -- solo si no existen ya (idempotente / no pisa una
  // personalizacion posterior si alguien ya las agrego a mano).
  if (!tabs.some((t) => t.key === 'ordenamiento_medico') && targetTabs.ordenamiento_medico) {
    tabs.push(JSON.parse(JSON.stringify(targetTabs.ordenamiento_medico)));
  }
  if (!tabs.some((t) => t.key === 'recuperacion_cancelados') && targetTabs.recuperacion_cancelados) {
    tabs.push(JSON.parse(JSON.stringify(targetTabs.recuperacion_cancelados)));
  }
  layout.tabs = tabs;

  db.prepare('UPDATE dashboards_config SET layout = ?, updatedAt = ? WHERE cliente = ?').run(
    JSON.stringify(layout),
    new Date().toISOString(),
    'ORLANT'
  );
  if (!config.isTest) {
    console.log('[db] Migracion dashboards_config_orlant_agendamiento_edwin_v1 aplicada.');
  }
});

// Fase 95 (tema A): agrega asesorUserId a monitoreos para que "Mis
// Resultados" (GET /monitoreos/mios) pueda identificar al asesor por id en
// vez de solo por nombre -- dos usuarios ASESOR con el mismo nombre hacian
// que uno viera (o no viera) los monitoreos del otro. No se agrega directo
// al CREATE TABLE de arriba para que esta migracion funcione igual en una
// base nueva o en una que ya tenia filas (evita "duplicate column name").
// Las filas existentes NO se tocan: quedan con asesorUserId NULL y la
// consulta de /monitoreos/mios sigue resolviendolas por nombre (fallback).
runOnceMigration('monitoreos_asesor_user_id_v1', () => {
  db.exec(`
    ALTER TABLE monitoreos ADD COLUMN asesorUserId INTEGER;
    CREATE INDEX IF NOT EXISTS idx_monitoreos_asesor_user_id ON monitoreos(asesorUserId);
  `);
  if (!config.isTest) {
    console.log('[db] Migracion monitoreos_asesor_user_id_v1 aplicada.');
  }
});

// Fase 95 (tema C): agrega vistoPorAsesorAt a monitoreos (se marca cuando
// el asesor dueño abre el detalle en "Mis Resultados") y guarda en
// app_config el id de monitoreo desde el que cuenta la alerta de
// "monitoreo nuevo" -- el maximo id que existia justo antes de que esta
// migracion corriera. Asi los monitoreos viejos (incluidos los datos de
// prueba de Calidad, Asesor 01-05) NUNCA disparan la alerta, sin tocar
// ninguna de sus filas: solo cuentan los que se crean despues del deploy
// de esta fase. No se agrega la columna directo al CREATE TABLE de arriba
// para que esta migracion funcione igual en una base nueva o en una que
// ya tenia filas (evita "duplicate column name").
runOnceMigration('monitoreos_visto_por_asesor_v1', () => {
  db.exec('ALTER TABLE monitoreos ADD COLUMN vistoPorAsesorAt TEXT;');
  const maxRow = db.prepare('SELECT COALESCE(MAX(id), 0) AS maxId FROM monitoreos').get();
  db.prepare('INSERT OR IGNORE INTO app_config (clave, valor) VALUES (?, ?)').run(
    'alertaAsesorDesdeMonitoreoId',
    String(maxRow.maxId)
  );
  if (!config.isTest) {
    console.log(`[db] Migracion monitoreos_visto_por_asesor_v1 aplicada (cuenta desde id > ${maxRow.maxId}).`);
  }
});

// Fase 100 (hallazgo real en produccion, revision final antes de entregar
// ORLANT): la Fase 98 (adenda, PR #212) marco los 4 campos viejos de
// inasistencia de la hoja "resumen" (inasist_audifonos/audiologia/
// examenes/total) como opcional+ocultaEnPlantilla en
// server/dashboard-secciones.js (SECCIONES.ORLANT.resumen.columnas) para
// que la plantilla descargable dejara de pedirlos -- pero, mismo patron
// exacto que dashboards_config_orlant_resumen_trafico_opcional_v1/v2 de
// arriba, ese cambio de codigo nunca le llega solo a la fila YA sembrada
// de dashboards_config (GET /dashboard/secciones/ORLANT lee
// dashboards_config.secciones, nunca el archivo en vivo). Sin esta
// migracion, la plantilla descargable de produccion seguia listando esos
// 4 campos viejos (confirmado bajando la plantilla real en produccion,
// Fase 100) aunque el codigo ya los marcara ocultos. Idempotente: si ya
// estan marcados, no hace nada. No borra ningun dato cargado.
runOnceMigration('dashboards_config_orlant_resumen_inasist_opcional_v1', () => {
  const INASIST_KEYS = ['inasist_audifonos', 'inasist_audiologia', 'inasist_examenes', 'inasist_total'];

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
    if (col && INASIST_KEYS.includes(col.key) && !col.ocultaEnPlantilla) {
      col.opcional = true;
      col.ocultaEnPlantilla = true;
      tocado = true;
    }
  });
  if (!tocado) return; // ya tiene la forma nueva -- nada que hacer

  db.prepare('UPDATE dashboards_config SET secciones = ?, updatedAt = ? WHERE cliente = ?').run(
    JSON.stringify(secciones),
    new Date().toISOString(),
    'ORLANT'
  );
  if (!config.isTest) {
    console.log('[db] Migracion dashboards_config_orlant_resumen_inasist_opcional_v1 aplicada.');
  }
});

// Fase 104 (pedido de InCo): "Agendas por agente" (panel index 3 de la
// pestaña Agendamiento, vista:'agente', top 12 + "Otros") se reemplaza por
// "Ranking de Asesores" (vista:'ranking', ranking completo). dashboards_config
// de ORLANT ya existia en produccion con la forma vieja (vista:'agente'),
// asi que la forma nueva del seed nunca le habria llegado sola.
//
// El panel y la sub-pestaña se verifican y corrigen POR SEPARADO (nunca uno
// gateado por el estado del otro): la migracion vieja
// dashboards_config_orlant_pdf_graficas_v1 (de antes de esta fase, ya
// aplicada en produccion) reconoce "forma vieja" de "agendamiento" solo por
// CANTIDAD de paneles (4) -- una condicion que, en una base que corre TODAS
// las migraciones desde cero (instancia nueva, `seed:demo`, los tests de
// este archivo), calza con la forma de ESTA fase tambien y alcanza a
// reemplazar `panels` usando el CONFIGS actual (ya con vista:'ranking')
// antes de que esta migracion corra -- pero esa migracion vieja nunca toca
// `subtabs`. Si el fix de abajo dependiera de `panelAgente.vista==='agente'`
// para tambien arreglar la sub-pestaña, ese escenario (panel ya nuevo,
// sub-pestaña todavia vieja) quedaria con "Agendas por agente" colgando de
// un panel vista:'ranking' -- sin romper nada visualmente raro, pero sin
// converger a la forma real de CONFIGS. En produccion esa migracion vieja
// YA corrio hace meses (no se repite), asi que alli el panel SI llega como
// 'agente' y ambos fixes corren juntos -- pero esta migracion debe converger
// igual sin depender de ese orden.
runOnceMigration('dashboards_config_orlant_ranking_asesores_v1', () => {
  const row = db.prepare("SELECT cliente, layout FROM dashboards_config WHERE cliente = 'ORLANT'").get();
  if (!row) return; // no existe todavia -> el seed ya la crea con la forma nueva
  let layout;
  try {
    layout = JSON.parse(row.layout);
  } catch (e) {
    return;
  }
  const target = CONFIGS.find((c) => c.cliente === 'ORLANT');
  if (!target) return;
  const targetAgenda = (target.layout.tabs || []).find((t) => t.key === 'agendamiento');
  if (!targetAgenda) return;

  const agenda = (layout.tabs || []).find((t) => t.key === 'agendamiento');
  if (!agenda || !Array.isArray(agenda.panels)) return;

  let tocado = false;

  const panelAgente = agenda.panels[3];
  if (panelAgente && panelAgente.tipo === 'agendas_panel' && panelAgente.vista === 'agente') {
    agenda.panels[3] = JSON.parse(JSON.stringify(targetAgenda.panels[3]));
    tocado = true;
  } else if (panelAgente && panelAgente.tipo === 'agendas_panel' && panelAgente.vista !== 'ranking') {
    if (!config.isTest) {
      console.log(`[db] Migracion dashboards_config_orlant_ranking_asesores_v1: panel 3 de "agendamiento" tiene vista "${panelAgente.vista}" (no "agente" ni "ranking") -- se deja intacto, revisar a mano.`);
    }
  } else if (!panelAgente || panelAgente.tipo !== 'agendas_panel') {
    if (!config.isTest) {
      console.log('[db] Migracion dashboards_config_orlant_ranking_asesores_v1: panel 3 de "agendamiento" no es un agendas_panel reconocible -- se deja intacto, revisar a mano.');
    }
  }

  // Igual que el resto de las migraciones de este archivo: solo se
  // reemplaza la forma VIEJA reconocible exacta ('agendasporagente',
  // Fase 94) -- cualquier otra cosa (una personalizacion, o un fixture de
  // otra migracion/prueba que no tiene nada que ver con esta) se deja
  // intacta, nunca se fuerza a la forma nueva solo porque no coincide.
  const subtabAgente = (agenda.subtabs || []).find((s) => (s.indices || []).includes(3));
  const targetSubtab = (targetAgenda.subtabs || []).find((s) => (s.indices || []).includes(3));
  if (subtabAgente && targetSubtab && subtabAgente.key === 'agendasporagente') {
    subtabAgente.key = targetSubtab.key;
    subtabAgente.label = targetSubtab.label;
    tocado = true;
  }

  if (!tocado) return; // ya tiene la forma nueva en ambos lados (dos corridas seguidas = mismo resultado)

  db.prepare('UPDATE dashboards_config SET layout = ?, updatedAt = ? WHERE cliente = ?').run(
    JSON.stringify(layout),
    new Date().toISOString(),
    'ORLANT'
  );
  if (!config.isTest) {
    console.log('[db] Migracion dashboards_config_orlant_ranking_asesores_v1 aplicada.');
  }
});

// Inasistencia (Fase 108, pedido textual de InCo: "que se pueda filtrar
// por sede, especialidad, nombre entidad"): la tabla pasa de un agregado
// por (campana,mes,especialidad) a (campana,mes,sede,especialidad,entidad)
// -- mismo patron de recrear tabla que hlm_sede_consolidacion_v1 (CREATE
// TABLE nueva + INSERT + DROP + RENAME, todo en una transaccion), guardado
// con PRAGMA table_info para no reventar "duplicate column" en una base
// que corre esta migracion 2 veces o que ya nace con la forma nueva (el
// CREATE TABLE de arriba ya declara sede/entidad). Las filas YA CARGADAS
// con el formato viejo (Ago-26 de 3 especialidades, Sep-26 de 1 -- Fase
// 98-106, sin sede/entidad real) quedan con sede='SIN DATO',
// entidad='SIN DATO' -- no se pierde nada, solo que esas filas no
// participan de los filtros nuevos de sede/entidad (inasistenciaOpciones
// las excluye de las listas de valores, ver server/inasistencia.js).
runOnceMigration('inasistencias_sede_entidad_v1', () => {
  const cols = db.prepare('PRAGMA table_info(inasistencias)').all().map((c) => c.name);
  if (cols.includes('sede')) return; // base nueva (ya nace con la forma de arriba) o ya migrada

  const tx = db.transaction(() => {
    db.exec(`
      CREATE TABLE inasistencias_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        campana TEXT NOT NULL,
        mes TEXT NOT NULL,
        sede TEXT NOT NULL,
        especialidad TEXT NOT NULL,
        entidad TEXT NOT NULL,
        cancelada INTEGER NOT NULL,
        inasistencia INTEGER NOT NULL,
        pendiente INTEGER NOT NULL,
        atendidas INTEGER NOT NULL,
        total INTEGER NOT NULL,
        archivoNombre TEXT NOT NULL DEFAULT '',
        cargadoPorNombre TEXT NOT NULL DEFAULT '',
        createdAt TEXT NOT NULL,
        UNIQUE(campana, mes, sede, especialidad, entidad)
      );
      INSERT INTO inasistencias_new
        (id, campana, mes, sede, especialidad, entidad, cancelada, inasistencia, pendiente, atendidas, total, archivoNombre, cargadoPorNombre, createdAt)
      SELECT id, campana, mes, 'SIN DATO', especialidad, 'SIN DATO', cancelada, inasistencia, pendiente, atendidas, total, archivoNombre, cargadoPorNombre, createdAt
      FROM inasistencias;
      DROP TABLE inasistencias;
      ALTER TABLE inasistencias_new RENAME TO inasistencias;
      CREATE INDEX IF NOT EXISTS idx_inasistencias_campana_mes ON inasistencias(campana, mes);
    `);
  });
  tx();
  if (!config.isTest) {
    console.log('[db] Migracion inasistencias_sede_entidad_v1 aplicada.');
  }
});

// Fase 108 (pedido textual de InCo: filtros de sede/especialidad/entidad +
// sub-pestaña "Por especialidad" por mes elegido): el tab "inasistencia" de
// ORLANT pasa de 1 panel sin subtabs (Fase 106) a 2 paneles
// (vista:'pormes'/'porespecialidad') con subtabs -- dashboards_config ya
// existia en produccion con la forma de la Fase 106, asi que esta forma
// nueva del seed nunca le habria llegado sola. Mismo patron de deteccion
// de "forma vieja reconocible" que v1/v2/v3: si no calza EXACTO, se deja
// intacta y solo se loguea (podria ser una personalizacion).
runOnceMigration('dashboards_config_orlant_inasistencia_panel_v4', () => {
  const row = db.prepare("SELECT cliente, layout FROM dashboards_config WHERE cliente = 'ORLANT'").get();
  if (!row) return; // no existe todavia -> el seed ya la crea con la forma nueva
  let layout;
  try {
    layout = JSON.parse(row.layout);
  } catch (e) {
    return;
  }
  const target = CONFIGS.find((c) => c.cliente === 'ORLANT');
  if (!target) return;
  const targetTab = (target.layout.tabs || []).find((t) => t.key === 'inasistencia');
  if (!targetTab) return;

  const tab = (layout.tabs || []).find((t) => t.key === 'inasistencia');
  if (!tab) return;
  const yaEsNuevo = (tab.panels || []).length === 2 &&
    (tab.panels || []).some((p) => p.vista === 'porespecialidad') &&
    (tab.subtabs || []).length === 2;
  if (yaEsNuevo) {
    if (!config.isTest) console.log('[db] Migracion dashboards_config_orlant_inasistencia_panel_v4: ya tenia la forma nueva, nada que hacer.');
    return;
  }
  const esViejoReconocible = (tab.panels || []).length === 1 &&
    tab.panels[0].tipo === 'inasistencia_panel' && tab.panels[0].vista === 'pormes' &&
    !((tab.subtabs || []).length);
  if (!esViejoReconocible) {
    if (!config.isTest) {
      console.log('[db] Migracion dashboards_config_orlant_inasistencia_panel_v4: el tab "inasistencia" no coincide con la forma esperada (Fase 106) -- se deja intacta, revisar a mano.');
    }
    return;
  }

  tab.panels = JSON.parse(JSON.stringify(targetTab.panels));
  tab.subtabs = JSON.parse(JSON.stringify(targetTab.subtabs || []));
  db.prepare('UPDATE dashboards_config SET layout = ?, updatedAt = ? WHERE cliente = ?').run(
    JSON.stringify(layout),
    new Date().toISOString(),
    'ORLANT'
  );
  if (!config.isTest) {
    console.log('[db] Migracion dashboards_config_orlant_inasistencia_panel_v4 aplicada.');
  }
});

// "Ranking de asesores" de ORLANT (Fase 111, pedido textual de Edwin: "el
// ranking va a ser efectividad por agendamiento"): el panel[3] del tab
// "agendamiento" pasa de `agendas_panel`/vista:'ranking' (Fase 104,
// calculado por CANTIDAD de agendas) a `efectividad_agendamiento_panel`
// (calculado por EFECTIVIDAD = agendas/gestiones, tabla nueva
// `efectividad_agendamiento`) -- produccion ya tenia este panel sembrado
// con la forma vieja (Fase 104), asi que la forma nueva del seed nunca le
// habria llegado sola. Mismo patron de deteccion de "forma vieja
// reconocible" que el resto de migraciones de dashboards_config: si no
// calza EXACTO, se deja intacta y solo se loguea (podria ser una
// personalizacion). El subtab ('rankingasesores', indices:[3]) no cambia
// de key/label/indice -- solo el panel que apunta.
runOnceMigration('dashboards_config_orlant_efectividad_agendamiento_v1', () => {
  const row = db.prepare("SELECT cliente, layout FROM dashboards_config WHERE cliente = 'ORLANT'").get();
  if (!row) return; // no existe todavia -> el seed ya la crea con la forma nueva
  let layout;
  try {
    layout = JSON.parse(row.layout);
  } catch (e) {
    return;
  }
  const target = CONFIGS.find((c) => c.cliente === 'ORLANT');
  if (!target) return;
  const targetAgenda = (target.layout.tabs || []).find((t) => t.key === 'agendamiento');
  if (!targetAgenda) return;

  const agenda = (layout.tabs || []).find((t) => t.key === 'agendamiento');
  if (!agenda || !Array.isArray(agenda.panels)) return;

  const panelRanking = agenda.panels[3];
  if (panelRanking && panelRanking.tipo === 'efectividad_agendamiento_panel') {
    return; // ya tiene la forma nueva -- nada que hacer (corrida 2 veces seguidas = mismo resultado)
  }
  if (!panelRanking || panelRanking.tipo !== 'agendas_panel' || panelRanking.vista !== 'ranking') {
    if (!config.isTest) {
      console.log('[db] Migracion dashboards_config_orlant_efectividad_agendamiento_v1: panel 3 de "agendamiento" no coincide con la forma esperada (Fase 104) -- se deja intacto, revisar a mano.');
    }
    return;
  }

  agenda.panels[3] = JSON.parse(JSON.stringify(targetAgenda.panels[3]));

  db.prepare('UPDATE dashboards_config SET layout = ?, updatedAt = ? WHERE cliente = ?').run(
    JSON.stringify(layout),
    new Date().toISOString(),
    'ORLANT'
  );
  if (!config.isTest) {
    console.log('[db] Migracion dashboards_config_orlant_efectividad_agendamiento_v1 aplicada.');
  }
});

// "Efectividad de Citas" de ORLANT (Fase 111, pedido textual de InCo):
// hoy leia citas_para_mes/citas_atendidas de la hoja "resumen" (filaUnica,
// que nunca tuvo datos reales) con un panel `combo` generico -- pasa a su
// propio panel (`efectividad_citas_panel`, tabla nueva `efectividad_citas`)
// Y se mueve de "al final, despues de Gestión STA" a "justo despues de
// Inasistencia" (pedido explicito). Produccion ya tenia el tab "efectividad"
// sembrado con la forma vieja en la posicion vieja, asi que la forma/orden
// nuevos del seed nunca le habrian llegado solos. Mismo patron de
// deteccion de "forma vieja reconocible" que el resto de migraciones de
// dashboards_config: si no calza EXACTO, se deja intacta y solo se loguea
// (podria ser una personalizacion).
runOnceMigration('dashboards_config_orlant_efectividad_citas_v1', () => {
  const row = db.prepare("SELECT cliente, layout FROM dashboards_config WHERE cliente = 'ORLANT'").get();
  if (!row) return; // no existe todavia -> el seed ya la crea con la forma/orden nuevos
  let layout;
  try {
    layout = JSON.parse(row.layout);
  } catch (e) {
    return;
  }
  const target = CONFIGS.find((c) => c.cliente === 'ORLANT');
  if (!target) return;
  const targetEfectividad = (target.layout.tabs || []).find((t) => t.key === 'efectividad');
  if (!targetEfectividad) return;

  const tabs = layout.tabs || [];
  const idxEfectividad = tabs.findIndex((t) => t && t.key === 'efectividad');
  if (idxEfectividad === -1) return; // no deberia pasar (el seed siempre lo trae oculto) -- nada que migrar

  let tocado = false;
  const tabEfectividad = tabs[idxEfectividad];
  const panelViejo = (tabEfectividad.panels || [])[0];
  const yaEsNuevo = panelViejo && panelViejo.tipo === 'efectividad_citas_panel';
  const esViejoReconocible = (tabEfectividad.panels || []).length === 1 &&
    panelViejo && panelViejo.tipo === 'combo' && panelViejo.titulo === 'Efectividad de citas';

  if (yaEsNuevo) {
    // ya tiene la forma nueva -- solo falta confirmar la posicion (abajo).
  } else if (esViejoReconocible) {
    tabEfectividad.label = targetEfectividad.label;
    tabEfectividad.panels = JSON.parse(JSON.stringify(targetEfectividad.panels));
    tocado = true;
  } else {
    if (!config.isTest) {
      console.log('[db] Migracion dashboards_config_orlant_efectividad_citas_v1: el tab "efectividad" no coincide con la forma esperada (vieja ni nueva) -- se deja intacto, revisar a mano.');
    }
    return;
  }

  const idxInasistencia = tabs.findIndex((t) => t && t.key === 'inasistencia');
  if (idxInasistencia !== -1 && tabs[idxInasistencia + 1] !== tabEfectividad) {
    tabs.splice(tabs.indexOf(tabEfectividad), 1);
    const nuevoIdxInasistencia = tabs.findIndex((t) => t && t.key === 'inasistencia');
    tabs.splice(nuevoIdxInasistencia + 1, 0, tabEfectividad);
    layout.tabs = tabs;
    tocado = true;
  }

  if (!tocado) return; // ya tenia la forma Y la posicion nuevas (dos corridas seguidas = mismo resultado)

  db.prepare('UPDATE dashboards_config SET layout = ?, updatedAt = ? WHERE cliente = ?').run(
    JSON.stringify(layout),
    new Date().toISOString(),
    'ORLANT'
  );
  if (!config.isTest) {
    console.log('[db] Migracion dashboards_config_orlant_efectividad_citas_v1 aplicada.');
  }
});

// "resumen" de ORLANT (Fase 111, pedido textual de InCo): citas_para_mes/
// citas_atendidas quedan ocultaEnPlantilla (ver dashboard-secciones.js) --
// mismo patron EXACTO que dashboards_config_orlant_resumen_inasist_opcional_v1
// (Fase 100), solo que sobre otros 2 campos.
runOnceMigration('dashboards_config_orlant_resumen_citas_opcional_v1', () => {
  const CITAS_KEYS = ['citas_para_mes', 'citas_atendidas'];

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
    if (col && CITAS_KEYS.includes(col.key) && !col.ocultaEnPlantilla) {
      col.opcional = true;
      col.ocultaEnPlantilla = true;
      tocado = true;
    }
  });
  if (!tocado) return; // ya tiene la forma nueva -- nada que hacer

  db.prepare('UPDATE dashboards_config SET secciones = ?, updatedAt = ? WHERE cliente = ?').run(
    JSON.stringify(secciones),
    new Date().toISOString(),
    'ORLANT'
  );
  if (!config.isTest) {
    console.log('[db] Migracion dashboards_config_orlant_resumen_citas_opcional_v1 aplicada.');
  }
});

// Fase 113 (tema A): last_login_at alimenta la columna "Ultimo ingreso" de
// Usuarios (NULL para toda cuenta que no haya iniciado sesion desde este
// deploy -- el frontend muestra "Sin registro" para ese caso).
runOnceMigration('users_last_login_v1', () => {
  db.exec(`ALTER TABLE users ADD COLUMN last_login_at TEXT`);
  if (!config.isTest) {
    console.log('[db] Migracion users_last_login_v1 aplicada.');
  }
});

// Fase 113 (tema B): token_version se mete en el JWT al firmar (signToken,
// server/auth.js) y se compara en cada peticion contra el valor real en BD
// (getActor) -- al cambiar una contrasena (propia o por reseteo de admin)
// se incrementa, y cualquier token firmado antes deja de servir en la
// SIGUIENTE peticion, sin guardar una lista de tokens revocados.
runOnceMigration('users_token_version_v1', () => {
  db.exec(`ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 1`);
  if (!config.isTest) {
    console.log('[db] Migracion users_token_version_v1 aplicada.');
  }
});

// Historial: columnas ip/userAgent, usadas SOLO por los eventos de inicio/
// cierre de sesion (LOGIN_OK/LOGIN_FALLIDO/LOGOUT) -- el resto de acciones
// (ya existentes) las deja NULL. El navegador se guarda ya RESUMIDO (ej.
// "Chrome / Windows"), nunca el user-agent crudo completo.
runOnceMigration('historial_login_ip_ua_v1', () => {
  db.exec(`ALTER TABLE historial ADD COLUMN ip TEXT`);
  db.exec(`ALTER TABLE historial ADD COLUMN userAgent TEXT`);
  if (!config.isTest) {
    console.log('[db] Migracion historial_login_ip_ua_v1 aplicada.');
  }
});

// Fase 120: quita el AHT de Trafico de WhatsApp en ORLANT (Wolkvox nunca
// lo entrega -- confirmado contra los 2 archivos reales de ago-sep/2026,
// 258 filas, AHT siempre "----", 0 numericas). Marca el panel
// trafico_whatsapp_combo con mostrarAht:false para que el frontend quite
// la sub-pestana "AHT", la tarjeta "AHT Promedio" y la columna "AHT (seg)"
// del export -- SOLO en WhatsApp, Trafico de Llamadas (voz, que SI tiene
// AHT real) no se toca porque su panel es trafico_combo, no
// trafico_whatsapp_combo. Reactivar despues de que Wolkvox lo entregue es
// solo volver a poner mostrarAht:true via PUT /dashboards/config/ORLANT,
// sin tocar codigo (el lector de WhatsApp sigue leyendo la columna AHT
// numerica por si llega).
// Igual que dashboards_config_orlant_trafico_whatsapp_tab_v1 (arriba): si
// ORLANT ya tiene mostrarAht seteado a lo que sea (false o true) se deja
// intacto -- evita pisar un ajuste manual hecho despues del deploy. Revisa
// el campo PANEL y la pestana (tab.key) por separado, nunca solo el tipo
// de panel, porque la Fase 104 mostro que mezclar ambos niveles en una
// sola migracion puede dejar pestanas o paneles en un estado intermedio.
runOnceMigration('dashboards_config_orlant_whatsapp_sin_aht_v1', () => {
  const row = db.prepare("SELECT cliente, layout FROM dashboards_config WHERE cliente = 'ORLANT'").get();
  if (!row) return; // ORLANT no existe todavia -> el seed ya la crea con mostrarAht:false
  let layout;
  try {
    layout = JSON.parse(row.layout);
  } catch (e) {
    return;
  }
  const tabs = layout.tabs || [];
  const tabWpp = tabs.find((t) => t && t.key === 'trafico_whatsapp');
  if (!tabWpp) return; // esta instalacion no tiene la pestana de WhatsApp -- nada que hacer
  let cambio = false;
  (tabWpp.panels || []).forEach((p) => {
    if (p && p.tipo === 'trafico_whatsapp_combo' && !Object.prototype.hasOwnProperty.call(p, 'mostrarAht')) {
      p.mostrarAht = false;
      cambio = true;
    }
  });
  if (!cambio) return; // ya tenia el campo (por defecto o personalizado) -- nada que hacer
  layout.tabs = tabs;
  db.prepare('UPDATE dashboards_config SET layout = ?, updatedAt = ? WHERE cliente = ?').run(
    JSON.stringify(layout),
    new Date().toISOString(),
    'ORLANT'
  );
  if (!config.isTest) {
    console.log('[db] Migracion dashboards_config_orlant_whatsapp_sin_aht_v1 aplicada.');
  }
});

// Fase 126 (pedido de Edwin): quita el Nivel de Servicio a 5 minutos de
// Trafico de WhatsApp en ORLANT -- Wolkvox sigue sin mandar
// SERVICE_LEVEL_5MIN. Mismo patron EXACTO que
// dashboards_config_orlant_whatsapp_sin_aht_v1 (arriba): marca el panel
// trafico_whatsapp_combo con mostrarSL5min:false (si no tiene ya el campo
// seteado a lo que sea -- nunca pisa un ajuste manual) para que el
// frontend deje de mostrar la tarjeta/serie/aviso de 5 min y pase el SL a
// 20s al lugar principal, igual que Trafico de Llamadas. Reactivarlo
// despues de que Wolkvox lo entregue es solo volver a poner
// mostrarSL5min:true via PUT /dashboards/config/ORLANT, sin tocar codigo.
runOnceMigration('dashboards_config_orlant_whatsapp_sin_sl5min_v1', () => {
  const row = db.prepare("SELECT cliente, layout FROM dashboards_config WHERE cliente = 'ORLANT'").get();
  if (!row) return; // ORLANT no existe todavia -> el seed ya la crea con mostrarSL5min:false
  let layout;
  try {
    layout = JSON.parse(row.layout);
  } catch (e) {
    return;
  }
  const tabs = layout.tabs || [];
  const tabWpp = tabs.find((t) => t && t.key === 'trafico_whatsapp');
  if (!tabWpp) return; // esta instalacion no tiene la pestana de WhatsApp -- nada que hacer
  let cambio = false;
  (tabWpp.panels || []).forEach((p) => {
    if (p && p.tipo === 'trafico_whatsapp_combo' && !Object.prototype.hasOwnProperty.call(p, 'mostrarSL5min')) {
      p.mostrarSL5min = false;
      cambio = true;
    }
  });
  if (!cambio) return; // ya tenia el campo (por defecto o personalizado) -- nada que hacer
  layout.tabs = tabs;
  db.prepare('UPDATE dashboards_config SET layout = ?, updatedAt = ? WHERE cliente = ?').run(
    JSON.stringify(layout),
    new Date().toISOString(),
    'ORLANT'
  );
  if (!config.isTest) {
    console.log('[db] Migracion dashboards_config_orlant_whatsapp_sin_sl5min_v1 aplicada.');
  }
});

// "Salida" de ORLANT (Fase 127, pedido textual de Edwin: "las llamadas de
// salida estan muy bajas, hay que revisarlo"): el tab ya estaba sembrado
// (oculto) desde el PDF de InCo (2026-09-18) con 2 paneles `line`/
// filtroSerie leyendo dashboard_cargas generico POR DIA -- el archivo real
// de Edwin es MENSUAL, nunca tuvo datos reales. Pasa a un unico panel
// dedicado (`salida_panel`, tabla nueva `salida_mensual`, server/salida.js).
// Mismo patron de deteccion de "forma vieja reconocible" que
// dashboards_config_orlant_efectividad_citas_v1 (arriba): si no calza
// EXACTO, se deja intacta y solo se loguea (podria ser una personalizacion).
// Sin reposicionamiento de tab (a diferencia de esa migracion) -- "Salida"
// se queda donde ya estaba en el orden de ORLANT.
runOnceMigration('dashboards_config_orlant_salida_panel_v1', () => {
  const row = db.prepare("SELECT cliente, layout FROM dashboards_config WHERE cliente = 'ORLANT'").get();
  if (!row) return; // no existe todavia -> el seed ya la crea con la forma nueva
  let layout;
  try {
    layout = JSON.parse(row.layout);
  } catch (e) {
    return;
  }
  const target = CONFIGS.find((c) => c.cliente === 'ORLANT');
  if (!target) return;
  const targetSalida = (target.layout.tabs || []).find((t) => t.key === 'salida');
  if (!targetSalida) return;

  const tabs = layout.tabs || [];
  const tabSalida = tabs.find((t) => t && t.key === 'salida');
  if (!tabSalida) return; // no deberia pasar (el seed siempre lo trae oculto) -- nada que migrar

  const panelesViejos = tabSalida.panels || [];
  const yaEsNuevo = panelesViejos.length === 1 && panelesViejos[0] && panelesViejos[0].tipo === 'salida_panel';
  const esViejoReconocible = panelesViejos.length === 2 &&
    panelesViejos[0] && panelesViejos[0].tipo === 'line' && panelesViejos[0].filtroSerie === true && panelesViejos[0].titulo === 'Llamadas de salida' &&
    panelesViejos[1] && panelesViejos[1].tipo === 'line' && panelesViejos[1].filtroSerie === true && panelesViejos[1].titulo === 'WhatsApp de salida';

  if (yaEsNuevo) return; // ya tenia la forma nueva -- nada que hacer

  if (!esViejoReconocible) {
    if (!config.isTest) {
      console.log('[db] Migracion dashboards_config_orlant_salida_panel_v1: el tab "salida" no coincide con la forma esperada (vieja ni nueva) -- se deja intacto, revisar a mano.');
    }
    return;
  }

  tabSalida.label = targetSalida.label;
  tabSalida.panels = JSON.parse(JSON.stringify(targetSalida.panels));
  delete tabSalida.subtabs;
  layout.tabs = tabs;

  db.prepare('UPDATE dashboards_config SET layout = ?, updatedAt = ? WHERE cliente = ?').run(
    JSON.stringify(layout),
    new Date().toISOString(),
    'ORLANT'
  );
  if (!config.isTest) {
    console.log('[db] Migracion dashboards_config_orlant_salida_panel_v1 aplicada.');
  }
});

// Fase 128 (Parte 1, pedido textual de Edwin en la reunion de validacion):
// renombra la pestaña "Salida" a "Llamadas y WhatsApp de salida" (label del
// tab + titulo de su panel) y la reubica justo despues de "trafico_whatsapp"
// -- antes vivia al final del array, junto a las pestañas sin base propia.
// Renombrar y reubicar son pasos INDEPENDIENTES, a proposito (hallazgo real
// al probar esto en local contra una base recien sembrada): las migraciones
// de reubicacion mas viejas (dashboards_config_orlant_orden_pestanas_v1/_v2,
// dashboards_config_orlant_efectividad_citas_v1) agrupan cualquier tab que
// no sea parte de su propio orden fijo en "el resto" y lo mandan al final
// del array -- eso incluye a "salida", AUNQUE la fila sea nueva y ya haya
// nacido con el label/panel correctos desde CONFIGS. Si la reubicacion de
// esta migracion dependiera de "el label todavia dice el default viejo", un
// ORLANT recien creado (nace ya con el label nuevo, nunca pasa por el
// 'Salida' viejo) se habria quedado para siempre mal ubicado. Por eso la
// reubicacion es INCONDICIONAL sobre la posicion (mismo criterio que
// dashboards_config_orlant_orden_pestanas_v2: ninguna de esas migraciones de
// orden tiene guard de "podria ser una personalizacion" tampoco). El
// renombre si sigue gateado -- si el label ya no es el default 'Salida' o el
// panel no tiene el titulo exacto que dejaba
// dashboards_config_orlant_salida_panel_v1, se deja el NOMBRE intacto
// (podria ser una personalizacion de un admin).
runOnceMigration('dashboards_config_orlant_salida_label_orden_v1', () => {
  const row = db.prepare("SELECT cliente, layout FROM dashboards_config WHERE cliente = 'ORLANT'").get();
  if (!row) return; // no existe todavia -> el seed ya la crea con el nombre/orden nuevo
  let layout;
  try {
    layout = JSON.parse(row.layout);
  } catch (e) {
    return;
  }
  const target = CONFIGS.find((c) => c.cliente === 'ORLANT');
  if (!target) return;
  const targetSalida = (target.layout.tabs || []).find((t) => t.key === 'salida');
  if (!targetSalida) return;

  const tabs = layout.tabs || [];
  let tabSalida = tabs.find((t) => t && t.key === 'salida');
  if (!tabSalida) return;

  let cambio = false;

  const panelViejoReconocible = Array.isArray(tabSalida.panels) && tabSalida.panels.length === 1 &&
    tabSalida.panels[0] && tabSalida.panels[0].tipo === 'salida_panel' &&
    tabSalida.panels[0].titulo === 'Salida (Llamadas y WhatsApp)';
  if (tabSalida.label === 'Salida' && panelViejoReconocible) {
    tabSalida.label = targetSalida.label;
    tabSalida.panels = JSON.parse(JSON.stringify(targetSalida.panels));
    cambio = true;
  } else if (!config.isTest && tabSalida.label !== targetSalida.label) {
    console.log('[db] Migracion dashboards_config_orlant_salida_label_orden_v1: el tab "salida" no coincide con la forma esperada -- se deja el nombre intacto, revisar a mano.');
  }

  const idxTraficoWpp = tabs.findIndex((t) => t && t.key === 'trafico_whatsapp');
  if (idxTraficoWpp === -1) {
    if (!config.isTest) {
      console.log('[db] Migracion dashboards_config_orlant_salida_label_orden_v1: no se encontro "trafico_whatsapp", no se reubica.');
    }
  } else {
    const idxSalidaActual = tabs.findIndex((t) => t && t.key === 'salida');
    if (idxSalidaActual !== idxTraficoWpp + 1) {
      const tabExtraido = tabs.splice(idxSalidaActual, 1)[0];
      const nuevoIdxTraficoWpp = tabs.findIndex((t) => t && t.key === 'trafico_whatsapp');
      tabs.splice(nuevoIdxTraficoWpp + 1, 0, tabExtraido);
      cambio = true;
    }
  }

  if (!cambio) return;
  layout.tabs = tabs;

  db.prepare('UPDATE dashboards_config SET layout = ?, updatedAt = ? WHERE cliente = ?').run(
    JSON.stringify(layout),
    new Date().toISOString(),
    'ORLANT'
  );
  if (!config.isTest) {
    console.log('[db] Migracion dashboards_config_orlant_salida_label_orden_v1 aplicada.');
  }
});

// Fase 130 (pedido de Edwin, aprobado): agrega el panel `calidad_bar_asesores`
// (nombre + % promedio por asesor, sin numero de monitoreos) al tab "calidad"
// de ORLANT que YA existe en produccion -- el seed (CONFIGS) solo aplica a
// instalaciones nuevas. Migracion ADITIVA, no reemplaza nada: si el panel ya
// esta (reinicio repetido, u otra instancia que ya corrio esto), no hace
// nada; si el tab no existe o no tiene panels, se deja intacto (no deberia
// pasar, pero sin asumir la forma exacta como las migraciones de reemplazo).
runOnceMigration('dashboards_config_orlant_calidad_bar_asesores_v1', () => {
  const row = db.prepare("SELECT cliente, layout FROM dashboards_config WHERE cliente = 'ORLANT'").get();
  if (!row) return; // no existe todavia -> el seed ya la crea con el panel nuevo
  let layout;
  try {
    layout = JSON.parse(row.layout);
  } catch (e) {
    return;
  }
  const tabCalidad = (layout.tabs || []).find((t) => t && t.key === 'calidad');
  if (!tabCalidad || !Array.isArray(tabCalidad.panels)) return;
  const yaTiene = tabCalidad.panels.some((p) => p && p.tipo === 'calidad_bar_asesores');
  if (yaTiene) return;
  // Mismo criterio de cautela que las migraciones de reemplazo (salida_panel,
  // efectividad_citas): solo se toca un tab "calidad" que calza EXACTO con
  // la forma estandar (kpis + pie, en ese orden, nada mas) -- un tab
  // personalizado a mano (otro panel, otro orden, otros paneles extra) se
  // deja intacto, solo se loguea, nunca se asume su forma.
  const esEstandarReconocible = tabCalidad.panels.length === 2 &&
    tabCalidad.panels[0] && tabCalidad.panels[0].tipo === 'calidad_kpis' &&
    tabCalidad.panels[1] && tabCalidad.panels[1].tipo === 'calidad_pie';
  if (!esEstandarReconocible) {
    if (!config.isTest) {
      console.log('[db] Migracion dashboards_config_orlant_calidad_bar_asesores_v1: el tab "calidad" no coincide con la forma estandar (kpis+pie) -- se deja intacto, revisar a mano.');
    }
    return;
  }

  tabCalidad.panels.push({ tipo: 'calidad_bar_asesores', campana: 'ORLANT', titulo: 'Promedio de calidad por asesor' });

  db.prepare('UPDATE dashboards_config SET layout = ?, updatedAt = ? WHERE cliente = ?').run(
    JSON.stringify(layout),
    new Date().toISOString(),
    'ORLANT'
  );
  if (!config.isTest) {
    console.log('[db] Migracion dashboards_config_orlant_calidad_bar_asesores_v1 aplicada.');
  }
});

// Fase 131 (Parte 1, pedido de Edwin): el cliente se escribia "MOVILIZE" en
// todo el codigo -- se corrige al nombre real de su marca, "MOBILIZE".
// dashboards_config.cliente y calidad_plantillas.campana son UNIQUE, y la
// semilla generica de arriba (CONFIGS/PLANTILLAS, "idempotente por
// cliente/campana que aun no exista") ya corrio ANTES de esta migracion en
// este mismo arranque -- en cuanto dashboard-plantillas-cliente.js y
// calidad-plantillas-seed.js pasaron a usar 'MOBILIZE', ese seed generico
// crea solo una fila NUEVA para 'MOBILIZE' (nunca pudo haber sido
// personalizada por un admin: 'MOBILIZE' no existia como concepto antes de
// este deploy). Por eso, si existe la fila VIEJA ('MOVILIZE', que SI puede
// traer personalizaciones de un admin de antes de este cambio) y TAMBIEN
// quedo la fila generica nueva ('MOBILIZE') recien sembrada, se descarta la
// generica y se renombra la vieja -- asi ninguna personalizacion se pierde
// y no queda una fila duplicada ni un choque de UNIQUE.
runOnceMigration('cliente_movilize_renombrado_mobilize_v1', () => {
  const ts = new Date().toISOString();
  let tocado = false;

  const dashboardViejo = db.prepare('SELECT id FROM dashboards_config WHERE cliente = ?').get('MOVILIZE');
  if (dashboardViejo) {
    const dashboardGenericoNuevo = db.prepare('SELECT id FROM dashboards_config WHERE cliente = ?').get('MOBILIZE');
    if (dashboardGenericoNuevo) db.prepare('DELETE FROM dashboards_config WHERE id = ?').run(dashboardGenericoNuevo.id);
    const target = CONFIGS.find((c) => c.cliente === 'MOBILIZE');
    db.prepare('UPDATE dashboards_config SET cliente = ?, titulo = ?, updatedAt = ? WHERE id = ?').run(
      'MOBILIZE',
      target ? target.titulo : 'Dashboard Mobilize',
      ts,
      dashboardViejo.id
    );
    tocado = true;
  }

  const plantillaVieja = db.prepare('SELECT id FROM calidad_plantillas WHERE campana = ?').get('MOVILIZE');
  if (plantillaVieja) {
    const plantillaGenericaNueva = db.prepare('SELECT id FROM calidad_plantillas WHERE campana = ?').get('MOBILIZE');
    if (plantillaGenericaNueva) db.prepare('DELETE FROM calidad_plantillas WHERE id = ?').run(plantillaGenericaNueva.id);
    db.prepare('UPDATE calidad_plantillas SET campana = ?, updatedAt = ? WHERE id = ?').run('MOBILIZE', ts, plantillaVieja.id);
    tocado = true;
  }

  // Resto de tablas con columna campana/cliente: ninguna de estas se siembra
  // sola para un cliente nuevo (solo las dos de arriba), asi que un simple
  // UPDATE basta -- hoy casi seguro 0 filas (MOBILIZE nunca tuvo datos
  // reales cargados como MOVILIZE), pero se cubre por si acaso.
  const TABLAS_CAMPANA = [
    'calidad_codificaciones', 'monitoreos', 'cronograma_metas',
    'calidad_nivel_servicio', 'calidad_nivel_servicio_diario', 'trafico_whatsapp',
    'agendas', 'tipificaciones', 'inasistencias', 'efectividad_agendamiento',
    'efectividad_citas', 'salida_mensual', 'alias_asesores', 'trafico_skill_mapeo',
    'gestion_humana_personal',
  ];
  TABLAS_CAMPANA.forEach((tabla) => {
    const info = db.prepare(`UPDATE ${tabla} SET campana = ? WHERE campana = ?`).run('MOBILIZE', 'MOVILIZE');
    if (info.changes) tocado = true;
  });
  const infoCargas = db.prepare('UPDATE dashboard_cargas SET cliente = ? WHERE cliente = ?').run('MOBILIZE', 'MOVILIZE');
  if (infoCargas.changes) tocado = true;

  // Permisos de usuario (withScopedPerms, arriba): las claves
  // cliente_MOVILIZE/campana_MOVILIZE se renombran SIN tocar su valor --
  // ningun usuario pierde el acceso que ya tenia.
  const usuarios = db.prepare('SELECT id, perms FROM users').all();
  const actualizarUser = db.prepare('UPDATE users SET perms = ? WHERE id = ?');
  usuarios.forEach((u) => {
    let perms;
    try {
      perms = JSON.parse(u.perms || '{}');
    } catch (_) {
      return;
    }
    let cambiado = false;
    ['cliente_', 'campana_'].forEach((prefix) => {
      const viejaKey = prefix + 'MOVILIZE';
      if (Object.prototype.hasOwnProperty.call(perms, viejaKey)) {
        const nuevaKey = prefix + 'MOBILIZE';
        if (perms[nuevaKey] === undefined) perms[nuevaKey] = perms[viejaKey];
        delete perms[viejaKey];
        cambiado = true;
      }
    });
    if (cambiado) {
      actualizarUser.run(JSON.stringify(perms), u.id);
      tocado = true;
    }
  });

  if (tocado && !config.isTest) {
    console.log('[db] Migracion cliente_movilize_renombrado_mobilize_v1 aplicada.');
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
