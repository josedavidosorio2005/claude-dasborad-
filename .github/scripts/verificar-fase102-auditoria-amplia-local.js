// verificar-fase102-auditoria-amplia-local.js — QA de un solo uso, Fase 102.
//
// Recorrido amplio EN LOCAL (http://localhost:3000, con `npm run seed:demo`
// corriendo) con Playwright directo desde Node (nunca la extension de
// Claude in Chrome, ver CLAUDE.md): cada rol de seed:demo inicia sesion y,
// para el admin, se recorre a fondo el dashboard de ORLANT (todas las
// pestanas y sub-pestanas reales, clic por clic, igual que una persona) en
// claro/oscuro y escritorio/movil, con Exportar real en cada pestana.
//
// Captura: errores de consola/pagina, peticiones fallidas (sin contar los
// 403 esperados de permisos), texto NaN/undefined/[object Object], scroll
// horizontal, y que "Exportar > Excel" produzca un archivo .xlsx real (no
// vacio, firma ZIP valida).
//
// Solo lectura sobre la app: nunca crea/edita/borra datos de negocio (si
// cambia algo de UI como el tema, no persiste nada en el servidor).
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.APP_URL || 'http://localhost:3000';
const CRED_FILE = path.join(__dirname, '..', '..', 'server', 'data', 'seed-demo-credenciales.txt');
const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 412, height: 915 };
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

function nuevoColector(page, hallazgos, etiquetaBase) {
  page.on('pageerror', (err) => hallazgos.push({ tipo: 'pageerror', ctx: etiquetaBase(), msg: err.message }));
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const txt = msg.text();
    if (/favicon/i.test(txt)) return;
    hallazgos.push({ tipo: 'console.error', ctx: etiquetaBase(), msg: txt });
  });
  page.on('requestfailed', (req) => {
    hallazgos.push({ tipo: 'request-failed', ctx: etiquetaBase(), url: req.url(), error: req.failure() && req.failure().errorText });
  });
  page.on('response', (res) => {
    const st = res.status();
    if (st >= 500) hallazgos.push({ tipo: 'response-5xx', ctx: etiquetaBase(), url: res.url(), status: st });
  });
}

async function login(page, user, password) {
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.fill('#username', user);
  await page.fill('#password', password);
  await page.click('button.btn-login');
  await page.waitForTimeout(1000);
  const err = await page.locator('#login-error').innerText().catch(() => '');
  if (err && err.trim() && (await page.locator('#login-error').isVisible().catch(() => false))) {
    throw new Error('Login fallo para ' + user + ': ' + err.trim());
  }
}

async function logout(page) {
  // 4 bloques de navbar (admin/dash/asesor/supervisor) comparten la misma
  // clase .btn-logout -- solo uno esta visible segun el rol. .first() toma
  // el primero en el DOM sin importar visibilidad, por eso puede fallar;
  // :visible filtra al que realmente se ve en pantalla.
  const btn = page.locator('button.btn-logout:visible').first();
  if (await btn.count()) { await btn.click(); await page.waitForTimeout(500); }
}

async function hayScrollHorizontal(page) {
  return page.evaluate(() => {
    const de = document.documentElement, b = document.body;
    return de.scrollWidth > de.clientWidth + 2 || (b && b.scrollWidth > b.clientWidth + 2);
  });
}

async function textoSospechoso(page) {
  const texto = await page.evaluate(() => document.body.innerText || '');
  const m = texto.match(TEXTO_SOSPECHOSO);
  return m ? m[0] + ' ... (' + texto.slice(Math.max(0, m.index - 40), m.index + 60).replace(/\s+/g, ' ') + ')' : null;
}

