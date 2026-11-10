// fase311-aurora-lineas-internas.test.js — Fase 311 (10/11/2026, Clinica Aurora):
// pestaña «Gestión líneas internas» (flujo, CDR y WhatsApp del Wolkvox interno),
// aparte de las demas pestañas. Datos SINTETICOS y anonimizados: se usan solo los
// NOMBRES de columna de los reportes de Wolkvox (en otro orden); todos los valores
// (agentes, telefonos, tipificaciones) son inventados. ORLANT no cambia.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');
const XLSX = require(path.join(__dirname, '..', '..', 'public', 'js', 'vendor', 'xlsx-0.20.3.full.min.js'));
const L = require('../../public/js/lineas-internas-logic.js');
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
  cliente = await crear('f311_cliente', 'CLIENTES_DASH', { ClientesDash: true, ['cliente_' + AURORA]: true });
  asesor = await crear('f311_asesor', 'ASESOR', { ['campana_' + AURORA]: true });
});

// Libro sintetico (una o varias hojas) leido con las mismas opciones del navegador.
function libro(hojas) {
  const wb = XLSX.utils.book_new();
  hojas.forEach((h) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([h.enc].concat(h.filas), { cellDates: true }), h.nombre));
  const back = XLSX.read(new Uint8Array(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })), { type: 'array', sheetStubs: true, cellNF: true });
  return back.SheetNames.map((n) => ({ nombre: n, aoa: XLSX.utils.sheet_to_json(back.Sheets[n], { header: 1, blankrows: false, defval: null }) }));
}
const d = (dia, h) => new Date(Date.UTC(2026, 9, dia, h || 12));

// HistQueue (otro orden): 2 areas del mapa + 1 desconocida.
const ENC_FLUJO = ['ABANDON_CALLS', 'SERVICE_LEVEL_20SEC', 'DATE', 'SKILL_NAME', 'ANSWER_CALLS', 'INBOUND_CALLS', 'AHT'];
const FLUJO = libro([{ nombre: 'HistQueue', enc: ENC_FLUJO, filas: [
  [1, '50.00 %', d(1), 'AREA FARMACIA', 3, 4, '----'],
  [0, '100.00 %', d(2), 'AREA FARMACIA', 2, 2, '----'],
  [2, '0.00 %', d(1), 'AREA ENFERMERIA', 0, 2, '----'],
  [0, '80.00 %', d(3), 'AREA FICTICIA NUEVA', 5, 5, '----'],
] }]);

// HistCDR (otro orden), con columnas sensibles que NO se deben leer.
const ENC_CDR = ['TELEPHONE', 'SKILL_NAME', 'DESCRIPTION_COD_ACT', 'CUSTOMER_ID', 'AGENT_NAME', 'COMMENT', 'DATE', 'SKILL_ID', 'CONN_ID', 'TYPE_INTERACTION'];
const fCdr = (tel, skill, tipif, agente, dia, skillId, tipo) => [tel, skill, tipif, 'CC-FICTICIA', agente, 'comentario ficticio', d(dia, 15), skillId, 'conn-ficticio', tipo];
const CDR = libro([{ nombre: 'HistCDR', enc: ENC_CDR, filas: [
  fCdr(3001112233, '-', 'CONFIRMACION_FICTICIA', 'Agente Ficticio 1', 2, '-', 'outbound_ma'),
  fCdr(3001112234, '-', 'CONFIRMACION_FICTICIA', 'Agente Ficticio 1', 3, '-', 'outbound_ma'),
  fCdr(3001112235, '-', 'NO_CONTESTA_FICTICIA', 'Agente Ficticio 2', 3, '-', 'outbound_ma'),
  fCdr(3001112236, 'AREA PROGRAMACION', 'SOLICITUD_FICTICIA', 'Agente Ficticio 2', 4, 4166, 'inbound'),
  fCdr(3001112237, 'AREA PATOLOGIA', 'SOLICITUD_FICTICIA', 'Agente Ficticio 3', 5, 4169, 'inbound'),
  fCdr(3001112238, '-', 'PRUEBA', 'Agente Ficticio 1', 5, '-', 'outbound_ma'),
] }]);

