// qa-datos-prueba-trafico-salida-orlant.js — QA de un solo uso, invocado por
// .github/workflows/qa-datos-prueba-trafico-salida-orlant.yml.
//
// Pedido de InCo (2026-09-18, tras PR #64-66): quiere VER las graficas de
// Trafico y Salida de ORLANT funcionando con datos, antes de decidir si
// registra ya el skill real de Wolkvox. Este script sube datos DE PRUEBA
// obviamente falsos (SKILL_NAME y periodo que no pueden confundirse con
// datos reales), toma capturas, y los borra todos al final.
//
// SKILL_NAME de prueba: PRUEBA_QA_GRAFICAS_ORLANT (nunca algo parecido a un
// skill real). Periodo de prueba: año 2020 -- deliberadamente ANTES de
// cualquier dato real de ORLANT (oct/nov-2026), no un año futuro como 2027:
// un periodo futuro se volveria el "mas reciente" y secuestraria el
// selector de MES del dashboard (mostraria "Ene-2027" en el encabezado
// mientras los demas paneles siguen mostrando datos reales de nov-2026) --
// un año claramente pasado evita esa confusion sin dejar de ser
// inconfundiblemente de prueba.
//
// Sube DOS cosas, ambas por el mecanismo real (no por API cruda):
//   1. Trafico/Volvox: archivo .xlsx real con la hoja "DATA" (mismas
//      columnas que exporta Volvox), subido por la pantalla "Metas
//      Calidad -> Trafico de Llamadas". 8 meses (ene-ago 2020), un dia
//      representativo por mes -- las cifras de ingresadas/contestadas/
//      abandonadas se basan en el patron del PDF de InCo (no una copia
//      exacta, el PDF tiene lecturas ambiguas en varias barras).
//   2. Salida: la hoja "salida" de la plantilla consolidada de ORLANT
//      (unica hoja llenada -- el resto del archivo queda en blanco, asi
//      que solo se sube esa seccion; no se toca resumen/tipificacion/sta
//      reales), 31 dias de julio-2020, lineas General y 3P.
//
// Usuario temporal (rol ADMIN, creado/borrado directo en la base de datos,
// nunca via la API) -- mismo patron que las verificaciones anteriores.
'use strict';
const { chromium } = require('playwright');
const XLSX = require('xlsx');
const path = require('path');
const os = require('os');

const BASE = process.env.PROD_URL || 'https://inconexionpruebasclaude.duckdns.org';
const ADMIN_USER = process.env.TEMP_ADMIN_USER;
const ADMIN_PW = process.env.TEMP_ADMIN_PW;
const ARTIFACTS_DIR = process.env.ARTIFACTS_DIR || os.tmpdir();

const SKILL = 'PRUEBA_QA_GRAFICAS_ORLANT';
const TRAFICO_PERIODO = '2020'; // ene-ago 2020
const SALIDA_PERIODO = '2020-07'; // julio 2020, 31 dias

// Excel serial (dias desde 1899-12-30, 25569 = 1970-01-01 UTC) -- misma
// formula (inversa) que traficoFechaDesdeSerial en trafico-logic.js.
function serialDe(y, m, d) {
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000) + 25569;
}

// ── 1) Workbook de Trafico/Volvox: hoja "DATA", 1 fila representativa por
// mes (ene-ago 2020). Ingresadas/contestadas/abandonadas en el mismo rango
// que muestra el PDF de InCo (no una transcripcion exacta -- varias barras
// del PDF son ilegibles a ese tamaño); AHT tomado de los valores de AHT que
// si son legibles en el PDF (formato mm.ss -> segundos).
function construirWorkbookTrafico() {
  const MESES = [
    { mes: 1, ingresadas: 1071, contestadas: 1035, aht_mmss: 3.59 },
    { mes: 2, ingresadas: 1043, contestadas: 1003, aht_mmss: 3.58 },
    { mes: 3, ingresadas: 923, contestadas: 887, aht_mmss: 3.40 },
    { mes: 4, ingresadas: 1001, contestadas: 961, aht_mmss: 3.33 },
    { mes: 5, ingresadas: 860, contestadas: 835, aht_mmss: 3.49 },
    { mes: 6, ingresadas: 909, contestadas: 870, aht_mmss: 3.12 },
    { mes: 7, ingresadas: 1045, contestadas: 996, aht_mmss: 3.42 },
    { mes: 8, ingresadas: 886, contestadas: 843, aht_mmss: 3.56 },
  ];
  const header = ['SKILL_NAME', 'DATE', 'TOTAL LLAMADAS', 'LLAMADAS CONTESTADAS', 'LLAMADAS ABANDONADAS', 'AHT', 'NIVEL DE ATENCION', 'TASA DE ABNDONO'];
  const rows = MESES.map((m) => {
    const abandonadas = m.ingresadas - m.contestadas;
    const mmss = String(m.aht_mmss.toFixed(2)).split('.');
    const ahtSegundos = Number(mmss[0]) * 60 + Number(mmss[1]);
    const ahtFraccionDia = ahtSegundos / 86400;
    return [
      SKILL,
      serialDe(2020, m.mes, 15),
      m.ingresadas,
      m.contestadas,
      abandonadas,
      ahtFraccionDia,
      Math.round((m.contestadas / m.ingresadas) * 10000) / 10000,
      Math.round((abandonadas / m.ingresadas) * 10000) / 10000,
    ];
  });
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'DATA');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

