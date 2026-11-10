// fase306-aurora-inasistencia-encuestas.test.js — Fase 306 (10/11/2026, Clinica
// Aurora): pestañas «Inasistencia» (% por especialidad) y «Encuestas» (por
// entidad y por fecha). Datos SINTETICOS y anonimizados: se usan solo los NOMBRES
// de columna de las bases reales (en otro orden); todos los valores son inventados.
// ORLANT no cambia.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');
const XLSX = require(path.join(__dirname, '..', '..', 'public', 'js', 'vendor', 'xlsx-0.20.3.full.min.js'));
const A = require('../../public/js/aurora-bases-logic.js');
const G = require('../../public/js/graficas-lineas-logic.js');
const { generarLayout, PERFILES_ACTUALES } = require('../plantillas-cliente');

const AURORA = 'CLINICA AURORA';
const H = (t) => ({ Authorization: 'Bearer ' + t });
let admin, cliente, asesor;

function crear(user, rol, perms) {
  db.prepare(`INSERT INTO users (nombre, user, rol, active, password_hash, perms, createdAt, debe_cambiar_password) VALUES (?,?,?,1,?,?,?,0)`)
    .run('Prueba ' + user, user, rol, bcrypt.hashSync('Clave#2026x', 4), JSON.stringify(perms), new Date().toISOString());
  return tokenFor(user, 'Clave#2026x');
}
before(async () => {
  admin = await tokenFor('admin', MASTER_PASSWORD);
  cliente = await crear('f306_cliente', 'CLIENTES_DASH', { ClientesDash: true, ['cliente_' + AURORA]: true });
  asesor = await crear('f306_asesor', 'ASESOR', { ['campana_' + AURORA]: true });
});

// Libro sintetico leido de vuelta con las mismas opciones del navegador.
function libro(enc, filas) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([enc].concat(filas), { cellDates: true }), 'hoja');
  const back = XLSX.read(new Uint8Array(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })), { type: 'array', sheetStubs: true, cellNF: true });
  return XLSX.utils.sheet_to_json(back.Sheets.hoja, { header: 1, blankrows: false, defval: null });
}
const d = (dia) => new Date(Date.UTC(2026, 9, dia, 12));
// Encabezados de la base de inasistencias (nombres reales, OTRO orden); valores inventados.
const ENC_INA = ['estado', 'nit', 'nombre', 'especialidad', 'sede', 'fecha', 'observacion', 'profesional', 'entidad'];
function filasIna(esp, total, noAsistio, otros) {
  return Array.from({ length: total }, (_, k) => {
    const estado = k < noAsistio ? (k % 2 ? 'NO ASISTIÓ' : 'No asistio') : (otros[k % otros.length]);
    const v = { estado, nit: 'X' + k, nombre: 'Paciente Ficticio ' + k, especialidad: esp, sede: 'SEDE FICTICIA', fecha: d(1 + (k % 28)), observacion: 'obs ficticia', profesional: 'PROF FICTICIO', entidad: 'EPS FICTICIA' };
    return ENC_INA.map((h) => v[h]);
  });
}
const INA = libro(ENC_INA, [].concat(
  filasIna('AUXILIAR DE ENFERMERIA FICTICIA', 352, 20, ['ASISTIÓ', 'CANCELÓ', '']),
  filasIna('ESPECIALIDAD CON UN NOMBRE MUY LARGO DE PRUEBA', 120, 7, ['ASISTIÓ']),
  filasIna('ESPECIALIDAD SIN FALTAS', 40, 0, ['ASISTIÓ', 'CANCELÓ']),
));
// Encabezados del compilado de encuestas (OTRO orden); valores inventados; 3 sin entidad.
const ENC_ENC = ['ENTIDAD', 'CELULAR', 'FECHA', 'NOMBRE', 'CEDULA'];
const ENC = libro(ENC_ENC, [].concat(
  Array.from({ length: 30 }, (_, k) => ['ENTIDAD FICTICIA UNO', 3000000000 + k, d(5), 'Persona Ficticia', 100 + k]),
  Array.from({ length: 12 }, (_, k) => ['ENTIDAD FICTICIA DOS', 3100000000 + k, d(k % 2 ? 8 : 5), 'Persona Ficticia', 200 + k]),
  Array.from({ length: 3 }, (_, k) => [null, 3200000000 + k, d(8), 'Persona Ficticia', 300 + k]),
));

