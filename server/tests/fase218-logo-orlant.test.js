// fase218-logo-orlant.test.js — Fase 218: logo nuevo de ORLANT (original de
// Edwin sin la linea pequena de texto, blanco, 28 px en escritorio y 22 en el
// celular). Cubre los archivos, el registro, la migracion idempotente y que
// Mobilize no cambia.
'use strict';

const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { cleanup } = require('./helpers');

after(cleanup);

const IMG = path.join(__dirname, '..', '..', 'public', 'img', 'clientes');
const tamPng = (f) => { const b = fs.readFileSync(path.join(IMG, f)); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), tipoColor: b[25] }; };

test('los PNG del logo de ORLANT: 1x de 28 px y 2x de 56 px de alto, con transparencia (RGBA)', () => {
  const a = tamPng('orlant-logo.png');
  const b = tamPng('orlant-logo@2x.png');
  assert.equal(a.h, 28);
  assert.equal(b.h, 56);
  assert.equal(b.w, 2 * a.w, 'el 2x es el doble del 1x');
  assert.equal(a.tipoColor, 6);
  assert.equal(b.tipoColor, 6);
  assert.ok(!fs.existsSync(path.join(IMG, 'orlant-logo-blanco.png')), 'el logo provisional ya no se sirve');
});

test('registro: ORLANT trae 28/22 px y Mobilize queda igual (sin alto propio: 25/18 por defecto)', () => {
  const { REGISTRO_INICIAL } = require('../clientes-registro');
  const o = REGISTRO_INICIAL.find((c) => c.nombre === 'ORLANT').logo;
  const m = REGISTRO_INICIAL.find((c) => c.nombre === 'MOBILIZE').logo;
  assert.deepEqual(o, { src: 'img/clientes/orlant-logo.png', src2x: 'img/clientes/orlant-logo@2x.png', alt: 'Orlant', width: 92, height: 28, alto: 28, altoMovil: 22 });
  assert.deepEqual(m, { src: 'img/clientes/mobilize-logo.png', src2x: 'img/clientes/mobilize-logo@2x.png', alt: 'Mobilize', width: 140, height: 25 });
});

test('migracion fase218_logo_orlant_v1: pone el logo nuevo solo a ORLANT y es idempotente', () => {
  const db = require('../db');
  db.prepare("UPDATE clientes_registro SET logo = ? WHERE nombre = 'ORLANT'").run(JSON.stringify({ src: 'img/clientes/orlant-logo-blanco.png', width: 64, height: 25 }));
  const antesMob = db.prepare("SELECT logo FROM clientes_registro WHERE nombre = 'MOBILIZE'").get().logo;
  db.actualizarLogoOrlant();
  db.actualizarLogoOrlant();
  const o = JSON.parse(db.prepare("SELECT logo FROM clientes_registro WHERE nombre = 'ORLANT'").get().logo);
  assert.equal(o.src, 'img/clientes/orlant-logo.png');
  assert.equal(o.alto, 28);
  assert.equal(o.altoMovil, 22);
  assert.equal(db.prepare("SELECT logo FROM clientes_registro WHERE nombre = 'MOBILIZE'").get().logo, antesMob);
  assert.ok(db.prepare("SELECT name FROM schema_migrations WHERE name = 'fase218_logo_orlant_v1'").get());
});

test('el encabezado usa el alto del registro (variables CSS) y en el celular su propio alto', () => {
  const js = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'dashboard-generic.js'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'css', 'styles.css'), 'utf8');
  assert.match(js, /setProperty\('--gd-logo-alto', \(logoCli\.alto \|\| 25\) \+ 'px'\)/);
  assert.match(js, /setProperty\('--gd-logo-alto-movil', \(logoCli\.altoMovil \|\| 18\) \+ 'px'\)/);
  assert.match(css, /#gd-modal \.gd-cliente-logo\{height:var\(--gd-logo-alto-movil,18px\)/);
});
