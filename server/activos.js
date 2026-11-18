// activos.js — Fase 369 (pedido de Edwin 18/11, E1): «Inventario de sistemas» (activos tecnológicos),
// según la versión unificada que aprobó Edwin. Empieza LIMPIO: ningún dato del HTML de Edwin (que
// trae datos reales) entra aquí. Quién: ADMIN y el rol SISTEMAS. El Inventario viejo queda aparte,
// solo para ADMIN, hasta que Sistemas valide este (luego se retira con OK del usuario).
//
// E1: elementos uno por uno (torre, monitor, teclado, mouse, diadema, portátil, equipo administrable),
// cada uno con su código (único por tipo), estado (libre, en uso, en reparación, malo, de baja),
// sede, operación y datos propios del tipo; panel con conteos; cambio de estado con motivo; historial
// por elemento; listas de sedes, operaciones y proveedores (vacías al empezar).
// Lo que sigue: E2 agentes y asignación por elemento (sin «equipo de mesa»), cambio de elemento con
// motivo; E3 actas en PDF y las firmadas en S3; E4 formularios editables y demás administrables.
'use strict';

const ESTADOS = [
  { codigo: 'libre', nombre: 'Libre' },
  { codigo: 'en_uso', nombre: 'En uso' },
  { codigo: 'en_reparacion', nombre: 'En reparación' },
  { codigo: 'malo', nombre: 'Malo' },
  { codigo: 'de_baja', nombre: 'De baja' },
];
const ESTADO_CODIGOS = ESTADOS.map((e) => e.codigo);
const LISTAS = { sedes: 'Sedes', operaciones: 'Operaciones', proveedores: 'Proveedores' };
// Tipos y sus campos propios (además de código, marca, modelo, serial, sede, operación y observaciones).
// tipo de campo: texto | numero | lista (opciones). En E4 se podrán editar desde la plataforma.
const TIPOS_BASE = [
  { codigo: 'TORRE', nombre: 'Torre', plural: 'Torres', campos: [{ k: 'nombre_equipo', l: 'Nombre del equipo', t: 'texto' }, { k: 'procesador', l: 'Procesador', t: 'texto' }, { k: 'ram_gb', l: 'Memoria RAM (GB)', t: 'numero' }, { k: 'disco', l: 'Disco', t: 'texto' }, { k: 'tipo_disco', l: 'Tipo de disco', t: 'lista', o: ['HDD', 'SSD', 'NVMe'] }] },
  { codigo: 'MONITOR', nombre: 'Monitor', plural: 'Monitores', campos: [{ k: 'serial_tag', l: 'Serial tag', t: 'texto' }, { k: 'pulgadas', l: 'Pulgadas', t: 'numero' }] },
  { codigo: 'TECLADO', nombre: 'Teclado', plural: 'Teclados', campos: [] },
  { codigo: 'MOUSE', nombre: 'Mouse', plural: 'Mouse', campos: [] },
  { codigo: 'DIADEMA', nombre: 'Diadema', plural: 'Diademas', campos: [{ k: 'conexion', l: 'Conexión', t: 'lista', o: ['USB', 'Jack 3.5', 'Inalámbrica'] }] },
  { codigo: 'PORTATIL', nombre: 'Portátil', plural: 'Portátiles', campos: [{ k: 'nombre_equipo', l: 'Nombre del equipo', t: 'texto' }, { k: 'procesador', l: 'Procesador', t: 'texto' }, { k: 'ram_gb', l: 'Memoria RAM (GB)', t: 'numero' }, { k: 'disco', l: 'Disco', t: 'texto' }, { k: 'cargador', l: 'Cargador', t: 'lista', o: ['Sí', 'No'] }] },
  { codigo: 'ADMINISTRABLE', nombre: 'Equipo administrable', plural: 'Equipos administrables', campos: [{ k: 'subtipo', l: 'Tipo', t: 'lista', o: ['Servidor', 'Switch', 'Router', 'Otro'] }, { k: 'ip', l: 'Dirección IP', t: 'texto' }, { k: 'responsable', l: 'Responsable', t: 'texto' }] },
];

// auth se carga aquí (no arriba): db.js carga este archivo y auth.js necesita db.js (dependencia circular).
function puede(actor) { return !!actor && (require('./auth').isFullAdmin(actor) || actor.rol === 'SISTEMAS'); }

