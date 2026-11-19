// fase372-inventario-formularios.test.js — Fase 372 (pedido de Edwin 18/11, E4): formularios
// editables del «Inventario de sistemas» por ADMIN y SISTEMAS: tipos y sus campos (un campo no se
// borra, se oculta; su tipo de dato no cambia; una opción en uso no se quita), tipos nuevos y
// desactivados, motivos frecuentes y el texto del acta (cada acta guarda su copia). Datos INVENTADOS.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');

const H = (t) => ({ Authorization: 'Bearer ' + t });
const tk = {};
before(async () => {
  for (const [u, rol] of [['f372_sis', 'SISTEMAS'], ['f372_sup', 'SUPERVISOR'], ['f372_rep', 'REPORTES']]) {
    db.prepare(`INSERT INTO users (nombre, user, rol, active, password_hash, perms, createdAt, debe_cambiar_password) VALUES (?,?,?,1,?,?,?,0)`)
      .run('Persona Inventada ' + u, u, rol, bcrypt.hashSync('Clave#2026x', 4), '{}', new Date().toISOString());
  }
  tk.admin = await tokenFor('admin', MASTER_PASSWORD);
  for (const u of ['sis', 'sup', 'rep']) tk[u] = await tokenFor('f372_' + u, 'Clave#2026x');
});
const put = (t, url, b) => request(app).put('/api' + url).set(H(t)).send(b);
const post = (t, url, b) => request(app).post('/api' + url).set(H(t)).send(b);
const config = async (t) => (await request(app).get('/api/activos/config').set(H(t || tk.sis))).body;
const hist = (accion) => db.prepare('SELECT detalle FROM historial WHERE accion = ? ORDER BY id DESC').all(accion);

test('solo ADMIN y SISTEMAS editan formularios y textos', async () => {
  for (const k of ['sup', 'rep']) {
    assert.equal((await post(tk[k], '/activos/config/tipos', { nombre: 'Cámara', plural: 'Cámaras', campos: [] })).status, 403, k);
    assert.equal((await put(tk[k], '/activos/config/tipos/MOUSE', { nombre: 'Mouse', plural: 'Mouse', campos: [] })).status, 403, k);
    assert.equal((await put(tk[k], '/activos/config/tipos/MOUSE/activo', { activo: false })).status, 403, k);
    assert.equal((await put(tk[k], '/activos/config/textos/acta_entrega', { valor: 'Texto inventado de prueba' })).status, 403, k);
  }
  assert.equal((await post(undefined, '/activos/config/tipos', {})).status, 401);
  const c = await config(tk.admin);
  assert.equal(c.tiposTodos.length, 7);
  assert.ok(c.textos.acta_entrega.startsWith('Recibo los elementos'));
  assert.ok('motivos' in c.listas, 'lista nueva de motivos frecuentes');
});

