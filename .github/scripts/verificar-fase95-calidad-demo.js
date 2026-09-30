// verificar-fase95-calidad-demo.js — Fase 95. Verificacion visual EN LOCAL
// (http://localhost:3000, con npm run seed:demo) de los temas A/B/C de
// Calidad: fecha/evaluador bloqueados, catalogo de codificaciones
// (vacio -> texto libre, cargado -> desplegable), y la alerta de
// "monitoreo nuevo" al asesor (aparece, se puede ver, desaparece al
// verlo, otro asesor no ve nada).
//
// Playwright DIRECTO desde Node (regla fija del proyecto, CLAUDE.md) --
// NO la extension de Claude in Chrome. Solo datos de demo (seed-demo),
// nunca datos reales. Credenciales de demo, leidas de
// server/data/seed-demo-credenciales.txt (gitignored, nunca en el
// comando ni en el historial de shell).
//
// El catalogo de codificaciones de ORLANT solo se puede ver "vacio" UNA
// vez (la primera corrida lo carga y queda cargado); por eso ese paso
// solo se verifica en la corrida de escritorio -- la de movil reusa el
// catalogo ya cargado y solo confirma que el desplegable + la alerta al
// asesor tambien funcionan bien en ese tamano.
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.LOCAL_URL || 'http://localhost:3000';
const OUT_DIR = path.join(__dirname, '..', '..', 'docs', 'capturas-demo', 'fase95-calidad');
const CRED_FILE = path.join(__dirname, '..', '..', 'server', 'data', 'seed-demo-credenciales.txt');

function log(...args) { console.log(new Date().toISOString(), ...args); }

function leerCredenciales() {
  const texto = fs.readFileSync(CRED_FILE, 'utf8');
  const creds = {};
  texto.split('\n').forEach((linea) => {
    const m = linea.match(/^(\w+)\s+user:\s*(\S+)\s+password:\s*(\S+)/);
    if (m) creds[m[1]] = { user: m[2], password: m[3] };
  });
  return creds;
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT_DIR, name), fullPage: false });
}

async function login(page, user, password) {
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.fill('#username', user);
  await page.fill('#password', password);
  await page.click('.btn-login');
  await page.waitForFunction(() => typeof authToken !== 'undefined' && !!authToken, { timeout: 10000 });
  await page.waitForTimeout(600);
}

async function logout(page) {
  await page.evaluate(() => { if (typeof doLogout === 'function') doLogout(); });
  await page.waitForTimeout(300);
}

async function abrirCalidadOrlantNuevo(page) {
  await page.evaluate(() => openCalidad());
  await page.waitForTimeout(500);
  await page.selectOption('#cal-campana-sel', 'ORLANT');
  await page.waitForTimeout(500);
  await page.evaluate(() => switchCalTab('nuevo'));
  await page.waitForTimeout(300);
}

async function crearMonitoreoOrlant(page, { codifTexto, codifSelect }) {
  await page.selectOption('#cf-asesor', 'Daniel Osorio Vega');
  if (codifTexto !== undefined) await page.fill('#cf-codificacion', codifTexto);
  if (codifSelect !== undefined) await page.selectOption('#cf-codificacion-select', codifSelect);
  for (let i = 1; i <= 17; i++) await page.selectOption('#cf-item-' + i, 'SI');
  await page.click('#cpanel-nuevo .btn-primary');
  await page.waitForTimeout(800);
}

