// fase340-un-solo-formulario.test.js — Fase 340 (critico, 11/11): un SUPERVISOR sin la plantilla de SURA
// marcada (acceso por plantilla, Fase 237) llegaba al formulario VIEJO de Calificar (armado con la plantilla
// principal). Ahora hay un solo formulario (el comun); sin plantilla habilitada sale un aviso claro, y el
// telefono no existe en ningun formulario ni se guarda en un monitoreo nuevo. Datos SINTETICOS.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');

const H = (t) => ({ Authorization: 'Bearer ' + t });
const PUB = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'public', f), 'utf8');
const hoy = new Date().toISOString().slice(0, 10);
let admin;
before(async () => { admin = await tokenFor('admin', MASTER_PASSWORD); });

function formularioCon({ usables, todas, campana }) {
  const el = { innerHTML: '', hidden: true };
  const ctx = { console, esc: (x) => String(x), document: { getElementById: (id) => (id === 'cf2' ? el : null), addEventListener() {}, querySelectorAll: () => [] },
    _ccampana: campana, CAL_PLANTILLAS_TODAS: todas, _calPlantillaDe: () => null, calPlantillasUsables: () => usables, calPlantillaSelectorHtml: () => '' };
  vm.createContext(ctx);
  vm.runInContext(PUB('js/calidad-calificar-logic.js'), ctx);
  vm.runInContext(PUB('js/calidad-calificar.js'), ctx);
  ctx.cc2Render = () => { el.innerHTML = 'FORMULARIO COMUN'; };
  return { r: ctx.cc2Sync(), el };
}

test('sin plantilla habilitada: aviso claro (nunca el formulario viejo); con plantilla: el formulario comun', () => {
  const sura = { id: 13, campana: 'SURA', nombre: 'Televentas SURA', principal: true, activo: true, engine: 'descuento', campos: [{ k: 'asesor' }, { k: 'fecha' }], usable: false };
  const sin = formularioCon({ usables: [], todas: [sura], campana: 'SURA' });
  assert.equal(sin.r, false);
  assert.equal(sin.el.hidden, false);
  assert.match(sin.el.innerHTML, /no tiene habilitada la plantilla «Televentas SURA» para calificar en SURA/);
  const con = formularioCon({ usables: [Object.assign({}, sura, { usable: true })], todas: [sura], campana: 'SURA' });
  assert.equal(con.r, true);
  assert.equal(con.el.innerHTML, 'FORMULARIO COMUN');
  // Plantilla sin campos propios (ORLANT u otra): tambien el comun, con campos genericos.
  const sinCampos = { id: 1, campana: 'OTRA', nombre: 'Generica', principal: true, activo: true, engine: 'standard', campos: null, usable: true };
  assert.equal(formularioCon({ usables: [sinCampos], todas: [sinCampos], campana: 'OTRA' }).r, true);
});

test('el formulario viejo ya no existe: ni su HTML ni su codigo de guardado', () => {
  const html = PUB('index.html');
  assert.ok(!html.includes('id="cf-viejo"') && !html.includes('id="cf-telefono"') && !html.includes('submitMonitoreo()'));
  assert.ok(!html.includes('Se registra automáticamente con la fecha de hoy'));
  assert.ok(html.includes('<div id="cf2"></div>'));
  const cal = PUB('js/calidad.js');
  assert.ok(!cal.includes('async function submitMonitoreo(') && !cal.includes("getElementById('cf-item-"));
  assert.ok(cal.includes("function renderCalItemsForm(){ if(typeof cc2Sync==='function') cc2Sync(); }"));
  const cc2 = PUB('js/calidad-calificar.js');
  assert.ok(cc2.includes("if (calCanEvaluate()) switchCalTab('nuevo'); else cc2MostrarPanel();"), 'Reportes llega al formulario al editar');
});

test('regla «sin telefono»: ningun formulario lo pide y el servidor no lo guarda en uno nuevo ni al editar', async () => {
  const L = require('../../public/js/calidad-calificar-logic.js');
  assert.ok(!L.cc2CamposDe({ campana: 'ORLANT', campos: null }).some((c) => c.k === 'telefono'));
  assert.ok(!L.cc2CamposDe({ campana: 'X', campos: [{ k: 'telefono' }, { k: 'asesor' }] }).some((c) => c.k === 'telefono'));
  const c = await request(app).post('/api/monitoreos').set(H(admin)).send({ campana: 'MOBILIZE', asesor: 'Asesor Ficticio', fecha: hoy, canal: 'LLAMADA', answers: { 1: 'SI' }, telefono: '3000000340' });
  assert.equal(c.status, 201, JSON.stringify(c.body));
  assert.equal(db.prepare('SELECT telefono FROM monitoreos WHERE id = ?').get(c.body.id).telefono, null);
  db.prepare("UPDATE monitoreos SET telefono = '3000000341' WHERE id = ?").run(c.body.id); // uno viejo que si lo tenia
  const e = await request(app).put('/api/monitoreos/' + c.body.id).set(H(admin)).send({ telefono: '3009999999', observaciones: 'Edicion ficticia' });
  assert.equal(e.status, 200, JSON.stringify(e.body));
  assert.equal(db.prepare('SELECT telefono FROM monitoreos WHERE id = ?').get(c.body.id).telefono, '3000000341', 'lo ya guardado no se toca ni se cambia');
});

test('por rol (servidor): el SUPERVISOR sin la plantilla marcada no califica con ella; marcada, si', async () => {
  const mk = async (user, perms) => {
    const r = await request(app).post('/api/users').set(H(admin)).send({ nombre: 'Persona Ficticia ' + user, user, password: 'Clave#Fase340x', rol: 'SUPERVISOR', perms });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    return tokenFor(user, 'Clave#Fase340x');
  };
  const principal = db.prepare("SELECT id FROM calidad_plantillas WHERE campana = 'MOBILIZE' AND principal = 1").get().id;
  const otra = db.prepare("SELECT id FROM calidad_plantillas WHERE campana = 'ORLANT' AND principal = 1").get().id;
  const sinMarca = await mk('sup340a', { Calidad: true, campana_MOBILIZE: true, ['plantilla_' + otra]: true });
  const conMarca = await mk('sup340b', { Calidad: true, campana_MOBILIZE: true, ['plantilla_' + principal]: true });
  const body = { campana: 'MOBILIZE', asesor: 'Asesor Ficticio', fecha: hoy, canal: 'LLAMADA', answers: { 1: 'SI' } };
  assert.equal((await request(app).post('/api/monitoreos').set(H(sinMarca)).send(body)).status, 403, 'sin la plantilla marcada, el servidor no deja');
  assert.equal((await request(app).post('/api/monitoreos').set(H(conMarca)).send(body)).status, 201);
  const pls = (await request(app).get('/api/calidad/plantillas/todas').set(H(sinMarca))).body.filter((p) => p.campana === 'MOBILIZE');
  assert.ok(pls.length && pls.every((p) => p.usable === false), 'por eso el navegador no tenia plantilla usable y caia al formulario viejo');
});
