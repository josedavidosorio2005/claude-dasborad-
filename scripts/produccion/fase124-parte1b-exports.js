// fase124-parte1b-exports.js — Fase 124, Parte 1 (seguimiento puntual).
// SOLO LECTURA en producción. El primer intento de fase124-parte1-*.js
// falló en el paso de exports (Playwright download.saveAs() -- "Cannot
// access file", por falta de downloadsPath en el navegador) -- el resto
// de esa corrida (números, alias, tema/viewports, mes parcial) SÍ se
// completó y quedó en docs/pendientes.md / el informe de cierre. Este
// script repite SOLO el paso de exports, ya corregido (downloadsPath +
// download.path() en vez de saveAs), para no hacer re-loguear al usuario
// por una corrida completa de varios minutos.
//
// Descarga el Excel real de Tipificación, Efectividad de Agendamiento,
// Efectividad de Citas y Agendas, y lo abre con el mismo SheetJS que usa
// el navegador (public/js/vendor/xlsx-0.20.3.full.min.js) para revisar:
// columnas que parezcan PII, columnas completamente vacías, y celdas que
// empiecen con =/+/-/@ sin neutralizar (inyección de fórmulas).
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'server', 'node_modules', 'playwright'));
const XLSX = require(path.join(__dirname, '..', '..', 'public', 'js', 'vendor', 'xlsx-0.20.3.full.min.js'));

const BASE = 'https://informa.inconexion.com.co';
const LOGIN_TIMEOUT_MS = 10 * 60 * 1000;
const OUT_DIR = 'C:\\Users\\filid\\Documents\\trabajo inconexion\\bases edwin\\capturas-produccion\\fase124-parte1';
const DESCARGAS_DIR = path.join(OUT_DIR, 'descargas');

function log(...args) { console.log(new Date().toISOString(), ...args); }

async function esperarLogin(page) {
  log('=== INICIA SESIÓN AHORA EN PRODUCCIÓN (ADMIN) === (hasta 10 min)');
  const deadline = Date.now() + LOGIN_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const info = await page.evaluate(() => {
      if (typeof authToken !== 'string' || !authToken) return null;
      try {
        const p = JSON.parse(atob(authToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        return { isMasterAdmin: !!p.isMasterAdmin, rol: p.rol || null };
      } catch (e) { return null; }
    }).catch(() => null);
    if (info && (info.isMasterAdmin || info.rol === 'ADMIN')) return true;
    await page.waitForTimeout(3000);
  }
  return false;
}

function instalarListeners(page, erroresConsola, peticionesFallidas) {
  page.on('pageerror', (e) => erroresConsola.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon/i.test(m.text())) erroresConsola.push('console.error: ' + m.text()); });
  page.on('requestfailed', (req) => peticionesFallidas.push('requestfailed: ' + req.url()));
  page.on('response', (res) => { if (res.status() >= 400 && !/\/api\/auth\/login$/.test(res.url())) peticionesFallidas.push('http ' + res.status() + ': ' + res.url()); });
}

async function canvasesSinDibujar(page) {
  return page.evaluate(() => {
    const out = [];
    const host = document.getElementById('gd-panels');
    if (!host) return out;
    if (/Sin datos de/.test(host.innerText)) return out;
    host.querySelectorAll('canvas').forEach((c) => {
      const rect = c.getBoundingClientRect();
      const style = getComputedStyle(c);
      if (style.display === 'none' || style.visibility === 'hidden') return;
      if (rect.width < 5 || rect.height < 5) { out.push({ id: c.id || '(sin id)', motivo: 'tamano-cero' }); return; }
      let ctx; try { ctx = c.getContext('2d'); } catch (e) { return; }
      if (!ctx) return;
      let data; try { data = ctx.getImageData(0, 0, c.width, c.height).data; } catch (e) { return; }
      let tienePixel = false;
      for (let i = 3; i < data.length; i += 4) { if (data[i] !== 0) { tienePixel = true; break; } }
      if (!tienePixel) out.push({ id: c.id || '(sin id)', motivo: 'sin-pixeles' });
    });
    return out;
  });
}

function analizarExport(rutaArchivo) {
  const wb = XLSX.readFile(rutaArchivo);
  const hojas = {};
  const PATRON_PII = /correo|email|tel[ée]fono|celular|documento|c[ée]dula|^dni$/i;
  const PATRON_FORMULA_SIN_NEUTRALIZAR = /^[=+\-@]/;
  wb.SheetNames.forEach((nombreHoja) => {
    const ws = wb.Sheets[nombreHoja];
    const filas = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
    const encabezados = (filas[0] || []).map(String);
    const columnasPII = encabezados.filter((h) => PATRON_PII.test(h));
    const columnasVacias = encabezados.filter((_, ci) => filas.slice(1).every((f) => f[ci] === '' || f[ci] == null));
    let celdasSospechosas = 0;
    filas.slice(1).forEach((f) => f.forEach((v) => { if (typeof v === 'string' && PATRON_FORMULA_SIN_NEUTRALIZAR.test(v)) celdasSospechosas++; }));
    hojas[nombreHoja] = { filas: Math.max(0, filas.length - 1), encabezados, columnasPII, columnasVacias, celdasFormulaSinNeutralizar: celdasSospechosas };
  });
  return hojas;
}

