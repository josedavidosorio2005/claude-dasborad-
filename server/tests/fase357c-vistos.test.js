// fase357c-vistos.test.js — Fase 357 C (pedido de Edwin, 17/11): pestaña «Vistos» de Calidad.
// Última apertura de la Calidad de cada asesora + monitoreos sin ver + semáforo. Datos SINTETICOS.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');
const V = require('../../public/js/vistos-logic.js');

const H = (t) => ({ Authorization: 'Bearer ' + t });
const CAMP = 'ORLANT';
function crear(user, rol, perms, extra) {
  const r = db.prepare(`INSERT INTO users (nombre, user, rol, active, password_hash, perms, createdAt, debe_cambiar_password, asesorCampana) VALUES (?,?,?,1,?,?,?,0,?)`)
    .run((extra && extra.nombre) || 'Persona ' + user, user, rol, bcrypt.hashSync('Clave#2026x', 4), JSON.stringify(perms), new Date().toISOString(), (extra && extra.asesorCampana) || null);
  return Number(r.lastInsertRowid);
}
function monitoreo(asesorUserId, nombre, visto) {
  const cols = db.prepare('PRAGMA table_info(monitoreos)').all().map((c) => c.name);
  const fila = { campana: CAMP, asesor: nombre, asesorUserId, fecha: '2026-11-10', evaluador: 'Evaluador Ficticio', vistoPorAsesorAt: visto ? '10/11/2026 10:00:00' : null, createdAt: new Date().toISOString(), puntaje: 90, mes: '2026-11', answers: '{}' };
  const usar = Object.keys(fila).filter((k) => cols.includes(k));
  db.prepare(`INSERT INTO monitoreos (${usar.join(',')}) VALUES (${usar.map(() => '?').join(',')})`).run(...usar.map((k) => fila[k]));
}
const id = {};
const tk = {};
before(async () => {
  // Solo cuentan los monitoreos posteriores al «desde» de la Fase 95.
  db.prepare("INSERT OR REPLACE INTO app_config (clave, valor) VALUES ('alertaAsesorDesdeMonitoreoId', ?)").run(String(db.prepare('SELECT COALESCE(MAX(id),0) m FROM monitoreos').get().m));
  id.verde = crear('f357c_verde', 'ASESOR', {}, { asesorCampana: CAMP, nombre: 'Asesora Verde Ficticia' });
  id.amar = crear('f357c_amar', 'ASESOR', {}, { asesorCampana: CAMP, nombre: 'Asesora Amarilla Ficticia' });
  id.rojo = crear('f357c_rojo', 'ASESOR', {}, { asesorCampana: CAMP, nombre: 'Asesora Roja Ficticia' });
  id.gris = crear('f357c_gris', 'ASESOR', {}, { asesorCampana: CAMP, nombre: 'Asesora Gris Ficticia' });
  id.otra = crear('f357c_otra', 'ASESOR', {}, { asesorCampana: 'MOBILIZE', nombre: 'Asesora Otra Campaña' });
  monitoreo(id.verde, 'Asesora Verde Ficticia', true);
  monitoreo(id.amar, 'Asesora Amarilla Ficticia', false);
  for (let i = 0; i < 3; i++) monitoreo(id.rojo, 'Asesora Roja Ficticia', false);
  monitoreo(null, 'Asesora Amarilla Ficticia', true); // por nombre exacto (sin id), visto
  tk.master = await tokenFor('admin', MASTER_PASSWORD);
  tk.rep = await (async () => { crear('f357c_rep', 'REPORTES', { Calidad: true, campana_ORLANT: true }); return tokenFor('f357c_rep', 'Clave#2026x'); })();
  tk.sup = await (async () => { crear('f357c_sup', 'SUPERVISOR', { supervisa_ORLANT: true }); return tokenFor('f357c_sup', 'Clave#2026x'); })();
  tk.supM = await (async () => { crear('f357c_supm', 'SUPERVISOR', { supervisa_MOBILIZE: true }); return tokenFor('f357c_supm', 'Clave#2026x'); })();
  tk.cal = await (async () => { crear('f357c_cal', 'CALIDAD', { Calidad: true, campana_ORLANT: true }); return tokenFor('f357c_cal', 'Clave#2026x'); })();
  tk.cli = await (async () => { crear('f357c_cli', 'CLIENTES_DASH', { ClientesDash: true, cliente_ORLANT: true }); return tokenFor('f357c_cli', 'Clave#2026x'); })();
  tk.amar = await tokenFor('f357c_amar', 'Clave#2026x');
  tk.rojo = await tokenFor('f357c_rojo', 'Clave#2026x');
});

