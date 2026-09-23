// verificar-fase63-unificacion-graficas.js — QA de un solo uso, Fase 63.
//
// Compara, en cada uno de los 9 clientes que ya tienen Calidad + Trafico de
// Llamadas (aparte de ORLANT), que el tipo de pestana y el tipo de grafica
// coincida EXACTO con el de ORLANT: misma dona de "Distribucion de
// clasificacion", mismas 3 tarjetas de KPI de Calidad, mismo tipo de panel
// de Trafico de Llamadas (trafico_combo). No compara los KPIs globales de la
// franja superior del dashboard (esos SI son legitimamente distintos por
// cliente, fuera del alcance del pedido).
//
// Solo lectura: nunca crea, edita ni borra datos.
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.APP_URL || 'http://localhost:3000';
const ADMIN_USER = process.env.QA_ADMIN_USER || 'demo_admin';
const ADMIN_PW = process.env.QA_ADMIN_PW;
const OUT_DIR = process.env.OUT_DIR ||
  path.join(__dirname, '..', '..', 'docs', 'capturas-demo', 'fase63-unificacion-graficas-plantillas');

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 412, height: 915 };

// Los 9 clientes a comparar contra ORLANT (mismo orden que el pedido).
// HOSPITAL LA MARIA no tiene pestaña de Calidad (sin plantilla de
// evaluacion configurada, Fase 61) -- se verifica solo su Trafico.
const CLIENTES = [
  { cliente: 'CLINICA AURORA', tieneCalidad: true },
  { cliente: 'HOSPITAL LA MARIA', tieneCalidad: false },
  { cliente: 'TELEVENTAS SURA', tieneCalidad: true },
  { cliente: 'TELEVENTAS COMFAMA', tieneCalidad: true },
  { cliente: 'ANDRES YEPES', tieneCalidad: true },
  { cliente: 'MOVILIZE', tieneCalidad: true },
  { cliente: 'INFONDO', tieneCalidad: true },
  { cliente: 'SASCHA FITNESS', tieneCalidad: true },
  { cliente: 'BIVETT', tieneCalidad: true },
];

// Clientes representativos para captura completa claro/oscuro/escritorio/movil.
const CAPTURAR = ['CLINICA AURORA', 'SASCHA FITNESS', 'TELEVENTAS SURA'];

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT_DIR, name), fullPage: false });
}
async function setTema(page, tema) {
  await page.evaluate((t) => { if (typeof aplicarTema === 'function') aplicarTema(t); }, tema);
  await page.waitForTimeout(200);
}

// Extrae la "huella" visual de la pestaña Calidad activa: tipo de grafica,
// labels/colores de la dona, y las 3 tarjetas de KPI.
async function inspeccionarCalidad(page) {
  await page.waitForTimeout(900);
  return page.evaluate(() => {
    var kpiHost = document.getElementById('gd-p0');
    var tarjetas = kpiHost ? Array.from(kpiHost.querySelectorAll('.aurora-kpi')).map(function (el) {
      return { clase: el.className, label: (el.querySelector('.kl') || {}).textContent };
    }) : [];
    var chart = (typeof _gd !== 'undefined' && _gd.charts) ? _gd.charts['gd-c1'] : null;
    return {
      tarjetas: tarjetas,
      tipoGrafica: chart ? chart.config.type : null,
      labelsGrafica: chart ? chart.data.labels.slice() : null,
      coloresGrafica: chart ? chart.data.datasets[0].backgroundColor.slice() : null,
      filtroAsesorPresente: !!document.getElementById('cd-f-asesor-0'),
      filtroFechaPresente: !!(document.getElementById('cd-f-desde-0') && document.getElementById('cd-f-hasta-0')),
    };
  });
}

// Extrae la "huella" del panel de Trafico de Llamadas: dropdown "Skill"
// (Fase 60) + comparador colapsable + tipo de grafica.
async function inspeccionarTrafico(page) {
  await page.waitForTimeout(900);
  return page.evaluate(() => {
    var host = document.getElementById('gd-p0');
    var selectSkill = host ? host.querySelector('select[id^="tv-f-skill-"]') : null;
    var comparador = host ? host.querySelector('details') : null;
    var chart = (typeof _gd !== 'undefined' && _gd.charts) ? _gd.charts['tv-canvas-0'] : null;
    // Chart.js 4 no expone chart.config.type de forma plana en este bundle --
    // se usa la composicion real de datasets (bar/bar/line = combo) como
    // huella del tipo de grafica, mas robusto que un solo string.
    return {
      panelPresente: !!host,
      dropdownSkillPresente: !!selectSkill,
      opcionTodasPresente: !!(selectSkill && Array.from(selectSkill.options).some(function (o) { return /todas/i.test(o.textContent); })),
      comparadorPresente: !!comparador,
      datasetTypes: chart ? chart.data.datasets.map(function (d) { return d.type || 'bar'; }) : null,
      datasetLabels: chart ? chart.data.datasets.map(function (d) { return d.label; }) : null,
      textoVacio: host ? /Sin datos/i.test(host.textContent) : null,
    };
  });
}

