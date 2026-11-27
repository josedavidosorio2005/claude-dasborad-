// faseCM2-campanas-calidad-edwin.test.js — Fase CM2 (27/11/2026, pedido de Edwin): 6 campañas nuevas de Calidad
// (ocultas, solo el administrador), la carga masiva lee los encabezados de sus plantillas y la columna
// «Codificación», y el canal «Correo». Datos INVENTADOS.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');
const dbMod = require('../db');
const reg = require('../clientes-registro');
const L = require('../../public/js/calidad-carga-masiva-logic.js');

const auth = (t) => ({ Authorization: `Bearer ${t}` });
const NUEVAS = ['CLINICA BIVETT', 'CONSULTORIO DR. JULIAN MOLANO', 'CONSULTORIO DR. ANDRES YEPES', 'INFONDO', 'SASCHA FITNESS', 'CARTERA'];
const hoy = new Date().toISOString().slice(0, 10);
let admin;

before(async () => { admin = await tokenFor('admin', MASTER_PASSWORD); });

test('migración: las 6 campañas existen con Calidad, tablero con la pestaña oculta y sin datos ni usuarios', () => {
  assert.deepEqual(dbMod.CAMPANAS_CM2.map((x) => x[0]), NUEVAS);
  for (const c of NUEVAS) {
    const r = db.prepare('SELECT modulos, dashboard, activo, parametros FROM clientes_registro WHERE nombre = ?').get(c);
    assert.ok(r, c);
    assert.deepEqual(JSON.parse(r.modulos), ['calidad']);
    assert.equal(r.activo, 1);
    assert.equal(JSON.parse(r.parametros).interno, undefined, 'campaña real, no réplica interna');
    const cfg = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get(c);
    const tabs = JSON.parse(cfg.layout).tabs || JSON.parse(cfg.layout);
    const lista = Array.isArray(tabs) ? tabs : [];
    assert.ok(lista.length >= 1 && lista.every((t) => t.oculta === true), c + ': pestañas ocultas');
    assert.equal(db.prepare('SELECT COUNT(*) n FROM users WHERE asesorCampana = ?').get(c).n, 0);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM calidad_plantillas WHERE campana = ?').get(c).n, 0);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM monitoreos WHERE campana = ?').get(c).n, 0);
  }
  const calidad = reg.campanasCalidad(db);
  for (const c of NUEVAS) assert.ok(calidad.includes(c), c + ' acepta plantilla de Calidad');
});

test('migración idempotente: otra vez no crea ni cambia nada', () => {
  const antes = JSON.stringify(db.prepare('SELECT * FROM clientes_registro ORDER BY nombre').all()) + JSON.stringify(db.prepare('SELECT cliente, layout FROM dashboards_config ORDER BY cliente').all());
  assert.equal(dbMod.crearCampanasCalidadCM2(), 0);
  const despues = JSON.stringify(db.prepare('SELECT * FROM clientes_registro ORDER BY nombre').all()) + JSON.stringify(db.prepare('SELECT cliente, layout FROM dashboards_config ORDER BY cliente').all());
  assert.equal(despues, antes);
});

test('importar una plantilla inventada en una campaña nueva y crear su asesora', async () => {
  const archivo = { formato: 'inconexion-plantilla-calidad', version: 1, nombre: 'Plantilla inventada CM2', campana: 'SASCHA FITNESS', motor: 'standard',
    campos: [{ k: 'asesor', etiqueta: 'Nombre del asesor' }, { k: 'fecha', etiqueta: 'Fecha' }, { k: 'idLlamada', etiqueta: 'ID chat' }, { k: 'codificacion', etiqueta: 'Codificación' }, { k: 'observaciones', etiqueta: 'Observaciones generales' }],
    items: [{ n: 1, categoria: 'A', nombre: 'Ítem inventado 1', peso: 40, critico: false }, { n: 2, categoria: 'B', nombre: 'Ítem inventado 2', peso: 60, critico: true }] };
  const r = await request(app).post('/api/calidad/plantillas/importar').set(auth(admin)).send({ archivo, principal: true, confirmar: true });
  assert.ok([200, 201].includes(r.status), JSON.stringify(r.body));
  assert.equal(db.prepare("SELECT COUNT(*) n FROM calidad_plantillas WHERE campana = 'SASCHA FITNESS' AND activo = 1").get().n, 1);
  const u = await request(app).post('/api/users').set(auth(admin)).send({ nombre: 'ASESORA INVENTADA CM2', user: 'cm2_inventada', password: 'Clave#FaseCM2xyz', rol: 'ASESOR', asesorCampana: 'SASCHA FITNESS' });
  assert.equal(u.status, 201, JSON.stringify(u.body));
});

