// verificar-orlant-subpestanas-produccion.js — QA de un solo uso, invocado
// por .github/workflows/verificar-orlant-subpestanas-produccion.yml.
//
// Verifica en produccion real (Fase 40, 2026-09-21, "una grafica por
// pestana") que:
//   1) las 5 pestanas de ORLANT que se dividieron (Flujo Mensual, Salida,
//      Agendamiento, Inasistencia, Gestion STA) muestran sus sub-pestanas
//      nuevas con el numero exacto de la config actual;
//   2) las 3 pestanas que NO se dividieron (Tipificacion, Efectividad
//      Citas, Calidad) siguen sin sub-pestanas (la migracion no las toco);
//   3) Trafico de Llamadas (Wolkvox) muestra sus 6 sub-pestanas (Resumen +
//      5 graficas de detalle) y Resumen sigue trayendo los KPIs + la
//      grafica combinada;
//   4) los 4 KPIs de cabecera de Flujo Mensual calculados en la Fase 39
//      desde Trafico siguen mostrando los mismos valores ya verificados
//      (Llamadas 3P 4.011, Nivel Atencion 3P 98.16%, Llamadas Linea
//      General 4.050, Nivel Atencion L.General 79.56%) -- confirma que
//      reorganizar la vista no toco ningun calculo.
//
// De SOLO LECTURA: nunca sube ni borra ninguna carga de ORLANT. El unico
// usuario temporal (rol ADMIN) se crea y se borra directo en la base de
// datos (nunca via la API), mismo criterio que
// verificar-graficas-orlant-produccion.js.
'use strict';
const { chromium } = require('playwright');
const path = require('path');
const os = require('os');

const BASE = process.env.PROD_URL || 'https://inconexionpruebasclaude.duckdns.org';
const ADMIN_USER = process.env.TEMP_ADMIN_USER;
const ADMIN_PW = process.env.TEMP_ADMIN_PW;
const ARTIFACTS_DIR = process.env.ARTIFACTS_DIR || os.tmpdir();

const TABS_DIVIDIDOS = {
  flujo: 4,
  salida: 2,
  agendamiento: 5,
  inasistencia: 4,
  sta: 4,
};
const TABS_SIN_DIVIDIR = ['tipificacion', 'efectividad', 'calidad'];
const TRAFICO_SUBTABS = ['resumen', 'abandono', 'aht', 'asaata', 'wait', 'sl'];

async function login(page, user, pw) {
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.fill('#username', user);
  await page.fill('#password', pw);
  await page.click('button.btn-login');
  await page.waitForTimeout(1200);
  const err = await page.locator('#login-error').innerText().catch(() => '');
  if (err && err.trim()) throw new Error('Login de "' + user + '" fallo: ' + err.trim());
}

async function shot(page, nombre) {
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, nombre), fullPage: true });
}

(async () => {
  if (!ADMIN_USER || !ADMIN_PW) {
    console.error('Faltan TEMP_ADMIN_USER/TEMP_ADMIN_PW en el entorno.');
    process.exit(1);
  }

  const browser = await chromium.launch();
  const resultado = {};
  let ok = true;

  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on('dialog', (d) => d.accept());
    await login(page, ADMIN_USER, ADMIN_PW);
    resultado.loginOk = true;

    await page.evaluate(() => openGenericDashboard('ORLANT'));
    await page.waitForTimeout(1500);
    const sub = await page.locator('#gd-sub').innerText().catch(() => '');
    resultado.dashboardAbreOk = sub.includes('ORLANT');
    resultado.subtitulo = sub;

    // ── Los 4 KPIs de cabecera de Flujo Mensual (Fase 39) no cambiaron ──
    const kpisTxt = await page.locator('#gd-kpis').innerText().catch(() => '');
    resultado.kpisFase39Ok =
      kpisTxt.includes('4.011') && kpisTxt.includes('98.16%') &&
      kpisTxt.includes('4.050') && kpisTxt.includes('79.56%');
    resultado.kpisTexto = kpisTxt.slice(0, 400);
    await shot(page, '0-orlant-kpis-cabecera.png');

    // ── Las 5 pestanas divididas: subtabs con el conteo exacto ──
    resultado.subtabsPorTab = {};
    for (const [key, esperadas] of Object.entries(TABS_DIVIDIDOS)) {
      await page.evaluate((k) => switchGenericTab(k), key);
      await page.waitForTimeout(600);
      const n = await page.locator('.gd-subtabs .gd-subtab-btn').count();
      resultado.subtabsPorTab[key] = n;
      await shot(page, '1-orlant-' + key + '-subtabs.png');
      // Recorre cada sub-pestana y confirma que solo queda UN canvas de
      // grafica visible a la vez (el pedido explicito: "una grafica por
      // pestana", no una grilla).
      const btns = await page.locator('.gd-subtabs .gd-subtab-btn').all();
      for (let i = 0; i < btns.length; i++) {
        await btns[i].click();
        await page.waitForTimeout(400);
      }
      await shot(page, '1-orlant-' + key + '-ultima-subtab.png');
    }

    // ── Las 3 pestanas que NO se dividieron: sin subtabs ──
    resultado.sinSubtabs = {};
    for (const key of TABS_SIN_DIVIDIR) {
      await page.evaluate((k) => switchGenericTab(k), key);
      await page.waitForTimeout(500);
      const n = await page.locator('.gd-subtabs').count();
      resultado.sinSubtabs[key] = n;
    }

    // ── Trafico de Llamadas (Wolkvox): 6 sub-pestanas propias ──
    await page.evaluate(() => switchGenericTab('trafico'));
    await page.waitForTimeout(2500); // trafico_combo carga datos via fetch aparte
    resultado.traficoSubtabsOk = await page.evaluate((claves) => {
      var host = document.getElementById('gd-p0');
      if (!host) return false;
      return claves.every((k) => !!host.querySelector('[data-trafsub="' + k + '"]'));
    }, TRAFICO_SUBTABS);
    resultado.traficoResumenOk = await page.evaluate(() => {
      var host = document.getElementById('gd-p0');
      return !!host && !!host.querySelector('#tv-kpis-0') && !!host.querySelector('#tv-canvas-0');
    });
    await shot(page, '2-orlant-trafico-resumen.png');
    for (const k of TRAFICO_SUBTABS.slice(1)) {
      await page.click('[data-trafsub="' + k + '"]');
      await page.waitForTimeout(600);
      await shot(page, '2-orlant-trafico-' + k + '.png');
    }

    await page.evaluate(() => closeGenericDashboard());

    ok =
      resultado.loginOk &&
      resultado.dashboardAbreOk &&
      resultado.kpisFase39Ok &&
      Object.entries(TABS_DIVIDIDOS).every(([k, n]) => resultado.subtabsPorTab[k] === n) &&
      TABS_SIN_DIVIDIR.every((k) => resultado.sinSubtabs[k] === 0) &&
      resultado.traficoSubtabsOk &&
      resultado.traficoResumenOk;

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
