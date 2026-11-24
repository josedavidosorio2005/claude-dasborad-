// faseM1-malla-casos.test.js — Fase M1 (pedido 6 de Edwin; alcance A+B+C aprobado el 24/11):
// «Casos especiales» de la malla. Personas, grupos y fechas INVENTADOS (semanas de 2031, lejos de hoy).
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');
const C = require('../malla-casos');
const P = require('../puntualidad');

const H = (t) => ({ Authorization: 'Bearer ' + t });
const R = 'MOBILIZE PRUEBAS API';
const S = '2031-03-03'; // lunes
const HOR = { 1: { entrada: '08:00', salida: '17:00' }, 2: { entrada: '08:00', salida: '17:00' }, 3: { entrada: '08:00', salida: '17:00' }, 4: { entrada: '08:00', salida: '17:00' }, 5: { entrada: '08:00', salida: '17:00' }, 6: null, 7: null };
function crear(user, rol, perms, camp) {
  const r = db.prepare(`INSERT INTO users (nombre, user, rol, active, password_hash, perms, createdAt, debe_cambiar_password, asesorCampana) VALUES (?,?,?,1,?,?,?,0,?)`)
    .run('Persona Inventada ' + user, user, rol, bcrypt.hashSync('Clave#2026x', 4), JSON.stringify(perms), new Date().toISOString(), camp || null);
  return Number(r.lastInsertRowid);
}
const id = {}, tk = {};
before(async () => {
  id.a1 = crear('m1_a1', 'ASESOR', {}, 'MOBILIZE');
  id.a2 = crear('m1_a2', 'ASESOR', {}, 'MOBILIZE');
  crear('m1_supm', 'SUPERVISOR', { supervisa_MOBILIZE: true });
  crear('m1_cli', 'CLIENTES_DASH', { ClientesDash: true, cliente_MOBILIZE: true });
  tk.master = await tokenFor('admin', MASTER_PASSWORD);
  for (const u of ['supm', 'cli', 'a1']) tk[u] = await tokenFor('m1_' + u, 'Clave#2026x');
  const g = await request(app).post('/api/malla/grupos').set(H(tk.master)).send({ campana: R, semana: S, nombre: 'Grupo M1', horario: HOR });
  assert.equal(g.status, 201, JSON.stringify(g.body));
  const a = await request(app).put('/api/malla/grupos/' + g.body.grupo.id + '/asesoras').set(H(tk.master)).send({ asesoras: [id.a1, id.a2] });
  assert.equal(a.status, 200, JSON.stringify(a.body));
});

// ── A. Tipos de excepción ──
test('A: se siembran los 3 de siempre y los 6 nuevos; capacitación cuenta como día trabajado', () => {
  const t = C.tipos(db, { todos: true });
  assert.deepEqual(t.slice(0, 3).map((x) => x.codigo), ['incapacidad', 'vacaciones', 'permiso']);
  for (const c of ['licencia', 'calamidad', 'capacitacion', 'compensatorio', 'suspension', 'dia_familia']) assert.ok(t.some((x) => x.codigo === c && x.activo), c);
  assert.deepEqual(t.filter((x) => x.cuentaTrabajado).map((x) => x.codigo), ['capacitacion']);
  // Idempotente: volver a crear las tablas no duplica ni pisa un cambio del ADMIN.
  db.prepare("UPDATE malla_tipos_excepcion SET nombre = 'Calamidad (renombrada)' WHERE codigo = 'calamidad'").run();
  C.crearTablas(db);
  assert.equal(C.tipos(db, { todos: true }).length, t.length);
  assert.equal(C.tiposMapa(db).calamidad, 'Calamidad (renombrada)');
});

test('A: leer los tipos: quien lee la malla; cambiarlos: solo el ADMIN completo', async () => {
  const sup = await request(app).get('/api/malla/tipos-excepcion').set(H(tk.supm));
  assert.equal(sup.status, 200);
  assert.equal(sup.body.puedeAdministrar, false);
  assert.equal((await request(app).get('/api/malla/tipos-excepcion').set(H(tk.cli))).status, 403);
  assert.equal((await request(app).get('/api/malla/tipos-excepcion').set(H(tk.a1))).status, 403);
  assert.equal((await request(app).get('/api/malla/tipos-excepcion')).status, 401);
  assert.equal((await request(app).post('/api/malla/tipos-excepcion').set(H(tk.supm)).send({ nombre: 'Tipo inventado' })).status, 403);
  assert.equal((await request(app).put('/api/malla/tipos-excepcion/permiso').set(H(tk.supm)).send({ activo: false })).status, 403);
  const adm = await request(app).get('/api/malla/tipos-excepcion').set(H(tk.master));
  assert.equal(adm.body.puedeAdministrar, true);
});

