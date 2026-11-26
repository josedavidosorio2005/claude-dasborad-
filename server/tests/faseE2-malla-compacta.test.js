// faseE2-malla-compacta.test.js — pedido de Edwin (reunión 24/11/2026): ventana de la malla del supervisor
// más compacta, y en Puntualidad la novedad del día en vez de «Sin ingreso». Datos INVENTADOS (2031).
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');
require('./fixture-campana-ejemplo-malla').montar(); // Fase W10: la réplica solo como campaña de ejemplo
const P = require('../puntualidad');
const L = require('../../public/js/malla-logic.js');

const H = (t) => ({ Authorization: 'Bearer ' + t });
const R = 'MOBILIZE PRUEBAS API';
const S = '2031-06-02'; // lunes
const HOR = { 1: { entrada: '08:00', salida: '17:00' }, 2: { entrada: '08:00', salida: '17:00' }, 3: { entrada: '08:00', salida: '17:00' }, 4: null, 5: null, 6: null, 7: null };
const PUB = path.join(__dirname, '..', '..', 'public');
const id = {};
let tk;
function crear(user) {
  return Number(db.prepare(`INSERT INTO users (nombre, user, rol, active, password_hash, perms, createdAt, debe_cambiar_password, asesorCampana) VALUES (?,?,'ASESOR',1,?,'{}',?,0,'MOBILIZE')`)
    .run('Persona Inventada ' + user, user, bcrypt.hashSync('Clave#2026x', 4), new Date().toISOString()).lastInsertRowid);
}
before(async () => {
  id.a1 = crear('e2_a1'); id.a2 = crear('e2_a2'); id.a3 = crear('e2_a3');
  tk = await tokenFor('admin', MASTER_PASSWORD);
  const g = await request(app).post('/api/malla/grupos').set(H(tk)).send({ campana: R, semana: S, nombre: 'Grupo E2', horario: HOR });
  assert.equal(g.status, 201, JSON.stringify(g.body));
  await request(app).put('/api/malla/grupos/' + g.body.grupo.id + '/asesoras').set(H(tk)).send({ asesoras: [id.a1, id.a2, id.a3] });
  // Logins inventados (enlace automático por nombre exacto); nadie entra el lunes 2.
  const ins = db.prepare('INSERT OR REPLACE INTO wolkvox_login_diario (operacion, fecha, agentId, agentName, primerLogin, ultimoLogout, sesiones, segundos) VALUES (?,?,?,?,?,?,1,100)');
  [['E21', 'e2_a1'], ['E22', 'e2_a2'], ['E23', 'e2_a3']].forEach(([ag, u]) => ['2031-06-03', '2031-06-04'].forEach((f) => ins.run('MOBILIZE', f, ag, 'Persona Inventada ' + u, f + ' 07:55:00', f + ' 17:00:00')));
  db.prepare("INSERT OR REPLACE INTO wolkvox_login_hasta (operacion, hasta, actualizado) VALUES ('MOBILIZE', '2031-06-08 23:59:59', 'x')").run();
});

