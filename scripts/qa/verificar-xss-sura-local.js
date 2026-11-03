// verificar-xss-sura-local.js — Fase 224: prueba en navegador del XSS del
// tablero Televentas de SURA, como USUARIO DE CLIENTE, contra una instancia
// LOCAL con la base demo (nunca produccion: se niega si APP_URL no es localhost).
//
//   1. Como admin (credenciales de la base demo, nunca impresas) monta una
//      base de ventas SINTETICA de SURA con un asesor llamado
//      <img src=x onerror=window.__xss=1> y una ciudad "><svg onload=...>,
//      y comprueba que el nombre de archivo "<b>x</b>.xlsx" se rechaza (400).
//   2. Crea un usuario CLIENTES_DASH solo con SURA (contrasena al azar).
//   3. Con Playwright entra como ese cliente, recorre todas las pestanas y
//      sub-pestanas (1440 claro y 375 oscuro) y verifica que window.__xss
//      sigue sin definirse y que el nombre se ve como texto.
//   4. Borra la base y el usuario de prueba.
//
//   cd server && npm run seed:demo && node server.js &
//   cd .. && node scripts/qa/verificar-xss-sura-local.js
// (APP_URL y SEED_CRED_FILE cambian la URL local y el archivo de credenciales.)
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SERVER_DIR = path.join(__dirname, '..', '..', 'server');
const { chromium } = require(path.join(SERVER_DIR, 'node_modules', 'playwright'));
const { XLSX, baseVentas } = require(path.join(SERVER_DIR, 'tests', 'helpers', 'sura-sinteticos'));
const BASE = process.env.APP_URL || 'http://localhost:3000';
const CRED_FILE = process.env.SEED_CRED_FILE || path.join(SERVER_DIR, 'data', 'seed-demo-credenciales.txt');
const BRAVE = 'C:/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe';
const MES = '2026-06';
const ASESOR = '<img src=x onerror=window.__xss=1>';
const CIUDAD = '"><svg onload=window.__xss=2>';

if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) {
  console.error('Solo contra una instancia local (APP_URL=http://localhost:PUERTO).');
  process.exit(2);
}

function stub() {
  return new Proxy(function () {}, {
    get: (t, k) => (k === 'forEach' ? () => {} : k === Symbol.toPrimitive ? () => '' : stub()),
    set: () => true,
    apply: () => stub(),
  });
}
global.XLSX = XLSX;
global.document = stub();
const { stvCrearApp } = require(path.join(__dirname, '..', '..', 'public', 'js', 'sura-televentas-app.js'));
const leer = stvCrearApp(stub(), {}, () => false).leer;

async function api(metodo, ruta, token, body) {
  const r = await fetch(BASE + '/api' + ruta, {
    method: metodo,
    headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}),
    body: body ? JSON.stringify(body) : undefined,
  });
  let j = null;
  try { j = await r.json(); } catch (e) { /* sin cuerpo */ }
  return { status: r.status, body: j };
}