test('A: crear y editar tipos (validaciones, duplicado, al menos uno activo) y queda en el Historial', async () => {
  const post = (b) => request(app).post('/api/malla/tipos-excepcion').set(H(tk.master)).send(b);
  const c = await post({ nombre: 'Jornada inventada de bienestar', cuentaTrabajado: true });
  assert.equal(c.status, 201, JSON.stringify(c.body));
  assert.equal(c.body.tipo.codigo, 'jornada_inventada_de_bienestar');
  assert.equal(c.body.tipo.cuentaTrabajado, true);
  assert.equal((await post({ nombre: 'JORNADA INVENTADA DE BIENESTAR' })).status, 409);
  assert.equal((await post({ nombre: 'x' })).status, 400);
  assert.equal((await post({ nombre: '<script>' })).status, 400);
  assert.equal((await post({ nombre: 'Tipo valido', otro: 1 })).status, 400);
  assert.equal((await post({ nombre: 'Tipo valido', cuentaTrabajado: 'si' })).status, 400);
  const put = (codigo, b) => request(app).put('/api/malla/tipos-excepcion/' + codigo).set(H(tk.master)).send(b);
  assert.equal((await put('no_existe', { activo: false })).status, 404);
  assert.equal((await put('../x', { activo: false })).status, 404);
  assert.equal((await put('permiso', {})).status, 400);
  const d = await put('permiso', { activo: false });
  assert.equal(d.status, 200);
  assert.equal(d.body.tipo.activo, false);
  const h = db.prepare("SELECT accion, detalle FROM historial WHERE accion LIKE 'MALLA_TIPO_EXCEPCION%' ORDER BY id").all();
  assert.deepEqual(h.map((x) => x.accion), ['MALLA_TIPO_EXCEPCION', 'MALLA_TIPO_EXCEPCION_EDITADO']);
  assert.match(h[1].detalle, /desactivado/);
  // Nunca queda sin tipos activos.
  for (const t of C.tipos(db)) if (t.codigo !== 'vacaciones') C.editarTipo(db, t.codigo, { activo: false });
  assert.equal((await put('vacaciones', { activo: false })).status, 400);
  for (const t of C.tipos(db, { todos: true })) if (t.codigo !== 'permiso') C.editarTipo(db, t.codigo, { activo: true });
});

test('A: la excepción acepta solo tipos activos; un tipo inactivo conserva su nombre; resumen aparte del «día trabajado»', async () => {
  const exc = (b) => request(app).post('/api/malla/excepciones').set(H(tk.master)).send(Object.assign({ campana: R, userId: id.a1, desde: S }, b));
  assert.equal((await exc({ tipo: 'permiso' })).status, 400, 'permiso está inactivo');
  assert.equal((await exc({ tipo: 'inventado' })).status, 400);
  assert.equal((await exc({ tipo: 'capacitacion' })).status, 201);
  assert.equal((await exc({ tipo: 'incapacidad', userId: id.a2, desde: '2031-03-04', hasta: '2031-03-05' })).status, 201);
  const p = await request(app).get('/api/malla/puntualidad?campana=' + encodeURIComponent(R) + '&semana=' + S).set(H(tk.master));
  assert.equal(p.status, 200);
  assert.equal(p.body.resumen.excepcion, 3);
  assert.equal(p.body.resumen.excepcionTrabajada, 1);
  const f = p.body.filas.find((x) => x.userId === id.a1 && x.fecha === S);
  assert.deepEqual(f.excepcion.tipo, 'capacitacion');
  assert.equal(f.excepcion.cuentaTrabajado, true);
  assert.equal(p.body.tipos.permiso, 'Permiso', 'el mapa trae también los inactivos');
  assert.ok(!p.body.tiposActivos.some((t) => t.codigo === 'permiso'), 'el formulario ofrece solo los activos');
  assert.equal(p.body.puedeAdministrarTipos, true);
  const h = db.prepare("SELECT detalle FROM historial WHERE accion = 'MALLA_EXCEPCION' ORDER BY id DESC LIMIT 2").all();
  assert.ok(h.some((x) => /^Capacitación · 2031-03-03$/.test(x.detalle)), JSON.stringify(h));
  assert.equal(P.TIPOS_EXCEPCION.incapacidad, 'Incapacidad', 'la lista vieja sigue exportada');
});

test('A (pantalla): la tabla de tipos escapa los nombres y marca los activos y el «día trabajado»', () => {
  global.esc = require('../../public/js/esc.js').esc;
  const { mpTiposHtml, mpResumenHtml } = require('../../public/js/malla-puntualidad.js');
  const html = mpTiposHtml({ tipos: [{ codigo: 'a', nombre: 'Tipo <b>raro</b>', activo: true, cuentaTrabajado: true }, { codigo: 'b', nombre: 'Viejo', activo: false, cuentaTrabajado: false }] });
  assert.ok(!html.includes('<b>raro'), 'nombre escapado');
  assert.match(html, /id="mp-tipo-t-0" checked/);
  assert.match(html, /id="mp-tipo-a-0" checked/);
  assert.match(html, /<tr class="mp-tipo-inactivo">/);
  assert.match(html, /<label class="mp-check"><input type="checkbox" id="mp-tipo-nuevo-t">/);
  assert.match(mpResumenHtml({ resumen: { excepcion: 2, excepcionTrabajada: 1 } }), /cuentan como día trabajado: 1/);
  assert.ok(!/cuentan como día trabajado/.test(mpResumenHtml({ resumen: { excepcion: 2, excepcionTrabajada: 0 } })));
});
