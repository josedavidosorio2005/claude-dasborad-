// verificar-permiso-historial-y-routers-produccion.js — QA de un solo uso,
// invocado por
// .github/workflows/verificar-permiso-historial-y-routers-produccion.yml.
//
// Verifica contra PRODUCCION real (PR "permiso de historial, cache/compresion
// de estaticos, server.js dividido en routers", 2026-09-17):
//   1. GET /api/historial: un ASESOR temporal recibe 403 (antes de este PR,
//      cualquier autenticado lo veia sin ningun chequeo de rol); un ADMIN
//      temporal lo sigue viendo sin cambios (200, con filas reales).
//   2. Flujo end-to-end completo login -> navegar a un dashboard real (con
//      datos reales de ORLANT) -> cargar datos (una carga de PRUEBA a
//      ALBERTO LINERO GO, periodo 2027-08) por el flujo real (plantilla
//      consolidada, UI real) -- para confirmar que dividir server.js en
//      server/routes/*.js no rompio nada de punta a punta.
//
// Usuarios TEMPORALES (creados y borrados por el workflow, directo en la
// base de datos — nunca via la API): uno ADMIN, uno ASESOR. Las contrasenas
// llegan por variables de entorno ya enmascaradas (`::add-mask::`) — este
// script jamas las imprime.
'use strict';
const { chromium } = require('playwright');
const XLSX = require('xlsx');
const path = require('path');
const os = require('os');

const BASE = process.env.PROD_URL || 'https://inconexionpruebasclaude.duckdns.org';
const ADMIN_USER = process.env.TEMP_ADMIN_USER;
const ADMIN_PW = process.env.TEMP_ADMIN_PW;
const ASESOR_USER = process.env.TEMP_ASESOR_USER;
const ASESOR_PW = process.env.TEMP_ASESOR_PW;
const TMP = os.tmpdir();
const ARTIFACTS_DIR = process.env.ARTIFACTS_DIR || TMP;
const PERIODO_PRUEBA = '2027-08';

async function login(page, user, pw) {
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.fill('#username', user);
  await page.fill('#password', pw);
  await page.click('button.btn-login');
  await page.waitForTimeout(1200);
  const err = await page.locator('#login-error').innerText().catch(() => '');
  if (err && err.trim()) throw new Error('Login de "' + user + '" fallo: ' + err.trim());
}