test('inasistencia: % = «No asistió» / total de filas de la especialidad (352 y 20 -> 5,7 %), de mayor a menor', () => {
  const r = A.inaParse(INA, 'base.xls');
  assert.equal(r.error, undefined, r.error);
  assert.equal(r.citas, 512);
  assert.equal(r.noAsistio, 27);
  const esp = A.inaPorEspecialidad(r.filas, ['2026-10']);
  assert.deepEqual(esp.map((x) => [x.especialidad, x.total, x.noAsistio, x.pct]), [
    ['ESPECIALIDAD CON UN NOMBRE MUY LARGO DE PRUEBA', 120, 7, 5.8],
    ['AUXILIAR DE ENFERMERIA FICTICIA', 352, 20, 5.7],
    ['ESPECIALIDAD SIN FALTAS', 40, 0, 0],
  ]);
  assert.equal(A.abPct(5.7), '5,7 %');
  // Estados reconocidos sin importar tildes ni mayusculas; los demas no cuentan.
  for (const e of ['No asistió', 'NO ASISTIÓ', 'no asistio']) assert.ok(A.inaEsNoAsistio(e), e);
  for (const e of ['ASISTIÓ', 'CANCELÓ', '', 'Asistio no']) assert.ok(!A.inaEsNoAsistio(e), e);
  // Privacidad: solo conteos.
  const p = JSON.stringify(r.filas);
  for (const x of ['Paciente Ficticio', 'obs ficticia', 'X1']) assert.ok(!p.includes(x), x);
  r.filas.forEach((f) => assert.deepEqual(Object.keys(f).sort(), ['especialidad', 'mes', 'noAsistio', 'total']));
});

test('inasistencia: columnas por nombre en cualquier orden; si falta una, error con columna y archivo', () => {
  const sinEstado = INA.map((row) => row.filter((_, k) => k !== 0));
  const r = A.inaParse(sinEstado, 'base-sin-estado.xls');
  assert.match(r.error, /base-sin-estado\.xls/);
  assert.match(r.error, /falta la columna «Estado»/);
  // Archivos cruzados: cada carga rechaza la base de la otra.
  assert.match(A.encParse(INA, 'base.xls').error, /parece la base de citas o inasistencias/);
  assert.match(A.inaParse(ENC, 'compilado.xlsx').error, /faltan las columnas «Especialidad».*«Estado»/);
});

test('encuestas: por entidad (de mayor a menor) y por fecha; las filas sin entidad no se grafican', () => {
  const r = A.encParse(ENC, 'compilado.xlsx');
  assert.equal(r.error, undefined, r.error);
  assert.equal(r.encuestas, 42);
  assert.equal(r.sinEntidad, 3);
  assert.match(r.avisos.join(' '), /3 encuesta\(s\) sin entidad: no se grafican/);
  assert.deepEqual(A.encPorEntidad(r.filas), [{ entidad: 'ENTIDAD FICTICIA UNO', n: 30 }, { entidad: 'ENTIDAD FICTICIA DOS', n: 12 }]);
  assert.deepEqual(A.encPorFecha(r.filas), [{ fecha: '2026-10-05', n: 36 }, { fecha: '2026-10-08', n: 6 }]);
  const p = JSON.stringify(r.filas);
  for (const x of ['Persona Ficticia', '3000000000', '"100"']) assert.ok(!p.includes(x), x);
  r.filas.forEach((f) => assert.deepEqual(Object.keys(f).sort(), ['entidad', 'fecha', 'mes', 'n']));
});

test('servidor: carga, impacto y lectura de las dos bases; recargar el mes lo reemplaza', async () => {
  const ina = A.inaParse(INA, 'base.xls').filas;
  const imp = await request(app).post('/api/calidad/aurora-inasistencia/carga/impacto').set(H(admin)).send({ campana: AURORA, filas: ina });
  assert.equal(imp.status, 200, JSON.stringify(imp.body));
  assert.deepEqual(imp.body.meses, [{ mes: '2026-10', existentes: 0, nuevas: 512 }]);
  for (let k = 0; k < 2; k++) {
    const c = await request(app).post('/api/calidad/aurora-inasistencia/carga').set(H(admin)).send({ campana: AURORA, archivoNombre: 'sintetico.xls', filas: ina });
    assert.equal(c.status, 201, JSON.stringify(c.body));
  }
  const dIna = await request(app).get('/api/calidad/aurora-inasistencia/datos?campana=' + encodeURIComponent(AURORA)).set(H(cliente));
  assert.equal(dIna.status, 200);
  assert.equal(dIna.body.filas.reduce((s, f) => s + f.total, 0), 512, 'recargar reemplaza, no duplica');
  const enc = A.encParse(ENC, 'compilado.xlsx').filas;
  assert.equal((await request(app).post('/api/calidad/aurora-encuestas/carga').set(H(admin)).send({ campana: AURORA, filas: enc })).status, 201);
  const dEnc = await request(app).get('/api/calidad/aurora-encuestas/datos?campana=' + encodeURIComponent(AURORA)).set(H(cliente));
  assert.equal(dEnc.body.filas.reduce((s, f) => s + f.n, 0), 42);
  const op = await request(app).get('/api/calidad/aurora-encuestas/opciones?campana=' + encodeURIComponent(AURORA)).set(H(cliente));
  assert.deepEqual(op.body.meses, ['2026-10']);
  assert.ok(db.prepare("SELECT COUNT(*) AS n FROM cargas_versiones WHERE carga = 'inasistencia_au' AND campana = ?").get(AURORA).n >= 1, 'respaldo para Deshacer');
});

