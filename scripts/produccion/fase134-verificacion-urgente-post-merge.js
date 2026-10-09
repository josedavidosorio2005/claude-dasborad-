// fase134-verificacion-urgente-post-merge.js — PR #367 (Fase 134, Paso 2)
// se mergeo y desplego a produccion SIN el dry-run ni el "OK borrar"
// explicito que estaban pactados como condicion del Paso 3. Este script
// verifica, EN SOLO LECTURA y con el login del usuario (nunca ve ni
// guarda la contrasena), que ORLANT y MOBILIZE quedaron intactos despues
// de que la migracion fase134_borrar_clientes_v1 corriera en el deploy de
// las 2026-10-09T02:10-02:12 UTC. Playwright DIRECTO desde Node
// (headless: false), NO la extension de Claude in Chrome (CLAUDE.md).
'use strict';
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'server', 'node_modules', 'playwright'));

const BASE = process.env.APP_URL || 'https://informa.inconexion.com.co';
const LOGIN_TIMEOUT_MS = 10 * 60 * 1000;

function log(...args) { console.log(new Date().toISOString(), ...args); }

async function esperarLogin(page) {
  log('');
  log('##########################################################');
  log('##  INICIA SESION AHORA EN ESTA VENTANA (cuenta de administrador)');
  log('##  (tienes hasta 10 min)');
  log('##########################################################');
  log('');
  const deadline = Date.now() + LOGIN_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const logged = await page.evaluate(() => typeof authToken === 'string' && !!authToken).catch(() => false);
    if (logged) return true;
    await page.waitForTimeout(3000);
  }
  return false;
}

function sum(rows, campo) { return (rows || []).reduce((a, r) => a + (Number(r[campo]) || 0), 0); }

