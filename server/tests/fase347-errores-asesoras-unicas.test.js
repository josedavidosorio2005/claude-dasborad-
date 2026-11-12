// fase347-errores-asesoras-unicas.test.js — Fase 347 (B1, pedido del usuario 12/11):
// Aurora › Errores › «Agregar errores» mostraba dos veces a la misma asesora: el usuario
// ASESOR con el nombre pegado de una hoja de calculo («NOMBRE<tab>12656») y el nombre
// limpio de "Usuarios del sistema". Ahora sale una sola vez, con el nombre limpio, y lo
// guardado tambien queda limpio. ORLANT y Mobilize (lista de Calidad) eran la referencia.
// Nombres y codigos INVENTADOS.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');
const E = require('../errores');

const H = (t) => ({ Authorization: 'Bearer ' + t });
const AURORA = 'CLINICA AURORA';
let admin;

before(async () => {
  admin = await tokenFor('admin', MASTER_PASSWORD);
  const crear = async (nombre, user) => {
    const r = await request(app).post('/api/users').set(H(admin)).send({ nombre, user, password: 'Clave#Fase347x', rol: 'ASESOR', asesorCampana: AURORA, perms: {} });
    assert.equal(r.status, 201, JSON.stringify(r.body));
  };
  db.prepare("INSERT INTO alias_asesores (campana, alias, canonico, createdAt) VALUES (?, 'usr9001', 'ASESORA INVENTADA UNO', '2026-11-12')").run(AURORA);
  await crear('ASESORA INVENTADA UNO\t90001', 'ase347a'); // misma persona que el alias
  await crear('ASESORA INVENTADA DOS 90002', 'ase347b'); // codigo con espacio, sin alias
  await crear('ASESORA INVENTADA TRES', 'ase347c'); // sin codigo
  await crear('ASESORA INVENTADA CUATRO 12', 'ase347d'); // 2 cifras: no es un codigo
});

test('sinCodigoFinal: quita solo un codigo de 3 o mas cifras al final', () => {
  assert.equal(E.sinCodigoFinal('NOMBRE APELLIDO\t12656'), 'NOMBRE APELLIDO');
  assert.equal(E.sinCodigoFinal('NOMBRE APELLIDO 12656 '), 'NOMBRE APELLIDO');
  assert.equal(E.sinCodigoFinal('NOMBRE APELLIDO'), 'NOMBRE APELLIDO');
  assert.equal(E.sinCodigoFinal('NOMBRE 12'), 'NOMBRE 12');
  assert.equal(E.sinCodigoFinal('12656'), '12656', 'un codigo solo no queda vacio');
});

test('la lista trae una sola vez a cada asesora, con el nombre limpio', async () => {
  const lista = (await request(app).get('/api/calidad/errores/asesoras?campana=' + encodeURIComponent(AURORA)).set(H(admin))).body.asesoras;
  const de = (txt) => lista.filter((n) => n.includes(txt));
  assert.deepEqual(de('INVENTADA UNO'), ['ASESORA INVENTADA UNO']);
  assert.deepEqual(de('INVENTADA DOS'), ['ASESORA INVENTADA DOS']);
  assert.deepEqual(de('INVENTADA TRES'), ['ASESORA INVENTADA TRES']);
  assert.deepEqual(de('INVENTADA CUATRO'), ['ASESORA INVENTADA CUATRO 12']);
  assert.ok(!lista.some((n) => /\t|\s\d{3,}$/.test(n)), 'ningun nombre con codigo final');
  assert.equal(new Set(lista.map((n) => n.toUpperCase())).size, lista.length, 'sin repetidos');
});

test('un error con el nombre viejo («NOMBRE<tab>codigo») se guarda con el nombre limpio; el alias sigue mandando', async () => {
  const a = await request(app).post('/api/calidad/errores').set(H(admin)).send({ campana: AURORA, mes: '2026-11', asesor: 'ASESORA INVENTADA UNO\t90001' });
  assert.equal(a.status, 201, JSON.stringify(a.body));
  assert.equal(a.body.asesor, 'ASESORA INVENTADA UNO');
  const b = await request(app).post('/api/calidad/errores').set(H(admin)).send({ campana: AURORA, mes: '2026-11', asesor: 'usr9001' });
  assert.equal(b.body.asesor, 'ASESORA INVENTADA UNO');
  const r = (await request(app).get('/api/calidad/errores?campana=' + encodeURIComponent(AURORA)).set(H(admin))).body;
  assert.equal(r.porAsesor['2026-11'].filter((x) => x.asesor === 'ASESORA INVENTADA UNO').length, 1, 'una sola fila por asesora');
});