test('editar campos: agregar, ocultar y reordenar; la clave y el tipo de dato no cambian; nada se borra', async () => {
  const t0 = (await config()).tiposTodos.find((t) => t.codigo === 'TORRE');
  const r = await post(tk.sis, '/activos', { tipo: 'TORRE', codigo: 'T-372', datos: { procesador: 'Inventado i7', tipo_disco: 'SSD', ram_gb: 16 } });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const id = r.body.activo.id;
  // Ocultar «Procesador», agregar «Garantía hasta» (texto) y «Puertos USB» (número), cambiar el orden y renombrar una etiqueta.
  const campos = t0.campos.map((c) => (c.k === 'procesador' ? { k: c.k, l: c.l, oculto: true } : c.k === 'tipo_disco' ? { k: c.k, l: 'Tipo de disco duro', o: c.o } : { k: c.k, l: c.l, o: c.o }));
  campos.unshift({ l: 'Garantía hasta', t: 'texto' });
  campos.push({ l: 'Puertos USB', t: 'numero' });
  const e = await put(tk.sis, '/activos/config/tipos/TORRE', { nombre: 'Torre', plural: 'Torres', campos });
  assert.equal(e.status, 200, JSON.stringify(e.body));
  const t1 = e.body.tipo;
  assert.deepEqual(t1.campos.map((c) => c.k), ['garantia_hasta', 'nombre_equipo', 'procesador', 'ram_gb', 'disco', 'tipo_disco', 'puertos_usb']);
  assert.equal(t1.campos.find((c) => c.k === 'procesador').oculto, true);
  assert.equal(t1.campos.find((c) => c.k === 'tipo_disco').l, 'Tipo de disco duro');
  assert.match(hist('ACTIVO_TIPO_EDITADO')[0].detalle, /^7 campo\(s\), 1 oculto\(s\)$/);
  // Al editar el elemento, lo guardado en el campo oculto se conserva aunque no se envíe (ni se puede cambiar).
  const ed = await put(tk.sis, '/activos/' + id, { datos: { ram_gb: 32, puertos_usb: 4, tipo_disco: 'SSD', procesador: 'Otro inventado' } });
  assert.equal(ed.status, 200, JSON.stringify(ed.body));
  assert.deepEqual([ed.body.activo.datos.procesador, ed.body.activo.datos.ram_gb, ed.body.activo.datos.puertos_usb], ['Inventado i7', 32, 4]);
  // Un campo no se borra; su tipo de dato no cambia; una clave inventada no entra.
  const sinUno = t1.campos.filter((c) => c.k !== 'disco');
  assert.match((await put(tk.sis, '/activos/config/tipos/TORRE', { nombre: 'Torre', plural: 'Torres', campos: sinUno })).body.error, /no se borra: oculta «Disco»/);
  const otroTipo = t1.campos.map((c) => (c.k === 'ram_gb' ? Object.assign({}, c, { t: 'texto' }) : c));
  assert.match((await put(tk.sis, '/activos/config/tipos/TORRE', { nombre: 'Torre', plural: 'Torres', campos: otroTipo })).body.error, /no se cambia/);
  assert.match((await put(tk.sis, '/activos/config/tipos/TORRE', { nombre: 'Torre', plural: 'Torres', campos: t1.campos.concat([{ k: 'inventada', l: 'Inventada' }]) })).body.error, /Campo no encontrado/);
  // Opción de lista en uso: no se quita; una que nadie usa, sí.
  const sinSsd = t1.campos.map((c) => (c.k === 'tipo_disco' ? Object.assign({}, c, { o: ['HDD', 'NVMe'] }) : c));
  assert.match((await put(tk.sis, '/activos/config/tipos/TORRE', { nombre: 'Torre', plural: 'Torres', campos: sinSsd })).body.error, /«SSD» la usan 1 elemento/);
  const sinHdd = t1.campos.map((c) => (c.k === 'tipo_disco' ? Object.assign({}, c, { o: ['SSD', 'NVMe', 'eMMC'] }) : c));
  assert.equal((await put(tk.sis, '/activos/config/tipos/TORRE', { nombre: 'Torre', plural: 'Torres', campos: sinHdd })).status, 200);
  // Validaciones de forma.
  for (const [b, re] of [
    [{ nombre: 'Torre', plural: 'Torres', campos: t1.campos.concat([{ l: 'Disco', t: 'texto' }]) }, /dos campos llamados/],
    [{ nombre: 'Torre', plural: 'Torres', campos: t1.campos.concat([{ l: 'Color', t: 'lista', o: [] }]) }, /opciones/],
    [{ nombre: 'Torre', plural: 'Torres', campos: t1.campos.concat([{ l: 'Color', t: 'fecha' }]) }, /texto, número o lista/],
    [{ nombre: 'Monitor', plural: 'Torres', campos: t1.campos }, /Ya hay un tipo llamado Monitor/],
    [{ nombre: 'Torre', plural: 'Torres', campos: t1.campos, extra: 1 }, /Datos no válidos/],
  ]) assert.match((await put(tk.sis, '/activos/config/tipos/TORRE', b)).body.error, re);
  assert.equal((await put(tk.sis, '/activos/config/tipos/NOEXISTE', { nombre: 'X1', plural: 'X1', campos: [] })).status, 404);
});

test('tipo nuevo: se registra con sus campos; desactivar solo sin elementos vigentes', async () => {
  const c = await post(tk.admin, '/activos/config/tipos', { nombre: 'Cámara web', plural: 'Cámaras web', campos: [{ l: 'Resolución', t: 'lista', o: ['720p', '1080p'] }] });
  assert.equal(c.status, 201, JSON.stringify(c.body));
  assert.deepEqual([c.body.tipo.codigo, c.body.tipo.campos[0].k, c.body.tipo.activo], ['CAMARA_WEB', 'resolucion', true]);
  assert.equal(hist('ACTIVO_TIPO_CREADO')[0].detalle, '1 campo(s)');
  assert.equal((await post(tk.sis, '/activos/config/tipos', { nombre: 'cámara WEB', plural: 'x2', campos: [] })).status, 400, 'nombre repetido sin importar mayúsculas');
  const el = await post(tk.sis, '/activos', { tipo: 'CAMARA_WEB', codigo: 'CW-1', datos: { resolucion: '1080p' } });
  assert.equal(el.status, 201, JSON.stringify(el.body));
  assert.match((await put(tk.sis, '/activos/config/tipos/CAMARA_WEB/activo', { activo: false })).body.error, /1 elemento\(s\) de este tipo sin dar de baja/);
  assert.equal((await post(tk.sis, '/activos/' + el.body.activo.id + '/estado', { estado: 'de_baja', motivo: 'Prueba inventada' })).status, 200);
  const d = await put(tk.sis, '/activos/config/tipos/CAMARA_WEB/activo', { activo: false });
  assert.equal(d.status, 200, JSON.stringify(d.body));
  assert.equal(hist('ACTIVO_TIPO_ACTIVO')[0].detalle, 'desactivado');
  const cf = await config();
  assert.ok(!cf.tipos.some((t) => t.codigo === 'CAMARA_WEB'), 'fuera de Registrar');
  assert.equal(cf.tiposTodos.find((t) => t.codigo === 'CAMARA_WEB').activo, false, 'sigue en Ajustes');
  assert.match((await post(tk.sis, '/activos', { tipo: 'CAMARA_WEB', codigo: 'CW-2' })).body.error, /Elige el tipo/);
  assert.equal((await put(tk.sis, '/activos/' + el.body.activo.id, { observaciones: 'Sigue editable' })).status, 200, 'el elemento de un tipo desactivado se edita');
  assert.equal((await put(tk.sis, '/activos/config/tipos/CAMARA_WEB/activo', { activo: true })).status, 200);
  assert.equal((await put(tk.sis, '/activos/config/tipos/CAMARA_WEB/activo', { activo: 'no' })).status, 400);
});

