// fase146-ata-cero-sin-abandonos.test.js — Fase 146 (decision de Edwin,
// 14/10/2026): si un periodo (o un punto de la grafica) HAY datos pero 0
// llamadas abandonadas, ATA vale 0 (0:00) en la tarjeta, la grafica y la
// exportacion -- antes salia "—" (null). Sin datos, sigue null (el aviso de
// "sin datos" de siempre). Con abandonos, el promedio ponderado de siempre.
'use strict';

const fs = require('fs');
const path = require('path');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { traficoAgregar, traficoAtaPromedioPeriodo, traficoAtaCeroSinAbandonos } = require('../../public/js/trafico-logic.js');
const { traficoWppAgregarPorPeriodo } = require('../../public/js/trafico-whatsapp-logic.js');

const fila = (fecha, o) => Object.assign({ fecha, skillName: 'MOBILIZE INBOUND', totalLlamadas: 100, contestadas: 100, llamadasAbandonadas: 0, asaSegundos: 5, ataSegundos: 0, ahtSegundos: 300 }, o);

test('Llamadas: con datos y 0 abandonos, ATA = 0 (no null) en el agregado del mes y en cada dia', () => {
  const filas = [fila('2026-09-01'), fila('2026-09-02'), fila('2026-09-03', { ataSegundos: null })];
  const mes = traficoAgregar(filas, { granularidad: 'mes', combinar: true });
  assert.equal(mes.length, 1);
  assert.equal(mes[0].ataSegundos, 0, 'mes: 0:00, no "—"');
  assert.equal(mes[0].llamadasAbandonadas, 0);
  const dias = traficoAgregar(filas, { granularidad: 'dia', combinar: true });
  assert.deepEqual(dias.map((d) => d.ataSegundos), [0, 0, 0], 'cada punto de la grafica en 0, sin huecos');
  // ASA y AHT no cambian
  assert.equal(mes[0].asaSegundos, 5);
  assert.equal(mes[0].ahtSegundos, 300);
});

test('Llamadas: con abandonos, el promedio ponderado por abandonadas de siempre', () => {
  const filas = [
    fila('2026-08-01', { llamadasAbandonadas: 10, ataSegundos: 30, contestadas: 90 }),
    fila('2026-08-02', { llamadasAbandonadas: 30, ataSegundos: 70, contestadas: 70 }),
  ];
  const mes = traficoAgregar(filas, { granularidad: 'mes', combinar: true });
  assert.equal(mes[0].ataSegundos, 60, '(10*30 + 30*70) / 40 = 60');
  assert.equal(traficoAtaPromedioPeriodo(filas), 60, 'la tarjeta da lo mismo que la grafica');
  // un dia con abandonos y otro sin: el sin abandonos no pesa
  const mixto = [fila('2026-08-01', { llamadasAbandonadas: 4, ataSegundos: 50 }), fila('2026-08-02')];
  assert.equal(traficoAgregar(mixto, { granularidad: 'mes', combinar: true })[0].ataSegundos, 50);
  assert.deepEqual(traficoAgregar(mixto, { granularidad: 'dia', combinar: true }).map((d) => d.ataSegundos), [50, 0]);
});

test('sin datos del periodo: ATA sigue en null (aviso "sin datos"), nunca 0', () => {
  assert.equal(traficoAtaPromedioPeriodo([]), null);
  assert.deepEqual(traficoAgregar([], { granularidad: 'mes', combinar: true }), []);
  assert.equal(traficoAtaCeroSinAbandonos({ total: 0, abandonadas: 0 }), false, 'total 0 = no hay datos');
});

test('tarjeta (traficoAtaPromedioPeriodo): 0 abandonos -> 0; columna de abandonadas ausente -> 0 solo si el ATA reportado es 0', () => {
  assert.equal(traficoAtaPromedioPeriodo([fila('2026-09-01'), fila('2026-09-02')]), 0);
  assert.equal(traficoAtaPromedioPeriodo([fila('2026-09-01', { llamadasAbandonadas: null, ataSegundos: 0 })]), 0);
  assert.equal(traficoAtaPromedioPeriodo([fila('2026-09-01', { llamadasAbandonadas: null, ataSegundos: 45 })]), null,
    'sin abandonadas reportadas y con un ATA real distinto de 0 no se inventa un 0');
  assert.equal(traficoAtaPromedioPeriodo([fila('2026-09-01', { llamadasAbandonadas: null, ataSegundos: null })]), null,
    'sin abandonadas ni ATA reportados: no hay dato');
});

test('WhatsApp (ORLANT): misma regla en su agregado', () => {
  const filasW = [
    { fechaInicio: '2026-09-01', colaWhatsapp: 'WHATSAPP X', totalWhatsapp: 50, contestados: 50, abandonados: 0, ataSegundos: null },
    { fechaInicio: '2026-09-02', colaWhatsapp: 'WHATSAPP X', totalWhatsapp: 40, contestados: 40, abandonados: 0, ataSegundos: null },
  ];
  const mes = traficoWppAgregarPorPeriodo(filasW, { granularidad: 'mes', combinar: true });
  assert.equal(mes[0].ataSegundos, 0);
  const conAband = [{ fechaInicio: '2026-09-01', colaWhatsapp: 'WHATSAPP X', totalWhatsapp: 50, contestados: 40, abandonados: 10, ataSegundos: 120 }];
  assert.equal(traficoWppAgregarPorPeriodo(conAband, { granularidad: 'mes', combinar: true })[0].ataSegundos, 120);
});

test('la exportacion (Excel/PDF) toma ataSegundos del mismo agregado -> 0 sale como 0', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'trafico.js'), 'utf8');
  assert.match(src, /'ATA \(seg\)': a\.ataSegundos/);
  assert.match(src, /var ataProm = traficoAtaPromedioPeriodo\(filtradas\);/);
});
