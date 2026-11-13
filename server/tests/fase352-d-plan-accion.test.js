// fase352-d-plan-accion.test.js — Fase 352 (D, reunion con Edwin del 13/11): en Aurora › Errores el
// plan de accion del mes va aparte («Plan de acción del mes»), sin asesora. Mismos permisos que
// Errores: el supervisor registra y edita; el administrador y Reportes tambien borran; el cliente solo
// lo lee. Los planes ya guardados siguen en errores_plan_accion (campaña + mes): no hay migracion.
// Datos SINTETICOS.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');

const H = (t) => ({ Authorization: 'Bearer ' + t });
const AURORA = 'CLINICA AURORA';
const CLAVE = 'Clave#Fase352d';
const PUB = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'public', f), 'utf8');
let admin, sup, rep, repOtro, cli;

async function cuenta(rol, perms) {
  const user = 'd352_' + Math.random().toString(36).slice(2, 8);
  const r = await request(app).post('/api/users').set(H(admin)).send({ nombre: 'Cuenta Sintética', user, password: CLAVE, rol, perms });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return tokenFor(user, CLAVE);
}
const ponerPlan = (t, mes, texto) => request(app).put('/api/calidad/errores/plan').set(H(t)).send({ campana: AURORA, mes, texto });
const borrarPlan = (t, mes) => request(app).delete('/api/calidad/errores/plan?campana=' + encodeURIComponent(AURORA) + '&mes=' + mes).set(H(t));
const planes = async (t) => (await request(app).get('/api/calidad/errores?campana=' + encodeURIComponent(AURORA)).set(H(t))).body.planes;

before(async () => {
  admin = await tokenFor('admin', MASTER_PASSWORD);
  sup = await cuenta('SUPERVISOR', { Calidad: true, ['supervisa_' + AURORA]: true, ['cliente_' + AURORA]: true });
  rep = await cuenta('REPORTES', { Calidad: true, ['campana_' + AURORA]: true });
  repOtro = await cuenta('REPORTES', { Calidad: true, campana_ORLANT: true });
  cli = await cuenta('CLIENTES_DASH', { ClientesDash: true, ['cliente_' + AURORA]: true });
});

test('D: un plan guardado como antes (junto con un error) sigue igual y se edita aparte', async () => {
  // Asi se guardaba hasta la 1.191.0: error y plan en un solo «Guardar».
  const g = await request(app).post('/api/calidad/errores/guardar').set(H(sup)).send({ campana: AURORA, mes: '2026-10', error: { asesor: 'Asesora Inventada', cantidad: 1, observacion: 'Error inventado.' }, plan: 'Plan inventado de octubre.' });
  assert.equal(g.status, 200, JSON.stringify(g.body));
  const antes = db.prepare('SELECT campana, mes, texto FROM errores_plan_accion WHERE campana = ? AND mes = ?').get(AURORA, '2026-10');
  assert.deepEqual(antes, { campana: AURORA, mes: '2026-10', texto: 'Plan inventado de octubre.' });
  assert.equal((await planes(cli))['2026-10'].texto, 'Plan inventado de octubre.', 'el cliente lo sigue leyendo');
  // Ahora se edita solo el plan (sin asesora).
  const p = await ponerPlan(sup, '2026-10', 'Plan inventado de octubre, actualizado.');
  assert.equal(p.status, 200, JSON.stringify(p.body));
  assert.equal((await planes(sup))['2026-10'].texto, 'Plan inventado de octubre, actualizado.');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM errores_agendamiento WHERE campana = ? AND mes = ?').get(AURORA, '2026-10').n, 1, 'el error no cambia');
});

