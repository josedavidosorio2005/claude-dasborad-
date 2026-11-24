// faseGH1-talento-humano.test.js — Fase GH1 (pedido de Edwin, reunión 23/11/2026): «Talento humano»,
// la app de Gestión humana de Edwin dentro de SinCo (docs/gestion-humana/plan.md).
// Prueba guardiana de lo GENERADO por scripts/gestion-humana/generar-talento-humano.js: sin datos de
// prueba, sin SheetJS embebido, sin su «inicio», con el «⌂ Menú principal» que vuelve a SinCo.
// No lee el HTML original de Edwin (vive fuera del repo; su inventario trae datos reales).
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PUB = path.join(__dirname, '..', '..', 'public');
const leer = (...p) => fs.readFileSync(path.join(PUB, ...p), 'utf8');
const app = leer('gestion-humana', 'talento-humano-app.js');
const pagina = leer('gestion-humana', 'talento-humano.html');
const hoja = leer('gestion-humana', 'talento-humano.css');

test('la app generada: sin datos de prueba ni botones para cargarlos', () => {
  new vm.Script(app); // sintaxis válida
  assert.match(app, /^\/\/ talento-humano-app\.js — GENERADO por scripts\/gestion-humana\/generar-talento-humano\.js/);
  assert.match(app, /function demoData\(\)\{return \[\]\}/);
  assert.match(app, /function demoVN\(\)\{return \{V:\[\],N:\[\]\}\}/);
  assert.match(app, /function ausDemo\(\)\{return \[\]\}/);
  assert.match(app, /function impDemo\(\)\{\}/);
  assert.doesNotMatch(app, /DATOS DE EJEMPLO|let seed=7|demo:true/);
  assert.doesNotMatch(app, /onclick="ausCargarDemo\(\)"/);
  assert.doesNotMatch(app, /Cargar datos de prueba/);
});

test('la app generada: sin datos con forma de persona (cédulas, celulares, correos)', () => {
  for (const t of [app, pagina, hoja]) {
    assert.equal((t.match(/['"`]\d{7,10}['"`]/g) || []).length, 0, 'cédulas');
    assert.equal((t.match(/\b3\d{9}\b/g) || []).length, 0, 'celulares');
    assert.equal((t.match(/[\w.+-]+@[\w-]+\.(?:com|co|net|org)\b/gi) || []).length, 0, 'correos');
  }
});

test('la página: SheetJS de SinCo, sin el de Edwin, sin su «inicio» ni el aviso de vista previa', () => {
  assert.ok(pagina.includes('<script src="../js/vendor/xlsx-0.20.3.full.min.js"></script>'));
  assert.ok(fs.existsSync(path.join(PUB, 'js', 'vendor', 'xlsx-0.20.3.full.min.js')));
  assert.ok(pagina.includes('<script src="talento-humano-api.js"></script>'), 'GH2: el adaptador carga la app');
  assert.ok(pagina.includes('<link rel="stylesheet" href="talento-humano.css">'));
  for (const t of [app, pagina]) {
    assert.doesNotMatch(t, /make_xlsx_lib|SheetJS -- http/, 'sin SheetJS embebido');
    assert.doesNotMatch(t, /No se puede descargar en la vista previa|inconexion_app/, 'sin el inicio ni la vista previa de Edwin');
  }
  assert.doesNotMatch(pagina, /<script>/, 'sin scripts en línea');
  assert.ok(pagina.includes('<button class="home-btn" onclick="volverMenu()"'), 'su botón «⌂ Menú principal» sigue');
  assert.match(hoja, /^:root\{\n  color-scheme:dark;/, 'su hoja tal cual (tema oscuro de Edwin)');
});

test('«⌂ Menú principal» cierra la ventana de SinCo (talentoHumanoCerrar del padre)', () => {
  const llamadas = [];
  const padre = { talentoHumanoCerrar: () => llamadas.push('cerrar') };
  const win = { parent: padre };
  const src = app.slice(app.indexOf('window.volverMenu'), app.indexOf('};', app.indexOf('window.volverMenu')) + 2);
  vm.runInNewContext(src, { window: win });
  win.volverMenu();
  assert.deepEqual(llamadas, ['cerrar']);
  const solo = { parent: null }; solo.parent = solo; // abierta sola (sin SinCo): no falla
  vm.runInNewContext(src, { window: solo });
  solo.volverMenu();
});

test('SinCo: tarjeta solo para el administrador; ventana de módulo; se cierra al salir y con «Ver como»', () => {
  const L = require('../../public/js/dashboards-logic.js');
  const t = L.dashTarjetasEntrada('ADMIN', true, false).find((x) => x.key === 'talento');
  assert.deepEqual(t, { key: 'talento', label: 'Talento humano', sub: 'Empleados, ausentismos y vacaciones', icon: 'i-contact', accion: 'talentoHumanoAbrir' });
  for (const r of ['GESTION_HUMANA', 'SISTEMAS', 'GERENCIA', 'AUX_ADMIN', 'SUPERVISOR', 'REPORTES', 'CALIDAD', 'CLIENTES_DASH']) {
    assert.ok(!L.dashTarjetasEntrada(r, false, true).some((x) => x.key === 'talento'), r);
  }
  assert.ok(leer('img', 'iconos', 'lucide.svg').includes('<symbol id="i-contact"'));
  const { talentoHumanoUrl } = require('../../public/js/talento-humano.js');
  assert.equal(talentoHumanoUrl(''), 'gestion-humana/talento-humano.html');
  assert.equal(talentoHumanoUrl('123 4'), 'gestion-humana/talento-humano.html?v=123%204');
  const index = leer('index.html');
  assert.ok(index.includes('<iframe id="th-frame" class="th-frame" title="Talento humano"></iframe>'));
  assert.ok(index.includes('<script src="js/talento-humano.js"></script>'));
  assert.ok(!index.includes('Se guarda en la plataforma'), 'pedido de Edwin 24/11: el encabezado ya no lo dice');
  assert.ok(leer('js', 'cerrar-ventanas.js').includes("'th-overlay': 'talentoHumanoCerrar', // Fase GH1"));
  assert.ok(leer('js', 'motion-helpers.js').includes("'activos-overlay', 'th-overlay']"));
});

test('el HTML original de Edwin nunca va al repo', () => {
  const gi = fs.readFileSync(path.join(__dirname, '..', '..', '.gitignore'), 'utf8');
  assert.ok(gi.split(/\r?\n/).includes('docs/gestion-humana/Plataforma_InConexion.html'));
});
