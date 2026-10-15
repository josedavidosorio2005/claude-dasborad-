// fase144-a7-etiquetas-toast.test.js — Fase 144 (A7), hallazgos D12 y D13 de
// la Fase 143: cada campo tiene nombre accesible (<label for>, etiqueta que
// lo envuelve o aria-label cuando no hay texto visible) y el aviso (toast) se
// anuncia: role="status" aria-live="polite", y role="alert" si es un error.
// Pruebas estaticas sobre el HTML y los JS que arman los filtros; sin datos.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { toastEsError, toastAtributos } = require('../../public/js/toast-logic.js');

const PUB = path.join(__dirname, '..', '..', 'public');
const leer = (rel) => fs.readFileSync(path.join(PUB, rel), 'utf8');
const html = leer('index.html');
const jsDeVistas = fs.readdirSync(path.join(PUB, 'js'))
  .filter((f) => f.endsWith('.js') && !f.endsWith('-logic.js'))
  .map((f) => ({ f, src: leer('js/' + f) }));

// Controles (input/select/textarea) sin nombre accesible. Los comentarios
// (lineas que empiezan con // o *) se ignoran: ahi se nombran etiquetas
// sueltas como "<select>" al explicar el codigo.
function controlesSinNombre(nombre, src) {
  const limpio = src.split('\n').map((l) => (/^\s*(\/\/|\*)/.test(l) ? '' : l)).join('\n');
  const fors = new Set([...limpio.matchAll(/<label[^>]*\bfor="([^"]+)"/g)].map((m) => m[1]));
  const malos = [];
  for (const m of limpio.matchAll(/<(input|select|textarea)\b([^>]*)>/g)) {
    const a = m[2];
    if (/type=\\?["'](hidden|file|submit|button)/.test(a)) continue;
    if (/aria-label(ledby)?=/.test(a)) continue;
    const id = (a.match(/\bid="([^"]+)"/) || [])[1];
    if (id && fors.has(id)) continue;
    const antes = limpio.slice(Math.max(0, m.index - 300), m.index);
    if (antes.lastIndexOf('<label') > antes.lastIndexOf('</label>')) continue; // la etiqueta lo envuelve
    malos.push(nombre + ':' + limpio.slice(0, m.index).split('\n').length + ' ' + m[0].slice(0, 80));
  }
  return malos;
}

test('D13: ningun campo de index.html queda sin nombre accesible', () => {
  assert.deepEqual(controlesSinNombre('index.html', html), []);
});

test('D13: ningun campo que arman los JS de las vistas queda sin nombre accesible', () => {
  const malos = jsDeVistas.flatMap(({ f, src }) => controlesSinNombre(f, src));
  assert.deepEqual(malos, []);
});

test('D13: cada for= de index.html apunta a un id que existe una sola vez', () => {
  const ids = {};
  for (const m of html.matchAll(/\bid="([^"]+)"/g)) ids[m[1]] = (ids[m[1]] || 0) + 1;
  for (const m of html.matchAll(/<label[^>]*\bfor="([^"]+)"/g)) assert.equal(ids[m[1]], 1, m[1]);
});

test('D13: los campos que la Fase 143 encontro sin etiqueta ahora la tienen', () => {
  for (const id of ['username', 'password', 'gd-mes-sel', 'carga-cliente', 'carga-periodo']) {
    assert.match(html, new RegExp('<label for="' + id + '"'), id);
  }
  const js = Object.fromEntries(jsDeVistas.map(({ f, src }) => [f, src]));
  const esperados = {
    'trafico.js': ["tv-f-desde-'+i+'", "tv-f-hasta-'+i+'", "tv-f-gran-'+i+'", "'+prefijo+'-f-skill-'+i+'"],
    'trafico-whatsapp.js': ["tww-f-desde-'+i+'", "tww-f-hasta-'+i+'", "tww-f-gran-'+i+'"],
    'tipificacion.js': ["tipif-f-mes-'+i+'", "tipif-f-desde-'+i+'", "tipif-f-hasta-'+i+'", "tipif-f-agente-'+i+'-'+c.canal+'"],
    'agendas.js': ["agendas-f-mes-'+i+'", "agendas-f-desde-'+i+'", "agendas-f-hasta-'+i+'", "agendas-f-asesor-'+i+'", "agendas-f-sede-'+i+'"],
    'whatsapp-tiempos.js': ["wtt-f-mes-' + i + '", "wtt-f-skill-' + i + '"],
    'llamadas-unicas.js': ["lu-f-desde-' + i + '", "lu-f-hasta-' + i + '", "ls-f-desde-' + i + '"],
  };
  for (const [f, ids] of Object.entries(esperados)) {
    for (const id of ids) assert.ok(js[f].includes('<label for="' + id + '"'), f + ' ' + id);
  }
  // "Comparar varias lineas" no tiene etiqueta visible propia: aria-label.
  assert.match(js['trafico.js'], /-f-skills-cmp-'\+i\+'" aria-label="Comparar varias '\+esc\(etiquetaPlural\)\+' especificas"/);
  // Buscadores sin etiqueta visible: aria-label y la lupa decorativa oculta.
  assert.match(html, /id="user-search" aria-label="Buscar usuarios"/);
  assert.doesNotMatch(html, /<span style="color:var\(--c-text-muted\)">&#128269;<\/span>/);
});

test('D13: los textos visibles de las etiquetas no cambian (solo se agrega for=)', () => {
  assert.match(html, /<label for="username">Usuario<\/label>/);
  assert.match(html, /<label for="password">Contraseña<\/label>/); // Fase 145: con ñ
  assert.match(html, /<label for="gd-mes-sel" style="[^"]*">MES:<\/label>/);
});

test('D12: toastEsError reconoce errores por tipo o por el texto de siempre', () => {
  assert.equal(toastEsError('Guardado'), false);
  assert.equal(toastEsError('Carga guardada: 3 hojas'), false);
  assert.equal(toastEsError('No se pudo guardar la carga'), true);
  assert.equal(toastEsError('No se pudieron cargar las plantillas'), true);
  assert.equal(toastEsError('Error de red'), true);
  assert.equal(toastEsError('Errores: ninguno', 'ok'), false);
  assert.equal(toastEsError('Sesion expirada', 'error'), true);
  assert.equal(toastEsError(null), false);
  assert.deepEqual(toastAtributos('Guardado'), { role: 'status', 'aria-live': 'polite' });
  assert.deepEqual(toastAtributos('x', 'error'), { role: 'alert', 'aria-live': 'assertive' });
});

test('D12: #toast arranca como status polite y toast-logic.js carga antes de ui-core.js', () => {
  assert.match(html, /<div class="toast" id="toast" role="status" aria-live="polite" aria-atomic="true"><\/div>/);
  const a = html.indexOf('<script src="js/toast-logic.js"></script>');
  const b = html.indexOf('<script src="js/ui-core.js"></script>');
  assert.ok(a > 0 && a < b);
});

test('D12: showToast pone role/aria-live segun el aviso y conserva el texto y la clase show', () => {
  const src = leer('js/ui-core.js');
  const fn = src.match(/function showToast\(msg, tipo\)\{[\s\S]*?\n\}/)[0];
  const attrs = {};
  const t = { textContent: '', setAttribute: (k, v) => { attrs[k] = v; }, classList: { add() {}, remove() {} } };
  const ctx = { document: { getElementById: () => t }, toastAtributos, setTimeout: () => 0, clearTimeout() {} };
  vm.runInNewContext(fn + '; showToast("No se pudo exportar"); r1 = JSON.stringify(attrs); showToast("Guardado");', Object.assign(ctx, { attrs }));
  assert.deepEqual(JSON.parse(ctx.r1), { role: "alert", "aria-live": "assertive" });
  assert.deepEqual(attrs, { role: 'status', 'aria-live': 'polite' });
  assert.equal(t.textContent, 'Guardado');
});

test('D12: los catch que muestran e.message / res.error marcan el aviso como error', () => {
  for (const { f, src } of jsDeVistas) {
    assert.doesNotMatch(src, /showToast\((e\.message|res\.error|v\.error)\)/, f);
  }
});