async function revisarExportarExcel(page, hallazgos, ctx) {
  const btn = page.locator('#gd-export-btn');
  if (!(await btn.count())) return;
  await btn.click();
  await page.waitForTimeout(250);
  const opcion = page.locator('#gd-export-menu button', { hasText: 'Excel' });
  if (!(await opcion.count())) {
    hallazgos.push({ tipo: 'exportar-sin-menu', ctx });
    return;
  }
  try {
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 8000 }),
      opcion.click(),
    ]);
    const p = await download.path();
    const buf = p ? fs.readFileSync(p) : Buffer.alloc(0);
    const valido = buf.length > 200 && buf[0] === 0x50 && buf[1] === 0x4b; // firma ZIP ("PK"), xlsx es un zip
    if (!valido) hallazgos.push({ tipo: 'exportar-invalido', ctx, tamano: buf.length });
  } catch (e) {
    hallazgos.push({ tipo: 'exportar-no-descargo', ctx, error: e.message });
  }
  // cerrar el menu si quedo abierto
  await page.keyboard.press('Escape').catch(() => {});
}

async function revisarPanelActual(page, hallazgos, ctx, { exportar }) {
  if (await hayScrollHorizontal(page)) hallazgos.push({ tipo: 'scroll-horizontal', ctx });
  const sosp = await textoSospechoso(page);
  if (sosp) hallazgos.push({ tipo: 'texto-sospechoso', ctx, muestra: sosp });
  if (exportar) await revisarExportarExcel(page, hallazgos, ctx);
}

// Recorre TODAS las pestanas (#gd-tabs .atab) y, dentro de cada una, TODAS
// las sub-pestanas reales (.gd-subtab-btn) -- sin asumir nombres de key,
// clic por clic como un usuario, para cubrir Agendamiento (4 vistas) e
// Inasistencia (3 vistas) sin tener que listarlas a mano.
async function recorrerTabsYSubtabs(page, hallazgos, cliente, { exportar }) {
  const nTabs = await page.locator('#gd-tabs .atab').count();
  for (let i = 0; i < nTabs; i++) {
    const tab = page.locator('#gd-tabs .atab').nth(i);
    const label = (await tab.textContent() || '').trim();
    await tab.click();
    await page.waitForTimeout(900);
    await revisarPanelActual(page, hallazgos, cliente + ' > ' + label, { exportar });

    const nSub = await page.locator('.gd-subtab-btn').count();
    for (let j = 0; j < nSub; j++) {
      const sub = page.locator('.gd-subtab-btn').nth(j);
      const subLabel = (await sub.textContent() || '').trim();
      await sub.click();
      await page.waitForTimeout(700);
      await revisarPanelActual(page, hallazgos, cliente + ' > ' + label + ' > ' + subLabel, { exportar });
    }
  }
}

async function aplicarTema(page, tema) {
  await page.evaluate((t) => { if (typeof aplicarTema === 'function') aplicarTema(t); }, tema);
  await page.waitForTimeout(250);
}

