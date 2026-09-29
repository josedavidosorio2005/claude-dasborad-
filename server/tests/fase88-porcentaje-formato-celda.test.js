// fase88-porcentaje-formato-celda.test.js — Fase 88 (hallazgo real del
// barrido: 0.86 en vez de 86.49 si SERVICE_LEVEL_* llega como celda
// numerica nativa de Excel con formato de porcentaje).
//
// Regla pedida explicitamente (NUNCA "si es <=1, multiplicar x100" --
// un 0,56% escrito como texto "0.56" terminaria mal en 56%):
//  - Celda de TEXTO ("86.49 %", "93.55%", "86.49"): SIN CAMBIOS, el mismo
//    camino de regex de siempre. Es el caso real de produccion (agosto,
//    "93.55 %" como texto).
//  - Celda NUMERICA con formato de porcentaje real de Excel (z contiene
//    "%"): SI se multiplica x100 (el valor guardado es la fraccion).
//  - Celda NUMERICA SIN formato de porcentaje: se deja tal cual (nunca se
//    adivina por el valor solo).
//  - Si TODA una columna de celdas numericas sin formato tiene valores
//    <=1, se avisa (una vez por columna) en vez de adivinar -- el valor
//    parseado no cambia.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  TRAFICO_COLUMNAS,
  traficoCeldaRef,
  traficoClasificarCeldaNumerica,
  traficoPctDesdeTexto,
  traficoParseFilas,
} = require('../../public/js/trafico-logic.js');
const {
  TRAFICO_WPP_COLUMNAS,
  traficoWppParseFilas,
} = require('../../public/js/trafico-whatsapp-logic.js');

// ── traficoCeldaRef ──────────────────────────────────────────────────────
test('traficoCeldaRef: referencia A1 estandar (fila/col 0-based -> A1, B1, Z1, AA1)', () => {
  assert.equal(traficoCeldaRef(0, 0), 'A1');
  assert.equal(traficoCeldaRef(0, 1), 'B1');
  assert.equal(traficoCeldaRef(0, 25), 'Z1');
  assert.equal(traficoCeldaRef(0, 26), 'AA1');
  assert.equal(traficoCeldaRef(4, 0), 'A5');
});

// ── traficoClasificarCeldaNumerica ───────────────────────────────────────
test('traficoClasificarCeldaNumerica: numerica con formato % -> "porcentaje"', () => {
  const ws = { A2: { t: 'n', v: 0.8649, z: '0.00%' } };
  assert.equal(traficoClasificarCeldaNumerica(ws, 1, 0), 'porcentaje');
});
test('traficoClasificarCeldaNumerica: numerica SIN formato % -> "numero"', () => {
  const ws = { A2: { t: 'n', v: 86.49, z: 'General' } };
  assert.equal(traficoClasificarCeldaNumerica(ws, 1, 0), 'numero');
  const wsSinZ = { A2: { t: 'n', v: 86.49 } };
  assert.equal(traficoClasificarCeldaNumerica(wsSinZ, 1, 0), 'numero');
});
test('traficoClasificarCeldaNumerica: celda de texto, vacia, o sin ws -> null', () => {
  assert.equal(traficoClasificarCeldaNumerica({ A2: { t: 's', v: '86.49 %' } }, 1, 0), null);
  assert.equal(traficoClasificarCeldaNumerica({}, 1, 0), null);
  assert.equal(traficoClasificarCeldaNumerica(null, 1, 0), null);
});

