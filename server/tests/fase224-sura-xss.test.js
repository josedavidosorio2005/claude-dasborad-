// fase224-sura-xss.test.js — Fase 224 (revision del 3-nov): XSS en el
// tablero Televentas de SURA. Un dato del Excel o del servidor (asesor,
// ciudad, campana, estrategia, nombre de archivo) nunca debe poder abrir
// una etiqueta ni salirse de un atributo. Datos 100 % sinteticos.
// La prueba en navegador (Playwright, usuario de cliente) es
// scripts/qa/verificar-xss-sura-local.js.
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { app, request, tokenFor, MASTER_PASSWORD } = require('./helpers');
const { XLSX, baseVentas } = require('./helpers/sura-sinteticos');

const RAIZ = path.join(__dirname, '..', '..');
const APP = path.join(RAIZ, 'public', 'js', 'sura-televentas-app.js');
const API = '/api/sura-televentas/SURA';
const PAYLOAD = '<img src=x onerror=window.__xss=1>';
const auth = (t) => ({ Authorization: 'Bearer ' + t });
let tAdmin;

function stub() {
  return new Proxy(function () {}, {
    get: (t, k) => (k === 'forEach' ? () => {} : k === Symbol.toPrimitive ? () => '' : stub()),
    set: () => true,
    apply: () => stub(),
  });
}
global.XLSX = XLSX;
global.document = stub();
const { stvCrearApp, stvLimpiarTexto } = require(APP);
const leer = stvCrearApp(stub(), {}, () => false).leer;

before(async () => { tAdmin = await tokenFor('admin', MASTER_PASSWORD); });

test('stvLimpiarTexto cambia < > " \' ` en textos y claves, sin tocar numeros ni estructura', () => {
  assert.equal(stvLimpiarTexto(PAYLOAD), '‹img src=x onerror=window.__xss=1›');
  assert.equal(stvLimpiarTexto('a" onmouseover="x'), 'a” onmouseover=”x');
  assert.equal(stvLimpiarTexto("O'Neil `x`"), 'O’Neil ˋxˋ');
  assert.equal(stvLimpiarTexto('Medellín & Bello'), 'Medellín & Bello');
  const d = { rows: [[PAYLOAD, '2026-08-01', 1, 2.5, 'p']], ag: { [PAYLOAD]: 3 }, n: 7, nada: null, pr: { ids: ['c1'], A: ['<b>'] } };
  const r = stvLimpiarTexto(d);
  assert.equal(r, d, 'se recorre en el sitio');
  assert.deepEqual(r.rows[0], ['‹img src=x onerror=window.__xss=1›', '2026-08-01', 1, 2.5, 'p']);
  assert.deepEqual(Object.keys(r.ag), ['‹img src=x onerror=window.__xss=1›']);
  assert.equal(r.n, 7);
  assert.equal(r.nada, null);
  assert.deepEqual(r.pr.A, ['‹b›']);
  assert.doesNotMatch(JSON.stringify(r), /[<>`]/);
});

test('el servidor rechaza nombres de archivo con caracteres de HTML', async () => {
  const v = baseVentas({ mes: '2026-03', n: 10, semilla: 2 });
  const datos = leer.parseBook(new Uint8Array(v.buf));
  for (const nombre of ['<b>x</b>.xlsx', 'a"b.xlsx', "a'b.xlsx", 'a`b.xlsx', 'a>b.xlsx']) {
    const r = await request(app).post(`${API}/bases/ventas/2026-03`).set(auth(tAdmin))
      .send({ archivoNombre: nombre, archivo: v.buf.toString('base64'), datos });
    assert.equal(r.status, 400, nombre);
  }
  const ok = await request(app).post(`${API}/bases/ventas/2026-03`).set(auth(tAdmin))
    .send({ archivoNombre: 'ventas marzo (1).xlsx', archivo: v.buf.toString('base64'), datos });
  assert.equal(ok.status, 201, 'un nombre normal sigue entrando');
});

test('un asesor con HTML en el Excel: el servidor lo guarda tal cual y el tablero lo recibe limpio', async () => {
  const v = baseVentas({ mes: '2026-04', n: 12, semilla: 5 });
  const datos = leer.parseBook(new Uint8Array(v.buf));
  datos.rows.forEach((x) => { x[0] = PAYLOAD; });
  const r = await request(app).post(`${API}/bases/ventas/2026-04`).set(auth(tAdmin))
    .send({ archivoNombre: 'ventas_abril.xlsx', archivo: v.buf.toString('base64'), datos });
  assert.equal(r.status, 201);
  const g = await request(app).get(`${API}/bases/ventas/2026-04`).set(auth(tAdmin));
  assert.equal(g.body.rows[0][0], PAYLOAD);
  const limpio = stvLimpiarTexto(g.body);
  assert.equal(limpio.rows[0][0], '‹img src=x onerror=window.__xss=1›');
  assert.doesNotMatch(JSON.stringify(limpio.rows), /<|>/);
});

test('un solo esc en el tablero, y todo lo que entra pasa por stvLimpiarTexto', () => {
  const src = fs.readFileSync(APP, 'utf8');
  assert.equal((src.match(/const esc=/g) || []).length, 1);
  assert.match(src, /const esc=t=>String\(t\?\?""\)\.replace\(\/&\/g,"&amp;"\)\.replace\(\/<\/g,"&lt;"\)\.replace\(\/>\/g,"&gt;"\)\.replace\(\/"\/g,"&quot;"\)\.replace\(\/'\/g,"&#39;"\)/);
  for (const t of ['stvLimpiarTexto(await API.resumen())', 'stvLimpiarTexto(await API.base(', 'stvLimpiarTexto(parseBook(buf))', 'stvLimpiarTexto(parseEst(buf))', 'stvLimpiarTexto(parseIni(buf))']) {
    assert.ok(src.includes(t), t);
  }
  for (const t of ['${d.file}', '${x.n}', '${o.n}', '${s.n}', '${pretty(k)}']) assert.ok(!src.includes(t), 'sin escapar: ' + t);
});

test('el generador lleva el mismo arreglo (regenerar no lo borra)', () => {
  const gen = fs.readFileSync(path.join(RAIZ, 'scripts', 'sura', 'generar-televentas.js'), 'utf8');
  assert.match(gen, /Fase 224 \(XSS\)/);
  assert.ok(gen.includes('${LIMPIAR}'));
  assert.ok(gen.includes("stvLimpiarTexto: stvLimpiarTexto"));
});
