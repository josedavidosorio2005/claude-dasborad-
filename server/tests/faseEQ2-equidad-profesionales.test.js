// faseEQ2-equidad-profesionales.test.js — «Equidad profesionales» de ORLANT (pedido de Edwin, llamada del
// 24/11/2026). Lector de las 3 bases, carga por base, permisos, lista de entidades, pestaña nueva y la salida del
// generador (sin datos). Todos los nombres, sedes y entidades son INVENTADOS.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');
const L = require('../../public/js/equidad-logic.js');

const PUB = path.join(__dirname, '..', '..', 'public');
const B = '/api/orlant/equidad';
const H = (t) => ({ Authorization: 'Bearer ' + t });
function crear(user, rol, perms, asesorCampana) {
  db.prepare(`INSERT INTO users (nombre, user, rol, active, password_hash, perms, asesorCampana, createdAt, debe_cambiar_password) VALUES (?,?,?,1,?,?,?,?,0)`)
    .run('Prueba ' + user, user, rol, bcrypt.hashSync('Clave#2026x', 4), JSON.stringify(perms), asesorCampana || null, new Date().toISOString());
}
const tok = (u) => tokenFor(u, 'Clave#2026x');
let admin, sup, supOtro, ger, cli, ase;

const ENC = ['CODIGO_SEDE', 'ESPNOM', 'MEDNOM', 'FECHA_CITA', 'NOMBRE_ENTIDAD'];
const fila = (i, ent) => ['SEDE FICTICIA ' + (i % 2 ? 'NORTE' : 'SUR'), 'ESPECIALIDAD INVENTADA', 'DR INVENTADO ' + (i % 3), new Date(2031, 0, 1 + (i % 5)), ent || 'ENTIDAD FICTICIA ' + (i % 2 ? 'A' : 'B')];

before(async () => {
  admin = await tokenFor('admin', MASTER_PASSWORD);
  crear('feq_sup', 'SUPERVISOR', { campana_ORLANT: true, cliente_ORLANT: true });
  crear('feq_supotro', 'SUPERVISOR', { campana_MOBILIZE: true, cliente_MOBILIZE: true });
  crear('feq_ger', 'GERENCIA', {});
  crear('feq_cli', 'CLIENTES_DASH', { ClientesDash: true, cliente_ORLANT: true });
  crear('feq_ase', 'ASESOR', { campana_ORLANT: true }, 'ORLANT');
  [sup, supOtro, ger, cli, ase] = await Promise.all(['feq_sup', 'feq_supotro', 'feq_ger', 'feq_cli', 'feq_ase'].map(tok));
});

