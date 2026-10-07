// fase129-dryrun-inasistencia-agosto.js — Script de un solo uso, Fase 129.
// Paso 2: sube el archivo filtrado SOLO-AGOSTO por la interfaz real (modal
// "Cargar Datos de Dashboards", cliente ORLANT), deja que la app lo
// reconozca y calcule el impacto (POST .../carga/impacto -- "no escribe
// nada", server/inasistencia.js), con confirm() forzado a false de forma
// SINCRONICA + bloqueo de red por construcción para cualquier escritura
// real -- ver scripts/produccion/lib/dry-run-seguro.js. Playwright DIRECTO
// desde Node (headless:false) -- NO la extensión de Claude in Chrome
// (CLAUDE.md).
//
// CORRECCION DE UN INCIDENTE REAL (misma fase): la version anterior de
// este script usaba page.exposeFunction para el override de
// window.confirm -- exposeFunction SIEMPRE envuelve el retorno en una
// Promise (truthy), asi que `if (!confirm(msg))` en cargas.js nunca se
// cumplio y el "dry-run" termino llamando al POST real de guardado,
// escribiendo en produccion sin el "si" del usuario y sin respaldo
// previo. Ver dry-run-seguro.js para las 2 defensas independientes que lo
// corrigen, y server/tests/fase129-dryrun-seguro-logic.test.js para la
// prueba que documenta la causa raiz.
//
// PRIVACIDAD: nunca imprime NOMBRE ENTIDAD ni ningún nombre -- el mensaje
// de confirmación que arma _cargasGuardarInasistencia solo trae meses +
// conteo de especialidades + un número de registros a reemplazar, sin
// entidades (confirmado leyendo public/js/cargas.js antes de usarlo).
'use strict';
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'server', 'node_modules', 'playwright'));
const { instalarDryRunSeguro, leerConfirmsCapturados } = require(path.join(__dirname, 'lib', 'dry-run-seguro.js'));

const BASE = 'https://informa.inconexion.com.co';
const LOGIN_TIMEOUT_MS = 10 * 60 * 1000;
const ARCHIVO_AGOSTO = 'C:\\Users\\filid\\Documents\\trabajo inconexion\\bases edwin\\inasistencia\\INASISTENCIA_SOLO_AGOSTO_2026.xlsx';

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

    // Las 2 defensas, instaladas DESDE EL INICIO (antes de tocar el modal
    // de cargas) -- cualquier peticion de escritura real que intente
    // salir durante TODA esta corrida queda abortada y registrada aqui.
    const peticionesBloqueadas = [];
    await instalarDryRunSeguro(page, peticionesBloqueadas);

    await page.evaluate(() => openCargas());
    await page.waitForTimeout(800);
    await page.selectOption('#carga-cliente', 'ORLANT');
    await page.waitForTimeout(800);

    log('Subiendo INASISTENCIA_SOLO_AGOSTO_2026.xlsx (filtrado, solo agosto)...');
    await page.setInputFiles('#carga-file', ARCHIVO_AGOSTO);
    await page.waitForTimeout(3000);

    const preview = await page.evaluate(() => {
      const r = _cargasResultados.find((x) => x.tipo === 'inasistencia');
      if (!r || r.error) return { error: r ? r.error : 'sin fila "inasistencia" en el plan' };
      const porMes = {};
      r.filas.forEach((f) => {
        if (!porMes[f.mes]) porMes[f.mes] = { especialidades: new Set(), total: 0, inasistencia: 0, pendiente: 0, cancelada: 0, atendidas: 0 };
        const m = porMes[f.mes];
        m.especialidades.add(f.especialidad); m.total += f.total; m.inasistencia += f.inasistencia; m.pendiente += f.pendiente;
        m.cancelada += f.cancelada; m.atendidas += f.atendidas;
      });
      const porMesOut = {};
      Object.keys(porMes).forEach((mes) => {
        const m = porMes[mes];
        porMesOut[mes] = { especialidades: m.especialidades.size, total: m.total, inasistencia: m.inasistencia, pendiente: m.pendiente, cancelada: m.cancelada, atendidas: m.atendidas, pct: Math.round(((m.inasistencia + m.pendiente) / m.total) * 10000) / 100 };
      });
      return {
        filasAgregadas: r.filas.length,
        avisos: r.avisos ? r.avisos.length : 0,
        entidadesAgrupadas: r.entidadesAgrupadas, entidadesSinDato: r.entidadesSinDato,
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
    log('Peticiones de escritura bloqueadas por la defensa de red (debe quedar en 0 -- la defensa 1 ya debio evitar que la app las intentara):', JSON.stringify(peticionesBloqueadas));

    if (!/no se toco|sin tocar/i.test(dryRun.mensaje || '')) {
      throw new Error('El dry-run no terminó con el mensaje esperado de "se dejó sin tocar" -- revisar antes de continuar: ' + dryRun.mensaje);
    }
    if (confirmsCapturados.length !== 1) {
      throw new Error('Se esperaba exactamente 1 confirm() capturado, llegaron ' + confirmsCapturados.length + ' -- revisar antes de continuar.');
    }
    if (peticionesBloqueadas.length > 0) {
      // Por diseno, esto NUNCA deberia pasar (la defensa 1 ya corta antes
      // de llegar a la peticion) -- si pasa, es la prueba de que la
      // defensa 1 fallo (como el incidente real que origino este
      // archivo), y este script debe fallar RUIDOSAMENTE en vez de seguir
      // como si nada.
      throw new Error('Se intento una peticion de escritura real durante el dry-run (bloqueada por la defensa de red, pero NUNCA debio intentarse): ' + JSON.stringify(peticionesBloqueadas));
    }

    reporte.ok = true;
    console.log('\n=== RESUMEN FINAL (JSON, ya filtrado de nombres) ===');
    console.log(JSON.stringify(reporte, null, 2));
  } catch (e) {
    console.error('FALLO:', e.message);
    ok = false;
  } finally {
    if (browser) await browser.close();
  }
  process.exit(ok ? 0 : 1);
})();
