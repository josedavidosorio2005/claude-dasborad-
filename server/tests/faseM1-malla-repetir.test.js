// faseM1-malla-repetir.test.js — Fase M1 (C): horario especial que se repite cada semana. Personas,
// grupos y horarios INVENTADOS (semanas de 2031, lejos de hoy).
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');
const L = require('../../public/js/malla-logic.js');
const M = require('../malla');
const X = require('../malla-extra');

const H = (t) => ({ Authorization: 'Bearer ' + t });
const R = 'MOBILIZE PRUEBAS API';
const S = '2031-05-05'; // lunes
const HOR = { 1: { entrada: '08:00', salida: '17:00' }, 2: { entrada: '08:00', salida: '17:00' }, 3: { entrada: '08:00', salida: '17:00' }, 4: { entrada: '08:00', salida: '17:00' }, 5: { entrada: '08:00', salida: '17:00' }, 6: null, 7: null };
function crear(user, rol, perms, camp) {
  const r = db.prepare(`INSERT INTO users (nombre, user, rol, active, password_hash, perms, createdAt, debe_cambiar_password, asesorCampana) VALUES (?,?,?,1,?,?,?,0,?)`)
    .run('Persona Inventada ' + user, user, rol, bcrypt.hashSync('Clave#2026x', 4), JSON.stringify(perms), new Date().toISOString(), camp || null);
  return Number(r.lastInsertRowid);
}
const id = {}, tk = {};
let grupo;
before(async () => {
  id.a1 = crear('m1c_a1', 'ASESOR', {}, 'MOBILIZE');
  id.a2 = crear('m1c_a2', 'ASESOR', {}, 'MOBILIZE');
  crear('m1c_cli', 'CLIENTES_DASH', { ClientesDash: true, cliente_MOBILIZE: true });
  tk.master = await tokenFor('admin', MASTER_PASSWORD);
  tk.cli = await tokenFor('m1c_cli', 'Clave#2026x');
  const g = await request(app).post('/api/malla/grupos').set(H(tk.master)).send({ campana: R, semana: S, nombre: 'Grupo M1C', horario: HOR });
  assert.equal(g.status, 201, JSON.stringify(g.body));
  grupo = g.body.grupo.id;
  await request(app).put('/api/malla/grupos/' + grupo + '/asesoras').set(H(tk.master)).send({ asesoras: [id.a1, id.a2] });
});
const guardar = (b, t) => request(app).put('/api/malla/ajustes').set(H(t || tk.master)).send(Object.assign({ campana: R, semana: S, asesorId: id.a1, dias: [2], descanso: false, entrada: '10:00', salida: '18:00' }, b));

test('C: la columna `serie` se agrega una sola vez y los horarios especiales viejos quedan sin serie', () => {
  const cols = () => db.prepare('PRAGMA table_info(malla_ajustes)').all().filter((c) => c.name === 'serie').length;
  assert.equal(cols(), 1);
  X.crearTablas(db);
  assert.equal(cols(), 1, 'idempotente');
});

test('C: «repetir hasta» crea los mismos días cada semana, con una sola serie; validaciones', async () => {
  assert.equal((await guardar({ repetirHasta: '2031-05-06' })).status, 400, 'debe ser de una semana siguiente');
  assert.equal((await guardar({ repetirHasta: '2031-13-01' })).status, 400);
  assert.equal((await guardar({ repetirHasta: 20310601 })).status, 400);
  const limite = L.mallaFechaDelDia(L.mallaSumarSemanas(S, 25), 7);
  assert.match((await guardar({ repetirHasta: L.mallaFechaDelDia(L.mallaSumarSemanas(S, 26), 1) })).body.error, new RegExp('máximo 26 semanas \\(hasta el ' + limite + '\\)'));
  const r = await guardar({ dias: [2, 4], repetirHasta: '2031-05-27' }); // martes y jueves, 3 semanas + el martes 27
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual(r.body.fechas, ['2031-05-06', '2031-05-08', '2031-05-13', '2031-05-15', '2031-05-20', '2031-05-22', '2031-05-27']);
  assert.match(r.body.serie, /^r[a-z0-9]+$/);
  const filas = db.prepare('SELECT DISTINCT serie FROM malla_ajustes WHERE asesorId = ?').all(id.a1);
  assert.deepEqual(filas.map((x) => x.serie), [r.body.serie]);
  const h = db.prepare("SELECT detalle FROM historial WHERE accion = 'MALLA_HORARIO_ESPECIAL' ORDER BY id DESC LIMIT 1").get().detalle;
  assert.equal(h, '2031-05-06 a 2031-05-27 · 7 día(s), se repite cada semana · 10:00 – 18:00');
  // Sin «repetir»: igual que antes (solo esa semana, sin serie).
  const s = await guardar({ asesorId: id.a2, dias: [1], descanso: true });
  assert.equal(s.status, 200);
  assert.equal(s.body.serie, null);
});