// ── 2) Hoja "salida" de la plantilla consolidada de ORLANT: 31 dias de
// julio-2020, patron dia-de-semana alto / fin-de-semana bajo (mismo patron
// visual que el PDF de InCo, sin copiar sus cifras exactas). Generador
// determinista (sin dependencias de azar externas) para que el archivo sea
// reproducible.
function construirFilasSalida() {
  let seed = 20200701;
  function rand() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
  const filas = [];
  for (let d = 1; d <= 31; d++) {
    const fecha = new Date(Date.UTC(2020, 6, d));
    const finde = fecha.getUTCDay() === 0 || fecha.getUTCDay() === 6;
    const base = finde ? 0.08 : 1;
    filas.push({
      fecha: '2020-07-' + String(d).padStart(2, '0'),
      salida_general: Math.round((300 + rand() * 200) * base),
      salida_3p: Math.round((60 + rand() * 80) * base),
      wpp_salida_general: Math.round((180 + rand() * 140) * base),
      wpp_salida_3p: Math.round((280 + rand() * 220) * base),
    });
  }
  return filas;
}

async function login(page, user, pw) {
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.fill('#username', user);
  await page.fill('#password', pw);
  await page.click('button.btn-login');
  await page.waitForTimeout(1200);
  const err = await page.locator('#login-error').innerText().catch(() => '');
  if (err && err.trim()) throw new Error('Login de "' + user + '" fallo: ' + err.trim());
}

async function shot(page, nombre) {
  await page.screenshot({ path: path.join(ARTIFACTS_DIR, nombre), fullPage: true });
}

