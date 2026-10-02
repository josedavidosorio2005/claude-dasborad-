// generar-pdf-guia-uso.js — Fase 100 (Tema B) / Fase 102 (la guia ya
// requiere sesion). Convierte la guia de uso a PDF con `page.pdf()` de
// Playwright, EN LOCAL (http://localhost:3000, con npm run seed:demo). La
// guia ya no es un archivo estatico publico (Fase 102): se pide con el
// token de la sesion desde el boton "Guía de uso" del menu de usuario, que
// la abre en una pestaña nueva -- este script inicia sesion como admin de
// demo y hace clic en ese mismo boton real, igual que una persona.
// El PDF sale FUERA del repo, en
// `C:\Users\filid\Documents\trabajo inconexion\entregables\`.
'use strict';
const fs = require('fs');
const path = require('path');

const SERVER_DIR = path.join(__dirname, '..', '..', 'server');
const { chromium } = require(path.join(SERVER_DIR, 'node_modules', 'playwright'));

const BASE = process.env.LOCAL_URL || 'http://localhost:3000';
const OUT_DIR = 'C:\\Users\\filid\\Documents\\trabajo inconexion\\entregables';
// Fase 112: el nombre llevaba "v1.2" fijo desde la Fase 100 -- quedo
// desactualizado (hoy v1.9.0). Se lee de server/package.json para que
// nunca mas quede atras de un bump de version real.
const APP_VERSION = require(path.join(SERVER_DIR, 'package.json')).version;
const OUT_FILE = path.join(OUT_DIR, `Guia_de_uso_ORLANT_v${APP_VERSION}.pdf`);
const CRED_FILE = path.join(SERVER_DIR, 'data', 'seed-demo-credenciales.txt');

function leerCredenciales() {
  const texto = fs.readFileSync(CRED_FILE, 'utf8');
  const creds = {};
  texto.split('\n').forEach((linea) => {
    const m = linea.match(/^(\w+)\s+user:\s*(\S+)\s+password:\s*(\S+)/);
    if (m) creds[m[1]] = { user: m[2], password: m[3] };
  });
  return creds;
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const creds = leerCredenciales();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
    await page.fill('#username', creds.ADMIN.user);
    await page.fill('#password', creds.ADMIN.password);
    await page.click('.btn-login');
    await page.waitForFunction(() => typeof authToken !== 'undefined' && !!authToken, { timeout: 10000 });
    await page.waitForTimeout(600);

    const [guia] = await Promise.all([
      page.waitForEvent('popup'),
      page.click('button.navbar-help-link'),
    ]);
    await guia.waitForLoadState('networkidle');
    await guia.pdf({
      path: OUT_FILE,
      format: 'A4',
      printBackground: true,
      margin: { top: '14mm', bottom: '14mm', left: '12mm', right: '12mm' },
    });
    console.log('PDF generado:', OUT_FILE);
  } finally {
    await browser.close();
  }
})();
