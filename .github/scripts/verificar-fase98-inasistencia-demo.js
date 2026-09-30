// verificar-fase98-inasistencia-demo.js — Fase 98 (ORLANT, pedido URGENTE de
// Edwin). Verificacion visual EN LOCAL (http://localhost:3000, con
// npm run seed:demo) de la pestaña nueva "Inasistencia": las 3 sub-pestañas
// (Por especialidad, Por mes, Detalle), el aviso de "menos especialidades
// que el mes anterior" (Sep-26 del demo solo trae Examenes Especiales),
// escritorio y movil, 0 errores de consola.
//
// Playwright DIRECTO desde Node (regla fija del proyecto, CLAUDE.md) -- NO
// la extension de Claude in Chrome. Solo datos de demo (seed-demo), nunca
// datos reales. Credenciales de demo, leidas de
// server/data/seed-demo-credenciales.txt (gitignored, nunca en el comando
// ni en el historial de shell).
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.LOCAL_URL || 'http://localhost:3000';
const OUT_DIR = path.join(__dirname, '..', '..', 'docs', 'capturas-demo', 'fase98-inasistencia');
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

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT_DIR, name), fullPage: false });
}

async function login(page, user, password) {
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.fill('#username', user);
  await page.fill('#password', password);
  await page.click('.btn-login');
  await page.waitForFunction(() => typeof authToken !== 'undefined' && !!authToken, { timeout: 10000 });
  await page.waitForTimeout(600);
}

