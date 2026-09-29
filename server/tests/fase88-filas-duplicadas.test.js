// fase88-filas-duplicadas.test.js — Fase 88 (hallazgo real del barrido).
//
// cargarAgendas/cargarTipificaciones reemplazan por PERIODO (borran el
// rango del archivo, insertan todo de nuevo) -- eso evita duplicar al
// volver a SUBIR EL MISMO archivo dos veces, pero nunca revisaba si el
// archivo en si traia dos filas EXACTAMENTE iguales: las dos se
// insertaban, inflando el conteo en silencio.
//
// Regla pedida explicitamente: solo se quitan filas IDENTICAS en TODAS
// las columnas (incluida fecha y hora con segundos) -- nunca "casi
// iguales" (2 citas reales del mismo asesor el mismo dia con datos
// distintos siguen siendo 2 filas). Se avisa cuantas se quitaron -- el
// aviso llega a la vista previa de carga (cargas.js, #carga-errores)
// ANTES de que la persona confirme, para que pueda cancelar si no esta
// de acuerdo.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { quitarDuplicadosExactos } = require('../../public/js/duplicados-exactos-logic.js');
const { agendasParseFilas, AGENDAS_COLUMNAS } = require('../../public/js/agendas-logic.js');
const { tipificacionParseFilas } = require('../../public/js/tipificacion-logic.js');

// ── quitarDuplicadosExactos (pura) ──────────────────────────────────────
test('quitarDuplicadosExactos: 2 filas identicas en TODAS las columnas -> se queda con 1', () => {
  const filas = [{ a: 1, b: 'x' }, { a: 1, b: 'x' }];
  const r = quitarDuplicadosExactos(filas);
  assert.equal(r.filas.length, 1);
  assert.equal(r.quitadas, 1);
});

test('quitarDuplicadosExactos: filas que difieren en UN SOLO campo NO se quitan (nunca "casi iguales")', () => {
  const filas = [
    { asesor: 'JUAN', fechaSolicitud: '2025-04-15 10:00:00', especialidad: 'AUDIOLOGIA' },
    { asesor: 'JUAN', fechaSolicitud: '2025-04-15 10:00:01', especialidad: 'AUDIOLOGIA' }, // 1 segundo distinto
  ];
  const r = quitarDuplicadosExactos(filas);
  assert.equal(r.filas.length, 2, 'un segundo de diferencia en la hora ya es una fila DISTINTA, no un duplicado');
  assert.equal(r.quitadas, 0);
});

test('quitarDuplicadosExactos: sin duplicados -> nada cambia, quitadas=0', () => {
  const filas = [{ a: 1 }, { a: 2 }, { a: 3 }];
  const r = quitarDuplicadosExactos(filas);
  assert.equal(r.filas.length, 3);
  assert.equal(r.quitadas, 0);
});

test('quitarDuplicadosExactos: 3 copias exactas de la misma fila -> se queda con 1, quitadas=2', () => {
  const filas = [{ a: 1, b: 2 }, { a: 1, b: 2 }, { a: 1, b: 2 }];
  const r = quitarDuplicadosExactos(filas);
  assert.equal(r.filas.length, 1);
  assert.equal(r.quitadas, 2);
});

test('quitarDuplicadosExactos: el orden de las llaves del objeto no importa (misma fila armada en distinto orden)', () => {
  const filas = [{ a: 1, b: 2 }, { b: 2, a: 1 }];
  const r = quitarDuplicadosExactos(filas);
  assert.equal(r.filas.length, 1, 'son la MISMA fila, solo con las propiedades en otro orden');
});

// ── Integracion: agendasParseFilas ──────────────────────────────────────
function aoaAgendas(filas) {
  const encabezado = AGENDAS_COLUMNAS.map((c) => c.label);
  return [encabezado, ...filas];
}

