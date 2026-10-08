// fase131-carga-real-flujo-mobilize.js — Fase 131 (Mobilize). CARGA REAL,
// autorizada explicitamente por el usuario ("OK cargar", 2026-10-08) tras
// el dry-run limpio (ver fase131-dryrun-carga-flujo-mobilize.js, mismo
// control: 27 filas, SAC 24 + Key Account 3, 104/104/0, 0 avisos) y con
// el respaldo de produccion confirmado <24h (workflow "Salud del
// servidor", corrida del mismo dia).
//
// Hace, en ESTE orden (decision del usuario: mapear las skills ANTES de
// cargar, para que nunca queden ni un instante en SIN_ASIGNAR):
//   1. Mapea "SKILL SAC" y "Skill Key Account" -> campana MOBILIZE
//      (PUT /calidad/trafico/skills/:skillName) -- solo si todavia NO
//      estan mapeadas a MOBILIZE (idempotente: si ya estuvieran mapeadas,
//      no las toca de nuevo).
//   2. Sube el archivo real y confirma el preview exacto (mismo control
//      que el dry-run) ANTES de guardar.
//   3. Guarda de verdad (sin ninguna defensa de dry-run -- esta es la
//      carga real).
//   4. Verifica contra produccion: GET /calidad/nivel-servicio/diario
//      campana=MOBILIZE (filas/totales) + recorrido visual del dashboard
//      (tab "Flujo de Llamadas", subtabs Resumen/SL/Abandono/ASA/AHT en
//      ese orden, sin WhatsApp, 0 errores de consola) + captura de
//      pantalla (fuera del repo).
//
// Playwright DIRECTO desde Node (headless:false) -- NO la extension de
// Claude in Chrome (regla fija, CLAUDE.md). Solo imprime estructura/
// agregados -- nunca una fila cruda del archivo.
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require(path.join(__dirname, '..', '..', 'server', 'node_modules', 'playwright'));

const BASE = 'https://informa.inconexion.com.co';
const ARCHIVO = 'C:/Users/filid/Documents/datos-inconexion/mobilize/PLANTILLA_DE_FLUJO_DE_LLAMADAS_MOBILIZE.xlsx';
const OUT_DIR = 'C:/Users/filid/Documents/datos-inconexion/mobilize/capturas-carga-flujo';
const LOGIN_TIMEOUT_MS = 10 * 60 * 1000;
const SKILLS_A_MAPEAR = ['SKILL SAC', 'Skill Key Account'];

const CONTROL = { filas: 27, porLinea: { 'SKILL SAC': 24, 'Skill Key Account': 3 }, ingresadas: 104, contestadas: 104, abandonadas: 0 };

