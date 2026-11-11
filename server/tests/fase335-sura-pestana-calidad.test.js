// fase335-sura-pestana-calidad.test.js — Fase 335 (pedido del usuario, 11/11): pestaña «Calidad»
// en Televentas SURA con «Resultado de los monitoreos» (plantilla de descuento). Se agrega desde
// AFUERA de la app de Edwin (no se pierde al regenerar el HTML), usa su propio filtro de mes, el
// cliente sigue la regla del registro (sin tabla por asesor hoy) y nunca recibe evaluador ni
// observaciones. Datos SINTETICOS.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { request, app, tokenFor, MASTER_PASSWORD } = require('./helpers');

const PUB = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'public', f), 'utf8');
const H = (t) => ({ Authorization: 'Bearer ' + t });
let admin, cliente, otro;

before(async () => {
  admin = await tokenFor('admin', MASTER_PASSWORD);
  const mk = async (user, perms) => {
    const r = await request(app).post('/api/users').set(H(admin)).send({ nombre: 'Persona Ficticia ' + user, user, password: 'Clave#Fase335x', rol: 'CLIENTES_DASH', perms });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    return tokenFor(user, 'Clave#Fase335x');
  };
  cliente = await mk('cli335', { ClientesDash: true, cliente_SURA: true });
  otro = await mk('cli335o', { ClientesDash: true, cliente_ORLANT: true });
});

test('la pestaña vive en el marco (sura-televentas.js), no en la app generada del HTML de Edwin', () => {
  const marco = PUB('js/sura-televentas.js');
  assert.ok(marco.includes("btn.className = 'tab'; btn.type = 'button'; btn.dataset.p = 'pcal'; btn.hidden = true;"), 'mismo estilo de pestaña de Televentas');
  assert.ok(marco.includes('<slot name="stv-calidad"></slot>'), 'contenido proyectado desde el DOM normal');
  assert.ok(marco.includes("_stvCalidadMontar(_stv.root, cliente); // Fase 335"));
  assert.ok(marco.includes("_cmpRender({ tipo: 'calidad_monitoreos_panel', campana: cliente, mesesPropios: true }, STV_CAL_I);"));
  assert.ok(marco.includes('el filtro de campaña de las otras pestañas (Odontológico / Salud para ti) no aplica aquí'), 'nota del filtro de campaña');
  const appGen = PUB('js/sura-televentas-app.js');
  assert.ok(!appGen.includes('pcal') && !appGen.includes('stv-calidad'), 'la app generada no se tocó (regenerar el HTML no la borra)');
  // El Centro de cargas (stvMontarCarga) no monta la pestaña.
  const carga = marco.slice(marco.indexOf('async function stvMontarCarga'), marco.indexOf('function stvDesmontarCarga'));
  assert.ok(!carga.includes('_stvCalidadMontar'));
});

test('el bloque usa su propio filtro de mes y abre sus diálogos dentro de Televentas', () => {
  const panel = PUB('js/calidad-panel.js');
  assert.ok(panel.includes("var marcados = (!p.mesesPropios && typeof _gdMeses === 'function') ? _gdMeses().slice().sort() : [];"));
  assert.ok(panel.includes("var host = document.querySelector('#stv-overlay.show #stv-modal') || document.getElementById('gd-overlay') || document.body;"));
  // Tabla por asesor del cliente: la decide el registro (asesorVisibleCliente), sin tocar codigo.
  assert.ok(panel.includes("(LISTAS_REGISTRO.asesorVisibleCliente || []).indexOf(campana) !== -1"));
});

test('servidor: el cliente de SURA ve los monitoreos sin evaluador ni observaciones; otro cliente, 403 (la pestaña no sale)', async () => {
  const r = await request(app).get('/api/monitoreos').query({ campana: 'SURA' }).set(H(cliente));
  assert.equal(r.status, 200);
  for (const m of r.body) { assert.equal('evaluador' in m, false); assert.equal('observaciones' in m, false); }
  assert.equal((await request(app).get('/api/monitoreos/total').query({ campana: 'SURA' }).set(H(cliente))).status, 200);
  assert.equal((await request(app).get('/api/monitoreos/total').query({ campana: 'SURA' }).set(H(otro))).status, 403);
});
