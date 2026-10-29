// sura-televentas.js — Fase 215: cliente SURA, tablero "Televentas".
//
// El tablero nace del HTML de una sola pagina que hizo Edwin (SheetJS en el
// navegador + IndexedDB). Aqui vive lo que antes guardaba IndexedDB, ahora
// en SQLite y por (cliente, tipo de base, mes):
//   - sura_bases:     el resultado PROCESADO de cada Excel (mismo formato que
//                     el objeto DB del HTML), comprimido con gzip. El Excel se
//                     sigue leyendo en el navegador con las mismas funciones
//                     del HTML (parseBook / parseIni / parseEst), asi los
//                     numeros no cambian.
//   - sura_archivos:  el Excel original, para el boton "Descargar".
//   - sura_config:    metas por mes y campana, meta individual por asesor,
//                     asesores quitados/agregados por campana, diccionario de
//                     codigos, tabla de tipificaciones y alias de asesores.
//   - sura_versiones: lo que habia antes de reemplazar o eliminar una base
//                     (mismo criterio que cargas-versiones.js: 30 dias, tope
//                     por mes), para poder recuperarlo.
// Escribir es solo del administrador (la ruta lo exige). El cliente ve las
// pestanas de PESTANAS_CLIENTE y recibe las cedulas seudonimizadas (HMAC):
// el cruce entre bases sigue funcionando porque es por igualdad, y la
// cedula real nunca sale del servidor hacia el rol cliente.
'use strict';

const crypto = require('crypto');
const zlib = require('zlib');

const ESPECIFICO = 'sura_televentas';
const TIPOS = ['ventas', 'inicial', 'estrategias'];
const CLAVES_CONFIG = ['metas', 'metasI', 'agc', 'dic', 'tip', 'agalias'];

// Pestanas del HTML (data-p). Edwin aun confirma cuales ve el cliente: se
// cambia SOLO esta lista. Cargar informacion (p1) y Bases (p10) son del
// administrador.
const PESTANAS = ['p1', 'p9', 'p2', 'p5', 'p7', 'p3', 'p10'];
const PESTANAS_CLIENTE = ['p9', 'p2', 'p5', 'p7', 'p3'];

const DIAS_RETENCION = 30;
const TOPE_VERSIONES = 3;
const MAX_ARCHIVO_BYTES = 28 * 1024 * 1024;
const MAX_FILAS = 300000;
const RE_MES = /^20\d{2}-(0[1-9]|1[0-2])$/;
const RE_ARCHIVO = /\.(xlsx|xlsm|xls|csv)$/i;

const SQL_TABLAS = `
CREATE TABLE IF NOT EXISTS sura_bases (
  cliente TEXT NOT NULL,
  tipo TEXT NOT NULL,
  mes TEXT NOT NULL,
  archivoNombre TEXT NOT NULL,
  registros INTEGER NOT NULL,
  datos BLOB NOT NULL,
  cargadoEn TEXT NOT NULL,
  cargadoPorNombre TEXT,
  PRIMARY KEY (cliente, tipo, mes)
);
CREATE TABLE IF NOT EXISTS sura_archivos (
  cliente TEXT NOT NULL,
  tipo TEXT NOT NULL,
  mes TEXT NOT NULL,
  archivoNombre TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  archivo BLOB NOT NULL,
  PRIMARY KEY (cliente, tipo, mes)
);
CREATE TABLE IF NOT EXISTS sura_config (
  cliente TEXT NOT NULL,
  clave TEXT NOT NULL,
  valor TEXT NOT NULL,
  actualizadoEn TEXT NOT NULL,
  actualizadoPorNombre TEXT,
  PRIMARY KEY (cliente, clave)
);
CREATE TABLE IF NOT EXISTS sura_versiones (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cliente TEXT NOT NULL,
  tipo TEXT NOT NULL,
  mes TEXT NOT NULL,
  motivo TEXT NOT NULL,
  archivoNombre TEXT NOT NULL,
  registros INTEGER NOT NULL,
  datos BLOB NOT NULL,
  cargadoEn TEXT NOT NULL,
  cargadoPorNombre TEXT,
  guardadoEn TEXT NOT NULL,
  guardadoPorNombre TEXT,
  expiraEn TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sura_versiones_mes ON sura_versiones (cliente, tipo, mes);
`;

