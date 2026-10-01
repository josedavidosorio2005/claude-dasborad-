// verificar-fase108-carga-real-produccion.js — Fase 108 (pedido textual de
// InCo). Script de UN SOLO USO: respalda el estado actual de Inasistencia
// de ORLANT, sube el archivo REAL nuevo (una fila por cita,
// SEDE/ESPECIALIDAD/FECHA_CITA/NOMBRE ENTIDAD/CITEST), y verifica el
// resultado contra la tabla de control del pedido. Playwright directo
// desde Node (headless:false, navegador visible) -- NO la extension de
// Claude in Chrome (CLAUDE.md). El usuario inicia sesion a mano (hasta 10
// min); el script nunca ve ni guarda la contraseña, ni cookies/storageState
// en disco. La carga real SOLO pasa por la interfaz normal de la
// plataforma (el modal "Cargar Datos de Dashboards"), nunca directo a la
// base ni por un workflow -- autorizacion explicita del usuario: UN solo
// reemplazo, Inasistencia de ORLANT, meses ene-ago 2026.
'use strict';
const fs = require('fs');
const path = require('path');
const SERVER_DIR = path.join(__dirname, '..', '..', 'server');
const { chromium } = require(path.join(SERVER_DIR, 'node_modules', 'playwright'));

const BASE = 'https://informa.inconexion.com.co';
const DIR_EDWIN = 'C:\\Users\\filid\\Documents\\trabajo inconexion\\bases edwin';
const OUT_RESPALDO = path.join(DIR_EDWIN, 'respaldos-inasistencia');
const OUT_SHOTS = path.join(DIR_EDWIN, 'capturas-produccion', 'fase108-carga-real');
const ARCHIVO_REAL = 'C:\\Users\\filid\\Downloads\\INASISTENCIA NUEVA PARA MONTAR.xlsx';
const LOGIN_TIMEOUT_MS = 10 * 60 * 1000;

