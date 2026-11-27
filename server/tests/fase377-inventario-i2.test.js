// fase377-inventario-i2.test.js — Fase 377 (I2 del plan con el diseño de Edwin): campos nuevos
// (velocidad, tipo de disco del portátil, precio y renta mensual), propietarios precargados,
// rendimiento según la RAM (bajo < 8 GB, medio 8 a 15, alto 16 o más) y filtros nuevos
// (sin sede/operación/propietario, propietario, rendimiento, datos pendientes, seriales repetidos).
// Datos INVENTADOS.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const bcrypt = require('bcryptjs');
const { request, app, db, tokenFor } = require('./helpers');
const { completar, crearIncompleto } = require('./helpers-activos'); // Fase INV2: registrar exige todos los campos
const A = require('../activos');

const H = (t) => ({ Authorization: 'Bearer ' + t });
let tk;
before(async () => {
  db.prepare(`INSERT INTO users (nombre, user, rol, active, password_hash, perms, createdAt, debe_cambiar_password) VALUES (?,?,?,1,?,?,?,0)`)
    .run('Persona Inventada f377', 'f377_sis', 'SISTEMAS', bcrypt.hashSync('Clave#2026x', 4), '{}', new Date().toISOString());
  tk = await tokenFor('f377_sis', 'Clave#2026x');
});
const get = (url) => request(app).get('/api' + url).set(H(tk));
const post = (url, b) => request(app).post('/api' + url).set(H(tk)).send(url === '/activos' ? completar(b) : b);
const codigos = async (q) => (await get('/activos?ambito=sistemas&' + q)).body.activos.map((a) => a.codigo).sort();

test('campos nuevos en su lugar y propietarios precargados (migración)', async () => {
  assert.ok(db.prepare("SELECT 1 FROM schema_migrations WHERE name = 'fase377_inventario_campos_v1'").get());
  const cfg = (await get('/activos/config')).body;
  const k = (c) => cfg.tipos.find((t) => t.codigo === c).campos.map((x) => x.k);
  assert.deepEqual(k('TORRE'), ['nombre_equipo', 'procesador', 'velocidad', 'ram_gb', 'disco', 'tipo_disco', 'precio', 'renta_mensual']);
  assert.deepEqual(k('PORTATIL'), ['nombre_equipo', 'procesador', 'velocidad', 'ram_gb', 'disco', 'tipo_disco', 'cargador', 'precio', 'renta_mensual']);
  for (const c of ['MONITOR', 'TECLADO', 'MOUSE', 'DIADEMA']) assert.deepEqual(k(c).slice(-2), ['precio', 'renta_mensual'], c);
  assert.ok(k('ADMINISTRABLE').includes('precio'), 'Fase 380: el administrable también lleva precio');
  assert.deepEqual((await get('/activos/config?ambito=inmuebles')).body.tipos.map((t) => t.campos.length), [0, 0, 0]);
  assert.deepEqual(cfg.listas.proveedores, ['InConexión', 'Alcom']);
  assert.deepEqual(cfg.rendimientos.map((r) => r.codigo), ['bajo', 'medio', 'alto', 'sin']);
});

test('agregar los campos es idempotente y respeta lo que Sistemas ocultó o renombró', () => {
  const t = db.prepare("SELECT campos FROM activos_tipos WHERE codigo = 'MONITOR'").get();
  const campos = JSON.parse(t.campos).map((c) => (c.k === 'precio' ? Object.assign(c, { l: 'Valor de compra', oculto: true }) : c));
  db.prepare("UPDATE activos_tipos SET campos = ? WHERE codigo = 'MONITOR'").run(JSON.stringify(campos));
  A.agregarCamposI2(db); A.agregarCamposI2(db);
  const despues = JSON.parse(db.prepare("SELECT campos FROM activos_tipos WHERE codigo = 'MONITOR'").get().campos);
  assert.deepEqual(despues, campos);
  // deja el monitor como estaba para las demás pruebas
  db.prepare("UPDATE activos_tipos SET campos = ? WHERE codigo = 'MONITOR'").run(JSON.stringify(campos.map((c) => (c.k === 'precio' ? { k: 'precio', l: 'Precio', t: 'numero' } : c))));
});

