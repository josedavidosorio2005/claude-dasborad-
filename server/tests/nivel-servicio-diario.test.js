// nivel-servicio-diario.test.js — Carga diaria de Nivel de Servicio desde el
// export real del conmutador (Fase 1 del pedido de carga real). El endpoint
// recibe filas YA parseadas (el servidor nunca parsea Excel), las upsertea en
// calidad_nivel_servicio_diario por (campana, fecha, skillName), y recalcula
// el agregado mensual de calidad_nivel_servicio a partir de TODAS las filas
// diarias de ese mes (no solo las de la carga actual).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, tokenFor, MASTER_PASSWORD } = require('./helpers');
const calc = require('../calidad-logic');

const auth = (t) => ({ Authorization: `Bearer ${t}` });

async function calidadUser(adminToken, campana, sufijo) {
  const user = 'nsd_' + sufijo + '_' + Math.random().toString(36).slice(2, 7);
  const create = await request(app)
    .post('/api/users')
    .set(auth(adminToken))
    .send({
      nombre: 'Calidad ' + sufijo,
      user,
      password: 'ClaveCalidad123',
      rol: 'CALIDAD',
      perms: campana ? { Calidad: true, ['campana_' + campana]: true } : { Calidad: true },
    });
  assert.equal(create.status, 201, JSON.stringify(create.body));
  const token = await tokenFor(user, 'ClaveCalidad123');
  return { token, id: create.body.id, user };
}

function fila(over = {}) {
  return {
    fecha: '2026-06-01',
    skillName: 'CALL INBOUND TEST',
    totalLlamadas: 100,
    contestadas: 95,
    serviceLevel20secPct: 80,
    ...over,
  };
}

test('carga diaria: solo el administrador puede cargar', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const { token } = await calidadUser(admin, 'ORLANT', 'noadmin');
  const res = await request(app)
    .post('/api/calidad/nivel-servicio/carga-diaria')
    .set(auth(token))
    .send({ campana: 'ORLANT', archivoNombre: 'x.xlsx', filas: [fila()] });
  assert.equal(res.status, 403);
});

test('carga diaria: agrega correctamente el % mensual con numeros conocidos', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const campana = 'CARGA DIARIA TEST ' + Math.random().toString(36).slice(2, 7);
  const res = await request(app)
    .post('/api/calidad/nivel-servicio/carga-diaria')
    .set(auth(admin))
    .send({
      campana,
      archivoNombre: 'reporte.xlsx',
      filas: [
        fila({ fecha: '2026-06-01', totalLlamadas: 100, contestadas: 95, serviceLevel20secPct: 80 }), // estimado = round(80/100*100) = 80
        fila({ fecha: '2026-06-02', totalLlamadas: 200, contestadas: 190, serviceLevel20secPct: 90 }), // estimado = round(90/100*200) = 180
      ],
    });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.diario.insertadas, 2);
  assert.equal(res.body.mensual.length, 1);
  const mes = res.body.mensual[0];
  assert.equal(mes.mes, '2026-06');
  assert.equal(mes.llamadasTotales, 300); // 100 + 200
  assert.equal(mes.contestadas20s, 260); // 80 + 180
  assert.equal(mes.pct, calc.nivelServicioPct(260, 300)); // 86.7
  assert.equal(mes.pct, 86.7);
  assert.equal(mes.cumple, true); // >= 80

  // Se reflejo tambien en /api/calidad/nivel-servicio (misma tabla de siempre).
  const list = await request(app).get(`/api/calidad/nivel-servicio?campana=${campana}`).set(auth(admin));
  assert.equal(list.status, 200);
  assert.equal(list.body.find((r) => r.mes === '2026-06').pct, 86.7);
});

test('carga diaria: serviceLevel20secPct null no cuenta como 0 en el numerador, pero SI suma al total', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const campana = 'CARGA DIARIA NULL ' + Math.random().toString(36).slice(2, 7);
  const res = await request(app)
    .post('/api/calidad/nivel-servicio/carga-diaria')
    .set(auth(admin))
    .send({
      campana,
      filas: [
        fila({ fecha: '2026-07-01', totalLlamadas: 100, contestadas: 90, serviceLevel20secPct: 80 }), // estimado 80
        fila({ fecha: '2026-07-02', totalLlamadas: 50, contestadas: 40, serviceLevel20secPct: null }), // sin dato ese dia
      ],
    });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const mes = res.body.mensual[0];
  assert.equal(mes.llamadasTotales, 150); // 100 + 50 (el dia sin SL% SI cuenta en el total)
  assert.equal(mes.contestadas20s, 80); // solo el dia con dato
});

