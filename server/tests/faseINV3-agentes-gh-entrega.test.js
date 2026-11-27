// faseINV3-agentes-gh-entrega.test.js — Fase INV3 (parte 3 del Inventario, HTML de Edwin): los agentes salen de las
// personas ACTIVAS de Gestión humana, cada agente muestra su estado en Gestión humana, a un retirado no se le
// entrega nada y se entregan varios elementos con UNA sola acta. Debe funcionar igual con GH_ROL_ACTIVO apagado y
// prendido (ese interruptor solo abre Talento humano al rol GESTION_HUMANA). Personas y elementos INVENTADOS.
'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { request, app, db, tokenFor } = require('./helpers');
const { completar } = require('./helpers-activos'); // Fase INV2: registrar exige todos los campos
const NGH = require('../gh-novedades');

const H = (t) => ({ Authorization: 'Bearer ' + t });
const K = 'inconexion_gh_empleados_v1';
const tk = {};
const ids = {};
const P = (url, b, t) => request(app).post('/api' + url).set(H(t || tk.sis)).send(b);
const G = (url, t) => request(app).get('/api' + url).set(H(t || tk.sis));
const guardarGH = (clave, valor) => db.prepare(`INSERT INTO gh_estado (clave, valor, version, actualizadoPor, actualizadoAt) VALUES (?,?,1,'prueba',?)
  ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor`).run(clave, JSON.stringify(valor), new Date().toISOString());