(async () => {
  const creds = leerCredenciales();
  const faltantes = ['ADMIN', 'AUX_ADMIN', 'CALIDAD', 'INVENTARIO', 'GERENCIA', 'GESTION_HUMANA', 'CLIENTES_DASH', 'SUPERVISOR', 'ASESOR', 'REPORTES']
    .filter((r) => !creds[r]);
  if (faltantes.length) { console.error('Faltan credenciales de demo para: ' + faltantes.join(', ')); process.exit(1); }

  const browser = await chromium.launch();
  const hallazgos = [];
  let ctxActual = 'arranque';
  const etiqueta = () => ctxActual;
  let ok = true;

  try {
    // ── 1) ADMIN: recorrido a fondo del dashboard de ORLANT ──────────────
    {
      const page = await browser.newPage({ viewport: DESKTOP });
      nuevoColector(page, hallazgos, etiqueta);
      ctxActual = 'login ADMIN';
      await login(page, creds.ADMIN.user, creds.ADMIN.password);

      ctxActual = 'ADMIN > ORLANT > claro > escritorio';
      await aplicarTema(page, 'light');
      await page.evaluate(() => openGenericDashboard('ORLANT'));
      await page.waitForTimeout(1200);
      await recorrerTabsYSubtabs(page, hallazgos, 'ORLANT(claro/escritorio)', { exportar: true });

      ctxActual = 'ADMIN > ORLANT > oscuro > escritorio';
      await aplicarTema(page, 'dark');
      await page.waitForTimeout(300);
      await recorrerTabsYSubtabs(page, hallazgos, 'ORLANT(oscuro/escritorio)', { exportar: false });

      ctxActual = 'ADMIN > ORLANT > claro > movil';
      await aplicarTema(page, 'light');
      await page.setViewportSize(MOBILE);
      await page.waitForTimeout(300);
      await recorrerTabsYSubtabs(page, hallazgos, 'ORLANT(claro/movil)', { exportar: false });
      await page.setViewportSize(DESKTOP);

      await page.evaluate(() => { if (typeof closeGenericDashboard === 'function') closeGenericDashboard(); });

      // Clientes sin datos reales (Aurora, Hospital La Maria): solo que
      // abran sin romperse (sin error de consola, sin scroll horizontal) --
      // no tienen Exportar representativo porque no hay filas.
      for (const cliente of ['CLINICA AURORA', 'HOSPITAL LA MARIA']) {
        ctxActual = 'ADMIN > ' + cliente + ' (sin datos reales)';
        await page.evaluate((c) => openGenericDashboard(c), cliente);
        await page.waitForTimeout(1200);
        await recorrerTabsYSubtabs(page, hallazgos, cliente, { exportar: false });
        await page.evaluate(() => { if (typeof closeGenericDashboard === 'function') closeGenericDashboard(); });
      }

      await logout(page);
      await page.close();
    }

    // ── 2) Cada otro rol de seed:demo: login, vista esperada, sin errores ─
    const vistaEsperada = {
      AUX_ADMIN: 'admin', CALIDAD: 'dash', INVENTARIO: 'dash', GERENCIA: 'dash',
      GESTION_HUMANA: 'dash', CLIENTES_DASH: 'dash', SUPERVISOR: 'supervisor',
      ASESOR: 'asesor', REPORTES: 'dash',
    };
    for (const rol of Object.keys(vistaEsperada)) {
      const page = await browser.newPage({ viewport: DESKTOP });
      nuevoColector(page, hallazgos, etiqueta);
      ctxActual = 'login ' + rol;
      try {
        await login(page, creds[rol].user, creds[rol].password);
        await page.waitForTimeout(500);
        const visibles = {
          admin: await page.locator('#nb-user-admin').isVisible().catch(() => false),
          dash: await page.locator('#nb-user-dash').isVisible().catch(() => false),
          asesor: await page.locator('#nb-user-asesor').isVisible().catch(() => false),
          supervisor: await page.locator('#nb-user-supervisor').isVisible().catch(() => false),
        };
        const esperada = vistaEsperada[rol];
        if (!visibles[esperada]) {
          hallazgos.push({ tipo: 'vista-inesperada', ctx: rol, detalle: 'esperaba "' + esperada + '" visible, estado: ' + JSON.stringify(visibles) });
        }
        // Un rol no-admin nunca debe ver el modulo de Usuarios/Permisos ni
        // el boton de Cargar Datos del panel admin (solo aplica si cayo en
        // la vista "admin", que es AUX_ADMIN -- su propio acceso real a
        // esos modulos ya lo cubre permissions.test.js en el servidor; aqui
        // solo interesa que la pantalla cargue sin romperse).
        await logout(page);
      } catch (e) {
        hallazgos.push({ tipo: 'rol-fallo-login-o-logout', ctx: rol, error: e.message });
      }
      await page.close();
    }
  } catch (e) {
    hallazgos.push({ tipo: 'fallo-general', ctx: etiqueta(), error: e.message });
    ok = false;
  } finally {
    await browser.close();
  }

  const resumen = {};
  hallazgos.forEach((h) => { resumen[h.tipo] = (resumen[h.tipo] || 0) + 1; });
  console.log('=== RESULTADO FINAL ===');
  console.log(JSON.stringify({ totalHallazgos: hallazgos.length, resumen, hallazgos }, null, 2));

  ok = ok && hallazgos.length === 0;
  process.exit(ok ? 0 : 1);
})();
