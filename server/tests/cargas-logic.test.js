// cargas-logic.test.js — cubre public/js/cargas-logic.js (parseo de la carga
// de datos operativos de dashboards de cliente y, sobre todo, la deteccion
// de formulas de Excel sin valor calculado). Reproduce el bug real reportado
// en la campana ALBERTO LINERO GO: un .xlsx generado por script (nunca
// abierto en Excel/LibreOffice) guarda formulas =COUNTA/=COUNTIF apuntando a
// una hoja de detalle, pero no su resultado — la vista previa mostraba "—"
// en silencio. Corre contra dos .xlsx REALES en fixtures/ (uno con ese bug,
// otro con los valores literales que la plantilla realmente pide). Ver
// server/tests/helpers/xlsx-lite.js para por que se leen a mano en vez de
// con el paquete npm `xlsx`. Cubre tambien el fix de la Fase 30/31 (auditoria
// del flujo de carga): una hoja AUSENTE del archivo (pestana renombrada o
// borrada por error) ahora genera un aviso, en vez de perderse en silencio
// igual que una hoja legitimamente vacia.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { leerHojaXlsxComoAoA, leerHojaXlsxComoCeldas } = require('./helpers/xlsx-lite');
const {
  cargasColPorLabel,
  cargasParseFilaUnica,
  cargasParseMultiFila,
  cargasDetectarFormulaSinValor,
  cargasPlanConsolidado,
  cargasHojaVacia,
  cargasProcesarHoja,
  cargasDetectarCanalTrafico,
  CARGAS_HOJA_TRAFICO,
  CARGAS_HOJA_CALIDAD,
} = require('../../public/js/cargas-logic.js');
const { traficoColIndexMap, traficoParseFilas } = require('../../public/js/trafico-logic.js');
const { traficoWppColIndexMap, traficoWppParseFilas } = require('../../public/js/trafico-whatsapp-logic.js');

const FIXTURE_FORMULAS = path.join(__dirname, 'fixtures', 'carga-formula-sin-valor.xlsx');
const FIXTURE_LITERALES = path.join(__dirname, 'fixtures', 'carga-valores-literales.xlsx');
const FIXTURE_CONSOLIDADA = path.join(__dirname, 'fixtures', 'carga-consolidada.xlsx');
const FIXTURE_TRAFICO_VOZ = path.join(__dirname, 'fixtures', 'EJEMPLO.xlsx');
const FIXTURE_TRAFICO_WPP = path.join(__dirname, 'fixtures', 'PLANTILLA_TRAFICO_WHATSAPP_EJEMPLO.xlsx');

// Spec equivalente a la seccion "resumen" de ALBERTO LINERO GO
// (server/dashboard-plantillas-cliente.js, plantillaVentas) — la campana
// real donde se reporto el bug.
const SPEC_RESUMEN_VENTAS = {
  filaUnica: true,
  columnas: [
    { key: 'base_asignada', label: 'Base asignada', tipo: 'entero' },
    { key: 'gestionados', label: 'Registros gestionados', tipo: 'entero' },
    { key: 'contactados', label: 'Contactados', tipo: 'entero' },
    { key: 'contactos_efectivos', label: 'Contactos efectivos', tipo: 'entero' },
    { key: 'ventas', label: 'Ventas', tipo: 'entero' },
    { key: 'meta_ventas', label: 'Meta de ventas', tipo: 'entero' },
    { key: 'aht_segundos', label: 'AHT promedio (segundos)', tipo: 'entero' },
  ],
};

test('cargasDetectarFormulaSinValor: detecta la primera formula sin calcular en el .xlsx real con el bug', () => {
  const ws = leerHojaXlsxComoCeldas(FIXTURE_FORMULAS, 'Datos');
  const r = cargasDetectarFormulaSinValor(ws);
  assert.ok(r, 'deberia detectar una celda con formula sin valor');
  assert.equal(r.celda, 'B2'); // "Base asignada" es la primera fila con formula
  assert.equal(r.etiqueta, 'Base asignada');
  assert.match(r.formula, /COUNTA/);
  assert.match(r.mensaje, /formula de Excel/i);
  assert.match(r.mensaje, /Base asignada/);
});

test('cargasDetectarFormulaSinValor: no marca la fila con valor literal (Meta de ventas) ni la ignora al buscar otras', () => {
  const ws = leerHojaXlsxComoCeldas(FIXTURE_FORMULAS, 'Datos');
  // La celda de "Meta de ventas" (B7) es literal: no debe ser la que se reporta.
  const r = cargasDetectarFormulaSinValor(ws);
  assert.notEqual(r.celda, 'B7');
});

