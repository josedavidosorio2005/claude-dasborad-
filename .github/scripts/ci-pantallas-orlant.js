// ci-pantallas-orlant.js — Fase 112, Parte 1.2 (autorizado): job nuevo de
// CI que recorre ORLANT (admin, cada pestana y sub-pestana real, claro,
// escritorio) con Playwright headless y falla si hay un error de consola,
// una peticion fallida inesperada (los 403 de permisos no cuentan), una
// respuesta 5xx, o un <canvas> dentro de #gd-panels sin pixeles pintados
// -- el bug de la Fase 111 (Ranking de Asesores / Efectividad de Citas no
// se dibujaban) que se le escapo a las pruebas porque solo chequeaban que
// el objeto Chart.js existiera, nunca el canvas real (ver tambien
// .github/scripts/verificar-fase102-auditoria-amplia-local.js, la version
// amplia de este mismo chequeo para QA manual).
//
// Deliberadamente LIVIANO (un solo rol, un solo tema/viewport, sin
// Exportar): es un smoke test de "no se rompio nada visible", pensado para
// correr en cada PR en menos de 5 minutos -- la auditoria completa
// (todos los roles, temas, viewports, exports) es manual, ver
// verificar-fase102-auditoria-amplia-local.js.
'use strict';
const fs = require('fs');
const path = require('path');

const SERVER_DIR = path.join(__dirname, '..', '..', 'server');
const { chromium } = require(path.join(SERVER_DIR, 'node_modules', 'playwright'));
const BASE = process.env.APP_URL || 'http://localhost:3000';
const CRED_FILE = path.join(SERVER_DIR, 'data', 'seed-demo-credenciales.txt');
const CAPTURAS_DIR = path.join(SERVER_DIR, 'ci-capturas-fallo');

function leerAdmin() {
  const texto = fs.readFileSync(CRED_FILE, 'utf8');
  const m = texto.match(/^ADMIN\tuser:\s*(\S+)\s+password:\s*(\S+)/m);
  if (!m) throw new Error('No se encontraron credenciales ADMIN en ' + CRED_FILE);
  return { user: m[1], password: m[2] };
}

async function canvasesSinDibujar(page) {
  return page.evaluate(() => {
    const out = [];
    const host = document.getElementById('gd-panels');
    if (!host) return out;
    // Fase 112 (hallazgo real en produccion, Calidad/gd-c1): si el panel
    // esta mostrando un aviso de "Sin datos de <X> para <mes>" (los 5
    // paneles autonomos -- Agendas/Inasistencia/Tipificacion/Efectividad/
    // Calidad -- lo hacen con mesSel sin datos), el canvas asociado se
    // deja SIN DIBUJAR a proposito (ver _gdRenderCalidad en
    // dashboard-generic.js, "evita un donut vacio sin explicacion") --
    // eso no es el bug de la Fase 111, es manejo correcto de "sin datos".
    if (/Sin datos de/.test(host.innerText)) return out;
    host.querySelectorAll('canvas').forEach((c) => {
      const rect = c.getBoundingClientRect();
      const style = getComputedStyle(c);
      if (style.display === 'none' || style.visibility === 'hidden') return;
      if (rect.width < 5 || rect.height < 5) {
        out.push({ id: c.id || '(sin id)', motivo: 'tamano-cero-en-pantalla', width: rect.width, height: rect.height });
        return;
      }
      let ctx;
      try { ctx = c.getContext('2d'); } catch (e) { return; }
      if (!ctx) return;
      let data;
      try { data = ctx.getImageData(0, 0, c.width, c.height).data; } catch (e) {
        out.push({ id: c.id || '(sin id)', motivo: 'error-leyendo-canvas', error: e.message });
        return;
      }
      let tienePixel = false;
      for (let i = 3; i < data.length; i += 4) { if (data[i] !== 0) { tienePixel = true; break; } }
      if (!tienePixel) out.push({ id: c.id || '(sin id)', motivo: 'sin-pixeles-dibujados', width: c.width, height: c.height });
    });
    return out;
  });
}

