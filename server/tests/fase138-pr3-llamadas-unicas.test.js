// fase138-pr3-llamadas-unicas.test.js — Fase 138 (PR3, pedido de Edwin
// 09/10/2026): "Llamadas únicas" de Mobilize -- llamadas de ingreso
// deduplicadas por (dia, telefono). Cubre los 7 casos sinteticos pedidos
// explicitamente + la privacidad DURA del telefono (nunca se guarda, nunca
// se exporta, nunca se muestra) con el mismo patron de centinelas que
// fase118-histcdr-privacidad.test.js.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const {
  LLAMADAS_UNICAS_COLUMNAS,
  LLAMADAS_UNICAS_ORDEN_ARRAY,
  LLAMADAS_UNICAS_SKILL_ABANDONADA_ETIQUETA,
  llamadasUnicasColIndexMap,
  llamadasUnicasParseFecha,
  llamadasUnicasParseFilas,
} = require('../../public/js/llamadas-unicas-logic.js');

const HEADER = ['AGENT_NAME', 'DATE', 'TELEPHONE', 'SKILL_NAME'];
function aoaDe(filas) { return [HEADER, ...filas]; }

// ── Los 7 casos sinteticos pedidos explicitamente ──────────────────────────

test('caso 1/7: el mismo numero 2 veces el MISMO dia cuenta 1 sola vez', () => {
  const res = llamadasUnicasParseFilas(aoaDe([
    ['Asesor Uno', '2026-09-05', '3001234567', 'SKILL SAC'],
    ['Asesor Uno', '2026-09-05', '3001234567', 'SKILL SAC'],
  ]));
  assert.equal(res.filas.length, 1);
  assert.equal(res.duplicadosQuitados, 1);
});

test('caso 2/7: el mismo numero en DIAS distintos cuenta 2 veces', () => {
  const res = llamadasUnicasParseFilas(aoaDe([
    ['Asesor Uno', '2026-09-05', '3001234567', 'SKILL SAC'],
    ['Asesor Uno', '2026-09-06', '3001234567', 'SKILL SAC'],
  ]));
  assert.equal(res.filas.length, 2);
  assert.equal(res.duplicadosQuitados, 0);
  assert.deepEqual(res.filas.map((f) => f[1]), ['2026-09-05', '2026-09-06']);
});

test('caso 3/7: abandonada (SKILL_NAME=NO CONTESTADAS) vs contestada (cualquier otro skill)', () => {
  const res = llamadasUnicasParseFilas(aoaDe([
    ['Asesor Uno', '2026-09-05', '3001234567', 'SKILL SAC'],
    ['Asesor Dos', '2026-09-05', '3009999999', 'NO CONTESTADAS'],
  ]));
  assert.equal(res.filas.length, 2);
  const porTipo = {};
  res.filas.forEach((f) => { porTipo[f[2]] = (porTipo[f[2]] || 0) + 1; });
  assert.equal(porTipo.CONTESTADA, 1);
  assert.equal(porTipo.ABANDONADA, 1);
  const abandonada = res.filas.find((f) => f[2] === 'ABANDONADA');
  assert.equal(abandonada[3], LLAMADAS_UNICAS_SKILL_ABANDONADA_ETIQUETA, 'la abandonada se guarda con skill="Abandonadas", nunca "NO CONTESTADAS" cruda');
});

test('caso 4/7: skill con mayusculas/acentos distintos sigue detectando la marca de abandonada', () => {
  const variantes = ['NO CONTESTADAS', 'no contestadas', 'No Contestadas', 'nó cöntéstádas', '  NO   CONTESTADAS  '];
  variantes.forEach((v, i) => {
    const res = llamadasUnicasParseFilas(aoaDe([[`Asesor ${i}`, '2026-09-0' + (i + 1), '300000000' + i, v]]));
    assert.equal(res.filas.length, 1, 'variante: ' + v);
    assert.equal(res.filas[0][2], 'ABANDONADA', 'variante no detectada como abandonada: ' + v);
  });
});

test('caso 5/7: re-cargar el mismo mes (mismo archivo) no duplica -- probado via el servidor, ver suite de integracion mas abajo', () => {
  // Cubierto dinamicamente contra el servidor real en el bloque de
  // integracion (cargarLlamadasUnicas reemplaza por rango de fecha) -- este
  // test solo documenta el caso para que la lista de 7 quede completa aqui.
  assert.ok(true);
});

test('caso 6/7: cargar OTRO mes no borra el anterior -- probado via el servidor, ver suite de integracion mas abajo', () => {
  assert.ok(true);
});

