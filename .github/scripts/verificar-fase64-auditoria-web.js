// verificar-fase64-auditoria-web.js — QA de un solo uso, Fase 64.
//
// Foto de salud general por navegador: recorre Calidad, Trafico de
// Llamadas y (solo ORLANT) Trafico de WhatsApp en ORLANT + 4 clientes mas
// ya sabidos unificados (Fase 63), en claro/oscuro y escritorio/movil.
// Captura errores de consola reales (excluye ruido conocido: favicon 404,
// etc.) y busca texto NaN/undefined/[object Object] visible.
//
// Solo lectura: nunca crea, edita ni borra datos.
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.APP_URL || 'http://localhost:3000';
const ADMIN_USER = process.env.QA_ADMIN_USER || 'demo_admin';
const ADMIN_PW = process.env.QA_ADMIN_PW;
const OUT_DIR = process.env.OUT_DIR ||
  path.join(__dirname, '..', '..', 'docs', 'capturas-demo', 'fase64-auditoria-completa');

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 412, height: 915 };

// ORLANT es el unico con Trafico de WhatsApp real -- se recorre aparte.
const CLIENTES = [
  { cliente: 'ORLANT', calidad: true, trafico: true, whatsapp: true },
  { cliente: 'CLINICA AURORA', calidad: true, trafico: true, whatsapp: false },
  { cliente: 'BIVETT', calidad: true, trafico: true, whatsapp: false },
  { cliente: 'TELEVENTAS COMFAMA', calidad: true, trafico: true, whatsapp: false },
  { cliente: 'MOVILIZE', calidad: true, trafico: true, whatsapp: false },
];

const TEXTO_SOSPECHOSO = /\bNaN\b|\bundefined\b|\[object Object\]/;

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT_DIR, name), fullPage: false });
}
async function setTema(page, tema) {
  await page.evaluate((t) => { if (typeof aplicarTema === 'function') aplicarTema(t); }, tema);
  await page.waitForTimeout(200);
}

async function revisarPanel(page, cliente, tabKey, tabLabel) {
  await page.evaluate((k) => switchGenericTab(k), tabKey);
  await page.waitForTimeout(1100);
  const texto = await page.evaluate(() => {
    var host = document.getElementById('gd-p0');
    return host ? host.textContent : '';
  });
  const sospechoso = TEXTO_SOSPECHOSO.test(texto);
  return { cliente, tab: tabLabel, sospechoso, muestraTexto: sospechoso ? texto.slice(0, 300) : null };
}

(async () => {
  if (!ADMIN_PW) {
    console.error('Falta QA_ADMIN_PW en el entorno.');
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const resultado = { consolaErrores: [], panelesRevisados: [] };
  let ok = true;

  try {
    const page = await browser.newPage({ viewport: DESKTOP });
    page.on('dialog', (d) => d.accept());
    page.on('pageerror', (err) => resultado.consolaErrores.push({ tipo: 'pageerror', msg: err.message }));
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        const txt = msg.text();
        // Ruido conocido/irrelevante: ya documentado en fases anteriores.
        if (/favicon/i.test(txt)) return;
        resultado.consolaErrores.push({ tipo: 'console.error', msg: txt });
      }
    });

    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
    await page.fill('#username', ADMIN_USER);
    await page.fill('#password', ADMIN_PW);
    await page.click('button.btn-login');
    await page.waitForTimeout(1200);
    const loginErr = await page.locator('#login-error').innerText().catch(() => '');
    if (loginErr && loginErr.trim()) throw new Error('Login fallo: ' + loginErr.trim());
    resultado.loginOk = true;

    for (const { cliente, calidad, trafico, whatsapp } of CLIENTES) {
      for (const [temaKey, tema] of [['claro', 'light'], ['oscuro', 'dark']]) {
        await setTema(page, tema);
        await page.evaluate((c) => openGenericDashboard(c), cliente);
        await page.waitForTimeout(1200);

        if (calidad) {
          const r = await revisarPanel(page, cliente, 'calidad', 'Calidad');
          resultado.panelesRevisados.push(r);
          if (temaKey === 'claro') {
            const slug = cliente.toLowerCase().replace(/[^a-z0-9]+/g, '-');
            await shot(page, slug + '-calidad-' + temaKey + '-desktop.png');
          }
        }
        if (trafico) {
          const r = await revisarPanel(page, cliente, 'trafico', 'Trafico de Llamadas');
          resultado.panelesRevisados.push(r);
        }
        if (whatsapp) {
          const r = await revisarPanel(page, cliente, 'trafico_whatsapp', 'Trafico de WhatsApp');
          resultado.panelesRevisados.push(r);
          if (temaKey === 'claro') {
            await shot(page, 'orlant-whatsapp-' + temaKey + '-desktop.png');
          } else {
            await shot(page, 'orlant-whatsapp-' + temaKey + '-desktop.png');
          }
        }

        if (temaKey === 'oscuro') {
          const slug = cliente.toLowerCase().replace(/[^a-z0-9]+/g, '-');
          if (trafico) {
            await page.evaluate(() => switchGenericTab('trafico'));
            await page.waitForTimeout(700);
            await shot(page, slug + '-trafico-oscuro-desktop.png');
          }
        }

        await page.evaluate(() => { if (typeof closeGenericDashboard === 'function') closeGenericDashboard(); });
      }

      // Movil: solo claro, solo Trafico de Llamadas (representativo), por cliente.
      await setTema(page, 'light');
      await page.setViewportSize(MOBILE);
      await page.evaluate((c) => openGenericDashboard(c), cliente);
      await page.waitForTimeout(1200);
      if (trafico) {
        await page.evaluate(() => switchGenericTab('trafico'));
        await page.waitForTimeout(700);
        const slug = cliente.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        await shot(page, slug + '-trafico-claro-movil.png');
      }
      await page.evaluate(() => { if (typeof closeGenericDashboard === 'function') closeGenericDashboard(); });
      await page.setViewportSize(DESKTOP);
    }

    await page.close();

    const sospechosos = resultado.panelesRevisados.filter((p) => p.sospechoso);
    resultado.sospechososCount = sospechosos.length;
    resultado.sospechosos = sospechosos;
    resultado.consolaErroresCount = resultado.consolaErrores.length;

    ok = resultado.loginOk && sospechosos.length === 0 && resultado.consolaErrores.length === 0;
    resultado.ok = ok;
    console.log('=== RESULTADO FINAL ===');
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
