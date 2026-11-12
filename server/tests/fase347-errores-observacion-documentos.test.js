// fase347-errores-observacion-documentos.test.js — Fase 347 (pedido del usuario, 12/11):
// Aurora › Errores › «Agregar errores»: la observacion de un error ya puede traer cedulas o
// numeros de documento (antes daba 400). El plan de accion y las observaciones de los
// monitoreos siguen revisados. Datos SINTETICOS (numeros inventados).
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { request, app, tokenFor, MASTER_PASSWORD } = require('./helpers');

const H = (t) => ({ Authorization: 'Bearer ' + t });
const AURORA = 'CLINICA AURORA';

test('crear, «Guardar» y editar: la observacion con documento se guarda tal cual', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const obs = 'Agendó con la cédula 1036 555 777 en vez de la del titular, CC 99.888.777';
  const c = await request(app).post('/api/calidad/errores').set(H(admin)).send({ campana: AURORA, mes: '2026-10', asesor: 'Asesora Inventada', observacion: obs });
  assert.equal(c.status, 201, JSON.stringify(c.body));
  assert.equal(c.body.observacion, obs);
  const g = await request(app).post('/api/calidad/errores/guardar').set(H(admin)).send({ campana: AURORA, mes: '2026-10', error: { asesor: 'Asesora Inventada', observacion: 'Documento 12345678' } });
  assert.equal(g.status, 200, JSON.stringify(g.body));
  assert.equal(g.body.registro.observacion, 'Documento 12345678');
  const e = await request(app).put('/api/calidad/errores/' + c.body.id).set(H(admin)).send({ observacion: 'Corregido: TI 1.234.567.890' });
  assert.equal(e.status, 200, JSON.stringify(e.body));
  assert.equal(e.body.observacion, 'Corregido: TI 1.234.567.890');
});

test('el plan de accion sigue sin aceptar documentos ni telefonos', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const p = await request(app).put('/api/calidad/errores/plan').set(H(admin)).send({ campana: AURORA, mes: '2026-10', texto: 'Llamar al 3001234567' });
  assert.equal(p.status, 400);
  const g = await request(app).post('/api/calidad/errores/guardar').set(H(admin)).send({ campana: AURORA, mes: '2026-10', plan: 'Revisar el documento 1036555777' });
  assert.equal(g.status, 400);
});

test('el formulario ya no pide escribir sin documentos', () => {
  const js = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'errores.js'), 'utf8');
  assert.ok(!/sin nombres, documentos ni teléfonos/.test(js));
});
