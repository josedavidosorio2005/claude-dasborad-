// fase259-aurora-agendas-usuaria.test.js — Fase 259 (pedido de Edwin, reunion
// 05/11, Clinica Aurora), al dia con la Fase 265: "Agendas por usuaria" desde el
// reporte de citas de la clinica. Lector y agregacion en el navegador (sin
// datos de pacientes en lo que se envia), columnas por nombre (fechacita,
// fecha_registro, usuario_confirma, nombresede, especial), alias resuelto AL
// MOSTRAR, recarga del mismo mes reemplaza, 3 vistas y filtros por fecha.
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

const serial = (iso) => Math.round(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86400000) + 25569;

// Reporte SINTETICO con columnas sensibles de mentira que nunca deben salir.
function reporte(filas) {
  const head = ['Id', 'documento', 'nombres', 'telefono', 'direccion', 'diagnostico', 'fecha_registro', 'FechaCita', 'especial', 'usuario_regcita', 'motivo_conf', 'nombresede', 'observacion']; // Fase 302: usuario que registra
  const aoa = [['Reporte de citas (sintetico)'], head].concat(filas.map((f, i) => [i + 1, '1000' + i, 'Paciente Ficticio ' + i, '300000000' + i, 'Calle Falsa ' + i, 'DX FICTICIO',
    f.sol ? serial(f.sol) : null, serial(f.cita), f.esp || 'ESPECIALIDAD UNO', f.conf, 'CONFIRMA', f.sede || 'SEDE UNO', 'obs ficticia']));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'oct');
  const back = XLSX.read(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }), { type: 'buffer' });
  return XLSX.utils.sheet_to_json(back.Sheets.oct, { header: 1, blankrows: false, defval: null });
}
const OCT = [
  { cita: '2026-10-05', sol: '2026-09-20', conf: 'INCONEXION', esp: 'DERMATOLOGIA' },
  { cita: '2026-10-06', sol: '2026-10-01', conf: 'inconexion  a', esp: 'DERMATOLOGIA' },
  { cita: '2026-10-07', sol: '2026-08-15', conf: 'INCONEXION A', esp: 'RADIOLOGIA' },
  { cita: '2026-10-08', sol: '2026-10-07', conf: 'INCONEXION B', esp: 'RADIOLOGIA', sede: 'SEDE DOS' },
  { cita: '2026-10-09', sol: '2026-10-07', conf: 'INCONEXION B', esp: 'DERMATOLOGIA' },
  { cita: '2026-10-10', sol: null, conf: 'INCONEXION B', esp: 'COSMETOLOGIA' },
  { cita: '2026-10-11', sol: '2026-10-09', conf: 'USUARIACLINICA', esp: 'DERMATOLOGIA' },
];
const NOV = [{ cita: '2026-11-03', sol: '2026-10-30', conf: 'INCONEXION A', esp: 'DERMATOLOGIA' }, { cita: '2026-11-04', sol: '2026-11-01', conf: 'INCONEXION', esp: 'RADIOLOGIA' }];

before(async () => { admin = await tokenFor('admin', MASTER_PASSWORD); });

test('usuario y fechas: codigo normalizado, personal de la clinica agrupado, serial/Date/texto', () => {
  assert.equal(L.auUsuario('  inconexion   d '), 'INCONEXION D');
  assert.equal(L.auUsuario('USUARIACLINICA'), L.AU_CLINICA);
  assert.equal(L.auFecha(serial('2026-10-31')), '2026-10-31');
  assert.equal(L.auFecha('05/10/2026'), '2026-10-05');
  assert.equal(L.auFecha(new Date(2026, 9, 31)), '2026-10-31');
  assert.equal(L.auFecha(new Date('x')), null);
});

