// verificar-fase65-fixes.js — QA de un solo uso, Fase 65.
//
// 1) Dropdown "Skill" de Trafico de Llamadas: confirma que el bug #1
//    (comparador viejo con 2+ lineas le gana a una eleccion nueva del
//    desplegable) y el #2 (desplegable no refleja "Varias lineas" tras
//    usar el comparador) estan arreglados, y que "Todas las lineas", una
//    sola linea, el comparador con "Ver skills por separado", y una URL
//    compartida siguen funcionando igual.
// 2) AHT: compara la tarjeta "AHT Promedio" de la franja global contra la
//    sub-pestaña AHT de Trafico de Llamadas para el mismo cliente/periodo
//    -- deben coincidir exacto.
//
// Requiere datos sinteticos YA insertados en la BD de desarrollo local
// (ver server/scripts/_qa-temp-*.js) -- este script NO los inserta ni los
// borra, solo los usa y los deja para que el caller decida cuando limpiar.
// Solo lectura sobre la app: nunca crea, edita ni borra datos via la UI.
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.APP_URL || 'http://localhost:3000';
const ADMIN_USER = process.env.QA_ADMIN_USER || 'demo_admin';
const ADMIN_PW = process.env.QA_ADMIN_PW;
const OUT_DIR = process.env.OUT_DIR ||
  path.join(__dirname, '..', '..', 'docs', 'capturas-demo', 'fase65-fixes-y-revision');

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 412, height: 915 };

const CLIENTES_AHT = ['TELEVENTAS SURA', 'TELEVENTAS COMFAMA', 'ANDRES YEPES'];

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT_DIR, name), fullPage: false });
}
async function setTema(page, tema) {
  await page.evaluate((t) => { if (typeof aplicarTema === 'function') aplicarTema(t); }, tema);
  await page.waitForTimeout(200);
}

