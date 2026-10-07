// fase130-cierre-chequeo-minimo.js — Fase 130, cierre (version ligera).
// La version completa (fase130-cierre-verificacion-completa.js) ya corrio
// hoy temprano con admin.ok:true (0 discrepancias, 0 canvas en blanco, 0
// errores de consola en las 8 pestañas) -- ese resultado no cambia por
// cargar Calidad. Este script, mas liviano (respeta el rate-limit del
// servidor, ya activado hoy por tantas corridas), SOLO confirma lo que
// pudo cambiar con la carga real de Calidad:
//   1. La pestaña Calidad dibuja con datos reales (0 canvas en blanco, 0
//      errores de consola) -- ya con los 95 monitoreos cargados.
//   2. Cuantas filas de Inasistencia quedan en agosto/2026 (decision
//      pendiente del usuario, Fase 129) -- via el 409 del dry-run
//      (el servidor siempre devuelve el conteo REAL en el cuerpo del error
//      cuando filasEsperadas no coincide, nunca borra nada).
// SOLO LECTURA. Playwright DIRECTO desde Node, NO la extension de Claude in
// Chrome.
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require(path.join(__dirname, '..', '..', 'server', 'node_modules', 'playwright'));
const { veredictoSubvista, canvasesSinDibujar } = require('./revision-final.js');

const ARCHIVO_CALIDAD = 'C:\\Users\\filid\\Downloads\\Copia de CALIDAD_CLINICA_ORLANT_2026 - Septiembre.xlsx';

// Asesores del archivo real de Calidad -- SOLO en memoria de este proceso,
// nunca se imprimen.
function leerAsesoresDelArchivoReal() {
  if (!fs.existsSync(ARCHIVO_CALIDAD)) return null;
  const XLSX = require(path.join(__dirname, '..', '..', 'public', 'js', 'vendor', 'xlsx-0.20.3.full.min.js'));
  const Module = require('module');
  const cmPath = path.join(__dirname, '..', '..', 'public', 'js', 'calidad-carga-masiva-logic.js');
  const origResolve = Module._resolveFilename;
  Module._resolveFilename = function (request, ...rest) {
    if (request === './fecha-limites-logic.js') return path.join(path.dirname(cmPath), 'fecha-limites-logic.js');
    return origResolve.call(this, request, ...rest);
  };
  const cm = require(cmPath);
  const vm = require('vm');
  const seedSrc = fs.readFileSync(path.join(__dirname, '..', '..', 'server', 'calidad-plantillas-seed.js'), 'utf8');
  const sandbox = { module: { exports: {} }, exports: {} };
  vm.createContext(sandbox);
  vm.runInContext(seedSrc + '\n;this.__ITEMS_ORLANT = ITEMS_ORLANT;', sandbox);
  const items = sandbox.__ITEMS_ORLANT;
  const buf = fs.readFileSync(ARCHIVO_CALIDAD);
  const wb = XLSX.read(buf, { type: 'buffer', cellDates: true });
  const ws = wb.Sheets['Monitoreos'] || wb.Sheets[wb.SheetNames[0]];
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: null });
  const res = cm.cmParseRows(aoa, items);
  if (res.error) return { error: res.error };
  return { asesoresNorm: new Set(res.filas.map((f) => f.asesor.trim().toLowerCase())) };
}

const BASE = process.env.APP_URL || 'https://informa.inconexion.com.co';
const LOGIN_TIMEOUT_MS = 10 * 60 * 1000;

function log(...args) { console.log(new Date().toISOString(), ...args); }

async function esperarLogin(page) {
  log('=== INICIA SESIÓN AHORA === (ventana abierta, esperando hasta 10 min)');
  const deadline = Date.now() + LOGIN_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const logueado = await page.evaluate(() => typeof authToken !== 'undefined' && !!authToken).catch(() => false);
    if (logueado) return true;
    await page.waitForTimeout(3000);
  }
  return false;
}