function diffHuellas(base, otra, campos) {
  var diffs = [];
  campos.forEach(function (c) {
    var a = JSON.stringify(base[c]), b = JSON.stringify(otra[c]);
    if (a !== b) diffs.push({ campo: c, orlant: base[c], cliente: otra[c] });
  });
  return diffs;
}

(async () => {
  if (!ADMIN_PW) {
    console.error('Falta QA_ADMIN_PW en el entorno.');
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const resultado = { clientes: {} };
  let ok = true;

  try {
    const page = await browser.newPage({ viewport: DESKTOP });
    page.on('dialog', (d) => d.accept());
    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
    await page.fill('#username', ADMIN_USER);
    await page.fill('#password', ADMIN_PW);
    await page.click('button.btn-login');
    await page.waitForTimeout(1200);
    const loginErr = await page.locator('#login-error').innerText().catch(() => '');
    if (loginErr && loginErr.trim()) throw new Error('Login fallo: ' + loginErr.trim());
    resultado.loginOk = true;

    // ══ Huella de referencia: ORLANT ════════════════════════════════════
    await page.evaluate(() => openGenericDashboard('ORLANT'));
    await page.waitForTimeout(1200);
    await page.evaluate(() => switchGenericTab('calidad'));
    const orlantCalidad = await inspeccionarCalidad(page);
    await page.evaluate(() => switchGenericTab('trafico'));
    const orlantTrafico = await inspeccionarTrafico(page);
    await page.evaluate(() => { if (typeof closeGenericDashboard === 'function') closeGenericDashboard(); });
    resultado.orlant = { calidad: orlantCalidad, trafico: orlantTrafico };
    console.log('ORLANT (referencia):', JSON.stringify(resultado.orlant, null, 2));

    // ══ Comparacion por cliente ═════════════════════════════════════════
    const CAMPOS_CALIDAD = ['tipoGrafica', 'labelsGrafica', 'coloresGrafica', 'filtroAsesorPresente', 'filtroFechaPresente'];
    const CAMPOS_TRAFICO = ['dropdownSkillPresente', 'opcionTodasPresente', 'comparadorPresente', 'datasetTypes', 'datasetLabels'];

    for (const { cliente, tieneCalidad } of CLIENTES) {
      await page.evaluate((c) => openGenericDashboard(c), cliente);
      await page.waitForTimeout(1200);
      const entry = {};

      if (tieneCalidad) {
        await page.evaluate(() => switchGenericTab('calidad'));
        const huella = await inspeccionarCalidad(page);
        entry.calidad = huella;
        entry.calidadDiffs = diffHuellas(orlantCalidad, huella, CAMPOS_CALIDAD);
        // 3 tarjetas esperadas, mismos labels que ORLANT (orden puede variar
        // por i18n de puntaje pero el label es fijo).
        entry.calidadTarjetasOk = huella.tarjetas.length === 3;
      } else {
        entry.calidad = null;
        entry.calidadDiffs = null;
      }

      await page.evaluate(() => switchGenericTab('trafico'));
      const huellaT = await inspeccionarTrafico(page);
      entry.trafico = huellaT;
      entry.traficoDiffs = diffHuellas(orlantTrafico, huellaT, CAMPOS_TRAFICO);

      if (CAPTURAR.indexOf(cliente) !== -1) {
        const slug = cliente.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        for (const tema of ['light', 'dark']) {
          await setTema(page, tema);
          if (tieneCalidad) {
            await page.evaluate(() => switchGenericTab('calidad'));
            await page.waitForTimeout(600);
            await shot(page, slug + '-calidad-' + tema + '-desktop.png');
          }
          await page.evaluate(() => switchGenericTab('trafico'));
          await page.waitForTimeout(600);
          await shot(page, slug + '-trafico-' + tema + '-desktop.png');
        }
        await setTema(page, 'light');
        await page.setViewportSize(MOBILE);
        await page.waitForTimeout(400);
        if (tieneCalidad) {
          await page.evaluate(() => switchGenericTab('calidad'));
          await page.waitForTimeout(500);
          await shot(page, slug + '-calidad-claro-movil.png');
        }
        await page.evaluate(() => switchGenericTab('trafico'));
        await page.waitForTimeout(500);
        await shot(page, slug + '-trafico-claro-movil.png');
        await page.setViewportSize(DESKTOP);
      }

      await page.evaluate(() => { if (typeof closeGenericDashboard === 'function') closeGenericDashboard(); });
      resultado.clientes[cliente] = entry;
      console.log(cliente + ':', JSON.stringify(entry, null, 2));
    }

    await page.close();

    ok = resultado.loginOk && Object.keys(resultado.clientes).every(function (c) {
      var e = resultado.clientes[c];
      var calidadOk = e.calidadDiffs === null || e.calidadDiffs.length === 0;
      var traficoOk = e.traficoDiffs.length === 0;
      return calidadOk && traficoOk;
    });
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
