// fase122-recarga-tipificacion-alias-falla.js — Script de un solo uso.
// Cierra el pendiente que dejo la Parte 2 de la Fase 122 (ver
// docs/pendientes.md -> "Re-carga del archivo de voz para consolidar el
// alias '_falla'"): re-sube TIPIFICACIONES.xlsx (mismo archivo de
// Tipificacion de Llamadas/HistCDR ya en produccion, 34.661 filas) para que
// el alias de nombre de asesor registrado en la Fase 122 (Parte 1) se
// aplique a las filas que hoy quedan guardadas con la variante "_falla".
// Autorizado explicitamente por el usuario en el chat para ESTE archivo
// puntual (confirmacion recibida tras verificar en LOCAL, con la misma
// logica de reconocimiento de la plataforma, que este archivo coincide
// exacto -- 34.661 filas -- con lo que ya hay en produccion).
//
// Por la interfaz normal de "Cargar Datos de Dashboards" -- nunca SQL
// directo, nunca un workflow (ver CLAUDE.md). Playwright DIRECTO desde Node
// (headless:false, navegador visible) -- NO la extension de Claude in
// Chrome. El usuario inicia sesion a mano en PRODUCCION; el script nunca ve
// ni escribe la contrasena, no persiste storageState/cookies en disco.
//
// Solo imprime/guarda ESTRUCTURA y AGREGADOS (conteos, listas de nombres
// SOLO para confirmar presencia/ausencia de la variante "_falla" por
// patron, nunca se imprime el listado completo) -- capturas fuera del
// repo, en "bases edwin\capturas-produccion\fase122-tipificacion-realias\".
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require(path.join(__dirname, '..', '..', 'server', 'node_modules', 'playwright'));

const BASE = 'https://informa.inconexion.com.co';
const ARCHIVO = 'C:\\Users\\filid\\Downloads\\TIPIFICACIONES.xlsx';
const OUT_DIR = 'C:\\Users\\filid\\Documents\\trabajo inconexion\\bases edwin\\capturas-produccion\\fase122-tipificacion-realias';
const LOGIN_TIMEOUT_MS = 10 * 60 * 1000;

function log(...args) { console.log(new Date().toISOString(), ...args); }

async function shot(page, name) {
  try { await page.screenshot({ path: path.join(OUT_DIR, name), fullPage: false }); } catch (e) { log('WARN screenshot fallo:', e.message); }
}

async function esperarLogin(page) {
  log('=== INICIA SESIÓN AHORA EN PRODUCCIÓN === (ventana de Chromium abierta, esperando hasta 10 min)');
  const deadline = Date.now() + LOGIN_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const logueado = await page.evaluate(() => typeof authToken !== 'undefined' && !!authToken).catch(() => false);
    if (logueado) return true;
    await page.waitForTimeout(3000);
  }
  return false;
}

