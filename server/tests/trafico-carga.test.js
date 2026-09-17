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

test('Hospital La Maria: dos skills mapeadas a la MISMA campana con sedes distintas no se mezclan (consolidacion 2026-09-15)', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const skillCastilla = 'SKILL HLM CASTILLA ' + Math.random().toString(36).slice(2, 6);
  const skillSede33 = 'SKILL HLM SEDE33 ' + Math.random().toString(36).slice(2, 6);

  await request(app)
    .put('/api/calidad/trafico/skills/' + encodeURIComponent(skillCastilla))
    .set(auth(admin))
    .send({ campana: 'HOSPITAL LA MARIA', sede: 'CASTILLA' });
  await request(app)
    .put('/api/calidad/trafico/skills/' + encodeURIComponent(skillSede33))
    .set(auth(admin))
    .send({ campana: 'HOSPITAL LA MARIA', sede: 'SEDE33' });

  const res = await request(app)
    .post('/api/calidad/trafico/carga')
    .set(auth(admin))
    .send({
      filas: [
        fila({ skillName: skillCastilla, fecha: '2026-08-05', totalLlamadas: 50, contestadas: 45 }),
        fila({ skillName: skillSede33, fecha: '2026-08-05', totalLlamadas: 30, contestadas: 20 }),
      ],
    });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  // UNA sola campana ahora (no 2 campanas falsas): ambas skills caen bajo "HOSPITAL LA MARIA".
  assert.deepEqual(res.body.campanas, ['HOSPITAL LA MARIA']);

  const todas = await request(app).get('/api/calidad/nivel-servicio/diario?campana=' + encodeURIComponent('HOSPITAL LA MARIA')).set(auth(admin));
  const filaCastilla = todas.body.find((r) => r.skillName === skillCastilla);
  const filaSede33 = todas.body.find((r) => r.skillName === skillSede33);
  assert.equal(filaCastilla.sede, 'CASTILLA');
  assert.equal(filaCastilla.totalLlamadas, 50);
  assert.equal(filaSede33.sede, 'SEDE33');
  assert.equal(filaSede33.totalLlamadas, 30);

  // El mensual de cada sede queda separado (nunca sumado con la otra sede).
  const mensual = await request(app).get('/api/calidad/nivel-servicio?campana=' + encodeURIComponent('HOSPITAL LA MARIA')).set(auth(admin));
  const agosto = mensual.body.filter((m) => m.mes === '2026-08');
  assert.equal(agosto.length, 2, 'deben quedar 2 filas mensuales separadas (una por sede), no 1 sumada');
  const mesCastilla = agosto.find((m) => m.sede === 'CASTILLA');
  const mesSede33 = agosto.find((m) => m.sede === 'SEDE33');
  assert.ok(mesCastilla.llamadasTotales >= 50 && mesCastilla.llamadasTotales < 80, 'no debe incluir las llamadas de la otra sede');
  assert.ok(mesSede33.llamadasTotales >= 30 && mesSede33.llamadasTotales < 80, 'no debe incluir las llamadas de la otra sede');
});

test('Hospital La Maria: acceso al dashboard base (cliente_HOSPITAL LA MARIA) alcanza para ver el trafico de ambas sedes (decision de permisos documentada en auth.js)', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const create = await request(app)
    .post('/api/users')
    .set(auth(admin))
    .send({
      nombre: 'Viewer HLM',
      user: 'hlm_viewer_' + Math.random().toString(36).slice(2, 7),
      password: 'ClaveTrafico123',
      rol: 'CLIENTES_DASH',
      perms: { ClientesDash: true, ['cliente_HOSPITAL LA MARIA']: true },
    });
  assert.equal(create.status, 201, JSON.stringify(create.body));
  const token = await tokenFor(create.body.user, 'ClaveTrafico123');

  const res = await request(app)
    .get('/api/calidad/nivel-servicio/diario?campana=' + encodeURIComponent('HOSPITAL LA MARIA'))
    .set(auth(token));
  assert.equal(res.status, 200, JSON.stringify(res.body));

  // Pero NO le da acceso a otra campana cualquiera que no sea HLM.
  const otra = await request(app).get('/api/calidad/nivel-servicio/diario?campana=ORLANT').set(auth(token));
  assert.equal(otra.status, 403);
});

