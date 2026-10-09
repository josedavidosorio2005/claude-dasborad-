// fase136-pr6-transiciones-chartjs.test.js — Fase 136 (PR 6). Transicion
// de entrada al cambiar de pestana/sub-pestana real (switchGenericTab/
// switchGenericSubtab) -- NUNCA en cambios de filtro (mes/comparar/
// vista) ni en el refresco de tema, que tambien llaman a
// renderGenericTab() pero son mas frecuentes (Paso 4 de la auditoria:
// "nada que retrase ver un numero"). Chart.js con configuracion central
// de animacion (F03), respetando prefers-reduced-motion/data-motion=
// "off" (Chart.js dibuja en <canvas>, fuera del alcance de la regla CSS
// global).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { request, app } = require('./helpers');

async function css() {
  const res = (await request(app).get('/css/styles.css'));
  assert.equal(res.status, 200);
  return res.text;
}
async function js(archivo) {
  const res = await request(app).get('/js/' + archivo);
  assert.equal(res.status, 200);
  return res.text;
}

test('#gd-panels: estado base invisible + .motion-show lo revela, solo opacity/transform (GPU)', async () => {
  const texto = await css();
  const base = texto.match(/^#gd-panels\{([^}]*)\}/m);
  const show = texto.match(/^#gd-panels\.motion-show\{([^}]*)\}/m);
  assert.ok(base && show);
  assert.match(base[1], /opacity:\s*0/);
  assert.match(show[1], /opacity:\s*1/);
  assert.match(base[1], /transition:\s*opacity var\(--dur-medium\) var\(--ease-out\),transform var\(--dur-medium\) var\(--ease-out\)/);
});

test('switchGenericTab y switchGenericSubtab llaman a motionEnter -- las demas llamadas a renderGenericTab (mes/comparar/vista/tema) NO', async () => {
  const texto = await js('dashboard-generic.js');
  const bloqueTab = texto.match(/function switchGenericTab\(key\)\{([\s\S]*?)\n\}/)[1];
  const bloqueSubtab = texto.match(/function switchGenericSubtab\(key\)\{([\s\S]*?)\n\}/)[1];
  assert.match(bloqueTab, /motionEnter\(document\.getElementById\('gd-panels'\)\)/);
  assert.match(bloqueSubtab, /motionEnter\(document\.getElementById\('gd-panels'\)\)/);

  ['onGdMesChange', 'onGdCompChange', 'onGdVistaChange', '_gdIrAMes'].forEach((fn) => {
    const m = texto.match(new RegExp('function ' + fn + '\\([^)]*\\)\\{([\\s\\S]*?)\\n\\}'));
    assert.ok(m, fn + ' deberia existir');
    assert.ok(!/motionEnter/.test(m[1]), fn + ' es un cambio de filtro, no de pestana -- no deberia animar (Paso 4 de la auditoria: "nada que retrase ver un numero")');
  });

  const themeJs = await js('theme.js');
  const bloqueRefresco = themeJs.match(/function refrescarGraficasTema\(\)\{([\s\S]*?)\n\}/)[1];
  assert.ok(!/motionEnter/.test(bloqueRefresco), 'el refresco de graficas al cambiar de tema no deberia re-disparar el fade del panel');
});

test('motionEnter se llama con progressive enhancement (typeof === function) -- la app no se rompe si motion-helpers.js no cargo', async () => {
  const texto = await js('dashboard-generic.js');
  const ocurrencias = texto.match(/if \(typeof motionEnter === 'function'\) motionEnter\(/g) || [];
  assert.equal(ocurrencias.length, 2, 'deberian ser exactamente 2 llamadas protegidas (switchGenericTab + switchGenericSubtab)');
});

test('Chart.js: configuracion central de animacion (F03), antes 0 modulos la configuraban', async () => {
  const texto = await js('charts.js');
  assert.match(texto, /Chart\.defaults\.animation\.duration = _reducirMovimiento \? 0 : 200/);
  assert.match(texto, /data-motion.*===.*off/);
  assert.match(texto, /prefers-reduced-motion: reduce/);
});
