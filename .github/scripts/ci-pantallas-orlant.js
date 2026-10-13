// ci-pantallas-orlant.js — Fase 112, Parte 1.2 (autorizado): job nuevo de
// CI que recorre ORLANT (admin, cada pestana y sub-pestana real, claro,
// escritorio) con Playwright headless y falla si hay un error de consola,
// una peticion fallida inesperada (los 403 de permisos no cuentan), una
// respuesta 5xx, o un <canvas> dentro de #gd-panels sin pixeles pintados
// -- el bug de la Fase 111 (Ranking de Asesores / Efectividad de Citas no
// se dibujaban) que se le escapo a las pruebas porque solo chequeaban que
// el objeto Chart.js existiera, nunca el canvas real (ver tambien
// .github/scripts/verificar-fase102-auditoria-amplia-local.js, la version
// amplia de este mismo chequeo para QA manual).
//
// Deliberadamente LIVIANO (un solo rol, un solo tema/viewport, sin
// Exportar): es un smoke test de "no se rompio nada visible", pensado para
// correr en cada PR en menos de 5 minutos -- la auditoria completa
// (todos los roles, temas, viewports, exports) es manual, ver
// verificar-fase102-auditoria-amplia-local.js.
//
// Fase 120 (verificacion de produccion que encontro el AHT de WhatsApp en
// blanco, Part 3 "que esto no vuelva a pasar"): ya recorria cada sub-pestana
// de cada pestaña (el bucle de `.gd-subtab-btn` de abajo, generico para
// Trafico voz/WhatsApp Y para cualquier tab.subtabs configurado via
// dashboard-generic.js) -- lo que faltaba es que un canvas OCULTO a
// proposito (serie vacia) nunca se revisaba mas alla de "esta oculto, debe
// estar bien" -- ahora confirma que de verdad quedo un mensaje ".oc-nodata"
// visible y con texto cerca (ver canvasesSinDibujar).
'use strict';
const fs = require('fs');
const path = require('path');

const SERVER_DIR = path.join(__dirname, '..', '..', 'server');
const { chromium } = require(path.join(SERVER_DIR, 'node_modules', 'playwright'));
const BASE = process.env.APP_URL || 'http://localhost:3000';
const CRED_FILE = path.join(SERVER_DIR, 'data', 'seed-demo-credenciales.txt');
const CAPTURAS_DIR = path.join(SERVER_DIR, 'ci-capturas-fallo');

function leerAdmin() {
  const texto = fs.readFileSync(CRED_FILE, 'utf8');
  const m = texto.match(/^ADMIN\tuser:\s*(\S+)\s+password:\s*(\S+)/m);
  if (!m) throw new Error('No se encontraron credenciales ADMIN en ' + CRED_FILE);
  return { user: m[1], password: m[2] };
}

async function canvasesSinDibujar(page) {
  return page.evaluate(() => {
    const out = [];
    const host = document.getElementById('gd-panels');
    if (!host) return out;
    // Fase 112 (hallazgo real en produccion, Calidad/gd-c1): si el panel
    // esta mostrando un aviso de "Sin datos de <X> para <mes>" (los 5
    // paneles autonomos -- Agendas/Inasistencia/Tipificacion/Efectividad/
    // Calidad -- lo hacen con mesSel sin datos), el canvas asociado se
    // deja SIN DIBUJAR a proposito (ver _gdRenderCalidad en
    // dashboard-generic.js, "evita un donut vacio sin explicacion") --
    // eso no es el bug de la Fase 111, es manejo correcto de "sin datos".
    if (/Sin datos de/.test(host.innerText)) return out;
    host.querySelectorAll('canvas').forEach((c) => {
      const rect = c.getBoundingClientRect();
      const style = getComputedStyle(c);
      if (style.display === 'none' || style.visibility === 'hidden') {
        // Fase 120 (que esto no vuelva a pasar -- el AHT de WhatsApp quedo
        // en blanco sin que ninguna verificacion anterior lo notara): hasta
        // aqui, un canvas OCULTO a proposito (serie vacia, _gdChart lo
        // esconde y agrega un aviso ".oc-nodata", Fase 90) se daba por bien
        // manejado sin revisar nada mas -- si por lo que fuera el aviso no
        // se llegaba a insertar, este chequeo nunca lo habria visto. Ahora
        // confirma que SI quedo un mensaje visible y con texto cerca.
        const contenedor = c.closest('.aurora-card') || c.closest('.aurora-chart-wrap') || c.parentElement;
        const aviso = contenedor ? contenedor.querySelector('.oc-nodata') : null;
        const avisoVisible = !!(aviso && aviso.offsetParent !== null && aviso.textContent.trim().length > 0);
        if (!avisoVisible) {
          out.push({ id: c.id || '(sin id)', motivo: 'oculto-sin-mensaje-de-aviso' });
        }
        return;
      }
      if (rect.width < 5 || rect.height < 5) {
        out.push({ id: c.id || '(sin id)', motivo: 'tamano-cero-en-pantalla', width: rect.width, height: rect.height });
        return;
      }
      let ctx;
      try { ctx = c.getContext('2d'); } catch (e) { return; }
      if (!ctx) return;
      let data;
      try { data = ctx.getImageData(0, 0, c.width, c.height).data; } catch (e) {
        out.push({ id: c.id || '(sin id)', motivo: 'error-leyendo-canvas', error: e.message });
        return;
      }
      let tienePixel = false;
      for (let i = 3; i < data.length; i += 4) { if (data[i] !== 0) { tienePixel = true; break; } }
      if (!tienePixel) out.push({ id: c.id || '(sin id)', motivo: 'sin-pixeles-dibujados', width: c.width, height: c.height });
    });
    return out;
  });
}

