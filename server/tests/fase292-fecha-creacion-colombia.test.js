// fase292-fecha-creacion-colombia.test.js — Fase 292 (revision del 07/11, hallazgo #15):
// las fechas que se escriben con nowStr (hora del proceso: UTC en produccion) se MUESTRAN
// en hora de Colombia, sin cambiar lo guardado: «Creado» de Usuarios, el Historial (desde
// `ts`) y Errores (registrado / editado / plan actualizado). Datos SINTETICOS.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { spawnSync } = require('child_process');
const { app, db, request, tokenFor, MASTER_PASSWORD } = require('./helpers');
const F = require('../fecha-limites');

const H = (t) => ({ Authorization: 'Bearer ' + t });
const LIB = path.join(__dirname, '..', 'fecha-limites.js').replace(/\\/g, '/');
const enZona = (tz, expr) => spawnSync(process.execPath, ['-e', `const F=require('${LIB}');process.stdout.write(String(${expr}))`], { env: { ...process.env, TZ: tz }, encoding: 'utf8' }).stdout;

test('servidor en UTC (produccion): «06/11/2026 21:02:26» se muestra «06/11/2026 16:02:26»; en Colombia queda igual', () => {
  assert.equal(enZona('UTC', "F.fechaServidorAColombiaStr('06/11/2026 21:02:26')"), '06/11/2026 16:02:26');
  assert.equal(enZona('UTC', "F.fechaServidorAColombiaStr('01/11/2026 02:00:00')"), '31/10/2026 21:00:00', 'cruza el dia y el mes');
  assert.equal(enZona('America/Bogota', "F.fechaServidorAColombiaStr('06/11/2026 16:02:26')"), '06/11/2026 16:02:26');
  assert.equal(F.fechaServidorAColombiaStr('2026-11-06'), '2026-11-06', 'otro formato: tal cual');
  assert.equal(F.fechaServidorAColombiaStr(null), null);
});

test('Usuarios: createdAt en hora de Colombia; lo guardado no cambia', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const user = 'p292_' + Math.random().toString(36).slice(2, 8);
  const r = await request(app).post('/api/users').set(H(admin)).send({ nombre: 'Cuenta Sintética', user, password: 'ClavePrueba1234', rol: 'CALIDAD', perms: { campana_ORLANT: true } });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const guardado = db.prepare('SELECT createdAt FROM users WHERE id = ?').get(r.body.id).createdAt;
  const lista = (await request(app).get('/api/users').set(H(admin))).body;
  assert.equal(lista.find((u) => u.id === r.body.id).createdAt, F.fechaServidorAColombiaStr(guardado));
  assert.equal(db.prepare('SELECT createdAt FROM users WHERE id = ?').get(r.body.id).createdAt, guardado, 'sin cambios en la base');
});

test('Historial: la fecha sale de ts en hora de Colombia', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const ts = Date.UTC(2026, 10, 6, 21, 2, 26); // 06/11/2026 21:02:26 UTC = 16:02:26 en Colombia
  db.prepare("INSERT INTO historial (ts, fecha, accion, nombre, username, rol, actor, detalle) VALUES (?, '06/11/2026 21:02:26', 'P292_PRUEBA', 'Sintético', '-', 'SUPERVISOR', 'Administrador', '')").run(ts);
  const h = (await request(app).get('/api/historial').set(H(admin))).body.find((x) => x.accion === 'P292_PRUEBA');
  assert.equal(h.fecha, '06/11/2026 16:02:26');
  assert.equal(db.prepare("SELECT fecha FROM historial WHERE accion = 'P292_PRUEBA'").get().fecha, '06/11/2026 21:02:26', 'sin cambios en la base');
});

test('Errores: registrado y plan actualizado en hora de Colombia', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const c = await request(app).post('/api/calidad/errores/guardar').set(H(admin)).send({ campana: 'CLINICA AURORA', mes: '2026-08', error: { asesor: 'Asesora Inventada', cantidad: 1 }, plan: 'Plan inventado.' });
  assert.equal(c.status, 200, JSON.stringify(c.body));
  const g = db.prepare('SELECT creadoEn FROM errores_agendamiento WHERE id = ?').get(c.body.registro.id).creadoEn;
  const p = db.prepare("SELECT actualizadoEn FROM errores_plan_accion WHERE campana = 'CLINICA AURORA' AND mes = '2026-08'").get().actualizadoEn;
  const d = (await request(app).get('/api/calidad/errores?campana=' + encodeURIComponent('CLINICA AURORA')).set(H(admin))).body;
  const reg = d.porAsesor['2026-08'][0].registros.find((x) => x.id === c.body.registro.id);
  assert.equal(reg.creadoEn, F.fechaServidorAColombiaStr(g));
  assert.equal(d.planes['2026-08'].actualizadoEn, F.fechaServidorAColombiaStr(p));
});
