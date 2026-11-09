// fase307-calidad-orlant-aurora.test.js — Fase 307 (pedido del supervisor, 10/11):
// Calidad de ORLANT y de Clinica Aurora como la de Mobilize, para que los lideres
// evaluen. ORLANT conserva lo que ya mostraba y suma «Resultado de los monitoreos»
// al final (decision del usuario); Aurora ya lo tenia (Fase 262) y su pestaña se
// destapa sola con el primer monitoreo. Mismo componente y mismo backend que
// Mobilize. Datos SINTETICOS.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');
const dbMod = require('../db');
const G = require('../../public/js/graficas-lineas-logic.js');
const { generarLayout, PERFILES_ACTUALES } = require('../plantillas-cliente');

const AURORA = 'CLINICA AURORA';
const H = (t) => ({ Authorization: 'Bearer ' + t });
const hoy = new Date().toISOString().slice(0, 10);
const layoutDe = (c) => JSON.parse(db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get(c).layout);
const calidadDe = (c) => layoutDe(c).tabs.find((t) => t.key === 'calidad');
const monitoreo = (campana) => ({ campana, asesor: 'Asesor Ficticio', fecha: hoy, canal: 'LLAMADA', observaciones: 'Observacion ficticia', answers: campana === AURORA ? { 1: 'SI', 2: 'SI', 3: 'NO', 4: 'N/A' } : { 1: 'SI', 3: 'NO' } }); // Aurora (plantilla nueva): monitoreo completo
let admin, supOrl, supAur, calAur, cliOrl, cliAur, asesor;

function crear(user, rol, perms) {
  db.prepare(`INSERT INTO users (nombre, user, rol, active, password_hash, perms, createdAt, debe_cambiar_password) VALUES (?,?,?,1,?,?,?,0)`)
    .run('Persona ' + user, user, rol, bcrypt.hashSync('Clave#2026x', 4), JSON.stringify(perms), new Date().toISOString());
  return tokenFor(user, 'Clave#2026x');
}
before(async () => {
  admin = await tokenFor('admin', MASTER_PASSWORD);
  supOrl = await crear('f307_sup_orl', 'SUPERVISOR', { campana_ORLANT: true });
  supAur = await crear('f307_sup_aur', 'SUPERVISOR', { ['campana_' + AURORA]: true });
  calAur = await crear('f307_cal_aur', 'CALIDAD', { ['campana_' + AURORA]: true });
  cliOrl = await crear('f307_cli_orl', 'CLIENTES_DASH', { ClientesDash: true, cliente_ORLANT: true });
  cliAur = await crear('f307_cli_aur', 'CLIENTES_DASH', { ClientesDash: true, ['cliente_' + AURORA]: true });
  asesor = await crear('f307_ase', 'ASESOR', { campana_ORLANT: true });
  // Plantilla SINTETICA de Aurora (en produccion la real se importo aparte; nunca va al repo).
  const r = await request(app).post('/api/calidad/plantillas/importar').set(H(admin)).send({ confirmar: true, principal: true, archivo: {
    formato: 'inconexion-plantilla-calidad', version: 1, nombre: 'Aurora sintetica 307', campana: AURORA, motor: 'standard',
    campos: ['asesor', 'fecha', 'idLlamada', 'telefono', 'codificacion', 'evaluador', 'observaciones'],
    items: [1, 2, 3, 4].map((n) => ({ n, categoria: 'Cat', nombre: 'Item ficticio ' + n, peso: 25, critico: n === 1, descripcion: 'Criterio ficticio' })) } });
  assert.equal(r.status, 201, JSON.stringify(r.body));
});

test('ORLANT: Calidad conserva sus 3 paneles y suma «Resultado de los monitoreos» al final; el resto de ORLANT igual a su foto', () => {
  assert.deepEqual(calidadDe('ORLANT').panels, [
    { tipo: 'calidad_kpis', campana: 'ORLANT' },
    { tipo: 'calidad_pie', campana: 'ORLANT', titulo: 'Distribución de clasificación' },
    { tipo: 'calidad_bar_asesores', campana: 'ORLANT', titulo: 'Promedio de calidad por asesor' },
    { tipo: 'calidad_monitoreos_panel', campana: 'ORLANT' },
  ]);
  assert.ok(!calidadDe('ORLANT').oculta);
  assert.equal(JSON.stringify(layoutDe('ORLANT')), JSON.stringify(generarLayout(PERFILES_ACTUALES.ORLANT).layout), 'ORLANT = su plantilla');
});

