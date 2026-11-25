// faseQA-historial-ligero.test.js — 25/11/2026. Medición local con filas inventadas: con un año de Historial
// (~44 mil filas) la respuesta pesaba 14 MB, el servidor tardaba 0,44 s en armarla y cada inicio de sesión del
// administrador la esperaba. Ahora:
//   - el servidor manda las 5.000 más recientes, con el total, y filtra por tipo y fecha (hora de Colombia);
//   - al iniciar sesión solo se pide el número (/historial/total); las filas, al abrir la pestaña;
//   - las alertas de seguridad no cambian.
// Filas INVENTADAS.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { request, app, db, tokenFor, MASTER_PASSWORD, SEED } = require('./helpers');
const H = require('../routes/historial');

const auth = (t) => ({ Authorization: 'Bearer ' + t });
const PUB = path.join(__dirname, '../../public');
let admin, adminRol, calidad;
// 5.200 filas inventadas, una por minuto desde el 2026-10-31 23:00 (Colombia) = 2026-11-01T04:00Z.
const T0 = Date.parse('2026-11-01T04:00:00Z');
const N = 5200;

before(async () => {
  const ins = db.prepare('INSERT INTO historial (ts, fecha, accion, nombre, username, rol, actor, detalle) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  db.transaction(() => {
    for (let i = 0; i < N; i++) {
      const accion = i % 4 === 0 ? 'LOGIN_OK' : i % 4 === 1 ? 'LOGIN_FALLIDO' : i % 4 === 2 ? 'QA_HIST_INVENTADO' : 'LOGOUT';
      ins.run(T0 + i * 60000, 'x', accion, 'Persona Inventada', 'inventada_qa', 'ASESOR', 'inventada_qa', 'fila inventada ' + i);
    }
  })();
  admin = await tokenFor('admin', MASTER_PASSWORD);
  adminRol = await tokenFor('psuarez', SEED.psuarez);
  calidad = await tokenFor('crodriguez', SEED.crodriguez);
});

const get = (url, t) => request(app).get('/api' + url).set(auth(t || admin));
const totalTabla = () => db.prepare('SELECT COUNT(*) n FROM historial').get().n;

test('sin parámetros: un arreglo (como antes) con las 5.000 más recientes, de la más nueva a la más vieja', async () => {
  const r = await get('/historial');
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.body));
  assert.equal(H.LIMITE, 5000);
  assert.equal(r.body.length, 5000);
  for (let i = 1; i < r.body.length; i++) {
    const a = r.body[i - 1], b = r.body[i];
    assert.ok(a.ts > b.ts || (a.ts === b.ts && a.id > b.id), 'orden por ts y id descendente');
  }
  assert.match(r.body[0].fecha, /^\d{2}\/\d{2}\/\d{4}/, 'la fecha sigue saliendo de ts en hora de Colombia');
});

test('con_total=1: filas, total, totalFiltrado y si se recortó', async () => {
  const r = await get('/historial?con_total=1');
  assert.equal(r.status, 200);
  assert.equal(r.body.filas.length, 5000);
  assert.equal(r.body.total, totalTabla());
  assert.equal(r.body.totalFiltrado, r.body.total);
  assert.equal(r.body.limite, 5000);
  assert.equal(r.body.recortado, true);
});

test('filtro por tipo en el servidor (uno exacto y el grupo «Inicios de sesión»)', async () => {
  const uno = await get('/historial?con_total=1&tipo=QA_HIST_INVENTADO');
  assert.equal(uno.body.totalFiltrado, N / 4);
  assert.equal(uno.body.filas.length, N / 4);
  assert.equal(uno.body.recortado, false);
  assert.ok(uno.body.filas.every((f) => f.accion === 'QA_HIST_INVENTADO'));
  const logins = await get('/historial?con_total=1&tipo=__LOGINS__');
  assert.ok(logins.body.filas.every((f) => ['LOGIN_OK', 'LOGIN_FALLIDO', 'LOGIN_BLOQUEADO', 'LOGOUT'].includes(f.accion)));
  assert.ok(logins.body.totalFiltrado >= (N / 4) * 3, 'las 3 de cada 4 inventadas que son de sesión');
});