test('remapear una skill de una sede a otra mueve solo sus filas y recalcula el mensual de ambas sedes', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const skill = 'SKILL HLM REMAP SEDE ' + Math.random().toString(36).slice(2, 6);

  await request(app).put('/api/calidad/trafico/skills/' + encodeURIComponent(skill)).set(auth(admin)).send({ campana: 'HOSPITAL LA MARIA', sede: 'CASTILLA' });
  const carga = await request(app)
    .post('/api/calidad/trafico/carga')
    .set(auth(admin))
    .send({ filas: [fila({ skillName: skill, fecha: '2026-09-01', totalLlamadas: 40, contestadas: 35 })] });
  assert.equal(carga.status, 201);

  const map = await request(app)
    .put('/api/calidad/trafico/skills/' + encodeURIComponent(skill))
    .set(auth(admin))
    .send({ campana: 'HOSPITAL LA MARIA', sede: 'SEDE33' });
  assert.equal(map.status, 200, JSON.stringify(map.body));
  assert.equal(map.body.movidas, 1);

  const todas = await request(app).get('/api/calidad/nivel-servicio/diario?campana=' + encodeURIComponent('HOSPITAL LA MARIA')).set(auth(admin));
  const fila1 = todas.body.find((r) => r.skillName === skill);
  assert.equal(fila1.sede, 'SEDE33', 'debe haberse movido a la sede nueva');

  const mensual = await request(app).get('/api/calidad/nivel-servicio?campana=' + encodeURIComponent('HOSPITAL LA MARIA')).set(auth(admin));
  const septiembre = mensual.body.filter((m) => m.mes === '2026-09');
  const mesCastilla = septiembre.find((m) => m.sede === 'CASTILLA');
  const mesSede33 = septiembre.find((m) => m.sede === 'SEDE33');
  assert.ok(!mesCastilla || mesCastilla.llamadasTotales === 0, 'CASTILLA ya no debe tener esas llamadas');
  assert.ok(mesSede33 && mesSede33.llamadasTotales >= 40, 'SEDE33 debe haber ganado esas llamadas');
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

// ── Point 1 del pedido de Edwin: plantilla invalida -> error claro, sin ──
// ── afectar los datos ya cargados (fin a fin, no solo la validacion suelta) ──
test('point 1: un archivo con estructura invalida es rechazado y la carga anterior sigue intacta', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const skill = 'SKILL POINT1 ' + Math.random().toString(36).slice(2, 6);

  // Carga valida primero.
  const buena = await request(app)
    .post('/api/calidad/trafico/carga')
    .set(auth(admin))
    .send({ filas: [fila({ skillName: skill, fecha: '2026-10-01', totalLlamadas: 77, contestadas: 70 })] });
  assert.equal(buena.status, 201, JSON.stringify(buena.body));

  // "Archivo roto": una fila sin SKILL_NAME (lo que produciria traficoParseFilas
  // si el navegador mandara algo mal formado, o si alguien pega el body a mano) —
  // el servidor debe rechazar TODO el request con 400 (zod), sin escribir nada.
  const rota = await request(app)
    .post('/api/calidad/trafico/carga')
    .set(auth(admin))
    .send({ filas: [{ fecha: '2026-10-02', totalLlamadas: 999, contestadas: 999 }] });
  assert.equal(rota.status, 400);

  // Los datos de la carga buena, intactos: mismos numeros, sin fila nueva del intento roto.
  const rows = await request(app)
    .get('/api/calidad/nivel-servicio/diario?campana=' + encodeURIComponent('(SIN ASIGNAR)'))
    .set(auth(admin));
  const filasSkill = rows.body.filter((r) => r.skillName === skill);
  assert.equal(filasSkill.length, 1, 'la carga rota no debe haber agregado ni tocado filas de esta skill');
  assert.equal(filasSkill[0].totalLlamadas, 77, 'el dato de la carga buena no debe cambiar');
  assert.equal(rows.body.some((r) => r.fecha === '2026-10-02'), false, 'ninguna fila del intento roto debe existir');
});

