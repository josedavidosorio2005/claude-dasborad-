// fase128-parte3-calidad-monitoreos-prueba.js — Fase 128, Parte 3 (pedido
// explicito de Edwin, confirmado en la reunion de validacion de hoy: los
// 37 monitoreos de Calidad de ORLANT en produccion son de prueba, entrega
// los datos reales mañana).
//
// SOLO LECTURA por defecto (modo dry-run): descubre cuantos monitoreos de
// ORLANT se borrarian, por mes, y que mas puede verse afectado
// (cronograma_metas) -- nunca escribe nada en este modo, sin importar que
// numero se le pase. El borrado real exige 2 variables de entorno
// explicitas (CONFIRMAR_BORRADO=si + los numeros EXACTOS que este mismo
// script ya mostro) -- nunca corre solo, nunca sin que un humano haya
// visto el dry-run primero.
//
// Playwright DIRECTO desde Node (headless:false, navegador visible) -- NO
// la extension de Claude in Chrome (regla fija del proyecto, CLAUDE.md).
// El usuario inicia sesion a mano; el script nunca ve ni escribe la
// contraseña. Antes de correr esto: respaldo manual confirmado (workflow
// "Respaldo de produccion", modo respaldar-ahora) -- ver PROGRESS.md/
// docs/pendientes.md para el estado de esa corrida.
//
// Solo imprime CONTEOS y meses -- nunca un nombre de asesor, evaluador ni
// lider de cronograma_metas.
'use strict';
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'server', 'node_modules', 'playwright'));

const BASE = process.env.APP_URL || 'https://informa.inconexion.com.co';
const LOGIN_TIMEOUT_MS = 10 * 60 * 1000;

// Rango generoso de meses a escanear -- cubre cualquier mes plausible de
// datos de prueba de ORLANT sin asumir cuales son.
const MESES_A_ESCANEAR = [];
for (let y = 2025; y <= 2026; y++) {
  for (let m = 1; m <= 12; m++) {
    MESES_A_ESCANEAR.push(y + '-' + String(m).padStart(2, '0'));
  }
}

// CONFIRMAR_BORRADO=si + estas 3 variables EXACTAS (las que el dry-run de
// esta misma corrida acaba de mostrar) habilitan el borrado real.
const CONFIRMAR = process.env.CONFIRMAR_BORRADO === 'si';
const MES_DESDE = process.env.MES_DESDE || null;
const MES_HASTA = process.env.MES_HASTA || null;
const FILAS_ESPERADAS = process.env.FILAS_ESPERADAS ? Number(process.env.FILAS_ESPERADAS) : null;

function log(...args) { console.log(new Date().toISOString(), ...args); }

