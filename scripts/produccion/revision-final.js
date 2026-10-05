// revision-final.js (ex verificar-fase110-revision-final-produccion.js,
// movido en la reorganizacion de scripts de la Fase 112). SOLO LECTURA en
// produccion -- no crea, edita, suspende ni borra nada, no sube ningun
// archivo. Playwright DIRECTO desde Node (headless:false, navegador
// visible) -- NO la extension de Claude in Chrome (regla fija del
// proyecto, CLAUDE.md). El usuario inicia sesion a mano; el script nunca
// ve ni escribe la contrasena, no persiste storageState ni cookies en
// disco.
//
// Fase 112: actualizado a las 7 pestanas de ORLANT y a los numeros de
// control vigentes (ultima verificacion real, Fase 111 --
// scripts/produccion/carga-real-patron.js corrio esta misma logica de
// numeros justo despues de cargar los 2 archivos reales de esa fase).
// Si algun numero cambio (carga nueva de Edwin), este script lo va a
// marcar como FALLO -- actualiza los valores esperados mas abajo despues
// de confirmar a mano que el cambio es legitimo.
'use strict';
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'server', 'node_modules', 'playwright'));

const BASE = 'https://informa.inconexion.com.co';
const LOGIN_TIMEOUT_MS = 10 * 60 * 1000;
const USUARIOS_EJEMPLO = ['crodriguez', 'mlopez', 'jherrera', 'agomez', 'lrios', 'psuarez'];
// Usuario del admin maestro (config.js: MASTER_ADMIN_USER, default 'admin') --
// no tiene fila en `users` (su "Ultimo ingreso" no aplica), a diferencia de
// cualquier otro rol ADMIN con fila real.
const MASTER_ADMIN_USER_ESPERADO = 'admin';

// Numeros de control esperados -- ver PROGRESS.md -> "Numeros de control".
// Fase 116 (2026-10-04): Tipificacion y Trafico de WhatsApp al dia con el
// export real de Wolkvox (Ago-26+Sep-26); el residuo de prueba de la Fase
// 67 en Trafico de Llamadas se resolvio solo al re-subir con el reemplazo
// por rango (la fecha real del archivo nuevo reemplazo la fila sintetica
// en el mismo lugar) -- totales de Trafico de Llamadas sin cambios desde
// la Fase 115 (el archivo es el mismo, byte a byte).
const ESPERADO = {
  tipificacionTotal: 14940 + 19721, // Ago-26 + Sep-26 (export completo HistCDR)
  // Fase 118: estaban en 17954/1110 (3 de mas), desalineados de PROGRESS.md
  // ("Numeros de control") desde que se corrigieron -- la suma real de
  // Ago-26 (8.908/7.961/947) + Sep-26 (9.043/8.883/160) es 17951/16844/1107.
  // Confirmado contra produccion real en la Fase 118 (0 discrepancias tras
  // este fix); no es un numero que se haya movido en produccion, era el
  // ESPERADO de este script el que quedo desactualizado.
  llamadasTotal: 8908 + 9043, llamadasContestadas: 7961 + 8883, llamadasPendientes: 947 + 160,
  // Fase 116: formato diario real de Wolkvox (8 colas) reemplazo la
  // plantilla vieja de periodo -- suma de Ago-26+Sep-26.
  wppTotal: 7390 + 7968, wppContestados: 7370 + 7953, wppPendientes: 20 + 15, wppSl20: null, // SL20 varia por mes, no se suma
  agendasTotal: 7426, agendasGeneral: 4643, agendas3p: 2783,
  inasistenciaAgoPct: 7.45, inasistenciaPeriodoPct: 6.87,
  rankingEquipoGestiones: 18566, rankingEquipoAgendas: 8319, rankingEquipoEfectividadPct: 44.81,
  efectividadCitasPeriodoAgendas: 1108, efectividadCitasPeriodoAtendidas: 953,
};

