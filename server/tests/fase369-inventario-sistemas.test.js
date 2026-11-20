// fase369-inventario-sistemas.test.js — Fase 369 (pedido de Edwin 18/11, E1): «Inventario de sistemas».
// Empieza limpio; solo ADMIN y SISTEMAS; elementos por código con estados, cambio de estado con
// motivo e historial; listas; el Inventario anterior queda solo para ADMIN. Datos INVENTADOS.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const bcrypt = require('bcryptjs');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');

const H = (t) => ({ Authorization: 'Bearer ' + t });
const tk = {};
function crear(user, rol, perms) {
  db.prepare(`INSERT INTO users (nombre, user, rol, active, password_hash, perms, createdAt, debe_cambiar_password) VALUES (?,?,?,1,?,?,?,0)`)
    .run('Persona Inventada ' + user, user, rol, bcrypt.hashSync('Clave#2026x', 4), JSON.stringify(perms), new Date().toISOString());
}
before(async () => {
  crear('f369_sis', 'SISTEMAS', {});
  crear('f369_inv', 'INVENTARIO', { Inventario: true });
  crear('f369_sup', 'SUPERVISOR', { supervisa_ORLANT: true });
  tk.admin = await tokenFor('admin', MASTER_PASSWORD);
  for (const u of ['sis', 'inv', 'sup']) tk[u] = await tokenFor('f369_' + u, 'Clave#2026x');
});
const post = (t, b) => request(app).post('/api/activos').set(H(t)).send(b);

test('empieza limpio: ningún elemento ni lista; los 7 tipos sembrados', async () => {
  assert.equal(db.prepare('SELECT COUNT(*) n FROM activos').get().n, 0);
  // Fase 376: las listas traen precargadas las sedes y operaciones del diseño de Edwin (sin elementos).
  assert.deepEqual(db.prepare('SELECT lista, COUNT(*) n FROM activos_listas GROUP BY lista ORDER BY lista').all().map((r) => [r.lista, r.n]), [['operaciones', 9], ['proveedores', 2], ['sedes', 3]]); // Fase 377: + propietarios del diseño
  const c = await request(app).get('/api/activos/config').set(H(tk.sis));
  assert.equal(c.status, 200);
  assert.deepEqual(c.body.tipos.map((t) => t.codigo), ['TORRE', 'MONITOR', 'TECLADO', 'MOUSE', 'DIADEMA', 'PORTATIL', 'ADMINISTRABLE']);
  assert.deepEqual(c.body.estados.map((e) => e.codigo), ['libre', 'en_uso', 'en_reparacion', 'malo', 'de_baja']);
  assert.ok(!c.body.tipos.some((t) => /mesa/i.test(t.nombre)), 'sin «equipo de mesa»: cada elemento por separado');
});

test('solo ADMIN y SISTEMAS', async () => {
  for (const k of ['inv', 'sup']) {
    assert.equal((await request(app).get('/api/activos/resumen').set(H(tk[k]))).status, 403, k);
    assert.equal((await post(tk[k], { tipo: 'MOUSE', codigo: 'M-1' })).status, 403, k);
  }
  assert.equal((await request(app).get('/api/activos/resumen')).status, 401);
  assert.equal((await request(app).get('/api/activos/resumen').set(H(tk.admin))).status, 200);
});

test('listas, registro con validaciones, código único por tipo, panel', async () => {
  assert.equal((await request(app).put('/api/activos/listas/sedes').set(H(tk.sis)).send({ valores: ['Sede Inventada Norte', 'Sede Inventada Sur', 'Sede Inventada Norte'] })).body.valores.length, 2);
  assert.equal((await request(app).put('/api/activos/listas/otra').set(H(tk.sis)).send({ valores: ['x'] })).status, 404);
  const t = await post(tk.sis, { tipo: 'TORRE', codigo: 'T-001', marca: 'MarcaX', sede: 'Sede Inventada Norte', datos: { ram_gb: 8, tipo_disco: 'SSD', procesador: 'Inventado i5' } });
  assert.equal(t.status, 201, JSON.stringify(t.body));
  assert.deepEqual([t.body.activo.estado, t.body.activo.datos.ram_gb], ['libre', 8]);
  assert.equal((await post(tk.sis, { tipo: 'TORRE', codigo: 'T-001' })).status, 409, 'código repetido en el mismo tipo');
  assert.equal((await post(tk.sis, { tipo: 'MONITOR', codigo: 'T-001' })).status, 201, 'el mismo código en otro tipo sí');
  for (const malo of [{ tipo: 'TORRE', codigo: '' }, { tipo: 'NAVE', codigo: 'X1' }, { tipo: 'TORRE', codigo: 'T-9', sede: 'Sede que no existe' }, { tipo: 'TORRE', codigo: 'T-9', datos: { ram_gb: 'mucha' } },
    { tipo: 'TORRE', codigo: 'T-9', datos: { tipo_disco: 'Cinta' } }, { tipo: 'ADMINISTRABLE', codigo: 'SW-1', datos: { ip: '300.1.1.1' } }, { tipo: 'MOUSE', codigo: 'M-9', estado: 'en_uso' }, { tipo: 'MOUSE', codigo: 'M-9', otro: 1 }]) {
    assert.equal((await post(tk.sis, malo)).status, 400, JSON.stringify(malo));
  }
  assert.equal((await post(tk.admin, { tipo: 'MOUSE', codigo: 'M-1', estado: 'malo' })).status, 201);
  const r = (await request(app).get('/api/activos/resumen').set(H(tk.sis))).body;
  assert.equal(r.total, 3);
  assert.deepEqual([r.porEstado.libre, r.porEstado.malo], [2, 1]);
  assert.equal(r.porTipo.TORRE.libre, 1);
  const l = (await request(app).get('/api/activos?tipo=TORRE&q=MarcaX').set(H(tk.sis))).body.activos;
  assert.deepEqual(l.map((a) => a.codigo), ['T-001']);
  assert.ok(db.prepare("SELECT 1 FROM historial WHERE accion = 'ACTIVO_INGRESO'").get());
});

