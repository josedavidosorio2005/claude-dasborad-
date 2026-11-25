// faseSTA10-trazabilidad-mes.test.js — Pedidos de Edwin (25/11/2026, 2:45 p. m.) para «Gestión STA» de ORLANT:
//  1) cada cambio de «Actualizar estado» queda en el histórico con QUIÉN lo hizo (líder o administrador), no a nombre
//     de la asesora, y se ve en Gestionados («Cambios de estado»), buscable por Numero Autorizacion;
//  2) filtro por mes junto a las fechas, que arranca en el mes actual.
// Datos INVENTADOS. Las funciones del navegador se prueban tal cual salen del generador, en un vm.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const bcrypt = require('bcryptjs');
const { request, app, db, tokenFor } = require('./helpers');
const STA = require('../orlant-sta');

const H = (t) => ({ Authorization: 'Bearer ' + t });
const B = '/api/orlant/sta';
let sup, as1, id1;
function crear(user, nombre, rol, perms, asesorCampana) {
  return Number(db.prepare(`INSERT INTO users (nombre, user, rol, active, password_hash, perms, asesorCampana, createdAt, debe_cambiar_password) VALUES (?,?,?,1,?,?,?,?,0)`)
    .run(nombre, user, rol, bcrypt.hashSync('Clave#2026x', 4), JSON.stringify(perms), asesorCampana || null, new Date().toISOString()).lastInsertRowid);
}
const caso = (n) => db.prepare('SELECT * FROM sta_casos WHERE campana = ? AND numero = ?').get('ORLANT', n);
const fila = (n) => ({ 'Fecha Ingreso Sta': '2026-11-02 08:00:00', Entidad: 'ENTIDAD INVENTADA', 'Numero Autorizacion': 'TR' + n, Estado: 'En proceso', 'Descripcion Cups': 'CUPS', 'Fecha Autorizacion': '2026-11-01 00:00:00', 'Fecha Expiracion': '2026-12-31 00:00:00', Servicio: 'SERV' });

before(async () => {
  crear('sta10_sup', 'Líder Inventada', 'SUPERVISOR', { campana_ORLANT: true, cliente_ORLANT: true });
  id1 = crear('sta10_as1', 'Asesora Inventada', 'ASESOR', { campana_ORLANT: true }, 'ORLANT');
  [sup, as1] = await Promise.all(['sta10_sup', 'sta10_as1'].map((u) => tokenFor(u, 'Clave#2026x')));
  assert.equal((await request(app).post(B + '/cargas').set(H(sup)).send({ archivo: 'b.xlsx', columnas: STA.CAMPOS, filas: [1, 2, 3].map(fila) })).status, 200);
  assert.equal((await request(app).post(B + '/asignar').set(H(sup)).send({ agenteId: id1, cantidad: 3 })).status, 200);
  assert.equal((await request(app).post(B + '/casos/TR1/codificar').set(H(as1)).send({ tipi: 'No contesta', obs: 'Obs inventada' })).status, 200);
});

test('1) «Actualizar estado» guarda en el histórico QUIÉN hizo el cambio (la líder), nunca la asesora', async () => {
  const r = await request(app).post(B + '/estados').set(H(sup)).send({ archivo: 'e.xlsx', filas: [{ numero: 'TR2', estado: 'Agendada' }, { numero: 'TR1', estado: 'Facturado' }] });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  for (const n of ['TR1', 'TR2']) {
    const h = JSON.parse(caso(n).hist).pop();
    assert.equal(h.origen, 'actualizar');
    assert.match(h.por, /Líder Inventada|sta10_sup/, 'quién lo hizo');
    assert.ok(!/Asesora Inventada/.test(h.por), 'no a nombre de la asesora');
  }
  // La gestión hecha por la asesora sigue a su nombre (TR1).
  assert.equal(caso('TR1').agenteId, id1);
  // La carga normal también deja quién fue.
  assert.equal((await request(app).post(B + '/cargas').set(H(sup)).send({ archivo: 'b2.xlsx', columnas: STA.CAMPOS, filas: [Object.assign(fila(3), { Estado: 'Anulada' })] })).status, 200);
  const h3 = JSON.parse(caso('TR3').hist).pop();
  assert.equal(h3.origen, 'carga'); assert.match(h3.por, /Líder Inventada|sta10_sup/);
});

