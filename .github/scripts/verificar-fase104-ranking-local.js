// verificar-fase104-ranking-local.js — QA de un solo uso, Fase 104 (ranking
// de agendamiento por asesor). Recorrido EN LOCAL (http://localhost:3000,
// con `npm run seed:demo`), Playwright directo desde Node (nunca la
// extension de Claude in Chrome, ver CLAUDE.md). Datos de AGENDAS
// SINTETICOS (30 asesores + 1 con variantes de escritura + 1 fila sin
// asesor, sep/oct de 2026) cargados por la API normal antes de correr este
// script (ver cargarDemoAgendas() mas abajo) -- nunca datos reales.
//
// Confirma: la sub-pestaña "Ranking de asesores" (tabla completa, orden por
// columna, buscador, "Sin asesor" al final, aviso de mes en curso,
// exportar a Excel con la misma suma que en pantalla) en 1366x768 y movil
// 412, claro/oscuro. Capturas en
// docs/capturas-demo/fase104-ranking-asesores/.
'use strict';
const path = require('path');
const fs = require('fs');
const http = require('http');

// Rutas absolutas de ESTA maquina (igual criterio que DIR_EDWIN en los
// scripts de verificacion en produccion): node_modules de playwright/xlsx
// viven en server/, no en la raiz del repo.
const SERVER_DIR = path.join(__dirname, '..', '..', 'server');
const { chromium } = require(path.join(SERVER_DIR, 'node_modules', 'playwright'));
const XLSX = require(path.join(SERVER_DIR, 'node_modules', 'xlsx'));
const CRED_FILE = path.join(SERVER_DIR, 'data', 'seed-demo-credenciales.txt');
const BASE = process.env.APP_URL || 'http://localhost:3000';
const OUT_DIR = path.join(SERVER_DIR, '..', 'docs', 'capturas-demo', 'fase104-ranking-asesores');
const HOY = new Date(); // para calcular "mes en curso" sin asumir una fecha fija
const MES_ACTUAL = HOY.getFullYear() + '-' + String(HOY.getMonth() + 1).padStart(2, '0');
function mesAnterior(mes) {
  const y = parseInt(mes.slice(0, 4), 10);
  const m = parseInt(mes.slice(5, 7), 10);
  const ant = m === 1 ? { y: y - 1, m: 12 } : { y, m: m - 1 };
  return ant.y + '-' + String(ant.m).padStart(2, '0');
}
const MES_COMPLETO = mesAnterior(MES_ACTUAL); // mes calendario anterior, YA terminado

function leerAdmin() {
  const texto = fs.readFileSync(CRED_FILE, 'utf8');
  const m = texto.match(/^ADMIN\tuser:\s*(\S+)\s+password:\s*(\S+)/m);
  return { user: m[1], password: m[2] };
}