async function run(viewport, suffix) {
  const erroresConsola = [];
  const peticionesFallidas = [];
  let browser;
  const creds = leerCredenciales();
  const reporte = { viewport: suffix };

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    page.on('pageerror', (e) => erroresConsola.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/favicon/i.test(m.text())) erroresConsola.push('console.error: ' + m.text()); });
    page.on('response', (res) => { if (res.status() >= 400) peticionesFallidas.push(res.status() + ' ' + res.url()); });
    page.on('requestfailed', (req) => peticionesFallidas.push('FAILED ' + req.url()));

    await login(page, creds.ADMIN.user, creds.ADMIN.password);
    await page.evaluate(() => openGenericDashboard('ORLANT'));
    await page.waitForTimeout(1500);

    // Agendas/Tipificacion no se siembran en el demo local (seed-demo-lib no
    // inserta en esas tablas, solo Inasistencia -- ver PROGRESS.md Fase 98):
    // sus pestañas NUNCA se destapan aqui, asi que el orden se confirma
    // contra TODAS las pestañas configuradas (`_gd.config.layout.tabs`), no
    // solo las visibles.
    const tabsInfo = await page.evaluate(() => ({
      tabsVisibles: _gdTabsVisibles().map((t) => t.key),
      tabsTodas: _gd.config.layout.tabs.map((t) => t.key),
      tabActiva: _gd.tab,
    }));
    reporte.orden = tabsInfo;
    log('[' + suffix + '] pestañas visibles:', JSON.stringify(tabsInfo));

    const tieneInasistencia = tabsInfo.tabsVisibles.indexOf('inasistencia') !== -1;
    reporte.tabDestapada = tieneInasistencia;
    if (!tieneInasistencia) throw new Error('La pestaña Inasistencia no se destapo (sin datos de demo?)');

    await page.evaluate(() => switchGenericTab('inasistencia'));
    await page.waitForTimeout(1200);

    // Numeros de control (demo, seed-demo-lib/dashboards.js): agosto trae
    // AUDIFONOS/AUDIOLOGIA/EXAMENES ESPECIALES (TOTAL siempre cuadra
    // cancelada+inasistencia+pendiente+atendidas), septiembre SOLO
    // EXAMENES ESPECIALES.
    const controlNumeros = await page.evaluate(async () => {
      const ago = await apiRequest('GET', '/calidad/inasistencia/especialidad?campana=ORLANT&mes=2026-08');
      const sep = await apiRequest('GET', '/calidad/inasistencia/especialidad?campana=ORLANT&mes=2026-09');
      const sumaCuadra = (r) => r.cancelada + r.inasistencia + r.pendiente + r.atendidas === r.total;
      return {
        agostoEspecialidades: ago.map((r) => r.especialidad).sort(),
        agostoTodasCuadran: ago.every(sumaCuadra),
        septiembreEspecialidades: sep.map((r) => r.especialidad),
      };
    });
    reporte.controlNumeros = controlNumeros;
    log('[' + suffix + '] numeros de control:', JSON.stringify(controlNumeros));

    // "Por especialidad" en Ago-26 (mes con las 3 especialidades) -- tarjetas + 2 graficas.
    await page.evaluate(() => { if (typeof _gdIrAMes === 'function') _gdIrAMes('2026-08'); });
    await page.waitForTimeout(1200);
    await page.evaluate(() => switchGenericSubtab('porespecialidad'));
    await page.waitForTimeout(1200);
    const tarjetas = await page.evaluate(() => Array.from(document.querySelectorAll('.aurora-kpi .kl')).map((el) => el.textContent));
    reporte.tarjetas = tarjetas;
    await shot(page, '1-por-especialidad-ago26-' + suffix + '.png');

    // Tema oscuro (pedido explicito: "escritorio y movil, claro y oscuro") --
    // solo una captura extra, misma vista "Por especialidad".
    await page.evaluate(() => { if (typeof aplicarTema === 'function') aplicarTema('dark'); });
    await page.waitForTimeout(500);
    await shot(page, '1b-por-especialidad-ago26-oscuro-' + suffix + '.png');
    await page.evaluate(() => { if (typeof aplicarTema === 'function') aplicarTema('light'); });
    await page.waitForTimeout(300);

    // "Por mes" -- linea con Total ponderado.
    await page.evaluate(() => switchGenericSubtab('pormes'));
    await page.waitForTimeout(1200);
    await shot(page, '2-por-mes-' + suffix + '.png');

    // "Detalle" -- tabla + fila de total.
    await page.evaluate(() => switchGenericSubtab('detalle'));
    await page.waitForTimeout(1200);
    const filasDetalle = await page.evaluate(() => document.querySelectorAll('#inasist-tabla-2 tr').length);
    reporte.filasDetalleAgo26 = filasDetalle; // encabezado + 3 especialidades + total = 5
    await shot(page, '3-detalle-ago26-' + suffix + '.png');

    // Aviso de "menos especialidades que el mes anterior" en Sep-26 (solo desktop, ahorra tiempo).
    if (suffix === 'desktop') {
      await page.evaluate(() => { if (typeof _gdIrAMes === 'function') _gdIrAMes('2026-09'); });
      await page.waitForTimeout(1200);
      await page.evaluate(() => switchGenericSubtab('porespecialidad'));
      await page.waitForTimeout(1200);
      const avisoTexto = await page.evaluate(() => (document.getElementById('inasist-aviso-0') || {}).textContent || '');
      reporte.avisoMenosEspecialidades = avisoTexto;
      log('[' + suffix + '] aviso Sep-26:', avisoTexto);
      await shot(page, '4-aviso-septiembre-' + suffix + '.png');
    }

    reporte.erroresConsola = erroresConsola;
    reporte.peticionesFallidas = peticionesFallidas;

    const okOrden = tabsInfo.tabsTodas.indexOf('agendamiento') < tabsInfo.tabsTodas.indexOf('inasistencia')
      && tabsInfo.tabsTodas.indexOf('inasistencia') < tabsInfo.tabsTodas.indexOf('tipificacion');
    const okControl = controlNumeros.agostoEspecialidades.length === 3 && controlNumeros.agostoTodasCuadran
      && controlNumeros.septiembreEspecialidades.length === 1 && controlNumeros.septiembreEspecialidades[0] === 'EXAMENES ESPECIALES';
    const okAviso = suffix !== 'desktop' || /solo hay datos de Examenes Especiales|solo hay datos de Exámenes Especiales/i.test(reporte.avisoMenosEspecialidades || '');
    const okConsola = erroresConsola.length === 0 && peticionesFallidas.length === 0;

    log('=== RESULTADO (' + suffix + ') ===');
    log('Orden (Agendamiento -> Inasistencia -> Tipificacion):', okOrden ? 'OK' : 'FALLO');
    log('Numeros de control (Ago-26 x3, Sep-26 x1, TOTAL cuadra):', okControl ? 'OK' : 'FALLO -- ' + JSON.stringify(controlNumeros));
    log('Aviso "menos especialidades" en Sep-26:', okAviso ? 'OK' : 'FALLO -- ' + reporte.avisoMenosEspecialidades);
    log('Consola/peticiones (0 errores):', okConsola ? 'OK' : 'FALLO -- ' + JSON.stringify({ erroresConsola, peticionesFallidas }));

    fs.writeFileSync(path.join(OUT_DIR, 'reporte-' + suffix + '.json'), JSON.stringify(reporte, null, 2));
    return okOrden && okControl && okAviso && okConsola;
  } finally {
    if (browser) await browser.close();
  }
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const okDesktop = await run({ width: 1440, height: 900 }, 'desktop');
  const okMovil = await run({ width: 390, height: 844 }, 'movil');
  log('=== FINAL: desktop=' + okDesktop + ' movil=' + okMovil + ' ===');
  process.exit(okDesktop && okMovil ? 0 : 1);
})();
