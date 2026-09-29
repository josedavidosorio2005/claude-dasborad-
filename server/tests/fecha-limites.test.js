// fecha-limites.test.js — Fase 86, tema 2. Cubre las 2 implementaciones
// gemelas del limite de fecha ACEPTABLE al cargar (server/fecha-limites.js
// y public/js/fecha-limites-logic.js -- duplicadas a proposito, cada una
// para su lado del repo, ver el comentario de cabecera de cada archivo):
// una fecha posterior al ultimo dia del MES EN CURSO (hora Colombia,
// UTC-5 fijo) se rechaza -- nunca "posterior a hoy" (WhatsApp trae
// periodos cuya FECHA FIN puede ser legitimamente el fin del mes en
// curso). Una fecha anterior a 2020 es sospechosa pero NUNCA bloquea.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const servidor = require('../fecha-limites');
const cliente = require('../../public/js/fecha-limites-logic.js');

for (const [nombre, impl] of [['server/fecha-limites.js', servidor], ['public/js/fecha-limites-logic.js', cliente]]) {
  test(`${nombre}: fechaLimitesFinDeMesActual devuelve el ultimo dia del mes en curso (hora Colombia)`, () => {
    assert.equal(impl.fechaLimitesFinDeMesActual(new Date('2026-09-15T12:00:00Z')), '2026-09-30');
    assert.equal(impl.fechaLimitesFinDeMesActual(new Date('2026-08-15T12:00:00Z')), '2026-08-31');
    // Bisiesto.
    assert.equal(impl.fechaLimitesFinDeMesActual(new Date('2028-02-10T12:00:00Z')), '2028-02-29');
    assert.equal(impl.fechaLimitesFinDeMesActual(new Date('2026-02-10T12:00:00Z')), '2026-02-28');
  });

  test(`${nombre}: fechaLimitesFinDeMesActual usa hora Colombia (UTC-5), no UTC -- cerca de medianoche UTC el mes no cambia antes de tiempo`, () => {
    // 2026-09-30 23:30 UTC = 2026-09-30 18:30 Colombia -- sigue siendo Sep.
    assert.equal(impl.fechaLimitesFinDeMesActual(new Date('2026-09-30T23:30:00Z')), '2026-09-30');
    // 2026-10-01 02:30 UTC = 2026-09-30 21:30 Colombia -- todavia Sep, no Oct.
    assert.equal(impl.fechaLimitesFinDeMesActual(new Date('2026-10-01T02:30:00Z')), '2026-09-30');
    // 2026-10-01 06:00 UTC = 2026-10-01 01:00 Colombia -- ya es Oct.
    assert.equal(impl.fechaLimitesFinDeMesActual(new Date('2026-10-01T06:00:00Z')), '2026-10-31');
  });

  test(`${nombre}: fechaLimitesEsFutura -- un dia cualquiera del mes en curso (incluido el ultimo) NUNCA es futuro, nunca se usa "posterior a hoy"`, () => {
    const ahora = new Date('2026-09-15T12:00:00Z');
    assert.equal(impl.fechaLimitesEsFutura('2026-09-01', ahora), false);
    assert.equal(impl.fechaLimitesEsFutura('2026-09-15', ahora), false);
    // El ultimo dia del mes (posterior a "hoy" 09-15, pero NO al mes en curso).
    assert.equal(impl.fechaLimitesEsFutura('2026-09-30', ahora), false);
  });

  test(`${nombre}: fechaLimitesEsFutura -- cualquier dia del mes siguiente en adelante SI es futuro`, () => {
    const ahora = new Date('2026-09-15T12:00:00Z');
    assert.equal(impl.fechaLimitesEsFutura('2026-10-01', ahora), true);
    assert.equal(impl.fechaLimitesEsFutura('2030-06-01', ahora), true, 'el hallazgo real de la Fase 85 (fila suelta 2030-06)');
  });

  test(`${nombre}: fechaLimitesEsFutura -- fechas pasadas nunca son futuras`, () => {
    const ahora = new Date('2026-09-15T12:00:00Z');
    assert.equal(impl.fechaLimitesEsFutura('2020-01-01', ahora), false);
    assert.equal(impl.fechaLimitesEsFutura('2026-08-31', ahora), false);
  });
}

test('server/fecha-limites.js: fechaLimitesRangoDeMes devuelve el primer y ultimo dia del mes, incluidos meses de 28/29/30/31 dias', () => {
  assert.deepEqual(servidor.fechaLimitesRangoDeMes('2025-02'), { desde: '2025-02-01', hasta: '2025-02-28' });
  assert.deepEqual(servidor.fechaLimitesRangoDeMes('2028-02'), { desde: '2028-02-01', hasta: '2028-02-29' }, 'bisiesto');
  assert.deepEqual(servidor.fechaLimitesRangoDeMes('2025-04'), { desde: '2025-04-01', hasta: '2025-04-30' });
  assert.deepEqual(servidor.fechaLimitesRangoDeMes('2025-01'), { desde: '2025-01-01', hasta: '2025-01-31' });
});

test('public/js/fecha-limites-logic.js: fechaLimitesEsSospechosaAntigua marca fechas anteriores a 2020 (sin bloquear -- eso lo decide quien llama)', () => {
  assert.equal(cliente.fechaLimitesEsSospechosaAntigua('2019-12-31'), true);
  assert.equal(cliente.fechaLimitesEsSospechosaAntigua('2020-01-01'), false);
  assert.equal(cliente.fechaLimitesEsSospechosaAntigua('2026-09-15'), false);
});

test('public/js/fecha-limites-logic.js: fechaLimitesRecortar nunca deja pasar una fecha futura -- es la base de "la ventana por defecto nunca pasa del mes actual" (trafico.js/trafico-whatsapp.js/agendas.js/tipificacion.js/dashboard-generic.js la llaman sobre el maximo de fecha disponible)', () => {
  const ahora = new Date('2026-09-15T12:00:00Z');
  // El hallazgo real de la Fase 85: una fila suelta 2030-06 no debe arrastrar
  // la ventana -- se recorta al fin del mes en curso.
  assert.equal(cliente.fechaLimitesRecortar('2030-06-01', ahora), '2026-09-30');
  // Una fecha ya dentro del mes en curso (o anterior) no se toca.
  assert.equal(cliente.fechaLimitesRecortar('2026-09-10', ahora), '2026-09-10');
  assert.equal(cliente.fechaLimitesRecortar('2026-08-31', ahora), '2026-08-31');
});
