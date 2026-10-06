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
  cargasLeerEncabezadoAcotado,
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

// ── Fase 71 (ORLANT/resumen): columnas autoTrafico -- se calculan solas
// desde Trafico de Llamadas/WhatsApp, nunca se guardan desde esta hoja aunque
// un archivo viejo todavia las traiga llenas.
const SPEC_RESUMEN_ORLANT_MINI = {
  filaUnica: true,
  columnas: [
    { key: 'llamadas_3p', label: 'Llamadas 3P', tipo: 'entero', opcional: true, autoTrafico: true },
    { key: 'nivel_atencion_3p', label: 'Nivel Atencion 3P (%)', tipo: 'porcentaje', opcional: true, autoTrafico: true },
    { key: 'total_agendas', label: 'Total agendas del mes', tipo: 'entero' },
  ],
};

test('cargasParseFilaUnica: archivo NUEVO (sin las filas autoTrafico) se parsea igual, sin avisos', () => {
  const aoa = [
    ['Metrica', 'Valor'],
    ['Total agendas del mes', 150],
  ];
  const res = cargasParseFilaUnica(SPEC_RESUMEN_ORLANT_MINI, aoa);
  assert.equal(res.error, undefined);
  assert.equal(res.filas.length, 1);
  assert.equal(res.filas[0].total_agendas, 150);
  assert.equal(res.filas[0].llamadas_3p, undefined, 'nunca se guarda, ni siquiera ausente');
  assert.deepEqual(res.avisos, []);
});

test('cargasParseFilaUnica: fila autoTrafico presente pero VACIA no genera aviso (plantilla vieja sin llenar)', () => {
  const aoa = [
    ['Metrica', 'Valor'],
    ['Llamadas 3P', ''],
    ['Total agendas del mes', 150],
  ];
  const res = cargasParseFilaUnica(SPEC_RESUMEN_ORLANT_MINI, aoa);
  assert.equal(res.error, undefined);
  assert.equal(res.filas[0].llamadas_3p, undefined);
  assert.deepEqual(res.avisos, []);
});

test('cargasParseFilaUnica: archivo VIEJO con las filas autoTrafico llenas -- se ignoran con un aviso claro, nunca se guardan', () => {
  const aoa = [
    ['Metrica', 'Valor'],
    ['Llamadas 3P', 8061],
    ['Nivel Atencion 3P (%)', 88.8],
    ['Total agendas del mes', 150],
  ];
  const res = cargasParseFilaUnica(SPEC_RESUMEN_ORLANT_MINI, aoa);
  assert.equal(res.error, undefined);
  assert.equal(res.filas[0].total_agendas, 150);
  assert.equal(res.filas[0].llamadas_3p, undefined, 'el valor del archivo viejo NUNCA se guarda (Trafico manda)');
  assert.equal(res.filas[0].nivel_atencion_3p, undefined);
  assert.equal(res.avisos.length, 2);
  assert.match(res.avisos[0], /Llamadas 3P/);
  assert.match(res.avisos[0], /se toma automaticamente de Trafico/);
  assert.match(res.avisos[1], /Nivel Atencion 3P/);
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

// cargasLeerEncabezadoAcotado — Fase 127, hallazgo real con Playwright
// contra un archivo sintetico de la forma EXACTA del archivo de Salida de
// Edwin (MES sin año, encabezado en la fila 3, 2 filas vacias antes, hoja
// "Hoja1"): subido por la pagina real, el archivo (perfectamente valido)
// nunca se reconocia -- "El archivo no tiene datos en ninguna hoja
// reconocida". La version vieja de este codigo (Fase 122, antes de esta
// funcion existir) acotaba la lectura del encabezado a UN SOLO renglon (el
// PRIMERO del rango usado de la hoja) asumiendo que ese renglon siempre es
// el encabezado -- cierto para el archivo real de esa fase, falso aqui
// porque el rango usado de la hoja arranca ANTES del encabezado real. Usa
// el XLSX vendorizado (public/js/vendor/) para construir el .xlsx
// sintetico, nunca el paquete npm `xlsx` (ver tests/helpers/xlsx-lite.js
// para por que: ese paquete falla `npm audit`).
{
  const XLSX = require('../../public/js/vendor/xlsx-0.20.3.full.min.js');
  const HEADER_SALIDA = ['MES', 'LINEA 3P', 'LINEA GENERAL', 'WHATSAPP 3P', 'WHATSAPP GENERAL'];

  function hojaConEncabezadoEnFila3() {
    return XLSX.utils.aoa_to_sheet([
      [], [], HEADER_SALIDA,
      ['AGOSTO', 100, 200, 50, 80],
      ['SEPTIEMBRE', 150, 300, 75, 120],
    ]);
  }

  test('cargasLeerEncabezadoAcotado: reproduce el bug real -- con maxFilas=1 (comportamiento viejo de la Fase 122) el encabezado en la fila 3 nunca se ve', () => {
    const ws = hojaConEncabezadoEnFila3();
    const header = cargasLeerEncabezadoAcotado(XLSX.utils, ws, 1);
    assert.deepEqual(header, [], 'con el codigo viejo (1 solo renglon), el encabezado real (fila 3) queda fuera de rango -- esto documenta el bug, no el comportamiento deseado');
  });

  test('cargasLeerEncabezadoAcotado: con maxFilas=20 (codigo nuevo) SI encuentra el encabezado aunque no este en la primera fila del rango usado', () => {
    const ws = hojaConEncabezadoEnFila3();
    const header = cargasLeerEncabezadoAcotado(XLSX.utils, ws, 20);
    assert.deepEqual(header, HEADER_SALIDA);
  });

  test('cargasLeerEncabezadoAcotado: igual al resultado de leer la hoja COMPLETA (mismo criterio que antes de la optimizacion de la Fase 122)', () => {
    const ws = hojaConEncabezadoEnFila3();
    const completo = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: null })[0];
    const acotado = cargasLeerEncabezadoAcotado(XLSX.utils, ws, 20);
    assert.deepEqual(acotado, completo);
  });

  test('cargasLeerEncabezadoAcotado: encabezado en la PRIMERA fila (caso comun) sigue funcionando igual que siempre', () => {
    const ws = XLSX.utils.aoa_to_sheet([HEADER_SALIDA, ['AGOSTO', 1, 2, 3, 4]]);
    assert.deepEqual(cargasLeerEncabezadoAcotado(XLSX.utils, ws, 20), HEADER_SALIDA);
    assert.deepEqual(cargasLeerEncabezadoAcotado(XLSX.utils, ws, 1), HEADER_SALIDA);
  });

  test('cargasLeerEncabezadoAcotado: hoja sin "!ref" (realmente vacia) -> [], nunca revienta', () => {
    assert.deepEqual(cargasLeerEncabezadoAcotado(XLSX.utils, {}, 20), []);
  });
}
