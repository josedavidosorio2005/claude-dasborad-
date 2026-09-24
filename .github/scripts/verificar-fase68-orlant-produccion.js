// verificar-fase68-orlant-produccion.js — QA de un solo uso, Fase 68,
// PRODUCCION. Solo lectura: nunca sube ni modifica ningun dato -- confirma
// con el usuario temporal (perms minimos, sin cargarDatos) que ORLANT en
// produccion refleja los 5 pedidos de Edwin (23/09):
//   1) Trafico de Llamadas/WhatsApp abren en vista MENSUAL por defecto
//   2) la franja superior de KPIs de ORLANT esta vacia (otro cliente la
//      conserva -- se usa CLINICA AURORA como control)
//   3) Nivel de Servicio muestra SOLO "SL 20s" (nunca SL 10s/SL 30s)
//   4) no existe ninguna grafica/sub-pestana "Wait Time"
//   5) Trafico de WhatsApp tiene la MISMA interfaz/controles que Llamadas
// Ademas confirma los KPIs reales YA cargados en produccion desde la Fase
// 67/55-56 (8.061/7.159/902 Llamadas, 7.305/7.109/196 WhatsApp) -- prueba
// de que ESTOS cambios (Fase 68) no tocaron ningun dato.
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.PROD_URL;
const ADMIN_USER = process.env.TEMP_USER;
const ADMIN_PW = process.env.TEMP_PW;
const OUT_DIR = process.env.ARTIFACTS_DIR || path.join(__dirname, '..', '..', 'docs', 'capturas-demo', 'fase68-verificacion-produccion');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const DESKTOP = { width: 1440, height: 900 };

function assert(cond, msg) {
  if (!cond) throw new Error('FALLO: ' + msg);
  console.log('OK: ' + msg);
}

async function shot(page, name) {
  const modal = page.locator('#gd-modal');
  if (await modal.count()) await modal.screenshot({ path: path.join(OUT_DIR, name) });
  else await page.screenshot({ path: path.join(OUT_DIR, name), fullPage: true });
}

