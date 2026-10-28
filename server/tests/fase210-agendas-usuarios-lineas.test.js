// fase210-agendas-usuarios-lineas.test.js — Fase 210 (pedido de Edwin, 28/10,
// solo ORLANT). La base de agendas CRUDA del aplicativo carga tal cual: el
// asesor sale del usuario (columna A) cruzado con la Clasificacion de usuarios
// (un usuario puede pasar a otra persona desde una fecha de cambio, sin
// reescribir el historico) y la linea del codigo de entidad (columna R)
// cruzado con la Clasificacion de lineas (fuera de la lista o vacio = 3P). Los
// cruces se hacen al consultar. Todo SINTETICO: usuarios, nombres y codigos
// inventados, nunca los reales de ORLANT.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const L = require('../../public/js/agendas-logic.js');
const { asesorDeUsuarioEnFecha, erroresListaUsuarios } = require('../agendas-clasificacion');
const { request, app, tokenFor, MASTER_PASSWORD, SEED, db } = require('./helpers');

const auth = (t) => ({ Authorization: `Bearer ${t}` });
const JS = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', f), 'utf8');

// Encabezado de la base cruda (las 20 columnas, en el orden del aplicativo).
const ENC = ['USUARIO_QUE_ASIGNA_CITA', 'CODIGO_SEDE', 'CODIGO_EXAMEN', 'NOMBRE_EXAMEN', 'PACTID', 'PACIDE', 'CITDUR', 'CITESP', 'ESPNOM',
  'CITMED', 'MEDNOM', 'CITTIP', 'FECHA_SOL', 'HORA_SOL', 'FECHA_CITA', 'HORA_CITA', 'CITTIR', 'CODIGO_ENTIDAD', 'NOMBRE_ENTIDAD', 'CITOBSOBS'];
// Serial de Excel de una fecha y hora (UTC, como el lector).
const serial = (iso) => Date.parse(iso + 'Z') / 86400000 + 25569;
function filaCruda({ usuario = '900', esp = 'ESP UNO', fecha = '2026-10-02T09:00:00', codigo = 'EPS1', cedula = '1234567890', obs = 'texto libre del paciente' } = {}) {
  return [usuario, 'S1', 'C1', 'EXAMEN UNO', 'X', cedula, 20, 'E1', esp, 'M1', 'MEDICO UNO', 'T', serial(fecha), serial(fecha), serial('2026-10-20T00:00:00'), 0.4, 'A', codigo, 'ENTIDAD UNO', obs];
}

test('migracion: columnas usuario/codigoEntidad y las 2 listas, con triggers e idempotente', () => {
  const cols = db.prepare('PRAGMA table_info(agendas)').all().map((c) => c.name);
  assert.ok(cols.includes('usuario') && cols.includes('codigoEntidad'));
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM agendas_usuarios').get().n, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM agendas_codigos_entidad').get().n, 0);
  assert.throws(() => db.prepare("INSERT INTO agendas_codigos_entidad (campana, codigo, linea, updatedAt) VALUES ('ORLANT','X','OTRA','x')").run());
  // Un usuario sin fecha una sola vez; con fecha distinta si puede repetirse.
  const ins = db.prepare("INSERT INTO agendas_usuarios (campana, usuario, asesor, fechaCambio, updatedAt) VALUES ('ORLANT', 'U', 'A', ?, 'x')");
  ins.run(null);
  assert.throws(() => ins.run(null));
  ins.run('2026-10-07');
  assert.throws(() => ins.run('2026-10-07'));
  db.prepare("DELETE FROM agendas_usuarios WHERE usuario = 'U'").run();
  for (const t of ['agendas_usuarios', 'agendas_codigos_entidad']) {
    assert.ok(db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='trigger' AND tbl_name=?").get(t).n >= 3, t);
  }
  db.crearAgendasUsuariosLineas(); // idempotente
});