(async () => {
  fs.mkdirSync(DESCARGAS_DIR, { recursive: true });
  const reporte = {};
  let ok = true;
  let browser;

  try {
    browser = await chromium.launch({ headless: false, downloadsPath: DESCARGAS_DIR });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
    const page = await context.newPage();
    const erroresConsola = [];
    const peticionesFallidas = [];
    instalarListeners(page, erroresConsola, peticionesFallidas);

    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
    const logueado = await esperarLogin(page);
    if (!logueado) throw new Error('Timeout de login (10 min).');
    log('Login detectado (ADMIN).');
    await page.waitForTimeout(1000);

    // ══ Verificación post-deploy (Fase 124, Parte 4): recorrido de las 7
    // pestañas + números de control, DESPUÉS del deploy de v1.13.1 (borrado
    // de código muerto en trafico-whatsapp-logic.js, dependencia proxy-addr
    // actualizada) -- confirma que nada se rompió con el deploy real. ══
    await page.evaluate(() => openGenericDashboard('ORLANT'));
    await page.waitForTimeout(1200);
    await page.evaluate(() => { if (typeof _gdIrAMes === 'function') _gdIrAMes('2026-09'); });
    await page.waitForTimeout(800);

    reporte.postDeploy = { pestanas: {} };
    const nTabs = await page.locator('#gd-tabs .atab').count();
    for (let i = 0; i < nTabs; i++) {
      const tab = page.locator('#gd-tabs .atab').nth(i);
      const label = ((await tab.textContent()) || '').trim();
      await tab.click();
      await page.waitForTimeout(900);
      reporte.postDeploy.pestanas[label] = await canvasesSinDibujar(page);
    }
    reporte.postDeploy.numeros = await page.evaluate(async () => {
      const tipifLl = await apiRequest('GET', '/calidad/tipificacion/por-tipo?campana=ORLANT&canal=LLAMADAS');
      const tipifWpp = await apiRequest('GET', '/calidad/tipificacion/por-tipo?campana=ORLANT&canal=WHATSAPP');
      const alias = await apiRequest('GET', '/alias-asesores?campana=ORLANT');
      const opcLl = await apiRequest('GET', '/calidad/tipificacion/opciones?campana=ORLANT&canal=LLAMADAS');
      const health = await apiRequest('GET', '/health').catch(() => null);
      return {
        tipifLlTotal: tipifLl.total, tipifWppTotal: tipifWpp.total,
        aliasCount: alias.length, tipifLlFalla: opcLl.agentes.filter((a) => /_falla/i.test(a)).length,
        healthVersion: health ? health.version : null, healthOk: health ? health.ok : null,
      };
    });
    const nd = reporte.postDeploy.numeros;
    reporte.postDeploy.ok =
      erroresConsola.length === 0 && peticionesFallidas.length === 0 &&
      Object.values(reporte.postDeploy.pestanas).every((m) => m.length === 0) &&
      nd.tipifLlTotal === 34661 && nd.tipifWppTotal === 25180 && nd.aliasCount === 3 && nd.tipifLlFalla === 0;
    log('Post-deploy:', JSON.stringify({ ok: reporte.postDeploy.ok, numeros: nd, erroresConsola: erroresConsola.length, peticionesFallidas: peticionesFallidas.length }));

    async function descargarYAbrir(tabText, subText, nombreArchivo) {
      await page.locator('#gd-tabs .atab', { hasText: tabText }).first().click().catch(() => {});
      await page.waitForTimeout(1000);
      if (subText) {
        const sub = page.locator('.gd-subtab-btn', { hasText: subText }).first();
        if (await sub.count()) { await sub.click(); await page.waitForTimeout(900); }
      }
      await page.click('#gd-export-btn');
      await page.waitForTimeout(200);
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 15000 }),
        page.click('#gd-export-menu button:has-text("Excel")'),
      ]);
      const falla = download.failure ? await download.failure() : null;
      if (falla) throw new Error('La descarga falló en el navegador: ' + falla);
      const rutaTemporal = await download.path();
      if (!rutaTemporal) throw new Error('download.path() vino vacío.');
      const destino = path.join(DESCARGAS_DIR, nombreArchivo);
      fs.copyFileSync(rutaTemporal, destino);
      await page.keyboard.press('Escape').catch(() => {});
      await page.evaluate(() => { const m = document.getElementById('gd-export-menu'); if (m) m.remove(); });
      return destino;
    }

    reporte.exports = {};
    const EXPORTS_A_PROBAR = [
      ['Tipificación', null, 'tipificacion.xlsx'],
      ['Agendamiento', 'Ranking', 'efectividad-agendamiento.xlsx'],
      ['Efectividad', null, 'efectividad-citas.xlsx'],
      ['Agendas', null, 'agendas.xlsx'],
    ];
    for (const [tab, sub, archivo] of EXPORTS_A_PROBAR) {
      try {
        const ruta = await descargarYAbrir(tab, sub, archivo);
        reporte.exports[tab + (sub ? '/' + sub : '')] = { ok: true, archivo, analisis: analizarExport(ruta) };
        log('OK:', tab, sub || '');
      } catch (e) {
        reporte.exports[tab + (sub ? '/' + sub : '')] = { ok: false, error: e.message };
        log('FALLO:', tab, sub || '', e.message);
      }
    }

    await page.evaluate(() => apiRequest('POST', '/auth/logout').catch(() => {}));
    console.log('=== REPORTE EXPORTS + POST-DEPLOY ===');
    console.log(JSON.stringify(reporte, null, 2));
    ok = reporte.postDeploy.ok && Object.values(reporte.exports).every((e) => e.ok);
  } catch (e) {
    console.error('FALLO:', e.message);
    console.log(JSON.stringify(reporte, null, 2));
    ok = false;
  } finally {
    if (browser) await browser.close();
  }
  process.exit(ok ? 0 : 1);
})();
