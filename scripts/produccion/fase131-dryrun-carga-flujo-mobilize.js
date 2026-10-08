// fase131-dryrun-carga-flujo-mobilize.js — Fase 131 (Parte "carga real de
// septiembre de Mobilize"). DRY-RUN SOLAMENTE: no guarda nada en produccion.
//
// Verifica, contra la interfaz real (sesion real del usuario, el usuario
// escribe su propia contrasena -- el script nunca la ve ni la persiste):
//   1. El mapeo skill->campana de "SKILL SAC" y "Skill Key Account"
//      (solo lectura, GET /calidad/trafico/skills).
//   2. Que el archivo real (fuera del repo) se reconoce con los numeros de
//      control exactos (27 filas, SAC 24 + Key Account 3, 104 ingresadas/
//      104 contestadas/0 abandonadas, 0 avisos) -- el parseo del archivo es
//      100% del lado del navegador, sin ninguna llamada de red todavia.
//   3. Que el boton "Guardar carga" con las 2 defensas de
//      lib/dry-run-seguro.js instaladas (confirm() siempre false +
//      bloqueo de red a cualquier escritura real salvo ".../impacto", que
//      el propio servidor documenta como "no escribe nada") NUNCA llega a
//      escribir de verdad -- se confirma leyendo /calidad/nivel-servicio/
//      diario?campana=MOBILIZE ANTES y DESPUES del intento: debe seguir en
//      0 filas en los dos casos.
//
// Playwright DIRECTO desde Node (headless:false) -- NO la extension de
// Claude in Chrome (regla fija, CLAUDE.md). Solo imprime estructura/
// agregados (conteos, totales) -- nunca una fila cruda del archivo.
'use strict';
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'server', 'node_modules', 'playwright'));
const { instalarDryRunSeguro, leerConfirmsCapturados } = require(path.join(__dirname, 'lib', 'dry-run-seguro.js'));

const BASE = 'https://informa.inconexion.com.co';
const ARCHIVO = 'C:/Users/filid/Documents/datos-inconexion/mobilize/PLANTILLA_DE_FLUJO_DE_LLAMADAS_MOBILIZE.xlsx';
const LOGIN_TIMEOUT_MS = 10 * 60 * 1000;

