// fase124-parte1-pendientes-fase122.js — Fase 124, Parte 1. SOLO LECTURA
// en produccion -- no crea, edita ni sube nada. Cierra lo que la Fase 122
// dejo explicitamente SIN verificar (ver docs/pendientes.md): tema
// oscuro + 1920x1080 + movil 412px en las 7 pestañas/sub-vistas, el
// combo/ranking de Efectividad de Agendamiento con asesores >100%, el
// selector de mes (nombres completos, sin desborde) + el mes parcial
// "Julio 2026", el efecto real del alias de asesor (conteo + 0
// duplicados por fila, sin imprimir nombres), y los 4 exports reales
// (Excel) abiertos y revisados por PII/formulas/columnas vacias.
//
// Playwright DIRECTO desde Node (headless:false) -- NO la extension de
// Claude in Chrome. El usuario inicia sesion a mano, el script nunca ve
// la contraseña. Mismo patron que scripts/produccion/revision-final.js.
'use strict';
const fs = require('fs');
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'server', 'node_modules', 'playwright'));
const XLSX = require(path.join(__dirname, '..', '..', 'public', 'js', 'vendor', 'xlsx-0.20.3.full.min.js'));

const BASE = 'https://informa.inconexion.com.co';
const LOGIN_TIMEOUT_MS = 10 * 60 * 1000;
const OUT_DIR = 'C:\\Users\\filid\\Documents\\trabajo inconexion\\bases edwin\\capturas-produccion\\fase124-parte1';
const DESCARGAS_DIR = path.join(OUT_DIR, 'descargas');

// Numeros de control vigentes (PROGRESS.md tras la Fase 122/123).
const ESPERADO = {
  tipificacionLlamadasTotal: 34661,
  tipificacionLlamadasAgo: 14940, tipificacionLlamadasSep: 19721,
  tipificacionLlamadasFalla: 0,
  tipificacionWppTotal: 25180,
  tipificacionWppJul: 71, tipificacionWppAgo: 12061, tipificacionWppSep: 13048,
  llamadasAgoTotal: 8908, llamadasAgoContestadas: 7961, llamadasAgoPendientes: 947,
  llamadasSepTotal: 9043, llamadasSepContestadas: 8883, llamadasSepPendientes: 160,
  wppAgoTotal: 7390, wppAgoContestados: 7370, wppAgoPendientes: 20, wppAgoSl20: 36.05,
  wppSepTotal: 7968, wppSepContestados: 7953, wppSepPendientes: 15, wppSepSl20: 39.88,
  agendasAgoSepTotal: 24186, agendasAgo: 11040, agendasSep: 13146,
  agendasAbril2025: 7426,
  efectAgendamientoAgoPct: 41.17, efectAgendamientoAgoGestiones: 26814, efectAgendamientoAgoAgendas: 11040,
  efectAgendamientoSepPct: 40.00, efectAgendamientoSepGestiones: 32868, efectAgendamientoSepAgendas: 13146,
  efectCitasEne: 93.67, efectCitasFeb: 84.32, efectCitasMar: 85.54, efectCitasPeriodo: 86.01,
  inasistenciaAgoPct: 7.45, inasistenciaPeriodoPct: 6.87,
  aliasRegistrados: 3,
};