// ── Control de cargas por periodo (seccion 3 del pedido de Edwin) ──
test('GET /calidad/trafico/cobertura: refleja los meses ya cargados por skill, reutilizando las fechas existentes', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const skill = 'SKILL COBERTURA ' + Math.random().toString(36).slice(2, 6);
  await request(app)
    .post('/api/calidad/trafico/carga')
    .set(auth(admin))
    .send({
      filas: [
        fila({ skillName: skill, fecha: '2026-11-01', totalLlamadas: 10, contestadas: 9 }),
        fila({ skillName: skill, fecha: '2026-12-01', totalLlamadas: 20, contestadas: 18 }),
      ],
    });

  const cobertura = await request(app).get('/api/calidad/trafico/cobertura').set(auth(admin));
  assert.equal(cobertura.status, 200);
  const fila1 = cobertura.body.find((r) => r.skillName === skill);
  assert.ok(fila1, 'la skill debe aparecer en la cobertura');
  assert.deepEqual(fila1.meses.map((m) => m.mes).sort(), ['2026-11', '2026-12']);
});

test('POST /calidad/trafico/carga/impacto: cuenta cuantas filas se reemplazarian SIN escribir nada', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const skill = 'SKILL IMPACTO ' + Math.random().toString(36).slice(2, 6);
  await request(app)
    .post('/api/calidad/trafico/carga')
    .set(auth(admin))
    .send({ filas: [fila({ skillName: skill, fecha: '2026-10-10', totalLlamadas: 5, contestadas: 5 })] });

  const impacto = await request(app)
    .post('/api/calidad/trafico/carga/impacto')
    .set(auth(admin))
    .send({ filas: [fila({ skillName: skill, fecha: '2026-10-10', totalLlamadas: 999, contestadas: 999 })] });
  assert.equal(impacto.status, 200, JSON.stringify(impacto.body));
  const par = impacto.body.find((p) => p.skillName === skill);
  assert.ok(par, JSON.stringify(impacto.body));
  assert.equal(par.filasExistentes, 1);
  assert.equal(par.mes, '2026-10');

  // No debe haber escrito nada: el valor guardado sigue siendo el original (5), no 999.
  const rows = await request(app)
    .get('/api/calidad/nivel-servicio/diario?campana=' + encodeURIComponent('(SIN ASIGNAR)'))
    .set(auth(admin));
  const filaSkill = rows.body.find((r) => r.skillName === skill);
  assert.equal(filaSkill.totalLlamadas, 5, '/carga/impacto no debe escribir nada en la base');
});

test('canLoadData (no solo isFullAdmin) alcanza para las rutas de trafico: un AUX_ADMIN con el permiso cargarDatos puede cargar y ver cobertura', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const create = await request(app)
    .post('/api/users')
    .set(auth(admin))
    .send({
      nombre: 'Aux con carga',
      user: 'aux_carga_' + Math.random().toString(36).slice(2, 7),
      password: 'ClaveTrafico123',
      rol: 'AUX_ADMIN',
      perms: { cargarDatos: true },
    });
  assert.equal(create.status, 201, JSON.stringify(create.body));
  const token = await tokenFor(create.body.user, 'ClaveTrafico123');

  const skill = 'SKILL AUX ADMIN ' + Math.random().toString(36).slice(2, 6);
  const carga = await request(app)
    .post('/api/calidad/trafico/carga')
    .set(auth(token))
    .send({ filas: [fila({ skillName: skill, fecha: '2026-10-15' })] });
  assert.equal(carga.status, 201, JSON.stringify(carga.body));

  const cobertura = await request(app).get('/api/calidad/trafico/cobertura').set(auth(token));
  assert.equal(cobertura.status, 200);

  // Pero un AUX_ADMIN SIN ese permiso sigue sin poder.
  const create2 = await request(app)
    .post('/api/users')
    .set(auth(admin))
    .send({
      nombre: 'Aux sin carga',
      user: 'aux_sincarga_' + Math.random().toString(36).slice(2, 7),
      password: 'ClaveTrafico123',
      rol: 'AUX_ADMIN',
      perms: {},
    });
  const token2 = await tokenFor(create2.body.user, 'ClaveTrafico123');
  const bloqueado = await request(app).get('/api/calidad/trafico/cobertura').set(auth(token2));
  assert.equal(bloqueado.status, 403);
});

