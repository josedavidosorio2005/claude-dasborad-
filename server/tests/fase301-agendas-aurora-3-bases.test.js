// fase301-agendas-aurora-3-bases.test.js — Fase 301 (09/11/2026): "Agendas por
// usuaria" de Clinica Aurora recibe 3 bases con los MISMOS encabezados en
// DISTINTO orden. Cada columna se ubica por nombre (sin importar mayusculas,
// tildes ni espacios), con un mapa configurable de sinonimos; las bases se unen
// guardando de cual vino cada fila; una columna obligatoria que falta da un error
// con la columna y el archivo. La pestaña se calcula igual que antes.
// Todo con archivos SINTETICOS (sin pacientes reales).
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');
const XLSX = require(path.join(__dirname, '..', '..', 'public', 'js', 'vendor', 'xlsx-0.20.3.full.min.js'));
const L = require('../../public/js/agendas-usuaria-logic.js');

const AURORA = 'CLINICA AURORA';
const API = '/api/calidad/agendas-usuaria';
const H = (t) => ({ Authorization: 'Bearer ' + t });
let admin;
before(async () => { admin = await tokenFor('admin', MASTER_PASSWORD); });

// Cabecera "real" de siempre + una columna con dato de paciente que NUNCA se lee.
const CAMPOS = ['fechacita', 'fecha_registro', 'usuario_confirma', 'nombresede', 'especial', 'paciente_ficticio'];
function filaCita(i, usuario) {
  return { fechacita: '2026-10-' + String(1 + (i % 28)).padStart(2, '0'), fecha_registro: '2026-09-' + String(1 + (i % 28)).padStart(2, '0'),
    usuario_confirma: usuario, nombresede: 'SEDE ' + (i % 2 ? 'NORTE' : 'SUR'), especial: i % 3 ? 'MEDICINA GENERAL' : 'PEDIATRIA',
    paciente_ficticio: 'Paciente Ficticio ' + i };
}
// Libro .xlsx con los encabezados dados (en ese orden) y n citas, leido de vuelta
// con las MISMAS opciones que el navegador (cellNF, sheet_to_json header:1).
function libro(encabezados, claves, n, usuario, titulo) {
  const aoa = [];
  if (titulo) aoa.push([titulo]); // una fila de titulo antes del encabezado (como el reporte real)
  aoa.push(encabezados);
  for (let i = 0; i < n; i++) { const f = filaCita(i, usuario); aoa.push(claves.map((k) => f[k])); }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'REPORTE');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const leido = XLSX.read(new Uint8Array(buf), { type: 'array', sheetStubs: true, cellNF: true });
  return XLSX.utils.sheet_to_json(leido.Sheets.REPORTE, { header: 1, blankrows: false, defval: null });
}
const orden1 = CAMPOS.slice();
const orden2 = ['especial', 'paciente_ficticio', 'nombresede', 'fechacita', 'usuario_confirma', 'fecha_registro'];
const orden3 = ['usuario_confirma', 'especial', 'fecha_registro', 'paciente_ficticio', 'fechacita', 'nombresede'];
// Mismos encabezados, escritos distinto: mayusculas, tildes, espacios de mas, sin guion bajo.
const ESCRITURA = { fechacita: '  FECHACITA ', fecha_registro: 'Fecha Registro', usuario_confirma: 'USUARIO  CONFIRMA', nombresede: 'NombreSede',
  especial: 'Especiál', paciente_ficticio: 'Paciente' };

test('el mapa de encabezados es configurable: cada campo con sus sinonimos, la base de siempre primero', () => {
  assert.deepEqual(L.AU_MAPA_ENCABEZADOS.map((c) => c.key), ['fechacita', 'fecha_registro', 'usuario_confirma', 'nombresede', 'especial']);
  L.AU_MAPA_ENCABEZADOS.forEach((c) => {
    assert.equal(c.sinonimos[0], c.key, c.key + ': el nombre de siempre va primero (manda sobre los genericos)');
    assert.ok(c.etiqueta && c.obligatoria === true);
  });
  assert.deepEqual(L.AU_TIPOS_BASE.map((b) => b.id), ['base1', 'base2', 'base3']);
  assert.deepEqual(L.AU_COLUMNAS, L.AU_MAPA_ENCABEZADOS.map((c) => ({ key: c.key, obligatoria: c.obligatoria })), 'AU_COLUMNAS sale del mapa');
});

