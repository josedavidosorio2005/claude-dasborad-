// tipificaciones-carga.test.js — POST /api/calidad/tipificacion/carga(/impacto)
// + GET /api/calidad/tipificacion/(por-tipo|opciones) (Fase 77, ORLANT).
// Mismo patron que agendas-carga.test.js: reemplazo por periodo (aqui
// ademas por CANAL), impacto/confirmacion, filtros, permisos, agrupacion
// top10+Otras. Datos SIEMPRE inventados.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, tokenFor, MASTER_PASSWORD } = require('./helpers');
const { agruparTop10YOtras } = require('../tipificaciones');

const auth = (t) => ({ Authorization: `Bearer ${t}` });

// [agente, fecha, hora, duracionMin, tipificacion, skill]
function fila(over) {
  const base = ['ASESOR 01', '2025-04-15', '18:06:08', 3, 'AGENDADA_InConexion', 'LLAMADAS DE SALIDA'];
  return Object.assign([], base, over);
}

test('POST /calidad/tipificacion/carga: solo quien tiene el permiso Cargar Datos puede subir', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const create = await request(app)
    .post('/api/users')
    .set(auth(admin))
    .send({ nombre: 'X', user: 'tipif_noadmin_' + Math.random().toString(36).slice(2, 7), password: 'ClaveTipif1234', rol: 'CALIDAD', perms: { Calidad: true, campana_ORLANT: true } });
  assert.equal(create.status, 201);
  const token = await tokenFor(create.body.user, 'ClaveTipif1234');
  const res = await request(app)
    .post('/api/calidad/tipificacion/carga')
    .set(auth(token))
    .send({ campana: 'ORLANT', canal: 'LLAMADAS', filas: [fila()] });
  assert.equal(res.status, 403);
});

test('carga valida: se guarda y GET /por-tipo la agrega correctamente', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const tip = 'TEST TIPO ' + Math.random().toString(36).slice(2, 8);
  const res = await request(app)
    .post('/api/calidad/tipificacion/carga')
    .set(auth(admin))
    .send({
      campana: 'ORLANT',
      canal: 'LLAMADAS',
      archivoNombre: 'TIPIFICACION_test.xlsx',
      filas: [
        fila({ 1: '2025-04-01', 4: tip }),
        fila({ 1: '2025-04-02', 4: tip }),
        fila({ 1: '2025-04-03', 4: tip }),
      ],
    });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.insertadas, 3);
  assert.equal(res.body.desde, '2025-04-01');
  assert.equal(res.body.hasta, '2025-04-03');

  const porTipo = await request(app).get('/api/calidad/tipificacion/por-tipo?campana=ORLANT&canal=LLAMADAS&mes=2025-04').set(auth(admin));
  assert.equal(porTipo.status, 200);
  const f = porTipo.body.datos.find((r) => r.tipificacion === tip);
  assert.ok(f, 'la tipificacion cargada debe aparecer agregada');
  assert.equal(f.cantidad, 3);
});

test('reemplaza por periodo Y CANAL: subir el MISMO archivo 2 veces no duplica', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const tip = 'TEST DUP ' + Math.random().toString(36).slice(2, 8);
  const payload = {
    campana: 'ORLANT',
    canal: 'LLAMADAS',
    archivoNombre: 'TIPIFICACION_dup.xlsx',
    filas: [
      fila({ 1: '2025-05-01', 4: tip }),
      fila({ 1: '2025-05-02', 4: tip }),
    ],
  };
  const uno = await request(app).post('/api/calidad/tipificacion/carga').set(auth(admin)).send(payload);
  assert.equal(uno.status, 201);
  const dos = await request(app).post('/api/calidad/tipificacion/carga').set(auth(admin)).send(payload);
  assert.equal(dos.status, 201);
  assert.equal(dos.body.borradas, 2, 'la segunda carga debe borrar las 2 filas de la primera antes de reinsertar');

  const porTipo = await request(app).get('/api/calidad/tipificacion/por-tipo?campana=ORLANT&canal=LLAMADAS&mes=2025-05').set(auth(admin));
  const f = porTipo.body.datos.find((r) => r.tipificacion === tip);
  assert.equal(f.cantidad, 2, 'no debe duplicar');
});