function log(...args) { console.log(new Date().toISOString(), ...args); }
function norm(s) { return String(s || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim(); }

// Detecta si dentro de una lista de nombres crudos quedan 2+ strings
// DISTINTOS que normalizan igual (indicio de que el alias NO unifico del
// todo) -- nunca imprime el nombre real, solo cuantos grupos problematicos
// hay y cuantas variantes crudas tenia cada uno.
function duplicadosNormalizados(lista) {
  const grupos = {};
  (lista || []).forEach((n) => { const k = norm(n); (grupos[k] = grupos[k] || new Set()).add(n); });
  return Object.values(grupos).filter((s) => s.size > 1).map((s) => s.size);
}

async function shot(page, name) {
  try { await page.screenshot({ path: path.join(OUT_DIR, name), fullPage: false }); } catch (e) { log('WARN screenshot fallo:', e.message); }
}

async function esperarLogin(page) {
  log('=== INICIA SESIÓN AHORA EN PRODUCCIÓN (ADMIN) === (hasta 10 min)');
  const deadline = Date.now() + LOGIN_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const info = await page.evaluate(() => {
      if (typeof authToken !== 'string' || !authToken) return null;
      try {
        const p = JSON.parse(atob(authToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        return { isMasterAdmin: !!p.isMasterAdmin, rol: p.rol || null };
      } catch (e) { return null; }
    }).catch(() => null);
    if (info && (info.isMasterAdmin || info.rol === 'ADMIN')) return true;
    await page.waitForTimeout(3000);
  }
  return false;
}

function instalarListeners(page, erroresConsola, peticionesFallidas) {
  page.on('pageerror', (e) => erroresConsola.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon/i.test(m.text())) erroresConsola.push('console.error: ' + m.text()); });
  page.on('requestfailed', (req) => peticionesFallidas.push('requestfailed: ' + req.url()));
  page.on('response', (res) => { if (res.status() >= 400 && !/\/api\/auth\/login$/.test(res.url())) peticionesFallidas.push('http ' + res.status() + ': ' + res.url()); });
}

async function veredictoSubvista(page) {
  return page.evaluate(() => {
    const host = document.getElementById('gd-panels');
    if (!host) return { veredicto: 'sin-panel' };
    const texto = (host.innerText || '').trim();
    const canvases = Array.from(host.querySelectorAll('canvas')).filter((c) => {
      const st = getComputedStyle(c); return st.display !== 'none' && st.visibility !== 'hidden';
    });
    let algunConPixeles = false;
    canvases.forEach((c) => {
      const r = c.getBoundingClientRect(); if (r.width < 5 || r.height < 5) return;
      let ctx; try { ctx = c.getContext('2d'); } catch (e) { return; }
      if (!ctx) return;
      let data; try { data = ctx.getImageData(0, 0, c.width, c.height).data; } catch (e) { return; }
      for (let i = 3; i < data.length; i += 4) { if (data[i] !== 0) { algunConPixeles = true; break; } }
    });
    if (algunConPixeles) return { veredicto: 'dibujo', canvases: canvases.length };
    const mensajeClaro = /sin datos|no disponible|no se entrega|no aplica|sin informaci[oó]n/i.test(texto);
    return { veredicto: mensajeClaro ? 'mensaje_claro' : (texto.length < 3 ? 'EN_BLANCO' : 'revisar'), canvases: canvases.length, textoLen: texto.length };
  });
}

async function hayScrollHorizontal(page) {
  return page.evaluate(() => {
    const de = document.documentElement, b = document.body;
    return Math.max(de.scrollWidth, b ? b.scrollWidth : 0) > window.innerWidth + 2;
  });
}

