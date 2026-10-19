// fase155-calculo-nivel-abandono.test.js — Fase 155 (pedido de Edwin, 19/10):
// en Flujo de Llamadas, nivel de atencion y tasa de abandono los calcula el
// sistema (suma / suma), ignorando los % que traiga el archivo; ingresadas
// = 0 -> sin dato. Y el nivel de atencion no tiene meta ni semaforo.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const XLSX = require('../../public/js/vendor/xlsx-0.20.3.full.min.js');
const T = require('../../public/js/trafico-logic.js');
const S = require('../../public/js/semaforo-logic.js');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');
const { pctAtencionAbandono } = require('../nivel-servicio-diario');

const auth = (t) => ({ Authorization: `Bearer ${t}` });

function parsear(aoa) {
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  return T.traficoParseFilas(XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true }), ws);
}

test('lector: ignora NIVEL DE ATENCION / % ABANDONO del archivo y los calcula', () => {
  // Como el reporte de Mobilize: el archivo dice 100 % y 0 %, pero los conteos dicen otra cosa.
  const r = parsear([
    ['TIPO DE LINEA', 'DÍA', 'LLAMADAS INGRESADAS', 'LLAMADAS CONTESTADAS', 'LLAMADAS ABANDONADAS', 'NIVEL DE ATENCION', '% ABANDONO'],
    ['LINEA A', '2026-08-01', 100, 80, 20, 1, 0],
    ['LINEA A', '2026-08-02', 0, 0, 0, 1, 0],
  ]);
  assert.ifError(r.error);
  assert.equal(r.filas[0].nivelAtencionPct, 80);
  assert.equal(r.filas[0].tasaAbandonoPct, 20);
  // ingresadas = 0: sin dato (nunca 100 % ni 0 %)
  assert.equal(r.filas[1].nivelAtencionPct, undefined);
  assert.equal(r.filas[1].tasaAbandonoPct, undefined);
  assert.ok(!r.avisos.some((a) => /NIVEL DE ATENCION|ABANDONO/.test(a)), 'sin avisos de esas columnas');
});

test('lector: sin columna de abandonadas, la tasa es (ingresadas - contestadas) / ingresadas', () => {
  const r = parsear([
    ['SKILL_NAME', 'DATE', 'TOTAL LLAMADAS', 'LLAMADAS CONTESTADAS'],
    ['SKILL X', '2026-08-01', 200, 150],
  ]);
  assert.equal(r.filas[0].nivelAtencionPct, 75);
  assert.equal(r.filas[0].tasaAbandonoPct, 25);
});

test('agregado del mes: suma / suma, nunca promedio de %', () => {
  const filas = [
    { fecha: '2026-08-01', skillName: 'A', totalLlamadas: 100, contestadas: 90, llamadasAbandonadas: 10 },
    { fecha: '2026-08-02', skillName: 'A', totalLlamadas: 10, contestadas: 1, llamadasAbandonadas: 9 },
    { fecha: '2026-08-03', skillName: 'B', totalLlamadas: 40, contestadas: 30 }, // sin abandonadas -> 10
    { fecha: '2026-08-04', skillName: 'B', totalLlamadas: 0, contestadas: 0 },
  ];
  const [mes] = T.traficoAgregar(filas, { granularidad: 'mes', combinar: true });
  // 121 / 150 = 80,67 % (promedio de % daria (90+10+75)/3 = 58,33)
  assert.equal(mes.nivelAtencionPct, 80.67);
  // (10 + 9 + 10) / 150 = 19,33 %
  assert.equal(mes.tasaAbandonoPct, 19.33);
  const [vacio] = T.traficoAgregar([filas[3]], { granularidad: 'mes', combinar: true });
  assert.equal(vacio.nivelAtencionPct, null);
  assert.equal(vacio.tasaAbandonoPct, null);
});

