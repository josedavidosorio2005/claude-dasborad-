const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  calDashFiltrarMonitoreos,
  calDashResumen,
  calDashAsesoresDistintos,
} = require('../../public/js/calidad-dashboard-logic');

const MONITOREOS = [
  { asesor: 'Ana Gomez', fecha: '2026-06-05', puntaje: 95 },
  { asesor: 'Ana Gomez', fecha: '2026-06-20', puntaje: 60 },
  { asesor: 'Luis Ruiz', fecha: '2026-06-10', puntaje: 80 },
  { asesor: 'Luis Ruiz', fecha: '2026-07-01', puntaje: 100 },
];

test('calDashFiltrarMonitoreos: sin filtros, devuelve todo (comportamiento identico a antes del cambio)', () => {
  assert.equal(calDashFiltrarMonitoreos(MONITOREOS, {}).length, 4);
});

test('calDashFiltrarMonitoreos: filtra por asesor', () => {
  const r = calDashFiltrarMonitoreos(MONITOREOS, { asesores: ['Ana Gomez'] });
  assert.equal(r.length, 2);
  assert.ok(r.every((m) => m.asesor === 'Ana Gomez'));
});

test('calDashFiltrarMonitoreos: filtra por rango de fechas (Desde/Hasta, igual que Trafico)', () => {
  const r = calDashFiltrarMonitoreos(MONITOREOS, { desde: '2026-06-06', hasta: '2026-06-30' });
  assert.deepEqual(r.map((m) => m.fecha), ['2026-06-20', '2026-06-10']);
});

test('calDashFiltrarMonitoreos: asesor + fecha combinados', () => {
  const r = calDashFiltrarMonitoreos(MONITOREOS, { asesores: ['Luis Ruiz'], desde: '2026-07-01' });
  assert.equal(r.length, 1);
  assert.equal(r[0].puntaje, 100);
});

test('calDashResumen: replica el mismo corte 90/70 que ya usaba _gdRenderCalidad', () => {
  const r = calDashResumen(MONITOREOS);
  assert.equal(r.total, 4);
  assert.equal(r.promedio, Math.round(((95 + 60 + 80 + 100) / 4) * 10) / 10);
  assert.equal(r.sobresaliente, 2); // 95, 100
  assert.equal(r.noCritico, 1); // 80
  assert.equal(r.critico, 1); // 60
});

test('calDashResumen: sin monitoreos, no rompe y clasificacion es "—"', () => {
  const r = calDashResumen([]);
  assert.equal(r.total, 0);
  assert.equal(r.promedio, 0);
  assert.equal(r.clasificacion, '—');
});

test('calDashAsesoresDistintos: lista alfabetica sin duplicados', () => {
  assert.deepEqual(calDashAsesoresDistintos(MONITOREOS), ['Ana Gomez', 'Luis Ruiz']);
});