test('cargasDetectarFormulaSinValor: null cuando todas las celdas son valores literales (plantilla llenada a mano)', () => {
  const ws = leerHojaXlsxComoCeldas(FIXTURE_LITERALES, 'Datos');
  assert.equal(cargasDetectarFormulaSinValor(ws), null);
});

test('cargasDetectarFormulaSinValor: null / no revienta con worksheet vacio o undefined', () => {
  assert.equal(cargasDetectarFormulaSinValor(undefined), null);
  assert.equal(cargasDetectarFormulaSinValor({}), null);
});

test('cargasDetectarFormulaSinValor: detecta la celda aunque SheetJS la marque t:"z" con v:0 (relleno de sheetStubs, NUNCA el resultado real)', () => {
  // Verificado contra el paquete real `xlsx` (no asumido): SIN la opcion
  // sheetStubs:true, una celda con formula sin valor cacheado ni siquiera
  // aparece en `ws` -- y CON esa opcion (la que usa cargas.js), SheetJS la
  // representa como { t:'z', f, v:0 }. Si esta funcion solo mirara `v`
  // (undefined/null/''), un `v:0` de relleno pasaria colado como "si tiene
  // valor" y el bug de PR #31 volveria a filtrarse en silencio.
  const ws = {
    A1: { v: 'Metrica' }, B1: { v: 'Valor' },
    A2: { v: 'Ventas' }, B2: { t: 'z', f: "COUNTA('Otra hoja'!A1:A10)", v: 0 },
    A3: { v: 'Meta de ventas' }, B3: { t: 'n', v: 80 },
  };
  const r = cargasDetectarFormulaSinValor(ws);
  assert.ok(r);
  assert.equal(r.celda, 'B2');
  assert.equal(r.etiqueta, 'Ventas');
});

test('cargasDetectarFormulaSinValor: una formula CON valor real cacheado (t distinto de "z") nunca se marca, aunque el valor sea 0', () => {
  const ws = { A1: { v: 'Ventas' }, B1: { t: 'n', f: 'A1-A1', v: 0 } };
  assert.equal(cargasDetectarFormulaSinValor(ws), null);
});

test('cargasParseFilaUnica: el archivo con valores literales SI se parsea correctamente (camino feliz)', () => {
  const aoa = leerHojaXlsxComoAoA(FIXTURE_LITERALES, 'Datos');
  const res = cargasParseFilaUnica(SPEC_RESUMEN_VENTAS, aoa);
  assert.equal(res.error, undefined);
  assert.equal(res.filas.length, 1);
  const fila = res.filas[0];
  assert.equal(fila.base_asignada, 500);
  assert.equal(fila.gestionados, 430);
  assert.equal(fila.contactados, 310);
  assert.equal(fila.contactos_efectivos, 180);
  assert.equal(fila.ventas, 42);
  assert.equal(fila.meta_ventas, 80);
});

test('cargasParseFilaUnica: el archivo con formulas sin calcular produce valores vacios (por eso hace falta el chequeo previo)', () => {
  // Esto documenta el bug tal cual lo veia el usuario antes del fix: sin
  // pasar primero por cargasDetectarFormulaSinValor, el parseo "funciona"
  // pero deja las metricas con formula en blanco -> la vista previa mostraba "—".
  const aoa = leerHojaXlsxComoAoA(FIXTURE_FORMULAS, 'Datos');
  const res = cargasParseFilaUnica(SPEC_RESUMEN_VENTAS, aoa);
  assert.equal(res.error, undefined);
  const fila = res.filas[0];
  // formula sin valor -> celda "vacia" (leerHojaXlsxComoAoA usa null para
  // celdas sin <v>, igual que XLSX.utils.sheet_to_json sin defval; en el
  // navegador cargas.js pasa defval:'' y el resultado visible es "—").
  assert.equal(fila.base_asignada, null);
  assert.equal(fila.meta_ventas, 80); // el unico literal si se lee bien
});

test('cargasColPorLabel: empareja por label o por key, normalizando mayusculas/espacios', () => {
  const col = cargasColPorLabel(SPEC_RESUMEN_VENTAS, '  ventas  ');
  assert.equal(col.key, 'ventas');
  assert.equal(cargasColPorLabel(SPEC_RESUMEN_VENTAS, 'no existe'), null);
});

// ── Plantilla consolidada (Fase "una sola plantilla por campana", 2026-09-16) ──
const { cmParseRows } = require('../../public/js/calidad-carga-masiva-logic.js');

