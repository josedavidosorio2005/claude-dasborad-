// faseGH5-inventario-panel.test.js — Fase GH5 (pedido del usuario, 23/11/2026): «Panel general» del
// Inventario de sistemas igual al diseño de Edwin (chips «Ver gráficas de», tarjetas, donas por estado y
// RAM, barras por tipo/sede/operación, marcas, valor, renta, calidad de los datos y movimientos de 6
// meses). Solo lectura: GET /activos/panel. Datos INVENTADOS.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const bcrypt = require('bcryptjs');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');
const P = require('../activos-panel');

const H = (t) => ({ Authorization: 'Bearer ' + t });
const tk = {};
let PROV = '';
before(async () => {
  for (const [u, rol] of [['gh5_sis', 'SISTEMAS'], ['gh5_rep', 'REPORTES']]) {
    db.prepare(`INSERT INTO users (nombre, user, rol, active, password_hash, perms, createdAt, debe_cambiar_password) VALUES (?,?,?,1,?,?,?,0)`)
      .run('Persona Inventada ' + u, u, rol, bcrypt.hashSync('Clave#2026x', 4), '{}', new Date().toISOString());
  }
  tk.admin = await tokenFor('admin', MASTER_PASSWORD);
  tk.sis = await tokenFor('gh5_sis', 'Clave#2026x');
  tk.rep = await tokenFor('gh5_rep', 'Clave#2026x');
  const post = (b) => request(app).post('/api/activos').set(H(tk.sis)).send(b);
  const L = (await request(app).get('/api/activos/config').set(H(tk.sis))).body.listas;
  PROV = L.proveedores.find((p) => !/inconexi/i.test(p));
  assert.ok(PROV, 'hay un proveedor distinto de InConexion');
  for (let i = 1; i <= 4; i++) {
    const r = await post({ tipo: 'TORRE', codigo: 'GH5-T' + i, marca: i < 3 ? 'MarcaInventada' : '', sede: i < 4 ? L.sedes[0] : '', operacion: '',
      proveedor: i === 4 ? PROV : '', estado: i === 3 ? 'malo' : 'libre', datos: { ram_gb: i === 1 ? 4 : 16, precio: i === 4 ? 0 : 1000, renta_mensual: i === 4 ? 250 : 0 } });
    assert.equal(r.status, 201, JSON.stringify(r.body));
  }
  const mon = await post({ tipo: 'MONITOR', codigo: 'GH5-T1', marca: 'MarcaInventada', sede: L.sedes[0], datos: { precio: 300 } });
  assert.equal(mon.status, 201, JSON.stringify(mon.body));
  const mouse = await post({ tipo: 'MOUSE', codigo: 'GH5-M1', datos: { precio: 50 } });
  assert.equal(mouse.status, 201, JSON.stringify(mouse.body));
  const baja = await request(app).post('/api/activos/' + mouse.body.activo.id + '/estado').set(H(tk.sis)).send({ estado: 'de_baja', motivo: 'Prueba inventada' });
  assert.equal(baja.status, 200, JSON.stringify(baja.body));
});

test('panel: conteos, donas, valor de los propios, renta de proveedores y calidad de los datos', () => {
  const p = P.panel(db, 'sistemas', '');
  assert.equal(p.total, 6);
  assert.deepEqual(p.porEstado, { libre: 4, en_uso: 0, en_reparacion: 0, malo: 1, de_baja: 1 });
  assert.deepEqual(p.porRendimiento, { bajo: 1, medio: 0, alto: 3, sin: 0 }, 'torres sin los dados de baja');
  const torre = p.porTipo.find((t) => t.codigo === 'TORRE');
  assert.equal(torre.total, 4);
  // valor: propios vivos (3 torres × 1000, 1 de ellas «malo» sí cuenta; monitor 300); el mouse dado de baja y la torre rentada no
  assert.equal(p.valor.total, 3300);
  assert.deepEqual(p.renta, { porProveedor: [{ proveedor: PROV, valor: 250, n: 1 }], total: 250, n: 1 });
  assert.equal(p.porSede.find((s) => s.sin).total, 1, 'una torre viva sin sede');
  assert.equal(p.porOperacion.length, 1);
  assert.equal(p.porOperacion[0].nombre, 'Sin operación');
  assert.equal(p.calidad.find((c) => c.k === 'sin_sede').n, 1);
  assert.equal(p.calidad.find((c) => c.k === 'codigos_repetidos').n, 0, 'el mismo código en otro tipo no es repetido');
  assert.equal(p.marcas[0].nombre, 'MARCAINVENTADA');
  assert.equal(p.marcas[0].n, 3);
  assert.equal(p.movimientos.length, 6);
  assert.equal(p.movimientos[5].ingresos, 6, 'los ingresos del mes salen del historial');
  assert.ok(p.calidad.some((c) => c.k === 'actas_pendientes'));
});

