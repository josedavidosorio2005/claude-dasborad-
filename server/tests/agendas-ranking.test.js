// agendas-ranking.test.js — Fase 104 (pedido de InCo): GET
// /api/calidad/agendas/ranking -- ranking COMPLETO de asesores (reemplaza
// a "Agendas por agente", Fase 94, que escondia al resto en "Otros" y no
// tenia posicion/%/desglose). Mismo patron que agendas-linea-agente.test.js:
// datos SIEMPRE inventados, marca unica por prueba para aislarse del resto
// de la base de test.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, tokenFor, MASTER_PASSWORD } = require('./helpers');

const auth = (t) => ({ Authorization: `Bearer ${t}` });

// [asesor, sede, examen, especialidad, profesional, fechaSolicitud, tipoLinea, entidad]
function fila(over) {
  const base = ['ASESOR 01', 'SEDE CENTRO', 'AUDIOMETRIA', 'AUDIOLOGIA', 'DR PEREZ', '2025-06-15 10:00:00', 'GENERAL', 'EPS DEMO'];
  return Object.assign([], base, over);
}

async function cargar(admin, marca, filas) {
  const res = await request(app).post('/api/calidad/agendas/carga').set(auth(admin)).send({ campana: 'ORLANT', filas });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  return res;
}

test('ranking: suma de "total" = total del filtro, suma de "%" = 100.00, 3P + General = total por asesor, orden mayor a menor', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const marca = 'RANK' + Math.random().toString(36).slice(2, 8);
  await cargar(admin, marca, [
    fila({ 0: 'ASESOR ' + marca + ' A', 5: '2025-06-01 08:00:00', 6: 'GENERAL', 3: marca }),
    fila({ 0: 'ASESOR ' + marca + ' A', 5: '2025-06-01 09:00:00', 6: '3P', 3: marca }),
    fila({ 0: 'ASESOR ' + marca + ' A', 5: '2025-06-02 08:00:00', 6: 'GENERAL', 3: marca }),
    fila({ 0: 'ASESOR ' + marca + ' B', 5: '2025-06-01 08:00:00', 6: 'GENERAL', 3: marca }),
    fila({ 0: 'ASESOR ' + marca + ' B', 5: '2025-06-03 08:00:00', 6: '3P', 3: marca }),
    fila({ 0: 'ASESOR ' + marca + ' C', 5: '2025-06-01 08:00:00', 6: 'GENERAL', 3: marca }),
  ]);

  const qs = 'campana=ORLANT&especialidad=' + encodeURIComponent(marca);
  const res = await request(app).get('/api/calidad/agendas/ranking?' + qs).set(auth(admin));
  assert.equal(res.status, 200, JSON.stringify(res.body));
  const { filas, total } = res.body;
  assert.equal(total, 6);

  const sumaTotal = filas.reduce((a, f) => a + f.total, 0);
  assert.equal(sumaTotal, 6, 'la suma de "total" de todas las filas debe dar el total del filtro');

  const sumaPct = filas.reduce((a, f) => Math.round((a + f.pct) * 100) / 100, 0);
  assert.equal(sumaPct, 100, 'la suma de "%" debe dar exactamente 100');

  filas.forEach((f) => {
    assert.equal(f.cantidad3p + f.cantidadGeneral, f.total, `3P + General debe dar el total de ${f.asesor}`);
  });

  // A (3) > B (2) > C (1) -- mayor a menor.
  assert.deepEqual(filas.map((f) => f.asesor), ['ASESOR ' + marca + ' A', 'ASESOR ' + marca + ' B', 'ASESOR ' + marca + ' C']);
  assert.deepEqual(filas.map((f) => f.puesto), [1, 2, 3]);
});

