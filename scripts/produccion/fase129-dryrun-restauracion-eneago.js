// fase129-dryrun-restauracion-eneago.js — Script de un solo uso, Fase 129.
// Decisión del usuario: restaurar agosto al alcance de privacidad
// original (umbral calculado sobre ene-ago, igual que la Fase 108: 352
// filas / 54 entidades), vía el Paso 1 de la Opción B aprobada: subir por
// la interfaz el archivo COMPLETO ene-ago (83.006 filas reales) -- esto
// restaura el umbral correcto en agosto, aunque de paso también
// "resucita" ene-jul temporalmente (se borran de nuevo en el Paso 2,
// script aparte, solo después de ver el conteo exacto y del "sí").
//
// Este script es SOLO dry-run: usa scripts/produccion/lib/dry-run-seguro.js
// (confirm síncrono forzado a false + bloqueo de red de cualquier
// escritura real fuera de /impacto, con fallo ruidoso si una se
// intenta) -- NUNCA guarda nada. Playwright DIRECTO desde Node
// (headless:false) -- NO la extensión de Claude in Chrome (CLAUDE.md).
//
// PRIVACIDAD: nunca imprime NOMBRE ENTIDAD -- el mensaje de confirmación
// de _cargasGuardarInasistencia solo trae meses + conteo de
// especialidades + un número de registros a reemplazar.
'use strict';
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'server', 'node_modules', 'playwright'));
const { instalarDryRunSeguro, leerConfirmsCapturados } = require(path.join(__dirname, 'lib', 'dry-run-seguro.js'));

const BASE = 'https://informa.inconexion.com.co';
const LOGIN_TIMEOUT_MS = 10 * 60 * 1000;
const ARCHIVO_ENEAGO = 'C:\\Users\\filid\\Downloads\\INASISTENCIA NUEVA PARA MONTAR (1).xlsx';

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
  const reporte = {};
  try {
    browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    page.on('pageerror', (e) => log('pageerror:', e.message));

    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
    const logueado = await esperarLogin(page);
    if (!logueado) throw new Error('Se agotó el tiempo de espera de login (10 min) sin detectar sesión iniciada.');
    log('Login detectado, continuando automáticamente.');
    await page.waitForTimeout(500);

    const peticionesBloqueadas = [];
    await instalarDryRunSeguro(page, peticionesBloqueadas);

    await page.evaluate(() => openCargas());
    await page.waitForTimeout(800);
    await page.selectOption('#carga-cliente', 'ORLANT');
    await page.waitForTimeout(800);

    log('Subiendo el archivo COMPLETO ene-ago (83.006 filas reales)...');
    await page.setInputFiles('#carga-file', ARCHIVO_ENEAGO);
    // 83.006 filas tardan mas en parsear/agregar en el navegador que el
    // archivo de solo-agosto (11.189) -- espera activa en vez de un
    // tiempo fijo (la corrida anterior fallo por esto: 4s no alcanzaron).
    let listo = false;
    for (let i = 0; i < 40; i++) {
      listo = await page.evaluate(() => Array.isArray(_cargasResultados) && _cargasResultados.some((r) => r.tipo === 'inasistencia'));
      if (listo) break;
      await page.waitForTimeout(1000);
    }
    log('Parseo listo tras la espera activa:', listo);

    const preview = await page.evaluate(() => {
      const r = _cargasResultados.find((x) => x.tipo === 'inasistencia');
      if (!r || r.error) return { error: r ? r.error : 'sin fila "inasistencia" en el plan' };
      const porMes = {};
      r.filas.forEach((f) => {
        if (!porMes[f.mes]) porMes[f.mes] = { especialidades: new Set(), filas: 0, total: 0, inasistencia: 0, pendiente: 0, cancelada: 0, atendidas: 0 };
        const m = porMes[f.mes];
        m.especialidades.add(f.especialidad); m.filas++; m.total += f.total; m.inasistencia += f.inasistencia; m.pendiente += f.pendiente;
        m.cancelada += f.cancelada; m.atendidas += f.atendidas;
      });
      const porMesOut = {};
      Object.keys(porMes).forEach((mes) => {
        const m = porMes[mes];
        porMesOut[mes] = { especialidades: m.especialidades.size, filas: m.filas, total: m.total, inasistencia: m.inasistencia, pendiente: m.pendiente, cancelada: m.cancelada, atendidas: m.atendidas, pct: Math.round(((m.inasistencia + m.pendiente) / m.total) * 10000) / 100 };
      });
      // Entidades distintas en TODO el archivo (incluye "PARTICULAR / OTRA"
      // como 1 valor) -- conteo, nunca la lista.
      const entidadesDistintasTotal = new Set(r.filas.map((f) => f.entidad)).size;
      const entidadesDistintasAgosto = new Set(r.filas.filter((f) => f.mes === '2026-08').map((f) => f.entidad)).size;
      return {
        filasAgregadasTotal: r.filas.length,
        avisos: r.avisos ? r.avisos.length : 0,
        entidadesAgrupadas: r.entidadesAgrupadas, entidadesSinDato: r.entidadesSinDato,
        entidadesDistintasTotal, entidadesDistintasAgosto,
        porMes: porMesOut,
      };
    });
    if (preview.error) throw new Error('El archivo no se reconoció como Inasistencia: ' + preview.error);
    reporte.preview = preview;
    log('Preview (parseo en el navegador, antes de cualquier llamada al servidor):', JSON.stringify(preview, null, 2));

    const dryRun = await page.evaluate(async () => {
      const r = _cargasResultados.find((x) => x.tipo === 'inasistencia');
      return await _cargasGuardarInasistencia('ORLANT', r);
    });
    const confirmsCapturados = await leerConfirmsCapturados(page);
    reporte.dryRun = dryRun;
    reporte.mensajesConfirmCapturados = confirmsCapturados;
    reporte.peticionesBloqueadas = peticionesBloqueadas;
    log('Mensaje(s) de confirmación que vería el usuario (SOLO meses/especialidades/conteo, nunca entidades):');
    confirmsCapturados.forEach((m) => log(m));
    log('Resultado del dry-run (confirm() forzado a false de forma sincronica):', JSON.stringify(dryRun));
    log('Peticiones de escritura bloqueadas (debe quedar en 0):', JSON.stringify(peticionesBloqueadas));

    if (!/no se toco|sin tocar/i.test(dryRun.mensaje || '')) {
      throw new Error('El dry-run no terminó con el mensaje esperado de "se dejó sin tocar": ' + dryRun.mensaje);
    }
    if (confirmsCapturados.length !== 1) {
      throw new Error('Se esperaba exactamente 1 confirm() capturado, llegaron ' + confirmsCapturados.length);
    }
    if (peticionesBloqueadas.length > 0) {
      throw new Error('Se intento una peticion de escritura real durante el dry-run: ' + JSON.stringify(peticionesBloqueadas));
    }

    const ago = preview.porMes['2026-08'];
    const okControl = ago && ago.filas === 352 && ago.total === 11189 && ago.inasistencia === 786 &&
      preview.entidadesDistintasAgosto === 54;
    log('Coincide con el objetivo (352 filas / 11.189 citas / I 786 / 54 entidades en agosto)?', okControl);

    reporte.ok = true;
    console.log('\n=== RESUMEN FINAL (JSON) ===');
    console.log(JSON.stringify(reporte, null, 2));
    if (!okControl) { ok = false; }
  } catch (e) {
    console.error('FALLO:', e.message);
    ok = false;
  } finally {
    if (browser) await browser.close();
  }
  process.exit(ok ? 0 : 1);
})();
