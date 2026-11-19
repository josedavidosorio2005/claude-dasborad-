// activos-actas.js — Fase 371 (pedido de Edwin 18/11, E3): actas del «Inventario de sistemas».
// Un acta de ENTREGA (elementos que el agente tiene asignados) o de DEVOLUCIÓN (elementos que ya
// entregó) guarda una copia fija de los datos (agente y elementos) con un número consecutivo. El PDF
// se arma en el navegador (imprimir → «Guardar como PDF»), igual que el reporte PDF de la Fase 355.
// El acta FIRMADA (escaneada, PDF) se guarda en un bucket S3 PRIVADO: el servidor la sube y la
// devuelve (nunca un enlace público). Apagado mientras no exista ACTAS_S3_BUCKET (SSM → process.env).
'use strict';

const A = require('./activos');

const TIPOS_ACTA = { entrega: 'Entrega', devolucion: 'Devolución' };
// Fase 379 (I4, diseño de Edwin): actas automáticas por cada movimiento. Las de entrega y devolución también
// se siguen creando a mano (Agentes › Actas); las demás solo salen solas.
const TIPOS_AUTO = { cambio: 'Cambio de elemento', reparacion: 'Envío a reparación', retorno: 'Recibo de reparación', malo: 'Elemento malo', baja: 'Baja' };
const TIPOS_TODOS = Object.assign({}, TIPOS_ACTA, TIPOS_AUTO);
const DIAS_ATRASO = 3; // días hábiles sin firmar
const PDF_MAX_BYTES = 5 * 1024 * 1024;

function crearTablas(db) {
  db.exec(`
CREATE TABLE IF NOT EXISTS activos_actas (
  id INTEGER PRIMARY KEY AUTOINCREMENT, numero INTEGER NOT NULL UNIQUE, tipo TEXT NOT NULL,
  agenteId INTEGER NOT NULL, fecha TEXT NOT NULL, agente TEXT NOT NULL, elementos TEXT NOT NULL,
  quien TEXT NOT NULL DEFAULT '', firmadaKey TEXT, firmadaEn TEXT, firmadaPor TEXT, firmadaBytes INTEGER
);
CREATE INDEX IF NOT EXISTS idx_activos_actas_agente ON activos_actas(agenteId, numero);`);
  // Fase 372 (E4): copia del texto del acta al crearla (el texto se edita en Ajustes; las actas viejas no cambian).
  const cols = db.prepare('PRAGMA table_info(activos_actas)').all().map((c) => c.name);
  if (!cols.includes('texto')) db.exec('ALTER TABLE activos_actas ADD COLUMN texto TEXT');
  // Fase 379 (I4): automáticas (agenteId 0 = sin agente), motivo, técnico y anulación (un acta no se borra).
  for (const [c, def] of [['auto', 'INTEGER NOT NULL DEFAULT 0'], ['motivo', "TEXT NOT NULL DEFAULT ''"], ['tecnico', "TEXT NOT NULL DEFAULT ''"], ['sede', "TEXT NOT NULL DEFAULT ''"],
    ['anuladaEn', 'TEXT'], ['anuladaPor', 'TEXT'], ['anuladaMotivo', 'TEXT']]) if (!cols.includes(c)) db.exec('ALTER TABLE activos_actas ADD COLUMN ' + c + ' ' + def);
}

