// fase381-inventario-i6.test.js — Fase 381 (I6 del plan con el diseño de Edwin): historial general,
// Excel/PDF de cada vista e importación desde Excel con revisión previa. Datos INVENTADOS.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const bcrypt = require('bcryptjs');
const { request, app, db, tokenFor } = require('./helpers');
const { completar } = require('./helpers-activos'); // Fase INV2: registrar exige todos los campos

const H = (t) => ({ Authorization: 'Bearer ' + t });
let tk, tkSup;
before(async () => {
  for (const [u, rol] of [['f381_sis', 'SISTEMAS'], ['f381_sup', 'SUPERVISOR']]) {
    db.prepare(`INSERT INTO users (nombre, user, rol, active, password_hash, perms, createdAt, debe_cambiar_password) VALUES (?,?,?,1,?,?,?,0)`)
      .run('Persona Inventada ' + u, u, rol, bcrypt.hashSync('Clave#2026x', 4), '{}', new Date().toISOString());
  }
  tk = await tokenFor('f381_sis', 'Clave#2026x');
  tkSup = await tokenFor('f381_sup', 'Clave#2026x');
});
const P = (url, b, t) => request(app).post('/api' + url).set(H(t || tk)).send(url === '/activos' ? completar(b) : b);
const G = (url, t) => request(app).get('/api' + url).set(H(t || tk));

test('importar: revisión fila por fila, nada se guarda hasta confirmar', async () => {
  const filas = [
    ['Código', 'Marca', 'Serial', 'Sede', 'Estado', 'RAM (GB)', 'Columna rara'],
    ['IMP-1', 'MarcaX', 'S-1', '', 'Libre', '16', 'x'],
    ['IMP-2', 'MarcaY', '', '', 'En reparación', '4', ''],
    [null, null, null, null, null, null, null],
    ['IMP-1', '', '', '', '', '', ''],
    ['IMP-3', '', '', '', 'Prestado', '', ''],
    ['=MALO', '', '', '', '', '', ''],
  ];
  const r = await P('/activos/importar', { tipo: 'TORRE', filas });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.deepEqual([r.body.validas, r.body.errores], [2, 3]);
  assert.ok(r.body.columnas.includes('Memoria RAM (GB)') && r.body.columnas.includes('Código'));
  assert.deepEqual(r.body.detalle.map((d) => [d.fila, d.ok ? 'ok' : d.error.slice(0, 18)]),
    [[2, 'ok'], [3, 'ok'], [5, 'Código repetido en'], [6, 'Estado «Prestado»:'], [7, 'El código es oblig']]);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM activos WHERE codigo LIKE 'IMP-%'").get().n, 0, 'sin confirmar no guarda');
  const c = await P('/activos/importar', { tipo: 'TORRE', filas, confirmar: true });
  assert.equal(c.body.importadas, 2);
  const l = (await G('/activos?tipo=TORRE&q=IMP-')).body.activos.sort((a, b) => a.codigo.localeCompare(b.codigo));
  assert.deepEqual(l.map((a) => [a.codigo, a.estado, a.datos.ram_gb, a.rendimiento]), [['IMP-1', 'libre', 16, 'alto'], ['IMP-2', 'en_reparacion', 4, 'bajo']]);
  const otra = await P('/activos/importar', { tipo: 'TORRE', filas: filas.slice(0, 2) });
  assert.match(otra.body.detalle[0].error, /Ya existe/);
  assert.ok(db.prepare("SELECT 1 FROM historial WHERE accion = 'ACTIVO_IMPORTACION'").get());
  // Errores de forma y permisos
  assert.equal((await P('/activos/importar', { tipo: 'NOEXISTE', filas })).status, 400);
  assert.equal((await P('/activos/importar', { tipo: 'TORRE', filas: [['Marca'], ['x']] })).status, 400, 'sin columna Código');
  assert.equal((await P('/activos/importar', { tipo: 'TORRE', filas: [filas[0]] })).status, 400, 'sin filas');
  assert.equal((await P('/activos/importar', { tipo: 'TORRE', filas, otra: 1 })).status, 400);
  assert.equal((await P('/activos/importar', { tipo: 'TORRE', filas }, tkSup)).status, 403);
});

test('importar administrables sin código: el código automático', async () => {
  const c = await P('/activos/importar', { tipo: 'ADMINISTRABLE', confirmar: true, filas: [['Tipo', 'Dirección IP'], ['Switch', '10.9.0.1'], ['Switch', '10.9.0.2']] });
  assert.equal(c.status, 200, JSON.stringify(c.body));
  assert.deepEqual((await G('/activos?tipo=ADMINISTRABLE')).body.activos.map((a) => a.codigo).sort(), ['6001', '6002']);
});

