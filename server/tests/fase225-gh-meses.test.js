// fase225-gh-meses.test.js — Fase 225 (revision del 3-nov): el flujo mensual
// de Gestion Humana conserva los ULTIMOS 60 meses. Antes el tope contaba
// desde el primer ingreso: con alguien que ingreso hace mas de 5 anos, el
// flujo terminaba antes del mes actual.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { db } = require('./helpers');
const { ADAPTERS, listarMeses } = require('../dashboard-adapters');
const { fechaLimitesHoyColombia } = require('../fecha-limites');

test('listarMeses: los ultimos 60 meses hasta el final, sin perder los recientes', () => {
  const a = listarMeses('2019-01', '2026-11');
  assert.equal(a.length, 60);
  assert.equal(a[0], '2021-12');
  assert.equal(a[59], '2026-11');
  assert.deepEqual(listarMeses('2026-09', '2026-11'), ['2026-09', '2026-10', '2026-11']);
  assert.deepEqual(listarMeses('2026-11', '2026-11'), ['2026-11']);
  assert.deepEqual(listarMeses('2026-12', '2026-11'), []);
  assert.equal(listarMeses('1990-01', '2026-11').length, 60, 'nunca da mas de 60 vueltas');
});

test('una persona que ingreso hace 7 anos y otra este mes: el flujo incluye el mes actual', () => {
  const hoy = fechaLimitesHoyColombia();
  const mesHoy = hoy.slice(0, 7);
  const hace7 = (Number(hoy.slice(0, 4)) - 7) + hoy.slice(4, 8) + '01';
  const ins = db.prepare(
    `INSERT INTO gestion_humana_personal (nombre, campana, fecha_ingreso, costo_hora, horas_mes, createdAt, updatedAt)
     VALUES (?, 'General', ?, 0, 192, ?, ?)`
  );
  const ahora = new Date().toISOString();
  ins.run('Persona antigua (prueba)', hace7, ahora, ahora);
  ins.run('Persona nueva (prueba)', mesHoy + '-01', ahora, ahora);

  const r = ADAPTERS.GESTION_HUMANA.build(db);
  const periodos = r.flujo_mes.map((x) => x.periodo);
  assert.equal(periodos.length, 60);
  assert.equal(periodos[periodos.length - 1], mesHoy, 'el ultimo mes del flujo es el actual');
  assert.ok(r.flujo_mes[r.flujo_mes.length - 1].filas[0].ingresos >= 1, 'el ingreso de este mes cuenta');
  assert.equal(r.resumen[0].periodo, mesHoy);
  assert.ok(r.resumen[0].filas[0].ingresos_mes >= 1, 'la tarjeta de ingresos del mes ya no queda en 0');
});