test('lector: columnas por nombre, mes de la cita, fecha de solicitud y especialidad; conteos de control', () => {
  const r = L.auParseFilas(reporte(OCT));
  assert.equal(r.error, undefined);
  assert.equal(r.citas, 7);
  assert.deepEqual(r.meses, { '2026-10': 7 });
  assert.deepEqual(r.porUsuario, { INCONEXION: 1, 'INCONEXION A': 2, 'INCONEXION B': 3, [L.AU_CLINICA]: 1 });
  assert.deepEqual(r.porEspecialidad, { DERMATOLOGIA: 4, RADIOLOGIA: 2, COSMETOLOGIA: 1 });
  assert.deepEqual([r.solicitudDesde, r.solicitudHasta], ['2026-08-15', '2026-10-09']);
  assert.match(r.avisos.join(' '), /1 cita\(s\) sin fecha de registro/); // Fase 302
  assert.equal(r.filas.reduce((s, f) => s + f.n, 0), 7);
  const f = r.filas.find((x) => x.especialidad === 'RADIOLOGIA' && x.usuario === 'INCONEXION A');
  assert.deepEqual([f.mes, f.fechaCita, f.fechaSolicitud], ['2026-10', '2026-10-07', '2026-08-15']);
  // Fase 302: solo fechacita es obligatoria; con casi nada mas, no parece una base.
  const sinCol = L.auParseFilas([['fechacita', 'usuario_regcita'], [serial('2026-10-01'), 'INCONEXION']]);
  assert.match(sinCol.error, /no parece una base de citas: solo se reconocen 2 columna/);
  const sinFecha = L.auParseFilas([['entidad', 'usuario_regcita', 'especial', 'prof'], ['EPS', 'INCONEXION', 'X', 'Y']]);
  assert.match(sinFecha.error, /faltan las columnas fechacita/);
});

test('PRIVACIDAD: lo que sale del navegador solo trae conteos (nunca documento, nombres, telefono, direccion, diagnostico)', () => {
  const r = L.auParseFilas(reporte(OCT));
  const payload = JSON.stringify(r.filas);
  for (const prohibido of ['documento', 'nombres', 'telefono', 'direccion', 'diagnostico', 'observacion', 'Paciente Ficticio', 'Calle Falsa', '3000000000', 'DX FICTICIO', 'USUARIACLINICA', 'obs ficticia', 'CONFIRMA']) {
    assert.ok(!payload.includes(prohibido), 'el envio no debe contener: ' + prohibido);
  }
  r.filas.forEach((f) => assert.deepEqual(Object.keys(f), L.AU_CAMPOS_FILA));
});

test('migracion: modulo y pestaña SOLO en Aurora; desde la Fase 302 «Agendas», una sola vista; idempotente', () => {
  const reg = JSON.parse(db.prepare('SELECT modulos FROM clientes_registro WHERE nombre = ?').get(AURORA).modulos);
  assert.ok(reg.includes('agendas_usuaria'));
  const tab = JSON.parse(db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get(AURORA).layout).tabs.find((t) => t.key === 'agendas_usuaria');
  assert.equal(tab.oculta, true);
  assert.equal(tab.label, 'Agendas');
  assert.deepEqual(tab.panels.map((p) => [p.tipo, p.vista, p.titulo]), [['agendas_usuaria_panel', 'agendas', 'Agendas']]);
  assert.equal(tab.subtabs, undefined);
  for (const c of ['ORLANT', 'MOBILIZE', 'HOSPITAL LA MARIA']) {
    const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get(c);
    if (row) assert.ok(!row.layout.includes('agendas_usuaria'), c);
  }
  const cols = db.prepare('PRAGMA table_info(agendas_usuaria)').all().map((c) => c.name);
  for (const c of ['fechaCita', 'fechaSolicitud', 'especialidad', 'entidad', 'prof', 'base']) assert.ok(cols.includes(c), c);
  const antes = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get(AURORA).layout;
  dbMod.crearAgendasUsuariaAurora(); dbMod.migrarAgendasUsuariaVistas(); dbMod.agendasTresBasesAurora();
  assert.equal(db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get(AURORA).layout, antes);
});

test('carga: el servidor rechaza campos de mas (datos de pacientes) y la forma vieja de la Fase 259', async () => {
  const base = { mes: '2026-10', fechaCita: '2026-10-02', fechaSolicitud: '2026-09-30', sede: 'SEDE UNO', usuario: 'INCONEXION', especialidad: 'DERMATOLOGIA', n: 1 };
  for (const extra of [{ cedula: '123' }, { nombres: 'X' }, { telefono: '3' }, { canal: 'Llamada' }]) {
    const r = await request(app).post('/api/calidad/agendas-usuaria/carga').set(auth(admin)).send({ campana: AURORA, filas: [Object.assign({}, base, extra)] });
    assert.equal(r.status, 400, JSON.stringify(extra));
  }
  const malFecha = await request(app).post('/api/calidad/agendas-usuaria/carga').set(auth(admin)).send({ campana: AURORA, filas: [Object.assign({}, base, { fechaCita: '02/10/2026' })] });
  assert.equal(malFecha.status, 400);
});

