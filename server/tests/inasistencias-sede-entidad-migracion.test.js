// inasistencias-sede-entidad-migracion.test.js — prueba la migracion
// `inasistencias_sede_entidad_v1` (server/db.js, Fase 108, pedido textual
// de InCo: "que se pueda filtrar por sede, especialidad, nombre entidad"):
// recrea la tabla `inasistencias` agregando sede/entidad (UNIQUE nuevo
// campana+mes+sede+especialidad+entidad), conservando las filas YA
// CARGADAS con el formato viejo (Fase 98-106, sin sede/entidad real) con
// sede='SIN DATO'/entidad='SIN DATO' -- no se pierde nada. Mismo patron
// que los demas tests de migracion de este repo: sembrar la tabla en la
// forma VIEJA a mano *antes* de requerir db.js, y verificar "despues".
'use strict';

const os = require('os');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const tmpDb = path.join(os.tmpdir(), `inconexion-inasist-sede-entidad-${process.pid}-${crypto.randomBytes(6).toString('hex')}.db`);

// Forma VIEJA (Fase 98-106): sin sede/entidad, UNIQUE(campana,mes,especialidad).
const pre = new Database(tmpDb);
pre.exec(`
  CREATE TABLE inasistencias (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campana TEXT NOT NULL,
    mes TEXT NOT NULL,
    especialidad TEXT NOT NULL,
    cancelada INTEGER NOT NULL,
    inasistencia INTEGER NOT NULL,
    pendiente INTEGER NOT NULL,
    atendidas INTEGER NOT NULL,
    total INTEGER NOT NULL,
    archivoNombre TEXT NOT NULL DEFAULT '',
    cargadoPorNombre TEXT NOT NULL DEFAULT '',
    createdAt TEXT NOT NULL,
    UNIQUE(campana, mes, especialidad)
  );
`);
const now = '01/10/2026 10:00:00';
pre.prepare(
  `INSERT INTO inasistencias (campana, mes, especialidad, cancelada, inasistencia, pendiente, atendidas, total, archivoNombre, cargadoPorNombre, createdAt)
   VALUES (?,?,?,?,?,?,?,?,?,?,?)`
).run('ORLANT', '2026-08', 'AUDIFONOS', 475, 109, 10, 2270, 2864, 'INASISTENCIA.xlsx', 'Edwin', now);
pre.prepare(
  `INSERT INTO inasistencias (campana, mes, especialidad, cancelada, inasistencia, pendiente, atendidas, total, archivoNombre, cargadoPorNombre, createdAt)
   VALUES (?,?,?,?,?,?,?,?,?,?,?)`
).run('ORLANT', '2026-09', 'EXAMENES ESPECIALES', 452, 94, 2, 935, 1483, 'INASISTENCIA.xlsx', 'Edwin', now);
pre.close();

function setEnvDefault(key, value) {
  if (process.env[key] === undefined || process.env[key] === '') process.env[key] = value;
}
setEnvDefault('NODE_ENV', 'test');
setEnvDefault('JWT_SECRET', crypto.randomBytes(48).toString('hex'));
setEnvDefault('JWT_EXPIRES_IN', '1h');
setEnvDefault('MASTER_ADMIN_USER', 'admin');
setEnvDefault('MASTER_ADMIN_PASSWORD_HASH', bcrypt.hashSync('NoUsadaEnEsteTest#1', 10));
setEnvDefault('DB_PATH', tmpDb);
setEnvDefault('TRUST_PROXY', 'false');
setEnvDefault('RATE_LIMIT_MAX', '10000');
setEnvDefault('LOGIN_RATE_LIMIT_MAX', '10000');

const db = require('../db');

