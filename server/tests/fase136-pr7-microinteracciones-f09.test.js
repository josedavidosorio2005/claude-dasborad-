// fase136-pr7-microinteracciones-f09.test.js — Fase 136 (PR 7). F09
// (estados vacios inconsistentes, Fase 135): 2 doughnuts (mis-
// resultados.js, portal Asesor; calidad.js, Reportes de Calidad del
// admin) con los 3 valores en 0 no dibujaban ningun sector -- quedaban
// en blanco sin avisar, a diferencia del resto de la plataforma.
// Microinteracciones: "Guardado" (ya existia, solo se tokenizo la
// duracion) y "cambio de tema" (giro del icono, SOLO en el clic real
// del usuario, nunca en una llamada programatica a aplicarTema()).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { request, app } = require('./helpers');

async function css() { const r = await request(app).get('/css/styles.css'); assert.equal(r.status, 200); return r.text; }
async function js(f) { const r = await request(app).get('/js/' + f); assert.equal(r.status, 200); return r.text; }

test('mis-resultados.js: el doughnut de clasificacion muestra "Sin datos" en vez de un hueco en blanco cuando no hay monitoreos', async () => {
  const texto = await js('mis-resultados.js');
  assert.match(texto, /function mrMostrarSinDatosOCanvas\(/);
  assert.match(texto, /mrMostrarSinDatosOCanvas\('mr-ch-clasif', total > 0, 'Distribucion de Clasificacion'\)/);
  assert.match(texto, /if \(total > 0\) \{\s*mrmk\('mr-ch-clasif'/);
});

test('calidad.js: el doughnut de Reportes de Calidad (admin) tiene el mismo aviso', async () => {
  const texto = await js('calidad.js');
  assert.match(texto, /function ccMostrarSinDatosOCanvas\(/);
  assert.match(texto, /ccMostrarSinDatosOCanvas\('cch-clasificacion', arr\.length > 0, 'Distribucion de Clasificacion'\)/);
  assert.match(texto, /if \(arr\.length > 0\) \{\s*ccmk\('cch-clasificacion'/);
});

test('.save-flash ("Guardado"): transicion tokenizada con --dur-medium/--ease-out', async () => {
  const texto = await css();
  const m = texto.match(/^\.save-flash\{([^}]*)\}/m);
  assert.ok(m);
  assert.match(m[1], /transition:\s*opacity var\(--dur-medium\) var\(--ease-out\)/);
});

test('cambio de tema: el giro del icono (.theme-spin) se agrega SOLO en toggleTema() (clic real), nunca dentro de aplicarTema() (tambien se llama programaticamente al cargar la pagina)', async () => {
  const texto = await js('theme.js');
  const bloqueToggle = texto.match(/function toggleTema\(\)\{([\s\S]*?)\n\}/)[1];
  const bloqueAplicar = texto.match(/function aplicarTema\(t\)\{([\s\S]*?)\n\}/)[1];
  assert.match(bloqueToggle, /theme-spin/);
  assert.ok(!/theme-spin/.test(bloqueAplicar), 'aplicarTema() no deberia agregar la clase de giro -- se llama tambien al restaurar el tema guardado al cargar la pagina, eso no es un clic del usuario');
});

test('.theme-toggle.theme-spin: solo transform (GPU), 200ms, mismos tokens de movimiento', async () => {
  const texto = await css();
  const m = texto.match(/^\.theme-toggle\{([^}]*)\}/m);
  assert.match(m[1], /transition:\s*transform var\(--dur-medium\) var\(--ease-out\)/);
  const spin = texto.match(/^\.theme-toggle\.theme-spin\{([^}]*)\}/m);
  assert.match(spin[1], /transform:\s*rotate\(180deg\)/);
});
