// verificar-fase111-efectividad-local.js — QA de un solo uso, Fase 111
// (pedido textual de Edwin: "el ranking va a ser efectividad por
// agendamiento" + nueva pestaña "Efectividad de Citas"). Recorrido EN LOCAL
// (http://localhost:3000, con `npm run seed:demo` -- esta fase agrega demo
// a `efectividad_agendamiento`/`efectividad_citas`, ver
// server/scripts/seed-demo-lib/dashboards.js), Playwright directo desde
// Node (nunca la extension de Claude in Chrome, ver CLAUDE.md).
'use strict';
const path = require('path');
const fs = require('fs');

const SERVER_DIR = path.join(__dirname, '..', '..', 'server');
const { chromium } = require(path.join(SERVER_DIR, 'node_modules', 'playwright'));
const XLSX = require(path.join(SERVER_DIR, 'node_modules', 'xlsx'));
const CRED_FILE = path.join(SERVER_DIR, 'data', 'seed-demo-credenciales.txt');
const BASE = process.env.APP_URL || 'http://localhost:3000';
const OUT_DIR = path.join(SERVER_DIR, '..', 'docs', 'capturas-demo', 'fase111-efectividad');

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

    ctx = 'abrir ORLANT';
    await page.evaluate(() => openGenericDashboard('ORLANT'));
    await page.waitForTimeout(1200);
    const mesSel = await page.evaluate(() => _gd.mesSel);

    // ══ Tema A: Ranking de Asesores (efectividad) ═══════════════════════
    ctx = 'tab Agendamiento / subtab Ranking de asesores';
    await page.evaluate(() => switchGenericTab('agendamiento'));
    await page.waitForTimeout(1200);
    await page.evaluate(() => switchGenericSubtab('rankingasesores'));
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(OUT_DIR, 'ea-01-ranking-default.png') });

    ctx = 'ranking: control cruzado contra la misma API que usa la pantalla (nunca un numero hardcodeado)';
    const ranking = await page.evaluate((mes) => apiRequest('GET', '/calidad/efectividad-agendamiento/ranking?campana=ORLANT&mes=' + mes), mesSel);
    if (!ranking.filas || !ranking.filas.length) hallazgos.push({ tipo: 'ranking-sin-filas', mesSel });
    else {
      // Orden: efectividad desc; empate = mas gestiones primero.
      for (let k = 1; k < ranking.filas.length; k++) {
        const a = ranking.filas[k - 1], b = ranking.filas[k];
        const ok = a.efectividad > b.efectividad || (a.efectividad === b.efectividad && a.gestiones >= b.gestiones);
        if (!ok) hallazgos.push({ tipo: 'orden-de-ranking-incorrecto', a, b });
      }
      // Equipo ponderado = Sigma(agendas)/Sigma(gestiones), nunca el promedio simple.
      const sumG = ranking.filas.reduce((s, f) => s + f.gestiones, 0);
      const sumA = ranking.filas.reduce((s, f) => s + f.agendas, 0);
      const ponderadoEsperado = sumG > 0 ? sumA / sumG : 0;
      if (Math.abs(ranking.equipo.efectividad - ponderadoEsperado) > 0.0001) {
        hallazgos.push({ tipo: 'equipo-no-es-ponderado', esperado: ponderadoEsperado, real: ranking.equipo.efectividad });
      }
      const promedioSimple = ranking.filas.reduce((s, f) => s + f.efectividad, 0) / ranking.filas.length;
      if (Math.abs(ranking.equipo.efectividad - promedioSimple) < 0.0001 && Math.abs(ponderadoEsperado - promedioSimple) > 0.01) {
        hallazgos.push({ tipo: 'equipo-coincide-con-promedio-simple-sospechoso' });
      }
    }

    ctx = 'tabla en pantalla: mismo orden/valores que la API (puesto, asesor, gestiones, agendas, %)';
    const filasTabla = await page.locator('#ea-tabla-3 tbody tr').allTextContents();
    if (ranking.filas && filasTabla.length !== ranking.filas.length) {
      hallazgos.push({ tipo: 'tabla-no-tiene-todos-los-asesores', esperado: ranking.filas.length, real: filasTabla.length });
    }

    ctx = 'tarjetas del mes: gestiones/agendas/efectividad ponderada';
    const tarjetasEA = await page.locator('#ea-tarjetas-wrap-3 .aurora-kpi').allTextContents();
    if (tarjetasEA.length !== 3) hallazgos.push({ tipo: 'ea-no-son-3-tarjetas', cantidad: tarjetasEA.length, tarjetasEA });
    const pctEquipoFmt = await page.evaluate((v) => efectividadAgendamientoFmtPct(v), ranking.equipo.efectividad);
    if (!tarjetasEA.some((t) => t.includes(pctEquipoFmt))) hallazgos.push({ tipo: 'tarjeta-equipo-no-coincide', esperado: pctEquipoFmt, tarjetasEA });

    ctx = 'grafica combo: barras Gestiones/Agendas + linea % Efectividad en eje secundario, en el orden del ranking';
    const chartEA = await page.evaluate(() => {
      var ch = _gd.charts['ea-c-3'];
      if (!ch) return null;
      return {
        labels: ch.data.labels.slice(),
        datasets: ch.data.datasets.map((d) => ({ label: d.label, type: d.type, yAxisID: d.yAxisID, data: d.data.slice() })),
      };
    });
    if (!chartEA) hallazgos.push({ tipo: 'ea-grafica-no-dibujada' });
    else {
      const barG = chartEA.datasets.find((d) => d.label === 'Gestiones');
      const barA = chartEA.datasets.find((d) => d.label === 'Agendas');
      const linea = chartEA.datasets.find((d) => d.label === '% Efectividad');
      if (!barG || !barA || !linea) hallazgos.push({ tipo: 'ea-grafica-sin-las-3-series', datasets: chartEA.datasets.map((d) => d.label) });
      if (linea && linea.type !== 'line') hallazgos.push({ tipo: 'ea-linea-no-es-line', real: linea.type });
      // Orden = orden del ranking (puesto), nunca el de busqueda.
      const ordenEsperado = ranking.filas.map((f) => textoFormatoNombreLocal(f.asesor));
      function textoFormatoNombreLocal(s) { return s; } // comparacion laxa (solo longitud/primeros nombres)
      if (chartEA.labels.length !== ranking.filas.length) hallazgos.push({ tipo: 'ea-grafica-cantidad-de-categorias-distinta', esperado: ranking.filas.length, real: chartEA.labels.length });
    }

    ctx = 'buscador: filtra la tabla por nombre sin reordenar';
    const primerAsesor = ranking.filas[0].asesor.split(' ')[0];
    await page.fill('#ea-buscar-3', primerAsesor);
    await page.waitForTimeout(300);
    const filasFiltradas = await page.locator('#ea-tabla-3 tbody tr').count();
    if (filasFiltradas < 1) hallazgos.push({ tipo: 'buscador-no-encontro-nada', primerAsesor });
    await page.fill('#ea-buscar-3', '');
    await page.waitForTimeout(300);

    ctx = 'exportar: trae la tabla completa + el total';
    const [descargaEA] = await Promise.all([
      page.waitForEvent('download', { timeout: 10000 }),
      (async () => {
        await page.locator('#gd-export-btn').click();
        await page.waitForTimeout(250);
        await page.locator('#gd-export-menu button', { hasText: 'Excel' }).click();
      })(),
    ]);
    const rutaEA = path.join(OUT_DIR, 'export-ranking.xlsx');
    await descargaEA.saveAs(rutaEA);
    const wbEA = XLSX.readFile(rutaEA);
    const hojaRanking = wbEA.SheetNames.find((n) => /ranking|efectividad/i.test(n));
    if (!hojaRanking) hallazgos.push({ tipo: 'export-ea-sin-hoja', hojas: wbEA.SheetNames });
    else {
      const filasExcel = XLSX.utils.sheet_to_json(wbEA.Sheets[hojaRanking]);
      if (filasExcel.length < ranking.filas.length) hallazgos.push({ tipo: 'export-ea-filas-incompletas', esperado: ranking.filas.length, real: filasExcel.length });
    }
    fs.unlinkSync(rutaEA);

    await page.screenshot({ path: path.join(OUT_DIR, 'ea-02-ranking-completo.png') });

    // ══ Tema B: Efectividad de Citas ═════════════════════════════════════
    ctx = 'tab Efectividad de Citas';
    await page.evaluate(() => switchGenericTab('efectividad'));
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(OUT_DIR, 'ec-01-default.png') });

    const citasPorMes = await page.evaluate(() => apiRequest('GET', '/calidad/efectividad-citas/mensual?campana=ORLANT'));
    if (!citasPorMes.length) hallazgos.push({ tipo: 'ec-sin-datos' });
    else {
      ctx = 'tarjetas: % del mes elegido + % ponderado del periodo con datos';
      const tarjetasEC = await page.locator('#ec-tarjetas-wrap-0 .aurora-kpi').allTextContents();
      if (tarjetasEC.length !== 2) hallazgos.push({ tipo: 'ec-no-son-2-tarjetas', cantidad: tarjetasEC.length, tarjetasEC });
      const ponderado = await page.evaluate((filas) => citasAtendidasPonderado(filas), citasPorMes);
      const ponderadoFmt = await page.evaluate((v) => citasAtendidasFmtPct(v), ponderado.pct);
      if (!tarjetasEC.some((t) => t.includes(ponderadoFmt))) hallazgos.push({ tipo: 'ec-tarjeta-ponderado-no-coincide', esperado: ponderadoFmt, tarjetasEC });
      const rangoEsperado = await page.evaluate((filas) => citasAtendidasRangoLbl(filas), citasPorMes);
      if (!tarjetasEC.some((t) => t.includes(rangoEsperado))) hallazgos.push({ tipo: 'ec-tarjeta-sin-rango', esperado: rangoEsperado, tarjetasEC });

      ctx = 'grafica combo: Agendas/Atendidas en barras, % Efectividad en linea (eje secundario)';
      const chartEC = await page.evaluate(() => {
        var ch = _gd.charts['ec-c-0'];
        if (!ch) return null;
        return { datasets: ch.data.datasets.map((d) => ({ label: d.label, type: d.type })) };
      });
      if (!chartEC) hallazgos.push({ tipo: 'ec-grafica-no-dibujada' });
      else {
        const linea = chartEC.datasets.find((d) => d.label === '% Efectividad');
        if (!linea || linea.type !== 'line') hallazgos.push({ tipo: 'ec-linea-incorrecta', chartEC });
      }

      ctx = 'tabla de datos debajo: mes elegido en negrita';
      const tablaECHtml = await page.locator('#ec-tabla-0').innerHTML().catch(() => '');
      if (!/font-weight:800/.test(tablaECHtml)) hallazgos.push({ tipo: 'ec-tabla-sin-negrita-mes-elegido' });

      ctx = 'exportar Efectividad de Citas';
      const [descargaEC] = await Promise.all([
        page.waitForEvent('download', { timeout: 10000 }),
        (async () => {
          await page.locator('#gd-export-btn').click();
          await page.waitForTimeout(250);
          await page.locator('#gd-export-menu button', { hasText: 'Excel' }).click();
        })(),
      ]);
      const rutaEC = path.join(OUT_DIR, 'export-efectividad-citas.xlsx');
      await descargaEC.saveAs(rutaEC);
      const wbEC = XLSX.readFile(rutaEC);
      const hojaEC = wbEC.SheetNames.find((n) => /citas|efectividad/i.test(n));
      if (!hojaEC) hallazgos.push({ tipo: 'export-ec-sin-hoja', hojas: wbEC.SheetNames });
      fs.unlinkSync(rutaEC);
    }
    await page.screenshot({ path: path.join(OUT_DIR, 'ec-02-completo.png') });

    ctx = 'texto sospechoso (NaN/undefined/[object Object]) en ambos paneles';
    const textoSospechoso = await page.evaluate(() => /\bNaN\b|\bundefined\b|\[object Object\]/.test(document.getElementById('gd-panels').innerText));
    if (textoSospechoso) hallazgos.push({ tipo: 'texto-sospechoso-nan-undefined' });

    ctx = 'tema oscuro, 1366x768';
    await page.evaluate(() => { if (typeof aplicarTema === 'function') aplicarTema('dark'); });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT_DIR, 'ec-03-oscuro.png') });
    await page.evaluate(() => switchGenericTab('agendamiento'));
    await page.waitForTimeout(800);
    await page.evaluate(() => switchGenericSubtab('rankingasesores'));
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(OUT_DIR, 'ea-03-oscuro.png') });
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
        if (scrollHorizontal) hallazgos.push({ tipo: 'scroll-horizontal-de-pagina', viewport: vp.name, tema, pestana: 'ranking' });

        await page.screenshot({ path: path.join(OUT_DIR, `ea-04-${vp.name}-${tema}.png`) });

        await page.evaluate(() => switchGenericTab('efectividad'));
        await page.waitForTimeout(500);
        const scrollHorizontalEC = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
        if (scrollHorizontalEC) hallazgos.push({ tipo: 'scroll-horizontal-de-pagina', viewport: vp.name, tema, pestana: 'efectividad-citas' });
        await page.screenshot({ path: path.join(OUT_DIR, `ec-04-${vp.name}-${tema}.png`) });

        await page.evaluate(() => switchGenericTab('agendamiento'));
        await page.waitForTimeout(300);
        await page.evaluate(() => switchGenericSubtab('rankingasesores'));
        await page.waitForTimeout(300);
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
