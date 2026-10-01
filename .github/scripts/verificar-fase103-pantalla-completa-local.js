// verificar-fase103-pantalla-completa-local.js — QA de un solo uso, Fase 103.
//
// InCo pidio que el dashboard de cliente (#gd-modal) se vea a pantalla
// completa en vez de ventana flotante. Recorrido EN LOCAL
// (http://localhost:3000, con `npm run seed:demo`), Playwright directo
// desde Node (nunca la extension de Claude in Chrome, ver CLAUDE.md):
//
//  - Los 3 clientes con dashboard sembrado (ORLANT, CLINICA AURORA,
//    HOSPITAL LA MARIA), en 1366x768 / 1920x1080 / 2560x1440 / movil 412,
//    claro/oscuro -- confirma que #gd-modal cubre el viewport (sin
//    max-width), sin scroll horizontal, sin texto sospechoso.
//  - Capturas de pantalla (datos de demo, nunca reales) en
//    docs/capturas-demo/fase103-pantalla-completa/.
//  - El boton de pantalla completa del navegador: entrar, salir con Esc,
//    salir con el boton, y que Exportar/MES sigan funcionando adentro.
//  - Captura "despues" de 2 modales que NO debian cambiar (Calidad,
//    Cargar Datos) -- la comparacion "antes" se hace aparte (ver el
//    reporte de la fase), reusando este mismo script contra el CSS viejo.
//
// Solo lectura sobre la app: no crea/edita/borra datos de negocio.
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.APP_URL || 'http://localhost:3000';
const CRED_FILE = path.join(__dirname, '..', '..', 'server', 'data', 'seed-demo-credenciales.txt');
const OUT_DIR = process.env.OUT_DIR || path.join(__dirname, '..', '..', 'docs', 'capturas-demo', 'fase103-pantalla-completa');

const VIEWPORTS = [
  { name: '1366x768', width: 1366, height: 768 },
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: '2560x1440', width: 2560, height: 1440 },
  { name: 'movil-412', width: 412, height: 915 },
];
const TEMAS = ['light', 'dark'];
const CLIENTES = ['ORLANT', 'CLINICA AURORA', 'HOSPITAL LA MARIA'];
const TEXTO_SOSPECHOSO = /\bNaN\b|\bundefined\b|\[object Object\]/;

function leerCredenciales() {
  const texto = fs.readFileSync(CRED_FILE, 'utf8');
  const creds = {};
  texto.split('\n').forEach((linea) => {
    const m = linea.match(/^(\w+)\s+user:\s*(\S+)\s+password:\s*(\S+)/);
    if (m) creds[m[1]] = { user: m[2], password: m[3] };
  });
  return creds;
}

function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-'); }

async function login(page, user, password) {
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.fill('#username', user);
  await page.fill('#password', password);
  await page.click('button.btn-login');
  await page.waitForTimeout(1000);
}

async function aplicarTema(page, tema) {
  await page.evaluate((t) => { if (typeof aplicarTema === 'function') aplicarTema(t); }, tema);
  await page.waitForTimeout(250);
}

async function medirModal(page) {
  return page.evaluate(() => {
    const m = document.getElementById('gd-modal');
    const r = m.getBoundingClientRect();
    const cs = getComputedStyle(m);
    return {
      top: r.top, left: r.left, width: r.width, height: r.height,
      vw: window.innerWidth, vh: window.innerHeight,
      borderRadius: cs.borderRadius,
    };
  });
}

async function hayScrollHorizontal(page) {
  return page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
}

async function textoSospechoso(page) {
  const texto = await page.evaluate(() => (document.getElementById('gd-panels') || {}).innerText || '');
  return TEXTO_SOSPECHOSO.test(texto);
}

