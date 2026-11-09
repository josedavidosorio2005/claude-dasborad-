// fase302-agendas-aurora-vista.test.js — Fase 302 (10/11/2026): «Agendas» de
// Clinica Aurora con sus 3 bases reales (Citas asignadas y cumplidas,
// Cancelaciones, Inasistencias). Archivos SINTETICOS con los ENCABEZADOS reales
// (solo los nombres de columna; ningun valor real) en distinto orden; las bases
// sin fecha_registro no dan error. Vista: filtros, botones de base, linea por mes
// (fecha de registro / fecha de cita) y ranking (usuario / especialidad /
// profesional) con top N. ORLANT no cambia.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');
const dbMod = require('../db');
const XLSX = require(path.join(__dirname, '..', '..', 'public', 'js', 'vendor', 'xlsx-0.20.3.full.min.js'));
const L = require('../../public/js/agendas-usuaria-logic.js');
const { generarLayout, PERFILES_ACTUALES } = require('../plantillas-cliente');

const AURORA = 'CLINICA AURORA';
const H = (t) => ({ Authorization: 'Bearer ' + t });
let admin;
before(async () => { admin = await tokenFor('admin', MASTER_PASSWORD); });

// Encabezados como vienen en los archivos de la clinica (sin valores reales).
const ENC_CITAS = ['f_nacimiento', 'tipo_cc', 'cedula', 'nombres', 'apellidos', 'telefono', 'direccion', 'fecha_registro', 'fechacita', 'especialidad_procedimiento', 'medico',
  'entidad', 'observacion', 'usuario_regcita', 'especial', 'mes', 'nombresede', 'prof', 'diagnostico', 'usuario_confirma', 'sede'];
const ENC_CANC = ['nro', 'historia', 'nombres', 'apellidos', 'telefono', 'celular', 'fechareg', 'fechacita', 'hora', 'entidad', 'nombresede', 'prof', 'diagnostico', 'medico',
  'especial', 'observacion', 'usuario_confirma', 'usuario_regcita', 'cedula', 'sede', 'direcc'];
const ENC_INAS = ENC_CANC.slice().reverse();
function valor(h, i) {
  const d = (x) => new Date(Date.UTC(2026, 9, 1 + (x % 28), 12));
  return {
    fechacita: d(i), fecha_registro: new Date(Date.UTC(2026, 8 + (i % 2), 1 + (i % 20), 12)), fechareg: d(i),
    entidad: ['EPS UNO', 'EPS DOS', 'EPS TRES'][i % 3], usuario_regcita: ['INCONEXION', 'INCONEXION A', 'otra persona clinica'][i % 3],
    usuario_confirma: 'INCONEXION Z', especial: ['DERMATOLOGIA', 'ONCOLOGIA'][i % 2], prof: 'PROFESIONAL FICTICIO ' + (i % 13),
    nombresede: i % 2 ? 'SEDE NORTE FICTICIA' : 'SEDE SUR FICTICIA', sede: i % 2 ? '002' : '001',
    nombres: 'Paciente Ficticio ' + i, cedula: '999' + i, telefono: '300' + i, direccion: 'Calle Falsa ' + i, diagnostico: 'DX FICTICIO',
  }[h] ?? null;
}
function libro(enc, n) {
  const aoa = [enc].concat(Array.from({ length: n }, (_, i) => enc.map((h) => valor(h, i))));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa, { cellDates: true }), 'hoja');
  const back = XLSX.read(new Uint8Array(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })), { type: 'array', sheetStubs: true, cellNF: true });
  return XLSX.utils.sheet_to_json(back.Sheets.hoja, { header: 1, blankrows: false, defval: null });
}
const unir = () => L.auUnirBases([
  { base: 'citas', archivo: 'CITAS ASIGNADAS Y CUMPLIDAS.xlsx', aoa: libro(ENC_CITAS, 30) },
  { base: 'cancelaciones', archivo: 'CANCELACIONES.xlsx', aoa: libro(ENC_CANC, 20) },
  { base: 'inasistencias', archivo: 'INASISTENCIAS.xlsx', aoa: libro(ENC_INAS, 9) },
]);