test('carga diaria: upsert por (campana, fecha, skillName) — resubir el mismo dia reemplaza, no duplica', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const campana = 'CARGA DIARIA UPSERT ' + Math.random().toString(36).slice(2, 7);

  const uno = await request(app)
    .post('/api/calidad/nivel-servicio/carga-diaria')
    .set(auth(admin))
    .send({ campana, filas: [fila({ fecha: '2026-08-05', totalLlamadas: 100, contestadas: 80, serviceLevel20secPct: 50 })] });
  assert.equal(uno.status, 201);
  assert.equal(uno.body.mensual[0].llamadasTotales, 100);
  assert.equal(uno.body.mensual[0].contestadas20s, 50); // round(50/100*100)

  // Re-subir el MISMO dia/skill con numeros distintos.
  const dos = await request(app)
    .post('/api/calidad/nivel-servicio/carga-diaria')
    .set(auth(admin))
    .send({ campana, filas: [fila({ fecha: '2026-08-05', totalLlamadas: 300, contestadas: 270, serviceLevel20secPct: 90 })] });
  assert.equal(dos.status, 201);
  // Si hubiera duplicado en vez de reemplazar, el total seria 100+300=400.
  assert.equal(dos.body.mensual[0].llamadasTotales, 300);
  assert.equal(dos.body.mensual[0].contestadas20s, 270); // round(90/100*300)
});

test('carga diaria: subir 2 meses distintos actualiza ambos en calidad_nivel_servicio', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const campana = 'CARGA DIARIA MULTIMES ' + Math.random().toString(36).slice(2, 7);
  const res = await request(app)
    .post('/api/calidad/nivel-servicio/carga-diaria')
    .set(auth(admin))
    .send({
      campana,
      filas: [
        fila({ fecha: '2026-09-01', totalLlamadas: 100, contestadas: 90, serviceLevel20secPct: 70 }),
        fila({ fecha: '2026-10-01', totalLlamadas: 100, contestadas: 90, serviceLevel20secPct: 95 }),
      ],
    });
  assert.equal(res.status, 201);
  assert.equal(res.body.mensual.length, 2);
  const meses = res.body.mensual.map((m) => m.mes).sort();
  assert.deepEqual(meses, ['2026-09', '2026-10']);
  const sep = res.body.mensual.find((m) => m.mes === '2026-09');
  const oct = res.body.mensual.find((m) => m.mes === '2026-10');
  assert.equal(sep.cumple, false); // 70% < 80%
  assert.equal(oct.cumple, true); // 95% >= 80%
});

test('carga diaria: validacion — contestadas > totalLlamadas en una fila -> 400', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const res = await request(app)
    .post('/api/calidad/nivel-servicio/carga-diaria')
    .set(auth(admin))
    .send({ campana: 'ORLANT', filas: [fila({ totalLlamadas: 50, contestadas: 60 })] });
  assert.equal(res.status, 400);
});

test('carga diaria: validacion — fecha con formato invalido -> 400', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const res = await request(app)
    .post('/api/calidad/nivel-servicio/carga-diaria')
    .set(auth(admin))
    .send({ campana: 'ORLANT', filas: [fila({ fecha: '01/06/2026' })] });
  assert.equal(res.status, 400);
});

test('carga diaria: validacion — sin filas -> 400', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const res = await request(app)
    .post('/api/calidad/nivel-servicio/carga-diaria')
    .set(auth(admin))
    .send({ campana: 'ORLANT', filas: [] });
  assert.equal(res.status, 400);
});

test('carga diaria: queda registrada en el historial con la accion NIVEL_SERVICIO_CARGA_DIARIA', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const campana = 'CARGA DIARIA HIST ' + Math.random().toString(36).slice(2, 7);
  await request(app)
    .post('/api/calidad/nivel-servicio/carga-diaria')
    .set(auth(admin))
    .send({ campana, filas: [fila({ fecha: '2026-11-01' })] });
  const hist = await request(app).get('/api/historial').set(auth(admin));
  assert.equal(hist.status, 200);
  assert.ok(hist.body.some((h) => h.accion === 'NIVEL_SERVICIO_CARGA_DIARIA' && h.rol === campana));
});
