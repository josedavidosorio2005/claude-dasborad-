// fase262-calidad-aurora-hlm.test.js — Fase 262 (Calidad de Clinica Aurora y
// Hospital La Maria, entrega 09/11): "Resultado de los monitoreos" en su pestaña
// Calidad (que se destapa sola con monitoreos), asesores de esas campañas en el
// formulario de usuario y plantillas SINTETICAS (12 items sin el 2; dos de HLM).
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');
const dbMod = require('../db');
const { generarLayout, PERFILES_ACTUALES } = require('../plantillas-cliente');

const auth = (t) => ({ Authorization: 'Bearer ' + t });
const AURORA = 'CLINICA AURORA';
const HLM = 'HOSPITAL LA MARIA';
let admin;
const layoutDe = (c) => JSON.parse(db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get(c).layout);
const CAMPOS = ['asesor', 'fecha', 'idLlamada', 'telefono', 'codificacion', 'evaluador', 'observaciones'];
function plantilla(nombre, campana, nums, criticos) {
  const base = Math.floor(100 / nums.length); const resto = 100 - base * nums.length; // pesos enteros, como las reales
  return { formato: 'inconexion-plantilla-calidad', version: 1, nombre, campana, motor: 'standard', campos: CAMPOS,
    items: nums.map((n, i) => ({ n, categoria: 'Cat ' + (i % 3), nombre: 'Item sintetico ' + n, peso: base + (i < resto ? 1 : 0), critico: criticos.includes(n), descripcion: 'Criterio ficticio ' + n })) };
}
const importar = (archivo, principal) => request(app).post('/api/calidad/plantillas/importar').set(auth(admin)).send({ archivo, principal, confirmar: true });

before(async () => { admin = await tokenFor('admin', MASTER_PASSWORD); });

test('migracion: el panel de monitoreos al final de Calidad de Aurora y HLM; ORLANT y SURA igual; idempotente', () => {
  for (const c of [AURORA, HLM]) {
    const cal = layoutDe(c).tabs.find((t) => t.key === 'calidad');
    assert.equal(cal.oculta, true, c + ': la pestaña sigue oculta (se destapa con monitoreos)');
    assert.equal(cal.panels[cal.panels.length - 1].tipo, 'calidad_monitoreos_panel', c);
    assert.equal(cal.panels.filter((p) => p.tipo === 'calidad_monitoreos_panel').length, 1, c);
  }
  assert.ok(!JSON.stringify(layoutDe('ORLANT')).includes('calidad_monitoreos_panel'));
  assert.equal(JSON.stringify(layoutDe('ORLANT')), JSON.stringify(generarLayout(PERFILES_ACTUALES.ORLANT).layout), 'ORLANT = su foto');
  const antes = JSON.stringify([layoutDe(AURORA), layoutDe(HLM)]);
  dbMod.agregarMonitoreosPanelAuroraHlm();
  assert.equal(JSON.stringify([layoutDe(AURORA), layoutDe(HLM)]), antes);
});

test('plantillas sinteticas: Aurora sin item 2 (12 items) y dos de HLM, la primera principal', async () => {
  const nums = [1, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
  const a = await importar(plantilla('Aurora sintetica', AURORA, nums, [4, 6, 8, 10, 12]), true);
  assert.equal(a.status, 201, JSON.stringify(a.body));
  assert.deepEqual(a.body.plantilla.items.map((i) => i.n), nums);
  assert.equal(a.body.plantilla.principal, true);
  const c = await importar(plantilla('HLM Castilla sintetica', HLM, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], [2, 4, 6, 7, 8]), true);
  const s = await importar(plantilla('HLM Sede 33 sintetica', HLM, [1, 2, 3, 4, 5, 6, 7], [2, 4, 6]), false);
  assert.equal(c.status, 201); assert.equal(s.status, 201);
  assert.equal(c.body.plantilla.principal, true);
  assert.equal(s.body.plantilla.principal, false);
  const todas = (await request(app).get('/api/calidad/plantillas/todas').set(auth(admin))).body.filter((p) => p.campana === HLM);
  assert.deepEqual(todas.map((p) => [p.nombre, p.activo, p.usable]).sort(), [['HLM Castilla sintetica', true, true], ['HLM Sede 33 sintetica', true, true]]);
  // monitoreo con Aurora: item 2 no existe, faltar 1 de los 12 -> 400
  const resp = Object.fromEntries(nums.map((n) => [n, 'SI']));
  const ok = await request(app).post('/api/monitoreos').set(auth(admin)).send({ campana: AURORA, plantillaId: a.body.plantilla.id, asesor: 'Asesor Sintetico', fecha: new Date().toISOString().slice(0, 10), canal: 'LLAMADA', answers: resp, observaciones: 'ok' });
  assert.equal(ok.status, 201, JSON.stringify(ok.body));
  assert.equal(ok.body.puntaje, 100);
});

test('navegador: asesores de cualquier campaña con Calidad y pestaña Calidad que se destapa con monitoreos', () => {
  const pub = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', f), 'utf8');
  assert.match(pub('users.js'), /var campanas=calidadCampanasRegistro\(\);/);
  assert.match(pub('session.js'), /calidadCampanasRegistro\(\)\.filter/);
  assert.match(pub('dashboard-generic.js'), /CAL_DB\[camp\]\.monitoreos \|\| \[\]\)\.length\)\{\s*var tabCalidad = [\s\S]{0,200}?if\(tabCalidad\) tabCalidad\.oculta = false;/);
  // calidadCampanasRegistro usa la lista del servidor y cae a la fija si no llego
  const ctx = { CAMPANAS_CALIDAD: ['ORLANT', 'MOBILIZE', AURORA, HLM] };
  const src = pub('constants.js');
  const fn = new Function('CAMPANAS_CALIDAD', src.slice(src.indexOf('var CAMPANAS_CON_PLANTILLA'), src.indexOf('}', src.indexOf('function calidadCampanasRegistro')) + 1) + '\nreturn calidadCampanasRegistro();');
  assert.deepEqual(fn(ctx.CAMPANAS_CALIDAD), ctx.CAMPANAS_CALIDAD);
  assert.deepEqual(fn([]), ['ORLANT', 'MOBILIZE']);
});
