// verificar-fase99-desplegables-produccion.js — Fase 99. Verificacion EN
// PRODUCCION (https://informa.inconexion.com.co), SOLO LECTURA: confirma
// con getComputedStyle que las <option> del selector MES (el reportado)
// tienen contraste real, y deja el navegador abierto en ORLANT para que el
// usuario abra el MES y lo confirme a ojo.
//
// Playwright DIRECTO desde Node (headless:false, navegador visible) -- NO
// la extension de Claude in Chrome. El usuario inicia sesion a mano; el
// script nunca ve ni escribe la contrasena, no persiste storageState ni
// cookies en disco. No cambia ningun dato -- solo lee.
'use strict';
const { chromium } = require('playwright');

const BASE = 'https://informa.inconexion.com.co';
const LOGIN_TIMEOUT_MS = 10 * 60 * 1000;

function log(...args) { console.log(new Date().toISOString(), ...args); }

function parseRgb(s) {
  const m = /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+))?\)/.exec(s || '');
  if (!m) return null;
  return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
}
function luminancia({ r, g, b }) {
  const f = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contraste(rgb1, rgb2) {
  const l1 = luminancia(rgb1), l2 = luminancia(rgb2);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

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

async function evaluarMes(page, tema) {
  await page.evaluate((t) => { if (typeof aplicarTema === 'function') aplicarTema(t); }, tema);
  await page.waitForTimeout(400);
  const datos = await page.$$eval('#gd-mes-sel option', (opts) =>
    opts.map((o) => { const cs = getComputedStyle(o); return { texto: o.textContent.trim(), color: cs.color, bg: cs.backgroundColor }; })
  );
  const resultados = datos.map((o) => {
    const color = parseRgb(o.color), bg = parseRgb(o.bg);
    if (!color || !bg || bg.a < 0.99) return { ...o, ok: false, ratio: null };
    const ratio = contraste(color, bg);
    return { ...o, ok: ratio >= 4.5, ratio: +ratio.toFixed(2) };
  });
  return resultados;
}

(async () => {
  let browser;
  try {
    browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();

    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });
    const logueado = await esperarLogin(page);
    if (!logueado) throw new Error('Se agoto el tiempo de espera de login (10 min) sin detectar sesion iniciada.');
    log('Login detectado, continuando automaticamente.');
    await page.waitForTimeout(1000);

    await page.evaluate(() => openGenericDashboard('ORLANT'));
    await page.waitForTimeout(1500);

    for (const tema of ['light', 'dark']) {
      const resultados = await evaluarMes(page, tema);
      log(`=== MES (#gd-mes-sel), tema ${tema} ===`);
      resultados.forEach((r) => log(`  [${r.ok ? 'OK' : 'FALLO'}] "${r.texto}": ${r.ratio !== null ? r.ratio + ':1' : 'sin fondo solido'} (color=${r.color} bg=${r.bg})`));
      const todoOk = resultados.length > 0 && resultados.every((r) => r.ok);
      log(`=== ${tema}: ${todoOk ? 'OK' : 'FALLO'} ===`);
    }

    // Deja el tema en claro (el que el usuario probablemente usa) y el
    // navegador ABIERTO en ORLANT para que confirme a ojo abriendo el MES.
    await page.evaluate(() => { if (typeof aplicarTema === 'function') aplicarTema('light'); });
    log('');
    log('Navegador dejado abierto en ORLANT (tema claro). Abre el selector MES de');
    log('arriba y confirma a ojo que las opciones (Sep-26, Ago-26, Abr-25) se leen');
    log('bien. Este script NO se cierra solo -- ciérralo (Ctrl+C) cuando termines.');
    await new Promise(() => {}); // espera indefinida -- el usuario cierra el proceso cuando termine
  } catch (e) {
    console.error('FALLO:', e.message);
    if (browser) await browser.close();
    process.exit(1);
  }
})();
