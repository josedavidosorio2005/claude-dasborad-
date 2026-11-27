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
// Fase INV6 (HTML de Edwin): los estados se pueden RENOMBRAR (no quitar ni agregar: de ellos dependen las actas y
// los movimientos). El código no cambia; el nombre nuevo se guarda en activos_estados y vale en los dos inventarios.
const ESTADO_NOMBRE_MAX = 40;
function estados(db) {
  const m = new Map(db.prepare('SELECT codigo, nombre FROM activos_estados').all().map((r) => [r.codigo, r.nombre]));
  return ESTADOS.map((e) => ({ codigo: e.codigo, nombre: m.get(e.codigo) || e.nombre, base: e.nombre }));
}
function estadoNombre(db, codigo) { const e = estados(db).find((x) => x.codigo === codigo); return e ? e.nombre : (codigo || ''); }
// nombres = { codigo: 'Nombre nuevo' } (uno o varios). Vacío o igual al de siempre = vuelve al de siempre.
function renombrarEstados(db, nombres, quien) {
  if (!nombres || typeof nombres !== 'object' || Array.isArray(nombres)) return { error: 'Datos no válidos' };
  const claves = Object.keys(nombres);
  if (!claves.length || claves.some((c) => !ESTADO_CODIGOS.includes(c))) return { error: 'Los estados no se pueden agregar ni quitar: solo cambiarles el nombre' };
  const final = Object.fromEntries(estados(db).map((e) => [e.codigo, e.nombre]));
  for (const c of claves) {
    if (typeof nombres[c] !== 'string') return { error: 'Datos no válidos' };
    const v = nombres[c].trim().replace(/\s+/g, ' ');
    if (v && (v.length < 2 || v.length > ESTADO_NOMBRE_MAX)) return { error: 'Cada nombre de estado debe tener entre 2 y ' + ESTADO_NOMBRE_MAX + ' caracteres' };
    final[c] = v || ESTADOS.find((e) => e.codigo === c).nombre;
  }
  const vistos = new Set();
  for (const c of ESTADO_CODIGOS) { const k = final[c].toLocaleLowerCase('es'); if (vistos.has(k)) return { error: 'Dos estados no pueden llamarse igual: «' + final[c] + '»' }; vistos.add(k); }
  const ahora = new Date().toISOString();
  db.transaction(() => {
    for (const c of claves) {
      if (final[c] === ESTADOS.find((e) => e.codigo === c).nombre) db.prepare('DELETE FROM activos_estados WHERE codigo = ?').run(c);
      else db.prepare('INSERT INTO activos_estados (codigo, nombre, actualizadoEn, actualizadoPor) VALUES (?,?,?,?) ON CONFLICT(codigo) DO UPDATE SET nombre = excluded.nombre, actualizadoEn = excluded.actualizadoEn, actualizadoPor = excluded.actualizadoPor').run(c, final[c], ahora, quien || '');
    }
  })();
  return { estados: estados(db) };
}
// Fase 372 (E4): «motivos» = motivos frecuentes de cambio de estado, devolución y cambio (sugerencias; el motivo sigue libre).
const LISTAS = { sedes: 'Sedes', operaciones: 'Operaciones', proveedores: 'Proveedores', motivos: 'Motivos frecuentes' };
// Tipos y sus campos propios (además de código, marca, modelo, serial, sede, operación y observaciones).
// tipo de campo: texto | numero | lista (opciones). Desde E4 (Fase 372) se editan en la plataforma
// (server/activos-formularios.js): un campo nunca se borra, se oculta (`oculto: true`) y lo guardado se conserva.
const TIPOS_BASE = [
  { codigo: 'TORRE', nombre: 'Torre', plural: 'Torres', campos: [{ k: 'nombre_equipo', l: 'Nombre del equipo', t: 'texto' }, { k: 'procesador', l: 'Procesador', t: 'texto' }, { k: 'ram_gb', l: 'Memoria RAM (GB)', t: 'numero' }, { k: 'disco', l: 'Disco', t: 'texto' }, { k: 'tipo_disco', l: 'Tipo de disco', t: 'lista', o: ['HDD', 'SSD', 'NVMe'] }] },
  { codigo: 'MONITOR', nombre: 'Monitor', plural: 'Monitores', campos: [{ k: 'serial_tag', l: 'Serial tag', t: 'texto' }, { k: 'pulgadas', l: 'Pulgadas', t: 'numero' }] },
  { codigo: 'TECLADO', nombre: 'Teclado', plural: 'Teclados', campos: [] },
  { codigo: 'MOUSE', nombre: 'Mouse', plural: 'Mouse', campos: [] },
  { codigo: 'DIADEMA', nombre: 'Diadema', plural: 'Diademas', campos: [{ k: 'conexion', l: 'Conexión', t: 'lista', o: ['USB', 'Jack 3.5', 'Inalámbrica'] }] },
  { codigo: 'PORTATIL', nombre: 'Portátil', plural: 'Portátiles', campos: [{ k: 'nombre_equipo', l: 'Nombre del equipo', t: 'texto' }, { k: 'procesador', l: 'Procesador', t: 'texto' }, { k: 'ram_gb', l: 'Memoria RAM (GB)', t: 'numero' }, { k: 'disco', l: 'Disco', t: 'texto' }, { k: 'cargador', l: 'Cargador', t: 'lista', o: ['Sí', 'No'] }] },
  { codigo: 'ADMINISTRABLE', nombre: 'Equipo administrable', plural: 'Equipos administrables', campos: [{ k: 'subtipo', l: 'Tipo', t: 'lista', o: ['Servidor', 'Switch', 'Router', 'Otro'] }, { k: 'ip', l: 'Dirección IP', t: 'texto' }, { k: 'responsable', l: 'Responsable', t: 'texto' }] },
];

