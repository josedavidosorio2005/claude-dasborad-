// verificar-fase99-desplegables-demo.js — Fase 99. Verificacion EN LOCAL
// (http://localhost:3000, con npm run seed:demo) del arreglo de contraste
// de <option>/<optgroup> en tema claro y oscuro.
//
// Hallazgo real en produccion (Brave/Windows): el selector MES de arriba
// (y varios otros del encabezado de cada modulo) fuerzan `color:#fff` en
// linea para leerse sobre su encabezado oscuro -- ese blanco se hereda en
// la lista emergente que abre el navegador, que por defecto tiene fondo
// blanco, asi que las opciones quedan en blanco sobre blanco (solo se lee
// la que tiene el mouse encima, resaltada en azul por el navegador).
//
// Playwright no puede fotografiar la lista nativa abierta de un <select>
// (es una ventana del sistema operativo, fuera del DOM renderizado) -- por
// eso esta prueba usa getComputedStyle sobre los <option> (existen en el
// DOM con su estilo ya resuelto, se abra o no la lista) y calcula el
// contraste WCAG entre su `color` y su `background-color` calculados.
// Antes del fix (server/../public/css/styles.css sin la regla
// `option,optgroup{color:...;background-color:...}`), el `background-color`
// calculado de un <option> es transparente (`rgba(0, 0, 0, 0)`, el <option>
// no tiene ninguna regla propia de fondo) -- eso YA es una falla (no hay
// fondo solido que garantice el contraste), asi que la prueba falla en 2
// casos: fondo transparente, o contraste por debajo de 4.5:1.
//
// Playwright DIRECTO desde Node (regla fija del proyecto, CLAUDE.md) -- NO
// la extension de Claude in Chrome. Solo datos de demo (seed-demo).
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.LOCAL_URL || 'http://localhost:3000';
const OUT_DIR = path.join(__dirname, '..', '..', 'docs', 'capturas-demo', 'fase99-desplegables');
const CRED_FILE = path.join(__dirname, '..', '..', 'server', 'data', 'seed-demo-credenciales.txt');

function log(...args) { console.log(new Date().toISOString(), ...args); }

function leerCredenciales() {
  const texto = fs.readFileSync(CRED_FILE, 'utf8');
  const creds = {};
  texto.split('\n').forEach((linea) => {
    const m = linea.match(/^(\w+)\s+user:\s*(\S+)\s+password:\s*(\S+)/);
    if (m) creds[m[1]] = { user: m[2], password: m[3] };
  });
  return creds;
}

async function login(page, user, password) {
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.fill('#username', user);
  await page.fill('#password', password);
  await page.click('.btn-login');
  await page.waitForFunction(() => typeof authToken !== 'undefined' && !!authToken, { timeout: 10000 });
  await page.waitForTimeout(600);
}

// relative luminance + contraste WCAG a partir de "rgb(r,g,b)"/"rgba(r,g,b,a)".
function parseRgb(s) {
  const m = /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+))?\)/.exec(s || '');
  if (!m) return null;
  return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
}
function luminancia({ r, g, b }) {
  const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contraste(rgb1, rgb2) {
  const l1 = luminancia(rgb1), l2 = luminancia(rgb2);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

// Evalua TODOS los <option> de un select (por selector CSS) -- devuelve
// null si el select no existe o no tiene opciones todavia (panel sin
// datos, no es un fallo de este arreglo).
async function evaluarSelect(page, selector, etiqueta, resultados) {
  const datos = await page.$$eval(selector + ' option', (opts) =>
    opts.map((o) => {
      const cs = getComputedStyle(o);
      return { color: cs.color, bg: cs.backgroundColor, texto: o.textContent.trim() };
    })
  ).catch(() => null);
  if (!datos || !datos.length) {
    resultados.push({ selector, etiqueta, ok: null, motivo: 'sin opciones (no se pudo probar)' });
    return;
  }
  for (const o of datos) {
    const color = parseRgb(o.color);
    const bg = parseRgb(o.bg);
    if (!color || !bg || bg.a < 0.99) {
      resultados.push({ selector, etiqueta, ok: false, motivo: `fondo transparente/indefinido (color=${o.color} bg=${o.bg})` });
      continue;
    }
    const ratio = contraste(color, bg);
    resultados.push({ selector, etiqueta, ok: ratio >= 4.5, motivo: `contraste ${ratio.toFixed(2)}:1 (color=${o.color} bg=${o.bg})` });
  }
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT_DIR, name), fullPage: false });
}

