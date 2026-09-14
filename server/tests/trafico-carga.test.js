// trafico-carga.test.js — POST /api/calidad/trafico/carga (sube el export
// de Volvox ya parseado, sin campana explicita) + el mapeo skill->campana
// (GET/PUT /api/calidad/trafico/skills) que resuelve a cual campana va cada
// fila. Cubre: skill nueva -> "(SIN ASIGNAR)" sin romper la carga,
// idempotencia (resubir no duplica), y que remapear una skill reatribuye su
// historico y recalcula el mensual de la campana vieja y la nueva.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');

const auth = (t) => ({ Authorization: `Bearer ${t}` });

function fila(over) {
  return {
    fecha: '2026-06-01',
    skillName: 'CALL INBOUND DEMO',
    totalLlamadas: 100,
    contestadas: 90,
    nivelAtencionPct: 90,
    ...over,
  };
}

test('POST /calidad/trafico/carga: solo el administrador puede cargar', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const create = await request(app)
    .post('/api/users')
    .set(auth(admin))
    .send({ nombre: 'X', user: 'trf_noadmin_' + Math.random().toString(36).slice(2, 7), password: 'ClaveTrafico123', rol: 'CALIDAD', perms: { Calidad: true } });
  assert.equal(create.status, 201);
  const token = await tokenFor(create.body.user, 'ClaveTrafico123');
  const res = await request(app).post('/api/calidad/trafico/carga').set(auth(token)).send({ filas: [fila()] });
  assert.equal(res.status, 403);
});

test('skill nueva (sin mapear) se guarda igual, bajo "(SIN ASIGNAR)", sin romper la carga', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const skill = 'SKILL NUEVA ' + Math.random().toString(36).slice(2, 8);
  const res = await request(app)
    .post('/api/calidad/trafico/carga')
    .set(auth(admin))
    .send({ archivoNombre: 'reporte.xlsx', filas: [fila({ skillName: skill })] });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.insertadas, 1);
  assert.deepEqual(res.body.skillsSinAsignar, [skill]);
  assert.deepEqual(res.body.campanas, ['(SIN ASIGNAR)']);

  const skills = await request(app).get('/api/calidad/trafico/skills').set(auth(admin));
  assert.equal(skills.status, 200);
  const row = skills.body.find((s) => s.skillName === skill);
  assert.ok(row, 'la skill debe quedar registrada automaticamente');
  assert.equal(row.campana, null);
  assert.equal(row.filas, 1);
});

test('mapear una skill re-atribuye su historico ya guardado (sin volver a subir el archivo) y recalcula el mensual', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const skill = 'SKILL REMAP ' + Math.random().toString(36).slice(2, 8);
  const campanaDestino = 'ORLANT';

  // Sube 2 dias sin mapear -> caen en (SIN ASIGNAR).
  const carga = await request(app)
    .post('/api/calidad/trafico/carga')
    .set(auth(admin))
    .send({
      filas: [
        fila({ skillName: skill, fecha: '2026-06-01', totalLlamadas: 100, contestadas: 90 }),
        fila({ skillName: skill, fecha: '2026-06-02', totalLlamadas: 50, contestadas: 45 }),
      ],
    });
  assert.equal(carga.status, 201);
  assert.deepEqual(carga.body.campanas, ['(SIN ASIGNAR)']);

  const antesSinAsignar = await request(app)
    .get('/api/calidad/nivel-servicio/diario?campana=' + encodeURIComponent('(SIN ASIGNAR)'))
    .set(auth(admin));
  assert.equal(antesSinAsignar.status, 200);
  assert.ok(antesSinAsignar.body.some((r) => r.skillName === skill));

  // Mapea la skill a ORLANT.
  const map = await request(app)
    .put('/api/calidad/trafico/skills/' + encodeURIComponent(skill))
    .set(auth(admin))
    .send({ campana: campanaDestino });
  assert.equal(map.status, 200, JSON.stringify(map.body));
  assert.equal(map.body.movidas, 2);

  // Ya no aparece bajo (SIN ASIGNAR)...
  const despuesSinAsignar = await request(app)
    .get('/api/calidad/nivel-servicio/diario?campana=' + encodeURIComponent('(SIN ASIGNAR)'))
    .set(auth(admin));
  assert.ok(!despuesSinAsignar.body.some((r) => r.skillName === skill));

  // ...sino bajo ORLANT, con los mismos datos.
  const orlant = await request(app).get('/api/calidad/nivel-servicio/diario?campana=ORLANT').set(auth(admin));
  const filasSkill = orlant.body.filter((r) => r.skillName === skill);
  assert.equal(filasSkill.length, 2);
  assert.equal(filasSkill.find((f) => f.fecha === '2026-06-01').totalLlamadas, 100);

  // El mensual de ORLANT para 2026-06 debe incluir estas 150 llamadas.
  const mensual = await request(app).get('/api/calidad/nivel-servicio?campana=ORLANT').set(auth(admin));
  const junio = mensual.body.find((m) => m.mes === '2026-06');
  assert.ok(junio, 'debe existir un agregado mensual 2026-06 para ORLANT tras el remapeo');
  assert.ok(junio.llamadasTotales >= 150);
});