function req(method, urlPath, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request(BASE + urlPath, {
      method,
      headers: Object.assign(
        { 'Content-Type': 'application/json' },
        data ? { 'Content-Length': Buffer.byteLength(data) } : {},
        token ? { Authorization: 'Bearer ' + token } : {}
      ),
    }, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => { let p; try { p = JSON.parse(d); } catch (e) { p = d; } resolve({ status: res.statusCode, body: p }); });
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

// Carga datos de AGENDAS sinteticos (via la API normal, nunca a mano en la
// base) para el mes COMPLETO anterior (variacion + suma estable) y el mes
// EN CURSO (aviso de "mes incompleto"). Idempotente a medias: si ya hay
// datos de una corrida anterior, simplemente se suman mas filas (no afecta
// la verificacion, que nunca depende de un total exacto salvo el que mide
// justo antes de verificarlo).
async function cargarDemoAgendas(token) {
  const ASESORES = []; for (let n = 1; n <= 30; n++) ASESORES.push('ASESOR DEMO ' + String(n).padStart(2, '0'));
  const SEDES = ['SEDE CENTRO', 'SEDE NORTE', 'SEDE SUR'];
  const EXAMENES = ['AUDIOMETRIA', 'OPTOMETRIA', 'ESPIROMETRIA'];
  const ESPECIALIDADES = ['AUDIOLOGIA', 'OPTOMETRIA', 'MEDICINA GENERAL'];
  const PROFESIONALES = ['DR PEREZ', 'DRA GOMEZ', 'DR RUIZ'];

  function filasMes(mes, diasDelMes, semillaBase) {
    const filas = [];
    let seed = semillaBase;
    function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
    ASESORES.forEach((asesor, idx) => {
      const nCitas = 2 + Math.floor(rnd() * 15);
      for (let k = 0; k < nCitas; k++) {
        const dia = 1 + Math.floor(rnd() * diasDelMes);
        const fecha = mes + '-' + String(dia).padStart(2, '0') + ' ' + String(8 + Math.floor(rnd() * 9)).padStart(2, '0') + ':00:00';
        const tipoLinea = rnd() < 0.4 ? '3P' : 'GENERAL';
        filas.push([
          idx === 0 ? [asesor, asesor.toLowerCase(), '  ' + asesor + '  '][k % 3] : asesor,
          SEDES[idx % SEDES.length], EXAMENES[idx % EXAMENES.length], ESPECIALIDADES[idx % ESPECIALIDADES.length],
          PROFESIONALES[idx % PROFESIONALES.length], fecha, tipoLinea, 'EPS DEMO',
        ]);
      }
    });
    filas.push(['SIN ASESOR', 'SEDE CENTRO', 'AUDIOMETRIA', 'AUDIOLOGIA', 'DR PEREZ', mes + '-05 09:00:00', 'GENERAL', 'EPS DEMO']);
    return filas;
  }

  const diasMesCompleto = new Date(parseInt(MES_COMPLETO.slice(0, 4), 10), parseInt(MES_COMPLETO.slice(5, 7), 10), 0).getDate();
  const diaHoy = HOY.getDate();
  const r1 = await req('POST', '/api/calidad/agendas/carga', { campana: 'ORLANT', filas: filasMes(MES_COMPLETO, diasMesCompleto, 7) }, token);
  const r2 = await req('POST', '/api/calidad/agendas/carga', { campana: 'ORLANT', filas: filasMes(MES_ACTUAL, diaHoy, 13) }, token);
  return { r1, r2 };
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const admin = leerAdmin();
  const hallazgos = [];
  const consola = [];
  let ctx = 'arranque';

  ctx = 'login API (para cargar datos sinteticos)';
  const login = await req('POST', '/api/auth/login', { user: admin.user, password: admin.password });
  if (login.status !== 200) { console.log('LOGIN API FALLO', login.status, login.body); process.exit(1); }
  await cargarDemoAgendas(login.body.token);
  const rankingApi = await req('GET', '/api/calidad/agendas/ranking?campana=ORLANT&mes=' + MES_COMPLETO, null, login.body.token);
  const totalEsperado = rankingApi.body.total;
  const filasEsperadas = rankingApi.body.filas.length;

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });
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

    ctx = 'click tab Agendamiento';
    const tabs = page.locator('#gd-tabs .atab');
    const nTabs = await tabs.count();
    let encontrado = false;
    for (let t = 0; t < nTabs; t++) {
      const txt = (await tabs.nth(t).textContent() || '').trim();
      if (/agendamiento/i.test(txt)) { await tabs.nth(t).click(); encontrado = true; break; }
    }
    if (!encontrado) hallazgos.push({ tipo: 'tab-agendamiento-no-encontrada' });
    await page.waitForTimeout(800);

    ctx = 'click sub-pestaña Ranking de asesores';
    const subBtn = page.locator('.gd-subtab-btn[data-gdsubtab="rankingasesores"]');
    if ((await subBtn.count()) === 0) hallazgos.push({ tipo: 'subtab-rankingasesores-no-encontrada' });
    else { await subBtn.click(); await page.waitForTimeout(900); }

    const panelInfo = await page.evaluate(() => {
      const sel = document.querySelector('select[id^="agendas-f-mes-"]');
      return sel ? { i: sel.id.replace('agendas-f-mes-', '') } : null;
    });
    if (!panelInfo) hallazgos.push({ tipo: 'panel-ranking-no-montado' });
    const i = panelInfo ? panelInfo.i : '3';

    ctx = 'filtrar mes completo (' + MES_COMPLETO + ', con variacion)';
    await page.selectOption('#agendas-f-mes-' + i, MES_COMPLETO);
    await page.locator('button[onclick*="_agendasAplicarFiltros"]').first().click();
    await page.waitForTimeout(900);

    ctx = 'verificar tabla (mes completo)';
    let filas = await page.locator('#agendas-ranking-tabla-' + i + ' tbody tr').count();
    if (filas < filasEsperadas) hallazgos.push({ tipo: 'tabla-pocas-filas', filas, filasEsperadas });
    const ultimaFila = await page.locator('#agendas-ranking-tabla-' + i + ' tbody tr').last().innerText();
    if (!/sin asesor/i.test(ultimaFila)) hallazgos.push({ tipo: 'sin-asesor-no-esta-al-final', ultimaFila });

    const sumaTotalUI = await page.evaluate((idx) => {
      const datos = window._agendasRankingDatos ? window._agendasRankingDatos[idx] : null;
      return datos ? datos.total : null;
    }, i);
    if (sumaTotalUI !== totalEsperado) hallazgos.push({ tipo: 'total-no-cuadra', esperado: totalEsperado, real: sumaTotalUI });

    await page.screenshot({ path: path.join(OUT_DIR, 'ranking-1366x768-light-mescompleto.png') });

    ctx = 'ordenar por columna (Asesor)';
    await page.locator('#agendas-ranking-tabla-' + i + ' thead th', { hasText: 'Asesor' }).click();
    await page.waitForTimeout(300);
    const primeraAsesorAsc = await page.locator('#agendas-ranking-tabla-' + i + ' tbody tr').first().innerText();
    await page.locator('#agendas-ranking-tabla-' + i + ' thead th', { hasText: 'Asesor' }).click();
    await page.waitForTimeout(300);
    const primeraAsesorDesc = await page.locator('#agendas-ranking-tabla-' + i + ' tbody tr').first().innerText();
    if (primeraAsesorAsc === primeraAsesorDesc) hallazgos.push({ tipo: 'ordenar-por-columna-no-cambio', primeraAsesorAsc, primeraAsesorDesc });
    await page.locator('#agendas-ranking-tabla-' + i + ' thead th', { hasText: 'Puesto' }).click();
    await page.waitForTimeout(300);

    ctx = 'buscador por nombre';
    await page.fill('#agendas-ranking-buscar-' + i, 'ASESOR DEMO 05');
    await page.waitForTimeout(300);
    filas = await page.locator('#agendas-ranking-tabla-' + i + ' tbody tr').count();
    if (filas !== 1) hallazgos.push({ tipo: 'buscador-no-filtro-a-1-fila', filas });
    await page.fill('#agendas-ranking-buscar-' + i, '');
    await page.waitForTimeout(300);

    ctx = 'mes en curso (' + MES_ACTUAL + ', hoy)';
    await page.selectOption('#agendas-f-mes-' + i, MES_ACTUAL);
    await page.locator('button[onclick*="_agendasAplicarFiltros"]').first().click();
    await page.waitForTimeout(900);
    const avisoTexto = await page.locator('#agendas-ranking-aviso-' + i).innerText().catch(() => '');
    if (!/en curso/i.test(avisoTexto)) hallazgos.push({ tipo: 'aviso-mes-en-curso-no-aparecio', avisoTexto });
    await page.screenshot({ path: path.join(OUT_DIR, 'ranking-1366x768-light-mesencurso-aviso.png') });

    await page.selectOption('#agendas-f-mes-' + i, MES_COMPLETO);
    await page.locator('button[onclick*="_agendasAplicarFiltros"]').first().click();
    await page.waitForTimeout(900);

    ctx = 'tema oscuro';
    await page.evaluate(() => { if (typeof aplicarTema === 'function') aplicarTema('dark'); });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT_DIR, 'ranking-1366x768-dark-mescompleto.png') });
    await page.evaluate(() => { if (typeof aplicarTema === 'function') aplicarTema('light'); });
    await page.waitForTimeout(300);

    ctx = 'movil 412';
    await page.setViewportSize({ width: 412, height: 915 });
    await page.waitForTimeout(500);
    const scrollHorizontalPagina = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
    if (scrollHorizontalPagina) hallazgos.push({ tipo: 'scroll-horizontal-pagina-movil' });
    await page.screenshot({ path: path.join(OUT_DIR, 'ranking-movil412-light-mescompleto.png') });
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.waitForTimeout(300);

    ctx = 'exportar a Excel';
    const [descarga] = await Promise.all([
      page.waitForEvent('download', { timeout: 10000 }),
      (async () => {
        await page.locator('#gd-export-btn').click();
        await page.waitForTimeout(250);
        await page.locator('#gd-export-menu button', { hasText: 'Excel' }).click();
      })(),
    ]);
    const rutaDescarga = path.join(OUT_DIR, 'export-ranking-verificacion.xlsx');
    await descarga.saveAs(rutaDescarga);
    const wb = XLSX.readFile(rutaDescarga);
    const hojaRanking = wb.SheetNames.find((n) => /ranking/i.test(n));
    if (!hojaRanking) {
      hallazgos.push({ tipo: 'excel-sin-hoja-ranking', hojas: wb.SheetNames });
    } else {
      const filasExcel = XLSX.utils.sheet_to_json(wb.Sheets[hojaRanking]);
      if (filasExcel.length !== filasEsperadas) hallazgos.push({ tipo: 'excel-filas-no-coinciden', esperado: filasEsperadas, real: filasExcel.length });
      const sumaTotalExcel = filasExcel.reduce((a, r) => a + (Number(r.Total) || 0), 0);
      if (sumaTotalExcel !== totalEsperado) hallazgos.push({ tipo: 'excel-suma-total-no-cuadra', esperado: totalEsperado, real: sumaTotalExcel });
    }
    fs.unlinkSync(rutaDescarga); // el .xlsx descargado no se commitea, solo las capturas

    console.log('=== CONSOLA (errores/requests fallidos) ===');
    console.log(JSON.stringify(consola, null, 2));
    console.log('=== HALLAZGOS ===');
    console.log(JSON.stringify(hallazgos, null, 2));
    console.log(hallazgos.length === 0 && consola.length === 0 ? 'OK: 0 hallazgos, 0 errores de consola.' : 'REVISAR hallazgos/consola arriba.');
  } catch (e) {
    console.log('EXCEPCION en ctx=', ctx, e.message);
  } finally {
    await browser.close();
  }
})();
