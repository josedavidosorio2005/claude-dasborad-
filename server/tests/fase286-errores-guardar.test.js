// fase286-errores-guardar.test.js — Fase 286 (pedido de Edwin, 07/11): en Clinica
// Aurora › Errores, un solo «Guardar» para el error y el plan de accion del mes (en una
// transaccion: o los dos o ninguno), la lista de errores del mes en una sub-pestaña con
// scroll, y la pestaña que se actualiza sola. Asesoras, observaciones y planes INVENTADOS.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { app, db, request, tokenFor, MASTER_PASSWORD } = require('./helpers');
const E = require('../../public/js/errores.js');

const AURORA = 'CLINICA AURORA';
const H = (t) => ({ Authorization: 'Bearer ' + t });
const CLAVE = 'ClavePrueba1234';
async function cuenta(rol, perms) {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const user = 'e286_' + Math.random().toString(36).slice(2, 8);
  const r = await request(app).post('/api/users').set(H(admin)).send({ nombre: 'Cuenta Sintética', user, password: CLAVE, rol, perms });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return tokenFor(user, CLAVE);
}
const guardar = (tok, body) => request(app).post('/api/calidad/errores/guardar').set(H(tok)).send(body);
const resumen = async (tok) => (await request(app).get('/api/calidad/errores?campana=' + encodeURIComponent(AURORA)).set(H(tok))).body;
const cuentaFilas = (mes) => db.prepare('SELECT COUNT(*) AS n FROM errores_agendamiento WHERE campana = ? AND mes = ?').get(AURORA, mes).n;

test('un solo «Guardar»: el error y el plan de accion del mes quedan juntos (y en el historial)', async () => {
  const sup = await cuenta('SUPERVISOR', { ['supervisa_' + AURORA]: true });
  const r = await guardar(sup, { campana: AURORA, mes: '2026-07', error: { asesor: 'Asesora Inventada A', cantidad: 2, observacion: 'Dos citas en la sede equivocada.' }, plan: 'Plan inventado de julio.' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.registro.asesor, 'Asesora Inventada A');
  assert.equal(r.body.registro.cantidad, 2);
  assert.equal(r.body.plan.texto, 'Plan inventado de julio.');
  const d = await resumen(sup);
  assert.equal(d.porMes.find((x) => x.mes === '2026-07').errores, 2);
  assert.equal(d.planes['2026-07'].texto, 'Plan inventado de julio.');
  const hist = db.prepare("SELECT accion FROM historial WHERE accion IN ('ERROR_AGENDAMIENTO_CREADO','ERRORES_PLAN_ACCION') ORDER BY id DESC LIMIT 2").all().map((h) => h.accion).sort();
  assert.deepEqual(hist, ['ERRORES_PLAN_ACCION', 'ERROR_AGENDAMIENTO_CREADO']);
});

test('sin asesora se guarda solo el plan; sin plan, el plan que habia no se toca', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const p = await guardar(admin, { campana: AURORA, mes: '2026-06', plan: 'Solo el plan inventado de junio.' });
  assert.equal(p.status, 200, JSON.stringify(p.body));
  assert.equal(p.body.registro, null);
  assert.equal(cuentaFilas('2026-06'), 0);
  const e = await guardar(admin, { campana: AURORA, mes: '2026-06', error: { asesor: 'Asesora Inventada B', observacion: 'Fecha equivocada.' } });
  assert.equal(e.status, 200);
  assert.equal(e.body.registro.cantidad, 1, 'cantidad por defecto 1');
  assert.equal((await resumen(admin)).planes['2026-06'].texto, 'Solo el plan inventado de junio.', 'el plan sigue');
});

test('o los dos o ninguno: si el plan trae un dato de paciente, el error tampoco se guarda', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const antes = cuentaFilas('2026-05');
  const r = await guardar(admin, { campana: AURORA, mes: '2026-05', error: { asesor: 'Asesora Inventada C', cantidad: 1, observacion: 'Bien.' }, plan: 'Llamar al 3001234567' });
  assert.equal(r.status, 400); assert.match(r.body.error, /datos de pacientes/);
  assert.equal(cuentaFilas('2026-05'), antes, 'el error no quedo guardado');
  assert.ok(!(await resumen(admin)).planes['2026-05'], 'el plan no quedo guardado');
});

