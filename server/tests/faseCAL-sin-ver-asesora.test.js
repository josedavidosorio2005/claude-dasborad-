// faseCAL-sin-ver-asesora.test.js — pedido de Edwin (reunión 23/11/2026): en «Mis resultados» de la
// asesora, «Sin ver» en rojo en los monitoreos que todavía no abrió con «Ver detalle», y arriba
// «Te faltan N por ver». Visto = solo al abrir «Ver detalle» (PUT /monitoreos/:id/visto, sin cambios).
// Datos SINTETICOS.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { request, app, db, tokenFor } = require('./helpers');

const H = (t) => ({ Authorization: 'Bearer ' + t });
const CAMP = 'ORLANT';
function crear(user, rol, extra) {
  const r = db.prepare(`INSERT INTO users (nombre, user, rol, active, password_hash, perms, createdAt, debe_cambiar_password, asesorCampana) VALUES (?,?,?,1,?,?,?,0,?)`)
    .run(extra.nombre, user, rol, bcrypt.hashSync('Clave#2026x', 4), '{}', new Date().toISOString(), extra.asesorCampana || null);
  return Number(r.lastInsertRowid);
}
function monitoreo(asesorUserId, nombre, visto) {
  const cols = db.prepare('PRAGMA table_info(monitoreos)').all().map((c) => c.name);
  const fila = { campana: CAMP, asesor: nombre, asesorUserId, fecha: '2026-11-10', evaluador: 'Evaluador Ficticio', vistoPorAsesorAt: visto ? '10/11/2026 10:00:00' : null, createdAt: new Date().toISOString(), puntaje: 90, mes: '2026-11', answers: '{}' };
  const usar = Object.keys(fila).filter((k) => cols.includes(k));
  return Number(db.prepare(`INSERT INTO monitoreos (${usar.join(',')}) VALUES (${usar.map(() => '?').join(',')})`).run(...usar.map((k) => fila[k])).lastInsertRowid);
}
const id = {};
const tk = {};
const mon = {};
before(async () => {
  id.a = crear('fcsv_a', 'ASESOR', { asesorCampana: CAMP, nombre: 'Asesora Sin Ver Ficticia' });
  id.b = crear('fcsv_b', 'ASESOR', { asesorCampana: CAMP, nombre: 'Otra Asesora Ficticia' });
  mon.viejo = monitoreo(id.a, 'Asesora Sin Ver Ficticia', false); // antes del corte: nunca cuenta
  db.prepare("INSERT OR REPLACE INTO app_config (clave, valor) VALUES ('alertaAsesorDesdeMonitoreoId', ?)").run(String(mon.viejo));
  mon.nuevo1 = monitoreo(id.a, 'Asesora Sin Ver Ficticia', false);
  mon.nuevo2 = monitoreo(id.a, 'Asesora Sin Ver Ficticia', false);
  mon.visto = monitoreo(id.a, 'Asesora Sin Ver Ficticia', true);
  mon.deB = monitoreo(id.b, 'Otra Asesora Ficticia', false);
  tk.a = await tokenFor('fcsv_a', 'Clave#2026x');
  tk.b = await tokenFor('fcsv_b', 'Clave#2026x');
});

const mios = async (t) => (await request(app).get('/api/monitoreos/mios').set(H(t))).body;
const porId = (lista) => Object.fromEntries(lista.map((m) => [m.id, m.sinVer]));

test('sinVer: solo los nuevos sin abrir; el visto y el anterior al corte no; igual al conteo de la alerta', async () => {
  const s = porId(await mios(tk.a));
  assert.equal(s[mon.nuevo1], true);
  assert.equal(s[mon.nuevo2], true);
  assert.equal(s[mon.visto], false);
  assert.equal(s[mon.viejo], false);
  assert.equal(s[mon.deB], undefined, 'nunca ve los de otra asesora');
  const alerta = (await request(app).get('/api/monitoreos/mios/nuevos').set(H(tk.a))).body.count;
  assert.equal(Object.values(s).filter(Boolean).length, alerta);
});

test('al abrir «Ver detalle» (PUT visto) deja de estar «sin ver»; otra asesora no puede marcarlo', async () => {
  assert.equal((await request(app).put('/api/monitoreos/' + mon.nuevo1 + '/visto').set(H(tk.b))).status, 403);
  assert.equal(porId(await mios(tk.a))[mon.nuevo1], true);
  assert.equal((await request(app).put('/api/monitoreos/' + mon.nuevo1 + '/visto').set(H(tk.a))).status, 200);
  const s = porId(await mios(tk.a));
  assert.equal(s[mon.nuevo1], false);
  assert.equal(s[mon.nuevo2], true);
  // la pestaña «Vistos» del supervisor y los datos no cambian de forma: sigue la misma columna
  assert.ok(db.prepare('SELECT vistoPorAsesorAt FROM monitoreos WHERE id = ?').get(mon.nuevo1).vistoPorAsesorAt);
});

test('interfaz: etiqueta «Sin ver» roja (semáforo), resumen «Te faltan N por ver» y quitar la marca al abrir', () => {
  const PUB = path.join(__dirname, '..', '..', 'public');
  const index = fs.readFileSync(path.join(PUB, 'index.html'), 'utf8');
  assert.match(index, /<p class="mr-sin-ver-resumen hidden" id="mr-sin-ver" role="status"><\/p>/);
  const js = fs.readFileSync(path.join(PUB, 'js', 'mis-resultados.js'), 'utf8');
  // funciones puras, cargadas aparte (el archivo toca el DOM al cargar)
  const src = js.slice(js.indexOf('function mrSinVerPill'), js.indexOf('function mrPintarResumenSinVer'));
  const f = new Function(src + '; return { mrSinVerPill, mrContarSinVer, mrTextoSinVer };')();
  assert.equal(f.mrTextoSinVer(0), '');
  assert.equal(f.mrTextoSinVer(1), 'Te falta 1 por ver. Ábrelo con «Ver Detalle».');
  assert.equal(f.mrTextoSinVer(3), 'Te faltan 3 por ver. Ábrelos con «Ver Detalle».');
  assert.equal(f.mrContarSinVer([{ sinVer: true }, { sinVer: false }, {}, null, { sinVer: true }]), 2);
  assert.match(f.mrSinVerPill(), /class="vis-pill vis-rojo mr-sin-ver-pill">Sin ver</);
  assert.match(js, /marcarMonitoreoVisto\(m\.id, idx\);/);
  assert.match(js, /if\(idx !== undefined && typeof mrQuitarSinVer === 'function'\) mrQuitarSinVer\(idx\);/);
  assert.match(js, /p\.textContent = mrTextoSinVer\(n\);/);
  const css = fs.readFileSync(path.join(PUB, 'css', 'styles.css'), 'utf8');
  assert.match(css, /\.mr-sin-ver-resumen:not\(\.hidden\)\{[^}]*var\(--c-danger-bg\)[^}]*var\(--c-danger-text\)/);
  // paleta.css sigue sin rojo (regla de la Fase 345)
  assert.doesNotMatch(fs.readFileSync(path.join(PUB, 'css', 'paleta.css'), 'utf8'), /danger/);
});