test('lector: reconoce la base cruda, solo saca 8 columnas (nunca la cedula ni las observaciones) y protege el codigo fuera de la lista', () => {
  assert.equal(L.agendasEsBaseCruda(ENC), true);
  assert.equal(L.agendasEsBaseCruda(['NOMBRE DE AGENTE', 'SEDE', 'NOMBRE_EXAMEN', 'ESPECIALIDAD', 'PROFESIONAL', 'FECHA_SOLICITUD', 'TIPO DE LINEA']), false);
  const aoa = [ENC,
    filaCruda({ usuario: ' 900 ', codigo: 'eps1' }),
    filaCruda({ codigo: '98765432' }), // particular: el codigo es una cedula
    filaCruda({ codigo: '' }),
    filaCruda({ fecha: '2026-10-03T10:00:00' }), filaCruda({ fecha: '2026-10-03T10:00:00' }), // duplicado exacto
    filaCruda({ fecha: '2026-10-03T10:00:00', cedula: '555' }), // misma cita en 8 columnas, otro paciente: es otra agenda
  ];
  const r = L.agendasParseFilas(aoa, null, { codigosEntidad: ['EPS1', 'EPS2'] });
  assert.equal(r.formato, 'cruda');
  assert.equal(r.filas.length, 5);
  assert.equal(r.codigosFueraDeLista, 1);
  assert.equal(r.codigosVacios, 1);
  assert.equal(r.usuarios, 1);
  assert.ok(r.avisos.some((a) => /1 fila\(s\) exactamente duplicada/.test(a)));
  assert.deepEqual(Object.keys(r.filas[0]).sort(), ['codigoEntidad', 'entidad', 'especialidad', 'examen', 'fechaSolicitud', 'profesional', 'sede', 'usuario']);
  assert.deepEqual(r.filas.map((f) => f.codigoEntidad), ['EPS1', 'PARTICULAR / OTRA', 'SIN CODIGO', 'EPS1', 'EPS1']);
  assert.equal(r.filas[0].usuario, '900');
  assert.equal(r.filas[0].especialidad, 'ESP UNO');
  assert.equal(r.filas[0].fechaSolicitud, '2026-10-02 09:00:00');
  const payload = JSON.stringify(r.filas.map((f) => L.agendasFilaComoArray(f, 'cruda')));
  for (const secreto of ['1234567890', '98765432', '555', 'texto libre del paciente']) assert.ok(!payload.includes(secreto), secreto);
  assert.deepEqual(L.agendasFilaComoArray(r.filas[0], 'cruda'), ['900', 'S1', 'EXAMEN UNO', 'ESP UNO', 'MEDICO UNO', '2026-10-02 09:00:00', 'EPS1', 'ENTIDAD UNO']);
  // Sin la lista (error de red) o con la lista vacia, no se carga: nunca se mandan codigos sin proteger.
  assert.match(L.agendasParseFilas(aoa, null, {}).error, /No se pudo leer la Clasificación de líneas/);
  assert.match(L.agendasParseFilas(aoa, null, { codigosEntidad: [] }).error, /está vacía/);
});