test('migracion inasistencias_sede_entidad_v1: las filas viejas quedan con sede/entidad = "SIN DATO", el resto intacto', () => {
  const filas = db.prepare('SELECT * FROM inasistencias ORDER BY mes ASC').all();
  assert.equal(filas.length, 2);
  filas.forEach((f) => {
    assert.equal(f.sede, 'SIN DATO');
    assert.equal(f.entidad, 'SIN DATO');
  });
  assert.equal(filas[0].mes, '2026-08');
  assert.equal(filas[0].especialidad, 'AUDIFONOS');
  assert.equal(filas[0].total, 2864);
  assert.equal(filas[0].cancelada + filas[0].inasistencia + filas[0].pendiente + filas[0].atendidas, 2864);
  assert.equal(filas[0].archivoNombre, 'INASISTENCIA.xlsx');
  assert.equal(filas[0].cargadoPorNombre, 'Edwin');
  assert.equal(filas[1].mes, '2026-09');
  assert.equal(filas[1].total, 1483);
});

test('migracion inasistencias_sede_entidad_v1: el UNIQUE nuevo incluye sede/entidad -- 2 filas del mismo campana/mes/especialidad con entidad distinta ya no chocan', () => {
  const now2 = new Date().toISOString();
  const insert = db.prepare(
    `INSERT INTO inasistencias (campana, mes, sede, especialidad, entidad, cancelada, inasistencia, pendiente, atendidas, total, archivoNombre, cargadoPorNombre, createdAt)
     VALUES (@campana,@mes,@sede,@especialidad,@entidad,@cancelada,@inasistencia,@pendiente,@atendidas,@total,@archivoNombre,@cargadoPorNombre,@createdAt)`
  );
  insert.run({ campana: 'ORLANT', mes: '2026-10', sede: 'SEDE PRINCIPAL', especialidad: 'AUDIOLOGIA', entidad: 'EPS UNO', cancelada: 0, inasistencia: 1, pendiente: 0, atendidas: 9, total: 10, archivoNombre: '', cargadoPorNombre: '', createdAt: now2 });
  insert.run({ campana: 'ORLANT', mes: '2026-10', sede: 'SEDE PRINCIPAL', especialidad: 'AUDIOLOGIA', entidad: 'EPS DOS', cancelada: 0, inasistencia: 1, pendiente: 0, atendidas: 9, total: 10, archivoNombre: '', cargadoPorNombre: '', createdAt: now2 });
  const filas = db.prepare("SELECT * FROM inasistencias WHERE campana='ORLANT' AND mes='2026-10'").all();
  assert.equal(filas.length, 2, 'misma sede/especialidad, entidad distinta -- 2 filas validas, no un conflicto de UNIQUE');

  assert.throws(() => insert.run({ campana: 'ORLANT', mes: '2026-10', sede: 'SEDE PRINCIPAL', especialidad: 'AUDIOLOGIA', entidad: 'EPS UNO', cancelada: 0, inasistencia: 1, pendiente: 0, atendidas: 9, total: 10, archivoNombre: '', cargadoPorNombre: '', createdAt: now2 }),
    'misma (campana,mes,sede,especialidad,entidad) exacta SI debe chocar con el UNIQUE');
});

test('migracion inasistencias_sede_entidad_v1: es idempotente -- correrla dos veces seguidas (reabriendo la base) da el mismo resultado', () => {
  const antes = db.prepare('SELECT * FROM inasistencias ORDER BY id ASC').all();

  delete require.cache[require.resolve('../db')];
  const db2 = require('../db');
  const despues = db2.prepare('SELECT * FROM inasistencias ORDER BY id ASC').all();
  assert.deepEqual(antes, despues, 'reabrir la base (segunda corrida real de todas las migraciones) da el mismo resultado');

  const cols = db2.prepare('PRAGMA table_info(inasistencias)').all().map((c) => c.name);
  assert.ok(cols.includes('sede') && cols.includes('entidad'));
});

test.after(() => {
  try { db.closeDb(); } catch (e) {}
  try { fs.unlinkSync(tmpDb); } catch (e) {}
});