test('rendimiento según la RAM en la lista, el detalle y el panel', async () => {
  assert.deepEqual([A.rendimientoDe(4), A.rendimientoDe(7.9), A.rendimientoDe(8), A.rendimientoDe(15), A.rendimientoDe(16), A.rendimientoDe(undefined), A.rendimientoDe(0)], ['bajo', 'bajo', 'medio', 'medio', 'alto', 'sin', 'sin']);
  for (const [codigo, ram] of [['T-1', 4], ['T-2', 8], ['T-3', 16], ['T-4', null]]) {
    const b = { tipo: 'TORRE', codigo, sede: 'Medellín', operacion: 'Mobilize', marca: 'MarcaX', modelo: 'M1', serial: 'S-' + codigo, proveedor: 'Alcom', datos: ram ? { ram_gb: ram, velocidad: '2,9 GHz', precio: 1500000, renta_mensual: 90000 } : {} };
    const r = ram ? await post('/activos', b) : crearIncompleto(b); // Fase INV2: sin RAM solo llega por la importación
    assert.equal(r.status, 201, JSON.stringify(r.body));
  }
  const p = crearIncompleto({ tipo: 'PORTATIL', codigo: 'P-1', datos: { ram_gb: 12, tipo_disco: 'SSD' } }); // datos pendientes (importación)
  assert.equal(p.status, 201, JSON.stringify(p.body));
  assert.equal(p.body.activo.rendimiento, 'medio');
  assert.equal(p.body.activo.datos.tipo_disco, 'SSD');
  const m = crearIncompleto({ tipo: 'MONITOR', codigo: 'MO-1', serial: 'S-T-1', datos: { precio: 400000 } });
  assert.equal(m.body.activo.rendimiento, null, 'un monitor no lleva rendimiento');
  assert.deepEqual(await codigos('rend=bajo'), ['T-1']);
  assert.deepEqual(await codigos('rend=medio'), ['P-1', 'T-2']);
  assert.deepEqual(await codigos('rend=alto'), ['T-3']);
  assert.deepEqual(await codigos('rend=sin'), ['T-4']);
  assert.equal((await codigos('rend=raro')).length, 6, 'un rendimiento desconocido no filtra');
  const r = (await get('/activos/resumen?ambito=sistemas')).body;
  assert.deepEqual(r.porRendimiento, { bajo: 1, medio: 2, alto: 1, sin: 1 });
  assert.equal((await get('/activos/resumen?ambito=inmuebles')).body.porRendimiento, null);
  const h = (await get('/activos/' + p.body.activo.id + '/historial')).body;
  assert.equal(h.activo.rendimiento, 'medio');
});

test('filtros: sin sede/operación/propietario, propietario, datos pendientes y seriales repetidos', async () => {
  assert.deepEqual(await codigos('proveedor=Alcom'), ['T-1', 'T-2', 'T-3', 'T-4']);
  assert.deepEqual(await codigos('proveedor=__none'), ['MO-1', 'P-1']);
  assert.deepEqual(await codigos('sede=__none'), ['MO-1', 'P-1']);
  assert.deepEqual(await codigos('operacion=__none&tipo=PORTATIL'), ['P-1']);
  assert.deepEqual(await codigos('pend=1'), ['MO-1', 'P-1']);
  assert.deepEqual(await codigos('dup=1'), [], 'el mismo serial en distinto tipo no cuenta');
  assert.equal((await post('/activos', { tipo: 'TORRE', codigo: 'T-5', serial: 'S-T-1' })).status, 201);
  assert.deepEqual(await codigos('dup=1'), ['T-1', 'T-5']);
  assert.equal((await get('/activos?ambito=sistemas&pend=si')).body.activos.length, 7, 'pend solo con 1');
});

test('interfaz: consulta, columna de rendimiento y tarjetas del panel (escapadas)', () => {
  global.esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  try {
    const UI = require(path.join(__dirname, '..', '..', 'public', 'js', 'activos.js'));
    assert.equal(UI.activosConsulta({ ambito: 'sistemas', sede: '__none', rend: 'bajo', proveedor: 'A&B', pend: true, dup: false, q: '' }), 'ambito=sistemas&sede=__none&proveedor=A%26B&rend=bajo&pend=1');
    const config = { tipos: [{ codigo: 'TORRE', nombre: 'Torre', campos: [] }, { codigo: 'MOUSE', nombre: 'Mouse', campos: [] }], estados: A.ESTADOS, rendimientos: A.RENDIMIENTOS };
    const fila = { id: 1, codigo: '<b>', tipo: 'TORRE', estado: 'libre', marca: '', modelo: '', serial: '', sede: '', operacion: '<i>', datos: { ram_gb: 4 }, rendimiento: 'bajo', agente: null };
    const html = UI.activosListaHtml([fila], config);
    assert.ok(html.includes('<th scope="col">RAM</th>') /* GH5c: el rendimiento va en la columna RAM */ && html.includes('vis-rojo') && html.includes('4 GB'));
    assert.ok(!html.includes('<b>') && !html.includes('<i>'));
    const sinRam = UI.activosListaHtml([Object.assign({}, fila, { tipo: 'MOUSE', rendimiento: null, datos: {} })], config);
    assert.ok(!sinRam.includes('>RAM<'), 'sin elementos con RAM no hay columna');
    const panel = UI.activosPanelHtml({ total: 2, porEstado: { libre: 2 }, porTipo: { TORRE: { libre: 2 } }, porSede: [], porRendimiento: { bajo: 1, medio: 0, alto: 1, sin: 0 } }, config);
    assert.ok(panel.includes('Rendimiento según la RAM') && panel.includes("activosVerRendimiento('alto')") && panel.includes('16 GB o más'));
    assert.ok(!UI.activosPanelHtml({ total: 1, porEstado: { libre: 1 }, porTipo: {}, porSede: [], porRendimiento: null }, config).includes('Rendimiento según'));
  } finally { delete global.esc; }
});
