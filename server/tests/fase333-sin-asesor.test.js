// fase333-sin-asesor.test.js — Fase 333 (decision del usuario, 11/11): los monitoreos de ORLANT
// con asesor guardado "Invalid Date" se corrigen SOLO si cruzan con certeza (ruta acotada que
// cambia solo el asesor, sin recalcular la nota); los que no cruzan se muestran "Sin asesor",
// al final, sin flecha, y no cuentan como un asesor mas (si en totales y promedio). Datos SINTETICOS.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');
const CE = require('../../public/js/calidad-equipo-logic.js');
const CA = require('../../public/js/calidad-analisis-logic.js');
const TX = require('../../public/js/texto-formato-logic.js');

const H = (t) => ({ Authorization: 'Bearer ' + t });
let admin, reportes, idInv, idInv2, idOk;
const fila = (id) => db.prepare('SELECT * FROM monitoreos WHERE id = ?').get(id);

before(async () => {
  admin = await tokenFor('admin', MASTER_PASSWORD);
  const ins = db.prepare(`INSERT INTO monitoreos (campana, asesor, fecha, mes, canal, idLlamada, evaluador, answers, puntaje, clasificacion, fallos, nivelCritico, observaciones, createdAt)
    VALUES ('ORLANT', ?, '2025-01-10', '2025-01', 'LLAMADA', ?, 'Evaluador Ficticio', '{"1":"SI","2":"NO"}', 87.5, 'NO CRITICO', 0, 'Sin fallos criticos', 'Obs ficticia', 'x')`);
  idOk = Number(ins.run('Persona Ficticia Uno', 'ID-1').lastInsertRowid);
  idInv = Number(ins.run('Invalid Date', 'ID-2').lastInsertRowid);
  idInv2 = Number(ins.run('Invalid Date', 'ID-3').lastInsertRowid);
  const r = await request(app).post('/api/users').set(H(admin)).send({ nombre: 'Persona Rep 333', user: 'rep333', password: 'Clave#Fase333x', rol: 'REPORTES', perms: { Calidad: true, campana_ORLANT: true } });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  reportes = await tokenFor('rep333', 'Clave#Fase333x');
});

test('corregir: solo cambia el asesor (nota, respuestas, fecha, evaluador y observaciones quedan igual)', async () => {
  const antes = fila(idInv);
  const r = await request(app).put('/api/monitoreos/' + idInv + '/asesor').set(H(admin)).send({ asesor: 'Persona Ficticia Uno' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const d = fila(idInv);
  assert.equal(d.asesor, 'Persona Ficticia Uno');
  for (const k of ['puntaje', 'answers', 'fecha', 'mes', 'evaluador', 'evaluadorUserId', 'observaciones', 'clasificacion', 'fallos', 'nivelCritico', 'extras', 'idLlamada', 'plantillaId', 'origen', 'asesorUserId']) {
    assert.deepEqual(d[k], antes[k], k + ' no cambia');
  }
  const h = db.prepare("SELECT COUNT(*) AS n FROM historial WHERE accion = 'MONITOREO_ASESOR_CORREGIDO'").get();
  assert.ok(h.n >= 1, 'queda en el historial');
});

test('corregir: solo el administrador, solo un "Invalid Date" y solo con un nombre que ya existe', async () => {
  assert.equal((await request(app).put('/api/monitoreos/' + idInv2 + '/asesor').set(H(reportes)).send({ asesor: 'Persona Ficticia Uno' })).status, 403);
  assert.equal((await request(app).put('/api/monitoreos/' + idOk + '/asesor').set(H(admin)).send({ asesor: 'Persona Ficticia Uno' })).status, 400, 'un nombre valido no se toca');
  const inv = await request(app).put('/api/monitoreos/' + idInv2 + '/asesor').set(H(admin)).send({ asesor: 'Nombre Inventado Que No Existe' });
  assert.equal(inv.status, 400);
  assert.match(inv.body.error, /no se inventan nombres/);
  assert.equal((await request(app).put('/api/monitoreos/' + idInv2 + '/asesor').set(H(admin)).send({ asesor: 'Invalid Date' })).status, 400);
  assert.equal((await request(app).put('/api/monitoreos/' + idInv2 + '/asesor').set(H(admin)).send({ asesor: 'Persona Ficticia Uno', puntaje: 100 })).status, 400, 'no acepta otros campos');
  assert.equal(fila(idInv2).asesor, 'Invalid Date', 'el que no cruza se queda como esta');
  assert.equal((await request(app).put('/api/monitoreos/999999/asesor').set(H(admin)).send({ asesor: 'Persona Ficticia Uno' })).status, 404);
});

test('pantalla: "Invalid Date" se ve "Sin asesor" en todo lugar donde se formatea un nombre', () => {
  assert.equal(TX.textoFormatoNombre('Invalid Date'), 'Sin asesor');
  assert.equal(TX.textoFormatoNombre(' invalid date '), 'Sin asesor');
  assert.equal(TX.textoFormatoNombre('PERSONA FICTICIA'), 'Persona Ficticia');
  assert.equal(CE.ceNombreAsesor('Invalid Date'), 'Sin asesor');
  assert.equal(CE.CE_SIN_NOMBRE, 'Sin asesor');
});

test('bloque nuevo: "Sin asesor" al final, sin flecha, fuera de «Asesores evaluados» y de por encima/por debajo; dentro de total y promedio', () => {
  const mons = [
    { asesor: 'Invalid Date', fecha: '2025-01-02', puntaje: 100 },
    { asesor: 'Uno Ficticio', fecha: '2025-01-03', puntaje: 90 },
    { asesor: 'Dos Ficticio', fecha: '2025-01-04', puntaje: 80 },
  ];
  const r = CE.ceResultado(mons, { meses: ['2025-01'], asesores: null, plantilla: null });
  assert.equal(r.kpis.total, 3, 'cuenta en el total');
  assert.equal(r.kpis.promedio, 90, 'y en el promedio general');
  assert.equal(r.kpis.asesores, 2, 'no es un asesor mas');
  assert.deepEqual(r.porAsesor.map((a) => a.name), ['Uno Ficticio', 'Dos Ficticio', 'Invalid Date'], 'al final aunque tenga la mejor nota');
  assert.deepEqual(r.lineaAsesor.map((a) => a.name), ['Dos Ficticio', 'Uno Ficticio', 'Invalid Date']);
  assert.equal(r.porAsesor[2].sinAsesor, true);
  assert.deepEqual(CE.ceVsEquipo(r.porAsesor, r.kpis.promedio), { equipo: 90, encima: 1, debajo: 1 });
  assert.deepEqual(CE.ceAsesoresDe(mons, ['2025-01']), ['Dos Ficticio', 'Uno Ficticio', 'Invalid Date'], 'filtro: al final');
  const res = CE.ceResumenAsesores(mons, 'all', '', []);
  assert.equal(res[res.length - 1].name, 'Invalid Date');
  // Modulo de Calidad (Resumen por asesor y tarjetas).
  const ca = CA.caResumenAsesores(mons.map((m) => Object.assign({ fallos: 0 }, m)));
  assert.equal(ca[ca.length - 1].asesor, 'Invalid Date');
  const k = CA.caKpis(mons);
  assert.equal(k.total, 3);
  assert.equal(k.asesores, 2);
});

test('panel: la fila "Sin asesor" no lleva flecha', () => {
  const panel = require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'public', 'js', 'calidad-panel.js'), 'utf8');
  assert.ok(panel.includes("(vsEq.equipo === null || a.sinAsesor ? '' : ' <span class=\"cmp-vs"));
});