test('normalizacion: sin importar mayusculas, tildes, espacios, guiones bajos ni puntos', () => {
  for (const [a, b] of [['  FECHA_DE  CITA ', 'fecha de cita'], ['Especiál', 'especial'], ['Nombre.Sede', 'nombre sede'], ['usuario-confirma', 'usuario confirma']]) {
    assert.equal(L.auNormEncabezado(a), b, a);
  }
});

test('la misma base con las columnas en 3 ordenes distintos da EXACTAMENTE el mismo resultado', () => {
  const r1 = L.auParseFilas(libro(orden1, orden1, 30, 'INCONEXION A'));
  const r2 = L.auParseFilas(libro(orden2, orden2, 30, 'INCONEXION A'));
  const r3 = L.auParseFilas(libro(orden3.map((k) => ESCRITURA[k]), orden3, 30, 'INCONEXION A', 'Reporte de citas sintetico'));
  for (const r of [r1, r2, r3]) assert.equal(r.error, undefined, r.error);
  const ordenar = (f) => f.map((x) => JSON.stringify(x)).sort();
  assert.deepEqual(ordenar(r2.filas), ordenar(r1.filas));
  assert.deepEqual(ordenar(r3.filas), ordenar(r1.filas), 'escrito distinto y con fila de titulo arriba');
  assert.equal(r1.citas, 30);
  assert.ok(r1.filas.every((f) => !('base' in f)), 'sin opts: igual que antes, sin base');
  assert.ok(!JSON.stringify(r1.filas).includes('Paciente Ficticio'), 'la columna del paciente nunca se lee');
});

test('un sinonimo generico no le gana al nombre de siempre (sede vs nombresede)', () => {
  const enc = ['sede', 'fechacita', 'fecha_registro', 'usuario_confirma', 'nombresede', 'especial'];
  const aoa = [enc, ['COD-01', '2026-10-05', '2026-09-30', 'INCONEXION', 'SEDE REAL', 'PEDIATRIA']];
  const r = L.auParseFilas(aoa);
  assert.equal(r.filas[0].sede, 'SEDE REAL');
  // Si solo viene el generico, se usa.
  const r2 = L.auParseFilas([['Sede', 'Fecha de cita', 'Fecha de solicitud', 'Usuario que confirma', 'Especialidad'], ['SEDE X', '2026-10-05', '2026-09-30', 'INCONEXION', 'PEDIATRIA']]);
  assert.equal(r2.error, undefined, r2.error);
  assert.equal(r2.filas[0].sede, 'SEDE X');
});

test('unir 3 bases: un solo conjunto, cada fila con su base', () => {
  const u = L.auUnirBases([
    { base: 'base1', archivo: 'b1.xlsx', aoa: libro(orden1, orden1, 10, 'INCONEXION A') },
    { base: 'base2', archivo: 'b2.xlsx', aoa: libro(orden2, orden2, 20, 'INCONEXION B') },
    { base: 'base3', archivo: 'b3.xlsx', aoa: libro(orden3.map((k) => ESCRITURA[k]), orden3, 5, 'INCONEXION') },
  ]);
  assert.equal(u.error, undefined, u.error);
  assert.equal(u.citas, 35);
  assert.deepEqual(Object.keys(u.porBase).sort(), ['base1', 'base2', 'base3']);
  assert.deepEqual([u.porBase.base1.citas, u.porBase.base2.citas, u.porBase.base3.citas], [10, 20, 5]);
  assert.ok(u.filas.every((f) => L.AU_TIPOS_BASE.some((b) => b.id === f.base)), 'toda fila sabe de que base vino');
  const suma = (b) => u.filas.filter((f) => f.base === b).reduce((s, f) => s + f.n, 0);
  assert.deepEqual([suma('base1'), suma('base2'), suma('base3')], [10, 20, 5]);
  // Una sola base tambien vale.
  const una = L.auUnirBases([{ base: 'base2', archivo: 'b2.xlsx', aoa: libro(orden2, orden2, 4, 'INCONEXION B') }]);
  assert.equal(una.error, undefined);
  assert.equal(una.citas, 4);
});

