// faseAU4-aurora-espera-2min.test.js — Fase AU4 (autorización escrita del usuario, 26/11/2026): «Ejecutar ahora» de
// la réplica «CLINICA AURORA PRUEBAS API» espera 2 min entre una y otra (para cargar su histórico de 2026). Las demás
// (ORLANT réplica; el hueco del real) siguen con 10 min. Una consulta detrás de otra: el candado sigue igual.
// Wolkvox FALSO; nunca sale a la red.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { app, request, tokenFor, MASTER_PASSWORD } = require('./helpers');
const D = require('../wolkvox-destinos');
const rutaWv = require('../routes/wolkvox');

const H = (t) => ({ Authorization: 'Bearer ' + t });
app.locals.wolkvoxInterruptor = async () => true;
app.locals.wolkvoxValor = async () => 'flujo,cdr,whatsapp';
app.locals.wolkvoxFetch = () => Promise.resolve({ status: 200, json: () => Promise.resolve({ code: 200, msg: '0 records were found', data: [] }) });
let admin;
before(async () => { admin = await tokenFor('admin', MASTER_PASSWORD); });

test('destinos: solo la réplica de Aurora espera 2 min; las demás, la de siempre', () => {
  assert.equal(D.DESTINOS.aurora_replica.esperaEjecutarMs, 2 * 60 * 1000);
  for (const [k, d] of Object.entries(D.DESTINOS)) if (k !== 'aurora_replica') assert.equal(d.esperaEjecutarMs, undefined, k);
});

test('ruta: Aurora pide esperar 2 min; ORLANT réplica, 10 min', async () => {
  rutaWv._reiniciarEspera();
  const ej = (campana) => request(app).post('/api/wolkvox/auto/ejecutar').set(H(admin)).send({ campana, modulo: 'whatsapp', mes: '2026-10' });
  const a1 = await ej('CLINICA AURORA PRUEBAS API');
  assert.equal(a1.status, 200, JSON.stringify(a1.body));
  const a2 = await ej('CLINICA AURORA PRUEBAS API');
  assert.equal(a2.status, 429);
  assert.match(a2.body.error, /^Espera 2 min/);
  const o1 = await ej('ORLANT PRUEBAS API');
  assert.equal(o1.status, 200, JSON.stringify(o1.body));
  const o2 = await ej('ORLANT PRUEBAS API');
  assert.equal(o2.status, 429);
  assert.match(o2.body.error, /^Espera 10 min/);
  // El Aurora real no tiene «Ejecutar ahora».
  assert.equal((await ej('CLINICA AURORA')).status, 404);
  rutaWv._reiniciarEspera();
});