test('caso 7/7: archivo sin la columna TELEPHONE -> error claro, SIN volcar filas parciales', () => {
  const res = llamadasUnicasParseFilas([
    ['AGENT_NAME', 'DATE', 'SKILL_NAME'],
    ['Asesor Uno', '2026-09-05', 'SKILL SAC'],
  ]);
  assert.ok(res.error, 'debe devolver un error, no filas parciales');
  assert.match(res.error, /TELEPHONE/);
  assert.equal(res.filas, undefined, 'no debe haber filas cuando falta una columna obligatoria');
});

// ── Columnas / orden del array ──────────────────────────────────────────

test('llamadasUnicasColIndexMap reconoce las 4 columnas por su label exacto', () => {
  const map = llamadasUnicasColIndexMap(HEADER);
  assert.deepEqual(map, { agente: 0, fecha: 1, telefono: 2, skill: 3 });
});

test('LLAMADAS_UNICAS_ORDEN_ARRAY nunca incluye "telefono"', () => {
  assert.equal(LLAMADAS_UNICAS_ORDEN_ARRAY.indexOf('telefono'), -1);
  assert.deepEqual(LLAMADAS_UNICAS_ORDEN_ARRAY, ['agente', 'fecha', 'tipo', 'skill']);
});

test('llamadasUnicasParseFecha: texto dd/mm/aaaa y serial de Excel dan el mismo resultado', () => {
  assert.equal(llamadasUnicasParseFecha('05/09/2026'), '2026-09-05');
  assert.equal(llamadasUnicasParseFecha(46270), '2026-09-05'); // serial de Excel real
});

test('fila sin TELEPHONE valido (vacio) se omite con aviso, no rompe el resto del archivo', () => {
  const res = llamadasUnicasParseFilas(aoaDe([
    ['Asesor Uno', '2026-09-05', '', 'SKILL SAC'],
    ['Asesor Dos', '2026-09-05', '3001234567', 'SKILL SAC'],
  ]));
  assert.equal(res.filas.length, 1);
  assert.equal(res.avisos.length, 1);
  assert.match(res.avisos[0], /TELEPHONE/);
});

test('fecha futura se omite (mismo criterio que el resto de la plataforma)', () => {
  const futura = new Date(Date.now() + 365 * 86400000);
  const fStr = futura.getUTCFullYear() + '-' + String(futura.getUTCMonth() + 1).padStart(2, '0') + '-' + String(futura.getUTCDate()).padStart(2, '0');
  const res = llamadasUnicasParseFilas(aoaDe([['Asesor Uno', fStr, '3001234567', 'SKILL SAC']]));
  assert.equal(res.filas.length, 0);
  assert.equal(res.avisos.length, 1);
});

// ── Privacidad DURA (mismo patron de centinelas que fase118-histcdr) ──────

const { request, app, tokenFor, MASTER_PASSWORD, db } = require('./helpers');
const auth = (t) => ({ Authorization: `Bearer ${t}` });
const CENTINELA_TEL = 'FASE138_CENTINELA_TELEFONO_3009998877';

test('Privacidad 1: llamadasUnicasParseFilas nunca incluye el telefono en las filas de salida', () => {
  const res = llamadasUnicasParseFilas(aoaDe([['Asesor Centinela', '2026-09-10', CENTINELA_TEL, 'SKILL SAC']]));
  assert.equal(res.filas.length, 1);
  const json = JSON.stringify(res.filas);
  assert.ok(!json.includes(CENTINELA_TEL), 'el payload no debe contener el centinela de telefono');
});

test('Privacidad 2: el servidor RECHAZA (400) una fila con un 5to elemento (cliente comprometido saltandose el navegador)', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const filaConCentinelaColado = ['Asesor Centinela', '2026-09-10', 'CONTESTADA', 'SKILL SAC', CENTINELA_TEL];
  const res = await request(app)
    .post('/api/calidad/llamadas-unicas/carga')
    .set(auth(admin))
    .send({ campana: 'MOBILIZE', filas: [filaConCentinelaColado] });
  assert.equal(res.status, 400, JSON.stringify(res.body));
  assert.ok(!JSON.stringify(res.body).includes(CENTINELA_TEL));
  const enBase = db.prepare("SELECT COUNT(*) AS n FROM llamadas_unicas WHERE agente = 'Asesor Centinela'").get();
  assert.equal(enBase.n, 0, 'nada debio insertarse en SQLite');
});