// ── Pantalla "Registrar skill nuevo" (mapeo manual Wolkvox -> campana, ──
// hallazgo de la auditoria del flujo de carga, Fase 30/32): confirma que
// PUT /calidad/trafico/skills/:skillName funciona igual de bien ANTES de
// que exista cualquier dato de trafico para ese skill (no asume que ya
// tiene fila) — y que una carga posterior que lo mencione lo reconoce
// como ya mapeado, sin duplicar la fila de mapeo ni pisar la campana ya
// registrada.
test('registrar un SKILL_NAME nuevo por PUT (sin ninguna carga previa) queda mapeado, y una carga posterior lo reconoce sin duplicar ni sobreescribir', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const skill = 'SKILL REGISTRO PREVIO ' + Math.random().toString(36).slice(2, 6);

  // Registro de antemano, sin ningun dato de trafico todavia (el caso real
  // que motivo este formulario: registrar el skill de Aurora/Hospital La
  // Maria antes de que Wolkvox mande el primer archivo que lo mencione).
  const registro = await request(app)
    .put('/api/calidad/trafico/skills/' + encodeURIComponent(skill))
    .set(auth(admin))
    .send({ campana: 'CLINICA AURORA' });
  assert.equal(registro.status, 200, JSON.stringify(registro.body));
  assert.equal(registro.body.movidas, 0, 'no hay filas previas que reatribuir');

  const antes = await request(app).get('/api/calidad/trafico/skills').set(auth(admin));
  const filaAntes = antes.body.filter((r) => r.skillName === skill);
  assert.equal(filaAntes.length, 1, 'debe quedar exactamente una fila de mapeo, sin duplicados');
  assert.equal(filaAntes[0].campana, 'CLINICA AURORA');
  assert.equal(filaAntes[0].filas, 0, 'todavia sin trafico cargado');

  // Ahora llega una carga real que menciona ese skill -- debe resolver
  // DIRECTO a CLINICA AURORA (nunca a "(SIN ASIGNAR)").
  const carga = await request(app)
    .post('/api/calidad/trafico/carga')
    .set(auth(admin))
    .send({ filas: [fila({ skillName: skill, fecha: '2026-11-01', totalLlamadas: 20, contestadas: 18 })] });
  assert.equal(carga.status, 201, JSON.stringify(carga.body));
  assert.deepEqual(carga.body.campanas, ['CLINICA AURORA']);
  assert.deepEqual(carga.body.skillsSinAsignar, [], 'ya estaba mapeado, no debe aparecer como skill nueva sin asignar');

  const despues = await request(app).get('/api/calidad/trafico/skills').set(auth(admin));
  const filaDespues = despues.body.filter((r) => r.skillName === skill);
  assert.equal(filaDespues.length, 1, 'sigue habiendo una sola fila de mapeo (la carga no debio duplicarla)');
  assert.equal(filaDespues[0].campana, 'CLINICA AURORA', 'la carga no debio pisar el mapeo ya registrado');
  assert.equal(filaDespues[0].filas, 1);

  const aurora = await request(app)
    .get('/api/calidad/nivel-servicio/diario?campana=' + encodeURIComponent('CLINICA AURORA'))
    .set(auth(admin));
  assert.ok(aurora.body.some((r) => r.skillName === skill && r.totalLlamadas === 20));
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
