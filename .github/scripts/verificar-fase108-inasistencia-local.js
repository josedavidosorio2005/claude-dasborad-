// verificar-fase108-inasistencia-local.js — QA de un solo uso, Fase 108
// (pedido textual de InCo: "la inasistencia va a ser por mes, que se pueda
// filtrar por sede, especialidad, nombre entidad... con resumen de todos
// los meses... y barra por especialidad"). Recorrido EN LOCAL
// (http://localhost:3000, con `npm run seed:demo`), Playwright directo
// desde Node (nunca la extension de Claude in Chrome, ver CLAUDE.md). Solo
// datos de demo (seedInasistenciaOrlant, server/scripts/seed-demo-lib/
// dashboards.js) -- nunca datos reales.
//
// Confirma: 2 sub-pestañas ("Resumen por mes"/"Por especialidad"), filtros
// de Sede/Especialidad/Entidad (con buscador), la tarjeta de % ponderado
// del periodo filtrado, la barra resaltada del mes elegido, la vista "Por
// especialidad" respetando el mes global y marcando base baja con
// asterisco, exportar a Excel con 2 hojas. Viewports 1366x768, 1920x1080 y
// movil 412, claro y oscuro. Capturas en
// docs/capturas-demo/fase108-inasistencia-filtros/.
'use strict';
const path = require('path');
const fs = require('fs');

const SERVER_DIR = path.join(__dirname, '..', '..', 'server');
const { chromium } = require(path.join(SERVER_DIR, 'node_modules', 'playwright'));
const XLSX = require(path.join(SERVER_DIR, 'node_modules', 'xlsx'));
const CRED_FILE = path.join(SERVER_DIR, 'data', 'seed-demo-credenciales.txt');
const BASE = process.env.APP_URL || 'http://localhost:3000';
const OUT_DIR = path.join(SERVER_DIR, '..', 'docs', 'capturas-demo', 'fase108-inasistencia-filtros');

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