function log(...args) { console.log(new Date().toISOString(), ...args); }
async function shot(page, name) { try { await page.screenshot({ path: path.join(OUT_DIR, name), fullPage: false }); } catch (e) { log('WARN screenshot fallo:', e.message); } }

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
  const reporte = { mapeo: {}, preview: null, guardado: null, verificacionApi: null, verificacionDashboard: {} };
  let ok = true;
  let browser;
  let ultimoDialogResumen = null;

  try {
    browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    page.on('dialog', (d) => {
      const msg = d.message();
      ultimoDialogResumen = { numeros: (msg.match(/\d+/g) || []).map(Number), mencionaReemplazo: /reemplaz/i.test(msg) };
      d.accept();
    });
    page.on('pageerror', (e) => erroresConsola.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/favicon/i.test(m.text())) erroresConsola.push('console.error: ' + m.text()); });

    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
    const logueado = await esperarLogin(page);
    if (!logueado) throw new Error('Se agoto el tiempo de espera de login (10 min).');
    log('Login detectado, continuando automaticamente.');
    await page.waitForTimeout(1000);

    // ══ 1. Mapear skills -> MOBILIZE (idempotente) ════════════════════════
    for (const skillName of SKILLS_A_MAPEAR) {
      const antes = await page.evaluate((s) => apiRequest('GET', '/calidad/trafico/skills').then((rows) => (rows || []).find((r) => r.skillName === s)), skillName);
      if (antes && antes.campana === 'MOBILIZE') {
        reporte.mapeo[skillName] = { yaEstabaMapeada: true };
        log('Skill ya mapeada a MOBILIZE, no se toca:', skillName);
        continue;
      }
      const resp = await page.evaluate((s) => apiRequest('PUT', '/calidad/trafico/skills/' + encodeURIComponent(s), { campana: 'MOBILIZE', sede: null }), skillName);
      reporte.mapeo[skillName] = { yaEstabaMapeada: false, resultado: resp };
      log('Skill mapeada a MOBILIZE:', skillName, JSON.stringify(resp));
    }

    // ══ 2. Subir el archivo real y confirmar el preview ═══════════════════
    await page.evaluate(() => openCargas());
    await page.waitForTimeout(800);
    await page.selectOption('#carga-cliente', 'MOBILIZE');
    let planLen = 0;
    for (let i = 0; i < 20; i++) {
      planLen = await page.evaluate(() => (typeof _cargasPlan !== 'undefined' ? _cargasPlan.length : -1));
      if (planLen > 0) break;
      await page.waitForTimeout(500);
    }
    if (planLen <= 0) throw new Error('_cargasPlan quedo vacio para MOBILIZE.');

    log('Subiendo PLANTILLA_DE_FLUJO_DE_LLAMADAS_MOBILIZE.xlsx (archivo real)...');
    await page.setInputFiles('#carga-file', ARCHIVO);
    await page.waitForTimeout(2000);
    const resultados = await page.evaluate(() => _cargasResultados);
    const filaTrafico = resultados.find((r) => r.tipo === 'trafico');
    if (!filaTrafico || filaTrafico.error) throw new Error('El archivo no se reconocio: ' + (filaTrafico ? filaTrafico.error : 'sin fila "trafico" en el plan'));

    const porLinea = {};
    let ing = 0, cont = 0, aband = 0;
    filaTrafico.filas.forEach((f) => {
      porLinea[f.skillName] = (porLinea[f.skillName] || 0) + 1;
      ing += Number(f.totalLlamadas) || 0;
      cont += Number(f.contestadas) || 0;
      aband += Number(f.llamadasAbandonadas) || 0;
    });
    reporte.preview = { filas: filaTrafico.filas.length, avisos: filaTrafico.avisos ? filaTrafico.avisos.length : 0, porLinea, ingresadas: ing, contestadas: cont, abandonadas: aband };
    log('Preview:', JSON.stringify(reporte.preview));
    await shot(page, '1-preview-flujo-mobilize.png');

    const controlOk =
      reporte.preview.filas === CONTROL.filas && reporte.preview.avisos === 0 &&
      porLinea['SKILL SAC'] === CONTROL.porLinea['SKILL SAC'] && porLinea['Skill Key Account'] === CONTROL.porLinea['Skill Key Account'] &&
      ing === CONTROL.ingresadas && cont === CONTROL.contestadas && aband === CONTROL.abandonadas;
    if (!controlOk) throw new Error('El preview NO coincide con el control esperado -- ABORTA antes de guardar.');
    log('Control exacto confirmado. Procediendo a GUARDAR DE VERDAD (autorizado explicitamente por el usuario).');

    // ══ 3. GUARDAR DE VERDAD ═══════════════════════════════════════════════
    await page.click('#cargas-overlay button:has-text("Guardar carga")');
    await page.waitForTimeout(3000);
    const toastGuardado = await page.evaluate(() => (document.getElementById('toast') || {}).innerText || '');
    reporte.guardado = { toast: toastGuardado, confirmacionMostrada: ultimoDialogResumen, ok: /✓.*Trafico/i.test(toastGuardado) };
    log('Resultado del guardado real:', JSON.stringify(reporte.guardado));
    await shot(page, '2-toast-guardado-flujo-mobilize.png');
    if (!reporte.guardado.ok) throw new Error('El toast no confirma un guardado OK de Trafico: ' + toastGuardado);

    await page.evaluate(() => closeCargas()).catch(() => {});

    // ══ 4. Verificacion API ════════════════════════════════════════════════
    const diario = await page.evaluate(() => apiRequest('GET', '/calidad/nivel-servicio/diario?campana=MOBILIZE'));
    const porLineaApi = {};
    (diario || []).forEach((r) => { porLineaApi[r.skillName] = (porLineaApi[r.skillName] || 0) + 1; });
    reporte.verificacionApi = {
      filas: (diario || []).length,
      porLinea: porLineaApi,
      totalLlamadas: (diario || []).reduce((a, r) => a + (Number(r.totalLlamadas) || 0), 0),
      contestadas: (diario || []).reduce((a, r) => a + (Number(r.contestadas) || 0), 0),
      abandonadas: (diario || []).reduce((a, r) => a + (Number(r.llamadasAbandonadas) || 0), 0),
    };
    log('Verificacion API (produccion real):', JSON.stringify(reporte.verificacionApi));

    // ══ 5. Verificacion visual del dashboard ═══════════════════════════════
    await page.evaluate(() => openGenericDashboard('MOBILIZE'));
    await page.waitForTimeout(1500);
    const tabsVisibles = await page.evaluate(() => (_gd.config.layout.tabs || []).map((t) => t.key));
    await shot(page, '3-dashboard-mobilize-flujo.png');
    for (const sub of ['resumen', 'sl', 'abandono', 'asa', 'aht']) {
      await page.evaluate((s) => switchGenericSubtab(s), sub).catch(() => {});
      await page.waitForTimeout(900);
      await shot(page, '4-subtab-' + sub + '.png');
    }
    reporte.verificacionDashboard = {
      tabsVisibles,
      tieneWhatsapp: tabsVisibles.some((t) => /whatsapp|wpp/i.test(t)),
    };
    log('Verificacion visual:', JSON.stringify(reporte.verificacionDashboard));

    reporte.erroresConsola = erroresConsola;

    ok =
      reporte.guardado.ok &&
      reporte.verificacionApi.filas === CONTROL.filas &&
      reporte.verificacionApi.totalLlamadas === CONTROL.ingresadas && reporte.verificacionApi.contestadas === CONTROL.contestadas && reporte.verificacionApi.abandonadas === CONTROL.abandonadas &&
      reporte.verificacionApi.porLinea['SKILL SAC'] === CONTROL.porLinea['SKILL SAC'] && reporte.verificacionApi.porLinea['Skill Key Account'] === CONTROL.porLinea['Skill Key Account'] &&
      !reporte.verificacionDashboard.tieneWhatsapp &&
      erroresConsola.length === 0;
    reporte.ok = ok;

    console.log('\n=== REPORTE FINAL (CARGA REAL) ===');
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
