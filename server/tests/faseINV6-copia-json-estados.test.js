// faseINV6-copia-json-estados.test.js — Fase INV6 (parte 6 del Inventario, HTML de Edwin): copia de seguridad en
// .json (solo descargar, sin restaurar) y estados que se pueden renombrar (sin agregar ni quitar). Datos INVENTADOS.
'use strict';
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { request, app, db, tokenFor } = require('./helpers');
const { completar } = require('./helpers-activos'); // Fase INV2: registrar exige todos los campos

const H = (t) => ({ Authorization: 'Bearer ' + t });
let tk;
const ids = {};
const P = (url, b, t) => request(app).post('/api' + url).set(H(t || tk.sis)).send(b);
const PUT = (url, b, t) => request(app).put('/api' + url).set(H(t || tk.sis)).send(b);
const G = (url, t) => request(app).get('/api' + url).set(H(t || tk.sis));
before(async () => {
  for (const [u, rol] of [['inv6_sis', 'SISTEMAS'], ['inv6_sup', 'SUPERVISOR']]) {
    db.prepare(`INSERT INTO users (nombre, user, rol, active, password_hash, perms, createdAt, debe_cambiar_password) VALUES (?,?,?,1,?,?,?,0)`)
      .run('Persona Inventada ' + u, u, rol, bcrypt.hashSync('Clave#2026x', 4), '{}', new Date().toISOString());
  }
  tk = { sis: await tokenFor('inv6_sis', 'Clave#2026x'), sup: await tokenFor('inv6_sup', 'Clave#2026x') };
  ids.d1 = (await P('/activos', completar({ tipo: 'DIADEMA', codigo: 'INV6-D1', marca: 'MarcaX' }))).body.activo.id; // Fase INV2: todos los campos
  ids.ag = (await P('/activos/agentes', { nombre: 'Agente Inventado INV6', documento: '7600001' })).body.agente.id;
  await P('/activos/' + ids.d1 + '/asignar', { agenteId: ids.ag });
});
after(() => { db.prepare('DELETE FROM activos_estados').run(); });

test('estados: renombrar sí; agregar, quitar, repetidos o vacíos raros no; vacío vuelve al de siempre', async () => {
  const base = (await G('/activos/config')).body.estados;
  assert.deepEqual(base.map((e) => e.codigo), ['libre', 'en_uso', 'en_reparacion', 'malo', 'de_baja']);
  assert.equal(base[0].nombre, 'Libre');
  assert.equal((await PUT('/activos/config/estados', { nombres: { libre: 'Disponible' } }, tk.sup)).status, 403);
  assert.match((await PUT('/activos/config/estados', { nombres: { nuevo: 'Prestado' } })).body.error, /no se pueden agregar ni quitar/);
  assert.match((await PUT('/activos/config/estados', { nombres: { libre: 'Malo' } })).body.error, /no pueden llamarse igual/);
  assert.match((await PUT('/activos/config/estados', { nombres: { libre: 'x' } })).body.error, /entre 2 y 40/);
  assert.match((await PUT('/activos/config/estados', { nombres: { libre: 'Disponible' }, otro: 1 })).body.error, /Datos no válidos/);
  const r = await PUT('/activos/config/estados', { nombres: { libre: '  Disponible  ', en_uso: 'Asignado' } });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body.estados.map((e) => e.nombre), ['Disponible', 'Asignado', 'En reparación', 'Malo', 'De baja']);
  assert.equal(r.body.estados.length, 5);
  assert.deepEqual((await G('/activos/config?ambito=inmuebles')).body.estados.slice(0, 2).map((e) => [e.codigo, e.nombre, e.base]), [['libre', 'Disponible', 'Libre'], ['en_uso', 'Asignado', 'En uso']]);
  // El código no cambia: el elemento sigue «en_uso» y los filtros por código siguen igual.
  assert.equal(db.prepare('SELECT estado FROM activos WHERE id = ?').get(ids.d1).estado, 'en_uso');
  // Las actas nuevas usan el nombre nuevo.
  const dev = (await P('/activos/' + ids.d1 + '/devolver', { estado: 'libre', motivo: 'Prueba inventada' })).body.actas[0];
  assert.equal(dev.elementos[0].queda, 'Disponible');
  // Vacío = el de siempre.
  const v = (await PUT('/activos/config/estados', { nombres: { libre: '', en_uso: 'En uso' } })).body.estados;
  assert.deepEqual(v.slice(0, 2).map((e) => e.nombre), ['Libre', 'En uso']);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM activos_estados').get().n, 0);
});