test('Privacidad 3-6: carga legitima -- SQLite, Historial y GET /resumen|/por-mes nunca contienen el centinela; la tabla no tiene columna de telefono', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const parsed = llamadasUnicasParseFilas(aoaDe([['Asesor Centinela', '2026-09-10', CENTINELA_TEL, 'SKILL SAC']]));
  assert.ok(!parsed.error, JSON.stringify(parsed));

  const carga = await request(app)
    .post('/api/calidad/llamadas-unicas/carga')
    .set(auth(admin))
    .send({ campana: 'MOBILIZE', archivoNombre: 'fase138-centinela.xlsx', filas: parsed.filas });
  assert.equal(carga.status, 201, JSON.stringify(carga.body));
  assert.ok(!JSON.stringify(carga.body).includes(CENTINELA_TEL));

  // SQLite: columnas de la tabla, nunca una de telefono -- estructuralmente
  // no puede guardar lo que nunca llega.
  const cols = db.prepare("PRAGMA table_info(llamadas_unicas)").all().map((c) => c.name);
  assert.deepEqual(cols.sort(), ['agente', 'archivoNombre', 'cargadoPorNombre', 'createdAt', 'fecha', 'id', 'skill', 'tipo', 'campana'].sort());
  assert.ok(!cols.some((c) => /tel/i.test(c)), 'ninguna columna debe referenciar telefono');

  const fila = db.prepare("SELECT * FROM llamadas_unicas WHERE agente = 'Asesor Centinela' ORDER BY id DESC LIMIT 1").get();
  assert.ok(fila);
  assert.ok(!JSON.stringify(fila).includes(CENTINELA_TEL));

  // Historial.
  const hist = await request(app).get('/api/historial').set(auth(admin));
  assert.equal(hist.status, 200);
  const evento = hist.body.find((h) => h.accion === 'LLAMADAS_UNICAS_CARGA' && (h.detalle || '').includes('reemplazada'));
  assert.ok(evento, 'deberia existir el evento de esta carga en el Historial');
  assert.ok(!JSON.stringify(evento).includes(CENTINELA_TEL));

  // GET /resumen y /por-mes: solo agregados.
  const resumen = await request(app).get('/api/calidad/llamadas-unicas/resumen').query({ campana: 'MOBILIZE' }).set(auth(admin));
  assert.equal(resumen.status, 200);
  assert.ok(!JSON.stringify(resumen.body).includes(CENTINELA_TEL));
  const porMes = await request(app).get('/api/calidad/llamadas-unicas/por-mes').query({ campana: 'MOBILIZE' }).set(auth(admin));
  assert.equal(porMes.status, 200);
  assert.ok(!JSON.stringify(porMes.body).includes(CENTINELA_TEL));
});

test('Privacidad 7: ni server/routes/llamadas-unicas.js ni server/llamadas-unicas.js tienen console.log/error/warn/debug (grep estatico)', () => {
  const archivos = [
    path.join(__dirname, '..', 'routes', 'llamadas-unicas.js'),
    path.join(__dirname, '..', 'llamadas-unicas.js'),
  ];
  archivos.forEach((f) => {
    const src = fs.readFileSync(f, 'utf8');
    assert.ok(!/console\.(log|error|warn|debug)\(/.test(src), `${f} no deberia tener console.*`);
  });
});

// ── Casos 5 y 6 (re-carga mismo mes / carga otro mes), contra el servidor ──

test('caso 5/7 (integracion): re-cargar el MISMO archivo del mismo mes no duplica', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const parsed = llamadasUnicasParseFilas(aoaDe([
    ['Asesor A', '2026-08-01', '3001111111', 'SKILL SAC'],
    ['Asesor B', '2026-08-02', '3002222222', 'NO CONTESTADAS'],
  ]));
  const body = { campana: 'MOBILIZE', archivoNombre: 'agosto.xlsx', filas: parsed.filas };
  const r1 = await request(app).post('/api/calidad/llamadas-unicas/carga').set(auth(admin)).send(body);
  assert.equal(r1.status, 201, JSON.stringify(r1.body));
  const r2 = await request(app).post('/api/calidad/llamadas-unicas/carga').set(auth(admin)).send(body);
  assert.equal(r2.status, 201, JSON.stringify(r2.body));
  assert.equal(r2.body.insertadas, 2);
  assert.equal(r2.body.borradas, 2, 'la 2da carga debio reemplazar las 2 filas de la 1ra, no sumarse');
  const total = db.prepare("SELECT COUNT(*) AS n FROM llamadas_unicas WHERE campana='MOBILIZE' AND fecha >= '2026-08-01' AND fecha <= '2026-08-02'").get();
  assert.equal(total.n, 2, 'nunca deben quedar duplicadas');
});