// Fase 139 (hallazgo real en produccion, Mobilize): las pestanas se movian
// ~14px hacia abajo un instante DESPUES de dibujarse -- el logo del cliente
// en la cabecera media 11px de alto mientras su imagen cargaba y 25px al
// terminar (la regla CSS `height:auto` anulaba la reserva de width/height
// del <img>), y un clic rapido caia en otra pestana. Abre el dashboard y
// registra, fotograma a fotograma desde el PRIMER dibujo de #gd-tabs, su
// posicion de layout (offsetTop: no la afecta la animacion de apertura del
// modal, que es solo transform). Devuelve las posiciones distintas vistas
// y si en algun fotograma se vio el logo de OTRO cliente (el navegador
// conserva la imagen anterior mientras carga la nueva: un <img> visible
// con complete === false esta mostrando la imagen VIEJA).
async function posicionesPestanasAlAbrir(page, cliente) {
  return page.evaluate((c) => new Promise((resolve) => {
    const vistas = [];
    let logoAjeno = false;
    let frames = 0;
    let conTabs = 0;
    openGenericDashboard(c); // vacia #gd-tabs en el acto: nada viejo se mide
    const tick = () => {
      const tabs = document.getElementById('gd-tabs');
      if (tabs && tabs.querySelector('.atab')) {
        conTabs++;
        const aviso = !!document.getElementById('gd-nodata-banner');
        const k = tabs.offsetTop;
        if (!vistas.length || vistas[vistas.length - 1].top !== k) vistas.push({ top: k, aviso, frameConTabs: conTabs });
        const logo = document.getElementById('gd-cliente-logo');
        const st = logo && getComputedStyle(logo);
        if (logo && st.display !== 'none' && st.visibility !== 'hidden' && !logo.complete) logoAjeno = true;
      }
      // ~1.5s desde que aparecen las pestanas (el logo se retrasa 600ms).
      if (++frames < 600 && conTabs < 90) requestAnimationFrame(tick);
      else resolve({ vistas, logoAjeno });
    };
    requestAnimationFrame(tick);
  }), cliente);
}