(async () => {
  if (!fs.existsSync(ARCHIVO)) throw new Error('No se encontro el archivo real: ' + ARCHIVO);
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const erroresConsola = [];
  const reporte = { antes: {}, carga: {}, despues: {} };
  let ok = true;
  let browser;
  let ultimoDialogMsg = '';

  try {
    browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    page.on('dialog', (d) => { ultimoDialogMsg = d.message(); d.accept(); });
    page.on('pageerror', (e) => erroresConsola.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/favicon/i.test(m.text())) erroresConsola.push('console.error: ' + m.text()); });

    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
    const logueado = await esperarLogin(page);
    if (!logueado) throw new Error('Se agoto el tiempo de espera de login (10 min) sin detectar sesion iniciada.');
    log('Login detectado, continuando automaticamente.');
    await page.waitForTimeout(1000);

    // ══ 0. ANTES: total y presencia de la variante "_falla" ══════════════
    reporte.antes = await page.evaluate(async () => {
      const porTipo = await apiRequest('GET', '/calidad/tipificacion/por-tipo?campana=ORLANT&canal=LLAMADAS');
      const opciones = await apiRequest('GET', '/calidad/tipificacion/opciones?campana=ORLANT&canal=LLAMADAS');
      return {
        total: porTipo.total,
        agentesConFalla: opciones.agentes.filter((a) => /_falla/i.test(a)).length,
        totalAgentesDistintos: opciones.agentes.length,
      };
    });
    log('ANTES de la recarga:', JSON.stringify(reporte.antes));
    if (reporte.antes.total !== 34661) throw new Error('El total ANTES no es 34.661 (es ' + reporte.antes.total + ') -- ABORTA, no coincide con el control conocido.');

    // ══ 1. SUBIR TIPIFICACIONES.xlsx (archivo real, ya en produccion) ═════
    await page.evaluate(() => openCargas());
    await page.waitForTimeout(800);
    await page.selectOption('#carga-cliente', 'ORLANT');
    await page.waitForTimeout(800);
    await shot(page, '0-cargas-orlant-produccion.png');

    log('Subiendo TIPIFICACIONES.xlsx (archivo real, re-carga para aplicar alias)...');
    await page.setInputFiles('#carga-file', ARCHIVO);
    await page.waitForTimeout(3000);
    const resultados = await page.evaluate(() => _cargasResultados);
    const fila = resultados.find((r) => r.tipo === 'tipificacion' && !r.error);
    if (!fila) throw new Error('TIPIFICACIONES.xlsx no se reconocio como tipificacion: ' + JSON.stringify(resultados.map((r) => ({ tipo: r.tipo, error: r.error }))));
    reporte.carga.preview = {
      filas: fila.filas.length,
      canal: fila.canalTipificacion || null,
      avisos: fila.avisos ? fila.avisos.length : 0,
      reconocidaPorEncabezadosComo: fila.reconocidaPorEncabezadosComo || null,
    };
    await shot(page, '1-preview-tipificacion.png');
    log('Preview TIPIFICACIONES:', JSON.stringify(reporte.carga.preview));
    if (fila.filas.length !== 34661) throw new Error('Se esperaban 34.661 filas, llegaron ' + fila.filas.length + ' -- ABORTA sin guardar.');
    if (fila.canalTipificacion && fila.canalTipificacion !== 'LLAMADAS') throw new Error('Canal detectado no es LLAMADAS, es ' + fila.canalTipificacion + ' -- ABORTA sin guardar.');

    await page.click('#cargas-overlay button:has-text("Guardar carga")');
    await page.waitForTimeout(3000);
    const toast = (await page.locator('#toast').innerText().catch(() => '')).trim();
    reporte.carga.confirmacionMostrada = ultimoDialogMsg;
    reporte.carga.toast = toast;
    reporte.carga.guardadoOk = /✓/.test(toast) && !/✗/.test(toast);
    log('Confirmación mostrada:', ultimoDialogMsg.replace(/\n/g, ' | '));
    log('TIPIFICACIONES guardado:', toast.replace(/\n/g, ' | '));
    await shot(page, '2-guardado-tipificacion.png');
    if (!reporte.carga.guardadoOk) throw new Error('El guardado no fue OK: ' + toast);

    await page.evaluate(() => closeCargas());
    await page.waitForTimeout(500);

    // ══ 2. DESPUES: mismo total, 0 variantes "_falla" ═════════════════════
    reporte.despues = await page.evaluate(async () => {
      const porTipo = await apiRequest('GET', '/calidad/tipificacion/por-tipo?campana=ORLANT&canal=LLAMADAS');
      const opciones = await apiRequest('GET', '/calidad/tipificacion/opciones?campana=ORLANT&canal=LLAMADAS');
      return {
        total: porTipo.total,
        agentesConFalla: opciones.agentes.filter((a) => /_falla/i.test(a)).length,
        totalAgentesDistintos: opciones.agentes.length,
      };
    });
    log('DESPUES de la recarga:', JSON.stringify(reporte.despues));
    await shot(page, '3-tipificacion-despues.png');

    reporte.erroresConsola = erroresConsola;
    ok =
      reporte.carga.guardadoOk &&
      reporte.despues.total === 34661 &&
      reporte.despues.agentesConFalla === 0 &&
      erroresConsola.length === 0;
    reporte.ok = ok;

    console.log(JSON.stringify(reporte, null, 2));
  } catch (e) {
    console.error('FALLO:', e.message);
    console.log(JSON.stringify(reporte, null, 2));
    ok = false;
  } finally {
    if (browser) await browser.close();
  }
  process.exit(ok ? 0 : 1);
})();
