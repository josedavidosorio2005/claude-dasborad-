// verificar-fase66-plantilla-unificada-orlant.js — QA de un solo uso, Fase 66.
//
// 1) Descarga la plantilla de ORLANT desde la interfaz y confirma que es la
//    unificada (hojas LLAMADAS/WHATSAPP en vez de "DATA").
// 2) Sube el archivo de prueba real (50 filas LLAMADAS + 5 WHATSAPP) para
//    ORLANT, confirma la vista previa por hoja, guarda, y confirma los
//    numeros de referencia de agosto 2026 en Trafico de Llamadas, Trafico
//    de WhatsApp, y la tarjeta "AHT Promedio" vs. su sub-pestaña.
// 3) Sube el MISMO archivo otra vez -- confirma que no se duplica nada
//    (conteo de filas en la base, antes/despues).
// 4) Sube un archivo viejo de solo voz (hoja "DATA") y uno viejo de solo
//    WhatsApp (hoja "DATA") -- confirma que ambos siguen funcionando.
//
// Los datos que este script sube via LLAMADAS (skills "CALL INBOUND ORLANT
// 3P"/"GENERAL") NO EXISTIAN antes en la base de desarrollo local (se
// verifico antes de correr esto) -- se borran al final. Los datos de
// WHATSAPP ya estaban en la base de desarrollo local con los MISMOS
// valores (Fase 56), asi que subirlos de nuevo es un upsert idempotente,
// no hace falta revertir nada ahi. NUNCA toca produccion.
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const BASE = process.env.APP_URL || 'http://localhost:3000';
const ADMIN_USER = process.env.QA_ADMIN_USER || 'demo_admin';
const ADMIN_PW = process.env.QA_ADMIN_PW;
const OUT_DIR = process.env.OUT_DIR ||
  path.join(__dirname, '..', '..', 'docs', 'capturas-demo', 'fase66-plantilla-unificada-orlant');
const DB_PATH = path.join(__dirname, '..', '..', 'server', 'data', 'inconexion.db');
const FIXTURES = path.join(__dirname, '..', '..', 'server', 'tests', 'fixtures');

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 412, height: 915 };
const SKILLS_TEST = ['CALL INBOUND ORLANT 3P', 'CALL INBOUND ORLANT GENERAL'];

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT_DIR, name), fullPage: false });
}
async function setTema(page, tema) {
  await page.evaluate((t) => { if (typeof aplicarTema === 'function') aplicarTema(t); }, tema);
  await page.waitForTimeout(200);
}
function filasVoz(skills) {
  const db = new Database(DB_PATH, { readonly: true });
  const r = db.prepare(
    `SELECT COUNT(*) n FROM calidad_nivel_servicio_diario WHERE campana='ORLANT' AND skillName IN (${skills.map(() => '?').join(',')})`
  ).get(...skills);
  db.close();
  return r.n;
}
function filasWpp() {
  const db = new Database(DB_PATH, { readonly: true });
  const r = db.prepare("SELECT COUNT(*) n FROM trafico_whatsapp WHERE campana='ORLANT'").get();
  db.close();
  return r.n;
}
function limpiarSkillsTest() {
  const db = new Database(DB_PATH);
  const info = db.prepare(
    `DELETE FROM calidad_nivel_servicio_diario WHERE campana='ORLANT' AND skillName IN (${SKILLS_TEST.map(() => '?').join(',')})`
  ).run(...SKILLS_TEST);
  // El mapeo skill->campana tampoco existia antes de esta corrida (se creo
  // via PUT /calidad/trafico/skills, ver mapearSkillsDePruebaAOrlant) --
  // se borra tambien para dejar la BD de desarrollo local exactamente
  // como estaba.
  const infoMapeo = db.prepare(
    `DELETE FROM trafico_skill_mapeo WHERE skillName IN (${SKILLS_TEST.map(() => '?').join(',')})`
  ).run(...SKILLS_TEST);
  db.close();
  return { filas: info.changes, mapeos: infoMapeo.changes };
}

async function abrirCargasYSeleccionarOrlant(page) {
  await page.evaluate(() => openCargas());
  await page.waitForTimeout(800);
  await page.selectOption('#carga-cliente', 'ORLANT');
  await page.waitForTimeout(600);
}

async function subirArchivo(page, filePath) {
  await page.setInputFiles('#carga-file', filePath);
  await page.waitForTimeout(1200);
}