// Tabla de control del pedido (calculada a mano del archivo real).
const CONTROL_MESES = {
  '2026-01': { total: 8811, c: 1666, i: 463, p: 103, t: 6579, pct: 6.42 },
  '2026-02': { total: 9526, c: 1719, i: 610, p: 21, t: 7176, pct: 6.62 },
  '2026-03': { total: 10014, c: 1751, i: 735, p: 19, t: 7509, pct: 7.53 },
  '2026-04': { total: 9948, c: 1941, i: 675, p: 30, t: 7302, pct: 7.09 },
  '2026-05': { total: 9827, c: 1826, i: 630, p: 78, t: 7293, pct: 7.20 },
  '2026-06': { total: 10913, c: 2244, i: 637, p: 60, t: 7972, pct: 6.39 },
  '2026-07': { total: 12778, c: 2827, i: 742, p: 70, t: 9139, pct: 6.35 },
  '2026-08': { total: 11189, c: 2459, i: 786, p: 48, t: 7896, pct: 7.45 },
};
const CONTROL_SEP_PCT = 6.47;
const CONTROL_POR_ESPECIALIDAD_AGO = {
  'AUDIFONOS': 4.09,
  'CONSULTA OTORRINO': 9.51,
  'VERTIGO Y EQUILIBRIO': 6.91,
  'FONOAUDIOLOGIA': 13.66,
  'AUDIOLOGIA': 7.81,
};

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
  fs.mkdirSync(OUT_RESPALDO, { recursive: true });
  fs.mkdirSync(OUT_SHOTS, { recursive: true });
  const erroresConsola = [];
  const hallazgos = [];
  function hallazgo(sev, texto) { hallazgos.push({ sev, texto }); log(`[${sev}]`, texto); }

  let browser;
  try {
    if (!fs.existsSync(ARCHIVO_REAL)) throw new Error('No se encuentra el archivo real en ' + ARCHIVO_REAL);

    browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
    const page = await context.newPage();
    page.on('pageerror', (e) => erroresConsola.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/favicon/i.test(m.text())) erroresConsola.push('console.error: ' + m.text()); });

    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
    const logueado = await esperarLogin(page);
    if (!logueado) throw new Error('Se agoto el tiempo de espera de login (10 min).');
    log('Login detectado, continuando automaticamente.');
    await page.waitForTimeout(1000);

    // ── 1) RESPALDO (solo lectura) del estado ANTES de tocar nada ───────
    log('Respaldando el estado actual de Inasistencia de ORLANT...');
    const antes = await page.evaluate(async () => {
      const opciones = await apiRequest('GET', '/calidad/inasistencia/opciones?campana=ORLANT');
      const mensual = await apiRequest('GET', '/calidad/inasistencia/mensual?campana=ORLANT');
      return { opciones, mensual };
    });
    const tsRespaldo = new Date().toISOString().replace(/[:.]/g, '-');
    const rutaRespaldo = path.join(OUT_RESPALDO, `inasistencia-orlant-antes-fase108-${tsRespaldo}.json`);
    fs.writeFileSync(rutaRespaldo, JSON.stringify(antes, null, 2), 'utf8');
    log('Respaldo guardado en', rutaRespaldo);
    log('Meses con datos ANTES de la carga:', antes.opciones.meses.join(', '));

    const ago26Antes = await page.evaluate(async () => apiRequest('GET', '/calidad/inasistencia/resumen?campana=ORLANT&mes=2026-08'));
    const sep26Antes = await page.evaluate(async () => apiRequest('GET', '/calidad/inasistencia/resumen?campana=ORLANT&mes=2026-09')).catch(() => null);
    log('Ago-26 ANTES:', JSON.stringify(ago26Antes));
    log('Sep-26 ANTES:', JSON.stringify(sep26Antes));
    if (!sep26Antes || sep26Antes.pct !== CONTROL_SEP_PCT) {
      hallazgo('aviso', `Sep-26 antes de la carga no es ${CONTROL_SEP_PCT}% (es ${sep26Antes && sep26Antes.pct}) -- revisar antes de continuar.`);
    }

    // ── 2) CARGA del archivo real, por la interfaz normal ───────────────
    let mensajeConfirmacion = null;
    page.on('dialog', async (dialog) => {
      mensajeConfirmacion = dialog.message();
      log('Dialogo de confirmacion:', mensajeConfirmacion);
      const pareceCorrecto = /REEMPLAZAR/i.test(mensajeConfirmacion) &&
        /Ene-26/.test(mensajeConfirmacion) && /Ago-26/.test(mensajeConfirmacion);
      if (!pareceCorrecto) {
        hallazgo('CRITICO', 'El dialogo de confirmacion NO menciona REEMPLAZAR/Ene-26/Ago-26 -- se cancela por seguridad.');
        await dialog.dismiss();
        return;
      }
      await dialog.accept();
    });

    await page.evaluate(() => openCargas());
    await page.waitForTimeout(500);
    await page.selectOption('#carga-cliente', 'ORLANT');
    await page.waitForTimeout(500);

    log('Subiendo el archivo real:', ARCHIVO_REAL);
    await page.setInputFiles('#carga-file', ARCHIVO_REAL);
    await page.waitForSelector('#carga-preview-card', { state: 'visible', timeout: 60000 });
    await page.waitForTimeout(500);
    const previewTexto = await page.locator('#carga-preview-card').innerText();
    log('--- Vista previa ---');
    log(previewTexto.slice(0, 2000));
    await page.screenshot({ path: path.join(OUT_SHOTS, '01-vista-previa.png'), fullPage: true });

    if (!/Inasistencia/i.test(previewTexto)) {
      throw new Error('La hoja de Inasistencia no aparece en la vista previa -- abortando SIN guardar.');
    }

    log('Guardando la carga (va a pedir confirmacion)...');
    await page.click('button[onclick="guardarCarga()"]');
    await page.waitForTimeout(3000);

    if (!mensajeConfirmacion) {
      throw new Error('No aparecio el dialogo de confirmacion esperado -- abortando, revisar a mano.');
    }
    if (hallazgos.some((h) => h.sev === 'CRITICO')) {
      throw new Error('Se cancelo la carga por el hallazgo CRITICO de arriba.');
    }

    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(OUT_SHOTS, '02-despues-de-guardar.png'), fullPage: true });
    log('Carga enviada. Verificando resultado...');

    // ── 3) VERIFICACION contra la tabla de control ───────────────────────
    const despues = await page.evaluate(async () => {
      const opciones = await apiRequest('GET', '/calidad/inasistencia/opciones?campana=ORLANT');
      const mensual = await apiRequest('GET', '/calidad/inasistencia/mensual?campana=ORLANT');
      return { opciones, mensual };
    });

    let sumaC = 0, sumaI = 0, sumaP = 0, sumaT = 0, sumaTotal = 0;
    for (const [mes, esperado] of Object.entries(CONTROL_MESES)) {
      const resumen = await page.evaluate((m) => apiRequest('GET', '/calidad/inasistencia/resumen?campana=ORLANT&mes=' + m), mes);
      sumaC += resumen.cancelada; sumaI += resumen.inasistencia; sumaP += resumen.pendiente; sumaT += resumen.atendidas; sumaTotal += resumen.total;
      const okTotal = resumen.total === esperado.total;
      const okPct = resumen.pct === esperado.pct;
      log(`${mes}: total=${resumen.total} (esperado ${esperado.total}) pct=${resumen.pct}% (esperado ${esperado.pct}%) ${okTotal && okPct ? 'OK' : 'DIFERENTE'}`);
      if (!okTotal || !okPct) hallazgo('CRITICO', `${mes}: esperado total=${esperado.total}/pct=${esperado.pct}%, real total=${resumen.total}/pct=${resumen.pct}%`);
    }
    log(`Suma de conteos ene-ago: C=${sumaC} I=${sumaI} P=${sumaP} T=${sumaT} total=${sumaTotal}`);
    if (sumaC !== 16433 || sumaI !== 5278 || sumaP !== 429 || sumaT !== 60866 || sumaTotal !== 83006) {
      hallazgo('CRITICO', 'La suma de conteos ene-ago NO coincide con C16433/I5278/P429/T60866=83006.');
    }

    const sep26Despues = await page.evaluate(() => apiRequest('GET', '/calidad/inasistencia/resumen?campana=ORLANT&mes=2026-09')).catch(() => null);
    log('Sep-26 DESPUES:', JSON.stringify(sep26Despues));
    if (!sep26Despues || sep26Despues.pct !== CONTROL_SEP_PCT) {
      hallazgo('CRITICO', `Sep-26 cambio o desaparecio (esperado ${CONTROL_SEP_PCT}%, real ${sep26Despues && sep26Despues.pct}%) -- no debia tocarse.`);
    }

    const porEspAgo = await page.evaluate(() => apiRequest('GET', '/calidad/inasistencia/especialidad?campana=ORLANT&mes=2026-08'));
    for (const [especialidad, pctEsperado] of Object.entries(CONTROL_POR_ESPECIALIDAD_AGO)) {
      const fila = porEspAgo.find((f) => f.especialidad === especialidad);
      if (!fila) { hallazgo('CRITICO', `Especialidad "${especialidad}" no aparece en Ago-26`); continue; }
      const pctReal = Math.round(((fila.inasistencia + fila.pendiente) / fila.total) * 10000) / 100;
      log(`Ago-26 / ${especialidad}: ${pctReal}% (esperado ${pctEsperado}%)`);
      if (pctReal !== pctEsperado) hallazgo('CRITICO', `Ago-26 / ${especialidad}: esperado ${pctEsperado}%, real ${pctReal}%`);
    }

    // ── 4) Confirmacion visual en pantalla (pestaña Inasistencia, ORLANT) ──
    await page.click('#cargas-overlay .aurora-close').catch(() => {});
    await page.evaluate(() => openGenericDashboard('ORLANT'));
    await page.waitForTimeout(1200);
    const tabs = page.locator('#gd-tabs .atab');
    const nTabs = await tabs.count();
    for (let t = 0; t < nTabs; t++) {
      const txt = (await tabs.nth(t).textContent() || '').trim();
      if (/^inasistencia/i.test(txt)) { await tabs.nth(t).click(); break; }
    }
    await page.waitForTimeout(1000);
    await page.selectOption('#gd-mes-sel', '2026-08').catch(() => {});
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT_SHOTS, '03-pantalla-ago26.png'), fullPage: true });
    const tarjetaTexto = await page.locator('#inasist-tarjetas-wrap-0 .kv').innerText().catch(() => '');
    log('Tarjeta en pantalla (Ago-26, sin filtros):', tarjetaTexto);
    if (tarjetaTexto.trim() !== '7,45 %') hallazgo('CRITICO', `La tarjeta en pantalla no dice 7,45 % (dice "${tarjetaTexto.trim()}")`);

    log('=== RESUMEN ===');
    log('Meses con datos DESPUES:', despues.opciones.meses.join(', '));
    log('Errores de consola:', erroresConsola.length, JSON.stringify(erroresConsola));
    log('Hallazgos:', JSON.stringify(hallazgos, null, 2));
    const criticos = hallazgos.filter((h) => h.sev === 'CRITICO');
    if (criticos.length || erroresConsola.length) {
      log('REVISAR -- hay hallazgos criticos o errores de consola.');
      process.exitCode = 1;
    } else {
      log('OK: carga real verificada contra la tabla de control, 0 errores de consola.');
    }
  } catch (e) {
    log('EXCEPCION:', e.message);
    process.exitCode = 1;
  } finally {
    if (browser) { await new Promise((r) => setTimeout(r, 2000)); await browser.close(); }
  }
})();
