// gh-archivos.js — Fase GH3 (plan de Gestión humana): los soportes adjuntos de «Talento humano»
// (incapacidades, licencias, retiros…) se guardan en un bucket S3 PRIVADO, como las actas firmadas
// (activos-actas.js): el servidor sube y entrega el archivo, nunca un enlace público. La base solo
// guarda quién, cuándo, el nombre y dónde está; la clave en S3 no lleva el nombre del archivo.
//
// Apagado mientras no exista GH_SOPORTES_S3_BUCKET (SSM → process.env): subir responde 503.
// Borrar = se marca como borrado y no se vuelve a entregar; el objeto queda en S3 (el permiso del
// servidor no incluye s3:DeleteObject, igual que en las actas).
'use strict';

const MAX_BYTES = 8 * 1024 * 1024; // el mismo tope de la app de Edwin (MAXF)
const PREFIJO = 'talento-humano/soportes/';

function crearTablas(db) {
  db.exec(`
CREATE TABLE IF NOT EXISTS gh_archivos (
  id TEXT PRIMARY KEY,
  empId TEXT NOT NULL DEFAULT '',
  nombre TEXT NOT NULL,
  tipo TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  s3Key TEXT NOT NULL,
  subidoPor TEXT NOT NULL DEFAULT '',
  subidoAt TEXT NOT NULL,
  borradoPor TEXT,
  borradoAt TEXT
);
`);
}

function bucket(env) {
  const b = (env || process.env).GH_SOPORTES_S3_BUCKET;
  return typeof b === 'string' && /^[a-z0-9][a-z0-9.-]{2,62}$/.test(b.trim()) ? b.trim() : null;
}
function _cliente(env) {
  env = env || process.env;
  const { S3Client } = require('@aws-sdk/client-s3');
  return new S3Client({ region: env.AWS_REGION || env.AWS_DEFAULT_REGION || 'us-east-1' });
}

// Tipo por la FIRMA del contenido (no por la extensión ni lo que diga el navegador).
const TIPOS = [
  { ext: 'pdf', mime: 'application/pdf', es: (b) => b.subarray(0, 5).toString('latin1') === '%PDF-' },
  { ext: 'png', mime: 'image/png', es: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { ext: 'jpg', mime: 'image/jpeg', es: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: 'webp', mime: 'image/webp', es: (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP' },
  { ext: 'docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', es: (b) => b.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])) },
  { ext: 'doc', mime: 'application/msword', es: (b) => b.subarray(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) },
];
function tipoDe(buf) { return TIPOS.find((t) => buf.length >= 12 && t.es(buf)) || null; }