test('las 3 bases con encabezados reales, en distinto orden: se leen por nombre; sin fecha_registro no es error', () => {
  const u = unir();
  assert.equal(u.error, undefined, u.error);
  assert.deepEqual([u.porBase.citas.citas, u.porBase.cancelaciones.citas, u.porBase.inasistencias.citas], [30, 20, 9]);
  const suma = (b, c) => u.filas.filter((f) => f.base === b && f[c]).reduce((s, f) => s + f.n, 0);
  assert.equal(suma('citas', 'fechaSolicitud'), 30);
  assert.equal(suma('cancelaciones', 'fechaSolicitud'), 0, 'Cancelaciones no trae fecha_registro (fechareg no se usa)');
  assert.equal(suma('inasistencias', 'fechaSolicitud'), 0);
  for (const b of ['citas', 'cancelaciones', 'inasistencias']) {
    for (const c of ['entidad', 'usuario', 'especialidad', 'prof', 'sede']) assert.ok(suma(b, c) > 0, b + ' ' + c);
  }
  assert.match(u.avisos.join(' '), /CANCELACIONES\.xlsx.*No trae la columna «Fecha de registro»/);
  // sede: el NOMBRE (nombresede), no el codigo 001/002; usuario: el que registra (no el que confirma).
  assert.ok(u.filas.every((f) => /FICTICIA$/.test(f.sede)));
  assert.ok(!u.filas.some((f) => f.usuario === 'INCONEXION Z'), 'usuario_confirma no se usa');
  assert.ok(u.filas.some((f) => f.usuario === L.AU_CLINICA), 'personal de la clinica agrupado');
});

test('PRIVACIDAD: solo los conteos de las 7 columnas (nada de nombres, cedula, telefono, direccion, diagnostico, medico)', () => {
  const u = unir();
  const payload = JSON.stringify(u.filas);
  for (const p of ['Paciente Ficticio', '9990', 'Calle Falsa', 'DX FICTICIO', 'INCONEXION Z']) assert.ok(!payload.includes(p), p);
  u.filas.forEach((f) => assert.deepEqual(Object.keys(f), L.AU_CAMPOS_FILA.concat(['base'])));
});

test('base por el nombre del archivo (Cargar Datos) y una casilla equivocada se detecta', () => {
  assert.equal(L.auBaseDesdeArchivo('CITAS ASIGNADAS Y CUMPLIDAS.xlsx'), 'citas');
  assert.equal(L.auBaseDesdeArchivo('cancelaciones octubre.xls'), 'cancelaciones');
  assert.equal(L.auBaseDesdeArchivo('INASISTENCIAS.xlsx'), 'inasistencias');
  assert.equal(L.auBaseDesdeArchivo('reporte.xlsx'), '');
  assert.deepEqual(L.AU_TIPOS_BASE.map((b) => b.etiqueta), ['Citas asignadas y cumplidas', 'Cancelaciones', 'Inasistencias']);
});