test('servidor y navegador usan la misma formula', () => {
  const casos = [[100, 80, 20], [100, 80, null], [0, 0, 0], [7, 3, null], [3, 3, 0], [1000, 999, 1]];
  for (const [t, c, a] of casos) {
    assert.deepEqual(pctAtencionAbandono(t, c, a), T.traficoPctAtencionAbandono(t, c, a), `caso ${t}/${c}/${a}`);
  }
});

test('POST /calidad/trafico/carga: lo guardado lo calcula el servidor, no lo que manda el navegador', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const skill = 'F155 SKILL ' + Math.random().toString(36).slice(2, 8);
  const res = await request(app).post('/api/calidad/trafico/carga').set(auth(admin)).send({
    filas: [
      { fecha: '2026-07-01', skillName: skill, totalLlamadas: 100, contestadas: 90, llamadasAbandonadas: 10, nivelAtencionPct: 100, tasaAbandonoPct: 0 },
      { fecha: '2026-07-02', skillName: skill, totalLlamadas: 50, contestadas: 40, nivelAtencionPct: 100 },
      { fecha: '2026-07-03', skillName: skill, totalLlamadas: 0, contestadas: 0, nivelAtencionPct: 100, tasaAbandonoPct: 0 },
    ],
  });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  const rows = db.prepare('SELECT fecha, nivelAtencionPct, tasaAbandonoPct FROM calidad_nivel_servicio_diario WHERE skillName = ? ORDER BY fecha').all(skill);
  assert.deepEqual(rows.map((r) => [r.nivelAtencionPct, r.tasaAbandonoPct]), [[90, 10], [80, 20], [null, null]]);
});

test('migracion: recalcula las filas viejas y es idempotente', () => {
  const skill = 'F155 MIG ' + Math.random().toString(36).slice(2, 8);
  const ins = db.prepare(`INSERT INTO calidad_nivel_servicio_diario (campana, fecha, skillName, totalLlamadas, contestadas, llamadasAbandonadas, nivelAtencionPct, tasaAbandonoPct, archivoNombre, cargadoPorNombre, createdAt)
    VALUES ('F155', ?, ?, ?, ?, ?, ?, ?, 'x', 'x', 'x')`);
  ins.run('2026-06-01', skill, 104, 104, null, 100, 0);
  ins.run('2026-06-02', skill, 0, 0, 0, 100, 0);
  ins.run('2026-06-03', skill, 10, 6, 3, 100, 0);
  const { recalcularPctAtencionAbandono } = require('../db');
  recalcularPctAtencionAbandono();
  recalcularPctAtencionAbandono();
  const rows = db.prepare('SELECT nivelAtencionPct n, tasaAbandonoPct t FROM calidad_nivel_servicio_diario WHERE skillName = ? ORDER BY fecha').all(skill);
  assert.deepEqual(rows.map((r) => [r.n, r.t]), [[100, 0], [null, null], [60, 30]]);
});

test('nivel de atencion: sin meta ni semaforo aunque haya umbral; la tasa de abandono sigue con el suyo', () => {
  const umbrales = [
    { metrica: 'nivel_atencion', campana: '', verde: 90, amarillo: 70, direccion: 'mayor_es_mejor' },
    { metrica: 'nivel_atencion', campana: 'MOBILIZE', verde: 95, amarillo: 80, direccion: 'mayor_es_mejor' },
    { metrica: 'tasa_abandono', campana: '', verde: 5, amarillo: 10, direccion: 'menor_es_mejor' },
  ];
  assert.equal(S.semaforoUmbralPara(umbrales, 'nivel_atencion', 'MOBILIZE'), null);
  assert.equal(S.semaforoUmbralPara(umbrales, 'nivel_atencion', 'ORLANT'), null);
  assert.equal(S.semaforoColorDe(100, S.semaforoUmbralPara(umbrales, 'nivel_atencion', 'MOBILIZE')), null);
  assert.equal(S.semaforoUmbralPara(umbrales, 'tasa_abandono', 'ORLANT').verde, 5);
});
