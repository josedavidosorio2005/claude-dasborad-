// verificar-filtros-colores-produccion.js — QA de un solo uso, invocado por
// .github/workflows/verificar-filtros-colores-produccion.yml.
//
// Verifica contra PRODUCCION real (2026-09-16) las 3 cosas del pedido
// "Boton Previsualizar dashboard + mejorar filtros y colores":
//   1. El boton "Previsualizar" del listado de Dashboards de Cliente abre el
//      dashboard REAL (con datos reales) de al menos 2 campanas, y que un
//      AUX_ADMIN no ve ese boton (ni la seccion) en absoluto.
//   2. El filtro de categorias (pie/bar de Gestion de base) funciona y el
//      color de una categoria es estable entre dos aperturas del dashboard.
//   3. El filtro de asesor/fecha de Calidad funciona contra datos REALES ya
//      existentes en produccion (ORLANT) — de solo lectura, nunca escribe
//      ni borra nada de esas filas reales.
//
// Para probar el filtro de categorias/fechas de Gestion de base con datos
// que este script controla (sin tocar los reales de ORLANT), sube una
// carga de prueba a ALBERTO LINERO GO (calidad:false — "solo Gestion de
// base", el segundo set de datos distinto que pide la verificacion) con el
// periodo 2027-06, por el flujo real (plantilla consolidada, UI real). La
// borra al final, identificada sin ambiguedad por (cliente, periodo).
//
// Usuarios TEMPORALES (creados y borrados por el workflow, directo en la
// base de datos — nunca via la API):
//   - uno rol ADMIN: el boton Previsualizar y la pantalla de configuracion
//     de dashboards son isFullAdmin-only (ADMIN o master), AUX_ADMIN no
//     alcanza — se necesita este rol para probar el punto 1.
//   - uno rol AUX_ADMIN: para confirmar que NO ve el boton/la seccion.
// Las contrasenas llegan por variables de entorno ya enmascaradas
// (`::add-mask::`) — este script jamas las imprime.
'use strict';
const { chromium } = require('playwright');
const XLSX = require('xlsx');
const path = require('path');
const os = require('os');

const BASE = process.env.PROD_URL || 'https://inconexionpruebasclaude.duckdns.org';
const ADMIN_USER = process.env.TEMP_ADMIN_USER;
const ADMIN_PW = process.env.TEMP_ADMIN_PW;
const AUX_USER = process.env.TEMP_AUX_USER;
const AUX_PW = process.env.TEMP_AUX_PW;
const TMP = os.tmpdir();
const ARTIFACTS_DIR = process.env.ARTIFACTS_DIR || TMP;
const PERIODO_PRUEBA = '2027-06';

async function login(page, user, pw) {
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.fill('#username', user);
  await page.fill('#password', pw);
  await page.click('button.btn-login');
  await page.waitForTimeout(1200);
  const err = await page.locator('#login-error').innerText().catch(() => '');
  if (err && err.trim()) throw new Error('Login de "' + user + '" fallo: ' + err.trim());
}

