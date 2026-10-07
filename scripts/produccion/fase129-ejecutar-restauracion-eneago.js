// fase129-ejecutar-restauracion-eneago.js — Script de un solo uso, Fase
// 129. Paso 1 de la Opción B aprobada por el usuario (dry-run ya
// confirmado, "sí" explícito dado): sube por la interfaz real el archivo
// COMPLETO ene-ago (83.006 filas) y ACEPTA el diálogo de confirmación
// real -- esta vez SÍ guarda, a propósito, porque el usuario ya dijo
// "sí" a los números exactos (352 filas/54 entidades/11.189 citas/786
// inasistencias en agosto) que mostró el dry-run anterior.
//
// Antes de aceptar el guardado real, vuelve a comprobar que el preview
// (parseo en el navegador, antes de cualquier llamada al servidor)
// sigue dando EXACTAMENTE esos números -- si algo no calza, aborta SIN
// guardar.
//
// Playwright DIRECTO desde Node (headless:false) -- NO la extensión de
// Claude in Chrome (CLAUDE.md). Respaldo manual YA confirmado
// (integrity_check ok, S3 OK) antes de correr este script.
//
// PRIVACIDAD: nunca imprime NOMBRE ENTIDAD.
'use strict';
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'server', 'node_modules', 'playwright'));

const BASE = 'https://informa.inconexion.com.co';
const LOGIN_TIMEOUT_MS = 10 * 60 * 1000;
const ARCHIVO_ENEAGO = 'C:\\Users\\filid\\Downloads\\INASISTENCIA NUEVA PARA MONTAR (1).xlsx';

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
  const reporte = {};
  try {
    browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const erroresConsola = [];
    page.on('pageerror', (e) => erroresConsola.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/favicon/i.test(m.text())) erroresConsola.push('console.error: ' + m.text()); });

    let dialogoMensaje = null;
    page.on('dialog', (d) => {
      dialogoMensaje = d.message();
      log('Diálogo de confirmación REAL (solo meses/especialidades/conteo, nunca entidades):');
      log(dialogoMensaje);
      d.accept();
    });

    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
    const logueado = await esperarLogin(page);
    if (!logueado) throw new Error('Se agotó el tiempo de espera de login (10 min) sin detectar sesión iniciada.');
    log('Login detectado, continuando automáticamente.');
    await page.waitForTimeout(500);

    await page.evaluate(() => openCargas());
    await page.waitForTimeout(800);
    await page.selectOption('#carga-cliente', 'ORLANT');
    await page.waitForTimeout(800);

    log('Subiendo el archivo COMPLETO ene-ago (83.006 filas reales)...');
    await page.setInputFiles('#carga-file', ARCHIVO_ENEAGO);
    let listo = false;
    for (let i = 0; i < 40; i++) {
      listo = await page.evaluate(() => Array.isArray(_cargasResultados) && _cargasResultados.some((r) => r.tipo === 'inasistencia' && r.filas));
      if (listo) break;
      await page.waitForTimeout(1000);
    }
    if (!listo) throw new Error('El archivo no se reconoció como Inasistencia (timeout de 40s) -- abortado SIN guardar.');

    const preview = await page.evaluate(() => {
      const r = _cargasResultados.find((x) => x.tipo === 'inasistencia');
      const ago = r.filas.filter((f) => f.mes === '2026-08');
      const tot = ago.reduce((a, f) => ({ total: a.total + f.total, inasistencia: a.inasistencia + f.inasistencia }), { total: 0, inasistencia: 0 });
      return {
        filasAgregadasTotal: r.filas.length,
        agosto: { filas: ago.length, entidadesDistintas: new Set(ago.map((f) => f.entidad)).size, total: tot.total, inasistencia: tot.inasistencia },
      };
    });
    log('Preview antes de guardar:', JSON.stringify(preview));
    reporte.preview = preview;

    const okControl = preview.filasAgregadasTotal === 2664 && preview.agosto.filas === 352 &&
      preview.agosto.entidadesDistintas === 54 && preview.agosto.total === 11189 && preview.agosto.inasistencia === 786;
    if (!okControl) {
      throw new Error('El preview NO coincide con los numeros ya aprobados (352/54/11189/786, 2664 total) -- ABORTADO SIN GUARDAR: ' + JSON.stringify(preview));
    }
    log('Preview coincide EXACTO con los números aprobados -- procediendo a guardar de verdad.');

    await page.click('#carga-preview-card .btn-primary:has-text("Guardar carga")');
    await page.waitForTimeout(3000);
    const toast = await page.evaluate(() => (document.getElementById('toast') || {}).innerText || '');
    log('Resultado del guardado (toast):', toast);
    reporte.toast = toast;
    reporte.dialogoMensaje = dialogoMensaje;

    if (erroresConsola.length) {
      log('ERRORES DE CONSOLA:', JSON.stringify(erroresConsola));
      reporte.erroresConsola = erroresConsola;
      ok = false;
    } else {
      log('0 errores de consola.');
    }

    if (!/✓/.test(toast) || /✗/.test(toast)) {
      throw new Error('El toast no confirma un guardado OK: ' + toast);
    }

    reporte.ok = true;
    console.log('\n=== RESUMEN FINAL (JSON) ===');
    console.log(JSON.stringify(reporte, null, 2));
  } catch (e) {
    console.error('FALLO:', e.message);
    ok = false;
  } finally {
    if (browser) await browser.close();
  }
  process.exit(ok ? 0 : 1);
})();
