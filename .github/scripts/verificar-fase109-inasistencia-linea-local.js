// verificar-fase109-inasistencia-linea-local.js — QA de un solo uso, Fase
// 109 (pedido textual de InCo): "Resumen por mes" pasa de barras a LINEA
// (como un grafico de linea de Excel) con tabla de datos debajo, 2
// tarjetas (periodo filtrado + mes elegido arriba, cada una con su propia
// etiqueta de rango) y avisos que distinguen mes 'parcial' (formato viejo,
// Sep-26)/'incompleto'/'sinDatosFiltro'. Recorrido EN LOCAL
// (http://localhost:3000, con `npm run seed:demo` -- el seed de esta fase
// deja el ULTIMO mes en formato viejo, sede/entidad='SIN DATO', igual que
// el Sep-26 real), Playwright directo desde Node (nunca la extension de
// Claude in Chrome, ver CLAUDE.md).
'use strict';
const path = require('path');
const fs = require('fs');

const SERVER_DIR = path.join(__dirname, '..', '..', 'server');
const { chromium } = require(path.join(SERVER_DIR, 'node_modules', 'playwright'));
const XLSX = require(path.join(SERVER_DIR, 'node_modules', 'xlsx'));
const CRED_FILE = path.join(SERVER_DIR, 'data', 'seed-demo-credenciales.txt');
const BASE = process.env.APP_URL || 'http://localhost:3000';
const OUT_DIR = path.join(SERVER_DIR, '..', 'docs', 'capturas-demo', 'fase109-inasistencia-linea');

function leerAdmin() {
  const texto = fs.readFileSync(CRED_FILE, 'utf8');
  const m = texto.match(/^ADMIN\tuser:\s*(\S+)\s+password:\s*(\S+)/m);
  return { user: m[1], password: m[2] };
}

