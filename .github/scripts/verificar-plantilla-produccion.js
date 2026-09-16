// verificar-plantilla-produccion.js — QA de un solo uso, invocado por
// .github/workflows/verificacion-plantilla-produccion.yml.
//
// Verifica, contra la PRODUCCION real, la plantilla CONSOLIDADA (PR #32 —
// reemplazo del boton individual de Trafico que este mismo script probaba
// antes del PR #32, ver historial de este archivo): un botón "Descargar
// plantilla" / "Elegir archivo" por campaña, con una hoja por tipo de dato.
//
//   1. ALBERTO LINERO GO (caso minimo, sin Calidad): descarga la plantilla,
//      confirma sus hojas exactas, la llena con datos de prueba y confirma
//      que la carga se guarda sin fricción.
//   2. ORLANT (caso completo, con Calidad): descarga su plantilla, confirma
//      que trae "Monitoreos", y prueba el camino de error real que arregló
//      el PR #31 (formula de Excel sin calcular en una hoja) mezclado con
//      una hoja válida (Trafico) en el MISMO archivo — confirma que se
//      rechaza solo la hoja mala, sin bloquear la buena.
//
// Usa un usuario TEMPORAL (creado y borrado por el workflow, directo en la
// base de datos — nunca via la API — con el permiso minimo `cargarDatos`,
// nunca rol admin). La contrasena llega por la variable de entorno TEMP_PW,
// ya registrada como "masked" por el paso anterior del workflow
// (`::add-mask::`) — este script JAMAS la imprime, ni en exito ni en error.
//
// Los datos que este script sube a produccion (periodo 2027-05, un skill de
// Trafico con nombre PROD_QA_VERIF_ORLANT) los borra el propio workflow en
// el paso siguiente (nunca quedan en la base real) — ver
// verificacion-plantilla-produccion.yml.
'use strict';
const { chromium } = require('playwright');
const XLSX = require('xlsx');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');

const BASE = process.env.PROD_URL || 'https://inconexionpruebasclaude.duckdns.org';
const TEMP_USER = process.env.TEMP_USER;
const TEMP_PW = process.env.TEMP_PW;
const TMP = os.tmpdir();
const ARTIFACTS_DIR = process.env.ARTIFACTS_DIR || TMP;

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

