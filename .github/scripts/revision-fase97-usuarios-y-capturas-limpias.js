// revision-fase97-usuarios-y-capturas-limpias.js — Fase 97 (parte no-AWS) +
// Fase 98 (capturas limpias para Edwin). SOLO LECTURA en produccion: no crea,
// edita ni borra ningun usuario, no sube ni cambia ningun dato.
//
// 1. Quien tiene hoy el rol REPORTES o el permiso cargarDatos (lista en
//    stdout, nunca en el repo).
// 2. Repite las capturas de la pestaña Inasistencia sin el panel "Cargar
//    Datos" superpuesto (cerrandolo antes de abrir el dashboard, a
//    diferencia del script de la Fase 98 Tema D).
//
// Playwright DIRECTO desde Node (headless:false, navegador visible) -- NO
// la extension de Claude in Chrome (regla fija del proyecto, CLAUDE.md). El
// usuario inicia sesion a mano; el script nunca ve ni escribe la
// contrasena, no persiste storageState ni cookies en disco.
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'https://informa.inconexion.com.co';
const OUT_DIR = 'C:\\Users\\filid\\Documents\\trabajo inconexion\\bases edwin\\capturas-produccion\\fase98-inasistencia\\limpias';
const LOGIN_TIMEOUT_MS = 10 * 60 * 1000;

function log(...args) { console.log(new Date().toISOString(), ...args); }

async function shot(page, name) {
  try { await page.screenshot({ path: path.join(OUT_DIR, name), fullPage: false }); } catch (e) { log('WARN screenshot fallo:', e.message); }
}

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
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const erroresConsola = [];
  let browser;
  let ok = true;

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

    // ── 1. Quien tiene REPORTES o cargarDatos (solo lectura, GET /users) ──
    await page.evaluate(() => showSection('users'));
    await page.waitForTimeout(1200);
    await shot(page, '0-usuarios-y-permisos.png');

    const usuarios = await page.evaluate(async () => {
      const rows = await apiRequest('GET', '/users');
      function campanasDe(perms) {
        return Object.keys(perms || {})
          .filter((k) => (k.indexOf('campana_') === 0 || k.indexOf('cliente_') === 0) && perms[k] === true)
          .map((k) => k.replace(/^campana_|^cliente_/, ''));
      }
      return rows
        .filter((u) => u.rol === 'REPORTES' || (u.perms && u.perms.cargarDatos === true))
        .map((u) => ({
          user: u.user, nombre: u.nombre, rol: u.rol, active: u.active,
          cargarDatos: !!(u.perms && u.perms.cargarDatos === true),
          campanas: campanasDe(u.perms),
        }));
    });
    console.log('=== USUARIOS CON ROL REPORTES O PERMISO cargarDatos ===');
    console.log(JSON.stringify(usuarios, null, 2));

    // ── 2. Capturas limpias de Inasistencia (cierra "Cargar Datos" antes) ──
    const cargasVisible = await page.evaluate(() => {
      const el = document.getElementById('page-cargas') || document.querySelector('[data-page="cargas"]');
      return !!(el && el.offsetParent !== null);
    }).catch(() => false);
    if (cargasVisible) { await page.evaluate(() => showSection('users')); await page.waitForTimeout(500); }

    await page.evaluate(() => openGenericDashboard('ORLANT'));
    await page.waitForTimeout(1500);
    await page.evaluate(() => { if (typeof _gdIrAMes === 'function') _gdIrAMes('2026-08'); });
    await page.waitForTimeout(1000);
    await page.evaluate(() => switchGenericTab('inasistencia'));
    await page.waitForTimeout(1200);

    await page.evaluate(() => switchGenericSubtab('porespecialidad'));
    await page.waitForTimeout(1200);
    await shot(page, '1-por-especialidad-ago26.png');

    await page.evaluate(() => switchGenericSubtab('pormes'));
    await page.waitForTimeout(1200);
    await shot(page, '2-por-mes.png');

    await page.evaluate(() => switchGenericSubtab('detalle'));
    await page.waitForTimeout(1200);
    await shot(page, '3-detalle-ago26.png');

    await page.evaluate(() => { if (typeof _gdIrAMes === 'function') _gdIrAMes('2026-09'); });
    await page.waitForTimeout(1000);
    await page.evaluate(() => switchGenericSubtab('porespecialidad'));
    await page.waitForTimeout(1200);
    await shot(page, '4-aviso-septiembre.png');

    await page.evaluate(() => closeGenericDashboard());
    await page.waitForTimeout(300);

    log('=== RESULTADO ===');
    log('Usuarios con REPORTES/cargarDatos encontrados:', usuarios.length);
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