const VIEWPORTS = [
  { name: '1366x768', width: 1366, height: 768 },
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

    ctx = 'abrir ORLANT, pestaña Inasistencia ("antes": estado por defecto)';
    await page.evaluate(() => openGenericDashboard('ORLANT'));
    await page.waitForTimeout(1200);
    const tabs = page.locator('#gd-tabs .atab');
    const nTabs = await tabs.count();
    for (let t = 0; t < nTabs; t++) {
      const txt = (await tabs.nth(t).textContent() || '').trim();
      if (/^inasistencia/i.test(txt)) { await tabs.nth(t).click(); break; }
    }
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(OUT_DIR, 'antes-01-resumen-por-mes-default.png') });

    ctx = 'opciones del servidor (mesesFormatoViejo nuevo)';
    const opciones = await page.evaluate(async () => apiRequest('GET', '/calidad/inasistencia/opciones?campana=ORLANT'));
    if (!opciones.meses.length) { console.log('FALLO: sin datos de Inasistencia en el seed de demo.'); process.exit(1); }
    if (!opciones.mesesFormatoViejo || !opciones.mesesFormatoViejo.length) {
      hallazgos.push({ tipo: 'seed-sin-mes-formato-viejo', opciones });
    }
    const mesParcial = opciones.mesesFormatoViejo[0];

    ctx = 'agregado del servidor (misma funcion que usa la pantalla, para comparar sin duplicar la formula)';
    const agregado = await page.evaluate(async () => {
      var datos = await apiRequest('GET', '/calidad/inasistencia/mensual?campana=ORLANT');
      return inasistenciaAgregarPorMes(datos);
    });
    const mesSel = await page.evaluate(() => _gd.mesSel);

    ctx = 'grafica: tipo LINEA (nunca barras), 1 sola serie etiquetada "% de inasistencia" (nunca "Series1")';
    const chartInfo = await page.evaluate(() => {
      var ch = _gd.charts['inasist-c-pormes-0'];
      if (!ch) return null;
      return {
        type: ch.config.type,
        label: ch.data.datasets[0].label,
        data: ch.data.datasets[0].data.slice(),
        labels: ch.data.labels.slice(),
        pointRadius: ch.data.datasets[0].pointRadius,
        pointBackgroundColor: ch.data.datasets[0].pointBackgroundColor,
        yMin: ch.options.scales.y.min,
        legendDisplay: ch.options.plugins.legend.display,
      };
    });
    if (!chartInfo) hallazgos.push({ tipo: 'grafica-no-dibujada' });
    else {
      if (chartInfo.type !== 'line') hallazgos.push({ tipo: 'grafica-no-es-linea', real: chartInfo.type });
      if (chartInfo.label !== '% de inasistencia') hallazgos.push({ tipo: 'leyenda-incorrecta', real: chartInfo.label });
      if (chartInfo.yMin !== 0) hallazgos.push({ tipo: 'eje-y-no-arranca-en-0', real: chartInfo.yMin });
      if (!chartInfo.legendDisplay) hallazgos.push({ tipo: 'leyenda-oculta' });

      // Valor de cada punto == inasistenciaAgregarPorMes (control cruzado, nunca un numero hardcodeado).
      agregado.forEach(function (a, idx) {
        if (chartInfo.data[idx] !== a.pct) hallazgos.push({ tipo: 'valor-de-punto-no-coincide', mes: a.mes, esperado: a.pct, real: chartInfo.data[idx] });
      });

      // Mes elegido: punto mas grande que el resto.
      var idxSel = agregado.map((a) => a.mes).indexOf(mesSel);
      if (idxSel !== -1) {
        var radioSel = chartInfo.pointRadius[idxSel];
        var otroRadio = chartInfo.pointRadius[(idxSel + 1) % chartInfo.pointRadius.length];
        if (!(radioSel > otroRadio)) hallazgos.push({ tipo: 'mes-elegido-no-se-resalta-en-radio', radioSel, otroRadio });
      }

      // Mes parcial: punto hueco (pointBackgroundColor 'transparent').
      if (mesParcial) {
        var idxParcial = agregado.map((a) => a.mes).indexOf(mesParcial);
        if (idxParcial !== -1 && chartInfo.pointBackgroundColor[idxParcial] !== 'transparent') {
          hallazgos.push({ tipo: 'mes-parcial-sin-punto-hueco', mes: mesParcial, real: chartInfo.pointBackgroundColor[idxParcial] });
        }
      }
    }

    ctx = 'datalabels con 2 decimales y coma (inasistenciaFmtPct, nunca el formato de 1 decimal de loPct)';
    const fmtEsperado = await page.evaluate((pct) => inasistenciaFmtPct(pct), agregado[0].pct);
    if (!/^\d+,\d{2} %$/.test(fmtEsperado)) hallazgos.push({ tipo: 'formato-de-control-inesperado', fmtEsperado });

    ctx = '2 tarjetas: periodo filtrado (con el RANGO en la etiqueta) + mes elegido arriba';
    const tarjetas = await page.locator('#inasist-tarjetas-wrap-0 .aurora-kpi').allTextContents();
    if (tarjetas.length !== 2) hallazgos.push({ tipo: 'no-son-2-tarjetas', cantidad: tarjetas.length, tarjetas });
    const rangoEsperado = await page.evaluate((agr) => inasistenciaRangoLbl(agr), agregado);
    if (!tarjetas.some((t) => t.includes(rangoEsperado))) hallazgos.push({ tipo: 'tarjeta-sin-etiqueta-de-rango', esperado: rangoEsperado, tarjetas });
    const mesSelLbl = await page.evaluate((m) => inasistenciaMesLbl(m), mesSel);
    if (!tarjetas.some((t) => t.includes(mesSelLbl))) hallazgos.push({ tipo: 'tarjeta-sin-etiqueta-del-mes-elegido', esperado: mesSelLbl, tarjetas });
    const ponderadoEsperado = await page.evaluate((agr) => inasistenciaPonderadoTotal(agr).pct, agregado);
    const ponderadoFmt = await page.evaluate((v) => inasistenciaFmtPct(v), ponderadoEsperado);
    if (!tarjetas.some((t) => t.includes(ponderadoFmt))) hallazgos.push({ tipo: 'tarjeta-periodo-no-coincide', esperado: ponderadoFmt, tarjetas });

    ctx = 'aviso "parcial" para el mes de formato viejo (menciona "datos parciales" y "sin sede ni entidad")';
    const avisoTexto = await page.locator('#inasist-aviso-0').innerText().catch(() => '');
    if (mesParcial && !/datos parciales/i.test(avisoTexto)) hallazgos.push({ tipo: 'aviso-parcial-no-aparecio', avisoTexto });
    if (mesParcial && !/sin sede ni entidad/i.test(avisoTexto)) hallazgos.push({ tipo: 'aviso-parcial-sin-mencion-sede-entidad', avisoTexto });

    ctx = 'tabla de datos debajo de la grafica: mes/valor alineados, Total de citas, columna del mes elegido en negrita, asterisco en el mes parcial';
    const tablaHtml = await page.locator('#inasist-tabla-pormes-0').innerHTML().catch(() => '');
    if (!/% de inasistencia/.test(tablaHtml) || !/Total de citas/.test(tablaHtml)) hallazgos.push({ tipo: 'tabla-sin-las-2-filas-esperadas' });
    if (mesParcial) {
      var mesParcialLbl = await page.evaluate((m) => inasistenciaMesLbl(m), mesParcial);
      if (!tablaHtml.includes(mesParcialLbl + ' *')) hallazgos.push({ tipo: 'tabla-sin-asterisco-en-mes-parcial' });
    }
    if (!/font-weight:800/.test(tablaHtml)) hallazgos.push({ tipo: 'tabla-sin-negrita-en-el-mes-elegido' });
    await page.screenshot({ path: path.join(OUT_DIR, 'despues-02-resumen-por-mes-con-tabla.png') });

    ctx = 'texto sospechoso (NaN/undefined/[object Object]) en todo el panel';
    const textoSospechoso = await page.evaluate(() => /\bNaN\b|\bundefined\b|\[object Object\]/.test(document.getElementById('gd-panels').innerText));
    if (textoSospechoso) hallazgos.push({ tipo: 'texto-sospechoso-nan-undefined' });

    ctx = 'filtro de Sede: deja un mes sin datos -> aviso "no tiene datos por sede"';
    const sedeElegida = opciones.sedes[0];
    await page.selectOption('#inasist-f-sede-0', sedeElegida);
    await page.click('button[onclick="_inasistenciaAplicarFiltros(0)"]');
    await page.waitForTimeout(700);
    const avisoConFiltro = await page.locator('#inasist-aviso-0').innerText().catch(() => '');
    if (!/no tiene datos por sede/i.test(avisoConFiltro)) hallazgos.push({ tipo: 'aviso-sin-datos-por-filtro-no-aparecio', avisoConFiltro });
    await page.screenshot({ path: path.join(OUT_DIR, 'despues-03-filtro-sede-aviso.png') });
    await page.selectOption('#inasist-f-sede-0', '');
    await page.click('button[onclick="_inasistenciaAplicarFiltros(0)"]');
    await page.waitForTimeout(500);

    ctx = '"Por especialidad" sigue en BARRAS (sin cambios de esta fase)';
    const subtabs = page.locator('.gd-subtab-btn');
    const nSub = await subtabs.count();
    for (let s = 0; s < nSub; s++) {
      const t = (await subtabs.nth(s).textContent() || '').trim();
      if (t.toLowerCase() === 'por especialidad') { await subtabs.nth(s).click(); break; }
    }
    await page.waitForTimeout(700);
    const tipoPorEsp = await page.evaluate(() => { var ch = _gd.charts['inasist-c-porespecialidad-1']; return ch ? ch.config.type : null; });
    if (tipoPorEsp !== 'bar') hallazgos.push({ tipo: 'por-especialidad-cambio-de-tipo', real: tipoPorEsp });
    await subtabs.nth(0).click(); // vuelve a "Resumen por mes"
    await page.waitForTimeout(700);

    ctx = 'exportar a Excel: hoja "Resumen por mes" trae Mes/% de inasistencia/Total de citas';
    const [descarga] = await Promise.all([
      page.waitForEvent('download', { timeout: 10000 }),
      (async () => {
        await page.locator('#gd-export-btn').click();
        await page.waitForTimeout(250);
        await page.locator('#gd-export-menu button', { hasText: 'Excel' }).click();
      })(),
    ]);
    const rutaDescarga = path.join(OUT_DIR, 'export-verificacion.xlsx');
    await descarga.saveAs(rutaDescarga);
    const wb = XLSX.readFile(rutaDescarga);
    const hojaMes = wb.SheetNames.find((n) => /inasist/i.test(n) && !/especialidad/i.test(n)) || wb.SheetNames.find((n) => /inasist/i.test(n));
    if (!hojaMes) hallazgos.push({ tipo: 'excel-sin-hoja-de-inasistencia', hojas: wb.SheetNames });
    else {
      const filasExcel = XLSX.utils.sheet_to_json(wb.Sheets[hojaMes]);
      const columnas = filasExcel.length ? Object.keys(filasExcel[0]) : [];
      if (!columnas.includes('Mes') || !columnas.includes('% de inasistencia') || !columnas.includes('Total de citas')) {
        hallazgos.push({ tipo: 'excel-columnas-incorrectas', columnas });
      }
    }
    fs.unlinkSync(rutaDescarga);

    ctx = 'tema oscuro, 1366x768';
    await page.evaluate(() => { if (typeof aplicarTema === 'function') aplicarTema('dark'); });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT_DIR, 'despues-04-resumen-por-mes-oscuro.png') });
    await page.evaluate(() => { if (typeof aplicarTema === 'function') aplicarTema('light'); });
    await page.waitForTimeout(300);

    for (const vp of VIEWPORTS) {
      if (vp.name === '1366x768') continue;
      for (const tema of TEMAS) {
        ctx = vp.name + '/' + tema;
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await page.evaluate((t) => { if (typeof aplicarTema === 'function') aplicarTema(t); }, tema);
        await page.waitForTimeout(500);

        const scrollHorizontal = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
        if (scrollHorizontal) hallazgos.push({ tipo: 'scroll-horizontal-de-pagina', viewport: vp.name, tema });

        await page.screenshot({ path: path.join(OUT_DIR, `despues-05-resumen-por-mes-${vp.name}-${tema}.png`) });
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