test('carga, impacto, recarga del mismo mes reemplaza (con respaldo) y nombre resuelto AL MOSTRAR', async () => {
  const filas = L.auParseFilas(reporte(OCT)).filas;
  const imp = await request(app).post('/api/calidad/agendas-usuaria/carga/impacto').set(auth(admin)).send({ campana: AURORA, filas });
  assert.equal(imp.status, 200, JSON.stringify(imp.body).slice(0, 400));
  assert.deepEqual(imp.body.meses, [{ mes: '2026-10', citasExistentes: 0, citasNuevas: 7 }]);
  const c1 = await request(app).post('/api/calidad/agendas-usuaria/carga').set(auth(admin)).send({ campana: AURORA, archivoNombre: 'sintetico.xlsx', filas });
  assert.equal(c1.status, 201, JSON.stringify(c1.body));
  assert.equal(c1.body.citas, 7);
  let d = await request(app).get('/api/calidad/agendas-usuaria/datos?campana=' + encodeURIComponent(AURORA)).set(auth(admin));
  assert.ok(d.body.filas.every((f) => f.asesora === f.usuario));
  assert.deepEqual(Object.keys(d.body.filas[0]).sort(), ['asesora', 'base', 'entidad', 'especialidad', 'fechaCita', 'fechaSolicitud', 'mes', 'n', 'prof', 'sede', 'usuario']); // Fase 302: + base, entidad, prof
  const a = await request(app).post('/api/alias-asesores').set(auth(admin)).send({ campana: AURORA, alias: 'INCONEXION A', canonico: 'Asesora Ficticia Uno' });
  assert.equal(a.status, 201, JSON.stringify(a.body));
  d = await request(app).get('/api/calidad/agendas-usuaria/datos?campana=' + encodeURIComponent(AURORA)).set(auth(admin));
  assert.ok(d.body.filas.filter((f) => f.usuario === 'INCONEXION A').every((f) => f.asesora === 'Asesora Ficticia Uno'));
  const ed = await request(app).put('/api/alias-asesores/' + a.body.id).set(auth(admin)).send({ alias: 'INCONEXION A', canonico: 'Asesora Ficticia Dos' });
  assert.equal(ed.status, 200, JSON.stringify(ed.body));
  d = await request(app).get('/api/calidad/agendas-usuaria/datos?campana=' + encodeURIComponent(AURORA)).set(auth(admin));
  assert.ok(d.body.filas.filter((f) => f.usuario === 'INCONEXION A').every((f) => f.asesora === 'Asesora Ficticia Dos'));
  const filas2 = L.auParseFilas(reporte(OCT.slice(0, 3))).filas;
  const imp2 = await request(app).post('/api/calidad/agendas-usuaria/carga/impacto').set(auth(admin)).send({ campana: AURORA, filas: filas2 });
  assert.deepEqual(imp2.body.meses, [{ mes: '2026-10', citasExistentes: 7, citasNuevas: 3 }]);
  assert.equal((await request(app).post('/api/calidad/agendas-usuaria/carga').set(auth(admin)).send({ campana: AURORA, filas: filas2 })).status, 201);
  assert.equal(db.prepare("SELECT SUM(n) AS n FROM agendas_usuaria WHERE campana = ? AND mes = '2026-10'").get(AURORA).n, 3);
  assert.ok(db.prepare("SELECT COUNT(*) AS n FROM cargas_versiones WHERE carga = 'agendas_usuaria' AND campana = ?").get(AURORA).n >= 1, 'respaldo para Deshacer');
  const op = await request(app).get('/api/calidad/agendas-usuaria/opciones?campana=' + encodeURIComponent(AURORA)).set(auth(admin));
  assert.deepEqual(op.body.meses, ['2026-10']);
});

