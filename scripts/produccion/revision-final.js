// revision-final.js (ex verificar-fase110-revision-final-produccion.js,
// movido en la reorganizacion de scripts de la Fase 112). SOLO LECTURA en
// produccion -- no crea, edita, suspende ni borra nada, no sube ningun
// archivo. Playwright DIRECTO desde Node (headless:false, navegador
// visible) -- NO la extension de Claude in Chrome (regla fija del
// proyecto, CLAUDE.md). El usuario inicia sesion a mano; el script nunca
// ve ni escribe la contrasena, no persiste storageState ni cookies en
// disco.
//
// Fase 119: las 2 ventanas ya NO asumen un orden fijo (admin primero,
// cliente segundo) -- en la practica, 3 corridas seguidas de la Fase 119
// recibieron la cuenta del cliente en la PRIMERA ventana pese al aviso en
// pantalla (probable autocompletado del navegador). El script ahora
// DETECTA la identidad real de cada login por el JWT decodificado y
// corre el bloque de chequeos que corresponda, sin importar en que
// ventana se escribio cada cuenta -- la segunda ventana exige la
// identidad que todavia falte (si se repite la misma cuenta, lo dice
// claro y no sigue).
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

// Fase 120: referencia por skill/cola x mes, calculada LOCALMENTE a partir
// de los 3 archivos reales que mando InCo (TIPIFICACIONES.xlsx,
// LLAMADAS_PARA_PLATAFORMA*.xlsx, WPP_PARA_LA_PLATAFORMA*.xlsx -- 6
// archivos = 3 contenidos distintos, confirmado por hash/filas). Son
// AGREGADOS operativos (conteos de llamadas/chats por skill y mes), del
// mismo nivel de sensibilidad que la tabla "Numeros de control" que ya
// vive en PROGRESS.md -- nunca un dato de paciente. Sirve para una
// verificacion "dato por dato" mas fuerte que solo el total: cuenta de
// filas exacta + suma exacta por skill/mes + 0 duplicados.
const REFERENCIA_LLAMADAS = {
  'CALL INBOUND ORLANT 3P': { '2026-08': { total: 4010, contestadas: 3937 }, '2026-09': { total: 4264, contestadas: 4214 } },
  'CALL INBOUND ORLANT GENERAL': { '2026-08': { total: 4048, contestadas: 3222 }, '2026-09': { total: 4057, contestadas: 3958 } },
  'REGIMEN ESPECIALES': { '2026-08': { total: 850, contestadas: 802 }, '2026-09': { total: 722, contestadas: 711 } },
};
const REFERENCIA_LLAMADAS_FILAS = 150;

const REFERENCIA_WHATSAPP = {
  'WHATSAPP ORLANT 3P': { '2026-08': { total: 4712, contestados: 4697 }, '2026-09': { total: 5237, contestados: 5225 } },
  'WHATSAPP ORLANT GENERAL': { '2026-08': { total: 1471, contestados: 1467 }, '2026-09': { total: 1721, contestados: 1718 } },
  'WHATSAPP AUDIFONOS': { '2026-08': { total: 729, contestados: 729 }, '2026-09': { total: 746, contestados: 746 } },
  'WHATSAPP FONOAUDIOLOGIA': { '2026-08': { total: 187, contestados: 187 }, '2026-09': { total: 209, contestados: 209 } },
  'WHATSAPP VESTIBULAR': { '2026-08': { total: 196, contestados: 196 } },
  'WHATSAPP TINNITUS': { '2026-08': { total: 37, contestados: 37 } },
  'WHATSAPP FONIATRIA': { '2026-08': { total: 29, contestados: 29 }, '2026-09': { total: 54, contestados: 54 } },
  'WHATSAPP PAUTAS': { '2026-08': { total: 29, contestados: 28 }, '2026-09': { total: 1, contestados: 1 } },
};
const REFERENCIA_WHATSAPP_FILAS = 258;
const REFERENCIA_WHATSAPP_AHT_NUMERICAS_ESPERADAS = 0; // confirmado local: 258/258 filas traen "----"

