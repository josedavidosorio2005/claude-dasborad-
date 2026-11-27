// fase379-inventario-i4.test.js — Fase 379 (I4 del plan con el diseño de Edwin): actas automáticas por
// cada movimiento (entrega, devolución, cambio, reparación, recibo de reparación, malo, baja), vista
// «Actas» con filtros y conteos, atrasadas por días hábiles y anular sin borrar. Datos INVENTADOS.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const bcrypt = require('bcryptjs');
const { request, app, db, tokenFor } = require('./helpers');
const { completar } = require('./helpers-activos'); // Fase INV2: registrar exige todos los campos
const ACT = require('../activos-actas');

const H = (t) => ({ Authorization: 'Bearer ' + t });
let tk;
const ids = {};
before(async () => {
  for (const [u, rol] of [['f379_sis', 'SISTEMAS'], ['f379_sup', 'SUPERVISOR']]) {
    db.prepare(`INSERT INTO users (nombre, user, rol, active, password_hash, perms, createdAt, debe_cambiar_password) VALUES (?,?,?,1,?,?,?,0)`)
      .run('Persona Inventada ' + u, u, rol, bcrypt.hashSync('Clave#2026x', 4), '{}', new Date().toISOString());
  }
  tk = { sis: await tokenFor('f379_sis', 'Clave#2026x'), sup: await tokenFor('f379_sup', 'Clave#2026x') };
  for (const [tipo, codigo] of [['DIADEMA', 'I4-D1'], ['DIADEMA', 'I4-D2'], ['TORRE', 'I4-T1'], ['SILLA', 'I4-S1']]) {
    const r = await request(app).post('/api/activos').set(H(tk.sis)).send(completar({ tipo, codigo, marca: 'MarcaX' }));
    assert.equal(r.status, 201, JSON.stringify(r.body));
    ids[codigo] = r.body.activo.id;
  }
  for (const [k, doc] of [['ag1', '7000001'], ['ag2', '7000002']]) ids[k] = (await request(app).post('/api/activos/agentes').set(H(tk.sis)).send({ nombre: 'Agente Inventado ' + k, documento: doc })).body.agente.id;
});
const P = (url, b, t) => request(app).post('/api' + url).set(H(t || tk.sis)).send(b);
const G = (url, t) => request(app).get('/api' + url).set(H(t || tk.sis));
const tipos = (r) => (r.body.actas || []).map((a) => a.tipo);

test('cada movimiento crea su acta automática', async () => {
  const a1 = await P('/activos/' + ids['I4-D1'] + '/asignar', { agenteId: ids.ag1 });
  assert.deepEqual(tipos(a1), ['entrega']);
  const acta = a1.body.actas[0];
  assert.deepEqual([acta.auto, acta.estado, acta.agente.nombre, acta.elementos[0].codigo, acta.elementos[0].dir], [true, 'completar', 'Agente Inventado ag1', 'I4-D1', 'recibe']); // Fase INV4: nace «por completar»
  assert.ok(acta.texto.length > 10);
  assert.deepEqual(tipos(await P('/activos/' + ids['I4-D1'] + '/reasignar', { agenteId: ids.ag2, motivo: 'Cambio de puesto' })), ['devolucion', 'entrega']);
  const c = await P('/activos/' + ids['I4-D1'] + '/cambiar', { nuevoId: ids['I4-D2'], estado: 'malo', motivo: 'Micrófono dañado' });
  assert.deepEqual(tipos(c), ['cambio']);
  assert.deepEqual(c.body.actas[0].elementos.map((e) => [e.codigo, e.dir, e.queda || '']), [['I4-D1', 'devuelve', 'Malo'], ['I4-D2', 'recibe', '']]);
  assert.deepEqual(tipos(await P('/activos/' + ids['I4-D2'] + '/devolver', { estado: 'libre', motivo: 'Vacaciones' })), ['devolucion']);
  const rep = await P('/activos/' + ids['I4-T1'] + '/estado', { estado: 'en_reparacion', motivo: 'No enciende', tecnico: 'Taller inventado' });
  assert.deepEqual(tipos(rep), ['reparacion']);
  assert.deepEqual([rep.body.actas[0].agente, rep.body.actas[0].tecnico], [null, 'Taller inventado']);
  assert.deepEqual(tipos(await P('/activos/' + ids['I4-T1'] + '/estado', { estado: 'libre', motivo: 'Reparada' })), ['retorno']);
  assert.deepEqual(tipos(await P('/activos/' + ids['I4-D1'] + '/estado', { estado: 'de_baja', motivo: 'Sin arreglo' })), ['baja']);
  // Un asignado que pasa a malo: un solo acta (malo), con el agente.
  await P('/activos/' + ids['I4-D2'] + '/asignar', { agenteId: ids.ag1 });
  const m = await P('/activos/' + ids['I4-D2'] + '/estado', { estado: 'malo', motivo: 'Cable roto' });
  assert.deepEqual([tipos(m), m.body.actas[0].agente.nombre, m.body.actas[0].elementos[0].dir], [['malo'], 'Agente Inventado ag1', 'devuelve']);
  // Los inmuebles no llevan actas.
  assert.deepEqual(tipos(await P('/activos/' + ids['I4-S1'] + '/estado', { estado: 'malo', motivo: 'Pata rota' })), []);
});