function _publica(r) {
  if (!r) return null;
  const firmada = r.firmadaKey ? { en: r.firmadaEn, por: r.firmadaPor, bytes: r.firmadaBytes } : null;
  const anulada = r.anuladaEn ? { en: r.anuladaEn, por: r.anuladaPor, motivo: r.anuladaMotivo } : null;
  const estado = anulada ? 'anulada' : firmada ? 'firmada' : 'pendiente';
  return { id: r.id, numero: r.numero, tipo: r.tipo, tipoNombre: TIPOS_TODOS[r.tipo] || r.tipo, agenteId: r.agenteId || null, fecha: r.fecha,
    agente: r.agenteId ? JSON.parse(r.agente) : null, elementos: JSON.parse(r.elementos), quien: r.quien, texto: r.texto || null,
    auto: !!r.auto, motivo: r.motivo || '', tecnico: r.tecnico || '', sede: r.sede || '', firmada, anulada, estado,
    atrasada: estado === 'pendiente' && diasHabiles(r.fecha) >= DIAS_ATRASO };
}
// Días hábiles (lunes a viernes, hora de Colombia) desde la fecha hasta ahora; sin festivos.
function diasHabiles(desdeIso, ahora) {
  const dia = (d) => new Date(new Date(d).getTime() - 5 * 3600 * 1000);
  const a = dia(desdeIso), b = dia(ahora || Date.now());
  let n = 0;
  const x = new Date(Date.UTC(a.getUTCFullYear(), a.getUTCMonth(), a.getUTCDate()));
  const fin = Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate());
  while (x.getTime() < fin && n < 400) { x.setUTCDate(x.getUTCDate() + 1); const w = x.getUTCDay(); if (w !== 0 && w !== 6) n++; }
  return n;
}
function obtener(db, id) { return _publica(db.prepare('SELECT * FROM activos_actas WHERE id = ?').get(id)); }
function deAgente(db, agenteId) { return db.prepare('SELECT * FROM activos_actas WHERE agenteId = ? ORDER BY numero DESC LIMIT 200').all(agenteId).map(_publica); }

// Elementos que puede llevar el acta: entrega = asignados hoy al agente; devolución = los que tuvo
// y ya entregó (con el estado en que quedaron y el motivo).
function candidatos(db, g, tipo) {
  if (tipo === 'entrega') return db.prepare(`SELECT a.id, a.tipo, a.codigo, a.marca, a.modelo, a.serial, s.desde FROM activos_asignaciones s JOIN activos a ON a.id = s.activoId
    WHERE s.agenteId = ? AND s.hasta IS NULL ORDER BY a.tipo, a.codigo`).all(g.id);
  return db.prepare(`SELECT a.id, a.tipo, a.codigo, a.marca, a.modelo, a.serial, a.estado AS queda, s.hasta, s.motivoFin AS motivo FROM activos_asignaciones s JOIN activos a ON a.id = s.activoId
    WHERE s.agenteId = ? AND s.hasta IS NOT NULL AND s.id = (SELECT MAX(id) FROM activos_asignaciones x WHERE x.activoId = s.activoId AND x.agenteId = s.agenteId)
      AND NOT EXISTS (SELECT 1 FROM activos_asignaciones y WHERE y.activoId = s.activoId AND y.agenteId = s.agenteId AND y.hasta IS NULL)
    ORDER BY s.hasta DESC LIMIT 200`).all(g.id);
}

function crear(db, g, tipo, ids, quien) {
  if (!TIPOS_ACTA[tipo]) return { error: 'Tipo de acta no válido' };
  if (!Array.isArray(ids) || !ids.length || ids.length > 50 || !ids.every((x) => Number.isInteger(x) && x > 0)) return { error: 'Elige los elementos del acta' };
  const disponibles = new Map(candidatos(db, g, tipo).map((c) => [c.id, c]));
  const elegidos = [...new Set(ids)].map((x) => disponibles.get(x));
  if (elegidos.some((x) => !x)) return { error: tipo === 'entrega' ? 'Solo elementos que el agente tiene asignados' : 'Solo elementos que el agente ya devolvió' };
  const nombresTipo = Object.fromEntries(A.tipos(db, { todos: true }).map((t) => [t.codigo, t.nombre]));
  const texto = require('./activos-formularios').textoActa(db, tipo); // Fase 372: copia fija
  const elementos = elegidos.map((c) => {
    const e = { tipo: nombresTipo[c.tipo] || c.tipo, codigo: c.codigo, marca: c.marca, modelo: c.modelo, serial: c.serial };
    if (tipo === 'devolucion') { e.queda = (A.ESTADOS.find((s) => s.codigo === c.queda) || {}).nombre || c.queda; e.motivo = c.motivo; }
    return e;
  });
  const agente = { nombre: g.nombre, documento: g.documento, sede: g.sede, operacion: g.operacion };
  let id;
  db.transaction(() => {
    const numero = (db.prepare('SELECT COALESCE(MAX(numero), 0) n FROM activos_actas').get().n) + 1;
    id = Number(db.prepare('INSERT INTO activos_actas (numero, tipo, agenteId, fecha, agente, elementos, quien, texto) VALUES (?,?,?,?,?,?,?,?)')
      .run(numero, tipo, g.id, new Date().toISOString(), JSON.stringify(agente), JSON.stringify(elementos), quien, texto).lastInsertRowid);
  })();
  return { acta: obtener(db, id) };
}