test('D: escribir el plan: supervisor y admin si; Reportes, cliente y otra campaña no', async () => {
  assert.equal((await ponerPlan(admin, '2026-11', 'Plan inventado del administrador.')).status, 200);
  assert.equal((await ponerPlan(sup, '2026-11', 'Plan inventado del supervisor.')).status, 200);
  assert.equal((await ponerPlan(rep, '2026-11', 'Intento de Reportes.')).status, 403);
  assert.equal((await ponerPlan(cli, '2026-11', 'Intento del cliente.')).status, 403);
  assert.equal((await planes(sup))['2026-11'].texto, 'Plan inventado del supervisor.');
});

test('D: borrar el plan: solo administrador y Reportes con acceso; el supervisor no (ni dejandolo vacio)', async () => {
  await ponerPlan(sup, '2026-09', 'Plan inventado de septiembre.');
  const vacio = await ponerPlan(sup, '2026-09', '   ');
  assert.equal(vacio.status, 403); assert.match(vacio.body.error, /administrador o Reportes/);
  const junto = await request(app).post('/api/calidad/errores/guardar').set(H(sup)).send({ campana: AURORA, mes: '2026-09', plan: '' });
  assert.equal(junto.status, 403, 'tampoco por el «Guardar» de siempre');
  assert.equal((await borrarPlan(sup, '2026-09')).status, 403);
  assert.equal((await borrarPlan(cli, '2026-09')).status, 403);
  assert.equal((await borrarPlan(repOtro, '2026-09')).status, 403, 'Reportes sin acceso a Aurora');
  assert.ok((await planes(sup))['2026-09'], 'sigue ahi');
  assert.equal((await borrarPlan(rep, '2026-09')).status, 200, 'Reportes de Aurora borra');
  assert.equal((await planes(sup))['2026-09'], undefined);
  await ponerPlan(sup, '2026-08', 'Plan inventado de agosto.');
  assert.equal((await borrarPlan(admin, '2026-08')).status, 200, 'el administrador borra');
  assert.equal((await planes(sup))['2026-08'], undefined);
  const h = db.prepare("SELECT detalle FROM historial WHERE accion = 'ERRORES_PLAN_ACCION' ORDER BY id DESC LIMIT 1").get();
  assert.equal(h.detalle, 'plan de 2026-08 borrado');
});

test('D: interfaz: «Plan de acción del mes» aparte, sin asesora; «Agregar errores» ya no trae el plan', () => {
  const js = PUB('js/errores.js');
  assert.ok(js.includes('onclick="erroresAbrirPlan(this.dataset.camp)">Plan de acción del mes</button>'));
  assert.ok(js.includes('if (d.puedeEditar || d.puedeBorrar) boton ='), 'el cliente no ve el boton');
  assert.doesNotMatch(js, /err-f-plan/, 'el formulario de errores ya no tiene el plan');
  assert.ok(js.includes("apiRequest('PUT', '/calidad/errores/plan'"));
  assert.ok(js.includes("apiRequest('DELETE', '/calidad/errores/plan?campana='"));
  const ventana = js.slice(js.indexOf('function _errPintarPlan'), js.indexOf('function erroresPlanCambiaMes'));
  assert.ok(!ventana.includes('err-f-asesor') && !ventana.includes('asesoras'), 'sin filtro de asesora');
  assert.doesNotMatch(ventana, /<select/, 'solo el mes y el texto');
  assert.ok(ventana.includes("(_errPl.puedeEditar ? '' : ' readonly')"), 'quien solo borra (Reportes) lo lee sin editar');
  assert.ok(ventana.includes("(_errPl.puedeBorrar && guardado ?"), 'Borrar plan solo para quien puede borrar');
  // El cliente sigue leyendo el plan en la pestaña, como hoy.
  assert.ok(js.includes("'<div class=\"aurora-card\"><div class=\"aurora-card-title\">Plan de acción · '"));
  // La ventana de Errores tiene X arriba.
  assert.ok(js.includes('onclick=\\"erroresCerrar()\\"><span aria-hidden=\\"true\\">×</span>') || js.includes('onclick="erroresCerrar()"><span aria-hidden="true">×</span>'));
});