// HistChat (otro orden): SKILL_ID solo con codigo; 0 fuera del mapa.
const ENC_WPP = ['AGENT_DNI', 'SKILL_ID', 'USER_ID', 'DATE', 'DESCRIPTION_COD_ACT', 'AGENT_NAME', 'DATE_CLOSE', 'COMMENTS', 'CONN_ID'];
const fW = (skill, tipif, agente, abre, cierra) => [99999, skill, 12345, d(abre), tipif, agente, d(cierra), 'comentario ficticio', 777];
const WPP = libro([{ nombre: 'HistChat', enc: ENC_WPP, filas: [
  fW(0, 'CONFIRMACION_FICTICIA', 'Agente Ficticio 1', 1, 1),
  fW(0, 'CONFIRMACION_FICTICIA', 'Agente Ficticio 1', 2, 2),
  fW(4171, '---', 'chat_bot', 2, 2),
  fW(4165, 'INFO_FICTICIA', 'Agente Ficticio 2', 30, 30),
  fW(4165, 'PRUEBA', 'Agente Ficticio 2', 30, 30),
  // Abierto en septiembre y cerrado en octubre: cuenta en octubre (DATE_CLOSE).
  [99999, 4170, 12345, new Date(Date.UTC(2026, 8, 30, 12)), 'INFO_FICTICIA', 'Agente Ficticio 3', d(1), 'x', 778],
] }]);

test('mapa de skills: codigo -> nombre del supervisor; fuera del mapa «Skill <codigo>»; salida', () => {
  assert.deepEqual(L.LI_SKILLS.map((s) => s.codigo + '=' + s.nombre), ['4170=Área Enfermería', '4165=Área Farmacia', '4169=Área Patología', '4166=Área Programación', '4171=Área Reportes Médicos']);
  assert.equal(L.liNombreSkill(L.liClaveSkill('', 'AREA REPORTES MEDICOS')), 'Área Reportes Médicos');
  assert.equal(L.liNombreSkill(L.liClaveSkill('4166', 'AREA PROGRAMACION')), 'Área Programación');
  assert.equal(L.liNombreSkill(L.liClaveSkill(0, '')), 'Skill 0');
  assert.equal(L.liNombreSkill(L.LI_SKILL_SALIDA), 'Llamadas de salida');
  assert.equal(L.liEtiquetaTipificacion('---'), 'Sin tipificación');
  assert.equal(L.liEtiquetaTipificacion('CONFIRMACION_CITA'), 'Confirmacion Cita');
});

test('flujo: lee por nombre de encabezado, suma por area y dia, NS promedio simple', () => {
  const r = L.liFlujoParse(FLUJO, 'flujo.xlsx');
  assert.ok(!r.error, r.error);
  assert.equal(r.total, 13); assert.equal(r.contestadas, 10); assert.equal(r.abandonadas, 3);
  assert.equal(r.filas.length, 4);
  r.filas.forEach((f) => assert.deepEqual(Object.keys(f).sort(), ['abandonadas', 'contestadas', 'fecha', 'mes', 'nivelServicio', 'skill', 'total']));
  assert.ok(r.avisos.some((a) => /AREA FICTICIA NUEVA/.test(a)), 'avisa el skill fuera del mapa');
  const todas = L.liFlujoSerie(r.filas, ['2026-10'], '');
  assert.equal(todas.porArea, true);
  assert.deepEqual(todas.puntos.map((p) => p.etiqueta), ['Área Enfermería', 'Área Farmacia', 'AREA FICTICIA NUEVA']);
  assert.equal(todas.resumen.nivelServicio, Math.round((50 + 100 + 0 + 80) / 4 * 100) / 100);
  const farm = L.liFlujoSerie(r.filas, [], '4165');
  assert.equal(farm.porArea, false);
  assert.deepEqual(farm.puntos.map((p) => [p.etiqueta, p.total, p.nivelServicio]), [['2026-10-01', 4, 50], ['2026-10-02', 2, 100]]);
  const botones = L.liBotonesFlujo(r.filas, []);
  assert.deepEqual(botones.slice(0, 6).map((b) => b.t), ['Todas', 'Área Enfermería', 'Área Farmacia', 'Área Patología', 'Área Programación', 'Área Reportes Médicos']);
  assert.equal(botones.find((b) => b.v === '4169').conDatos, false, 'un area sin datos sale con «sin datos»');
  assert.equal(L.liFlujoSerie(r.filas, [], '4169').puntos.length, 0, 'area sin datos: sin romper nada');
});