test('Puntualidad: con novedad del día (o de toda la semana) sale la novedad en vez de «Sin ingreso»', async () => {
  const nov = (b) => request(app).post('/api/malla/novedades').set(H(tk)).send(Object.assign({ campana: R, semana: S }, b));
  assert.equal((await nov({ asesorId: id.a1, fecha: '2031-06-02', texto: 'Suspensión inventada' })).status, 201);
  assert.equal((await nov({ asesorId: id.a2, fecha: null, texto: 'Calamidad inventada toda la semana' })).status, 201);
  const r = P.calcular(db, R, S, L.mallaFechaDelDia(S, 7), { ahora: '2031-06-09 10:00:00' });
  const dia = (u) => r.filas.find((f) => f.userId === u && f.fecha === '2031-06-02');
  assert.deepEqual([dia(id.a1).estado, dia(id.a1).novedad], ['novedad', 'Suspensión inventada']);
  assert.deepEqual([dia(id.a2).estado, dia(id.a2).novedad], ['novedad', 'Calamidad inventada toda la semana']);
  assert.deepEqual([dia(id.a3).estado, dia(id.a3).novedad], ['sin_ingreso', null], 'sin novedad: sigue «Sin ingreso»');
  assert.equal(r.resumen.novedad, 2);
  assert.equal(r.resumen.sin_ingreso, 1);
  // Un día en que sí entró: la novedad no tapa «A tiempo».
  assert.equal(r.filas.find((f) => f.userId === id.a2 && f.fecha === '2031-06-03').estado, 'a_tiempo');
  // Una novedad quitada ya no cuenta.
  const n = db.prepare('SELECT id FROM malla_novedades WHERE asesorId = ?').get(id.a1).id;
  assert.equal((await request(app).delete('/api/malla/novedades/' + n).set(H(tk))).status, 200);
  const r2 = P.calcular(db, R, S, L.mallaFechaDelDia(S, 7), { ahora: '2031-06-09 10:00:00' });
  assert.equal(r2.filas.find((f) => f.userId === id.a1 && f.fecha === '2031-06-02').estado, 'sin_ingreso');
  // La vista de la asesora queda igual («Mi puntualidad» no recibe el estado nuevo).
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'routes', 'malla.js'), 'utf8'), /estado: f\.estado === 'novedad' \? 'sin_ingreso' : f\.estado/);
});

test('Puntualidad (pantalla): la celda muestra «Novedad: …» escapada y el resumen «Con novedad»', () => {
  global.esc = require('../../public/js/esc.js').esc;
  Object.assign(global, L);
  const MP = require('../../public/js/malla-puntualidad.js');
  assert.deepEqual(MP.mpEstadoTexto({ estado: 'novedad', novedad: 'Suspensión' }), { texto: 'Novedad: Suspensión', clase: 'vis-gris mp-novedad' });
  const html = MP.mpTablaHtml({ semana: S, tipos: {}, filas: [{ userId: 1, nombre: 'A', fecha: S, estado: 'novedad', novedad: '<b>x</b>', entrada: '08:00', salida: '17:00' }] });
  assert.ok(!html.includes('<b>x'));
  assert.match(html, /title="Novedad: &lt;b&gt;x&lt;\/b&gt;"/);
  assert.match(MP.mpResumenHtml({ resumen: { novedad: 2 } }), /Con novedad: 2/);
  assert.ok(!/Con novedad/.test(MP.mpResumenHtml({ resumen: { novedad: 0 } })));
});