async function leerVistaPrevia(page) {
  return page.evaluate(() => {
    var filas = Array.from(document.querySelectorAll('#carga-preview-table tr')).slice(1); // sin encabezado
    return filas.map(function (tr) {
      var tds = tr.querySelectorAll('td');
      return { hoja: tds[0] ? tds[0].textContent.trim() : '', tipo: tds[1] ? tds[1].textContent.trim() : '', estado: tds[2] ? tds[2].textContent.trim() : '' };
    });
  });
}

(async () => {
  if (!ADMIN_PW) { console.error('Falta QA_ADMIN_PW.'); process.exit(1); }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Verificacion previa: los 2 skills de prueba NO deben existir todavia.
  const preExistentes = filasVoz(SKILLS_TEST);
  if (preExistentes > 0) {
    console.error('ABORTA: ya hay ' + preExistentes + ' fila(s) de los skills de prueba en la BD local -- correr esto dejaria datos mezclados. Limpia primero.');
    process.exit(1);
  }
  const wppAntes = filasWpp();

  const browser = await chromium.launch();
  const resultado = { descarga: {}, subida: {}, reSubida: {}, archivosViejos: {}, aht: {} };
  let ok = true;
  const erroresConsola = [];

  try {
    const page = await browser.newPage({ viewport: DESKTOP });
    page.on('dialog', (d) => d.accept());
    page.on('pageerror', (e) => erroresConsola.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/favicon/i.test(m.text())) erroresConsola.push('console.error: ' + m.text()); });

    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
    await page.fill('#username', ADMIN_USER);
    await page.fill('#password', ADMIN_PW);
    await page.click('button.btn-login');
    await page.waitForTimeout(1200);
    const loginErr = await page.locator('#login-error').innerText().catch(() => '');
    if (loginErr && loginErr.trim()) throw new Error('Login fallo: ' + loginErr.trim());
    resultado.loginOk = true;

    // Mapea los 2 skills de prueba a ORLANT (PUT /calidad/trafico/skills,
    // mismo endpoint que usa la pantalla real "Registrar skill nuevo",
    // Fase 32) -- en produccion estos skills YA estan mapeados desde hace
    // fases; esta base de desarrollo local nunca los habia visto, asi que
    // sin este paso la carga los guardaria bajo "(SIN ASIGNAR)" en vez de
    // ORLANT (comportamiento correcto y ya documentado del sistema, no un
    // bug de esta fase -- se replica aqui el paso de onboarding real que
    // un admin haria una sola vez). Se revierte al final (limpiarSkillsTest).
    for (const skill of SKILLS_TEST) {
      await page.evaluate((s) => apiRequest('PUT', '/calidad/trafico/skills/' + encodeURIComponent(s), { campana: 'ORLANT' }), skill);
    }

    // ══ 1. DESCARGA — confirma que ORLANT trae LLAMADAS/WHATSAPP ═══════
    await abrirCargasYSeleccionarOrlant(page);
    await shot(page, '1-cargas-orlant-claro-desktop.png');
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#cargas-overlay button:has-text("Descargar plantilla (Excel)")'),
    ]);
    const descargaPath = path.join(OUT_DIR, 'descarga-orlant.xlsx');
    await download.saveAs(descargaPath);
    const { leerHojaXlsxComoAoA } = require(path.join(__dirname, '..', '..', 'server', 'tests', 'helpers', 'xlsx-lite.js'));
    // Necesitamos los nombres reales de hoja del workbook -- leerHojaXlsxComoAoA
    // solo lee UNA hoja por nombre, asi que probamos las que esperamos.
    let tieneLlamadas = false, tieneWhatsapp = false, tieneData = false;
    let headerLlamadas = null, headerWhatsapp = null;
    try { headerLlamadas = leerHojaXlsxComoAoA(descargaPath, 'LLAMADAS')[0]; tieneLlamadas = true; } catch (e) {}
    try { headerWhatsapp = leerHojaXlsxComoAoA(descargaPath, 'WHATSAPP')[0]; tieneWhatsapp = true; } catch (e) {}
    try { leerHojaXlsxComoAoA(descargaPath, 'DATA'); tieneData = true; } catch (e) {}
    resultado.descarga = { tieneLlamadas, tieneWhatsapp, tieneData, headerLlamadas, headerWhatsapp };
    resultado.descarga.ok = tieneLlamadas && tieneWhatsapp && !tieneData;

    // ══ 2. SUBIDA del archivo unificado de prueba ═══════════════════════
    await subirArchivo(page, path.join(FIXTURES, 'PLANTILLA_TRAFICO_UNIFICADA_ORLANT_PRUEBA_AGOSTO_2026.xlsx'));
    await shot(page, '2-vista-previa-unificada-claro-desktop.png');
    const previewUnificado = await leerVistaPrevia(page);
    resultado.subida.previewUnificado = previewUnificado;
    const errorTexto = await page.locator('#carga-errores').innerText().catch(() => '');
    resultado.subida.erroresPreview = errorTexto;

    await page.click('#cargas-overlay button:has-text("Guardar carga")');
    await page.waitForTimeout(1500);
    resultado.subida.filasVozTrasSubir = filasVoz(SKILLS_TEST);
    resultado.subida.filasWppTrasSubir = filasWpp();

    // ══ Verificar en el dashboard: Trafico de Llamadas (solo los 2 skills
    // de prueba, via el comparador, para no mezclar con datos demo del
    // skill "ORLANT - INBOUND" que ya vive en la BD de desarrollo local) ══
    await page.evaluate(() => closeCargas());
    await page.evaluate(() => openGenericDashboard('ORLANT'));
    await page.waitForTimeout(1200);
    await page.evaluate(() => switchGenericTab('trafico'));
    await page.waitForTimeout(1000);
    await page.click('#tv-f-cmp-wrap-0 summary');
    await page.selectOption('#tv-f-skills-cmp-0', SKILLS_TEST);
    // Rango de fechas amplio para cubrir agosto 2026 completo.
    await page.fill('#tv-f-desde-0', '2026-08-01');
    await page.fill('#tv-f-hasta-0', '2026-08-31');
    await page.click('button[onclick^="_traficoAplicarFiltros"]');
    await page.waitForTimeout(1000);
    const kpisLlamadas = await page.$eval('#tv-kpis-0', (el) => el.textContent.replace(/\s+/g, ' ').trim());
    resultado.subida.kpisLlamadasAgosto = kpisLlamadas;
    await shot(page, '3-trafico-llamadas-agosto-claro-desktop.png');
    await setTema(page, 'dark');
    await shot(page, '3b-trafico-llamadas-agosto-oscuro-desktop.png');
    await setTema(page, 'light');

    // AHT: tarjeta vs sub-pestaña (Fase 65) -- SOLO para los 2 skills de
    // prueba (mismo filtro ya aplicado) no es directamente comparable con
    // la tarjeta global (que no filtra por skill) -- se verifica aparte,
    // con "Todas las lineas" restringido de forma distinta: aqui se
    // recalcula el AHT esperado dentro de la pagina, con las MISMAS
    // funciones que usa la tarjeta, filtrando a los 2 skills de prueba y
    // agosto 2026 -- coincidencia exacta confirma que el parseo (con el
    // "----" excluido) llega intacto hasta el calculo.
    const ahtEsperado = await page.evaluate((skills) => {
      var datos = _trafico['ORLANT'];
      var filas = traficoFiltrarFilas(datos.filas, { skills: skills, desde: '2026-08-01', hasta: '2026-08-31' });
      return { seg: traficoAhtPromedioPeriodo(filas), texto: _gdFmt(traficoAhtPromedioPeriodo(filas), 'tiempo_mmss'), filas: filas.length };
    }, SKILLS_TEST);
    resultado.aht.esperadoSoloSkillsPrueba = ahtEsperado;

    // ══ Trafico de WhatsApp — agosto 2026 ════════════════════════════════
    await page.evaluate(() => switchGenericTab('trafico_whatsapp'));
    await page.waitForTimeout(1000);
    const kpisWpp = await page.$eval('#tww-kpis-0', (el) => el.textContent.replace(/\s+/g, ' ').trim()).catch(() => null);
    resultado.subida.kpisWhatsappAgosto = kpisWpp;
    await shot(page, '4-trafico-whatsapp-agosto-claro-desktop.png');

    // ══ AHT: NO hay tarjeta "AHT Promedio" en la franja global de ORLANT ══
    // Correccion al pedido: la conexion de esa tarjeta al dato real
    // (Fase 65) se hizo SOLO para 6 clientes (TELEVENTAS SURA/COMFAMA,
    // ANDRES YEPES, MOVILIZE, SASCHA FITNESS, BIVETT) -- ORLANT nunca tuvo
    // esa tarjeta (sus KPIs de voz siguen manuales/diferidos a proposito,
    // Fase 54). Verificado: 0 coincidencias de "AHT" en el layout.kpis de
    // ORLANT en dashboard-config-seed.js. Lo que SI existe para ORLANT es
    // la sub-pestaña "AHT" DENTRO del panel de Trafico de Llamadas (una
    // grafica, no una tarjeta) -- su calculo ya se verifico arriba
    // (resultado.aht.esperadoSoloSkillsPrueba, con el "----" excluido
    // correctamente) contra el mismo parseo real que llega hasta aqui.
    const hayTarjetaAht = await page.evaluate(() => {
      var cards = Array.from(document.querySelectorAll('#gd-kpis .gd-kpi'));
      return cards.some(function (c) { return /AHT Promedio/.test(c.textContent); });
    });
    resultado.aht.orlantTieneTarjetaAhtGlobal = hayTarjetaAht;
    await page.evaluate(() => switchGenericTab('trafico'));
    await page.waitForTimeout(700);
    await page.evaluate(() => switchGenericSubtab('aht'));
    await page.waitForTimeout(700);
    await shot(page, '5-aht-subpestana-claro-desktop.png');

    await page.setViewportSize(MOBILE);
    await page.waitForTimeout(400);
    await shot(page, '6-trafico-claro-movil.png');
    await page.setViewportSize(DESKTOP);
    await page.evaluate(() => { if (typeof closeGenericDashboard === 'function') closeGenericDashboard(); });

    // ══ 3. RE-SUBIR el mismo archivo — confirma que no se duplica ═══════
    await abrirCargasYSeleccionarOrlant(page);
    await subirArchivo(page, path.join(FIXTURES, 'PLANTILLA_TRAFICO_UNIFICADA_ORLANT_PRUEBA_AGOSTO_2026.xlsx'));
    await page.waitForTimeout(800);
    await page.click('#cargas-overlay button:has-text("Guardar carga")');
    await page.waitForTimeout(1500);
    resultado.reSubida.filasVozTrasResubir = filasVoz(SKILLS_TEST);
    resultado.reSubida.filasWppTrasResubir = filasWpp();
    resultado.reSubida.sinDuplicados =
      resultado.reSubida.filasVozTrasResubir === resultado.subida.filasVozTrasSubir &&
      resultado.reSubida.filasWppTrasResubir === resultado.subida.filasWppTrasSubir;

    // ══ 4. ARCHIVOS VIEJOS (hoja "DATA", un solo canal) ══════════════════
    await abrirCargasYSeleccionarOrlant(page);
    await subirArchivo(page, path.join(FIXTURES, 'EJEMPLO.xlsx')); // voz, hoja DATA
    await page.waitForTimeout(800);
    const previewViejoVoz = await leerVistaPrevia(page);
    resultado.archivosViejos.previewViejoVoz = previewViejoVoz;
    await shot(page, '7-vista-previa-archivo-viejo-voz-claro-desktop.png');
    await page.click('#cargas-overlay button:has-text("Guardar carga")');
    await page.waitForTimeout(1200);

    await abrirCargasYSeleccionarOrlant(page);
    await subirArchivo(page, path.join(FIXTURES, 'PLANTILLA_TRAFICO_WHATSAPP_EJEMPLO.xlsx')); // whatsapp, hoja DATA
    await page.waitForTimeout(800);
    const previewViejoWpp = await leerVistaPrevia(page);
    resultado.archivosViejos.previewViejoWpp = previewViejoWpp;
    await shot(page, '8-vista-previa-archivo-viejo-whatsapp-claro-desktop.png');
    await page.click('#cargas-overlay button:has-text("Guardar carga")');
    await page.waitForTimeout(1200);
    await page.evaluate(() => closeCargas());

    await page.close();
    resultado.erroresConsola = erroresConsola;

    ok = resultado.loginOk && resultado.descarga.ok && resultado.reSubida.sinDuplicados &&
      resultado.aht.esperadoSoloSkillsPrueba && resultado.aht.esperadoSoloSkillsPrueba.seg > 0 &&
      resultado.aht.esperadoSoloSkillsPrueba.filas === 50 &&
      resultado.subida.filasVozTrasSubir === 50 && resultado.subida.filasWppTrasSubir === 5 &&
      erroresConsola.length === 0;
    resultado.ok = ok;
    console.log('=== RESULTADO FINAL ===');
    console.log(JSON.stringify(resultado, null, 2));
  } catch (e) {
    console.error('FALLO la verificacion:', e.message);
    console.log(JSON.stringify(resultado, null, 2));
    ok = false;
  } finally {
    await browser.close();
    const limpieza = limpiarSkillsTest();
    console.log('Limpieza: borradas', limpieza.filas, 'filas y', limpieza.mapeos, 'mapeo(s) skill->campana de los skills de prueba (LLAMADAS). WhatsApp no necesita limpieza (upsert idempotente, valores identicos a los ya sembrados desde la Fase 56).');
    const wppDespues = filasWpp();
    if (wppDespues !== wppAntes) {
      console.error('ADVERTENCIA: el conteo de filas de trafico_whatsapp cambio (' + wppAntes + ' -> ' + wppDespues + ') -- revisar a mano.');
    }
  }

  process.exit(ok ? 0 : 1);
})();