test('C: en semanas sin malla todavía, el horario especial se aplica cuando la asesora queda asignada', async () => {
  const sig = L.mallaSumarSemanas(S, 1);
  assert.equal(M.turnoDe(db, id.a1, R, sig), null, 'la semana siguiente aún no tiene malla');
  const c = await request(app).post('/api/malla/copiar').set(H(tk.master)).send({ campana: R, desde: S, hasta: sig });
  assert.equal(c.status, 200);
  const t = M.turnoDe(db, id.a1, R, sig);
  assert.deepEqual(t.horario[2], { entrada: '10:00', salida: '18:00' });
  assert.deepEqual(t.especiales, [2, 4]);
  const p = await request(app).get('/api/malla/puntualidad?campana=' + encodeURIComponent(R) + '&semana=' + sig).set(H(tk.master));
  const f = p.body.filas.find((x) => x.userId === id.a1 && x.fecha === '2031-05-13');
  assert.deepEqual([f.entrada, f.salida], ['10:00', '18:00']);
  const sem = await request(app).get('/api/malla?campana=' + encodeURIComponent(R) + '&semana=' + sig).set(H(tk.master));
  assert.ok(sem.body.ajustes.every((a) => a.asesorId !== id.a1 || a.serie), 'la semana trae la serie de cada día');
});

test('C: quitar toda la repetición: solo quien edita; un día suelto se sigue quitando aparte; Historial', async () => {
  const serie = db.prepare('SELECT serie FROM malla_ajustes WHERE asesorId = ? AND serie IS NOT NULL LIMIT 1').get(id.a1).serie;
  const uno = db.prepare('SELECT id FROM malla_ajustes WHERE asesorId = ? AND fecha = ?').get(id.a1, '2031-05-27').id;
  assert.equal((await request(app).delete('/api/malla/ajustes/' + uno).set(H(tk.master))).status, 200);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM malla_ajustes WHERE serie = ?').get(serie).n, 6);
  assert.equal((await request(app).delete('/api/malla/ajustes/serie/' + serie).set(H(tk.cli))).status, 404, 'el cliente no ve la malla');
  assert.equal((await request(app).delete('/api/malla/ajustes/serie/rnoexiste123').set(H(tk.master))).status, 404);
  assert.equal((await request(app).delete('/api/malla/ajustes/serie/..%2Fx').set(H(tk.master))).status, 404);
  const d = await request(app).delete('/api/malla/ajustes/serie/' + serie).set(H(tk.master));
  assert.equal(d.status, 200);
  assert.equal(d.body.quitados, 6);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM malla_ajustes WHERE asesorId = ?').get(id.a1).n, 0);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM malla_ajustes WHERE asesorId = ?').get(id.a2).n, 1, 'lo de otra asesora no se toca');
  const h = db.prepare("SELECT detalle FROM historial WHERE accion = 'MALLA_HORARIO_ESPECIAL_QUITADO' ORDER BY id DESC LIMIT 1").get().detalle;
  assert.equal(h, '2031-05-06 a 2031-05-22 · 6 día(s), toda la repetición');
});

test('C (pantalla): el formulario trae «Repetir cada semana hasta» y la repetición se marca y se quita de una vez', () => {
  Object.assign(global, L, { esc: require('../../public/js/esc.js').esc });
  const UI = require('../../public/js/malla.js');
  const html = UI.mallaCasosHtml({ id: 1, asesoras: [{ id: 7, nombre: 'Asesora <i>x</i>' }] }, 0, true, {
    ajustes: [{ id: 1, asesorId: 7, fecha: '2031-05-06', turno: { entrada: '10:00', salida: '18:00' }, serie: 'rabc123' }, { id: 2, asesorId: 7, fecha: '2031-05-07', turno: null, serie: null }], novedades: [] });
  assert.match(html, /10:00 – 18:00 <span class="ml-rep">· se repite<\/span>/);
  assert.match(html, /mallaQuitarSerie\('rabc123'\)" aria-label="Quitar todas las semanas de este horario especial de Asesora &lt;i&gt;x&lt;\/i&gt;"/);
  assert.equal((html.match(/mallaQuitarSerie/g) || []).length, 1, 'solo el día con serie');
  const solo = UI.mallaCasosHtml({ id: 1, asesoras: [{ id: 7, nombre: 'A' }] }, 0, false, { ajustes: [{ id: 1, asesorId: 7, fecha: '2031-05-06', turno: null, serie: 'rabc123' }], novedades: [] });
  assert.ok(!/mallaQuitarSerie|ml-chip-x/.test(solo), 'solo lectura: sin botones');
  const js = require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'public', 'js', 'malla.js'), 'utf8');
  assert.match(js, /Repetir cada semana hasta \(opcional\)/);
  assert.match(js, /b\.repetirHasta = rep\.value/);
});