async function recorrerTabsYSubtabs(page, nombreCombo, erroresConsola, peticionesFallidas) {
  const out = {};
  const nTabs = await page.locator('#gd-tabs .atab').count();
  for (let i = 0; i < nTabs; i++) {
    const tab = page.locator('#gd-tabs .atab').nth(i);
    const label = ((await tab.textContent()) || '').trim();
    await tab.click();
    await page.waitForTimeout(900);
    out[label] = { subvistas: {}, scrollHorizontal: await hayScrollHorizontal(page) };
    const nSub = await page.locator('.gd-subtab-btn').count();
    if (nSub > 0) {
      for (let s = 0; s < nSub; s++) {
        const subBtn = page.locator('.gd-subtab-btn').nth(s);
        const subLabel = ((await subBtn.textContent()) || '').trim();
        await subBtn.click();
        await page.waitForTimeout(700);
        out[label].subvistas[subLabel] = await veredictoSubvista(page);
      }
    } else {
      out[label].subvistas['(sin sub-pestañas)'] = await veredictoSubvista(page);
    }
  }
  out._erroresConsola = erroresConsola.slice();
  out._peticionesFallidas = peticionesFallidas.slice();
  log(nombreCombo + ': ' + nTabs + ' pestañas recorridas, ' + erroresConsola.length + ' errores consola, ' + peticionesFallidas.length + ' peticiones fallidas');
  return out;
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.mkdirSync(DESCARGAS_DIR, { recursive: true });
  const reporte = {};
  let ok = true;
  let browser;

  try {
    browser = await chromium.launch({ headless: false, downloadsPath: DESCARGAS_DIR });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
    const page = await context.newPage();
    const erroresConsola = [], peticionesFallidas = [];
    instalarListeners(page, erroresConsola, peticionesFallidas);

    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
    const logueado = await esperarLogin(page);
    if (!logueado) throw new Error('Timeout de login (10 min).');
    log('Login detectado (ADMIN).');
    await page.waitForTimeout(1000);

    // ══ A. Números de control vigentes (Fase 122/123) ════════════════════
    await page.evaluate(() => openGenericDashboard('ORLANT'));
    await page.waitForTimeout(1200);
    await page.evaluate(() => { if (typeof _gdIrAMes === 'function') _gdIrAMes('2026-09'); });
    await page.waitForTimeout(800);
    const numeros = await page.evaluate(async () => {
      const tipifLl = await apiRequest('GET', '/calidad/tipificacion/por-tipo?campana=ORLANT&canal=LLAMADAS');
      const tipifLlAgo = await apiRequest('GET', '/calidad/tipificacion/por-tipo?campana=ORLANT&canal=LLAMADAS&mes=2026-08');
      const tipifLlSep = await apiRequest('GET', '/calidad/tipificacion/por-tipo?campana=ORLANT&canal=LLAMADAS&mes=2026-09');
      const tipifWpp = await apiRequest('GET', '/calidad/tipificacion/por-tipo?campana=ORLANT&canal=WHATSAPP');
      const tipifWppJul = await apiRequest('GET', '/calidad/tipificacion/por-tipo?campana=ORLANT&canal=WHATSAPP&mes=2026-07');
      const tipifWppAgo = await apiRequest('GET', '/calidad/tipificacion/por-tipo?campana=ORLANT&canal=WHATSAPP&mes=2026-08');
      const tipifWppSep = await apiRequest('GET', '/calidad/tipificacion/por-tipo?campana=ORLANT&canal=WHATSAPP&mes=2026-09');
      const opcLl = await apiRequest('GET', '/calidad/tipificacion/opciones?campana=ORLANT&canal=LLAMADAS');
      const opcWpp = await apiRequest('GET', '/calidad/tipificacion/opciones?campana=ORLANT&canal=WHATSAPP');
      const porEsp = await apiRequest('GET', '/calidad/agendas/especialidad?campana=ORLANT&mes=2025-04');
      const agendasAbril = porEsp.reduce((a, r) => a + r.cantidad, 0);
      const opcAgendas = await apiRequest('GET', '/calidad/agendas/opciones?campana=ORLANT');
      const rankingAgo = await apiRequest('GET', '/calidad/efectividad-agendamiento/ranking?campana=ORLANT&mes=2026-08');
      const rankingSep = await apiRequest('GET', '/calidad/efectividad-agendamiento/ranking?campana=ORLANT&mes=2026-09');
      const diario = await apiRequest('GET', '/calidad/nivel-servicio/diario?campana=ORLANT');
      const wpp = await apiRequest('GET', '/calidad/trafico/whatsapp?campana=ORLANT');
      const citasPorMes = await apiRequest('GET', '/calidad/efectividad-citas/mensual?campana=ORLANT');
      const inasistAgo = await apiRequest('GET', '/calidad/inasistencia/resumen?campana=ORLANT&mes=2026-08');
      const inasistTodos = await apiRequest('GET', '/calidad/inasistencia/mensual?campana=ORLANT');
      const alias = await apiRequest('GET', '/alias-asesores?campana=ORLANT');
      const iAcc = inasistTodos.reduce((s, f) => s + f.inasistencia + f.pendiente, 0);
      const tAcc = inasistTodos.reduce((s, f) => s + f.total, 0);
      return {
        tipifLlTotal: tipifLl.total, tipifLlAgo: tipifLlAgo.total, tipifLlSep: tipifLlSep.total,
        tipifLlFalla: opcLl.agentes.filter((a) => /_falla/i.test(a)).length,
        tipifWppTotal: tipifWpp.total, tipifWppJul: tipifWppJul.total, tipifWppAgo: tipifWppAgo.total, tipifWppSep: tipifWppSep.total,
        agendasAbril2025: agendasAbril,
        rankingAgo: { gestiones: rankingAgo.equipo.gestiones, agendas: rankingAgo.equipo.agendas, pct: Math.round(rankingAgo.equipo.efectividad * 10000) / 100, filas: rankingAgo.filas.map((f) => ({ asesor: f.asesor, efectividad: f.efectividad })) },
        rankingSep: { gestiones: rankingSep.equipo.gestiones, agendas: rankingSep.equipo.agendas, pct: Math.round(rankingSep.equipo.efectividad * 10000) / 100, filas: rankingSep.filas.map((f) => ({ asesor: f.asesor, efectividad: f.efectividad })) },
        inasistenciaAgoPct: inasistAgo.pct, inasistenciaPeriodoPct: Math.round((iAcc / tAcc) * 10000) / 100,
        citasPorMes: citasPorMes.map((f) => ({ mes: f.mes, pct: Math.round((f.atendidas / f.agendas) * 10000) / 100 })),
        citasPeriodoAgendas: citasPorMes.reduce((s, f) => s + f.agendas, 0), citasPeriodoAtendidas: citasPorMes.reduce((s, f) => s + f.atendidas, 0),
        aliasCount: alias.length,
        agentesLlamadas: opcLl.agentes, agentesWhatsapp: opcWpp.agentes, agentesAgendas: opcAgendas.asesores || opcAgendas.agentes || [],
        asesoresRankingAgo: rankingAgo.filas.map((f) => f.asesor), asesoresRankingSep: rankingSep.filas.map((f) => f.asesor),
      };
    });

    reporte.numeros = {
      tipifLlTotal: numeros.tipifLlTotal, tipifLlAgo: numeros.tipifLlAgo, tipifLlSep: numeros.tipifLlSep, tipifLlFalla: numeros.tipifLlFalla,
      tipifWppTotal: numeros.tipifWppTotal, tipifWppJul: numeros.tipifWppJul, tipifWppAgo: numeros.tipifWppAgo, tipifWppSep: numeros.tipifWppSep,
      agendasAbril2025: numeros.agendasAbril2025,
      efectAgendamientoAgo: { gestiones: numeros.rankingAgo.gestiones, agendas: numeros.rankingAgo.agendas, pct: numeros.rankingAgo.pct },
      efectAgendamientoSep: { gestiones: numeros.rankingSep.gestiones, agendas: numeros.rankingSep.agendas, pct: numeros.rankingSep.pct },
      inasistenciaAgoPct: numeros.inasistenciaAgoPct, inasistenciaPeriodoPct: numeros.inasistenciaPeriodoPct,
      citasPorMes: numeros.citasPorMes, citasPeriodoAgendas: numeros.citasPeriodoAgendas, citasPeriodoAtendidas: numeros.citasPeriodoAtendidas,
      aliasCount: numeros.aliasCount,
    };
    const discrepancias = [];
    if (numeros.tipifLlTotal !== ESPERADO.tipificacionLlamadasTotal) discrepancias.push('tipifLlTotal');
    if (numeros.tipifLlAgo !== ESPERADO.tipificacionLlamadasAgo) discrepancias.push('tipifLlAgo');
    if (numeros.tipifLlSep !== ESPERADO.tipificacionLlamadasSep) discrepancias.push('tipifLlSep');
    if (numeros.tipifLlFalla !== ESPERADO.tipificacionLlamadasFalla) discrepancias.push('tipifLlFalla');
    if (numeros.tipifWppTotal !== ESPERADO.tipificacionWppTotal) discrepancias.push('tipifWppTotal');
    if (numeros.agendasAbril2025 !== ESPERADO.agendasAbril2025) discrepancias.push('agendasAbril2025');
    if (numeros.rankingAgo.pct !== ESPERADO.efectAgendamientoAgoPct) discrepancias.push('efectAgendamientoAgoPct');
    if (numeros.rankingSep.pct !== ESPERADO.efectAgendamientoSepPct) discrepancias.push('efectAgendamientoSepPct');
    if (numeros.inasistenciaAgoPct !== ESPERADO.inasistenciaAgoPct) discrepancias.push('inasistenciaAgoPct');
    if (numeros.inasistenciaPeriodoPct !== ESPERADO.inasistenciaPeriodoPct) discrepancias.push('inasistenciaPeriodoPct');
    if (numeros.aliasCount !== ESPERADO.aliasRegistrados) discrepancias.push('aliasCount (esperado ' + ESPERADO.aliasRegistrados + ', real ' + numeros.aliasCount + ')');
    reporte.discrepanciasNumeros = discrepancias;
    log('Discrepancias de números:', discrepancias.length ? JSON.stringify(discrepancias) : '(ninguna)');

    // ══ B. Alias: 0 duplicados normalizados restantes en cada tabla ══════
    reporte.aliasDuplicados = {
      tipificacionLlamadas: duplicadosNormalizados(numeros.agentesLlamadas),
      tipificacionWhatsapp: duplicadosNormalizados(numeros.agentesWhatsapp),
      agendas: duplicadosNormalizados(numeros.agentesAgendas),
      efectividadAgendamientoAgo: duplicadosNormalizados(numeros.asesoresRankingAgo),
      efectividadAgendamientoSep: duplicadosNormalizados(numeros.asesoresRankingSep),
    };
    log('Alias — grupos con variantes normalizadas distintas (deberían ser todos []):', JSON.stringify(reporte.aliasDuplicados));

    // ══ C. Efectividad de Agendamiento >100%: estructura del combo + formato ══
    reporte.efectividadMayor100 = {};
    for (const [periodo, mes] of [['ago', '2026-08'], ['sep', '2026-09']]) {
      await page.evaluate((m) => { if (typeof _gdIrAMes === 'function') _gdIrAMes(m); }, mes);
      await page.waitForTimeout(800);
      await page.locator('#gd-tabs .atab', { hasText: 'Agendamiento' }).first().click().catch(() => {});
      await page.waitForTimeout(1000);
      const subRank = page.locator('.gd-subtab-btn', { hasText: 'Ranking' }).first();
      if (await subRank.count()) { await subRank.click(); await page.waitForTimeout(1200); }
      await shot(page, `efectividad-${periodo}-ranking.png`);
      const filas = periodo === 'ago' ? numeros.rankingAgo.filas : numeros.rankingSep.filas;
      const sobre100 = filas.filter((f) => f.efectividad > 1);
      const chartInfo = await page.evaluate(() => {
        if (typeof _gd === 'undefined' || !_gd.charts) return null;
        const entries = Object.entries(_gd.charts).filter(([id]) => /efectividad|ranking/i.test(id));
        return entries.map(([id, ch]) => {
          const scales = ch.options && ch.options.scales ? Object.keys(ch.options.scales).map((k) => ({ eje: k, max: ch.scales && ch.scales[k] ? ch.scales[k].max : null })) : [];
          return { id, scales, nDatasets: (ch.data && ch.data.datasets ? ch.data.datasets.length : 0) };
        });
      });
      const textoPanel = await page.evaluate(() => (document.getElementById('gd-panels') || {}).innerText || '');
      const formatosComaPct = (textoPanel.match(/\d{1,3},\d{2}\s?%/g) || []).length;
      reporte.efectividadMayor100[periodo] = {
        asesoresSobre100EnAPI: sobre100.length,
        maxEfectividadPct: Math.round(Math.max(...filas.map((f) => f.efectividad)) * 10000) / 100,
        chartInfo,
        formatosComaPctEncontrados: formatosComaPct,
        canvasVeredicto: await veredictoSubvista(page),
      };
    }
    log('Efectividad >100%:', JSON.stringify(reporte.efectividadMayor100));

    // ══ D. Selector de mes: nombres completos, sin desborde; mes parcial Julio-2026 ══
    reporte.mesSelector = { nombresVistos: new Set() };
    await page.evaluate(() => { if (typeof _gdIrAMes === 'function') _gdIrAMes('2026-09'); });
    for (const vp of [{ w: 1366, h: 768 }, { w: 412, h: 915 }]) {
      await page.setViewportSize({ width: vp.w, height: vp.h });
      await page.waitForTimeout(500);
      const opcionesMes = await page.evaluate(() => Array.from(document.getElementById('gd-mes-sel').options).map((o) => o.textContent));
      const overflow = await hayScrollHorizontal(page);
      reporte.mesSelector[`${vp.w}x${vp.h}`] = { opciones: opcionesMes, scrollHorizontal: overflow };
      opcionesMes.forEach((o) => reporte.mesSelector.nombresVistos.add(o));
    }
    reporte.mesSelector.nombresVistos = Array.from(reporte.mesSelector.nombresVistos);
    await page.setViewportSize({ width: 1440, height: 900 });

    // Julio 2026 (mes parcial, solo 71 filas de Tipificación WhatsApp) — smoke en las 7 pestañas.
    await page.evaluate(() => { if (typeof _gdIrAMes === 'function') _gdIrAMes('2026-07'); });
    await page.waitForTimeout(1000);
    const erroresAntesJulio = erroresConsola.length;
    const julio = await recorrerTabsYSubtabs(page, 'Julio-2026(parcial)', erroresConsola, peticionesFallidas);
    reporte.julio2026Parcial = { ...julio, erroresNuevos: erroresConsola.length - erroresAntesJulio };
    await page.evaluate(() => { if (typeof _gdIrAMes === 'function') _gdIrAMes('2026-09'); });
    await page.waitForTimeout(800);

    // ══ E. Tema oscuro + viewports (1920x1080, móvil 412) — combos nuevos ══
    reporte.combos = {};
    const COMBOS = [
      { nombre: '1920x1080-claro', vp: { width: 1920, height: 1080 }, tema: 'light' },
      { nombre: '412x915-claro', vp: { width: 412, height: 915 }, tema: 'light' },
      { nombre: '1366x768-oscuro', vp: { width: 1366, height: 768 }, tema: 'dark' },
      { nombre: '1920x1080-oscuro', vp: { width: 1920, height: 1080 }, tema: 'dark' },
      { nombre: '412x915-oscuro', vp: { width: 412, height: 915 }, tema: 'dark' },
    ];
    for (const combo of COMBOS) {
      await page.setViewportSize(combo.vp);
      const temaActualPagina = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
      if (temaActualPagina !== combo.tema) await page.evaluate(() => toggleTema());
      await page.waitForTimeout(600);
      erroresConsola.length = 0; peticionesFallidas.length = 0;
      reporte.combos[combo.nombre] = await recorrerTabsYSubtabs(page, combo.nombre, erroresConsola, peticionesFallidas);
      await shot(page, `combo-${combo.nombre}.png`);
    }
    // deja la página en claro/1440x900 para el resto del script
    const temaFinal = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    if (temaFinal !== 'light') await page.evaluate(() => toggleTema());
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(500);

    // ══ F. Exports reales: descargar y abrir (Excel) ═════════════════════
    async function descargarYAbrir(tabText, subText, nombreArchivo) {
      await page.locator('#gd-tabs .atab', { hasText: tabText }).first().click().catch(() => {});
      await page.waitForTimeout(1000);
      if (subText) {
        const sub = page.locator('.gd-subtab-btn', { hasText: subText }).first();
        if (await sub.count()) { await sub.click(); await page.waitForTimeout(900); }
      }
      await page.click('#gd-export-btn');
      await page.waitForTimeout(200);
      const [download] = await Promise.all([
        page.waitForEvent('download', { timeout: 15000 }),
        page.click('#gd-export-menu button:has-text("Excel")'),
      ]);
      const falla = download.failure ? await download.failure() : null;
      if (falla) throw new Error('La descarga falló en el navegador: ' + falla);
      // Playwright a veces no puede copiar con saveAs() si el contexto no
      // fijo downloadsPath explicito -- download.path() da la ruta del
      // artefacto temporal que Playwright YA guardo, sin copia adicional.
      const rutaTemporal = await download.path();
      if (!rutaTemporal) throw new Error('download.path() vino vacío (sin downloadsPath configurado en el contexto).');
      const destino = path.join(DESCARGAS_DIR, nombreArchivo);
      fs.copyFileSync(rutaTemporal, destino);
      await page.keyboard.press('Escape').catch(() => {});
      await page.evaluate(() => { const m = document.getElementById('gd-export-menu'); if (m) m.remove(); });
      return destino;
    }

    function analizarExport(rutaArchivo) {
      const wb = XLSX.readFile(rutaArchivo);
      const hojas = {};
      const PATRON_PII = /correo|email|tel[ée]fono|celular|documento|c[ée]dula|^dni$/i;
      const PATRON_FORMULA_SIN_NEUTRALIZAR = /^[=+\-@]/;
      wb.SheetNames.forEach((nombreHoja) => {
        const ws = wb.Sheets[nombreHoja];
        const filas = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' });
        const encabezados = (filas[0] || []).map(String);
        const columnasPII = encabezados.filter((h) => PATRON_PII.test(h));
        const columnasVacias = encabezados.filter((_, ci) => filas.slice(1).every((f) => f[ci] === '' || f[ci] == null));
        let celdasSospechosas = 0;
        filas.slice(1).forEach((f) => f.forEach((v) => { if (typeof v === 'string' && PATRON_FORMULA_SIN_NEUTRALIZAR.test(v)) celdasSospechosas++; }));
        hojas[nombreHoja] = { filas: Math.max(0, filas.length - 1), encabezados, columnasPII, columnasVacias, celdasFormulaSinNeutralizar: celdasSospechosas };
      });
      return hojas;
    }

    reporte.exports = {};
    const EXPORTS_A_PROBAR = [
      ['Tipificación', null, 'tipificacion.xlsx'],
      ['Agendamiento', 'Ranking', 'efectividad-agendamiento.xlsx'],
      ['Efectividad', null, 'efectividad-citas.xlsx'],
      ['Agendas', null, 'agendas.xlsx'],
    ];
    for (const [tab, sub, archivo] of EXPORTS_A_PROBAR) {
      try {
        const ruta = await descargarYAbrir(tab, sub, archivo);
        reporte.exports[tab + (sub ? '/' + sub : '')] = { ok: true, archivo, analisis: analizarExport(ruta) };
      } catch (e) {
        reporte.exports[tab + (sub ? '/' + sub : '')] = { ok: false, error: e.message };
      }
    }
    log('Exports analizados:', JSON.stringify(Object.keys(reporte.exports).map((k) => [k, reporte.exports[k].ok])));

    reporte.erroresConsolaGlobal = erroresConsola;
    reporte.peticionesFallidasGlobal = peticionesFallidas;

    await page.evaluate(() => apiRequest('POST', '/auth/logout').catch(() => {}));

    console.log('=== REPORTE FASE 124 PARTE 1 ===');
    console.log(JSON.stringify(reporte, null, 2));
    fs.writeFileSync(path.join(OUT_DIR, 'reporte.json'), JSON.stringify(reporte, null, 2));
    ok = discrepancias.length === 0;
  } catch (e) {
    console.error('FALLO:', e.message, e.stack);
    console.log(JSON.stringify(reporte, null, 2));
    ok = false;
  } finally {
    if (browser) await browser.close();
  }
  process.exit(ok ? 0 : 1);
})();
