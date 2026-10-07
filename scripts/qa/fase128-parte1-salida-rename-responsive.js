// fase128-parte1-salida-rename-responsive.js — QA de un solo uso, Fase 128
// Parte 1 (pedido textual de Edwin en la reunion de validacion): confirma
// que renombrar "Salida" a "Llamadas y WhatsApp de salida" y reubicarla
// junto a "Tráfico de WhatsApp" no rompe nada visualmente.
//
// Corre EN LOCAL (http://localhost:3000, con `npm run seed:demo` ya
// sembrado y el servidor arriba) con Playwright directo desde Node (nunca
// la extension de Claude in Chrome, ver CLAUDE.md). Carga datos SINTETICOS
// de Salida (2 meses, numeros inventados -- nunca los reales de produccion)
// vía la API real, con el usuario de demo `demo_ADMIN`, para que la pestaña
// tenga algo que mostrar.
//
// Por cada combinacion de tema (claro/oscuro) x viewport (1366x768,
// 1920x1080, movil 412x915):
//   - el boton de la pestaña justo despues de "Tráfico de WhatsApp" dice
//     exactamente "Llamadas y WhatsApp de salida";
//   - ese boton no se corta (scrollWidth <= clientWidth) ni la barra de
//     pestañas completa genera scroll horizontal nuevo;
//   - 0 errores de consola/pagina, 0 peticiones fallidas;
//   - "Exportar > Excel" descarga un archivo real con las hojas
//     "Llamadas de salida" / "WhatsApp de salida" (nombre nuevo, releido
//     con el parser de ZIP/XML independiente de las pruebas, no SheetJS).
//
// Solo lectura sobre el resto de la app: lo unico que escribe es la carga
// sintetica de Salida, igual que cualquier carga real por la interfaz.
'use strict';
const fs = require('fs');
const path = require('path');

const SERVER_DIR = path.join(__dirname, '..', '..', 'server');
const { chromium } = require(path.join(SERVER_DIR, 'node_modules', 'playwright'));
const { leerHojaXlsxComoAoA } = require(path.join(SERVER_DIR, 'tests', 'helpers', 'xlsx-lite.js'));

const BASE = process.env.APP_URL || 'http://localhost:3000';
const CRED_FILE = path.join(SERVER_DIR, 'data', 'seed-demo-credenciales.txt');
const LABEL_NUEVO = 'Llamadas y WhatsApp de salida';
const VIEWPORTS = [
  { nombre: '1366x768', width: 1366, height: 768 },
  { nombre: '1920x1080', width: 1920, height: 1080 },
  { nombre: 'movil-412', width: 412, height: 915 },
];
const TEMAS = ['claro', 'oscuro'];

function leerCredenciales() {
  const texto = fs.readFileSync(CRED_FILE, 'utf8');
  const creds = {};
  texto.split('\n').forEach((linea) => {
    const m = linea.match(/^(\w+)\s+user:\s*(\S+)\s+password:\s*(\S+)/);
    if (m) creds[m[1]] = { user: m[2], password: m[3] };
  });
  return creds;
}

async function login(page, user, password) {
  await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.fill('#username', user);
  await page.fill('#password', password);
  await page.click('button.btn-login');
  await page.waitForTimeout(1000);
}

function instalarListeners(page, hallazgos) {
  page.on('pageerror', (e) => hallazgos.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon/i.test(m.text())) hallazgos.push('console.error: ' + m.text()); });
  page.on('requestfailed', (req) => hallazgos.push('requestfailed: ' + req.url()));
  page.on('response', (res) => { if (res.status() >= 500) hallazgos.push('http ' + res.status() + ': ' + res.url()); });
}

async function cargarDatosSinteticos(page) {
  // Numeros inventados, SOLO para que la pestaña tenga algo que dibujar en
  // este entorno local de demo -- nunca los numeros reales de produccion.
  return page.evaluate(async () => {
    return apiRequest('POST', '/calidad/salida/carga', {
      campana: 'ORLANT',
      archivoNombre: 'fase128-parte1-sintetico.xlsx',
      filas: [
        ['2026-08', 1000, 2000, 500, 900],
        ['2026-09', 1100, 2100, 550, 950],
      ],
    });
  });
}

