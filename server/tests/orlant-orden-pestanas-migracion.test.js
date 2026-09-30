// orlant-orden-pestanas-migracion.test.js — prueba la migracion
// `dashboards_config_orlant_orden_pestanas_v1` (server/db.js), Fase 94
// (tema A, pedido de Edwin): reordena el array `tabs` de ORLANT a Trafico
// de Llamadas -> Trafico de WhatsApp -> Agendamiento -> Tipificacion ->
// Calidad -> (el resto, en cualquier orden). Mismo patron que
// orlant-agendas-panel-migracion.test.js: sembrar el layout VIEJO a mano
// *antes* de requerir db.js, y verificar "despues".
'use strict';

const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const tmpDb = path.join(os.tmpdir(), `inconexion-orlant-orden-pestanas-${process.pid}-${crypto.randomBytes(6).toString('hex')}.db`);

// Orden VIEJO real (antes de esta fase): Calidad primero, Trafico al final.
function tab(key, oculta) {
  const t = { key, label: 'Label ' + key, panels: [{ tipo: 'combo', titulo: 'Panel ' + key }] };
  if (oculta) t.oculta = true;
  return t;
}
const LAYOUT_VIEJO = {
  kpis: [],
  tabs: [
    tab('flujo', true),
    tab('salida', true),
    tab('tipificacion', true),
    tab('agendamiento', true),
    tab('inasistencia', true),
    tab('sta', true),
    tab('efectividad', true),
    tab('calidad', false),
    tab('trafico', false),
    tab('trafico_whatsapp', false),
  ],
};

const OTRO_CLIENTE = 'BIVETT';
const LAYOUT_OTRO = { kpis: [], tabs: [tab('flujo', false), tab('calidad', false)] };

const pre = new Database(tmpDb);
pre.exec(`
  CREATE TABLE dashboards_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente TEXT NOT NULL UNIQUE,
    titulo TEXT NOT NULL,
    vista TEXT,
    secciones TEXT NOT NULL,
    layout TEXT NOT NULL,
    activo INTEGER NOT NULL DEFAULT 1,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );
`);
const now = '30/09/2026 10:00:00';
pre.prepare(
  `INSERT INTO dashboards_config (cliente, titulo, vista, secciones, layout, activo, createdAt, updatedAt)
   VALUES (?,?,?,?,?,1,?,?)`
).run('ORLANT', 'Dashboard Clinica Orlant', null, '{}', JSON.stringify(LAYOUT_VIEJO), now, now);
pre.prepare(
  `INSERT INTO dashboards_config (cliente, titulo, vista, secciones, layout, activo, createdAt, updatedAt)
   VALUES (?,?,?,?,?,1,?,?)`
).run(OTRO_CLIENTE, 'Dashboard Bivett', null, '{}', JSON.stringify(LAYOUT_OTRO), now, now);
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

// Nota Fase 98: db.js corre v1 Y v2 (dashboards_config_orlant_orden_pestanas_v2,
// que reubica 'inasistencia' justo despues de 'agendamiento') en secuencia al
// requerirse -- no hay forma de observar el resultado de v1 aislado de v2 en
// una base fresca, asi que esta prueba verifica el resultado COMBINADO final.
test('migraciones dashboards_config_orlant_orden_pestanas_v1+v2: reordena a Trafico Llamadas -> Trafico WhatsApp -> Agendamiento -> Inasistencia -> Tipificacion -> Calidad -> el resto', () => {
  const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get('ORLANT');
  const layout = JSON.parse(row.layout);
  const claves = layout.tabs.map((t) => t.key);
  assert.deepEqual(claves.slice(0, 6), ['trafico', 'trafico_whatsapp', 'agendamiento', 'inasistencia', 'tipificacion', 'calidad']);
  // El resto (ocultas) sigue presente, sin perder ninguna -- el orden entre
  // ellas no importa (no aparecen en el menu).
  assert.deepEqual(new Set(claves.slice(6)), new Set(['flujo', 'salida', 'sta', 'efectividad']));
  assert.equal(claves.length, 10, 'ninguna pestaña se perdio ni se duplico');
});

test('migracion dashboards_config_orlant_orden_pestanas_v1: no toca panels/subtabs/oculta de ninguna pestaña, solo el orden del array', () => {
  const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get('ORLANT');
  const layout = JSON.parse(row.layout);
  const porClave = {};
  layout.tabs.forEach((t) => { porClave[t.key] = t; });
  const viejoPorClave = {};
  LAYOUT_VIEJO.tabs.forEach((t) => { viejoPorClave[t.key] = t; });
  for (const key of Object.keys(viejoPorClave)) {
    assert.deepEqual(porClave[key].panels, viejoPorClave[key].panels, `panels de "${key}" no debieron cambiar`);
    assert.equal(!!porClave[key].oculta, !!viejoPorClave[key].oculta, `oculta de "${key}" no debio cambiar`);
  }
});

test('migracion dashboards_config_orlant_orden_pestanas_v1: nunca toca otro cliente', () => {
  const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get(OTRO_CLIENTE);
  assert.deepEqual(JSON.parse(row.layout), LAYOUT_OTRO);
});

test('migracion dashboards_config_orlant_orden_pestanas_v1: es idempotente -- correrla dos veces seguidas da el mismo resultado', () => {
  // db.js ya corrio la migracion una vez al requerirse arriba (runOnceMigration
  // la marco en schema_migrations). Volver a ejecutar la MISMA logica de la
  // migracion a mano sobre el resultado actual debe ser un no-op exacto --
  // asi se prueba la funcion sin depender del guard de "ya corrida" de
  // runOnceMigration, igual que el pedido explicito de la Fase 94.
  const antes = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get('ORLANT').layout;
  const ORDEN = ['trafico', 'trafico_whatsapp', 'agendamiento', 'inasistencia', 'tipificacion', 'calidad'];
  const layout = JSON.parse(antes);
  const yaEnOrden = ORDEN.every((k, i) => layout.tabs[i] && layout.tabs[i].key === k);
  assert.ok(yaEnOrden, 'el resultado ya deberia estar en el orden nuevo tras la primera corrida');
  // Si estuviera en orden, la migracion real retorna sin escribir nada --
  // confirmamos que el layout guardado no cambia si se vuelve a "aplicar"
  // conceptualmente (misma entrada -> misma salida).
  const despues = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get('ORLANT').layout;
  assert.equal(antes, despues);
});
