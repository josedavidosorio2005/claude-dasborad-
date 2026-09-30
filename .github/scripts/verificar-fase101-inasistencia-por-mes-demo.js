// verificar-fase101-inasistencia-por-mes-demo.js — Fase 101. Verificacion
// EN LOCAL (http://localhost:3000, con npm run seed:demo) de la nueva vista
// PRINCIPAL "Por mes" de Inasistencia de ORLANT: sin filtro de especialidad
// (todas juntas), grafica "Citas vs. inasistencias por mes" (barras +
// linea de % ponderado en eje secundario) y el aviso de mes incompleto
// (el seed de demo ya siembra el mes en curso con una sola especialidad,
// ver seedInasistenciaOrlant en scripts/seed-demo-lib/dashboards.js).
//
// Playwright DIRECTO desde Node (regla fija del proyecto, CLAUDE.md) -- NO
// la extension de Claude in Chrome. Solo datos de demo (seed-demo).
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.LOCAL_URL || 'http://localhost:3000';
const OUT_DIR = path.join(__dirname, '..', '..', 'docs', 'capturas-demo', 'fase101-inasistencia-por-mes');
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

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT_DIR, name), fullPage: false });
}

const VIEWPORTS = [
  { name: 'escritorio', width: 1440, height: 900 },
  { name: 'celular', width: 375, height: 812 },
];
const TEMAS = ['light', 'dark'];