(async () => {
  const creds = leerCredenciales();
  if (!creds.ADMIN) { console.error('Falta ADMIN en las credenciales de demo.'); process.exit(1); }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const hallazgos = [];
  const consola = [];
  let ctx = 'arranque';

  try {
    const page = await browser.newPage({ viewport: VIEWPORTS[0] });
    page.on('pageerror', (e) => consola.push({ ctx, tipo: 'pageerror', msg: e.message }));
    page.on('console', (m) => { if (m.type() === 'error' && !/favicon/i.test(m.text())) consola.push({ ctx, tipo: 'console.error', msg: m.text() }); });
    page.on('requestfailed', (r) => consola.push({ ctx, tipo: 'request-failed', url: r.url() }));

    ctx = 'login';
    await login(page, creds.ADMIN.user, creds.ADMIN.password);

    // ── Dashboard de cliente a pantalla completa, por cliente/viewport/tema ──
    for (const cliente of CLIENTES) {
      for (const vp of VIEWPORTS) {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        for (const tema of TEMAS) {
          ctx = `${cliente} / ${vp.name} / ${tema}`;
          await aplicarTema(page, tema);
          await page.evaluate((c) => openGenericDashboard(c), cliente);
          await page.waitForTimeout(1300);

          const medida = await medirModal(page);
          const cubreAncho = Math.abs(medida.width - medida.vw) <= 1;
          const cubreAlto = Math.abs(medida.height - medida.vh) <= 2; // dvh vs vh puede variar 1-2px
          if (!cubreAncho || !cubreAlto || medida.top !== 0 || medida.left !== 0) {
            hallazgos.push({ tipo: 'modal-no-cubre-viewport', ctx, medida });
          }
          if (medida.borderRadius !== '0px') {
            hallazgos.push({ tipo: 'border-radius-no-cero', ctx, borderRadius: medida.borderRadius });
          }
          if (await hayScrollHorizontal(page)) hallazgos.push({ tipo: 'scroll-horizontal', ctx });
          if (await textoSospechoso(page)) hallazgos.push({ tipo: 'texto-sospechoso', ctx });

          // ORLANT: una captura por resolucion x tema (las 4 resoluciones
          // pedidas, claro Y oscuro) mas una por cada pestana visible en
          // claro/1920 -- suficiente para revisar visualmente sin generar
          // cientos de archivos. Los otros 2 clientes: solo 1920/movil en
          // claro (ya cubiertos arriba por las verificaciones automaticas
          // en las 4 resoluciones x 2 temas, aunque no se guarde la imagen).
          if (cliente === 'ORLANT') {
            await page.screenshot({ path: path.join(OUT_DIR, `${slug(cliente)}-${vp.name}-${tema}.png`), fullPage: false });
            if (tema === 'light' && vp.name === '1920x1080') {
              const nTabs = await page.locator('#gd-tabs .atab').count();
              for (let i = 0; i < nTabs; i++) {
                const tab = page.locator('#gd-tabs .atab').nth(i);
                const label = (await tab.textContent() || '').trim();
                await tab.click();
                await page.waitForTimeout(900);
                await page.screenshot({ path: path.join(OUT_DIR, `${slug(cliente)}-tab-${slug(label)}-${vp.name}-${tema}.png`), fullPage: false });
              }
            }
          } else if (tema === 'light' && (vp.name === '1920x1080' || vp.name === 'movil-412')) {
            await page.screenshot({ path: path.join(OUT_DIR, `${slug(cliente)}-${vp.name}-${tema}.png`), fullPage: false });
          }

          await page.evaluate(() => { if (typeof closeGenericDashboard === 'function') closeGenericDashboard(); });
        }
      }
    }
    await page.setViewportSize({ width: 1920, height: 1080 });
    await aplicarTema(page, 'light');

    // ── Boton de pantalla completa del navegador ────────────────────────
    ctx = 'pantalla completa del navegador';
    await page.evaluate(() => openGenericDashboard('ORLANT'));
    await page.waitForTimeout(1200);
    const btnVisible = await page.locator('#gd-fullscreen-btn').isVisible().catch(() => false);
    if (!btnVisible) {
      hallazgos.push({ tipo: 'boton-fullscreen-no-visible', ctx, nota: 'Chromium headless deberia soportar la Fullscreen API -- revisar' });
    } else {
      await page.locator('#gd-fullscreen-btn').click();
      await page.waitForTimeout(500);
      let activo = await page.evaluate(() => !!document.fullscreenElement);
      if (!activo) hallazgos.push({ tipo: 'fullscreen-no-activo-tras-clic', ctx });

      // Exportar y el selector de MES deben seguir funcionando adentro.
      const mesOpciones = await page.locator('#gd-mes-sel option').count();
      if (mesOpciones < 1) hallazgos.push({ tipo: 'mes-sin-opciones-en-fullscreen', ctx });
      try {
        const [descarga] = await Promise.all([
          page.waitForEvent('download', { timeout: 8000 }),
          (async () => {
            await page.locator('#gd-export-btn').click();
            await page.waitForTimeout(250);
            await page.locator('#gd-export-menu button', { hasText: 'Excel' }).click();
          })(),
        ]);
        if (!(await descarga.path())) hallazgos.push({ tipo: 'exportar-no-descargo-en-fullscreen', ctx });
      } catch (e) {
        hallazgos.push({ tipo: 'exportar-fallo-en-fullscreen', ctx, error: e.message });
      }

      // Simula lo que hace el NAVEGADOR cuando el usuario presiona Esc:
      // llama exitFullscreen() el solo, sin pasar por ningun boton de la
      // app. page.keyboard.press('Escape') NO sirve para probar esto --
      // Esc-sale-de-fullscreen lo intercepta el proceso de chrome del
      // navegador antes de que le llegue a la pagina, asi que Playwright no
      // puede simular ese atajo via CDP; lo que SI hay que confirmar es que
      // el listener de la app (_gdOnFullscreenChange) reacciona bien
      // cuando el navegador sale por su cuenta, sea por Esc o por cualquier
      // otro motivo -- eso es exactamente lo que dispara exitFullscreen().
      await page.evaluate(() => document.exitFullscreen());
      await page.waitForTimeout(500);
      activo = await page.evaluate(() => !!document.fullscreenElement);
      if (activo) hallazgos.push({ tipo: 'exitFullscreen-no-salio', ctx });
      const iconoTrasSalir = await page.locator('#gd-fullscreen-btn').innerHTML();
      if (/🗗/.test(iconoTrasSalir)) hallazgos.push({ tipo: 'icono-no-volvio-tras-salir', ctx });

      // Entrar de nuevo y salir con el MISMO boton (no solo con Esc).
      await page.locator('#gd-fullscreen-btn').click();
      await page.waitForTimeout(500);
      await page.locator('#gd-fullscreen-btn').click();
      await page.waitForTimeout(500);
      activo = await page.evaluate(() => !!document.fullscreenElement);
      if (activo) hallazgos.push({ tipo: 'boton-no-sale-de-fullscreen', ctx });
    }
    await page.evaluate(() => { if (typeof closeGenericDashboard === 'function') closeGenericDashboard(); });

    // ── Otros modales (deben verse EXACTAMENTE igual que antes) ─────────
    ctx = 'modal Calidad (no deberia cambiar)';
    await page.evaluate(() => openCalidad());
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(OUT_DIR, 'despues-calidad-modal.png'), fullPage: false });
    const medidaCal = await page.evaluate(() => {
      const m = document.getElementById('calidad-modal');
      const r = m.getBoundingClientRect();
      return { width: r.width, borderRadius: getComputedStyle(m).borderRadius };
    });
    if (medidaCal.borderRadius === '0px') hallazgos.push({ tipo: 'calidad-modal-cambio-border-radius', ctx, medidaCal });
    await page.evaluate(() => closeCalidad());
    await page.waitForTimeout(300);

    ctx = 'modal Cargar Datos (no deberia cambiar)';
    await page.evaluate(() => openCargas());
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(OUT_DIR, 'despues-cargas-modal.png'), fullPage: false });
    const medidaCargas = await page.evaluate(() => {
      const m = document.getElementById('cargas-modal');
      const r = m.getBoundingClientRect();
      return { width: r.width, borderRadius: getComputedStyle(m).borderRadius };
    });
    if (medidaCargas.borderRadius === '0px') hallazgos.push({ tipo: 'cargas-modal-cambio-border-radius', ctx, medidaCargas });
    await page.evaluate(() => closeCargas());

    await page.close();
  } catch (e) {
    hallazgos.push({ tipo: 'fallo-general', ctx, error: e.message });
  } finally {
    await browser.close();
  }

  const todosLosHallazgos = hallazgos.concat(consola.map((c) => ({ tipo: 'consola/' + c.tipo, ctx: c.ctx, detalle: c.msg || c.url })));
  console.log('=== RESULTADO FINAL ===');
  console.log(JSON.stringify({ total: todosLosHallazgos.length, hallazgos: todosLosHallazgos }, null, 2));
  process.exit(todosLosHallazgos.length === 0 ? 0 : 1);
})();
