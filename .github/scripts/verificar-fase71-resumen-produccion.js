// verificar-fase71-resumen-produccion.js — QA de un solo uso, Fase 71,
// PRODUCCION. Solo lectura: nunca sube ningun dato -- descarga la plantilla
// real de ORLANT y confirma que la hoja "resumen" ya NO trae las 7 filas de
// trafico (Llamadas/WhatsApp 3P y Linea General + los 3 niveles de
// atencion), que se calculan solas desde Trafico de Llamadas/WhatsApp desde
// esta fase.
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { leerHojaXlsxComoAoA } = require('../../server/tests/helpers/xlsx-lite');

const BASE = process.env.PROD_URL;
const ADMIN_USER = process.env.TEMP_USER;
const ADMIN_PW = process.env.TEMP_PW;
const OUT_DIR = process.env.ARTIFACTS_DIR || path.join(__dirname, '..', '..', 'docs', 'capturas-demo', 'fase71-verificacion-produccion');
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

function assert(cond, msg) {
  if (!cond) throw new Error('FALLO: ' + msg);
  console.log('OK: ' + msg);
}

async function main() {
  if (!BASE || !ADMIN_USER || !ADMIN_PW) throw new Error('Faltan PROD_URL/TEMP_USER/TEMP_PW en el entorno');
  const browser = await chromium.launch();
  const erroresConsola = [];
  let ok = true;
  const descargaPath = path.join(OUT_DIR, '_descarga-resumen-orlant-produccion.xlsx');

  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('pageerror', (e) => erroresConsola.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/favicon/i.test(m.text())) erroresConsola.push('console.error: ' + m.text()); });

    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
    await page.fill('#username', ADMIN_USER);
    await page.fill('#password', ADMIN_PW);
    await page.click('button.btn-login');
    await page.waitForTimeout(1500);
    const loginErr = await page.locator('#login-error').innerText().catch(() => '');
    if (loginErr && loginErr.trim()) throw new Error('Login fallo: ' + loginErr.trim());
    console.log('OK: login con usuario temporal de solo lectura (perms.cargarDatos)');

    await page.evaluate(() => openCargas());
    await page.waitForTimeout(900);
    await page.selectOption('#carga-cliente', 'ORLANT');
    await page.waitForTimeout(600);
    await page.locator('#cargas-overlay').screenshot({ path: path.join(OUT_DIR, '01-cargas-orlant-produccion.png') });

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#cargas-overlay button:has-text("Descargar plantilla (Excel)")'),
    ]);
    await download.saveAs(descargaPath);
    console.log('OK: plantilla de ORLANT descargada de produccion');

    const resumenAoa = leerHojaXlsxComoAoA(descargaPath, 'resumen');
    const etiquetas = resumenAoa.map((r) => (r[0] == null ? '' : String(r[0]).trim())).filter((e) => e && e !== 'Metrica');
    const ETIQUETAS_TRAFICO = ['Llamadas 3P', 'WhatsApp 3P', 'Llamadas Linea General', 'WhatsApp Linea General', 'Nivel Atencion 3P (%)', 'Nivel Atencion WhatsApp 3P (%)', 'Nivel Atencion Linea General (%)'];
    const siguenAhi = ETIQUETAS_TRAFICO.filter((et) => etiquetas.includes(et));

    assert(siguenAhi.length === 0, 'produccion: la hoja "resumen" de ORLANT NO trae ninguna de las 7 filas de trafico -- ' + JSON.stringify(siguenAhi));
    assert(etiquetas.length === 16, 'produccion: la hoja "resumen" tiene exactamente 16 filas de metrica (23 - 7) -- tiene ' + etiquetas.length + ': ' + JSON.stringify(etiquetas));

    console.log('\n=== ERRORES DE CONSOLA:', erroresConsola.length, '===');
    erroresConsola.forEach((e) => console.log(e));
    assert(erroresConsola.length === 0, 'cero errores de consola durante toda la verificacion');

    console.log('\n=== VERIFICACION FASE 71 EN PRODUCCION: TODO OK (solo lectura, ningun dato modificado) ===');
  } catch (e) {
    ok = false;
    console.error('\n=== VERIFICACION FASE 71 EN PRODUCCION FALLO ===');
    console.error(e);
  } finally {
    await browser.close();
    try { fs.unlinkSync(descargaPath); } catch (_) {}
  }
  process.exit(ok ? 0 : 1);
}

main();