// ── Navegador ──
const APP = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'orlant-sta-app.js'), 'utf8');
const A = require('../../public/js/orlant-sta-app.js');
function fuente(nombre) {
  const i = APP.search(new RegExp('\\n(?:async )?function ' + nombre + '\\('));
  assert.ok(i >= 0, 'no está la función ' + nombre);
  const resto = APP.slice(i + 1);
  const fin = resto.slice(1).search(/\n(?:async )?function |\nconst |\nlet |\nROOT\./);
  return resto.slice(0, fin + 1);
}
function contexto(casos, valores) {
  const els = {};
  const el = (id) => els[id] || (els[id] = { value: (valores || {})[id] || '', innerHTML: '' });
  const ctx = { S: { casos }, $: el, esc: (s) => String(s == null ? '' : s), verFecha: (s) => String(s || '').slice(0, 10), nombreAgente: (id) => 'Asesora ' + id,
    ahora: () => '2026-11-26 10:00:00', p2: (n) => String(n).padStart(2, '0'), NOMBRE_MES: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'], mesIniciado: {} };
  vm.createContext(ctx);
  vm.runInContext(['mesActualSta', 'rangoMes', 'mesesConGestion', 'llenarMeses', 'ponerRango', 'cambiosEstado', 'pintarCambios'].map(fuente).join('\n'), ctx);
  return { ctx, els };
}

test('1) Gestionados › «Cambios de estado»: lista los cambios con quién los hizo y se busca por Numero Autorizacion', () => {
  const casos = {
    a: { 'Numero Autorizacion': 'INV-001', _hist: [{ fecha: '2026-11-20 09:00:00', de: 'En proceso', a: 'Agendada', origen: 'actualizar', por: 'Líder Inventada', sale: true, agente: 7 }] },
    b: { 'Numero Autorizacion': 'INV-002', _hist: [{ fecha: '2026-11-21 10:00:00', de: 'Agendada', a: 'En proceso', origen: 'carga', por: 'Admin Inventado', vuelve: true }, { fecha: '2026-11-01', de: '', a: 'x', origen: 'otro' }] },
  };
  const { ctx, els } = contexto(casos, { gsQ: '', gsD: '2026-11-01', gsH: '2026-11-30' });
  assert.equal(ctx.cambiosEstado().length, 2, 'solo los de «Actualizar estado» o la carga');
  ctx.pintarCambios();
  assert.match(els.gsCambios.innerHTML, /INV-002[\s\S]*Volvió a disponibles[\s\S]*Admin Inventado[\s\S]*Carga de la base/);
  assert.match(els.gsCambios.innerHTML, /INV-001[\s\S]*En proceso → Agendada[\s\S]*Salió de la gestión \(era de Asesora 7\)[\s\S]*Líder Inventada[\s\S]*Actualizar estado/);
  els.gsQ.value = 'inv-001';
  assert.equal(ctx.cambiosEstado().length, 1, 'buscador por Numero Autorizacion');
  // La tabla de Gestionados también pinta los cambios.
  assert.match(APP, /function pintarGestSup\(\)\{\n  pintarCambios\(\);/);
  assert.ok(A.STA_MARKUP.includes('<div id="gsCambios"></div>'));
});

test('2) «Mes» junto a las fechas: arranca en el mes actual, llena Desde/Hasta y ofrece los meses con gestión y «Todos»', () => {
  const casos = { a: { _fg: '2026-09-15 08:00:00' }, b: { _fg: '2026-10-02 08:00:00', _prev: [{ fg: '2026-08-05' }] } };
  const { ctx, els } = contexto(casos, {});
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.mesesConGestion())), ['2026-11', '2026-10', '2026-09', '2026-08']);
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.rangoMes('2026-02'))), ['2026-02-01', '2026-02-28']);
  ctx.llenarMeses('gr');
  assert.equal(els.grMes.value, '2026-11', 'arranca en el mes actual');
  assert.deepEqual([els.grD.value, els.grH.value], ['2026-11-01', '2026-11-30']);
  assert.match(els.grMes.innerHTML, /<option value="2026-10">Octubre 2026<\/option>[\s\S]*<option value="">Todos los meses<\/option>/);
  // Al volver a llenar no se pierde lo que eligió la persona.
  els.grMes.value = '2026-09'; ctx.llenarMeses('gr');
  assert.equal(els.grMes.value, '2026-09');
  assert.ok(A.STA_MARKUP.includes('<label class="f">Mes<select class="inp" id="grMes" aria-label="Mes de gestión" onchange="STAapp.elegirMes(\'gr\')"></select></label>'));
  assert.ok(A.STA_MARKUP.includes('<label class="f">Mes<select class="inp" id="gsMes" aria-label="Mes de gestión" onchange="STAapp.elegirMes(\'gs\')"></select></label>'));
  assert.match(APP, /function limpiarGr\(\)\{ \['grAg','grEnt','grServ','grD','grH','grMes'\]/);
});