test('agendasParseFilas: 2 filas EXACTAMENTE iguales (incluida hora) -> se queda con 1, con aviso explicito', () => {
  // 5 filas mas con la misma entidad para que la privacidad NO agrupe (umbral >=5) y no interfiera con el dedup.
  const filaBase = ['ASESOR X', 'SEDE CENTRO', 'AUDIOMETRIA', 'AUDIOLOGIA', 'DR PEREZ', '2025-04-15 10:00:00', 'GENERAL', 'EPS REPETIDA'];
  const relleno = Array.from({ length: 5 }, (_, i) => ['OTRO ASESOR', 'SEDE CENTRO', 'AUDIOMETRIA', 'AUDIOLOGIA', 'DR PEREZ', '2025-04-1' + i + ' 09:00:00', 'GENERAL', 'EPS REPETIDA']);
  const aoa = aoaAgendas([filaBase, filaBase, ...relleno]);
  const r = agendasParseFilas(aoa);
  assert.ok(!r.error, JSON.stringify(r));
  const deAsesorX = r.filas.filter((f) => f.asesor === 'ASESOR X');
  assert.equal(deAsesorX.length, 1, 'la fila EXACTA repetida 2 veces en el archivo debe quedar solo 1 vez');
  assert.ok(r.avisos.some((a) => /1 fila\(s\) exactamente duplicada/.test(a)), 'debe avisar cuantas se quitaron: ' + JSON.stringify(r.avisos));
});

test('agendasParseFilas: 2 citas del MISMO asesor el MISMO dia pero con especialidad distinta -> NUNCA se quitan (no son duplicados)', () => {
  const relleno = Array.from({ length: 5 }, (_, i) => ['OTRO ASESOR', 'SEDE CENTRO', 'AUDIOMETRIA', 'AUDIOLOGIA', 'DR PEREZ', '2025-04-1' + i + ' 09:00:00', 'GENERAL', 'EPS REPETIDA']);
  const aoa = aoaAgendas([
    ['ASESOR Y', 'SEDE CENTRO', 'AUDIOMETRIA', 'AUDIOLOGIA', 'DR PEREZ', '2025-04-15 10:00:00', 'GENERAL', 'EPS REPETIDA'],
    ['ASESOR Y', 'SEDE CENTRO', 'AUDIOMETRIA', 'OTORRINOLARINGOLOGIA', 'DR PEREZ', '2025-04-15 10:00:00', 'GENERAL', 'EPS REPETIDA'],
    ...relleno,
  ]);
  const r = agendasParseFilas(aoa);
  assert.ok(!r.error, JSON.stringify(r));
  const deAsesorY = r.filas.filter((f) => f.asesor === 'ASESOR Y');
  assert.equal(deAsesorY.length, 2, 'especialidad distinta -> 2 citas reales, ninguna se quita');
});

// ── Integracion: tipificacionParseFilas ─────────────────────────────────
function aoaTipif(filas) {
  return [['AGENT_NAME', 'DATE', 'HORA', 'TIME_MIN', 'DESCRIPTION_COD_ACT', 'SKILL_NAME'], ...filas];
}

test('tipificacionParseFilas: 2 filas EXACTAMENTE iguales (incluida hora) -> se queda con 1, con aviso explicito', () => {
  const filaBase = ['ASESOR X', '2025-04-15', '18:06:08', 3, 'AGENDADA', 'LLAMADAS DE SALIDA'];
  const aoa = aoaTipif([filaBase, filaBase]);
  const r = tipificacionParseFilas(aoa);
  assert.ok(!r.error, JSON.stringify(r));
  assert.equal(r.filas.length, 1);
  assert.ok(r.avisos.some((a) => /1 fila\(s\) exactamente duplicada/.test(a)), JSON.stringify(r.avisos));
});

test('tipificacionParseFilas: mismo agente/fecha pero HORA distinta (1 segundo) -> NUNCA se quita', () => {
  const aoa = aoaTipif([
    ['ASESOR Z', '2025-04-15', '18:06:08', 3, 'AGENDADA', 'LLAMADAS DE SALIDA'],
    ['ASESOR Z', '2025-04-15', '18:06:09', 3, 'AGENDADA', 'LLAMADAS DE SALIDA'],
  ]);
  const r = tipificacionParseFilas(aoa);
  assert.ok(!r.error, JSON.stringify(r));
  assert.equal(r.filas.length, 2, 'un segundo de diferencia en HORA ya es una fila distinta');
});

test('tipificacionParseFilas: mismo agente/fecha/hora pero TIPIFICACION distinta -> NUNCA se quita', () => {
  const aoa = aoaTipif([
    ['ASESOR W', '2025-04-15', '18:06:08', 3, 'AGENDADA', 'LLAMADAS DE SALIDA'],
    ['ASESOR W', '2025-04-15', '18:06:08', 3, 'NO INTERESADO', 'LLAMADAS DE SALIDA'],
  ]);
  const r = tipificacionParseFilas(aoa);
  assert.ok(!r.error, JSON.stringify(r));
  assert.equal(r.filas.length, 2);
});
