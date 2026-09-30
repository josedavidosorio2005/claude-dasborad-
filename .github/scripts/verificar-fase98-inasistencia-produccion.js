// verificar-fase98-inasistencia-produccion.js — Fase 98 (ORLANT, pedido
// URGENTE de Edwin). Tema D: sube bases edwin\INASISTENCIA.xlsx TAL CUAL
// (unica escritura autorizada de esta fase) y verifica la pestaña
// Inasistencia con los numeros de control reales, ademas de confirmar que
// nada mas cambio (Tipificacion/Trafico/Agendas).
//
// Playwright DIRECTO desde Node (headless:false, navegador visible) -- NO
// la extension de Claude in Chrome (regla fija del proyecto, CLAUDE.md). El
// usuario inicia sesion a mano en la ventana que abre este script; el
// script nunca ve ni escribe la contrasena, y no persiste storageState ni
// cookies en disco -- todo vive en memoria de esta sola ejecucion de Node.
//
// El dialogo confirm() de la carga se acepta automaticamente (headless no
// puede hacer clic en un dialogo nativo) -- su TEXTO se captura y se
// imprime/guarda para verificar que dice lo esperado ANTES de aceptarlo.
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'https://informa.inconexion.com.co';
const ARCHIVO_INASISTENCIA = 'C:\\Users\\filid\\Documents\\trabajo inconexion\\bases edwin\\INASISTENCIA.xlsx';
const DIR_EDWIN = 'C:\\Users\\filid\\Documents\\trabajo inconexion\\bases edwin';
const OUT_DIR = path.join(DIR_EDWIN, 'capturas-produccion', 'fase98-inasistencia');
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
  let mensajeConfirmacion = null;

  try {
    browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    page.on('pageerror', (e) => erroresConsola.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/favicon/i.test(m.text())) erroresConsola.push('console.error: ' + m.text()); });
    page.on('response', (res) => { if (res.status() >= 400) peticionesFallidas.push(res.status() + ' ' + res.url()); });
    page.on('requestfailed', (req) => peticionesFallidas.push('FAILED ' + req.url()));
    // El confirm() de guardarCarga -> _cargasGuardarInasistencia se acepta
    // solo -- headless no puede hacer clic en un dialogo nativo. El TEXTO
    // se captura ANTES de aceptar para verificar que dice lo esperado.
    page.on('dialog', async (dialog) => {
      mensajeConfirmacion = dialog.message();
      log('Dialogo de confirmacion:', mensajeConfirmacion);
      await dialog.accept();
    });

    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
    const logueado = await esperarLogin(page);
    if (!logueado) throw new Error('Se agoto el tiempo de espera de login (10 min) sin detectar sesion iniciada.');
    log('Login detectado, continuando automaticamente.');
    await page.waitForTimeout(1000);

    // ── Numeros de control ANTES de la carga (nada mas debe cambiar) ────
    // Trafico de Llamadas/WhatsApp no tiene un endpoint "resumen" propio (se
    // carga a `_trafico[campana].filas` via trafico_combo, ver
    // dashboard-generic.js _gdBootstrap) -- se confirma por CAPTURA visual
    // (pantallas 6/7 mas abajo), no por API, para no adivinar una ruta que
    // no existe. Tipificacion y Agendas SI tienen endpoints de lectura
    // confirmados (routes/tipificaciones.js, routes/agendas.js).
    const controlAntes = await page.evaluate(async () => {
      const tipif = await apiRequest('GET', '/calidad/tipificacion/por-tipo?campana=ORLANT&canal=LLAMADAS');
      return { tipificacionTotal: tipif.total };
    }).catch((e) => ({ error: e.message }));
    reporte.controlAntes = controlAntes;
    log('Numeros de control ANTES:', JSON.stringify(controlAntes));

    // ── Tema D: subir bases edwin\INASISTENCIA.xlsx TAL CUAL ────────────
    await page.evaluate(() => openCargas());
    await page.waitForTimeout(800);
    await page.selectOption('#carga-cliente', 'ORLANT');
    await page.waitForTimeout(800);
    await shot(page, '0-antes-de-subir.png');

    await page.setInputFiles('#carga-file', ARCHIVO_INASISTENCIA);
    await page.waitForTimeout(1500);
    await shot(page, '1-vista-previa.png');

    const previa = await page.evaluate(() => document.getElementById('carga-preview-table').innerText);
    reporte.previa = previa;
    log('Vista previa:', previa.replace(/\n/g, ' | '));

    await page.click('#carga-preview-card .btn-primary'); // "Guardar carga" -> dispara el confirm()
    await page.waitForTimeout(2500); // tiempo para el POST + el toast de resultado
    reporte.mensajeConfirmacion = mensajeConfirmacion;
    await shot(page, '2-despues-de-guardar.png');

    const confirmacionOk = !!mensajeConfirmacion && /Ago-26 \(3 especialidad/.test(mensajeConfirmacion) && /Sep-26 \(1 especialidad/.test(mensajeConfirmacion);
    reporte.confirmacionOk = confirmacionOk;
    if (!confirmacionOk) throw new Error('El mensaje de confirmacion NO decia "Ago-26 (3 especialidades)" y "Sep-26 (1 especialidad)": ' + mensajeConfirmacion);

    // ── Verificacion: pestaña Inasistencia con los numeros de control ───
    await page.evaluate(() => openGenericDashboard('ORLANT'));
    await page.waitForTimeout(1500);
    await page.evaluate(() => { if (typeof _gdIrAMes === 'function') _gdIrAMes('2026-08'); });
    await page.waitForTimeout(1000);
    await page.evaluate(() => switchGenericTab('inasistencia'));
    await page.waitForTimeout(1200);

    const numerosInasistencia = await page.evaluate(async () => {
      const ago = await apiRequest('GET', '/calidad/inasistencia/especialidad?campana=ORLANT&mes=2026-08');
      const sep = await apiRequest('GET', '/calidad/inasistencia/especialidad?campana=ORLANT&mes=2026-09');
      const resumenAgo = await apiRequest('GET', '/calidad/inasistencia/resumen?campana=ORLANT&mes=2026-08');
      return { ago, sep, resumenAgo };
    });
    reporte.numerosInasistencia = numerosInasistencia;
    log('Numeros de control Inasistencia:', JSON.stringify(numerosInasistencia));

    await page.evaluate(() => switchGenericSubtab('porespecialidad'));
    await page.waitForTimeout(1000);
    await shot(page, '3-por-especialidad-ago26.png');

    await page.evaluate(() => switchGenericSubtab('detalle'));
    await page.waitForTimeout(1000);
    await shot(page, '4-detalle-ago26.png');

    await page.evaluate(() => { if (typeof _gdIrAMes === 'function') _gdIrAMes('2026-09'); });
    await page.waitForTimeout(1000);
    await page.evaluate(() => switchGenericSubtab('porespecialidad'));
    await page.waitForTimeout(1000);
    const avisoSep = await page.evaluate(() => (document.getElementById('inasist-aviso-0') || {}).textContent || '');
    reporte.avisoSeptiembre = avisoSep;
    log('Aviso Sep-26:', avisoSep);
    await shot(page, '5-aviso-septiembre.png');

    const mesesSelector = await page.evaluate(() => _gd.periodos);
    reporte.mesesSelector = mesesSelector;

    // Exportar (Excel) -- confirma que dispara una descarga sin error.
    const descargaPromesa = page.waitForEvent('download', { timeout: 15000 }).catch(() => null);
    await page.evaluate(() => { if (typeof _gdExportExcel === 'function') _gdExportExcel(); });
    const descarga = await descargaPromesa;
    reporte.exportarOk = !!descarga;
    log('Exportar:', descarga ? ('OK -- ' + (await descarga.suggestedFilename())) : 'FALLO (sin descarga)');

    // ── Nada mas cambio: Tipificacion/Agendas por API, Trafico por captura ──
    const controlDespues = await page.evaluate(async () => {
      const tipif = await apiRequest('GET', '/calidad/tipificacion/por-tipo?campana=ORLANT&canal=LLAMADAS');
      const porEsp = await apiRequest('GET', '/calidad/agendas/especialidad?campana=ORLANT&mes=2025-04');
      const porLinea = await apiRequest('GET', '/calidad/agendas/linea?campana=ORLANT&mes=2025-04');
      const totalAgendas = porEsp.reduce((a, r) => a + r.cantidad, 0);
      const audifonos = porEsp.find((r) => r.especialidad === 'AUDIFONOS');
      const linea2025 = porLinea.filter((r) => r.mes === '2025-04');
      return {
        tipificacionTotal: tipif.total,
        totalAgendas, audifonos: audifonos ? audifonos.cantidad : null,
        lineaGeneral: (linea2025.find((r) => r.tipoLinea === 'GENERAL') || {}).cantidad,
        linea3p: (linea2025.find((r) => r.tipoLinea === '3P') || {}).cantidad,
      };
    }).catch((e) => ({ error: e.message }));
    reporte.controlDespues = controlDespues;
    log('Numeros de control DESPUES (Tipificacion/Agendas, nada debe cambiar):', JSON.stringify(controlDespues));

    // Trafico de Llamadas / WhatsApp -- captura visual (numeros de control
    // 8.061/7.159/902 y 7.305/7.109/196 + SL20 34,67% se leen a mano de la
    // pantalla, no hay endpoint de "resumen" que consultar por API).
    await page.evaluate(() => switchGenericTab('trafico'));
    await page.waitForTimeout(1500);
    await shot(page, '6-trafico-llamadas.png');
    await page.evaluate(() => switchGenericTab('trafico_whatsapp'));
    await page.waitForTimeout(1500);
    await shot(page, '7-trafico-whatsapp.png');

    reporte.erroresConsola = erroresConsola;
    reporte.peticionesFallidas = peticionesFallidas;
    const okConsola = erroresConsola.length === 0 && peticionesFallidas.length === 0;
    const okAgo = numerosInasistencia.ago.length === 3;
    const okSep = numerosInasistencia.sep.length === 1 && numerosInasistencia.sep[0].especialidad === 'EXAMENES ESPECIALES';
    const okAviso = /solo hay datos de Examenes Especiales|solo hay datos de Exámenes Especiales/i.test(avisoSep);
    const okSelector = mesesSelector.includes('2026-08') && mesesSelector.includes('2026-09');
    const okAgendas = controlDespues.totalAgendas === 7426 && controlDespues.audifonos === 2141
      && controlDespues.lineaGeneral === 4643 && controlDespues.linea3p === 2783;
    const okTipificacion = controlDespues.tipificacionTotal === 14940;

    log('=== RESULTADO ===');
    log('Confirmacion (Ago-26 x3 / Sep-26 x1):', confirmacionOk ? 'OK' : 'FALLO');
    log('Ago-26 con 3 especialidades:', okAgo ? 'OK' : 'FALLO');
    log('Sep-26 solo Examenes Especiales:', okSep ? 'OK' : 'FALLO');
    log('Aviso "menos especialidades":', okAviso ? 'OK' : 'FALLO -- ' + avisoSep);
    log('Selector de MES incluye Ago-26/Sep-26:', okSelector ? 'OK' : 'FALLO');
    log('Exportar:', reporte.exportarOk ? 'OK' : 'FALLO');
    log('Tipificacion sigue en 14.940:', okTipificacion ? 'OK' : 'FALLO -- ' + controlDespues.tipificacionTotal);
    log('Agendas sigue igual (7.426 / AUDIFONOS 2.141 / General 4.643 / 3P 2.783):', okAgendas ? 'OK' : 'FALLO -- ' + JSON.stringify(controlDespues));
    log('Consola/peticiones (0 errores):', okConsola ? 'OK' : 'FALLO -- ' + JSON.stringify({ erroresConsola, peticionesFallidas }));

    ok = confirmacionOk && okAgo && okSep && okAviso && okSelector && reporte.exportarOk && okTipificacion && okAgendas && okConsola;
    reporte.ok = ok;
    fs.writeFileSync(path.join(OUT_DIR, 'reporte.json'), JSON.stringify(reporte, null, 2));
    console.log(JSON.stringify(reporte, null, 2));
  } catch (e) {
    console.error('FALLO:', e.message);
    reporte.error = e.message;
    reporte.erroresConsola = erroresConsola;
    reporte.peticionesFallidas = peticionesFallidas;
    fs.writeFileSync(path.join(OUT_DIR, 'reporte.json'), JSON.stringify(reporte, null, 2));
    ok = false;
  } finally {
    if (browser) await browser.close();
  }
  process.exit(ok ? 0 : 1);
})();
