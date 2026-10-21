// fase158-cache-opciones.test.js — Fase 158: cache en memoria de las
// consultas de "opciones" (cache-opciones.js). Una lectura repetida sin
// cambios en la base no vuelve a consultar; cargar, eliminar un mes y
// deshacer la invalidan (lo que muestra el desplegable sigue siendo
// exactamente lo que hay en la base). Datos 100% sinteticos.
'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const { app, db, request, tokenFor, MASTER_PASSWORD, cleanup } = require('./helpers');
const { opcionesConCache } = require('../cache-opciones');
const { llamadasUnicasOpciones } = require('../llamadas-unicas');

after(cleanup);
const auth = (t) => ({ Authorization: 'Bearer ' + t });

test('sin cambios en la base, la segunda lectura sale de la cache (no recalcula) y es una copia', () => {
  const mem = new Database(':memory:');
  mem.exec('CREATE TABLE t (campana TEXT, v TEXT)');
  mem.prepare('INSERT INTO t VALUES (?, ?)').run('A', 'uno');
  let calculos = 0;
  const leer = () => opcionesConCache(mem, 'k', () => { calculos++; return { vs: mem.prepare('SELECT v FROM t').all().map((r) => r.v) }; });

  const a = leer();
  const b = leer();
  assert.equal(calculos, 1, 'la segunda lectura no vuelve a consultar');
  assert.deepEqual(b, { vs: ['uno'] });
  b.vs.push('modificado por quien llama');
  assert.deepEqual(leer(), { vs: ['uno'] }, 'cambiar lo devuelto no cambia lo guardado');
  assert.notEqual(a, b);

  mem.prepare('INSERT INTO t VALUES (?, ?)').run('A', 'dos');
  assert.deepEqual(leer(), { vs: ['uno', 'dos'] }, 'una escritura invalida');
  assert.equal(calculos, 2);
  mem.close();
});

test('una escritura de OTRA conexion a la misma base tambien invalida (data_version)', (t) => {
  const fs = require('fs'), os = require('os'), path = require('path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'f158-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const archivo = path.join(dir, 'x.db');
  const a = new Database(archivo); a.pragma('journal_mode = WAL');
  a.exec('CREATE TABLE t (v TEXT)');
  const b = new Database(archivo);
  const leer = () => opcionesConCache(a, 'k', () => a.prepare('SELECT COUNT(*) AS n FROM t').get().n);
  assert.equal(leer(), 0);
  b.prepare('INSERT INTO t VALUES (?)').run('x');
  assert.equal(leer(), 1);
  a.close(); b.close();
});

test('claves distintas no se mezclan (cliente, modulo, permiso)', () => {
  const mem = new Database(':memory:');
  assert.equal(opcionesConCache(mem, JSON.stringify(['m', 'A', true]), () => 'A-con'), 'A-con');
  assert.equal(opcionesConCache(mem, JSON.stringify(['m', 'A', false]), () => 'A-sin'), 'A-sin');
  assert.equal(opcionesConCache(mem, JSON.stringify(['m', 'B', true]), () => 'B-con'), 'B-con');
  assert.equal(opcionesConCache(mem, JSON.stringify(['m', 'A', true]), () => 'otro'), 'A-con');
  mem.close();
});

test('cargar, eliminar el mes y deshacer invalidan las opciones (Llamadas Unicas por HTTP)', async () => {
  const t = await tokenFor('admin', MASTER_PASSWORD);
  const C = 'MOBILIZE';
  const opciones = async () => {
    const r = await request(app).get('/api/calidad/llamadas-unicas/opciones?campana=' + C).set(auth(t));
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.deepEqual(r.body, llamadasUnicasOpciones(db, C, { incluirAgentes: true }), 'la cache devuelve lo mismo que la consulta directa');
    return r.body;
  };
  const subir = async (fecha, skill) => {
    const r = await request(app).post('/api/calidad/llamadas-unicas/carga').set(auth(t))
      .send({ campana: C, archivoNombre: 'f158.xlsx', filas: [['Asesor F158', fecha, 'CONTESTADA', skill]] });
    assert.equal(r.status, 201, JSON.stringify(r.body));
  };

  await subir('2026-03-05', 'SKILL F158 MARZO');
  const o1 = await opciones();
  assert.ok(o1.skills.includes('SKILL F158 MARZO'));
  assert.ok(!o1.meses.includes('2026-04'));
  assert.deepEqual(await opciones(), o1, 'sin cambios: igual');

  // 1) Cargar
  await subir('2026-04-07', 'SKILL F158 ABRIL');
  const o2 = await opciones();
  assert.ok(o2.skills.includes('SKILL F158 ABRIL'), 'cargar invalida');
  assert.ok(o2.meses.includes('2026-04'));

  // 2) Eliminar el mes desde el Centro de cargas
  const d = await request(app).delete('/api/centro-cargas/' + C + '/llamadas_unicas/2026-04').set(auth(t));
  assert.equal(d.status, 200, JSON.stringify(d.body));
  const o3 = await opciones();
  assert.ok(!o3.skills.includes('SKILL F158 ABRIL'), 'eliminar invalida');
  assert.ok(!o3.meses.includes('2026-04'));

  // 3) Deshacer la eliminacion
  const vs = (await request(app).get('/api/centro-cargas/' + C + '/versiones?carga=llamadas_unicas&mes=2026-04').set(auth(t))).body.versiones;
  const u = await request(app).post('/api/centro-cargas/versiones/' + vs[0].id + '/deshacer').set(auth(t));
  assert.equal(u.status, 200, JSON.stringify(u.body));
  const o4 = await opciones();
  assert.ok(o4.skills.includes('SKILL F158 ABRIL'), 'deshacer invalida');
  assert.ok(o4.meses.includes('2026-04'));
});