async function run(viewport, suffix, { incluirCatalogoVacio, nuevosEsperados }) {
  const erroresConsola = [];
  const peticionesFallidas = [];
  let browser;
  const creds = leerCredenciales();
  const reporte = { viewport: suffix };

  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    page.on('pageerror', (e) => erroresConsola.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/favicon/i.test(m.text())) erroresConsola.push('console.error: ' + m.text()); });
    page.on('response', (res) => { if (res.status() >= 400) peticionesFallidas.push(res.status() + ' ' + res.url()); });
    page.on('requestfailed', (req) => peticionesFallidas.push('FAILED ' + req.url()));

    // ── demo_calidad: formulario de monitoreo, fecha/evaluador bloqueados ──
    await login(page, creds.CALIDAD.user, creds.CALIDAD.password);
    await abrirCalidadOrlantNuevo(page);

    const estadoFormulario1 = await page.evaluate(() => ({
      fechaDisabled: document.getElementById('cf-fecha').disabled,
      fechaValor: document.getElementById('cf-fecha').value,
      evaluadorDisabled: document.getElementById('cf-evaluador').disabled,
      evaluadorValor: document.getElementById('cf-evaluador').value,
      codifEsTexto: document.getElementById('cf-codificacion-select').style.display === 'none',
    }));
    reporte.estadoFormulario1 = estadoFormulario1;
    log('[' + suffix + '] Formulario (1a vista):', JSON.stringify(estadoFormulario1));

    if (incluirCatalogoVacio) {
      await shot(page, '1-formulario-fecha-evaluador-bloqueados-texto-libre-' + suffix + '.png');
      await crearMonitoreoOrlant(page, { codifTexto: 'PRUEBA FASE95' });
      log('[' + suffix + '] Monitoreo #1 (codificacion texto libre) creado.');
    }
    await logout(page);

    if (incluirCatalogoVacio) {
      // ── demo_admin: catalogo de codificaciones (vacio -> cargado) ────────
      await login(page, creds.ADMIN.user, creds.ADMIN.password);
      await page.evaluate(() => openCalidad());
      await page.waitForTimeout(500);
      await page.selectOption('#cal-campana-sel', 'ORLANT');
      await page.waitForTimeout(500);
      await page.evaluate(() => switchCalTab('config'));
      await page.waitForTimeout(500);
      await shot(page, '2-catalogo-codificaciones-vacio-' + suffix + '.png');

      await page.fill('#cf-cod-nuevas', 'POS\nNO CONTESTA\nNUMERO EQUIVOCADO');
      await page.click('button[onclick="calCodificacionesAgregar()"]');
      await page.waitForTimeout(800);
      await shot(page, '3-catalogo-codificaciones-cargado-' + suffix + '.png');
      log('[' + suffix + '] Catalogo de codificaciones de ORLANT cargado.');
      await logout(page);
    }

    // ── demo_calidad otra vez: codificacion YA es DESPLEGABLE ──────────────
    await login(page, creds.CALIDAD.user, creds.CALIDAD.password);
    await abrirCalidadOrlantNuevo(page);
    const estadoFormulario2 = await page.evaluate(() => ({
      codifEsDesplegable: document.getElementById('cf-codificacion-select').style.display !== 'none',
      opciones: Array.from(document.getElementById('cf-codificacion-select').options).map((o) => o.value),
    }));
    reporte.estadoFormulario2 = estadoFormulario2;
    log('[' + suffix + '] Formulario (con catalogo):', JSON.stringify(estadoFormulario2));
    await shot(page, '4-codificacion-desplegable-' + suffix + '.png');

    await crearMonitoreoOrlant(page, { codifSelect: 'POS' });
    log('[' + suffix + '] Monitoreo (desde el desplegable) creado.');
    await logout(page);

    // ── demo_asesor: ve el aviso + contador ─────────────────────────────────
    await login(page, creds.ASESOR.user, creds.ASESOR.password);
    await page.waitForTimeout(800);
    const alertaInicial = await page.evaluate(() => ({
      bannerVisible: !document.getElementById('asesor-alerta-nuevos').classList.contains('hidden'),
      texto: document.getElementById('asesor-alerta-nuevos-texto').textContent,
      badge: document.getElementById('asesor-menu-calidad-badge').textContent,
    }));
    reporte.alertaInicial = alertaInicial;
    log('[' + suffix + '] Alerta inicial del asesor:', JSON.stringify(alertaInicial));
    await shot(page, '5-asesor-alerta-nuevos-' + suffix + '.png');

    // El asesor tiene cientos de monitoreos viejos (datos de demo) ademas de
    // los nuevos de esta corrida -- la tabla ordena por fecha, no por
    // "nuevo", asi que se abre el detalle DIRECTO por indice (el primero
    // que todavia no tenga vistoPorAsesorAt), no "la primera fila visible".
    async function abrirPrimerNoVisto() {
      // Reconsulta el servidor antes de cada intento: verDetalleMonitoreo()
      // marca "visto" en el servidor pero no reescribe _misMonitoreosList en
      // memoria, asi que sin este refresh el segundo intento reencontraria
      // el mismo indice ya marcado.
      return page.evaluate(async () => {
        await renderMisResultados();
        var idx = _misMonitoreosList.findIndex(function (m) { return !m.vistoPorAsesorAt; });
        if (idx < 0) return false;
        verDetalleMonitoreo(idx);
        return true;
      });
    }

    let alertaTrasUno = null;
    const abrio1 = await abrirPrimerNoVisto();
    if (abrio1) {
      await page.waitForTimeout(800);
      await shot(page, '6-asesor-detalle-monitoreo-' + suffix + '.png');
      alertaTrasUno = await page.evaluate(() => document.getElementById('asesor-menu-calidad-badge').textContent);
      log('[' + suffix + '] Contador tras ver 1 detalle:', alertaTrasUno);
      await page.evaluate(() => closeDetalleMonitoreo());
      await page.waitForTimeout(300);
    }
    reporte.alertaTrasUno = alertaTrasUno;

    // Abre el resto de los nuevos (si hay mas de 1) hasta que no quede ninguno.
    for (let restantes = nuevosEsperados - 1; restantes > 0; restantes--) {
      const abrio = await abrirPrimerNoVisto();
      if (!abrio) break;
      await page.waitForTimeout(800);
      await page.evaluate(() => closeDetalleMonitoreo());
      await page.waitForTimeout(300);
    }

    const alertaFinal = await page.evaluate(() => ({
      bannerVisible: !document.getElementById('asesor-alerta-nuevos').classList.contains('hidden'),
      badgeVisible: !document.getElementById('asesor-menu-calidad-badge').classList.contains('hidden'),
    }));
    reporte.alertaFinal = alertaFinal;
    log('[' + suffix + '] Alerta tras ver todos:', JSON.stringify(alertaFinal));
    await shot(page, '7-asesor-sin-alertas-' + suffix + '.png');
    await logout(page);

    // ── otro asesor (sin monitoreos): no ve nada ────────────────────────────
    const otroPass = 'ClaveOtroAsesor95!';
    await login(page, creds.ADMIN.user, creds.ADMIN.password);
    const otroUser = 'oa95_' + suffix.slice(0, 1) + Date.now().toString(36);
    await page.evaluate(async ({ otroUser, otroPass }) => {
      await apiRequest('POST', '/users', {
        nombre: 'Otro Asesor Fase95 ' + Math.random().toString(36).slice(2, 6),
        user: otroUser,
        password: otroPass,
        rol: 'ASESOR',
        asesorCampana: 'ORLANT',
        perms: {},
      });
    }, { otroUser, otroPass });
    await logout(page);

    await login(page, otroUser, otroPass);
    await page.waitForTimeout(800);
    const otroAsesor = await page.evaluate(() => ({
      bannerVisible: !document.getElementById('asesor-alerta-nuevos').classList.contains('hidden'),
      badgeVisible: !document.getElementById('asesor-menu-calidad-badge').classList.contains('hidden'),
      monitoreosPropios: (typeof _misMonitoreosAll !== 'undefined' ? _misMonitoreosAll.length : -1),
    }));
    reporte.otroAsesor = otroAsesor;
    log('[' + suffix + '] Otro asesor (sin monitoreos propios):', JSON.stringify(otroAsesor));
    await shot(page, '8-otro-asesor-sin-nada-' + suffix + '.png');
    await logout(page);

    reporte.erroresConsola = erroresConsola;
    reporte.peticionesFallidas = peticionesFallidas;

    const okFormulario1 = !incluirCatalogoVacio || (
      estadoFormulario1.fechaDisabled === true
      && estadoFormulario1.evaluadorDisabled === true
      && estadoFormulario1.codifEsTexto === true
    );
    const okFormulario2 = estadoFormulario2.codifEsDesplegable === true
      && estadoFormulario2.opciones.includes('POS');
    const okAlerta = alertaInicial.bannerVisible === true
      && alertaInicial.badge === String(nuevosEsperados)
      && alertaFinal.bannerVisible === false
      && alertaFinal.badgeVisible === false;
    const okOtroAsesor = otroAsesor.bannerVisible === false && otroAsesor.badgeVisible === false && otroAsesor.monitoreosPropios === 0;
    const okConsola = erroresConsola.length === 0 && peticionesFallidas.length === 0;

    log('=== RESULTADO (' + suffix + ') ===');
    log('Formulario sin catalogo (bloqueados + texto libre):', okFormulario1 ? 'OK' : 'FALLO -- ' + JSON.stringify(estadoFormulario1));
    log('Formulario con catalogo (desplegable):', okFormulario2 ? 'OK' : 'FALLO -- ' + JSON.stringify(estadoFormulario2));
    log('Alerta al asesor (aparece y desaparece):', okAlerta ? 'OK' : 'FALLO -- ' + JSON.stringify({ alertaInicial, alertaFinal, nuevosEsperados }));
    log('Otro asesor no ve nada:', okOtroAsesor ? 'OK' : 'FALLO -- ' + JSON.stringify(otroAsesor));
    log('Consola/peticiones (0 errores):', okConsola ? 'OK' : 'FALLO -- ' + JSON.stringify({ erroresConsola, peticionesFallidas }));

    fs.writeFileSync(path.join(OUT_DIR, 'reporte-' + suffix + '.json'), JSON.stringify(reporte, null, 2));
    return okFormulario1 && okFormulario2 && okAlerta && okOtroAsesor && okConsola;
  } finally {
    if (browser) await browser.close();
  }
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const okDesktop = await run({ width: 1440, height: 900 }, 'desktop', { incluirCatalogoVacio: true, nuevosEsperados: 2 });
  const okMovil = await run({ width: 390, height: 844 }, 'movil', { incluirCatalogoVacio: false, nuevosEsperados: 1 });
  log('=== FINAL: desktop=' + okDesktop + ' movil=' + okMovil + ' ===');
  process.exit(okDesktop && okMovil ? 0 : 1);
})();