// ── traficoPctDesdeTexto(v, clasificacion) ───────────────────────────────
test('traficoPctDesdeTexto: celda de TEXTO -- SIN CAMBIOS, cualquiera sea `clasificacion` (caso real de produccion, agosto "93.55 %")', () => {
  assert.equal(traficoPctDesdeTexto('93.55 %'), 93.55);
  assert.equal(traficoPctDesdeTexto('93.55 %', 'porcentaje'), 93.55, 'un texto nunca se reinterpreta aunque venga con clasificacion');
  assert.equal(traficoPctDesdeTexto('93.55 %', 'numero'), 93.55);
  assert.equal(traficoPctDesdeTexto('86.49'), 86.49);
});
test('traficoPctDesdeTexto: NUMERO con clasificacion "porcentaje" -> x100 (fraccion real de Excel)', () => {
  assert.equal(traficoPctDesdeTexto(0.8649, 'porcentaje'), 86.49);
  assert.equal(traficoPctDesdeTexto(0.0056, 'porcentaje'), 0.56, 'un 0.56% real tambien se recupera bien');
  assert.equal(traficoPctDesdeTexto(1, 'porcentaje'), 100);
});
test('traficoPctDesdeTexto: NUMERO con clasificacion "numero" (o sin clasificacion) -- NUNCA se adivina, se deja tal cual', () => {
  assert.equal(traficoPctDesdeTexto(0.56, 'numero'), 0.56, 'nunca se multiplica x100 por el solo hecho de ser <=1');
  assert.equal(traficoPctDesdeTexto(87, 'numero'), 87);
  assert.equal(traficoPctDesdeTexto(0.56), 0.56, 'sin clasificacion (llamador viejo) -- mismo comportamiento de siempre');
  assert.equal(traficoPctDesdeTexto(87), 87);
});

// ── traficoParseFilas: integracion con `ws` ──────────────────────────────
const HEADER = TRAFICO_COLUMNAS.map((c) => c.label);
const IDX = {};
TRAFICO_COLUMNAS.forEach((c, i) => { IDX[c.key] = i; });

function filaBase(over) {
  const row = new Array(HEADER.length).fill(null);
  row[IDX.skillName] = 'CALL INBOUND ORLANT 3P';
  row[IDX.fecha] = '2026-08-15';
  row[IDX.totalLlamadas] = 100;
  row[IDX.contestadas] = 90;
  Object.keys(over || {}).forEach((k) => { row[IDX[k]] = over[k]; });
  return row;
}

test('traficoParseFilas: celda numerica con formato % real de Excel -> se multiplica x100 (nunca cambia el archivo real de produccion, que viene como texto)', () => {
  const fila = filaBase({ serviceLevel20secPct: 0.8766 });
  const aoa = [HEADER, fila];
  const ws = { [traficoCeldaRef(1, IDX.serviceLevel20secPct)]: { t: 'n', v: 0.8766, z: '0.00%' } };
  const res = traficoParseFilas(aoa, ws);
  assert.ok(!res.error, JSON.stringify(res));
  assert.equal(res.filas[0].serviceLevel20secPct, 87.66, 'numero de control real de ORLANT (SL20 3P), recuperado exacto desde la fraccion');
  assert.equal(res.avisos.length, 0);
});

test('traficoParseFilas: celda numerica SIN formato %, valor <=1 -- se deja tal cual (0.56, no 56), y avisa UNA vez por columna', () => {
  const fila = filaBase({ serviceLevel20secPct: 0.56 });
  const aoa = [HEADER, fila];
  const ws = { [traficoCeldaRef(1, IDX.serviceLevel20secPct)]: { t: 'n', v: 0.56, z: 'General' } };
  const res = traficoParseFilas(aoa, ws);
  assert.ok(!res.error, JSON.stringify(res));
  assert.equal(res.filas[0].serviceLevel20secPct, 0.56, 'nunca se adivina/multiplica -- se deja exactamente como vino');
  assert.ok(res.avisos.some((a) => /SERVICE_LEVEL_20SEC/.test(a) && /<= 1/.test(a)), 'debe avisar UNA vez, para que la persona revise: ' + JSON.stringify(res.avisos));
});

test('traficoParseFilas: sin `ws` (llamador viejo, o SheetJS sin cellNF) -- comportamiento EXACTAMENTE igual al de antes de la Fase 88', () => {
  const fila = filaBase({ serviceLevel20secPct: 0.56 });
  const aoa = [HEADER, fila];
  const res = traficoParseFilas(aoa); // sin ws
  assert.ok(!res.error, JSON.stringify(res));
  assert.equal(res.filas[0].serviceLevel20secPct, 0.56);
  assert.equal(res.avisos.length, 0, 'sin ws no se puede saber el formato -- no se avisa, no se adivina, mismo comportamiento de siempre');
});