test('Lector: la tabla dinámica se ignora, Particulares sin entidad no es error y una columna de paciente nunca se lee', () => {
  const dinamica = { nombre: 'Hoja1', aoa: [['Etiquetas de fila', 'Cuenta'], ['DR INVENTADO 0', 4]] };
  const pol = L.eqLeerLibro([dinamica, { nombre: 'Sheet', aoa: [ENC].concat([0, 1, 2, 3, 4, 5].map((i) => fila(i))) }], 'polizas');
  assert.equal(pol.ok, true);
  assert.equal(pol.hoja, 'Sheet');
  assert.equal(pol.filas.length, 6);
  assert.deepEqual(pol.filas[0], { sede: 'SEDE FICTICIA SUR', esp: 'ESPECIALIDAD INVENTADA', prof: 'DR INVENTADO 0', fecha: '2031-01-01', ent: 'ENTIDAD FICTICIA B' });
  assert.deepEqual(pol.avisos, []);
  // Particulares: 4 columnas, sin «Entidad» -> sin aviso de entidad.
  const par = L.eqLeerLibro([{ nombre: 'Sheet', aoa: [ENC.slice(0, 4), ['SEDE FICTICIA SUR', 'ESP', 'DR INVENTADO 9', '15/02/2031']] }], 'particulares');
  assert.equal(par.ok, true);
  assert.deepEqual(par.avisos, []);
  assert.deepEqual(par.filas, [{ sede: 'SEDE FICTICIA SUR', esp: 'ESP', prof: 'DR INVENTADO 9', fecha: '2031-02-15', ent: '' }]);
  // Particulares con una columna de entidad (ahí iría el paciente): se descarta en memoria.
  const par2 = L.eqLeerLibro([{ nombre: 'Sheet', aoa: [ENC, ['S', 'E', 'DR INVENTADO 9', 47528, 'PACIENTE INVENTADO']] }], 'particulares');
  assert.equal(par2.filas[0].ent, '');
  assert.ok(!JSON.stringify(par2).includes('PACIENTE'));
  assert.equal(par2.filas[0].fecha, '2030-02-14', 'serial de Excel');
  // Encabezados en otra fila y con tildes o minúsculas.
  const otra = L.eqLeerLibro([{ nombre: 'X', aoa: [['Reporte'], [], ['codigo_sede', 'Espnom', 'Médico', 'Fecha', 'Entidad'], ['S', 'E', 'DR A', '2031-03-01', 'ENT']] }], 'prepagada');
  assert.equal(otra.filas[0].prof, 'DR A');
  // Fecha inválida: fuera, con aviso. Sin profesional ni fecha: error claro.
  const mala = L.eqLeerLibro([{ nombre: 'S', aoa: [ENC, fila(1), ['S', 'E', 'DR B', 'mañana', 'X']] }], 'polizas');
  assert.equal(mala.filas.length, 1);
  assert.match(mala.avisos[0], /1 fila sin fecha de cita válida/);
  assert.match(L.eqLeerLibro([{ nombre: 'S', aoa: [['A', 'B']] }], 'polizas').error, /MEDNOM y FECHA_CITA/);
  assert.match(L.eqLeerLibro([{ nombre: 'S', aoa: [['MEDNOM', 'FECHA_CITA']] }], 'polizas').error, /no tiene citas/);
});

test('Cálculos: promedio equitativo, 1 − Gini y la clasificación con ±20 % (como el HTML de Edwin)', () => {
  const filas = [].concat(Array(12).fill({ prof: 'A' }), Array(10).fill({ prof: 'B' }), Array(8).fill({ prof: 'C' }), Array(2).fill({ prof: 'D' }));
  const a = L.eqAnalizar(filas);
  assert.equal(a.total, 32);
  assert.equal(a.ideal, 8);
  assert.deepEqual(a.lista.map((p) => [p.prof, p.estado]), [['A', 'over'], ['B', 'over'], ['C', 'ok'], ['D', 'under']]);
  assert.equal(L.eqAnalizar(Array(4).fill({ prof: 'X' }).concat(Array(4).fill({ prof: 'Y' }))).equidad, 1, 'reparto idéntico = 100 %');
  assert.ok(a.equidad > 0 && a.equidad < 1);
});

test('Carga por base: cada archivo reemplaza SOLO su base; el servidor revisa cada fila', async () => {
  const filas = (n, ent) => Array.from({ length: n }, (_, i) => ({ sede: 'SEDE FICTICIA', esp: 'ESP', prof: 'DR INVENTADO ' + (i % 3), fecha: '2031-01-0' + ((i % 5) + 1), ent: ent || 'ENTIDAD FICTICIA A' }));
  let r = await request(app).post(B + '/cargas/polizas').set(H(admin)).send({ archivoNombre: 'polizas.xlsx', hoja: 'Sheet', filas: filas(7) });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.filas, r.body.reemplazadas], [7, 0]);
  r = await request(app).post(B + '/cargas/particulares').set(H(sup)).send({ archivoNombre: 'part.xlsx', filas: filas(3, 'PACIENTE INVENTADO') });
  assert.equal(r.status, 200);
  r = await request(app).post(B + '/cargas/polizas').set(H(admin)).send({ archivoNombre: 'polizas2.xlsx', filas: filas(4) });
  assert.deepEqual([r.body.filas, r.body.reemplazadas], [4, 7]);
  const e = await request(app).get(B + '/estado').set(H(admin));
  const g = Object.fromEntries(e.body.grupos.map((x) => [x.id, x]));
  assert.deepEqual([g.polizas.filas.length, g.prepagada.filas.length, g.particulares.filas.length], [4, 0, 3]);
  assert.equal(g.polizas.archivo, 'polizas2.xlsx');
  assert.ok(g.particulares.filas.every((f) => f.ent === ''), 'Particulares nunca guarda la entidad');
  assert.equal(db.prepare("SELECT COUNT(*) n FROM equidad_citas WHERE entidad LIKE '%PACIENTE%'").get().n, 0);
  // Filas malas: todo o nada.
  for (const malo of [[{ sede: 'S', esp: 'E', prof: '', fecha: '2031-01-01' }], [{ sede: 'S', esp: 'E', prof: 'P', fecha: '2031-02-30' }], []]) {
    const x = await request(app).post(B + '/cargas/prepagada').set(H(admin)).send({ filas: malo });
    assert.equal(x.status, 400);
  }
  assert.equal((await request(app).post(B + '/cargas/otra').set(H(admin)).send({ filas: filas(1) })).status, 400);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM equidad_citas WHERE grupo = 'prepagada'").get().n, 0);
  // El Historial guarda conteos, nunca contenido.
  const h = db.prepare("SELECT detalle FROM historial WHERE accion = 'EQUIDAD_CARGA' ORDER BY ts DESC LIMIT 1").get();
  assert.match(h.detalle, /ORLANT · polizas: 4 citas \(antes 7\)/);
});