test('semáforo: reglas aprobadas', () => {
  const ahora = new Date('2026-11-17T15:00:00Z');
  const hace = (d) => new Date(ahora.getTime() - d * 86400000).toISOString();
  assert.equal(V.vistosSemaforo(0, 0, null, ahora), 'gris');
  assert.equal(V.vistosSemaforo(5, 0, null, ahora), 'verde');
  assert.equal(V.vistosSemaforo(5, 1, hace(1), ahora), 'amarillo');
  assert.equal(V.vistosSemaforo(5, 2, hace(6), ahora), 'amarillo');
  assert.equal(V.vistosSemaforo(5, 2, hace(7), ahora), 'rojo', '7 días sin entrar');
  assert.equal(V.vistosSemaforo(5, 1, null, ahora), 'rojo', 'nunca entró');
  assert.equal(V.vistosSemaforo(5, 3, hace(0), ahora), 'rojo', '3 o más sin ver');
  assert.deepEqual(V.VISTOS_ESTADOS, { gris: 'Sin monitoreos', verde: 'Al día', amarillo: 'Pendiente', rojo: 'Atrasado' });
});

test('días en calendario de Colombia (no en UTC)', () => {
  // 17/11 00:30 en Colombia = 17/11 05:30 UTC; 16/11 23:30 en Colombia = 17/11 04:30 UTC → 1 día.
  assert.equal(V.vistosDiasDesde('2026-11-17T04:30:00Z', new Date('2026-11-17T05:30:00Z')), 1);
  assert.equal(V.vistosDiasDesde('2026-11-17T05:30:00Z', new Date('2026-11-17T23:00:00Z')), 0);
  assert.equal(V.vistosDiasDesde(null, new Date()), null);
});

test('la asesora registra cuándo abre su Calidad; los demás roles no registran nada', async () => {
  assert.equal(db.prepare('SELECT calidad_abierta_at x FROM users WHERE id = ?').get(id.amar).x, null);
  const r = await request(app).post('/api/monitoreos/mios/abierto').set(H(tk.amar)).send({});
  assert.equal(r.status, 200);
  assert.equal(r.body.registrado, true);
  assert.ok(db.prepare('SELECT calidad_abierta_at x FROM users WHERE id = ?').get(id.amar).x);
  const s = await request(app).post('/api/monitoreos/mios/abierto').set(H(tk.sup)).send({});
  assert.equal(s.body.registrado, false);
  // Con «ver como» (solo lectura) no se registra la apertura.
  const vc = (await request(app).post('/api/admin/ver-como/' + id.rojo).set(H(tk.master)).send({})).body.token;
  assert.equal((await request(app).post('/api/monitoreos/mios/abierto').set(H(vc)).send({})).status, 403);
  assert.equal(db.prepare('SELECT calidad_abierta_at x FROM users WHERE id = ?').get(id.rojo).x, null);
});

test('«Vistos»: asesoras de la campaña con sin ver, última apertura y semáforo, ordenadas', async () => {
  const r = await request(app).get('/api/calidad/vistos?campana=' + CAMP).set(H(tk.master));
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const por = Object.fromEntries(r.body.asesores.map((a) => [a.id, a]));
  assert.ok(!por[id.otra], 'solo las de la campaña');
  assert.deepEqual([por[id.verde].semaforo, por[id.verde].sinVer, por[id.verde].total], ['verde', 0, 1]);
  assert.deepEqual([por[id.amar].semaforo, por[id.amar].sinVer, por[id.amar].total], ['amarillo', 1, 2], 'cuenta también el monitoreo por nombre exacto');
  assert.ok(por[id.amar].ultimaApertura && por[id.amar].dias === 0);
  assert.deepEqual([por[id.rojo].semaforo, por[id.rojo].sinVer], ['rojo', 3]);
  assert.deepEqual([por[id.gris].semaforo, por[id.gris].total], ['gris', 0]);
  const orden = r.body.asesores.map((a) => a.semaforo);
  assert.deepEqual(orden, orden.slice().sort((a, b) => ({ rojo: 0, amarillo: 1, verde: 2, gris: 3 })[a] - ({ rojo: 0, amarillo: 1, verde: 2, gris: 3 })[b]));
});

test('«Vistos»: ADMIN, Reportes y el supervisor de la campaña; nadie más', async () => {
  assert.equal((await request(app).get('/api/calidad/vistos?campana=' + CAMP).set(H(tk.rep))).status, 200);
  assert.equal((await request(app).get('/api/calidad/vistos?campana=' + CAMP).set(H(tk.sup))).status, 200);
  assert.equal((await request(app).get('/api/calidad/vistos?campana=' + CAMP).set(H(tk.supM))).status, 403, 'supervisor de otra campaña');
  for (const k of ['cal', 'cli', 'amar']) assert.equal((await request(app).get('/api/calidad/vistos?campana=' + CAMP).set(H(tk[k]))).status, 403, k);
  assert.equal((await request(app).get('/api/calidad/vistos').set(H(tk.master))).status, 400);
});
