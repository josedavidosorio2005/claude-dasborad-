// fase131-dryrun-carga-cdr-mobilize.js — Fase 131 (Parte 3). DRY-RUN
// SOLAMENTE: no guarda nada en produccion.
//
// Verifica, contra la interfaz real (sesion real del usuario):
//   1. Que el archivo real del CDR de septiembre (fuera del repo) se
//      reconoce con los numeros de control exactos: 171 filas totales
//      (104 inbound/67 outbound_ma), 4 excluidas por "PRUEBA", quedan 167
//      (103 inbound/64 outbound_ma), 20 codificaciones, SKILL SAC/
//      Llamadas de salida/Skill Key Account, outbound 64 (49 conectadas/
//      15 no conectadas tras excluir PRUEBA).
//   2. Que el boton "Guardar carga" con las 2 defensas de
//      lib/dry-run-seguro.js instaladas NUNCA llega a escribir de verdad
//      -- se confirma leyendo /calidad/tipificacion/opciones?campana=
//      MOBILIZE&canal=LLAMADAS ANTES y DESPUES: debe seguir sin datos en
//      los dos casos.
//
// Playwright DIRECTO desde Node (headless:false) -- NO la extension de
// Claude in Chrome (regla fija, CLAUDE.md). Solo imprime estructura/
// agregados -- nunca una fila cruda del archivo (ni agente, ni skill real
// con nombre de cliente, nada de TELEPHONE/CUSTOMER_ID/etc, que ademas
// nunca se leen).
'use strict';
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'server', 'node_modules', 'playwright'));
const { instalarDryRunSeguro, leerConfirmsCapturados } = require(path.join(__dirname, 'lib', 'dry-run-seguro.js'));

const BASE = 'https://informa.inconexion.com.co';
const ARCHIVO = 'C:/Users/filid/Documents/datos-inconexion/mobilize/PLANTILLA_CDR.xlsx';
const LOGIN_TIMEOUT_MS = 10 * 60 * 1000;

const CONTROL = {
  filasTotales: 171,
  excluidas: 4,
  filasFinales: 167,
  porTipo: { inbound: 103, outbound_ma: 64 },
  outbound: { total: 64, conectadas: 49, noConectadas: 15 },
};

