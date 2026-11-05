// fase259-aurora-agendas-usuaria.test.js — Fase 259 (pedido de Edwin, reunion
// 05/11, Clinica Aurora): "Agendas por usuaria" desde el reporte de citas de
// la clinica. Lector y agregacion en el navegador (sin datos de pacientes en
// lo que se envia), canal desde texto con erratas, alias resuelto AL MOSTRAR,
// recarga del mismo mes reemplaza, y la pestaña nueva solo en Aurora.
// Archivo y nombres 100 % SINTETICOS.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');
const dbMod = require('../db');
const XLSX = require(path.join(__dirname, '..', '..', 'public', 'js', 'vendor', 'xlsx-0.20.3.full.min.js'));
const L = require('../../public/js/agendas-usuaria-logic.js');

const AURORA = 'CLINICA AURORA';
const auth = (t) => ({ Authorization: `Bearer ${t}` });
let admin;

// Serial de Excel para una fecha (UTC), como lo trae el .xls real.
const serial = (iso) => Math.round(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86400000) + 25569;

// Reporte SINTETICO con columnas sensibles de mentira que nunca deben salir.
function reporte(filas) {
  const head = ['Id', 'documento', 'nombres', 'telefono', 'direccion', 'diagnostico', 'FechaCita', 'usuario_confirma', 'motivo_conf', 'fecha_confirma',
    'nombresede', 'usuario_regcita', 'consulta', 'cirugia', 'tipo_paciente', 'observacion'];
  const aoa = [['Reporte de citas (sintetico)'], head].concat(filas.map((f, i) => [i + 1, '1000' + i, 'Paciente Ficticio ' + i, '300000000' + i, 'Calle Falsa ' + i, 'DX FICTICIO',
    serial(f.cita), f.conf, f.motivo, f.fconf ? serial(f.fconf) : null, f.sede || 'SEDE UNO', f.crea || 'USUARIACLINICA', f.consulta, f.cirugia, f.tipo || 'ANTIGUO', 'obs ficticia']));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'oct');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const back = XLSX.read(buf, { type: 'buffer' });
  return XLSX.utils.sheet_to_json(back.Sheets.oct, { header: 1, blankrows: false, defval: null });
}
const OCT = [
  { cita: '2026-10-05', conf: 'INCONEXION', motivo: 'CONFIRMA POR LLAMADA', fconf: '2026-10-02', consulta: true, cirugia: false, crea: 'INCONEXION' },
  { cita: '2026-10-06', conf: 'inconexion  a', motivo: 'CONFIRMA POR LALMADA', fconf: '2026-10-03', consulta: false, cirugia: true },
  { cita: '2026-10-07', conf: 'INCONEXION A', motivo: 'CONFIRM APOR WPP', fconf: '2026-09-30', consulta: 1, cirugia: 0, tipo: 'NUEVO', crea: 'INCONEXION A' },
  { cita: '2026-10-08', conf: 'INCONEXION B', motivo: 'NO CONETESTA', fconf: '2026-10-07', consulta: false, cirugia: false, sede: 'SEDE DOS' },
  { cita: '2026-10-09', conf: 'INCONEXION B', motivo: 'CONFIRMA WWP', fconf: '2026-10-07', consulta: true, cirugia: false },
  { cita: '2026-10-10', conf: 'INCONEXION B', motivo: 'reprogramada', fconf: '2026-10-08', consulta: true, cirugia: false },
  { cita: '2026-10-11', conf: 'USUARIACLINICA', motivo: 'CONFIRMA POR CEL', fconf: '2026-10-09', consulta: true, cirugia: false },
];

before(async () => { admin = await tokenFor('admin', MASTER_PASSWORD); });

test('canal desde texto libre con erratas reales, tipo de cita y usuario', () => {
  const casos = { 'CONFIRMA POR LLAMADA': 'Llamada', 'CONFIRMA POR LALMADA': 'Llamada', 'CONFIRM APOR WPP': 'WhatsApp', 'CONFIRMA WWP': 'WhatsApp',
    'confirma por whatsapp': 'WhatsApp', 'NO CONETESTA': 'No contesta', 'NO CONTESTA': 'No contesta', 'CONFIRMA POR CEL': 'Llamada', 'Llamó, confirmó': 'Llamada', '': 'Otro', 'reprogramada': 'Otro' };
  for (const [t, esperado] of Object.entries(casos)) assert.equal(L.auCanal(t), esperado, t);
  assert.equal(L.auTipoCita(true, true), 'Cirugía');
  assert.equal(L.auTipoCita('1', '0'), 'Consulta');
  assert.equal(L.auTipoCita(false, false), 'Otro');
  assert.equal(L.auUsuario('  inconexion   d '), 'INCONEXION D');
  assert.equal(L.auUsuario('USUARIACLINICA'), L.AU_CLINICA);
  assert.equal(L.auFecha(serial('2026-10-31')), '2026-10-31');
  assert.equal(L.auFecha('05/10/2026'), '2026-10-05');
});