test('flujo: una hoja por area (sin columna de skill) -> el area sale del nombre de la hoja; se leen todas', () => {
  const enc = ['DATE', 'INBOUND_CALLS', 'ANSWER_CALLS', 'ABANDON_CALLS'];
  const r = L.liFlujoParse(libro([{ nombre: 'AREA PATOLOGIA', enc, filas: [[d(1), 3, 2, 1]] }, { nombre: 'AREA FARMACIA', enc, filas: [[d(1), 5, 5, 0]] }]), 'x.xlsx');
  assert.equal(r.total, 8);
  assert.deepEqual(Object.keys(r.porSkill).sort(), ['4165', '4169']);
  assert.ok(/falta/.test(L.liFlujoParse(libro([{ nombre: 'h', enc: ['DATE', 'OTRA'], filas: [[d(1), 1]] }]), 'mal.xlsx').error));
});

test('CDR: «-» es salida, PRUEBA no cuenta, sin columnas sensibles; filtros agente / skill / tipo', () => {
  const r = L.liCdrParse(CDR, 'cdr.xlsx');
  assert.ok(!r.error, r.error);
  assert.equal(r.registros, 5); assert.equal(r.excluidas, 1);
  assert.deepEqual(r.porTipo, { entrada: 2, salida: 3 });
  const p = JSON.stringify(r.filas);
  for (const x of ['3001112233', 'CC-FICTICIA', 'comentario', 'conn-ficticio']) assert.ok(!p.includes(x), x);
  r.filas.forEach((f) => assert.deepEqual(Object.keys(f).sort(), ['agente', 'mes', 'n', 'skill', 'tipificacion', 'tipo']));
  assert.equal(L.liTorta(r.filas, ['2026-10'], {}).total, 5);
  assert.deepEqual(L.liTorta(r.filas, [], { tipo: 'salida' }).todas, [{ tipificacion: 'CONFIRMACION_FICTICIA', cantidad: 2 }, { tipificacion: 'NO_CONTESTA_FICTICIA', cantidad: 1 }]);
  assert.equal(L.liTorta(r.filas, [], { tipo: 'entrada', skill: '4169' }).total, 1);
  assert.equal(L.liTorta(r.filas, [], { agente: 'Agente Ficticio 3', tipo: 'salida' }).total, 0, 'sin salida: total 0, sin error');
  assert.deepEqual(L.liOpciones(r.filas, [], {}, 'skill').map((o) => o.t), ['Área Patología', 'Área Programación', 'Llamadas de salida']);
  const soloEntrada = L.liCdrParse(libro([{ nombre: 'h', enc: ENC_CDR, filas: [fCdr(1, 'AREA PATOLOGIA', 'X', 'A', 1, 4169, 'inbound')] }]), 'e.xlsx');
  assert.equal(L.liTorta(soloEntrada.filas, [], { tipo: 'salida' }).total, 0);
});

test('WhatsApp: skill solo con codigo (nombre del mapa o «Skill <codigo>»), mes por DATE_CLOSE, sin datos sensibles', () => {
  const r = L.liWhatsappParse(WPP, 'chat.xlsx');
  assert.ok(!r.error, r.error);
  assert.equal(r.registros, 5); assert.equal(r.excluidas, 1);
  assert.deepEqual(r.porSkill, { 0: 2, 4171: 1, 4165: 1, 4170: 1 });
  assert.deepEqual([...new Set(r.filas.map((f) => f.mes))], ['2026-10'], 'abierto en septiembre, cerrado en octubre -> octubre');
  assert.ok(r.avisos.some((a) => /Skill 0 \(2\)/.test(a)));
  assert.deepEqual(L.liOpciones(r.filas, [], {}, 'skill').map((o) => o.t), ['Área Enfermería', 'Área Farmacia', 'Área Reportes Médicos', 'Skill 0']);
  assert.equal(L.liTorta(r.filas, [], { skill: '0' }).total, 2);
  const p = JSON.stringify(r.filas);
  for (const x of ['99999', '12345', 'comentario', '777']) assert.ok(!p.includes(x), x);
});

