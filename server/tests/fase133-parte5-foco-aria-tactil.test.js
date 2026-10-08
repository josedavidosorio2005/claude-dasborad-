// fase133-parte5-foco-aria-tactil.test.js — Fase 133 (Parte 5): sin
// degradados decorativos, foco visible con outline:none SIEMPRE
// acompanado de un :focus-visible de reemplazo, nombres accesibles en
// botones solo-icono y graficas, objetivos tactiles en movil.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { request, app } = require('./helpers');

const CSS_PATH = path.join(__dirname, '..', '..', 'public', 'css', 'styles.css');
const css = fs.readFileSync(CSS_PATH, 'utf8');

test('sin degradados decorativos en marca: --grad-brand/--grad-btn ya no son linear-gradient (login/botones)', () => {
  // Alcance = lo que pide el prompt (--grad-brand/--grad-btn, usados en
  // #login-page/.btn-login/.btn-primary) -- OTROS gradientes sin relacion
  // (la barra de meta .qbar-fill, el fondo fijo de #user-page) no son
  // "degradados decorativos de marca" y se quedan como estaban, fuera de
  // alcance de esta parte.
  assert.match(css, /--grad-brand:var\(--c-brand\)/);
  assert.match(css, /--grad-btn:var\(--c-brand\)/);
  const defBrand = css.match(/--grad-brand:[^;]+;/)[0];
  const defBtn = css.match(/--grad-btn:[^;]+;/)[0];
  assert.ok(!/linear-gradient/.test(defBrand));
  assert.ok(!/linear-gradient/.test(defBtn));
});

test('todo outline:none/outline:0 tiene un :focus-visible de reemplazo despues en el archivo', () => {
  // Busca cada regla con outline:none/0 (fuera de un :focus-visible) y
  // confirma que exista un bloque :focus-visible MAS ABAJO en el archivo
  // (la cascada por orden de aparicion es la que realmente lo arregla).
  const reglas = [...css.matchAll(/([^{]+)\{[^}]*outline:\s*(?:none|0)\b[^}]*\}/g)];
  const sinReemplazo = reglas.filter((m) => !/:focus-visible/.test(m[1]));
  assert.ok(sinReemplazo.length > 0, 'se esperaba encontrar al menos una regla real con outline:none (si no, revisar que el test siga vigente)');
  const idxUltimoOutlineNone = Math.max(...sinReemplazo.map((m) => m.index));
  const idxFocusVisible = css.indexOf('a:focus-visible, button:focus-visible');
  assert.ok(idxFocusVisible !== -1, 'deberia existir un bloque global de :focus-visible con outline');
  assert.match(css.slice(idxFocusVisible, idxFocusVisible + 300), /outline:\s*2px solid var\(--c-focus\)/);
  assert.ok(idxFocusVisible > idxUltimoOutlineNone, 'el bloque :focus-visible global deberia venir DESPUES de las reglas outline:none (gana por orden de cascada, misma especificidad)');
});