test('cargasHojaVacia: filaUnica (Metrica/Valor) es vacia solo si ningun valor esta lleno', () => {
  assert.equal(cargasHojaVacia([], true), true);
  assert.equal(cargasHojaVacia([['Metrica', 'Valor'], ['Ventas', '']], true), true);
  assert.equal(cargasHojaVacia([['Metrica', 'Valor'], ['Ventas', 30]], true), false);
});

test('cargasHojaVacia: multi-fila es vacia si no hay filas mas alla del encabezado', () => {
  assert.equal(cargasHojaVacia([['A', 'B']], false), true);
  assert.equal(cargasHojaVacia([['A', 'B'], ['', '']], false), true);
  assert.equal(cargasHojaVacia([['A', 'B'], [1, 2]], false), false);
  assert.equal(cargasHojaVacia(null, false), true);
});

test('cargasPlanConsolidado: Trafico SIEMPRE se incluye; Calidad solo si la campana ya tiene plantilla', () => {
  const secciones = { resumen: { titulo: 'Resumen', filaUnica: true, columnas: [] } };
  const traficoCols = [{ label: 'SKILL_NAME' }];

  const sinCalidad = cargasPlanConsolidado(secciones, null, traficoCols);
  assert.deepEqual(sinCalidad.map((h) => h.hoja), ['resumen', CARGAS_HOJA_TRAFICO]);

  const conCalidad = cargasPlanConsolidado(secciones, [{ label: 'ASESOR' }], traficoCols);
  assert.deepEqual(conCalidad.map((h) => h.hoja), ['resumen', CARGAS_HOJA_CALIDAD, CARGAS_HOJA_TRAFICO]);
});

test('cargasProcesarHoja + archivo consolidado real: la hoja valida se procesa, la vacia se omite sin error, y la hoja con formula se rechaza sola', () => {
  const ITEMS_TEST = [{ n: 1, cat: 'Apertura', label: 'Saludo inicial', weight: 100, critico: false }];
  const SPEC_RESUMEN = {
    filaUnica: true,
    columnas: [
      { key: 'base_asignada', label: 'Base asignada', tipo: 'entero' },
      { key: 'gestionados', label: 'Registros gestionados', tipo: 'entero' },
      { key: 'contactados', label: 'Contactados', tipo: 'entero' },
      { key: 'contactos_efectivos', label: 'Contactos efectivos', tipo: 'entero' },
      { key: 'ventas', label: 'Ventas', tipo: 'entero' },
      { key: 'meta_ventas', label: 'Meta de ventas', tipo: 'entero' },
      { key: 'aht_segundos', label: 'AHT promedio (segundos)', tipo: 'entero' },
    ],
  };

  // Hoja 'resumen' (Gestion de base) — OK.
  const aoaResumen = leerHojaXlsxComoAoA(FIXTURE_CONSOLIDADA, 'resumen');
  const wsResumen = leerHojaXlsxComoCeldas(FIXTURE_CONSOLIDADA, 'resumen');
  const rResumen = cargasProcesarHoja(
    { tipo: 'seccion', hoja: 'resumen', titulo: 'Resumen', filaUnica: true },
    aoaResumen, wsResumen,
    (aoa) => cargasParseFilaUnica(SPEC_RESUMEN, aoa)
  );
  assert.equal(rResumen.vacia, undefined);
  assert.equal(rResumen.error, undefined);
  assert.equal(rResumen.filas[0].ventas, 30);

  // Hoja 'DATA' (Trafico) — solo encabezado -> vacia, NO es un error.
  const aoaData = leerHojaXlsxComoAoA(FIXTURE_CONSOLIDADA, 'DATA');
  const wsData = leerHojaXlsxComoCeldas(FIXTURE_CONSOLIDADA, 'DATA');
  const rData = cargasProcesarHoja(
    { tipo: 'trafico', hoja: CARGAS_HOJA_TRAFICO, titulo: 'Trafico', filaUnica: false },
    aoaData, wsData,
    traficoParseFilas
  );
  assert.equal(rData.vacia, true);
  assert.equal(rData.error, undefined);
  assert.equal(rData.filas, undefined);

  // Hoja 'Monitoreos' (Calidad) — trae datos pero con una formula sin
  // calcular -> se rechaza SOLO esta hoja, con un mensaje claro.
  const aoaMon = leerHojaXlsxComoAoA(FIXTURE_CONSOLIDADA, 'Monitoreos');
  const wsMon = leerHojaXlsxComoCeldas(FIXTURE_CONSOLIDADA, 'Monitoreos');
  const rMon = cargasProcesarHoja(
    { tipo: 'calidad', hoja: CARGAS_HOJA_CALIDAD, titulo: 'Calidad', filaUnica: false },
    aoaMon, wsMon,
    (aoa) => cmParseRows(aoa, ITEMS_TEST)
  );
  assert.equal(rMon.vacia, undefined);
  assert.match(rMon.error, /formula de Excel/i);

  // La hoja mala NO afecto el resultado de las otras dos: siguen siendo
  // exactamente lo que eran antes de procesar 'Monitoreos'.
  assert.equal(rResumen.filas[0].ventas, 30);
  assert.equal(rData.vacia, true);
});