test('chips «Ver gráficas de»: ?tipo= deja solo ese tipo; uno desconocido vuelve a Todos', () => {
  const t = P.panel(db, 'sistemas', 'TORRE');
  assert.equal(t.tipo, 'TORRE');
  assert.equal(t.total, 4);
  assert.deepEqual(t.porTipo.map((x) => x.codigo), ['TORRE']);
  assert.ok(!t.calidad.some((c) => c.k === 'actas_pendientes'), 'agentes y actas son de todo el inventario');
  const m = P.panel(db, 'sistemas', 'MONITOR');
  assert.equal(m.porRendimiento, null, 'los monitores no llevan RAM');
  assert.equal(P.panel(db, 'sistemas', 'NO_EXISTE').tipo, '');
  assert.equal(P.panel(db, 'inmuebles', 'TORRE').total, 0, 'una torre no es de inmuebles');
});

test('ruta: ADMIN y SISTEMAS; sin sesión 401; otro rol 403', async () => {
  assert.equal((await request(app).get('/api/activos/panel?ambito=sistemas').set(H(tk.sis))).status, 200);
  assert.equal((await request(app).get('/api/activos/panel?tipo=TORRE').set(H(tk.admin))).body.total, 4);
  assert.equal((await request(app).get('/api/activos/panel').set(H(tk.rep))).status, 403);
  assert.equal((await request(app).get('/api/activos/panel')).status, 401);
});

test('interfaz: activosPanel2Html dibuja las tarjetas del diseño y el estado vacío', () => {
  global.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const UI = require(path.join(__dirname, '..', '..', 'public', 'js', 'activos.js'));
  const html = UI.activosPanel2Html(P.panel(db, 'sistemas', ''));
  for (const t of ['Ver gráficas de:', 'Equipos asignados', '¿En qué estado están los equipos y elementos?', 'Rendimiento según la memoria RAM', '¿Cuántos hay de cada tipo?',
    'Elementos por sede', 'Elementos por operación', 'Marcas más comunes', 'Valor del inventario por elemento', 'Renta mensual por elemento', 'Calidad de los datos', 'Movimientos de los últimos 6 meses']) {
    assert.ok(html.includes(esc(t)), 'falta ' + t);
  }
  assert.match(html, /\$ 3\.300/);
  assert.match(html, /class="acp-chip on" aria-pressed="true"[^>]*>✓ Todos/);
  const vacio = UI.activosPanel2Html(P.panel(db, 'inmuebles', ''));
  assert.match(vacio, /Aún no hay elementos/);
});

