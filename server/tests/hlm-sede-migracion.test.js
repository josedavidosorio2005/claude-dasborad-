// hlm-sede-migracion.test.js — prueba la migracion `hlm_sede_consolidacion_v1`
// (server/db.js) contra un archivo SQLite que simula el estado de PRODUCCION
// ANTES del cambio: 2 campanas falsas ("HOSPITAL LA MARIA CASTILLA" /
// "...SEDE33") en vez de una campana + sede como atributo. Pedido explicito
// de Edwin: nunca perder historico, solo re-etiquetar — este test construye
// el escenario "antes" a mano (con el esquema viejo real, no inventado) y
// verifica que "despues" de requerir db.js (que corre la migracion al
// arrancar) los mismos datos siguen ahi, con los MISMOS puntajes/numeros,
// solo con campana unificada + sede.
//
// A diferencia del resto de tests (que usan ./helpers, con una BD vacia ya
// migrada), este NO puede usar ese helper: necesita sembrar el esquema VIEJO
// *antes* de que db.js corra sus migraciones. node --test corre cada
// archivo en su propio proceso, asi que fijar env vars propias aqui no
// interfiere con los demas archivos de test.
'use strict';

const os = require('os');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const tmpDb = path.join(os.tmpdir(), `inconexion-hlm-migracion-${process.pid}-${crypto.randomBytes(6).toString('hex')}.db`);

// ── 1) Sembrar el esquema VIEJO (real, tal cual estaba antes de esta fase) ──
const pre = new Database(tmpDb);
pre.exec(`
  CREATE TABLE calidad_nivel_servicio (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campana TEXT NOT NULL,
    mes TEXT NOT NULL,
    contestadas20s INTEGER NOT NULL DEFAULT 0,
    llamadasTotales INTEGER NOT NULL DEFAULT 0,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    UNIQUE(campana, mes)
  );
  CREATE TABLE calidad_nivel_servicio_diario (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campana TEXT NOT NULL,
    fecha TEXT NOT NULL,
    skillName TEXT NOT NULL,
    totalLlamadas INTEGER NOT NULL DEFAULT 0,
    contestadas INTEGER NOT NULL DEFAULT 0,
    serviceLevel20secPct REAL,
    contestadas20sEstimado INTEGER,
    archivoNombre TEXT NOT NULL DEFAULT '',
    cargadoPorNombre TEXT NOT NULL DEFAULT '',
    createdAt TEXT NOT NULL,
    UNIQUE(campana, fecha, skillName)
  );
  CREATE TABLE trafico_skill_mapeo (
    skillName TEXT PRIMARY KEY,
    campana TEXT,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );
`);

const SKILL_CASTILLA = 'SKILL PROD CASTILLA';
const SKILL_SEDE33 = 'SKILL PROD SEDE33';
const now = '15/09/2026 10:00:00';

pre.prepare(
  `INSERT INTO calidad_nivel_servicio_diario
     (campana, fecha, skillName, totalLlamadas, contestadas, serviceLevel20secPct, contestadas20sEstimado, archivoNombre, cargadoPorNombre, createdAt)
   VALUES (?,?,?,?,?,?,?,?,?,?)`
).run('HOSPITAL LA MARIA CASTILLA', '2026-07-01', SKILL_CASTILLA, 200, 180, 87.5, 175, 'volvox-julio.xlsx', 'admin', now);
pre.prepare(
  `INSERT INTO calidad_nivel_servicio_diario
     (campana, fecha, skillName, totalLlamadas, contestadas, serviceLevel20secPct, contestadas20sEstimado, archivoNombre, cargadoPorNombre, createdAt)
   VALUES (?,?,?,?,?,?,?,?,?,?)`
).run('HOSPITAL LA MARIA SEDE33', '2026-07-01', SKILL_SEDE33, 60, 50, 80.0, 48, 'volvox-julio.xlsx', 'admin', now);

pre.prepare(
  `INSERT INTO calidad_nivel_servicio (campana, mes, contestadas20s, llamadasTotales, createdAt, updatedAt) VALUES (?,?,?,?,?,?)`
).run('HOSPITAL LA MARIA CASTILLA', '2026-07', 175, 200, now, now);
pre.prepare(
  `INSERT INTO calidad_nivel_servicio (campana, mes, contestadas20s, llamadasTotales, createdAt, updatedAt) VALUES (?,?,?,?,?,?)`
).run('HOSPITAL LA MARIA SEDE33', '2026-07', 48, 60, now, now);

pre.prepare(`INSERT INTO trafico_skill_mapeo (skillName, campana, createdAt, updatedAt) VALUES (?,?,?,?)`).run(
  SKILL_CASTILLA,
  'HOSPITAL LA MARIA CASTILLA',
  now,
  now
);
pre.prepare(`INSERT INTO trafico_skill_mapeo (skillName, campana, createdAt, updatedAt) VALUES (?,?,?,?)`).run(
  SKILL_SEDE33,
  'HOSPITAL LA MARIA SEDE33',
  now,
  now
);
pre.close();

