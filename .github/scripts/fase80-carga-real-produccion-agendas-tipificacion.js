// fase80-carga-real-produccion-agendas-tipificacion.js — Script de un solo
// uso, Fase 80. Carga en PRODUCCION los archivos REALES de Agendas y
// Tipificacion de ORLANT (autorizado explicitamente por el usuario), por la
// interfaz normal de "Cargar Datos de Dashboards" -- nunca SQL directo,
// nunca un workflow (los archivos reales no pueden pasar por GitHub).
//
// Playwright DIRECTO desde Node (headless:false, navegador visible) -- NO
// la extension de Claude in Chrome (regla fija del proyecto, ver
// CLAUDE.md). El usuario inicia sesion a mano en la ventana que este
// script abre; el script nunca ve ni escribe la contrasena, y no persiste
// storageState/cookies en disco -- todo vive en memoria de esta sola
// ejecucion de Node.
//
// Sube primero los ORIGINALES de Edwin (para probar en produccion el
// arreglo de la Fase 79: reconocimiento de la hoja "DATA" por
// encabezados); si alguno fallara, cae al archivo "PARA_CARGAR" de
// respaldo para dejar los datos correctos de todas formas.
//
// Solo imprime/guarda ESTRUCTURA y AGREGADOS (conteos, totales) -- nunca
// valores individuales reales (nombres de pacientes, etc). Capturas en
// "bases edwin/capturas-produccion/", fuera del repo.
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'https://informa.inconexion.com.co';
const DIR_EDWIN = 'C:\\Users\\filid\\Documents\\trabajo inconexion\\bases edwin';
const OUT_DIR = path.join(DIR_EDWIN, 'capturas-produccion');
const LOGIN_TIMEOUT_MS = 10 * 60 * 1000;

const ORIGINALES = {
  agendas: { path: path.join(DIR_EDWIN, 'AGENDAS.xlsx'), filasEsperadas: 7426, agrupadasEsperadas: 576, sinDatoEsperadas: 5 },
  tipificacion: { path: path.join(DIR_EDWIN, 'BASE_PARA_TORTAS_DE_TIPIFICACION.xlsx'), filasEsperadas: 14940 },
};
const RESPALDO = {
  agendas: path.join(DIR_EDWIN, 'ORLANT_agendas_abril_2025_PARA_CARGAR.xlsx'),
  tipificacion: path.join(DIR_EDWIN, 'ORLANT_tipificacion_llamadas_agosto_2026_PARA_CARGAR.xlsx'),
};

function log(...args) { console.log(new Date().toISOString(), ...args); }

async function shot(page, name) {
  try { await page.screenshot({ path: path.join(OUT_DIR, name), fullPage: false }); } catch (e) { log('WARN screenshot fallo:', e.message); }
}

async function esperarLogin(page) {
  log('Inicia sesion en la ventana');
  const deadline = Date.now() + LOGIN_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const logueado = await page.evaluate(() => typeof authToken !== 'undefined' && !!authToken).catch(() => false);
    if (logueado) return true;
    await page.waitForTimeout(3000);
  }
  return false;
}

async function subirYVerificar(page, archivoPath, tipo, esperado) {
  await page.setInputFiles('#carga-file', archivoPath);
  await page.waitForTimeout(3000); // archivos de 3-4 MB, dar tiempo a SheetJS
  const resultados = await page.evaluate(() => _cargasResultados);
  const fila = resultados.find((r) => r.tipo === tipo);
  const ok = !!fila && Array.isArray(fila.filas) &&
    (tipo !== 'agendas' || (fila.filas.length === ORIGINALES.agendas.filasEsperadas && fila.entidadesAgrupadas === ORIGINALES.agendas.agrupadasEsperadas)) &&
    (tipo !== 'tipificacion' || fila.filas.length === ORIGINALES.tipificacion.filasEsperadas);
  return { ok, fila };
}