(async () => {
  if (!ADMIN_USER || !ADMIN_PW) {
    console.error('Faltan TEMP_ADMIN_USER/TEMP_ADMIN_PW en el entorno.');
    process.exit(1);
  }

  const browser = await chromium.launch();
  const resultado = {};
  let ok = true;

  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on('dialog', (d) => d.accept());
    await login(page, ADMIN_USER, ADMIN_PW);
    resultado.loginOk = true;

    // ══ 1. Registrar el skill de prueba (pantalla "Registrar skill nuevo") ══
    await page.evaluate(() => showSection('metas'));
    await page.waitForTimeout(1000);
    await page.fill('#tv-skill-nuevo-nombre', SKILL);
    await page.selectOption('#tv-skill-nuevo-campana', 'ORLANT');
    await page.click('#tv-skill-nuevo-btn');
    await page.waitForTimeout(800);
    resultado.skillRegistradoToast = (await page.locator('#toast').innerText().catch(() => '')).trim();
    resultado.skillRegistradoOk = /registrado y asignado/i.test(resultado.skillRegistradoToast);

    // ══ 2. Subir el archivo de Trafico/Volvox de prueba ══
    const bufTrafico = construirWorkbookTrafico();
    await page.setInputFiles('#tv-file', { name: 'PRUEBA_volvox_qa_graficas_orlant.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: bufTrafico });
    await page.waitForTimeout(800);
    resultado.traficoPreviewVisible = await page.locator('#tv-preview-card').isVisible().catch(() => false);
    await page.click('#tv-save-btn');
    await page.waitForTimeout(1200);
    resultado.traficoGuardadoToast = (await page.locator('#toast').innerText().catch(() => '')).trim();
    resultado.traficoGuardadoOk = /fila\(s\) guardadas/i.test(resultado.traficoGuardadoToast);

    // ══ 3. Subir la hoja "salida" de la plantilla consolidada de ORLANT ══
    // (unica hoja llenada -- el resto del archivo queda en blanco, asi que
    // guardarCarga() solo sube "salida"; resumen/tipificacion/sta reales de
    // ORLANT quedan intactos.)
    await page.evaluate(() => { if (typeof openCargas === 'function') return openCargas(); });
    await page.waitForTimeout(800);
    await page.selectOption('#carga-cliente', 'ORLANT');
    await page.waitForTimeout(500);
    const [dl] = await Promise.all([
      page.waitForEvent('download', { timeout: 15000 }),
      page.click('button[onclick="descargarPlantillaConsolidada()"]'),
    ]);
    const plantillaPath = path.join(os.tmpdir(), 'plantilla_ORLANT_qa_graficas.xlsx');
    await dl.saveAs(plantillaPath);

    const wb = XLSX.readFile(plantillaPath);
    const filasSalida = construirFilasSalida();
    const salidaAoa = [
      ['Fecha (AAAA-MM-DD)', 'Llamadas salida Linea General', 'Llamadas salida 3P', 'WhatsApp salida Linea General', 'WhatsApp salida 3P'],
      ...filasSalida.map((f) => [f.fecha, f.salida_general, f.salida_3p, f.wpp_salida_general, f.wpp_salida_3p]),
    ];
    wb.Sheets['salida'] = XLSX.utils.aoa_to_sheet(salidaAoa);
    const llenaPath = path.join(os.tmpdir(), 'plantilla_ORLANT_qa_graficas_llena.xlsx');
    XLSX.writeFile(wb, llenaPath);

    await page.fill('#carga-periodo', SALIDA_PERIODO);
    await page.setInputFiles('#carga-file', llenaPath);
    await page.waitForTimeout(800);
    await page.evaluate(() => guardarCarga());
    await page.waitForTimeout(1500);
    resultado.salidaGuardadoToast = (await page.locator('#toast').innerText().catch(() => '')).trim();
    resultado.salidaGuardadoOk = resultado.salidaGuardadoToast.includes('salida') || resultado.salidaGuardadoToast.includes('✓');
    await page.evaluate(() => { if (typeof closeCargas === 'function') closeCargas(); });

    // ══ 4. Abrir el dashboard real de ORLANT y revisar cada panel ══
    await page.evaluate(() => openGenericDashboard('ORLANT'));
    await page.waitForTimeout(1500);
    resultado.dashboardAbreOk = (await page.locator('#gd-sub').innerText().catch(() => '')).includes('ORLANT');

    // Trafico: los 3 canvases ahora deberian tener datos (no "Sin datos").
    await page.evaluate(() => switchGenericTab('trafico'));
    await page.waitForTimeout(3000);
    resultado.traficoConDatosOk = await page.evaluate(() => {
      var host = document.getElementById('gd-p0');
      return !!host && !/Sin datos cargados/i.test(host.textContent) && !!host.querySelector('#tv-canvas-aht-0');
    });
    // Captura del panel completo (no page.screenshot fullPage): #gd-overlay
    // tiene su propio scroll interno, asi que una captura de pagina completa
    // corta el contenido del modal que no entra en el viewport -- una
    // captura de ELEMENTO escala/incluye todo el alto real del panel
    // (filtros + KPIs + los 3 canvases), sin depender de cuanto scroll tenga
    // el modal.
    await page.locator('#gd-p0').screenshot({ path: path.join(ARTIFACTS_DIR, '1-orlant-trafico-con-datos.png') });

    // Salida: cambiar panel 1 a "Linea 3P" (panel 2 se queda en el default
    // "Linea General") -- asi la captura prueba que el selector realmente
    // cambia lo que se dibuja, no solo que ambos paneles muestran lo mismo.
    await page.evaluate(() => switchGenericTab('salida'));
    await page.waitForTimeout(1000);
    const opcionesLinea = await page.evaluate(() => {
      var sel = document.getElementById('gd-serief-0');
      return sel ? Array.from(sel.options).map((o) => o.value) : [];
    });
    resultado.salidaOpcionesLinea = opcionesLinea;
    const opcion3p = opcionesLinea.find((o) => /3P/i.test(o));
    if (opcion3p) {
      await page.selectOption('#gd-serief-0', opcion3p);
      await page.click('#gd-f0 button.btn-sm');
      await page.waitForTimeout(600);
    }
    resultado.salidaTotalPanel1 = await page.evaluate(() => { var el = document.getElementById('gd-serietot-0'); return el ? el.textContent : null; });
    resultado.salidaTotalPanel2 = await page.evaluate(() => { var el = document.getElementById('gd-serietot-1'); return el ? el.textContent : null; });
    resultado.salidaConDatosOk = !!resultado.salidaTotalPanel1 && !resultado.salidaTotalPanel1.includes('Total: 0') &&
      !!resultado.salidaTotalPanel2 && !resultado.salidaTotalPanel2.includes('Total: 0');
    await shot(page, '2-orlant-salida-con-datos.png');

    // Tipificacion y STA: ya tenian datos reales antes de este prompt --
    // confirmar que siguen viendose bien (sin tocarlos).
    await page.evaluate(() => switchGenericTab('tipificacion'));
    await page.waitForTimeout(1000);
    resultado.tipificacionSigueOk = await page.evaluate(() => {
      var chart = _gd.charts['gd-c0'];
      return !!chart && (chart.data.labels || []).length > 0;
    });
    await shot(page, '3-orlant-tipificacion.png');

    await page.evaluate(() => switchGenericTab('sta'));
    await page.waitForTimeout(1000);
    resultado.staSigueOk = await page.evaluate(() => {
      var titulos = Array.from(document.querySelectorAll('.aurora-card-title')).map((el) => el.textContent);
      return titulos.some((t) => t.includes('Ordenes por servicio (año)'));
    });
    await shot(page, '4-orlant-sta.png');

    await page.evaluate(() => closeGenericDashboard());

    ok =
      resultado.loginOk &&
      resultado.skillRegistradoOk &&
      resultado.traficoGuardadoOk &&
      resultado.salidaGuardadoOk &&
      resultado.dashboardAbreOk &&
      resultado.traficoConDatosOk &&
      resultado.salidaConDatosOk &&
      resultado.tipificacionSigueOk &&
      resultado.staSigueOk;

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
