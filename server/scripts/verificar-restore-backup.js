#!/usr/bin/env node
// scripts/verificar-restore-backup.js — Fase 72 (auditoria de seguridad):
// nunca se habia probado una RESTAURACION real de un backup, solo que la
// copia se subiera a S3 (ver docs/auditoria-seguridad-fase72.md, seccion
// "Backups"). Este script:
//   1. Lista los backups en S3 (mismo bucket/prefijo que scripts/backup.js)
//      y toma el mas reciente por nombre (timestamp en el nombre del archivo).
//   2. Lo descarga a un archivo TEMPORAL (nunca sobre la base real).
//   3. Lo abre con better-sqlite3 en modo readonly y corre PRAGMA
//      integrity_check + unos conteos de sanity-check.
//   4. Borra el archivo temporal.
//
// Fase 114 (--local): a veces lo que hace falta verificar es el respaldo
// LOCAL recien generado (antes incluso de que exista copia en S3, o para no
// depender de permisos de S3 que todavia no estan listos -- ver
// docs/pendientes.md, Politica 1 de IAM). `--local <ruta>` se salta el
// listado/descarga de S3 y corre EXACTAMENTE la misma verificacion
// (integrity_check + conteos) contra un archivo que ya esta en el disco del
// servidor -- nunca lo mueve ni lo copia fuera de ahi, lo abre readonly en
// su propia ruta.
//
// Nunca escribe en S3, nunca toca inconexion.db (la base real que usa el
// servidor) ni la reemplaza -- es una verificacion de que "el backup mas
// reciente SIRVE", no un restore real contra produccion.
//
// Fase 97 (el repo es publico: esta salida queda en el log de GitHub
// Actions, ver verificar-restore-backup-produccion.yml / respaldo-produccion.yml):
// todo lo que se imprime aqui es SOLO nombre de archivo (timestamp, sin
// datos), fecha, tamano en KiB, el resultado de integrity_check ('ok'/otro) y
// CONTEOS de filas (nunca una fila real) -- si se agrega un console.log
// nuevo a este script, nunca debe imprimir un valor de columna real (nombre,
// correo, telefono, texto libre de un monitoreo, etc.), solo metadatos/conteos.
//
// Uso:
//   docker compose exec -T app node scripts/verificar-restore-backup.js
//   docker compose exec -T app node scripts/verificar-restore-backup.js --local /app/server/data/backups/inconexion-<ts>.db
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');

// Conteos de sanity-check: tablas con datos reales de ORLANT (Fase 114 amplia
// la lista original de Fase 72 -- usuarios/cargas/monitoreos -- a las
// pestañas con datos reales cargados desde las Fases 98-111). Una tabla que
// no exista todavia en un backup viejo simplemente se reporta en 0 (CREATE
// TABLE IF NOT EXISTS ya corrio al abrir con la app real antes de respaldar).
const TABLAS_SANITY = [
  'users',
  'dashboard_cargas',
  'monitoreos',
  'tipificaciones',
  'agendas',
  'inasistencias',
  'efectividad_agendamiento',
  'efectividad_citas',
];

function contarTablas(db) {
  const conteos = {};
  for (const tabla of TABLAS_SANITY) {
    try {
      conteos[tabla] = db.prepare(`SELECT COUNT(*) AS c FROM ${tabla}`).get().c;
    } catch (e) {
      conteos[tabla] = null; // tabla no existe en este backup -- no es un error
    }
  }
  return conteos;
}

function verificarArchivo(rutaDb) {
  const db = new Database(rutaDb, { readonly: true });
  try {
    const integridad = db.pragma('integrity_check', { simple: true });
    const conteos = contarTablas(db);

    console.log(`[verificar-restore] integrity_check: ${integridad}`);
    for (const tabla of TABLAS_SANITY) {
      console.log(`[verificar-restore] ${tabla}: ${conteos[tabla] === null ? 'sin-tabla' : conteos[tabla]}`);
    }

    if (integridad !== 'ok') {
      console.error('[verificar-restore] FALLO: integrity_check no devolvio "ok".');
      process.exitCode = 1;
      return;
    }
    if (!conteos.users || conteos.users < 1) {
      console.error('[verificar-restore] FALLO: la tabla users esta vacia -- el backup no parece un restore usable.');
      process.exitCode = 1;
      return;
    }
    console.log('[verificar-restore] OK: el backup abre, pasa integrity_check y tiene datos reales.');
  } finally {
    db.close();
  }
}

async function uploadModeS3() {
  const bucket = process.env.BACKUP_S3_BUCKET;
  if (!bucket) {
    console.error('[verificar-restore] BACKUP_S3_BUCKET no esta definido -- nada que verificar.');
    process.exitCode = 1;
    return;
  }
  const prefix = (process.env.BACKUP_S3_PREFIX || 'db-backups').replace(/^\/+|\/+$/g, '');
  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';

  const { S3Client, ListObjectsV2Command, GetObjectCommand } = require('@aws-sdk/client-s3');
  const client = new S3Client({ region });

  console.log(`[verificar-restore] Listando s3://${bucket}/${prefix}/ ...`);
  const listado = await client.send(
    new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix + '/' })
  );
  const objetos = (listado.Contents || []).filter((o) => /inconexion-\d{8}-\d{6}\.db$/.test(o.Key));
  if (!objetos.length) {
    console.error('[verificar-restore] No se encontro ningun backup en S3 con el nombre esperado.');
    process.exitCode = 1;
    return;
  }
  objetos.sort((a, b) => (a.Key < b.Key ? 1 : -1)); // nombre = timestamp -> el mas reciente primero
  const masReciente = objetos[0];
  console.log(`[verificar-restore] Backup mas reciente: ${masReciente.Key} (${masReciente.LastModified}, ${(masReciente.Size / 1024).toFixed(1)} KiB)`);

  const destino = path.join(os.tmpdir(), 'verificar-restore-' + Date.now() + '.db');
  const obj = await client.send(new GetObjectCommand({ Bucket: bucket, Key: masReciente.Key }));
  await new Promise((resolve, reject) => {
    const out = fs.createWriteStream(destino);
    obj.Body.pipe(out);
    obj.Body.on('error', reject);
    out.on('finish', resolve);
    out.on('error', reject);
  });

  try {
    verificarArchivo(destino);
  } finally {
    fs.unlinkSync(destino);
  }
}

async function modoLocal(rutaLocal) {
  if (!fs.existsSync(rutaLocal)) {
    console.error(`[verificar-restore] No existe el archivo: ${rutaLocal}`);
    process.exitCode = 1;
    return;
  }
  const { size, mtime } = fs.statSync(rutaLocal);
  console.log(`[verificar-restore] Backup local: ${mtime.toISOString()} (${(size / 1024).toFixed(1)} KiB)`);
  verificarArchivo(rutaLocal);
}

async function main() {
  const argv = process.argv.slice(2);
  const idxLocal = argv.indexOf('--local');
  if (idxLocal !== -1) {
    const ruta = argv[idxLocal + 1];
    if (!ruta) {
      console.error('[verificar-restore] --local requiere una ruta de archivo.');
      process.exitCode = 1;
      return;
    }
    await modoLocal(ruta);
    return;
  }
  await uploadModeS3();
}

main().catch((err) => {
  console.error('[verificar-restore] ERROR:', err && err.stack ? err.stack : err);
  process.exitCode = 1;
});