(async () => {
  fs.mkdirSync(CAPTURAS_DIR, { recursive: true });
  const admin = leerAdmin();
  const hallazgos = [];
  let ctxActual = 'arranque';

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  page.on('pageerror', (err) => hallazgos.push({ tipo: 'pageerror', ctx: ctxActual, msg: err.message }));
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const txt = msg.text();
    if (/favicon/i.test(txt)) return;
    hallazgos.push({ tipo: 'console.error', ctx: ctxActual, msg: txt });
  });
  page.on('requestfailed', (req) => {
    hallazgos.push({ tipo: 'request-failed', ctx: ctxActual, url: req.url(), error: req.failure() && req.failure().errorText });
  });
  page.on('response', (res) => {
    const st = res.status();
    if (st === 403) return; // permisos esperados segun el rol
    if (st >= 500) hallazgos.push({ tipo: 'response-5xx', ctx: ctxActual, url: res.url(), status: st });
  });

  try {
    ctxActual = 'login ADMIN';
    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
    await page.fill('#username', admin.user);
    await page.fill('#password', admin.password);
    await page.click('button.btn-login');
    await page.waitForTimeout(1000);

    ctxActual = 'abrir ORLANT';
    await page.evaluate(() => openGenericDashboard('ORLANT'));
    await page.waitForTimeout(1200);

    const nTabs = await page.locator('#gd-tabs .atab').count();
    for (let i = 0; i < nTabs; i++) {
      const tab = page.locator('#gd-tabs .atab').nth(i);
      const label = (await tab.textContent() || '').trim();
      await tab.click();
      await page.waitForTimeout(900);
      ctxActual = 'ORLANT > ' + label;
      const antes = hallazgos.length;
      const canvasesMalos = await canvasesSinDibujar(page);
      canvasesMalos.forEach((c) => hallazgos.push({ tipo: 'canvas-' + c.motivo, ctx: ctxActual, canvas: c.id, detalle: c }));
      if (hallazgos.length > antes) {
        await page.screenshot({ path: path.join(CAPTURAS_DIR, `fallo-${i}-${label.replace(/[^a-z0-9]+/gi, '-')}.png`) }).catch(() => {});
      }

      const nSub = await page.locator('.gd-subtab-btn').count();
      for (let j = 0; j < nSub; j++) {
        const sub = page.locator('.gd-subtab-btn').nth(j);
        const subLabel = (await sub.textContent() || '').trim();
        await sub.click();
        await page.waitForTimeout(700);
        ctxActual = 'ORLANT > ' + label + ' > ' + subLabel;
        const antesSub = hallazgos.length;
        const canvasesMalosSub = await canvasesSinDibujar(page);
        canvasesMalosSub.forEach((c) => hallazgos.push({ tipo: 'canvas-' + c.motivo, ctx: ctxActual, canvas: c.id, detalle: c }));
        if (hallazgos.length > antesSub) {
          await page.screenshot({ path: path.join(CAPTURAS_DIR, `fallo-${i}-${j}-${subLabel.replace(/[^a-z0-9]+/gi, '-')}.png`) }).catch(() => {});
        }
      }
    }

    // Fase 139: las pestanas no se mueven despues de su primer dibujo, ni
    // con el aviso amarillo "sin datos" (Mobilize en produccion no tiene
    // dashboard_cargas -- se simula vaciando `secciones`) ni mientras carga
    // el logo del cliente (se retrasa a proposito, como la primera visita
    // sin cache). Cada orden (ORLANT->Mobilize y Mobilize->ORLANT) en un
    // contexto NUEVO, sin cache de imagenes: en la pagina de arriba los
    // logos ya quedaron en cache y el salto no se veria. Antes del arreglo
    // fallaba con +14px (ORLANT) y -30px (Mobilize).
    for (const orden of [['ORLANT', 'MOBILIZE'], ['MOBILIZE', 'ORLANT']]) {
      ctxActual = 'salto de pestanas ' + orden.join('->');
      const ctxSalto = await browser.newContext({ viewport: { width: 1440, height: 900 } });
      const pSalto = await ctxSalto.newPage();
      pSalto.on('pageerror', (err) => hallazgos.push({ tipo: 'pageerror', ctx: ctxActual, msg: err.message }));
      await pSalto.route('**/img/clientes/**', async (route) => {
        await new Promise((r) => setTimeout(r, 600));
        await route.continue();
      });
      await pSalto.route(/\/api\/dashboard\/MOBILIZE$/, async (route) => {
        const r = await route.fetch();
        const j = await r.json();
        j.secciones = {};
        await route.fulfill({ response: r, json: j });
      });
      await pSalto.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
      await pSalto.fill('#username', admin.user);
      await pSalto.fill('#password', admin.password);
      await pSalto.click('button.btn-login');
      await pSalto.waitForTimeout(1000);
      for (const cliente of orden) {
        ctxActual = 'salto de pestanas ' + orden.join('->') + ' > ' + cliente;
        const { vistas, logoAjeno } = await posicionesPestanasAlAbrir(pSalto, cliente);
        if (logoAjeno) hallazgos.push({ tipo: 'logo-viejo-o-a-medio-cargar-visible', ctx: ctxActual });
        if (!vistas.length) hallazgos.push({ tipo: 'salto-pestanas-sin-pestanas', ctx: ctxActual });
        else if (vistas.length > 1) {
          hallazgos.push({ tipo: 'salto-pestanas', ctx: ctxActual, posiciones: vistas });
          await pSalto.screenshot({ path: path.join(CAPTURAS_DIR, `fallo-salto-${orden.join('-')}-${cliente}.png`) }).catch(() => {});
        }
        if (cliente === 'MOBILIZE' && vistas.length && !vistas[0].aviso) {
          hallazgos.push({ tipo: 'salto-pestanas-aviso-no-estaba-en-primer-dibujo', ctx: ctxActual });
        }
        await pSalto.evaluate(() => closeGenericDashboard());
        await pSalto.waitForTimeout(600);
      }
      await ctxSalto.close();
    }
  } catch (e) {
    hallazgos.push({ tipo: 'excepcion', ctx: ctxActual, error: e.message });
    await page.screenshot({ path: path.join(CAPTURAS_DIR, 'fallo-excepcion.png') }).catch(() => {});
  } finally {
    await browser.close();
  }

  console.log('=== RESULTADO ===');
  console.log(JSON.stringify({ totalHallazgos: hallazgos.length, hallazgos }, null, 2));
  if (hallazgos.length === 0) {
    console.log('OK: ORLANT completo (admin, claro, escritorio) sin errores de consola, peticiones fallidas ni canvas sin dibujar; pestanas de ORLANT/Mobilize sin salto al abrir.');
  }
  process.exit(hallazgos.length ? 1 : 0);
})();