test('el "+" de usuarios: repetido sin fecha avisa y pide la fecha; con fecha entra; misma fecha no', () => {
  let lista = [];
  lista = L.agendasAgregarUsuario(lista, { usuario: '518', asesor: 'Persona Anterior' }).lista;
  const rep = L.agendasAgregarUsuario(lista, { usuario: ' 518', asesor: 'Persona Nueva' });
  assert.equal(rep.repetido, true);
  assert.match(rep.error, /El usuario 518 ya existe \(hoy es de Persona Anterior\)\. Indica la fecha de cambio/);
  lista = L.agendasAgregarUsuario(lista, { usuario: '518', asesor: 'Persona Nueva', fechaCambio: '2026-10-07' }).lista;
  assert.equal(lista.length, 2);
  assert.match(L.agendasAgregarUsuario(lista, { usuario: '518', asesor: 'Otra', fechaCambio: '2026-10-07' }).error, /misma fecha/);
  assert.match(L.agendasAgregarUsuario(lista, { usuario: '', asesor: 'X' }).error, /usuario/);
  assert.match(L.agendasAgregarUsuario(lista, { usuario: '7', asesor: ' ' }).error, /asesor/);
  // El asesor de cada dia: antes del cambio la anterior, desde el cambio la nueva.
  assert.equal(asesorDeUsuarioEnFecha(lista, '518', '2026-10-06'), 'Persona Anterior');
  assert.equal(asesorDeUsuarioEnFecha(lista, '518', '2026-10-07'), 'Persona Nueva');
  assert.equal(asesorDeUsuarioEnFecha(lista, '999', '2026-10-07'), null);
  assert.equal(erroresListaUsuarios(lista).length, 0);
  assert.equal(erroresListaUsuarios(lista.concat([{ usuario: '518', asesor: 'Z', fechaCambio: null }])).length, 1);
  // El "+" de codigos: un codigo una sola vez.
  const c = L.agendasAgregarCodigo([], { codigo: 'eps1', linea: '3P' }).lista;
  assert.match(L.agendasAgregarCodigo(c, { codigo: 'EPS1', linea: 'GENERAL' }).error, /ya está en la lista \(Línea 3P\)/);
  assert.match(L.agendasAgregarCodigo(c, { codigo: 'EPS9', linea: '' }).error, /Elige la línea/);
});

test('Excel de las listas: hoja AGENTES (usuario repetido con su fecha) y hoja CODIGOS (columnas 3P y GENERAL o codigo + linea)', () => {
  const u = L.agendasLeerUsuariosExcel([
    ['USUARIO', 'NOMBRE EN WOLKVOX', 'FECHA  DE CAMBIO'],
    ['518', 'Persona Anterior', null],
    ['518', 'Persona Nueva', serial('2026-10-07T00:00:00')],
    ['600', 'Persona Tres', null],
    ['600', 'Persona Cuatro', null], // repetido sin fecha: no entra, se avisa
  ]);
  assert.deepEqual(u.usuarios, [
    { usuario: '518', asesor: 'Persona Anterior', fechaCambio: null },
    { usuario: '518', asesor: 'Persona Nueva', fechaCambio: '2026-10-07' },
    { usuario: '600', asesor: 'Persona Tres', fechaCambio: null },
  ]);
  assert.equal(u.avisos.length, 1);
  assert.match(u.avisos[0], /^Fila 5: El usuario 600 ya existe/);
  const c = L.agendasLeerCodigosExcel([['3P', 'GENERAL'], ['A1', 'B1'], ['A2', null], [null, 'B2']]);
  assert.deepEqual(c.codigos, [{ codigo: 'A1', linea: '3P' }, { codigo: 'B1', linea: 'GENERAL' }, { codigo: 'A2', linea: '3P' }, { codigo: 'B2', linea: 'GENERAL' }]);
  const c2 = L.agendasLeerCodigosExcel([['Código', 'Línea'], ['A1', 'Línea 3P'], ['B1', 'General'], ['C1', 'otra']]);
  assert.deepEqual(c2.codigos, [{ codigo: 'A1', linea: '3P' }, { codigo: 'B1', linea: 'GENERAL' }]);
  assert.equal(c2.avisos.length, 1);
  assert.match(L.agendasLeerCodigosExcel([['NADA']]).error, /3P/);
});