test('falta una columna obligatoria: error claro con la columna y el archivo, y no se une nada', () => {
  const sinSede = orden2.filter((k) => k !== 'nombresede');
  const u = L.auUnirBases([
    { base: 'base1', archivo: 'b1.xlsx', aoa: libro(orden1, orden1, 3, 'INCONEXION') },
    { base: 'base2', archivo: 'octubre-base2.xlsx', aoa: libro(sinSede, sinSede, 3, 'INCONEXION') },
  ]);
  assert.ok(u.error);
  assert.deepEqual(u.filas, [], 'no se guarda a medias');
  assert.equal(u.errores.length, 1);
  assert.match(u.errores[0], /octubre-base2\.xlsx/);
  assert.match(u.errores[0], /Base 2/);
  assert.match(u.errores[0], /falta la columna «Sede»/);
  assert.match(u.errores[0], /nombresede/, 'dice como se busca');
  // Dos que faltan, en plural; la misma base dos veces; ningun archivo.
  const sinDos = orden1.filter((k) => k !== 'fechacita' && k !== 'especial');
  assert.match(L.auUnirBases([{ base: 'base3', archivo: 'x.xlsx', aoa: libro(sinDos, sinDos, 2, 'INCONEXION') }]).error, /faltan las columnas «Fecha de cita».*«Especialidad»/);
  assert.match(L.auUnirBases([{ base: 'base1', archivo: 'a.xlsx', aoa: libro(orden1, orden1, 1, 'INCONEXION') }, { base: 'base1', archivo: 'b.xlsx', aoa: libro(orden1, orden1, 1, 'INCONEXION') }]).error, /Base 1 viene dos veces/);
  assert.match(L.auUnirBases([]).error, /Elige al menos un archivo/);
  assert.match(L.auUnirBases([{ base: 'otra', archivo: 'z.xlsx', aoa: [] }]).error, /no tiene una base válida/);
});

test('servidor: cada base reemplaza SOLO lo suyo; la carga de siempre (sin base) sigue reemplazando el mes entero', async () => {
  const mes = '2026-10';
  const total = async () => {
    const d = await request(app).get(API + '/datos?campana=' + encodeURIComponent(AURORA)).set(H(admin));
    assert.equal(d.status, 200);
    return d.body.filas.filter((f) => f.mes === mes).reduce((s, f) => s + f.n, 0);
  };
  const enviar = (filas) => request(app).post(API + '/carga').set(H(admin)).send({ campana: AURORA, archivoNombre: 'sintetico.xlsx', filas });
  const porBase = () => Object.fromEntries(db.prepare('SELECT base, SUM(n) AS n FROM agendas_usuaria WHERE campana = ? AND mes = ? GROUP BY base').all(AURORA, mes).map((r) => [r.base, r.n]));
  // 1) Carga de siempre (un archivo, sin base): 7 citas.
  assert.equal((await enviar(L.auParseFilas(libro(orden1, orden1, 7, 'INCONEXION')).filas)).status, 201);
  assert.equal(await total(), 7);
  // 2) Base 1 y Base 2 juntas: reemplazan lo de antes (sin base) y quedan las 2.
  const u = L.auUnirBases([
    { base: 'base1', archivo: 'b1.xlsx', aoa: libro(orden1, orden1, 10, 'INCONEXION A') },
    { base: 'base2', archivo: 'b2.xlsx', aoa: libro(orden2, orden2, 20, 'INCONEXION B') },
  ]);
  const imp = await request(app).post(API + '/carga/impacto').set(H(admin)).send({ campana: AURORA, filas: u.filas });
  assert.equal(imp.status, 200);
  const im = imp.body.meses.find((m) => m.mes === mes);
  assert.deepEqual(im.bases, ['base1', 'base2']);
  assert.equal(im.citasExistentes, 7, 'reemplaza lo cargado sin base');
  const r = await enviar(u.filas);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.deepEqual(r.body.porBase, { base1: 10, base2: 20 });
  assert.deepEqual(porBase(), { base1: 10, base2: 20 });
  assert.equal(await total(), 30, 'la pestaña suma igual que antes');
  // 3) Solo Base 3: se agrega sin tocar la 1 ni la 2.
  const u3 = L.auUnirBases([{ base: 'base3', archivo: 'b3.xlsx', aoa: libro(orden3, orden3, 5, 'INCONEXION') }]);
  assert.equal((await enviar(u3.filas)).status, 201);
  assert.deepEqual(porBase(), { base1: 10, base2: 20, base3: 5 });
  // 4) Base 2 otra vez (corregida): solo cambia la 2.
  const u2 = L.auUnirBases([{ base: 'base2', archivo: 'b2-bis.xlsx', aoa: libro(orden2, orden2, 8, 'INCONEXION B') }]);
  const imp2 = (await request(app).post(API + '/carga/impacto').set(H(admin)).send({ campana: AURORA, filas: u2.filas })).body.meses.find((m) => m.mes === mes);
  assert.equal(imp2.citasExistentes, 20);
  assert.equal((await enviar(u2.filas)).status, 201);
  assert.deepEqual(porBase(), { base1: 10, base2: 8, base3: 5 });
  assert.equal(await total(), 23);
  // 5) La carga de siempre (sin base) vuelve a reemplazar el mes entero.
  const imp3 = (await request(app).post(API + '/carga/impacto').set(H(admin)).send({ campana: AURORA, filas: L.auParseFilas(libro(orden1, orden1, 4, 'INCONEXION')).filas })).body.meses.find((m) => m.mes === mes);
  assert.equal(imp3.bases, undefined, 'sin el campo: el mes entero, como siempre');
  assert.equal(imp3.citasExistentes, 23);
  assert.equal((await enviar(L.auParseFilas(libro(orden1, orden1, 4, 'INCONEXION')).filas)).status, 201);
  assert.deepEqual(porBase(), { '': 4 });
  // La base no sale en la lectura de la pestaña (la vista no cambia).
  const d = await request(app).get(API + '/datos?campana=' + encodeURIComponent(AURORA)).set(H(admin));
  assert.ok(d.body.filas.every((f) => !('base' in f)));
});

