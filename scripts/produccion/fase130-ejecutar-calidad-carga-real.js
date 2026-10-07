// fase130-ejecutar-calidad-carga-real.js — Fase 130, cierre.
// Ejecuta el guardado REAL del archivo de Calidad de ORLANT (septiembre
// 2026, 95 monitoreos) por la UI real (Cargar Datos de Dashboards -> ORLANT
// -> archivo real de Descargas), con "sí" explícito del usuario y respaldo
// manual ya confirmado (integrity_check:ok, S3:OK, <1h de antiguedad).
//
// ANTES de guardar, verifica en el propio preview (ya parseado por el
// codigo real, _cargasResultados) que SOLO hay una seccion reconocida de
// tipo 'calidad' con EXACTO 95 filas -- aborta sin guardar si aparece
// cualquier otra cosa (otra seccion reconocida sin querer, un numero de
// filas distinto). No hay dialogo window.confirm en este flujo (a
// diferencia de Inasistencia/Agendas) -- _cargasGuardarCalidad llama
// directo a POST /monitoreos/bulk sin preguntar, asi que la defensa aqui es
// bloquear cualquier OTRA peticion de escritura que no sea esa.
//
// Playwright DIRECTO desde Node (headless:false), NO la extension de
// Claude in Chrome. SOLO imprime conteos -- nunca una fila cruda, nunca un
// nombre de asesor/evaluador, nunca un telefono/observacion.
'use strict';
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'server', 'node_modules', 'playwright'));

