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
// Nunca escribe en S3, nunca toca inconexion.db (la base real que usa el
// servidor) ni la reemplaza -- es una verificacion de que "el backup mas
// reciente SIRVE", no un restore real contra produccion.
//
// Uso:  docker compose exec -T app node scripts/verificar-restore-backup.js
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');

async function main() {
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
    const db = new Database(destino, { readonly: true });
    try {
      const integridad = db.pragma('integrity_check', { simple: true });
      const usuarios = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
      const cargas = db.prepare('SELECT COUNT(*) AS c FROM dashboard_cargas').get().c;
      const monitoreos = db.prepare('SELECT COUNT(*) AS c FROM monitoreos').get().c;

      console.log(`[verificar-restore] integrity_check: ${integridad}`);
      console.log(`[verificar-restore] users: ${usuarios}, dashboard_cargas: ${cargas}, monitoreos: ${monitoreos}`);

      if (integridad !== 'ok') {
        console.error('[verificar-restore] FALLO: integrity_check no devolvio "ok".');
        process.exitCode = 1;
        return;
      }
      if (usuarios < 1) {
        console.error('[verificar-restore] FALLO: la tabla users esta vacia -- el backup no parece un restore usable.');
        process.exitCode = 1;
        return;
      }
      console.log('[verificar-restore] OK: el backup mas reciente abre, pasa integrity_check y tiene datos reales.');
    } finally {
      db.close();
    }
  } finally {
    fs.unlinkSync(destino);
  }
}

main().catch((err) => {
  console.error('[verificar-restore] ERROR:', err && err.stack ? err.stack : err);
  process.exitCode = 1;
});