function log(...args) { console.log(new Date().toISOString(), ...args); }

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
  const erroresConsola = [];
  const reporte = { preview: null, opcionesAntes: null, opcionesDespues: null, intentoGuardarBloqueado: null, confirmsCapturados: null, peticionesBloqueadas: [], erroresConsola };
  let ok = true;
  let browser;

  try {
    browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    page.on('pageerror', (e) => erroresConsola.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/favicon/i.test(m.text())) erroresConsola.push('console.error: ' + m.text()); });

    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
    const logueado = await esperarLogin(page);
    if (!logueado) throw new Error('Se agoto el tiempo de espera de login (10 min).');
    log('Login detectado, continuando automaticamente.');
    await page.waitForTimeout(1000);

    // ══ 1. Opciones de Tipificacion de MOBILIZE ANTES (debe estar vacio) ══
    const opAntes = await page.evaluate(() => apiRequest('GET', '/calidad/tipificacion/opciones?campana=MOBILIZE&canal=LLAMADAS'));
    reporte.opcionesAntes = opAntes;
    log('Opciones MOBILIZE/LLAMADAS antes:', JSON.stringify(opAntes));

    // ══ 2. Abrir modal, seleccionar MOBILIZE, subir el archivo real ═══════
    await page.evaluate(() => openCargas());
    await page.waitForTimeout(800);
    await page.selectOption('#carga-cliente', 'MOBILIZE');
    let planLen = 0;
    for (let i = 0; i < 20; i++) {
      planLen = await page.evaluate(() => (typeof _cargasPlan !== 'undefined' ? _cargasPlan.length : -1));
      if (planLen > 0) break;
      await page.waitForTimeout(500);
    }
    const planTipos = await page.evaluate(() => (typeof _cargasPlan !== 'undefined' ? _cargasPlan.map((h) => h.tipo + ':' + h.hoja + (h.canalTipificacion ? '(' + h.canalTipificacion + ')' : '')) : null));
    log('Plan de carga para MOBILIZE:', planLen, JSON.stringify(planTipos));
    if (planLen <= 0) throw new Error('_cargasPlan quedo vacio para MOBILIZE.');

    log('Subiendo PLANTILLA_CDR.xlsx (archivo real, solo parseo en el navegador, 0 peticiones de red)...');
    await page.setInputFiles('#carga-file', ARCHIVO);
    await page.waitForTimeout(2500);
    const resultados = await page.evaluate(() => _cargasResultados);
    log('Resultados tras subir:', JSON.stringify(resultados.map((r) => ({ tipo: r.tipo, hoja: r.hoja, canalTipificacion: r.canalTipificacion, error: r.error || null, filasLen: r.filas ? r.filas.length : null, excluidas: r.excluidas || 0, avisos: r.avisos ? r.avisos.length : 0 }))));
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
    reporte.preview = {
      filas: filaTipifLlamadas.filas.length,
      excluidas: filaTipifLlamadas.excluidas || 0,
      avisos: filaTipifLlamadas.avisos ? filaTipifLlamadas.avisos.length : 0,
      avisosTexto: filaTipifLlamadas.avisos || [],
      reconocidaPorEncabezadosComo: filaTipifLlamadas.reconocidaPorEncabezadosComo || null,
      porTipo,
      outbound: { total: outboundTotal, conectadas: outboundConectadas, noConectadas: outboundNoConectadas },
    };
    log('Preview del CDR:', JSON.stringify(reporte.preview));

    const controlOk =
      reporte.preview.filas === CONTROL.filasFinales &&
      reporte.preview.excluidas === CONTROL.excluidas &&
      porTipo.inbound === CONTROL.porTipo.inbound && porTipo.outbound_ma === CONTROL.porTipo.outbound_ma &&
      outboundTotal === CONTROL.outbound.total && outboundConectadas === CONTROL.outbound.conectadas && outboundNoConectadas === CONTROL.outbound.noConectadas;
    if (!controlOk) throw new Error('El preview NO coincide con el control esperado (ver reporte.preview arriba) -- ABORTA antes de intentar guardar.');
    log('Control exacto confirmado: 167 filas (103 inbound/64 outbound_ma), 4 excluidas por PRUEBA, outbound 64 (49 conectadas/15 no conectadas).');

    // ══ 3. Instalar las 2 defensas de dry-run-seguro.js ANTES de guardar ══
    const peticionesBloqueadas = [];
    await instalarDryRunSeguro(page, peticionesBloqueadas);

    // ══ 4. Click "Guardar carga" -- NO debe escribir nada de verdad ═══════
    await page.click('#cargas-overlay button:has-text("Guardar carga")');
    await page.waitForTimeout(2500);
    const toastTexto = await page.evaluate(() => (document.getElementById('toast') || {}).innerText || '');
    reporte.confirmsCapturados = await leerConfirmsCapturados(page);
    reporte.peticionesBloqueadas = peticionesBloqueadas.map((p) => ({ method: p.method, pathname: new URL(p.url).pathname }));
    reporte.intentoGuardarBloqueado = { toast: toastTexto.slice(0, 400), huboPeticionDeEscrituraBloqueada: peticionesBloqueadas.some((p) => /\/calidad\/tipificacion\/carga$/.test(new URL(p.url).pathname)) };
    log('Intento de guardado (dry-run):', JSON.stringify(reporte.intentoGuardarBloqueado));
    log('Peticiones de escritura bloqueadas:', JSON.stringify(reporte.peticionesBloqueadas));

    // ══ 5. Opciones de Tipificacion de MOBILIZE DESPUES (debe seguir vacio) ═
    await page.evaluate(() => closeCargas()).catch(() => {});
    const opDespues = await page.evaluate(() => apiRequest('GET', '/calidad/tipificacion/opciones?campana=MOBILIZE&canal=LLAMADAS'));
    reporte.opcionesDespues = opDespues;
    log('Opciones MOBILIZE/LLAMADAS despues del dry-run:', JSON.stringify(opDespues));

    ok =
      controlOk &&
      reporte.intentoGuardarBloqueado.huboPeticionDeEscrituraBloqueada &&
      (!opAntes.meses || !opAntes.meses.length) && (!opDespues.meses || !opDespues.meses.length) &&
      erroresConsola.length === 0;
    reporte.ok = ok;

    console.log('\n=== REPORTE FINAL (DRY-RUN, nada se guardo en produccion) ===');
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
