// capturas-fase46-menu.js — QA de un solo uso para la Fase 46 (menu lateral
// desplegable en escritorio, ademas del off-canvas que ya existia en
// movil). Captura el sidebar EXPANDIDO/COLAPSADO (escritorio) y
// ABIERTO/CERRADO (movil) en claro/oscuro, contra 2 dashboards de fondo
// distintos (ORLANT y BIVETT, plantilla) abiertos con el mismo modal de
// siempre (openGenericDashboard), y verifica que CADA enlace del sidebar de
// admin sigue navegando a su seccion (no solo que se ve bien).
//
// Credenciales: lee server/data/seed-demo-credenciales.txt (gitignored,
// nunca se imprime aqui), usuario ADMIN sembrado. Solo lectura.
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.APP_URL || 'http://localhost:3000';
const OUT_DIR = process.env.OUT_DIR ||
  path.join(__dirname, '..', '..', 'docs', 'capturas-demo', 'fase46-menu-desplegable');
const CRED_FILE = path.join(__dirname, '..', '..', 'server', 'data', 'seed-demo-credenciales.txt');

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 412, height: 915 };

function leerCredencialAdmin() {
  const txt = fs.readFileSync(CRED_FILE, 'utf8');
  const linea = txt.split('\n').find((l) => l.startsWith('ADMIN\t'));
  if (!linea) throw new Error('No se encontro un usuario ADMIN en ' + CRED_FILE);
  return { user: linea.match(/user:\s*(\S+)/)[1], password: linea.match(/password:\s*(\S+)/)[1] };
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT_DIR, name), fullPage: false });
}

async function setTema(page, tema) {
  await page.evaluate((t) => { if (typeof aplicarTema === 'function') aplicarTema(t); }, tema);
  await page.waitForTimeout(200);
}

async function sidebarColapsado(page) {
  return page.evaluate(() => document.documentElement.getAttribute('data-sidebar-collapsed') === '1');
}
async function sidebarAbiertoMovil(page) {
  return page.evaluate(() => {
    var p = document.querySelector('.app-page:not([style*="display: none"])') || document.getElementById('admin-page');
    return p ? p.classList.contains('sidebar-open') : false;
  });
}