test('ranking: empates comparten puesto (competencia 1,2,2,4) y el orden es estable entre corridas repetidas', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const marca = 'RANKTIE' + Math.random().toString(36).slice(2, 7);
  await cargar(admin, marca, [
    fila({ 0: 'ASESOR ' + marca + ' A', 5: '2025-06-01 08:00:00', 3: marca }),
    fila({ 0: 'ASESOR ' + marca + ' A', 5: '2025-06-02 08:00:00', 3: marca }),
    fila({ 0: 'ASESOR ' + marca + ' B', 5: '2025-06-01 08:00:00', 3: marca }),
    fila({ 0: 'ASESOR ' + marca + ' B', 5: '2025-06-02 08:00:00', 3: marca }),
    fila({ 0: 'ASESOR ' + marca + ' C', 5: '2025-06-01 08:00:00', 3: marca }),
  ]);
  const qs = 'campana=ORLANT&especialidad=' + encodeURIComponent(marca);

  const r1 = await request(app).get('/api/calidad/agendas/ranking?' + qs).set(auth(admin));
  assert.equal(r1.status, 200);
  // A y B empatan con 2 -> ambos puesto 1; C con 1 -> puesto 3 (no 2: "salta"
  // tantos lugares como personas empataron arriba).
  const puestos = Object.fromEntries(r1.body.filas.map((f) => [f.asesor, f.puesto]));
  assert.equal(puestos['ASESOR ' + marca + ' A'], 1);
  assert.equal(puestos['ASESOR ' + marca + ' B'], 1);
  assert.equal(puestos['ASESOR ' + marca + ' C'], 3);
  // A y B empatan en total -> orden alfabetico entre ellos (estable).
  assert.deepEqual(r1.body.filas.slice(0, 2).map((f) => f.asesor).sort(), ['ASESOR ' + marca + ' A', 'ASESOR ' + marca + ' B']);

  const r2 = await request(app).get('/api/calidad/agendas/ranking?' + qs).set(auth(admin));
  assert.deepEqual(r2.body.filas, r1.body.filas, 'la misma consulta repetida da EXACTAMENTE el mismo orden/resultado');
});

test('ranking: el mismo asesor con distinta escritura (mayusculas/tildes/espacios dobles) se agrupa en una sola fila', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const marca = 'RANKHOM' + Math.random().toString(36).slice(2, 6);
  await cargar(admin, marca, [
    fila({ 0: 'José  Pérez', 5: '2025-06-01 08:00:00', 3: marca, 2: marca }),
    fila({ 0: 'JOSE PEREZ', 5: '2025-06-02 08:00:00', 3: marca, 2: marca }),
    fila({ 0: '  jose perez  ', 5: '2025-06-03 08:00:00', 3: marca, 2: marca }),
    fila({ 0: 'Otro Asesor', 5: '2025-06-01 08:00:00', 3: marca, 2: marca }),
  ]);
  const qs = 'campana=ORLANT&examen=' + encodeURIComponent(marca);
  const res = await request(app).get('/api/calidad/agendas/ranking?' + qs).set(auth(admin));
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.filas.length, 2, 'las 3 variantes de "Jose Perez" deben quedar en UNA sola fila');
  assert.equal(res.body.variantesConHomonimos, 1, 'se debe reportar 1 asesor con variantes de escritura distintas');
  const jose = res.body.filas.find((f) => f.total === 3);
  assert.ok(jose, 'debe existir una fila con total=3 (las 3 variantes fundidas)');
  assert.equal(jose.diasDistintos, 3);
});

test('ranking: asesor "SIN ASESOR" (fila que el parseo del navegador guarda cuando NOMBRE DE AGENTE venia vacio, ver agendas-logic.js) aparece como "Sin asesor" al final, nunca desaparece, y la suma sigue cuadrando', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const marca = 'RANKVACIO' + Math.random().toString(36).slice(2, 6);
  await cargar(admin, marca, [
    fila({ 0: 'ASESOR ' + marca + ' A', 5: '2025-06-01 08:00:00', 3: marca }),
    fila({ 0: 'ASESOR ' + marca + ' A', 5: '2025-06-02 08:00:00', 3: marca }),
    fila({ 0: 'SIN ASESOR', 5: '2025-06-01 08:00:00', 3: marca }),
  ]);
  const qs = 'campana=ORLANT&especialidad=' + encodeURIComponent(marca);
  const res = await request(app).get('/api/calidad/agendas/ranking?' + qs).set(auth(admin));
  assert.equal(res.status, 200, JSON.stringify(res.body));
  assert.equal(res.body.total, 3);
  const ultima = res.body.filas[res.body.filas.length - 1];
  assert.equal(ultima.asesor, 'Sin asesor');
  assert.equal(ultima.sinAsesor, true);
  assert.equal(ultima.puesto, null, '"Sin asesor" no compite por un puesto');
  assert.equal(ultima.total, 1);
  const sumaTotal = res.body.filas.reduce((a, f) => a + f.total, 0);
  assert.equal(sumaTotal, 3);
});

