// verificar-fase106-inasistencia-local.js — QA de un solo uso, Fase 106
// (pedido textual de InCo: "que en Inasistencia solo quede en porcentaje,
// por mes"). Recorrido EN LOCAL (http://localhost:3000, con `npm run
// seed:demo`), Playwright directo desde Node (nunca la extension de Claude
// in Chrome, ver CLAUDE.md). Solo datos de demo (seedInasistenciaOrlant,
// server/scripts/seed-demo-lib/dashboards.js) -- nunca datos reales.
//
// Confirma: la pestaña Inasistencia ya NO ofrece sub-pestañas
// ("Por especialidad"/"Detalle" desaparecieron), ya NO pinta conteos
// sueltos (Total de citas/Atendidas/Canceladas/Pendientes) ni las barras
// de la vieja grafica combo -- queda 1 tarjeta y 1 grafica, las dos solo
// con el % de inasistencia PONDERADO por mes. El selector global de MES
// resalta la barra del mes elegido (otro color de la paleta categorica,
// nunca el semaforo) y actualiza la tarjeta -- el valor se compara exacto
// contra el agregado que ya calcula inasistenciaAgregarPorMes
// (public/js/inasistencia-logic.js, la MISMA funcion que usa el servidor
// para los numeros de control, nunca una formula duplicada aqui). Exportar
// a Excel trae 1 sola hoja con Mes y % de inasistencia, cuadrando con lo
// que se ve en pantalla. Viewports 1366x768, 1920x1080 y movil 412, claro
// y oscuro. Capturas en docs/capturas-demo/fase106-inasistencia-porcentaje/.
'use strict';
const path = require('path');
const fs = require('fs');

// Rutas absolutas de ESTA maquina (igual criterio que los demas scripts de
// verificacion local/produccion): node_modules de playwright/xlsx viven en
// server/, no en la raiz del repo.
const SERVER_DIR = path.join(__dirname, '..', '..', 'server');
const { chromium } = require(path.join(SERVER_DIR, 'node_modules', 'playwright'));
const XLSX = require(path.join(SERVER_DIR, 'node_modules', 'xlsx'));
const CRED_FILE = path.join(SERVER_DIR, 'data', 'seed-demo-credenciales.txt');
const BASE = process.env.APP_URL || 'http://localhost:3000';
const OUT_DIR = path.join(SERVER_DIR, '..', 'docs', 'capturas-demo', 'fase106-inasistencia-porcentaje');

function leerAdmin() {
  const texto = fs.readFileSync(CRED_FILE, 'utf8');
  const m = texto.match(/^ADMIN\tuser:\s*(\S+)\s+password:\s*(\S+)/m);
  return { user: m[1], password: m[2] };
}