test('servidor: carga, impacto y lectura de las 3 bases; recargar el mes lo reemplaza; no toca las otras tablas de Aurora', async () => {
  const antes = ['aurora_inasistencia', 'aurora_encuestas', 'agendas_usuaria', 'tipificaciones'].map((t) => {
    try { return db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n; } catch (e) { return null; }
  });
  const casos = [
    { ruta: 'aurora-li-flujo', filas: L.liFlujoParse(FLUJO, 'f').filas, suma: (f) => f.total, total: 13 },
    { ruta: 'aurora-li-cdr', filas: L.liCdrParse(CDR, 'c').filas, suma: (f) => f.n, total: 5 },
    { ruta: 'aurora-li-whatsapp', filas: L.liWhatsappParse(WPP, 'w').filas, suma: (f) => f.n, total: 5 },
  ];
  for (const c of casos) {
    const imp = await request(app).post('/api/calidad/' + c.ruta + '/carga/impacto').set(H(admin)).send({ campana: AURORA, filas: c.filas });
    assert.equal(imp.status, 200, JSON.stringify(imp.body));
    assert.deepEqual(imp.body.meses, [{ mes: '2026-10', existentes: 0, nuevas: c.total }]);
    for (let k = 0; k < 2; k++) {
      const r = await request(app).post('/api/calidad/' + c.ruta + '/carga').set(H(admin)).send({ campana: AURORA, archivoNombre: 'sintetico.xlsx', filas: c.filas });
      assert.equal(r.status, 201, JSON.stringify(r.body));
    }
    const dat = await request(app).get('/api/calidad/' + c.ruta + '/datos?campana=' + encodeURIComponent(AURORA)).set(H(cliente));
    assert.equal(dat.status, 200);
    assert.equal(dat.body.filas.reduce((s, f) => s + c.suma(f), 0), c.total, c.ruta + ': recargar reemplaza, no duplica');
    const op = await request(app).get('/api/calidad/' + c.ruta + '/opciones?campana=' + encodeURIComponent(AURORA)).set(H(cliente));
    assert.deepEqual(op.body.meses, ['2026-10']);
  }
  const despues = ['aurora_inasistencia', 'aurora_encuestas', 'agendas_usuaria', 'tipificaciones'].map((t) => {
    try { return db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n; } catch (e) { return null; }
  });
  assert.deepEqual(despues, antes, 'las bases actuales de Aurora no cambian');
  assert.ok(db.prepare("SELECT COUNT(*) AS n FROM cargas_versiones WHERE carga = 'cdr_li' AND campana = ?").get(AURORA).n >= 1, 'respaldo para Deshacer');
});

test('servidor: CLIENTE y ASESOR no cargan; columnas sensibles o tipo raro -> 400; otra campaña -> 403', async () => {
  const fila = { mes: '2026-10', agente: 'A', skill: '4166', tipo: 'entrada', tipificacion: 'X', n: 1 };
  for (const t of [cliente, asesor]) {
    assert.equal((await request(app).post('/api/calidad/aurora-li-cdr/carga').set(H(t)).send({ campana: AURORA, filas: [fila] })).status, 403);
    assert.equal((await request(app).post('/api/calidad/aurora-li-flujo/carga').set(H(t)).send({ campana: AURORA, filas: [{ mes: '2026-10', fecha: '2026-10-01', skill: '4165', total: 1, contestadas: 1, abandonadas: 0, nivelServicio: null }] })).status, 403);
  }
  assert.equal((await request(app).post('/api/calidad/aurora-li-cdr/carga').set(H(admin)).send({ campana: AURORA, filas: [{ ...fila, telefono: '300' }] })).status, 400);
  assert.equal((await request(app).post('/api/calidad/aurora-li-whatsapp/carga').set(H(admin)).send({ campana: AURORA, filas: [{ ...fila, tipo: 'otro' }] })).status, 400);
  assert.equal((await request(app).post('/api/calidad/aurora-li-flujo/carga').set(H(admin)).send({ campana: AURORA, filas: [{ mes: '2026-10', fecha: '2026-10-01', skill: '4165', total: 1, contestadas: 1, abandonadas: 0, nivelServicio: 150 }] })).status, 400);
  assert.equal((await request(app).get('/api/calidad/aurora-li-cdr/datos?campana=ORLANT').set(H(cliente))).status, 403);
  // Modulo que no es de la campaña: ORLANT no tiene líneas internas.
  assert.equal((await request(app).post('/api/calidad/aurora-li-cdr/carga').set(H(admin)).send({ campana: 'ORLANT', filas: [fila] })).status, 400);
});