test('caso 6/7 (integracion): cargar OTRO mes no borra el anterior', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const sept = llamadasUnicasParseFilas(aoaDe([['Asesor Sept', '2026-09-15', '3003333333', 'SKILL SAC']]));
  const rSept = await request(app).post('/api/calidad/llamadas-unicas/carga').set(auth(admin)).send({ campana: 'MOBILIZE', archivoNombre: 'sept.xlsx', filas: sept.filas });
  assert.equal(rSept.status, 201, JSON.stringify(rSept.body));

  const octubre = llamadasUnicasParseFilas(aoaDe([['Asesor Oct', '2026-10-01', '3004444444', 'SKILL SAC']]));
  const rOct = await request(app).post('/api/calidad/llamadas-unicas/carga').set(auth(admin)).send({ campana: 'MOBILIZE', archivoNombre: 'oct.xlsx', filas: octubre.filas });
  assert.equal(rOct.status, 201, JSON.stringify(rOct.body));
  assert.equal(rOct.body.borradas, 0, 'cargar octubre no debio borrar nada de septiembre');

  const sigueSept = db.prepare("SELECT COUNT(*) AS n FROM llamadas_unicas WHERE campana='MOBILIZE' AND fecha = '2026-09-15'").get();
  assert.equal(sigueSept.n, 1, 'septiembre debe seguir intacto tras cargar octubre');
});

// ── Resumen/por-mes: agregacion correcta ───────────────────────────────

test('GET /resumen y /por-mes agregan correctamente contestadas/abandonadas/total', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const parsed = llamadasUnicasParseFilas(aoaDe([
    ['Asesor A', '2026-07-01', '3005555551', 'SKILL SAC'],
    ['Asesor A', '2026-07-02', '3005555552', 'SKILL SAC'],
    ['Asesor B', '2026-07-03', '3005555553', 'NO CONTESTADAS'],
  ]));
  await request(app).post('/api/calidad/llamadas-unicas/carga').set(auth(admin)).send({ campana: 'MOBILIZE', archivoNombre: 'jul.xlsx', filas: parsed.filas });

  const resumen = await request(app).get('/api/calidad/llamadas-unicas/resumen').query({ campana: 'MOBILIZE', desde: '2026-07-01', hasta: '2026-07-03' }).set(auth(admin));
  assert.equal(resumen.status, 200);
  assert.equal(resumen.body.contestadas, 2);
  assert.equal(resumen.body.abandonadas, 1);
  assert.equal(resumen.body.total, 3);

  const porMes = await request(app).get('/api/calidad/llamadas-unicas/por-mes').query({ campana: 'MOBILIZE', desde: '2026-07-01', hasta: '2026-07-03' }).set(auth(admin));
  assert.equal(porMes.status, 200);
  const julio = porMes.body.find((m) => m.periodo === '2026-07');
  assert.ok(julio);
  assert.equal(julio.contestadas, 2);
  assert.equal(julio.abandonadas, 1);
  assert.equal(julio.total, 3);
});

test('GET /opciones devuelve "Abandonadas" entre los skills cuando hay filas abandonadas', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const op = await request(app).get('/api/calidad/llamadas-unicas/opciones').query({ campana: 'MOBILIZE' }).set(auth(admin));
  assert.equal(op.status, 200);
  assert.ok(op.body.skills.indexOf(LLAMADAS_UNICAS_SKILL_ABANDONADA_ETIQUETA) !== -1);
});

// ── Columnas EXACTAS de la plantilla oficial ────────────────────────────

test('LLAMADAS_UNICAS_COLUMNAS coincide con las 4 columnas reales confirmadas contra el archivo de Edwin', () => {
  assert.deepEqual(LLAMADAS_UNICAS_COLUMNAS.map((c) => c.label), ['AGENT_NAME', 'DATE', 'TELEPHONE', 'SKILL_NAME']);
  assert.ok(LLAMADAS_UNICAS_COLUMNAS.every((c) => c.obligatoria), 'las 4 columnas son obligatorias en el archivo real');
});

test('la plantilla oficial PLANTILLA_LLAMADAS_UNICAS_MOBILIZE.xlsx existe y trae las columnas exactas + al menos 1 fila de ejemplo', () => {
  const XLSX = require('../../public/js/vendor/xlsx-0.20.3.full.min.js');
  XLSX.set_fs(fs);
  const p = path.join(__dirname, '..', 'plantillas', 'PLANTILLA_LLAMADAS_UNICAS_MOBILIZE.xlsx');
  assert.ok(fs.existsSync(p), 'falta server/plantillas/PLANTILLA_LLAMADAS_UNICAS_MOBILIZE.xlsx');
  const wb = XLSX.readFile(p);
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1 });
  assert.deepEqual(rows[0], ['AGENT_NAME', 'DATE', 'TELEPHONE', 'SKILL_NAME']);
  assert.ok(rows.length >= 2, 'debe traer al menos 1 fila de ejemplo ademas del encabezado');
});