test('migracion: idempotente, solo ORLANT; una Calidad de forma distinta se deja intacta', () => {
  const todos = () => JSON.stringify(db.prepare('SELECT cliente, layout FROM dashboards_config ORDER BY cliente').all());
  const antes = todos();
  dbMod.orlantCalidadMonitoreos();
  assert.equal(todos(), antes, 'segunda corrida: nada cambia');
  // Forma distinta (sin indicadores ni torta): no se toca.
  const orig = layoutDe('ORLANT');
  const otra = JSON.parse(JSON.stringify(orig));
  otra.tabs.find((t) => t.key === 'calidad').panels = [{ tipo: 'otro_panel', campana: 'ORLANT' }];
  db.prepare('UPDATE dashboards_config SET layout = ? WHERE cliente = ?').run(JSON.stringify(otra), 'ORLANT');
  dbMod.orlantCalidadMonitoreos();
  assert.deepEqual(calidadDe('ORLANT').panels, [{ tipo: 'otro_panel', campana: 'ORLANT' }]);
  db.prepare('UPDATE dashboards_config SET layout = ? WHERE cliente = ?').run(JSON.stringify(orig), 'ORLANT');
  // Mobilize, Aurora y HLM: la misma Calidad de antes (solo monitoreos); SURA sin ese panel.
  assert.deepEqual(calidadDe('MOBILIZE').panels, [{ tipo: 'calidad_monitoreos_panel', campana: 'MOBILIZE' }]);
  for (const c of [AURORA, 'HOSPITAL LA MARIA']) {
    assert.deepEqual(calidadDe(c).panels, [{ tipo: 'calidad_monitoreos_panel', campana: c }], c);
    assert.equal(calidadDe(c).oculta, true, c + ': se destapa sola con el primer monitoreo');
  }
});

test('Aurora: Calidad antes de Errores (Errores siempre de ultima)', () => {
  const tabs = layoutDe(AURORA).tabs.map((t) => Object.assign({}, t, { oculta: false }));
  const orden = G.pestanasOrdenCliente(tabs, AURORA).map((t) => t.key);
  assert.equal(orden[orden.length - 1], 'errores');
  assert.equal(orden[orden.length - 2], 'calidad');
});

test('permisos como Mobilize: el lider (SUPERVISOR/CALIDAD) de la campaña evalua; de otra campaña, cliente o asesor -> 403', async () => {
  const post = (t, c) => request(app).post('/api/monitoreos').set(H(t)).send(monitoreo(c));
  { const r0 = await post(supOrl, 'ORLANT'); assert.equal(r0.status, 201, JSON.stringify(r0.body)); }
  { const r1 = await post(supAur, AURORA); assert.equal(r1.status, 201, JSON.stringify(r1.body)); }
  assert.equal((await post(calAur, AURORA)).status, 201, 'calidad de Aurora');
  assert.equal((await post(supAur, 'ORLANT')).status, 403, 'lider de Aurora no evalua ORLANT');
  assert.equal((await post(supOrl, AURORA)).status, 403, 'lider de ORLANT no evalua Aurora');
  for (const t of [cliOrl, cliAur, asesor]) assert.equal((await post(t, 'ORLANT')).status, 403);
  // Cada campaña usa SU plantilla principal.
  const pl = (c) => db.prepare('SELECT p.campana FROM monitoreos m JOIN calidad_plantillas p ON p.id = m.plantillaId WHERE m.campana = ? ORDER BY m.id DESC LIMIT 1').get(c);
  const sinId = db.prepare("SELECT COUNT(*) n FROM monitoreos WHERE campana IN ('ORLANT', ?) AND plantillaId IS NULL").get(AURORA).n;
  if (!sinId) { assert.equal(pl('ORLANT').campana, 'ORLANT'); assert.equal(pl(AURORA).campana, AURORA); }
});

test('cliente: ve lo mismo que en Mobilize (sin evaluador, observaciones ni telefono)', async () => {
  for (const [t, c] of [[cliOrl, 'ORLANT'], [cliAur, AURORA]]) {
    const r = await request(app).get('/api/monitoreos?campana=' + encodeURIComponent(c)).set(H(t));
    assert.equal(r.status, 200, c);
    assert.ok(r.body.length >= 1, c);
    for (const m of r.body) {
      assert.ok(!m.evaluador, c + ': sin evaluador');
      assert.ok(!m.observaciones, c + ': sin observaciones');
      assert.ok(!m.telefono, c + ': sin telefono');
    }
  }
  assert.equal((await request(app).get('/api/monitoreos?campana=ORLANT').set(H(cliAur))).status, 403, 'cliente de Aurora no ve ORLANT');
});

test('pantalla: en ORLANT «Resultado de los monitoreos» va DESPUES de la rejilla (torta y barras); sin rejilla, donde siempre', () => {
  const js = require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'public', 'js', 'dashboard-generic.js'), 'utf8');
  assert.match(js, /if\(p\.tipo === 'calidad_monitoreos_panel' && tieneRejilla\)\{[^\n]*htmlAlFinal \+=/);
  assert.ok(js.indexOf('html += htmlAlFinal;') > js.indexOf("html += '<div class=\"aurora-grid-2\">'"), 'se agrega despues de la rejilla');
});
