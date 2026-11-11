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

// La prueba del telefono paso a fase343 (el telefono volvio) y la prueba por rol del servidor a fase342
// (la principal se habilita sola).
