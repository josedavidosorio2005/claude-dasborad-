// verificar-fase94-agendamiento-produccion.js — Fase 94. Verificacion visual
// EN PRODUCCION (https://informa.inconexion.com.co) de los 4 temas: orden
// de pestañas de ORLANT (tema A), las 4 sub-pestañas de Agendamiento con
// los numeros de control de Edwin (tema B), el aviso nuevo de WhatsApp a 5
// min (tema C) -- Calidad (tema D) fue solo lectura/docs, no se toca aqui.
//
// Playwright DIRECTO desde Node (headless:false, navegador visible) -- NO
// la extension de Claude in Chrome (regla fija del proyecto, CLAUDE.md). El
// usuario inicia sesion a mano en la ventana que abre este script; el
// script nunca ve ni escribe la contrasena, y no persiste storageState ni
// cookies en disco -- todo vive en memoria de esta sola ejecucion de Node.
//
// Solo lectura: no sube archivos, no borra ni cambia ningun dato. Con
// datos REALES de produccion, "Agendas por agente" muestra nombres reales
// de asesores (igual que Tipificacion ya lo hacia antes de esta fase) --
// las capturas van FUERA del repo (bases edwin/capturas-produccion/), nunca
// se commitean.
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'https://informa.inconexion.com.co';
const DIR_EDWIN = 'C:\\Users\\filid\\Documents\\trabajo inconexion\\bases edwin';
const OUT_DIR = path.join(DIR_EDWIN, 'capturas-produccion', 'fase94-agendamiento');
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
  const peticionesFallidas = [];
  const reporte = {};
  let ok = true;
  let browser;

  try {
    browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    page.on('pageerror', (e) => erroresConsola.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/favicon/i.test(m.text())) erroresConsola.push('console.error: ' + m.text()); });
    page.on('response', (res) => { if (res.status() >= 400) peticionesFallidas.push(res.status() + ' ' + res.url()); });
    page.on('requestfailed', (req) => peticionesFallidas.push('FAILED ' + req.url()));

    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });

    const logueado = await esperarLogin(page);
    if (!logueado) throw new Error('Se agoto el tiempo de espera de login (10 min) sin detectar sesion iniciada.');
    log('Login detectado, continuando automaticamente.');
    await page.waitForTimeout(1000);

    await page.evaluate(() => openGenericDashboard('ORLANT'));
    await page.waitForTimeout(1500);

    // Tema A: orden de pestañas
    const tabsInfo = await page.evaluate(() => ({ tabsVisibles: _gdTabsVisibles().map(t => t.key), tabActiva: _gd.tab }));
    reporte.temaA_orden = tabsInfo;
    log('Tema A -- orden de pestañas:', JSON.stringify(tabsInfo));
    await shot(page, '0-orden-pestanas.png');

    // Tema B: numeros de control + 4 sub-pestañas de Agendamiento
    const controlNumeros = await page.evaluate(async () => {
      const tipif = await apiRequest('GET', '/calidad/tipificacion/por-tipo?campana=ORLANT&canal=LLAMADAS');
      const porEsp = await apiRequest('GET', '/calidad/agendas/especialidad?campana=ORLANT&mes=2025-04');
      const porLinea = await apiRequest('GET', '/calidad/agendas/linea?campana=ORLANT&mes=2025-04');
      const porAgente = await apiRequest('GET', '/calidad/agendas/agente?campana=ORLANT&mes=2025-04');
      const totalAgendas = porEsp.reduce((a, r) => a + r.cantidad, 0);
      const totalAgente = porAgente.reduce((a, r) => a + r.cantidad, 0);
      const audifonos = porEsp.find(r => r.especialidad === 'AUDIFONOS');
      const linea2025 = porLinea.filter(r => r.mes === '2025-04');
      return {
        tipificacionTotal: tipif.total,
        totalAgendasAbr25: totalAgendas,
        totalAgentePorAgenteAbr25: totalAgente,
        audifonos: audifonos ? audifonos.cantidad : null,
        lineaGeneral: (linea2025.find(r => r.tipoLinea === 'GENERAL') || {}).cantidad,
        linea3p: (linea2025.find(r => r.tipoLinea === '3P') || {}).cantidad,
        sumaIgualATotal: totalAgente === totalAgendas,
      };
    });
    reporte.temaB_controlNumeros = controlNumeros;
    log('Tema B -- numeros de control:', JSON.stringify(controlNumeros));

    let tieneAgendamiento = false;
    for (let i = 0; i < 5; i++) {
      tieneAgendamiento = await page.evaluate(() => _gdTabsVisibles().some(t => t.key === 'agendamiento'));
      if (tieneAgendamiento) break;
      await page.waitForTimeout(1000);
    }
    reporte.temaB_tabDestapada = tieneAgendamiento;
    if (tieneAgendamiento) {
      await page.evaluate(() => switchGenericTab('agendamiento'));
      await page.waitForTimeout(1500);
      // El selector MES global cae por defecto en el mes mas reciente con
      // CUALQUIER dato (Ago-26, de Calidad/Trafico) -- Agendas solo tiene
      // datos reales en Abr-25, asi que sin este salto las 4 sub-pestañas
      // mostrarian el aviso "Sin datos para Ago-26" en vez de las graficas
      // reales. _gdIrAMes ya es la funcion que usa el boton "Ver Abr-25".
      await page.evaluate(() => { if (typeof _gdIrAMes === 'function') _gdIrAMes('2025-04'); });
      await page.waitForTimeout(1200);
      const subtabs = await page.evaluate(() => (_gd.config.layout.tabs.find(t => t.key === 'agendamiento').subtabs || []).map(s => s.key));
      reporte.temaB_subtabs = subtabs;
      for (const sub of subtabs) {
        await page.evaluate((k) => switchGenericSubtab(k), sub);
        await page.waitForTimeout(1500);
        await shot(page, `agendamiento-${sub}.png`);
      }
    }

    // Tema C: aviso de WhatsApp a 5 min
    await page.evaluate(() => switchGenericTab('trafico_whatsapp'));
    await page.waitForTimeout(1500);
    const textoWpp = await page.evaluate(() => document.getElementById('gd-panels').innerText);
    reporte.temaC_aviso = {
      contienePrincipal: textoWpp.includes('aún no hay datos para este período'),
      contieneDetalle: textoWpp.includes('SERVICE_LEVEL_5MIN'),
    };
    await shot(page, 'trafico-whatsapp-aviso-sl5.png');

    reporte.erroresConsola = erroresConsola;
    reporte.peticionesFallidas = peticionesFallidas;
    ok = erroresConsola.length === 0 && peticionesFallidas.length === 0;
    reporte.ok = ok;

    console.log(JSON.stringify(reporte, null, 2));
  } catch (e) {
    console.error('FALLO:', e.message);
    reporte.erroresConsola = erroresConsola;
    reporte.peticionesFallidas = peticionesFallidas;
    console.log(JSON.stringify(reporte, null, 2));
    ok = false;
  } finally {
    if (browser) await browser.close();
  }
  process.exit(ok ? 0 : 1);
})();