test('traficoParseFilas: si SOLO ALGUNAS filas de la columna son <=1 (y el resto normales) -- NO se avisa (no es "toda la columna")', () => {
  const filas = [
    filaBase({ serviceLevel20secPct: 0.56 }),
    filaBase({ serviceLevel20secPct: 87 }),
  ];
  const aoa = [HEADER, ...filas];
  const ws = {
    [traficoCeldaRef(1, IDX.serviceLevel20secPct)]: { t: 'n', v: 0.56, z: 'General' },
    [traficoCeldaRef(2, IDX.serviceLevel20secPct)]: { t: 'n', v: 87, z: 'General' },
  };
  const res = traficoParseFilas(aoa, ws);
  assert.ok(!res.error, JSON.stringify(res));
  assert.equal(res.avisos.length, 0, 'un valor normal en la misma columna descarta la ambiguedad');
});

test('traficoParseFilas: texto ("93.55 %") con `ws` presente pero la celda es de TEXTO -- sin cambios, sin aviso (caso real de produccion)', () => {
  const fila = filaBase({ serviceLevel20secPct: '93.55 %' });
  const aoa = [HEADER, fila];
  const ws = { [traficoCeldaRef(1, IDX.serviceLevel20secPct)]: { t: 's', v: '93.55 %' } };
  const res = traficoParseFilas(aoa, ws);
  assert.ok(!res.error, JSON.stringify(res));
  assert.equal(res.filas[0].serviceLevel20secPct, 93.55);
  assert.equal(res.avisos.length, 0);
});

// ── traficoWppParseFilas: mismo criterio, columna SERVICE_LEVEL_5MIN ────
const HEADER_WPP = TRAFICO_WPP_COLUMNAS.map((c) => c.label);
const IDX_WPP = {};
TRAFICO_WPP_COLUMNAS.forEach((c, i) => { IDX_WPP[c.key] = i; });

function filaWppBase(over) {
  const row = new Array(HEADER_WPP.length).fill(null);
  row[IDX_WPP.colaWhatsapp] = 'WHATSAPP ORLANT GENERAL';
  row[IDX_WPP.fechaInicio] = '2026-08-01';
  row[IDX_WPP.fechaFin] = '2026-08-31';
  row[IDX_WPP.totalWhatsapp] = 100;
  row[IDX_WPP.contestados] = 90;
  Object.keys(over || {}).forEach((k) => { row[IDX_WPP[k]] = over[k]; });
  return row;
}

test('traficoWppParseFilas: SERVICE_LEVEL_5MIN con formato % real de Excel -> x100; sin formato y <=1 -> se avisa sin adivinar', () => {
  const filaConFormato = filaWppBase({ serviceLevel5minPct: 0.9838 });
  const aoaOk = [HEADER_WPP, filaConFormato];
  const wsOk = { [traficoCeldaRef(1, IDX_WPP.serviceLevel5minPct)]: { t: 'n', v: 0.9838, z: '0.00%' } };
  const resOk = traficoWppParseFilas(aoaOk, wsOk);
  assert.ok(!resOk.error, JSON.stringify(resOk));
  assert.equal(resOk.filas[0].serviceLevel5minPct, 98.38);

  const filaSinFormato = filaWppBase({ serviceLevel5minPct: 0.42 });
  const aoaAmbiguo = [HEADER_WPP, filaSinFormato];
  const wsAmbiguo = { [traficoCeldaRef(1, IDX_WPP.serviceLevel5minPct)]: { t: 'n', v: 0.42, z: 'General' } };
  const resAmbiguo = traficoWppParseFilas(aoaAmbiguo, wsAmbiguo);
  assert.ok(!resAmbiguo.error, JSON.stringify(resAmbiguo));
  assert.equal(resAmbiguo.filas[0].serviceLevel5minPct, 0.42, 'nunca se adivina');
  assert.ok(resAmbiguo.avisos.some((a) => /SERVICE_LEVEL_5MIN/.test(a) && /<= 1/.test(a)), JSON.stringify(resAmbiguo.avisos));
});

test('traficoWppParseFilas: texto SIGUE igual (caso real de produccion, agosto, "93.55 %" como texto)', () => {
  const fila = filaWppBase({ serviceLevel5minPct: '93.55 %' });
  const aoa = [HEADER_WPP, fila];
  const ws = { [traficoCeldaRef(1, IDX_WPP.serviceLevel5minPct)]: { t: 's', v: '93.55 %' } };
  const res = traficoWppParseFilas(aoa, ws);
  assert.ok(!res.error, JSON.stringify(res));
  assert.equal(res.filas[0].serviceLevel5minPct, 93.55);
  assert.equal(res.avisos.length, 0);
});
