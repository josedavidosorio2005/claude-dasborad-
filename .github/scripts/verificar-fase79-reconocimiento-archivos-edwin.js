// verificar-fase79-reconocimiento-archivos-edwin.js — QA de un solo uso,
// Fase 79, LOCAL. Sube los 4 archivos reales (fuera del repo, en
// "bases edwin") a "Cargar Datos de Dashboards" (ORLANT) y verifica SOLO la
// vista previa (nombres de hoja, filas, avisos) -- nunca imprime ni
// consulta datos reales (nombres de pacientes en NOMBRE_ENTIDAD). No guarda
// ninguna carga (nunca hace click en "Guardar carga"): esto es diagnostico
// de reconocimiento de hojas, la carga real se hace aparte, en produccion,
// por separado.
'use strict';
const { chromium } = require('playwright');
const path = require('path');

const fs = require('fs');

const BASE = process.env.APP_URL || 'http://localhost:3000';
const ADMIN_USER = process.env.QA_ADMIN_USER || 'demo_admin';
// Nunca se pide por env var en texto plano en la linea de comandos: se lee
// directo del archivo local (gitignored, server/data/) que ya genera
// scripts/seed-demo.js -- asi nunca aparece la contrasena en ningun log de
// comandos ni en el historial de la sesion.
function leerPasswordAdmin() {
  if (process.env.QA_ADMIN_PW) return process.env.QA_ADMIN_PW;
  const credsPath = path.join(__dirname, '..', '..', 'server', 'data', 'seed-demo-credenciales.txt');
  const texto = fs.readFileSync(credsPath, 'utf8');
  const linea = texto.split('\n').find((l) => l.includes('user: ' + ADMIN_USER + '\t'));
  if (!linea) throw new Error('No se encontro la credencial de ' + ADMIN_USER + ' en ' + credsPath);
  const m = linea.match(/password:\s*(\S+)/);
  if (!m) throw new Error('No se pudo parsear la contrasena en: ' + credsPath);
  return m[1];
}
const ADMIN_PW = leerPasswordAdmin();
const DIR_EDWIN = 'C:\\Users\\filid\\Documents\\trabajo inconexion\\bases edwin';

const ARCHIVOS = [
  { nombre: 'ORLANT_agendas_abril_2025_PARA_CARGAR.xlsx', desc: 'Fase 78, hoja AGENDAS' },
  { nombre: 'ORLANT_tipificacion_llamadas_agosto_2026_PARA_CARGAR.xlsx', desc: 'Fase 77, hoja TIPIFICACION_LLAMADAS' },
  { nombre: 'AGENDAS.xlsx', desc: 'ORIGINAL de Edwin, hojas GRAFICA+DATA' },
  { nombre: 'BASE_PARA_TORTAS_DE_TIPIFICACION.xlsx', desc: 'ORIGINAL de Edwin, hojas GRAFICA+DATA' },
];

async function leerPreview(page) {
  return page.evaluate(() => {
    var filas = Array.from(document.querySelectorAll('#carga-preview-table tr')).slice(1);
    return filas.map(function (tr) {
      var tds = tr.querySelectorAll('td');
      return { hoja: tds[0] ? tds[0].textContent.trim() : '', tipo: tds[1] ? tds[1].textContent.trim() : '', estado: tds[2] ? tds[2].textContent.trim() : '' };
    });
  });
}

(async () => {
  if (!ADMIN_PW) { console.error('Falta QA_ADMIN_PW.'); process.exit(1); }

  const browser = await chromium.launch();
  const erroresConsola = [];
  const resultados = [];
  let ok = true;

  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('dialog', (d) => d.accept());
    page.on('pageerror', (e) => erroresConsola.push('pageerror: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/favicon/i.test(m.text())) erroresConsola.push('console.error: ' + m.text()); });

    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
    await page.fill('#username', ADMIN_USER);
    await page.fill('#password', ADMIN_PW);
    await page.click('button.btn-login');
    await page.waitForTimeout(1200);
    const loginErr = await page.locator('#login-error').innerText().catch(() => '');
    if (loginErr && loginErr.trim()) throw new Error('Login fallo: ' + loginErr.trim());

    await page.evaluate(() => openCargas());
    await page.waitForTimeout(800);
    await page.selectOption('#carga-cliente', 'ORLANT');
    await page.waitForTimeout(600);

    for (const archivo of ARCHIVOS) {
      const full = path.join(DIR_EDWIN, archivo.nombre);
      await page.setInputFiles('#carga-file', full);
      await page.waitForTimeout(2500); // archivos de 3-4 MB, dar tiempo a SheetJS
      const toastTexto = (await page.locator('#toast').innerText().catch(() => '')).trim();
      const previewVisible = await page.locator('#carga-preview-card').isVisible().catch(() => false);
      const preview = previewVisible ? await leerPreview(page) : [];
      const errores = (await page.locator('#carga-errores').innerText().catch(() => '')).trim();
      resultados.push({ archivo: archivo.nombre, desc: archivo.desc, toastTexto, previewVisible, preview, errores });
      // limpia para la siguiente iteracion sin guardar nada
      if (previewVisible) await page.evaluate(() => cancelarPreviewCarga());
      await page.waitForTimeout(300);
    }

    console.log(JSON.stringify({ resultados, erroresConsola }, null, 2));
    ok = erroresConsola.length === 0;
  } catch (e) {
    console.error('FALLO:', e.message);
    console.log(JSON.stringify({ resultados, erroresConsola }, null, 2));
    ok = false;
  } finally {
    await browser.close();
  }
  process.exit(ok ? 0 : 1);
})();