test('API: listas solo del administrador (la de codigos tambien la lee quien carga agendas); usuario repetido sin fecha = 400', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const create = await request(app).post('/api/users').set(auth(admin))
    .send({ nombre: 'Carga', user: 'f210_carga', password: 'ClaveAgendas1234', rol: 'CALIDAD', perms: { Calidad: true, campana_ORLANT: true, cargar_agendas: true } });
  assert.equal(create.status, 201, JSON.stringify(create.body));
  const cargador = await tokenFor('f210_carga', 'ClaveAgendas1234');
  const cli = await tokenFor('agomez', SEED.agomez);
  assert.equal((await request(app).get('/api/calidad/agendas/codigos-entidad').query({ campana: 'ORLANT' }).set(auth(cargador))).status, 200);
  assert.equal((await request(app).get('/api/calidad/agendas/usuarios').query({ campana: 'ORLANT' }).set(auth(cargador))).status, 403);
  for (const t of [cargador, cli]) {
    assert.equal((await request(app).put('/api/calidad/agendas/usuarios').set(auth(t)).send({ campana: 'ORLANT', usuarios: [] })).status, 403);
    assert.equal((await request(app).put('/api/calidad/agendas/codigos-entidad').set(auth(t)).send({ campana: 'ORLANT', codigos: [] })).status, 403);
  }
  assert.equal((await request(app).get('/api/calidad/agendas/codigos-entidad').query({ campana: 'ORLANT' }).set(auth(cli))).status, 403);
  // Solo ORLANT.
  assert.equal((await request(app).get('/api/calidad/agendas/usuarios').query({ campana: 'MOBILIZE' }).set(auth(admin))).status, 404);
  const putU = (usuarios) => request(app).put('/api/calidad/agendas/usuarios').set(auth(admin)).send({ campana: 'ORLANT', usuarios });
  const malo = await putU([{ usuario: '518', asesor: 'A' }, { usuario: '518', asesor: 'B' }]);
  assert.equal(malo.status, 400);
  assert.match(malo.body.error, /El usuario 518 está repetido: indica la fecha de cambio/);
  assert.equal((await putU([{ usuario: '518', asesor: 'A', fechaCambio: '07/10/2026' }])).status, 400);
  assert.equal((await request(app).put('/api/calidad/agendas/codigos-entidad').set(auth(admin))
    .send({ campana: 'ORLANT', codigos: [{ codigo: 'X', linea: '3P' }, { codigo: ' x ', linea: 'GENERAL' }] })).status, 400);
});

