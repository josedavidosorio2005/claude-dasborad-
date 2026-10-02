// fase111-carga-real-produccion-efectividad.js — Script de un solo uso,
// Fase 111. Carga en PRODUCCION los 2 archivos REALES de ORLANT
// (EFECTIVIDAD_AGENDAMIENTO.xlsx, CITAS_ATENDIDAS.xlsx), autorizado
// explicitamente por el usuario, por la interfaz normal de "Cargar Datos
// de Dashboards" -- nunca SQL directo, nunca un workflow.
//
// Playwright DIRECTO desde Node (headless:false, navegador visible) -- NO
// la extension de Claude in Chrome (regla fija del proyecto, CLAUDE.md). El
// usuario inicia sesion a mano; el script nunca ve ni escribe la
// contrasena, no persiste storageState/cookies en disco.
//
// Solo imprime/guarda ESTRUCTURA y AGREGADOS (conteos, totales, % del
// control YA publico que el propio Edwin/InCo dieron) -- nunca el listado
// completo de nombres de asesores. Capturas fuera del repo, en
// "bases edwin\capturas-produccion\fase111-efectividad\".
//
// Fase 112: "bases edwin\" se reorganizo en subcarpetas por tipo de base
// (agendas/, tipificacion/, efectividad/, inasistencia/, consolidadas/,
// respaldos/ -- ver INDICE.md en esa carpeta). Los 2 archivos de esta
// fase viven ahora en "bases edwin\efectividad\".
'use strict';
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'server', 'node_modules', 'playwright'));
const fs = require('fs');

const BASE = 'https://informa.inconexion.com.co';
const DIR_EDWIN = 'C:\\Users\\filid\\Documents\\trabajo inconexion\\bases edwin';
const OUT_DIR = path.join(DIR_EDWIN, 'capturas-produccion', 'fase111-efectividad');
const LOGIN_TIMEOUT_MS = 10 * 60 * 1000;

const ARCHIVO_EA = path.join(DIR_EDWIN, 'efectividad', 'EFECTIVIDAD_AGENDAMIENTO.xlsx');
const ARCHIVO_EC = path.join(DIR_EDWIN, 'efectividad', 'CITAS_ATENDIDAS.xlsx');

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