test('idempotencia: volver a subir el mismo archivo actualiza, no duplica', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const skill = 'SKILL IDEMPOTENTE ' + Math.random().toString(36).slice(2, 8);
  const filas = [fila({ skillName: skill, fecha: '2026-07-01', totalLlamadas: 100, contestadas: 80 })];

  const uno = await request(app).post('/api/calidad/trafico/carga').set(auth(admin)).send({ filas });
  assert.equal(uno.status, 201);

  const dos = await request(app)
    .post('/api/calidad/trafico/carga')
    .set(auth(admin))
    .send({ filas: [fila({ skillName: skill, fecha: '2026-07-01', totalLlamadas: 300, contestadas: 270 })] });
  assert.equal(dos.status, 201);

  const rows = await request(app)
    .get('/api/calidad/nivel-servicio/diario?campana=' + encodeURIComponent('(SIN ASIGNAR)'))
    .set(auth(admin));
  const filasSkill = rows.body.filter((r) => r.skillName === skill && r.fecha === '2026-07-01');
  assert.equal(filasSkill.length, 1, 'no debe duplicar la fila (campana, fecha, skillName)');
  assert.equal(filasSkill[0].totalLlamadas, 300, 'debe reflejar el valor de la SEGUNDA carga, no sumar ambas');
});

test('un archivo con varias skills mapeadas a campanas distintas se reparte correctamente en un solo POST', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const skillA = 'SKILL MULTI A ' + Math.random().toString(36).slice(2, 6);
  const skillB = 'SKILL MULTI B ' + Math.random().toString(36).slice(2, 6);

  await request(app).put('/api/calidad/trafico/skills/' + encodeURIComponent(skillA)).set(auth(admin)).send({ campana: 'ORLANT' });
  await request(app).put('/api/calidad/trafico/skills/' + encodeURIComponent(skillB)).set(auth(admin)).send({ campana: 'CLINICA AURORA' });

  const res = await request(app)
    .post('/api/calidad/trafico/carga')
    .set(auth(admin))
    .send({
      filas: [
        fila({ skillName: skillA, fecha: '2026-08-01' }),
        fila({ skillName: skillB, fecha: '2026-08-01' }),
      ],
    });
  assert.equal(res.status, 201);
  assert.equal(res.body.skillsSinAsignar.length, 0);
  assert.deepEqual(res.body.campanas.sort(), ['CLINICA AURORA', 'ORLANT']);

  const orlant = await request(app).get('/api/calidad/nivel-servicio/diario?campana=ORLANT').set(auth(admin));
  assert.ok(orlant.body.some((r) => r.skillName === skillA));
  const aurora = await request(app).get('/api/calidad/nivel-servicio/diario?campana=' + encodeURIComponent('CLINICA AURORA')).set(auth(admin));
  assert.ok(aurora.body.some((r) => r.skillName === skillB));
});

test('GET /calidad/nivel-servicio/diario respeta el acceso por campana', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const create = await request(app)
    .post('/api/users')
    .set(auth(admin))
    .send({ nombre: 'X', user: 'trf_sincamp_' + Math.random().toString(36).slice(2, 7), password: 'ClaveTrafico123', rol: 'CALIDAD', perms: { Calidad: true } });
  const token = await tokenFor(create.body.user, 'ClaveTrafico123');
  const res = await request(app).get('/api/calidad/nivel-servicio/diario?campana=ORLANT').set(auth(token));
  assert.equal(res.status, 403);
});

test('validacion: fila sin SKILL_NAME -> 400 (defensa en el servidor, no solo en el navegador)', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const res = await request(app)
    .post('/api/calidad/trafico/carga')
    .set(auth(admin))
    .send({ filas: [{ fecha: '2026-06-01', totalLlamadas: 100, contestadas: 90 }] });
  assert.equal(res.status, 400);
});

test('validacion: contestadas > totalLlamadas -> 400', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const res = await request(app)
    .post('/api/calidad/trafico/carga')
    .set(auth(admin))
    .send({ filas: [fila({ totalLlamadas: 50, contestadas: 60 })] });
  assert.equal(res.status, 400);
});

test('las columnas opcionales ausentes no llegan como 0 sino como null', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const skill = 'SKILL SIN OPCIONALES ' + Math.random().toString(36).slice(2, 6);
  const res = await request(app)
    .post('/api/calidad/trafico/carga')
    .set(auth(admin))
    .send({ filas: [{ fecha: '2026-06-05', skillName: skill, totalLlamadas: 100, contestadas: 90 }] });
  assert.equal(res.status, 201);
  const rows = await request(app)
    .get('/api/calidad/nivel-servicio/diario?campana=' + encodeURIComponent('(SIN ASIGNAR)'))
    .set(auth(admin));
  const row = rows.body.find((r) => r.skillName === skill);
  assert.equal(row.nivelAtencionPct, null);
  assert.equal(row.serviceLevel20secPct, null);
  assert.equal(row.ahtSegundos, null);
});