const CONTROL = {
  filas: 27,
  porLinea: { 'SKILL SAC': 24, 'Skill Key Account': 3 },
  ingresadas: 104,
  contestadas: 104,
  abandonadas: 0,
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
  const reporte = { skillsMapeo: null, preview: null, nivelServicioAntes: null, nivelServicioDespues: null, intentoGuardarBloqueado: null, confirmsCapturados: null, peticionesBloqueadas: [], erroresConsola };
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
    if (!logueado) throw new Error('Se agoto el tiempo de espera de login (10 min) sin detectar sesion iniciada.');
    log('Login detectado, continuando automaticamente.');
    await page.waitForTimeout(1000);

    // ══ 1. Mapeo skill -> campana (SOLO LECTURA) ══════════════════════════
    const skills = await page.evaluate(() => apiRequest('GET', '/calidad/trafico/skills'));
    const buscar = (nombre) => {
      const row = (skills || []).find((s) => s.skillName === nombre);
      return row ? { campana: row.campana, sede: row.sede, filasYaGuardadas: row.filas } : { campana: null, sede: null, filasYaGuardadas: 0, noExisteTodavia: true };
    };
    reporte.skillsMapeo = { 'SKILL SAC': buscar('SKILL SAC'), 'Skill Key Account': buscar('Skill Key Account') };
    log('Mapeo skill->campana actual:', JSON.stringify(reporte.skillsMapeo));

    // ══ 2. Nivel de servicio de MOBILIZE ANTES (debe estar en 0) ══════════
    const diarioAntes = await page.evaluate(() => apiRequest('GET', '/calidad/nivel-servicio/diario?campana=MOBILIZE'));
    reporte.nivelServicioAntes = { filas: (diarioAntes || []).length, totalLlamadas: (diarioAntes || []).reduce((a, r) => a + (Number(r.totalLlamadas) || 0), 0) };
    log('Nivel de servicio MOBILIZE antes:', JSON.stringify(reporte.nivelServicioAntes));

    // ══ 3. Abrir modal, seleccionar MOBILIZE, subir el archivo real ═══════
    await page.evaluate(() => openCargas());
    await page.waitForTimeout(800);
    await page.selectOption('#carga-cliente', 'MOBILIZE');
    // onCargaClienteChange() es async (await GET /dashboard/secciones/MOBILIZE) --
    // espera activamente a que _cargasPlan quede listo en vez de un timeout fijo.
    let planLen = 0;
    for (let i = 0; i < 20; i++) {
      planLen = await page.evaluate(() => (typeof _cargasPlan !== 'undefined' ? _cargasPlan.length : -1));
      if (planLen > 0) break;
      await page.waitForTimeout(500);
    }
    const planTipos = await page.evaluate(() => (typeof _cargasPlan !== 'undefined' ? _cargasPlan.map((h) => h.tipo + ':' + h.hoja) : null));
    log('Plan de carga para MOBILIZE tras seleccionar cliente:', planLen, JSON.stringify(planTipos));
    if (planLen <= 0) throw new Error('_cargasPlan quedo vacio para MOBILIZE (GET /dashboard/secciones/MOBILIZE probablemente fallo o no respondio a tiempo) -- ver planTipos arriba.');

    log('Subiendo PLANTILLA_DE_FLUJO_DE_LLAMADAS_MOBILIZE.xlsx (archivo real, solo parseo en el navegador, 0 peticiones de red)...');
    await page.setInputFiles('#carga-file', ARCHIVO);
    await page.waitForTimeout(2000);
    const toastTrasSubir = await page.evaluate(() => (document.getElementById('toast') || {}).innerText || '');
    const previewCardVisible = await page.evaluate(() => { const el = document.getElementById('carga-preview-card'); return el ? el.style.display : null; });
    log('Toast tras subir (si hubo error de lectura del archivo):', JSON.stringify(toastTrasSubir));
    log('carga-preview-card display:', previewCardVisible);
    const resultados = await page.evaluate(() => _cargasResultados);
    log('Resultados tras subir el archivo:', JSON.stringify(resultados.map((r) => ({ tipo: r.tipo, hoja: r.hoja, error: r.error || null, filasLen: r.filas ? r.filas.length : null, vacia: r.vacia || null }))));
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
    reporte.preview = {
      filas: filaTrafico.filas.length,
      avisos: filaTrafico.avisos ? filaTrafico.avisos.length : 0,
      avisosTexto: filaTrafico.avisos || [],
      reconocidaPorEncabezadosComo: filaTrafico.reconocidaPorEncabezadosComo || null,
      porLinea,
      ingresadas: ing, contestadas: cont, abandonadas: aband,
    };
    log('Preview del archivo:', JSON.stringify(reporte.preview));

    const controlOk =
      reporte.preview.filas === CONTROL.filas &&
      reporte.preview.avisos === 0 &&
      porLinea['SKILL SAC'] === CONTROL.porLinea['SKILL SAC'] &&
      porLinea['Skill Key Account'] === CONTROL.porLinea['Skill Key Account'] &&
      ing === CONTROL.ingresadas && cont === CONTROL.contestadas && aband === CONTROL.abandonadas;
    if (!controlOk) throw new Error('El preview NO coincide con el control esperado (ver reporte.preview arriba) -- ABORTA antes de intentar guardar.');
    log('Control exacto confirmado: 27 filas (SAC 24 + Key Account 3), 104/104/0, 0 avisos.');

    // ══ 4. Instalar las 2 defensas de dry-run-seguro.js ANTES de guardar ══
    const peticionesBloqueadas = [];
    await instalarDryRunSeguro(page, peticionesBloqueadas);

    // ══ 5. Click "Guardar carga" -- NO debe escribir nada de verdad ═══════
    await page.click('#cargas-overlay button:has-text("Guardar carga")');
    await page.waitForTimeout(2500);
    const toastTexto = await page.evaluate(() => (document.getElementById('toast') || {}).innerText || '');
    reporte.confirmsCapturados = await leerConfirmsCapturados(page);
    reporte.peticionesBloqueadas = peticionesBloqueadas.map((p) => ({ method: p.method, pathname: new URL(p.url).pathname }));
    reporte.intentoGuardarBloqueado = { toast: toastTexto.slice(0, 300), huboPeticionDeEscrituraBloqueada: peticionesBloqueadas.some((p) => /\/calidad\/trafico\/carga$/.test(new URL(p.url).pathname)) };
    log('Intento de guardado (dry-run):', JSON.stringify(reporte.intentoGuardarBloqueado));
    log('Peticiones de escritura bloqueadas:', JSON.stringify(reporte.peticionesBloqueadas));

    // ══ 6. Nivel de servicio de MOBILIZE DESPUES (debe seguir en 0) ═══════
    await page.evaluate(() => closeCargas()).catch(() => {});
    const diarioDespues = await page.evaluate(() => apiRequest('GET', '/calidad/nivel-servicio/diario?campana=MOBILIZE'));
    reporte.nivelServicioDespues = { filas: (diarioDespues || []).length, totalLlamadas: (diarioDespues || []).reduce((a, r) => a + (Number(r.totalLlamadas) || 0), 0) };
    log('Nivel de servicio MOBILIZE despues del dry-run:', JSON.stringify(reporte.nivelServicioDespues));

    reporte.erroresConsola = erroresConsola;

    ok =
      controlOk &&
      reporte.intentoGuardarBloqueado.huboPeticionDeEscrituraBloqueada &&
      reporte.confirmsCapturados.length === 0 && // esperado: sin datos previos, nunca se llega a mostrar el confirm()
      reporte.nivelServicioAntes.filas === 0 && reporte.nivelServicioDespues.filas === 0 &&
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