async function api(page, method, url) {
  return page.evaluate(({ method, url }) => apiRequest(method, url), { method, url });
}

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1366, height: 768 } });

  await page.goto(BASE, { waitUntil: 'load' });
  const loggedIn = await esperarLogin(page);
  if (!loggedIn) {
    log('No se detecto login dentro del tiempo limite. Cerrando sin verificar.');
    await browser.close();
    process.exit(1);
  }
  log('Login detectado. Continuando con la verificacion (todo GET, nada se escribe).');
  await page.waitForTimeout(1000);

  const esperado = {
    clientes: ['MOBILIZE', 'ORLANT'],
    orlantInasistenciaAgo: 11189,
    orlantInasistenciaSep: 12194,
    orlantCalidad: 95,
    orlantTipificacion: 34661,
    orlantAgendas: 24186,
    mobilizeFlujo: 27,
    mobilizeTipificacion: 167,
  };

  const hallazgos = [];
  const reporte = {};

  // 1) Clientes con dashboard configurado -- deben ser SOLO ORLANT y MOBILIZE.
  const clientesResp = await api(page, 'GET', '/dashboard/clientes');
  reporte.clientes = clientesResp.clientes;
  const clientesOrdenados = (clientesResp.clientes || []).slice().sort();
  if (JSON.stringify(clientesOrdenados) !== JSON.stringify(esperado.clientes)) {
    hallazgos.push(`Clientes configurados = ${JSON.stringify(clientesOrdenados)}, se esperaba ${JSON.stringify(esperado.clientes)}`);
  }

  // 2) ORLANT Inasistencia ago/sep (suma de `total` = citas totales del mes).
  const inasistAgo = await api(page, 'GET', '/calidad/inasistencia/resumen?campana=ORLANT&mes=2026-08');
  const inasistSep = await api(page, 'GET', '/calidad/inasistencia/resumen?campana=ORLANT&mes=2026-09');
  reporte.orlantInasistenciaAgo = inasistAgo.total;
  reporte.orlantInasistenciaSep = inasistSep.total;
  if (inasistAgo.total !== esperado.orlantInasistenciaAgo) {
    hallazgos.push(`ORLANT Inasistencia agosto = ${inasistAgo.total}, se esperaba ${esperado.orlantInasistenciaAgo}`);
  }
  if (inasistSep.total !== esperado.orlantInasistenciaSep) {
    hallazgos.push(`ORLANT Inasistencia septiembre = ${inasistSep.total}, se esperaba ${esperado.orlantInasistenciaSep}`);
  }

  // 3) ORLANT Calidad -- cantidad de monitoreos.
  const monitoreos = await api(page, 'GET', '/monitoreos?campana=ORLANT');
  reporte.orlantCalidad = monitoreos.length;
  if (monitoreos.length !== esperado.orlantCalidad) {
    hallazgos.push(`ORLANT Calidad (monitoreos) = ${monitoreos.length}, se esperaba ${esperado.orlantCalidad}`);
  }

  // 4) ORLANT Tipificacion -- total LLAMADAS + total WHATSAPP (el `total`
  // que devuelve por-tipo ya es el COUNT(*) real sin filtrar por mes).
  const tipifLlamadas = await api(page, 'GET', '/calidad/tipificacion/por-tipo?campana=ORLANT&canal=LLAMADAS');
  let tipifWhatsapp = { total: 0 };
  try { tipifWhatsapp = await api(page, 'GET', '/calidad/tipificacion/por-tipo?campana=ORLANT&canal=WHATSAPP'); } catch (e) { /* puede no existir el canal */ }
  const orlantTipifTotal = (tipifLlamadas.total || 0) + (tipifWhatsapp.total || 0);
  reporte.orlantTipificacion = orlantTipifTotal;
  reporte.orlantTipificacionDetalle = { llamadas: tipifLlamadas.total, whatsapp: tipifWhatsapp.total };
  if (orlantTipifTotal !== esperado.orlantTipificacion) {
    hallazgos.push(`ORLANT Tipificacion (LLAMADAS+WHATSAPP) = ${orlantTipifTotal}, se esperaba ${esperado.orlantTipificacion}`);
  }

  // 5) ORLANT Agendas -- suma de `cantidad` por mes (mensual = COUNT(*) real).
  const agendasMensual = await api(page, 'GET', '/calidad/agendas/mensual?campana=ORLANT');
  const orlantAgendasTotal = sum(agendasMensual, 'cantidad');
  reporte.orlantAgendas = orlantAgendasTotal;
  if (orlantAgendasTotal !== esperado.orlantAgendas) {
    hallazgos.push(`ORLANT Agendas = ${orlantAgendasTotal}, se esperaba ${esperado.orlantAgendas}`);
  }

  // 6) MOBILIZE flujo -- filas crudas de nivel-servicio/diario (sin agregar).
  const mobilizeDiario = await api(page, 'GET', '/calidad/nivel-servicio/diario?campana=MOBILIZE');
  reporte.mobilizeFlujo = mobilizeDiario.length;
  if (mobilizeDiario.length !== esperado.mobilizeFlujo) {
    hallazgos.push(`MOBILIZE flujo (nivel-servicio/diario) = ${mobilizeDiario.length}, se esperaba ${esperado.mobilizeFlujo}`);
  }

  // 7) MOBILIZE tipificacion.
  const mobilizeTipif = await api(page, 'GET', '/calidad/tipificacion/por-tipo?campana=MOBILIZE&canal=LLAMADAS');
  reporte.mobilizeTipificacion = mobilizeTipif.total;
  if (mobilizeTipif.total !== esperado.mobilizeTipificacion) {
    hallazgos.push(`MOBILIZE Tipificacion = ${mobilizeTipif.total}, se esperaba ${esperado.mobilizeTipificacion}`);
  }

  // 8) Usuarios -- nadie debe haber quedado con CERO cliente_/campana_ (la
  // migracion solo quita la clave de permiso del cliente eliminado, nunca
  // borra usuarios; si alguien queda en 0 accesos es una señal a revisar).
  const users = await api(page, 'GET', '/users');
  const sinAcceso = [];
  for (const u of users) {
    const perms = u.perms || {};
    const accesos = Object.keys(perms).filter((k) => (k.startsWith('cliente_') || k.startsWith('campana_')) && perms[k] === true);
    if (accesos.length === 0 && u.rol !== 'ADMIN' && u.rol !== 'AUX_ADMIN') {
      // Fase 137 (corrección antes de subir este script, hallazgo real al
      // revisarlo): nunca incluir u.nombre aquí -- este reporte se imprime
      // completo por consola (log abajo), y el repo es público. id + rol
      // ya alcanzan para que el usuario investigue el caso puntual.
      sinAcceso.push({ id: u.id, rol: u.rol });
    }
  }
  reporte.usuariosTotal = users.length;
  reporte.usuariosSinClienteOCampana = sinAcceso;
  if (sinAcceso.length > 0) {
    hallazgos.push(`${sinAcceso.length} usuario(s) no-admin sin NINGUN cliente_/campana_ asignado: ${JSON.stringify(sinAcceso)}`);
  }

  log('');
  log('=== REPORTE (solo numeros agregados, nunca filas individuales) ===');
  log(JSON.stringify(reporte, null, 2));
  log('');
  if (hallazgos.length === 0) {
    log('OK -- ORLANT y MOBILIZE cuadran exacto contra los numeros de control, y nadie no-admin quedo sin acceso.');
  } else {
    log('HALLAZGOS (revisar):');
    hallazgos.forEach((h) => log('  - ' + h));
  }

  await page.evaluate(() => apiRequest('POST', '/auth/logout').catch(() => {}));
  await browser.close();
  process.exit(hallazgos.length === 0 ? 0 : 1);
})();