function crearTablas(db) {
  db.exec(`
CREATE TABLE IF NOT EXISTS activos_tipos (
  codigo TEXT PRIMARY KEY, nombre TEXT NOT NULL, plural TEXT NOT NULL, orden INTEGER NOT NULL DEFAULT 0,
  activo INTEGER NOT NULL DEFAULT 1, campos TEXT NOT NULL DEFAULT '[]'
);
CREATE TABLE IF NOT EXISTS activos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo TEXT NOT NULL, codigo TEXT NOT NULL, estado TEXT NOT NULL DEFAULT 'libre',
  sede TEXT NOT NULL DEFAULT '', operacion TEXT NOT NULL DEFAULT '', proveedor TEXT NOT NULL DEFAULT '',
  marca TEXT NOT NULL DEFAULT '', modelo TEXT NOT NULL DEFAULT '', serial TEXT NOT NULL DEFAULT '',
  datos TEXT NOT NULL DEFAULT '{}', observaciones TEXT NOT NULL DEFAULT '',
  creadoPor TEXT NOT NULL DEFAULT '', createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL,
  UNIQUE (tipo, codigo)
);
CREATE INDEX IF NOT EXISTS idx_activos_estado ON activos(estado, tipo);
CREATE TABLE IF NOT EXISTS activos_historial (
  id INTEGER PRIMARY KEY AUTOINCREMENT, activoId INTEGER NOT NULL, ts INTEGER NOT NULL, fecha TEXT NOT NULL,
  accion TEXT NOT NULL, estadoAntes TEXT, estadoDespues TEXT, motivo TEXT NOT NULL DEFAULT '', quien TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_activos_hist ON activos_historial(activoId, ts);
CREATE TABLE IF NOT EXISTS activos_listas (
  lista TEXT NOT NULL, valor TEXT NOT NULL, orden INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (lista, valor)
);
-- Fase 370 (E2): agentes (quien recibe los elementos) y asignaciones por elemento.
CREATE TABLE IF NOT EXISTS activos_agentes (
  id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL, documento TEXT NOT NULL DEFAULT '',
  operacion TEXT NOT NULL DEFAULT '', sede TEXT NOT NULL DEFAULT '', activo INTEGER NOT NULL DEFAULT 1,
  createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS activos_asignaciones (
  id INTEGER PRIMARY KEY AUTOINCREMENT, activoId INTEGER NOT NULL, agenteId INTEGER NOT NULL,
  desde TEXT NOT NULL, hasta TEXT, motivoFin TEXT NOT NULL DEFAULT '', quien TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_activos_asig_activo ON activos_asignaciones(activoId, hasta);
CREATE INDEX IF NOT EXISTS idx_activos_asig_agente ON activos_asignaciones(agenteId, hasta);
CREATE UNIQUE INDEX IF NOT EXISTS ux_activos_asig_abierta ON activos_asignaciones(activoId) WHERE hasta IS NULL;`);
  const ins = db.prepare('INSERT OR IGNORE INTO activos_tipos (codigo, nombre, plural, orden, campos) VALUES (?, ?, ?, ?, ?)');
  TIPOS_BASE.forEach((t, i) => ins.run(t.codigo, t.nombre, t.plural, i + 1, JSON.stringify(t.campos)));
}

function tipos(db) {
  return db.prepare('SELECT * FROM activos_tipos WHERE activo = 1 ORDER BY orden').all()
    .map((t) => ({ codigo: t.codigo, nombre: t.nombre, plural: t.plural, campos: JSON.parse(t.campos || '[]') }));
}
function tipo(db, codigo) { return tipos(db).find((t) => t.codigo === codigo) || null; }
function lista(db, nombre) { return db.prepare('SELECT valor FROM activos_listas WHERE lista = ? ORDER BY orden, valor').all(nombre).map((r) => r.valor); }
function guardarLista(db, nombre, valores) {
  db.transaction(() => {
    db.prepare('DELETE FROM activos_listas WHERE lista = ?').run(nombre);
    const ins = db.prepare('INSERT OR IGNORE INTO activos_listas (lista, valor, orden) VALUES (?, ?, ?)');
    valores.forEach((v, i) => ins.run(nombre, v, i));
  })();
  return lista(db, nombre);
}

