// fase130-parte6-diagnostico-trust-proxy.js — Fase 130 (continuacion,
// diagnostico del rate limiter). Script de un solo uso, SOLO LECTURA, muy
// liviano (login + 1 GET /historial, 2 peticiones nada mas -- a proposito,
// para no volver a gastar la cuota del limitador global recien liberada).
//
// Objetivo: saber si `trust proxy` ve la IP real del cliente o la IP
// interna de Caddy (el mismo contenedor para TODOS los usuarios, lo que
// explicaria "varios clientes" compartiendo un solo cupo). NUNCA imprime
// la IP cruda -- solo la clasifica (privada/Docker vs publica), que es lo
// unico que pidio el usuario ("sin datos personales: solo si es la del
// proxy o la del cliente").
//
// Playwright DIRECTO desde Node (headless:false), NO la extension de
// Claude in Chrome (CLAUDE.md). Login manual en la ventana (hasta 10 min).
'use strict';
const path = require('path');
const { chromium } = require(path.join(__dirname, '..', '..', 'server', 'node_modules', 'playwright'));

const BASE = 'https://informa.inconexion.com.co';
const LOGIN_TIMEOUT_MS = 10 * 60 * 1000;

function log(...args) { console.log(new Date().toISOString(), ...args); }

async function esperarLogin(page) {
  log('=== INICIA SESIÓN AHORA, CON TU CUENTA DE ADMINISTRADOR === (hasta 10 min)');
  const deadline = Date.now() + LOGIN_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const logueado = await page.evaluate(() => typeof authToken !== 'undefined' && !!authToken).catch(() => false);
    if (logueado) return true;
    await page.waitForTimeout(3000);
  }
  return false;
}

// Clasifica una IPv4/IPv6 como "privada/interna" (Docker, LAN, loopback) o
// "publica" -- nunca devuelve el valor, solo la clasificacion.
function clasificarIp(ip) {
  if (!ip) return 'desconocida (vacia)';
  const limpio = String(ip).replace(/^::ffff:/, '');
  if (limpio === '::1' || limpio === '127.0.0.1') return 'loopback (interna)';
  const partes = limpio.split('.').map(Number);
  if (partes.length === 4 && partes.every((n) => !isNaN(n))) {
    const [a, b] = partes;
    if (a === 10) return 'privada 10.0.0.0/8 (interna/Docker/LAN)';
    if (a === 172 && b >= 16 && b <= 31) return 'privada 172.16.0.0/12 (interna/Docker/LAN)';
    if (a === 192 && b === 168) return 'privada 192.168.0.0/16 (interna/LAN)';
    return 'publica (parece IP real de cliente)';
  }
  if (/^fc|^fd/i.test(limpio)) return 'privada ULA IPv6 (interna)';
  return 'publica o formato no reconocido (IPv6)';
}

(async () => {
  let browser;
  let ok = true;
  try {
    browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    await page.goto(BASE + '/', { waitUntil: 'networkidle', timeout: 30000 });

    const logueado = await esperarLogin(page);
    if (!logueado) throw new Error('Se agotó el tiempo de espera de login (10 min).');
    log('Login detectado, continuando.');
    await page.waitForTimeout(500);

    const peticionesBloqueadas = [];
    await page.route('**/*', (route) => {
      const req = route.request();
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method())) {
        peticionesBloqueadas.push(req.method() + ' ' + new URL(req.url()).pathname);
        return route.abort();
      }
      return route.continue();
    });

    const historial = await page.evaluate(() => apiRequest('GET', '/historial'));
    const miLogin = historial.find((h) => h.accion === 'LOGIN_OK');

    const reporte = {
      miLoginEncontrado: !!miLogin,
      clasificacionIp: miLogin ? clasificarIp(miLogin.ip) : null,
      totalFilasHistorial: historial.length,
      ipsDistintasUltimas50: new Set(historial.slice(0, 50).map((h) => h.ip || '')).size,
      peticionesBloqueadas,
    };

    console.log('\n=== DIAGNOSTICO TRUST PROXY — JSON (sin IPs crudas, sin nombres) ===');
    console.log(JSON.stringify(reporte, null, 2));

    await page.evaluate(() => apiRequest('POST', '/auth/logout').catch(() => {}));
  } catch (e) {
    console.error('FALLO:', e.message);
    ok = false;
  } finally {
    if (browser) await browser.close();
  }
  process.exit(ok ? 0 : 1);
})();