async function main() {
  if (!BASE || !ADMIN_USER || !ADMIN_PW) throw new Error('Faltan PROD_URL/TEMP_USER/TEMP_PW en el entorno');
  const browser = await chromium.launch();
  const erroresConsola = [];
  let ok = true;

  try {
    const page = await browser.newPage({ viewport: DESKTOP });
    page.on('pageerror', (e) => erroresConsola.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/favicon/i.test(m.text())) erroresConsola.push('console.error: ' + m.text()); });

    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
    await page.fill('#username', ADMIN_USER);
    await page.fill('#password', ADMIN_PW);
    await page.click('button.btn-login');
    await page.waitForTimeout(1500);
    const loginErr = await page.locator('#login-error').innerText().catch(() => '');
    if (loginErr && loginErr.trim()) throw new Error('Login fallo: ' + loginErr.trim());
    console.log('OK: login con usuario temporal de solo lectura');

    // ── Pedido 2: franja de KPIs vacia en ORLANT, presente en otro cliente ──
    await page.evaluate(() => openGenericDashboard('ORLANT'));
    await page.waitForTimeout(1200);
    const orlantKpisHtml = await page.$eval('#gd-kpis', (el) => el.innerHTML.trim());
    assert(orlantKpisHtml === '', 'ORLANT: franja de KPIs vacia en produccion (#gd-kpis sin contenido)');
    await shot(page, '01-orlant-sin-franja-kpis-produccion.png');

    await page.evaluate(() => openGenericDashboard('CLINICA AURORA'));
    await page.waitForTimeout(1200);
    const auroraKpiCount = await page.$$eval('#gd-kpis .aurora-kpi', (els) => els.length);
    assert(auroraKpiCount > 0, 'CLINICA AURORA conserva su franja de KPIs en produccion (' + auroraKpiCount + ' tarjetas)');
    await shot(page, '02-aurora-conserva-franja-kpis-produccion.png');

    // ── Trafico de Llamadas ──────────────────────────────────────────────
    await page.evaluate(() => openGenericDashboard('ORLANT'));
    await page.waitForTimeout(1200);
    await page.evaluate(() => switchGenericTab('trafico'));
    await page.waitForTimeout(1500);

    const granLlamadas = await page.$eval('#tv-f-gran-0', (el) => el.value);
    assert(granLlamadas === 'mes', 'Llamadas: vista MENSUAL por defecto en produccion (granularidad="' + granLlamadas + '")');

    const subtabsLlamadas = await page.$$eval('#tv-subtabs-0 .gd-subtab-btn', (els) => els.map((e) => e.textContent.trim()));
    assert(JSON.stringify(subtabsLlamadas) === JSON.stringify(['Resumen', 'Abandono', 'AHT', 'ASA y ATA', 'Nivel de Servicio a 20s']),
      'Llamadas: sub-pestanas correctas en produccion (sin Wait Time) -- ' + JSON.stringify(subtabsLlamadas));
    assert(!(await page.$('#tv-canvas-wait-0')), 'Llamadas: no existe el canvas de Wait Time en produccion');

    const kpisLlamadasTxt = await page.$eval('#tv-kpis-0', (el) => el.textContent.replace(/\s+/g, ' ').trim());
    assert(/8\.061/.test(kpisLlamadasTxt) && /7\.159/.test(kpisLlamadasTxt) && /902/.test(kpisLlamadasTxt),
      'Llamadas: KPIs en produccion SIN CAMBIOS -- referencia 8.061/7.159/902 -- "' + kpisLlamadasTxt + '"');
    await shot(page, '03-llamadas-resumen-mensual-produccion.png');

    await page.evaluate(() => _traficoSwitchSubtab(0, 'sl'));
    await page.waitForTimeout(1000);
    const slLabelsLlamadas = await page.evaluate(() => _gd.charts['tv-canvas-sl-0'] ? _gd.charts['tv-canvas-sl-0'].data.datasets.map((d) => d.label) : null);
    assert(JSON.stringify(slLabelsLlamadas) === JSON.stringify(['SL 20s']), 'Llamadas: SOLO "SL 20s" en produccion -- ' + JSON.stringify(slLabelsLlamadas));
    await shot(page, '04-llamadas-sl20-produccion.png');

    // ── Trafico de WhatsApp (Pedido 5) ──────────────────────────────────
    await page.evaluate(() => switchGenericTab('trafico_whatsapp'));
    await page.waitForTimeout(1500);

    const granWpp = await page.$eval('#tww-f-gran-0', (el) => el.value);
    assert(granWpp === 'mes', 'WhatsApp: vista MENSUAL por defecto en produccion (granularidad="' + granWpp + '")');
    const granWppOpciones = await page.$$eval('#tww-f-gran-0 option', (els) => els.map((e) => e.value));
    assert(JSON.stringify(granWppOpciones) === JSON.stringify(['mes', 'anio']), 'WhatsApp: Granularidad nunca ofrece "dia" en produccion -- ' + JSON.stringify(granWppOpciones));

    const subtabsWpp = await page.$$eval('#tww-subtabs-0 .gd-subtab-btn', (els) => els.map((e) => e.textContent.trim()));
    assert(JSON.stringify(subtabsWpp) === JSON.stringify(subtabsLlamadas), 'WhatsApp: MISMAS sub-pestanas que Llamadas en produccion -- ' + JSON.stringify(subtabsWpp));

    const kpisWppTxt = await page.$eval('#tww-kpis-0', (el) => el.textContent.replace(/\s+/g, ' ').trim());
    assert(/7\.305/.test(kpisWppTxt) && /7\.109/.test(kpisWppTxt) && /196/.test(kpisWppTxt),
      'WhatsApp: KPIs en produccion SIN CAMBIOS -- referencia 7.305/7.109/196 -- "' + kpisWppTxt + '"');
    await shot(page, '05-whatsapp-resumen-mensual-produccion.png');

    await page.evaluate(() => _traficoWppSwitchSubtab(0, 'sl'));
    await page.waitForTimeout(1000);
    const slLabelsWpp = await page.evaluate(() => _gd.charts['tww-canvas-sl-0'] ? _gd.charts['tww-canvas-sl-0'].data.datasets.map((d) => d.label) : null);
    assert(JSON.stringify(slLabelsWpp) === JSON.stringify(['SL 20s']), 'WhatsApp: SOLO "SL 20s" en produccion -- ' + JSON.stringify(slLabelsWpp));
    await shot(page, '06-whatsapp-sl20-produccion.png');

    console.log('\n=== ERRORES DE CONSOLA:', erroresConsola.length, '===');
    erroresConsola.forEach((e) => console.log(e));
    assert(erroresConsola.length === 0, 'cero errores de consola durante toda la verificacion en produccion');

    console.log('\n=== VERIFICACION FASE 68 EN PRODUCCION: TODO OK (solo lectura, ningun dato modificado) ===');
  } catch (e) {
    ok = false;
    console.error('\n=== VERIFICACION FASE 68 EN PRODUCCION FALLO ===');
    console.error(e);
  } finally {
    await browser.close();
  }
  process.exit(ok ? 0 : 1);
}

main();