function crearTablas(db) {
  db.exec(SQL_TABLAS);
}

// Cliente con este tablero: lo marca el registro de clientes
// (parametros.especificos), nunca un nombre fijo en el codigo.
function esClienteTeleventas(db, cliente) {
  const row = db.prepare('SELECT parametros FROM clientes_registro WHERE nombre = ? AND activo = 1').get(cliente);
  if (!row) return false;
  try {
    const p = JSON.parse(row.parametros || '{}');
    return Array.isArray(p.especificos) && p.especificos.includes(ESPECIFICO);
  } catch (e) {
    return false;
  }
}

function pestanasPara(esAdmin) {
  return esAdmin ? PESTANAS.slice() : PESTANAS.filter((p) => PESTANAS_CLIENTE.includes(p));
}

// ── Validacion del resultado procesado (lo que arma el navegador) ──────────
const esArr = Array.isArray;
const esObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const esNum = (v) => typeof v === 'number' && Number.isFinite(v);
const esTxt = (v) => typeof v === 'string';

function largoIgual(arrs, n) {
  return arrs.every((a) => esArr(a) && a.length === n);
}

function validarVentas(d) {
  if (!esArr(d.rows) || d.rows.length > MAX_FILAS) return 'rows debe ser una lista de ventas';
  for (const r of d.rows) {
    if (!esArr(r) || r.length !== 12) return 'cada venta debe tener 12 campos';
    if (!esTxt(r[1]) || !/^\d{4}-\d{2}-\d{2}$/.test(r[1])) return 'cada venta debe tener fecha AAAA-MM-DD';
    if (!esNum(r[2]) || !esNum(r[3])) return 'cantidad y produccion deben ser numeros';
    if (!esArr(r[5])) return 'campos de estrategia invalidos';
  }
  if (!esNum(d.total) || d.total < 0) return 'total invalido';
  const p = d.pr;
  if (!esObj(p) || !esArr(p.ids) || p.ids.length > MAX_FILAS) return 'pr (registros de la base) invalido';
  if (!largoIgual([p.d, p.c, p.e, p.a, p.k, p.r], p.ids.length)) return 'pr con listas de distinto largo';
  if (![p.D, p.C, p.A, p.K, p.R].every(esArr)) return 'pr sin catalogos';
  for (const k of Object.keys(p)) {
    if (/^x_/.test(k) && (!esArr(p[k]) || p[k].length !== p.ids.length || !esArr(p['X_' + k.slice(2)]))) return 'pr con columna de codigos invalida';
  }
  for (const k of ['strat', 'ag', 'geo', 'ct']) if (!esObj(d[k])) return k + ' invalido';
  if (!esArr(d.sh)) return 'sh invalido';
  return null;
}

function validarInicial(d) {
  if (!esArr(d.ids) || d.ids.length > MAX_FILAS) return 'ids invalido';
  if (!esArr(d.cols)) return 'cols invalido';
  for (const c of d.cols) {
    if (!esObj(c) || !esTxt(c.k) || !esTxt(c.h)) return 'columna invalida';
    if (c.n !== undefined ? !largoIgual([c.n], d.ids.length) : !(esArr(c.V) && largoIgual([c.x], d.ids.length))) return 'columna con largo distinto';
  }
  return null;
}

function validarEstrategias(d) {
  if (!esArr(d.ids) || d.ids.length > MAX_FILAS) return 'ids invalido';
  if (!largoIgual([d.cp], d.ids.length) || !esArr(d.C)) return 'estrategia (campana) invalida';
  if (!esArr(d.cols)) return 'cols invalido';
  for (const c of d.cols) {
    if (!esObj(c) || !esNum(c.num) || !esArr(c.N) || !esArr(c.L)) return 'columna de estrategia invalida';
    if (!largoIgual([c.n, c.l], d.ids.length)) return 'columna de estrategia con largo distinto';
  }
  return null;
}