const BASE = 'https://informa.inconexion.com.co';
const LOGIN_TIMEOUT_MS = 10 * 60 * 1000;
const ARCHIVO = 'C:\\Users\\filid\\Downloads\\Copia de CALIDAD_CLINICA_ORLANT_2026 - Septiembre.xlsx';
const FILAS_ESPERADAS = 95;

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

    const erroresPagina = [];
    page.on('pageerror', (e) => erroresPagina.push('pageerror: ' + e.message));
    page.on('console', (msg) => { if (msg.type() === 'error') erroresPagina.push('console.error: ' + msg.text()); });

    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
    const logueado = await esperarLogin(page);
    if (!logueado) throw new Error('Se agotó el tiempo de espera de login.');
    log('Login detectado.');
    await page.waitForTimeout(500);

    // Defensa: cualquier escritura que NO sea el guardado de Calidad queda
    // bloqueada -- este script solo debe guardar ESO.
    const peticionesBloqueadas = [];
    await page.route('**/*', (route) => {
      const req = route.request();
      const m = req.method();
      const pathname = new URL(req.url()).pathname;
      // El servidor expone las rutas bajo un prefijo (API_BASE, ej. "/api")
      // -- se compara por sufijo exacto, igual que el resto de scripts de
      // scripts/produccion/, nunca por igualdad literal de la ruta completa.
      const permitido = /\/monitoreos\/bulk$/.test(pathname);
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(m) && !permitido) {
        peticionesBloqueadas.push(m + ' ' + pathname);
        return route.abort();
      }
      return route.continue();
    });

    await page.evaluate(() => openCargas());
    await page.waitForSelector('#carga-cliente', { state: 'visible', timeout: 10000 });
    await page.selectOption('#carga-cliente', { label: 'ORLANT' });
    await page.waitForTimeout(800);

    // Diagnostico (Fase 130, hallazgo): confirma que el plan consolidado de
    // ORLANT trae la seccion de Calidad ANTES de subir el archivo -- nunca
    // nombres, solo tipos/campañas (nombres de campaña no son PII).
    const diagPlan = await page.evaluate(() => ({
      campanasConPlantilla: Object.keys(window._cargasCalidadPorCampana || {}),
      planTipos: (window._cargasPlan || []).map((h) => ({ tipo: h.tipo, hoja: h.hoja })),
      clienteSeleccionado: document.getElementById('carga-cliente').value,
    }));
    log('Diagnostico del plan ANTES de subir archivo:', JSON.stringify(diagPlan));
    if (!diagPlan.planTipos.some((p) => p.tipo === 'calidad')) {
      throw new Error('El plan consolidado de ORLANT NO trae una seccion de Calidad -- NO SE SUBE EL ARCHIVO: ' + JSON.stringify(diagPlan));
    }

    log('Subiendo el archivo real (fuera del repo, Descargas)...');
    await page.setInputFiles('#carga-file', ARCHIVO);
    await page.waitForTimeout(6000);

    const errores = await page.evaluate(() => (document.getElementById('carga-errores') || {}).textContent || '');
    if (errores.trim()) log('Avisos mostrados en pantalla (preview):', errores.trim());
    const toastPreUpload = await page.evaluate(() => {
      const el = document.querySelector('.toast, #toast, [class*="toast"]');
      return el ? el.textContent : null;
    });
    if (toastPreUpload) log('Toast visible justo despues de subir el archivo:', toastPreUpload);
    const inputState = await page.evaluate(() => {
      const inp = document.getElementById('carga-file');
      return { tieneArchivo: !!(inp && inp.files && inp.files.length), nombreArchivoVar: window._cargasArchivoNombre || null };
    });
    log('Estado del input de archivo:', JSON.stringify(inputState));
    if (erroresPagina.length) log('Errores de pagina/consola capturados:', JSON.stringify(erroresPagina));

    // Verifica el preview YA parseado ANTES de tocar guardarCarga() --
    // SOLO tipos/conteos, nunca una fila.
    const previewCheck = await page.evaluate(() => {
      var resultados = window._cargasResultados || [];
      var tipos = resultados.map(function (r) { return { tipo: r.tipo, filas: r.filas ? r.filas.length : 0, titulo: r.titulo, error: r.error || null, vacia: !!r.vacia }; });
      var calidad = resultados.filter(function (r) { return r.tipo === 'calidad'; });
      // El plan consolidado de ORLANT SIEMPRE trae 14 "slots" (uno por tipo
      // de base posible) -- un archivo de SOLO Calidad hace que los otros 13
      // reporten "hoja ausente" (error, sin filas), eso es NORMAL y esperado
      // para este archivo, no una senal de alarma. Lo que SI importa:
      // ninguna OTRA seccion debe traer filas>0 (eso si seria una senal de
      // que el archivo se reconocio donde no debia).
      var otrasConFilas = resultados.filter(function (r) { return r.tipo !== 'calidad' && r.filas && r.filas.length > 0; });
      return {
        totalSecciones: resultados.length,
        tipos: tipos,
        calidadSecciones: calidad.length,
        calidadFilas: calidad.length === 1 && calidad[0].filas ? calidad[0].filas.length : null,
        calidadError: calidad.length === 1 ? (calidad[0].error || null) : null,
        otrasSeccionesConFilas: otrasConFilas.map(function (r) { return { tipo: r.tipo, filas: r.filas.length }; }),
      };
    });
    log('Preview ANTES de guardar:', JSON.stringify(previewCheck));

    if (previewCheck.calidadSecciones !== 1 || previewCheck.calidadFilas !== FILAS_ESPERADAS) {
      throw new Error('El preview NO tiene EXACTO 1 seccion de Calidad con 95 filas -- NO SE GUARDA: ' + JSON.stringify(previewCheck));
    }
    if (previewCheck.otrasSeccionesConFilas.length > 0) {
      throw new Error('Alguna OTRA seccion (no Calidad) trajo filas -- NO SE GUARDA: ' + JSON.stringify(previewCheck));
    }

    log('Preview OK (Calidad con 95 filas, ninguna otra seccion con datos). Guardando de verdad (guardarCarga())...');
    await page.evaluate(() => guardarCarga());
    await page.waitForTimeout(3000);

    const toast = await page.evaluate(() => {
      const el = document.querySelector('.toast, #toast, [class*="toast"]');
      return el ? el.textContent : null;
    });
    log('Mensaje final (toast) tras guardar:', toast);

    log('Peticiones de escritura bloqueadas fuera de /monitoreos/bulk (debe ser 0):', peticionesBloqueadas.length, JSON.stringify(peticionesBloqueadas));
    if (peticionesBloqueadas.length > 0) {
      throw new Error('Alguna petición de escritura ajena a /monitoreos/bulk intentó salir.');
    }

    // Verificacion post-guardado -- SOLO conteos/agregados, nunca un nombre.
    const verificacion = await page.evaluate(() => {
      return apiRequest('GET', '/monitoreos?campana=ORLANT&mes=2026-09').then(function (rows) {
        var asesores = {};
        var clasif = {};
        var sumaPuntaje = 0;
        rows.forEach(function (r) {
          asesores[r.asesor] = true;
          clasif[r.clasificacion] = (clasif[r.clasificacion] || 0) + 1;
          sumaPuntaje += r.puntaje || 0;
        });
        return {
          total: rows.length,
          asesoresDistintos: Object.keys(asesores).length,
          clasificacion: clasif,
          promedioPuntaje: rows.length ? Math.round((sumaPuntaje / rows.length) * 100) / 100 : null,
        };
      });
    });
    log('=== VERIFICACION POST-GUARDADO (JSON, sin nombres) ===');
    console.log(JSON.stringify(verificacion, null, 2));

    if (verificacion.total !== FILAS_ESPERADAS || verificacion.asesoresDistintos !== 19) {
      throw new Error('La verificacion post-guardado NO coincide con lo esperado (95 filas / 19 asesores): ' + JSON.stringify(verificacion));
    }

    console.log('\n=== OK: guardado ejecutado y verificado ===');
  } catch (e) {
    console.error('FALLO:', e.message);
    ok = false;
  } finally {
    if (browser) await browser.close();
  }
  process.exit(ok ? 0 : 1);
})();
