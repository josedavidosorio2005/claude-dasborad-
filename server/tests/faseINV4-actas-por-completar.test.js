// faseINV4-actas-por-completar.test.js — Fase INV4 (parte 4 del Inventario, HTML de Edwin): las actas automáticas
// nacen «Por completar»; se completan (fecha, quién entrega o recibe por Sistemas, técnico en reparación y recibo,
// observaciones), se genera el PDF y quedan «Por firmar»; firmadas cierran el proceso. Datos INVENTADOS.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { request, app, db, tokenFor } = require('./helpers');

const H = (t) => ({ Authorization: 'Bearer ' + t });
let tk;
const ids = {};
const P = (url, b, t) => request(app).post('/api' + url).set(H(t || tk.sis)).send(b);
const G = (url, t) => request(app).get('/api' + url).set(H(t || tk.sis));
before(async () => {
  for (const [u, rol] of [['inv4_sis', 'SISTEMAS'], ['inv4_sup', 'SUPERVISOR']]) {
    db.prepare(`INSERT INTO users (nombre, user, rol, active, password_hash, perms, createdAt, debe_cambiar_password) VALUES (?,?,?,1,?,?,?,0)`)
      .run('Persona Inventada ' + u, u, rol, bcrypt.hashSync('Clave#2026x', 4), '{}', new Date().toISOString());
  }
  tk = { sis: await tokenFor('inv4_sis', 'Clave#2026x'), sup: await tokenFor('inv4_sup', 'Clave#2026x') };
  for (const [tipo, codigo] of [['DIADEMA', 'INV4-D1'], ['TORRE', 'INV4-T1']]) {
    const r = await P('/activos', { tipo, codigo, marca: 'MarcaX', sede: '' });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    ids[codigo] = r.body.activo.id;
  }
  ids.ag = (await P('/activos/agentes', { nombre: 'Agente Inventado INV4', documento: '7400001' })).body.agente.id;
});

test('por completar → completar (validaciones) → por firmar; no se sube firmada antes de completarla', async () => {
  const entrega = (await P('/activos/' + ids['INV4-D1'] + '/asignar', { agenteId: ids.ag })).body.actas[0];
  assert.equal(entrega.estado, 'completar');
  assert.equal(entrega.generada, null);
  // No se sube la firmada de un acta sin completar.
  assert.match((await P('/activos/actas/' + entrega.id + '/firmada', { pdf: 'x' })).body.error, /Primero completa el acta/);
  // Validaciones
  const url = '/activos/actas/' + entrega.id + '/completar';
  assert.match((await P(url, { fecha: '', entrega: 'Sistemas Inventado' })).body.error, /fecha del acta/);
  assert.match((await P(url, { fecha: '2999-01-01', entrega: 'Sistemas Inventado' })).body.error, /posterior a hoy/);
  assert.match((await P(url, { fecha: '2026-11-20', entrega: 'ab' })).body.error, /quién entrega por Sistemas/);
  assert.match((await P(url, { fecha: '2026-11-20', entrega: 'Sistemas Inventado', otro: 1 })).body.error, /Datos no válidos/);
  assert.equal((await P(url, { fecha: '2026-11-20', entrega: 'Sistemas Inventado' }, tk.sup)).status, 403);
  const ok = await P(url, { fecha: '2026-11-20', entrega: '  Sistemas   Inventado ', observaciones: 'Se entrega con su estuche' });
  assert.equal(ok.status, 200, JSON.stringify(ok.body));
  const a = ok.body.acta;
  assert.deepEqual([a.estado, a.fechaActa, a.entrega, a.observaciones, !!a.generada], ['pendiente', '2026-11-20', 'Sistemas Inventado', 'Se entrega con su estuche', true]);
  // Ya completada: no se vuelve a completar.
  assert.match((await P(url, { fecha: '2026-11-21', entrega: 'Otra persona' })).body.error, /ya se completó/);
});

