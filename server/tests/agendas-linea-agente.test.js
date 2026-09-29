// agendas-linea-agente.test.js — Fase 94 (tema B, pedido de Edwin): GET
// /api/calidad/agendas/(linea|agente) -- "Agendas por línea" (por mes,
// Línea General vs 3P, desde la columna `tipoLinea` de la tabla `agendas`,
// YA NO de la hoja "resumen") y "Agendas por agente" (barras por asesor,
// mayor a menor, con los mismos filtros que las demas sub-pestañas).
// Mismo patron que agendas-carga.test.js: datos SIEMPRE inventados, nunca
// se toca la hoja "resumen" en este archivo -- eso en si mismo prueba que
// "Agendas por línea" no depende de ella (si dependiera, saldria vacio).
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

test('GET /calidad/agendas/linea + /agente: carga mixta (2 meses, 2 lineas, 3 asesores) y confirma sumas y agrupacion', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const marca = 'LINAG' + Math.random().toString(36).slice(2, 8);
  const filas = [
    // Junio: 3 GENERAL (Asesor A x2, Asesor B x1), 2 3P (Asesor C x2)
    fila({ 0: 'ASESOR ' + marca + ' A', 5: '2025-06-01 08:00:00', 6: 'GENERAL', 3: marca }),
    fila({ 0: 'ASESOR ' + marca + ' A', 5: '2025-06-02 08:00:00', 6: 'GENERAL', 3: marca }),
    fila({ 0: 'ASESOR ' + marca + ' B', 5: '2025-06-03 08:00:00', 6: 'GENERAL', 3: marca }),
    fila({ 0: 'ASESOR ' + marca + ' C', 5: '2025-06-04 08:00:00', 6: '3P', 3: marca }),
    fila({ 0: 'ASESOR ' + marca + ' C', 5: '2025-06-05 08:00:00', 6: '3P', 3: marca }),
    // Julio: 1 GENERAL (Asesor B), 1 3P (Asesor A)
    fila({ 0: 'ASESOR ' + marca + ' B', 5: '2025-07-01 08:00:00', 6: 'GENERAL', 3: marca }),
    fila({ 0: 'ASESOR ' + marca + ' A', 5: '2025-07-02 08:00:00', 6: '3P', 3: marca }),
  ];
  const carga = await request(app).post('/api/calidad/agendas/carga').set(auth(admin)).send({ campana: 'ORLANT', filas });
  assert.equal(carga.status, 201, JSON.stringify(carga.body));
  assert.equal(carga.body.insertadas, 7);

  // Filtro que aisla esta carga del resto de datos ya sembrados en la base
  // de test (especialidad = marca unica de esta prueba).
  const qs = 'campana=ORLANT&especialidad=' + encodeURIComponent(marca);

  const linea = await request(app).get('/api/calidad/agendas/linea?' + qs).set(auth(admin));
  assert.equal(linea.status, 200, JSON.stringify(linea.body));
  const porMesLinea = {};
  linea.body.forEach((r) => { porMesLinea[r.mes + '|' + r.tipoLinea] = r.cantidad; });
  assert.equal(porMesLinea['2025-06|GENERAL'], 3);
  assert.equal(porMesLinea['2025-06|3P'], 2);
  assert.equal(porMesLinea['2025-07|GENERAL'], 1);
  assert.equal(porMesLinea['2025-07|3P'], 1);
  const totalLinea = linea.body.reduce((a, r) => a + r.cantidad, 0);
  assert.equal(totalLinea, 7, 'la suma de "Agendas por línea" debe dar el total (7)');

  const agente = await request(app).get('/api/calidad/agendas/agente?' + qs).set(auth(admin));
  assert.equal(agente.status, 200, JSON.stringify(agente.body));
  const porAgente = {};
  agente.body.forEach((r) => { porAgente[r.asesor] = r.cantidad; });
  assert.equal(porAgente['ASESOR ' + marca + ' A'], 3);
  assert.equal(porAgente['ASESOR ' + marca + ' B'], 2);
  assert.equal(porAgente['ASESOR ' + marca + ' C'], 2);
  const totalAgente = agente.body.reduce((a, r) => a + r.cantidad, 0);
  assert.equal(totalAgente, 7, 'la suma de "Agendas por agente" debe dar el total (7)');
  // Mayor a menor (pedido explicito de Edwin) -- A (3) antes que B/C (2 y 2).
  assert.equal(agente.body[0].asesor, 'ASESOR ' + marca + ' A');
  assert.ok(agente.body[0].cantidad >= agente.body[1].cantidad);
  assert.ok(agente.body[1].cantidad >= agente.body[2].cantidad);
});

