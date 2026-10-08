// tests/fase132-marca-inconexion.test.js — Fase 132 (marca InConexion®:
// logo, colores oficiales, tipografia Quicksand).
//
// Estos tests fallan SIN el cambio de esta fase: comprueban que index.html
// referencia un favicon real (no el default del navegador), que los logos
// nuevos existen como archivo servible, que la fuente autoalojada esta
// declarada (nunca Google Fonts en runtime) y que ningun archivo ORIGINAL
// de marca (resolucion de impresion, miles de px) termino copiado dentro
// de public/ por error.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { request, app } = require('./helpers');

const PUBLIC_DIR = path.join(__dirname, '..', '..', 'public');

test('index.html declara favicon real (.ico + PNG) y apple-touch-icon, con sizes', async () => {
  const res = await request(app).get('/');
  assert.equal(res.status, 200);
  assert.match(res.text, /<link rel="icon" href="favicon\.ico" sizes="any">/);
  assert.match(res.text, /<link rel="icon" type="image\/png" sizes="32x32" href="favicon-32\.png">/);
  assert.match(res.text, /<link rel="apple-touch-icon" sizes="180x180" href="favicon-180\.png">/);
});

test('todos los archivos de favicon referenciados existen y los sirve el estatico', async () => {
  for (const f of ['favicon.ico', 'favicon-32.png', 'favicon-180.png', 'favicon-192.png']) {
    assert.ok(fs.existsSync(path.join(PUBLIC_DIR, f)), `falta public/${f}`);
    const res = await request(app).get('/' + f);
    assert.equal(res.status, 200, `GET /${f} deberia dar 200`);
  }
});

test('login, navbar (admin/user/asesor/supervisor) y pantalla de bienvenida referencian img/marca/, no las imagenes viejas', async () => {
  const res = await request(app).get('/');
  assert.ok(!/img\/logo-inconexion\.png/.test(res.text), 'quedo una referencia al logo viejo (img/logo-inconexion.png)');
  assert.ok(!/img\/navbar-icon\.png/.test(res.text), 'quedo una referencia al icono viejo (img/navbar-icon.png)');

  const imgsMarca = [...res.text.matchAll(/(?:src|srcset)="(img\/marca\/[^"\s]+)/g)].map((m) => m[1]);
  assert.ok(imgsMarca.length >= 4, 'se esperaban varias referencias a img/marca/ (login, navbar, bienvenida)');

  // Cada archivo de marca referenciado existe de verdad y lo sirve el estatico.
  const unicos = [...new Set(imgsMarca)];
  for (const rel of unicos) {
    assert.ok(fs.existsSync(path.join(PUBLIC_DIR, rel)), `falta public/${rel}`);
    const r = await request(app).get('/' + rel);
    assert.equal(r.status, 200, `GET /${rel} deberia dar 200`);
  }
});

test('las 4 paginas con navbar (admin/user/asesor/supervisor) traen el isotipo de marca', async () => {
  const res = await request(app).get('/');
  const matches = res.text.match(/class="navbar-logo-icon"/g) || [];
  assert.equal(matches.length, 4, 'se esperaban 4 navbars con el isotipo de marca (admin, user, asesor, supervisor)');
});

test('el logo del login tiene version clara y oscura, con el mismo ancho/alto (sin salto de layout)', async () => {
  const res = await request(app).get('/');
  const claro = res.text.match(/<img class="login-logo logo-light"[^>]*width="(\d+)"[^>]*height="(\d+)"/);
  const oscuro = res.text.match(/<img class="login-logo logo-dark"[^>]*width="(\d+)"[^>]*height="(\d+)"/);
  assert.ok(claro, 'no se encontro el logo claro del login');
  assert.ok(oscuro, 'no se encontro el logo oscuro del login');
  assert.equal(claro[1], oscuro[1], 'el logo claro y oscuro deberian declarar el mismo ancho');
  assert.equal(claro[2], oscuro[2], 'el logo claro y oscuro deberian declarar el mismo alto');
});

