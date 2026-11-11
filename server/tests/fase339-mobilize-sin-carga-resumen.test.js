// fase339-mobilize-sin-carga-resumen.test.js — Fase 339 (pedido de Edwin, 11/11): Mobilize deja de
// ofrecer la carga manual «Calidad: resumen por asesor» (Calidad se hace en la plataforma). Oculta por
// configuracion (CARGAS_RETIRADAS_POR_CLIENTE): el modulo sigue en el registro, los datos subidos no se
// borran y el servidor rechaza una carga nueva. Las demas campañas no cambian. Datos SINTETICOS.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const CC = require('../centro-cargas');
const { CATALOGO } = require('../plantillas-cliente');
const reg = require('../clientes-registro');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');

const H = (t) => ({ Authorization: 'Bearer ' + t });
let admin;
before(async () => { admin = await tokenFor('admin', MASTER_PASSWORD); });

test('Cargar Datos de Mobilize ya no ofrece «Calidad: resumen por asesor»; el modulo sigue en el registro', () => {
  const mob = CC.resumenCliente(db, 'MOBILIZE', 2026, CATALOGO);
  assert.ok(!mob.some((m) => m.id === 'calidad_resumen'));
  assert.ok(mob.some((m) => m.id === 'encuesta') && mob.some((m) => m.id === 'flujo_llamadas'), 'el resto de cargas de Mobilize sigue');
  assert.ok(reg.leerRegistro(db).find((c) => c.nombre === 'MOBILIZE').modulos.includes('calidad_resumen'), 'no se quito del registro');
  assert.equal(CC.cargaRetiradaPara('MOBILIZE', { id: 'calidad_resumen' }), true);
  for (const c of ['ORLANT', 'CLINICA AURORA', 'HOSPITAL LA MARIA', 'SURA']) assert.equal(CC.cargaRetiradaPara(c, { id: 'calidad_resumen' }), false, c);
});

test('el servidor rechaza una carga nueva; lo ya subido no se borra y se sigue leyendo', async () => {
  db.prepare("INSERT INTO calidad_resumen_asesor (campana, mes, agente, monitoreos, puntaje, fallos, archivoNombre, cargadoPorNombre, createdAt) VALUES ('MOBILIZE', '2025-06', 'Asesor Sintetico 339', 3, 95, 0, 'sint.xlsx', 'Persona S', 'x')").run();
  const filas = [['Asesor Sintetico 339', 3, 95, 0]];
  for (const ruta of ['/api/calidad/calidad-resumen/carga', '/api/calidad/calidad-resumen/carga/impacto']) {
    const r = await request(app).post(ruta).set(H(admin)).send({ campana: 'MOBILIZE', mes: '2025-07', filas });
    assert.equal(r.status, 400, ruta);
    assert.match(r.body.error, /ya no usa «Calidad: resumen por asesor»/);
  }
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM calidad_resumen_asesor WHERE campana = 'MOBILIZE' AND mes = '2025-06'").get().n, 1, 'los datos siguen');
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM calidad_resumen_asesor WHERE campana = 'MOBILIZE' AND mes = '2025-07'").get().n, 0, 'nada nuevo');
  const m = await request(app).get('/api/calidad/calidad-resumen/mensual').query({ campana: 'MOBILIZE' }).set(H(admin));
  assert.equal(m.status, 200);
});