(async () => {
  fs.mkdirSync(CAPTURAS_DIR, { recursive: true });
  const admin = leerAdmin();
  const hallazgos = [];
  let ctxActual = 'arranque';

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  page.on('pageerror', (err) => hallazgos.push({ tipo: 'pageerror', ctx: ctxActual, msg: err.message }));
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const txt = msg.text();
    if (/favicon/i.test(txt)) return;
    hallazgos.push({ tipo: 'console.error', ctx: ctxActual, msg: txt });
  });
  page.on('requestfailed', (req) => {
    hallazgos.push({ tipo: 'request-failed', ctx: ctxActual, url: req.url(), error: req.failure() && req.failure().errorText });
  });
  page.on('response', (res) => {
    const st = res.status();
    if (st === 403) return; // permisos esperados segun el rol
    if (st >= 500) hallazgos.push({ tipo: 'response-5xx', ctx: ctxActual, url: res.url(), status: st });
  });

  try {
    ctxActual = 'login ADMIN';
    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
    await page.fill('#username', admin.user);
    await page.fill('#password', admin.password);
    await page.click('button.btn-login');
    await page.waitForTimeout(1000);

    ctxActual = 'abrir ORLANT';
    await page.evaluate(() => openGenericDashboard('ORLANT'));
    await page.waitForTimeout(1200);

    const nTabs = await page.locator('#gd-tabs .atab').count();
    for (let i = 0; i < nTabs; i++) {
      const tab = page.locator('#gd-tabs .atab').nth(i);
      const label = (await tab.textContent() || '').trim();
      await tab.click();
      await page.waitForTimeout(900);
      ctxActual = 'ORLANT > ' + label;
      const antes = hallazgos.length;
      const canvasesMalos = await canvasesSinDibujar(page);
      canvasesMalos.forEach((c) => hallazgos.push({ tipo: 'canvas-' + c.motivo, ctx: ctxActual, canvas: c.id, detalle: c }));
      if (hallazgos.length > antes) {
        await page.screenshot({ path: path.join(CAPTURAS_DIR, `fallo-${i}-${label.replace(/[^a-z0-9]+/gi, '-')}.png`) }).catch(() => {});
      }

      const nSub = await page.locator('.gd-subtab-btn').count();
      for (let j = 0; j < nSub; j++) {
        const sub = page.locator('.gd-subtab-btn').nth(j);
        const subLabel = (await sub.textContent() || '').trim();
        await sub.click();
        await page.waitForTimeout(700);
        ctxActual = 'ORLANT > ' + label + ' > ' + subLabel;
        const antesSub = hallazgos.length;
        const canvasesMalosSub = await canvasesSinDibujar(page);
        canvasesMalosSub.forEach((c) => hallazgos.push({ tipo: 'canvas-' + c.motivo, ctx: ctxActual, canvas: c.id, detalle: c }));
        if (hallazgos.length > antesSub) {
          await page.screenshot({ path: path.join(CAPTURAS_DIR, `fallo-${i}-${j}-${subLabel.replace(/[^a-z0-9]+/gi, '-')}.png`) }).catch(() => {});
        }
      }
    }
  } catch (e) {
    hallazgos.push({ tipo: 'excepcion', ctx: ctxActual, error: e.message });
    await page.screenshot({ path: path.join(CAPTURAS_DIR, 'fallo-excepcion.png') }).catch(() => {});
  } finally {
    await browser.close();
  }

  console.log('=== RESULTADO ===');
  console.log(JSON.stringify({ totalHallazgos: hallazgos.length, hallazgos }, null, 2));
  if (hallazgos.length === 0) {
    console.log('OK: ORLANT completo (admin, claro, escritorio) sin errores de consola, peticiones fallidas ni canvas sin dibujar.');
  }
  process.exit(hallazgos.length ? 1 : 0);
})();
