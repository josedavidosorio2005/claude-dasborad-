// verificar-mapeo-skill-produccion.js — QA de un solo uso, invocado por
// .github/workflows/verificar-mapeo-skill-produccion.yml.
//
// Verifica, contra la PRODUCCION real, el formulario "Registrar skill
// nuevo" (Fase 32, auditoria del flujo de carga — hallazgo pendiente de la
// Fase 30): permitir registrar de antemano el mapeo SKILL_NAME (Wolkvox)
// -> campana, ANTES de que exista ningun archivo de Trafico que lo
// mencione. Reutiliza PUT /calidad/trafico/skills/:skillName tal cual (sin
// rutas nuevas).
//
// Casos probados en la pantalla "Metas Calidad" real:
//   1. SKILL_NAME vacio -> rechazo claro, SIN llamar al backend.
//   2. SKILL_NAME lleno, sin campana -> rechazo claro, SIN llamar al backend.
//   3. Camino feliz: SKILL_NAME + campana -> se registra, aparece en la
//      tabla de mapeos de inmediato (SIN recargar la pagina), y el campo de
//      texto queda limpio.
//   4. Reintentar el MISMO SKILL_NAME -> rechazado como duplicado (no se
//      deja que el upsert del backend lo pise en silencio).
//
// Usa un usuario TEMPORAL (creado y borrado por el workflow, directo en la
// base de datos — nunca via la API — con el permiso minimo `cargarDatos`,
// nunca rol admin, y NUNCA la contrasena maestra). El skill de prueba
// (identificable por el prefijo PROD_QA_VERIF_SKILL_MAPEO) lo borra el
// propio workflow en el paso siguiente (nunca queda en la base real).
'use strict';
const { chromium } = require('playwright');

const BASE = process.env.PROD_URL || 'https://inconexionpruebasclaude.duckdns.org';
const TEMP_USER = process.env.TEMP_USER;
const TEMP_PW = process.env.TEMP_PW;
const ARTIFACTS_DIR = process.env.ARTIFACTS_DIR || require('os').tmpdir();
const SKILL_NUEVO = 'PROD_QA_VERIF_SKILL_MAPEO_' + (process.env.GITHUB_RUN_ID || Date.now());

(async () => {
  if (!TEMP_USER || !TEMP_PW) {
    console.error('Faltan TEMP_USER/TEMP_PW en el entorno.');
    process.exit(1);
  }

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('dialog', (d) => d.accept());

  const resultado = {};
  let ok = true;

  try {
    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
    await page.fill('#username', TEMP_USER);
    await page.fill('#password', TEMP_PW);
    await page.click('button.btn-login');
    await page.waitForTimeout(1500);

    const loginError = await page.locator('#login-error').innerText().catch(() => '');
    if (loginError && loginError.trim()) {
      throw new Error('Login fallo. Mensaje del servidor: ' + loginError.trim());
    }
    const adminPageVisible = await page
      .locator('#admin-page')
      .evaluate((el) => getComputedStyle(el).display !== 'none')
      .catch(() => false);
    if (!adminPageVisible) {
      throw new Error('Login no entro al panel admin (se esperaba rol AUX_ADMIN). URL actual: ' + page.url());
    }
    resultado.loginOk = true;

    await page.evaluate(() => { if (typeof showSection === 'function') showSection('metas'); });
    await page.waitForTimeout(1200);

    const formVisible = await page.locator('#tv-skill-nuevo-btn').isVisible().catch(() => false);
    if (!formVisible) throw new Error('El formulario "Registrar skill nuevo" no esta visible para este usuario.');

    // ── 1. SKILL_NAME vacio -> rechazo claro, sin llamar al backend ──
    await page.selectOption('#tv-skill-nuevo-campana', 'ORLANT');
    await page.click('#tv-skill-nuevo-btn');
    await page.waitForTimeout(500);
    resultado.toastVacio = (await page.locator('#toast').innerText().catch(() => '')).trim();

    // ── 2. SKILL_NAME lleno, SIN campana -> rechazo claro ──
    await page.fill('#tv-skill-nuevo-nombre', SKILL_NUEVO);
    await page.selectOption('#tv-skill-nuevo-campana', '');
    await page.click('#tv-skill-nuevo-btn');
    await page.waitForTimeout(500);
    resultado.toastSinCampana = (await page.locator('#toast').innerText().catch(() => '')).trim();

    const antes = await page.locator('#tv-skills-tbody').innerText();
    resultado.antesNoContieneSkill = !antes.includes(SKILL_NUEVO);

    // ── 3. Camino feliz: SKILL_NAME + campana -> se registra y aparece ──
    // ── en la tabla de inmediato, SIN recargar la pagina ──
    await page.fill('#tv-skill-nuevo-nombre', SKILL_NUEVO);
    await page.selectOption('#tv-skill-nuevo-campana', 'ORLANT');
    await page.click('#tv-skill-nuevo-btn');
    await page.waitForTimeout(1200);
    resultado.toastExito = (await page.locator('#toast').innerText().catch(() => '')).trim();
    const despues = await page.locator('#tv-skills-tbody').innerText();
    resultado.despuesContieneSkill = despues.includes(SKILL_NUEVO);
    resultado.campoLimpio = await page.inputValue('#tv-skill-nuevo-nombre');
    await page.screenshot({ path: require('path').join(ARTIFACTS_DIR, '1-mapeo-skill-registrado.png'), fullPage: true });

    // ── 4. Reintentar el MISMO SKILL_NAME -> rechazado como duplicado ──
    await page.fill('#tv-skill-nuevo-nombre', SKILL_NUEVO);
    await page.selectOption('#tv-skill-nuevo-campana', 'CLINICA AURORA');
    await page.click('#tv-skill-nuevo-btn');
    await page.waitForTimeout(500);
    resultado.toastDuplicado = (await page.locator('#toast').innerText().catch(() => '')).trim();
    await page.screenshot({ path: require('path').join(ARTIFACTS_DIR, '2-mapeo-skill-duplicado-rechazado.png'), fullPage: true });

    ok =
      resultado.loginOk &&
      /Escribe el SKILL_NAME/.test(resultado.toastVacio) &&
      /Selecciona la campana/.test(resultado.toastSinCampana) &&
      resultado.antesNoContieneSkill &&
      /registrado y asignado a ORLANT/.test(resultado.toastExito) &&
      resultado.despuesContieneSkill &&
      resultado.campoLimpio === '' &&
      /ya existe en la tabla de abajo/.test(resultado.toastDuplicado);

    resultado.skillNuevo = SKILL_NUEVO;
    resultado.ok = ok;
    console.log(JSON.stringify(resultado, null, 2));
  } catch (e) {
    console.error('FALLO la verificacion:', e.message);
    resultado.skillNuevo = SKILL_NUEVO;
    console.log(JSON.stringify(resultado, null, 2));
    ok = false;
  } finally {
    await browser.close();
  }

  process.exit(ok ? 0 : 1);
})();