(async () => {
  if (!ADMIN_USER || !ADMIN_PW || !AUX_USER || !AUX_PW) {
    console.error('Faltan TEMP_ADMIN_USER/TEMP_ADMIN_PW/TEMP_AUX_USER/TEMP_AUX_PW en el entorno.');
    process.exit(1);
  }

  const browser = await chromium.launch();
  const resultado = {};
  let ok = true;

  try {
    // ══ 1a. AUX_ADMIN no ve "Dashboards" en absoluto ══════════════════
    const pageAux = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    pageAux.on('dialog', (d) => d.accept());
    await login(pageAux, AUX_USER, AUX_PW);
    resultado.auxLoginOk = true;
    resultado.auxMenuDashboardsHidden = await pageAux
      .locator('#menu-dashboards-li')
      .evaluate((el) => el.classList.contains('hidden'));
    const auxDashboardsConfig = await pageAux.evaluate(async () => {
      try { await apiRequest('GET', '/dashboards/config'); return 'NO_DEBERIA_LLEGAR'; }
      catch (e) { return e.message; }
    });
    resultado.auxApiBloqueada = /solo el administrador/i.test(auxDashboardsConfig);
    await pageAux.close();

    // ══ 1b. ADMIN temporal: boton Previsualizar abre el dashboard REAL ══
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('dialog', (d) => d.accept());
    await login(page, ADMIN_USER, ADMIN_PW);
    resultado.adminLoginOk = true;

    await page.evaluate(() => { if (typeof showSection === 'function') showSection('dashboards'); });
    await page.waitForTimeout(800);
    resultado.previewBtnVisibleEnListado = await page
      .locator('button[data-dcaction="preview"]')
      .first()
      .isVisible()
      .catch(() => false);

    async function previsualizarYLeer(cliente) {
      const btn = page.locator('button[data-dcaction="preview"][data-cliente="' + cliente + '"]');
      await btn.click();
      await page.waitForTimeout(1200);
      const sub = await page.locator('#gd-sub').innerText().catch(() => '');
      const kpisLen = await page.locator('#gd-kpis').evaluate((el) => el.innerHTML.length).catch(() => 0);
      return { sub, kpisLen };
    }
    const prevOrlant = await previsualizarYLeer('ORLANT');
    resultado.previewOrlant = prevOrlant;
    resultado.previewOrlantOk = prevOrlant.sub.includes('ORLANT') && prevOrlant.kpisLen > 100;
    await page.evaluate(() => { if (typeof closeGenericDashboard === 'function') closeGenericDashboard(); });

    const prevAlg = await previsualizarYLeer('ALBERTO LINERO GO');
    resultado.previewAlg = prevAlg;
    resultado.previewAlgOk = prevAlg.sub.includes('ALBERTO LINERO GO') && prevAlg.kpisLen > 100;
    await page.evaluate(() => { if (typeof closeGenericDashboard === 'function') closeGenericDashboard(); });

    // ══ 2. Subir carga de prueba a ALBERTO LINERO GO (periodo 2027-06) ══
    // resumen: valida (sin columnas de porcentaje en esta plantilla).
    // tipificacion: 3 categorias distintas -> prueba el filtro de categorias.
    // diario: 3 dias distintos -> prueba el filtro Desde/Hasta.
    await page.evaluate(() => { if (typeof openCargas === 'function') return openCargas(); });
    await page.waitForTimeout(800);
    await page.selectOption('#carga-cliente', 'ALBERTO LINERO GO');
    await page.waitForTimeout(500);
    const [dlAlg] = await Promise.all([
      page.waitForEvent('download', { timeout: 15000 }),
      page.click('button[onclick="descargarPlantillaConsolidada()"]'),
    ]);
    const algPath = path.join(TMP, 'plantilla_ALBERTO_LINERO_GO_filtros.xlsx');
    await dlAlg.saveAs(algPath);

    const wb = XLSX.readFile(algPath);
    const wsResumen = wb.Sheets['resumen'];
    const rangeResumen = XLSX.utils.decode_range(wsResumen['!ref']);
    for (let r = rangeResumen.s.r + 1; r <= rangeResumen.e.r; r++) {
      wsResumen[XLSX.utils.encode_cell({ r, c: 1 })] = { t: 'n', v: 77 };
    }
    const TIPIFS = ['QA Objecion precio', 'QA No contesta', 'QA Interesado'];
    wb.Sheets['tipificacion'] = XLSX.utils.aoa_to_sheet(
      [['Tipificacion', 'Cantidad']].concat(TIPIFS.map((t, idx) => [t, (idx + 1) * 10]))
    );
    const DIAS = ['2027-06-01', '2027-06-15', '2027-06-30'];
    wb.Sheets['diario'] = XLSX.utils.aoa_to_sheet(
      [['Fecha (AAAA-MM-DD)', 'Gestionados', 'Contactados', 'Ventas']].concat(
        DIAS.map((f, idx) => [f, 10 + idx, 5 + idx, 1 + idx])
      )
    );
    const algFilledPath = path.join(TMP, 'plantilla_ALBERTO_LINERO_GO_filtros_llena.xlsx');
    XLSX.writeFile(wb, algFilledPath);

    await page.fill('#carga-periodo', PERIODO_PRUEBA);
    await page.setInputFiles('#carga-file', algFilledPath);
    await page.waitForTimeout(800);
    await page.evaluate(() => guardarCarga());
    await page.waitForTimeout(1200);
    resultado.cargaPruebaToast = (await page.locator('#toast').innerText().catch(() => '')).trim();
    resultado.cargaPruebaOk = !resultado.cargaPruebaToast.includes('✗');
    await page.evaluate(() => { if (typeof closeCargas === 'function') closeCargas(); });

    // ══ 2a. Filtro de categorias (Tipificacion) + color estable entre 2 aperturas ══
    await page.evaluate(() => openGenericDashboard('ALBERTO LINERO GO'));
    await page.waitForTimeout(1200);
    await page.evaluate(() => switchGenericTab('tipificacion'));
    await page.waitForTimeout(500);
    const catInfo1 = await page.evaluate(() => {
      var sel = document.getElementById('gd-catf-0');
      var chart = _gd.charts['gd-c0'];
      return {
        opciones: sel ? Array.from(sel.options).map((o) => o.value) : [],
        colores: chart ? chart.data.datasets[0].backgroundColor.slice() : [],
        labels: chart ? chart.data.labels.slice() : [],
      };
    });
    resultado.categoriasDisponibles = catInfo1.opciones;
    resultado.categoriasFiltroDisponibleOk = TIPIFS.every((t) => catInfo1.opciones.includes(t));
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, '1-alg-tipificacion-sin-filtrar.png') });

    // Narrows a solo 2 de las 3 categorias.
    await page.evaluate((tipifs) => {
      var sel = document.getElementById('gd-catf-0');
      Array.from(sel.options).forEach((o) => { o.selected = tipifs.includes(o.value); });
      _gdAplicarFiltroPanel(0);
    }, [TIPIFS[0], TIPIFS[2]]);
    await page.waitForTimeout(500);
    const catFiltrado = await page.evaluate(() => {
      var chart = _gd.charts['gd-c0'];
      return { labels: chart.data.labels.slice(), colores: chart.data.datasets[0].backgroundColor.slice() };
    });
    resultado.categoriaFiltroFuncionaOk =
      catFiltrado.labels.length === 2 &&
      catFiltrado.labels.includes(TIPIFS[0]) &&
      catFiltrado.labels.includes(TIPIFS[2]) &&
      !catFiltrado.labels.includes(TIPIFS[1]);
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, '2-alg-tipificacion-filtrada.png') });

    // Color estable: reabre el dashboard (simula una recarga real) y
    // confirma que las mismas 3 categorias (sin filtro) mantienen el mismo
    // color que en la primera apertura.
    await page.evaluate(() => closeGenericDashboard());
    await page.evaluate(() => openGenericDashboard('ALBERTO LINERO GO'));
    await page.waitForTimeout(1200);
    await page.evaluate(() => switchGenericTab('tipificacion'));
    await page.waitForTimeout(500);
    const catInfo2 = await page.evaluate(() => {
      var chart = _gd.charts['gd-c0'];
      return { labels: chart.data.labels.slice(), colores: chart.data.datasets[0].backgroundColor.slice() };
    });
    const colorPorLabel1 = {};
    catInfo1.labels.forEach((l, idx) => { colorPorLabel1[l] = catInfo1.colores[idx]; });
    resultado.colorEstableEntreAperturasOk = catInfo2.labels.every((l, idx) => colorPorLabel1[l] === catInfo2.colores[idx]);
    resultado.coloresAntes = catInfo1;
    resultado.coloresDespues = catInfo2;

    // ══ 2b. Filtro Desde/Hasta (linea diaria "Gestionados por dia") ══
    await page.evaluate(() => switchGenericTab('flujo'));
    await page.waitForTimeout(500);
    const fechaInfo1 = await page.evaluate(() => {
      var chart = _gd.charts['gd-c0'];
      return { labels: chart ? chart.data.labels.slice() : [] };
    });
    resultado.fechaFiltroDisponibleOk = fechaInfo1.labels.length === 3; // 3 dias subidos
    await page.evaluate(() => {
      document.getElementById('gd-fechaf-desde-0').value = '2027-06-10';
      document.getElementById('gd-fechaf-hasta-0').value = '2027-06-30';
      _gdAplicarFiltroPanel(0);
    });
    await page.waitForTimeout(500);
    const fechaInfo2 = await page.evaluate(() => {
      var chart = _gd.charts['gd-c0'];
      return { labels: chart.data.labels.slice() };
    });
    resultado.fechaFiltroFuncionaOk = fechaInfo2.labels.length === 2; // solo 15/6 y 30/6
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, '3-alg-fecha-filtrada.png') });
    await page.evaluate(() => closeGenericDashboard());

    // ══ 3. Filtro de asesor de Calidad, sobre datos REALES de ORLANT (solo lectura) ══
    await page.evaluate(() => openGenericDashboard('ORLANT'));
    await page.waitForTimeout(1200);
    await page.evaluate(() => switchGenericTab('calidad'));
    await page.waitForTimeout(600);
    const calAntes = await page.evaluate(() => {
      var sel = document.querySelector('[id^="cd-f-asesor-"]');
      return {
        asesores: sel ? Array.from(sel.options).map((o) => o.value) : [],
        monitoreos: document.querySelector('#gd-p0 .kv') ? document.querySelector('#gd-p0 .kv').textContent : null,
      };
    });
    resultado.calAsesoresDisponibles = calAntes.asesores;
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, '4-orlant-calidad-sin-filtrar.png') });
    if (calAntes.asesores.length) {
      const primerAsesor = calAntes.asesores[0];
      await page.evaluate((asesor) => {
        var sel = document.querySelector('[id^="cd-f-asesor-"]');
        var i = sel.id.split('-').pop();
        Array.from(sel.options).forEach((o) => { o.selected = o.value === asesor; });
        _calDashAplicarFiltros('ORLANT', Number(i));
      }, primerAsesor);
      await page.waitForTimeout(600);
      const calDespues = await page.evaluate(() => {
        return document.querySelector('#gd-p0 .kv') ? document.querySelector('#gd-p0 .kv').textContent : null;
      });
      resultado.calFiltroAsesorFuncionaOk = calDespues !== null && calDespues !== calAntes.monitoreos;
      resultado.calMonitoreosAntes = calAntes.monitoreos;
      resultado.calMonitoreosDespues = calDespues;
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, '5-orlant-calidad-filtrada.png') });
    } else {
      resultado.calFiltroAsesorFuncionaOk = false;
      resultado.calAvisoSinAsesores = 'ORLANT no tiene asesores reales en Calidad ahora mismo — no se pudo probar el filtro.';
    }
    await page.evaluate(() => closeGenericDashboard());

    ok =
      resultado.auxLoginOk &&
      resultado.auxMenuDashboardsHidden &&
      resultado.auxApiBloqueada &&
      resultado.adminLoginOk &&
      resultado.previewBtnVisibleEnListado &&
      resultado.previewOrlantOk &&
      resultado.previewAlgOk &&
      resultado.cargaPruebaOk &&
      resultado.categoriasFiltroDisponibleOk &&
      resultado.categoriaFiltroFuncionaOk &&
      resultado.colorEstableEntreAperturasOk &&
      resultado.fechaFiltroDisponibleOk &&
      resultado.fechaFiltroFuncionaOk &&
      resultado.calFiltroAsesorFuncionaOk;

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
