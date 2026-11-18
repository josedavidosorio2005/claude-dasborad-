// activos-actas.js — Fase 371 (pedido de Edwin 18/11, E3): actas del «Inventario de sistemas».
// Un acta de ENTREGA (elementos que el agente tiene asignados) o de DEVOLUCIÓN (elementos que ya
// entregó) guarda una copia fija de los datos (agente y elementos) con un número consecutivo. El PDF
// se arma en el navegador (imprimir → «Guardar como PDF»), igual que el reporte PDF de la Fase 355.
// El acta FIRMADA (escaneada, PDF) se guarda en un bucket S3 PRIVADO: el servidor la sube y la
// devuelve (nunca un enlace público). Apagado mientras no exista ACTAS_S3_BUCKET (SSM → process.env).
'use strict';

const A = require('./activos');

const TIPOS_ACTA = { entrega: 'Entrega', devolucion: 'Devolución' };
const PDF_MAX_BYTES = 5 * 1024 * 1024;

function crearTablas(db) {
  db.exec(`
CREATE TABLE IF NOT EXISTS activos_actas (
  id INTEGER PRIMARY KEY AUTOINCREMENT, numero INTEGER NOT NULL UNIQUE, tipo TEXT NOT NULL,
  agenteId INTEGER NOT NULL, fecha TEXT NOT NULL, agente TEXT NOT NULL, elementos TEXT NOT NULL,
  quien TEXT NOT NULL DEFAULT '', firmadaKey TEXT, firmadaEn TEXT, firmadaPor TEXT, firmadaBytes INTEGER
);
CREATE INDEX IF NOT EXISTS idx_activos_actas_agente ON activos_actas(agenteId, numero);`);
}

function _publica(r) {
  if (!r) return null;
  return { id: r.id, numero: r.numero, tipo: r.tipo, tipoNombre: TIPOS_ACTA[r.tipo] || r.tipo, agenteId: r.agenteId, fecha: r.fecha,
    agente: JSON.parse(r.agente), elementos: JSON.parse(r.elementos), quien: r.quien,
    firmada: r.firmadaKey ? { en: r.firmadaEn, por: r.firmadaPor, bytes: r.firmadaBytes } : null };
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
  const nombresTipo = Object.fromEntries(A.tipos(db).map((t) => [t.codigo, t.nombre]));
  const elementos = elegidos.map((c) => {
    const e = { tipo: nombresTipo[c.tipo] || c.tipo, codigo: c.codigo, marca: c.marca, modelo: c.modelo, serial: c.serial };
    if (tipo === 'devolucion') { e.queda = (A.ESTADOS.find((s) => s.codigo === c.queda) || {}).nombre || c.queda; e.motivo = c.motivo; }
    return e;
  });
  const agente = { nombre: g.nombre, documento: g.documento, sede: g.sede, operacion: g.operacion };
  let id;
  db.transaction(() => {
    const numero = (db.prepare('SELECT COALESCE(MAX(numero), 0) n FROM activos_actas').get().n) + 1;
    id = Number(db.prepare('INSERT INTO activos_actas (numero, tipo, agenteId, fecha, agente, elementos, quien) VALUES (?,?,?,?,?,?,?)')
      .run(numero, tipo, g.id, new Date().toISOString(), JSON.stringify(agente), JSON.stringify(elementos), quien).lastInsertRowid);
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

module.exports = { TIPOS_ACTA, PDF_MAX_BYTES, crearTablas, obtener, deAgente, candidatos, crear, bucket, leerPdf, guardarFirmada, leerFirmada };
