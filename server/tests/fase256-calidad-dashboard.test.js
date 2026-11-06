// fase256-calidad-dashboard.test.js — Fase 256 (plan de Calidad B5): panel
// "calidad_monitoreos_panel" en la pestaña Calidad de MOBILIZE (migracion
// idempotente que no toca a nadie mas), el asesor ve las plantillas de su
// campaña (para "Mis resultados") y el cliente sigue sin telefono. SINTETICO.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');
const dbMod = require('../db');

const auth = (t) => ({ Authorization: `Bearer ${t}` });
const PW = 'Clave#Fase256x';
const hoy = new Date().toISOString().slice(0, 10);
let admin, asesorMob, asesorOrl, cliente;
const layoutDe = (c) => JSON.parse(db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get(c).layout);

async function crear(user, rol, perms, extra) {
  const r = await request(app).post('/api/users').set(auth(admin)).send(Object.assign({ nombre: 'Persona ' + user, user, password: PW, rol, perms }, extra));
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return { id: r.body.id, token: await tokenFor(user, PW) };
}

before(async () => {
  admin = await tokenFor('admin', MASTER_PASSWORD);
  asesorMob = await crear('ase256m', 'ASESOR', {}, { asesorCampana: 'MOBILIZE' });
  asesorOrl = await crear('ase256o', 'ASESOR', {}, { asesorCampana: 'ORLANT' });
  cliente = await crear('cli256', 'CLIENTES_DASH', { cliente_MOBILIZE: true });
});

test('migracion: el panel queda al final de Calidad de MOBILIZE, una sola vez; los demas clientes igual', () => {
  const cal = layoutDe('MOBILIZE').tabs.find((t) => t.key === 'calidad');
  assert.equal(cal.panels[cal.panels.length - 1].tipo, 'calidad_monitoreos_panel');
  assert.equal(cal.panels.filter((p) => p.tipo === 'calidad_monitoreos_panel').length, 1);
  const otros = db.prepare("SELECT cliente, layout FROM dashboards_config WHERE cliente <> 'MOBILIZE'").all();
  const antes = JSON.stringify(otros);
  const mobAntes = JSON.stringify(layoutDe('MOBILIZE'));
  dbMod.migrarMobilizeCalidadMonitoreosPanel();
  assert.equal(JSON.stringify(layoutDe('MOBILIZE')), mobAntes, 'idempotente');
  assert.equal(JSON.stringify(db.prepare("SELECT cliente, layout FROM dashboards_config WHERE cliente <> 'MOBILIZE'").all()), antes);
  // Fase 262: Aurora y HLM tambien lo tienen; ORLANT y SURA no.
  assert.ok(otros.filter((r) => !['CLINICA AURORA', 'HOSPITAL LA MARIA'].includes(r.cliente)).every((r) => !r.layout.includes('calidad_monitoreos_panel')), 'ORLANT y SURA no lo tienen');
});

test('el asesor ve las plantillas de SU campaña (no las de otra), nunca usables', async () => {
  const m = await request(app).get('/api/calidad/plantillas/todas?inactivas=1').set(auth(asesorMob.token));
  assert.equal(m.status, 200);
  assert.ok(m.body.length >= 1 && m.body.every((p) => p.campana === 'MOBILIZE' && p.usable === false), JSON.stringify(m.body.map((p) => p.campana)));
  const o = await request(app).get('/api/calidad/plantillas').set(auth(asesorOrl.token));
  assert.deepEqual(o.body.map((p) => p.campana), ['ORLANT']);
});

test('el cliente recibe los monitoreos de su campaña sin telefono (para el panel)', async () => {
  const c = await request(app).post('/api/monitoreos').set(auth(admin)).send({ campana: 'MOBILIZE', asesor: 'Asesor Sintetico', fecha: hoy, canal: 'LLAMADA', answers: { 1: 'SI' }, telefono: '3000000256' });
  assert.equal(c.status, 201, JSON.stringify(c.body));
  const r = await request(app).get('/api/monitoreos?campana=MOBILIZE').set(auth(cliente.token));
  assert.equal(r.status, 200);
  const fila = r.body.find((x) => x.id === c.body.id);
  assert.ok(fila);
  assert.equal('telefono' in fila, false);
  const pl = await request(app).get('/api/calidad/plantillas/todas?inactivas=1').set(auth(cliente.token));
  assert.ok(pl.body.some((p) => p.campana === 'MOBILIZE'), 'el cliente ve la plantilla (items y diccionario)');
});

test('navegador: el tipo nuevo esta en las listas cerradas y no se exporta (nombres + notas)', () => {
  const pub = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', f), 'utf8');
  assert.match(pub('mes-global-logic.js'), /GD_TIPOS_SIGUEN_MESES = \[[^\]]*'calidad_monitoreos_panel'/);
  assert.match(pub('mes-global-logic.js'), /GD_TIPOS_AUTONOMOS = \[[^\]]*'calidad_monitoreos_panel'/);
  assert.match(pub('dashboard-export-tipos.js'), /'calidad_monitoreos_panel'/);
  const gd = pub('dashboard-generic.js');
  assert.match(gd, /if\(p\.tipo === 'calidad_monitoreos_panel'\)\{ _cmpRender\(p, i\); return; \}/);
  assert.match(gd, /if\(p\.tipo === 'calidad_monitoreos_panel'\)\{ continue; \}/);
  assert.ok(pub('calidad-panel.js').includes('_gdMeses().slice()'), 'sigue a MESES (Fase 274: los meses marcados)');
  assert.match(pub('calidad-panel.js'), /asesorVisibleCliente/, 'respeta la regla de nombres para el cliente');
});