test('Permisos: ven admin, gerencia y el supervisor de ORLANT; el cliente y el asesor no (por ahora); cargan solo quien carga ORLANT', async () => {
  for (const [t, s] of [[admin, 200], [ger, 200], [sup, 200], [cli, 403], [ase, 403], [supOtro, 403]]) {
    assert.equal((await request(app).get(B + '/estado').set(H(t))).status, s);
  }
  const f = [{ sede: 'S', esp: 'E', prof: 'P', fecha: '2031-01-01', ent: '' }];
  for (const t of [ger, cli, ase, supOtro]) assert.equal((await request(app).post(B + '/cargas/prepagada').set(H(t)).send({ filas: f })).status, 403);
  assert.equal((await request(app).get(B + '/resumen').set(H(ger))).status, 403);
  assert.equal((await request(app).get(B + '/estado')).status, 401);
});

test('Lista de entidades: configurable, sin repetidos entre listas, y avisa al cargar una entidad de la otra base', async () => {
  let r = await request(app).put(B + '/entidades').set(H(admin)).send({ polizas: ['ENTIDAD FICTICIA A', ' entidad  ficticia a '], prepagada: ['Prepagada Inventada'] });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body, { polizas: ['ENTIDAD FICTICIA A'], prepagada: ['Prepagada Inventada'] });
  r = await request(app).put(B + '/entidades').set(H(admin)).send({ polizas: ['X'], prepagada: ['x'] });
  assert.equal(r.status, 400);
  r = await request(app).post(B + '/cargas/prepagada').set(H(admin)).send({ filas: [{ sede: 'S', esp: 'E', prof: 'P', fecha: '2031-01-01', ent: 'ENTIDAD FICTICIA A' }, { sede: 'S', esp: 'E', prof: 'P', fecha: '2031-01-02', ent: 'PREPAGADA INVENTADA' }] });
  assert.deepEqual(r.body.otraBase, [{ entidad: 'ENTIDAD FICTICIA A', citas: 1, base: 'polizas' }]);
  const res = await request(app).get(B + '/resumen').set(H(sup));
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.entidades.prepagada, ['Prepagada Inventada']);
  assert.equal(res.body.grupos.find((g) => g.id === 'prepagada').citas, 2);
});

test('Pestaña nueva en ORLANT: «Equidad profesionales» oculta, justo después de las de STA; nada más cambia', () => {
  const tabs = JSON.parse(db.prepare("SELECT layout FROM dashboards_config WHERE cliente = 'ORLANT'").get().layout).tabs;
  const i = tabs.findIndex((t) => t.key === 'equidad');
  assert.ok(i > 0);
  assert.ok(['sta', 'sta_gestion'].includes(tabs[i - 1].key));
  assert.deepEqual(tabs[i], { key: 'equidad', label: 'Equidad profesionales', oculta: true, panels: [{ tipo: 'equidad_panel', campana: 'ORLANT', titulo: 'Equidad profesionales' }] });
  assert.equal(tabs.filter((t) => t.key === 'equidad').length, 1);
  for (const c of db.prepare("SELECT layout FROM dashboards_config WHERE cliente <> 'ORLANT'").all()) assert.ok(!c.layout.includes('equidad_panel'));
  const P = require('../plantillas-cliente');
  assert.equal(P.TABS_EXTRA.equidad.crear('ORLANT').panels[0].tipo, 'equidad_panel');
});

