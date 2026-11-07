// fase287-privacidad-cliente.test.js — Fase 287 (revision del 07/11, hallazgo #5).
// Lo que recibe una cuenta de cliente (CLIENTES_DASH):
//  - monitoreos: nunca evaluador, observaciones ni «Motivo de afectacion»;
//  - Aurora y HLM (asesorOcultoCliente): ningun nombre de asesor en Calidad,
//    Tipificacion, Salida, Agendas por usuaria ni el resumen de Calidad ("Asesor N");
//  - ORLANT y Mobilize siguen viendo los nombres como hoy.
// Y las observaciones NUEVAS de los monitoreos pasan por la revision de datos de
// pacientes de Errores. Asesores, evaluadores y textos INVENTADOS.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { app, db, request, tokenFor, MASTER_PASSWORD } = require('./helpers');
const reg = require('../clientes-registro');

const AURORA = 'CLINICA AURORA';
const HLM = 'HOSPITAL LA MARIA';
const H = (t) => ({ Authorization: 'Bearer ' + t });
const CLAVE = 'ClavePrueba1234';
const MES = '2026-10';
async function cuenta(rol, perms) {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const user = 'p287_' + Math.random().toString(36).slice(2, 8);
  const r = await request(app).post('/api/users').set(H(admin)).send({ nombre: 'Cuenta Sintética', user, password: CLAVE, rol, perms });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return tokenFor(user, CLAVE);
}
const cliente = (c) => cuenta('CLIENTES_DASH', { ClientesDash: true, ['cliente_' + c]: true });
// Inserta una fila llenando las columnas obligatorias que no se pasan.
function insertar(tabla, fila) {
  const cols = db.prepare(`PRAGMA table_info(${tabla})`).all();
  const o = { ...fila };
  for (const c of cols) {
    if (c.pk || o[c.name] !== undefined || !c.notnull || c.dflt_value != null) continue;
    o[c.name] = /INT|REAL/i.test(c.type) ? 0 : '';
  }
  const ks = Object.keys(o);
  return db.prepare(`INSERT INTO ${tabla} (${ks.join(',')}) VALUES (${ks.map((k) => '@' + k).join(',')})`).run(o).lastInsertRowid;
}
function monitoreo(campana, asesor, extra) {
  return insertar('monitoreos', {
    campana, asesor, fecha: MES + '-15', mes: MES, canal: 'LLAMADA', idLlamada: 'ID-' + Math.random().toString(36).slice(2, 7),
    telefono: '3000000000', codificacion: 'COD', evaluador: 'Evaluadora Inventada', evaluadorUserId: null,
    answers: '{}', puntaje: 80, clasificacion: 'BUENO', fallos: 0, nivelCritico: 0,
    observaciones: 'Observación inventada del monitoreo', createdAt: '2026-11-07 10:00:00',
    extras: JSON.stringify({ motivo: 'Motivo inventado' }), ...(extra || {}),
  });
}

test('migracion: Aurora y HLM ocultan los nombres al cliente; ORLANT y Mobilize no', () => {
  assert.equal(reg.asesorOcultoCliente(db, AURORA), true);
  assert.equal(reg.asesorOcultoCliente(db, HLM), true);
  assert.equal(reg.asesorOcultoCliente(db, 'ORLANT'), false);
  assert.equal(reg.asesorOcultoCliente(db, 'MOBILIZE'), false);
});

test('/monitoreos: el cliente de Aurora no recibe asesor, evaluador, observaciones, motivo ni telefono; el admin si', async () => {
  monitoreo(AURORA, 'Asesora Inventada Beta');
  monitoreo(AURORA, 'Asesora Inventada Alfa');
  monitoreo(AURORA, 'Asesora Inventada Alfa');
  const c = await cliente(AURORA);
  const r = await request(app).get('/api/monitoreos?campana=' + encodeURIComponent(AURORA)).set(H(c));
  assert.equal(r.status, 200);
  assert.equal(r.body.length, 3);
  const texto = JSON.stringify(r.body);
  for (const prohibido of ['Asesora Inventada', 'Evaluadora Inventada', 'Observación inventada', 'Motivo inventado', '3000000000']) {
    assert.ok(!texto.includes(prohibido), 'el cliente recibe: ' + prohibido);
  }
  for (const m of r.body) { assert.equal(m.evaluador, undefined); assert.equal(m.observaciones, undefined); assert.equal(m.asesorUserId, null); }
  // Los conteos por asesor siguen cuadrando: 2 asesores distintos, "Asesor 1" (Alfa) con 2.
  assert.deepEqual(r.body.map((m) => m.asesor).sort(), ['Asesor 1', 'Asesor 1', 'Asesor 2']);
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const a = (await request(app).get('/api/monitoreos?campana=' + encodeURIComponent(AURORA)).set(H(admin))).body;
  assert.ok(a.every((m) => m.evaluador === 'Evaluadora Inventada' && m.observaciones && /Asesora Inventada/.test(m.asesor) && m.telefono));
});

