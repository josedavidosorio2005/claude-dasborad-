// capturas-fase45-headers.js — QA de un solo uso, Fase 45: confirma visualmente
// que la franja global de KPIs (arriba de las pestanas) de CLINICA AURORA y
// HOSPITAL LA MARIA dejo de repetir Total/Contestadas/Abandonadas/Nivel de
// Atencion (ahora solo en el resumen de "Trafico de Llamadas"). Solo lectura.
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.APP_URL || 'http://localhost:3000';
const STATE = process.env.STATE || 'despues';
const OUT_DIR = process.env.OUT_DIR ||
  path.join(__dirname, '..', '..', 'docs', 'capturas-demo', 'fase45-trafico-y-valores');
const CRED_FILE = path.join(__dirname, '..', '..', 'server', 'data', 'seed-demo-credenciales.txt');
const DESKTOP = { width: 1440, height: 900 };

function leerCredencialAdmin() {
  const txt = fs.readFileSync(CRED_FILE, 'utf8');
  const linea = txt.split('\n').find((l) => l.startsWith('ADMIN\t'));
  const user = linea.match(/user:\s*(\S+)/)[1];
  const password = linea.match(/password:\s*(\S+)/)[1];
  return { user, password };
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const { user, password } = leerCredencialAdmin();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: DESKTOP });
    page.on('dialog', (d) => d.accept());
    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
    await page.fill('#username', user);
    await page.fill('#password', password);
    await page.click('button.btn-login');
    await page.waitForTimeout(1200);

    for (const cliente of ['CLINICA AURORA', 'HOSPITAL LA MARIA']) {
      await page.evaluate((t) => { if (typeof aplicarTema === 'function') aplicarTema(t); }, 'light');
      await page.evaluate((c) => openGenericDashboard(c), cliente);
      await page.waitForTimeout(1200);
      const slug = cliente.toLowerCase().replace(/\s+/g, '-');
      await page.screenshot({ path: path.join(OUT_DIR, `header-${slug}-claro-desktop-${STATE}.png`), fullPage: false });
      const kpis = await page.evaluate(() => Array.from(document.querySelectorAll('#gd-kpis .aurora-kpi, #gd-kpis [class*=kpi]')).map(function(el){
        var t = (el.querySelector('.kl') || {}).textContent;
        return t;
      }).filter(Boolean));
      console.log(cliente, JSON.stringify(kpis));
      await page.evaluate(() => { if (typeof closeGenericDashboard === 'function') closeGenericDashboard(); });
      await page.waitForTimeout(300);
    }
    await page.close();
  } finally {
    await browser.close();
  }
})();