async function toggleViaBoton(page) {
  await page.click('#admin-page .navbar-menu-toggle');
  await page.waitForTimeout(400); // transicion CSS (0.2s/0.25s) + margen
}
// El modal de previsualizar dashboard (openGenericDashboard) se superpone a
// TODA la pagina, tapando el boton hamburguesa del sidebar de admin que
// queda detras -- un click real no lo alcanzaria (ni lo alcanzaria un
// usuario real), asi que para las capturas "sidebar detras de un
// dashboard" se invoca toggleSidebar() directo, mismo criterio que
// _traficoSwitchSubtab en la Fase 45.
async function toggleViaEvaluate(page) {
  await page.evaluate(() => {
    var btn = document.querySelector('#admin-page .navbar-menu-toggle');
    if (btn) toggleSidebar(btn);
  });
  await page.waitForTimeout(400);
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const { user, password } = leerCredencialAdmin();
  const browser = await chromium.launch();
  const resultado = {};
  const errores = [];
  let ok = true;

  try {
    const page = await browser.newPage({ viewport: DESKTOP });
    page.on('pageerror', (e) => errores.push('pageerror: ' + e.message));
    page.on('dialog', (d) => d.accept());
    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
    await page.fill('#username', user);
    await page.fill('#password', password);
    await page.click('button.btn-login');
    await page.waitForTimeout(1200);
    const loginErr = await page.locator('#login-error').innerText().catch(() => '');
    if (loginErr && loginErr.trim()) throw new Error('Login fallo: ' + loginErr.trim());
    resultado.loginOk = true;

    await setTema(page, 'light');

    // ══ 1. ESCRITORIO: expandido (default) / colapsado, claro y oscuro ═
    resultado.desktopDefaultColapsado = await sidebarColapsado(page); // debe ser false (nunca tocado)
    await shot(page, '1-sidebar-expandido-claro-desktop.png');

    await toggleViaBoton(page);
    resultado.desktopTrasColapsar = await sidebarColapsado(page); // debe ser true
    await shot(page, '1-sidebar-colapsado-claro-desktop.png');

    await setTema(page, 'dark');
    await shot(page, '1-sidebar-colapsado-oscuro-desktop.png');

    await toggleViaBoton(page); // vuelve a expandir
    resultado.desktopTrasReabrir = await sidebarColapsado(page); // debe ser false
    await shot(page, '1-sidebar-expandido-oscuro-desktop.png');
    await setTema(page, 'light');

    // ══ 2. Persistencia: localStorage sobrevive un reload ══════════════
    // La app NO persiste la sesion entre reloads (authToken vive solo en
    // memoria, session.js) -- un reload real siempre vuelve al login, asi
    // que hay que loguear de nuevo antes de poder ver el sidebar otra vez.
    // La preferencia colapsado/expandido si esta en localStorage (fuera del
    // ciclo de vida de la sesion), que es justamente lo que se quiere probar
    // aca: sobrevive aunque la sesion no.
    await toggleViaBoton(page); // colapsa
    const prefTrasColapsar = await page.evaluate(() => localStorage.getItem('inco_sidebar_colapsado'));
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    await page.fill('#username', user);
    await page.fill('#password', password);
    await page.click('button.btn-login');
    await page.waitForTimeout(1200);
    resultado.persisteTrasReload = (prefTrasColapsar === '1') && (await sidebarColapsado(page)) === true;
    await shot(page, '2-sidebar-colapsado-tras-reload-claro-desktop.png');
    await toggleViaBoton(page); // vuelve a expandir para el resto de las pruebas
    resultado.expandidoOtraVez = (await sidebarColapsado(page)) === false;

    // ══ 3. Todos los enlaces del sidebar de admin siguen navegando ═════
    const enlaces = await page.evaluate(() =>
      Array.from(document.querySelectorAll('#sidebar-menu a')).map((a) => a.id)
    );
    resultado.enlacesEncontrados = enlaces;
    const navegacionOk = {};
    for (const id of enlaces) {
      await page.click('#' + id);
      await page.waitForTimeout(300);
      if (id === 'menu-cargas') {
        // openCargas() (cargas.js) abre un modal, no una seccion con
        // showSection() -- nunca marca 'active' (ver ui-core.js
        // showSection: 'cargas' no esta en su lista de claves). Verificar
        // que el modal se muestra, y cerrarlo antes de seguir con los
        // demas enlaces (si no, su overlay tapa todo lo de abajo).
        navegacionOk[id] = await page.evaluate(() =>
          document.getElementById('cargas-overlay').classList.contains('show'));
        await page.evaluate(() => { if (typeof closeCargas === 'function') closeCargas(); });
        await page.waitForTimeout(200);
      } else {
        navegacionOk[id] = await page.evaluate((elId) => document.getElementById(elId).classList.contains('active'), id);
      }
    }
    resultado.navegacionOk = navegacionOk;
    await page.click('#menu-users');
    await page.waitForTimeout(300);

    // ══ 4. Contra 2 dashboards de fondo distintos (ORLANT, BIVETT) ═════
    for (const cliente of ['ORLANT', 'BIVETT']) {
      const slug = cliente.toLowerCase();
      await setTema(page, 'light');
      await page.evaluate((c) => openGenericDashboard(c), cliente);
      await page.waitForTimeout(1200);
      await shot(page, `3-${slug}-sidebar-expandido-claro-desktop.png`);

      await toggleViaEvaluate(page);
      await shot(page, `3-${slug}-sidebar-colapsado-claro-desktop.png`);
      await setTema(page, 'dark');
      await shot(page, `3-${slug}-sidebar-colapsado-oscuro-desktop.png`);
      await toggleViaEvaluate(page);
      await shot(page, `3-${slug}-sidebar-expandido-oscuro-desktop.png`);
      await setTema(page, 'light');

      await page.evaluate(() => { if (typeof closeGenericDashboard === 'function') closeGenericDashboard(); });
      await page.waitForTimeout(300);
    }

    await page.close();

    // ══ 5. MOVIL: off-canvas cerrado (default) / abierto, claro y oscuro,
    //      contra los mismos 2 dashboards de fondo ══════════════════════
    const pageM = await browser.newPage({ viewport: MOBILE });
    pageM.on('pageerror', (e) => errores.push('pageerror(movil): ' + e.message));
    pageM.on('dialog', (d) => d.accept());
    await pageM.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
    await pageM.fill('#username', user);
    await pageM.fill('#password', password);
    await pageM.click('button.btn-login');
    await pageM.waitForTimeout(1200);
    await setTema(pageM, 'light');

    resultado.movilDefaultAbierto = await sidebarAbiertoMovil(pageM); // debe ser false
    await shot(pageM, '4-sidebar-cerrado-claro-movil.png');
    await pageM.click('#admin-page .navbar-menu-toggle');
    await pageM.waitForTimeout(400);
    resultado.movilTrasAbrir = await sidebarAbiertoMovil(pageM); // debe ser true
    await shot(pageM, '4-sidebar-abierto-claro-movil.png');
    await setTema(pageM, 'dark');
    await shot(pageM, '4-sidebar-abierto-oscuro-movil.png');
    // El overlay cubre TODO el ancho (left:0;right:0) pero el sidebar (encima,
    // z-index mayor) ocupa el 80% izquierdo -- un click en el centro del
    // overlay cae sobre el sidebar. Se hace click explicito cerca del borde
    // derecho, fuera del sidebar, para probar el overlay de verdad.
    await pageM.click('#admin-page .sidebar-overlay', { position: { x: MOBILE.width - 15, y: 100 } });
    await pageM.waitForTimeout(400);
    resultado.movilTrasCerrarConOverlay = await sidebarAbiertoMovil(pageM); // debe ser false
    await shot(pageM, '4-sidebar-cerrado-oscuro-movil.png');
    await setTema(pageM, 'light');

    for (const cliente of ['ORLANT', 'BIVETT']) {
      const slug = cliente.toLowerCase();
      await pageM.evaluate((c) => openGenericDashboard(c), cliente);
      await pageM.waitForTimeout(1200);
      await shot(pageM, `5-${slug}-sidebar-cerrado-claro-movil.png`);
      await toggleViaEvaluate(pageM);
      await shot(pageM, `5-${slug}-sidebar-abierto-claro-movil.png`);
      await toggleViaEvaluate(pageM);
      await pageM.waitForTimeout(400);
      await pageM.evaluate(() => { if (typeof closeGenericDashboard === 'function') closeGenericDashboard(); });
      await pageM.waitForTimeout(300);
    }
    await pageM.close();

    resultado.erroresJs = errores;
    ok = resultado.loginOk &&
      resultado.desktopDefaultColapsado === false &&
      resultado.desktopTrasColapsar === true &&
      resultado.desktopTrasReabrir === false &&
      resultado.persisteTrasReload === true &&
      resultado.movilDefaultAbierto === false &&
      resultado.movilTrasAbrir === true &&
      resultado.movilTrasCerrarConOverlay === false &&
      Object.values(navegacionOk).every(Boolean) &&
      errores.length === 0;
    resultado.ok = ok;
    console.log(JSON.stringify(resultado, null, 2));
  } catch (e) {
    console.error('FALLO la verificacion:', e.message);
    console.log(JSON.stringify(resultado, null, 2));
    ok = false;
  } finally {
    await browser.close();
  }

  process.exit(ok ? 0 : 1);
})();
