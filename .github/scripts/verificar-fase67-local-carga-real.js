// verificar-fase67-local-carga-real.js — QA de un solo uso, Fase 67, LOCAL.
//
// Simula exactamente lo que haria un usuario real: descarga la plantilla de
// ORLANT desde la interfaz (ya con el fix de cache-busting del Paso 2),
// llena SOLO LLAMADAS y WHATSAPP con las 50+5 filas de agosto del fixture
// real, deja TODAS las demas hojas tal cual vienen descargadas (resumen con
// nombres de metrica pero sin valor, Diccionario con sus filas reales,
// salida/tipificacion/sta_categorias con su fila en blanco), y la sube por
// "Cargar Datos de Dashboards".
//
// La edicion de las 2 hojas de Trafico se hace DENTRO del navegador con el
// mismo SheetJS que ya carga la app (xlsx.full.min.js) -- nunca se instala
// el paquete npm `xlsx` (este proyecto lo evita a proposito, ver
// server/tests/helpers/xlsx-lite.js) y nunca se toca ninguna otra hoja del
// archivo descargado.
//
// Confirma ademas que NINGUN otro dato de ORLANT cambia (Gestion de base:
// resumen/salida/tipificacion/sta_categorias, y Monitoreos) comparando la
// base de datos local ANTES y DESPUES byte a byte.
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

const BASE = process.env.APP_URL || 'http://localhost:3000';
const ADMIN_USER = process.env.QA_ADMIN_USER || 'demo_admin';
const ADMIN_PW = process.env.QA_ADMIN_PW;
const OUT_DIR = process.env.OUT_DIR ||
  path.join(__dirname, '..', '..', 'docs', 'capturas-demo', 'fase67-plantilla-produccion-y-prueba-real');
const DB_PATH = path.join(__dirname, '..', '..', 'server', 'data', 'inconexion.db');
const FIXTURES = path.join(__dirname, '..', '..', 'server', 'tests', 'fixtures');
const { leerHojaXlsxComoAoA } = require(path.join(__dirname, '..', '..', 'server', 'tests', 'helpers', 'xlsx-lite.js'));

const DESKTOP = { width: 1440, height: 900 };
const SKILLS_TEST = ['CALL INBOUND ORLANT 3P', 'CALL INBOUND ORLANT GENERAL'];

function db_ro() { return new Database(DB_PATH, { readonly: true }); }

function filasVoz(skills) {
  const db = db_ro();
  const r = db.prepare(
    `SELECT COUNT(*) n FROM calidad_nivel_servicio_diario WHERE campana='ORLANT' AND skillName IN (${skills.map(() => '?').join(',')})`
  ).get(...skills);
  db.close();
  return r.n;
}
function filasWpp() {
  const db = db_ro();
  const r = db.prepare("SELECT COUNT(*) n FROM trafico_whatsapp WHERE campana='ORLANT'").get();
  db.close();
  return r.n;
}
function snapshotOtrosDatos() {
  const db = db_ro();
  const cargas = db.prepare(
    "SELECT seccion, periodo, filas, cargadoPorNombre, cargadoEn FROM dashboard_cargas WHERE cliente='ORLANT' ORDER BY seccion, periodo"
  ).all();
  const monitoreos = db.prepare(
    "SELECT id, asesor, fecha, createdAt, updatedAt FROM monitoreos WHERE campana='ORLANT' ORDER BY id"
  ).all();
  db.close();
  return { cargas, monitoreos };
}
function limpiarSkillsTest() {
  const db = new Database(DB_PATH);
  const info = db.prepare(
    `DELETE FROM calidad_nivel_servicio_diario WHERE campana='ORLANT' AND skillName IN (${SKILLS_TEST.map(() => '?').join(',')})`
  ).run(...SKILLS_TEST);
  const infoMapeo = db.prepare(
    `DELETE FROM trafico_skill_mapeo WHERE skillName IN (${SKILLS_TEST.map(() => '?').join(',')})`
  ).run(...SKILLS_TEST);
  db.close();
  return { filas: info.changes, mapeos: infoMapeo.changes };
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT_DIR, name), fullPage: false });
}

function aoaDesdeFixture(sheetName) {
  return leerHojaXlsxComoAoA(
    path.join(FIXTURES, 'PLANTILLA_TRAFICO_UNIFICADA_ORLANT_PRUEBA_AGOSTO_2026.xlsx'),
    sheetName
  );
}