async function guardarCargaActual(page) {
  await page.click('#cargas-overlay button:has-text("Guardar carga")');
  await page.waitForTimeout(2000);
  const toast = (await page.locator('#toast').innerText().catch(() => '')).trim();
  return toast;
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const erroresConsola = [];
  const reporte = { efectividadAgendamiento: {}, efectividadCitas: {}, verificacionDashboard: {} };
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

    // ══ 1. CARGAR EFECTIVIDAD_AGENDAMIENTO.xlsx ═══════════════════════════
    await page.evaluate(() => openCargas());
    await page.waitForTimeout(800);
    await page.selectOption('#carga-cliente', 'ORLANT');
    await page.waitForTimeout(800);
    await shot(page, '0-cargas-orlant-produccion.png');

    log('Subiendo EFECTIVIDAD_AGENDAMIENTO.xlsx (archivo real de Edwin)...');
    await page.setInputFiles('#carga-file', ARCHIVO_EA);
    await page.waitForTimeout(2000);
    let resultados = await page.evaluate(() => _cargasResultados);
    let filaEA = resultados.find((r) => r.tipo === 'efectividad_agendamiento');
    if (!filaEA || filaEA.error) throw new Error('EFECTIVIDAD_AGENDAMIENTO.xlsx no se reconocio: ' + (filaEA ? filaEA.error : 'sin fila en el plan'));
    reporte.efectividadAgendamiento.preview = {
      filas: filaEA.filas.length,
      avisos: filaEA.avisos ? filaEA.avisos.length : 0,
      advertenciasEfectividad: filaEA.advertenciasEfectividad ? filaEA.advertenciasEfectividad.length : 0,
      reconocidaPorEncabezadosComo: filaEA.reconocidaPorEncabezadosComo || null,
      mesesDelArchivo: [...new Set(filaEA.filas.map((f) => f.mes))],
    };
    await shot(page, '1-preview-efectividad-agendamiento.png');
    log('Preview EFECTIVIDAD_AGENDAMIENTO:', JSON.stringify(reporte.efectividadAgendamiento.preview));
    if (filaEA.filas.length !== 20) throw new Error('Se esperaban 20 filas en EFECTIVIDAD_AGENDAMIENTO.xlsx, llegaron ' + filaEA.filas.length + ' -- ABORTA sin guardar.');

    const toastEA = await guardarCargaActual(page);
    reporte.efectividadAgendamiento.confirmacionMostrada = ultimoDialogMsg;
    reporte.efectividadAgendamiento.toast = toastEA;
    reporte.efectividadAgendamiento.guardadoOk = /✓/.test(toastEA) && !/✗/.test(toastEA);
    log('EFECTIVIDAD_AGENDAMIENTO guardado:', toastEA.replace(/\n/g, ' | '));
    await shot(page, '2-guardado-efectividad-agendamiento.png');
    if (!reporte.efectividadAgendamiento.guardadoOk) throw new Error('El guardado de EFECTIVIDAD_AGENDAMIENTO no fue OK: ' + toastEA);

    // ══ 2. CARGAR CITAS_ATENDIDAS.xlsx ═════════════════════════════════════
    ultimoDialogMsg = '';
    log('Subiendo CITAS_ATENDIDAS.xlsx (archivo real de Edwin)...');
    await page.setInputFiles('#carga-file', ARCHIVO_EC);
    await page.waitForTimeout(2000);
    resultados = await page.evaluate(() => _cargasResultados);
    const filaEC = resultados.find((r) => r.tipo === 'citas_atendidas');
    if (!filaEC || filaEC.error) throw new Error('CITAS_ATENDIDAS.xlsx no se reconocio: ' + (filaEC ? filaEC.error : 'sin fila en el plan'));
    reporte.efectividadCitas.preview = {
      filas: filaEC.filas.length,
      avisos: filaEC.avisos ? filaEC.avisos.length : 0,
      advertenciasEfectividad: filaEC.advertenciasEfectividad ? filaEC.advertenciasEfectividad.length : 0,
      reconocidaPorEncabezadosComo: filaEC.reconocidaPorEncabezadosComo || null,
      mesesDelArchivo: [...new Set(filaEC.filas.map((f) => f.mes))],
    };
    await shot(page, '3-preview-efectividad-citas.png');
    log('Preview CITAS_ATENDIDAS:', JSON.stringify(reporte.efectividadCitas.preview));
    if (filaEC.filas.length !== 3) throw new Error('Se esperaban 3 filas en CITAS_ATENDIDAS.xlsx, llegaron ' + filaEC.filas.length + ' -- ABORTA sin guardar.');

    const toastEC = await guardarCargaActual(page);
    reporte.efectividadCitas.confirmacionMostrada = ultimoDialogMsg;
    reporte.efectividadCitas.toast = toastEC;
    reporte.efectividadCitas.guardadoOk = /✓/.test(toastEC) && !/✗/.test(toastEC);
    log('CITAS_ATENDIDAS guardado:', toastEC.replace(/\n/g, ' | '));
    await shot(page, '4-guardado-efectividad-citas.png');
    if (!reporte.efectividadCitas.guardadoOk) throw new Error('El guardado de CITAS_ATENDIDAS no fue OK: ' + toastEC);

    await page.evaluate(() => closeCargas());
    await page.waitForTimeout(500);

    // ══ 3. VERIFICAR EN EL DASHBOARD (API real, misma sesion autenticada) ══
    await page.evaluate(() => openGenericDashboard('ORLANT'));
    await page.waitForTimeout(1200);

    // --- Ranking de Asesores (Tema A): control Sep-26 ---
    await page.evaluate(() => switchGenericTab('agendamiento'));
    await page.waitForTimeout(1500);
    await page.evaluate(() => switchGenericSubtab('rankingasesores'));
    await page.waitForTimeout(1500);
    await shot(page, '5-ranking-asesores-produccion.png');
    const mesSelActual = await page.evaluate(() => _gd.mesSel);
    const ranking = await page.evaluate(() => apiRequest('GET', '/calidad/efectividad-agendamiento/ranking?campana=ORLANT&mes=2026-09'));
    const top = ranking.filas[0];
    const bottom = ranking.filas[ranking.filas.length - 1];
    const tieneFalla = ranking.filas.some((f) => /_falla/.test(f.asesor));
    reporte.verificacionDashboard.ranking = {
      mesGlobalAlAbrir: mesSelActual,
      totalFilas: ranking.filas.length,
      equipoGestiones: ranking.equipo.gestiones,
      equipoAgendas: ranking.equipo.agendas,
      equipoEfectividadPct: Math.round(ranking.equipo.efectividad * 10000) / 100,
      primerPuesto: { asesor: top.asesor, gestiones: top.gestiones, agendas: top.agendas, pct: Math.round(top.efectividad * 10000) / 100, puesto: top.puesto },
      ultimoPuesto: { asesor: bottom.asesor, gestiones: bottom.gestiones, agendas: bottom.agendas, pct: Math.round(bottom.efectividad * 10000) / 100, puesto: bottom.puesto },
      tieneFilaFalla: tieneFalla,
    };
    // El mes global por defecto (mesGlobalAlAbrir, ej. Ago-26) nunca cambia
    // solo por cargar datos nuevos -- Sep-26 es el unico mes con Efectividad
    // de Agendamiento, asi que hay que pararse ahi explicitamente antes de
    // exportar (si no, el panel esta legitimamente en su aviso de "sin
    // datos" y el export trae ese aviso, no la tabla -- NO es un error).
    await page.evaluate(() => { if (typeof _gdIrAMes === 'function') _gdIrAMes('2026-09'); });
    await page.waitForTimeout(800);
    const exportEA = await page.evaluate(async () => {
      const tab = (_gd.config.layout.tabs || []).find((t) => t.key === 'agendamiento');
      const i = (tab.panels || []).findIndex((p) => p.tipo === 'efectividad_agendamiento_panel');
      return await _gdExportarEfectividadAgendamiento(tab.panels[i], i);
    });
    reporte.verificacionDashboard.exportRanking = { tipo: exportEA[0].tipo, filas: exportEA[0].filas ? exportEA[0].filas.length : 0 };

    // --- Efectividad de Citas (Tema B): control Ene-26 a Mar-26 ---
    await page.evaluate(() => switchGenericTab('efectividad'));
    await page.waitForTimeout(1500);
    await shot(page, '6-efectividad-citas-produccion-mes-sep.png');
    const avisoEc = await page.$eval('[id^="ec-aviso-"]', (el) => el.textContent.trim()).catch(() => '');
    await page.evaluate(() => { if (typeof _gdIrAMes === 'function') _gdIrAMes('2026-03'); });
    await page.waitForTimeout(1200);
    await shot(page, '7-efectividad-citas-produccion-mar26.png');
    const citasPorMes = await page.evaluate(() => apiRequest('GET', '/calidad/efectividad-citas/mensual?campana=ORLANT'));
    reporte.verificacionDashboard.efectividadCitas = {
      avisoConMesSep26SinDatos: avisoEc,
      meses: citasPorMes.map((f) => ({ mes: f.mes, agendas: f.agendas, atendidas: f.atendidas, pct: Math.round((f.atendidas / f.agendas) * 10000) / 100 })),
      periodoAgendas: citasPorMes.reduce((s, f) => s + f.agendas, 0),
      periodoAtendidas: citasPorMes.reduce((s, f) => s + f.atendidas, 0),
    };
    const exportEC = await page.evaluate(async () => {
      const tab = (_gd.config.layout.tabs || []).find((t) => t.key === 'efectividad');
      const i = (tab.panels || []).findIndex((p) => p.tipo === 'efectividad_citas_panel');
      return await _gdExportarEfectividadCitas(tab.panels[i], i);
    });
    reporte.verificacionDashboard.exportEfectividadCitas = { tipo: exportEC[0].tipo, filas: exportEC[0].filas ? exportEC[0].filas.length : 0 };

    // --- El resto no debe haber cambiado (numeros de control ya conocidos, misma formula que verificar-fase104-revision-final-produccion.js) ---
    // Agendas 7.426/4.643/2.783 es el archivo real de abril 2025 (Abr-25,
    // Fase 80) -- NUNCA el mes global de arriba (Ago-26 por defecto) --
    // mismo mes que usa verificar-fase104-revision-final-produccion.js.
    await page.evaluate(() => { if (typeof _gdIrAMes === 'function') _gdIrAMes('2026-09'); });
    await page.waitForTimeout(800);
    reporte.verificacionDashboard.sinCambios = await page.evaluate(async () => {
      const tipif = await apiRequest('GET', '/calidad/tipificacion/por-tipo?campana=ORLANT&canal=LLAMADAS');
      const porEsp = await apiRequest('GET', '/calidad/agendas/especialidad?campana=ORLANT&mes=2025-04');
      const porLinea = await apiRequest('GET', '/calidad/agendas/linea?campana=ORLANT&mes=2025-04');
      const totalAgendas = porEsp.reduce((a, r) => a + r.cantidad, 0);
      const linea = porLinea.filter((r) => r.mes === '2025-04');
      const diario = await apiRequest('GET', '/calidad/nivel-servicio/diario?campana=ORLANT');
      const llamadasTotal = diario.reduce((a, r) => a + (Number(r.totalLlamadas) || 0), 0);
      const llamadasContestadas = diario.reduce((a, r) => a + (Number(r.contestadas) || 0), 0);
      const wpp = await apiRequest('GET', '/calidad/trafico/whatsapp?campana=ORLANT');
      const wppTotal = wpp.reduce((a, r) => a + (Number(r.totalWhatsapp) || 0), 0);
      const wppContestados = wpp.reduce((a, r) => a + (Number(r.contestados) || 0), 0);
      const sl20 = (typeof traficoWppServiceLevelPromedioPeriodo === 'function') ? traficoWppServiceLevelPromedioPeriodo(wpp, 'serviceLevel20secPct') : null;
      const inasistAgo = await apiRequest('GET', '/calidad/inasistencia/resumen?campana=ORLANT&mes=2026-08');
      const inasistTodos = await apiRequest('GET', '/calidad/inasistencia/mensual?campana=ORLANT');
      const i = inasistTodos.reduce((s, f) => s + f.inasistencia + f.pendiente, 0);
      const t = inasistTodos.reduce((s, f) => s + f.total, 0);
      return {
        tipificacionTotal: tipif.total,
        llamadasTotal, llamadasContestadas, llamadasPendientes: llamadasTotal - llamadasContestadas,
        wppTotal, wppContestados, wppPendientes: wppTotal - wppContestados, wppSl20: sl20,
        agendasTotal: totalAgendas,
        agendasGeneral: (linea.find((r) => r.tipoLinea === 'GENERAL') || {}).cantidad,
        agendas3p: (linea.find((r) => r.tipoLinea === '3P') || {}).cantidad,
        inasistenciaAgoPct: inasistAgo.pct,
        inasistenciaPeriodoPct: Math.round((i / t) * 10000) / 100,
      };
    });

    reporte.erroresConsola = erroresConsola;

    const vr = reporte.verificacionDashboard.ranking;
    const vc = reporte.verificacionDashboard.efectividadCitas;
    const vs = reporte.verificacionDashboard.sinCambios;
    ok =
      reporte.efectividadAgendamiento.guardadoOk && reporte.efectividadCitas.guardadoOk &&
      vr.totalFilas === 20 && vr.equipoGestiones === 18566 && vr.equipoAgendas === 8319 && vr.equipoEfectividadPct === 44.81 &&
      vr.primerPuesto.pct === 97.36 && vr.ultimoPuesto.pct === 12.18 &&
      vc.periodoAgendas === 1108 && vc.periodoAtendidas === 953 &&
      vs.tipificacionTotal === 14940 &&
      vs.llamadasTotal === 8061 && vs.llamadasContestadas === 7159 && vs.llamadasPendientes === 902 &&
      vs.wppTotal === 7305 && vs.wppContestados === 7109 && vs.wppPendientes === 196 && Math.abs(vs.wppSl20 - 34.67) < 0.01 &&
      vs.agendasTotal === 7426 && vs.agendasGeneral === 4643 && vs.agendas3p === 2783 &&
      vs.inasistenciaAgoPct === 7.45 && vs.inasistenciaPeriodoPct === 6.87 &&
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