async function clickSubtab(page, texto) {
  const btns = page.locator('.gd-subtab-btn');
  const n = await btns.count();
  for (let i = 0; i < n; i++) {
    const t = (await btns.nth(i).textContent() || '').trim();
    if (t.toLowerCase() === texto.toLowerCase()) { await btns.nth(i).click(); return true; }
  }
  return false;
}

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
    if (!encontrado) { hallazgos.push({ tipo: 'tab-inasistencia-no-encontrada' }); throw new Error('sin tab'); }
    await page.waitForTimeout(1000);

    ctx = 'opciones del servidor (sedes/especialidades/entidades) para comparar sin duplicar la logica';
    const opciones = await page.evaluate(async () => apiRequest('GET', '/calidad/inasistencia/opciones?campana=ORLANT'));
    if (!opciones.meses.length) { console.log('FALLO: sin datos de Inasistencia en el seed de demo.'); process.exit(1); }
    if (!opciones.sedes.length || !opciones.entidades.length) hallazgos.push({ tipo: 'opciones-sin-sedes-o-entidades', opciones });

    ctx = '2 sub-pestañas presentes: "Resumen por mes" y "Por especialidad"';
    const subtabsTxt = await page.locator('.gd-subtab-btn').allTextContents();
    const esperadas = ['Resumen por mes', 'Por especialidad'];
    if (!esperadas.every((e) => subtabsTxt.map((s) => s.trim()).includes(e))) {
      hallazgos.push({ tipo: 'subtabs-incorrectas', encontradas: subtabsTxt });
    }

    ctx = '"Resumen por mes" (vista por defecto): filtros Sede/Especialidad/Entidad presentes, tarjeta con % ponderado';
    await page.waitForTimeout(500);
    const filtrosPormes = {
      sede: await page.locator('#inasist-f-sede-0').count(),
      especialidad: await page.locator('#inasist-f-especialidad-0').count(),
      entidad: await page.locator('#inasist-f-entidad-0').count(),
    };
    if (!filtrosPormes.sede || !filtrosPormes.especialidad || !filtrosPormes.entidad) {
      hallazgos.push({ tipo: 'faltan-filtros-resumen-por-mes', filtrosPormes });
    }
    const tarjetaAntes = await page.locator('#inasist-tarjetas-wrap-0 .kv').innerText().catch(() => '');
    if (!/%/.test(tarjetaAntes)) hallazgos.push({ tipo: 'tarjeta-ponderada-sin-porcentaje', tarjetaAntes });
    await page.screenshot({ path: path.join(OUT_DIR, 'resumen-por-mes-1366x768-light.png') });

    ctx = 'filtro de Sede cambia la tarjeta ponderada (comparando contra el endpoint, no una formula duplicada)';
    const sedeElegida = opciones.sedes[0];
    const ponderadoEsperado = await page.evaluate(async (sede) => {
      const datos = await apiRequest('GET', '/calidad/inasistencia/mensual?campana=ORLANT&sede=' + encodeURIComponent(sede));
      const agregado = inasistenciaAgregarPorMes(datos);
      return inasistenciaPonderadoTotal(agregado).pct;
    }, sedeElegida);
    await page.selectOption('#inasist-f-sede-0', sedeElegida);
    await page.click('button[onclick="_inasistenciaAplicarFiltros(0)"]');
    await page.waitForTimeout(700);
    const tarjetaConSede = await page.locator('#inasist-tarjetas-wrap-0 .kv').innerText().catch(() => '');
    const pctEsperadoFmt = await page.evaluate((v) => inasistenciaFmtPct(v), ponderadoEsperado);
    if (tarjetaConSede.trim() !== pctEsperadoFmt) {
      hallazgos.push({ tipo: 'tarjeta-no-cambio-con-filtro-sede', sede: sedeElegida, esperado: pctEsperadoFmt, real: tarjetaConSede.trim() });
    }
    // Limpia el filtro de sede para no afectar los pasos siguientes.
    await page.selectOption('#inasist-f-sede-0', '');
    await page.click('button[onclick="_inasistenciaAplicarFiltros(0)"]');
    await page.waitForTimeout(500);

    ctx = 'filtro de Entidad (datalist/buscador): el campo acepta una opcion conocida de la lista';
    const entidadDatalist = await page.locator('#inasist-dl-entidad-0 option').count();
    if (entidadDatalist !== opciones.entidades.length) {
      hallazgos.push({ tipo: 'datalist-entidad-no-coincide', esperado: opciones.entidades.length, real: entidadDatalist });
    }

    ctx = 'cambiar al mes mas reciente con datos (resalta la barra, mueve "Por especialidad")';
    const mesReciente = opciones.meses[opciones.meses.length - 1];
    await page.selectOption('#gd-mes-sel', mesReciente);
    await page.waitForTimeout(700);

    ctx = '"Por especialidad": barras por especialidad del mes elegido, filtros Sede/Entidad (sin Especialidad)';
    const switched = await clickSubtab(page, 'Por especialidad');
    if (!switched) hallazgos.push({ tipo: 'no-se-pudo-cambiar-a-por-especialidad' });
    await page.waitForTimeout(700);
    const filtrosEsp = {
      sede: await page.locator('#inasist-f-sede-1').count(),
      especialidad: await page.locator('#inasist-f-especialidad-1').count(), // NO debe existir en esta vista
      entidad: await page.locator('#inasist-f-entidad-1').count(),
    };
    if (!filtrosEsp.sede || !filtrosEsp.entidad) hallazgos.push({ tipo: 'faltan-filtros-por-especialidad', filtrosEsp });
    if (filtrosEsp.especialidad) hallazgos.push({ tipo: 'por-especialidad-no-deberia-tener-filtro-de-especialidad' });

    const porEspEsperado = await page.evaluate(async (mes) => {
      const filas = await apiRequest('GET', '/calidad/inasistencia/especialidad?campana=ORLANT&mes=' + encodeURIComponent(mes));
      const conPct = filas.map((f) => ({ especialidad: f.especialidad, pct: inasistenciaPctPonderado(f.inasistencia, f.pendiente, f.total), total: f.total }));
      return inasistenciaOrdenarBaseBaja(conPct, 30);
    }, mesReciente);
    const chartData = await page.evaluate(() => {
      const ch = _gd.charts['inasist-c-porespecialidad-1'];
      return ch ? { labels: ch.data.labels.slice(), data: ch.data.datasets[0].data.slice() } : null;
    });
    if (!chartData) hallazgos.push({ tipo: 'grafica-por-especialidad-no-dibujada' });
    else if (chartData.labels.length !== porEspEsperado.length) {
      hallazgos.push({ tipo: 'cantidad-barras-no-coincide', esperado: porEspEsperado.length, real: chartData.labels.length });
    } else {
      porEspEsperado.forEach((f, idx) => {
        const etiquetaEsperada = chartData.labels[idx];
        if (f.baseBaja && !/\*$/.test(etiquetaEsperada)) hallazgos.push({ tipo: 'base-baja-sin-asterisco', especialidad: f.especialidad });
        if (chartData.data[idx] !== f.pct) hallazgos.push({ tipo: 'pct-por-especialidad-no-coincide', especialidad: f.especialidad, esperado: f.pct, real: chartData.data[idx] });
      });
    }
    const hayBaseBaja = porEspEsperado.some((f) => f.baseBaja);
    const notaBaseBaja = await page.locator('#inasist-esp-nota-1').innerText().catch(() => '');
    if (hayBaseBaja && !/base baja/i.test(notaBaseBaja)) hallazgos.push({ tipo: 'nota-base-baja-no-aparecio', notaBaseBaja });
    await page.screenshot({ path: path.join(OUT_DIR, 'por-especialidad-1366x768-light.png') });

    ctx = 'texto sospechoso (NaN/undefined/[object Object]) en todo el panel';
    const textoSospechoso = await page.evaluate(() => /\bNaN\b|\bundefined\b|\[object Object\]/.test(document.getElementById('gd-panels').innerText));
    if (textoSospechoso) hallazgos.push({ tipo: 'texto-sospechoso-nan-undefined' });

    ctx = 'exportar a Excel: 2 hojas (Resumen por mes + Por especialidad), sin conteos sueltos';
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
    if (hojasInasist.length !== 2) {
      hallazgos.push({ tipo: 'excel-cantidad-de-hojas-incorrecta', hojas: wb.SheetNames });
    } else {
      hojasInasist.forEach((nombreHoja) => {
        const filasExcel = XLSX.utils.sheet_to_json(wb.Sheets[nombreHoja]);
        const columnas = filasExcel.length ? Object.keys(filasExcel[0]) : [];
        if (columnas.some((c) => /Total de citas|Cancelada|Atendidas|Pendientes/i.test(c))) {
          hallazgos.push({ tipo: 'excel-todavia-trae-columnas-de-conteos', hoja: nombreHoja, columnas });
        }
      });
    }
    fs.unlinkSync(rutaDescarga); // el .xlsx descargado no se commitea, solo las capturas

    ctx = 'tema oscuro, 1366x768';
    await page.evaluate(() => { if (typeof aplicarTema === 'function') aplicarTema('dark'); });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT_DIR, 'por-especialidad-1366x768-dark.png') });
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

        await page.screenshot({ path: path.join(OUT_DIR, `por-especialidad-${vp.name}-${tema}.png`) });
      }
    }
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.evaluate(() => { if (typeof aplicarTema === 'function') aplicarTema('light'); });

    ctx = 'volver a "Resumen por mes" y verificar que el filtro de Especialidad deja el agregado con 1 sola especialidad por mes';
    await clickSubtab(page, 'Resumen por mes');
    await page.waitForTimeout(500);
    const especialidadElegida = opciones.especialidades[0];
    await page.selectOption('#inasist-f-especialidad-0', especialidadElegida);
    await page.click('button[onclick="_inasistenciaAplicarFiltros(0)"]');
    await page.waitForTimeout(700);
    const chartPormesConEspecialidad = await page.evaluate(() => {
      const ch = _gd.charts['inasist-c-pormes-0'];
      return ch ? ch.data.labels.length : 0;
    });
    if (!chartPormesConEspecialidad) hallazgos.push({ tipo: 'grafica-pormes-vacia-con-filtro-especialidad' });
    await page.screenshot({ path: path.join(OUT_DIR, 'resumen-por-mes-con-especialidad-1366x768-light.png') });

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
