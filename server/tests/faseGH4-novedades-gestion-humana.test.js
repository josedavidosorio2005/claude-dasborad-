// faseGH4-novedades-gestion-humana.test.js — Fase GH4 (docs/gestion-humana/plan.md): «Novedades desde
// Gestión Humana» en el Inventario de sistemas. Solo lectura de Talento humano, lo mínimo (sin salario,
// cargo ni tipo de novedad), solo ADMIN y SISTEMAS. Personas y equipos INVENTADOS.
'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');
const NGH = require('../gh-novedades');

const H = (t) => ({ Authorization: 'Bearer ' + t });
const K = 'inconexion_gh_empleados_v1';
const tk = {};
const ids = {};
const P = (url, b) => request(app).post('/api/activos' + url).set(H(tk.sis)).send(b);
const guardarGH = (clave, valor) => db.prepare(`INSERT INTO gh_estado (clave, valor, version, actualizadoPor, actualizadoAt) VALUES (?,?,1,'prueba',?)
  ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor`).run(clave, JSON.stringify(valor), new Date().toISOString());
const HOY = NGH.hoyColombia();
const dia = (n) => { const d = new Date(HOY + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

before(async () => {
  delete process.env.GH_ROL_ACTIVO;
  for (const [u, rol] of [['gh4_sis', 'SISTEMAS'], ['gh4_gh', 'GESTION_HUMANA'], ['gh4_ger', 'GERENCIA']]) {
    db.prepare(`INSERT INTO users (nombre, user, rol, active, password_hash, perms, createdAt, debe_cambiar_password) VALUES (?,?,?,1,?,?,?,0)`)
      .run('Persona Inventada ' + u, u, rol, bcrypt.hashSync('Clave#2026x', 4), '{}', new Date().toISOString());
  }
  tk.admin = await tokenFor('admin', MASTER_PASSWORD);
  tk.sis = await tokenFor('gh4_sis', 'Clave#2026x');
  tk.gh = await tokenFor('gh4_gh', 'Clave#2026x');
  tk.ger = await tokenFor('gh4_ger', 'Clave#2026x');
  // 5 agentes inventados, cada uno con un elemento, y 1 sin elementos
  const agentes = [['ret', 'Retirada Inventada', '91.000.001'], ['vac', 'Vacaciones Inventada', '91000002'], ['nov', 'Novedad Inventada', '91000003'],
    ['prox', 'Próxima Inventada', '91000004'], ['sin', 'Sin Registro Inventado', '91000099'], ['nom', 'José Pérez Inventado', ''], ['libre', 'Sin Equipos Inventada', '91000006']];
  for (const [k, nombre, documento] of agentes) {
    const g = await P('/agentes', { nombre, documento });
    assert.equal(g.status, 201, JSON.stringify(g.body));
    ids[k] = g.body.agente.id;
    if (k === 'libre') continue;
    const e = await P('', { tipo: 'DIADEMA', codigo: 'GH4-' + k.toUpperCase() });
    assert.equal(e.status, 201, JSON.stringify(e.body));
    assert.equal((await P('/' + e.body.activo.id + '/asignar', { agenteId: ids[k] })).status, 200);
  }
});
after(() => { db.prepare('DELETE FROM gh_estado').run(); delete process.env.GH_ROL_ACTIVO; });

test('sin empleados en Talento humano: lo dice y no inventa alertas', async () => {
  db.prepare('DELETE FROM gh_estado').run();
  const r = await request(app).get('/api/activos/novedades-gh').set(H(tk.sis));
  assert.equal(r.status, 200);
  assert.equal(r.body.empleadosGH, 0);
  assert.equal(r.body.retirados.length + r.body.ausentes.length + r.body.proximos.length, 0);
});

test('cruza por documento (sin puntos) y por nombre solo si el agente no tiene documento', async () => {
  guardarGH(K, [
    { id: 'e1', nombre: 'Retirada Inventada', numId: '91000001', estado: 'Retirado', fRetiro: dia(-3), salario: 1234567, cargo: 'Cargo Secreto', telefono: '3000000000' },
    { id: 'e2', nombre: 'Vacaciones Inventada', numId: '91000002', estado: 'Activo', salario: 1 },
    { id: 'e3', nombre: 'Novedad Inventada', numId: '91000003', estado: 'Activo' },
    { id: 'e4', nombre: 'Próxima Inventada', numId: '91000004', estado: 'Activo' },
    { id: 'e5', nombre: 'Jose Perez Inventado', numId: '91000005', estado: 'Retirado', fRetiro: dia(-1) },
    { id: 'e6', nombre: 'Sin Equipos Inventada', numId: '91000006', estado: 'Retirado', fRetiro: dia(-1) },
  ]);
  guardarGH(K + '_vac', [{ id: 'v1', empId: 'e2', tipo: 'Disfrute', fIni: dia(-1), fFin: dia(5) }, { id: 'v2', empId: 'e4', tipo: 'Disfrute', fIni: dia(3), fFin: dia(10) },
    { id: 'v3', empId: 'e3', tipo: 'Disfrute', fIni: dia(-2), fFin: dia(2), anulada: true }]);
  guardarGH(K + '_nov', [{ id: 'n1', empId: 'e3', tipo: 'Incapacidad', diagnostico: 'Diagnóstico Secreto', fIni: HOY, fFin: dia(2) }]);
  const r = await request(app).get('/api/activos/novedades-gh').set(H(tk.sis));
  assert.equal(r.status, 200);
  const nombres = (l) => l.map((x) => x.agente.nombre).sort();
  assert.deepEqual(nombres(r.body.retirados), ['José Pérez Inventado', 'Retirada Inventada']);
  assert.deepEqual(nombres(r.body.ausentes), ['Novedad Inventada', 'Vacaciones Inventada']);
  assert.deepEqual(nombres(r.body.proximos), ['Próxima Inventada']);
  assert.deepEqual(nombres(r.body.sinRegistro), ['Sin Registro Inventado']);
  assert.equal(r.body.empleadosGH, 6);
  const ret = r.body.retirados.find((x) => x.agente.id === ids.ret);
  assert.match(ret.estado.txt, /^Retirado de la empresa desde el \d{2}\/\d{2}\/\d{4}$/);
  assert.deepEqual(ret.elementos.map((e) => e.codigo), ['GH4-RET']);
  assert.match(r.body.ausentes.find((x) => x.agente.id === ids.nov).estado.txt, /^Ausente hasta el .* \(novedad registrada en Gestión Humana\)$/);
  // lo mínimo: nada de salario, cargo, contacto, tipo de novedad ni diagnóstico
  const txt = JSON.stringify(r.body);
  for (const x of ['1234567', 'Cargo Secreto', '3000000000', 'Incapacidad', 'Diagnóstico Secreto', 'salario', 'numId']) assert.ok(!txt.includes(x), 'no expone ' + x);
  // agente sin elementos no aparece aunque esté retirado
  assert.ok(!txt.includes('Sin Equipos Inventada'));
});

test('el menú del inventario trae el conteo (retirados + ausentes) y la vista de Edwin lo pinta', async () => {
  const r = await request(app).get('/api/activos/resumen?ambito=sistemas').set(H(tk.sis));
  assert.deepEqual(r.body.novedadesGH, { retirados: 2, ausentes: 2 });
  assert.equal((await request(app).get('/api/activos/resumen?ambito=inmuebles').set(H(tk.sis))).body.novedadesGH, undefined);
  global.esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  try {
    const UI = require('../../public/js/activos.js');
    // Fase GH5d (diseño de Edwin): las novedades salen del menú y son una pestaña de «Actas», con su conteo.
    assert.ok(!UI.AC_MENU.sistemas.some((x) => x[0] === 'novedadesgh'));
    assert.ok(!UI.AC_MENU.inmuebles.some((x) => x[0] === 'novedadesgh'));
    assert.match(UI.activosActasPestanasHtml('novedades', 4), /acp-chip on" aria-pressed="true" onclick="activosActasPestana\('novedades'\)">Novedades de GH \(4\)/);
    assert.match(UI.activosActasPestanasHtml('pendiente', 0), /Actas pendientes[^]*Actas firmadas[^]*Todas[^]*>Novedades de GH</);
    const datos = (await request(app).get('/api/activos/novedades-gh').set(H(tk.sis))).body;
    const html = UI.activosNovedadesGHHtml(datos, { tipos: [{ codigo: 'DIADEMA', nombre: 'Diadema' }] });
    assert.match(html, /Retirados con elementos a su nombre/);
    assert.match(html, /Recibir elementos/);
    assert.match(html, /Diadema GH4-RET/);
    assert.match(html, /sin registro en Gestión Humana/);
    assert.match(UI.activosNovedadesGHHtml({ empleadosGH: 0, retirados: [], ausentes: [], proximos: [], sinRegistro: [] }, {}), /aún no tiene empleados/);
    const xss = UI.activosNovedadesGHHtml({ empleadosGH: 1, retirados: [{ agente: { id: 1, nombre: '<img src=x>', documento: '' }, estado: { txt: 'x' }, elementos: [] }], ausentes: [], proximos: [], sinRegistro: [] }, {});
    assert.ok(!xss.includes('<img'), 'escapa el nombre');
  } finally { delete global.esc; }
});

test('permisos: solo ADMIN y SISTEMAS (Gestión humana no entra al inventario, ni con GH_ROL_ACTIVO)', async () => {
  assert.equal((await request(app).get('/api/activos/novedades-gh').set(H(tk.admin))).status, 200);
  assert.equal((await request(app).get('/api/activos/novedades-gh').set(H(tk.ger))).status, 403);
  process.env.GH_ROL_ACTIVO = '1';
  assert.equal((await request(app).get('/api/activos/novedades-gh').set(H(tk.gh))).status, 403);
  delete process.env.GH_ROL_ACTIVO;
  assert.equal((await request(app).get('/api/activos/novedades-gh')).status, 401);
});

test('datos de Talento humano dañados o raros no rompen la vista', () => {
  db.prepare("UPDATE gh_estado SET valor = 'no es json' WHERE clave = ?").run(K + '_vac');
  guardarGH(K + '_nov', { no: 'es lista' });
  const r = NGH.novedades(db);
  assert.equal(r.empleadosGH, 6);
  assert.equal(r.ausentes.length, 0, 'sin vacaciones ni novedades legibles, nadie queda ausente');
  assert.equal(NGH.doc(' 91.000.001 '), '91000001');
  assert.equal(NGH.norm('  José   PÉREZ '), 'jose perez');
});