test('editar con «Guardar» (id); un id de otra campaña o inexistente da 404; nada que guardar da 400', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const c = await guardar(admin, { campana: AURORA, mes: '2026-04', error: { asesor: 'Asesora Inventada D', cantidad: 1 } });
  const e = await guardar(admin, { campana: AURORA, mes: '2026-04', error: { id: c.body.registro.id, asesor: 'Asesora Inventada D', cantidad: 4, observacion: 'Editado.' }, plan: 'Plan inventado de abril.' });
  assert.equal(e.status, 200, JSON.stringify(e.body));
  assert.equal(e.body.registro.id, c.body.registro.id);
  assert.equal(e.body.registro.cantidad, 4);
  assert.equal(cuentaFilas('2026-04'), 1, 'edito, no creo otro');
  const otra = db.prepare("INSERT INTO errores_agendamiento (campana, mes, asesor, cantidad, observacion, creadoPorNombre, creadoEn) VALUES ('HOSPITAL LA MARIA', '2026-04', 'X', 1, '', '-', '2026-11-07')").run().lastInsertRowid;
  assert.equal((await guardar(admin, { campana: AURORA, mes: '2026-04', error: { id: Number(otra), asesor: 'X', cantidad: 9 } })).status, 404);
  assert.equal(db.prepare('SELECT cantidad FROM errores_agendamiento WHERE id = ?').get(otra).cantidad, 1, 'no se toco');
  db.prepare('DELETE FROM errores_agendamiento WHERE id = ?').run(otra);
  assert.equal((await guardar(admin, { campana: AURORA, mes: '2026-04', error: { id: 999999, asesor: 'X' } })).status, 404);
  assert.equal((await guardar(admin, { campana: AURORA, mes: '2026-04' })).status, 400);
  assert.equal((await guardar(admin, { campana: AURORA, mes: '2026-04', plan: 'x', otra: 1 })).status, 400, 'llaves de mas');
});

test('permisos: el cliente y el supervisor de otro cliente no guardan; ORLANT no tiene el modulo', async () => {
  const cliente = await cuenta('CLIENTES_DASH', { ClientesDash: true, ['cliente_' + AURORA]: true });
  const supOtro = await cuenta('SUPERVISOR', { supervisa_ORLANT: true });
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const body = { campana: AURORA, mes: '2026-03', error: { asesor: 'Asesora Inventada E' }, plan: 'Plan inventado.' };
  assert.equal((await guardar(cliente, body)).status, 403);
  assert.equal((await guardar(supOtro, body)).status, 403);
  assert.equal((await guardar(admin, { ...body, campana: 'ORLANT' })).status, 404);
  assert.equal(cuentaFilas('2026-03'), 0);
});

test('navegador: aviso cuando el mes guardado queda fuera de MESES', () => {
  assert.equal(E.erroresAvisoFueraDeMeses('2026-11', ['2026-10'], ['2026-10']), true);
  assert.equal(E.erroresAvisoFueraDeMeses('2026-10', ['2026-10'], ['2026-10']), false, 'se ve');
  assert.equal(E.erroresAvisoFueraDeMeses('2026-11', ['2026-10', '2026-11'], []), false, 'MESES sin marcar = todos');
  assert.equal(E.erroresAvisoFueraDeMeses('', [], ['2026-10']), false);
});

test('navegador: un solo «Guardar», «Errores del mes» en sub-pestaña con scroll, borrar con confirmacion, la pestaña se redibuja', () => {
  const js = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'errores.js'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'css', 'styles.css'), 'utf8');
  assert.ok(!js.includes('Agregar error\'') && !js.includes('>Agregar error<') && !js.includes('Guardar plan de acción'), 'ya no hay dos botones');
  assert.equal((js.match(/class="btn-primary err-guardar"/g) || []).length, 1);
  assert.match(js, /apiRequest\('POST', '\/calidad\/errores\/guardar', cuerpo\)/);
  assert.match(js, /role="tab"/); assert.match(js, /role="tabpanel" id="err-pan-lista"/);
  assert.match(js, /'Errores del mes \(' \+ regs\.length \+ '\)'/);
  assert.match(js, /btn\.textContent = '¿Borrar\?'/, 'borrar sigue pidiendo confirmacion');
  assert.match(js, /async function _errRecargar[\s\S]*?_erroresPintar\(camp\);/, 'la pestaña de atras se redibuja');
  assert.match(css, /\.err-lista\{max-height:[^}]*overflow:auto/);
  assert.match(css, /\.err-tabs \.gd-subtab-btn\{min-height:44px\}/);
});
