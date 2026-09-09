#!/usr/bin/env node
// scripts/backup.js — Copia de seguridad del archivo SQLite.
//
// Uso:
//   node scripts/backup.js                 -> copia a <BACKUP_DIR>/inconexion-<timestamp>.db
//   node scripts/backup.js --keep 14       -> ademas borra backups mas alla de los 14 mas recientes
//   BACKUP_DIR=/ruta/backups node scripts/backup.js
//
// Subida a S3 (Fase B5): si BACKUP_S3_BUCKET esta definido, ademas de la copia
// local sube el respaldo a  s3://$BACKUP_S3_BUCKET/$BACKUP_S3_PREFIX/inconexion-<ts>.db
// (el bucket debe tener versionado activado). Usa el rol IAM de la instancia.
//
// Pensado para systemd timer o cron, por ejemplo (todos los dias a las 03:00,
// reteniendo 14 locales):
//   0 3 * * * cd /app/server && node scripts/backup.js --keep 14 >> /var/log/inconexion-backup.log 2>&1
//
// Usa la API de backup online de better-sqlite3: es consistente aunque el
// servidor este escribiendo en ese momento (no hace falta detener la app).
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

async function uploadToS3(filePath) {
  const bucket = process.env.BACKUP_S3_BUCKET;
  if (!bucket) return null;
  let S3Client, PutObjectCommand;
  try {
    ({ S3Client, PutObjectCommand } = require('@aws-sdk/client-s3'));
  } catch (e) {
    console.error('[backup] BACKUP_S3_BUCKET definido pero @aws-sdk/client-s3 no esta instalado.');
    process.exit(1);
  }
  const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
  const prefix = (process.env.BACKUP_S3_PREFIX || 'db-backups').replace(/^\/+|\/+$/g, '');
  const key = `${prefix}/${path.basename(filePath)}`;
  const client = new S3Client({ region });
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: fs.createReadStream(filePath),
      ContentType: 'application/x-sqlite3',
    })
  );
  return `s3://${bucket}/${key}`;
}

function parseArgs(argv) {
  const args = { keep: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--keep') {
      args.keep = parseInt(argv[++i], 10);
      if (!Number.isInteger(args.keep) || args.keep < 1) {
        console.error('--keep requiere un entero >= 1');
        process.exit(1);
      }
    }
  }
  return args;
}

function timestamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

async function main() {
  const args = parseArgs(process.argv);

  const dbPath =
    process.env.DB_PATH || path.join(__dirname, '..', 'data', 'inconexion.db');
  const backupDir =
    process.env.BACKUP_DIR || path.join(path.dirname(dbPath), 'backups');

  if (!fs.existsSync(dbPath)) {
    console.error(`[backup] No existe la base de datos en: ${dbPath}`);
    process.exit(1);
  }

  fs.mkdirSync(backupDir, { recursive: true });
  const dest = path.join(backupDir, `inconexion-${timestamp()}.db`);

  const db = new Database(dbPath, { readonly: true });
  try {
    await db.backup(dest);
  } finally {
    db.close();
  }

  const { size } = fs.statSync(dest);
  console.log(`[backup] OK -> ${dest} (${(size / 1024).toFixed(1)} KiB)`);

  try {
    const s3uri = await uploadToS3(dest);
    if (s3uri) console.log(`[backup] Subido a ${s3uri}`);
  } catch (err) {
    console.error(`[backup] Fallo la subida a S3: ${err.message}`);
    process.exitCode = 2; // la copia local si quedo; señalamos el fallo de S3
  }

  if (args.keep) {
    const files = fs
      .readdirSync(backupDir)
      .filter((f) => /^inconexion-\d{8}-\d{6}\.db$/.test(f))
      .sort()
      .reverse();
    const toDelete = files.slice(args.keep);
    for (const f of toDelete) {
      fs.unlinkSync(path.join(backupDir, f));
      console.log(`[backup] retencion: borrado ${f}`);
    }
  }
}

main().catch((err) => {
  console.error('[backup] Fallo:', err.message);
  process.exit(1);
});