// Fase 376 (I1, diseño de Edwin): «Inventario de inmuebles» con el mismo motor y sus propios tipos
// (ámbito «inmuebles»), vacío al empezar. Los tipos de antes son del ámbito «sistemas».
const AMBITOS = ['sistemas', 'inmuebles'];
const TIPOS_INMUEBLES = [
  { codigo: 'SILLA', nombre: 'Silla', plural: 'Sillas', campos: [] },
  { codigo: 'MESA', nombre: 'Mesa', plural: 'Mesas', campos: [] },
  { codigo: 'PAPELERA', nombre: 'Papelera', plural: 'Papeleras', campos: [] },
];
const ambitoDe = (v) => (AMBITOS.includes(v) ? v : 'sistemas');

// Fase 377 (I2, diseño de Edwin): campos que faltaban. Se agregan a los tipos ya guardados por la
// migración fase377_inventario_campos_v1 (solo si la clave no existe: nunca quita, ni toca lo que
// Sistemas ocultó o renombró). `tras` = clave después de la cual va (si no está, al final).
const CAMPOS_I2 = [
  { tipos: ['TORRE', 'PORTATIL'], campo: { k: 'velocidad', l: 'Velocidad', t: 'texto' }, tras: 'procesador' },
  { tipos: ['PORTATIL'], campo: { k: 'tipo_disco', l: 'Tipo de disco', t: 'lista', o: ['HDD', 'SSD', 'NVMe'] }, tras: 'disco' },
  { tipos: ['TORRE', 'MONITOR', 'TECLADO', 'MOUSE', 'DIADEMA', 'PORTATIL'], campo: { k: 'precio', l: 'Precio', t: 'numero' } },
  { tipos: ['TORRE', 'MONITOR', 'TECLADO', 'MOUSE', 'DIADEMA', 'PORTATIL'], campo: { k: 'renta_mensual', l: 'Precio de renta mensual', t: 'numero' } },
];
function agregarCamposI2(db) {
  const upd = db.prepare('UPDATE activos_tipos SET campos = ? WHERE codigo = ?');
  for (const t of db.prepare('SELECT codigo, campos FROM activos_tipos').all()) {
    const campos = JSON.parse(t.campos || '[]');
    let cambio = false;
    for (const x of CAMPOS_I2) {
      if (!x.tipos.includes(t.codigo) || campos.some((c) => c.k === x.campo.k)) continue;
      const i = x.tras ? campos.findIndex((c) => c.k === x.tras) : -1;
      campos.splice(i >= 0 ? i + 1 : campos.length, 0, JSON.parse(JSON.stringify(x.campo)));
      cambio = true;
    }
    if (cambio) upd.run(JSON.stringify(campos), t.codigo);
  }
}
// Fase 380 (I5, diseño de Edwin): equipos administrables (red e infraestructura). Subtipos que faltaban,
// ubicación, precio y renta (solo se agregan) y el código automático por subtipo.
const ADMIN_SUBTIPOS_I5 = ['DVR / NVR', 'Firewall', 'Access Point', 'UPS'];
const ADMIN_CODIGO_BASE = { Servidor: 5001, Switch: 6001, 'DVR / NVR': 7001, Router: 8001, Firewall: 8001, 'Access Point': 9001, UPS: 4001, Otro: 4501 };
function agregarCamposI5(db) {
  const t = db.prepare("SELECT campos FROM activos_tipos WHERE codigo = 'ADMINISTRABLE'").get();
  if (!t) return;
  const campos = JSON.parse(t.campos || '[]');
  const sub = campos.find((c) => c.k === 'subtipo');
  if (sub && sub.t === 'lista') { sub.o = sub.o || []; const iOtro = sub.o.indexOf('Otro'); for (const o of ADMIN_SUBTIPOS_I5) if (!sub.o.includes(o)) sub.o.splice(iOtro >= 0 ? sub.o.indexOf('Otro') : sub.o.length, 0, o); }
  const poner = (campo, tras) => { if (campos.some((c) => c.k === campo.k)) return; const i = tras ? campos.findIndex((c) => c.k === tras) : -1; campos.splice(i >= 0 ? i + 1 : campos.length, 0, campo); };
  poner({ k: 'ubicacion', l: 'Ubicación', t: 'texto' }, 'ip');
  poner({ k: 'precio', l: 'Precio', t: 'numero' });
  poner({ k: 'renta_mensual', l: 'Precio de renta mensual', t: 'numero' });
  db.prepare("UPDATE activos_tipos SET campos = ? WHERE codigo = 'ADMINISTRABLE'").run(JSON.stringify(campos));
}
// Siguiente código libre del subtipo: el mayor código numérico de ese subtipo + 1, o su base.
function siguienteCodigoAdmin(db, subtipo) {
  const base = ADMIN_CODIGO_BASE[subtipo] || ADMIN_CODIGO_BASE.Otro;
  const usados = db.prepare("SELECT codigo FROM activos WHERE tipo = 'ADMINISTRABLE' AND json_extract(datos, '$.subtipo') IS ?").all(subtipo || null)
    .map((r) => (/^\d+$/.test(r.codigo) ? Number(r.codigo) : NaN)).filter((n) => Number.isFinite(n));
  let n = usados.length ? Math.max(...usados) + 1 : base;
  const existe = db.prepare("SELECT 1 FROM activos WHERE tipo = 'ADMINISTRABLE' AND codigo = ?");
  while (existe.get(String(n))) n++;
  return String(n);
}
// Aviso (no error): otra IP igual entre los equipos administrables.
function ipRepetida(db, ip, id) {
  if (!ip) return null;
  return db.prepare("SELECT codigo FROM activos WHERE tipo = 'ADMINISTRABLE' AND json_extract(datos, '$.ip') = ? AND id != ? AND estado != 'de_baja'").get(ip, id || 0) || null;
}
// Rendimiento según la RAM (mismos cortes del diseño): bajo < 8 GB, medio 8 a 15, alto 16 o más.
const RENDIMIENTOS = [
  { codigo: 'bajo', nombre: 'Bajo', ayuda: 'menos de 8 GB' },
  { codigo: 'medio', nombre: 'Medio', ayuda: '8 a 15 GB' },
  { codigo: 'alto', nombre: 'Alto', ayuda: '16 GB o más' },
  { codigo: 'sin', nombre: 'Sin dato', ayuda: 'RAM no registrada' },
];
function rendimientoDe(ram) {
  if (typeof ram !== 'number' || !Number.isFinite(ram) || ram <= 0) return 'sin';
  return ram < 8 ? 'bajo' : ram < 16 ? 'medio' : 'alto';
}
// Tipos que llevan RAM (campo ram_gb visible u oculto): solo ellos tienen rendimiento.
function tiposConRam(db) { return tipos(db, { todos: true }).filter((t) => t.campos.some((c) => c.k === 'ram_gb')).map((t) => t.codigo); }
const SQL_REND = "CASE WHEN json_type(a.datos, '$.ram_gb') IN ('integer', 'real') AND json_extract(a.datos, '$.ram_gb') > 0 THEN CASE WHEN json_extract(a.datos, '$.ram_gb') < 8 THEN 'bajo' WHEN json_extract(a.datos, '$.ram_gb') < 16 THEN 'medio' ELSE 'alto' END ELSE 'sin' END";

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
CREATE UNIQUE INDEX IF NOT EXISTS ux_activos_asig_abierta ON activos_asignaciones(activoId) WHERE hasta IS NULL;
-- Fase INV6: nombre propio de cada estado (solo los renombrados; el código no cambia).
CREATE TABLE IF NOT EXISTS activos_estados (
  codigo TEXT PRIMARY KEY, nombre TEXT NOT NULL, actualizadoEn TEXT NOT NULL, actualizadoPor TEXT NOT NULL DEFAULT ''
);`);
  const ins = db.prepare('INSERT OR IGNORE INTO activos_tipos (codigo, nombre, plural, orden, campos) VALUES (?, ?, ?, ?, ?)');
  TIPOS_BASE.forEach((t, i) => ins.run(t.codigo, t.nombre, t.plural, i + 1, JSON.stringify(t.campos)));
  // Fase 376: ámbito de cada tipo; los de inmuebles se siembran (sin elementos).
  if (!db.prepare('PRAGMA table_info(activos_tipos)').all().some((c) => c.name === 'ambito')) db.exec("ALTER TABLE activos_tipos ADD COLUMN ambito TEXT NOT NULL DEFAULT 'sistemas'");
  const insI = db.prepare("INSERT OR IGNORE INTO activos_tipos (codigo, nombre, plural, orden, campos, ambito) VALUES (?, ?, ?, ?, ?, 'inmuebles')");
  TIPOS_INMUEBLES.forEach((t, i) => insI.run(t.codigo, t.nombre, t.plural, 100 + i, JSON.stringify(t.campos)));
  // Fase INV2 (HTML de Edwin, «Se asigna a agentes»): los tipos de siempre siguen como hoy (se asignan), menos los
  // equipos administrables y los inmuebles, que nunca se asignaron a un agente. Solo agrega una columna: no borra nada.
  if (!db.prepare('PRAGMA table_info(activos_tipos)').all().some((c) => c.name === 'asignable')) {
    db.exec('ALTER TABLE activos_tipos ADD COLUMN asignable INTEGER NOT NULL DEFAULT 1');
    db.exec("UPDATE activos_tipos SET asignable = 0 WHERE codigo = 'ADMINISTRABLE' OR ambito = 'inmuebles'");
  }
}

// Fase 372 (E4): con { todos: true } también los tipos desactivados (con su marca `activo`).
// Fase 376: con { ambito } solo los tipos de ese inventario (sin él, todos: así validar() encuentra cualquiera).
function tipos(db, opts) {
  const todos = !!(opts && opts.todos), amb = opts && opts.ambito ? ambitoDe(opts.ambito) : null;
  const w = [];
  if (!todos) w.push('activo = 1');
  if (amb) w.push("ambito = '" + amb + "'");
  return db.prepare('SELECT * FROM activos_tipos ' + (w.length ? 'WHERE ' + w.join(' AND ') + ' ' : '') + 'ORDER BY orden, codigo').all()
    .map((t) => ({ codigo: t.codigo, nombre: t.nombre, plural: t.plural, activo: !!t.activo, ambito: t.ambito || 'sistemas', asignable: t.asignable === undefined ? true : !!t.asignable, campos: JSON.parse(t.campos || '[]') }));
}
function tipo(db, codigo, opts) { return tipos(db, opts).find((t) => t.codigo === codigo) || null; }
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
// Fase INV2 (HTML de Edwin): con { completo } (registrar y editar) todos los campos visibles son obligatorios: los de
// siempre, los del tipo (menos los ocultos) y las observaciones. El precio es de los propios (InConexion) y la renta
// mensual de los de un proveedor: se pide el que aplica. La importación desde Excel no lo exige (marca «datos pendientes»).
const PROPIO = /inconexi[oó]n/i;
const esPropio = (p) => !String(p || '').trim() || PROPIO.test(String(p));
function faltanTexto(faltan) {
  return 'Todos los campos son obligatorios. Falta' + (faltan.length > 1 ? 'n' : '') + ': ' + faltan.slice(0, 4).join(', ') + (faltan.length > 4 ? ' y ' + (faltan.length - 4) + ' más' : '') + '.';
}
function camposFaltantes(t, v, datos) {
  const faltan = [];
  for (const [k, l] of [['marca', 'Marca'], ['modelo', 'Modelo'], ['serial', 'Serial'], ['sede', 'Sede'], ['operacion', 'Operación'], ['proveedor', 'Propietario / proveedor']]) if (!v[k]) faltan.push(l);
  const propio = esPropio(v.proveedor);
  for (const c of t.campos) {
    if (c.oculto || (c.k === 'precio' && !propio) || (c.k === 'renta_mensual' && propio)) continue;
    if (datos[c.k] === undefined) faltan.push(c.l);
  }
  if (!v.observaciones) faltan.push('Observaciones');
  return faltan;
}
function validar(db, b, { nuevo, tipo: tipoActual, completo }) {
  if (!b || typeof b !== 'object' || Array.isArray(b)) return { error: 'Datos no válidos' };
  const permitidas = ['tipo', 'codigo', 'sede', 'operacion', 'proveedor', 'marca', 'modelo', 'serial', 'datos', 'observaciones', 'estado'];
  if (Object.keys(b).some((k) => !permitidas.includes(k))) return { error: 'Datos no válidos' };
  // Un elemento de un tipo ya desactivado se sigue pudiendo editar (Fase 372); uno nuevo, no.
  const t = tipo(db, nuevo ? b.tipo : tipoActual, { todos: !nuevo });
  if (!t) return { error: 'Elige el tipo de elemento' };
  let codigo = _txt(b.codigo, 40);
  // Fase 380 (I5): un equipo administrable nuevo sin código recibe el siguiente de su subtipo.
  const subtipoNuevo = b.datos && typeof b.datos === 'object' ? b.datos.subtipo : undefined;
  if (nuevo && !codigo && t.codigo === 'ADMINISTRABLE') codigo = siguienteCodigoAdmin(db, subtipoNuevo);
  if (nuevo && !/^[\p{L}\p{N}][\p{L}\p{N} ._/-]{0,39}$/u.test(codigo)) return { error: 'El código es obligatorio (letras, números, punto, guion o barra; hasta 40)' };
  const v = { sede: _txt(b.sede), operacion: _txt(b.operacion), proveedor: _txt(b.proveedor), marca: _txt(b.marca, 60), modelo: _txt(b.modelo, 60), serial: _txt(b.serial, 80), observaciones: _txt(b.observaciones, 500) };
  for (const [campo, nombreLista] of [['sede', 'sedes'], ['operacion', 'operaciones'], ['proveedor', 'proveedores']]) {
    if (v[campo] && !lista(db, nombreLista).includes(v[campo])) return { error: 'Elige ' + LISTAS[nombreLista].toLowerCase().replace(/s$/, '') + ' de la lista (Ajustes)' };
  }
  const datos = {};
  const d = b.datos && typeof b.datos === 'object' && !Array.isArray(b.datos) ? b.datos : {};
  for (const c of t.campos) {
    if (c.oculto) continue; // Fase 372: campo oculto -- no se recibe; editar() conserva lo guardado
    const x = d[c.k];
    if (x === undefined || x === null || x === '') continue;
    if (c.t === 'numero') { const n = Number(x); if (!Number.isFinite(n) || n < 0 || n > 1e10) return { error: c.l + ': escribe un número' }; datos[c.k] = n; }
    else if (c.t === 'lista') { if (!(c.o || []).includes(x)) return { error: c.l + ': elige una opción' }; datos[c.k] = x; }
    else datos[c.k] = _txt(String(x), 120);
  }
  if (completo) { const faltan = camposFaltantes(t, v, datos); if (faltan.length) return { error: faltanTexto(faltan), faltan }; }
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
  o.rendimiento = a.conRam ? rendimientoDe(o.datos.ram_gb) : null; // Fase 377
  delete o.conRam;
  // Fase GH5c: + cédula y «asignado desde» para la lista de Asignados (diseño de Edwin).
  o.agente = a.agenteId ? { id: a.agenteId, nombre: a.agenteNombre, documento: a.agenteDocumento || '', desde: a.agenteDesde || '' } : null;
  delete o.agenteId; delete o.agenteNombre; delete o.agenteDocumento; delete o.agenteDesde;
  return o;
}
// El agente actual de cada elemento sale de su asignación abierta (hasta IS NULL).
// Fase 377: conRam = el tipo lleva RAM (para el rendimiento).
const SELECT_ACTIVO = `SELECT a.*, s.agenteId, g.nombre AS agenteNombre, g.documento AS agenteDocumento, s.desde AS agenteDesde,
  EXISTS (SELECT 1 FROM activos_tipos t, json_each(t.campos) c WHERE t.codigo = a.tipo AND json_extract(c.value, '$.k') = 'ram_gb') AS conRam FROM activos a
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
  // Fase 372 (E4): lo guardado en un campo oculto no se pierde al editar el elemento.
  const t = tipo(db, a.tipo, { todos: true });
  for (const c of (t ? t.campos : [])) if (c.oculto && a.datos && a.datos[c.k] !== undefined) v.datos[c.k] = a.datos[c.k];
  db.transaction(() => {
    db.prepare('UPDATE activos SET sede = ?, operacion = ?, proveedor = ?, marca = ?, modelo = ?, serial = ?, datos = ?, observaciones = ?, updatedAt = ? WHERE id = ?')
      .run(v.sede, v.operacion, v.proveedor, v.marca, v.modelo, v.serial, JSON.stringify(v.datos), v.observaciones, new Date().toISOString(), a.id);
    _hist(db, a.id, 'Edición', a.estado, a.estado, '', quien);
  })();
  return obtener(db, a.id);
}
// Cambio de estado: siempre con motivo (Edwin: «cambio de elemento con motivo»). «En uso» lo pone
// la asignación a un agente (E2), salvo los equipos administrables (en uso = instalado).
function cambiarEstado(db, a, estado, motivo, quien, tecnico) {
  if (!ESTADO_CODIGOS.includes(estado)) return { error: 'Estado no válido' };
  if (estado === a.estado) return { error: 'El elemento ya está en ese estado' };
  if (a.estado === 'de_baja') return { error: 'Un elemento dado de baja no cambia de estado' };
  if (estado === 'en_uso' && a.tipo !== 'ADMINISTRABLE') return { error: '«En uso» se marca al asignarlo a un agente' };
  let m = _txt(motivo, 300);
  if (m.length < 3) return { error: 'Escribe el motivo o diagnóstico' };
  // Fase 378 (I3, diseño de Edwin): al mandarlo a reparación, el técnico o proveedor (opcional) va en el motivo.
  const tec = estado === 'en_reparacion' ? _txt(tecnico, 80) : '';
  if (tec) m = (m + ' · Técnico: ' + tec).slice(0, 380);
  // Fase 378: un elemento asignado también cambia de estado; se registra la devolución del agente.
  if (a.agente) {
    db.transaction(() => _cerrar(db, a, estado, m, quien, new Date().toISOString(), 'Devolución por cambio de estado'))();
    return { activo: obtener(db, a.id), devuelto: true };
  }
  db.transaction(() => {
    db.prepare('UPDATE activos SET estado = ?, updatedAt = ? WHERE id = ?').run(estado, new Date().toISOString(), a.id);
    _hist(db, a.id, 'Cambio de estado', a.estado, estado, m, quien);
  })();
  return { activo: obtener(db, a.id) };
}