async function esperarLogin(page) {
  log('=== INICIA SESION AHORA EN PRODUCCION (ADMIN) === (hasta 10 min)');
  const deadline = Date.now() + LOGIN_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const info = await page.evaluate(() => {
      if (typeof authToken !== 'string' || !authToken) return null;
      try {
        const p = JSON.parse(atob(authToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        return { isMasterAdmin: !!p.isMasterAdmin, rol: p.rol || null };
      } catch (e) { return null; }
    }).catch(() => null);
    if (info && (info.isMasterAdmin || info.rol === 'ADMIN')) return true;
    await page.waitForTimeout(3000);
  }
  return false;
}

// Dry-run SIEMPRE seguro: filasEsperadas:0 nunca coincide con un conteo
// real > 0, asi que la API responde 409 con el conteo REAL en el campo
// `real` (ver server/admin-borrado-rango.js) -- nunca borra nada, sin
// importar el resultado. Si el conteo real SI es 0, la API responde 200
// (dryRun:true, filas:0), que tambien leemos igual.
async function contarMesSinRiesgo(page, mesDesde, mesHasta) {
  return page.evaluate(async (args) => {
    try {
      const r = await apiRequest('POST', '/admin/borrado-rango', {
        base: 'monitoreos', campana: 'ORLANT', mesDesde: args.mesDesde, mesHasta: args.mesHasta, filasEsperadas: 0,
      });
      return r.filas; // 200: dry-run, ya sabemos que es 0
    } catch (e) {
      // 409: el conteo real viene en e.data.real (api.js adjunta el cuerpo
      // completo de la respuesta en .data -- e.message es solo el texto
      // humano, nunca trae el numero).
      return (e.data && typeof e.data.real === 'number') ? e.data.real : null;
    }
  }, { mesDesde, mesHasta });
}

async function main() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });

  const logueado = await esperarLogin(page);
  if (!logueado) throw new Error('Se agoto el tiempo de espera de login (10 min) sin detectar sesion de administrador.');
  log('Login detectado, continuando automaticamente.');
  await page.waitForTimeout(1000);

  // ── 1. Conteo por mes (solo lectura, 0 riesgo) ──────────────────────
  const porMes = {};
  let total = 0;
  for (const mes of MESES_A_ESCANEAR) {
    const n = await contarMesSinRiesgo(page, mes, mes);
    if (n) { porMes[mes] = n; total += n; }
  }
  log('Monitoreos de ORLANT por mes (solo conteos):', JSON.stringify(porMes));
  log('Total monitoreos ORLANT (en el rango escaneado):', total);

  const mesesConDatos = Object.keys(porMes).sort();
  const mesDesdeReal = mesesConDatos[0] || null;
  const mesHastaReal = mesesConDatos[mesesConDatos.length - 1] || null;

  // ── 2. Que mas puede verse afectado: cronograma_metas (independiente,
  // sin fila por monitoreo -- nunca se borra, solo se informa) ─────────
  const metas = await page.evaluate(() => apiRequest('GET', '/metas?campana=ORLANT')).catch((e) => ({ error: e.message }));
  const mesesConMeta = Array.isArray(metas) ? [...new Set(metas.map((m) => m.mes))].sort() : null;
  log('cronograma_metas de ORLANT (NO se borra por este camino, tabla independiente):',
    mesesConMeta ? ('filas: ' + metas.length + ', meses: ' + JSON.stringify(mesesConMeta)) : JSON.stringify(metas));
  log('Historial de auditoria: NO se toca -- el endpoint de borrado solo AGREGA un evento de resumen (conteo), nunca borra entradas existentes.');

  log('==========================================================');
  if (!mesDesdeReal) {
    log('OK: 0 monitoreos encontrados en el rango escaneado -- nada que borrar.');
  } else {
    log('Para borrar de verdad estos ' + total + ' monitoreo(s) (rango ' + mesDesdeReal + '..' + mesHastaReal + '), correr de nuevo con:');
    log('  CONFIRMAR_BORRADO=si MES_DESDE=' + mesDesdeReal + ' MES_HASTA=' + mesHastaReal + ' FILAS_ESPERADAS=' + total + ' node scripts/produccion/fase128-parte3-calidad-monitoreos-prueba.js');
    log('SOLO despues de que el usuario haya visto este numero y haya dicho "si" explicitamente.');
  }

  // ── 3. Borrado real -- SOLO si las 3 variables de entorno coinciden
  // EXACTO con lo que el dry-run de ESTA MISMA corrida acaba de mostrar.
  // Nunca confia en un numero de una corrida anterior. ─────────────────
  if (CONFIRMAR) {
    if (MES_DESDE !== mesDesdeReal || MES_HASTA !== mesHastaReal || FILAS_ESPERADAS !== total) {
      log('ABORTA: las variables de entorno (MES_DESDE/MES_HASTA/FILAS_ESPERADAS) no coinciden con el dry-run de ESTA corrida -- no se borro nada.');
      log('  Pedido: MES_DESDE=' + MES_DESDE + ' MES_HASTA=' + MES_HASTA + ' FILAS_ESPERADAS=' + FILAS_ESPERADAS);
      log('  Real ahora mismo: MES_DESDE=' + mesDesdeReal + ' MES_HASTA=' + mesHastaReal + ' FILAS_ESPERADAS=' + total);
    } else {
      log('CONFIRMAR_BORRADO=si y los numeros coinciden -- borrando de verdad...');
      const resultado = await page.evaluate((args) => apiRequest('POST', '/admin/borrado-rango', {
        base: 'monitoreos', campana: 'ORLANT', mesDesde: args.mesDesde, mesHasta: args.mesHasta, filasEsperadas: args.filasEsperadas, confirmar: true,
      }), { mesDesde: mesDesdeReal, mesHasta: mesHastaReal, filasEsperadas: total });
      log('Resultado del borrado:', JSON.stringify(resultado));
    }
  }

  await browser.close();
}

main().catch((e) => { console.error('FALLO:', e.message); process.exit(1); });