test('importar desde Excel acepta el nombre nuevo del estado', async () => {
  await PUT('/activos/config/estados', { nombres: { malo: 'Dañado' } });
  const r = await P('/activos/importar', { tipo: 'DIADEMA', filas: [['Código', 'Marca', 'Estado'], ['INV6-I1', 'MarcaX', 'Dañado'], ['INV6-I2', 'MarcaX', 'Roto']] });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const filas = r.body.filas || r.body.resultado || [];
  const err = JSON.stringify(r.body);
  assert.match(err, /Estado «Roto»: usa Libre, En reparación o Dañado/);
  assert.ok(!/Estado «Dañado»/.test(err), 'el nombre nuevo se reconoce');
  assert.ok(Array.isArray(filas));
  await PUT('/activos/config/estados', { nombres: { malo: '' } });
});

test('copia .json: todo el inventario, sin la ruta de los PDF firmados; solo Sistemas/admin', async () => {
  assert.equal((await G('/activos/copia', tk.sup)).status, 403);
  const r = await G('/activos/copia?ambito=sistemas');
  assert.equal(r.status, 200);
  assert.equal(r.headers['cache-control'], 'no-store');
  const c = r.body;
  assert.equal(c.ambito, 'sistemas');
  assert.equal(c.version, 1);
  assert.match(c.aviso, /no la restaura/);
  for (const k of ['estados', 'listas', 'tipos', 'elementos', 'historial', 'agentes', 'asignaciones', 'actas', 'textosActa', 'conteos']) assert.ok(k in c, k);
  assert.ok(c.elementos.some((e) => e.codigo === 'INV6-D1' && typeof e.datos === 'object'));
  assert.ok(c.agentes.some((a) => a.nombre === 'Agente Inventado INV6'));
  assert.ok(c.historial.length >= 2);
  assert.ok(c.actas.length >= 2);
  assert.ok(!JSON.stringify(c).includes('firmadaKey'), 'sin la ruta del PDF en S3');
  assert.equal(c.conteos.elementos, c.elementos.length);
  const inm = (await G('/activos/copia?ambito=inmuebles')).body;
  assert.equal(inm.ambito, 'inmuebles');
  assert.ok(!('agentes' in inm) && !('actas' in inm));
  assert.ok(!inm.elementos.some((e) => e.codigo === 'INV6-D1'));
  // No hay ruta para restaurar.
  assert.equal((await P('/activos/copia', c)).status, 404);
});

test('pantalla: estados editables con el nombre de antes y nombre del archivo de la copia', () => {
  global.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const UI = require('../../public/js/activos.js');
  const h = UI.activosAjEstadosHtml([{ codigo: 'libre', nombre: 'Disponible <x>', base: 'Libre' }, { codigo: 'malo', nombre: 'Malo', base: 'Malo' }]);
  assert.match(h, /<input type="text" id="ac-est-libre" data-codigo="libre" maxlength="40" value="Disponible &lt;x&gt;" placeholder="Libre">/);
  assert.match(h, /\(antes «Libre»\)/);
  assert.equal((h.match(/antes «/g) || []).length, 1);
  assert.equal(UI.activosCopiaNombre('sistemas', '2026-11-27'), 'inventario-sistemas-2026-11-27.json');
  assert.equal(UI.activosCopiaNombre('inmuebles', '2026-11-27'), 'inventario-inmuebles-2026-11-27.json');
  const html = require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'public', 'index.html'), 'utf8');
  assert.match(html, /onclick="activosGuardarEstados\(\)">Guardar nombres/);
  assert.match(html, /onclick="activosDescargarCopia\(\)">Descargar copia \(\.json\)/);
});
