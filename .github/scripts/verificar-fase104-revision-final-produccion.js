// verificar-fase104-revision-final-produccion.js — Fase 104 (ranking de
// agendamiento por asesor). Revision final EN PRODUCCION
// (https://informa.inconexion.com.co), SOLO LECTURA, igual criterio que los
// scripts de las Fases 100/102/103: Playwright directo desde Node
// (headless:false, navegador visible) -- NO la extension de Claude in
// Chrome. El usuario inicia sesion a mano; el script nunca ve ni escribe la
// contrasena, no persiste storageState ni cookies en disco. No crea, sube,
// borra ni cambia NADA en produccion -- ni siquiera al "descargar" (son GETs).
//
// Diferencia con el script de la Fase 103: agrega la confirmacion del
// ranking de asesores (GET /calidad/agendas/ranking, total y homonimos
// fundidos) y una captura de la sub-pestaña "Ranking de asesores" -- el
// resto (numeros de control, exports, formulario de Calidad, guia de uso,
// #gd-modal a pantalla completa, 0 errores de consola) es identico, para no
// perder cobertura de regresion de las 2 fases anteriores en el mismo
// recorrido (la verificacion final en produccion de la Fase 103 seguia
// pendiente al cerrar esta fase -- ver PROGRESS.md).
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const XLSX = require(process.env.XLSX_MODULE_PATH || 'xlsx');