const _txt = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max || 120) : '');
// Valida y normaliza el cuerpo de un elemento. -> { error } o { valores }
function validar(db, b, { nuevo, tipo: tipoActual }) {
  if (!b || typeof b !== 'object' || Array.isArray(b)) return { error: 'Datos no válidos' };
  const permitidas = ['tipo', 'codigo', 'sede', 'operacion', 'proveedor', 'marca', 'modelo', 'serial', 'datos', 'observaciones', 'estado'];
  if (Object.keys(b).some((k) => !permitidas.includes(k))) return { error: 'Datos no válidos' };
  const t = tipo(db, nuevo ? b.tipo : tipoActual);
  if (!t) return { error: 'Elige el tipo de elemento' };
  const codigo = _txt(b.codigo, 40);
  if (nuevo && !/^[\p{L}\p{N}][\p{L}\p{N} ._/-]{0,39}$/u.test(codigo)) return { error: 'El código es obligatorio (letras, números, punto, guion o barra; hasta 40)' };
  const v = { sede: _txt(b.sede), operacion: _txt(b.operacion), proveedor: _txt(b.proveedor), marca: _txt(b.marca, 60), modelo: _txt(b.modelo, 60), serial: _txt(b.serial, 80), observaciones: _txt(b.observaciones, 500) };
  for (const [campo, nombreLista] of [['sede', 'sedes'], ['operacion', 'operaciones'], ['proveedor', 'proveedores']]) {
    if (v[campo] && !lista(db, nombreLista).includes(v[campo])) return { error: 'Elige ' + LISTAS[nombreLista].toLowerCase().replace(/s$/, '') + ' de la lista (Ajustes)' };
  }
  const datos = {};
  const d = b.datos && typeof b.datos === 'object' && !Array.isArray(b.datos) ? b.datos : {};
  for (const c of t.campos) {
    const x = d[c.k];
    if (x === undefined || x === null || x === '') continue;
    if (c.t === 'numero') { const n = Number(x); if (!Number.isFinite(n) || n < 0 || n > 1e7) return { error: c.l + ': escribe un número' }; datos[c.k] = n; }
    else if (c.t === 'lista') { if (!(c.o || []).includes(x)) return { error: c.l + ': elige una opción' }; datos[c.k] = x; }
    else datos[c.k] = _txt(String(x), 120);
  }
  if (datos.ip && !/^(25[0-5]|2[0-4]\d|1?\d?\d)(\.(25[0-5]|2[0-4]\d|1?\d?\d)){3}$/.test(datos.ip)) return { error: 'La dirección IP no es válida (ejemplo: 192.168.1.10)' };
  if (nuevo) {
    const estado = b.estado === undefined ? 'libre' : b.estado;
    if (!['libre', 'en_reparacion', 'malo'].includes(estado)) return { error: 'Un elemento nuevo entra libre, en reparación o malo' };
    v.estado = estado;
    v.tipo = t.codigo; v.codigo = codigo;
  }
  v.datos = datos;
  return { valores: v };
}

function _hist(db, activoId, accion, antes, despues, motivo, quien) {
  const ahora = new Date();
  db.prepare('INSERT INTO activos_historial (activoId, ts, fecha, accion, estadoAntes, estadoDespues, motivo, quien) VALUES (?,?,?,?,?,?,?,?)')
    .run(activoId, ahora.getTime(), ahora.toISOString(), accion, antes || null, despues || null, motivo || '', quien || '');
}
function _publico(a) {
  if (!a) return null;
  const o = Object.assign({}, a, { datos: JSON.parse(a.datos || '{}') });
  o.agente = a.agenteId ? { id: a.agenteId, nombre: a.agenteNombre } : null;
  delete o.agenteId; delete o.agenteNombre;
  return o;
}
// El agente actual de cada elemento sale de su asignación abierta (hasta IS NULL).
const SELECT_ACTIVO = `SELECT a.*, s.agenteId, g.nombre AS agenteNombre FROM activos a
  LEFT JOIN activos_asignaciones s ON s.activoId = a.id AND s.hasta IS NULL
  LEFT JOIN activos_agentes g ON g.id = s.agenteId`;

