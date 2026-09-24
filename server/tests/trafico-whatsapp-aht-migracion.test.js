// trafico-whatsapp-aht-migracion.test.js — prueba la migracion
// `trafico_whatsapp_aht_v1` (server/db.js), Fase 68 Pedido 5 (Edwin,
// 23/09): agrega la columna opcional `ahtSegundos` a `trafico_whatsapp`
// para quien ya tenia esa tabla sembrada en produccion (Fase 50-56) antes
// de esta columna existir. Mismo patron que las pruebas de migracion de
// dashboards_config: se siembra la tabla VIEJA a mano (sin la columna)
// *antes* de requerir db.js, y se verifica que la migracion la agrega sin
// romper nada ni perder filas existentes.
'use strict';

const os = require('os');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const tmpDb = path.join(os.tmpdir(), `inconexion-trafico-wpp-aht-${process.pid}-${crypto.randomBytes(6).toString('hex')}.db`);

// Forma "vieja" reconocible: trafico_whatsapp tal como existia antes de la
// Fase 68 (sin ahtSegundos), con una fila real ya cargada.
const pre = new Database(tmpDb);
pre.exec(`
  CREATE TABLE trafico_whatsapp (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campana TEXT NOT NULL,
    colaWhatsapp TEXT NOT NULL,
    fechaInicio TEXT NOT NULL,
    fechaFin TEXT NOT NULL,
    totalWhatsapp INTEGER NOT NULL DEFAULT 0,
    contestados INTEGER NOT NULL DEFAULT 0,
    abandonados INTEGER,
    serviceLevel10secPct REAL,
    serviceLevel20secPct REAL,
    serviceLevel30secPct REAL,
    asaSegundos REAL,
    ataSegundos REAL,
    archivoNombre TEXT NOT NULL DEFAULT '',
    cargadoPorNombre TEXT NOT NULL DEFAULT '',
    createdAt TEXT NOT NULL,
    UNIQUE(campana, colaWhatsapp, fechaInicio, fechaFin)
  );
`);
const now = '24/09/2026 09:00:00';
pre.prepare(
  `INSERT INTO trafico_whatsapp
     (campana, colaWhatsapp, fechaInicio, fechaFin, totalWhatsapp, contestados, abandonados,
      serviceLevel10secPct, serviceLevel20secPct, serviceLevel30secPct, asaSegundos, ataSegundos,
      archivoNombre, cargadoPorNombre, createdAt)
   VALUES ('ORLANT','WHATSAPP PRE-EXISTENTE','2026-08-01','2026-08-31',100,90,5,10,20,30,15.5,25.5,'archivo.xlsx','Alguien',?)`
).run(now);
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

test('migracion trafico_whatsapp_aht_v1: agrega la columna ahtSegundos sin perder filas existentes', () => {
  const row = db.prepare("SELECT * FROM trafico_whatsapp WHERE colaWhatsapp = 'WHATSAPP PRE-EXISTENTE'").get();
  assert.ok(row, 'la fila cargada antes de la migracion debe seguir ahi');
  assert.equal(row.totalWhatsapp, 100);
  assert.equal(row.asaSegundos, 15.5);
  assert.equal(row.ahtSegundos, null, 'una fila vieja, cargada antes de que existiera la columna, queda null (no 0)');
});

test('migracion trafico_whatsapp_aht_v1: la columna nueva se puede escribir/leer con normalidad', () => {
  db.prepare(
    `INSERT INTO trafico_whatsapp
       (campana, colaWhatsapp, fechaInicio, fechaFin, totalWhatsapp, contestados, ahtSegundos, archivoNombre, cargadoPorNombre, createdAt)
     VALUES ('ORLANT','WHATSAPP CON AHT','2026-09-01','2026-09-30',50,45,215,'archivo2.xlsx','Alguien','24/09/2026 09:05:00')`
  ).run();
  const row = db.prepare("SELECT * FROM trafico_whatsapp WHERE colaWhatsapp = 'WHATSAPP CON AHT'").get();
  assert.equal(row.ahtSegundos, 215);
});

test.after(() => {
  try { db.closeDb(); } catch (e) {}
  try { fs.unlinkSync(tmpDb); } catch (e) {}
});