test('carga masiva: encabezados de Infondo/Cartera/Sascha/Bivett, codificación y canal Correo', async () => {
  const items = [{ n: 1, label: 'Ítem inventado 1', weight: 40, critico: false }, { n: 2, label: 'Ítem inventado 2', weight: 60, critico: true }];
  // Infondo / Cartera
  const a1 = [['NOMBRES Y APELLIDOS', 'NÚMERO TELEFONO', 'CAMPAÑA', 'FECHA DE MONITOREO', 'MEDIO DE COMUNICACIÓN', 'ENLACE CHAT O IDENTIFICADOR', 'CODIFICACION', '1. Ítem (40%)', '⚠️ 2. Ítem (60%)', 'OBSERVACIONES GENERALES'],
    ['Persona Inventada', '3000000000', 'X', '2026-10-05', 'WhatsApp', 'id-inv-1', 'COD_INVENTADA', 'SI', 'NO', ''],
    ['Persona Inventada', '', 'X', '2026-10-06', 'Llamada de salida', 'id-inv-2', '', 'SI', 'SI', '']];
  const r1 = L.cmParseRows(a1, items);
  assert.equal(r1.error, undefined);
  assert.deepEqual(r1.filas.map((f) => [f.asesor, f.fecha, f.canal, f.idLlamada, f.codificacion]), [['Persona Inventada', '2026-10-05', 'WPP', 'id-inv-1', 'COD_INVENTADA'], ['Persona Inventada', '2026-10-06', 'LLAMADA', 'id-inv-2', '']]);
  assert.equal(r1.filas[0].telefono, '3000000000');
  // Sascha
  const a2 = [['Nombre del Asesor', 'Fecha', 'N° de caso / ticket', 'Canal (Chat/Correo)', 'ID CHAT', 'CODIFICACION', '1. Ítem', '2. Ítem'],
    ['Persona Inventada', '2026-09-01', '123', 'CORREO', 'c-1', 'C1', 'SI', 'SI'],
    ['Persona Inventada', '2026-09-02', '124', 'CHAT EN VIVO', 'c-2', 'C2', 'NO', 'SI'],
    ['Persona Inventada', '13/0872026', '125', 'CORREO', 'c-3', 'C3', 'SI', 'SI']];
  const r2 = L.cmParseRows(a2, items);
  assert.deepEqual(r2.filas.map((f) => [f.canal, f.idLlamada, f.codificacion]), [['CORREO', 'c-1', 'C1'], ['WPP', 'c-2', 'C2']]);
  assert.ok(r2.avisos.some((x) => /FECHA invalida/.test(x)), 'la fecha mal escrita se salta con aviso');
  // Bivett
  const a3 = [['Nombre del Asesor', 'Fecha', 'ID / Llamada', '# Teléfono', 'Codificación', 'Evaluador', '1. Ítem', '2. Ítem'], ['Persona Inventada', '2026-11-03', 'b-1', '1', 'CB', 'Evaluadora Inventada', 'SI', 'SI']];
  const r3 = L.cmParseRows(a3, items);
  assert.deepEqual([r3.filas[0].idLlamada, r3.filas[0].codificacion, r3.filas[0].evaluador], ['b-1', 'CB', 'Evaluadora Inventada']);
  assert.equal(L.cmCanal('E-mail'), 'CORREO');
  assert.equal(L.cmCanal(''), 'LLAMADA');
  // El servidor guarda CORREO y la codificación
  const filas = r2.filas.map((f) => Object.assign({}, f, { fecha: hoy }));
  const s = await request(app).post('/api/monitoreos/bulk').set(auth(admin)).send({ campana: 'SASCHA FITNESS', archivoNombre: 'inventado.xlsx', filas });
  assert.equal(s.status, 201, JSON.stringify(s.body));
  const g = db.prepare("SELECT canal, codificacion FROM monitoreos WHERE campana = 'SASCHA FITNESS' ORDER BY idLlamada").all();
  assert.deepEqual(g.map((x) => [x.canal, x.codificacion]), [['CORREO', 'C1'], ['WPP', 'C2']]);
  // y un canal desconocido se rechaza
  const mal = await request(app).post('/api/monitoreos/bulk').set(auth(admin)).send({ campana: 'SASCHA FITNESS', filas: [Object.assign({}, filas[0], { canal: 'FAX' })] });
  assert.equal(mal.status, 400);
});