test('/monitoreos: el cliente de Mobilize y el de ORLANT siguen viendo el asesor, pero no evaluador ni observaciones', async () => {
  for (const camp of ['MOBILIZE', 'ORLANT']) {
    monitoreo(camp, 'Asesor Inventado ' + camp);
    const c = await cliente(camp);
    const r = (await request(app).get('/api/monitoreos?campana=' + camp).set(H(c))).body;
    const m = r.find((x) => x.asesor === 'Asesor Inventado ' + camp);
    assert.ok(m, camp + ': el nombre del asesor sigue');
    assert.equal(m.evaluador, undefined, camp);
    assert.equal(m.observaciones, undefined, camp);
    assert.equal((m.extras || {}).motivo, undefined, camp);
  }
});

test('/metas/cumplimiento: el cliente no recibe el nombre de los evaluadores', async () => {
  const admin0 = await tokenFor('admin', MASTER_PASSWORD);
  const lider = await request(app).post('/api/users').set(H(admin0)).send({ nombre: 'Evaluadora Inventada', user: 'p287l_' + Math.random().toString(36).slice(2, 7), password: CLAVE, rol: 'CALIDAD', perms: { Calidad: true, ['campana_' + AURORA]: true } });
  assert.equal(lider.status, 201, JSON.stringify(lider.body));
  insertar('cronograma_metas', { campana: AURORA, mes: MES, liderId: lider.body.id, liderNombre: 'Evaluadora Inventada', metaGrupal: 10 });
  const c = await cliente(AURORA);
  const r = await request(app).get('/api/metas/cumplimiento?campana=' + encodeURIComponent(AURORA) + '&mes=' + MES).set(H(c));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.ok(r.body.lideres.length >= 1);
  assert.ok(!JSON.stringify(r.body).includes('Evaluadora Inventada'));
});

test('Tipificacion y Salida de Aurora: el cliente no recibe la lista de agentes ni filtra por agente', async () => {
  for (const [agente, n] of [['Agente Inventado Uno', 3], ['Agente Inventado Dos', 2]]) {
    for (let k = 0; k < n; k++) insertar('tipificaciones', { campana: AURORA, canal: 'LLAMADAS', agente, fecha: MES + '-0' + (k + 1), tipificacion: 'Cita asignada', skill: '-', createdAt: '2026-11-07' });
  }
  const c = await cliente(AURORA);
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const q = '?campana=' + encodeURIComponent(AURORA) + '&canal=LLAMADAS';
  const opC = (await request(app).get('/api/calidad/tipificacion/opciones' + q).set(H(c))).body;
  const opA = (await request(app).get('/api/calidad/tipificacion/opciones' + q).set(H(admin))).body;
  assert.deepEqual(opC.agentes, []);
  assert.ok(opA.agentes.includes('Agente Inventado Uno'), 'el admin sigue con la lista');
  const conFiltro = (await request(app).get('/api/calidad/tipificacion/por-tipo' + q + '&agente=' + encodeURIComponent('Agente Inventado Dos')).set(H(c))).body;
  const sinFiltro = (await request(app).get('/api/calidad/tipificacion/por-tipo' + q).set(H(c))).body;
  assert.deepEqual(conFiltro, sinFiltro, 'el ?agente= del cliente se ignora');
  const sal = await request(app).get('/api/calidad/salida/asesores?campana=' + encodeURIComponent(AURORA) + '&mes=' + MES).set(H(c));
  assert.equal(sal.status, 200);
  assert.deepEqual(sal.body.asesores, []);
  assert.ok(!JSON.stringify(sal.body).includes('Agente Inventado'));
});