test('reparación pide técnico; conteos, filtros y panel cuentan por completar y por firmar', async () => {
  const rep = (await P('/activos/' + ids['INV4-T1'] + '/estado', { estado: 'en_reparacion', motivo: 'No enciende' })).body.actas[0];
  assert.equal(rep.tipo, 'reparacion');
  if (!rep.tecnico) assert.match((await P('/activos/actas/' + rep.id + '/completar', { fecha: '2026-11-20', entrega: 'Sistemas Inventado' })).body.error, /técnico o proveedor/);
  const r = (await G('/activos/actas')).body;
  const mias = r.actas.filter((x) => x.elementos.some((e) => /^INV4-/.test(e.codigo)));
  assert.deepEqual(mias.map((x) => x.estado).sort(), ['completar', 'pendiente']);
  assert.ok(r.resumen.porCompletar >= 1 && r.resumen.pendientes >= 1);
  const ids2 = (q) => G('/activos/actas?estado=' + q).then((x) => x.body.actas.map((y) => y.id));
  assert.ok((await ids2('completar')).includes(rep.id));
  assert.ok(!(await ids2('pendiente')).includes(rep.id));
  assert.ok((await ids2('sincerrar')).includes(rep.id));
  const menu = (await G('/activos/resumen?ambito=sistemas')).body;
  assert.equal(menu.actasPorFirmar, r.resumen.pendientes + r.resumen.porCompletar);
  const panel = (await G('/activos/panel?ambito=sistemas')).body;
  assert.equal(panel.actasPendientes, r.resumen.pendientes + r.resumen.porCompletar);
});

test('pantalla: tarjeta «Por completar», botón para completar, formulario y PDF con los datos del acta', () => {
  global.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const UI = require('../../public/js/activos.js');
  const k = UI.activosActasKpisHtml({ porCompletar: 2, pendientes: 1, atrasadas: 0, firmadas: 3, anuladas: 0 });
  assert.match(k, /<b>2<\/b><span class="vis-pill vis-amarillo">Por completar<\/span>.*<b>1<\/b><span class="vis-pill vis-amarillo">Por firmar<\/span>/);
  const base = { id: 7, numero: 12, tipo: 'reparacion', tipoNombre: 'Reparación', fecha: '2026-11-20T15:00:00Z', agente: null, elementos: [{ tipo: 'Torre', codigo: 'T-<9>' }], auto: true, motivo: 'No enciende', tecnico: '' };
  const fila = UI.activosActasHtml([Object.assign({ estado: 'completar' }, base)], true, 3);
  assert.match(fila, /activosActaCompletarForm\(7\)">Completar y generar PDF/);
  assert.doesNotMatch(fila, /Imprimir \/ PDF|Subir firmada/);
  assert.match(fila, /Por completar/);
  const form = UI.activosActaCompletarHtml(base, '2026-11-27', 'Persona <Inventada>');
  assert.match(form, /type="date" id="ac-cp-fecha" required max="2026-11-27" value="2026-11-27"/);
  assert.match(form, /Quién entrega por Sistemas<\/label><input type="text" id="ac-cp-entrega" required minlength="3" maxlength="80" value="Persona &lt;Inventada&gt;"/);
  assert.match(form, /id="ac-cp-tecnico" required/);
  assert.match(form, /T-&lt;9&gt;/);
  assert.doesNotMatch(UI.activosActaCompletarHtml(Object.assign({}, base, { tipo: 'entrega' }), '2026-11-27', ''), /ac-cp-tecnico/);
  assert.match(UI.activosActaCompletarHtml(Object.assign({}, base, { tipo: 'devolucion' }), '2026-11-27', ''), /Quién recibe por Sistemas/);
  const pdf = UI.activosActaPrintHtml(Object.assign({ estado: 'pendiente', fechaActa: '2026-11-20', entrega: 'Sistemas Inventado', observaciones: 'Con <cargador>', tecnico: 'Taller' }, base));
  assert.match(pdf, /Inventario de sistemas · InConexión · 20\/11\/2026/);
  assert.match(pdf, /<dt>Entrega por Sistemas<\/dt><dd>Sistemas Inventado<\/dd>/);
  assert.match(pdf, /<strong>Observaciones:<\/strong> Con &lt;cargador&gt;/);
});