test('vista: filtros, botones de base, linea por mes (registro / cita) y ranking con top N', () => {
  const u = unir();
  const legacy = { mes: '2026-10', fechaCita: '2026-10-05', fechaSolicitud: '2026-10-01', sede: 'S', usuario: 'INCONEXION', especialidad: 'E', entidad: '', prof: '', base: '', n: 50 };
  const filas = u.filas.concat([legacy]);
  const todas = L.auFiltrarAgendas(filas, {});
  assert.equal(todas.reduce((s, f) => s + f.n, 0), 59, 'la carga vieja (sin base) no entra');
  // Fecha de cita: las 3 bases; fecha de registro: solo Citas (las otras cuentan como sin fecha).
  const porCita = L.auSerieMensual(todas, 'fechaCita');
  assert.deepEqual(porCita.meses, ['2026-10']);
  assert.deepEqual(porCita.series.map((x) => [x.base, x.data[0]]), [['citas', 30], ['cancelaciones', 20], ['inasistencias', 9]]);
  assert.deepEqual(porCita.total, [59]);
  const porReg = L.auSerieMensual(todas, 'fechaSolicitud');
  assert.deepEqual(porReg.meses, ['2026-09', '2026-10']);
  assert.deepEqual(porReg.series.map((x) => x.base), ['citas']);
  assert.deepEqual(porReg.sinFecha, { cancelaciones: 20, inasistencias: 9 });
  // Boton de base.
  assert.equal(L.auFiltrarAgendas(filas, { bases: ['cancelaciones'] }).reduce((s, f) => s + f.n, 0), 20);
  // Filtros.
  const n = (f) => L.auFiltrarAgendas(filas, f).reduce((s, x) => s + x.n, 0);
  assert.equal(n({ entidad: 'EPS UNO' }), 10 + 7 + 3);
  assert.equal(n({ especialidad: 'ONCOLOGIA' }), 15 + 10 + 4);
  assert.equal(n({ sede: 'SEDE NORTE FICTICIA' }), 15 + 10 + 4);
  assert.equal(n({ prof: 'PROFESIONAL FICTICIO 0' }), 3 + 2 + 1);
  assert.equal(n({ usuario: 'INCONEXION A' }), 10 + 7 + 3);
  assert.equal(n({ registroDesde: '2026-10-01' }), 15, 'filtrar por fecha de registro deja fuera las bases que no la traen');
  assert.equal(n({ citaDesde: '2026-10-28' }), 1 + 0 + 0);
  // Con el alias resuelto (asesora), el filtro y el ranking usan el nombre.
  const conAlias = filas.map((f) => Object.assign({}, f, { asesora: f.usuario === 'INCONEXION A' ? 'Asesora Ficticia' : f.usuario }));
  assert.equal(L.auFiltrarAgendas(conAlias, { usuario: 'Asesora Ficticia' }).reduce((s, f) => s + f.n, 0), 20);
  // Ranking por profesional: 13 valores, top 10 + ver mas.
  const rk = L.auRanking(todas, 'prof', 10);
  assert.equal(rk.items.length, 10);
  assert.equal(rk.cantidad, 13);
  assert.equal(rk.ocultos, 3);
  assert.ok(rk.items.every((x, k) => k === 0 || rk.items[k - 1].total >= x.total), 'de mayor a menor');
  assert.equal(L.auRanking(todas, 'prof', null).items.length, 13, 'ver mas: todos');
  const r0 = rk.items[0];
  assert.equal(Object.values(r0.porBase).reduce((s, v) => s + v, 0), r0.total, 'detalle por base suma el total');
  assert.deepEqual(L.auOpcionesAgendas(todas, 'entidad'), ['EPS DOS', 'EPS TRES', 'EPS UNO']);
});

test('servidor: entidad, prof y base se guardan y se leen; filas viejas sin esas columnas se aceptan', async () => {
  const u = unir();
  const r = await request(app).post('/api/calidad/agendas-usuaria/carga').set(H(admin)).send({ campana: AURORA, archivoNombre: 'sintetico', filas: u.filas });
  assert.equal(r.status, 201, JSON.stringify(r.body).slice(0, 300));
  assert.deepEqual(r.body.porBase, { citas: 30, cancelaciones: 20, inasistencias: 9 });
  const d = await request(app).get('/api/calidad/agendas-usuaria/datos?campana=' + encodeURIComponent(AURORA)).set(H(admin));
  const oct = d.body.filas.filter((f) => f.mes === '2026-10' && f.base);
  assert.equal(oct.reduce((s, f) => s + f.n, 0), 59);
  assert.ok(oct.every((f) => f.entidad && f.prof && f.sede));
  // Una fila sin entidad/prof (como antes) y con sede vacia: valida.
  const vieja = { mes: '2026-12', fechaCita: '2026-12-01', fechaSolicitud: '', sede: '', usuario: '', especialidad: '', n: 1, base: 'inasistencias' };
  assert.equal((await request(app).post('/api/calidad/agendas-usuaria/carga').set(H(admin)).send({ campana: AURORA, filas: [vieja] })).status, 201);
});