test('Agendas por usuaria y resumen de Calidad de Aurora: "Asesor N" para el cliente, el nombre real para el admin', async () => {
  db.prepare("INSERT OR IGNORE INTO alias_asesores (campana, alias, canonico, createdAt) VALUES (?, 'usr287a', 'Asesora Real Inventada', '2026-11-07')").run(AURORA);
  insertar('agendas_usuaria', { campana: AURORA, mes: MES, sede: 'Sede', usuario: 'usr287a', canal: 'Llamada', tipoCita: 'Cita', tipoPaciente: 'Nuevo', rol: 'confirma', n: 4, createdAt: '2026-11-07' });
  insertar('calidad_resumen_asesor', { campana: AURORA, mes: MES, agente: 'Asesora Resumen Inventada', monitoreos: 2, puntaje: 90, fallos: 0, createdAt: '2026-11-07' });
  const c = await cliente(AURORA);
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const q = '?campana=' + encodeURIComponent(AURORA);
  const agC = await request(app).get('/api/calidad/agendas-usuaria/datos' + q).set(H(c));
  assert.equal(agC.status, 200, JSON.stringify(agC.body));
  assert.ok(!JSON.stringify(agC.body).includes('Asesora Real Inventada') && !JSON.stringify(agC.body).includes('usr287a'));
  assert.ok(agC.body.filas.some((f) => /^Asesor \d+$/.test(f.asesora)));
  const agA = (await request(app).get('/api/calidad/agendas-usuaria/datos' + q).set(H(admin))).body;
  assert.ok(agA.filas.some((f) => f.asesora === 'Asesora Real Inventada'));
  const reC = (await request(app).get('/api/calidad/calidad-resumen/mensual' + q).set(H(c))).body;
  assert.ok(!JSON.stringify(reC).includes('Asesora Resumen Inventada'));
});

test('observaciones nuevas con un documento o telefono: se rechazan al crear, editar y en la carga masiva', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const answers = Object.fromEntries(Array.from({ length: 17 }, (_, i) => [String(i + 1), 'SI']));
  const base = { campana: 'ORLANT', asesor: 'Asesor Inventado', fecha: MES + '-15', answers };
  const malo = await request(app).post('/api/monitoreos').set(H(admin)).send({ ...base, observaciones: 'Paciente con cédula 1036555777' });
  assert.equal(malo.status, 400); assert.match(malo.body.error, /datos de pacientes/);
  const bueno = await request(app).post('/api/monitoreos').set(H(admin)).send({ ...base, observaciones: 'Saludo correcto.' });
  assert.equal(bueno.status, 201, JSON.stringify(bueno.body));
  const ed = await request(app).put('/api/monitoreos/' + bueno.body.id).set(H(admin)).send({ observaciones: 'Llamar al 300 123 4567' });
  assert.equal(ed.status, 400);
  // Lo ya guardado no se vuelve a revisar al editar otra cosa.
  const viejo = monitoreo('ORLANT', 'Asesor Inventado', { observaciones: 'Texto viejo 1036555777', answers: JSON.stringify(answers) });
  const ed2 = await request(app).put('/api/monitoreos/' + viejo).set(H(admin)).send({ codificacion: 'COD' });
  assert.notEqual(ed2.status, 400, JSON.stringify(ed2.body));
  const bulk = await request(app).post('/api/monitoreos/bulk').set(H(admin)).send({ campana: 'ORLANT', filas: [
    { asesor: 'Asesor Inventado', fecha: MES + '-16', canal: 'LLAMADA', answers, observaciones: 'Doc 1036 555 777' },
    { asesor: 'Asesor Inventado', fecha: MES + '-16', canal: 'LLAMADA', answers, observaciones: 'Bien.' },
  ] });
  assert.equal(bulk.status, 201, JSON.stringify(bulk.body));
  assert.equal(bulk.body.insertadas, 1);
  assert.equal(bulk.body.omitidas, 1);
  assert.ok((bulk.body.avisos || []).some((a) => /dato de paciente/.test(a)), JSON.stringify(bulk.body));
});