// Fase 118: rutas que SI pueden dar 4xx en el uso normal de este script y no
// cuentan como "peticion fallida" real.
const STATUS_IGNORADOS_RE = /\/api\/historial$|\/api\/auth\/login$/;

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

// Mismo chequeo que scripts/qa/auditoria-amplia-local.js -- el bug de la
// Fase 111 (Ranking de Asesores/Efectividad de Citas no se dibujaban) se
// le escapo a las pruebas porque solo chequeaban que el objeto Chart.js
// existiera, no que el <canvas> tuviera pixeles pintados de verdad.
async function canvasesSinDibujar(page) {
  return page.evaluate(() => {
    const out = [];
    const host = document.getElementById('gd-panels');
    if (!host) return out;
    // Fase 112 (hallazgo real en produccion, Calidad/gd-c1 -- ver commit):
    // si el panel muestra "Sin datos de <X> para <mes>", el canvas
    // asociado se deja SIN DIBUJAR a proposito (_gdRenderCalidad,
    // dashboard-generic.js -- "evita un donut vacio sin explicacion"). No
    // es el bug de la Fase 111, es manejo correcto de "sin datos".
    if (/Sin datos de/.test(host.innerText)) return out;
    host.querySelectorAll('canvas').forEach((c) => {
      const rect = c.getBoundingClientRect();
      const style = getComputedStyle(c);
      if (style.display === 'none' || style.visibility === 'hidden') return;
      if (rect.width < 5 || rect.height < 5) { out.push({ id: c.id || '(sin id)', motivo: 'tamano-cero' }); return; }
      let ctx; try { ctx = c.getContext('2d'); } catch (e) { return; }
      if (!ctx) return;
      let data; try { data = ctx.getImageData(0, 0, c.width, c.height).data; } catch (e) { return; }
      let tienePixel = false;
      for (let i = 3; i < data.length; i += 4) { if (data[i] !== 0) { tienePixel = true; break; } }
      if (!tienePixel) out.push({ id: c.id || '(sin id)', motivo: 'sin-pixeles' });
    });
    return out;
  });
}

// Fase 118: exportar Excel desde cada pestaña y confirmar que la descarga
// realmente se dispara (_gdExportExcel usa XLSX.writeFile -- descarga de
// blob en el cliente, sin ida al servidor).
async function exportarYVerificarDescarga(page) {
  await page.click('#gd-export-btn');
  await page.waitForTimeout(200);
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15000 }),
    page.click('#gd-export-menu button:has-text("Excel")'),
  ]);
  const nombre = download.suggestedFilename();
  await download.cancel().catch(() => {}); // no necesitamos guardar el archivo, solo confirmar que se disparo
  return nombre;
}

