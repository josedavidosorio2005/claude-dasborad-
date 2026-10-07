// fase130-cierre-verificacion-completa.js — Fase 130, cierre.
// Una sola sesion de login para cubrir todo lo que esta fase necesita
// verificar de verdad contra produccion:
//   1. correrChequeosAdmin (revision-final.js, reusado tal cual): KPIs,
//      integridad de Inasistencia (Parte 2), 0 canvas en blanco, 0 errores
//      de consola, 0 peticiones fallidas, exports.
//   2. Posicion/nombre de la pestaña "Llamadas y WhatsApp de salida" (pedido
//      de Edwin #1) via GET /dashboards/config/ORLANT (config real, no un
//      screenshot).
//   3. Ningun aviso de julio/mes parcial/incompleto en las sub-vistas de
//      Inasistencia (pedido de Edwin #2, Parte 3) -- lee SOLO el texto de
//      los contenedores de aviso (mes + nombres de especialidad, nunca PII)
//      y busca patrones prohibidos.
//   4. Cuantos de los asesores del archivo real de Calidad (fuera del repo)
//      YA tienen un usuario ASESOR activo en ORLANT -- cruce de nombres
//      hecho en memoria, SOLO se imprime el conteo, nunca un nombre.
//
// SOLO LECTURA. Playwright DIRECTO desde Node (headless:false), NO la
// extension de Claude in Chrome.
'use strict';
const path = require('path');
const fs = require('fs');
const { chromium } = require(path.join(__dirname, '..', '..', 'server', 'node_modules', 'playwright'));
const { correrChequeosAdmin } = require('./revision-final.js');

const BASE = process.env.APP_URL || 'https://informa.inconexion.com.co';
const LOGIN_TIMEOUT_MS = 10 * 60 * 1000;
const ARCHIVO_CALIDAD = 'C:\\Users\\filid\\Downloads\\Copia de CALIDAD_CLINICA_ORLANT_2026 - Septiembre.xlsx';

function log(...args) { console.log(new Date().toISOString(), ...args); }

async function esperarLogin(page) {
  log('=== INICIA SESIÓN AHORA, CON TU CUENTA DE ADMINISTRADOR === (ventana abierta, esperando hasta 10 min)');
  const deadline = Date.now() + LOGIN_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const logueado = await page.evaluate(() => typeof authToken !== 'undefined' && !!authToken).catch(() => false);
    if (logueado) return true;
    await page.waitForTimeout(3000);
  }
  return false;
}

// Asesores del archivo real de Calidad -- SOLO en memoria de este proceso,
// nunca se imprimen. Requiere los mismos modulos puros que ya usa la carga
// masiva (cmParseRows) para no reinventar el parseo.
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
  const asesoresNorm = new Set(res.filas.map((f) => f.asesor.trim().toLowerCase()));
  return { asesoresNorm, totalFilas: res.filas.length };
}

const PATRONES_PROHIBIDOS = [/incompleto/i, /\bparcial\b/i, /\bjul(io)?\b/i, /jul-26/i];