const REFERENCIA_TIPIFICACION_SKILL_MES = {
  'LINEA DE SALIDA': { '2026-08': 6560, '2026-09': 10404 },
  'CALL INBOUND ORLANT 3P': { '2026-08': 3957, '2026-09': 4229 },
  'REGIMEN ESPECIALES': { '2026-08': 804, '2026-09': 719 },
  'CALL INBOUND ORLANT GENERAL': { '2026-08': 3229, '2026-09': 3971 },
  'CANCELACIONES Y REPROGRAMACION': { '2026-08': 390, '2026-09': 392 },
  'ATENCION TUTELAS': { '2026-09': 6 },
};
const REFERENCIA_TIPIFICACION_FILAS = 34661;

const OCULTAS_ESPERADAS = ['Ordenamiento Médico', 'Recuperación de Cancelados', 'Flujo Mensual', 'Salida', 'Gestión STA'];

function log(...args) { console.log(new Date().toISOString(), ...args); }

// Espera un login (cualquiera) y devuelve la identidad real decodificada del
// JWT -- nunca confia solo en `currentUser` del front (puede quedar null en
// una condicion de carrera justo despues del login).
async function esperarLoginYDecodificar(page, mensaje) {
  log('');
  log('##########################################################');
  log('##  INICIA SESIÓN AHORA EN ESTA VENTANA');
  log('##  >>> ' + mensaje + ' <<<');
  log('##  (tienes hasta 10 min)');
  log('##########################################################');
  log('');
  const deadline = Date.now() + LOGIN_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const tokenInfo = await page.evaluate(() => {
      if (typeof authToken !== 'string' || !authToken) return null;
      try {
        const payload = JSON.parse(atob(authToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        return { isMasterAdmin: !!payload.isMasterAdmin, rol: payload.rol || null, userId: payload.userId || null };
      } catch (e) { return null; }
    }).catch(() => null);
    if (tokenInfo) return tokenInfo;
    await page.waitForTimeout(3000);
  }
  return null;
}

function esAdmin(tokenInfo) { return !!tokenInfo && (tokenInfo.isMasterAdmin || tokenInfo.rol === 'ADMIN'); }
function esClienteDash(tokenInfo) { return !!tokenInfo && !tokenInfo.isMasterAdmin && tokenInfo.rol === 'CLIENTES_DASH'; }

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

// Fase 120: veredicto MAS PRECISO por sub-vista -- a diferencia de
// canvasesSinDibujar() (que SALTA todo el chequeo si aparece CUALQUIER
// "Sin datos de..." en el panel), esto distingue 3 casos reales:
//   'dibujo'          -- hay al menos un canvas visible con pixeles reales.
//   'mensaje_claro'   -- no hay canvas con pixeles, pero el panel SI trae un
//                        texto explicito tipo "Sin datos..."/"no disponible".
//   'EN_BLANCO'       -- no hay canvas con pixeles Y NO hay ningun mensaje
//                        explicando por que (el hallazgo que esta fase
//                        busca: el AHT de WhatsApp salia asi).
async function veredictoSubvista(page) {
  return page.evaluate(() => {
    const host = document.getElementById('gd-panels');
    if (!host) return { veredicto: 'sin-panel', texto: '' };
    const texto = (host.innerText || '').trim();
    const canvases = Array.from(host.querySelectorAll('canvas')).filter((c) => {
      const style = getComputedStyle(c);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });
    let algunConPixeles = false;
    canvases.forEach((c) => {
      const rect = c.getBoundingClientRect();
      if (rect.width < 5 || rect.height < 5) return;
      let ctx; try { ctx = c.getContext('2d'); } catch (e) { return; }
      if (!ctx) return;
      let data; try { data = ctx.getImageData(0, 0, c.width, c.height).data; } catch (e) { return; }
      for (let i = 3; i < data.length; i += 4) { if (data[i] !== 0) { algunConPixeles = true; break; } }
    });
    if (algunConPixeles) return { veredicto: 'dibujo', texto: texto.slice(0, 800), canvases: canvases.length };
    const hayMensajeExplicito = /sin datos|no disponible|no se entrega|no aplica|sin informaci[oó]n/i.test(texto);
    // Un host con texto MUY corto (sin tablas/tarjetas/leyendas) y sin
    // ningun canvas es sospechoso de estar genuinamente vacio aunque no
    // matchee el patron de mensaje -- se deja igual el texto completo
    // (recortado) en el reporte para que un humano lo revise.
    return {
      veredicto: hayMensajeExplicito ? 'mensaje_claro' : (texto.length < 3 ? 'EN_BLANCO' : 'revisar'),
      texto: texto.slice(0, 800),
      canvases: canvases.length,
    };
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

function instalarListeners(page, erroresConsola, peticionesFallidas) {
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
}

// ══════════════════════════════════════════════════════════════════
// Chequeos con la cuenta de ADMINISTRADOR
// ══════════════════════════════════════════════════════════════════
async function correrChequeosAdmin(page) {
  const erroresConsola = [];
  const peticionesFallidas = [];
  instalarListeners(page, erroresConsola, peticionesFallidas);
  const exportsOk = {};
  const hallazgosCanvas = [];
  const reporte = { pestanas: {} };

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
  reporte.usuariosEjemplo = { estado: usuarios };
  const activosConEjemplo = usuarios.filter((u) => u.existe && u.active);
  if (activosConEjemplo.length > 0) {
    log('ADVERTENCIA: siguen activos (puede ser legitimo si ya tienen otra contraseña):', activosConEjemplo.map((u) => u.user).join(', '));
  }

  // ══ 2. Las 7 pestañas de ORLANT, Y CADA SUB-VISTA (Fase 120: hallazgo de
  // fondo -- las Fases 112-119 solo miraban la sub-vista que abre por
  // defecto; asi se le escapo el AHT de WhatsApp en blanco). ══
  await page.evaluate(() => openGenericDashboard('ORLANT'));
  await page.waitForTimeout(1200);
  const subvistas = {};
  const enBlancoSinMensaje = [];
  const nTabs = await page.locator('#gd-tabs .atab').count();
  for (let i = 0; i < nTabs; i++) {
    const tab = page.locator('#gd-tabs .atab').nth(i);
    const label = (await tab.textContent() || '').trim();
    await tab.click();
    await page.waitForTimeout(1200);
    const malos = await canvasesSinDibujar(page);
    reporte.pestanas[label] = { canvasesSinDibujar: malos };
    malos.forEach((m) => hallazgosCanvas.push(label + ': ' + m.motivo + ' (' + m.id + ')'));

    subvistas[label] = {};
    const nSub = await page.locator('.gd-subtab-btn').count();
    if (nSub > 0) {
      for (let s = 0; s < nSub; s++) {
        const subBtn = page.locator('.gd-subtab-btn').nth(s);
        const subLabel = (await subBtn.textContent() || '').trim();
        await subBtn.click();
        await page.waitForTimeout(900);
        const v = await veredictoSubvista(page);
        subvistas[label][subLabel] = v;
        if (v.veredicto === 'EN_BLANCO') enBlancoSinMensaje.push(label + ' > ' + subLabel + ': "' + v.texto + '"');
      }
    } else {
      const v = await veredictoSubvista(page);
      subvistas[label]['(sin sub-pestañas)'] = v;
      if (v.veredicto === 'EN_BLANCO') enBlancoSinMensaje.push(label + ': "' + v.texto + '"');
    }

    try {
      const nombreDescarga = await exportarYVerificarDescarga(page);
      exportsOk[label] = { ok: !!nombreDescarga, archivo: nombreDescarga };
    } catch (e) {
      exportsOk[label] = { ok: false, error: e.message };
    }
    await page.keyboard.press('Escape').catch(() => {});
    await page.evaluate(() => { const m = document.getElementById('gd-export-menu'); if (m) m.remove(); });
  }
  reporte.exports = exportsOk;
  reporte.subvistas = subvistas;
  reporte.enBlancoSinMensaje = enBlancoSinMensaje;

  // ══ 2b. Fase 120: la sub-vista AHT de Tráfico de WhatsApp, puntual --
  // es el hallazgo original que disparo esta fase. La confirma explicita
  // aparte, con mas detalle, ademas del barrido generico de arriba. ══
  await page.locator('#gd-tabs .atab', { hasText: 'Tráfico de WhatsApp' }).first().click().catch(() => {});
  await page.waitForTimeout(1000);
  const ahtBtnWpp = page.locator('.gd-subtab-btn', { hasText: 'AHT' }).first();
  if (await ahtBtnWpp.count()) {
    await ahtBtnWpp.click();
    await page.waitForTimeout(900);
    reporte.ahtWhatsappVeredicto = await veredictoSubvista(page);
  } else {
    reporte.ahtWhatsappVeredicto = { veredicto: 'sub-pestaña-no-existe (puede ya estar quitada por el PR de esta fase)' };
  }

  // ══ 2c. Fase 120: recorte de cabecera a pantalla completa reportado por
  // InCo (~1878x850) -- confirma si "Dashboard Clínica Orlant" y el titulo
  // de seccion quedan tapados/cortados, midiendo posiciones reales, no
  // solo mirando una captura. ══
  await page.setViewportSize({ width: 1878, height: 850 }).catch(() => {});
  await page.waitForTimeout(500);
  reporte.recorteCabecera = await page.evaluate(() => {
    const out = { };
    const titulo = document.getElementById('gd-title');
    const barraFija = document.querySelector('#gd-tabs') || document.querySelector('.gd-header-fija');
    if (titulo) {
      const r = titulo.getBoundingClientRect();
      out.tituloRect = { top: r.top, bottom: r.bottom, visible: r.top >= 0 };
    }
    if (barraFija) {
      const r = barraFija.getBoundingClientRect();
      out.barraFijaRect = { top: r.top, bottom: r.bottom };
    }
    if (titulo && barraFija) {
      const rt = titulo.getBoundingClientRect(), rb = barraFija.getBoundingClientRect();
      out.tituloTapadoPorBarra = rt.bottom > rb.top && rt.top < rb.bottom;
    }
    return out;
  });
  await page.setViewportSize({ width: 1440, height: 900 }).catch(() => {});
  await page.waitForTimeout(500);

  // ══ 3. Numeros de control ══
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

  // ══ 3b. Fase 120: "dato por dato" contra los 3 archivos reales -- no
  // solo totales. Cuenta de filas exacta + suma exacta por skill/cola x
  // mes + 0 duplicados (skill|cola, fecha), para Llamadas, WhatsApp y
  // Tipificacion (esta ultima por skill x mes, ver REFERENCIA_* arriba). ══
  const datoPorDato = await page.evaluate(async (ref) => {
    const out = { llamadas: {}, whatsapp: {}, tipificacion: {} };

    const diario = await apiRequest('GET', '/calidad/nivel-servicio/diario?campana=ORLANT');
    out.llamadas.filasReales = diario.length;
    out.llamadas.filasEsperadas = ref.llamadasFilas;
    const clavesLl = diario.map((r) => r.skillName + '|' + r.fecha);
    out.llamadas.duplicados = clavesLl.length - new Set(clavesLl).size;
    out.llamadas.diferencias = [];
    for (const [skill, porMes] of Object.entries(ref.llamadas)) {
      for (const [mes, esperado] of Object.entries(porMes)) {
        const filasSkillMes = diario.filter((r) => r.skillName === skill && r.fecha.slice(0, 7) === mes);
        const total = filasSkillMes.reduce((a, r) => a + (Number(r.totalLlamadas) || 0), 0);
        const contestadas = filasSkillMes.reduce((a, r) => a + (Number(r.contestadas) || 0), 0);
        if (total !== esperado.total || contestadas !== esperado.contestadas) {
          out.llamadas.diferencias.push(`${skill} ${mes}: esperado ${esperado.total}/${esperado.contestadas}, real ${total}/${contestadas}`);
        }
      }
    }

    const wpp = await apiRequest('GET', '/calidad/trafico/whatsapp?campana=ORLANT');
    out.whatsapp.filasReales = wpp.length;
    out.whatsapp.filasEsperadas = ref.whatsappFilas;
    const clavesW = wpp.map((r) => r.colaWhatsapp + '|' + r.fechaInicio);
    out.whatsapp.duplicados = clavesW.length - new Set(clavesW).size;
    out.whatsapp.ahtNumericas = wpp.filter((r) => typeof r.ahtSegundos === 'number' && !isNaN(r.ahtSegundos)).length;
    out.whatsapp.diferencias = [];
    for (const [cola, porMes] of Object.entries(ref.whatsapp)) {
      for (const [mes, esperado] of Object.entries(porMes)) {
        const filasColaMes = wpp.filter((r) => r.colaWhatsapp === cola && r.fechaInicio.slice(0, 7) === mes);
        const total = filasColaMes.reduce((a, r) => a + (Number(r.totalWhatsapp) || 0), 0);
        const contestados = filasColaMes.reduce((a, r) => a + (Number(r.contestados) || 0), 0);
        if (total !== esperado.total || contestados !== esperado.contestados) {
          out.whatsapp.diferencias.push(`${cola} ${mes}: esperado ${esperado.total}/${esperado.contestados}, real ${total}/${contestados}`);
        }
      }
    }

    out.tipificacion.filasEsperadas = ref.tipifFilas;
    out.tipificacion.diferencias = [];
    let sumaTipifReal = 0;
    for (const [skill, porMes] of Object.entries(ref.tipificacion)) {
      for (const [mes, esperado] of Object.entries(porMes)) {
        const canal = 'LLAMADAS'; // las 3 skills de Tipificacion de este archivo son todas de voz
        const r = await apiRequest('GET', `/calidad/tipificacion/por-tipo?campana=ORLANT&canal=${canal}&skill=${encodeURIComponent(skill)}&mes=${mes}`);
        sumaTipifReal += r.total;
        if (r.total !== esperado) out.tipificacion.diferencias.push(`${skill} ${mes}: esperado ${esperado}, real ${r.total}`);
      }
    }
    out.tipificacion.sumaDeTodosLosSkillMesReferenciados = sumaTipifReal;

    return out;
  }, {
    llamadas: REFERENCIA_LLAMADAS, llamadasFilas: REFERENCIA_LLAMADAS_FILAS,
    whatsapp: REFERENCIA_WHATSAPP, whatsappFilas: REFERENCIA_WHATSAPP_FILAS,
    tipificacion: REFERENCIA_TIPIFICACION_SKILL_MES, tipifFilas: REFERENCIA_TIPIFICACION_FILAS,
  });
  reporte.datoPorDato = datoPorDato;

  // ══ 4. Fase 113: mi propio login queda en el Historial + "Ultimo ingreso"
  // se actualiza + "Cambiar mi contrasena" aparece en el menu, SIN usarla ══
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
  // Fase 119 (hallazgo real, falso negativo del PROPIO script): el DOM
  // tiene el MISMO boton "Cambiar mi contrasena" repetido una vez por
  // pagina (#admin-page, #user-page, #asesor-page, #supervisor-page,
  // todas presentes a la vez, solo una visible). document.querySelector
  // sin acotar a la pagina activa siempre agarra la PRIMERA en el DOM
  // (#admin-page, que aparece primero en index.html) -- para el chequeo de
  // CLIENTES_DASH esto dio un falso "no visible" porque el boton de
  // #admin-page esta oculto (esa pagina ni se muestra), nunca porque el
  // boton real de #user-page faltara. Acotar a la pagina activa.
  fase113.botonCambiarPasswordVisible = await page.evaluate(() => {
    const btn = document.querySelector('#admin-page button[onclick="abrirCambiarPasswordModal()"]');
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

  const datoPorDatoOk =
    datoPorDato.llamadas.filasReales === datoPorDato.llamadas.filasEsperadas &&
    datoPorDato.llamadas.duplicados === 0 && datoPorDato.llamadas.diferencias.length === 0 &&
    datoPorDato.whatsapp.filasReales === datoPorDato.whatsapp.filasEsperadas &&
    datoPorDato.whatsapp.duplicados === 0 && datoPorDato.whatsapp.diferencias.length === 0 &&
    datoPorDato.tipificacion.diferencias.length === 0;

  reporte.ok =
    erroresConsola.length === 0 && discrepancias.length === 0 && hallazgosCanvas.length === 0 &&
    fase113Ok && peticionesFallidas.length === 0 && exportsFallidos.length === 0 &&
    datoPorDatoOk && enBlancoSinMensaje.length === 0;

  // Cierra sesion admin antes de soltar esta pagina -- nunca deja el
  // navegador logueado como admin al terminar este bloque.
  await page.evaluate(() => apiRequest('POST', '/auth/logout').catch(() => {}));
  return reporte;
}

// ══════════════════════════════════════════════════════════════════
// Chequeos con la cuenta REAL del cliente (CLIENTES_DASH, solo ORLANT)
// ══════════════════════════════════════════════════════════════════
async function correrChequeosCliente(page) {
  const erroresConsola = [];
  const peticionesFallidas = [];
  instalarListeners(page, erroresConsola, peticionesFallidas);
  const clientesDash = {};

  clientesDash.vistaUsuario = await page.evaluate(() => ({
    userPageVisible: getComputedStyle(document.getElementById('user-page')).display !== 'none',
    adminPageOculto: getComputedStyle(document.getElementById('admin-page')).display === 'none',
    rolFrontend: (typeof currentUser !== 'undefined' && currentUser) ? currentUser.rol : null,
  }));

  // IDOR / escalada (Fase 102/118): con el token de este usuario, los
  // endpoints admin-only deben devolver 403/404, nunca datos. Estos 403
  // SON el resultado esperado y correcto -- Chrome igual los loguea como
  // console.error/requestfailed (ruido propio de la prueba, no un error
  // real de la app): se descarta todo lo que se acumule en esta ventana
  // (Fase 119, hallazgo real: antes inflaban erroresConsola/
  // peticionesFallidas y hacian fallar el chequeo aunque todo estuviera
  // correctamente bloqueado).
  const antesConsola = erroresConsola.length;
  const antesPeticiones = peticionesFallidas.length;
  const escaladas = await page.evaluate(async () => {
    async function intentar(method, url) {
      try { await apiRequest(method, url); return { url, bloqueado: false }; }
      catch (e) { return { url, bloqueado: e.status === 403 || e.status === 401 || e.status === 404, status: e.status, mensaje: e.message }; }
    }
    return Promise.all([
      intentar('GET', '/historial'),
      intentar('GET', '/seguridad/alertas'),
      intentar('GET', '/dashboards/config'),
      intentar('GET', '/dashboard/cargas'),
      intentar('GET', '/inventario/items'),
      intentar('GET', '/gerencia/kpis'),
      intentar('GET', '/gh/personal'),
    ]);
  });
  erroresConsola.length = antesConsola;
  peticionesFallidas.length = antesPeticiones;
  clientesDash.escaladasBloqueadas = escaladas;

  // Pestañas visibles: solo las 7 con datos reales, nunca las 5 que esperan
  // base de Edwin (dashboard-config-seed.js: oculta:true).
  await page.evaluate(() => openGenericDashboard('ORLANT'));
  await page.waitForTimeout(1200);
  const nTabsCliente = await page.locator('#gd-tabs .atab').count();
  const etiquetasTabs = [];
  for (let i = 0; i < nTabsCliente; i++) {
    etiquetasTabs.push(((await page.locator('#gd-tabs .atab').nth(i).textContent()) || '').trim());
  }
  clientesDash.pestanasVisibles = etiquetasTabs;
  clientesDash.pestanasOcultasFiltradas = OCULTAS_ESPERADAS.filter((o) => etiquetasTabs.includes(o));

  // Recorre las 7 pestañas reales: canvas con pixeles, Exportar funciona,
  // sin aviso "demo"/dato de prueba visible.
  const hallazgosCanvasCliente = [];
  const exportsCliente = {};
  const avisosDemo = [];
  for (let i = 0; i < nTabsCliente; i++) {
    const tab = page.locator('#gd-tabs .atab').nth(i);
    const label = ((await tab.textContent()) || '').trim();
    await tab.click();
    await page.waitForTimeout(1200);
    const malos = await canvasesSinDibujar(page);
    malos.forEach((m) => hallazgosCanvasCliente.push(label + ': ' + m.motivo + ' (' + m.id + ')'));
    const textoPanel = await page.evaluate(() => (document.getElementById('gd-panels') || {}).innerText || '');
    if (/\bdemo\b|datos? de prueba|ficticio/i.test(textoPanel)) avisosDemo.push(label);
    try {
      const nombreDescarga = await exportarYVerificarDescarga(page);
      exportsCliente[label] = { ok: !!nombreDescarga };
    } catch (e) {
      exportsCliente[label] = { ok: false, error: e.message };
    }
    await page.keyboard.press('Escape').catch(() => {});
    await page.evaluate(() => { const m = document.getElementById('gd-export-menu'); if (m) m.remove(); });
  }
  clientesDash.canvasesSinDibujar = hallazgosCanvasCliente;
  clientesDash.exports = exportsCliente;
  clientesDash.avisosDemoVisibles = avisosDemo;

  // Calidad: solo DESCRIBE lo que el cliente ve (catalogo de
  // codificaciones, cantidad de monitoreos) -- nunca toca nada, los 37
  // monitoreos de ORLANT esperan confirmacion de Edwin.
  clientesDash.calidadVista = await page.evaluate(async () => {
    try {
      const codifs = await apiRequest('GET', '/calidad/codificaciones?campana=ORLANT');
      const monitoreos = await apiRequest('GET', '/monitoreos?campana=ORLANT');
      return { codificacionesCount: Array.isArray(codifs) ? codifs.length : null, monitoreosCount: Array.isArray(monitoreos) ? monitoreos.length : null };
    } catch (e) { return { error: e.message }; }
  });

  // "Cambiar mi contraseña": carga y VALIDA (contraseña actual incorrecta
  // -> rechazo), nunca se envia una contraseña nueva real. Fase 119: acotar
  // a #user-page (ver el mismo comentario en correrChequeosAdmin) -- sin
  // esto, el boton identico y oculto de #admin-page daba un falso negativo.
  // Igual que en el bloque de escaladas: el 401 esperado de este PUT con
  // clave actual incorrecta no cuenta como ruido.
  const antesConsola2 = erroresConsola.length;
  const antesPeticiones2 = peticionesFallidas.length;
  clientesDash.cambiarPassword = await page.evaluate(async () => {
    const btn = document.querySelector('#user-page button[onclick="abrirCambiarPasswordModal()"]');
    const visible = !!btn && getComputedStyle(btn).display !== 'none' && btn.offsetParent !== null;
    if (!visible) return { visible: false };
    let rechazoOk = null;
    try {
      await apiRequest('PUT', '/auth/password', { currentPassword: 'esta-password-seguro-que-no-es-FASE119', newPassword: 'NoSeVaAUsar#2026xx' });
      rechazoOk = false; // si no lanzo, algo esta mal (acepto una clave actual incorrecta)
    } catch (e) {
      rechazoOk = e.status === 401 || e.status === 400;
    }
    return { visible: true, rechazoContrasenaActualIncorrecta: rechazoOk };
  });
  erroresConsola.length = antesConsola2;
  peticionesFallidas.length = antesPeticiones2;

  clientesDash.erroresConsola = erroresConsola;
  clientesDash.peticionesFallidas = peticionesFallidas;
  clientesDash.ok =
    clientesDash.vistaUsuario.userPageVisible &&
    clientesDash.vistaUsuario.adminPageOculto &&
    clientesDash.vistaUsuario.rolFrontend === 'CLIENTES_DASH' &&
    escaladas.every((e) => e.bloqueado) &&
    clientesDash.pestanasOcultasFiltradas.length === 0 &&
    hallazgosCanvasCliente.length === 0 &&
    Object.values(exportsCliente).every((e) => e.ok) &&
    avisosDemo.length === 0 &&
    clientesDash.cambiarPassword.visible && clientesDash.cambiarPassword.rechazoContrasenaActualIncorrecta === true &&
    erroresConsola.length === 0 && peticionesFallidas.length === 0;

  // Cierra sesion del cliente tambien, no deja el browser logueado con su
  // cuenta real al terminar.
  await page.evaluate(() => apiRequest('POST', '/auth/logout').catch(() => {}));
  return clientesDash;
}

async function paginaFresca(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.clearCookies();
  const page = await context.newPage();
  await page.addInitScript(() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} });
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
  return { context, page };
}

(async () => {
  const reporte = {};
  let ok = true;
  let browser;

  try {
    browser = await chromium.launch({ headless: false });

    // ── Ventana 1: cualquiera de las 2 cuentas, el script detecta cual es ──
    let { context: ctx1, page: page1 } = await paginaFresca(browser);
    const token1 = await esperarLoginYDecodificar(page1, 'con TU CUENTA DE ADMINISTRADOR *o* con LA CUENTA REAL DEL CLIENTE -- cualquiera de las 2, el script detecta cual es');
    if (!token1) throw new Error('Se agoto el tiempo de espera de login (10 min) en la primera ventana, sin detectar sesion iniciada.');
    await page1.waitForTimeout(1000);

    let reporteAdmin = null;
    let reporteCliente = null;
    let primeraFue;

    if (esAdmin(token1)) {
      primeraFue = 'admin';
      log('Identidad de la 1ra ventana: ADMIN (confirmado por JWT).');
      reporteAdmin = await correrChequeosAdmin(page1);
      reporte.admin = reporteAdmin;
      log('--- Chequeos de ADMIN terminados (se guardan ya, por si la 2da ventana falla) ---');
      console.log(JSON.stringify({ admin: reporteAdmin }, null, 2));
    } else if (esClienteDash(token1)) {
      primeraFue = 'cliente';
      log('Identidad de la 1ra ventana: CLIENTE CLIENTES_DASH (confirmado por JWT).');
      reporteCliente = await correrChequeosCliente(page1);
      reporte.clientesDash = reporteCliente;
      log('--- Chequeos de CLIENTES_DASH terminados (se guardan ya, por si la 2da ventana falla) ---');
      console.log(JSON.stringify({ clientesDash: reporteCliente }, null, 2));
    } else {
      throw new Error('La 1ra ventana no es ni admin ni CLIENTES_DASH (token: ' + JSON.stringify(token1) + '). Revisa con que cuenta iniciaste sesion.');
    }
    await ctx1.close();

    // ── Ventana 2: la identidad que todavia falte. Si se repite la misma
    // identidad de la ventana 1 (confusion de credenciales), esta vez NO
    // aborta -- avisa claro y se queda con lo que ya tiene de la ventana 1
    // (nunca se pierde un recorrido que SI se completo bien). ──
    const falta = primeraFue === 'admin' ? 'cliente' : 'admin';
    const { context: ctx2, page: page2 } = await paginaFresca(browser);
    const mensaje2 = falta === 'admin'
      ? 'con TU CUENTA DE ADMINISTRADOR (en la ventana anterior entraste con la del cliente -- ahora toca la tuya)'
      : 'con LA CUENTA REAL DEL CLIENTE, rol CLIENTES_DASH (en la ventana anterior entraste con la de administrador -- ahora toca la del cliente)';
    const token2 = await esperarLoginYDecodificar(page2, mensaje2);
    if (!token2) {
      log('ADVERTENCIA: no se detecto el segundo login (' + falta + ') en 10 min -- esa mitad queda SIN VERIFICAR, no se bloquea el resto.');
    } else {
      await page2.waitForTimeout(1000);
      if (falta === 'admin' && esAdmin(token2)) {
        log('Identidad de la 2da ventana: ADMIN (confirmado por JWT).');
        reporteAdmin = await correrChequeosAdmin(page2);
        reporte.admin = reporteAdmin;
      } else if (falta === 'cliente' && esClienteDash(token2)) {
        log('Identidad de la 2da ventana: CLIENTE CLIENTES_DASH (confirmado por JWT).');
        reporteCliente = await correrChequeosCliente(page2);
        reporte.clientesDash = reporteCliente;
      } else {
        log(
          'ADVERTENCIA: la 2da ventana debia ser la cuenta de ' + falta + ', pero el JWT dice otra cosa (' + JSON.stringify(token2) + '). ' +
          (esAdmin(token2) || esClienteDash(token2) ? 'Parece que se repitio la MISMA cuenta de la primera ventana.' : 'Esa cuenta no es ni admin ni CLIENTES_DASH.') +
          ' Esa mitad (' + falta + ') queda SIN VERIFICAR esta corrida -- se conserva lo que SI se completo.'
        );
      }
    }
    await ctx2.close();

    reporte.admin = reporteAdmin;
    reporte.clientesDash = reporteCliente;

    log('=== REPORTE COMPLETO ===');
    console.log(JSON.stringify(reporte, null, 2));

    ok = (reporteAdmin ? reporteAdmin.ok : false) && (reporteCliente ? reporteCliente.ok : false);
    if (!reporteAdmin) log('ADVERTENCIA: los chequeos de ADMIN no se corrieron.');
    if (!reporteCliente) log('ADVERTENCIA: los chequeos de CLIENTES_DASH no se corrieron.');
    log(ok ? 'OK: ambas cuentas verificadas, 0 discrepancias, 0 errores, exports OK.' : 'REVISAR -- ver discrepancias/hallazgos/advertencias arriba.');
  } catch (e) {
    console.error('FALLO:', e.message);
    console.log(JSON.stringify(reporte, null, 2));
    ok = false;
  } finally {
    if (browser) await browser.close();
  }
  process.exit(ok ? 0 : 1);
})();