test('GH5b: «Registrar ingreso» con una tarjeta por tipo, «Nueva tecnología» y «Últimos ingresos»', () => {
  global.esc = global.esc || ((s) => String(s == null ? '' : s));
  const UI = require(path.join(__dirname, '..', '..', 'public', 'js', 'activos.js'));
  const tipos = [{ codigo: 'TORRE', nombre: 'Torre' }, { codigo: 'ADMINISTRABLE', nombre: 'Equipo administrable' }, { codigo: 'VIEJO', nombre: 'Viejo', activo: false }];
  const html = UI.activosRegistrarTarjetasHtml(tipos, { TORRE: { libre: 2, en_uso: 1, malo: 1 } }, [{ codigo: 'GH5-T9', tipo: 'TORRE', fecha: '2026-11-23T10:00:00', quien: 'Prueba' }]);
  assert.match(html, /<h4>Torre<\/h4>/);
  assert.match(html, /4 registrados · 2 libres/);
  assert.match(html, /0 registrados<\/p>/, 'administrables sin «libres»');
  assert.ok(!html.includes('Viejo'), 'un tipo desactivado no tiene tarjeta');
  for (const f of ["activosRegistrarTipo('TORRE')", "activosVerTipo('TORRE')", "activosEditarFormulario('TORRE')", 'activosNuevaTecnologia()', 'activosIrImportar()', 'Ver equipos']) assert.ok(html.includes(f), 'falta ' + f);
  assert.match(html, /Últimos ingresos[\s\S]*GH5-T9/);
  assert.match(UI.activosRegistrarTarjetasHtml(tipos, {}, []), /Todavía no hay ingresos registrados/);
});

test('GH5c: la línea de conteo de las listas lleva el detalle por tipo (como Edwin)', () => {
  const UI = require(path.join(__dirname, '..', '..', 'public', 'js', 'activos.js'));
  const cfg = { tipos: [{ codigo: 'TORRE', nombre: 'Torre' }, { codigo: 'MONITOR', nombre: 'Monitor' }] };
  assert.equal(UI.activosConteoTexto([{ tipo: 'TORRE' }, { tipo: 'MONITOR' }, { tipo: 'MONITOR' }], cfg), '3 elementos con estos filtros · 1 torre · 2 monitor');
  assert.equal(UI.activosConteoTexto([{ tipo: 'TORRE' }], cfg), '1 elemento con estos filtros', 'un solo tipo: sin detalle');
  assert.equal(UI.activosConteoTexto([], cfg), '0 elementos con estos filtros');
});

