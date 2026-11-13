// fase349-menu-lateral-aurora-hlm.test.js — Fase 349: el menu lateral de Mobilize (Fase 348 G) se
// extiende a Clinica Aurora y Hospital La Maria. Cada pestaña con su icono propio (tambien las de
// Aurora: Agendas, Inasistencia, Encuestas, Errores); «Gestión líneas internas» sigue como boton
// aparte en el encabezado; ORLANT y SURA no cambian; los iconos de Mobilize, iguales.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const L = require('../../public/js/gd-menu-lateral.js');

const PUB = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'public', f), 'utf8');

// Los nombres de las pestañas de Aurora y HLM tal como los dejan las migraciones y TABS_EXTRA.
const AURORA_HLM = {
  'Tráfico de Llamadas': 'i-phone',
  'Tráfico de WhatsApp': 'i-message-circle',
  'Total tráfico': 'i-gauge',
  'Llamadas y WhatsApp de salida': 'i-contact',
  'Agendas': 'i-target',
  'Tipificación': 'i-layout-dashboard',
  'Inasistencia': 'i-ban',
  'Encuestas': 'i-message-circle',
  'Errores': 'i-triangle-alert',
  'Calidad': 'i-circle-check',
};

test('349: cada pestaña de Aurora y HLM con su icono del sprite (ninguna con el punto generico)', () => {
  const sprite = PUB('img/iconos/lucide.svg');
  for (const [t, ico] of Object.entries(AURORA_HLM)) {
    assert.equal(L.gdMenuIcono(t), ico, t);
    assert.notEqual(L.gdMenuIcono(t), 'i-punto', t);
    assert.ok(sprite.includes('id="' + ico + '"'), ico + ' existe en el sprite');
  }
  assert.notEqual(L.gdMenuIcono('Agendas'), L.gdMenuIcono('Inasistencia'), 'Agendas e Inasistencia se distinguen');
});

test('349: las pestañas de Aurora salen de la configuracion real (nombres de TABS_EXTRA y de las migraciones)', () => {
  const srv = ['plantillas-cliente.js', 'db.js'].map((f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8')).join('\n');
  for (const t of ['Agendas', 'Inasistencia', 'Encuestas', 'Errores', 'Total tráfico', 'Gestión líneas internas']) assert.ok(srv.includes("label: '" + t + "'"), t);
});

test('349: «Gestión líneas internas» sigue como boton aparte del encabezado, no entra al menu', () => {
  const html = PUB('index.html');
  const i = html.indexOf('<div id="gd-modal">');
  const cab = html.slice(i, html.indexOf('<div class="aurora-kpis" id="gd-kpis">', i));
  assert.match(cab, /id="gd-li-wrap"/, 'dentro del encabezado del tablero');
  const gd = PUB('js/dashboard-generic.js');
  assert.ok(gd.includes("var GD_TABS_BOTON_APARTE = ['lineas_internas'];"));
  assert.ok(gd.includes('_gdTabsVisibles().filter(function(t){ return GD_TABS_BOTON_APARTE.indexOf(t.key) === -1; })'), 'el menu se arma con las pestañas visibles para quien mira, sin las de boton aparte');
});