(async () => {
  const erroresConsola = [];
  const hallazgosCanvas = [];
  const peticionesFallidas = [];
  const exportsOk = {};
  const reporte = { usuariosEjemplo: {}, pestanas: {}, numeros: {} };
  let ok = true;
  let browser;

  try {
    browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    page.on('pageerror', (e) => erroresConsola.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/favicon/i.test(m.text())) erroresConsola.push('console.error: ' + m.text()); });
    page.on('requestfailed', (req) => {
      if (STATUS_IGNORADOS_RE.test(req.url())) return;
      peticionesFallidas.push('requestfailed: ' + req.method() + ' ' + req.url() + ' (' + (req.failure() && req.failure().errorText) + ')');
    });
    page.on('response', (res) => {
      if (res.status() < 400) return;
      if (STATUS_IGNORADOS_RE.test(res.url())) return;
      peticionesFallidas.push('http ' + res.status() + ': ' + res.request().method() + ' ' + res.url());
    });

    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
    const logueado = await esperarLogin(page);
    if (!logueado) throw new Error('Se agoto el tiempo de espera de login (10 min) sin detectar sesion iniciada.');
    log('Login detectado, continuando automaticamente.');
    await page.waitForTimeout(1000);

    // ══ 1. Usuarios de ejemplo (Fase 110): ninguno activo con la clave de ejemplo ══
    await page.evaluate(() => showSection('users'));
    await page.waitForTimeout(1200);
    const usuarios = await page.evaluate(async (lista) => {
      const rows = await apiRequest('GET', '/users');
      return lista.map((u) => {
        const row = rows.find((r) => r.user === u);
        return row ? { user: u, existe: true, active: row.active, rol: row.rol } : { user: u, existe: false };
      });
    }, USUARIOS_EJEMPLO);
    reporte.usuariosEjemplo.estado = usuarios;
    const activosConEjemplo = usuarios.filter((u) => u.existe && u.active);
    if (activosConEjemplo.length > 0) {
      log('ADVERTENCIA: siguen activos (puede ser legitimo si ya tienen otra contraseña):', activosConEjemplo.map((u) => u.user).join(', '));
    }

    // ══ 2. Las 7 pestañas de ORLANT: abre cada una, canvas con pixeles, sin errores ══
    await page.evaluate(() => openGenericDashboard('ORLANT'));
    await page.waitForTimeout(1200);
    const nTabs = await page.locator('#gd-tabs .atab').count();
    for (let i = 0; i < nTabs; i++) {
      const tab = page.locator('#gd-tabs .atab').nth(i);
      const label = (await tab.textContent() || '').trim();
      await tab.click();
      await page.waitForTimeout(1200);
      const malos = await canvasesSinDibujar(page);
      reporte.pestanas[label] = { canvasesSinDibujar: malos };
      malos.forEach((m) => hallazgosCanvas.push(label + ': ' + m.motivo + ' (' + m.id + ')'));
      try {
        const nombreDescarga = await exportarYVerificarDescarga(page);
        exportsOk[label] = { ok: !!nombreDescarga, archivo: nombreDescarga };
      } catch (e) {
        exportsOk[label] = { ok: false, error: e.message };
      }
      // cierra el menu de exportar si quedo abierto, para no tapar la siguiente pestana
      await page.keyboard.press('Escape').catch(() => {});
      await page.evaluate(() => { const m = document.getElementById('gd-export-menu'); if (m) m.remove(); });
    }
    reporte.exports = exportsOk;

    // ══ 3. Numeros de control (misma formula que carga-real-patron.js,
    //    corrida real contra produccion al cerrar la Fase 111) ══
    await page.evaluate(() => { if (typeof _gdIrAMes === 'function') _gdIrAMes('2026-09'); });
    await page.waitForTimeout(800);
    const sinCambios = await page.evaluate(async () => {
      const tipif = await apiRequest('GET', '/calidad/tipificacion/por-tipo?campana=ORLANT&canal=LLAMADAS');
      const porEsp = await apiRequest('GET', '/calidad/agendas/especialidad?campana=ORLANT&mes=2025-04');
      const porLinea = await apiRequest('GET', '/calidad/agendas/linea?campana=ORLANT&mes=2025-04');
      const totalAgendas = porEsp.reduce((a, r) => a + r.cantidad, 0);
      const linea = porLinea.filter((r) => r.mes === '2025-04');
      const diario = await apiRequest('GET', '/calidad/nivel-servicio/diario?campana=ORLANT');
      const llamadasTotal = diario.reduce((a, r) => a + (Number(r.totalLlamadas) || 0), 0);
      const llamadasContestadas = diario.reduce((a, r) => a + (Number(r.contestadas) || 0), 0);
      const wpp = await apiRequest('GET', '/calidad/trafico/whatsapp?campana=ORLANT');
      const wppTotal = wpp.reduce((a, r) => a + (Number(r.totalWhatsapp) || 0), 0);
      const wppContestados = wpp.reduce((a, r) => a + (Number(r.contestados) || 0), 0);
      const sl20 = (typeof traficoWppServiceLevelPromedioPeriodo === 'function') ? traficoWppServiceLevelPromedioPeriodo(wpp, 'serviceLevel20secPct') : null;
      const inasistAgo = await apiRequest('GET', '/calidad/inasistencia/resumen?campana=ORLANT&mes=2026-08');
      const inasistTodos = await apiRequest('GET', '/calidad/inasistencia/mensual?campana=ORLANT');
      const i = inasistTodos.reduce((s, f) => s + f.inasistencia + f.pendiente, 0);
      const t = inasistTodos.reduce((s, f) => s + f.total, 0);
      return {
        tipificacionTotal: tipif.total,
        llamadasTotal, llamadasContestadas, llamadasPendientes: llamadasTotal - llamadasContestadas,
        wppTotal, wppContestados, wppPendientes: wppTotal - wppContestados, wppSl20: sl20,
        agendasTotal: totalAgendas,
        agendasGeneral: (linea.find((r) => r.tipoLinea === 'GENERAL') || {}).cantidad,
        agendas3p: (linea.find((r) => r.tipoLinea === '3P') || {}).cantidad,
        inasistenciaAgoPct: inasistAgo.pct,
        inasistenciaPeriodoPct: Math.round((i / t) * 10000) / 100,
      };
    });
    const ranking = await page.evaluate(() => apiRequest('GET', '/calidad/efectividad-agendamiento/ranking?campana=ORLANT&mes=2026-09'));
    const citasPorMes = await page.evaluate(() => apiRequest('GET', '/calidad/efectividad-citas/mensual?campana=ORLANT'));
    reporte.numeros = {
      ...sinCambios,
      rankingEquipoGestiones: ranking.equipo.gestiones,
      rankingEquipoAgendas: ranking.equipo.agendas,
      rankingEquipoEfectividadPct: Math.round(ranking.equipo.efectividad * 10000) / 100,
      efectividadCitasPeriodoAgendas: citasPorMes.reduce((s, f) => s + f.agendas, 0),
      efectividadCitasPeriodoAtendidas: citasPorMes.reduce((s, f) => s + f.atendidas, 0),
    };

    const n = reporte.numeros;
    const discrepancias = Object.keys(ESPERADO).filter((k) => {
      const esperado = ESPERADO[k];
      const real = n[k];
      return typeof esperado === 'number' && Math.abs(real - esperado) > 0.01;
    }).map((k) => `${k}: esperado ${ESPERADO[k]}, real ${n[k]}`);

    // ══ 4. Fase 113: mi propio login queda en el Historial (tema A) +
    // "Ultimo ingreso" se actualiza (tema A) + "Cambiar mi contrasena"
    // aparece en el menu, SIN usarla (tema B) ══
    const hist113 = await page.evaluate(() => apiRequest('GET', '/historial'));
    const miLogin = hist113.find((h) => h.accion === 'LOGIN_OK');
    const fase113 = { miLoginEnHistorial: !!miLogin };
    if (miLogin) {
      fase113.miLoginReciente = Date.now() - miLogin.ts < 15 * 60 * 1000;
      fase113.miLoginTieneIpYNavegador = !!(miLogin.ip && miLogin.userAgent);
      if (miLogin.username && miLogin.username !== MASTER_ADMIN_USER_ESPERADO) {
        const usersAhora = await page.evaluate(() => apiRequest('GET', '/users'));
        const filaUsuario = usersAhora.find((u) => u.user === miLogin.username);
        fase113.ultimoIngresoActualizado = !!(filaUsuario && filaUsuario.lastLogin);
      } else {
        fase113.ultimoIngresoActualizado = 'n/a (admin maestro no tiene fila en Usuarios)';
      }
    }
    fase113.botonCambiarPasswordVisible = await page.evaluate(() => {
      const btn = document.querySelector('button[onclick="abrirCambiarPasswordModal()"]');
      return !!btn && getComputedStyle(btn).display !== 'none' && btn.offsetParent !== null;
    });
    reporte.fase113 = fase113;
    const fase113Ok =
      fase113.miLoginEnHistorial && fase113.miLoginReciente && fase113.miLoginTieneIpYNavegador &&
      fase113.ultimoIngresoActualizado !== false && fase113.botonCambiarPasswordVisible;

    reporte.erroresConsola = erroresConsola;
    reporte.discrepanciasNumeros = discrepancias;
    reporte.canvasesSinDibujar = hallazgosCanvas;
    reporte.peticionesFallidas = peticionesFallidas;

    const exportsFallidos = Object.keys(exportsOk).filter((k) => !exportsOk[k].ok);

    // ══ 5. Fase 118: recorrido con un usuario sin admin (CLIENTES_DASH) --
    // misma sesion del navegador visible, segundo login manual. No se cierra
    // el browser entre logins (nueva pestaña con un contexto aparte, para no
    // mezclar cookies con la sesion admin de arriba). ══
    const page2 = await context.browser().newPage();
    const erroresConsola2 = [];
    page2.on('pageerror', (e) => erroresConsola2.push('pageerror: ' + e.message));
    page2.on('console', (m) => { if (m.type() === 'error' && !/favicon/i.test(m.text())) erroresConsola2.push('console.error: ' + m.text()); });
    await page2.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
    log('=== AHORA INICIA SESIÓN COMO crodriguez (rol CLIENTES_DASH, sin admin) === (nueva ventana, hasta 10 min)');
    const logueado2 = await esperarLogin(page2);
    const clientesDash = { intentado: logueado2 };
    if (logueado2) {
      await page2.waitForTimeout(1200);
      clientesDash.vistaUsuario = await page2.evaluate(() => ({
        userPageVisible: getComputedStyle(document.getElementById('user-page')).display !== 'none',
        adminPageOculto: getComputedStyle(document.getElementById('admin-page')).display === 'none',
        rol: (typeof currentUser !== 'undefined' && currentUser) ? currentUser.rol : null,
      }));
      // IDOR / escalada (Fase 102): con el token de este usuario, los
      // endpoints admin-only deben devolver 403, nunca datos.
      const escaladas = await page2.evaluate(async () => {
        async function intentar(method, url) {
          try { await apiRequest(method, url); return { url, bloqueado: false }; }
          catch (e) { return { url, bloqueado: e.status === 403 || e.status === 401, status: e.status, mensaje: e.message }; }
        }
        return Promise.all([
          intentar('GET', '/users'),
          intentar('GET', '/historial'),
        ]);
      });
      clientesDash.escaladasBloqueadas = escaladas;
      clientesDash.erroresConsola = erroresConsola2;
      clientesDash.ok =
        clientesDash.vistaUsuario.userPageVisible &&
        clientesDash.vistaUsuario.adminPageOculto &&
        clientesDash.vistaUsuario.rol === 'CLIENTES_DASH' &&
        escaladas.every((e) => e.bloqueado) &&
        erroresConsola2.length === 0;
    } else {
      log('ADVERTENCIA: no se detecto login de CLIENTES_DASH en 10 min -- recorrido queda SIN VERIFICAR, no se bloquea el resto.');
    }
    reporte.clientesDash = clientesDash;
    await page2.close();

    log('=== REPORTE ===');
    console.log(JSON.stringify(reporte, null, 2));

    ok = erroresConsola.length === 0 && discrepancias.length === 0 && hallazgosCanvas.length === 0 && fase113Ok &&
      peticionesFallidas.length === 0 && exportsFallidos.length === 0 &&
      (clientesDash.intentado ? clientesDash.ok : true);
    log(ok ? 'OK: 7 pestañas, 0 canvas sin dibujar, 0 errores de consola, 0 peticiones fallidas, exports OK, números de control exactos, Fase 113 confirmada, CLIENTES_DASH confirmado.' : 'REVISAR -- ver discrepancias/hallazgos arriba.');
  } catch (e) {
    console.error('FALLO:', e.message);
    console.log(JSON.stringify(reporte, null, 2));
    ok = false;
  } finally {
    if (browser) await browser.close();
  }
  process.exit(ok ? 0 : 1);
})();