const VIEWPORTS = [
  { name: '1366x768', width: 1366, height: 768 },
  { name: '1920x1080', width: 1920, height: 1080 },
  { name: 'movil412', width: 412, height: 915 },
];
const TEMAS = ['light', 'dark'];

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const admin = leerAdmin();
  const hallazgos = [];
  const consola = [];
  let ctx = 'arranque';

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: VIEWPORTS[0] });
  page.on('pageerror', (e) => consola.push({ ctx, tipo: 'pageerror', msg: e.message }));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon/i.test(m.text())) consola.push({ ctx, tipo: 'console.error', msg: m.text() }); });
  page.on('requestfailed', (r) => consola.push({ ctx, tipo: 'request-failed', url: r.url() }));

  try {
    ctx = 'login UI';
    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
    await page.fill('#username', admin.user);
    await page.fill('#password', admin.password);
    await page.click('button.btn-login');
    await page.waitForTimeout(1000);

    ctx = 'abrir ORLANT, pestaña Inasistencia';
    await page.evaluate(() => openGenericDashboard('ORLANT'));
    await page.waitForTimeout(1200);
    const tabs = page.locator('#gd-tabs .atab');
    const nTabs = await tabs.count();
    let encontrado = false;
    for (let t = 0; t < nTabs; t++) {
      const txt = (await tabs.nth(t).textContent() || '').trim();
      if (/^inasistencia/i.test(txt)) { await tabs.nth(t).click(); encontrado = true; break; }
    }
    if (!encontrado) hallazgos.push({ tipo: 'tab-inasistencia-no-encontrada' });
    await page.waitForTimeout(1000);

    ctx = 'agregado del servidor (misma funcion que usa la pantalla, para comparar sin duplicar la formula)';
    const agregado = await page.evaluate(async () => {
      var datos = await apiRequest('GET', '/calidad/inasistencia/mensual?campana=ORLANT');
      return inasistenciaAgregarPorMes(datos);
    });
    if (!agregado.length) { console.log('FALLO: sin datos de Inasistencia en el seed de demo.'); process.exit(1); }
    const mesA = agregado[0].mes;
    const mesB = agregado[agregado.length - 1].mes;

    ctx = 'estructura: sin sub-pestañas, sin conteos sueltos, 1 tarjeta, 1 grafica';
    const estructura = await page.evaluate(() => {
      const panel = document.getElementById('gd-panels');
      const texto = panel ? panel.innerText : '';
      return {
        subtabsBtn: document.querySelectorAll('.gd-subtab-btn').length,
        tarjetas: document.querySelectorAll('.aurora-kpis .aurora-kpi').length,
        canvas: !!document.getElementById('inasist-c-pormes-0'),
        tieneConteosViejos: /Total de citas|Atendidas|Canceladas|Pendientes/i.test(texto),
        textoSospechoso: /\bNaN\b|\bundefined\b|\[object Object\]/.test(texto),
      };
    });
    if (estructura.subtabsBtn !== 0) hallazgos.push({ tipo: 'todavia-tiene-botones-subtabs', cantidad: estructura.subtabsBtn });
    if (estructura.tarjetas !== 1) hallazgos.push({ tipo: 'tarjetas-no-es-1', cantidad: estructura.tarjetas });
    if (!estructura.canvas) hallazgos.push({ tipo: 'grafica-no-dibujada' });
    if (estructura.tieneConteosViejos) hallazgos.push({ tipo: 'todavia-muestra-conteos-sueltos' });
    if (estructura.textoSospechoso) hallazgos.push({ tipo: 'texto-sospechoso-nan-undefined' });

    ctx = 'aviso de mes incompleto (el seed de demo siembra el ultimo mes con 1 sola especialidad)';
    const avisoTexto = await page.locator('#inasist-aviso-0').innerText().catch(() => '');
    if (!avisoTexto || !/solo incluye/i.test(avisoTexto)) hallazgos.push({ tipo: 'aviso-mes-incompleto-no-aparecio', avisoTexto });

    ctx = 'tooltip "?" de la formula ponderada sigue presente';
    const tieneHelp = await page.locator('.gd-help').count();
    if (!tieneHelp) hallazgos.push({ tipo: 'tooltip-formula-ponderada-no-esta' });

    ctx = 'selector global de MES (' + mesA + '): tarjeta y barra resaltada coinciden con el agregado';
    await page.selectOption('#gd-mes-sel', mesA);
    await page.waitForTimeout(700);
    const tarjetaTexto = await page.locator('#inasist-tarjetas-wrap-0 .kv').innerText().catch(() => '');
    const pctEsperadoA = await page.evaluate(({ m, agr }) => {
      var a = agr.find((x) => x.mes === m);
      return inasistenciaFmtPct(a.pct);
    }, { m: mesA, agr: agregado });
    if (tarjetaTexto.trim() !== pctEsperadoA) hallazgos.push({ tipo: 'tarjeta-no-coincide-con-agregado', mes: mesA, esperado: pctEsperadoA, real: tarjetaTexto.trim() });

    const coloresA = await page.evaluate(() => {
      var ch = _gd.charts['inasist-c-pormes-0'];
      return ch ? ch.data.datasets[0].backgroundColor.slice() : null;
    });
    const idxA = agregado.map((a) => a.mes).indexOf(mesA);
    if (!coloresA) hallazgos.push({ tipo: 'grafica-sin-instancia-chart' });
    else {
      const otrosColoresA = coloresA.filter((c, idx) => idx !== idxA);
      if (otrosColoresA.length && otrosColoresA.every((c) => c === coloresA[idxA])) {
        hallazgos.push({ tipo: 'barra-del-mes-elegido-no-se-resalta', mes: mesA, colores: coloresA });
      }
    }
    await page.screenshot({ path: path.join(OUT_DIR, 'inasistencia-1366x768-light-mesA.png') });

    if (mesB !== mesA) {
      ctx = 'selector global de MES (' + mesB + '): la tarjeta cambia';
      await page.selectOption('#gd-mes-sel', mesB);
      await page.waitForTimeout(700);
      const tarjetaTextoB = await page.locator('#inasist-tarjetas-wrap-0').innerText().catch((e) => 'ERROR:' + e.message);
      const pctEsperadoB = await page.evaluate(({ m, agr }) => {
        var a = agr.find((x) => x.mes === m);
        return a ? inasistenciaFmtPct(a.pct) : null;
      }, { m: mesB, agr: agregado });
      if (pctEsperadoB !== null && !tarjetaTextoB.includes(pctEsperadoB)) {
        hallazgos.push({ tipo: 'tarjeta-no-actualizo-con-mes-nuevo', mes: mesB, esperado: pctEsperadoB, real: tarjetaTextoB.trim() });
      }
      await page.screenshot({ path: path.join(OUT_DIR, 'inasistencia-1366x768-light-mesB.png') });
      await page.selectOption('#gd-mes-sel', mesA);
      await page.waitForTimeout(500);
    }

    ctx = 'exportar a Excel: 1 sola hoja, Mes + % de inasistencia, cuadrando con pantalla';
    const [descarga] = await Promise.all([
      page.waitForEvent('download', { timeout: 10000 }),
      (async () => {
        await page.locator('#gd-export-btn').click();
        await page.waitForTimeout(250);
        await page.locator('#gd-export-menu button', { hasText: 'Excel' }).click();
      })(),
    ]);
    const rutaDescarga = path.join(OUT_DIR, 'export-inasistencia-verificacion.xlsx');
    await descarga.saveAs(rutaDescarga);
    const wb = XLSX.readFile(rutaDescarga);
    const hojasInasist = wb.SheetNames.filter((n) => /inasist/i.test(n));
    if (hojasInasist.length !== 1) {
      hallazgos.push({ tipo: 'excel-cantidad-de-hojas-incorrecta', hojas: wb.SheetNames });
    } else {
      const filasExcel = XLSX.utils.sheet_to_json(wb.Sheets[hojasInasist[0]]);
      if (!filasExcel.length) hallazgos.push({ tipo: 'excel-hoja-inasistencia-vacia' });
      const columnas = filasExcel.length ? Object.keys(filasExcel[0]) : [];
      if (!columnas.includes('Mes') || !columnas.includes('% de inasistencia')) {
        hallazgos.push({ tipo: 'excel-columnas-incorrectas', columnas });
      }
      if (columnas.some((c) => /Total de citas|Inasistencias \(incluye|Atendidas|Canceladas|Pendientes/i.test(c))) {
        hallazgos.push({ tipo: 'excel-todavia-trae-columnas-de-conteos', columnas });
      }
      const mesALbl = await page.evaluate((m) => inasistenciaMesLbl(m), mesA);
      const filaA = filasExcel.find((f) => f.Mes === mesALbl);
      if (!filaA || Number(filaA['% de inasistencia']) !== agregado[idxA].pct) {
        hallazgos.push({ tipo: 'excel-pct-no-cuadra-con-pantalla', esperado: agregado[idxA].pct, fila: filaA });
      }
    }
    fs.unlinkSync(rutaDescarga); // el .xlsx descargado no se commitea, solo las capturas

    ctx = 'tema oscuro, 1366x768';
    await page.evaluate(() => { if (typeof aplicarTema === 'function') aplicarTema('dark'); });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT_DIR, 'inasistencia-1366x768-dark.png') });
    await page.evaluate(() => { if (typeof aplicarTema === 'function') aplicarTema('light'); });
    await page.waitForTimeout(300);

    for (const vp of VIEWPORTS) {
      if (vp.name === '1366x768') continue; // ya capturado arriba (claro+oscuro)
      for (const tema of TEMAS) {
        ctx = vp.name + '/' + tema;
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.evaluate((t) => { if (typeof aplicarTema === 'function') aplicarTema(t); }, tema);
        await page.waitForTimeout(500);

        const scrollHorizontal = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
        if (scrollHorizontal) hallazgos.push({ tipo: 'scroll-horizontal', viewport: vp.name, tema });

        await page.screenshot({ path: path.join(OUT_DIR, `inasistencia-${vp.name}-${tema}.png`) });
      }
    }
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.evaluate(() => { if (typeof aplicarTema === 'function') aplicarTema('light'); });

    console.log('=== CONSOLA (errores/requests fallidos) ===');
    console.log(JSON.stringify(consola, null, 2));
    console.log('=== HALLAZGOS ===');
    console.log(JSON.stringify(hallazgos, null, 2));
    console.log(hallazgos.length === 0 && consola.length === 0 ? 'OK: 0 hallazgos, 0 errores de consola.' : 'REVISAR hallazgos/consola arriba.');
    if (hallazgos.length || consola.length) process.exitCode = 1;
  } catch (e) {
    console.log('EXCEPCION en ctx=', ctx, e.message);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