test('Generador: la app de Edwin sin datos, con el filtro Profesional y sin Entidad en Particulares', () => {
  const js = fs.readFileSync(path.join(PUB, 'js', 'orlant-equidad-app.js'), 'utf8');
  const css = fs.readFileSync(path.join(PUB, 'css', 'orlant-equidad-app.css'), 'utf8');
  for (const s of ['SEED_POLIZA = [];', 'SEED_PREPAGADAS = [];', 'SEED_PARTICULARES = [];', "name:'Pólizas'", "name:'Medicina prepagada'", "name:'Particulares'",
    'data-f="prof" aria-label="Profesional"', '${T.conEntidad?', '(!f.prof||r.prof===f.prof)', 'const $ = s=>ROOT.querySelector(s);']) assert.ok(js.includes(s), s);
  assert.ok(!/"sede":|localStorage|FileReader|XLSX\.|document\.querySelector/.test(js), 'sin datos, sin localStorage ni carga propia');
  assert.ok(!/SEED_\w+ = \[[^\]]/.test(js));
  assert.ok(!/:root|(^|\n)body\{|(^|\n)main\{/.test(css));
  assert.match(css, /:host\{display:block;/);
  assert.match(css, /@media\(max-width:560px\)\{\n  \.kpis\{grid-template-columns:minmax\(0,1fr\)\}/);
  const A = require('../../public/js/orlant-equidad-app.js');
  assert.equal(typeof A.eqCrearApp, 'function');
  assert.ok(A.EQ_MARKUP.includes('id="tabs"') && !A.EQ_MARKUP.includes('fileInput'));
  // Para regenerar se necesita el HTML de Edwin (fuera del repo): la ruta nunca está en el repo.
  const gen = fs.readFileSync(path.join(__dirname, '..', '..', 'scripts', 'orlant', 'generar-equidad.js'), 'utf8');
  assert.match(gen, /quedaron datos, localStorage o la carga del HTML/);
});

test('Centro de cargas: sección con las 3 bases, texto escapado y resultado de la carga', () => {
  global.esc = require('../../public/js/esc.js').esc;
  const C = require('../../public/js/centro-equidad.js');
  const html = C.ccEquidadHtml({ grupos: [{ id: 'polizas', nombre: 'Pólizas', conEntidad: true, archivo: '<b>x</b>.xlsx', citas: 1200, profesionales: 7, desde: '2031-01-01', hasta: '2031-01-31', cargadoEn: '2031-02-01T10:00:00Z' },
    { id: 'prepagada', nombre: 'Medicina prepagada', conEntidad: true, citas: 0 }, { id: 'particulares', nombre: 'Particulares', conEntidad: false, citas: 0 }], entidades: { polizas: ['A<i>'], prepagada: [] } });
  assert.ok(!html.includes('<b>x') && html.includes('&lt;b&gt;x'));
  assert.ok(html.includes('A&lt;i&gt;'));
  assert.equal(html.split('class="btn-primary cc-eq-subir"').length - 1, 3);
  assert.match(html, /Reemplazar base[\s\S]*Subir base[\s\S]*esta base no lleva entidad/);
  assert.match(html, /<label for="cc-eq-ent-polizas">Pólizas<\/label><textarea id="cc-eq-ent-polizas"/);
  const res = C.ccEquidadResultadoHtml('Pólizas', { filas: 10, reemplazadas: 4, otraBase: [{ entidad: '<x>', citas: 2, base: 'prepagada' }] }, ['Aviso <y>']);
  assert.ok(res.includes('10 citas cargadas (reemplazan 4)') && res.includes('&lt;x&gt;') && res.includes('Aviso &lt;y&gt;'));
  const idx = fs.readFileSync(path.join(PUB, 'index.html'), 'utf8');
  for (const s of ['<div id="cc-equidad" hidden></div>', 'js/equidad-logic.js', 'js/centro-equidad.js', 'js/orlant-equidad-app.js', 'js/orlant-equidad.js']) assert.ok(idx.includes(s), s);
});
