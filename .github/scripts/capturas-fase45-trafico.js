// capturas-fase45-trafico.js — QA de un solo uso para la Fase 45 (ajustes
// de Trafico de Llamadas + valores numericos visibles en las graficas).
//
// Captura, en claro Y oscuro, y en escritorio Y movil (~412px), las 6
// sub-pestanas del panel "Trafico de Llamadas" (Fase 40) para ORLANT:
// Resumen, Abandono, AHT, ASA y ATA, Wait Time, Niveles de Servicio.
//
// Pasar STATE=antes|despues por env decide el sufijo de archivo, para poder
// correr este mismo script dos veces (antes de los cambios de la Fase 45,
// con `git stash`, y despues) contra el MISMO seed de datos y comparar.
//
// Ademas de las capturas, imprime en JSON los valores NUMERICOS reales de
// las 5 tarjetas del resumen (Total/Contestadas/Abandonadas/Nivel
// Atencion/Tasa Abandono) para el mes visible — se compara antes/despues a
// mano (o con otro script) para confirmar que NINGUN dato cambio de valor,
// solo que se dejo de duplicar arriba.
//
// Credenciales: lee server/data/seed-demo-credenciales.txt (generado por
// `npm run seed:demo`, gitignored, nunca se imprime aqui) y usa el usuario
// ADMIN sembrado -- nunca el admin maestro real. Solo lectura: no sube
// cargas ni cambia configuracion.
'use strict';
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE = process.env.APP_URL || 'http://localhost:3000';
const STATE = process.env.STATE || 'despues'; // 'antes' | 'despues'
const OUT_DIR = process.env.OUT_DIR ||
  path.join(__dirname, '..', '..', 'docs', 'capturas-demo', 'fase45-trafico-y-valores');
const CRED_FILE = path.join(__dirname, '..', '..', 'server', 'data', 'seed-demo-credenciales.txt');

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 412, height: 915 };

const SUBTABS = [
  { key: 'resumen', label: 'resumen' },
  { key: 'abandono', label: 'abandono' },
  { key: 'aht', label: 'aht' },
  { key: 'asaata', label: 'asaata' },
  { key: 'wait', label: 'waittime' },
  { key: 'sl', label: 'sl' },
];

function leerCredencialAdmin() {
  const txt = fs.readFileSync(CRED_FILE, 'utf8');
  const linea = txt.split('\n').find((l) => l.startsWith('ADMIN\t'));
  if (!linea) throw new Error('No se encontro un usuario ADMIN en ' + CRED_FILE);
  const user = linea.match(/user:\s*(\S+)/)[1];
  const password = linea.match(/password:\s*(\S+)/)[1];
  return { user, password };
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT_DIR, name), fullPage: false });
}

async function setTema(page, tema) {
  await page.evaluate((t) => { if (typeof aplicarTema === 'function') aplicarTema(t); }, tema);
  await page.waitForTimeout(200);
}

async function capturarSubtabs(page, tema, vpName) {
  for (const st of SUBTABS) {
    await page.evaluate((key) => {
      if (typeof _traficoSwitchSubtab === 'function') _traficoSwitchSubtab(0, key);
    }, st.key);
    await page.waitForTimeout(900); // datos + Chart.js + datalabels
    // La franja global de KPIs (arriba de las pestanas) empuja el contenido
    // del tab fuera de la ventana visible en movil -- hay que bajar hasta
    // las sub-pestanas de Trafico antes de capturar, o siempre se veria el
    // mismo recorte (el header) sin importar la sub-pestana activa.
    await page.evaluate(() => {
      var el = document.getElementById('tv-subtabs-0');
      if (el) el.scrollIntoView({ block: 'start' });
    });
    await page.waitForTimeout(200);
    await shot(page, `trafico-${st.label}-${tema}-${vpName}-${STATE}.png`);
  }
}

(async () => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const { user, password } = leerCredencialAdmin();

  const browser = await chromium.launch();
  const resultado = { state: STATE };
  let ok = true;

  try {
    const page = await browser.newPage({ viewport: DESKTOP });
    page.on('dialog', (d) => d.accept());
    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
    await page.fill('#username', user);
    await page.fill('#password', password);
    await page.click('button.btn-login');
    await page.waitForTimeout(1200);
    const loginErr = await page.locator('#login-error').innerText().catch(() => '');
    if (loginErr && loginErr.trim()) throw new Error('Login fallo: ' + loginErr.trim());
    resultado.loginOk = true;

    await setTema(page, 'light');
    await page.evaluate(() => openGenericDashboard('ORLANT'));
    await page.waitForTimeout(1200);
    await page.evaluate(() => { if (typeof switchGenericTab === 'function') switchGenericTab('trafico'); });
    await page.waitForTimeout(1200);

    // ── Escritorio, claro ──
    await capturarSubtabs(page, 'claro', 'desktop');
    // Valores reales de las 5 tarjetas del resumen (para comparar antes/despues).
    await page.evaluate((key) => { if (typeof _traficoSwitchSubtab === 'function') _traficoSwitchSubtab(0, key); }, 'resumen');
    await page.waitForTimeout(700);
    resultado.kpisResumen = await page.evaluate(() => {
      var els = document.querySelectorAll('#tv-kpis-0 .aurora-kpi');
      return Array.from(els).map(function (el) {
        return {
          valor: (el.querySelector('.kv') || {}).textContent || null,
          etiqueta: (el.querySelector('.kl') || {}).textContent || null,
        };
      });
    });

    // ── Escritorio, oscuro ──
    await setTema(page, 'dark');
    await page.waitForTimeout(400);
    await capturarSubtabs(page, 'oscuro', 'desktop');

    // ── Movil, claro / oscuro ──
    await page.setViewportSize(MOBILE);
    await setTema(page, 'light');
    await page.waitForTimeout(400);
    await capturarSubtabs(page, 'claro', 'movil');
    await setTema(page, 'dark');
    await page.waitForTimeout(400);
    await capturarSubtabs(page, 'oscuro', 'movil');

    await page.setViewportSize(DESKTOP);
    await page.evaluate(() => { if (typeof closeGenericDashboard === 'function') closeGenericDashboard(); });
    await page.close();

    ok = resultado.loginOk;
    resultado.ok = ok;
    console.log(JSON.stringify(resultado, null, 2));
  } catch (e) {
    console.error('FALLO la verificacion:', e.message);
    console.log(JSON.stringify(resultado, null, 2));
    ok = false;
  } finally {
    await browser.close();
  }

  process.exit(ok ? 0 : 1);
})();