test('la fuente Quicksand esta autoalojada (public/fonts/), nunca se carga desde Google Fonts', async () => {
  const res = await request(app).get('/');
  assert.ok(!/fonts\.googleapis\.com/.test(res.text), 'no deberia haber ninguna referencia a Google Fonts en runtime');

  const cssPath = path.join(PUBLIC_DIR, 'css', 'styles.css');
  const css = fs.readFileSync(cssPath, 'utf8');
  assert.ok(!/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(css), 'no deberia haber ninguna referencia a Google Fonts en el CSS');
  assert.match(css, /@font-face\{font-family:'Quicksand'/, 'falta la declaracion @font-face de Quicksand');
  assert.match(css, /--font-sans:'Quicksand'/, '--font-sans deberia empezar por Quicksand');

  for (const peso of ['400', '500', '600', '700']) {
    const archivo = `quicksand-latin-${peso}.woff2`;
    assert.ok(fs.existsSync(path.join(PUBLIC_DIR, 'fonts', archivo)), `falta public/fonts/${archivo}`);
    assert.match(css, new RegExp(`font-weight:${peso}[^}]*url\\('\\.\\./fonts/${archivo}'\\)`), `falta el @font-face de peso ${peso}`);
  }
  assert.ok(fs.existsSync(path.join(PUBLIC_DIR, 'fonts', 'LICENSE-quicksand.txt')), 'falta la licencia OFL de Quicksand');
});

test('ningun archivo original de marca (miles de px, el que llega del diseñador) quedo copiado dentro de public/', async () => {
  // Los originales son ~4013x3848 (isotipo) y ~6469x1295 (logo horizontal);
  // las versiones optimizadas de esta fase no deberian pasar de 1200px de
  // ancho (el @2x mas grande que se genera) ni pesar mas de 150KB cada una.
  const marcaDir = path.join(PUBLIC_DIR, 'img', 'marca');
  assert.ok(fs.existsSync(marcaDir), 'falta public/img/marca/');
  const archivos = fs.readdirSync(marcaDir).filter((f) => f.endsWith('.png'));
  assert.ok(archivos.length > 0, 'public/img/marca/ esta vacio');
  for (const f of archivos) {
    const stat = fs.statSync(path.join(marcaDir, f));
    assert.ok(stat.size < 150 * 1024, `public/img/marca/${f} pesa ${(stat.size / 1024).toFixed(0)}KB -- demasiado para una version web optimizada (¿se copio el original?)`);
  }
});

test('las fuentes autoalojadas en conjunto no superan ~100KB (presupuesto de rendimiento)', () => {
  const fontsDir = path.join(PUBLIC_DIR, 'fonts');
  const total = ['400', '500', '600', '700']
    .map((p) => fs.statSync(path.join(fontsDir, `quicksand-latin-${p}.woff2`)).size)
    .reduce((a, b) => a + b, 0);
  assert.ok(total < 100 * 1024, `las 4 fuentes pesan ${(total / 1024).toFixed(1)}KB en total, por encima del presupuesto de 100KB`);
});

test('el verde de "Ultima actualizacion" usa el token de marca --c-brand-green (no un literal suelto)', () => {
  const css = fs.readFileSync(path.join(PUBLIC_DIR, 'css', 'styles.css'), 'utf8');
  assert.match(css, /--c-brand-green:#74B859/i, 'falta el token --c-brand-green con el verde oficial');
  assert.match(css, /\.gd-ultima-act\{[^}]*border-left:3px solid var\(--c-brand-green\)/, '.gd-ultima-act deberia usar var(--c-brand-green), no el hex suelto');
});

test('--c-brand es el teal oficial de marca (#004150)', () => {
  const css = fs.readFileSync(path.join(PUBLIC_DIR, 'css', 'styles.css'), 'utf8');
  assert.match(css, /--c-brand:#004150;/i);
});