(async () => {
  if (!TEMP_USER || !TEMP_PW) {
    console.error('Faltan TEMP_USER/TEMP_PW en el entorno.');
    process.exit(1);
  }

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  // Nunca dejar un window.confirm() bloqueando la pagina (el flujo de
  // guardado pregunta antes de reemplazar una carga ya existente, o antes
  // de reemplazar trafico ya cargado) — se acepta siempre, como haria un
  // operador real continuando la carga.
  page.on('dialog', (d) => d.accept());

  const resultado = {};
  let ok = true;

  try {
    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
    await page.fill('#username', TEMP_USER);
    await page.fill('#password', TEMP_PW);
    await page.click('button.btn-login');
    await page.waitForTimeout(1500);

    const loginError = await page.locator('#login-error').innerText().catch(() => '');
    if (loginError && loginError.trim()) {
      throw new Error('Login fallo. Mensaje del servidor: ' + loginError.trim());
    }
    const adminPageVisible = await page
      .locator('#admin-page')
      .evaluate((el) => getComputedStyle(el).display !== 'none')
      .catch(() => false);
    if (!adminPageVisible) {
      throw new Error('Login no entro al panel admin (se esperaba rol AUX_ADMIN). URL actual: ' + page.url());
    }
    resultado.loginOk = true;

    await page.evaluate(() => { if (typeof openCargas === 'function') return openCargas(); });
    await page.waitForTimeout(1200);

    // ══ 1. ALBERTO LINERO GO — caso minimo (sin Calidad) ══════════════
    await page.selectOption('#carga-cliente', 'ALBERTO LINERO GO');
    await page.waitForTimeout(800);
    resultado.algPlan = (await page.locator('#carga-plan-desc').innerText()).trim();

    const [dlAlg] = await Promise.all([
      page.waitForEvent('download', { timeout: 15000 }),
      page.click('button[onclick="descargarPlantillaConsolidada()"]'),
    ]);
    const algPath = path.join(TMP, 'plantilla_ALBERTO_LINERO_GO_produccion.xlsx');
    await dlAlg.saveAs(algPath);
    const algBuf = fs.readFileSync(algPath);
    resultado.algArchivo = { bytes: algBuf.length, sha256: sha256(algBuf) };
    fs.copyFileSync(algPath, path.join(ARTIFACTS_DIR, 'plantilla_ALBERTO_LINERO_GO_produccion.xlsx'));

    const wbAlg = XLSX.readFile(algPath);
    resultado.algHojas = wbAlg.SheetNames;
    const hojasEsperadasAlg = ['INSTRUCCIONES', 'resumen', 'diario', 'tipificacion', 'asesores', 'DATA'];
    resultado.algHojasOk = JSON.stringify(wbAlg.SheetNames) === JSON.stringify(hojasEsperadasAlg);
    if (!resultado.algHojasOk) {
      throw new Error('ALBERTO LINERO GO: hojas inesperadas -> ' + wbAlg.SheetNames.join(', '));
    }

    // Llena "resumen" (Metrica/Valor) con numeros de prueba obviamente
    // ficticios, respetando el formato que pide su propia hoja INSTRUCCIONES
    // (numero final, nunca una formula).
    const wsResumenAlg = wbAlg.Sheets['resumen'];
    const rangeResumenAlg = XLSX.utils.decode_range(wsResumenAlg['!ref']);
    for (let r = rangeResumenAlg.s.r + 1; r <= rangeResumenAlg.e.r; r++) {
      wsResumenAlg[XLSX.utils.encode_cell({ r, c: 1 })] = { t: 'n', v: 111 };
    }
    const algFilledPath = path.join(TMP, 'plantilla_ALBERTO_LINERO_GO_llena.xlsx');
    XLSX.writeFile(wbAlg, algFilledPath);

    await page.fill('#carga-periodo', '2027-05');
    await page.setInputFiles('#carga-file', algFilledPath);
    await page.waitForTimeout(800);
    resultado.algPreview = (await page.locator('#carga-preview-table').innerText()).replace(/\n/g, ' | ');
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, '1-alberto-linero-go-preview.png') });

    await page.evaluate(() => guardarCarga());
    await page.waitForTimeout(1500);
    resultado.algToast = (await page.locator('#toast').innerText().catch(() => '')).trim();
    resultado.algCargaOk = /Resumen mensual/.test(resultado.algToast) && !resultado.algToast.includes('✗');
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, '2-alberto-linero-go-guardado.png') });

    // ══ 2. ORLANT — caso completo (con Calidad) + camino de error ═════
    await page.evaluate(() => {
      var card = document.getElementById('carga-preview-card');
      if (card) card.style.display = 'none';
    });
    await page.selectOption('#carga-cliente', 'ORLANT');
    await page.waitForTimeout(800);
    resultado.orlantPlan = (await page.locator('#carga-plan-desc').innerText()).trim();
    resultado.orlantTieneCalidad = resultado.orlantPlan.includes('Monitoreos');
    if (!resultado.orlantTieneCalidad) throw new Error('ORLANT: la plantilla no trajo la hoja Monitoreos (Calidad).');

    const [dlOrlant] = await Promise.all([
      page.waitForEvent('download', { timeout: 15000 }),
      page.click('button[onclick="descargarPlantillaConsolidada()"]'),
    ]);
    const orlantPath = path.join(TMP, 'plantilla_ORLANT_produccion.xlsx');
    await dlOrlant.saveAs(orlantPath);
    const orlantBuf = fs.readFileSync(orlantPath);
    resultado.orlantArchivo = { bytes: orlantBuf.length, sha256: sha256(orlantBuf) };
    fs.copyFileSync(orlantPath, path.join(ARTIFACTS_DIR, 'plantilla_ORLANT_produccion.xlsx'));

    const wbOrlant = XLSX.readFile(orlantPath);
    resultado.orlantHojas = wbOrlant.SheetNames;

    // "resumen": la primera metrica queda como FORMULA SIN VALOR (el bug
    // real que arreglo el PR #31 — un archivo que nunca se abrio en Excel
    // para forzar el recalculo), a proposito, para probar el rechazo. El
    // resto de metricas se llenan con un numero literal para que la hoja
    // NO se lea como "vacia" (cargasHojaVacia mira si HAY algun valor real
    // en la hoja antes de siquiera llegar a chequear la formula — si la
    // unica celda tocada fuera la formula, la hoja se veria vacia y el
    // camino de error nunca se probaria de verdad).
    const wsResumenOrlant = wbOrlant.Sheets['resumen'];
    const rangeResumenOrlant = XLSX.utils.decode_range(wsResumenOrlant['!ref']);
    const filaFormula = rangeResumenOrlant.s.r + 1;
    for (let r = rangeResumenOrlant.s.r + 1; r <= rangeResumenOrlant.e.r; r++) {
      const addr = XLSX.utils.encode_cell({ r, c: 1 });
      wsResumenOrlant[addr] = r === filaFormula ? { f: 'A1+A1' } /* sin "v": sin calcular */ : { t: 'n', v: 222 };
    }

    // "DATA" (Trafico): una fila VALIDA en el MISMO archivo -- debe
    // guardarse igual aunque "resumen" falle.
    const wsData = wbOrlant.Sheets.DATA;
    const headerData = XLSX.utils.sheet_to_json(wsData, { header: 1 })[0];
    headerData.forEach((label, c) => {
      const addr = XLSX.utils.encode_cell({ r: 1, c });
      if (label === 'SKILL_NAME') wsData[addr] = { t: 's', v: 'PROD_QA_VERIF_ORLANT' };
      else if (label === 'DATE') wsData[addr] = { t: 's', v: '2027-05-10' };
      else if (label === 'TOTAL LLAMADAS') wsData[addr] = { t: 'n', v: 20 };
      else if (label === 'LLAMADAS CONTESTADAS') wsData[addr] = { t: 'n', v: 18 };
      else delete wsData[addr];
    });

    const orlantFilledPath = path.join(TMP, 'plantilla_ORLANT_llena.xlsx');
    XLSX.writeFile(wbOrlant, orlantFilledPath);

    await page.setInputFiles('#carga-file', orlantFilledPath);
    await page.waitForTimeout(800);
    resultado.orlantPreview = (await page.locator('#carga-preview-table').innerText()).replace(/\n/g, ' | ');
    resultado.orlantErrorDetectadoEnPreview = /formula de Excel/i.test(resultado.orlantPreview);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, '3-orlant-preview-error.png') });

    await page.evaluate(() => guardarCarga());
    await page.waitForTimeout(1500);
    resultado.orlantToast = (await page.locator('#toast').innerText().catch(() => '')).trim();
    resultado.orlantSoloResumenFallo =
      /✗[^\n]*Resumen mensual/.test(resultado.orlantToast) && /✓[^\n]*Trafico de Llamadas/.test(resultado.orlantToast);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, '4-orlant-guardado-parcial.png') });

    ok =
      resultado.loginOk &&
      resultado.algHojasOk &&
      resultado.algCargaOk &&
      resultado.orlantTieneCalidad &&
      resultado.orlantErrorDetectadoEnPreview &&
      resultado.orlantSoloResumenFallo;

    resultado.ok = ok;
    console.log(JSON.stringify(resultado, null, 2));
  } catch (e) {
    console.error('FALLO la verificacion:', e.message);
    console.log(JSON.stringify(resultado, null, 2));
    ok = false;
  } finally {
    await browser.close();
  }

  process.exit(ok ? 0 : 1);
})();