test('vistas: por mes (linea de tiempo), por especialidad y por asesor por mes; filtros de sede, asesor y fechas', () => {
  const filas = L.auParseFilas(reporte(OCT.concat(NOV))).filas.map((f) => Object.assign({}, f, { asesora: f.usuario === 'INCONEXION A' ? 'Asesora Ficticia Uno' : f.usuario }));
  assert.deepEqual(L.auPorMes(filas), [{ mes: '2026-10', n: 7 }, { mes: '2026-11', n: 2 }]);
  assert.deepEqual(L.auPorEspecialidad(filas).map((x) => [x.especialidad, x.n, x.pct]), [['DERMATOLOGIA', 5, 55.6], ['RADIOLOGIA', 3, 33.3], ['COSMETOLOGIA', 1, 11.1]]);
  const a = L.auPorAsesor(filas);
  assert.deepEqual(a.meses, ['2026-10', '2026-11']);
  assert.deepEqual(a.filas.map((x) => [x.asesora, x.serie, x.total]), [['Asesora Ficticia Uno', [2, 1], 3], ['INCONEXION B', [3, 0], 3], ['INCONEXION', [1, 1], 2], [L.AU_CLINICA, [1, 0], 1]]);
  assert.equal(L.auTotal(L.auFiltrar(filas, { sedes: ['SEDE DOS'] })), 1);
  assert.equal(L.auTotal(L.auFiltrar(filas, { asesoras: ['INCONEXION B'] })), 3);
  assert.equal(L.auTotal(L.auFiltrar(filas, { citaDesde: '2026-10-08', citaHasta: '2026-10-31' })), 4);
  assert.equal(L.auTotal(L.auFiltrar(filas, { solicitudDesde: '2026-10-01' })), 6, 'sin fecha de solicitud no entra al filtrar por ella');
  assert.equal(L.auTotal(L.auFiltrar(filas, { solicitudHasta: '2026-09-30' })), 2);
  assert.equal(L.auTotal(L.auFiltrar(filas, { meses: ['2026-11'] })), 2);
});

test('navegador: el tipo nuevo esta en las listas cerradas, en el Centro y en el plan de Cargar Datos', () => {
  const fs = require('fs');
  const pub = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', f), 'utf8');
  assert.match(pub('mes-global-logic.js'), /GD_TIPOS_SIGUEN_MESES = \[[^\]]*'agendas_usuaria_panel'/);
  assert.match(pub('dashboard-export-tipos.js'), /'agendas_usuaria_panel'/);
  assert.match(pub('dashboard-generic.js'), /if\(p\.tipo === 'agendas_usuaria_panel'\)\{ _auRender\(p, i\); return; \}/);
  const panel = pub('agendas-usuaria.js');
  assert.match(panel, /gdMesesTarjetasActual\(\)/);
  for (const quitado of ['Canal', 'Tipo de paciente', 'Tipo de cita']) assert.ok(!panel.includes("'" + quitado + "'"), 'sin el filtro ' + quitado);
  for (const queda of ['Fecha de solicitud de la cita', 'Fecha de cita', '>Sede<', 'Asesor:']) assert.ok(panel.includes(queda), 'filtro ' + queda);
  const C = require('../../public/js/centro-cargas-logic.js');
  assert.ok(C.centroSubeDesdeMes('agendas_usuaria'));
  const plan = require('../../public/js/cargas-logic.js').cargasPlanConsolidado({}, null, null, null, null, null, null, null, null, null, undefined, null, null, null, null, null, null, null, null, [{ label: 'fechacita' }]);
  assert.ok(plan.some((h) => h.tipo === 'agendas_usuaria'), 'renglon del plan');
});

test('Fase 260: fechas como Date (lectura de Cargar Datos con cellNF sobre celdas con formato de fecha)', () => {
  const head = ['fechacita', 'fecha_registro', 'usuario_regcita', 'nombresede', 'especial']; // Fase 302
  const ws = XLSX.utils.aoa_to_sheet([head, [serial('2026-10-31'), serial('2026-09-30'), 'INCONEXION C', 'SEDE UNO', 'DERMATOLOGIA'], [serial('2026-10-01'), serial('2026-10-01'), 'INCONEXION', 'SEDE UNO', 'RADIOLOGIA']]);
  ['A2', 'B2', 'A3', 'B3'].forEach((c) => { ws[c].z = 'dd/mm/yyyy'; });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'oct');
  for (const bookType of ['xlsx', 'biff8']) {
    const back = XLSX.read(new Uint8Array(XLSX.write(wb, { type: 'buffer', bookType })), { type: 'array', sheetStubs: true, cellNF: true });
    const r = L.auParseFilas(XLSX.utils.sheet_to_json(back.Sheets.oct, { header: 1, blankrows: false, defval: null }));
    assert.equal(r.citas, 2, bookType + ': ' + JSON.stringify(r.avisos));
    assert.deepEqual(r.meses, { '2026-10': 2 }, bookType);
    assert.equal(r.filas.find((f) => f.usuario === 'INCONEXION C').fechaSolicitud, '2026-09-30', bookType);
  }
});