const HOY = NGH.hoyColombia();
const dia = (n) => { const d = new Date(HOY + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const elemento = async (tipo, codigo) => {
  const r = await P('/activos', completar({ tipo, codigo, marca: 'MarcaX' }));
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body.activo.id;
};

before(async () => {
  delete process.env.GH_ROL_ACTIVO;
  for (const [u, rol] of [['inv3_sis', 'SISTEMAS'], ['inv3_gh', 'GESTION_HUMANA'], ['inv3_sup', 'SUPERVISOR']]) {
    db.prepare(`INSERT INTO users (nombre, user, rol, active, password_hash, perms, createdAt, debe_cambiar_password) VALUES (?,?,?,1,?,?,?,0)`)
      .run('Persona Inventada ' + u, u, rol, bcrypt.hashSync('Clave#2026x', 4), '{}', new Date().toISOString());
  }
  tk.sis = await tokenFor('inv3_sis', 'Clave#2026x');
  tk.gh = await tokenFor('inv3_gh', 'Clave#2026x');
  tk.sup = await tokenFor('inv3_sup', 'Clave#2026x');
  for (const [k, nombre, documento] of [['act', 'Activa Inventada INV3', '93000001'], ['ret', 'Retirado Inventado INV3', '93000002'],
    ['vac', 'Vacaciones Inventada INV3', '93000003'], ['sin', 'Sin Registro Inventado INV3', '93000099']]) {
    const g = await P('/activos/agentes', { nombre, documento });
    assert.equal(g.status, 201, JSON.stringify(g.body));
    ids[k] = g.body.agente.id;
  }
  ids.d1 = await elemento('DIADEMA', 'INV3-D1');
  ids.m1 = await elemento('MOUSE', 'INV3-M1');
  ids.t1 = await elemento('TECLADO', 'INV3-T1');
  ids.d2 = await elemento('DIADEMA', 'INV3-D2');
  ids.d3 = await elemento('DIADEMA', 'INV3-D3');
  // El retirado recibe una diadema ANTES de que Gestión humana lo marque retirado (para probar que puede devolverla).
  assert.equal((await P('/activos/' + ids.d3 + '/asignar', { agenteId: ids.ret })).status, 200);
});
after(() => { db.prepare('DELETE FROM gh_estado').run(); delete process.env.GH_ROL_ACTIVO; });

test('sin datos en Gestión humana: nada cambia (sin estado, sin bloqueo); la búsqueda dice que no hay datos', async () => {
  db.prepare('DELETE FROM gh_estado').run();
  const l = (await G('/activos/agentes?todos=1')).body;
  assert.equal(l.hayGH, false);
  assert.ok(l.agentes.every((g) => g.gh === null));
  const p = await G('/activos/gh-personas?q=Inventad');
  assert.equal(p.status, 200);
  assert.deepEqual(p.body, { personas: [], hayGH: false });
  assert.equal((await G('/activos/agentes/' + ids.sin)).body.gh, null);
});

test('Gestión humana con datos: estado de cada agente, búsqueda de activos y bloqueo del retirado (igual con GH_ROL_ACTIVO apagado y prendido)', async () => {
  guardarGH(K, [
    { id: 'e1', nombre: 'Activa Inventada INV3', numId: '93.000.001', estado: 'Activo', cargo: 'NO DEBE SALIR', salario: 999 },
    { id: 'e2', nombre: 'Retirado Inventado INV3', numId: '93000002', estado: 'Retirado', fRetiro: dia(-3) },
    { id: 'e3', nombre: 'Vacaciones Inventada INV3', numId: '93000003', estado: 'Activo' },
    { id: 'e4', nombre: 'Persona Nueva Inventada INV3', numId: '93000004', estado: 'Activo' },
    { id: 'e5', nombre: 'Otra Retirada Inventada INV3', numId: '93000005', estado: 'Retirado' },
  ]);
  guardarGH(K + '_vac', [{ empId: 'e3', tipo: 'Disfrute', fIni: dia(-1), fFin: dia(5) }]);
  const fotos = [];
  for (const flag of [undefined, '1']) {
    if (flag) process.env.GH_ROL_ACTIVO = flag; else delete process.env.GH_ROL_ACTIVO;
    const l = (await G('/activos/agentes?todos=1')).body;
    assert.equal(l.hayGH, true);
    const est = Object.fromEntries(l.agentes.filter((g) => /INV3/.test(g.nombre)).map((g) => [g.nombre, g.gh && g.gh.t]));
    assert.deepEqual(est, { 'Activa Inventada INV3': 'activo', 'Retirado Inventado INV3': 'retiro', 'Vacaciones Inventada INV3': 'vacaciones', 'Sin Registro Inventado INV3': 'sin' });
    const p = (await G('/activos/gh-personas?q=inventada inv3')).body;
    // Solo activos (ni retirados), solo nombre y documento, y si ya es agente.
    assert.deepEqual(p.personas.map((x) => [x.nombre, x.documento, x.yaEsAgente]),
      [['Activa Inventada INV3', '93000001', true], ['Persona Nueva Inventada INV3', '93000004', false], ['Vacaciones Inventada INV3', '93000003', true]]);
    assert.ok(!JSON.stringify(p).includes('NO DEBE SALIR') && !JSON.stringify(p).includes('999'));
    assert.deepEqual((await G('/activos/gh-personas?q=93000004')).body.personas.map((x) => x.nombre), ['Persona Nueva Inventada INV3']);
    // Al retirado no se le asigna (y el mensaje lo dice); al de vacaciones sí se puede (solo es aviso).
    const r = await P('/activos/' + ids.d1 + '/asignar', { agenteId: ids.ret });
    assert.equal(r.status, 400);
    assert.match(r.body.error, /retirado en Gestión humana/);
    const det = (await G('/activos/agentes/' + ids.ret)).body;
    assert.equal(det.gh.t, 'retiro');
    assert.ok(!('cargo' in det.gh) && !JSON.stringify(det.gh).includes('NO DEBE SALIR'));
    fotos.push(JSON.stringify({ est, p }));
  }
  assert.equal(fotos[0], fotos[1], 'mismo resultado con GH_ROL_ACTIVO apagado y prendido');
  delete process.env.GH_ROL_ACTIVO;
  // El retirado sí puede devolver lo que tiene; reasignarle o cambiarle, no.
  assert.equal((await P('/activos/' + ids.d1 + '/reasignar', { agenteId: ids.ret, motivo: 'Prueba inventada' })).status, 400);
  assert.match((await P('/activos/' + ids.d3 + '/cambiar', { nuevoId: ids.d1, estado: 'libre', motivo: 'Prueba inventada' })).body.error, /retirado en Gestión humana.*Devolver/);
  assert.equal((await P('/activos/' + ids.d3 + '/devolver', { estado: 'libre', motivo: 'Se retiró (inventado)' })).status, 200);
});

test('buscar personas: solo ADMIN/SISTEMAS y con 3 a 60 caracteres', async () => {
  assert.equal((await G('/activos/gh-personas?q=Inventada', tk.sup)).status, 403);
  process.env.GH_ROL_ACTIVO = '1';
  assert.equal((await G('/activos/gh-personas?q=Inventada', tk.gh)).status, 403, 'GESTION_HUMANA no entra al Inventario ni con GH_ROL_ACTIVO');
  delete process.env.GH_ROL_ACTIVO;
  assert.equal((await G('/activos/gh-personas?q=ab')).status, 400);
  assert.equal((await G('/activos/gh-personas?q=' + 'x'.repeat(61))).status, 400);
  assert.equal(NGH.personas(db, 'Inventada').length <= NGH.PERSONAS_MAX, true);
});

test('entrega múltiple: uno por tipo, una sola acta ya completada (Por firmar), todo o nada', async () => {
  const E = (b, id) => P('/activos/agentes/' + (id || ids.act) + '/entregar', b);
  const hoy = HOY;
  assert.equal((await request(app).post('/api/activos/agentes/' + ids.act + '/entregar').set(H(tk.sup)).send({ ids: [ids.m1], fecha: hoy, observaciones: 'x y z' })).status, 403);
  assert.match((await E({ ids: [ids.m1], fecha: hoy })).body.error, /observación/);
  assert.match((await E({ ids: [], fecha: hoy, observaciones: 'Ingreso inventado' })).body.error, /al menos un elemento/);
  assert.match((await E({ ids: [ids.m1], fecha: hoy, observaciones: 'Ingreso inventado', otro: 1 })).body.error, /Datos no válidos/);
  assert.match((await E({ ids: [ids.d1, ids.d2], fecha: hoy, observaciones: 'Ingreso inventado' })).body.error, /un solo elemento de cada tipo/);
  assert.match((await E({ ids: [ids.m1], fecha: '2999-01-01', observaciones: 'Ingreso inventado' })).body.error, /posterior a hoy/);
  assert.match((await E({ ids: [ids.m1], fecha: hoy, observaciones: 'Ingreso inventado' }, ids.ret)).body.error, /retirado en Gestión humana/);
  // Todo o nada: si la fecha falla, nada quedó asignado ni hay acta nueva.
  const actasAntes = db.prepare('SELECT COUNT(*) n FROM activos_actas').get().n;
  assert.equal(db.prepare("SELECT estado FROM activos WHERE id = ?").get(ids.m1).estado, 'libre');
  const r = await E({ ids: [ids.d1, ids.m1, ids.t1], fecha: hoy, observaciones: 'Ingreso a la campaña, puesto 12 (inventado)' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.elementos.length, 3);
  assert.ok(r.body.elementos.every((a) => a.estado === 'en_uso' && a.agente && a.agente.id === ids.act));
  assert.equal(db.prepare('SELECT COUNT(*) n FROM activos_actas').get().n, actasAntes + 1, 'una sola acta');
  const a = r.body.acta;
  assert.equal(a.tipo, 'entrega');
  assert.equal(a.estado, 'pendiente', 'ya completada: queda Por firmar');
  assert.equal(a.elementos.length, 3);
  assert.equal(a.fechaActa, hoy);
  assert.match(a.observaciones, /puesto 12/);
  assert.ok(a.entrega.length >= 3);
  // Ya asignados: otra entrega con ellos falla.
  assert.match((await E({ ids: [ids.m1], fecha: hoy, observaciones: 'Otra vez' })).body.error, /ya está asignado/);
});

test('pantalla: estado de Gestión humana, filas de la entrega y resumen', () => {
  global.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const UI = require('../../public/js/activos.js');
  assert.equal(UI.activosGhPill(null), '');
  assert.match(UI.activosGhPill({ t: 'retiro', txt: 'Retirado' }), /vis-rojo[^>]*>Retirado</);
  assert.match(UI.activosGhPill({ t: 'activo', txt: 'Activo' }), />Activo en GH</);
  assert.match(UI.activosGhPill({ t: 'sin', txt: 'x' }), />No está en GH</);
  assert.equal(UI.activosGhCajaHtml(null, 0), '');
  assert.match(UI.activosGhCajaHtml({ t: 'retiro', txt: 'Retirado de la empresa desde el 20/11/2026' }, 1), /class="ac-gh-caja mal"[\s\S]*20\/11\/2026\. Tiene 1 elemento\(s\)[\s\S]*Devolver/);
  assert.match(UI.activosGhCajaHtml({ t: 'vacaciones', txt: 'De vacaciones hasta el 30/11/2026' }, 0), /class="ac-gh-caja no"/);
  assert.match(UI.activosGhPersonasHtml({ hayGH: false, personas: [] }), /aún no tiene personas/);
  assert.match(UI.activosGhPersonasHtml({ hayGH: true, personas: [{ nombre: 'A <b>', documento: '1', yaEsAgente: true }] }), /A &lt;b&gt;[\s\S]*ya es agente/);
  const tipos = [{ codigo: 'DIADEMA', nombre: 'Diadema' }, { codigo: 'MOUSE', nombre: 'Mouse' }];
  const h = UI.activosEntregaFilasHtml(tipos, { DIADEMA: [{ id: 7, codigo: 'D-7', marca: 'M<x>' }], MOUSE: [] }, [{ tipo: 'DIADEMA', codigo: 'D-1' }]);
  assert.match(h, /<select id="ac-ent-DIADEMA" data-tipo="DIADEMA"/);
  assert.match(h, /<option value="7">D-7 · M&lt;x&gt;<\/option>/);
  assert.match(h, /Ya tiene D-1/);
  assert.match(h, /No hay libres de este tipo/);
  assert.match(UI.activosEntregaResumenHtml([]), /Elige arriba/);
  assert.match(UI.activosEntregaResumenHtml([{ tipo: 'Diadema', codigo: 'D-7' }, { tipo: 'Mouse', codigo: 'M-1' }]), /una sola acta[\s\S]*Diadema D-7/);
  const html = require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'public', 'index.html'), 'utf8');
  assert.match(html, /id="ac-ag-gh"/);
});