async function run(tema) {
  const erroresConsola = [];
  const peticionesFallidas = [];
  let browser;
  const creds = leerCredenciales();
  const resultados = [];

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    page.on('pageerror', (e) => erroresConsola.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/favicon/i.test(m.text())) erroresConsola.push('console.error: ' + m.text()); });
    page.on('response', (res) => { if (res.status() >= 400) peticionesFallidas.push(res.status() + ' ' + res.url()); });

    await login(page, creds.ADMIN.user, creds.ADMIN.password);
    await page.evaluate((t) => { if (typeof aplicarTema === 'function') aplicarTema(t); }, tema);
    await page.waitForTimeout(300);

    // ── 1. Encabezado del dashboard generico (ORLANT) -- el select MES
    // reportado, mas los otros 2 del mismo encabezado (Vista/Comparar). ──
    await page.evaluate(() => openGenericDashboard('ORLANT'));
    await page.waitForTimeout(1500);
    await shot(page, `0-selector-mes-cerrado-orlant-${tema}.png`);
    await evaluarSelect(page, '#gd-mes-sel', 'MES (encabezado, ORLANT) -- el reportado', resultados);
    await evaluarSelect(page, '#gd-vista-sel', 'Vista (encabezado, ORLANT)', resultados);
    await evaluarSelect(page, '#gd-comp-sel', 'Comparar contra (encabezado, ORLANT)', resultados);

    // Filtro de especialidad de Inasistencia (select "plano" DENTRO de un
    // panel, con datos reales de demo -- distinto patron visual al del
    // encabezado, mismo <option> global).
    await page.evaluate(() => switchGenericTab('inasistencia'));
    await page.waitForTimeout(1200);
    await evaluarSelect(page, '#inasist-f-especialidad-0', 'Especialidad (panel Inasistencia)', resultados);

    // Calidad (mismo cliente, header propio).
    await page.evaluate(() => switchGenericTab('calidad'));
    await page.waitForTimeout(1200);
    await evaluarSelect(page, '#gd-f0 select', 'Filtro de Calidad (panel)', resultados);
    await page.evaluate(() => closeGenericDashboard());
    await page.waitForTimeout(300);

    // ── 2. Otro cliente (Clinica Aurora) -- mismo componente generico. ──
    await page.evaluate(() => openGenericDashboard('CLINICA AURORA'));
    await page.waitForTimeout(1500);
    await evaluarSelect(page, '#gd-mes-sel', 'MES (encabezado, CLINICA AURORA)', resultados);
    await page.evaluate(() => closeGenericDashboard());
    await page.waitForTimeout(300);

    // ── 3. Modulo de Calidad independiente (formulario de monitoreo + catalogo). ──
    await page.evaluate(() => openCalidad());
    await page.waitForTimeout(800);
    await evaluarSelect(page, '#cal-campana-sel', 'Campana (encabezado, Calidad)', resultados);
    await page.selectOption('#cal-campana-sel', 'ORLANT').catch(() => {});
    await page.waitForTimeout(500);
    await evaluarSelect(page, '#cal-mes-sel', 'Mes (encabezado, Calidad)', resultados);
    await page.evaluate(() => switchCalTab('nuevo'));
    await page.waitForTimeout(500);
    await evaluarSelect(page, '#cf-asesor', 'Asesor (formulario de monitoreo)', resultados);
    await evaluarSelect(page, '#cf-codificacion-select', 'Codificacion (catalogo, formulario de monitoreo)', resultados);
    await page.evaluate(() => closeCalidad());
    await page.waitForTimeout(300);

    // ── 4. Cargar Datos. ──
    await page.evaluate(() => openCargas());
    await page.waitForTimeout(800);
    await shot(page, `1-select-plano-cargar-datos-cerrado-${tema}.png`);
    await evaluarSelect(page, '#carga-cliente', 'Cliente (Cargar Datos)', resultados);
    await page.evaluate(() => closeCargas());
    await page.waitForTimeout(300);

    // ── 5. Panel admin -- Usuarios (modal Nuevo Usuario), Historial. ──
    await page.evaluate(() => { if (typeof openCreateModal === 'function') openCreateModal(); });
    await page.waitForTimeout(500);
    await evaluarSelect(page, '#mu-rol', 'Rol (Nuevo Usuario, admin)', resultados);
    await page.evaluate(() => { if (typeof closeUserModal === 'function') closeUserModal(); });
    await page.waitForTimeout(300);

    await page.evaluate(() => showSection('hist'));
    await page.waitForTimeout(800);
    await evaluarSelect(page, '#hist-filter', 'Tipo de accion (Historial, admin)', resultados);

    await page.evaluate(() => showSection('inventario'));
    await page.waitForTimeout(800);
    await evaluarSelect(page, '#inv-filtro-cat', 'Categoria (encabezado, Inventario)', resultados);
    await evaluarSelect(page, '#inv-filtro-estado', 'Estado (encabezado, Inventario)', resultados);

    await page.evaluate(() => showSection('gerencia'));
    await page.waitForTimeout(800);
    await evaluarSelect(page, '#ger-periodo-sel', 'Periodo (encabezado, Gerencia)', resultados);

    return { tema, resultados, erroresConsola, peticionesFallidas };
  } finally {
    if (browser) await browser.close();
  }
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const reporteFinal = {};
  let ok = true;
  for (const tema of ['light', 'dark']) {
    const r = await run(tema);
    reporteFinal[tema] = r;
    log(`=== ${tema} ===`);
    for (const res of r.resultados) {
      const marca = res.ok === null ? '·' : res.ok ? 'OK' : 'FALLO';
      log(`  [${marca}] ${res.etiqueta} (${res.selector}): ${res.motivo}`);
      if (res.ok === false) ok = false;
    }
    if (r.erroresConsola.length || r.peticionesFallidas.length) {
      log('  Errores de consola/peticiones:', JSON.stringify({ erroresConsola: r.erroresConsola, peticionesFallidas: r.peticionesFallidas }));
      ok = false;
    }
  }
  fs.writeFileSync(path.join(OUT_DIR, 'reporte-contraste.json'), JSON.stringify(reporteFinal, null, 2));
  log('=== RESULTADO FINAL:', ok ? 'OK (todos los option con contraste >= 4.5:1, 0 errores)' : 'FALLO', '===');
  process.exit(ok ? 0 : 1);
})();
