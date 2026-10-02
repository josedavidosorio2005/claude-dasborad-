// verificar-fase110-estado-usuarios-ejemplo.js — Fase 110 (URGENTE), Parte 1.
// SOLO LECTURA en produccion: no crea, edita, suspende ni borra ningun
// usuario. Lee el estado actual (existe/activo/rol/fecha de creacion) de
// los 6 usuarios de ejemplo de server/db.js con la sesion del usuario.
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
  try {
    browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
    const logueado = await esperarLogin(page);
    if (!logueado) throw new Error('Se agoto el tiempo de espera de login (10 min) sin detectar sesion iniciada.');
    log('Login detectado, continuando automaticamente.');
    await page.waitForTimeout(1000);

    await page.evaluate(() => showSection('users'));
    await page.waitForTimeout(1200);

    const resultado = await page.evaluate(async (lista) => {
      const rows = await apiRequest('GET', '/users');
      return lista.map((u) => {
        const row = rows.find((r) => r.user === u);
        if (!row) return { user: u, existe: false };
        return { user: u, existe: true, active: row.active, rol: row.rol, createdAt: row.createdAt };
      });
    }, USUARIOS_EJEMPLO);

    log('=== ESTADO DE LOS 6 USUARIOS DE EJEMPLO ===');
    console.log(JSON.stringify(resultado, null, 2));

    // Historial: busca eventos relacionados a estos 6 usuarios (suspension,
    // activacion, cambio de contrasena) -- solo lectura.
    const historial = await page.evaluate(async (lista) => {
      const rows = await apiRequest('GET', '/historial');
      return rows.filter((h) => lista.includes(h.username));
    }, USUARIOS_EJEMPLO);
    log('=== EVENTOS EN HISTORIAL PARA ESOS 6 USUARIOS ===');
    console.log(JSON.stringify(historial, null, 2));
  } catch (e) {
    console.error('FALLO:', e.message);
    ok = false;
  } finally {
    if (browser) await browser.close();
  }
  process.exit(ok ? 0 : 1);
})();