test('motivos frecuentes y texto del acta: cada acta guarda su copia', async () => {
  const m = await put(tk.sis, '/activos/listas/motivos', { valores: ['Dañado por uso', 'Retiro del agente'] });
  assert.deepEqual(m.body.valores, ['Dañado por uso', 'Retiro del agente']);
  // Acta con el texto de siempre.
  const g = (await post(tk.sis, '/activos/agentes', { nombre: 'Agente Inventado Uno' })).body.agente;
  const mouse = (await post(tk.sis, '/activos', { tipo: 'MOUSE', codigo: 'M-372' })).body.activo;
  assert.equal((await post(tk.sis, '/activos/' + mouse.id + '/asignar', { agenteId: g.id })).status, 200);
  const a1 = (await post(tk.sis, '/activos/agentes/' + g.id + '/actas', { tipo: 'entrega', activoIds: [mouse.id] })).body.acta;
  assert.ok(a1.texto.startsWith('Recibo los elementos'));
  // Cambiar el texto: las actas nuevas lo usan, la anterior conserva el suyo.
  assert.match((await put(tk.sis, '/activos/config/textos/acta_entrega', { valor: 'corto' })).body.error, /entre 10 y 1.500/);
  assert.equal((await put(tk.sis, '/activos/config/textos/otra', { valor: 'Texto inventado largo' })).status, 404);
  const t = await put(tk.admin, '/activos/config/textos/acta_entrega', { valor: 'Texto INVENTADO de entrega para la prueba de la Fase 372.' });
  assert.equal(t.status, 200, JSON.stringify(t.body));
  assert.equal(hist('ACTIVO_TEXTO')[0].detalle, '57 caracteres');
  const a2 = (await post(tk.sis, '/activos/agentes/' + g.id + '/actas', { tipo: 'entrega', activoIds: [mouse.id] })).body.acta;
  assert.equal(a2.texto, 'Texto INVENTADO de entrega para la prueba de la Fase 372.');
  assert.ok((await request(app).get('/api/activos/actas/' + a1.id).set(H(tk.sis))).body.acta.texto.startsWith('Recibo los elementos'), 'el acta anterior no cambia');
  assert.equal((await config()).textos.acta_entrega, 'Texto INVENTADO de entrega para la prueba de la Fase 372.');
});

test('interfaz: editor escapado, campo guardado con su tipo fijo, acta con su texto guardado', () => {
  const path = require('path');
  global.esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  try {
    const UI = require(path.join(__dirname, '..', '..', 'public', 'js', 'activos.js'));
    const t = { codigo: 'TORRE', nombre: 'Torre <b>', plural: 'Torres', activo: false, campos: [{ k: 'ram_gb', l: 'RAM "GB"', t: 'numero' }, { k: 'x', l: 'Oculto', t: 'texto', oculto: true }] };
    const lista = UI.activosTiposHtml([t]);
    assert.ok(lista.includes('Torre &lt;b&gt;') && !lista.includes('<b>'), 'nombre escapado');
    assert.ok(lista.includes('1 (+1 oculto)') && lista.includes('Desactivado') && lista.includes('>Activar<') && lista.includes('ac-tipos-tabla'));
    const ed = UI.activosEditorTipoHtml(t);
    assert.ok(ed.includes('data-k="ram_gb"') && ed.includes('data-t="numero"') && ed.includes('RAM &quot;GB&quot;'));
    assert.ok(!/data-k="ram_gb"[^]*?<select[^>]*data-ce="t"[^]*?data-k="x"/.test(ed), 'un campo guardado no deja elegir otro tipo de dato');
    assert.ok(!ed.includes('>Quitar<'), 'un campo guardado no se quita');
    assert.ok(UI.activosCampoEditorHtml({ t: 'lista' }, 'n1').includes('>Quitar<'), 'uno nuevo sí');
    const acta = { numero: 2, tipo: 'entrega', tipoNombre: 'Entrega', fecha: '2026-11-19T15:00:00.000Z', quien: 'x', agente: {}, elementos: [] };
    assert.ok(UI.activosActaPrintHtml(Object.assign({ texto: 'Texto <propio> del acta' }, acta)).includes('Texto &lt;propio&gt; del acta'));
    assert.ok(UI.activosActaPrintHtml(acta).includes('Recibo los elementos'), 'actas viejas: el texto de siempre');
  } finally { delete global.esc; }
});
