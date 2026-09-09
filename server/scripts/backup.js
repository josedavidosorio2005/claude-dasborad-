#!/usr/bin/env node
// scripts/backup.js — Copia de seguridad del archivo SQLite.
//
// Uso:
//   node scripts/backup.js                 -> copia a <BACKUP_DIR>/inconexion-<timestamp>.db
//   node scripts/backup.js --keep 14       -> ademas borra backups mas alla de los 14 mas recientes
//   BACKUP_DIR=/ruta/backups node scripts/backup.js
//
// Pensado para cron, por ejemplo (todos los dias a las 03:00, reteniendo 14):
//   0 3 * * * cd /app && node scripts/backup.js --keep 14 >> /var/log/inconexion-backup.log 2>&1
//
// Usa la API de backup online de better-sqlite3: es consistente aunque el
// servidor este escribiendo en ese momento (no hace falta detener la app).
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

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