test('cargasProcesarHoja: hoja realmente AUSENTE del archivo (ninguna pestana con ese nombre) genera un aviso claro, nunca un guardado silencioso', () => {
  // Reproduce el hallazgo real de la auditoria del flujo de carga (Fase 30):
  // antes de este fix, una pestana renombrada/borrada por error se trataba
  // exactamente igual que una hoja vacia legitima.
  const r = cargasProcesarHoja(
    { tipo: 'seccion', hoja: 'diario', titulo: 'Diario', filaUnica: false },
    undefined, undefined,
    () => { throw new Error('no deberia llamarse el parser si la hoja no existe'); },
    ['INSTRUCCIONES', 'resumen', 'Diaro', 'tipificacion', 'asesores', 'DATA']
  );
  assert.equal(r.vacia, undefined);
  assert.match(r.error, /No se encontro la hoja "diario"/);
  assert.match(r.error, /no la borres ni la renombres/i);
  assert.match(r.error, /INSTRUCCIONES, resumen, Diaro, tipificacion, asesores, DATA/);
});

test('cargasProcesarHoja: hoja PRESENTE pero sin filas de datos sigue siendo "vacia -- no aplica", nunca un error (caso legitimo sin cambios)', () => {
  const ws = { A1: { v: 'Metrica' }, B1: { v: 'Valor' } }; // la pestana existe, con el nombre correcto
  const aoa = [['Metrica', 'Valor']];
  const r = cargasProcesarHoja(
    { tipo: 'seccion', hoja: 'diario', titulo: 'Diario', filaUnica: true },
    aoa, ws,
    () => { throw new Error('no deberia llamarse el parser si la hoja esta vacia'); },
    ['INSTRUCCIONES', 'diario']
  );
  assert.equal(r.vacia, true);
  assert.equal(r.error, undefined);
});

test('cargasProcesarHoja: hoja ausente sin ninguna otra hoja en el archivo -- el mensaje no queda vacio ni roto', () => {
  const r = cargasProcesarHoja(
    { tipo: 'trafico', hoja: 'DATA', titulo: 'Trafico', filaUnica: false },
    undefined, undefined,
    () => { throw new Error('no deberia llamarse el parser'); },
    []
  );
  assert.match(r.error, /No se encontro la hoja "DATA"/);
  assert.match(r.error, /\(el archivo no tiene ninguna hoja\)/);
});

test('cargasParseMultiFila: descarta filas vacias y columnas que no coinciden con la plantilla', () => {
  const spec = { columnas: [{ key: 'fecha', label: 'Fecha' }, { key: 'ventas', label: 'Ventas' }] };
  const aoa = [
    ['Fecha', 'Ventas', 'Columna extra'],
    ['2026-09-01', 5, 'x'],
    ['', '', ''],
    ['2026-09-02', 3, 'y'],
  ];
  const res = cargasParseMultiFila(spec, aoa);
  assert.equal(res.filas.length, 2);
  assert.equal(res.filas[0].fecha, '2026-09-01');
  assert.equal(res.filas[0].ventas, 5);
  assert.equal(res.filas[0]['Columna extra'], undefined);
});

// ── Fase 52: la hoja "DATA" del modal "Cargar Datos de Dashboards" acepta
// dos formatos (Trafico de Llamadas o Trafico de WhatsApp) -- bug real
// reportado por el usuario: subir el archivo real de WhatsApp por este
// modal fallaba con "ninguna hoja reconocida" porque esta hoja SOLO
// reconocia el formato de voz, aunque el nombre "DATA" fuera correcto.
test('cargasDetectarCanalTrafico: encabezado real de voz (EJEMPLO.xlsx) -> "voz"', () => {
  const aoa = leerHojaXlsxComoAoA(FIXTURE_TRAFICO_VOZ, 'DATA');
  const canal = cargasDetectarCanalTrafico(aoa[0], traficoColIndexMap, traficoWppColIndexMap);
  assert.equal(canal, 'voz');
});

