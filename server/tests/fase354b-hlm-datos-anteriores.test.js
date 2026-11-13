// fase354b-hlm-datos-anteriores.test.js — Fase 354b (arreglo temporal, pedido del 13/11):
// mientras las sedes de Hospital La Maria esten vacias, quien hoy ve HLM (cliente, supervisor,
// calidad) abre «Datos anteriores (agosto, sin separar por sede)» en solo lectura.
//  - la migracion prende la opcion parametros.datosAnteriores del padre (idempotente);
//  - con la opcion prendida: el tablero del padre abre para quien tiene acceso a HLM; quien
//    solo tiene una sede, no; con la opcion apagada, solo el administrador (como la Fase 354);
//  - solo lectura: las cargas al padre siguen rechazadas (400) y el supervisor no puede
//    cambiar configuraciones del padre (skills de WhatsApp: 403).
// Datos SINTETICOS.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');
const dbMod = require('../db');
const reg = require('../clientes-registro');
const S = require('../../public/js/sedes-logic.js');

const H = (t) => ({ Authorization: 'Bearer ' + t });
const HLM = 'HOSPITAL LA MARIA';
const S33 = 'HOSPITAL LA MARIA - SEDE 33';
function crear(user, rol, perms) {
  db.prepare(`INSERT INTO users (nombre, user, rol, active, password_hash, perms, createdAt, debe_cambiar_password) VALUES (?,?,?,1,?,?,?,0)`)
    .run('Persona ' + user, user, rol, bcrypt.hashSync('Clave#2026x', 4), JSON.stringify(perms), new Date().toISOString());
  return tokenFor(user, 'Clave#2026x');
}
function ponerOpcion(valor) {
  const r = db.prepare('SELECT parametros FROM clientes_registro WHERE nombre = ?').get(HLM);
  const p = JSON.parse(r.parametros);
  if (valor === undefined) delete p.datosAnteriores; else p.datosAnteriores = valor;
  db.prepare('UPDATE clientes_registro SET parametros = ? WHERE nombre = ?').run(JSON.stringify(p), HLM);
}
const abrir = async (t, c) => (await request(app).get('/api/dashboard/' + encodeURIComponent(c)).set(H(t))).status;
let admin, cli, sup, cal, soloSede;

before(async () => {
  admin = await tokenFor('admin', MASTER_PASSWORD);
  cli = await crear('f354b_cli', 'CLIENTES_DASH', { ClientesDash: true, ['cliente_' + HLM]: true });
  sup = await crear('f354b_sup', 'SUPERVISOR', { ['supervisa_' + HLM]: true });
  cal = await crear('f354b_cal', 'CALIDAD', { ['campana_' + HLM]: true });
  soloSede = await crear('f354b_s33', 'CLIENTES_DASH', { ClientesDash: true, ['cliente_' + S33]: true });
});

test('migracion: prende «Datos anteriores» en el padre, con su etiqueta, y es idempotente', () => {
  const padre = reg.leerRegistro(db).find((c) => c.nombre === HLM);
  assert.deepEqual(padre.parametros.datosAnteriores, { visible: true, etiqueta: 'Datos anteriores (agosto, sin separar por sede)' });
  assert.equal(reg.datosAnterioresVisibles(db, HLM), true);
  assert.equal(reg.datosAnterioresVisibles(db, 'ORLANT'), false);
  // Ya existe (aunque se haya apagado): la migracion no la vuelve a prender.
  ponerOpcion({ visible: false, etiqueta: 'x' });
  dbMod.prenderDatosAnterioresHlm();
  assert.equal(reg.datosAnterioresVisibles(db, HLM), false);
  ponerOpcion({ visible: true, etiqueta: 'Datos anteriores (agosto, sin separar por sede)' });
});

test('logica del navegador: el boton sale con la opcion prendida y acceso al padre', () => {
  const r = reg.leerRegistro(db);
  assert.deepEqual(S.datosAnterioresDe(r, HLM), { etiqueta: 'Datos anteriores (agosto, sin separar por sede)' });
  assert.equal(S.datosAnterioresDe(r, 'ORLANT'), null);
  assert.equal(S.puedeVerDatosAnteriores(r, HLM, { ['cliente_' + HLM]: true }), true);
  assert.equal(S.puedeVerDatosAnteriores(r, HLM, { ['campana_' + HLM]: true }), true, 'calidad');
  assert.equal(S.puedeVerDatosAnteriores(r, HLM, { ['cliente_' + S33]: true }), false, 'solo una sede: no');
  const apagada = r.map((c) => (c.nombre === HLM ? { ...c, parametros: { ...c.parametros, datosAnteriores: { visible: false } } } : c));
  assert.equal(S.datosAnterioresDe(apagada, HLM), null);
  assert.equal(S.puedeVerDatosAnteriores(apagada, HLM, { ['cliente_' + HLM]: true }), false);
});

test('tablero del padre: prendida -> cliente, supervisor y calidad lo abren; apagada -> solo el administrador', async () => {
  for (const t of [admin, cli, sup, cal]) assert.equal(await abrir(t, HLM), 200);
  assert.equal(await abrir(soloSede, HLM), 403, 'quien solo tiene una sede no ve los datos mezclados');
  ponerOpcion({ visible: false, etiqueta: 'Datos anteriores (agosto, sin separar por sede)' });
  try {
    assert.equal(await abrir(admin, HLM), 200);
    for (const t of [cli, sup, cal]) assert.equal(await abrir(t, HLM), 403);
    ponerOpcion(undefined);
    assert.equal(await abrir(cli, HLM), 403, 'sin la opcion: solo el administrador');
  } finally {
    ponerOpcion({ visible: true, etiqueta: 'Datos anteriores (agosto, sin separar por sede)' });
  }
  // Las sedes siguen abriendo igual.
  assert.equal(await abrir(cli, S33), 200);
});

test('solo lectura: las cargas al padre siguen rechazadas y el supervisor no cambia su configuracion', async () => {
  const fila = { fecha: '2026-08-04', skillName: 'F354B', totalLlamadas: 5, contestadas: 4, llamadasAbandonadas: 1 };
  for (const t of [admin, sup]) {
    const r = await request(app).post('/api/calidad/trafico/carga').set(H(t)).send({ campana: HLM, archivoNombre: 's.xlsx', filas: [fila] });
    assert.equal(r.status, 400, JSON.stringify(r.body));
    assert.match(r.body.error, /se suben por sede/);
  }
  const skills = { campana: HLM, skills: [{ codigo: '0', nombre: 'WHATSAPP DE SALIDA' }] };
  assert.equal((await request(app).put('/api/calidad/tipificacion/skills-whatsapp').set(H(sup)).send(skills)).status, 403);
  // En su sede el supervisor sigue pudiendo.
  assert.notEqual((await request(app).put('/api/calidad/tipificacion/skills-whatsapp').set(H(sup)).send({ ...skills, campana: S33 })).status, 403);
});
