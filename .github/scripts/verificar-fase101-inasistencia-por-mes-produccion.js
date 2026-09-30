// verificar-fase101-inasistencia-por-mes-produccion.js — Fase 101. Revision
// EN PRODUCCION (https://informa.inconexion.com.co), SOLO LECTURA. Cubre en
// UNA sola sesion de login lo que quedaba pendiente de la Fase 100
// (revision final: numeros de control, plantilla sin los 4 campos viejos de
// inasistencia) MAS lo especifico de la Fase 101 (Inasistencia abre en "Por
// mes", grafica y numeros de control de la vista nueva, aviso de mes
// incompleto). Playwright directo desde Node (headless:false, navegador
// visible) -- NO la extension de Claude in Chrome. El usuario inicia sesion
// a mano; el script nunca ve ni escribe la contrasena, no persiste
// storageState ni cookies en disco. No crea, sube, borra ni cambia NADA en
// produccion -- ni siquiera al "descargar" (son GETs).
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'https://informa.inconexion.com.co';
const DIR_EDWIN = 'C:\\Users\\filid\\Documents\\trabajo inconexion\\bases edwin';
const OUT_SHOTS = path.join(DIR_EDWIN, 'capturas-produccion', 'fase101-inasistencia-por-mes');
const LOGIN_TIMEOUT_MS = 10 * 60 * 1000;

function log(...args) { console.log(new Date().toISOString(), ...args); }