const VALIDADORES = { ventas: validarVentas, inicial: validarInicial, estrategias: validarEstrategias };

function registrosDe(tipo, d) {
  return tipo === 'ventas' ? d.rows.length : d.ids.length;
}

// Firma del Excel: xlsx/xlsm son ZIP (PK), xls es OLE (D0 CF 11 E0); csv
// es texto, solo en la base inicial y la de estrategias (como el HTML).
function tipoArchivoValido(tipo, nombre, buf) {
  if (!buf || buf.length < 4) return false;
  const zip = buf[0] === 0x50 && buf[1] === 0x4b;
  const ole = buf[0] === 0xd0 && buf[1] === 0xcf && buf[2] === 0x11 && buf[3] === 0xe0;
  if (/\.csv$/i.test(nombre)) return tipo !== 'ventas' && !buf.subarray(0, 4096).includes(0);
  if (/\.xls$/i.test(nombre)) return ole;
  return zip;
}

// Valida todo lo que llega a POST .../bases/:tipo/:mes. Devuelve
// { error } o { datos, archivo (Buffer) } listos para guardar.
function validarCarga(tipo, mes, body) {
  if (!TIPOS.includes(tipo)) return { error: 'Tipo de base desconocido' };
  if (!RE_MES.test(mes)) return { error: 'Mes invalido (AAAA-MM)' };
  if (!esObj(body)) return { error: 'Cuerpo invalido' };
  const nombre = body.archivoNombre;
  if (!esTxt(nombre) || !nombre.trim() || nombre.length > 200 || !RE_ARCHIVO.test(nombre) || /[\\/\0]/.test(nombre)) {
    return { error: 'Nombre de archivo invalido (.xlsx, .xlsm, .xls o .csv)' };
  }
  if (!esTxt(body.archivo) || !/^[A-Za-z0-9+/]*={0,2}$/.test(body.archivo)) return { error: 'Falta el archivo original' };
  const archivo = Buffer.from(body.archivo, 'base64');
  if (!archivo.length || archivo.length > MAX_ARCHIVO_BYTES) return { error: 'El archivo original esta vacio o pasa de 28 MB' };
  if (!tipoArchivoValido(tipo, nombre, archivo)) return { error: 'El archivo no es un Excel valido' };
  if (!esObj(body.datos)) return { error: 'Faltan los datos procesados' };
  const err = VALIDADORES[tipo](body.datos);
  if (err) return { error: 'Datos procesados invalidos: ' + err };
  // Solo se guardan las claves que produce el HTML (nada extra del cliente).
  const CLAVES = {
    ventas: ['rows', 'total', 'sheet', 'strat', 'ag', 'geo', 'pr', 'ct', 'sh', 'x12', 'mixta'],
    inicial: ['ids', 'cols', 'sheet'],
    estrategias: ['ids', 'cp', 'C', 'sheet', 'cols'],
  }[tipo];
  const datos = {};
  for (const k of CLAVES) if (body.datos[k] !== undefined) datos[k] = body.datos[k];
  if (tipo === 'ventas') datos.v = 18; // version de formato del HTML
  return { datos, archivo, archivoNombre: nombre.trim() };
}

function gz(obj) {
  return zlib.gzipSync(Buffer.from(JSON.stringify(obj)));
}
function ungz(blob) {
  return JSON.parse(zlib.gunzipSync(blob).toString());
}