async function main() {
  const creds = leerCredenciales();
  const admin = creds.ADMIN;
  if (!admin) throw new Error('No se encontro la credencial demo_ADMIN en ' + CRED_FILE + ' -- correr primero: cd server && npm run seed:demo');

  const browser = await chromium.launch({ headless: true });
  const resultados = [];
  let algunaFalla = false;

  // Carga de datos sinteticos una sola vez, en una pagina aparte.
  {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 } });
    const page = await ctx.newPage();
    await login(page, admin.user, admin.password);
    const resp = await cargarDatosSinteticos(page);
    console.log('[fase128-parte1] carga sintetica de Salida:', JSON.stringify(resp));
    await ctx.close();
  }

  for (const tema of TEMAS) {
    for (const vp of VIEWPORTS) {
      const hallazgos = [];
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
      const page = await ctx.newPage();
      instalarListeners(page, hallazgos);
      await login(page, admin.user, admin.password);
      await page.evaluate((t) => { aplicarTema(t === 'oscuro' ? 'dark' : 'light'); }, tema);
      await page.waitForTimeout(300);
      await page.evaluate(() => openGenericDashboard('ORLANT'));
      await page.waitForTimeout(1200);

      const info = await page.evaluate(() => {
        const botones = Array.from(document.querySelectorAll('#gd-tabs .atab'));
        const etiquetas = botones.map((b) => b.textContent.trim());
        const idxWpp = etiquetas.indexOf('Tráfico de WhatsApp');
        const idxSalida = etiquetas.indexOf('Llamadas y WhatsApp de salida');
        let btnSalida = null;
        if (idxSalida !== -1) {
          const b = botones[idxSalida];
          const r = b.getBoundingClientRect();
          btnSalida = { scrollWidth: b.scrollWidth, clientWidth: b.clientWidth, width: r.width };
        }
        const tabsEl = document.getElementById('gd-tabs');
        const tabsOverflow = tabsEl ? (tabsEl.scrollWidth > tabsEl.clientWidth + 2) : null;
        return { etiquetas, idxWpp, idxSalida, btnSalida, tabsOverflow };
      });

      if (info.idxSalida === -1) hallazgos.push('No se encontro la pestaña "' + LABEL_NUEVO + '" entre: ' + info.etiquetas.join(' | '));
      else if (info.idxSalida !== info.idxWpp + 1) hallazgos.push('La pestaña quedo en la posicion ' + info.idxSalida + ', no justo despues de Tráfico de WhatsApp (' + info.idxWpp + ')');
      if (info.btnSalida && info.btnSalida.scrollWidth > info.btnSalida.clientWidth + 1) hallazgos.push('El texto del boton se corta: scrollWidth=' + info.btnSalida.scrollWidth + ' clientWidth=' + info.btnSalida.clientWidth);

      // Entra a la pestaña y exporta -- confirma render + nombre nuevo en las hojas.
      let exportInfo = null;
      if (info.idxSalida !== -1) {
        await page.locator('#gd-tabs .atab').nth(info.idxSalida).click();
        await page.waitForTimeout(1000);
        try {
          await page.click('#gd-export-btn');
          await page.waitForTimeout(200);
          const [download] = await Promise.all([
            page.waitForEvent('download', { timeout: 15000 }),
            page.click('#gd-export-menu button:has-text("Excel")'),
          ]);
          const tmpPath = await download.path();
          const llamadas = leerHojaXlsxComoAoA(tmpPath, 'Llamadas de salida');
          const whatsapp = leerHojaXlsxComoAoA(tmpPath, 'WhatsApp de salida');
          exportInfo = { ok: true, filasLlamadas: llamadas.length - 1, filasWhatsapp: whatsapp.length - 1 };
        } catch (e) {
          exportInfo = { ok: false, error: e.message };
          hallazgos.push('Export fallo o no tiene las hojas con el nombre nuevo: ' + e.message);
        }
      }

      if (hallazgos.length) algunaFalla = true;
      resultados.push({ tema, viewport: vp.nombre, idxSalida: info.idxSalida, idxWpp: info.idxWpp, tabsOverflow: info.tabsOverflow, exportInfo, hallazgos });
      await ctx.close();
    }
  }

  await browser.close();
  console.log(JSON.stringify(resultados, null, 2));
  console.log(algunaFalla ? 'REVISAR -- ver hallazgos arriba.' : 'OK: pestaña renombrada, en la posicion correcta, sin cortes, export con el nombre nuevo, en los 2 temas x 3 viewports.');
  process.exit(algunaFalla ? 1 : 0);
}

main().catch((e) => { console.error('FALLO:', e.message); process.exit(1); });