test('reemplazar Llamadas de un periodo NUNCA toca WhatsApp del mismo periodo (canal aislado)', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const tip = 'TEST CANAL ' + Math.random().toString(36).slice(2, 6);
  await request(app).post('/api/calidad/tipificacion/carga').set(auth(admin)).send({
    campana: 'ORLANT', canal: 'WHATSAPP', filas: [fila({ 1: '2025-06-10', 4: tip, 5: 'WHATSAPP ORLANT 3P' })],
  });
  // Subir Llamadas para el MISMO rango de fechas no debe borrar la fila de WhatsApp de arriba.
  await request(app).post('/api/calidad/tipificacion/carga').set(auth(admin)).send({
    campana: 'ORLANT', canal: 'LLAMADAS', filas: [fila({ 1: '2025-06-10', 4: 'OTRA COSA' })],
  });

  const porTipoWpp = await request(app).get('/api/calidad/tipificacion/por-tipo?campana=ORLANT&canal=WHATSAPP&mes=2025-06').set(auth(admin));
  const f = porTipoWpp.body.datos.find((r) => r.tipificacion === tip);
  assert.ok(f, 'la fila de WhatsApp debe seguir intacta despues de subir Llamadas del mismo periodo');
  assert.equal(f.cantidad, 1);
});

test('un archivo de un rango DISTINTO no toca las filas de otro rango (mismo canal)', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const tip = 'TEST RANGO ' + Math.random().toString(36).slice(2, 6);
  await request(app).post('/api/calidad/tipificacion/carga').set(auth(admin)).send({
    campana: 'ORLANT', canal: 'LLAMADAS', filas: [fila({ 1: '2025-07-01', 4: tip })],
  });
  await request(app).post('/api/calidad/tipificacion/carga').set(auth(admin)).send({
    campana: 'ORLANT', canal: 'LLAMADAS', filas: [fila({ 1: '2025-08-01', 4: tip })],
  });
  const porTipoJul = await request(app).get('/api/calidad/tipificacion/por-tipo?campana=ORLANT&canal=LLAMADAS&mes=2025-07').set(auth(admin));
  const fJul = porTipoJul.body.datos.find((r) => r.tipificacion === tip);
  assert.ok(fJul, 'julio debe seguir con su propia fila, sin tocar por la carga de agosto');
  assert.equal(fJul.cantidad, 1);
});

test('POST /calidad/tipificacion/carga/impacto: no escribe nada, solo cuenta lo que se reemplazaria', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const tip = 'TEST IMPACTO ' + Math.random().toString(36).slice(2, 6);
  await request(app).post('/api/calidad/tipificacion/carga').set(auth(admin)).send({
    campana: 'ORLANT', canal: 'LLAMADAS', filas: [fila({ 1: '2025-09-05', 4: tip }), fila({ 1: '2025-09-10', 4: tip })],
  });
  const impacto = await request(app).post('/api/calidad/tipificacion/carga/impacto').set(auth(admin)).send({
    campana: 'ORLANT', canal: 'LLAMADAS', filas: [fila({ 1: '2025-09-01', 4: tip }), fila({ 1: '2025-09-30', 4: tip })],
  });
  assert.equal(impacto.status, 200);
  assert.equal(impacto.body.filasExistentes, 2, 'las 2 filas de sept-05 y sept-10 caen dentro de [01..30]');
  assert.equal(impacto.body.filasNuevas, 2);

  const check = await request(app).get('/api/calidad/tipificacion/por-tipo?campana=ORLANT&canal=LLAMADAS&mes=2025-09').set(auth(admin));
  const f = check.body.datos.find((r) => r.tipificacion === tip);
  assert.equal(f.cantidad, 2, 'impacto no debe haber escrito ni borrado nada');
});