function crear(db, v, quien) {
  if (db.prepare('SELECT 1 FROM activos WHERE tipo = ? AND codigo = ?').get(v.tipo, v.codigo)) return { error: 'Ya hay un elemento de ese tipo con el código ' + v.codigo, status: 409 };
  const ahora = new Date().toISOString();
  let id;
  db.transaction(() => {
    id = Number(db.prepare(`INSERT INTO activos (tipo, codigo, estado, sede, operacion, proveedor, marca, modelo, serial, datos, observaciones, creadoPor, createdAt, updatedAt)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(v.tipo, v.codigo, v.estado, v.sede, v.operacion, v.proveedor, v.marca, v.modelo, v.serial, JSON.stringify(v.datos), v.observaciones, quien, ahora, ahora).lastInsertRowid);
    _hist(db, id, 'Ingreso', null, v.estado, '', quien);
  })();
  return { activo: obtener(db, id) };
}
function obtener(db, id) { return _publico(db.prepare(SELECT_ACTIVO + ' WHERE a.id = ?').get(id)); }
function editar(db, a, v, quien) {
  db.transaction(() => {
    db.prepare('UPDATE activos SET sede = ?, operacion = ?, proveedor = ?, marca = ?, modelo = ?, serial = ?, datos = ?, observaciones = ?, updatedAt = ? WHERE id = ?')
      .run(v.sede, v.operacion, v.proveedor, v.marca, v.modelo, v.serial, JSON.stringify(v.datos), v.observaciones, new Date().toISOString(), a.id);
    _hist(db, a.id, 'Edición', a.estado, a.estado, '', quien);
  })();
  return obtener(db, a.id);
}
// Cambio de estado: siempre con motivo (Edwin: «cambio de elemento con motivo»). «En uso» lo pone
// la asignación a un agente (E2), salvo los equipos administrables (en uso = instalado).
function cambiarEstado(db, a, estado, motivo, quien) {
  if (!ESTADO_CODIGOS.includes(estado)) return { error: 'Estado no válido' };
  if (estado === a.estado) return { error: 'El elemento ya está en ese estado' };
  if (a.estado === 'de_baja') return { error: 'Un elemento dado de baja no cambia de estado' };
  if (estado === 'en_uso' && a.tipo !== 'ADMINISTRABLE') return { error: '«En uso» se marca al asignarlo a un agente' };
  if (a.agente) return { error: 'Está asignado a un agente: usa «Devolver» o «Cambiar elemento»' };
  const m = _txt(motivo, 300);
  if (m.length < 3) return { error: 'Escribe el motivo o diagnóstico' };
  db.transaction(() => {
    db.prepare('UPDATE activos SET estado = ?, updatedAt = ? WHERE id = ?').run(estado, new Date().toISOString(), a.id);
    _hist(db, a.id, 'Cambio de estado', a.estado, estado, m, quien);
  })();
  return { activo: obtener(db, a.id) };
}

function listar(db, q) {
  const where = [], p = [];
  if (q.tipo) { where.push('a.tipo = ?'); p.push(q.tipo); }
  if (q.estado) { where.push('a.estado = ?'); p.push(q.estado); }
  if (q.sede) { where.push('a.sede = ?'); p.push(q.sede); }
  if (q.q) { where.push("(a.codigo LIKE ? OR a.marca LIKE ? OR a.modelo LIKE ? OR a.serial LIKE ? OR a.datos LIKE ? OR g.nombre LIKE ?)"); const s = '%' + String(q.q).slice(0, 60).replace(/[%_]/g, '') + '%'; p.push(s, s, s, s, s, s); }
  return db.prepare(SELECT_ACTIVO + ' ' + (where.length ? 'WHERE ' + where.join(' AND ') : '') + ' ORDER BY a.tipo, a.codigo LIMIT 3000').all(...p).map(_publico);
}
function resumen(db) {
  const porEstado = Object.fromEntries(ESTADO_CODIGOS.map((e) => [e, 0]));
  for (const r of db.prepare('SELECT estado, COUNT(*) n FROM activos GROUP BY estado').all()) porEstado[r.estado] = r.n;
  const porTipo = {};
  for (const r of db.prepare('SELECT tipo, estado, COUNT(*) n FROM activos GROUP BY tipo, estado').all()) {
    porTipo[r.tipo] = porTipo[r.tipo] || Object.fromEntries(ESTADO_CODIGOS.map((e) => [e, 0]));
    porTipo[r.tipo][r.estado] = r.n;
  }
  const porSede = db.prepare("SELECT CASE WHEN sede = '' THEN '(sin sede)' ELSE sede END sede, COUNT(*) n FROM activos WHERE estado != 'de_baja' GROUP BY 1 ORDER BY n DESC").all();
  const agentes = db.prepare(`SELECT COUNT(*) activos, COALESCE(SUM(EXISTS (SELECT 1 FROM activos_asignaciones s WHERE s.agenteId = g.id AND s.hasta IS NULL)), 0) conElementos
    FROM activos_agentes g WHERE g.activo = 1`).get(); // Fase 370
  return { total: Object.values(porEstado).reduce((a, b) => a + b, 0), porEstado, porTipo, porSede, agentes };
}
function historial(db, id) { return db.prepare('SELECT fecha, accion, estadoAntes, estadoDespues, motivo, quien FROM activos_historial WHERE activoId = ? ORDER BY ts DESC, id DESC').all(id); }

// ── Fase 370 (E2): agentes y asignación por elemento ──
// Cada elemento se asigna por separado (no hay «equipo de mesa»). Asignar pone el elemento «En uso»;
// devolverlo o cambiarlo por otro del mismo tipo pide motivo y deja el anterior libre, en reparación o malo.
const ESTADOS_AL_SOLTAR = ['libre', 'en_reparacion', 'malo'];
function validarAgente(db, b, nuevo) {
  if (!b || typeof b !== 'object' || Array.isArray(b)) return { error: 'Datos no válidos' };
  const permitidas = ['nombre', 'documento', 'operacion', 'sede', 'activo'];
  if (Object.keys(b).some((k) => !permitidas.includes(k))) return { error: 'Datos no válidos' };
  const v = {};
  if (nuevo || 'nombre' in b) {
    v.nombre = _txt(b.nombre, 80).replace(/\s+/g, ' ');
    if (v.nombre.length < 3) return { error: 'Escribe el nombre completo del agente' };
  }
  if (nuevo || 'documento' in b) {
    v.documento = _txt(b.documento, 20);
    if (v.documento && !/^[A-Za-z0-9.-]{3,20}$/.test(v.documento)) return { error: 'El documento solo lleva números o letras (3 a 20)' };
  }
  for (const [campo, nombreLista] of [['operacion', 'operaciones'], ['sede', 'sedes']]) {
    if (!nuevo && !(campo in b)) continue;
    v[campo] = _txt(b[campo]);
    if (v[campo] && !lista(db, nombreLista).includes(v[campo])) return { error: 'Elige ' + LISTAS[nombreLista].toLowerCase().replace(/s$/, '') + ' de la lista (Ajustes)' };
  }
  if ('activo' in b) { if (typeof b.activo !== 'boolean') return { error: 'Datos no válidos' }; v.activo = b.activo ? 1 : 0; }
  return { valores: v };
}
function _agenteDuplicado(db, v, id) {
  if (v.documento && db.prepare("SELECT 1 FROM activos_agentes WHERE documento = ? AND id != ?").get(v.documento, id || 0)) return 'Ya hay un agente con ese documento';
  return null;
}
function agentes(db, q) {
  const where = [], p = [];
  if (!q.todos) where.push('g.activo = 1');
  if (q.q) { where.push('(g.nombre LIKE ? OR g.documento LIKE ?)'); const s = '%' + String(q.q).slice(0, 60).replace(/[%_]/g, '') + '%'; p.push(s, s); }
  return db.prepare(`SELECT g.*, (SELECT COUNT(*) FROM activos_asignaciones s WHERE s.agenteId = g.id AND s.hasta IS NULL) AS elementos
    FROM activos_agentes g ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY g.activo DESC, g.nombre LIMIT 3000`).all(...p);
}
function agente(db, id) { return db.prepare('SELECT * FROM activos_agentes WHERE id = ?').get(id) || null; }
function crearAgente(db, v) {
  const dup = _agenteDuplicado(db, v); if (dup) return { error: dup, status: 409 };
  const ahora = new Date().toISOString();
  const id = Number(db.prepare('INSERT INTO activos_agentes (nombre, documento, operacion, sede, activo, createdAt, updatedAt) VALUES (?,?,?,?,1,?,?)')
    .run(v.nombre, v.documento, v.operacion, v.sede, ahora, ahora).lastInsertRowid);
  return { agente: agente(db, id) };
}
function editarAgente(db, g, v) {
  const dup = _agenteDuplicado(db, v, g.id); if (dup) return { error: dup, status: 409 };
  if (v.activo === 0 && db.prepare('SELECT 1 FROM activos_asignaciones WHERE agenteId = ? AND hasta IS NULL').get(g.id)) return { error: 'Primero devuelve o cambia los elementos que tiene asignados' };
  const n = Object.assign({}, g, v);
  db.prepare('UPDATE activos_agentes SET nombre = ?, documento = ?, operacion = ?, sede = ?, activo = ?, updatedAt = ? WHERE id = ?')
    .run(n.nombre, n.documento, n.operacion, n.sede, n.activo, new Date().toISOString(), g.id);
  return { agente: agente(db, g.id) };
}
function agenteDetalle(db, g) {
  const elementos = db.prepare(SELECT_ACTIVO + ' WHERE s.agenteId = ? ORDER BY a.tipo, a.codigo').all(g.id).map(_publico);
  const asignaciones = db.prepare(`SELECT s.desde, s.hasta, s.motivoFin, s.quien, a.id AS activoId, a.tipo, a.codigo FROM activos_asignaciones s
    JOIN activos a ON a.id = s.activoId WHERE s.agenteId = ? ORDER BY s.desde DESC, s.id DESC LIMIT 500`).all(g.id);
  return { agente: g, elementos, asignaciones };
}
function _abrir(db, a, g, quien, ahora, motivo, accion) {
  db.prepare('INSERT INTO activos_asignaciones (activoId, agenteId, desde, quien) VALUES (?,?,?,?)').run(a.id, g.id, ahora, quien);
  db.prepare("UPDATE activos SET estado = 'en_uso', updatedAt = ? WHERE id = ?").run(ahora, a.id);
  _hist(db, a.id, accion, a.estado, 'en_uso', motivo ? motivo + ' · a ' + g.nombre : 'A ' + g.nombre, quien);
}
function _cerrar(db, a, estado, motivo, quien, ahora, accion) {
  db.prepare('UPDATE activos_asignaciones SET hasta = ?, motivoFin = ? WHERE activoId = ? AND hasta IS NULL').run(ahora, motivo, a.id);
  db.prepare('UPDATE activos SET estado = ?, updatedAt = ? WHERE id = ?').run(estado, ahora, a.id);
  _hist(db, a.id, accion, a.estado, estado, motivo + (a.agente ? ' · de ' + a.agente.nombre : ''), quien);
}
function asignar(db, a, agenteId, quien) {
  if (a.tipo === 'ADMINISTRABLE') return { error: 'Los equipos administrables no se asignan a un agente' };
  if (a.agente) return { error: 'Ya está asignado a ' + a.agente.nombre };
  if (a.estado !== 'libre') return { error: 'Solo se asigna un elemento libre' };
  const g = Number.isInteger(agenteId) ? agente(db, agenteId) : null;
  if (!g || !g.activo) return { error: 'Elige un agente activo' };
  db.transaction(() => _abrir(db, a, g, quien, new Date().toISOString(), '', 'Asignación'))();
  return { activo: obtener(db, a.id), agente: g };
}
function _motivoYEstado(estado, motivo) {
  if (!ESTADOS_AL_SOLTAR.includes(estado)) return { error: 'Elige cómo queda el elemento: libre, en reparación o malo' };
  const m = _txt(motivo, 300);
  if (m.length < 3) return { error: 'Escribe el motivo' };
  return { m };
}
function devolver(db, a, estado, motivo, quien) {
  if (!a.agente) return { error: 'El elemento no está asignado' };
  const r = _motivoYEstado(estado, motivo); if (r.error) return r;
  db.transaction(() => _cerrar(db, a, estado, r.m, quien, new Date().toISOString(), 'Devolución'))();
  return { activo: obtener(db, a.id) };
}
// Cambio de elemento: el agente entrega uno y recibe otro libre del mismo tipo, en un solo paso.
function cambiarElemento(db, a, nuevoId, estado, motivo, quien) {
  if (!a.agente) return { error: 'El elemento no está asignado' };
  const r = _motivoYEstado(estado, motivo); if (r.error) return r;
  const n = Number.isInteger(nuevoId) ? obtener(db, nuevoId) : null;
  if (!n || n.id === a.id) return { error: 'Elige el elemento nuevo' };
  if (n.tipo !== a.tipo) return { error: 'El elemento nuevo debe ser del mismo tipo' };
  if (n.estado !== 'libre' || n.agente) return { error: 'El elemento nuevo debe estar libre' };
  const g = agente(db, a.agente.id);
  db.transaction(() => {
    const ahora = new Date().toISOString();
    _cerrar(db, a, estado, r.m, quien, ahora, 'Cambio de elemento');
    _abrir(db, n, g, quien, ahora, 'Reemplaza a ' + a.codigo + ': ' + r.m, 'Cambio de elemento');
  })();
  return { anterior: obtener(db, a.id), activo: obtener(db, n.id) };
}

module.exports = { ESTADOS_AL_SOLTAR, validarAgente, agentes, agente, crearAgente, editarAgente, agenteDetalle, asignar, devolver, cambiarElemento,
  ESTADOS, ESTADO_CODIGOS, LISTAS, TIPOS_BASE, puede, crearTablas, tipos, tipo, lista, guardarLista, validar, crear, obtener, editar, cambiarEstado, listar, resumen, historial };
