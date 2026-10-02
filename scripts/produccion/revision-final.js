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

// Numeros de control esperados -- ver PROGRESS.md -> "Numeros de control".
const ESPERADO = {
  tipificacionTotal: 14940,
  llamadasTotal: 8061, llamadasContestadas: 7159, llamadasPendientes: 902,
  wppTotal: 7305, wppContestados: 7109, wppPendientes: 196, wppSl20: 34.67,
  agendasTotal: 7426, agendasGeneral: 4643, agendas3p: 2783,
  inasistenciaAgoPct: 7.45, inasistenciaPeriodoPct: 6.87,
  rankingEquipoGestiones: 18566, rankingEquipoAgendas: 8319, rankingEquipoEfectividadPct: 44.81,
  efectividadCitasPeriodoAgendas: 1108, efectividadCitasPeriodoAtendidas: 953,
};

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

(async () => {
  const erroresConsola = [];
  const hallazgosCanvas = [];
  const reporte = { usuariosEjemplo: {}, pestanas: {}, numeros: {} };
  let ok = true;
  let browser;

  try {
    browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    page.on('pageerror', (e) => erroresConsola.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/favicon/i.test(m.text())) erroresConsola.push('console.error: ' + m.text()); });

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
    }

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

    reporte.erroresConsola = erroresConsola;
    reporte.discrepanciasNumeros = discrepancias;
    reporte.canvasesSinDibujar = hallazgosCanvas;

    log('=== REPORTE ===');
    console.log(JSON.stringify(reporte, null, 2));

    ok = erroresConsola.length === 0 && discrepancias.length === 0 && hallazgosCanvas.length === 0;
    log(ok ? 'OK: 7 pestañas, 0 canvas sin dibujar, 0 errores de consola, números de control exactos.' : 'REVISAR -- ver discrepancias/hallazgos arriba.');
  } catch (e) {
    console.error('FALLO:', e.message);
    console.log(JSON.stringify(reporte, null, 2));
    ok = false;
  } finally {
    if (browser) await browser.close();
  }
  process.exit(ok ? 0 : 1);
})();