test('GH5c: la lista trae la cédula y la fecha de la asignación del agente', async () => {
  const id = (await request(app).get('/api/activos?ambito=sistemas&q=GH5-T2').set(H(tk.sis))).body.activos[0].id;
  const r = await request(app).post('/api/activos/' + id + '/asignar').set(H(tk.sis)).send({ agenteNuevo: { nombre: 'Agente Inventado GH5', documento: '9000555', operacion: '' } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const a = (await request(app).get('/api/activos?ambito=sistemas&estado=en_uso&q=GH5-T2').set(H(tk.sis))).body.activos[0];
  assert.equal(a.agente.nombre, 'Agente Inventado GH5');
  assert.equal(a.agente.documento, '9000555');
  assert.match(a.agente.desde, /^\d{4}-\d{2}-\d{2}/);
  assert.ok(!('agenteDocumento' in a) && !('agenteDesde' in a), 'sin columnas sueltas');
});

test('GH5c: columnas y acciones de Edwin en las listas, y la vista «Inventario» por tipo', () => {
  global.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const UI = require(path.join(__dirname, '..', '..', 'public', 'js', 'activos.js'));
  const cfg = { tipos: [{ codigo: 'TORRE', nombre: 'Torre', plural: 'Torres' }, { codigo: 'MONITOR', nombre: 'Monitor' }, { codigo: 'VIEJO', nombre: 'Viejo', activo: false }],
    estados: [{ codigo: 'libre', nombre: 'Libre' }, { codigo: 'en_uso', nombre: 'En uso' }, { codigo: 'de_baja', nombre: 'De baja' }], rendimientos: [{ codigo: 'alto', nombre: 'Alto' }] };
  const lista = [
    { id: 1, tipo: 'TORRE', codigo: 'GH5-X1', marca: 'MarcaInventada', modelo: 'M1', serial: 'S-1', sede: 'Sede A', operacion: 'Op A', estado: 'en_uso', rendimiento: 'alto',
      datos: { nombre_equipo: 'PC-01', procesador: 'Proc Inventado', ram_gb: 16 }, agente: { id: 7, nombre: 'Agente <b>', documento: '123', desde: '2026-11-20T15:00:00.000Z' } },
    { id: 2, tipo: 'MONITOR', codigo: 'GH5-X2', marca: '', modelo: '', serial: '', sede: '', operacion: '', estado: 'de_baja', rendimiento: null, datos: {}, agente: null },
  ];
  const asig = UI.activosListaHtml(lista, cfg, 'asignados');
  for (const t of ['>Tipo<', '>Código<', '>Nombre<', '>Equipo<', '>Procesador<', '>RAM<', '>Sede<', '>Operación<', '>Agente<', '>Cédula<', '>Asignado desde<', '>Acciones<']) assert.ok(asig.includes(t), 'falta ' + t);
  assert.ok(!asig.includes('>Estado</th>'), 'Asignados no repite la columna Estado');
  assert.match(asig, /activosAccionRecibir\(1\)/);
  assert.match(asig, /activosAccionEstado\(1\)/);
  assert.ok(!/activosAccionEstado\(2\)/.test(asig), 'un elemento de baja no cambia de estado');
  assert.ok(asig.includes('Agente &lt;b&gt;') && asig.includes('S/N S-1') && asig.includes('16 GB'));
  const libres = UI.activosListaHtml(lista, cfg, 'libres');
  assert.ok(!libres.includes('Recibir') && !libres.includes('>Cédula<'), 'Libres sin Recibir ni cédula');
  const todo = UI.activosListaHtml(lista, cfg, 'elementos');
  assert.ok(todo.includes('>Estado</th>') && todo.includes('De baja'));
  assert.match(UI.activosListaHtml([], cfg, 'libres'), /Ningún elemento coincide/);
  const inv = UI.activosInvTiposHtml(cfg.tipos, { TORRE: { libre: 2, en_uso: 3, en_reparacion: 1, malo: 0, de_baja: 1 } }, 'TORRE');
  assert.ok(!inv.includes('Viejo'), 'sin tipos desactivados');
  assert.match(inv, /aci-card aci-sel[\s\S]*Torre[\s\S]*>7<\/b>/);
  assert.match(inv, /<dt>Libres<\/dt><dd>2<\/dd>[\s\S]*<dt>En uso<\/dt><dd>3<\/dd>[\s\S]*<dt>Reparación<\/dt><dd>1<\/dd>[\s\S]*<dt>Malos<\/dt><dd>0<\/dd>/);
  assert.match(inv, /acp-chip on" aria-pressed="true" onclick="activosInvTipo\('TORRE'\)">Torres/);
  assert.match(inv, /Ver detalle/);
});

test('GH5d: Ajustes en tarjetas (mismos campos de antes) con Estados de solo lectura', () => {
  const fs = require('fs');
  const html = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'index.html'), 'utf8');
  const i = html.indexOf('<section id="ac-p-ajustes"'); const sec = html.slice(i, html.indexOf('</section>', i));
  for (const t of ['>Excel<', '>Sedes<', '>Operaciones<', '>Propietarios / proveedores<', '>Motivos frecuentes<', '>Estados<', 'Formularios por tipo', 'Textos del acta', 'activosAjustesExcel()']) assert.ok(sec.includes(t), 'falta ' + t);
  for (const id of ['ac-imp-tipo', 'ac-imp-file', 'ac-l-sedes', 'ac-l-operaciones', 'ac-l-proveedores', 'ac-l-motivos', 'ac-tipos', 'ac-textos', 'ac-aj-estados']) assert.ok(sec.includes('id="' + id + '"'), 'falta #' + id);
  global.esc = global.esc || ((s) => String(s));
  const UI = require(path.join(__dirname, '..', '..', 'public', 'js', 'activos.js'));
  const e = UI.activosAjEstadosHtml([{ codigo: 'libre', nombre: 'Libre' }, { codigo: 'malo', nombre: 'Malo' }]);
  assert.match(e, /vis-verde">Libre<[\s\S]*vis-rojo">Malo</);
  assert.ok(!/<(input|select|textarea|button)/.test(e), 'los estados no se editan');
});
