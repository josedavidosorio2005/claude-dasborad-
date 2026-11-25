// faseEQ5-equidad-por-mes.test.js — Pedido de Edwin (26/11/2026, para el 27/11): «Equidad profesionales» por mes.
//  - cada base se carga POR MES; subir un mes NO borra los anteriores; «Reemplazar» cambia solo esa base en ese mes;
//  - una cita de otro mes rechaza la carga (todo o nada) y dice de qué meses son;
//  - la migración asigna lo ya cargado a su mes por la fecha de la cita, sin perder nada, y se puede repetir;
//  - el dashboard filtra por MESES (un mes, varios o «Todos» = acumulado).
// Datos INVENTADOS (sedes, profesionales y entidades ficticias; fechas de 2031).
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');
const EQ = require('../orlant-equidad');
const L = require('../../public/js/equidad-logic.js');

const H = (t) => ({ Authorization: 'Bearer ' + t });
const B = '/api/orlant/equidad';
let admin;
const filas = (n, mes, conEnt) => Array.from({ length: n }, (_, i) => Object.assign({ sede: 'SEDE FICTICIA', esp: 'ESP INVENTADA', prof: 'DR INVENTADO ' + (i % 3), fecha: mes + '-' + String((i % 27) + 1).padStart(2, '0') }, conEnt === false ? {} : { ent: 'ENTIDAD FICTICIA' }));
const cargar = (grupo, mes, f, nombre) => request(app).post(B + '/cargas/' + grupo).set(H(admin)).send({ mes, archivoNombre: nombre || grupo + '-' + mes + '.xlsx', filas: f });
const contar = (grupo, mes) => db.prepare('SELECT COUNT(*) n FROM equidad_citas WHERE grupo = ? AND mes = ?').get(grupo, mes).n;

before(async () => { admin = await tokenFor('admin', MASTER_PASSWORD); });

test('cargar dos meses de la misma base NO borra el primero', async () => {
  let r = await cargar('polizas', '2031-03', filas(10, '2031-03'));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.mes, r.body.filas, r.body.reemplazadas], ['2031-03', 10, 0]);
  r = await cargar('polizas', '2031-04', filas(7, '2031-04'));
  assert.equal(r.status, 200);
  assert.deepEqual([contar('polizas', '2031-03'), contar('polizas', '2031-04')], [10, 7]);
});

test('«Reemplazar» un mes cambia solo esa base en ese mes; los demás meses y las otras bases no se tocan', async () => {
  assert.equal((await cargar('prepagada', '2031-03', filas(5, '2031-03'))).status, 200);
  const r = await cargar('polizas', '2031-03', filas(4, '2031-03'), 'polizas-marzo-v2.xlsx');
  assert.deepEqual([r.body.filas, r.body.reemplazadas], [4, 10]);
  assert.deepEqual([contar('polizas', '2031-03'), contar('polizas', '2031-04'), contar('prepagada', '2031-03')], [4, 7, 5]);
  const res = (await request(app).get(B + '/resumen').set(H(admin))).body;
  const pol = res.grupos.find((g) => g.id === 'polizas');
  assert.deepEqual(pol.meses.map((m) => [m.mes, m.citas, m.archivo]), [['2031-04', 7, 'polizas-2031-04.xlsx'], ['2031-03', 4, 'polizas-marzo-v2.xlsx']]);
  assert.equal(pol.citas, 11);
});

test('una cita de otro mes rechaza la carga (todo o nada) y dice de qué meses son; sin mes, 400', async () => {
  const mezcla = filas(3, '2031-05').concat(filas(2, '2031-06'));
  const r = await cargar('polizas', '2031-05', mezcla);
  assert.equal(r.status, 400);
  assert.match(r.body.error, /2 citas no son de 2031-05 \(2031-06: 2\)/);
  assert.equal(contar('polizas', '2031-05'), 0, 'no se cargó nada');
  assert.equal((await request(app).post(B + '/cargas/polizas').set(H(admin)).send({ filas: filas(1, '2031-05') })).status, 400);
  assert.equal((await cargar('polizas', '2031-13', filas(1, '2031-05'))).status, 400);
  // Particulares sigue sin guardar la entidad.
  assert.equal((await cargar('particulares', '2031-03', filas(2, '2031-03', true))).status, 200);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM equidad_citas WHERE grupo = 'particulares' AND entidad <> ''").get().n, 0);
});

test('estado: trae todas las citas y la lista de meses para el selector MESES del tablero', async () => {
  const e = (await request(app).get(B + '/estado').set(H(admin))).body;
  assert.deepEqual(e.meses, ['2031-03', '2031-04']);
  assert.equal(e.grupos.find((g) => g.id === 'polizas').filas.length, 11);
});