test('base cruda de punta a punta: asesor por usuario y fecha de cambio, linea por codigo (fuera de la lista = 3P), y el formato anterior no cambia', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const q = (ruta, extra) => request(app).get('/api/calidad/agendas/' + ruta).query({ campana: 'ORLANT', ...extra }).set(auth(admin));

  // Formato anterior (agosto): sigue usando su asesor y su linea guardados.
  const vieja = await request(app).post('/api/calidad/agendas/carga').set(auth(admin)).send({
    campana: 'ORLANT', filas: [
      ['ASESOR VIEJO', 'S1', 'EX', 'ESP UNO', 'PROF', '2026-08-05 08:00:00', 'GENERAL', 'EPS DEMO'],
      ['ASESOR VIEJO', 'S1', 'EX', 'ESP UNO', 'PROF', '2026-08-06 08:00:00', '3P', 'EPS DEMO'],
    ],
  });
  assert.equal(vieja.status, 201, JSON.stringify(vieja.body));

  // Listas: 518 cambia de persona el 07/10; 700 siempre de la misma; 800 no esta.
  assert.equal((await request(app).put('/api/calidad/agendas/codigos-entidad').set(auth(admin))
    .send({ campana: 'ORLANT', codigos: [{ codigo: 'EPSG', linea: 'GENERAL' }, { codigo: 'EPS3', linea: '3P' }] })).status, 200);
  const gu = await request(app).put('/api/calidad/agendas/usuarios').set(auth(admin)).send({ campana: 'ORLANT', usuarios: [
    { usuario: '518', asesor: 'Persona Anterior' },
    { usuario: '518', asesor: 'Persona Nueva', fechaCambio: '2026-10-07' },
    { usuario: '700', asesor: 'Persona Siete' },
  ] });
  assert.equal(gu.status, 200, JSON.stringify(gu.body));
  assert.equal(gu.body.usuariosDistintos, 2);
  assert.equal(gu.body.conCambio, 1);

  // Octubre crudo: 518 -> 2 antes y 3 desde el 07/10; 700 -> 2; 800 -> 1.
  // [usuario, sede, examen, especialidad, profesional, fechaSolicitud, codigoEntidad, entidad]
  const c = (u, dia, esp, cod) => [u, 'S1', 'EX', esp, 'PROF', '2026-10-' + dia + ' 09:00:00', cod, 'ENT'];
  const filas = [
    c('518', '01', 'ESP UNO', 'EPSG'), c('518', '06', 'ESP UNO', 'EPS3'),
    c('518', '07', 'ESP DOS', 'EPSG'), c('518', '08', 'ESP DOS', 'PARTICULAR / OTRA'), c('518', '09', 'ESP UNO', ''),
    c('700', '02', 'ESP UNO', 'EPSG'), c('700', '10', 'ESP DOS', '12345678'), // codigo que no esta en la lista: el servidor tambien lo protege
    c('800', '03', 'ESP UNO', 'EPS3'),
  ];
  const imp = await request(app).post('/api/calidad/agendas/carga/impacto').set(auth(admin)).send({ campana: 'ORLANT', formato: 'cruda', filas });
  assert.equal(imp.status, 200, JSON.stringify(imp.body));
  assert.equal(imp.body.filasSinAsesor, 1);
  assert.equal(imp.body.filasCodigoFueraDeLista, 3);
  // Una fila del formato anterior no pasa como cruda (ni al reves).
  assert.equal((await request(app).post('/api/calidad/agendas/carga').set(auth(admin)).send({ campana: 'ORLANT', formato: 'cruda', filas: [['A', 'S', 'E', 'ES', 'P', '2026-10-01 08:00:00', 'XX', 'E', 'sobra']] })).status, 400);
  const carga = await request(app).post('/api/calidad/agendas/carga').set(auth(admin)).send({ campana: 'ORLANT', formato: 'cruda', archivoNombre: 'sint.xlsx', filas });
  assert.equal(carga.status, 201, JSON.stringify(carga.body));
  assert.equal(carga.body.insertadas, 8);
  // Ningun codigo fuera de la lista quedo guardado tal cual.
  assert.deepEqual(db.prepare("SELECT DISTINCT codigoEntidad AS c FROM agendas WHERE usuario IS NOT NULL ORDER BY c").all().map((r) => r.c),
    ['EPS3', 'EPSG', 'PARTICULAR / OTRA', 'SIN CODIGO']);

  // Total y especialidad del mes.
  const esp = await q('especialidad', { mes: '2026-10' });
  assert.deepEqual(esp.body, [{ especialidad: 'ESP UNO', cantidad: 5 }, { especialidad: 'ESP DOS', cantidad: 3 }]);
  // Linea: General = EPSG (3), 3P = EPS3 + fuera de lista + vacio (5). Agosto conserva lo suyo.
  const lin = (await q('linea')).body;
  assert.deepEqual(lin, [
    { mes: '2026-08', tipoLinea: '3P', cantidad: 1 }, { mes: '2026-08', tipoLinea: 'GENERAL', cantidad: 1 },
    { mes: '2026-10', tipoLinea: '3P', cantidad: 5 }, { mes: '2026-10', tipoLinea: 'GENERAL', cantidad: 3 },
  ]);
  // Asesor: el 518 se reparte por la fecha de cambio; el 800 sale "sin asesor".
  const op = (await q('opciones')).body;
  assert.deepEqual(op.asesores, ['ASESOR VIEJO', 'Persona Anterior', 'Persona Nueva', 'Persona Siete', 'Usuario 800 (sin asesor)']);
  const porAsesor = async (asesor) => (await q('mensual', { asesor })).body.reduce((s, r) => s + r.cantidad, 0);
  assert.equal(await porAsesor('Persona Anterior'), 2);
  assert.equal(await porAsesor('Persona Nueva'), 3);
  assert.equal(await porAsesor('Usuario 800 (sin asesor)'), 1);
  assert.equal(await porAsesor('ASESOR VIEJO'), 2);
  assert.equal((await q('mensual', { tipoLinea: 'GENERAL', mes: '2026-10' })).body.find((r) => r.mes === '2026-10').cantidad, 3);

  // La lista de usuarios: los de la base que no estan, con sus agendas.
  const lu = (await request(app).get('/api/calidad/agendas/usuarios').query({ campana: 'ORLANT' }).set(auth(admin))).body;
  assert.deepEqual(lu.sinAsesor, [{ usuario: '800', agendas: 1 }]);
  assert.equal(lu.usuarios.find((u) => u.usuario === '518' && !u.fechaCambio).agendasUsuario, 5);
  const lc = (await request(app).get('/api/calidad/agendas/codigos-entidad').query({ campana: 'ORLANT' }).set(auth(admin))).body;
  assert.equal(lc.agendasFueraDeLista, 3);

  // Corregir una lista cambia el resultado SIN volver a cargar (no reescribe lo guardado).
  await request(app).put('/api/calidad/agendas/usuarios').set(auth(admin)).send({ campana: 'ORLANT', usuarios: [
    { usuario: '518', asesor: 'Persona Anterior' }, { usuario: '518', asesor: 'Persona Nueva', fechaCambio: '2026-10-09' },
    { usuario: '700', asesor: 'Persona Siete' }, { usuario: '800', asesor: 'Persona Ocho' },
  ] });
  assert.equal(await porAsesor('Persona Anterior'), 4);
  assert.equal(await porAsesor('Persona Nueva'), 1);
  assert.equal(await porAsesor('Persona Ocho'), 1);
  await request(app).put('/api/calidad/agendas/codigos-entidad').set(auth(admin))
    .send({ campana: 'ORLANT', codigos: [{ codigo: 'EPSG', linea: 'GENERAL' }, { codigo: 'EPS3', linea: 'GENERAL' }] });
  assert.deepEqual((await q('linea', { mes: '2026-10' })).body.filter((r) => r.mes === '2026-10'),
    [{ mes: '2026-10', tipoLinea: '3P', cantidad: 3 }, { mes: '2026-10', tipoLinea: 'GENERAL', cantidad: 5 }]);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM agendas WHERE usuario IS NOT NULL").get().n, 8);
});