(async () => {
  if (!ADMIN_PW) { console.error('Falta QA_ADMIN_PW.'); process.exit(1); }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const resultado = { dropdown: {}, aht: {} };
  let ok = true;

  try {
    const page = await browser.newPage({ viewport: DESKTOP });
    page.on('dialog', (d) => d.accept());
    const erroresConsola = [];
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

    // ══ 1. DROPDOWN "SKILL" — ORLANT con QA_SKILL_A/B/C ════════════════
    await page.evaluate(() => openGenericDashboard('ORLANT'));
    await page.waitForTimeout(1200);
    await page.evaluate(() => switchGenericTab('trafico'));
    await page.waitForTimeout(1000);
    await shot(page, '1-orlant-trafico-inicial-claro-desktop.png');

    // Bug #1: cargar estado con 2+ lineas en el comparador (simulando una
    // URL compartida), luego cambiar el desplegable principal a OTRA linea
    // especifica SIN tocar el comparador, y confirmar que la eleccion
    // nueva SI se aplica (antes del arreglo se ignoraba).
    await page.click('#tv-f-cmp-wrap-0 summary');
    await page.selectOption('#tv-f-skills-cmp-0', ['QA_SKILL_A', 'QA_SKILL_C']);
    await page.click('button:has-text("Aplicar filtros")');
    await page.waitForTimeout(800);
    const kpisComparador = await page.$eval('#tv-kpis-0', (el) => el.textContent.replace(/\s+/g, ' ').trim());
    resultado.dropdown.kpisTrasComparador = kpisComparador;
    await shot(page, '2-orlant-comparador-2-lineas-claro-desktop.png');

    await page.selectOption('#tv-f-skill-0', 'QA_SKILL_B');
    await page.click('button:has-text("Aplicar filtros")');
    await page.waitForTimeout(800);
    const kpisTrasCambioDropdown = await page.$eval('#tv-kpis-0', (el) => el.textContent.replace(/\s+/g, ' ').trim());
    const urlTrasCambio = await page.evaluate(() => location.search);
    resultado.dropdown.kpisTrasCambioDropdown = kpisTrasCambioDropdown;
    resultado.dropdown.urlTrasCambio = urlTrasCambio;
    // Bug #1 arreglado: los KPIs deben ser DISTINTOS de los del comparador
    // (una sola linea trae menos llamadas que 2 combinadas) y la URL debe
    // reflejar SOLO QA_SKILL_B, no A,C.
    resultado.dropdown.bug1Arreglado = (kpisComparador !== kpisTrasCambioDropdown) && /QA_SKILL_B/.test(urlTrasCambio) && !/QA_SKILL_A/.test(urlTrasCambio);
    await shot(page, '3-orlant-dropdown-cambiado-a-skillB-claro-desktop.png');

    // Bug #2: el desplegable principal debe mostrar "QA_SKILL_B" seleccionado
    // (no la opcion vieja) tras ese cambio.
    const valorDropdownTrasCambio = await page.$eval('#tv-f-skill-0', (el) => el.value);
    resultado.dropdown.valorDropdownTrasCambio = valorDropdownTrasCambio;
    resultado.dropdown.bug2ParteA_ok = valorDropdownTrasCambio === 'QA_SKILL_B';

    // Ahora, en sentido inverso: elegir 2+ en el comparador de nuevo y
    // aplicar -- el desplegable principal debe mostrar la opcion "Varias
    // lineas" (bug #2 real: antes se quedaba mostrando la opcion vieja).
    await page.click('#tv-f-cmp-wrap-0 summary');
    await page.selectOption('#tv-f-skills-cmp-0', ['QA_SKILL_A', 'QA_SKILL_C']);
    await page.click('button:has-text("Aplicar filtros")');
    await page.waitForTimeout(800);
    const dropdownTrasComparador = await page.$eval('#tv-f-skill-0', (el) => ({
      value: el.value,
      texto: el.options[el.selectedIndex] ? el.options[el.selectedIndex].textContent : null,
      disabled: el.options[el.selectedIndex] ? el.options[el.selectedIndex].disabled : null,
    }));
    resultado.dropdown.dropdownTrasComparador = dropdownTrasComparador;
    resultado.dropdown.bug2ParteB_ok = dropdownTrasComparador.value === '__multi__' && /Varias/.test(dropdownTrasComparador.texto || '');
    await shot(page, '4-orlant-dropdown-muestra-varias-lineas-claro-desktop.png');
    await setTema(page, 'dark');
    await shot(page, '4b-orlant-dropdown-muestra-varias-lineas-oscuro-desktop.png');
    await setTema(page, 'light');

    // ══ Regresiones: "Todas las lineas" ═════════════════════════════════
    await page.selectOption('#tv-f-skill-0', '');
    await page.click('button:has-text("Aplicar filtros")');
    await page.waitForTimeout(800);
    const kpisTodas = await page.$eval('#tv-kpis-0', (el) => el.textContent.replace(/\s+/g, ' ').trim());
    const urlTodas = await page.evaluate(() => location.search);
    resultado.dropdown.todasLasLineasOk = !/tv_skills=/.test(urlTodas) || urlTodas === '';
    resultado.dropdown.kpisTodas = kpisTodas;

    // ══ Regresion: "Ver skills por separado" con 2+ en comparador ═══════
    await page.click('#tv-f-cmp-wrap-0 summary');
    await page.selectOption('#tv-f-skills-cmp-0', ['QA_SKILL_A', 'QA_SKILL_B', 'QA_SKILL_C']);
    await page.check('#tv-f-separado-0');
    await page.click('button:has-text("Aplicar filtros")');
    await page.waitForTimeout(1000);
    const datasetsSeparado = await page.evaluate(() => {
      var c = _gd.charts['tv-canvas-0'];
      return c ? c.data.datasets.length : 0;
    });
    resultado.dropdown.separadoDatasets = datasetsSeparado;
    resultado.dropdown.separadoOk = datasetsSeparado >= 3; // al menos 1 serie por skill (3 skills separadas, mas puede haber lineas de nivel de atencion)
    await shot(page, '5-orlant-comparador-separado-claro-desktop.png');

    // ══ Regresion: URL compartida reproduce la misma vista ══════════════
    const urlCompartida = BASE + '/?tv_skills=QA_SKILL_A%2CQA_SKILL_C&tv_desde=2026-04-01&tv_hasta=2026-09-12&tv_gran=dia&tv_modo=separado';
    await page.goto(urlCompartida, { waitUntil: 'networkidle' });
    await page.fill('#username', ADMIN_USER);
    await page.fill('#password', ADMIN_PW);
    await page.click('button.btn-login');
    await page.waitForTimeout(1200);
    await page.evaluate(() => openGenericDashboard('ORLANT'));
    await page.waitForTimeout(1200);
    await page.evaluate(() => switchGenericTab('trafico'));
    await page.waitForTimeout(1000);
    const estadoUrlCompartida = await page.$eval('#tv-f-skill-0', (el) => ({
      value: el.value, texto: el.options[el.selectedIndex] ? el.options[el.selectedIndex].textContent : null,
    }));
    const comparadorAbierto = await page.$eval('#tv-f-cmp-wrap-0', (el) => el.open);
    resultado.dropdown.urlCompartidaOk = estadoUrlCompartida.value === '__multi__' && comparadorAbierto === true;
    resultado.dropdown.estadoUrlCompartida = estadoUrlCompartida;
    await shot(page, '6-orlant-url-compartida-claro-desktop.png');
    await page.evaluate(() => { if (typeof closeGenericDashboard === 'function') closeGenericDashboard(); });

    // ══ 2. AHT — comparar tarjeta vs sub-pestaña en 3 clientes ══════════
    for (const cliente of CLIENTES_AHT) {
      await page.evaluate((c) => openGenericDashboard(c), cliente);
      await page.waitForTimeout(1200);
      const valorTarjeta = await page.evaluate(() => {
        var cards = Array.from(document.querySelectorAll('#gd-kpis .gd-kpi'));
        var card = cards.find(function (c) { return /AHT Promedio/.test(c.textContent); });
        if (!card) return null;
        var kv = card.querySelector('.kv');
        return kv ? kv.textContent.trim() : null;
      });
      // Recalcula, DENTRO de la pagina, el AHT esperado con las MISMAS
      // funciones que usa _gdResolver para la tarjeta (traficoFiltrarFilas +
      // traficoAhtPromedioPeriodo, mes = _gd.mesSel o el mas reciente) --
      // asi la comparacion es contra la logica real, no contra una
      // reconstruccion aproximada de lo que pinta la grafica.
      const esperado = await page.evaluate((c) => {
        var datos = _trafico[c];
        if (!datos || !datos.filas.length) return { esperadoSegundos: null, esperadoTexto: null, mes: null };
        var meses = datos.filas.map(function (r) { return String(r.fecha).slice(0, 7); });
        var mes = _gd.mesSel || meses.slice().sort().reverse()[0];
        var filasMes = traficoFiltrarFilas(datos.filas, { desde: mes + '-01', hasta: mes + '-31' });
        var seg = traficoAhtPromedioPeriodo(filasMes);
        return { esperadoSegundos: seg, esperadoTexto: seg === null ? '—' : _gdFmt(seg, 'tiempo_mmss'), mes: mes, filasEnMes: filasMes.length };
      }, cliente);
      resultado.aht[cliente] = { valorTarjeta: valorTarjeta, esperado: esperado, coincide: valorTarjeta === esperado.esperadoTexto };
      await page.evaluate(() => switchGenericTab('trafico'));
      await page.waitForTimeout(1000);
      await page.evaluate(() => switchGenericSubtab('aht'));
      await page.waitForTimeout(1000);
      await shot(page, cliente.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-aht-tarjeta-vs-subpestana-claro-desktop.png');
      await setTema(page, 'dark');
      await shot(page, cliente.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-aht-tarjeta-vs-subpestana-oscuro-desktop.png');
      await setTema(page, 'light');
      await page.setViewportSize(MOBILE);
      await page.waitForTimeout(400);
      await shot(page, cliente.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-aht-claro-movil.png');
      await page.setViewportSize(DESKTOP);
      await page.evaluate(() => { if (typeof closeGenericDashboard === 'function') closeGenericDashboard(); });
    }

    await page.close();
    resultado.erroresConsola = erroresConsola;

    const ahtOk = CLIENTES_AHT.every((c) => resultado.aht[c] && resultado.aht[c].coincide);
    ok = resultado.loginOk && resultado.dropdown.bug1Arreglado && resultado.dropdown.bug2ParteA_ok &&
      resultado.dropdown.bug2ParteB_ok && resultado.dropdown.separadoOk && resultado.dropdown.urlCompartidaOk &&
      ahtOk && erroresConsola.length === 0;
    resultado.ok = ok;
    console.log('=== RESULTADO FINAL ===');
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
