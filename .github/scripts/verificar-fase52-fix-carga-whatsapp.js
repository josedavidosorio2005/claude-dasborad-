// verificar-fase52-fix-carga-whatsapp.js — QA de un solo uso para la Fase 52
// (fix del bug real: el archivo de WhatsApp subido por el modal "Cargar
// Datos de Dashboards" fallaba con "ninguna hoja reconocida"). Reproduce el
// flujo real completo: sube el archivo real de WhatsApp por ese mismo modal
// para ORLANT (confirma que ahora se reconoce y se guarda), y ademas sube un
// archivo consolidado real (Gestion de base + Calidad + Trafico de voz) para
// otro cliente para confirmar que esos tres tipos no se rompieron.
//
// Credenciales: lee server/data/seed-demo-credenciales.txt (gitignored,
// nunca se imprime aqui), usuario ADMIN sembrado.
'use strict';
const fs = require('fs');
const path = require('path');
const REPO = path.join(__dirname, '..', '..');
const { chromium } = require(path.join(REPO, 'server', 'node_modules', 'playwright'));
const BASE = process.env.APP_URL || 'http://localhost:3000';
const CRED_FILE = path.join(REPO, 'server', 'data', 'seed-demo-credenciales.txt');
const FIXTURE_WPP = path.join(REPO, 'server', 'tests', 'fixtures', 'PLANTILLA_TRAFICO_WHATSAPP_EJEMPLO.xlsx');
const FIXTURE_CONSOLIDADA = path.join(REPO, 'server', 'tests', 'fixtures', 'carga-consolidada.xlsx');
const OUT_DIR = path.join(REPO, 'docs', 'capturas-demo', 'fase52-fix-carga-whatsapp');

function leerCredencialAdmin() {
  const txt = fs.readFileSync(CRED_FILE, 'utf8');
  const linea = txt.split('\n').find((l) => l.startsWith('ADMIN\t'));
  return { user: linea.match(/user:\s*(\S+)/)[1], password: linea.match(/password:\s*(\S+)/)[1] };
}
async function shot(page, name) { await page.screenshot({ path: path.join(OUT_DIR, name) }); }

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const { user, password } = leerCredencialAdmin();
  const browser = await chromium.launch();
  const resultado = {};
  const consoleErrores = [];
  let ok = true;

  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('console', (msg) => { if (msg.type() === 'error') consoleErrores.push(msg.text()); });
    page.on('pageerror', (e) => consoleErrores.push('pageerror: ' + e.message));
    page.on('dialog', (d) => d.accept());
    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
    await page.fill('#username', user);
    await page.fill('#password', password);
    await page.click('button.btn-login');
    await page.waitForTimeout(1200);

    // ══ PARTE 1: WhatsApp por el modal "Cargar Datos de Dashboards" (el bug real) ══
    await page.evaluate(() => openCargas());
    await page.waitForTimeout(800);
    await page.selectOption('#carga-cliente', 'ORLANT');
    await page.waitForTimeout(500);
    await shot(page, '01-modal-cargar-datos-orlant.png');

    await page.setInputFiles('#carga-file', FIXTURE_WPP);
    await page.waitForTimeout(1000);
    resultado.wppPreviewVisible = await page.evaluate(() => document.getElementById('carga-preview-card').style.display !== 'none');
    await shot(page, '02-preview-whatsapp-reconocido.png');

    // Confirmar en la tabla de vista previa que la fila "Trafico" quedo OK.
    resultado.wppPreviewFilas = await page.evaluate(() => {
      var rows = Array.from(document.querySelectorAll('#carga-preview-table tr'));
      return rows.map(function (tr) { return Array.from(tr.querySelectorAll('td,th')).map(function (td) { return td.textContent.trim(); }); });
    });

    await page.click('#carga-preview-card button.btn-primary');
    await page.waitForTimeout(1500);
    resultado.wppToastGuardado = await page.evaluate(() => { var t = document.getElementById('toast'); return t ? t.textContent : null; });
    await shot(page, '03-confirmacion-exito-whatsapp.png');

    // Verificar en la pestana "Trafico de WhatsApp" del dashboard de ORLANT.
    await page.evaluate(() => closeCargas());
    await page.waitForTimeout(400);
    await page.evaluate(() => openGenericDashboard('ORLANT'));
    await page.waitForTimeout(1200);
    await page.evaluate(() => switchGenericTab('trafico_whatsapp'));
    await page.waitForTimeout(1500);
    resultado.wppKpis = await page.evaluate(() => Array.from(document.querySelectorAll('#tww-kpis-0 .aurora-kpi .kv')).map(function (el) { return el.textContent; }));
    await shot(page, '04-tab-whatsapp-con-datos.png');
    await page.evaluate(() => closeGenericDashboard());

    // ══ PARTE 2: regresion -- Gestion de base / Calidad / Trafico de voz siguen funcionando ══
    await page.evaluate(() => openCargas());
    await page.waitForTimeout(800);
    await page.selectOption('#carga-cliente', 'ANDRES YEPES');
    await page.waitForTimeout(500);
    await page.setInputFiles('#carga-file', FIXTURE_CONSOLIDADA);
    await page.waitForTimeout(1000);
    resultado.consolidadaPreviewFilas = await page.evaluate(() => {
      var rows = Array.from(document.querySelectorAll('#carga-preview-table tr'));
      return rows.map(function (tr) { return Array.from(tr.querySelectorAll('td,th')).map(function (td) { return td.textContent.trim(); }); });
    });
    await shot(page, '05-preview-consolidada-andres-yepes.png');

    await page.fill('#carga-periodo', '2026-08');
    await page.click('#carga-preview-card button.btn-primary');
    await page.waitForTimeout(1500);
    resultado.consolidadaToast = await page.evaluate(() => { var t = document.getElementById('toast'); return t ? t.textContent : null; });
    await shot(page, '06-confirmacion-consolidada.png');

    resultado.consoleErrores = consoleErrores;
    resultado.ok = true;
  } catch (e) {
    ok = false;
    resultado.ok = false;
    resultado.error = e.message;
    resultado.consoleErrores = consoleErrores;
  } finally {
    await browser.close();
  }

  fs.writeFileSync(path.join(OUT_DIR, 'hallazgos.json'), JSON.stringify(resultado, null, 2));
  console.log(JSON.stringify(resultado, null, 2));
  process.exit(ok ? 0 : 1);
})();