test('historial general: filtros por acción, texto, fechas y ámbito', async () => {
  const todo = (await G('/activos/historial?ambito=sistemas')).body;
  assert.ok(todo.historial.length >= 4);
  assert.ok(todo.acciones.includes('Ingreso (importado)'));
  assert.equal((await G('/activos/historial?accion=' + encodeURIComponent('Ingreso (importado)'))).body.historial.length, 4);
  assert.deepEqual((await G('/activos/historial?q=IMP-2')).body.historial.map((h) => h.codigo), ['IMP-2']);
  assert.equal((await G('/activos/historial?hasta=2020-01-01')).body.historial.length, 0);
  const hoy = new Date().toISOString().slice(0, 10);
  assert.equal((await G('/activos/historial?desde=' + hoy + '&hasta=' + hoy)).body.historial.length, todo.historial.length);
  assert.equal((await G('/activos/historial?ambito=inmuebles')).body.historial.length, 0);
  assert.equal((await G('/activos/historial', tkSup)).status, 403);
});

test('interfaz: Excel/PDF por vista, historial e importación (escapados, celdas seguras)', () => {
  global.esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  try {
    const UI = require(path.join(__dirname, '..', '..', 'public', 'js', 'activos.js'));
    const config = { tipos: [{ codigo: 'TORRE', nombre: 'Torre' }] };
    const el = UI.activosFilasExport('elementos', [{ codigo: '<T1>', tipo: 'TORRE', estado: 'en_uso', marca: 'M', datos: { ram_gb: 8 }, agente: { nombre: 'A' } }], config);
    assert.deepEqual(el.filas[0].slice(0, 3), ['<T1>', 'Torre', 'Asignado']);
    assert.equal(el.filas[0][6], 8);
    const pdf = UI.activosReportePrintHtml(el, '19/11/2026');
    assert.ok(pdf.includes('&lt;T1&gt;') && !pdf.includes('<T1>') && !/<script/i.test(pdf) && pdf.includes('1 fila'));
    const ac = UI.activosFilasExport('actas', [{ numero: 3, tipoNombre: 'Entrega', fecha: '2026-11-19T15:00:00Z', agente: null, elementos: [{ tipo: 'Mouse', codigo: 'M1' }], estado: 'pendiente', atrasada: true }], config);
    assert.deepEqual([ac.filas[0][4], ac.filas[0][6]], ['Mouse M1', 'Atrasada']);
    const ad = UI.activosFilasExport('admin', [{ codigo: '5001', estado: 'en_uso', datos: { subtipo: 'Servidor', ip: '10.0.0.1' } }], config);
    assert.deepEqual([ad.filas[0][1], ad.filas[0][5], ad.filas[0][9]], ['Servidor', '10.0.0.1', 'Activo']);
    const hi = UI.activosHistorialHtml([{ fecha: '2026-11-19T15:00:00Z', tipo: 'TORRE', codigo: '<c>', accion: 'Ingreso', estadoAntes: null, estadoDespues: 'libre', motivo: '<m>', quien: 'q', activoId: 4 }], config);
    assert.ok(hi.includes('activosAdminVer(4)') && hi.includes('Libre') && !hi.includes('<c>') && !hi.includes('<m>'));
    assert.deepEqual(UI.activosImportarColumnas({ campos: [{ k: 'ram_gb', l: 'RAM (GB)' }, { k: 'x', l: 'Oculto', oculto: true }] }).slice(-2), ['Observaciones', 'RAM (GB)']);
    const rev = UI.activosImportarResultadoHtml({ validas: 1, errores: 1, columnas: ['codigo'], detalle: [{ fila: 2, ok: true }, { fila: 3, codigo: '<x>', error: 'Ya existe' }] }, false);
    assert.ok(rev.includes('Importar 1 elemento(s)') && rev.includes('&lt;x&gt;'));
    assert.ok(!UI.activosImportarResultadoHtml({ validas: 0, errores: 0, columnas: [], detalle: [] }, false).includes('Importar'));
    assert.ok(UI.activosMenuHtml('inmuebles', 'panel', null).includes('Historial'));
    assert.ok(UI.activosMenuHtml('sistemas', 'panel', null).includes('Historial'));
  } finally { delete global.esc; }
});