test('vista Actas: filtros, conteos, anular sin borrar y permisos', async () => {
  const todas = (await G('/activos/actas')).body;
  assert.equal(todas.actas.length, 10);
  assert.deepEqual(todas.resumen, { porCompletar: 10, pendientes: 0, firmadas: 0, atrasadas: 0, anuladas: 0, total: 10 }); // Fase INV4
  assert.equal((await G('/activos/actas?tipo=entrega')).body.actas.length, 3);
  assert.equal((await G('/activos/actas?q=Taller')).body.actas.length, 1);
  const una = todas.actas[0];
  assert.match((await P('/activos/actas/' + una.id + '/anular', { motivo: '' })).body.error, /motivo/);
  const an = await P('/activos/actas/' + una.id + '/anular', { motivo: 'Creada por error' });
  assert.equal(an.status, 200, JSON.stringify(an.body));
  assert.equal(an.body.acta.estado, 'anulada');
  assert.match((await P('/activos/actas/' + una.id + '/anular', { motivo: 'Otra vez' })).body.error, /ya está anulada/);
  assert.equal((await P('/activos/actas/' + una.id + '/firmada', { pdf: 'x' })).status, 400, 'una anulada no recibe firmada');
  assert.equal((await G('/activos/actas?estado=anulada')).body.actas.length, 1);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM activos_actas').get().n, 10, 'nada se borra');
  assert.equal((await G('/activos/actas', tk.sup)).status, 403);
  assert.equal((await P('/activos/actas/' + todas.actas[1].id + '/anular', { motivo: 'x x x' }, tk.sup)).status, 403);
  assert.equal((await G('/activos/resumen?ambito=sistemas')).body.actasPorFirmar, 9);
});

test('atrasadas: 3 o más días hábiles sin firmar (lunes a viernes)', async () => {
  // jueves 12/11 → lunes 16/11 = 2 hábiles; → martes 17/11 = 3
  assert.equal(ACT.diasHabiles('2026-11-12T15:00:00Z', new Date('2026-11-16T15:00:00Z')), 2);
  assert.equal(ACT.diasHabiles('2026-11-12T15:00:00Z', new Date('2026-11-17T15:00:00Z')), 3);
  assert.equal(ACT.diasHabiles('2026-11-14T15:00:00Z', new Date('2026-11-16T15:00:00Z')), 1, 'de sábado a lunes');
  const id = (await G('/activos/actas?estado=sincerrar')).body.actas[0].id; // Fase INV4: por completar también se atrasa
  db.prepare("UPDATE activos_actas SET fecha = '2026-01-05T15:00:00.000Z' WHERE id = ?").run(id);
  const r = (await G('/activos/actas?estado=atrasada')).body;
  assert.deepEqual(r.actas.map((a) => a.id), [id]);
  assert.equal(r.resumen.atrasadas, 1);
});

test('interfaz: impresión por tipo, lista y aviso (escapados)', () => {
  global.esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  try {
    const UI = require(path.join(__dirname, '..', '..', 'public', 'js', 'activos.js'));
    const base = { id: 1, numero: 7, fecha: '2026-11-19T15:00:00Z', quien: 'x', auto: true, motivo: '<m>', estado: 'pendiente' };
    const rep = UI.activosActaPrintHtml(Object.assign({}, base, { tipo: 'reparacion', tipoNombre: 'Envío a reparación', agente: null, tecnico: 'Taller', elementos: [{ tipo: 'Torre', codigo: 'T<1>', queda: 'En reparación' }] }));
    assert.ok(rep.includes('Recibe (técnico o proveedor)') && rep.includes('Taller') && !rep.includes('<dt>Agente</dt>') && !rep.includes('T<1>') && rep.includes('&lt;m&gt;'));
    const cam = UI.activosActaPrintHtml(Object.assign({}, base, { tipo: 'cambio', tipoNombre: 'Cambio de elemento', agente: { nombre: 'A' }, elementos: [{ tipo: 'Mouse', codigo: 'M1', dir: 'devuelve', queda: 'Malo' }, { tipo: 'Mouse', codigo: 'M2', dir: 'recibe' }] }));
    assert.ok(cam.includes('<th>Movimiento</th>') && cam.includes('Devuelve') && cam.includes('Recibe') && cam.includes('<dt>Agente</dt>'));
    const lista = UI.activosActasHtml([Object.assign({}, base, { tipo: 'malo', tipoNombre: 'Elemento malo', agente: null, elementos: [{ tipo: 'Mouse', codigo: '<c>' }], atrasada: true })], true, 3);
    assert.ok(lista.includes('Atrasada (3+ días hábiles)') && lista.includes('Subir firmada') && lista.includes('Anular') && !lista.includes('<c>'));
    assert.equal(UI.activosActasAviso([{ numero: 4 }, { numero: 5 }]), '. Actas N.º 4 y 5 creadas (en «Actas»)');
    assert.equal(UI.activosActasAviso([]), '');
    assert.ok(UI.activosActasKpisHtml({ pendientes: 2, atrasadas: 1, firmadas: 0, anuladas: 0 }).includes("activosActasFiltrar('atrasada')"));
    assert.ok(UI.activosMenuHtml('sistemas', 'actas', { porEstado: {}, total: 1, actasPorFirmar: 4 }).includes('Actas</span><span class="ac-menu-n">4<'));
    assert.ok(!UI.activosMenuHtml('inmuebles', 'panel', null).includes('Actas'));
  } finally { delete global.esc; }
});