test('dashboard (app generada): filtro «Mes» que arranca en el último mes cargado; «Todos» = acumulado', async () => {
  const A = require('../../public/js/orlant-equidad-app.js');
  const e = (await request(app).get(B + '/estado').set(H(admin))).body;
  const ap = A.eqCrearApp({ querySelector: () => null, querySelectorAll: () => [] }, { estado: async () => e });
  ap.aplicar(e);
  const T = ap.state.tabs.poliza;
  assert.equal(T.f.mes, '2031-04', 'por defecto, el último mes cargado');
  assert.equal(ap.filtered(T).length, 7);
  T.f.mes = '2031-03';
  assert.equal(ap.filtered(T).length, 4);
  T.f.mes = '';
  assert.equal(ap.filtered(T).length, 11, 'todos los meses (acumulado)');
  assert.equal(ap.state.tabs.base3.f.mes, '2031-03', 'cada base con su último mes');
  assert.match(A.EQ_MARKUP + require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'public', 'js', 'orlant-equidad-app.js'), 'utf8'), /<div class="field"><label>Mes<\/label><select data-f="mes" aria-label="Mes">\$\{eqOpcionesMes\(T,f\.mes\)\}<\/select><\/div>/);
});

test('migración: lo cargado ANTES de «por mes» queda asignado a su mes por la fecha de la cita, sin perder nada; repetible', () => {
  const m = new Database(':memory:');
  // Esquema anterior (24/11): sin columna mes, una carga por base.
  m.exec(`CREATE TABLE equidad_citas (id INTEGER PRIMARY KEY AUTOINCREMENT, grupo TEXT NOT NULL, sede TEXT NOT NULL, especialidad TEXT NOT NULL, profesional TEXT NOT NULL, fecha TEXT NOT NULL, entidad TEXT NOT NULL DEFAULT '');
    CREATE TABLE equidad_cargas (grupo TEXT PRIMARY KEY, archivoNombre TEXT NOT NULL DEFAULT '', hoja TEXT NOT NULL DEFAULT '', filas INTEGER NOT NULL, cargadoEn TEXT NOT NULL, cargadoPor TEXT NOT NULL DEFAULT '');`);
  const ins = m.prepare('INSERT INTO equidad_citas (grupo, sede, especialidad, profesional, fecha, entidad) VALUES (?,?,?,?,?,?)');
  for (let i = 0; i < 6; i++) ins.run('polizas', 'S', 'E', 'P' + i, '2031-10-0' + (i + 1), 'ENT');
  for (let i = 0; i < 4; i++) ins.run('prepagada', 'S', 'E', 'P' + i, i < 3 ? '2031-10-1' + i : '2031-11-02', 'ENT'); // un archivo con 2 meses
  m.prepare("INSERT INTO equidad_cargas VALUES ('polizas', 'polizas-oct.xlsx', 'H', 6, '2031-11-01T10:00:00Z', 'Prueba')").run();
  m.prepare("INSERT INTO equidad_cargas VALUES ('prepagada', 'prepagada.xlsx', 'H', 4, '2031-11-05T10:00:00Z', 'Prueba')").run();
  const antes = m.prepare('SELECT grupo, sede, especialidad, profesional, fecha, entidad FROM equidad_citas ORDER BY id').all();
  EQ.asegurarTablas(m);
  EQ.asegurarTablas(m); // repetible
  const despues = m.prepare('SELECT grupo, sede, especialidad, profesional, fecha, entidad FROM equidad_citas ORDER BY id').all();
  assert.deepEqual(despues, antes, 'ninguna cita se pierde ni cambia');
  assert.equal(m.prepare("SELECT COUNT(*) n FROM equidad_citas WHERE mes = ''").get().n, 0);
  assert.deepEqual(m.prepare('SELECT grupo, mes, filas, archivoNombre FROM equidad_cargas_mes ORDER BY grupo, mes').all().map((r) => [r.grupo, r.mes, r.filas, r.archivoNombre]),
    [['polizas', '2031-10', 6, 'polizas-oct.xlsx'], ['prepagada', '2031-10', 3, 'prepagada.xlsx'], ['prepagada', '2031-11', 1, 'prepagada.xlsx']]);
  const res = EQ.resumen(m);
  assert.deepEqual(res.grupos.find((g) => g.id === 'prepagada').meses.map((x) => [x.mes, x.citas]), [['2031-11', 1], ['2031-10', 3]]);
  // Después de migrar, cargar un mes nuevo no toca octubre.
  EQ.cargar(m, 'polizas', { mes: '2031-12', filas: filas(2, '2031-12') }, 'Prueba');
  assert.equal(m.prepare("SELECT COUNT(*) n FROM equidad_citas WHERE grupo = 'polizas' AND mes = '2031-10'").get().n, 6);
  m.close();
});

test('navegador: la cuadrícula de meses del año con «Subir» o «Reemplazar» por mes', () => {
  global.esc = require('../../public/js/esc.js').esc;
  Object.assign(global, require('../../public/js/centro-cargas-logic.js'));
  const C = require('../../public/js/centro-equidad.js');
  const meses = C.ccEquidadMesesDelAnio({ meses: [{ mes: '2031-03', citas: 4, archivo: 'a.xlsx', cargadoEn: '', cargadoPor: '' }] }, 2031);
  assert.equal(meses.length, 12);
  assert.deepEqual([meses[2].mes, meses[2].registros, meses[3].registros], ['2031-03', 4, 0]);
});