// ── Acta firmada en S3 privado ──
function bucket(env) { const b = (env || process.env).ACTAS_S3_BUCKET; return typeof b === 'string' && /^[a-z0-9][a-z0-9.-]{2,62}$/.test(b.trim()) ? b.trim() : null; }
function _cliente(env) {
  env = env || process.env;
  const { S3Client } = require('@aws-sdk/client-s3');
  return new S3Client({ region: env.AWS_REGION || env.AWS_DEFAULT_REGION || 'us-east-1' });
}
// base64 → Buffer validado (PDF real, hasta 5 MB).
function leerPdf(b64) {
  if (typeof b64 !== 'string' || !b64.length || b64.length > Math.ceil(PDF_MAX_BYTES / 3) * 4 + 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return { error: 'Sube el acta firmada en PDF (hasta 5 MB)' };
  const buf = Buffer.from(b64, 'base64');
  if (buf.length < 64 || buf.length > PDF_MAX_BYTES || buf.subarray(0, 5).toString('latin1') !== '%PDF-') return { error: 'El archivo no es un PDF válido (hasta 5 MB)' };
  return { buf };
}
async function guardarFirmada(db, acta, buf, quien, opts) {
  const env = (opts && opts.env) || process.env;
  const b = bucket(env);
  if (!b) return { error: 'Falta configurar dónde se guardan las actas firmadas (S3). Pídeselo al administrador.', status: 503 };
  const key = 'actas/' + String(acta.numero).padStart(6, '0') + '-' + acta.tipo + '-' + Date.now() + '.pdf';
  const { PutObjectCommand } = require('@aws-sdk/client-s3');
  const cliente = (opts && opts.cliente) || _cliente(env);
  await cliente.send(new PutObjectCommand({ Bucket: b, Key: key, Body: buf, ContentType: 'application/pdf', ServerSideEncryption: 'AES256' }));
  db.prepare('UPDATE activos_actas SET firmadaKey = ?, firmadaEn = ?, firmadaPor = ?, firmadaBytes = ? WHERE id = ?').run(key, new Date().toISOString(), quien, buf.length, acta.id);
  return { acta: obtener(db, acta.id) };
}
async function leerFirmada(db, id, opts) {
  const env = (opts && opts.env) || process.env;
  const fila = db.prepare('SELECT firmadaKey, numero FROM activos_actas WHERE id = ?').get(id);
  if (!fila || !fila.firmadaKey) return { error: 'Esta acta aún no tiene la versión firmada', status: 404 };
  const b = bucket(env);
  if (!b) return { error: 'Falta configurar dónde se guardan las actas firmadas (S3).', status: 503 };
  const { GetObjectCommand } = require('@aws-sdk/client-s3');
  const cliente = (opts && opts.cliente) || _cliente(env);
  const out = await cliente.send(new GetObjectCommand({ Bucket: b, Key: fila.firmadaKey }));
  const buf = Buffer.from(await out.Body.transformToByteArray());
  return { buf, nombre: 'acta-' + fila.numero + '-firmada.pdf' };
}

// ── Fase 379 (I4): actas automáticas ──
// items: [{ a (elemento como lo devuelve activos.obtener, antes del movimiento), dir: 'recibe'|'devuelve'|'', queda }]
function auto(db, { tipo, agente: g, items, motivo, tecnico, quien }) {
  if (!TIPOS_TODOS[tipo] || !items || !items.length) return null;
  const nombresTipo = Object.fromEntries(A.tipos(db, { todos: true }).map((t) => [t.codigo, t.nombre]));
  const estadoN = (c) => (A.ESTADOS.find((s) => s.codigo === c) || {}).nombre || c || '';
  const elementos = items.map((x) => {
    const e = { tipo: nombresTipo[x.a.tipo] || x.a.tipo, codigo: x.a.codigo, marca: x.a.marca, modelo: x.a.modelo, serial: x.a.serial };
    if (x.dir) e.dir = x.dir;
    if (x.queda) e.queda = estadoN(x.queda);
    return e;
  });
  const agente = g ? { nombre: g.nombre, documento: g.documento, sede: g.sede, operacion: g.operacion } : {};
  const texto = require('./activos-formularios').textoActa(db, tipo);
  let id;
  db.transaction(() => {
    const numero = (db.prepare('SELECT COALESCE(MAX(numero), 0) n FROM activos_actas').get().n) + 1;
    id = Number(db.prepare('INSERT INTO activos_actas (numero, tipo, agenteId, fecha, agente, elementos, quien, texto, auto, motivo, tecnico, sede) VALUES (?,?,?,?,?,?,?,?,1,?,?,?)')
      .run(numero, tipo, g ? g.id : 0, new Date().toISOString(), JSON.stringify(agente), JSON.stringify(elementos), quien || '', texto,
        String(motivo || '').slice(0, 300), String(tecnico || '').slice(0, 80), (items[0].a.sede || (g && g.sede) || '')).lastInsertRowid);
  })();
  return obtener(db, id);
}
// Solo los elementos del Inventario de sistemas llevan actas (los inmuebles no).
function llevaActa(db, a) { const t = A.tipo(db, a.tipo, { todos: true }); return !!t && t.ambito !== 'inmuebles'; }
// Acta del cambio de estado (antes = elemento antes del cambio, despues = después). null si no aplica.
function tipoPorEstado(antes, despues) {
  if (despues === 'en_reparacion') return 'reparacion';
  if (despues === 'malo') return 'malo';
  if (despues === 'de_baja') return 'baja';
  if (despues === 'libre' && ['en_reparacion', 'malo'].includes(antes)) return 'retorno';
  if (despues === 'libre' && antes === 'en_uso') return 'devolucion';
  return null;
}
// Lista general con filtros: estado (pendiente, firmada, anulada, atrasada), tipo y búsqueda.
function listar(db, q) {
  const where = [], p = [];
  if (q.tipo && TIPOS_TODOS[q.tipo]) { where.push('tipo = ?'); p.push(q.tipo); }
  if (q.estado === 'firmada') where.push('firmadaKey IS NOT NULL AND anuladaEn IS NULL');
  if (q.estado === 'anulada') where.push('anuladaEn IS NOT NULL');
  if (q.estado === 'pendiente' || q.estado === 'atrasada') where.push('firmadaKey IS NULL AND anuladaEn IS NULL');
  if (q.q) { const t = '%' + String(q.q).slice(0, 60).replace(/[%_]/g, '') + '%'; where.push('(CAST(numero AS TEXT) LIKE ? OR agente LIKE ? OR elementos LIKE ? OR motivo LIKE ? OR tecnico LIKE ?)'); p.push(t, t, t, t, t); }
  let l = db.prepare('SELECT * FROM activos_actas ' + (where.length ? 'WHERE ' + where.join(' AND ') : '') + ' ORDER BY numero DESC LIMIT 1000').all(...p).map(_publica);
  if (q.estado === 'atrasada') l = l.filter((x) => x.atrasada);
  return l;
}
function resumen(db) {
  const todas = db.prepare('SELECT * FROM activos_actas').all().map(_publica);
  return { pendientes: todas.filter((x) => x.estado === 'pendiente').length, firmadas: todas.filter((x) => x.estado === 'firmada').length,
    atrasadas: todas.filter((x) => x.atrasada).length, anuladas: todas.filter((x) => x.estado === 'anulada').length, total: todas.length };
}
// Anular (nunca borrar): con motivo; una firmada no se anula.
function anular(db, acta, motivo, quien) {
  if (acta.anulada) return { error: 'El acta ya está anulada' };
  if (acta.firmada) return { error: 'Un acta firmada no se anula' };
  const m = typeof motivo === 'string' ? motivo.trim().slice(0, 300) : '';
  if (m.length < 3) return { error: 'Escribe el motivo de la anulación' };
  db.prepare('UPDATE activos_actas SET anuladaEn = ?, anuladaPor = ?, anuladaMotivo = ? WHERE id = ?').run(new Date().toISOString(), quien || '', m, acta.id);
  return { acta: obtener(db, acta.id) };
}

module.exports = { TIPOS_AUTO, TIPOS_TODOS, DIAS_ATRASO, diasHabiles, auto, llevaActa, tipoPorEstado, listar, resumen, anular, TIPOS_ACTA, PDF_MAX_BYTES, crearTablas, obtener, deAgente, candidatos, crear, bucket, leerPdf, guardarFirmada, leerFirmada };
