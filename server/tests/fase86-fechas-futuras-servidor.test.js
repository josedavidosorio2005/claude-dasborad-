// fase86-fechas-futuras-servidor.test.js — Fase 86, tema 2. Defensa en el
// SERVIDOR (nunca solo en el navegador, ver fecha-limites.js) contra fechas
// futuras en las 6 rutas de carga por Excel: LLAMADAS, WHATSAPP,
// TIPIFICACION_LLAMADAS/WHATSAPP, AGENDAS, resumen/salida/sta_categorias
// (seccion generica) y Calidad. El criterio es siempre "posterior al
// ultimo dia del mes en curso" -- NUNCA "posterior a hoy" (confirmado con
// un caso explicito para WhatsApp, cuya FECHA FIN puede ser legitimamente
// el fin del mes en curso). Datos SIEMPRE inventados.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, tokenFor, MASTER_PASSWORD } = require('./helpers');
const { fechaLimitesFinDeMesActual } = require('../fecha-limites');

const auth = (t) => ({ Authorization: `Bearer ${t}` });

test('POST /calidad/trafico/carga (LLAMADAS): una fila con fecha futura se rechaza con 400 y el mensaje dice la fecha', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const res = await request(app)
    .post('/api/calidad/trafico/carga')
    .set(auth(admin))
    .send({ filas: [{ skillName: 'SKILL FASE86 ' + Math.random().toString(36).slice(2, 6), fecha: '2099-06-15', totalLlamadas: 10, contestadas: 9 }] });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /2099-06-15/);
  assert.match(res.body.error, /futuro/);
});

test('POST /calidad/trafico/whatsapp/carga (WHATSAPP): FECHA FIN futura se rechaza con 400', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const res = await request(app)
    .post('/api/calidad/trafico/whatsapp/carga')
    .set(auth(admin))
    .send({ campana: 'ORLANT', filas: [{ colaWhatsapp: 'COLA FASE86', fechaInicio: '2099-06-01', fechaFin: '2099-06-30', totalWhatsapp: 10, contestados: 9 }] });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /2099-06-30/);
  assert.match(res.body.error, /futuro/);
});

test('POST /calidad/trafico/whatsapp/carga (WHATSAPP): FECHA FIN = ultimo dia del mes en curso se ACEPTA -- nunca "posterior a hoy"', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const finMes = fechaLimitesFinDeMesActual();
  const inicioMes = finMes.slice(0, 8) + '01';
  const res = await request(app)
    .post('/api/calidad/trafico/whatsapp/carga')
    .set(auth(admin))
    .send({ campana: 'ORLANT', filas: [{ colaWhatsapp: 'COLA FASE86 FINMES ' + Math.random().toString(36).slice(2, 6), fechaInicio: inicioMes, fechaFin: finMes, totalWhatsapp: 10, contestados: 9 }] });
  assert.equal(res.status, 201, JSON.stringify(res.body));
});

test('POST /calidad/tipificacion/carga (TIPIFICACION_LLAMADAS): fila con fecha futura se rechaza con 400', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const res = await request(app)
    .post('/api/calidad/tipificacion/carga')
    .set(auth(admin))
    .send({
      campana: 'ORLANT',
      canal: 'LLAMADAS',
      filas: [['ASESOR FASE86', '2099-06-15', null, null, 'TIPIFICACION X', 'SKILL X']],
    });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /2099-06-15/);
  assert.match(res.body.error, /futuro/);
});

test('POST /calidad/agendas/carga (AGENDAS): FECHA_SOLICITUD futura se rechaza con 400', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const res = await request(app)
    .post('/api/calidad/agendas/carga')
    .set(auth(admin))
    .send({
      campana: 'ORLANT',
      filas: [['ASESOR FASE86', 'SEDE CENTRO', 'AUDIOMETRIA', 'AUDIOLOGIA', 'DR PEREZ', '2099-06-15 10:00:00', 'GENERAL', 'EPS DEMO']],
    });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /2099-06-15/);
  assert.match(res.body.error, /futuro/);
});

test('POST /monitoreos/bulk (Calidad): fila con fecha futura se rechaza con 400', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const res = await request(app)
    .post('/api/monitoreos/bulk')
    .set(auth(admin))
    .send({ campana: 'ORLANT', filas: [{ asesor: 'ASESOR FASE86', fecha: '2099-06-15', answers: { 1: 'SI' } }] });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /2099-06-15/);
  assert.match(res.body.error, /futuro/);
});

// resumen/salida/sta_categorias comparten el mismo mecanismo generico
// (POST /dashboard/cargas, server/dashboard-secciones.js normalizarFilas) --
// se prueba contra "salida" de ORLANT, que trae una columna tipo 'fecha'.
test('POST /dashboard/cargas (seccion generica con columna tipo "fecha", ej. "salida" de ORLANT): fila con fecha futura se rechaza con 400', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const seccionesRes = await request(app).get('/api/dashboard/secciones/ORLANT').set(auth(admin));
  assert.equal(seccionesRes.status, 200);
  const salida = seccionesRes.body.secciones.salida;
  assert.ok(salida, 'ORLANT debe tener la seccion "salida" sembrada');
  const colFecha = salida.columnas.find((c) => c.tipo === 'fecha');
  assert.ok(colFecha, 'la seccion "salida" debe tener al menos una columna tipo fecha');

  const fila = {};
  salida.columnas.forEach((c) => {
    if (c.key === colFecha.key) { fila[c.key] = '2099-06-15'; return; }
    if (c.opcional) return;
    fila[c.key] = c.tipo === 'texto' ? 'X' : 1;
  });

  const res = await request(app)
    .post('/api/dashboard/cargas')
    .set(auth(admin))
    .send({ cliente: 'ORLANT', seccion: 'salida', cadencia: salida.cadencia, periodo: '2026-09', filas: [fila] });
  assert.equal(res.status, 400);
  assert.match(res.body.error, /2099-06-15/);
  assert.match(res.body.error, /futuro/);
});
