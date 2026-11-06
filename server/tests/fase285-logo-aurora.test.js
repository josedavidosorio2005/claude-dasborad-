// fase285-logo-aurora.test.js — Fase 285: logo de Clinica Aurora en el encabezado de
// su dashboard (opcion C del usuario: blanco, fondo transparente, sin la linea de abajo;
// 28 px en escritorio y 22 en el celular, como ORLANT). Las tarjetas del selector no
// cambian y los demas clientes quedan igual.
'use strict';

const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { cleanup } = require('./helpers');

after(cleanup);

const IMG = path.join(__dirname, '..', '..', 'public', 'img', 'clientes');
const png = (f) => { const b = fs.readFileSync(path.join(IMG, f)); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), tipoColor: b[25] }; };

test('los PNG del logo de Aurora: 1x de 28 px y 2x de 56 px, con transparencia (RGBA)', () => {
  const a = png('aurora-logo.png');
  const b = png('aurora-logo@2x.png');
  assert.equal(a.h, 28);
  assert.equal(b.h, 56);
  assert.equal(b.w, 2 * a.w, 'el 2x es el doble del 1x');
  assert.equal(a.tipoColor, 6);
  assert.equal(b.tipoColor, 6);
});

test('registro: el logo de Aurora es el de los archivos (ancho y alto reales)', () => {
  const { LOGO_AURORA } = require('../clientes-registro');
  const a = png('aurora-logo.png');
  assert.deepEqual(LOGO_AURORA, { src: 'img/clientes/aurora-logo.png', src2x: 'img/clientes/aurora-logo@2x.png', alt: 'Clínica Aurora', width: a.w, height: a.h, alto: 28, altoMovil: 22 });
});

test('migracion fase285_logo_aurora_v1: pone el logo solo a Aurora y es idempotente', () => {
  const db = require('../db');
  const { LOGO_AURORA } = require('../clientes-registro');
  const otros = () => db.prepare("SELECT nombre, logo FROM clientes_registro WHERE nombre != 'CLINICA AURORA' ORDER BY nombre").all();
  db.prepare("UPDATE clientes_registro SET logo = NULL WHERE nombre = 'CLINICA AURORA'").run();
  const antes = otros();
  db.actualizarLogoAurora();
  db.actualizarLogoAurora();
  const f = db.prepare("SELECT logo FROM clientes_registro WHERE nombre = 'CLINICA AURORA'").get();
  assert.deepEqual(JSON.parse(f.logo), LOGO_AURORA);
  assert.deepEqual(otros(), antes, 'ORLANT, MOBILIZE, HLM y SURA no cambian');
  assert.equal(JSON.parse(antes.find((c) => c.nombre === 'ORLANT').logo).src, 'img/clientes/orlant-logo.png');
  assert.equal(antes.find((c) => c.nombre === 'HOSPITAL LA MARIA').logo, null, 'HLM sigue sin logo');
  assert.ok(db.prepare("SELECT name FROM schema_migrations WHERE name = 'fase285_logo_aurora_v1'").get());
});

test('el logo sale solo en el encabezado del dashboard: las tarjetas del selector no usan logos', () => {
  const pub = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'public', f), 'utf8');
  assert.match(pub('js/dashboard-generic.js'), /var logoCli = LISTAS_REGISTRO\.logos\[_gd\.cliente\] \|\| null;/);
  const sesion = pub('js/session.js');
  assert.ok(!/logos\[/.test(sesion), 'el selector y el Portal Supervisor no pintan logos');
});
