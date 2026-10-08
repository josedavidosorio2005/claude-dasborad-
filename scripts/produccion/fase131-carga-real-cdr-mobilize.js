// fase131-carga-real-cdr-mobilize.js — Fase 131 (Parte 3). CARGA REAL,
// autorizada explicitamente por el usuario ("OK cargar", 2026-10-08) tras
// el dry-run limpio (ver fase131-dryrun-carga-cdr-mobilize.js, mismo
// control: 167 filas tras excluir 4 de PRUEBA, 103 inbound/64 outbound_ma,
// outbound 64/49/15) y con el respaldo de produccion confirmado <24h.
//
// Sube el archivo real, confirma el preview exacto, guarda de verdad (sin
// ninguna defensa de dry-run), y verifica contra produccion: API
// (/calidad/tipificacion/por-tipo, /calidad/tipificacion/resumen-salida)
// + recorrido visual del dashboard (tab "Tipificacion", filtros, sin
// nombres reales en ningun lado de este reporte).
//
// Playwright DIRECTO desde Node (headless:false) -- NO la extension de
// Claude in Chrome. Solo imprime estructura/agregados.
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require(path.join(__dirname, '..', '..', 'server', 'node_modules', 'playwright'));

const BASE = 'https://informa.inconexion.com.co';
const ARCHIVO = 'C:/Users/filid/Documents/datos-inconexion/mobilize/PLANTILLA_CDR.xlsx';
const OUT_DIR = 'C:/Users/filid/Documents/datos-inconexion/mobilize/capturas-carga-cdr';
const LOGIN_TIMEOUT_MS = 10 * 60 * 1000;

const CONTROL = { filasFinales: 167, excluidas: 4, porTipo: { inbound: 103, outbound_ma: 64 }, outbound: { total: 64, conectadas: 49, noConectadas: 15 } };

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
  const reporte = { preview: null, guardado: null, verificacionApi: null, verificacionDashboard: {}, erroresConsola };
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
    await page.waitForTimeout(1500); // margen extra tras el login (dry-run anterior vio 401 transitorios justo despues del login)

    // ══ 1. Subir el archivo real y confirmar el preview ═══════════════════
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

    log('Subiendo PLANTILLA_CDR.xlsx (archivo real)...');
    await page.setInputFiles('#carga-file', ARCHIVO);
    await page.waitForTimeout(2500);
    const resultados = await page.evaluate(() => _cargasResultados);
    const filaTipifLlamadas = resultados.find((r) => r.tipo === 'tipificacion' && r.canalTipificacion === 'LLAMADAS');
    if (!filaTipifLlamadas || filaTipifLlamadas.error) throw new Error('El CDR no se reconocio: ' + (filaTipifLlamadas ? filaTipifLlamadas.error : 'sin fila "tipificacion/LLAMADAS" en el plan'));

    const porTipo = {};
    let outboundTotal = 0, outboundConectadas = 0, outboundNoConectadas = 0;
    const NO_CONECTADA = ['Cliente_no_contesta'];
    filaTipifLlamadas.filas.forEach((f) => {
      porTipo[f.tipoInteraccion] = (porTipo[f.tipoInteraccion] || 0) + 1;
      if (f.tipoInteraccion === 'outbound_ma') {
        outboundTotal++;
        if (NO_CONECTADA.indexOf(f.tipificacion) !== -1) outboundNoConectadas++;
        else outboundConectadas++;
      }
    });
    reporte.preview = { filas: filaTipifLlamadas.filas.length, excluidas: filaTipifLlamadas.excluidas || 0, porTipo, outbound: { total: outboundTotal, conectadas: outboundConectadas, noConectadas: outboundNoConectadas } };
    log('Preview:', JSON.stringify(reporte.preview));
    await shot(page, '1-preview-cdr-mobilize.png');

    const controlOk =
      reporte.preview.filas === CONTROL.filasFinales && reporte.preview.excluidas === CONTROL.excluidas &&
      porTipo.inbound === CONTROL.porTipo.inbound && porTipo.outbound_ma === CONTROL.porTipo.outbound_ma &&
      outboundTotal === CONTROL.outbound.total && outboundConectadas === CONTROL.outbound.conectadas && outboundNoConectadas === CONTROL.outbound.noConectadas;
    if (!controlOk) throw new Error('El preview NO coincide con el control esperado -- ABORTA antes de guardar.');
    log('Control exacto confirmado. Procediendo a GUARDAR DE VERDAD (autorizado explicitamente por el usuario).');

    // ══ 2. GUARDAR DE VERDAD ═══════════════════════════════════════════════
    await page.click('#cargas-overlay button:has-text("Guardar carga")');
    await page.waitForTimeout(3500);
    const toastGuardado = await page.evaluate(() => (document.getElementById('toast') || {}).innerText || '');
    reporte.guardado = { toast: toastGuardado, confirmacionMostrada: ultimoDialogResumen, ok: /✓.*Tipificaci[oó]n de Llamadas/i.test(toastGuardado) };
    log('Resultado del guardado real:', JSON.stringify(reporte.guardado));
    await shot(page, '2-toast-guardado-cdr-mobilize.png');
    if (!reporte.guardado.ok) throw new Error('El toast no confirma un guardado OK de Tipificacion de Llamadas: ' + toastGuardado);

    await page.evaluate(() => closeCargas()).catch(() => {});

    // ══ 3. Verificacion API ════════════════════════════════════════════════
    const porTipoApi = await page.evaluate(() => apiRequest('GET', '/calidad/tipificacion/por-tipo?campana=MOBILIZE&canal=LLAMADAS&mes=2026-09'));
    const resumenSalidaApi = await page.evaluate(() => apiRequest('GET', '/calidad/tipificacion/resumen-salida?campana=MOBILIZE&mes=2026-09'));
    const totalPorTipoApi = (porTipoApi && porTipoApi.total) || 0;
    reporte.verificacionApi = { totalPorTipo: totalPorTipoApi, categoriasDistintas: porTipoApi && porTipoApi.datos ? porTipoApi.datos.length : 0, resumenSalida: resumenSalidaApi };
    log('Verificacion API (produccion real):', JSON.stringify(reporte.verificacionApi));

    // ══ 4. Verificacion visual del dashboard ═══════════════════════════════
    await page.evaluate(() => openGenericDashboard('MOBILIZE'));
    await page.waitForTimeout(1500);
    const tabsVisibles = await page.evaluate(() => (_gd.config.layout.tabs || []).map((t) => t.key));
    await page.evaluate(() => switchGenericTab('tipificacion')).catch(() => {});
    await page.waitForTimeout(1500);
    await shot(page, '3-dashboard-mobilize-tipificacion.png');
    reporte.verificacionDashboard = { tabsVisibles, tieneTabTipificacion: tabsVisibles.indexOf('tipificacion') !== -1 };
    log('Verificacion visual:', JSON.stringify(reporte.verificacionDashboard));

    reporte.erroresConsola = erroresConsola;

    ok =
      reporte.guardado.ok &&
      reporte.verificacionApi.totalPorTipo === CONTROL.filasFinales &&
      reporte.verificacionApi.resumenSalida.total === CONTROL.outbound.total &&
      reporte.verificacionApi.resumenSalida.conectadas === CONTROL.outbound.conectadas &&
      reporte.verificacionApi.resumenSalida.noConectadas === CONTROL.outbound.noConectadas &&
      reporte.verificacionDashboard.tieneTabTipificacion &&
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
