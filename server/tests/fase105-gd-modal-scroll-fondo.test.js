// fase105-gd-modal-scroll-fondo.test.js — Fase 105 (hallazgo real durante
// la verificacion final en produccion de la Fase 104, nunca visto en
// headless): en un Chrome real, si la pagina de FONDO (detras de
// #gd-overlay, nunca visible mientras el modal esta abierto) tenia su
// propia barra de scroll vertical, el navegador reservaba su ancho al
// calcular el tamano de #gd-modal (a pantalla completa desde la Fase 103)
// -- quedaba sistematicamente ~15px mas angosto que el viewport real, en
// las 3 resoluciones x 2 temas probadas (confirmado tambien en local,
// reproducible siempre que hay un Chrome real de por medio, headless o no
// nunca lo mostraba). Bloquear el scroll de html/body mientras el modal
// esta abierto (estandar para un modal a pantalla completa -- nada detras
// deberia poder scrollear de todos modos) elimina esa barra de raiz.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { request, app } = require('./helpers');

async function js() {
  const res = await request(app).get('/js/dashboard-generic.js');
  assert.equal(res.status, 200);
  return res.text;
}

test('_gdBloquearScrollFondo: existe y alterna overflow:hidden en html Y body', async () => {
  const texto = await js();
  const m = texto.match(/function _gdBloquearScrollFondo\(bloquear\)\{([^}]*)\}/);
  assert.ok(m, 'deberia existir la funcion _gdBloquearScrollFondo');
  assert.match(m[1], /document\.documentElement\.style\.overflow\s*=\s*bloquear\s*\?\s*'hidden'\s*:\s*''/);
  assert.match(m[1], /document\.body\.style\.overflow\s*=\s*bloquear\s*\?\s*'hidden'\s*:\s*''/);
});

test('openGenericDashboard y openGenericDashboardPreview bloquean el scroll de fondo al abrir', async () => {
  const texto = await js();
  const abreReal = texto.match(/async function openGenericDashboard\(cliente\)\{([^]*?)\n\}/);
  const abrePreview = texto.match(/async function openGenericDashboardPreview\(config\)\{([^]*?)\n\}/);
  assert.ok(abreReal, 'deberia existir openGenericDashboard');
  assert.ok(abrePreview, 'deberia existir openGenericDashboardPreview');
  assert.match(abreReal[1], /_gdBloquearScrollFondo\(true\)/, 'openGenericDashboard deberia bloquear el scroll de fondo');
  assert.match(abrePreview[1], /_gdBloquearScrollFondo\(true\)/, 'openGenericDashboardPreview deberia bloquear el scroll de fondo');
});

test('closeGenericDashboard restaura el scroll de fondo al cerrar', async () => {
  const texto = await js();
  const cierre = texto.match(/function closeGenericDashboard\(\)\{([^]*?)\n\}/);
  assert.ok(cierre, 'deberia existir closeGenericDashboard');
  assert.match(cierre[1], /_gdBloquearScrollFondo\(false\)/, 'closeGenericDashboard deberia restaurar el scroll de fondo');
});