test('GET /calidad/agendas/linea + /agente: filtros combinados (sede + tipoLinea + rango de fechas) se respetan igual que en /especialidad', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const marca = 'LINAGF' + Math.random().toString(36).slice(2, 8);
  const filas = [
    fila({ 0: 'ASESOR ' + marca + ' X', 1: 'SEDE NORTE', 5: '2025-08-01 08:00:00', 6: 'GENERAL', 3: marca }),
    fila({ 0: 'ASESOR ' + marca + ' X', 1: 'SEDE NORTE', 5: '2025-08-10 08:00:00', 6: '3P', 3: marca }),
    fila({ 0: 'ASESOR ' + marca + ' Y', 1: 'SEDE SUR', 5: '2025-08-05 08:00:00', 6: 'GENERAL', 3: marca }),
    fila({ 0: 'ASESOR ' + marca + ' X', 1: 'SEDE NORTE', 5: '2025-08-20 08:00:00', 6: 'GENERAL', 3: marca }),
  ];
  const carga = await request(app).post('/api/calidad/agendas/carga').set(auth(admin)).send({ campana: 'ORLANT', filas });
  assert.equal(carga.status, 201, JSON.stringify(carga.body));

  // Filtra: sede NORTE + tipoLinea GENERAL + rango 01-15 ago -- de las 4
  // filas, solo la primera (X, NORTE, GENERAL, 08-01) deberia sobrevivir
  // (la del 08-20 queda fuera por el rango de fechas).
  const qs = 'campana=ORLANT&especialidad=' + encodeURIComponent(marca) +
    '&sede=SEDE+NORTE&tipoLinea=GENERAL&desde=2025-08-01&hasta=2025-08-15';

  const linea = await request(app).get('/api/calidad/agendas/linea?' + qs).set(auth(admin));
  assert.equal(linea.status, 200);
  const total = linea.body.reduce((a, r) => a + r.cantidad, 0);
  assert.equal(total, 1, 'solo 1 fila cumple sede+tipoLinea+rango a la vez');
  assert.ok(linea.body.every((r) => r.tipoLinea === 'GENERAL'));

  const agente = await request(app).get('/api/calidad/agendas/agente?' + qs).set(auth(admin));
  assert.equal(agente.status, 200);
  assert.deepEqual(agente.body.map((r) => r.asesor), ['ASESOR ' + marca + ' X']);
  assert.equal(agente.body[0].cantidad, 1);
});

test('GET /calidad/agendas/linea: nunca lee la hoja "resumen" -- una campana sin NINGUNA carga de resumen sigue devolviendo datos reales de la tabla agendas', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const marca = 'LINSINRESUMEN' + Math.random().toString(36).slice(2, 6);
  const carga = await request(app).post('/api/calidad/agendas/carga').set(auth(admin)).send({
    campana: 'ORLANT',
    filas: [fila({ 5: '2025-09-01 08:00:00', 6: '3P', 3: marca })],
  });
  assert.equal(carga.status, 201);
  // Esta prueba nunca sembro NADA en dashboard_cargas/resumen para esta
  // marca -- si /linea dependiera de esa hoja (como el panel viejo,
  // reemplazado en esta misma fase), vendria vacio a pesar de la carga real.
  const linea = await request(app).get('/api/calidad/agendas/linea?campana=ORLANT&especialidad=' + encodeURIComponent(marca)).set(auth(admin));
  assert.equal(linea.status, 200);
  assert.deepEqual(linea.body, [{ mes: '2025-09', tipoLinea: '3P', cantidad: 1 }]);
});

test('GET /calidad/agendas/linea y /agente: requieren acceso a la campana (403 sin acceso, mismo criterio que /especialidad)', async () => {
  const create = await (async () => {
    const admin = await tokenFor('admin', MASTER_PASSWORD);
    return request(app)
      .post('/api/users')
      .set(auth(admin))
      .send({ nombre: 'X', user: 'agendaslinea_' + Math.random().toString(36).slice(2, 7), password: 'ClaveAgendas1234', rol: 'CALIDAD', perms: { Calidad: true, 'campana_HOSPITAL LA MARIA': true } });
  })();
  assert.equal(create.status, 201);
  const token = await tokenFor(create.body.user, 'ClaveAgendas1234');
  const linea = await request(app).get('/api/calidad/agendas/linea?campana=ORLANT').set(auth(token));
  assert.equal(linea.status, 403);
  const agente = await request(app).get('/api/calidad/agendas/agente?campana=ORLANT').set(auth(token));
  assert.equal(agente.status, 403);
});