test('migracion: la pestaña de 3 vistas (la de produccion) pasa a «Agendas»; otra forma se deja; idempotente; solo Aurora', () => {
  const leer = () => JSON.parse(db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get(AURORA).layout);
  const escribir = (l) => db.prepare('UPDATE dashboards_config SET layout = ? WHERE cliente = ?').run(JSON.stringify(l), AURORA);
  const original = leer();
  const orlantAntes = db.prepare("SELECT layout FROM dashboards_config WHERE cliente = 'ORLANT'").get().layout;
  try {
    const l = leer();
    const t = l.tabs.find((x) => x.key === 'agendas_usuaria');
    t.label = 'Agendas por usuaria';
    t.panels = [['mes', 'Agendas por mes'], ['especialidad', 'Agendas por especialidad'], ['asesor', 'Agendas por asesor']].map(([vista, titulo]) => ({ tipo: 'agendas_usuaria_panel', campana: AURORA, vista, titulo }));
    t.subtabs = t.panels.map((p, k) => ({ key: p.vista, label: p.titulo, indices: [k] }));
    escribir(l);
    dbMod.agendasTresBasesAurora();
    const n = leer().tabs.find((x) => x.key === 'agendas_usuaria');
    assert.equal(n.label, 'Agendas');
    assert.deepEqual(n.panels, [{ tipo: 'agendas_usuaria_panel', campana: AURORA, vista: 'agendas', titulo: 'Agendas' }]);
    assert.equal(n.subtabs, undefined);
    assert.equal(n.oculta, t.oculta, 'no cambia si esta oculta');
    const despues = JSON.stringify(leer());
    dbMod.agendasTresBasesAurora();
    assert.equal(JSON.stringify(leer()), despues, 'idempotente');
    // Otra forma (retocada a mano): se deja.
    const otra = leer(); otra.tabs.find((x) => x.key === 'agendas_usuaria').panels = [{ tipo: 'agendas_usuaria_panel', campana: AURORA, vista: 'mes', titulo: 'X' }];
    escribir(otra); dbMod.agendasTresBasesAurora();
    assert.equal(leer().tabs.find((x) => x.key === 'agendas_usuaria').panels[0].titulo, 'X');
  } finally { escribir(original); }
  assert.equal(db.prepare("SELECT layout FROM dashboards_config WHERE cliente = 'ORLANT'").get().layout, orlantAntes, 'ORLANT no se toca');
  assert.equal(JSON.stringify(JSON.parse(orlantAntes)), JSON.stringify(generarLayout(PERFILES_ACTUALES.ORLANT).layout), 'ORLANT igual a su plantilla');
});

test('front: la vista nueva (botones, graficas, top N) y Cargar Datos reconoce la base por el nombre', () => {
  const pub = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', f), 'utf8');
  const au = pub('agendas-usuaria.js');
  assert.match(au, /if \(vista === 'agendas'\) \{ await _auRenderAgendas\(p, i, el, camp\); return; \}/);
  assert.match(au, /var AU_G1 = \[\{ v: 'fechaSolicitud', t: 'Fecha de registro' \}, \{ v: 'fechaCita', t: 'Fecha de cita' \}\];/);
  assert.match(au, /var AU_G2 = \[\{ v: 'usuario', t: 'Usuario que registra' \}, \{ v: 'especialidad', t: 'Especialidad' \}, \{ v: 'prof', t: 'Profesional' \}\];/);
  assert.match(au, /var AU_TOP = 10;/);
  for (const filtro of ["'Fecha de registro'", "'Fecha de cita'", "'Entidad'", "'Usuario que registra'", "'Especialidad'", "'Profesional'", "'Sede'"]) assert.ok(au.includes(filtro), filtro);
  assert.ok(!/kpiTarjetaHtml/.test(au.slice(au.indexOf('async function _auRenderAgendas'), au.indexOf('// Botones de base'))), 'sin cuadro de resumen');
  const cargas = pub('cargas.js');
  assert.match(cargas, /var baseAu = \(typeof auBaseDesdeArchivo === 'function'\) \? auBaseDesdeArchivo\(_cargasArchivoNombre\) : '';/);
});
