const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  calDashFiltrarMonitoreos,
  calDashResumen,
  calDashAsesoresDistintos,
  calDashPromedioPorAsesor,
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

// Fase 130 (pedido de Edwin, vista de Calidad): promedio por asesor para la
// barra horizontal "nombre + %". Asesores ficticios, incluye uno con UN SOLO
// monitoreo (caso de borde explicito pedido por el usuario) -- esta prueba
// no existia antes de esta fase: sin calDashPromedioPorAsesor definida,
// fallaria con "calDashPromedioPorAsesor is not a function"; con la funcion
// real, pasa con los valores exactos de abajo.
test('calDashPromedioPorAsesor: promedia por asesor y ordena de mayor a menor', () => {
  const r = calDashPromedioPorAsesor(MONITOREOS);
  assert.deepEqual(r, [
    { asesor: 'Luis Ruiz', promedio: 90 }, // (80+100)/2
    { asesor: 'Ana Gomez', promedio: 77.5 }, // (95+60)/2
  ]);
});

test('calDashPromedioPorAsesor: un asesor con UN SOLO monitoreo -- el promedio es ese mismo valor, no se rompe', () => {
  const unico = [{ asesor: 'Carla Soto', fecha: '2026-06-01', puntaje: 88 }];
  const r = calDashPromedioPorAsesor(unico);
  assert.deepEqual(r, [{ asesor: 'Carla Soto', promedio: 88 }]);
});

test('calDashPromedioPorAsesor: mezcla de asesores con 1 y con varios monitoreos a la vez', () => {
  const mezcla = MONITOREOS.concat([{ asesor: 'Carla Soto', fecha: '2026-06-01', puntaje: 88 }]);
  const r = calDashPromedioPorAsesor(mezcla);
  assert.equal(r.length, 3);
  const porNombre = {};
  r.forEach((x) => { porNombre[x.asesor] = x.promedio; });
  assert.equal(porNombre['Carla Soto'], 88);
  assert.equal(porNombre['Luis Ruiz'], 90);
  assert.equal(porNombre['Ana Gomez'], 77.5);
});

test('calDashPromedioPorAsesor: redondea a 1 decimal (mismo criterio que calDashResumen)', () => {
  const r = calDashPromedioPorAsesor([
    { asesor: 'Diego Paz', fecha: '2026-06-01', puntaje: 70 },
    { asesor: 'Diego Paz', fecha: '2026-06-02', puntaje: 71 },
    { asesor: 'Diego Paz', fecha: '2026-06-03', puntaje: 71 },
  ]);
  assert.deepEqual(r, [{ asesor: 'Diego Paz', promedio: 70.7 }]); // 212/3 = 70.666... -> 70.7
});

test('calDashPromedioPorAsesor: sin monitoreos, devuelve lista vacia', () => {
  assert.deepEqual(calDashPromedioPorAsesor([]), []);
});

test('calDashPromedioPorAsesor: el resultado NUNCA trae el numero de monitoreos (ninguna llave de conteo)', () => {
  const r = calDashPromedioPorAsesor(MONITOREOS);
  r.forEach((x) => {
    assert.deepEqual(Object.keys(x).sort(), ['asesor', 'promedio']);
  });
});
