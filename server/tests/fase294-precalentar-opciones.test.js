// fase294-precalentar-opciones.test.js — Fase 294 (revision 07/11, #7): al
// arrancar, la cache de opciones se llena en segundo plano con las MISMAS
// claves y funciones de las rutas. Si una clave del precalentado no fuera
// exactamente la de su ruta, abrir la ruta agregaria una entrada nueva: aqui
// se comprueba que, ya precalentado, ninguna ruta de opciones agrega claves
// (ni como admin, que ve asesores, ni como cliente, que no). Datos sinteticos.
'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { app, db, request, tokenFor, MASTER_PASSWORD, SEED, cleanup } = require('./helpers');
const { tamanoCache } = require('../cache-opciones');
const pre = require('../opciones-precalentar');
const { leerRegistro } = require('../clientes-registro');

after(cleanup);
const auth = (t) => ({ Authorization: 'Bearer ' + t });

const RUTAS = [
  'agendas/opciones', 'agendas-usuaria/opciones', 'calidad-resumen/opciones',
  'efectividad-agendamiento/opciones', 'efectividad-citas/opciones', 'flujo-hora/opciones',
  'inasistencia/opciones', 'salida/opciones', 'tipificacion/meses',
  'tipificacion/opciones?canal=LLAMADAS', 'tipificacion/opciones?canal=WHATSAPP',
  'whatsapp-tiempos/opciones', 'encuestas/opciones', 'llamadas-salida/opciones',
  'llamadas-unicas/opciones',
];

test('ya precalentado, abrir cada ruta de opciones de cada cliente no agrega claves', async () => {
  const clientes = leerRegistro(db).map((c) => c.nombre);
  assert.ok(clientes.includes('ORLANT') && clientes.includes('MOBILIZE'));
  const n = pre.precalentarYa(db);
  assert.equal(n, clientes.length * 18, '18 consultas por cliente');
  const antes = tamanoCache(db);
  assert.equal(antes, n, 'una entrada por consulta, sin claves repetidas');

  const tokens = [await tokenFor('admin', MASTER_PASSWORD), await tokenFor('agomez', SEED.agomez)];
  let atendidas = 0;
  for (const t of tokens) {
    for (const c of clientes) {
      for (const ruta of RUTAS) {
        const url = '/api/calidad/' + ruta + (ruta.includes('?') ? '&' : '?') + 'campana=' + encodeURIComponent(c);
        const r = await request(app).get(url).set(auth(t));
        assert.ok([200, 403].includes(r.status), url + ' -> ' + r.status + ' ' + JSON.stringify(r.body));
        if (r.status === 200) atendidas++;
        assert.equal(tamanoCache(db), antes, 'la ruta ' + url + ' uso una clave que el precalentado no lleno');
      }
    }
  }
  assert.ok(atendidas >= RUTAS.length * clientes.length + RUTAS.length, 'el admin y el cliente sí abrieron rutas');
});

test('el resultado precalentado es el mismo que calcula la ruta', async () => {
  const t = await tokenFor('admin', MASTER_PASSWORD);
  const r = await request(app).get('/api/calidad/llamadas-unicas/opciones?campana=ORLANT').set(auth(t));
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, require('../llamadas-unicas').llamadasUnicasOpciones(db, 'ORLANT', { incluirAgentes: true }));
});

test('en segundo plano: no corre nada al llamarlo y termina solo, sin errores', async () => {
  const mensajes = [], errores = [];
  const log = { log: (m) => mensajes.push(m), error: (...a) => errores.push(a.join(' ')) };
  const cancelar = pre.precalentarEnSegundoPlano(db, { demoraMs: 0, pausaMs: 0, log });
  assert.equal(mensajes.length, 0, 'no calcula nada de forma sincronica');
  for (let i = 0; i < 500 && mensajes.length === 0; i++) await new Promise((res) => setTimeout(res, 10));
  cancelar();
  assert.equal(mensajes.length, 1, 'avisa al terminar');
  assert.match(mensajes[0], /cache de opciones lista: \d+ consultas/);
  assert.deepEqual(errores, []);
});

test('una consulta que falla se registra y no corta las demas', async () => {
  const mensajes = [], errores = [];
  let despues = 0;
  const lista = [
    { clave: '["f294-falla"]', calcular: () => { throw new Error('falla a proposito'); } },
    { clave: '["f294-ok"]', calcular: () => { despues++; return 1; } },
  ];
  pre.precalentarEnSegundoPlano(db, { demoraMs: 0, pausaMs: 0, lista, log: { log: (m) => mensajes.push(m), error: (...a) => errores.push(a.join(' ')) } });
  for (let i = 0; i < 200 && mensajes.length === 0; i++) await new Promise((res) => setTimeout(res, 10));
  assert.equal(despues, 1, 'la siguiente consulta corrio');
  assert.equal(errores.length, 1);
  assert.match(errores[0], /f294-falla.*falla a proposito/);
  assert.match(mensajes[0], /2 consultas en \d+ ms, 1 con error/);
});

test('cancelar antes de empezar: no calcula nada', async () => {
  const mensajes = [];
  const cancelar = pre.precalentarEnSegundoPlano(db, { demoraMs: 5, pausaMs: 0, log: { log: (m) => mensajes.push(m), error: () => {} } });
  cancelar();
  await new Promise((res) => setTimeout(res, 30));
  assert.deepEqual(mensajes, []);
});