test('lector: columnas por nombre (sin importar mayusculas ni la fila del encabezado), conteos de control', () => {
  const r = L.auParseFilas(reporte(OCT));
  assert.equal(r.error, undefined);
  assert.equal(r.citas, 7);
  assert.deepEqual(r.meses, { '2026-10': 7 });
  assert.deepEqual(r.porUsuario, { INCONEXION: 1, 'INCONEXION A': 2, 'INCONEXION B': 3, [L.AU_CLINICA]: 1 });
  assert.deepEqual(r.porCanal, { Llamada: 3, WhatsApp: 2, 'No contesta': 1, Otro: 1 });
  assert.deepEqual(r.porSede, { 'SEDE UNO': 6, 'SEDE DOS': 1 });
  assert.equal(r.creadasInconexion, 2, 'solo las creadas por InConexion');
  assert.equal(r.filas.filter((f) => f.rol === 'confirma').reduce((s, f) => s + f.n, 0), 7);
  const sept = r.filas.find((f) => f.usuario === 'INCONEXION A' && f.canal === 'WhatsApp' && f.rol === 'confirma');
  assert.equal(sept.dia, '2026-09-30', 'se confirma antes de la cita: el mes es el de la cita');
  assert.equal(sept.mes, '2026-10');
  assert.equal(sept.tipoPaciente, 'Nuevo');
  const sinCol = L.auParseFilas([['fechacita', 'usuario_confirma'], [serial('2026-10-01'), 'INCONEXION']]);
  assert.match(sinCol.error, /faltan las columnas motivo_conf, fecha_confirma, nombresede/);
});

test('PRIVACIDAD: lo que sale del navegador solo trae conteos (nunca documento, nombres, telefono, direccion, diagnostico)', () => {
  const r = L.auParseFilas(reporte(OCT));
  const payload = JSON.stringify(r.filas);
  for (const prohibido of ['documento', 'nombres', 'telefono', 'direccion', 'diagnostico', 'observacion', 'Paciente Ficticio', 'Calle Falsa', '3000000000', 'DX FICTICIO', '10000', 'USUARIACLINICA', 'obs ficticia']) {
    assert.ok(!payload.includes(prohibido), 'el envio no debe contener: ' + prohibido);
  }
  r.filas.forEach((f) => assert.deepEqual(Object.keys(f), L.AU_CAMPOS_FILA));
});

test('migracion: tabla nueva, modulo y pestaña oculta SOLO en Aurora; idempotente', () => {
  const reg = JSON.parse(db.prepare('SELECT modulos FROM clientes_registro WHERE nombre = ?').get(AURORA).modulos);
  assert.ok(reg.includes('agendas_usuaria'));
  const tabs = JSON.parse(db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get(AURORA).layout).tabs;
  const tab = tabs.find((t) => t.key === 'agendas_usuaria');
  assert.deepEqual(tab, { key: 'agendas_usuaria', label: 'Agendas por usuaria', oculta: true, panels: [{ tipo: 'agendas_usuaria_panel', campana: AURORA, titulo: 'Agendas por usuaria' }] });
  for (const c of ['ORLANT', 'MOBILIZE', 'HOSPITAL LA MARIA']) {
    const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get(c);
    if (row) assert.ok(!row.layout.includes('agendas_usuaria'), c);
  }
  const antes = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get(AURORA).layout;
  dbMod.crearAgendasUsuariaAurora();
  assert.equal(db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get(AURORA).layout, antes);
});

test('carga: el servidor rechaza campos de mas (datos de pacientes) y valores fuera de lista', async () => {
  const base = { mes: '2026-10', dia: '2026-10-02', sede: 'SEDE UNO', usuario: 'INCONEXION', canal: 'Llamada', tipoCita: 'Consulta', tipoPaciente: 'Antiguo', rol: 'confirma', n: 1 };
  for (const extra of [{ cedula: '123' }, { nombres: 'X' }, { telefono: '3' }]) {
    const r = await request(app).post('/api/calidad/agendas-usuaria/carga').set(auth(admin)).send({ campana: AURORA, filas: [Object.assign({}, base, extra)] });
    assert.equal(r.status, 400, JSON.stringify(extra));
  }
  const malCanal = await request(app).post('/api/calidad/agendas-usuaria/carga').set(auth(admin)).send({ campana: AURORA, filas: [Object.assign({}, base, { canal: 'Fax' })] });
  assert.equal(malCanal.status, 400);
});