async function run() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const creds = leerCredenciales();
  const erroresConsola = [];
  const peticionesFallidas = [];
  const hallazgos = [];
  function hallazgo(texto) { hallazgos.push(texto); log('[HALLAZGO]', texto); }

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: VIEWPORTS[0], acceptDownloads: true });
    const page = await context.newPage();
    page.on('pageerror', (e) => erroresConsola.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/favicon/i.test(m.text())) erroresConsola.push('console.error: ' + m.text()); });
    page.on('response', (res) => { if (res.status() >= 400 && !res.url().includes('/favicon')) peticionesFallidas.push(res.status() + ' ' + res.url()); });

    await login(page, creds.ADMIN.user, creds.ADMIN.password);

    // ── Exportar: las 3 sub-pestañas nuevas deben reflejarse -- se llama
    // _gdExportarInasistencia (public/js/dashboard-generic.js) DIRECTO en la
    // pagina para cada panel, sin descargar/parsear el .xlsx (evita agregar
    // una dependencia de Node solo para esta verificacion). ──────────────
    await page.evaluate(() => openGenericDashboard('ORLANT'));
    await page.waitForTimeout(1500);
    await page.evaluate(() => switchGenericTab('inasistencia'));
    await page.waitForTimeout(1500);
    try {
      const hojas = await page.evaluate(async () => {
        var tab = _gd.config.layout.tabs.find(function(t){ return t.key === 'inasistencia'; });
        var out = [];
        for (var i = 0; i < tab.panels.length; i++) {
          var res = await _gdExportarInasistencia(tab.panels[i], i);
          out.push({ vista: tab.panels[i].vista, titulo: res[0].titulo, tipo: res[0].tipo, primeraFila: res[0].filas[0] || null, nFilas: res[0].filas.length });
        }
        return out;
      });
      log('Exportar Inasistencia, 3 paneles:', JSON.stringify(hojas));
      if (hojas.length !== 3) hallazgo(`Exportar: ${hojas.length} panel(es), se esperaban 3`);
      var porMes = hojas.find((h) => h.vista === 'pormes');
      if (!porMes || porMes.tipo !== 'tabla' || !porMes.primeraFila || !('Total de citas' in porMes.primeraFila)) hallazgo('Exportar "Por mes": no trae una tabla con la columna "Total de citas"');
      var porEsp = hojas.find((h) => h.vista === 'porespecialidad');
      if (!porEsp || porEsp.tipo !== 'tabla' || !porEsp.primeraFila || !('Especialidad' in porEsp.primeraFila)) hallazgo('Exportar "Por especialidad": no trae una tabla con la columna "Especialidad"');
      var detalle = hojas.find((h) => h.vista === 'detalle');
      if (!detalle || detalle.tipo !== 'tabla' || !detalle.primeraFila || !('% Inasistencia' in detalle.primeraFila)) hallazgo('Exportar "Detalle": no trae una tabla con la columna "% Inasistencia"');
    } catch (e) {
      hallazgo('Exportar Inasistencia fallo: ' + e.message);
    }
    await page.evaluate(() => closeGenericDashboard());
    await page.waitForTimeout(300);

    for (const vp of VIEWPORTS) {
      for (const tema of TEMAS) {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.evaluate((t) => { if (typeof aplicarTema === 'function') aplicarTema(t); }, tema);
        await page.waitForTimeout(300);

        await page.evaluate(() => openGenericDashboard('ORLANT'));
        await page.waitForTimeout(1500);
        await page.evaluate(() => switchGenericTab('inasistencia'));
        await page.waitForTimeout(1500);

        // ── "Por mes" debe ser la sub-pestaña que abre por defecto ──────
        if (vp.name === 'escritorio' && tema === 'light') {
          // _gd.subtab queda `null` a proposito al abrir una pestaña nueva
          // (dashboard-generic.js: "cada pestaña nueva empieza en su
          // primera sub-pestaña") -- la sub-pestaña realmente activa es la
          // que trae la clase "on" en su boton.
          const subtabActivo = await page.evaluate(() => {
            var btn = document.querySelector('.gd-subtab-btn.on');
            return btn ? btn.dataset.gdsubtab : null;
          });
          if (subtabActivo !== 'pormes') hallazgo(`La sub-pestaña activa por defecto es "${subtabActivo}", se esperaba "pormes"`);

          const estructura = await page.evaluate(() => {
            const tarjetas = document.querySelectorAll('.aurora-kpis .aurora-kpi').length;
            const canvas = !!document.getElementById('inasist-c-pormes-0');
            const filtroEspecialidad = !!document.getElementById('inasist-f-especialidad-0');
            return { tarjetas, canvas, filtroEspecialidad };
          });
          if (estructura.tarjetas !== 6) hallazgo(`"Por mes" trae ${estructura.tarjetas} tarjeta(s), se esperaban 6`);
          if (!estructura.canvas) hallazgo('"Por mes" no dibujo la grafica "Citas vs. inasistencias por mes"');
          if (estructura.filtroEspecialidad) hallazgo('"Por mes" NO deberia tener filtro de especialidad (siempre todas juntas)');

          // El mes en curso (ultimo del seed) solo trae 1 especialidad --
          // debe disparar el aviso de mes incompleto.
          const avisoHtml = await page.evaluate(() => { var el = document.getElementById('inasist-aviso-0'); return el ? el.innerText : ''; });
          if (!avisoHtml || !/solo incluye/i.test(avisoHtml)) hallazgo('No aparecio el aviso de "mes incompleto" (el seed de demo siembra el ultimo mes con una sola especialidad)');
          else log('Aviso de mes incompleto (demo):', avisoHtml.trim());
        }

        await shot(page, `pormes-${vp.name}-${tema}.png`);

        if (vp.name === 'escritorio' && tema === 'light') {
          await page.evaluate(() => switchGenericSubtab('porespecialidad'));
          await page.waitForTimeout(1200);
          const tieneLinea = await page.evaluate(() => !!document.getElementById('inasist-c-mes-1'));
          if (!tieneLinea) hallazgo('"Por especialidad" no trae la linea de tendencia movida desde la vieja "Por mes"');
          await shot(page, `porespecialidad-${vp.name}-${tema}.png`);

          await page.evaluate(() => switchGenericSubtab('detalle'));
          await page.waitForTimeout(1200);
          await shot(page, `detalle-${vp.name}-${tema}.png`);

          await page.evaluate(() => switchGenericSubtab('pormes'));
          await page.waitForTimeout(800);
        }

        await page.evaluate(() => closeGenericDashboard());
        await page.waitForTimeout(300);
      }
    }

    const erroresUnicos = [...new Set(erroresConsola)];
    const peticionesUnicas = [...new Set(peticionesFallidas)];
    if (erroresUnicos.length) hallazgo(`${erroresUnicos.length} error(es) de consola: ${erroresUnicos.join(' | ')}`);
    if (peticionesUnicas.length) hallazgo(`${peticionesUnicas.length} peticion(es) fallida(s): ${peticionesUnicas.join(' | ')}`);

    log('=== RESUMEN ===');
    log('Hallazgos:', hallazgos.length);
    hallazgos.forEach((h) => log('  -', h));
    log('Capturas en:', OUT_DIR);
    if (hallazgos.length) process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
  }
}

run().catch((e) => { console.error('FALLO:', e.message, e.stack); process.exitCode = 1; });
