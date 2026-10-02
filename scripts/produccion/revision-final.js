// verificar-fase110-revision-final-produccion.js — Fase 110, Parte 3.
// SOLO LECTURA en produccion: no crea, edita, suspende ni borra ningun
// usuario. Confirma que, tras el deploy, ninguno de los 6 usuarios de
// ejemplo sigue activo con la contraseña de ejemplo, que el Historial
// registra la suspension automatica (si hubo), y que no hay errores de
// consola al navegar.
//
// Playwright DIRECTO desde Node (headless:false, navegador visible) -- NO
// la extension de Claude in Chrome (regla fija del proyecto, CLAUDE.md). El
// usuario inicia sesion a mano; el script nunca ve ni escribe la
// contrasena, no persiste storageState ni cookies en disco.
'use strict';
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'server', 'node_modules', 'playwright'));

const BASE = 'https://informa.inconexion.com.co';
const LOGIN_TIMEOUT_MS = 10 * 60 * 1000;
const USUARIOS_EJEMPLO = ['crodriguez', 'mlopez', 'jherrera', 'agomez', 'lrios', 'psuarez'];

function log(...args) { console.log(new Date().toISOString(), ...args); }

async function esperarLogin(page) {
  log('=== INICIA SESIÓN AHORA === (ventana de Chromium abierta, esperando hasta 10 min)');
  const deadline = Date.now() + LOGIN_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const logueado = await page.evaluate(() => typeof authToken !== 'undefined' && !!authToken).catch(() => false);
    if (logueado) return true;
    await page.waitForTimeout(3000);
  }
  return false;
}

(async () => {
  let browser;
  let ok = true;
  const erroresConsola = [];
  try {
    browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    page.on('pageerror', (e) => erroresConsola.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/favicon/i.test(m.text())) erroresConsola.push('console.error: ' + m.text()); });

    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
    const logueado = await esperarLogin(page);
    if (!logueado) throw new Error('Se agoto el tiempo de espera de login (10 min) sin detectar sesion iniciada.');
    log('Login detectado, continuando automaticamente.');
    await page.waitForTimeout(1000);

    await page.evaluate(() => showSection('users'));
    await page.waitForTimeout(1200);

    const usuarios = await page.evaluate(async (lista) => {
      const rows = await apiRequest('GET', '/users');
      return lista.map((u) => {
        const row = rows.find((r) => r.user === u);
        if (!row) return { user: u, existe: false };
        return { user: u, existe: true, active: row.active, rol: row.rol };
      });
    }, USUARIOS_EJEMPLO);
    log('=== ESTADO DE LOS 6 USUARIOS DE EJEMPLO (post-deploy) ===');
    console.log(JSON.stringify(usuarios, null, 2));

    const activosConEjemplo = usuarios.filter((u) => u.existe && u.active);
    if (activosConEjemplo.length > 0) {
      log('ADVERTENCIA: siguen activos (puede ser legitimo si ya tienen otra contraseña, la red de seguridad solo toca la contraseña de ejemplo):', activosConEjemplo.map((u) => u.user).join(', '));
    }

    const historial = await page.evaluate(async () => {
      const rows = await apiRequest('GET', '/historial');
      return rows.filter((h) => h.actor && h.actor.includes('Seguridad automatica'));
    });
    log('=== EVENTOS DE SUSPENSION AUTOMATICA EN HISTORIAL ===');
    console.log(JSON.stringify(historial, null, 2));

    await page.evaluate(() => showSection('historial'));
    await page.waitForTimeout(1500);

    log('Errores de consola:', erroresConsola.length === 0 ? 'OK (0)' : 'FALLO -- ' + JSON.stringify(erroresConsola));
    ok = erroresConsola.length === 0;
  } catch (e) {
    console.error('FALLO:', e.message);
    ok = false;
  } finally {
    if (browser) await browser.close();
  }
  process.exit(ok ? 0 : 1);
})();
