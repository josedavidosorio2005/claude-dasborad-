// fase151-restore-local.test.js — Fase 151: verificar-restore-backup.js
// --local-ultimo verifica la copia local mas reciente sin tocar la carpeta
// de respaldos y sin imprimir nombres de archivo.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const Database = require('better-sqlite3');

const SCRIPT = path.join(__dirname, '..', 'scripts', 'verificar-restore-backup.js');

function correr(dir) {
  return spawnSync(process.execPath, [SCRIPT, '--local-ultimo'], {
    env: { ...process.env, BACKUP_DIR: dir },
    encoding: 'utf8',
  });
}

test('--local-ultimo: verifica la mas reciente, no deja archivos de mas y no imprime nombres', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'f151-restore-'));
  try {
    for (const [ts, filas] of [['2026-10-14T00-00-00', 1], ['2026-10-15T00-00-00', 3]]) {
      const db = new Database(path.join(dir, `inconexion-${ts}.db`));
      db.exec('CREATE TABLE users (id INTEGER PRIMARY KEY, nombre TEXT)');
      for (let i = 0; i < filas; i++) db.prepare('INSERT INTO users (nombre) VALUES (?)').run('Sintetico ' + i);
      db.close();
    }
    const antes = fs.readdirSync(dir).sort();
    const r = correr(dir);
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stdout, /Respaldos locales: 2/);
    assert.match(r.stdout, /integrity_check: ok/);
    assert.match(r.stdout, /users: 3/, 'toma la copia mas reciente');
    assert.doesNotMatch(r.stdout + r.stderr, /inconexion-2026|Sintetico/);
    assert.deepEqual(fs.readdirSync(dir).sort(), antes, 'la carpeta de respaldos queda igual');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('--local-ultimo sin respaldos: falla con un mensaje sin rutas', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'f151-restore-vacio-'));
  try {
    const r = correr(dir);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /No se encontro ningun respaldo local/);
    assert.ok(!r.stderr.includes(dir));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