test('filtros de agente y skill se respetan de forma independiente', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const tip = 'TEST FILTRO ' + Math.random().toString(36).slice(2, 6);
  await request(app).post('/api/calidad/tipificacion/carga').set(auth(admin)).send({
    campana: 'ORLANT', canal: 'LLAMADAS',
    filas: [
      fila({ 0: 'SARA RAMIREZ LOPEZ', 1: '2025-10-05', 4: tip, 5: 'LLAMADAS DE SALIDA' }),
      fila({ 0: 'OTRO ASESOR', 1: '2025-10-05', 4: tip, 5: 'LLAMADAS DE SALIDA' }),
      fila({ 0: 'SARA RAMIREZ LOPEZ', 1: '2025-10-05', 4: tip, 5: 'CALL INBOUND ORLANT 3P' }),
    ],
  });
  const porAgente = await request(app).get('/api/calidad/tipificacion/por-tipo?campana=ORLANT&canal=LLAMADAS&mes=2025-10&agente=' + encodeURIComponent('SARA RAMIREZ LOPEZ')).set(auth(admin));
  const total1 = porAgente.body.datos.filter((r) => r.tipificacion === tip).reduce((a, r) => a + r.cantidad, 0);
  assert.equal(total1, 2, 'solo las 2 filas de SARA, sin importar el skill');

  const porSkill = await request(app).get('/api/calidad/tipificacion/por-tipo?campana=ORLANT&canal=LLAMADAS&mes=2025-10&skill=' + encodeURIComponent('LLAMADAS DE SALIDA')).set(auth(admin));
  const total2 = porSkill.body.datos.filter((r) => r.tipificacion === tip).reduce((a, r) => a + r.cantidad, 0);
  assert.equal(total2, 2, 'solo las 2 filas de LLAMADAS DE SALIDA, sin importar el agente');

  const combinado = await request(app).get('/api/calidad/tipificacion/por-tipo?campana=ORLANT&canal=LLAMADAS&mes=2025-10&agente=' + encodeURIComponent('SARA RAMIREZ LOPEZ') + '&skill=' + encodeURIComponent('LLAMADAS DE SALIDA')).set(auth(admin));
  const total3 = combinado.body.datos.filter((r) => r.tipificacion === tip).reduce((a, r) => a + r.cantidad, 0);
  assert.equal(total3, 1, 'solo la fila que cumple los 2 filtros a la vez');
});

test('GET /calidad/tipificacion/opciones: agentes/skills/meses distintos, filtrados por canal', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const asesor = 'ASESOR OPC ' + Math.random().toString(36).slice(2, 6);
  await request(app).post('/api/calidad/tipificacion/carga').set(auth(admin)).send({
    campana: 'ORLANT', canal: 'WHATSAPP', filas: [fila({ 0: asesor, 1: '2025-11-01', 5: 'WHATSAPP ORLANT GENERAL' })],
  });
  const opWpp = await request(app).get('/api/calidad/tipificacion/opciones?campana=ORLANT&canal=WHATSAPP').set(auth(admin));
  assert.ok(opWpp.body.agentes.includes(asesor));
  assert.ok(opWpp.body.meses.includes('2025-11'));

  const opLlam = await request(app).get('/api/calidad/tipificacion/opciones?campana=ORLANT&canal=LLAMADAS').set(auth(admin));
  assert.ok(!opLlam.body.agentes.includes(asesor), 'el asesor de WhatsApp no debe filtrar hacia las opciones de Llamadas');
});

// ── Agrupacion top10 + "Otras" (pura, sin DB) ───────────────────────────
test('agruparTop10YOtras: 15 categorias -> top 10 + 1 sola "Otras (5 tipificaciones)"', () => {
  const conteo = Array.from({ length: 15 }, (_, i) => ({ tipificacion: 'CAT' + i, cantidad: 15 - i }));
  const { datos, total } = agruparTop10YOtras(conteo);
  assert.equal(datos.length, 11, '10 categorias + 1 "Otras"');
  assert.equal(datos[0].tipificacion, 'CAT0');
  assert.equal(datos[9].tipificacion, 'CAT9');
  const otras = datos[10];
  assert.equal(otras.tipificacion, 'Otras (5 tipificaciones)');
  assert.equal(otras.esOtras, true);
  assert.equal(otras.distintas, 5, 'N es la cantidad de categorias DISTINTAS agrupadas, no la suma de filas');
  // CAT10..CAT14 -> cantidades 5,4,3,2,1 = 15
  assert.equal(otras.cantidad, 15);
  assert.equal(total, conteo.reduce((a, r) => a + r.cantidad, 0));
});

test('agruparTop10YOtras: 10 categorias o menos -> nunca aparece "Otras"', () => {
  const conteo = Array.from({ length: 10 }, (_, i) => ({ tipificacion: 'CAT' + i, cantidad: i + 1 }));
  const { datos } = agruparTop10YOtras(conteo);
  assert.equal(datos.length, 10);
  assert.ok(!datos.some((d) => d.esOtras));
});

test('agruparTop10YOtras: sin categorias -> lista vacia, total 0', () => {
  const { datos, total } = agruparTop10YOtras([]);
  assert.deepEqual(datos, []);
  assert.equal(total, 0);
});
