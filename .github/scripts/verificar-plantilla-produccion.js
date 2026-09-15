// verificar-plantilla-produccion.js — QA de un solo uso, invocado por
// .github/workflows/verificacion-plantilla-produccion.yml.
//
// Verifica, contra la PRODUCCION real, que el boton "Descargar plantilla"
// del modulo de Trafico entrega el archivo oficial byte a byte identico al
// que vive en el repo (server/plantillas/PLANTILLA_TRAFICO_INCONEXION_VACIA.xlsx).
//
// Usa un usuario TEMPORAL (creado y borrado por el workflow, directo en la
// base de datos — nunca via la API — con el permiso minimo `cargarDatos`,
// nunca rol admin). La contrasena llega por la variable de entorno TEMP_PW,
// ya registrada como "masked" por el paso anterior del workflow
// (`::add-mask::`) — este script JAMAS la imprime, ni en exito ni en error,
// para que nunca quede en el log del workflow ni en ningun otro lado.
'use strict';
const { chromium } = require('playwright');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');

const BASE = process.env.PROD_URL || 'https://inconexionpruebasclaude.duckdns.org';
const TEMP_USER = process.env.TEMP_USER;
const TEMP_PW = process.env.TEMP_PW;
const REAL_FILE = path.join(__dirname, '..', '..', 'server', 'plantillas', 'PLANTILLA_TRAFICO_INCONEXION_VACIA.xlsx');

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

(async () => {
  if (!TEMP_USER || !TEMP_PW) {
    console.error('Faltan TEMP_USER/TEMP_PW en el entorno.');
    process.exit(1);
  }

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  let ok = false;

  try {
    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
    await page.fill('#username', TEMP_USER);
    await page.fill('#password', TEMP_PW);
    await page.click('button.btn-login');
    await page.waitForTimeout(1500);

    const loginError = await page.locator('#login-error').innerText().catch(() => '');
    if (loginError && loginError.trim()) {
      // El mensaje de error del servidor nunca incluye la contrasena — seguro de imprimir.
      console.error('Login fallo. Mensaje del servidor:', loginError.trim());
      process.exit(1);
    }

    // El usuario temporal es rol CALIDAD (no admin): el item de menu "Metas
    // Calidad" del sidebar esta gateado por ROL en session.js (solo ADMIN lo
    // ve), pero el permiso REAL que importa (canLoadData, server-side) ya lo
    // tiene este usuario — por eso se entra a la seccion directo en vez de
    // depender de un link de menu pensado solo para administradores.
    await page.evaluate(() => {
      if (typeof showSection === 'function') showSection('metas');
    });
    await page.waitForTimeout(1200);

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 15000 }),
      page.click('button[onclick="descargarPlantillaTrafico()"]'),
    ]);
    const tmpPath = path.join(os.tmpdir(), 'plantilla-descargada-produccion.xlsx');
    await download.saveAs(tmpPath);

    const descargado = fs.readFileSync(tmpPath);
    const real = fs.readFileSync(REAL_FILE);
    const hashDescargado = sha256(descargado);
    const hashReal = sha256(real);
    ok = hashDescargado === hashReal && descargado.length === real.length;

    console.log(
      JSON.stringify(
        {
          loginOk: true,
          descargaOk: true,
          tamanoDescargadoBytes: descargado.length,
          tamanoRealBytes: real.length,
          sha256Descargado: hashDescargado,
          sha256Real: hashReal,
          identicoByteAByte: ok,
        },
        null,
        2
      )
    );

    fs.unlinkSync(tmpPath);
  } catch (e) {
    console.error('FALLO la verificacion:', e.message);
    process.exitCode = 1;
    ok = false;
  } finally {
    await browser.close();
  }

  process.exit(ok ? 0 : 1);
})();
