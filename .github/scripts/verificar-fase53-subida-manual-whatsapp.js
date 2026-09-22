// verificar-fase53-subida-manual-whatsapp.js — QA de un solo uso para la
// Fase 53: verificacion guiada, paso a paso, de la subida real del archivo
// de WhatsApp por el modal "Cargar Datos de Dashboards" (ya arreglado en la
// Fase 52) -- confirma que las filas rojas de la vista previa son solo
// informativas, que "Guardar carga" funciona, y que subir el mismo archivo
// dos veces actualiza (upsert) en vez de duplicar.
//
// El archivo real (PLANTILLA_TRAFICO_WHATSAPP_ORLANT.xlsx) NUNCA se
// comitea al repo -- vive solo en la maquina local de quien corre este
// script (mismo criterio que la Fase 36 con el archivo real de trafico de
// voz). Pasa ARCHIVO_REAL por env var si corres esto en otra maquina.
//
// Credenciales: lee server/data/seed-demo-credenciales.txt (gitignored,
// nunca se imprime aqui), usuario ADMIN sembrado. Solo contra un entorno de
// verificacion local (APP_URL), nunca produccion.
'use strict';
const fs = require('fs');
const path = require('path');
const REPO = path.join(__dirname, '..', '..');
const { chromium } = require(path.join(REPO, 'server', 'node_modules', 'playwright'));
const BASE = process.env.APP_URL || 'http://localhost:3000';
const CRED_FILE = path.join(REPO, 'server', 'data', 'seed-demo-credenciales.txt');
const ARCHIVO_REAL = process.env.ARCHIVO_REAL || 'C:\\Users\\filid\\Downloads\\PLANTILLA_TRAFICO_WHATSAPP_ORLANT.xlsx';
const OUT_DIR = path.join(REPO, 'docs', 'capturas-demo', 'fase53-subida-manual-web-whatsapp');

function leerCredencialAdmin() {
  const txt = fs.readFileSync(CRED_FILE, 'utf8');
  const linea = txt.split('\n').find((l) => l.startsWith('ADMIN\t'));
  return { user: linea.match(/user:\s*(\S+)/)[1], password: linea.match(/password:\s*(\S+)/)[1] };
}
async function shotFull(page, name) { await page.screenshot({ path: path.join(OUT_DIR, name), fullPage: true }); }

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const { user, password } = leerCredencialAdmin();
  const browser = await chromium.launch();
  const resultado = {};
  const consoleErrores = [];

  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrores.push(msg.text()); });
    page.on('pageerror', (e) => consoleErrores.push('pageerror: ' + e.message));
    page.on('dialog', (d) => { resultado.dialogVisto = (resultado.dialogVisto || []).concat(d.message()); d.accept(); });
    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
    await page.fill('#username', user);
    await page.fill('#password', password);
    await page.click('button.btn-login');
    await page.waitForTimeout(1200);

    // ── Paso 1: abrir el modal, elegir cliente ORLANT ──
    await page.evaluate(() => openCargas());
    await page.waitForTimeout(800);
    await page.selectOption('#carga-cliente', 'ORLANT');
    await page.waitForTimeout(500);
    await shotFull(page, '01-modal-abierto-orlant.png');

    // ── Paso 2: elegir el archivo REAL ──
    await page.setInputFiles('#carga-file', ARCHIVO_REAL);
    await page.waitForTimeout(1000);
    resultado.previewVisible = await page.evaluate(() => document.getElementById('carga-preview-card').style.display !== 'none');
    await shotFull(page, '02-vista-previa-completa.png');

    resultado.filasPreview = await page.evaluate(() => {
      var rows = Array.from(document.querySelectorAll('#carga-preview-table tr'));
      return rows.map(function (tr) { return Array.from(tr.querySelectorAll('td,th')).map(function (td) { return td.textContent.trim(); }); });
    });
    // Confirmar que el boton "Guardar carga" NO esta deshabilitado.
    resultado.botonGuardarDisabled = await page.evaluate(() => {
      var btn = document.querySelector('#carga-preview-card button.btn-primary');
      return btn ? btn.disabled : null;
    });

    // ── Paso 3: clic en "Guardar carga" (primera vez) ──
    await page.click('#carga-preview-card button.btn-primary');
    await page.waitForTimeout(1500);
    resultado.toastPrimeraCarga = await page.evaluate(() => { var t = document.getElementById('toast'); return t ? t.textContent : null; });
    await shotFull(page, '03-mensaje-exito-primera-carga.png');

    // ── Paso 4: pestana "Trafico de WhatsApp" del dashboard ──
    await page.evaluate(() => closeCargas());
    await page.waitForTimeout(400);
    await page.evaluate(() => openGenericDashboard('ORLANT'));
    await page.waitForTimeout(1200);
    await page.evaluate(() => switchGenericTab('trafico_whatsapp'));
    await page.waitForTimeout(1500);
    resultado.kpisTrasPrimeraCarga = await page.evaluate(() => Array.from(document.querySelectorAll('#tww-kpis-0 .aurora-kpi .kv')).map((el) => el.textContent));
    await shotFull(page, '04-tab-whatsapp-con-datos.png');
    await page.evaluate(() => closeGenericDashboard());
    await page.waitForTimeout(400);

    // ── Paso 5: subir el MISMO archivo una segunda vez (duplicado) ──
    await page.evaluate(() => openCargas());
    await page.waitForTimeout(800);
    await page.selectOption('#carga-cliente', 'ORLANT');
    await page.waitForTimeout(500);
    await page.setInputFiles('#carga-file', ARCHIVO_REAL);
    await page.waitForTimeout(1000);
    await shotFull(page, '05-vista-previa-segunda-subida.png');
    await page.click('#carga-preview-card button.btn-primary');
    await page.waitForTimeout(1500);
    resultado.toastSegundaCarga = await page.evaluate(() => { var t = document.getElementById('toast'); return t ? t.textContent : null; });
    await shotFull(page, '06-mensaje-segunda-carga.png');

    resultado.consoleErrores = consoleErrores;
    resultado.ok = true;
  } catch (e) {
    resultado.ok = false;
    resultado.error = e.message;
    resultado.consoleErrores = consoleErrores;
  } finally {
    await browser.close();
  }

  fs.writeFileSync(path.join(OUT_DIR, 'hallazgos.json'), JSON.stringify(resultado, null, 2));
  console.log(JSON.stringify(resultado, null, 2));
})();