const BASE = 'https://informa.inconexion.com.co';
const DIR_EDWIN = 'C:\\Users\\filid\\Documents\\trabajo inconexion\\bases edwin';
const OUT_SHOTS = path.join(DIR_EDWIN, 'capturas-produccion', 'fase104-revision-final');
const OUT_EXPORTS = path.join(DIR_EDWIN, 'exportes-prueba', 'fase104');
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
      // Fase 104: ranking completo de asesores -- la suma de "total" de
      // todas las filas debe dar el mismo total que "especialidad" (7.426),
      // y cuantos asesores reales tenian mas de una variante de escritura
      // en el periodo (homonimos fundidos al agrupar, nunca modificado en
      // la base).
      const ranking = await apiRequest('GET', '/calidad/agendas/ranking?campana=ORLANT&mes=2025-04');
      const resumenAgo = await apiRequest('GET', '/calidad/inasistencia/resumen?campana=ORLANT&mes=2026-08');
      const sep = await apiRequest('GET', '/calidad/inasistencia/especialidad?campana=ORLANT&mes=2026-09');

      // Trafico de Llamadas: suma cruda de total/contestadas sobre TODAS las
      // filas diarias de ORLANT (sin filtrar por skill/fecha) -- mismo dato
      // que alimenta la grafica de la pestaña, sin reinventar la agregacion.
      const diario = await apiRequest('GET', '/calidad/nivel-servicio/diario?campana=ORLANT');
      const llamadasTotal = diario.reduce((a, r) => a + (Number(r.totalLlamadas) || 0), 0);
      const llamadasContestadas = diario.reduce((a, r) => a + (Number(r.contestadas) || 0), 0);

      // Trafico de WhatsApp: mismo criterio, mas el SL20 ponderado por
      // totalWhatsapp (traficoWppServiceLevelPromedioPeriodo, ya cargada
      // como global en esta pagina -- mismo calculo que usa el panel real).
      const wpp = await apiRequest('GET', '/calidad/trafico/whatsapp?campana=ORLANT');
      const wppTotal = wpp.reduce((a, r) => a + (Number(r.totalWhatsapp) || 0), 0);
      const wppContestados = wpp.reduce((a, r) => a + (Number(r.contestados) || 0), 0);
      const sl20 = (typeof traficoWppServiceLevelPromedioPeriodo === 'function')
        ? traficoWppServiceLevelPromedioPeriodo(wpp, 'serviceLevel20secPct')
        : null;

      return {
        tipificacionTotal: tipif.total,
        totalAgendas, audifonos: audifonos ? audifonos.cantidad : null,
        lineaGeneral: (linea2025.find((r) => r.tipoLinea === 'GENERAL') || {}).cantidad,
        linea3p: (linea2025.find((r) => r.tipoLinea === '3P') || {}).cantidad,
        rankingTotal: ranking.total,
        rankingFilas: ranking.filas.length,
        rankingVariantesConHomonimos: ranking.variantesConHomonimos,
        rankingSumaTotal: ranking.filas.reduce((a, f) => a + f.total, 0),
        rankingSumaPct: Math.round(ranking.filas.reduce((a, f) => a + f.pct, 0) * 100) / 100,
        inasistenciaAgo: resumenAgo,
        inasistenciaSep: sep,
        llamadasTotal, llamadasContestadas, llamadasPendientes: llamadasTotal - llamadasContestadas,
        wppTotal, wppContestados, wppPendientes: wppTotal - wppContestados, wppSl20: sl20,
      };
    });
    log('Numeros de control (API):', JSON.stringify(reporte.numerosControl));
    const nc = reporte.numerosControl;
    if (nc.tipificacionTotal !== 14940) hallazgo('ALTO', `Tipificacion total = ${nc.tipificacionTotal}, se esperaba 14.940`);
    if (nc.llamadasTotal !== 8061) hallazgo('ALTO', `Trafico Llamadas total = ${nc.llamadasTotal}, se esperaba 8.061`);
    if (nc.llamadasContestadas !== 7159) hallazgo('ALTO', `Trafico Llamadas contestadas = ${nc.llamadasContestadas}, se esperaba 7.159`);
    if (nc.llamadasPendientes !== 902) hallazgo('ALTO', `Trafico Llamadas pendientes = ${nc.llamadasPendientes}, se esperaba 902`);
    if (nc.wppTotal !== 7305) hallazgo('ALTO', `Trafico WhatsApp total = ${nc.wppTotal}, se esperaba 7.305`);
    if (nc.wppContestados !== 7109) hallazgo('ALTO', `Trafico WhatsApp contestados = ${nc.wppContestados}, se esperaba 7.109`);
    if (nc.wppPendientes !== 196) hallazgo('ALTO', `Trafico WhatsApp pendientes = ${nc.wppPendientes}, se esperaba 196`);
    if (nc.wppSl20 !== 34.67) hallazgo('ALTO', `Trafico WhatsApp SL20 = ${nc.wppSl20}, se esperaba 34,67`);
    if (nc.totalAgendas !== 7426) hallazgo('ALTO', `Agendas total = ${nc.totalAgendas}, se esperaba 7.426`);
    if (nc.audifonos !== 2141) hallazgo('ALTO', `Agendas AUDIFONOS = ${nc.audifonos}, se esperaba 2.141`);
    if (nc.lineaGeneral !== 4643) hallazgo('ALTO', `Agendas Linea General = ${nc.lineaGeneral}, se esperaba 4.643`);
    if (nc.linea3p !== 2783) hallazgo('ALTO', `Agendas Linea 3P = ${nc.linea3p}, se esperaba 2.783`);
    if (nc.rankingTotal !== 7426) hallazgo('ALTO', `Ranking de asesores: total = ${nc.rankingTotal}, se esperaba 7.426 (igual a Agendas total)`);
    if (nc.rankingSumaTotal !== 7426) hallazgo('ALTO', `Ranking de asesores: suma de "total" de todas las filas = ${nc.rankingSumaTotal}, se esperaba 7.426`);
    if (nc.rankingSumaPct !== 100) hallazgo('ALTO', `Ranking de asesores: suma de "%" = ${nc.rankingSumaPct}, se esperaba 100`);
    log(`Ranking de asesores: ${nc.rankingFilas} fila(s), ${nc.rankingVariantesConHomonimos} asesor(es) real(es) con variantes de escritura distintas en abril 2025.`);
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

        // Fase 103: #gd-modal debe cubrir el viewport EXACTO, sin esquinas
        // redondeadas -- confirmado en produccion real, no solo en demo.
        const medidaModal = await page.evaluate(() => {
          const m = document.getElementById('gd-modal');
          const r = m.getBoundingClientRect();
          return { top: r.top, left: r.left, width: r.width, height: r.height, vw: window.innerWidth, vh: window.innerHeight, borderRadius: getComputedStyle(m).borderRadius };
        });
        const cubre = Math.abs(medidaModal.width - medidaModal.vw) <= 1 && Math.abs(medidaModal.height - medidaModal.vh) <= 2 && medidaModal.top === 0 && medidaModal.left === 0;
        if (!cubre) hallazgo('ALTO', `#gd-modal no cubre el viewport en ${vp.name}/${tema}: ${JSON.stringify(medidaModal)}`);
        if (medidaModal.borderRadius !== '0px') hallazgo('MEDIO', `#gd-modal tiene esquinas redondeadas en ${vp.name}/${tema} (deberia ser 0): ${medidaModal.borderRadius}`);

        for (const tab of TABS) {
          const inicio = Date.now();
          await page.evaluate((k) => switchGenericTab(k), tab);
          await page.waitForTimeout(1500);
          const ms = Date.now() - inicio;
          reporte.tiempos[`${tab}-${vp.name}-${tema}`] = ms;
          if (ms > 6000) hallazgo('MEDIO', `Pestaña "${tab}" tardo ${ms}ms en ${vp.name}/${tema} (>6s)`);

          const estado = await page.evaluate(() => {
            const panels = document.getElementById('gd-panels');
            const texto = panels ? panels.innerText : '';
            return {
              scrollAncho: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2,
              textoSospechoso: /\bNaN\b|\bundefined\b|\[object Object\]/.test(texto),
              avisosSinDatos: texto.match(/Sin datos|sin datos cargados|todavia no tiene datos/gi) || [],
            };
          });
          if (estado.scrollAncho && vp.name === 'celular') hallazgo('MEDIO', `Scroll horizontal en celular, pestaña "${tab}" (${tema})`);
          if (estado.textoSospechoso) hallazgo('MEDIO', `Texto NaN/undefined/[object Object] visible en "${tab}" (${vp.name}/${tema})`);
          if (estado.avisosSinDatos.length) log(`  [info] "${tab}" (${vp.name}/${tema}): aviso(s) sin datos x${estado.avisosSinDatos.length}`);

          if (vp.name === 'escritorio' && tema === 'light') {
            const subtabs = await page.evaluate((k) => {
              const t = _gd.config.layout.tabs.find((x) => x.key === k);
              return (t && t.subtabs) ? t.subtabs.map((s) => s.key) : [];
            }, tab);
            for (const sub of subtabs) {
              await page.evaluate((k) => switchGenericSubtab(k), sub);
              await page.waitForTimeout(1200);
              await shot(page, `${tab}-${sub}-${vp.name}-${tema}.png`);
              // Fase 104: confirma visualmente la tabla de ranking (filas
              // reales, "Sin asesor" si aplica) ademas de la captura.
              if (sub === 'rankingasesores') {
                const infoTabla = await page.evaluate(() => {
                  const tabla = document.querySelector('table[id^="agendas-ranking-tabla-"]');
                  if (!tabla) return null;
                  const filas = tabla.querySelectorAll('tbody tr');
                  return { nFilas: filas.length, ultima: filas.length ? filas[filas.length - 1].innerText : '' };
                });
                if (!infoTabla) hallazgo('ALTO', 'Ranking de asesores: la tabla no esta montada en el DOM');
                else log('Ranking de asesores (DOM): filas=', infoTabla.nFilas, 'ultima fila=', infoTabla.ultima.replace(/\n/g, ' | '));
              }
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
        const hojasVaciasSinAviso = hojasVacias.filter((h) => !/aviso|mensaje/i.test(h));
        if (hojasVaciasSinAviso.length) hallazgo('MEDIO', `Exportar "${tab}": hoja(s) vacia(s) sin marca de aviso: ${hojasVaciasSinAviso.join(', ')}`);
        // Fase 104: dentro del export de "agendamiento", la hoja de ranking
        // debe traer TODAS las filas (ninguna se esconde en "Otros") y la
        // misma suma que el total de Agendas.
        if (tab === 'agendamiento') {
          const hojaRanking = wb.SheetNames.find((n) => /ranking/i.test(n));
          if (!hojaRanking) {
            hallazgo('ALTO', 'Exportar "agendamiento": no trae ninguna hoja de Ranking de Asesores');
          } else {
            const filasRanking = XLSX.utils.sheet_to_json(wb.Sheets[hojaRanking]);
            const sumaTotalExcel = filasRanking.reduce((a, r) => a + (Number(r.Total) || 0), 0);
            if (sumaTotalExcel !== nc.totalAgendas) {
              hallazgo('ALTO', `Exportar "agendamiento": suma de "Total" en la hoja de ranking = ${sumaTotalExcel}, se esperaba ${nc.totalAgendas}`);
            }
          }
        }
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
      esFullAdmin: typeof isFullAdmin === 'function' ? isFullAdmin() : null,
    }));
    log('Calidad, formulario de monitoreo (sin guardar):', JSON.stringify(reporte.calidad.formulario));
    // La FECHA solo se desbloquea para un administrador completo (Fase 95,
    // correcciones deliberadas) -- a diferencia del script de la Fase 100,
    // este chequeo tiene en cuenta quien inicio sesion para no marcar como
    // hallazgo lo que en realidad es el comportamiento correcto cuando
    // quien verifica es admin.
    const fechaDebeEstarBloqueada = !reporte.calidad.formulario.esFullAdmin;
    if (fechaDebeEstarBloqueada && !reporte.calidad.formulario.fechaDisabled) {
      hallazgo('ALTO', 'Calidad: la FECHA del formulario de monitoreo NO esta bloqueada para un actor que no es administrador completo');
    }
    if (!fechaDebeEstarBloqueada && reporte.calidad.formulario.fechaDisabled) {
      hallazgo('MEDIO', 'Calidad: la FECHA sigue bloqueada para un administrador completo (deberia poder corregirla)');
    }
    if (!reporte.calidad.formulario.evaluadorDisabled) hallazgo('ALTO', 'Calidad: el EVALUADOR del formulario de monitoreo NO esta bloqueado');
    await shot(page, 'calidad-formulario-monitoreo.png');
    await page.evaluate(() => switchCalTab('config'));
    await page.waitForTimeout(600);
    await shot(page, 'calidad-catalogo-codificaciones.png');
    await page.evaluate(() => closeCalidad());
    await page.waitForTimeout(300);

    // ── Guia de uso (Fase 102): abre con sesion, sin errores ────────────
    try {
      const [guia] = await Promise.all([
        page.waitForEvent('popup', { timeout: 8000 }),
        page.click('button.navbar-help-link'),
      ]);
      await guia.waitForLoadState('networkidle');
      const titulo = await guia.title();
      log('Guia de uso abrio en pestaña nueva, titulo:', titulo);
      if (!/gu[ií]a/i.test(titulo)) hallazgo('MEDIO', `La guia de uso abrio pero el titulo no parece el esperado: "${titulo}"`);
      await guia.close();
    } catch (e) {
      hallazgo('MEDIO', `La guia de uso no abrio desde el menu: ${e.message}`);
    }

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