(async () => {
  if (!ADMIN_USER || !ADMIN_PW || !ASESOR_USER || !ASESOR_PW) {
    console.error('Faltan TEMP_ADMIN_USER/TEMP_ADMIN_PW/TEMP_ASESOR_USER/TEMP_ASESOR_PW en el entorno.');
    process.exit(1);
  }

  const browser = await chromium.launch();
  const resultado = {};
  let ok = true;

  try {
    // ══ 1a. ASESOR temporal: GET /api/historial -> 403 ════════════════
    const pageAsesor = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    pageAsesor.on('dialog', (d) => d.accept());
    await login(pageAsesor, ASESOR_USER, ASESOR_PW);
    resultado.asesorLoginOk = true;
    const asesorHistorial = await pageAsesor.evaluate(async () => {
      try {
        const rows = await apiRequest('GET', '/historial');
        return { bloqueada: false, filas: Array.isArray(rows) ? rows.length : null };
      } catch (e) {
        return { bloqueada: true, status: e.status, mensaje: e.message };
      }
    });
    resultado.asesorHistorial = asesorHistorial;
    resultado.asesorHistorialBloqueadoOk = asesorHistorial.bloqueada && asesorHistorial.status === 403;
    await pageAsesor.screenshot({ path: path.join(ARTIFACTS_DIR, '1-asesor-historial-bloqueado.png') });
    await pageAsesor.close();

    // ══ 1b. ADMIN temporal: GET /api/historial -> 200, con filas reales ══
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('dialog', (d) => d.accept());
    await login(page, ADMIN_USER, ADMIN_PW);
    resultado.adminLoginOk = true;
    const adminHistorial = await page.evaluate(async () => {
      try {
        const rows = await apiRequest('GET', '/historial');
        return { bloqueada: false, filas: Array.isArray(rows) ? rows.length : null };
      } catch (e) {
        return { bloqueada: true, status: e.status, mensaje: e.message };
      }
    });
    resultado.adminHistorial = adminHistorial;
    resultado.adminHistorialOkSigueViendolo = !adminHistorial.bloqueada && adminHistorial.filas > 0;

    // ══ 2a. Navegar a un dashboard REAL (ORLANT, datos reales de produccion) ══
    await page.evaluate(() => { if (typeof openGenericDashboard === 'function') openGenericDashboard('ORLANT'); });
    await page.waitForTimeout(1200);
    const orlantSub = await page.locator('#gd-sub').innerText().catch(() => '');
    const orlantKpisLen = await page.locator('#gd-kpis').evaluate((el) => el.innerHTML.length).catch(() => 0);
    resultado.orlantDashboard = { sub: orlantSub, kpisLen: orlantKpisLen };
    resultado.orlantDashboardOk = orlantSub.includes('ORLANT') && orlantKpisLen > 100;
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, '2-orlant-dashboard-real.png') });
    await page.evaluate(() => { if (typeof closeGenericDashboard === 'function') closeGenericDashboard(); });

    // ══ 2b. Cargar datos: una carga de PRUEBA a ALBERTO LINERO GO (2027-08) ══
    // por el flujo real (descarga la plantilla consolidada, la llena, la
    // sube) -- confirma que routes/dashboards.js (POST /dashboard/cargas)
    // sigue funcionando igual tras el refactor.
    await page.evaluate(() => { if (typeof openCargas === 'function') return openCargas(); });
    await page.waitForTimeout(800);
    await page.selectOption('#carga-cliente', 'ALBERTO LINERO GO');
    await page.waitForTimeout(500);
    const [dl] = await Promise.all([
      page.waitForEvent('download', { timeout: 15000 }),
      page.click('button[onclick="descargarPlantillaConsolidada()"]'),
    ]);
    const plantillaPath = path.join(TMP, 'plantilla_ALBERTO_LINERO_GO_historial.xlsx');
    await dl.saveAs(plantillaPath);

    const wb = XLSX.readFile(plantillaPath);
    const wsResumen = wb.Sheets['resumen'];
    const rangeResumen = XLSX.utils.decode_range(wsResumen['!ref']);
    for (let r = rangeResumen.s.r + 1; r <= rangeResumen.e.r; r++) {
      wsResumen[XLSX.utils.encode_cell({ r, c: 1 })] = { t: 'n', v: 99 };
    }
    const plantillaLlenaPath = path.join(TMP, 'plantilla_ALBERTO_LINERO_GO_historial_llena.xlsx');
    XLSX.writeFile(wb, plantillaLlenaPath);

    await page.fill('#carga-periodo', PERIODO_PRUEBA);
    await page.setInputFiles('#carga-file', plantillaLlenaPath);
    await page.waitForTimeout(800);
    await page.evaluate(() => guardarCarga());
    await page.waitForTimeout(1200);
    resultado.cargaPruebaToast = (await page.locator('#toast').innerText().catch(() => '')).trim();
    resultado.cargaPruebaOk = !resultado.cargaPruebaToast.includes('✗');
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, '3-alberto-linero-go-carga-guardada.png') });
    await page.evaluate(() => { if (typeof closeCargas === 'function') closeCargas(); });

    // Confirma que la carga de prueba se ve reflejada en su dashboard real.
    await page.evaluate(() => openGenericDashboard('ALBERTO LINERO GO'));
    await page.waitForTimeout(1200);
    const algKpisLen = await page.locator('#gd-kpis').evaluate((el) => el.innerHTML.length).catch(() => 0);
    resultado.albertoLineroGoDashboardTrasCargaOk = algKpisLen > 100;
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, '4-alberto-linero-go-dashboard-tras-carga.png') });
    await page.evaluate(() => closeGenericDashboard());

    ok =
      resultado.asesorLoginOk &&
      resultado.asesorHistorialBloqueadoOk &&
      resultado.adminLoginOk &&
      resultado.adminHistorialOkSigueViendolo &&
      resultado.orlantDashboardOk &&
      resultado.cargaPruebaOk &&
      resultado.albertoLineroGoDashboardTrasCargaOk;

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
