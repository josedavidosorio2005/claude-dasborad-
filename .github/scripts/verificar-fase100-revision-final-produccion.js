// verificar-fase100-revision-final-produccion.js — Fase 100 tema A. Revision
// final EN PRODUCCION (https://informa.inconexion.com.co), SOLO LECTURA,
// antes de entregar ORLANT. Playwright directo desde Node (headless:false,
// navegador visible) -- NO la extension de Claude in Chrome. El usuario
// inicia sesion a mano; el script nunca ve ni escribe la contrasena, no
// persiste storageState ni cookies en disco. No crea, sube, borra ni
// cambia NADA en produccion -- ni siquiera al "descargar" (son GETs).
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const XLSX = require(process.env.XLSX_MODULE_PATH || 'xlsx');

const BASE = 'https://informa.inconexion.com.co';
const DIR_EDWIN = 'C:\\Users\\filid\\Documents\\trabajo inconexion\\bases edwin';
const OUT_SHOTS = path.join(DIR_EDWIN, 'capturas-produccion', 'fase100-revision-final');
const OUT_EXPORTS = path.join(DIR_EDWIN, 'exportes-prueba', 'fase100');
const LOGIN_TIMEOUT_MS = 10 * 60 * 1000;

const TABS = ['trafico', 'trafico_whatsapp', 'agendamiento', 'inasistencia', 'tipificacion', 'calidad'];
const VIEWPORTS = [
  { name: 'escritorio', width: 1440, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'celular', width: 375, height: 812 },
];
const TEMAS = ['light', 'dark'];

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
  fs.mkdirSync(OUT_EXPORTS, { recursive: true });
  const erroresConsola = [];
  const peticionesFallidas = [];
  const reporte = { hallazgos: [], tiempos: {}, numerosControl: {}, exportes: {}, plantilla: null, calidad: {} };

  function hallazgo(sev, texto) { reporte.hallazgos.push({ sev, texto }); log(`[${sev}]`, texto); }

  let browser;
  try {
    browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({ viewport: VIEWPORTS[0], acceptDownloads: true });
    const page = await context.newPage();
    page.on('pageerror', (e) => { erroresConsola.push('pageerror: ' + e.message); });
    page.on('console', (m) => { if (m.type() === 'error' && !/favicon/i.test(m.text())) erroresConsola.push('console.error: ' + m.text()); });
    page.on('response', (res) => { if (res.status() >= 400 && !res.url().includes('/favicon')) peticionesFallidas.push(res.status() + ' ' + res.url()); });

    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
    const logueado = await esperarLogin(page);
    if (!logueado) throw new Error('Se agoto el tiempo de espera de login (10 min).');
    log('Login detectado, continuando automaticamente.');
    await page.waitForTimeout(1000);

    // ── Numeros de control (API, independientes de viewport/tema) ──────
    reporte.numerosControl = await page.evaluate(async () => {
      const tipif = await apiRequest('GET', '/calidad/tipificacion/por-tipo?campana=ORLANT&canal=LLAMADAS');
      const porEsp = await apiRequest('GET', '/calidad/agendas/especialidad?campana=ORLANT&mes=2025-04');
      const porLinea = await apiRequest('GET', '/calidad/agendas/linea?campana=ORLANT&mes=2025-04');
      const totalAgendas = porEsp.reduce((a, r) => a + r.cantidad, 0);
      const audifonos = porEsp.find((r) => r.especialidad === 'AUDIFONOS');
      const linea2025 = porLinea.filter((r) => r.mes === '2025-04');
      const resumenAgo = await apiRequest('GET', '/calidad/inasistencia/resumen?campana=ORLANT&mes=2026-08');
      const sep = await apiRequest('GET', '/calidad/inasistencia/especialidad?campana=ORLANT&mes=2026-09');
      return {
        tipificacionTotal: tipif.total,
        totalAgendas, audifonos: audifonos ? audifonos.cantidad : null,
        lineaGeneral: (linea2025.find((r) => r.tipoLinea === 'GENERAL') || {}).cantidad,
        linea3p: (linea2025.find((r) => r.tipoLinea === '3P') || {}).cantidad,
        inasistenciaAgo: resumenAgo,
        inasistenciaSep: sep,
      };
    });
    log('Numeros de control (API):', JSON.stringify(reporte.numerosControl));
    const nc = reporte.numerosControl;
    if (nc.tipificacionTotal !== 14940) hallazgo('ALTO', `Tipificacion total = ${nc.tipificacionTotal}, se esperaba 14.940`);
    if (nc.totalAgendas !== 7426) hallazgo('ALTO', `Agendas total = ${nc.totalAgendas}, se esperaba 7.426`);
    if (nc.audifonos !== 2141) hallazgo('ALTO', `Agendas AUDIFONOS = ${nc.audifonos}, se esperaba 2.141`);
    if (nc.lineaGeneral !== 4643) hallazgo('ALTO', `Agendas Linea General = ${nc.lineaGeneral}, se esperaba 4.643`);
    if (nc.linea3p !== 2783) hallazgo('ALTO', `Agendas Linea 3P = ${nc.linea3p}, se esperaba 2.783`);
    if (nc.inasistenciaAgo.total !== 5893) hallazgo('ALTO', `Inasistencia Ago-26 total = ${nc.inasistenciaAgo.total}, se esperaba 5.893`);
    if (nc.inasistenciaAgo.pct !== 5.63) hallazgo('ALTO', `Inasistencia Ago-26 % = ${nc.inasistenciaAgo.pct}, se esperaba 5,63`);
    const sepExamenes = nc.inasistenciaSep.find((r) => r.especialidad === 'EXAMENES ESPECIALES');
    const sepPct = sepExamenes ? Math.round(((sepExamenes.inasistencia + sepExamenes.pendiente) / sepExamenes.total) * 10000) / 100 : null;
    if (sepPct !== 6.47) hallazgo('ALTO', `Inasistencia Sep-26 Examenes Especiales % = ${sepPct}, se esperaba 6,47`);

    // ── Plantilla descargable (solo GET, no escribe nada) ───────────────
    await page.evaluate(() => openCargas());
    await page.waitForTimeout(800);
    await page.selectOption('#carga-cliente', 'ORLANT').catch(() => {});
    await page.waitForTimeout(800);
    const [descargaPlantilla] = await Promise.all([
      page.waitForEvent('download'),
      page.click('button[onclick="descargarPlantillaConsolidada()"]'),
    ]);
    const rutaPlantilla = path.join(OUT_EXPORTS, 'plantilla-ORLANT.xlsx');
    await descargaPlantilla.saveAs(rutaPlantilla);
    const wbPlantilla = XLSX.readFile(rutaPlantilla);
    reporte.plantilla = { hojas: wbPlantilla.SheetNames };
    log('Plantilla ORLANT, hojas:', wbPlantilla.SheetNames.join(', '));
    if (!wbPlantilla.SheetNames.includes('INASISTENCIA')) hallazgo('ALTO', 'La plantilla de ORLANT NO trae la hoja INASISTENCIA');
    const wsResumen = wbPlantilla.Sheets['resumen'];
    if (wsResumen) {
      const filasResumen = XLSX.utils.sheet_to_json(wsResumen, { header: 1 });
      const metricas = filasResumen.map((r) => String(r[0] || ''));
      const viejosPresentes = metricas.filter((m) => /inasist_|inasistencia audifonos|inasistencia audiologia|inasistencia examenes|inasistencia total/i.test(m));
      if (viejosPresentes.length) hallazgo('MEDIO', `La hoja "resumen" de la plantilla todavia lista campos viejos de inasistencia: ${viejosPresentes.join(', ')}`);
    }
    await page.evaluate(() => closeCargas());
    await page.waitForTimeout(300);

    // ── Recorrido completo: viewport x tema x pestañas ──────────────────
    for (const vp of VIEWPORTS) {
      for (const tema of TEMAS) {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.evaluate((t) => { if (typeof aplicarTema === 'function') aplicarTema(t); }, tema);
        await page.waitForTimeout(300);

        const inicioApertura = Date.now();
        await page.evaluate(() => openGenericDashboard('ORLANT'));
        await page.waitForTimeout(1800);
        reporte.tiempos[`apertura-${vp.name}-${tema}`] = Date.now() - inicioApertura;
        await page.evaluate(() => { if (typeof _gdIrAMes === 'function') _gdIrAMes('2026-08'); });
        await page.waitForTimeout(1000);

        for (const tab of TABS) {
          const inicio = Date.now();
          await page.evaluate((k) => switchGenericTab(k), tab);
          await page.waitForTimeout(1500);
          const ms = Date.now() - inicio;
          reporte.tiempos[`${tab}-${vp.name}-${tema}`] = ms;
          if (ms > 6000) hallazgo('MEDIO', `Pestaña "${tab}" tardo ${ms}ms en ${vp.name}/${tema} (>6s)`);

          const estado = await page.evaluate(() => {
            const panels = document.getElementById('gd-panels');
            return {
              scrollAncho: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
              avisosSinDatos: panels ? panels.innerText.match(/Sin datos|sin datos cargados|todavia no tiene datos/gi) || [] : [],
              canvasVisibles: Array.from(document.querySelectorAll('#gd-panels canvas')).filter((c) => c.offsetParent !== null).length,
              canvasOcultosPorVacio: document.querySelectorAll('#gd-panels .oc-nodata').length,
            };
          });
          if (estado.scrollAncho && vp.name === 'celular') hallazgo('MEDIO', `Scroll horizontal en celular, pestaña "${tab}" (${tema})`);
          if (estado.avisosSinDatos.length) log(`  [info] "${tab}" (${vp.name}/${tema}): aviso(s) sin datos x${estado.avisosSinDatos.length}`);

          // Sub-pestañas: solo se recorren una vez (escritorio/claro) para no triplicar el trabajo.
          if (vp.name === 'escritorio' && tema === 'light') {
            const subtabs = await page.evaluate((k) => {
              const t = _gd.config.layout.tabs.find((x) => x.key === k);
              return (t && t.subtabs) ? t.subtabs.map((s) => s.key) : [];
            }, tab);
            for (const sub of subtabs) {
              await page.evaluate((k) => switchGenericSubtab(k), sub);
              await page.waitForTimeout(1200);
              await shot(page, `${tab}-${sub}-${vp.name}-${tema}.png`);
            }
          } else {
            await shot(page, `${tab}-${vp.name}-${tema}.png`);
          }
        }
        await page.evaluate(() => closeGenericDashboard());
        await page.waitForTimeout(300);
      }
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.evaluate(() => { if (typeof aplicarTema === 'function') aplicarTema('light'); });

    // ── Exportar: cada pestaña, escritorio/claro, confirma que ninguna hoja sale vacia sin aviso ──
    await page.evaluate(() => openGenericDashboard('ORLANT'));
    await page.waitForTimeout(1500);
    await page.evaluate(() => { if (typeof _gdIrAMes === 'function') _gdIrAMes('2026-08'); });
    await page.waitForTimeout(1000);
    for (const tab of TABS) {
      await page.evaluate((k) => switchGenericTab(k), tab);
      await page.waitForTimeout(1500);
      try {
        const [descarga] = await Promise.all([
          page.waitForEvent('download', { timeout: 15000 }),
          page.evaluate(() => { if (typeof _gdExportExcel === 'function') _gdExportExcel(); }),
        ]);
        const nombreArchivo = `export-${tab}.xlsx`;
        const ruta = path.join(OUT_EXPORTS, nombreArchivo);
        await descarga.saveAs(ruta);
        const wb = XLSX.readFile(ruta);
        const hojasVacias = [];
        wb.SheetNames.forEach((nombreHoja) => {
          const filas = XLSX.utils.sheet_to_json(wb.Sheets[nombreHoja]);
          if (!filas.length) hojasVacias.push(nombreHoja);
        });
        reporte.exportes[tab] = { hojas: wb.SheetNames, hojasVacias };
        log(`Exportar "${tab}": hojas=${wb.SheetNames.join(',')} vacias=${hojasVacias.join(',') || 'ninguna'}`);
        // Una hoja vacia SIN fila de aviso (columna "Valor"/"mensaje" tipico de tipo 'aviso') es sospechosa.
        const hojasVaciasSinAviso = hojasVacias.filter((h) => !/aviso|mensaje/i.test(h));
        if (hojasVaciasSinAviso.length) hallazgo('MEDIO', `Exportar "${tab}": hoja(s) vacia(s) sin marca de aviso: ${hojasVaciasSinAviso.join(', ')}`);
      } catch (e) {
        hallazgo('MEDIO', `Exportar "${tab}" fallo o no disparo descarga: ${e.message}`);
      }
    }
    await page.evaluate(() => closeGenericDashboard());
    await page.waitForTimeout(300);

    // ── Calidad: formulario de monitoreo (sin guardar) + catalogo ───────
    await page.evaluate(() => openCalidad());
    await page.waitForTimeout(800);
    await page.selectOption('#cal-campana-sel', 'ORLANT').catch(() => {});
    await page.waitForTimeout(600);
    await page.evaluate(() => switchCalTab('nuevo'));
    await page.waitForTimeout(600);
    reporte.calidad.formulario = await page.evaluate(() => ({
      fechaDisabled: document.getElementById('cf-fecha') ? document.getElementById('cf-fecha').disabled : null,
      evaluadorDisabled: document.getElementById('cf-evaluador') ? document.getElementById('cf-evaluador').disabled : null,
    }));
    log('Calidad, formulario de monitoreo (sin guardar):', JSON.stringify(reporte.calidad.formulario));
    if (!reporte.calidad.formulario.fechaDisabled) hallazgo('ALTO', 'Calidad: la FECHA del formulario de monitoreo NO esta bloqueada');
    if (!reporte.calidad.formulario.evaluadorDisabled) hallazgo('ALTO', 'Calidad: el EVALUADOR del formulario de monitoreo NO esta bloqueado');
    await shot(page, 'calidad-formulario-monitoreo.png');
    await page.evaluate(() => switchCalTab('config'));
    await page.waitForTimeout(600);
    await shot(page, 'calidad-catalogo-codificaciones.png');
    await page.evaluate(() => closeCalidad());
    await page.waitForTimeout(300);

    reporte.erroresConsola = [...new Set(erroresConsola)];
    reporte.peticionesFallidas = [...new Set(peticionesFallidas)];
    if (reporte.erroresConsola.length) hallazgo('ALTO', `${reporte.erroresConsola.length} error(es) de consola distintos durante el recorrido`);
    if (reporte.peticionesFallidas.length) hallazgo('ALTO', `${reporte.peticionesFallidas.length} peticion(es) fallida(s) distinta(s) durante el recorrido`);

    fs.writeFileSync(path.join(OUT_SHOTS, 'reporte-revision-final.json'), JSON.stringify(reporte, null, 2));
    log('=== RESUMEN ===');
    log('Hallazgos:', reporte.hallazgos.length);
    reporte.hallazgos.forEach((h) => log(`  [${h.sev}] ${h.texto}`));
    log('Tiempos (ms):', JSON.stringify(reporte.tiempos));
    log('Consola:', reporte.erroresConsola.length, 'Peticiones fallidas:', reporte.peticionesFallidas.length);
    log('=== FIN (navegador se cierra) ===');
  } catch (e) {
    console.error('FALLO:', e.message, e.stack);
  } finally {
    if (browser) await browser.close();
  }
})();