(async () => {
  let browser;
  let ok = true;
  const reporte = {};
  try {
    browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
    const logueado = await esperarLogin(page);
    if (!logueado) throw new Error('Se agotó el tiempo de espera de login.');
    log('Login detectado, corriendo los chequeos completos de cierre...');

    // 1. correrChequeosAdmin reusado tal cual.
    const admin = await correrChequeosAdmin(page);
    reporte.admin = {
      ok: admin.ok,
      discrepanciasNumeros: admin.discrepanciasNumeros,
      canvasesSinDibujar: admin.canvasesSinDibujar,
      erroresConsola: admin.erroresConsola,
      peticionesFallidas: admin.peticionesFallidas,
      enBlancoSinMensaje: admin.enBlancoSinMensaje,
      inasistenciaIntegridad: admin.inasistenciaIntegridad,
      pestanas: Object.keys(admin.pestanas || {}),
      subvistasInasistencia: admin.subvistas ? Object.keys(admin.subvistas['Inasistencia'] || {}) : [],
    };

    // 2. Posicion/nombre de "Llamadas y WhatsApp de salida" vs "Tráfico de WhatsApp".
    const config = await page.evaluate(() => apiRequest('GET', '/dashboards/config/ORLANT'));
    const tabs = (config.layout && config.layout.tabs) || [];
    const idxTw = tabs.findIndex((t) => t.key === 'trafico_whatsapp');
    const idxSalida = tabs.findIndex((t) => t.key === 'salida');
    reporte.salidaTab = {
      existeTraficoWpp: idxTw !== -1,
      existeSalida: idxSalida !== -1,
      label: idxSalida !== -1 ? tabs[idxSalida].label : null,
      justoDespuesDeTraficoWpp: idxTw !== -1 && idxSalida === idxTw + 1,
    };

    // 3. Avisos de Inasistencia -- SOLO texto de mes/especialidad (no PII).
    await page.locator('#gd-tabs .atab', { hasText: 'Inasistencia' }).first().click().catch(() => {});
    await page.waitForTimeout(1000);
    const avisosEncontrados = [];
    const nSub = await page.locator('.gd-subtab-btn').count();
    const subVistasRecorridas = [];
    for (let s = 0; s < Math.max(nSub, 1); s++) {
      if (nSub > 0) {
        const subBtn = page.locator('.gd-subtab-btn').nth(s);
        const subLabel = (await subBtn.textContent() || '').trim();
        await subBtn.click();
        await page.waitForTimeout(900);
        subVistasRecorridas.push(subLabel);
      } else {
        subVistasRecorridas.push('(sin sub-pestañas)');
      }
      const textos = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('[id^="inasist-aviso-"], [id^="inasist-esp-aviso-"]'))
          .map((el) => el.innerText || '')
          .filter((t) => t.trim());
      });
      textos.forEach((t) => {
        PATRONES_PROHIBIDOS.forEach((re) => {
          if (re.test(t)) avisosEncontrados.push({ subvista: subVistasRecorridas[subVistasRecorridas.length - 1], patron: re.toString() });
        });
      });
    }
    reporte.inasistenciaAvisos = {
      subVistasRecorridas,
      avisosProhibidosEncontrados: avisosEncontrados,
      // 'por entidad' NO existe como sub-vista propia -- es un filtro dentro
      // de 'Por mes', no una tercera sub-pestaña (confirmado leyendo
      // inasistencia.js antes de correr este script).
      nota: 'Inasistencia solo tiene 2 sub-vistas (Por mes, Por especialidad) -- "por entidad" es un filtro, no una sub-vista aparte.',
    };

    // 4. Calidad -- cruce de asesores del archivo real vs usuarios ASESOR ya
    // creados en ORLANT. Solo conteos, nunca un nombre.
    const archivoInfo = leerAsesoresDelArchivoReal();
    if (!archivoInfo) {
      reporte.calidadAsesores = { error: 'No se encontro el archivo real en la ruta esperada -- omitido.' };
    } else if (archivoInfo.error) {
      reporte.calidadAsesores = { error: archivoInfo.error };
    } else {
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
        usuariosAsesorActivosOrlant: asesoresOrlantActivos.size,
        conUsuarioYaCreado: conUsuario,
        sinUsuarioTodavia: archivoInfo.asesoresNorm.size - conUsuario,
      };
    }

    reporte.ok = admin.ok && avisosEncontrados.length === 0 && reporte.salidaTab.justoDespuesDeTraficoWpp && reporte.salidaTab.label === 'Llamadas y WhatsApp de salida';

    console.log('\n=== REPORTE DE CIERRE FASE 130 (JSON, sin nombres) ===');
    console.log(JSON.stringify(reporte, null, 2));
    ok = reporte.ok;
  } catch (e) {
    console.error('FALLO:', e.message);
    ok = false;
  } finally {
    if (browser) await browser.close();
  }
  process.exit(ok ? 0 : 1);
})();
