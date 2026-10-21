// fase161-cache-datos-version.test.js — Fase 161: la cache de opciones se
// vacia solo cuando cambian DATOS (triggers que suben datos_version), no con
// los inicios de sesion. Cargar, eliminar, deshacer y el borrado por rango
// invalidan; iniciar sesion no. Datos 100% sinteticos.
'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { app, db, request, tokenFor, MASTER_PASSWORD, cleanup } = require('./helpers');
const { opcionesConCache } = require('../cache-opciones');
const { asegurarDatosVersion, TABLAS_SIN_VERSION_DATOS } = require('../db');

after(cleanup);
const auth = (t) => ({ Authorization: 'Bearer ' + t });

// Cuenta cuantas veces la cache tuvo que recalcular la clave `k`.
function contador(k) {
  let calculos = 0;
  const leer = () => opcionesConCache(db, k, () => ++calculos);
  return { leer, calculos: () => calculos };
}

function filaAgendas(i, mes, dia) {
  return ['ASESOR_F161_' + i, 'SEDE_F161', 'EXAMEN_F161', 'ESPECIALIDAD_F161', 'PROFESIONAL_F161', mes + '-' + dia + ' 08:00:00', 'GENERAL', 'ENTIDAD_F161'];
}

test('cada tabla de datos tiene sus 3 triggers; users, historial y tokens_revocados no', () => {
  const tablas = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'").all().map((r) => r.name);
  const triggers = new Set(db.prepare("SELECT name FROM sqlite_master WHERE type = 'trigger'").all().map((r) => r.name));
  for (const t of tablas) {
    for (const op of ['insert', 'update', 'delete']) {
      assert.equal(triggers.has(`dv_${t}_${op}`), !TABLAS_SIN_VERSION_DATOS.includes(t), `dv_${t}_${op}`);
    }
  }
  for (const t of ['agendas', 'calidad_nivel_servicio_diario', 'trafico_whatsapp', 'tipificaciones', 'trafico_skill_mapeo', 'dashboards_config']) {
    assert.ok(triggers.has(`dv_${t}_insert`), t);
  }
  for (const t of ['users', 'historial', 'tokens_revocados']) assert.ok(!triggers.has(`dv_${t}_update`), t);
});

test('asegurarDatosVersion es idempotente (correrla otra vez no cambia nada)', () => {
  const antes = db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'trigger'").get().n;
  const n = db.prepare('SELECT n FROM datos_version').get().n;
  asegurarDatosVersion();
  asegurarDatosVersion();
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type = 'trigger'").get().n, antes);
  assert.equal(db.prepare('SELECT n FROM datos_version').get().n, n);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM datos_version').get().n, 1);
});

test('iniciar sesion y cerrar sesion NO vacian la cache de opciones', async () => {
  const c = contador('f161-login');
  c.leer();
  await tokenFor('admin', MASTER_PASSWORD);
  const t = await tokenFor('admin', MASTER_PASSWORD);
  c.leer();
  assert.equal(c.calculos(), 1, 'un inicio de sesion no invalida');
  await request(app).post('/api/auth/logout').set(auth(t));
  c.leer();
  assert.equal(c.calculos(), 1, 'cerrar sesion no invalida');
});

test('cargar, eliminar el mes, deshacer y el borrado por rango SI la vacian', async () => {
  const t = await tokenFor('admin', MASTER_PASSWORD);
  const c = contador('f161-datos');
  const invalida = (que) => {
    const antes = c.calculos();
    c.leer();
    assert.equal(c.calculos(), antes + 1, que + ' invalida');
    c.leer();
    assert.equal(c.calculos(), antes + 1, 'sin mas cambios, sale de la cache');
  };
  c.leer();

  // Cargar
  const r = await request(app).post('/api/calidad/agendas/carga').set(auth(t))
    .send({ campana: 'ORLANT', archivoNombre: 'f161.xlsx', filas: [filaAgendas(1, '2020-05', '04'), filaAgendas(2, '2020-06', '04')] });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  invalida('cargar');

  // Eliminar el mes desde el Centro
  const d = await request(app).delete('/api/centro-cargas/ORLANT/agendas/2020-05').set(auth(t));
  assert.equal(d.status, 200, JSON.stringify(d.body));
  invalida('eliminar');

  // Deshacer
  const vs = (await request(app).get('/api/centro-cargas/ORLANT/versiones?carga=agendas&mes=2020-05').set(auth(t))).body.versiones;
  const u = await request(app).post('/api/centro-cargas/versiones/' + vs[0].id + '/deshacer').set(auth(t));
  assert.equal(u.status, 200, JSON.stringify(u.body));
  invalida('deshacer');

  // Borrado por rango (admin)
  const b = await request(app).post('/api/admin/borrado-rango').set(auth(t))
    .send({ base: 'agendas', campana: 'ORLANT', mesDesde: '2020-06', mesHasta: '2020-06', filasEsperadas: 1, confirmar: true });
  assert.equal(b.status, 200, JSON.stringify(b.body));
  invalida('borrado por rango');
});