(async () => {
  const m = fs.readFileSync(CRED_FILE, 'utf8').match(/^ADMIN\tuser:\s*(\S+)\s+password:\s*(\S+)/m);
  if (!m) throw new Error('No hay credenciales ADMIN en el archivo de la base demo');
  const admin = (await api('POST', '/auth/login', null, { user: m[1], password: m[2] })).body;
  if (!admin || !admin.token) throw new Error('No se pudo entrar como admin de la demo');
  const tA = admin.token;
  const res = [];
  let userId = null;
  try {
    // 1) base sintetica con HTML en el asesor y la ciudad
    const v = baseVentas({ mes: MES, n: 30, semilla: 9 });
    const datos = leer.parseBook(new Uint8Array(v.buf));
    datos.rows.forEach((x, i) => { x[0] = ASESOR; if (i % 2) x[9] = CIUDAD; });
    const malo = await api('POST', `/sura-televentas/SURA/bases/ventas/${MES}`, tA, { archivoNombre: '<b>x</b>.xlsx', archivo: v.buf.toString('base64'), datos });
    res.push(['nombre de archivo "<b>x</b>.xlsx" rechazado', malo.status === 400, malo.status]);
    const ok = await api('POST', `/sura-televentas/SURA/bases/ventas/${MES}`, tA, { archivoNombre: 'ventas_xss_sintetica.xlsx', archivo: v.buf.toString('base64'), datos });
    if (ok.status !== 201) throw new Error('No se pudo montar la base sintetica: ' + ok.status);

    // 2) usuario de cliente solo con SURA (contrasenas al azar, nunca impresas)
    const user = 'qa_xss_' + crypto.randomBytes(3).toString('hex');
    const pw1 = 'Qa#' + crypto.randomBytes(12).toString('hex');
    const pw2 = 'Qa#' + crypto.randomBytes(12).toString('hex');
    const cu = await api('POST', '/users', tA, { nombre: 'QA XSS', user, password: pw1, rol: 'CLIENTES_DASH', perms: { ClientesDash: true, cliente_SURA: true } });
    if (cu.status !== 201) throw new Error('No se pudo crear el usuario de cliente: ' + cu.status);
    userId = cu.body.id;
    const t1 = (await api('POST', '/auth/login', null, { user, password: pw1 })).body.token;
    const cp = await api('PUT', '/auth/password', t1, { currentPassword: pw1, newPassword: pw2 });
    if (cp.status !== 200) throw new Error('No se pudo hacer el cambio obligatorio de contrasena: ' + cp.status);

    // 3) navegador como cliente
    const browser = await chromium.launch(fs.existsSync(BRAVE) ? { executablePath: BRAVE } : {});
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errores = [];
    page.on('pageerror', (e) => errores.push(e.message.slice(0, 120)));
    page.on('dialog', (d) => { errores.push('dialogo: ' + d.message().slice(0, 60)); d.dismiss(); });
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await page.fill('#username', user);
    await page.fill('#password', pw2);
    await page.click('button.btn-login');
    await page.waitForTimeout(1500);
    for (const [w, tema] of [[1440, 'light'], [375, 'dark']]) {
      await page.setViewportSize({ width: w, height: 900 });
      await page.evaluate((t) => aplicarTema(t), tema);
      await page.evaluate(() => openSuraTeleventas('SURA'));
      await page.waitForTimeout(2500);
      const r = await page.evaluate(async () => {
        const R = _stv.root;
        const pausa = (ms) => new Promise((o) => setTimeout(o, ms));
        const tabs = [...R.querySelectorAll('.tab')].filter((t) => !t.hidden);
        let visto = '';
        for (const t of tabs) {
          t.click(); await pausa(500);
          const sec = R.querySelector('#' + t.dataset.p);
          for (const s of sec ? [...sec.querySelectorAll('.stab')] : []) { s.click(); await pausa(400); }
          // pasar el mouse por filas y barras (los recuadros emergentes se arman con datos)
          for (const el of [...R.querySelectorAll('tr, .bar, .hov, [data-tip], .k')].slice(0, 80)) {
            el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
            el.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 50, clientY: 50 }));
          }
          await pausa(200);
          visto += ' ' + R.querySelector('.wrap').innerText;
        }
        const texto = visto + ' ' + (R.querySelector('#mtip') ? R.querySelector('#mtip').innerText : '');
        return {
          tabs: tabs.length,
          xss: typeof window.__xss,
          // pretty() cambia mayusculas y _ por espacio: basta con el inicio del nombre
          comoTexto: texto.toLowerCase().includes('‹img src=x onerror=window'),
          imgInyectadas: R.querySelectorAll('img[onerror], svg[onload]').length,
        };
      });
      res.push([`${w} ${tema}: window.__xss sin definir (${r.tabs} pestañas recorridas)`, r.xss === 'undefined', r.xss]);
      res.push([`${w} ${tema}: ningún <img onerror>/<svg onload> en el tablero`, r.imgInyectadas === 0, r.imgInyectadas]);
      res.push([`${w} ${tema}: el asesor se ve como texto`, r.comoTexto, r.comoTexto]);
      await page.evaluate(() => { document.getElementById('stv-overlay').classList.remove('show'); });
    }
    res.push(['sin errores de página ni diálogos', errores.length === 0, errores.join(' | ')]);
    await page.evaluate(() => doLogout());
    await browser.close();
  } finally {
    // 4) limpieza: base y usuario de prueba
    await api('DELETE', `/sura-televentas/SURA/bases/ventas/${MES}`, tA);
    if (userId) await api('DELETE', `/users/${userId}`, tA);
  }
  let fallas = 0;
  for (const [que, ok, det] of res) { if (!ok) fallas++; console.log(`${ok ? 'OK   ' : 'FALLA'} ${que}${ok ? '' : ' → ' + det}`); }
  console.log(fallas ? `${fallas} falla(s)` : 'Todo en verde');
  process.exit(fallas ? 1 : 0);
})().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