test('carga, impacto, recarga del mismo mes reemplaza (con respaldo) y nombre resuelto AL MOSTRAR', async () => {
  const filas = L.auParseFilas(reporte(OCT)).filas;
  const imp = await request(app).post('/api/calidad/agendas-usuaria/carga/impacto').set(auth(admin)).send({ campana: AURORA, filas });
  assert.equal(imp.status, 200, JSON.stringify(imp.body).slice(0, 400));
  assert.deepEqual(imp.body.meses, [{ mes: '2026-10', citasExistentes: 0, citasNuevas: 7 }]);
  const c1 = await request(app).post('/api/calidad/agendas-usuaria/carga').set(auth(admin)).send({ campana: AURORA, archivoNombre: 'sintetico.xlsx', filas });
  assert.equal(c1.status, 201, JSON.stringify(c1.body));
  assert.equal(c1.body.citas, 7);
  // sin alias: se ve el codigo tal cual
  let d = await request(app).get('/api/calidad/agendas-usuaria/datos?campana=' + encodeURIComponent(AURORA)).set(auth(admin));
  assert.ok(d.body.filas.every((f) => f.asesora === f.usuario));
  // alias (nombre FICTICIO) -> se resuelve al mostrar, tambien para el mes ya cargado
  const a = await request(app).post('/api/alias-asesores').set(auth(admin)).send({ campana: AURORA, alias: 'INCONEXION A', canonico: 'Asesora Ficticia Uno' });
  assert.equal(a.status, 201, JSON.stringify(a.body));
  assert.equal(a.body.advertencia, undefined, 'el codigo esta en el reporte: no se advierte');
  d = await request(app).get('/api/calidad/agendas-usuaria/datos?campana=' + encodeURIComponent(AURORA)).set(auth(admin));
  assert.ok(d.body.filas.filter((f) => f.usuario === 'INCONEXION A').every((f) => f.asesora === 'Asesora Ficticia Uno'));
  assert.ok(d.body.filas.filter((f) => f.usuario === 'INCONEXION B').every((f) => f.asesora === 'INCONEXION B'));
  // editar el alias cambia el nombre de lo ya cargado
  const ed = await request(app).put('/api/alias-asesores/' + a.body.id).set(auth(admin)).send({ alias: 'INCONEXION A', canonico: 'Asesora Ficticia Dos' });
  assert.equal(ed.status, 200, JSON.stringify(ed.body));
  d = await request(app).get('/api/calidad/agendas-usuaria/datos?campana=' + encodeURIComponent(AURORA)).set(auth(admin));
  assert.ok(d.body.filas.filter((f) => f.usuario === 'INCONEXION A').every((f) => f.asesora === 'Asesora Ficticia Dos'));
  // recargar octubre con menos citas: reemplaza, no suma
  const filas2 = L.auParseFilas(reporte(OCT.slice(0, 3))).filas;
  const imp2 = await request(app).post('/api/calidad/agendas-usuaria/carga/impacto').set(auth(admin)).send({ campana: AURORA, filas: filas2 });
  assert.deepEqual(imp2.body.meses, [{ mes: '2026-10', citasExistentes: 7, citasNuevas: 3 }]);
  const c2 = await request(app).post('/api/calidad/agendas-usuaria/carga').set(auth(admin)).send({ campana: AURORA, filas: filas2 });
  assert.equal(c2.status, 201);
  const total = db.prepare("SELECT SUM(n) AS n FROM agendas_usuaria WHERE campana = ? AND mes = '2026-10' AND rol = 'confirma'").get(AURORA).n;
  assert.equal(total, 3);
  const versiones = db.prepare("SELECT COUNT(*) AS n FROM cargas_versiones WHERE carga = 'agendas_usuaria' AND campana = ?").get(AURORA).n;
  assert.ok(versiones >= 1, 'respaldo para Deshacer');
  const op = await request(app).get('/api/calidad/agendas-usuaria/opciones?campana=' + encodeURIComponent(AURORA)).set(auth(admin));
  assert.deepEqual(op.body.meses, ['2026-10']);
});