async function shot(page, name) {
  try { await page.screenshot({ path: path.join(OUT_SHOTS, name), fullPage: false }); } catch (e) { log('WARN screenshot fallo:', e.message); }
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
  fs.mkdirSync(OUT_SHOTS, { recursive: true });
  const erroresConsola = [];
  const peticionesFallidas = [];
  const reporte = { hallazgos: [], numerosControl: {}, plantilla: null };
  function hallazgo(sev, texto) { reporte.hallazgos.push({ sev, texto }); log(`[${sev}]`, texto); }

  let browser;
  try {
    browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
    const page = await context.newPage();
    page.on('pageerror', (e) => { erroresConsola.push('pageerror: ' + e.message); });
    page.on('console', (m) => { if (m.type() === 'error' && !/favicon/i.test(m.text())) erroresConsola.push('console.error: ' + m.text()); });
    page.on('response', (res) => { if (res.status() >= 400 && !res.url().includes('/favicon')) peticionesFallidas.push(res.status() + ' ' + res.url()); });

    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
    const logueado = await esperarLogin(page);
    if (!logueado) throw new Error('Se agoto el tiempo de espera de login (10 min).');
    log('Login detectado, continuando automaticamente.');
    await page.waitForTimeout(1000);

    // ── Numeros de control (API) -- pendientes de la Fase 100 + los nuevos
    // de la Fase 101 (mismo patron ponderado que inasistenciaAgregarPorMes) ──
    reporte.numerosControl = await page.evaluate(async () => {
      const tipif = await apiRequest('GET', '/calidad/tipificacion/por-tipo?campana=ORLANT&canal=LLAMADAS');
      const porEsp = await apiRequest('GET', '/calidad/agendas/especialidad?campana=ORLANT&mes=2025-04');
      const porLinea = await apiRequest('GET', '/calidad/agendas/linea?campana=ORLANT&mes=2025-04');
      const totalAgendas = porEsp.reduce((a, r) => a + r.cantidad, 0);
      const linea2025 = porLinea.filter((r) => r.mes === '2025-04');
      const mensual = await apiRequest('GET', '/calidad/inasistencia/mensual?campana=ORLANT');
      return {
        tipificacionTotal: tipif.total,
        totalAgendas,
        lineaGeneral: (linea2025.find((r) => r.tipoLinea === 'GENERAL') || {}).cantidad,
        linea3p: (linea2025.find((r) => r.tipoLinea === '3P') || {}).cantidad,
        inasistenciaMensual: mensual,
      };
    });
    const nc = reporte.numerosControl;
    if (nc.tipificacionTotal !== 14940) hallazgo('ALTO', `Tipificacion total = ${nc.tipificacionTotal}, se esperaba 14.940`);
    if (nc.totalAgendas !== 7426) hallazgo('ALTO', `Agendas total = ${nc.totalAgendas}, se esperaba 7.426`);
    if (nc.lineaGeneral !== 4643) hallazgo('ALTO', `Agendas Linea General = ${nc.lineaGeneral}, se esperaba 4.643`);
    if (nc.linea3p !== 2783) hallazgo('ALTO', `Agendas Linea 3P = ${nc.linea3p}, se esperaba 2.783`);

    // Agregado "Por mes" (mismo calculo que inasistenciaAgregarPorMes) --
    // confirma Ago-26 (5.893/332/5,63%) y Sep-26 (1.483/96/6,47%).
    const porMes = {};
    (nc.inasistenciaMensual || []).forEach((r) => {
      if (!porMes[r.mes]) porMes[r.mes] = { total: 0, ip: 0, esp: {} };
      porMes[r.mes].total += r.total;
      porMes[r.mes].ip += r.inasistencia + r.pendiente;
      porMes[r.mes].esp[r.especialidad] = true;
    });
    const ago = porMes['2026-08'], sep = porMes['2026-09'];
    const pctAgo = ago ? Math.round((ago.ip / ago.total) * 10000) / 100 : null;
    const pctSep = sep ? Math.round((sep.ip / sep.total) * 10000) / 100 : null;
    log('Agregado por mes (Ago-26):', JSON.stringify(ago), 'pct:', pctAgo);
    log('Agregado por mes (Sep-26):', JSON.stringify(sep), 'pct:', pctSep);
    if (!ago || ago.total !== 5893) hallazgo('ALTO', `Inasistencia Ago-26 total = ${ago && ago.total}, se esperaba 5.893`);
    if (!ago || ago.ip !== 332) hallazgo('ALTO', `Inasistencia Ago-26 (inasist+pend) = ${ago && ago.ip}, se esperaba 332`);
    if (pctAgo !== 5.63) hallazgo('ALTO', `Inasistencia Ago-26 % = ${pctAgo}, se esperaba 5,63`);
    if (!sep || sep.total !== 1483) hallazgo('ALTO', `Inasistencia Sep-26 total = ${sep && sep.total}, se esperaba 1.483`);
    if (!sep || sep.ip !== 96) hallazgo('ALTO', `Inasistencia Sep-26 (inasist+pend) = ${sep && sep.ip}, se esperaba 96`);
    if (pctSep !== 6.47) hallazgo('ALTO', `Inasistencia Sep-26 % = ${pctSep}, se esperaba 6,47`);
    if (!sep || Object.keys(sep.esp).length !== 1 || !sep.esp['EXAMENES ESPECIALES']) hallazgo('ALTO', `Sep-26 deberia traer solo EXAMENES ESPECIALES, trae: ${sep ? Object.keys(sep.esp).join(',') : 'nada'}`);

    // ── Plantilla descargable (solo GET) -- pendiente de la Fase 100: ya no
    // debe listar los 4 campos viejos de inasistencia en "resumen". ───────
    await page.evaluate(() => openCargas());
    await page.waitForTimeout(800);
    await page.selectOption('#carga-cliente', 'ORLANT').catch(() => {});
    await page.waitForTimeout(800);
    try {
      const [descargaPlantilla] = await Promise.all([
        page.waitForEvent('download', { timeout: 15000 }),
        page.click('button[onclick="descargarPlantillaConsolidada()"]'),
      ]);
      const rutaPlantilla = path.join(OUT_SHOTS, 'plantilla-ORLANT.xlsx');
      await descargaPlantilla.saveAs(rutaPlantilla);
      reporte.plantilla = { guardada: true };
      log('Plantilla ORLANT descargada (revisar a mano si hace falta: hoja "resumen" no deberia listar campos inasist_*).');
    } catch (e) {
      hallazgo('MEDIO', 'No se pudo descargar la plantilla: ' + e.message);
    }
    await page.evaluate(() => closeCargas());
    await page.waitForTimeout(300);

    // ── Fase 101: Inasistencia debe abrir en "Por mes" ───────────────────
    await page.evaluate(() => openGenericDashboard('ORLANT'));
    await page.waitForTimeout(1500);
    await page.evaluate(() => { if (typeof _gdIrAMes === 'function') _gdIrAMes('2026-08'); });
    await page.waitForTimeout(1000);
    await page.evaluate(() => switchGenericTab('inasistencia'));
    await page.waitForTimeout(1500);

    const subtabActivo = await page.evaluate(() => {
      var btn = document.querySelector('.gd-subtab-btn.on');
      return btn ? btn.dataset.gdsubtab : null;
    });
    if (subtabActivo !== 'pormes') hallazgo('ALTO', `Inasistencia abre en "${subtabActivo}", se esperaba "pormes"`);
    else log('Confirmado: Inasistencia abre en "Por mes".');

    const estructura = await page.evaluate(() => ({
      tarjetas: document.querySelectorAll('.aurora-kpis .aurora-kpi').length,
      canvas: !!document.getElementById('inasist-c-pormes-0'),
      filtroEspecialidad: !!document.getElementById('inasist-f-especialidad-0'),
    }));
    if (estructura.tarjetas !== 6) hallazgo('MEDIO', `"Por mes" trae ${estructura.tarjetas} tarjeta(s), se esperaban 6`);
    if (!estructura.canvas) hallazgo('ALTO', '"Por mes" no dibujo la grafica "Citas vs. inasistencias por mes"');
    if (estructura.filtroEspecialidad) hallazgo('MEDIO', '"Por mes" NO deberia tener filtro de especialidad');

    const avisoTexto = await page.evaluate(() => { var el = document.getElementById('inasist-aviso-0'); return el ? el.innerText.trim() : ''; });
    if (!/Sep-26.*solo incluye/i.test(avisoTexto)) hallazgo('MEDIO', `No aparecio el aviso esperado de Sep-26 incompleto (texto real: "${avisoTexto}")`);
    else log('Aviso de mes incompleto confirmado:', avisoTexto);

    await shot(page, 'pormes-ago26-escritorio-light.png');
    await page.evaluate(() => { if (typeof aplicarTema === 'function') aplicarTema('dark'); });
    await page.waitForTimeout(400);
    await shot(page, 'pormes-ago26-escritorio-dark.png');
    await page.evaluate(() => { if (typeof aplicarTema === 'function') aplicarTema('light'); });
    await page.setViewportSize({ width: 375, height: 812 });
    await page.waitForTimeout(400);
    await shot(page, 'pormes-ago26-celular-light.png');
    await page.evaluate(() => switchGenericSubtab('porespecialidad'));
    await page.waitForTimeout(1200);
    await shot(page, 'porespecialidad-celular-light.png');
    await page.setViewportSize({ width: 1440, height: 900 });

    await page.evaluate(() => closeGenericDashboard());
    await page.waitForTimeout(300);

    reporte.erroresConsola = [...new Set(erroresConsola)];
    reporte.peticionesFallidas = [...new Set(peticionesFallidas)];
    if (reporte.erroresConsola.length) hallazgo('ALTO', `${reporte.erroresConsola.length} error(es) de consola distintos durante el recorrido`);
    if (reporte.peticionesFallidas.length) hallazgo('ALTO', `${reporte.peticionesFallidas.length} peticion(es) fallida(s) distinta(s) durante el recorrido`);

    fs.writeFileSync(path.join(OUT_SHOTS, 'reporte.json'), JSON.stringify(reporte, null, 2));
    log('=== RESUMEN ===');
    log('Hallazgos:', reporte.hallazgos.length);
    reporte.hallazgos.forEach((h) => log(`  [${h.sev}] ${h.texto}`));
    log('Consola:', reporte.erroresConsola.length, 'Peticiones fallidas:', reporte.peticionesFallidas.length);
    log('Capturas en:', OUT_SHOTS);
    log('=== FIN (navegador se cierra) ===');
  } catch (e) {
    console.error('FALLO:', e.message, e.stack);
  } finally {
    if (browser) await browser.close();
  }
})();