test('Ventana compacta: una fila de filtros con la semana en una lista, pestañas visibles, cabecera del grupo, lista con scroll y «Agregar novedad»', () => {
  global.esc = require('../../public/js/esc.js').esc;
  Object.assign(global, L);
  const UI = require('../../public/js/malla.js');
  const idx = fs.readFileSync(path.join(PUB, 'index.html'), 'utf8');
  const barra = idx.slice(idx.indexOf('<div class="ml-barra">'), idx.indexOf('id="ml-vistas"'));
  for (const x of ['id="ml-campana"', 'mallaMoverSemana(-1)', 'id="ml-mes"', 'id="ml-semanas-mes"', '<select id="ml-sem-sel" onchange="mallaElegirSemanaMes()">']) assert.ok(barra.includes(x), x);
  assert.match(idx, /<button type="button" class="ml-tab" id="ml-vista-turnos" aria-pressed="true"/);
  const js = fs.readFileSync(path.join(PUB, 'js', 'malla.js'), 'utf8');
  assert.ok(!js.includes('ml-sem-btn'), 'sin las fichas de semanas');
  const g = { id: 1, nombre: 'G', horario: HOR, asesoras: [{ id: 7, nombre: 'Asesora <i>x</i>' }] };
  const ed = UI.mallaGrupoHtml(g, true, [{ id: 7, nombre: 'Asesora <i>x</i>' }], 0, { ajustes: [], novedades: [] });
  assert.match(ed, /<div class="ml-grupo-cab">[\s\S]*Guardar grupo[\s\S]*<div class="ml-grupo-cuerpo">/);
  assert.match(ed, /<div class="ml-asesoras-lista" tabindex="0" role="group"/);
  assert.match(ed, /class="btn-sm ml-btn-sm ml-btn-ambar"[^>]*aria-label="Agregar novedad a Asesora &lt;i&gt;x&lt;\/i&gt;">\+ Agregar novedad<\/button>/);
  const ro = UI.mallaGrupoHtml(g, false, [{ id: 7, nombre: 'A' }], 0, { ajustes: [], novedades: [] });
  assert.ok(!/Agregar novedad|Guardar grupo/.test(ro), 'solo lectura: sin botones');
  const css = fs.readFileSync(path.join(PUB, 'css', 'styles.css'), 'utf8');
  assert.match(css, /\.ml-asesoras-lista\{max-height:286px;overflow-y:auto/);
  assert.match(css, /\.ml-tab\[aria-pressed="true"\]\{/);
  // «Mi malla» de la asesora no usa nada de lo nuevo.
  assert.ok(!/ml-grupo-cab|ml-btn-sm|ml-asesoras-lista/.test(UI.mallaMiaHtml({ semanas: [{ semana: S, turno: { grupo: 'G', horario: HOR } }] })));
});

test('Pedido de Edwin (24/11): «Novedades» y «Horario especial» en ámbar (botones, registros y título del bloque)', () => {
  const fs = require('fs');
  const path = require('path');
  const css = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'css', 'styles.css'), 'utf8');
  assert.match(css, /\.ml-btn-sm\.ml-btn-ambar\{background:var\(--c-warning-bg\);color:var\(--c-warning-text\);border-color:var\(--c-warning\)\}/);
  assert.match(css, /\.ml-chip\.ml-chip-ambar\{background:var\(--c-warning-bg\)/);
  assert.match(css, /\.ml-casos summary\{color:var\(--c-warning-text\)\}/);
  const js = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'malla.js'), 'utf8');
  assert.equal(js.split('class="btn-sm ml-btn-sm ml-btn-ambar"').length - 1, 2, 'los dos botones');
  assert.ok(js.includes('<li class="ml-chip ml-chip-ambar">') && js.includes('<li class="ml-chip ml-chip-nov ml-chip-ambar">'), 'los registros');
});

test('Pedido de Edwin (24/11, 3:30 p. m.): asesoras justo debajo del horario en 2-3 columnas y «Novedades y horarios especiales» como botón ámbar', () => {
  global.esc = require('../../public/js/esc.js').esc;
  Object.assign(global, L);
  const UI = require('../../public/js/malla.js');
  const g = { id: 1, nombre: 'G', horario: HOR, asesoras: [{ id: 7, nombre: 'Persona Inventada' }] };
  const html = UI.mallaGrupoHtml(g, true, [{ id: 7, nombre: 'Persona Inventada' }], 0, { ajustes: [], novedades: [] });
  // Orden: tabla del horario → lista de asesoras (la lista ya no queda al lado). Desde el 26/11 (pedido de Edwin, cuadro
  // único con las pausas) el total de la semana y la ayuda de festivos van pegados a la tabla, antes de la lista.
  const iTabla = html.indexOf('</table>'), iLista = html.indexOf('class="ml-asesoras"'), iAyuda = html.indexOf('ml-fest-ayuda"');
  assert.ok(iTabla > 0 && iAyuda > iTabla && iLista > iAyuda, 'tabla, ayuda y después la lista');
  assert.match(html, /<summary class="ml-casos-btn">Novedades y horarios especiales<\/summary>/);
  const css = fs.readFileSync(path.join(PUB, 'css', 'styles.css'), 'utf8');
  assert.ok(!css.includes('.ml-grupo-cuerpo{grid-template-columns:minmax(0,1.05fr) minmax(0,1fr)'), 'sin el lado a lado');
  assert.match(css, /@media \(min-width:560px\)\{\.ml-asesoras-lista\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\}\}/);
  assert.match(css, /@media \(min-width:1024px\)\{\.ml-asesoras-lista\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\)\}\}/);
  assert.match(css, /\.ml-casos summary\.ml-casos-btn\{display:inline-flex;[^}]*min-height:44px;[^}]*border:1px solid var\(--c-warning\);[^}]*background:var\(--c-warning-bg\)/);
  assert.match(css, /\.ml-casos summary\.ml-casos-btn:focus-visible\{outline:2px solid var\(--c-focus\)/);
});