test('cargasDetectarCanalTrafico: encabezado real de WhatsApp (PLANTILLA_TRAFICO_WHATSAPP_EJEMPLO.xlsx) -> "whatsapp"', () => {
  const aoa = leerHojaXlsxComoAoA(FIXTURE_TRAFICO_WPP, 'DATA');
  const canal = cargasDetectarCanalTrafico(aoa[0], traficoColIndexMap, traficoWppColIndexMap);
  assert.equal(canal, 'whatsapp');
});

test('cargasDetectarCanalTrafico: encabezado vacio/irreconocible cae por defecto a "voz" (mismo comportamiento que antes de la Fase 52)', () => {
  assert.equal(cargasDetectarCanalTrafico([], traficoColIndexMap, traficoWppColIndexMap), 'voz');
  assert.equal(cargasDetectarCanalTrafico(['COLUMNA RARA'], traficoColIndexMap, traficoWppColIndexMap), 'voz');
  assert.equal(cargasDetectarCanalTrafico(undefined, traficoColIndexMap, traficoWppColIndexMap), 'voz');
});

test('cargasProcesarHoja: reproduce el bug real -- la hoja DATA del archivo real de WhatsApp ahora SI se reconoce (antes: "ninguna hoja reconocida")', () => {
  const aoa = leerHojaXlsxComoAoA(FIXTURE_TRAFICO_WPP, 'DATA');
  const ws = leerHojaXlsxComoCeldas(FIXTURE_TRAFICO_WPP, 'DATA');
  // Mismo dispatcher que cargas.js#_cargasParseTraficoAuto, reproducido aqui
  // con los parsers reales (sin DOM) para probar el flujo completo.
  const parseFn = (a) => {
    const canal = cargasDetectarCanalTrafico(a[0], traficoColIndexMap, traficoWppColIndexMap);
    const res = canal === 'whatsapp' ? traficoWppParseFilas(a) : traficoParseFilas(a);
    if (!res.error) res.canal = canal;
    return res;
  };
  const r = cargasProcesarHoja(
    { tipo: 'trafico', hoja: CARGAS_HOJA_TRAFICO, titulo: 'Trafico (Llamadas o WhatsApp)', filaUnica: false },
    aoa, ws, parseFn
  );
  assert.equal(r.error, undefined);
  assert.equal(r.canal, 'whatsapp');
  assert.equal(r.filas.length, 5);
  assert.equal(r.filas[0].colaWhatsapp, 'WHATSAPP FONOAUDIOLOGIA');
});

test('cargasProcesarHoja: un archivo real de voz sigue yendo por el parser de voz de siempre (no rompio nada)', () => {
  const aoa = leerHojaXlsxComoAoA(FIXTURE_TRAFICO_VOZ, 'DATA');
  const ws = leerHojaXlsxComoCeldas(FIXTURE_TRAFICO_VOZ, 'DATA');
  const parseFn = (a) => {
    const canal = cargasDetectarCanalTrafico(a[0], traficoColIndexMap, traficoWppColIndexMap);
    const res = canal === 'whatsapp' ? traficoWppParseFilas(a) : traficoParseFilas(a);
    if (!res.error) res.canal = canal;
    return res;
  };
  const r = cargasProcesarHoja(
    { tipo: 'trafico', hoja: CARGAS_HOJA_TRAFICO, titulo: 'Trafico (Llamadas o WhatsApp)', filaUnica: false },
    aoa, ws, parseFn
  );
  assert.equal(r.error, undefined);
  assert.equal(r.canal, 'voz');
  assert.ok(r.filas.length > 0);
  assert.ok(r.filas[0].skillName);
});

test('cargasProcesarHoja: pasa de largo campos extra del parser (ej. `canal`) sin filtrarlos', () => {
  const aoa = [['A'], [1]];
  const ws = { A1: { v: 'A' }, A2: { v: 1 } };
  const parseFn = () => ({ filas: [{ a: 1 }], avisos: [], canal: 'whatsapp', colas: ['X'] });
  const r = cargasProcesarHoja({ tipo: 'trafico', hoja: 'DATA', titulo: 'Trafico', filaUnica: false }, aoa, ws, parseFn);
  assert.equal(r.canal, 'whatsapp');
  assert.deepEqual(r.colas, ['X']);
});