(async () => {
  let browser;
  let ok = true;
  const reporte = {};
  try {
    browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const erroresConsola = [];
    page.on('pageerror', (e) => erroresConsola.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/favicon/i.test(m.text())) erroresConsola.push('console.error: ' + m.text()); });

    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
    const logueado = await esperarLogin(page);
    if (!logueado) throw new Error('Se agotó el tiempo de espera de login.');
    log('Login detectado.');
    await page.waitForTimeout(500);

    // 1. Pestaña Calidad, ya con los 95 monitoreos reales cargados.
    await page.evaluate(() => openGenericDashboard('ORLANT'));
    await page.waitForTimeout(1200);
    await page.locator('#gd-tabs .atab', { hasText: 'Calidad' }).first().click();
    await page.waitForTimeout(1500);
    const malosCalidad = await canvasesSinDibujar(page);
    const veredictoCalidad = await veredictoSubvista(page);
    reporte.calidadTab = { canvasesSinDibujar: malosCalidad, veredicto: veredictoCalidad.veredicto };
    log('Calidad -- canvas en blanco (debe ser 0):', malosCalidad.length, JSON.stringify(malosCalidad));
    log('Calidad -- veredicto de la vista:', veredictoCalidad.veredicto);

    // 2. Inasistencia Ago-26, filas reales tras la recarga de hoy -- via el
    // 409 del dry-run (nunca borra, el servidor siempre devuelve el conteo
    // real en el cuerpo del error cuando filasEsperadas no coincide).
    const dryRunAgosto = await page.evaluate(() => apiRequest('POST', '/admin/borrado-rango', {
      base: 'inasistencia', campana: 'ORLANT', mesDesde: '2026-08', mesHasta: '2026-08',
      filasEsperadas: 999999999, confirmar: false,
    }).catch((e) => ({ filas: e && e.data ? e.data.real : null, via409: true })));
    reporte.inasistenciaAgostoFilas = dryRunAgosto.filas;
    log('Inasistencia Ago-26, filas (sede x especialidad x entidad) tras la recarga de hoy:', dryRunAgosto.filas);

    // 3. Cuantos de los 19 asesores del archivo real de Calidad YA tienen un
    // usuario ASESOR activo en ORLANT -- cruce de nombres en memoria, SOLO
    // se imprime el conteo.
    const archivoInfo = leerAsesoresDelArchivoReal();
    if (archivoInfo && !archivoInfo.error) {
      const usuarios = await page.evaluate(() => apiRequest('GET', '/users'));
      const asesoresOrlantActivos = new Set(
        (usuarios || [])
          .filter((u) => u.rol === 'ASESOR' && u.active && u.asesorCampana === 'ORLANT')
          .map((u) => String(u.nombre || '').trim().toLowerCase())
      );
      let conUsuario = 0;
      archivoInfo.asesoresNorm.forEach((n) => { if (asesoresOrlantActivos.has(n)) conUsuario++; });
      reporte.calidadAsesores = {
        asesoresDistintosEnArchivo: archivoInfo.asesoresNorm.size,
        sinUsuarioTodavia: archivoInfo.asesoresNorm.size - conUsuario,
      };
      log('Asesores de Calidad sin usuario ASESOR en ORLANT:', reporte.calidadAsesores.sinUsuarioTodavia, 'de', reporte.calidadAsesores.asesoresDistintosEnArchivo);
    } else {
      reporte.calidadAsesores = { error: 'archivo no encontrado o con error de parseo, omitido' };
    }

    reporte.erroresConsola = erroresConsola;
    reporte.ok = malosCalidad.length === 0 && erroresConsola.length === 0 && typeof dryRunAgosto.filas === 'number';

    console.log('\n=== REPORTE MINIMO DE CIERRE (JSON, sin nombres) ===');
    console.log(JSON.stringify(reporte, null, 2));

    // Cierra sesion admin antes de soltar la pagina (mismo criterio que
    // revision-final.js) -- intencional, nunca deja el navegador logueado.
    await page.evaluate(() => apiRequest('POST', '/auth/logout').catch(() => {}));

    ok = reporte.ok;
  } catch (e) {
    console.error('FALLO:', e.message);
    ok = false;
  } finally {
    if (browser) await browser.close();
  }
  process.exit(ok ? 0 : 1);
})();