function guardarVersion(db, row, motivo, actorNombre) {
  const ahora = new Date();
  db.prepare(
    `INSERT INTO sura_versiones (cliente, tipo, mes, motivo, archivoNombre, registros, datos, cargadoEn, cargadoPorNombre, guardadoEn, guardadoPorNombre, expiraEn)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    row.cliente, row.tipo, row.mes, motivo, row.archivoNombre, row.registros, row.datos, row.cargadoEn,
    row.cargadoPorNombre, ahora.toISOString(), actorNombre,
    new Date(ahora.getTime() + DIAS_RETENCION * 864e5).toISOString()
  );
  db.prepare('DELETE FROM sura_versiones WHERE expiraEn < ?').run(ahora.toISOString());
  const sobran = db.prepare(
    'SELECT id FROM sura_versiones WHERE cliente = ? AND tipo = ? AND mes = ? ORDER BY id DESC LIMIT -1 OFFSET ?'
  ).all(row.cliente, row.tipo, row.mes, TOPE_VERSIONES);
  for (const s of sobran) db.prepare('DELETE FROM sura_versiones WHERE id = ?').run(s.id);
}

function guardarBase(db, { cliente, tipo, mes, archivoNombre, datos, archivo, actorNombre }) {
  const cargadoEn = new Date().toISOString();
  const registros = registrosDe(tipo, datos);
  db.transaction(() => {
    const prev = db.prepare('SELECT * FROM sura_bases WHERE cliente = ? AND tipo = ? AND mes = ?').get(cliente, tipo, mes);
    if (prev) guardarVersion(db, prev, 'reemplazo', actorNombre);
    db.prepare(
      `INSERT OR REPLACE INTO sura_bases (cliente, tipo, mes, archivoNombre, registros, datos, cargadoEn, cargadoPorNombre)
       VALUES (?,?,?,?,?,?,?,?)`
    ).run(cliente, tipo, mes, archivoNombre, registros, gz(datos), cargadoEn, actorNombre);
    db.prepare(
      'INSERT OR REPLACE INTO sura_archivos (cliente, tipo, mes, archivoNombre, bytes, archivo) VALUES (?,?,?,?,?,?)'
    ).run(cliente, tipo, mes, archivoNombre, archivo.length, archivo);
  })();
  return { tipo, mes, archivoNombre, registros, cargadoEn, cargadoPorNombre: actorNombre };
}

function eliminarBase(db, { cliente, tipo, mes, actorNombre }) {
  let borrada = false;
  db.transaction(() => {
    const prev = db.prepare('SELECT * FROM sura_bases WHERE cliente = ? AND tipo = ? AND mes = ?').get(cliente, tipo, mes);
    if (!prev) return;
    guardarVersion(db, prev, 'eliminacion', actorNombre);
    db.prepare('DELETE FROM sura_bases WHERE cliente = ? AND tipo = ? AND mes = ?').run(cliente, tipo, mes);
    db.prepare('DELETE FROM sura_archivos WHERE cliente = ? AND tipo = ? AND mes = ?').run(cliente, tipo, mes);
    borrada = true;
  })();
  return borrada;
}

function listarBases(db, cliente) {
  return db.prepare(
    `SELECT b.tipo, b.mes, b.archivoNombre, b.registros, b.cargadoEn, b.cargadoPorNombre,
            (a.mes IS NOT NULL) AS tieneArchivo
       FROM sura_bases b LEFT JOIN sura_archivos a ON a.cliente = b.cliente AND a.tipo = b.tipo AND a.mes = b.mes
      WHERE b.cliente = ? ORDER BY b.tipo, b.mes`
  ).all(cliente).map((r) => ({ ...r, tieneArchivo: !!r.tieneArchivo }));
}

// ── Cedulas seudonimizadas para quien no es administrador ─────────────────
// HMAC-SHA256 con una llave derivada del secreto del servidor: la misma
// cedula da siempre el mismo valor (los cruces por cedula funcionan igual),
// pero no se puede volver a la cedula sin la llave.
function crearSeudonimo(secreto) {
  const llave = crypto.createHmac('sha256', String(secreto)).update('sura-televentas:cedulas:v1').digest();
  const memo = new Map();
  return (id) => {
    if (id === null || id === undefined || id === '') return id;
    const s = String(id);
    let h = memo.get(s);
    if (!h) {
      h = 'c' + crypto.createHmac('sha256', llave).update(s).digest('base64url').slice(0, 18);
      memo.set(s, h);
    }
    return h;
  };
}

function seudonimizar(tipo, datos, fn) {
  if (tipo === 'ventas') {
    datos.rows = datos.rows.map((r) => {
      const x = r.slice();
      x[11] = fn(x[11]);
      return x;
    });
    if (datos.pr) datos.pr.ids = datos.pr.ids.map(fn);
  } else {
    datos.ids = datos.ids.map(fn);
  }
  return datos;
}

function leerBase(db, { cliente, tipo, mes, seudonimo }) {
  const row = db.prepare('SELECT * FROM sura_bases WHERE cliente = ? AND tipo = ? AND mes = ?').get(cliente, tipo, mes);
  if (!row) return null;
  const datos = ungz(row.datos);
  datos.file = row.archivoNombre;
  datos.at = row.cargadoEn;
  return seudonimo ? seudonimizar(tipo, datos, seudonimo) : datos;
}

function leerArchivo(db, { cliente, tipo, mes }) {
  return db.prepare('SELECT archivoNombre, bytes, archivo FROM sura_archivos WHERE cliente = ? AND tipo = ? AND mes = ?').get(cliente, tipo, mes) || null;
}

// ── Configuracion (metas, codigos, asesores) ───────────────────────────────
function validarConfig(clave, valor) {
  if (!CLAVES_CONFIG.includes(clave)) return 'Clave de configuracion desconocida';
  if (valor === null) return null; // null = volver al valor original del tablero
  if (clave === 'tip') {
    if (!esArr(valor) || valor.length > 500) return 'La tabla de tipificaciones debe ser una lista';
    if (!valor.every((r) => esArr(r) && r.length <= 20 && r.every((x) => esTxt(x) && x.length <= 200))) return 'Fila de tipificacion invalida';
    return null;
  }
  if (!esObj(valor)) return 'Valor invalido';
  if (JSON.stringify(valor).length > 512 * 1024) return 'Valor demasiado grande';
  if (clave === 'metas' || clave === 'metasI') {
    for (const [mes, porCamp] of Object.entries(valor)) {
      if (!RE_MES.test(mes) || !esObj(porCamp)) return 'Meta con mes invalido';
      for (const m of Object.values(porCamp)) {
        if (!esObj(m) || Object.entries(m).some(([f, n]) => !['p', 'v'].includes(f) || !esNum(n) || n < 0)) return 'Meta invalida';
      }
    }
  }
  if (clave === 'agc') {
    for (const o of Object.values(valor)) {
      if (!esObj(o) || ![o.out || [], o.in || []].every((l) => esArr(l) && l.every(esTxt))) return 'Lista de asesores invalida';
    }
  }
  if (clave === 'dic') {
    for (const m of Object.values(valor)) {
      if (!esObj(m) || !Object.values(m).every(esTxt)) return 'Diccionario invalido';
    }
  }
  if (clave === 'agalias' && !Object.entries(valor).every(([a, b]) => a.length <= 200 && esTxt(b) && b.length <= 200)) {
    return 'Alias invalido';
  }
  return null;
}

function leerConfig(db, cliente) {
  const out = {};
  for (const r of db.prepare('SELECT clave, valor FROM sura_config WHERE cliente = ?').all(cliente)) {
    out[r.clave] = JSON.parse(r.valor);
  }
  return out;
}

function guardarConfig(db, { cliente, clave, valor, actorNombre }) {
  if (valor === null) {
    db.prepare('DELETE FROM sura_config WHERE cliente = ? AND clave = ?').run(cliente, clave);
    return;
  }
  db.prepare(
    'INSERT OR REPLACE INTO sura_config (cliente, clave, valor, actualizadoEn, actualizadoPorNombre) VALUES (?,?,?,?,?)'
  ).run(cliente, clave, JSON.stringify(valor), new Date().toISOString(), actorNombre);
}

module.exports = {
  ESPECIFICO,
  TIPOS,
  CLAVES_CONFIG,
  PESTANAS,
  PESTANAS_CLIENTE,
  RE_MES,
  crearTablas,
  esClienteTeleventas,
  pestanasPara,
  validarCarga,
  guardarBase,
  eliminarBase,
  listarBases,
  leerBase,
  leerArchivo,
  crearSeudonimo,
  validarConfig,
  leerConfig,
  guardarConfig,
};