function listar(db, q) {
  const where = [], p = [];
  if (q.ambito) { where.push('a.tipo IN (SELECT codigo FROM activos_tipos WHERE ambito = ?)'); p.push(ambitoDe(q.ambito)); } // Fase 376
  if (q.tipo) { where.push('a.tipo = ?'); p.push(q.tipo); }
  if (q.estado) { where.push('a.estado = ?'); p.push(q.estado); }
  // Fase 377: «__none» = sin sede / sin operación / sin propietario.
  for (const k of ['sede', 'operacion', 'proveedor']) if (q[k]) { where.push('a.' + k + ' = ?'); p.push(q[k] === '__none' ? '' : q[k]); }
  if (q.rend && RENDIMIENTOS.some((r) => r.codigo === q.rend)) {
    const conRam = tiposConRam(db);
    if (!conRam.length) where.push('0');
    else { where.push('a.tipo IN (' + conRam.map(() => '?').join(',') + ') AND ' + SQL_REND + ' = ?'); p.push(...conRam, q.rend); }
  }
  if (q.pend) where.push("(a.marca = '' OR a.modelo = '' OR a.serial = '' OR a.sede = '' OR a.operacion = '')"); // datos pendientes
  if (q.dup) where.push("a.serial != '' AND EXISTS (SELECT 1 FROM activos b WHERE b.tipo = a.tipo AND b.serial = a.serial AND b.id != a.id)"); // seriales repetidos
  if (q.q) { where.push("(a.codigo LIKE ? OR a.marca LIKE ? OR a.modelo LIKE ? OR a.serial LIKE ? OR a.datos LIKE ? OR g.nombre LIKE ?)"); const s = '%' + String(q.q).slice(0, 60).replace(/[%_]/g, '') + '%'; p.push(s, s, s, s, s, s); }
  return db.prepare(SELECT_ACTIVO + ' ' + (where.length ? 'WHERE ' + where.join(' AND ') : '') + ' ORDER BY a.tipo, a.codigo LIMIT 3000').all(...p).map(_publico);
}
function resumen(db, ambito) {
  // Fase 376: por ámbito (sistemas o inmuebles).
  const amb = ambitoDe(ambito), F = " WHERE tipo IN (SELECT codigo FROM activos_tipos WHERE ambito = '" + amb + "')";
  const porEstado = Object.fromEntries(ESTADO_CODIGOS.map((e) => [e, 0]));
  for (const r of db.prepare('SELECT estado, COUNT(*) n FROM activos' + F + ' GROUP BY estado').all()) porEstado[r.estado] = r.n;
  const porTipo = {};
  for (const r of db.prepare('SELECT tipo, estado, COUNT(*) n FROM activos' + F + ' GROUP BY tipo, estado').all()) {
    porTipo[r.tipo] = porTipo[r.tipo] || Object.fromEntries(ESTADO_CODIGOS.map((e) => [e, 0]));
    porTipo[r.tipo][r.estado] = r.n;
  }
  const porSede = db.prepare("SELECT CASE WHEN sede = '' THEN '(sin sede)' ELSE sede END sede, COUNT(*) n FROM activos" + F + " AND estado != 'de_baja' GROUP BY 1 ORDER BY n DESC").all();
  const agentes = db.prepare(`SELECT COUNT(*) activos, COALESCE(SUM(EXISTS (SELECT 1 FROM activos_asignaciones s WHERE s.agenteId = g.id AND s.hasta IS NULL)), 0) conElementos
    FROM activos_agentes g WHERE g.activo = 1`).get(); // Fase 370
  // Fase 377: rendimiento por RAM de los que la llevan (sin los dados de baja); null si no hay ninguno.
  const conRam = tiposConRam(db), porRendimiento = Object.fromEntries(RENDIMIENTOS.map((r) => [r.codigo, 0]));
  if (conRam.length) {
    for (const r of db.prepare('SELECT ' + SQL_REND + " rend, COUNT(*) n FROM activos a WHERE a.estado != 'de_baja' AND a.tipo IN (" + conRam.map(() => '?').join(',') +
      ') AND a.tipo IN (SELECT codigo FROM activos_tipos WHERE ambito = ?) GROUP BY 1').all(...conRam, amb)) porRendimiento[r.rend] = r.n;
  }
  const hayRam = Object.values(porRendimiento).some((n) => n > 0);
  return { total: Object.values(porEstado).reduce((a, b) => a + b, 0), porEstado, porTipo, porSede, agentes, porRendimiento: hayRam ? porRendimiento : null };
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
  const lista = db.prepare(`SELECT g.*, (SELECT COUNT(*) FROM activos_asignaciones s WHERE s.agenteId = g.id AND s.hasta IS NULL) AS elementos
    FROM activos_agentes g ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY g.activo DESC, g.nombre LIMIT 3000`).all(...p);
  if (!q.equipos) return lista;
  // Fase INV5 (HTML de Edwin, hoja «Agentes y equipos asignados»): lo que tiene asignado hoy cada agente.
  const por = new Map();
  db.prepare(`SELECT s.agenteId, a.codigo, COALESCE(t.nombre, a.tipo) AS tipo FROM activos_asignaciones s JOIN activos a ON a.id = s.activoId
    LEFT JOIN activos_tipos t ON t.codigo = a.tipo WHERE s.hasta IS NULL ORDER BY t.orden, a.codigo`).all()
    .forEach((r) => { if (!por.has(r.agenteId)) por.set(r.agenteId, []); por.get(r.agenteId).push({ tipo: r.tipo, codigo: r.codigo }); });
  return lista.map((g) => Object.assign(g, { equipos: por.get(g.id) || [] }));
}
function agente(db, id) { return db.prepare('SELECT * FROM activos_agentes WHERE id = ?').get(id) || null; }
// Pedido de Edwin (25/11/2026): una cédula que no está en Talento humano.
//   'avisar' (hoy): se crea el agente con el nombre escrito a mano; el navegador muestra «No se encontró en
//                   Talento humano».
//   'bloquear':     no se crea (400). Cambiar a esto es cambiar esta constante.
const CEDULA_SIN_GH = 'avisar';
function crearAgente(db, v) {
  const dup = _agenteDuplicado(db, v); if (dup) return { error: dup, status: 409 };
  if (CEDULA_SIN_GH === 'bloquear' && v.documento && !require('./gh-novedades').nombrePorDocumento(db, v.documento)) {
    return { error: 'Esa cédula no está en Talento humano. Pide su registro primero.', status: 400 };
  }
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
  const ta = tipo(db, a.tipo, { todos: true }); // Fase INV2: «Se asigna a agentes» del tipo
  if (ta && !ta.asignable) return { error: ta.plural + ': este tipo no se asigna a agentes (es un componente del inventario)' };
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

// Fase 378 (I3): reasignar un elemento asignado a otro agente en un solo paso (sigue «En uso»).
function reasignar(db, a, agenteId, motivo, quien) {
  if (!a.agente) return { error: 'El elemento no está asignado: usa «Asignar»' };
  const g = Number.isInteger(agenteId) ? agente(db, agenteId) : null;
  if (!g || !g.activo) return { error: 'Elige un agente activo' };
  if (g.id === a.agente.id) return { error: 'Ya está asignado a ese agente' };
  const m = _txt(motivo, 300);
  if (m.length < 3) return { error: 'Escribe el motivo' };
  db.transaction(() => {
    const ahora = new Date().toISOString();
    db.prepare('UPDATE activos_asignaciones SET hasta = ?, motivoFin = ? WHERE activoId = ? AND hasta IS NULL').run(ahora, 'Reasignado: ' + m, a.id);
    db.prepare('INSERT INTO activos_asignaciones (activoId, agenteId, desde, quien) VALUES (?,?,?,?)').run(a.id, g.id, ahora, quien);
    db.prepare('UPDATE activos SET updatedAt = ? WHERE id = ?').run(ahora, a.id);
    _hist(db, a.id, 'Reasignación', 'en_uso', 'en_uso', m + ' · de ' + a.agente.nombre + ' a ' + g.nombre, quien);
  })();
  return { activo: obtener(db, a.id), agente: g };
}
// Fase 378 (I3): el agente que recibe: uno existente (agenteId) o uno nuevo (nombre y documento); si el
// documento ya existe, se usa ese agente. -> { agente } o { error }
function agenteParaAsignar(db, b) {
  if (b && Number.isInteger(b.agenteId)) return { agenteId: b.agenteId };
  if (!b || !b.agenteNuevo || typeof b.agenteNuevo !== 'object' || Array.isArray(b.agenteNuevo)) return { error: 'Elige un agente activo' };
  const v = validarAgente(db, b.agenteNuevo, true);
  if (v.error) return v;
  if (!v.valores.documento) return { error: 'Escribe la cédula del agente nuevo' };
  const hay = db.prepare('SELECT id, activo FROM activos_agentes WHERE documento = ?').get(v.valores.documento);
  if (hay) return hay.activo ? { agenteId: hay.id, existente: true } : { error: 'Ese documento es de un agente inactivo: actívalo en «Agentes»' };
  const c = crearAgente(db, v.valores);
  return c.error ? c : { agenteId: c.agente.id, creado: true };
}

// ── Fase 381 (I6, diseño de Edwin): historial general e importación ──
// Historial de todos los elementos del inventario abierto, con filtros (desde/hasta AAAA-MM-DD, acción, texto).
function historialGeneral(db, q) {
  const where = ['a.tipo IN (SELECT codigo FROM activos_tipos WHERE ambito = ?)'], p = [ambitoDe(q.ambito)];
  if (q.desde && /^\d{4}-\d{2}-\d{2}$/.test(q.desde)) { where.push('h.fecha >= ?'); p.push(q.desde); }
  if (q.hasta && /^\d{4}-\d{2}-\d{2}$/.test(q.hasta)) { where.push('h.fecha < ?'); p.push(q.hasta + 'T99'); }
  if (q.accion) { where.push('h.accion = ?'); p.push(String(q.accion).slice(0, 60)); }
  if (q.q) { const t = '%' + String(q.q).slice(0, 60).replace(/[%_]/g, '') + '%'; where.push('(a.codigo LIKE ? OR h.motivo LIKE ? OR h.quien LIKE ?)'); p.push(t, t, t); }
  const filas = db.prepare('SELECT h.id, h.fecha, h.accion, h.estadoAntes, h.estadoDespues, h.motivo, h.quien, a.id AS activoId, a.tipo, a.codigo FROM activos_historial h JOIN activos a ON a.id = h.activoId WHERE ' +
    where.join(' AND ') + ' ORDER BY h.ts DESC, h.id DESC LIMIT 2000').all(...p);
  const acciones = db.prepare('SELECT DISTINCT accion FROM activos_historial ORDER BY accion').all().map((r) => r.accion);
  return { historial: filas, acciones };
}
// Encabezado del Excel → campo. Acepta las columnas fijas y las etiquetas o claves de los campos del tipo.
const _norm = (s) => String(s == null ? '' : s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const COLUMNAS_FIJAS = { codigo: ['codigo', 'código', 'etiqueta'], marca: ['marca'], modelo: ['modelo'], serial: ['serial', 'serie'], sede: ['sede'], operacion: ['operacion', 'operación', 'departamento operacion', 'departamento / operación'],
  proveedor: ['propietario', 'proveedor', 'propietario proveedor', 'propietario / proveedor', 'propiedad'], observaciones: ['observaciones', 'observacion', 'adicionales'], estado: ['estado'] };
function mapaColumnas(t, encabezados) {
  const m = {};
  const alias = Object.entries(COLUMNAS_FIJAS).flatMap(([k, l]) => l.map((x) => [_norm(x), { k }]));
  for (const c of t.campos) if (!c.oculto) { alias.push([_norm(c.l), { k: c.k, dato: true }]); alias.push([_norm(c.k), { k: c.k, dato: true }]); }
  const a = new Map(alias);
  encabezados.forEach((h, i) => { const x = a.get(_norm(h)); if (x && !Object.values(m).some((y) => y.k === x.k)) m[i] = x; });
  return m;
}
const ESTADO_TEXTO = { libre: 'libre', disponible: 'libre', 'en reparacion': 'en_reparacion', reparacion: 'en_reparacion', malo: 'malo', 'fuera de servicio': 'malo' };
// filas = matriz (primera fila = encabezados). Sin confirmar: solo revisa. Confirmar: crea los válidos en una transacción.
function importar(db, tipoCodigo, filas, confirmar, quien) {
  const t = tipo(db, tipoCodigo);
  if (!t) return { error: 'Elige el tipo de elemento' };
  if (!Array.isArray(filas) || filas.length < 2 || filas.length > 2001 || !filas.every(Array.isArray)) return { error: 'El archivo debe traer encabezados y entre 1 y 2.000 filas' };
  const m = mapaColumnas(t, filas[0]);
  // Fase INV6: también vale el nombre propio de los estados que se pueden importar (si se renombraron).
  const estTxt = Object.assign({}, ESTADO_TEXTO); estados(db).filter((e) => ['libre', 'en_reparacion', 'malo'].includes(e.codigo)).forEach((e) => { estTxt[_norm(e.nombre)] = e.codigo; });
  if (!Object.values(m).some((x) => x.k === 'codigo') && t.codigo !== 'ADMINISTRABLE') return { error: 'Falta la columna «Código»' };
  const NOMBRE_FIJA = { codigo: 'Código', marca: 'Marca', modelo: 'Modelo', serial: 'Serial', sede: 'Sede', operacion: 'Operación', proveedor: 'Propietario / proveedor', observaciones: 'Observaciones', estado: 'Estado' };
  const reconocidas = Object.values(m).map((x) => (x.dato ? (t.campos.find((c) => c.k === x.k) || {}).l || x.k : NOMBRE_FIJA[x.k]));
  const resultado = [], codigos = new Set();
  filas.slice(1).forEach((fila, i) => {
    if (!fila.some((v) => v !== null && v !== undefined && String(v).trim() !== '')) return;
    const b = { tipo: t.codigo, datos: {} };
    for (const [idx, x] of Object.entries(m)) {
      let v = fila[idx];
      if (v === null || v === undefined || String(v).trim() === '') continue;
      if (x.dato) { const c = t.campos.find((z) => z.k === x.k); b.datos[x.k] = c && c.t === 'numero' ? Number(String(v).replace(/[^\d.,-]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.')) : String(v).trim(); }
      else if (x.k === 'estado') { const e = estTxt[_norm(v)]; if (e) b.estado = e; else b.estado = '?' + String(v).slice(0, 30); }
      else b[x.k] = String(v).trim();
    }
    if (typeof b.estado === 'string' && b.estado.startsWith('?')) { resultado.push({ fila: i + 2, error: 'Estado «' + b.estado.slice(1) + '»: usa ' + ['libre', 'en_reparacion', 'malo'].map((c) => estadoNombre(db, c)).join(', ').replace(/, ([^,]*)$/, ' o $1') }); return; }
    const v = validar(db, b, { nuevo: true });
    if (v.error) { resultado.push({ fila: i + 2, codigo: b.codigo || '', error: v.error }); return; }
    // Administrable sin código: el automático se calcula al guardar (no se comparan entre sí).
    if (t.codigo === 'ADMINISTRABLE' && !b.codigo) { v.valores.codigo = ''; resultado.push({ fila: i + 2, codigo: '(automático)', ok: true, valores: v.valores }); return; }
    const k = v.valores.codigo;
    if (codigos.has(k)) { resultado.push({ fila: i + 2, codigo: k, error: 'Código repetido en el archivo' }); return; }
    if (db.prepare('SELECT 1 FROM activos WHERE tipo = ? AND codigo = ?').get(t.codigo, k)) { resultado.push({ fila: i + 2, codigo: k, error: 'Ya existe en el inventario' }); return; }
    codigos.add(k);
    resultado.push({ fila: i + 2, codigo: k, ok: true, valores: v.valores });
  });
  const validas = resultado.filter((r) => r.ok);
  const resumen = { tipo: t.codigo, columnas: reconocidas, validas: validas.length, errores: resultado.filter((r) => !r.ok).length,
    detalle: resultado.map((r) => (r.ok ? { fila: r.fila, codigo: r.codigo, ok: true } : { fila: r.fila, codigo: r.codigo || '', error: r.error })).slice(0, 500) };
  if (!confirmar) return resumen;
  if (!validas.length) return { error: 'No hay filas válidas para importar' };
  db.transaction(() => {
    for (const r of validas) {
      // El código automático de los administrables se calcula de nuevo dentro de la transacción.
      if (t.codigo === 'ADMINISTRABLE' && !r.valores.codigo) r.valores.codigo = siguienteCodigoAdmin(db, r.valores.datos.subtipo);
      const c = crear(db, r.valores, quien);
      if (c.error) throw new Error('Fila ' + r.fila + ': ' + c.error);
      db.prepare("UPDATE activos_historial SET accion = 'Ingreso (importado)' WHERE activoId = ? AND accion = 'Ingreso'").run(c.activo.id);
    }
  })();
  return Object.assign(resumen, { importadas: validas.length });
}

module.exports = { faltanTexto, camposFaltantes, esPropio, CEDULA_SIN_GH, historialGeneral, mapaColumnas, importar, ADMIN_SUBTIPOS_I5, ADMIN_CODIGO_BASE, agregarCamposI5, siguienteCodigoAdmin, ipRepetida, reasignar, agenteParaAsignar, CAMPOS_I2, agregarCamposI2, RENDIMIENTOS, rendimientoDe, AMBITOS, TIPOS_INMUEBLES, ambitoDe, ESTADOS_AL_SOLTAR, validarAgente, agentes, agente, crearAgente, editarAgente, agenteDetalle, asignar, devolver, cambiarElemento,
  ESTADOS, ESTADO_CODIGOS, estados, estadoNombre, renombrarEstados, ESTADO_NOMBRE_MAX, LISTAS, TIPOS_BASE, puede, crearTablas, tipos, tipo, lista, guardarLista, validar, crear, obtener, editar, cambiarEstado, listar, resumen, historial };