(async () => {
  if (!ADMIN_PW) { console.error('Falta QA_ADMIN_PW.'); process.exit(1); }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const preExistentes = filasVoz(SKILLS_TEST);
  if (preExistentes > 0) {
    console.error('ABORTA: ya hay ' + preExistentes + ' fila(s) de los skills de prueba en la BD local.');
    process.exit(1);
  }

  const antes = snapshotOtrosDatos();
  const wppAntes = filasWpp();

  const browser = await chromium.launch();
  const resultado = { descarga: {}, subida: {}, otrosDatos: {} };
  let ok = true;
  const erroresConsola = [];

  try {
    // Contexto de navegador NUEVO y sin cache/cookies previos (Playwright
    // no reutiliza perfil entre corridas) -- equivalente a "navegador limpio".
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

    // Onboarding real de los 2 skills de prueba a ORLANT (igual que un admin
    // haria la primera vez que ve un skill nuevo, Fase 32) -- se revierte al final.
    for (const skill of SKILLS_TEST) {
      await page.evaluate((s) => apiRequest('PUT', '/calidad/trafico/skills/' + encodeURIComponent(s), { campana: 'ORLANT' }), skill);
    }

    // ══ 1. DESCARGA ═════════════════════════════════════════════════════
    await page.evaluate(() => openCargas());
    await page.waitForTimeout(800);
    await page.selectOption('#carga-cliente', 'ORLANT');
    await page.waitForTimeout(600);
    await shot(page, '1-cargas-orlant-local.png');

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.click('#cargas-overlay button:has-text("Descargar plantilla (Excel)")'),
    ]);
    const descargaPath = path.join(OUT_DIR, 'descarga-orlant-local.xlsx');
    await download.saveAs(descargaPath);

    let tieneLlamadas = false, tieneWhatsapp = false, tieneData = false;
    try { leerHojaXlsxComoAoA(descargaPath, 'LLAMADAS'); tieneLlamadas = true; } catch (e) {}
    try { leerHojaXlsxComoAoA(descargaPath, 'WHATSAPP'); tieneWhatsapp = true; } catch (e) {}
    try { leerHojaXlsxComoAoA(descargaPath, 'DATA'); tieneData = true; } catch (e) {}
    resultado.descarga = { tieneLlamadas, tieneWhatsapp, tieneData };
    resultado.descarga.ok = tieneLlamadas && tieneWhatsapp && !tieneData;
    if (!resultado.descarga.ok) throw new Error('La descarga no trae el formato unificado esperado: ' + JSON.stringify(resultado.descarga));

    // ══ 2. LLENAR SOLO LLAMADAS/WHATSAPP, DENTRO DEL NAVEGADOR ═════════
    // Se usa el XLSX YA CARGADO por la app (window.XLSX) para no instalar
    // ningun paquete npm de lectura/escritura de xlsx. Las demas hojas
    // (INSTRUCCIONES/resumen/salida/tipificacion/sta_categorias/Monitoreos/
    // Diccionario/Resumen por Asesor) se dejan BYTE A BYTE como vienen.
    const bufDescarga = fs.readFileSync(descargaPath);
    const b64Descarga = bufDescarga.toString('base64');
    const llamadasAoa = aoaDesdeFixture('LLAMADAS');
    const whatsappAoa = aoaDesdeFixture('WHATSAPP');

    const b64Lleno = await page.evaluate(({ b64, llamadasAoa, whatsappAoa }) => {
      var wb = XLSX.read(b64, { type: 'base64' });
      wb.Sheets['LLAMADAS'] = XLSX.utils.aoa_to_sheet(llamadasAoa);
      wb.Sheets['WHATSAPP'] = XLSX.utils.aoa_to_sheet(whatsappAoa);
      var out = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      return out;
    }, { b64: b64Descarga, llamadasAoa, whatsappAoa });

    const llenoPath = path.join(OUT_DIR, 'llenado-solo-trafico-local.xlsx');
    fs.writeFileSync(llenoPath, Buffer.from(b64Lleno, 'base64'));

    // Confirma que el archivo llenado sigue trayendo TODAS las demas hojas
    // (no se perdio nada en el read/write dentro del navegador).
    const hojasEsperadas = ['INSTRUCCIONES', 'resumen', 'salida', 'tipificacion', 'sta_categorias', 'Monitoreos', 'LLAMADAS', 'WHATSAPP', 'Diccionario', 'Resumen por Asesor'];
    const hojasEncontradas = {};
    for (const h of hojasEsperadas) {
      try { leerHojaXlsxComoAoA(llenoPath, h); hojasEncontradas[h] = true; } catch (e) { hojasEncontradas[h] = false; }
    }
    resultado.archivoLlenadoTrasTodasLasHojas = hojasEncontradas;

    // ══ 3. SUBIDA ═══════════════════════════════════════════════════════
    await page.setInputFiles('#carga-file', llenoPath);
    await page.waitForTimeout(1200);
    await shot(page, '2-vista-previa-solo-trafico-local.png');

    const preview = await page.evaluate(() => {
      var filas = Array.from(document.querySelectorAll('#carga-preview-table tr')).slice(1);
      return filas.map(function (tr) {
        var tds = tr.querySelectorAll('td');
        return { hoja: tds[0] ? tds[0].textContent.trim() : '', tipo: tds[1] ? tds[1].textContent.trim() : '', estado: tds[2] ? tds[2].textContent.trim() : '' };
      });
    });
    resultado.subida.preview = preview;
    const filaLlamadas = preview.find((p) => p.tipo === 'Trafico de Llamadas');
    const filaWhatsapp = preview.find((p) => p.tipo === 'Trafico de WhatsApp');
    resultado.subida.previewLlamadasOk = !!filaLlamadas && /OK/i.test(filaLlamadas.estado) && /50/.test(filaLlamadas.estado);
    resultado.subida.previewWhatsappOk = !!filaWhatsapp && /OK/i.test(filaWhatsapp.estado) && /5\b/.test(filaWhatsapp.estado);

    const otrasHojas = preview.filter((p) => p !== filaLlamadas && p !== filaWhatsapp);
    resultado.subida.otrasHojasSinError = otrasHojas.every((p) => !/error/i.test(p.estado) && !/✗/.test(p.estado));
    resultado.subida.otrasHojasEstados = otrasHojas.map((p) => p.hoja + ': ' + p.estado);

    const errorTexto = await page.locator('#carga-errores').innerText().catch(() => '');
    resultado.subida.erroresPreview = errorTexto.trim();

    await page.click('#cargas-overlay button:has-text("Guardar carga")');
    await page.waitForTimeout(1500);
    resultado.subida.toast = (await page.locator('#toast').innerText().catch(() => '')).trim();
    await shot(page, '3-guardado-local.png');

    resultado.subida.filasVozTrasSubir = filasVoz(SKILLS_TEST);
    resultado.subida.filasWppTrasSubir = filasWpp();

    // ══ 4. NINGUN OTRO DATO DE ORLANT CAMBIA ═══════════════════════════
    const despues = snapshotOtrosDatos();
    resultado.otrosDatos.cargasIdenticas = JSON.stringify(antes.cargas) === JSON.stringify(despues.cargas);
    resultado.otrosDatos.monitoreosIdenticos = JSON.stringify(antes.monitoreos) === JSON.stringify(despues.monitoreos);
    if (!resultado.otrosDatos.cargasIdenticas) {
      resultado.otrosDatos.cargasAntes = antes.cargas;
      resultado.otrosDatos.cargasDespues = despues.cargas;
    }

    // ══ 5. KPIs en el dashboard real ════════════════════════════════════
    await page.evaluate(() => closeCargas());
    await page.evaluate(() => openGenericDashboard('ORLANT'));
    await page.waitForTimeout(1200);
    await page.evaluate(() => switchGenericTab('trafico'));
    await page.waitForTimeout(1000);
    await page.click('#tv-f-cmp-wrap-0 summary');
    await page.selectOption('#tv-f-skills-cmp-0', SKILLS_TEST);
    await page.fill('#tv-f-desde-0', '2026-08-01');
    await page.fill('#tv-f-hasta-0', '2026-08-31');
    await page.click('button[onclick^="_traficoAplicarFiltros"]');
    await page.waitForTimeout(1000);
    resultado.subida.kpisLlamadas = await page.$eval('#tv-kpis-0', (el) => el.textContent.replace(/\s+/g, ' ').trim());
    await shot(page, '4-trafico-llamadas-local.png');

    await page.evaluate(() => switchGenericTab('trafico_whatsapp'));
    await page.waitForTimeout(1000);
    resultado.subida.kpisWhatsapp = await page.$eval('#tww-kpis-0', (el) => el.textContent.replace(/\s+/g, ' ').trim());
    await shot(page, '5-trafico-whatsapp-local.png');

    resultado.erroresConsola = erroresConsola;

    ok =
      resultado.loginOk &&
      resultado.descarga.ok &&
      resultado.subida.previewLlamadasOk &&
      resultado.subida.previewWhatsappOk &&
      resultado.subida.otrasHojasSinError &&
      resultado.subida.filasVozTrasSubir === 50 &&
      resultado.subida.filasWppTrasSubir === 5 &&
      resultado.otrosDatos.cargasIdenticas &&
      resultado.otrosDatos.monitoreosIdenticos &&
      /8[.,]061/.test(resultado.subida.kpisLlamadas) &&
      /7[.,]159/.test(resultado.subida.kpisLlamadas) &&
      /902/.test(resultado.subida.kpisLlamadas) &&
      /7[.,]305/.test(resultado.subida.kpisWhatsapp) &&
      /7[.,]109/.test(resultado.subida.kpisWhatsapp) &&
      /196/.test(resultado.subida.kpisWhatsapp) &&
      erroresConsola.length === 0;

    resultado.ok = ok;
    console.log(JSON.stringify(resultado, null, 2));
  } catch (e) {
    console.error('FALLO la verificacion:', e.message);
    console.log(JSON.stringify(resultado, null, 2));
    ok = false;
  } finally {
    await browser.close();
    const limpieza = limpiarSkillsTest();
    console.log('Limpieza: borradas ' + limpieza.filas + ' filas y ' + limpieza.mapeos + ' mapeo(s) de los skills de prueba.');
    const wppDespues = filasWpp();
    console.log('trafico_whatsapp ORLANT antes=' + wppAntes + ' despues-de-limpiar=' + wppDespues + ' (deberian ser iguales, WhatsApp era upsert idempotente).');
  }

  process.exit(ok ? 0 : 1);
})();