async function guardarCargaActual(page) {
  await page.click('#cargas-overlay button:has-text("Guardar carga")');
  await page.waitForTimeout(2000);
  const toast = (await page.locator('#toast').innerText().catch(() => '')).trim();
  return toast;
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const erroresConsola = [];
  const reporte = { agendas: {}, tipificacion: {}, verificacionDashboard: {} };
  let ok = true;
  let browser;
  let localServerPid = null;

  try {
    browser = await chromium.launch({ headless: false });
    // Contexto nuevo, sin storageState -- nunca se persiste sesion/cookies en disco.
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    page.on('dialog', (d) => d.accept());
    page.on('pageerror', (e) => erroresConsola.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/favicon/i.test(m.text())) erroresConsola.push('console.error: ' + m.text()); });

    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });

    const logueado = await esperarLogin(page);
    if (!logueado) throw new Error('Se agoto el tiempo de espera de login (10 min) sin detectar sesion iniciada.');
    log('Login detectado, continuando automaticamente.');
    await page.waitForTimeout(1000);

    // ══ 1. CARGAR ═══════════════════════════════════════════════════════
    await page.evaluate(() => openCargas());
    await page.waitForTimeout(800);
    await page.selectOption('#carga-cliente', 'ORLANT');
    await page.waitForTimeout(800);
    await shot(page, '0-cargas-orlant-produccion.png');

    // --- Agendas ---
    log('Subiendo AGENDAS.xlsx (original de Edwin)...');
    let r = await subirYVerificar(page, ORIGINALES.agendas.path, 'agendas', ORIGINALES.agendas);
    reporte.agendas.original = { ok: r.ok, filas: r.fila && r.fila.filas ? r.fila.filas.length : null, reconocidaPorEncabezadosComo: r.fila ? r.fila.reconocidaPorEncabezadosComo : null, entidadesAgrupadas: r.fila ? r.fila.entidadesAgrupadas : null, entidadesSinDato: r.fila ? r.fila.entidadesSinDato : null };
    await shot(page, '1-preview-agendas-original.png');
    let archivoAgendasUsado = 'original';
    if (!r.ok) {
      log('AVISO: el original de Agendas NO se reconocio como se esperaba -- cae al archivo de respaldo. Revisar despues.');
      r = await subirYVerificar(page, RESPALDO.agendas, 'agendas', ORIGINALES.agendas);
      archivoAgendasUsado = 'respaldo';
      reporte.agendas.respaldo = { ok: r.ok, filas: r.fila && r.fila.filas ? r.fila.filas.length : null };
      await shot(page, '1b-preview-agendas-respaldo.png');
    }
    if (!r.ok) throw new Error('Ni el original ni el respaldo de Agendas se reconocieron correctamente -- ABORTA sin guardar.');
    const toastAgendas = await guardarCargaActual(page);
    reporte.agendas.archivoUsado = archivoAgendasUsado;
    reporte.agendas.toast = toastAgendas;
    reporte.agendas.guardadoOk = /✓/.test(toastAgendas) && !/✗/.test(toastAgendas);
    log('Agendas guardado:', toastAgendas.replace(/\n/g, ' | '));
    await shot(page, '2-guardado-agendas.png');

    // --- Tipificacion ---
    log('Subiendo BASE_PARA_TORTAS_DE_TIPIFICACION.xlsx (original de Edwin)...');
    r = await subirYVerificar(page, ORIGINALES.tipificacion.path, 'tipificacion', ORIGINALES.tipificacion);
    reporte.tipificacion.original = { ok: r.ok, filas: r.fila && r.fila.filas ? r.fila.filas.length : null, reconocidaPorEncabezadosComo: r.fila ? r.fila.reconocidaPorEncabezadosComo : null, canalTipificacion: r.fila ? r.fila.canalTipificacion : null };
    await shot(page, '3-preview-tipificacion-original.png');
    let archivoTipifUsado = 'original';
    if (!r.ok) {
      log('AVISO: el original de Tipificacion NO se reconocio como se esperaba -- cae al archivo de respaldo. Revisar despues.');
      r = await subirYVerificar(page, RESPALDO.tipificacion, 'tipificacion', ORIGINALES.tipificacion);
      archivoTipifUsado = 'respaldo';
      reporte.tipificacion.respaldo = { ok: r.ok, filas: r.fila && r.fila.filas ? r.fila.filas.length : null };
      await shot(page, '3b-preview-tipificacion-respaldo.png');
    }
    if (!r.ok) throw new Error('Ni el original ni el respaldo de Tipificacion se reconocieron correctamente -- ABORTA sin guardar.');
    const toastTipif = await guardarCargaActual(page);
    reporte.tipificacion.archivoUsado = archivoTipifUsado;
    reporte.tipificacion.toast = toastTipif;
    reporte.tipificacion.guardadoOk = /✓/.test(toastTipif) && !/✗/.test(toastTipif);
    log('Tipificacion guardado:', toastTipif.replace(/\n/g, ' | '));
    await shot(page, '4-guardado-tipificacion.png');

    await page.evaluate(() => closeCargas());
    await page.waitForTimeout(500);

    // ══ 2. VERIFICAR EN EL DASHBOARD (API real, misma sesion autenticada) ══
    // Nota: NO se hace un reload/Ctrl+F5 completo -- este es un contexto de
    // navegador NUEVO (nunca tuvo JS viejo en cache) y el token de sesion
    // vive solo en memoria (no en localStorage/cookie), asi que un reload
    // real forzaria un login nuevo que el usuario no esta aqui para hacer.
    // Se abre el dashboard con la navegacion propia de la app
    // (openGenericDashboard), que ya usa el JS de esta misma carga de
    // pagina -- el mismo que se acaba de usar para reconocer los archivos.
    await page.evaluate(() => openGenericDashboard('ORLANT'));
    await page.waitForTimeout(1200);

    // --- Agendamiento: API real (mismos endpoints que pinta el panel) ---
    await page.evaluate(() => switchGenericTab('agendamiento'));
    await page.waitForTimeout(1500);
    const estadoAgendasAbrir = await page.evaluate(() => JSON.stringify(_agendasEstado[0] || {}));
    const opcionesAgendas = await page.evaluate(() => apiRequest('GET', '/calidad/agendas/opciones?campana=ORLANT'));
    const porEsp = await page.evaluate(() => apiRequest('GET', '/calidad/agendas/especialidad?campana=ORLANT&mes=2025-04'));
    const porTipoLineaGeneral = await page.evaluate(() => apiRequest('GET', '/calidad/agendas/especialidad?campana=ORLANT&mes=2025-04&tipoLinea=GENERAL'));
    const porTipoLinea3p = await page.evaluate(() => apiRequest('GET', '/calidad/agendas/especialidad?campana=ORLANT&mes=2025-04&tipoLinea=3P'));
    const totalAgendas = porEsp.reduce((a, r) => a + r.cantidad, 0);
    const totalGeneral = porTipoLineaGeneral.reduce((a, r) => a + r.cantidad, 0);
    const total3p = porTipoLinea3p.reduce((a, r) => a + r.cantidad, 0);
    reporte.verificacionDashboard.agendamiento = {
      estadoAlAbrirSinTocarFiltros: estadoAgendasAbrir,
      ultimoMesConDatos: opcionesAgendas.meses ? opcionesAgendas.meses[opcionesAgendas.meses.length - 1] : null,
      barras: porEsp.length,
      totalAbril2025: totalAgendas,
      general: totalGeneral,
      tresP: total3p,
      top5: porEsp.slice(0, 5),
      ultimo: porEsp[porEsp.length - 1],
    };
    await shot(page, '5-agendamiento-produccion.png');

    // --- Tipificacion: API real (mismos endpoints que pinta el panel) ---
    await page.evaluate(() => switchGenericTab('tipificacion'));
    await page.waitForTimeout(1500);
    const porTipoLlamadas = await page.evaluate(() => apiRequest('GET', '/calidad/tipificacion/por-tipo?campana=ORLANT&canal=LLAMADAS'));
    const porTipoWhatsapp = await page.evaluate(() => apiRequest('GET', '/calidad/tipificacion/por-tipo?campana=ORLANT&canal=WHATSAPP'));
    const skillsAVerificar = ['LLAMADAS DE SALIDA', 'CALL INBOUND ORLANT 3P', 'CALL INBOUND ORLANT GENERAL', 'REGIMEN ESPECIALES', 'CANCELACIONES Y REPROGRAMACION'];
    const porSkill = {};
    for (const skill of skillsAVerificar) {
      const r2 = await page.evaluate((s) => apiRequest('GET', '/calidad/tipificacion/por-tipo?campana=ORLANT&canal=LLAMADAS&skill=' + encodeURIComponent(s)), skill);
      porSkill[skill] = r2.total;
    }
    const ejemploEdwin = await page.evaluate(() => apiRequest('GET', '/calidad/tipificacion/por-tipo?campana=ORLANT&canal=LLAMADAS&skill=' + encodeURIComponent('LLAMADAS DE SALIDA') + '&agente=' + encodeURIComponent('SARA RAMIREZ LOPEZ') + '&desde=2026-08-15&hasta=2026-08-20'));
    reporte.verificacionDashboard.tipificacion = {
      totalLlamadas: porTipoLlamadas.total,
      top3: porTipoLlamadas.datos.slice(0, 3),
      porSkill,
      ejemploEdwinTotal: ejemploEdwin.total,
      whatsappTotal: porTipoWhatsapp.total,
    };
    await shot(page, '6-tipificacion-produccion.png');

    // --- Trafico: sigue igual (lectura DOM, mismo criterio ya usado en Fases 77/78) ---
    await page.evaluate(() => switchGenericTab('trafico'));
    await page.waitForTimeout(1200);
    const kpisLlamadas = await page.$eval('#tv-kpis-0', (el) => el.textContent.replace(/\s+/g, ' ').trim()).catch(() => '');
    await shot(page, '7-trafico-llamadas-produccion.png');
    await page.evaluate(() => switchGenericTab('trafico_whatsapp'));
    await page.waitForTimeout(1200);
    const kpisWhatsapp = await page.$eval('#tww-kpis-0', (el) => el.textContent.replace(/\s+/g, ' ').trim()).catch(() => '');
    await shot(page, '8-trafico-whatsapp-produccion.png');
    reporte.verificacionDashboard.trafico = { kpisLlamadas, kpisWhatsapp };

    reporte.erroresConsola = erroresConsola;

    const va = reporte.verificacionDashboard.agendamiento;
    const vt = reporte.verificacionDashboard.tipificacion;
    const vtr = reporte.verificacionDashboard.trafico;
    ok =
      reporte.agendas.guardadoOk && reporte.tipificacion.guardadoOk &&
      va.barras === 16 && va.totalAbril2025 === 7426 && va.general === 4643 && va.tresP === 2783 &&
      vt.totalLlamadas === 14940 && vt.ejemploEdwinTotal === 40 && !vt.whatsappTotal &&
      /8[.,]061/.test(vtr.kpisLlamadas) && /7[.,]159/.test(vtr.kpisLlamadas) && /902/.test(vtr.kpisLlamadas) &&
      /7[.,]305/.test(vtr.kpisWhatsapp) && /7[.,]109/.test(vtr.kpisWhatsapp) && /196/.test(vtr.kpisWhatsapp) &&
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