test('vista: tarjetas, tabla por asesora (mayor a menor, con total y creadas), por dia y filtros', () => {
  const filas = L.auParseFilas(reporte(OCT)).filas.map((f) => Object.assign({}, f, { asesora: f.usuario === 'INCONEXION A' ? 'Asesora Ficticia Uno' : f.usuario }));
  const t = L.auTarjetas(filas);
  assert.deepEqual([t.total, t.llamada, t.whatsapp, t.noContesta, t.otro, t.creadas, t.pctWhatsapp], [7, 3, 2, 1, 1, 2, 28.6]);
  const tab = L.auPorAsesora(filas);
  assert.deepEqual(tab.filas.map((x) => [x.asesora, x.total, x.creadas]), [['INCONEXION B', 3, 0], ['Asesora Ficticia Uno', 2, 1], ['Clínica (no InConexion)', 1, 0], ['INCONEXION', 1, 1]]);
  assert.equal(tab.total.total, 7);
  assert.equal(tab.total.creadas, 2);
  assert.deepEqual(L.auPorDia(filas).map((x) => x.dia), ['2026-09-30', '2026-10-02', '2026-10-03', '2026-10-07', '2026-10-08', '2026-10-09']);
  assert.equal(L.auTarjetas(L.auFiltrar(filas, { asesoras: ['INCONEXION B'], canales: ['WhatsApp'] })).total, 1);
  assert.equal(L.auTarjetas(L.auFiltrar(filas, { meses: ['2026-11'] })).total, 0);
});

test('navegador: el tipo nuevo esta en las listas cerradas, en el Centro y en el plan de Cargar Datos', () => {
  const fs = require('fs');
  const pub = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', f), 'utf8');
  assert.match(pub('mes-global-logic.js'), /GD_TIPOS_SIGUEN_MESES = \[[^\]]*'agendas_usuaria_panel'/);
  assert.match(pub('dashboard-export-tipos.js'), /'agendas_usuaria_panel'/);
  assert.match(pub('dashboard-generic.js'), /if\(p\.tipo === 'agendas_usuaria_panel'\)\{ _auRender\(p, i\); return; \}/);
  assert.match(pub('agendas-usuaria.js'), /gdMesesTarjetasActual\(\)/);
  const C = require('../../public/js/centro-cargas-logic.js');
  assert.ok(C.centroSubeDesdeMes('agendas_usuaria'));
  const plan = require('../../public/js/cargas-logic.js').cargasPlanConsolidado({}, null, null, null, null, null, null, null, null, null, undefined, null, null, null, null, null, null, null, null, [{ label: 'fechacita' }]);
  assert.ok(plan.some((h) => h.tipo === 'agendas_usuaria'), 'renglon del plan');
});

test('Fase 260: fechas como Date (lectura de Cargar Datos con cellNF sobre celdas con formato de fecha)', () => {
  // Mismas opciones que procesarArchivoConsolidado (cargas.js) y celdas con formato de fecha, como el .xls real.
  const head = ['fechacita', 'usuario_confirma', 'motivo_conf', 'fecha_confirma', 'nombresede'];
  const ws = XLSX.utils.aoa_to_sheet([head, [serial('2026-10-31'), 'INCONEXION C', 'CONFIRMA POR WPP', serial('2026-09-30'), 'SEDE UNO'], [serial('2026-10-01'), 'INCONEXION', 'LLAMADA', serial('2026-10-01'), 'SEDE UNO']]);
  ['A2', 'D2', 'A3', 'D3'].forEach((c) => { ws[c].z = 'dd/mm/yyyy'; });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'oct');
  for (const bookType of ['xlsx', 'biff8']) {
    const back = XLSX.read(new Uint8Array(XLSX.write(wb, { type: 'buffer', bookType })), { type: 'array', sheetStubs: true, cellNF: true });
    const aoa = XLSX.utils.sheet_to_json(back.Sheets.oct, { header: 1, blankrows: false, defval: null });
    const r = L.auParseFilas(aoa);
    assert.equal(r.citas, 2, bookType + ': ' + JSON.stringify(r.avisos));
    assert.deepEqual(r.meses, { '2026-10': 2 }, bookType);
    const c = r.filas.find((f) => f.usuario === 'INCONEXION C');
    assert.equal(c.dia, '2026-09-30', bookType);
  }
  assert.equal(L.auFecha(new Date(2026, 9, 31)), '2026-10-31');
  assert.equal(L.auFecha(new Date('x')), null);
});