test('ranking: filtrar por tipoLinea/sede/especialidad cambia el resultado igual que las demas sub-pestañas', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const marca = 'RANKFILT' + Math.random().toString(36).slice(2, 6);
  await cargar(admin, marca, [
    fila({ 0: 'ASESOR ' + marca + ' X', 1: 'SEDE NORTE', 5: '2025-08-01 08:00:00', 6: 'GENERAL', 3: marca }),
    fila({ 0: 'ASESOR ' + marca + ' X', 1: 'SEDE NORTE', 5: '2025-08-02 08:00:00', 6: '3P', 3: marca }),
    fila({ 0: 'ASESOR ' + marca + ' Y', 1: 'SEDE SUR', 5: '2025-08-01 08:00:00', 6: 'GENERAL', 3: marca }),
  ]);
  const base = 'campana=ORLANT&especialidad=' + encodeURIComponent(marca);

  const porLinea = await request(app).get('/api/calidad/agendas/ranking?' + base + '&tipoLinea=GENERAL').set(auth(admin));
  assert.equal(porLinea.status, 200);
  assert.equal(porLinea.body.total, 2);

  const porSede = await request(app).get('/api/calidad/agendas/ranking?' + base + '&sede=SEDE+NORTE').set(auth(admin));
  assert.equal(porSede.status, 200);
  assert.equal(porSede.body.total, 2);
  assert.deepEqual(porSede.body.filas.map((f) => f.asesor), ['ASESOR ' + marca + ' X']);
});

test('ranking: un mes sin ninguna agenda cargada responde 200 con lista vacia, nunca un error', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const marca = 'RANKVACIOMES' + Math.random().toString(36).slice(2, 5);
  await cargar(admin, marca, [fila({ 5: '2025-06-01 08:00:00', 2: marca })]);
  const res = await request(app).get('/api/calidad/agendas/ranking?campana=ORLANT&examen=' + encodeURIComponent(marca) + '&mes=2019-01').set(auth(admin));
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.filas, []);
  assert.equal(res.body.total, 0);
});

test('ranking: variacion contra el mes anterior -- con dato previo calcula la diferencia, sin dato previo da null, sin filtro de mes da null para todos', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const marca = 'RANKVAR' + Math.random().toString(36).slice(2, 6);
  await cargar(admin, marca, [
    // Mayo: A=3, B=1
    fila({ 0: 'ASESOR ' + marca + ' A', 5: '2025-05-01 08:00:00', 2: marca }),
    fila({ 0: 'ASESOR ' + marca + ' A', 5: '2025-05-02 08:00:00', 2: marca }),
    fila({ 0: 'ASESOR ' + marca + ' A', 5: '2025-05-03 08:00:00', 2: marca }),
    fila({ 0: 'ASESOR ' + marca + ' B', 5: '2025-05-01 08:00:00', 2: marca }),
    // Junio: A=1 (baja de 3 a 1, variacion -2), C=2 (nuevo, sin dato previo -> null)
    fila({ 0: 'ASESOR ' + marca + ' A', 5: '2025-06-01 08:00:00', 2: marca }),
    fila({ 0: 'ASESOR ' + marca + ' C', 5: '2025-06-01 08:00:00', 2: marca }),
    fila({ 0: 'ASESOR ' + marca + ' C', 5: '2025-06-02 08:00:00', 2: marca }),
  ]);
  const qs = 'campana=ORLANT&examen=' + encodeURIComponent(marca);

  const junio = await request(app).get('/api/calidad/agendas/ranking?' + qs + '&mes=2025-06').set(auth(admin));
  assert.equal(junio.status, 200, JSON.stringify(junio.body));
  const porAsesor = Object.fromEntries(junio.body.filas.map((f) => [f.asesor, f.variacion]));
  assert.equal(porAsesor['ASESOR ' + marca + ' A'], -2, 'A bajo de 3 (mayo) a 1 (junio)');
  assert.equal(porAsesor['ASESOR ' + marca + ' C'], null, 'C no tiene dato en mayo -> variacion null ("-")');

  const sinMes = await request(app).get('/api/calidad/agendas/ranking?' + qs).set(auth(admin));
  assert.equal(sinMes.status, 200);
  assert.ok(sinMes.body.filas.every((f) => f.variacion === null), 'sin filtro de mes, la variacion siempre es null ("-")');
});

test('ranking: requiere acceso a la campana (403 sin acceso), mismo criterio que las demas sub-pestañas de Agendas', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const create = await request(app)
    .post('/api/users')
    .set(auth(admin))
    .send({ nombre: 'X', user: 'rankingagendas_' + Math.random().toString(36).slice(2, 7), password: 'ClaveRanking1234', rol: 'CALIDAD', perms: { Calidad: true, 'campana_HOSPITAL LA MARIA': true } });
  assert.equal(create.status, 201);
  const token = await tokenFor(create.body.user, 'ClaveRanking1234');
  const res = await request(app).get('/api/calidad/agendas/ranking?campana=ORLANT').set(auth(token));
  assert.equal(res.status, 403);
});
