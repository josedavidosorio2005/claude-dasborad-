// verificar-fase100-usuario-sin-admin-produccion.js — Fase 100, punto 3
// ("lo que ve el cliente"). Revision EN PRODUCCION, SOLO LECTURA: confirma
// que un usuario SIN rol de administrador, con acceso solo a ORLANT, ve
// UNICAMENTE ORLANT (nunca otros clientes), nunca los modulos de admin
// (Usuarios/Permisos/Cargar Datos/Dashboards/Inventario/Gerencia/Gestion
// Humana) ni un boton de carga, y que el dashboard se ve bien. Playwright
// directo desde Node (headless:false, navegador visible) -- NO la
// extension de Claude in Chrome. El usuario inicia sesion a mano con SU
// usuario sin admin; el script nunca ve ni escribe la contrasena, no
// persiste storageState ni cookies. No crea, sube, borra ni cambia nada.
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = 'https://informa.inconexion.com.co';
const DIR_EDWIN = 'C:\\Users\\filid\\Documents\\trabajo inconexion\\bases edwin';
const OUT_SHOTS = path.join(DIR_EDWIN, 'capturas-produccion', 'fase100-usuario-sin-admin');
const LOGIN_TIMEOUT_MS = 10 * 60 * 1000;

function log(...args) { console.log(new Date().toISOString(), ...args); }

async function shot(page, name) {
  try { await page.screenshot({ path: path.join(OUT_SHOTS, name), fullPage: false }); } catch (e) { log('WARN screenshot fallo:', e.message); }
}

async function esperarLogin(page) {
  log('=== INICIA SESIÓN AHORA, con tu usuario SIN ADMIN === (ventana visible, esperando hasta 10 min)');
  const deadline = Date.now() + LOGIN_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const logueado = await page.evaluate(() => typeof authToken !== 'undefined' && !!authToken).catch(() => false);
    if (logueado) return true;
    await page.waitForTimeout(3000);
  }
  return false;
}

(async () => {
  fs.mkdirSync(OUT_SHOTS, { recursive: true });
  const reporte = { hallazgos: [] };
  function hallazgo(sev, texto) { reporte.hallazgos.push({ sev, texto }); log(`[${sev}]`, texto); }

  let browser;
  try {
    browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
    const logueado = await esperarLogin(page);
    if (!logueado) throw new Error('Se agoto el tiempo de espera de login (10 min).');
    log('Login detectado, continuando automaticamente.');
    await page.waitForTimeout(1200);

    reporte.datosActor = await page.evaluate(() => ({
      rol: (typeof currentUser !== 'undefined' && currentUser) ? currentUser.rol : null,
      esAdmin: (typeof isFullAdmin === 'function') ? isFullAdmin() : null,
    })).catch(() => ({}));
    log('Actor:', JSON.stringify(reporte.datosActor));
    if (reporte.datosActor.esAdmin === true) {
      hallazgo('ALTO', 'El usuario con el que entraste SI tiene rol de administrador -- esta prueba necesita un usuario SIN admin.');
    }

    await shot(page, '01-pantalla-inicial.png');

    // ── Menu principal: que clientes/modulos se ven ─────────────────────
    const menuTexto = await page.evaluate(() => {
      var el = document.querySelector('#gd-menu, .dashboard-list, #dashboards-lista, nav, .sidebar');
      return document.body.innerText;
    });
    const clientesConocidos = ['CLINICA AURORA', 'HOSPITAL LA MARIA', 'BIVETT', 'ANDRES YEPES', 'MOVILIZE', 'SASCHA FITNESS', 'INFONDO', 'CONSULTORIO JULIAN MOLANO', 'CARTERA INTERNA', 'TELEVENTAS SURA', 'TELEVENTAS COMFAMA'];
    const otrosClientesVisibles = clientesConocidos.filter((c) => menuTexto.toUpperCase().includes(c));
    if (otrosClientesVisibles.length) hallazgo('ALTO', `Aparecen otros clientes ademas de ORLANT: ${otrosClientesVisibles.join(', ')}`);
    else log('Confirmado: ningun otro cliente visible en el texto de la pagina.');

    const modulosAdmin = ['Usuarios', 'Permisos', 'Cargar Datos', 'Dashboards', 'Inventario', 'Gerencia', 'Gestion Humana', 'Umbrales', 'Rol Reportes'];
    const modulosVisibles = [];
    for (const m of modulosAdmin) {
      const visible = await page.evaluate((texto) => {
        return Array.from(document.querySelectorAll('a, button, li')).some((el) => el.offsetParent !== null && el.textContent.trim().includes(texto));
      }, m);
      if (visible) modulosVisibles.push(m);
    }
    if (modulosVisibles.length) hallazgo('ALTO', `Se ven modulos de administrador: ${modulosVisibles.join(', ')}`);
    else log('Confirmado: ningun modulo de administrador visible (Usuarios/Permisos/Cargar Datos/Dashboards/Inventario/Gerencia/Gestion Humana/Umbrales/Rol Reportes).');

    await shot(page, '02-menu-principal.png');

    // ── Dentro de ORLANT: boton Exportar si, boton/enlace de carga no ───
    await page.evaluate(() => { if (typeof openGenericDashboard === 'function') openGenericDashboard('ORLANT'); });
    await page.waitForTimeout(1800);
    const dentroOrlant = await page.evaluate(() => {
      var botones = Array.from(document.querySelectorAll('button, a')).filter((el) => el.offsetParent !== null);
      return {
        exportar: botones.some((b) => b.textContent.trim() === 'Exportar'),
        cargar: botones.some((b) => /cargar datos|elegir archivo|subir archivo/i.test(b.textContent)),
        tituloVisible: document.body.innerText.includes('ORLANT'),
      };
    });
    log('Dentro de ORLANT:', JSON.stringify(dentroOrlant));
    if (!dentroOrlant.exportar) hallazgo('MEDIO', 'No se ve el boton "Exportar" dentro del dashboard de ORLANT (deberia verse, es de lectura).');
    if (dentroOrlant.cargar) hallazgo('ALTO', 'Se ve un boton/enlace de carga de archivos dentro del dashboard (no deberia, este usuario no tiene permiso de Cargar Datos).');
    await shot(page, '03-dentro-orlant.png');

    const erroresConsola = [];
    page.on('console', (m) => { if (m.type() === 'error' && !/favicon/i.test(m.text())) erroresConsola.push(m.text()); });
    await page.evaluate(() => switchGenericTab('inasistencia'));
    await page.waitForTimeout(1500);
    await shot(page, '04-inasistencia-pormes.png');
    await page.waitForTimeout(500);
    if (erroresConsola.length) hallazgo('MEDIO', `${erroresConsola.length} error(es) de consola: ${[...new Set(erroresConsola)].join(' | ')}`);

    fs.writeFileSync(path.join(OUT_SHOTS, 'reporte.json'), JSON.stringify(reporte, null, 2));
    log('=== RESUMEN ===');
    log('Hallazgos:', reporte.hallazgos.length);
    reporte.hallazgos.forEach((h) => log(`  [${h.sev}] ${h.texto}`));
    log('Capturas en:', OUT_SHOTS);
    log('=== FIN (navegador se cierra) ===');
  } catch (e) {
    console.error('FALLO:', e.message, e.stack);
  } finally {
    if (browser) await browser.close();
  }
})();