const idValido = (v) => typeof v === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(v);
function limpiarNombre(n) {
  const s = String(n || '').replace(/[\u0000-\u001f\u007f<>"\\/|?*:]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 150);
  return s || 'soporte';
}

// Valida el cuerpo { id, empId, nombre, base64 } → { buf, tipo } o { error }.
function leer(b) {
  b = b || {};
  if (!idValido(b.id)) return { error: 'Identificador de archivo no válido' };
  if (b.empId !== undefined && b.empId !== null && !idValido(String(b.empId))) return { error: 'Empleado no válido' };
  const b64 = b.base64;
  if (typeof b64 !== 'string' || !b64.length || b64.length > Math.ceil(MAX_BYTES / 3) * 4 + 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) return { error: 'El archivo no es válido (hasta 8 MB)', status: 400 };
  const buf = Buffer.from(b64, 'base64');
  if (buf.length > MAX_BYTES) return { error: 'El archivo supera 8 MB', status: 413 };
  const tipo = tipoDe(buf);
  if (!tipo) return { error: 'Solo PDF, imagen (JPG, PNG, WEBP) o Word (DOC, DOCX)' };
  return { buf, tipo };
}

async function subir(db, cuerpo, quien, opts) {
  const env = (opts && opts.env) || process.env;
  const b = bucket(env);
  if (!b) return { status: 503, error: 'Falta configurar dónde se guardan los soportes (S3). Pídeselo al administrador.' };
  const r = leer(cuerpo);
  if (r.error) return { status: r.status || 400, error: r.error };
  const ya = db.prepare('SELECT id, borradoAt FROM gh_archivos WHERE id = ?').get(cuerpo.id);
  if (ya && !ya.borradoAt) return { status: 200, archivo: meta(db, cuerpo.id), yaExistia: true }; // p. ej. al restaurar una copia
  if (ya) return { status: 409, error: 'Ese soporte se borró; súbelo de nuevo como un archivo nuevo' };
  const key = PREFIJO + cuerpo.id + '-' + Date.now() + '.' + r.tipo.ext;
  const { PutObjectCommand } = require('@aws-sdk/client-s3');
  const cliente = (opts && opts.cliente) || _cliente(env);
  await cliente.send(new PutObjectCommand({ Bucket: b, Key: key, Body: r.buf, ContentType: r.tipo.mime, ServerSideEncryption: 'AES256' }));
  const ahora = new Date().toISOString();
  db.prepare('INSERT INTO gh_archivos (id, empId, nombre, tipo, bytes, s3Key, subidoPor, subidoAt) VALUES (?,?,?,?,?,?,?,?)')
    .run(cuerpo.id, cuerpo.empId ? String(cuerpo.empId) : '', limpiarNombre(cuerpo.nombre), r.tipo.mime, r.buf.length, key, quien || '', ahora);
  db.prepare('INSERT INTO gh_bitacora (clave, version, usuario, fecha, bytes, elementos) VALUES (?,?,?,?,?,?)').run('soporte:subido', 0, quien || '', ahora, r.buf.length, null);
  return { status: 201, archivo: meta(db, cuerpo.id) };
}

function meta(db, id) {
  const f = db.prepare('SELECT id, empId, nombre, tipo, bytes, subidoAt FROM gh_archivos WHERE id = ? AND borradoAt IS NULL').get(id);
  return f ? { id: f.id, empId: f.empId, name: f.nombre, type: f.tipo, size: f.bytes, subidoAt: f.subidoAt } : null;
}

async function leerArchivo(db, id, opts) {
  const env = (opts && opts.env) || process.env;
  if (!idValido(id)) return { status: 400, error: 'Identificador de archivo no válido' };
  const f = db.prepare('SELECT * FROM gh_archivos WHERE id = ? AND borradoAt IS NULL').get(id);
  if (!f) return { status: 404, error: 'No se encontró el soporte' };
  const b = bucket(env);
  if (!b) return { status: 503, error: 'Falta configurar dónde se guardan los soportes (S3).' };
  const { GetObjectCommand } = require('@aws-sdk/client-s3');
  const cliente = (opts && opts.cliente) || _cliente(env);
  const out = await cliente.send(new GetObjectCommand({ Bucket: b, Key: f.s3Key }));
  const buf = Buffer.from(await out.Body.transformToByteArray());
  return { status: 200, archivo: Object.assign(meta(db, id), { base64: buf.toString('base64') }) };
}

function borrar(db, id, quien) {
  if (!idValido(id)) return { status: 400, error: 'Identificador de archivo no válido' };
  const f = db.prepare('SELECT id, borradoAt FROM gh_archivos WHERE id = ?').get(id);
  if (!f || f.borradoAt) return { status: 200, borrado: false }; // ya no está: nada que hacer (la app borra sin preguntar)
  const ahora = new Date().toISOString();
  db.prepare('UPDATE gh_archivos SET borradoPor = ?, borradoAt = ? WHERE id = ?').run(quien || '', ahora, id);
  db.prepare('INSERT INTO gh_bitacora (clave, version, usuario, fecha, bytes, elementos) VALUES (?,?,?,?,?,?)').run('soporte:borrado', 0, quien || '', ahora, 0, null);
  return { status: 200, borrado: true };
}

module.exports = { MAX_BYTES, PREFIJO, TIPOS, crearTablas, bucket, tipoDe, leer, subir, meta, leerArchivo, borrar, limpiarNombre };