test('cambio de estado con motivo, historial; «en uso» solo por asignación (salvo administrables); de baja es final', async () => {
  const t = db.prepare("SELECT id FROM activos WHERE tipo = 'TORRE' AND codigo = 'T-001'").get();
  const est = (b) => request(app).post('/api/activos/' + t.id + '/estado').set(H(tk.sis)).send(b);
  assert.equal((await est({ estado: 'en_reparacion' })).status, 400, 'sin motivo');
  assert.equal((await est({ estado: 'en_uso', motivo: 'asignada' })).status, 400);
  assert.equal((await est({ estado: 'en_reparacion', motivo: 'No enciende' })).status, 200);
  assert.equal((await est({ estado: 'de_baja', motivo: 'Tarjeta madre quemada' })).status, 200);
  assert.equal((await est({ estado: 'libre', motivo: 'Volvió' })).status, 400, 'de baja no vuelve');
  const h = (await request(app).get('/api/activos/' + t.id + '/historial').set(H(tk.sis))).body.historial;
  assert.deepEqual(h.map((x) => [x.accion, x.estadoAntes, x.estadoDespues, x.motivo]), [
    ['Cambio de estado', 'en_reparacion', 'de_baja', 'Tarjeta madre quemada'], ['Cambio de estado', 'libre', 'en_reparacion', 'No enciende'], ['Ingreso', null, 'libre', '']]);
  const sw = await post(tk.sis, { tipo: 'ADMINISTRABLE', codigo: 'SW-1', datos: { subtipo: 'Switch', ip: '192.168.1.10' } });
  assert.equal((await request(app).post('/api/activos/' + sw.body.activo.id + '/estado').set(H(tk.sis)).send({ estado: 'en_uso', motivo: 'Instalado en el rack' })).status, 200);
  // Editar: no cambia tipo, código ni estado.
  assert.equal((await request(app).put('/api/activos/' + sw.body.activo.id).set(H(tk.sis)).send({ codigo: 'otro' })).status, 400);
  const e = await request(app).put('/api/activos/' + sw.body.activo.id).set(H(tk.sis)).send({ marca: 'MarcaY', datos: { subtipo: 'Switch', ip: '192.168.1.11' } });
  assert.equal(e.status, 200, JSON.stringify(e.body));
  assert.deepEqual([e.body.activo.marca, e.body.activo.datos.ip, e.body.activo.estado], ['MarcaY', '192.168.1.11', 'en_uso']);
});

// Fase 383: el Inventario anterior se retiró del todo (410 también para ADMIN; sin tarjeta para nadie).
test('el Inventario anterior está retirado', async () => {
  assert.equal((await request(app).get('/api/inventario/items').set(H(tk.inv))).status, 410);
  assert.equal((await request(app).get('/api/inventario/items').set(H(tk.admin))).status, 410);
  const constantes = require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'public', 'js', 'constants.js'), 'utf8');
  assert.ok(!/key:'Inventario'/.test(constantes), 'sin la tarjeta «Inventario» en DASH_MODULES');
  const L = require('../../public/js/dashboards-logic.js');
  assert.ok(L.dashTarjetasEntrada('SISTEMAS', false, false).some((t) => t.key === 'activos'));
  assert.ok(L.dashTarjetasEntrada('ADMIN', true, false).some((t) => t.key === 'activos'));
  assert.ok(!L.dashTarjetasEntrada('SUPERVISOR', false, false).some((t) => t.key === 'activos'));
});

test('interfaz: panel y lista escapan los textos', () => {
  global.esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  try {
    const UI = require(path.join(__dirname, '..', '..', 'public', 'js', 'activos.js'));
    const config = { estados: [{ codigo: 'libre', nombre: 'Libre' }], tipos: [{ codigo: 'MOUSE', nombre: 'Mouse', plural: 'Mouse', campos: [] }] };
    const html = UI.activosListaHtml([{ id: 1, tipo: 'MOUSE', codigo: '<b>M</b>', estado: 'libre', marca: '', modelo: '', serial: '', sede: '' }], config);
    assert.ok(html.includes('&lt;b&gt;M&lt;/b&gt;') && !html.includes('<b>M'));
    assert.match(UI.activosPanelHtml({ total: 0, porEstado: { libre: 0 }, porTipo: {}, porSede: [] }, config), /Aún no hay elementos/);
  } finally { delete global.esc; }
});