test('filtro por fechas en hora de Colombia: «desde» y «hasta» incluyen el día completo', async () => {
  // 2026-10-31 (Colombia): solo la primera hora inventada (23:00–23:59) = 60 filas.
  const oct31 = await get('/historial?con_total=1&tipo=QA_HIST_INVENTADO&desde=2026-10-31&hasta=2026-10-31');
  assert.equal(oct31.body.totalFiltrado, 15, '60 filas, 1 de cada 4 es QA_HIST_INVENTADO');
  // 2026-11-01 completo: 1.440 minutos.
  const nov1 = await get('/historial?con_total=1&tipo=QA_HIST_INVENTADO&desde=2026-11-01&hasta=2026-11-01');
  assert.equal(nov1.body.totalFiltrado, 360);
  const tsMin = Math.min(...nov1.body.filas.map((f) => f.ts)), tsMax = Math.max(...nov1.body.filas.map((f) => f.ts));
  assert.ok(tsMin >= Date.parse('2026-11-01T05:00:00Z') && tsMax < Date.parse('2026-11-02T05:00:00Z'));
  // Solo «desde»: del 04/11 en adelante.
  const desde = await get('/historial?con_total=1&tipo=QA_HIST_INVENTADO&desde=2026-11-04');
  assert.ok(desde.body.filas.every((f) => f.ts >= Date.parse('2026-11-04T05:00:00Z')));
  assert.ok(desde.body.totalFiltrado > 0);
});

test('parámetros no válidos: 400, sin consultar', async () => {
  for (const q of ['tipo=login_ok', "tipo=X'%20OR%201=1", 'desde=2026-13-01', 'hasta=2026-02-30', 'desde=hoy']) {
    const r = await get('/historial?con_total=1&' + q);
    assert.equal(r.status, 400, q);
  }
});

test('/historial/total: solo el número; solo el administrador completo (403 para los demás)', async () => {
  const t = await get('/historial/total');
  assert.equal(t.status, 200);
  assert.deepEqual(Object.keys(t.body), ['total']);
  assert.equal(t.body.total, totalTabla());
  assert.equal((await get('/historial/total', adminRol)).status, 200, 'ADMIN completo');
  assert.equal((await get('/historial/total', calidad)).status, 403);
  assert.equal((await get('/historial', calidad)).status, 403);
  assert.equal((await get('/historial?con_total=1', calidad)).status, 403);
  assert.equal((await request(app).get('/api/historial/total')).status, 401);
});

test('las alertas de seguridad no cambian (no pasan por esta ruta)', async () => {
  const r = await get('/seguridad/alertas');
  assert.equal(r.status, 200);
  assert.doesNotMatch(fs.readFileSync(path.join(__dirname, '../routes/seguridad.js'), 'utf8'), /require\(['"]\.\/historial['"]\)/);
});

test('interfaz: al iniciar sesión solo se pide el total; las filas, al abrir la pestaña', () => {
  const ses = fs.readFileSync(path.join(PUB, 'js/session.js'), 'utf8');
  assert.doesNotMatch(ses, /await loadHist\(\)/, 'el inicio de sesión ya no descarga el Historial');
  assert.equal((ses.match(/await loadHistTotal\(\)/g) || []).length, 2, 'admin maestro y rol ADMIN');
  const ui = fs.readFileSync(path.join(PUB, 'js/ui-core.js'), 'utf8');
  assert.match(ui, /if\(sec==='hist'\)\{ loadHist\(\)\.then\(function\(\)\{ renderHist\(\); \}\); \}/);
  assert.match(ui, /stat-hist'\)\.textContent=historialTotal==null\?'-'/);
  const html = fs.readFileSync(path.join(PUB, 'index.html'), 'utf8');
  assert.match(html, /id="hist-filter" aria-label="Filtrar por tipo de evento" onchange="filterHistServidor\(\)"/);
  assert.match(html, /<label class="hist-fecha">Desde <input type="date" class="hist-filter-sel" id="hist-desde" onchange="filterHistServidor\(\)"><\/label>/);
  assert.match(html, /<label class="hist-fecha">Hasta <input type="date" class="hist-filter-sel" id="hist-hasta" onchange="filterHistServidor\(\)"><\/label>/);
  assert.match(html, /<div class="hist-aviso hidden" id="hist-aviso" role="status"><\/div>/);
});

test('interfaz: consulta al servidor y textos del conteo y del aviso', () => {
  const L = require('../../public/js/historial.js');
  assert.equal(L.histConsulta('', '', ''), '/historial?con_total=1');
  assert.equal(L.histConsulta('__LOGINS__', '2026-11-01', '2026-11-30'), '/historial?con_total=1&tipo=__LOGINS__&desde=2026-11-01&hasta=2026-11-30');
  assert.equal(L.histConsulta('LOGIN_OK', 'mal', ''), '/historial?con_total=1&tipo=LOGIN_OK');
  assert.equal(L.histTextoConteo({ total: 300, totalFiltrado: 300, recortado: false }, 300), '300 eventos en total');
  assert.equal(L.histTextoConteo({ total: 300, totalFiltrado: 1, recortado: false }, 1), '1 evento de 300 en total');
  assert.equal(L.histTextoConteo({ total: 44096, totalFiltrado: 44096, recortado: true, limite: 5000 }, 5000), 'Se muestran 5.000 de 44.096 eventos');
  assert.equal(L.histTextoRecorte({ recortado: false }), '');
  assert.match(L.histTextoRecorte({ recortado: true, limite: 5000 }), /^Se muestran los 5\.000 eventos más recientes\./);
});
