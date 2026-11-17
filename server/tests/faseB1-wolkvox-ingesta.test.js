// faseB1-wolkvox-ingesta.test.js — Plan B de Wolkvox, fase B1: ingesta del agente de la
// oficina. Solo la replica «MOBILIZE PRUEBAS API», solo Flujo. Clave y datos INVENTADOS.
'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { request, app, db } = require('./helpers');
const ing = require('../wolkvox-ingesta');

const R = ing.CAMPANA_INGESTA;
const RUTA = ing.RUTA_INGESTA;
const CLAVE = 'clave-falsa-de-prueba-B1-no-es-real-0123456789';
const HUELLA = crypto.createHash('sha256').update(CLAVE).digest('hex');
const antes = { h: process.env.WOLKVOX_AGENTE_CLAVE_SHA256, ips: process.env.WOLKVOX_AGENTE_IPS };
after(() => {
  if (antes.h === undefined) delete process.env.WOLKVOX_AGENTE_CLAVE_SHA256; else process.env.WOLKVOX_AGENTE_CLAVE_SHA256 = antes.h;
  if (antes.ips === undefined) delete process.env.WOLKVOX_AGENTE_IPS; else process.env.WOLKVOX_AGENTE_IPS = antes.ips;
});

const fila = (fecha, skillName, extra) => ({ fecha, skillName, totalLlamadas: 10, contestadas: 8, llamadasAbandonadas: 2, serviceLevel20secPct: 75, asaSegundos: 12, ataSegundos: 90, ...extra });
const cuerpo = (filas, mes = '2026-10') => ({ reporte: 'flujo', mes, filas });
const enviar = (b, clave = CLAVE) => request(app).post(RUTA).set('X-Agente-Clave', clave).send(b);
const filasReplica = (mes) => db.prepare("SELECT fecha, skillName, totalLlamadas FROM calidad_nivel_servicio_diario WHERE campana = ? AND substr(fecha,1,7) = ? ORDER BY fecha, skillName").all(R, mes);

test('apagada sin huella en el entorno: 503 y no escribe', async () => {
  delete process.env.WOLKVOX_AGENTE_CLAVE_SHA256;
  const r = await enviar(cuerpo([fila('2026-10-01', 'SKILL INVENTADA A')]));
  assert.equal(r.status, 503);
  assert.equal(filasReplica('2026-10').length, 0);
});

test('clave equivocada o ausente: 401; IP fuera de la lista: 403', async () => {
  process.env.WOLKVOX_AGENTE_CLAVE_SHA256 = HUELLA;
  assert.equal((await enviar(cuerpo([fila('2026-10-01', 'X')]), CLAVE + 'x')).status, 401);
  assert.equal((await request(app).post(RUTA).send(cuerpo([fila('2026-10-01', 'X')]))).status, 401);
  process.env.WOLKVOX_AGENTE_IPS = '203.0.113.7';
  assert.equal((await enviar(cuerpo([fila('2026-10-01', 'X')]))).status, 403);
  delete process.env.WOLKVOX_AGENTE_IPS;
  assert.equal(filasReplica('2026-10').length, 0);
});

test('valida el cuerpo: reporte, mes, fechas, numeros, repetidos', async () => {
  process.env.WOLKVOX_AGENTE_CLAVE_SHA256 = HUELLA;
  const malos = [
    { ...cuerpo([fila('2026-10-01', 'A')]), reporte: 'cdr' },
    cuerpo([fila('2026-10-01', 'A')], '2026-13'),
    cuerpo([fila('2026-11-01', 'A')]),
    cuerpo([fila('2026-10-32', 'A')]),
    cuerpo([fila('2026-10-01', 'A', { totalLlamadas: -1 })]),
    cuerpo([fila('2026-10-01', 'A', { contestadas: 11 })]),
    cuerpo([fila('2026-10-01', 'A', { serviceLevel20secPct: 101 })]),
    cuerpo([fila('2026-10-01', 'A'), fila('2026-10-01', 'A')]),
    cuerpo([]),
  ];
  for (const b of malos) assert.equal((await enviar(b)).status, 400, JSON.stringify(b).slice(0, 80));
  assert.equal(filasReplica('2026-10').length, 0);
});

test('reemplaza el mes completo de la replica y no toca Mobilize ni otros meses', async () => {
  process.env.WOLKVOX_AGENTE_CLAVE_SHA256 = HUELLA;
  const mobAntes = db.prepare("SELECT COUNT(*) n FROM calidad_nivel_servicio_diario WHERE campana = 'MOBILIZE'").get().n;
  let r = await enviar(cuerpo([fila('2026-10-01', 'SKILL INVENTADA A'), fila('2026-10-02', 'SKILL INVENTADA B')]));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.filas, 2);
  r = await enviar(cuerpo([fila('2026-09-30', 'SKILL INVENTADA A')], '2026-09'));
  assert.equal(r.status, 200);
  // Segundo envio de octubre sin la skill B: B sale; septiembre queda igual.
  r = await enviar(cuerpo([fila('2026-10-05', 'SKILL INVENTADA A', { totalLlamadas: 20, contestadas: 15 })]));
  assert.equal(r.status, 200);
  assert.equal(r.body.reemplazadas, 2);
  assert.deepEqual(filasReplica('2026-10'), [{ fecha: '2026-10-05', skillName: 'SKILL INVENTADA A', totalLlamadas: 20 }]);
  assert.equal(filasReplica('2026-09').length, 1);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM calidad_nivel_servicio_diario WHERE campana = 'MOBILIZE'").get().n, mobAntes);
  const mensual = db.prepare('SELECT llamadasTotales FROM calidad_nivel_servicio WHERE campana = ? AND mes = ?').get(R, '2026-10');
  assert.equal(mensual && mensual.llamadasTotales, 20);
});

test('unidades: normalizarIp y ultimoDiaDelMes', () => {
  assert.equal(ing.normalizarIp('::ffff:198.51.100.2'), '198.51.100.2');
  assert.equal(ing.ultimoDiaDelMes('2028-02'), '2028-02-29');
});