test('--c-focus pasa AA de componente (>=3:1) contra las superficies principales de cada tema', () => {
  const { contrasteRazon } = require('../../public/js/contraste-logic.js');
  const m = css.match(/--c-focus:var\(--c-primary-mid\)/);
  assert.ok(m, '--c-focus deberia estar definido');
  // --c-primary-mid real de cada tema (medido, no copiado de memoria).
  const claro = css.match(/--c-primary-mid:(#[0-9a-fA-F]{6})/)[1];
  const bloqueOscuro = css.match(/:root\[data-theme="dark"\]\{([\s\S]*?)\n\}/)[1];
  const oscuro = bloqueOscuro.match(/--c-primary-mid:(#[0-9a-fA-F]{6})/)[1];
  assert.ok(contrasteRazon(claro, '#ffffff') >= 3);
  assert.ok(contrasteRazon(claro, '#f0f4f8') >= 3);
  assert.ok(contrasteRazon(oscuro, '#132c35') >= 3);
  assert.ok(contrasteRazon(oscuro, '#0a1e25') >= 3);
});

test('movimiento reducido: existe @media(prefers-reduced-motion: reduce) apagando animaciones/transiciones', () => {
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  const bloque = css.match(/@media \(prefers-reduced-motion: reduce\)\s*\{([\s\S]*?)\n\}/)[1];
  assert.match(bloque, /animation-duration:\s*0\.01ms\s*!important/);
  assert.match(bloque, /transition-duration:\s*0\.01ms\s*!important/);
});

test('objetivos tactiles: >=44px en movil para cerrar/exportar/MES/pestanas, >=24px en escritorio', () => {
  // Ancla en el selector exacto que agrupa a los 44px moviles (unico en el
  // archivo) en vez de recortar por @media(max-width:768px) -- ese mismo
  // breakpoint se reusa en otras reglas no relacionadas mas arriba.
  const idx = css.indexOf('.aurora-close,#gd-mes-sel,#gd-export-btn,.atab,');
  assert.ok(idx !== -1, 'deberia existir el selector de objetivos tactiles de movil');
  const bloqueMovil = css.slice(idx, css.indexOf('}', css.indexOf('{', idx)) + 1);
  assert.match(bloqueMovil, /min-height:44px;min-width:44px/);
  assert.match(css, /button,\.btn-sm,\.atab,\.aurora-close,select,\.theme-toggle,\n\.navbar-menu-toggle,\.navbar-profile-toggle\{min-height:24px;min-width:24px;\}/);
});

test('los 7 botones .btn-eye (mostrar/ocultar contrasena) tienen aria-label', async () => {
  const res = await request(app).get('/');
  const botones = [...res.text.matchAll(/<button class="btn-eye"[^>]*>/g)];
  assert.equal(botones.length, 7, 'se esperaban 7 botones .btn-eye en toda la pagina');
  botones.forEach((b) => assert.match(b[0], /aria-label="/, 'cada boton .btn-eye deberia traer aria-label'));
});

test('ui-core.js: toggleEye actualiza el aria-label segun el estado real (Mostrar/Ocultar)', async () => {
  const res = await request(app).get('/js/ui-core.js');
  assert.equal(res.status, 200);
  const fn = res.text.match(/function toggleEye\(inputId,btn\)\{([\s\S]*?)\n\}/);
  assert.ok(fn);
  assert.match(fn[1], /aria-label','Ocultar contrasena'/);
  assert.match(fn[1], /aria-label','Mostrar contrasena'/);
});

test('charts.js: gdEtiquetarCanvasChart existe y los 3 new Chart(...) la llaman (role="img" + aria-label en cada grafica)', async () => {
  const chartsRes = await request(app).get('/js/charts.js');
  assert.match(chartsRes.text, /function gdEtiquetarCanvasChart\(chartInstance\)/);
  assert.match(chartsRes.text, /setAttribute\('role','img'\)/);
  assert.match(chartsRes.text, /setAttribute\('aria-label'/);

  const sitios = [
    ['/js/dashboard-generic.js', /new Chart\(el, cfg\);\s*\n\s*if\(typeof gdEtiquetarCanvasChart/],
    ['/js/calidad.js', /new Chart\(el,cfg\);\s*\n\s*if\(typeof gdEtiquetarCanvasChart/],
    ['/js/mis-resultados.js', /new Chart\(el,cfg\);\s*\n\s*if\(typeof gdEtiquetarCanvasChart/],
  ];
  for (const [url, re] of sitios) {
    const r = await request(app).get(url);
    assert.equal(r.status, 200);
    assert.match(r.text, re, `${url} deberia llamar a gdEtiquetarCanvasChart justo despues de crear el Chart`);
  }
});

test('ninguna etiqueta de Chart.js (font:{size:N}) queda por debajo de 12px', async () => {
  const archivos = ['charts.js', 'trafico.js', 'calidad.js', 'mis-resultados.js', 'tipificacion.js', 'inasistencia.js', 'agendas.js', 'efectividad-agendamiento.js', 'efectividad-citas.js', 'dashboard-generic.js'];
  for (const f of archivos) {
    const r = await request(app).get('/js/' + f);
    assert.equal(r.status, 200);
    const tamanos = [...r.text.matchAll(/font:\{[^}]*size:(\d+)/g)].map((m) => parseInt(m[1], 10));
    tamanos.forEach((n) => assert.ok(n >= 12, `${f} tiene una etiqueta de grafica de ${n}px, por debajo del piso de 12px`));
  }
});