// ── 2) Requerir db.js contra ESE archivo: corre CREATE TABLE IF NOT EXISTS
// (no-op sobre lo ya sembrado) + TODAS las runOnceMigration, incluida
// hlm_sede_consolidacion_v1, exactamente como pasaria en produccion. ──
function setEnvDefault(key, value) {
  if (process.env[key] === undefined || process.env[key] === '') process.env[key] = value;
}
setEnvDefault('NODE_ENV', 'test');
setEnvDefault('JWT_SECRET', crypto.randomBytes(48).toString('hex'));
setEnvDefault('JWT_EXPIRES_IN', '1h');
setEnvDefault('MASTER_ADMIN_USER', 'admin');
setEnvDefault('MASTER_ADMIN_PASSWORD_HASH', bcrypt.hashSync('NoUsadaEnEsteTest#1', 10)); // no se usa en este test
setEnvDefault('DB_PATH', tmpDb);
setEnvDefault('TRUST_PROXY', 'false');
setEnvDefault('RATE_LIMIT_MAX', '10000');
setEnvDefault('LOGIN_RATE_LIMIT_MAX', '10000');

const db = require('../db');

test('migracion hlm_sede_consolidacion_v1: re-etiqueta sin perder historico ni cambiar puntajes', () => {
  // Ya NO existen filas bajo las campanas falsas.
  const bajoCastillaVieja = db.prepare('SELECT COUNT(*) AS n FROM calidad_nivel_servicio_diario WHERE campana = ?').get('HOSPITAL LA MARIA CASTILLA');
  const bajoSede33Vieja = db.prepare('SELECT COUNT(*) AS n FROM calidad_nivel_servicio_diario WHERE campana = ?').get('HOSPITAL LA MARIA SEDE33');
  assert.equal(bajoCastillaVieja.n, 0);
  assert.equal(bajoSede33Vieja.n, 0);

  // Las filas siguen ahi, bajo "HOSPITAL LA MARIA" + su sede real, MISMOS numeros.
  const filaCastilla = db.prepare('SELECT * FROM calidad_nivel_servicio_diario WHERE skillName = ?').get(SKILL_CASTILLA);
  assert.ok(filaCastilla, 'la fila de Castilla no debe haberse perdido');
  assert.equal(filaCastilla.campana, 'HOSPITAL LA MARIA');
  assert.equal(filaCastilla.sede, 'CASTILLA');
  assert.equal(filaCastilla.totalLlamadas, 200);
  assert.equal(filaCastilla.contestadas, 180);
  assert.equal(filaCastilla.contestadas20sEstimado, 175);

  const filaSede33 = db.prepare('SELECT * FROM calidad_nivel_servicio_diario WHERE skillName = ?').get(SKILL_SEDE33);
  assert.ok(filaSede33, 'la fila de Sede33 no debe haberse perdido');
  assert.equal(filaSede33.campana, 'HOSPITAL LA MARIA');
  assert.equal(filaSede33.sede, 'SEDE33');
  assert.equal(filaSede33.totalLlamadas, 60);
  assert.equal(filaSede33.contestadas, 50);

  // El agregado mensual: mismos puntajes, cada sede en su propia fila (nunca sumadas).
  const mensualCastilla = db.prepare('SELECT * FROM calidad_nivel_servicio WHERE campana = ? AND mes = ? AND sede = ?').get('HOSPITAL LA MARIA', '2026-07', 'CASTILLA');
  const mensualSede33 = db.prepare('SELECT * FROM calidad_nivel_servicio WHERE campana = ? AND mes = ? AND sede = ?').get('HOSPITAL LA MARIA', '2026-07', 'SEDE33');
  assert.ok(mensualCastilla, 'el mensual de Castilla no debe haberse perdido');
  assert.equal(mensualCastilla.contestadas20s, 175);
  assert.equal(mensualCastilla.llamadasTotales, 200);
  assert.ok(mensualSede33, 'el mensual de Sede33 no debe haberse perdido');
  assert.equal(mensualSede33.contestadas20s, 48);
  assert.equal(mensualSede33.llamadasTotales, 60);
  // No debe existir una fila sumada equivocadamente (campana, mes) sin sede.
  const mensualSinSede = db.prepare('SELECT * FROM calidad_nivel_servicio WHERE campana = ? AND mes = ? AND sede IS NULL').get('HOSPITAL LA MARIA', '2026-07');
  assert.equal(mensualSinSede, undefined, 'nunca debe quedar un agregado mezclado de ambas sedes');

  // El mapeo de skills tambien queda re-etiquetado.
  const mapeoCastilla = db.prepare('SELECT * FROM trafico_skill_mapeo WHERE skillName = ?').get(SKILL_CASTILLA);
  assert.equal(mapeoCastilla.campana, 'HOSPITAL LA MARIA');
  assert.equal(mapeoCastilla.sede, 'CASTILLA');
  const mapeoSede33 = db.prepare('SELECT * FROM trafico_skill_mapeo WHERE skillName = ?').get(SKILL_SEDE33);
  assert.equal(mapeoSede33.campana, 'HOSPITAL LA MARIA');
  assert.equal(mapeoSede33.sede, 'SEDE33');
});

test.after(() => {
  try { db.closeDb(); } catch (e) {}
  try { fs.unlinkSync(tmpDb); } catch (e) {}
});