test('servidor: CLIENTE y ASESOR no cargan; campos de pacientes o datos imposibles -> 400; otra campaña -> 403', async () => {
  const fila = { mes: '2026-10', especialidad: 'X', total: 10, noAsistio: 1 };
  for (const t of [cliente, asesor]) {
    assert.equal((await request(app).post('/api/calidad/aurora-inasistencia/carga').set(H(t)).send({ campana: AURORA, filas: [fila] })).status, 403);
    assert.equal((await request(app).post('/api/calidad/aurora-encuestas/carga').set(H(t)).send({ campana: AURORA, filas: [{ mes: '2026-10', fecha: '2026-10-01', entidad: 'E', n: 1 }] })).status, 403);
  }
  assert.equal((await request(app).post('/api/calidad/aurora-inasistencia/carga').set(H(admin)).send({ campana: AURORA, filas: [{ ...fila, nombre: 'X' }] })).status, 400);
  assert.equal((await request(app).post('/api/calidad/aurora-inasistencia/carga').set(H(admin)).send({ campana: AURORA, filas: [{ ...fila, noAsistio: 11 }] })).status, 400);
  assert.equal((await request(app).post('/api/calidad/aurora-encuestas/carga').set(H(admin)).send({ campana: AURORA, filas: [{ mes: '2026-10', fecha: '2026-10-01', entidad: 'E', n: 1, cedula: '1' }] })).status, 400);
  assert.equal((await request(app).get('/api/calidad/aurora-inasistencia/datos?campana=ORLANT').set(H(cliente))).status, 403);
});

test('migracion: modulos y pestañas «Inasistencia» y «Encuestas» SOLO en Aurora, visibles; Errores SIEMPRE de ultima', () => {
  const layout = (c) => JSON.parse(db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get(c).layout);
  const tabs = layout(AURORA).tabs;
  const ina = tabs.find((t) => t.key === 'inasistencia_au'), enc = tabs.find((t) => t.key === 'encuestas_au');
  assert.equal(ina.label, 'Inasistencia'); assert.ok(!ina.oculta);
  assert.deepEqual(ina.panels, [{ tipo: 'aurora_inasistencia_panel', campana: AURORA, titulo: 'Inasistencia por especialidad' }]);
  assert.equal(enc.label, 'Encuestas'); assert.ok(!enc.oculta);
  // Al mostrar: Errores de ultima, aunque haya pestañas fuera de la lista.
  const visibles = G.pestanasOrdenCliente(tabs.concat([{ key: 'otra_futura' }]), AURORA).map((t) => t.key);
  // Fase 311: «Gestión líneas internas» va despues de Errores; Errores sigue de ultima entre las demas.
  assert.deepEqual(visibles.slice(-2), ['errores', 'lineas_internas']);
  assert.deepEqual(visibles.slice(visibles.indexOf('tipificacion'), visibles.indexOf('tipificacion') + 3), ['tipificacion', 'inasistencia_au', 'encuestas_au']);
  for (const c of ['ORLANT', 'MOBILIZE', 'HOSPITAL LA MARIA']) {
    const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get(c);
    if (row) assert.ok(!/aurora_(inasistencia|encuestas)_panel/.test(row.layout), c);
  }
  assert.equal(JSON.stringify(layout('ORLANT')), JSON.stringify(generarLayout(PERFILES_ACTUALES.ORLANT).layout), 'ORLANT igual a su plantilla');
});

test('front: el Centro abre la ventana propia, el panel usa la paleta de Aurora y los nombres completos', () => {
  const pub = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', f), 'utf8');
  assert.match(pub('centro-cargas.js'), /if \(\(c\.id === 'inasistencia_au' \|\| c\.id === 'encuestas_au' \|\| c\.id === 'flujo_li'[^)]*\) && typeof abAbrirCarga === 'function'\)/); // Fase 311: + líneas internas
  const ab = pub('aurora-bases.js');
  assert.match(ab, /auColorAgendas\(id, _abOscuro\(\)\)/);
  assert.match(ab, /auPartirEtiqueta\(t, angosta \? 14 : 24\)/, 'nombres completos, en trozos mas cortos en pantalla angosta');
  assert.match(ab, /esp\.map\(function \(x\) \{ return x\.pct; \}\)/, 'inasistencia: solo el porcentaje');
  const html = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'index.html'), 'utf8');
  assert.ok(html.indexOf('js/aurora-bases-logic.js') > html.indexOf('js/agendas-usuaria-logic.js'), 'despues de la logica de Agendas');
});