test('servidor: una base desconocida o campos de mas se rechazan (400)', async () => {
  const fila = { mes: '2026-11', fechaCita: '2026-11-03', fechaSolicitud: '', sede: 'S', usuario: 'INCONEXION', especialidad: 'E', n: 1 };
  assert.equal((await request(app).post(API + '/carga').set(H(admin)).send({ campana: AURORA, filas: [{ ...fila, base: 'base9' }] })).status, 400);
  assert.equal((await request(app).post(API + '/carga').set(H(admin)).send({ campana: AURORA, filas: [{ ...fila, base: 'base1', paciente: 'x' }] })).status, 400);
  assert.equal((await request(app).post(API + '/carga').set(H(admin)).send({ campana: AURORA, filas: [{ ...fila, base: 'base1' }] })).status, 201);
});

test('la columna base es nueva (ADD COLUMN) y la migracion quedo registrada', () => {
  const cols = db.prepare('PRAGMA table_info(agendas_usuaria)').all().map((c) => c.name);
  assert.ok(cols.includes('base'));
  assert.ok(db.prepare("SELECT 1 FROM schema_migrations WHERE name = 'fase301_agendas_usuaria_base_v1'").get());
});

test('front: el Centro abre la ventana de bases SOLO para Agendas por usuaria; la ventana lee por nombre y une', () => {
  const cc = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'centro-cargas.js'), 'utf8');
  assert.ok(cc.includes("if (c.id === 'agendas_usuaria' && typeof auAbrirCargaBases === 'function') { auAbrirCargaBases(_cc.cliente, x.mes); return; }"));
  const au = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'agendas-usuaria.js'), 'utf8');
  assert.match(au, /function auAbrirCargaBases\(cliente, mes\)/);
  assert.match(au, /AU_TIPOS_BASE\.map/);
  assert.match(au, /auUnirBases\(partes\)/);
  assert.match(au, /XLSX\.read\(new Uint8Array\(await _auLeerArchivo\(f\)\), \{ type: 'array', sheetStubs: true, cellNF: true \}\)/, 'mismas opciones que Cargar Datos');
});
