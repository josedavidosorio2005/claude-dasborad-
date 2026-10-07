// fase130-dryrun-inasistencia-ago-sep.js — Fase 130, Parte 2.
// Dry-run REAL de la carga de Inasistencia (ago+sep/2026) contra
// produccion, ya con el fix de "FECHA CITA"/"SEDE 34 (AUDIFONOS)"
// desplegado (v1.15.2): sube el archivo real
// 'INASISTENCIA DE AGOSTO Y SEPTIEMBRE.xlsx' (fuera del repo, en
// Descargas) por la UI real (Cargar Datos de Dashboards), pero NUNCA
// llega a hacer click en "Guardar carga" -- lee `_cargasResultados` (el
// resultado YA parseado por el codigo de produccion) directo del navegador
// y calcula los numeros de control AQUI, sin tocar el servidor con un
// POST de escritura. Ademas, por si acaso, instala las 2 defensas de
// dry-run-seguro.js (bloqueo de red + confirm() siempre false) como
// defensa en profundidad.
//
// SOLO imprime conteos/meses/sedes -- nunca una fila cruda, nunca el
// nombre de una entidad (ver CLAUDE.md de esta fase).
//
// Playwright DIRECTO desde Node (headless:false), NO la extension de
// Claude in Chrome.
'use strict';
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'server', 'node_modules', 'playwright'));
const { instalarDryRunSeguro, leerConfirmsCapturados } = require('./lib/dry-run-seguro.js');

const BASE = 'https://informa.inconexion.com.co';
const LOGIN_TIMEOUT_MS = 10 * 60 * 1000;
const ARCHIVO = path.join('C:', 'Users', 'filid', 'Downloads', 'INASISTENCIA DE AGOSTO Y SEPTIEMBRE.xlsx');

function log(...args) { console.log(new Date().toISOString(), ...args); }

async function esperarLogin(page) {
  log('=== INICIA SESIÓN AHORA === (ventana de Chromium abierta, esperando hasta 10 min)');
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
  try {
    browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
    const logueado = await esperarLogin(page);
    if (!logueado) throw new Error('Se agotó el tiempo de espera de login.');
    log('Login detectado.');
    await page.waitForTimeout(500);

    const peticionesBloqueadas = [];
    await instalarDryRunSeguro(page, peticionesBloqueadas);

    await page.evaluate(() => openCargas());
    await page.waitForSelector('#carga-cliente', { state: 'visible', timeout: 10000 });
    await page.selectOption('#carga-cliente', { label: 'ORLANT' });
    await page.waitForTimeout(800); // onCargaClienteChange construye _cargasPlan

    log('Subiendo el archivo real (fuera del repo, Descargas)...');
    await page.setInputFiles('#carga-file', ARCHIVO);
    await page.waitForTimeout(3000); // procesarArchivoConsolidado es async (XLSX + parseo)

    const errores = await page.evaluate(() => (document.getElementById('carga-errores') || {}).textContent || '');
    if (errores.trim()) log('Errores mostrados en pantalla:', errores.trim());

    const resumen = await page.evaluate(() => {
      var r = (window._cargasResultados || []).find(function (x) { return x.tipo === 'inasistencia'; });
      if (!r || !r.filas) return null;
      var porMes = {};
      r.filas.forEach(function (f) {
        if (!porMes[f.mes]) porMes[f.mes] = { cancelada: 0, inasistencia: 0, pendiente: 0, atendidas: 0, total: 0, especialidades: {}, sedes: {} };
        var m = porMes[f.mes];
        m.cancelada += f.cancelada; m.inasistencia += f.inasistencia; m.pendiente += f.pendiente;
        m.atendidas += f.atendidas; m.total += f.total;
        m.especialidades[f.especialidad] = true;
        m.sedes[f.sede] = (m.sedes[f.sede] || 0) + f.total;
      });
      var out = {};
      Object.keys(porMes).sort().forEach(function (mes) {
        var m = porMes[mes];
        out[mes] = {
          total: m.total, cancelada: m.cancelada, inasistencia: m.inasistencia, pendiente: m.pendiente, atendidas: m.atendidas,
          especialidadesDistintas: Object.keys(m.especialidades).length,
          porSede: m.sedes,
        };
      });
      return { porMes: out, filasAgregadasTotal: r.filas.length, avisos: r.avisos || [] };
    });

    if (!resumen) throw new Error('No se encontro el resultado parseado de inasistencia en _cargasResultados -- revisar manualmente.');

    log('=== NUMEROS DE CONTROL (calculados en el navegador, SIN guardar nada) ===');
    console.log(JSON.stringify(resumen, null, 2));

    const confirms = await leerConfirmsCapturados(page);
    log('window.confirm() interceptados (debe seguir vacio -- nunca se llego a Guardar):', JSON.stringify(confirms));
    log('Peticiones de escritura bloqueadas (debe ser 0 -- nunca se clickeo Guardar):', peticionesBloqueadas.length, JSON.stringify(peticionesBloqueadas));

    if (peticionesBloqueadas.length > 0) {
      throw new Error('Alguna peticion de escritura intento salir -- revisar.');
    }
  } catch (e) {
    console.error('FALLO:', e.message);
    ok = false;
  } finally {
    if (browser) await browser.close();
  }
  process.exit(ok ? 0 : 1);
})();