test('vista: los 2 botones solo para el administrador y solo en ORLANT; la ventana tiene "+", Excel y Guardar; Centro de cargas reconoce la base cruda', () => {
  const ag = JS('agendas.js');
  assert.match(ag, /_AGENDAS_CLIENTES_CLASIFICACION = \['ORLANT'\]/);
  assert.match(ag, /isFullAdmin\(\)\) return ''/);
  assert.match(ag, />Clasificación de usuarios<\/button>/);
  assert.match(ag, />Clasificación de líneas<\/button>/);
  const html = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'index.html'), 'utf8');
  assert.match(html, /id="modal-agendas-clasif"/);
  assert.match(html, /onsubmit="agendasClasifAgregar\(event\)"/);
  assert.match(html, /onchange="agendasClasifExcel\(this\)"/);
  assert.match(html, /onclick="agendasClasifGuardar\(\)"/);
  const cargas = JS('cargas.js');
  assert.match(cargas, /h\.tipo==='agendas' && agendasEsBaseCruda\(headerRow0\)/);
  assert.match(cargas, /\/calidad\/agendas\/codigos-entidad\?campana=/);
  assert.match(cargas, /formato: formato, filas: filasArray/);
});

test('usuario sin espacios: "INCO 19" de la lista es "INCO19" de la base (hallazgo real del 28/10)', async () => {
  assert.equal(L.agendasNormUsuario(' inco 19 '), 'INCO19');
  assert.deepEqual(L.agendasLeerUsuariosExcel([['USUARIO', 'NOMBRE'], ['INCO 19', 'Persona Diecinueve']]).usuarios,
    [{ usuario: 'INCO19', asesor: 'Persona Diecinueve', fechaCambio: null }]);
  assert.equal(L.agendasParseFilas([ENC, filaCruda({ usuario: 'INCO 19', codigo: 'EPS1' })], null, { codigosEntidad: ['EPS1'] }).filas[0].usuario, 'INCO19');
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const r = await request(app).put('/api/calidad/agendas/usuarios').set(auth(admin)).send({ campana: 'ORLANT', usuarios: [{ usuario: 'INCO 19', asesor: 'Persona Diecinueve' }] });
  assert.equal(r.status, 200);
  assert.ok(r.body.usuarios.some((u) => u.usuario === 'INCO19'));
});
