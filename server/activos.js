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
);`);
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
function _publico(a) { return a ? Object.assign({}, a, { datos: JSON.parse(a.datos || '{}') }) : null; }

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
function obtener(db, id) { return _publico(db.prepare('SELECT * FROM activos WHERE id = ?').get(id)); }
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
  if (q.tipo) { where.push('tipo = ?'); p.push(q.tipo); }
  if (q.estado) { where.push('estado = ?'); p.push(q.estado); }
  if (q.sede) { where.push('sede = ?'); p.push(q.sede); }
  if (q.q) { where.push("(codigo LIKE ? OR marca LIKE ? OR modelo LIKE ? OR serial LIKE ? OR datos LIKE ?)"); const s = '%' + String(q.q).slice(0, 60).replace(/[%_]/g, '') + '%'; p.push(s, s, s, s, s); }
  return db.prepare('SELECT * FROM activos ' + (where.length ? 'WHERE ' + where.join(' AND ') : '') + ' ORDER BY tipo, codigo LIMIT 3000').all(...p).map(_publico);
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
  return { total: Object.values(porEstado).reduce((a, b) => a + b, 0), porEstado, porTipo, porSede };
}
function historial(db, id) { return db.prepare('SELECT fecha, accion, estadoAntes, estadoDespues, motivo, quien FROM activos_historial WHERE activoId = ? ORDER BY ts DESC, id DESC').all(id); }

module.exports = { ESTADOS, ESTADO_CODIGOS, LISTAS, TIPOS_BASE, puede, crearTablas, tipos, tipo, lista, guardarLista, validar, crear, obtener, editar, cambiarEstado, listar, resumen, historial };