test('migracion: pestaña «Gestión líneas internas» SOLO en Aurora, al FINAL (despues de Errores), visible; las demas igual; ORLANT idéntico', () => {
  const layout = (c) => JSON.parse(db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get(c).layout);
  const tabs = layout(AURORA).tabs;
  const li = tabs.find((t) => t.key === 'lineas_internas');
  assert.equal(li.label, 'Gestión líneas internas'); assert.ok(!li.oculta);
  assert.deepEqual(li.panels.map((p) => p.tipo), ['aurora_li_flujo_panel', 'aurora_li_cdr_panel', 'aurora_li_whatsapp_panel']);
  const orden = G.pestanasOrdenCliente(tabs.map((t) => Object.assign({}, t, { oculta: false })), AURORA).map((t) => t.key);
  assert.deepEqual(orden.slice(-2), ['errores', 'lineas_internas']);
  const reg = JSON.parse(db.prepare('SELECT modulos FROM clientes_registro WHERE nombre = ?').get(AURORA).modulos);
  for (const m of ['flujo_li', 'cdr_li', 'whatsapp_li']) assert.ok(reg.includes(m), m);
  for (const c of ['ORLANT', 'MOBILIZE', 'HOSPITAL LA MARIA']) {
    const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get(c);
    if (row) assert.ok(!/aurora_li_/.test(row.layout), c);
  }
  assert.equal(JSON.stringify(layout('ORLANT')), JSON.stringify(generarLayout(PERFILES_ACTUALES.ORLANT).layout), 'ORLANT igual a su plantilla');
});

test('migracion idempotente: no duplica la pestaña ni cambia las otras pestañas de Aurora', () => {
  const antes = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get(AURORA).layout;
  require('../db').auroraLineasInternas();
  assert.equal(db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get(AURORA).layout, antes);
  // Sobre un layout sin la pestaña, solo la agrega al final.
  const l = JSON.parse(antes); const sin = l.tabs.filter((t) => t.key !== 'lineas_internas');
  db.prepare('UPDATE dashboards_config SET layout = ? WHERE cliente = ?').run(JSON.stringify(Object.assign({}, l, { tabs: sin })), AURORA);
  require('../db').auroraLineasInternas();
  const otra = JSON.parse(db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get(AURORA).layout);
  assert.deepEqual(otra.tabs.slice(0, -1), sin, 'las pestañas que ya estaban quedan exactamente igual');
  assert.equal(otra.tabs[otra.tabs.length - 1].key, 'lineas_internas');
});

test('front: scripts cargados, Centro abre la ventana propia, botones con el estilo de Agendas, aviso sin salida', () => {
  const pub = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', f), 'utf8');
  const html = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'index.html'), 'utf8');
  assert.ok(html.indexOf('js/lineas-internas-logic.js') > html.indexOf('js/aurora-bases.js'));
  assert.ok(html.indexOf('js/lineas-internas.js') > html.indexOf('js/lineas-internas-logic.js'));
  assert.match(pub('centro-cargas.js'), /c\.id === 'whatsapp_li'/);
  const li = pub('lineas-internas.js');
  assert.match(li, /class="gd-subtabs au-ag-botones"/);
  assert.match(li, /class="gd-subtab-btn' \+ \(on \? ' on' : ''\) \+ '" aria-pressed=/);
  assert.match(li, /Sin llamadas de salida/);
  assert.match(li, /liEtiquetaTipificacion/);
  const cl = pub('centro-cargas-logic.js');
  for (const m of ['flujo_li', 'cdr_li', 'whatsapp_li']) assert.match(cl, new RegExp(m + ": \\{ tipo: '" + m + "', mensual: true \\}"));
});
