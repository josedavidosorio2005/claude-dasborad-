// fase222-sura-inicial-lista-blanca.test.js — Fase 222 (revision del 3-nov,
// S1): de la base inicial de SURA solo se guardan y se entregan las columnas
// que usa el tablero. Una base con nombre, telefono, correo y direccion no
// los devuelve al rol CLIENTES_DASH (ni los guarda), y una base montada antes
// de la lista blanca tampoco se los entrega al cliente. Datos 100 % sinteticos.
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { app, db, request, tokenFor, MASTER_PASSWORD } = require('./helpers');
const sura = require('../sura-televentas');
const { XLSX } = require('./helpers/sura-sinteticos');

const API = '/api/sura-televentas/SURA';
const auth = (t) => ({ Authorization: 'Bearer ' + t });
let tAdmin, tCliente;

function stub() {
  return new Proxy(function () {}, {
    get: (t, k) => (k === 'forEach' ? () => {} : k === Symbol.toPrimitive ? () => '' : stub()),
    set: () => true,
    apply: () => stub(),
  });
}
global.XLSX = XLSX;
global.document = stub();
const { stvCrearApp } = require('../../public/js/sura-televentas-app.js');
const leer = stvCrearApp(stub(), {}, () => false).leer;

// Las 10 columnas que usa el tablero (INIF) + 6 con datos personales.
const USADAS = ['tipo_documento', 'sexo', 'edad', 'ingresos', 'estado_civil', 'ocupacion', 'ciudad', 'departamento',
  'rango_saldo_promedio', 'categoria_percentil'];
const PERSONALES = ['Nombre completo', 'Teléfono', 'Celular', 'Correo electrónico', 'Dirección', 'Fecha de nacimiento'];
const PERSONALES_K = ['nombre_completo', 'telefono', 'celular', 'correo_electronico', 'direccion', 'fecha_de_nacimiento'];
const MARCAS = ['Persona Sintetica', '3009990000', 'sintetico@example.invalid', 'Calle Falsa 123'];

function libroConPersonales(n = 30) {
  const H = ['identificacion', ...USADAS.slice(0, 5), PERSONALES[0], USADAS[5], PERSONALES[1], PERSONALES[2],
    USADAS[6], USADAS[7], PERSONALES[3], PERSONALES[4], USADAS[8], USADAS[9], PERSONALES[5]];
  const filas = [H];
  for (let i = 0; i < n; i++) {
    filas.push([String(8100000000 + i), 'CC', i % 2 ? 'F' : 'M', 20 + i, 1000000 + i, 'S', MARCAS[0] + ' ' + i, 'E',
      MARCAS[1], '310' + i, 'Medellin', 'Antioquia', MARCAS[2], MARCAS[3], '1M-3M', String(1 + (i % 4)), '1990-01-0' + (1 + (i % 9))]);
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(filas), 'base');
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
}

function sinPersonales(body, quien) {
  const ks = body.cols.map((c) => c.k);
  for (const k of PERSONALES_K) assert.ok(!ks.includes(k), `${quien} recibio la columna ${k}`);
  const texto = JSON.stringify(body);
  for (const m of MARCAS) assert.ok(!texto.includes(m), `${quien} recibio un valor personal`);
  return ks;
}

before(async () => {
  tAdmin = await tokenFor('admin', MASTER_PASSWORD);
  db.prepare(
    `INSERT INTO users (nombre, user, rol, active, password_hash, perms, createdAt, debe_cambiar_password)
     VALUES (?,?,?,1,?,?,?,0)`
  ).run('Prueba cliente 222', 'sura_cli222', 'CLIENTES_DASH', bcrypt.hashSync('Clave#2026x', 4),
    JSON.stringify({ ClientesDash: true, cliente_SURA: true }), new Date().toISOString());
  tCliente = await tokenFor('sura_cli222', 'Clave#2026x');
});

test('una base inicial con nombre, telefono, correo y direccion no los guarda ni se los devuelve al cliente', async () => {
  const buf = libroConPersonales();
  const datos = leer.parseIni(new Uint8Array(buf));
  // El navegador si los lee del Excel (16 columnas): el filtro es del servidor.
  assert.equal(datos.cols.length, USADAS.length + PERSONALES.length);
  const r = await request(app).post(`${API}/bases/inicial/2026-05`).set(auth(tAdmin))
    .send({ archivoNombre: 'inicial_mayo.xlsx', archivo: buf.toString('base64'), datos });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  assert.equal(r.body.registros, 30);

  const cli = await request(app).get(`${API}/bases/inicial/2026-05`).set(auth(tCliente));
  assert.equal(cli.status, 200);
  assert.deepEqual(sinPersonales(cli.body, 'el cliente'), USADAS);
  assert.equal(cli.body.ids.length, 30);
  assert.ok(cli.body.ids.every((x) => /^c[\w-]{18}$/.test(x)), 'cedulas seudonimizadas');

  // Tampoco quedaron guardadas: el administrador recibe las mismas 10.
  const adm = await request(app).get(`${API}/bases/inicial/2026-05`).set(auth(tAdmin));
  assert.deepEqual(sinPersonales(adm.body, 'el administrador'), USADAS);
});

test('una base montada antes de la lista blanca: el cliente no recibe las columnas que sobran', async () => {
  const buf = libroConPersonales(12);
  const datos = leer.parseIni(new Uint8Array(buf));
  // Se guarda como antes (sin pasar por validarCarga), con las 16 columnas.
  sura.guardarBase(db, { cliente: 'SURA', tipo: 'inicial', mes: '2026-04', archivoNombre: 'vieja.xlsx', datos, archivo: buf, actorNombre: 'prueba' });

  const cli = await request(app).get(`${API}/bases/inicial/2026-04`).set(auth(tCliente));
  assert.equal(cli.status, 200);
  assert.deepEqual(sinPersonales(cli.body, 'el cliente'), USADAS);
  // Los valores de las columnas que quedan no cambian.
  const adm = await request(app).get(`${API}/bases/inicial/2026-04`).set(auth(tAdmin));
  assert.equal(adm.body.cols.length, 16);
  for (const c of cli.body.cols) assert.deepEqual(c, adm.body.cols.find((x) => x.k === c.k));
});
