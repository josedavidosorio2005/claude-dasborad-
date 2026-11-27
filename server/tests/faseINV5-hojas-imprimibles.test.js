// faseINV5-hojas-imprimibles.test.js — Fase INV5 (parte 5 del Inventario, HTML de Edwin), primer tramo: hojas
// imprimibles: ficha de un elemento («printFicha») y «Agentes y equipos asignados» («printAgentes»). Datos INVENTADOS.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { request, app, db, tokenFor } = require('./helpers');

const H = (t) => ({ Authorization: 'Bearer ' + t });
let tk;
const ids = {};
const P = (url, b) => request(app).post('/api' + url).set(H(tk.sis)).send(b);
const G = (url, t) => request(app).get('/api' + url).set(H(t || tk.sis));
before(async () => {
  for (const [u, rol] of [['inv5_sis', 'SISTEMAS'], ['inv5_sup', 'SUPERVISOR']]) {
    db.prepare(`INSERT INTO users (nombre, user, rol, active, password_hash, perms, createdAt, debe_cambiar_password) VALUES (?,?,?,1,?,?,?,0)`)
      .run('Persona Inventada ' + u, u, rol, bcrypt.hashSync('Clave#2026x', 4), '{}', new Date().toISOString());
  }
  tk = { sis: await tokenFor('inv5_sis', 'Clave#2026x'), sup: await tokenFor('inv5_sup', 'Clave#2026x') };
  for (const [tipo, codigo] of [['DIADEMA', 'INV5-D1'], ['TORRE', 'INV5-T1'], ['MONITOR', 'INV5-M1']]) ids[codigo] = (await P('/activos', { tipo, codigo, marca: 'MarcaX', sede: '' })).body.activo.id;
  ids.ag1 = (await P('/activos/agentes', { nombre: 'Agente Inventado INV5 Uno', documento: '7500001' })).body.agente.id;
  ids.ag2 = (await P('/activos/agentes', { nombre: 'Agente Inventado INV5 Dos', documento: '7500002' })).body.agente.id;
  await P('/activos/' + ids['INV5-T1'] + '/asignar', { agenteId: ids.ag1 });
  await P('/activos/' + ids['INV5-D1'] + '/asignar', { agenteId: ids.ag1 });
});

test('agentes con equipos=1 traen lo asignado hoy; sin el parámetro, igual que antes', async () => {
  const con = (await G('/activos/agentes?q=INV5&equipos=1')).body.agentes;
  const uno = con.find((g) => g.id === ids.ag1), dos = con.find((g) => g.id === ids.ag2);
  assert.deepEqual(uno.equipos.map((e) => e.codigo).sort(), ['INV5-D1', 'INV5-T1']);
  assert.ok(uno.equipos.every((e) => typeof e.tipo === 'string' && e.tipo.length));
  assert.equal(uno.elementos, 2);
  assert.deepEqual(dos.equipos, []);
  const sin = (await G('/activos/agentes?q=INV5')).body.agentes;
  assert.ok(sin.every((g) => !('equipos' in g)));
  assert.equal((await G('/activos/agentes?equipos=1', tk.sup)).status, 403);
});

test('hoja «Agentes y equipos asignados»: columnas y filas (Excel y PDF usan las mismas)', () => {
  global.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const UI = require('../../public/js/activos.js');
  const t = UI.activosFilasExport('agentes', [{ nombre: 'Agente Inventado', documento: '1', operacion: 'Op', sede: 'Sede', activo: 1, equipos: [{ tipo: 'Torre', codigo: 'T-1' }, { tipo: 'Diadema', codigo: 'D-1' }] }, { nombre: 'Otro', activo: 0 }], {});
  assert.equal(t.titulo, 'Agentes y equipos asignados');
  assert.deepEqual(t.cols, ['Nombre', 'Documento', 'Operación', 'Sede', 'Equipos asignados', 'Estado']);
  assert.deepEqual(t.filas, [['Agente Inventado', '1', 'Op', 'Sede', 'Torre T-1, Diadema D-1', 'Activo'], ['Otro', '', '', '', '', 'Inactivo']]);
  const html = require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'public', 'index.html'), 'utf8');
  assert.match(html, /activosExportar\('agentes', 'xlsx'\)">Excel<\/button><button type="button" class="btn-cancel ac-btn" onclick="activosExportar\('agentes', 'pdf'\)">PDF/);
});

test('ficha imprimible: datos en pares, campos del tipo, asignación, historial reciente y firmas solo si está asignado', () => {
  const UI = require('../../public/js/activos.js');
  const estadoN = (c) => ({ libre: 'Libre', en_uso: 'En uso' }[c] || c);
  const tipo = { nombre: 'Torre', campos: [{ k: 'ram_gb', l: 'RAM (GB)' }, { k: 'cpu', l: 'Procesador' }] };
  const hist = Array.from({ length: 25 }, (_, i) => ({ fecha: '2026-11-' + String(27 - (i % 20)).padStart(2, '0') + 'T15:00:00Z', accion: 'Acción ' + i, estadoAntes: 'libre', estadoDespues: 'en_uso', motivo: '', quien: 'Persona Inventada' }));
  const a = { codigo: 'T-<1>', tipo: 'TORRE', estado: 'en_uso', marca: 'MarcaX', modelo: '', serial: 'S1', sede: 'Sede', operacion: '', proveedor: 'InConexion', datos: { ram_gb: 16 }, observaciones: 'Sin <detalle>', agente: { nombre: 'Agente Inventado', documento: '123', desde: '2026-11-20T15:00:00Z' } };
  const h = UI.activosFichaPrintHtml(a, tipo, hist, estadoN, '27/11/2026');
  assert.match(h, /<h1>Ficha de torre<\/h1>/);
  assert.match(h, /Código <span class="cod">T-&lt;1&gt;<\/span>/);
  assert.match(h, /<td class="k">Estado<\/td><td>En uso<\/td>/);
  assert.match(h, /<td class="k">Modelo<\/td><td>—<\/td>/);
  assert.match(h, /<td class="k">RAM \(GB\)<\/td><td>16<\/td>/);
  assert.doesNotMatch(h, /Procesador/);
  assert.match(h, /Asignación actual[\s\S]*Agente Inventado[\s\S]*123/);
  assert.match(h, /Sin &lt;detalle&gt;/);
  assert.equal((h.match(/Acción \d+/g) || []).length, 20);
  assert.match(h, /Acción 0<\/td>/, 'los más recientes (llegan primero)');
  assert.doesNotMatch(h, /Acción 24<\/td>/);
  assert.match(h, /Recibe \(agente\): Agente Inventado/);
  const libre = UI.activosFichaPrintHtml(Object.assign({}, a, { estado: 'libre', agente: null }), tipo, [], estadoN, '27/11/2026');
  assert.doesNotMatch(libre, /Asignación actual|class="firmas"|Historial/);
});
