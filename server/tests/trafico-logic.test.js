// trafico-logic.test.js — cubre public/js/trafico-logic.js (parseo del
// export de Volvox + agregacion por granularidad), corriendo la MISMA
// logica que usa el navegador contra el fixture REAL
// (server/tests/fixtures/EJEMPLO.xlsx, hoja DATA) — nunca un fixture
// inventado. Ver server/tests/helpers/xlsx-lite.js para por que se lee el
// .xlsx a mano en vez de con un paquete de npm.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { leerHojaXlsxComoAoA } = require('./helpers/xlsx-lite');
const {
  traficoParseFilas,
  traficoFechaDesdeSerial,
  traficoSegundosDesdeFraccionDia,
  traficoPctDesdeTexto,
  traficoPctDesdeFraccion,
  traficoNumero,
  traficoFiltrarFilas,
  traficoAgregar,
  traficoAhtPromedioPeriodo,
  traficoVentana12Meses,
  traficoResolverSkillsControles,
  traficoModoDisplaySkills,
  traficoValidarNuevoMapeo,
} = require('../../public/js/trafico-logic.js');

const FIXTURE = path.join(__dirname, 'fixtures', 'EJEMPLO.xlsx');
// Fixture adicional (misma estructura de DATA, adjuntado por el usuario):
// trae ademas una hoja GRAFICA con una tabla dinamica hecha a mano en Excel,
// como referencia de que filtros/metricas pedia la fase de "plantilla
// universal" — nunca como fuente de calculo (ver el test de mas abajo, que
// prueba justamente que el promedio simple de esa hoja es el calculo
// incorrecto que este motor evita).
const FIXTURE_FILTROS = path.join(__dirname, 'fixtures', 'EJEMPLO_FILTROS.xlsx');

test('conversion: serial de Excel -> YYYY-MM-DD (aritmetica UTC, sin depender de la zona horaria)', () => {
  assert.equal(traficoFechaDesdeSerial(46266), '2026-09-01');
  assert.equal(traficoFechaDesdeSerial(46267), '2026-09-02');
  assert.equal(traficoFechaDesdeSerial('46268'), '2026-09-03'); // texto numerico tambien
  assert.equal(traficoFechaDesdeSerial('no es un numero'), null);
});

test('conversion: WAIT_TIME/AHT (hora nativa de Excel = fraccion de dia) -> segundos', () => {
  assert.equal(traficoSegundosDesdeFraccionDia(0.0002546296296296296), 22); // 0:00:22
  assert.equal(traficoSegundosDesdeFraccionDia(0.002488425925925926), 215); // 0:03:35
  assert.equal(traficoSegundosDesdeFraccionDia(0), 0);
  assert.equal(traficoSegundosDesdeFraccionDia(null), null);
  assert.equal(traficoSegundosDesdeFraccionDia(''), null);
});

test('conversion: SERVICE_LEVEL_* vienen como texto con % (con y sin espacio)', () => {
  assert.equal(traficoPctDesdeTexto('86.49 %'), 86.49); // con espacio
  assert.equal(traficoPctDesdeTexto('1.62%'), 1.62); // sin espacio
  assert.equal(traficoPctDesdeTexto('0.00%'), 0); // 0% real, no "sin dato"
  assert.equal(traficoPctDesdeTexto(''), null);
  assert.equal(traficoPctDesdeTexto(null), null);
  assert.equal(traficoPctDesdeTexto('texto raro'), null);
});

test('conversion: NIVEL DE ATENCION/TASA DE ABNDONO vienen como fraccion decimal, no como %', () => {
  assert.equal(traficoPctDesdeFraccion(0.9837837837837838), 98.38);
  assert.equal(traficoPctDesdeFraccion(0.016216216216216217), 1.62);
  assert.equal(traficoPctDesdeFraccion(0), 0);
  assert.equal(traficoPctDesdeFraccion(1), 100);
  assert.equal(traficoPctDesdeFraccion(null), null);
});

test('conversion: ASA/ATA (numero, a veces como texto) -> numero', () => {
  assert.equal(traficoNumero('22.47'), 22.47);
  assert.equal(traficoNumero(22.47), 22.47);
  assert.equal(traficoNumero('0.00'), 0);
  assert.equal(traficoNumero(''), null);
});

test('parseo del archivo REAL (EJEMPLO.xlsx, hoja DATA): todas las columnas, valores correctos', () => {
  const aoa = leerHojaXlsxComoAoA(FIXTURE, 'DATA');
  const res = traficoParseFilas(aoa);
  assert.ok(!res.error, res.error);
  assert.equal(res.filas.length, 12, 'el fixture tiene 12 filas de datos');
  assert.deepEqual(res.skills, ['CALL INBOUND ORLANT 3P']);
  assert.deepEqual(res.meses, ['2026-09']);

  const f1 = res.filas[0];
  assert.equal(f1.fecha, '2026-09-01');
  assert.equal(f1.skillName, 'CALL INBOUND ORLANT 3P');
  assert.equal(f1.totalLlamadas, 185);
  assert.equal(f1.contestadas, 182);
  assert.equal(f1.llamadasAbandonadas, 3);
  assert.equal(f1.serviceLevel10secPct, 86.49);
  assert.equal(f1.serviceLevel20secPct, 87.03);
  assert.equal(f1.serviceLevel30secPct, 88.11);
  // ABANDON (columna de Volvox) se dejo de parsear en la Fase 45 (sin uso en
  // ningun lado -- tasaAbandonoPct ya cubre el abandono, recalculado exacto):
  // la fila ya no trae abandonPct aunque el archivo real traiga esa columna.
  assert.equal(f1.abandonPct, undefined);
  assert.equal(f1.asaSegundos, 22.47);
  assert.equal(f1.ataSegundos, 162.33);
  assert.equal(f1.waitTimeSegundos, 22);
  assert.equal(f1.ahtSegundos, 215);
  assert.equal(f1.nivelAtencionPct, 98.38);
  assert.equal(f1.tasaAbandonoPct, 1.62);

  // Todas las fechas del fixture caen en septiembre-2026 (no necesariamente
  // consecutivas: el export real tiene huecos, ej. sin fila para el 9/6 ni
  // el 9/13 — un dia sin fila no es lo mismo que un dia en 0).
  const fechas = res.filas.map((f) => f.fecha).sort();
  assert.equal(fechas[0], '2026-09-01');
  assert.equal(fechas[fechas.length - 1], '2026-09-14');
  fechas.forEach((f) => assert.match(f, /^2026-09-\d{2}$/));
});

test('columnas extra se ignoran sin fallar (emparejamiento por nombre, no por posicion)', () => {
  const aoa = [
    ['SKILL_NAME', 'DATE', 'TOTAL LLAMADAS', 'LLAMADAS CONTESTADAS', 'COLUMNA_QUE_VOLVOX_AGREGO_MANANA'],
    ['SKILL X', '2026-01-01', 100, 90, 'lo que sea'],
  ];
  const res = traficoParseFilas(aoa);
  assert.ok(!res.error, res.error);
  assert.equal(res.filas.length, 1);
  assert.equal(res.filas[0].totalLlamadas, 100);
  assert.ok(!('COLUMNA_QUE_VOLVOX_AGREGO_MANANA' in res.filas[0]));
});

test('columnas reordenadas: el emparejamiento sigue siendo por nombre', () => {
  const aoa = [
    ['LLAMADAS CONTESTADAS', 'DATE', 'SKILL_NAME', 'TOTAL LLAMADAS'],
    [90, '2026-01-01', 'SKILL X', 100],
  ];
  const res = traficoParseFilas(aoa);
  assert.ok(!res.error, res.error);
  assert.equal(res.filas[0].skillName, 'SKILL X');
  assert.equal(res.filas[0].totalLlamadas, 100);
  assert.equal(res.filas[0].contestadas, 90);
});

test('columna obligatoria faltante -> error claro diciendo cual falta', () => {
  const aoa = [
    ['SKILL_NAME', 'DATE', 'TOTAL LLAMADAS'], // falta LLAMADAS CONTESTADAS
    ['SKILL X', '2026-01-01', 100],
  ];
  const res = traficoParseFilas(aoa);
  assert.ok(res.error);
  assert.match(res.error, /LLAMADAS CONTESTADAS/);
});

test('archivo con varias skills y varios meses a la vez (no es un caso raro, debe funcionar)', () => {
  const aoa = [
    ['SKILL_NAME', 'DATE', 'TOTAL LLAMADAS', 'LLAMADAS CONTESTADAS', 'NIVEL DE ATENCION'],
    ['SKILL A', '2026-01-15', 100, 90, 0.9],
    ['SKILL A', '2026-02-15', 120, 100, 0.83],
    ['SKILL B', '2026-01-20', 50, 45, 0.9],
    ['SKILL B', '2026-03-05', 80, 70, 0.875],
  ];
  const res = traficoParseFilas(aoa);
  assert.ok(!res.error, res.error);
  assert.equal(res.filas.length, 4);
  assert.deepEqual(res.skills.sort(), ['SKILL A', 'SKILL B']);
  assert.deepEqual(res.meses.sort(), ['2026-01', '2026-02', '2026-03']);
});

test('filas invalidas se descartan con un aviso explicando por que (fecha vacia, contestadas>total, etc.)', () => {
  const aoa = [
    ['SKILL_NAME', 'DATE', 'TOTAL LLAMADAS', 'LLAMADAS CONTESTADAS'],
    ['SKILL X', '', 100, 90], // fecha vacia
    ['SKILL X', '2026-01-01', 100, 150], // contestadas > total
    ['', '2026-01-02', 100, 90], // skill vacio
    ['SKILL X', '2026-01-03', 100, 90], // valida
  ];
  const res = traficoParseFilas(aoa);
  assert.ok(!res.error, res.error);
  assert.equal(res.filas.length, 1);
  assert.equal(res.avisos.length, 3);
  assert.match(res.avisos[0], /DATE invalida/);
  assert.match(res.avisos[1], /supera el total/);
  assert.match(res.avisos[2], /SKILL_NAME vacio/);
});

// ── Point 10 del pedido de Edwin: nunca confiar en una fila TOTAL/resumen ──
test('fila TOTAL/resumen de la base (SKILL_NAME="TOTAL", con fecha valida) se descarta con aviso, no se suma como si fuera una linea real', () => {
  const aoa = [
    ['SKILL_NAME', 'DATE', 'TOTAL LLAMADAS', 'LLAMADAS CONTESTADAS'],
    ['SKILL X', '2026-01-01', 100, 90],
    ['TOTAL', '2026-01-01', 100, 90], // fila resumen con fecha VALIDA: el riesgo real
    ['Totales', '2026-01-02', 50, 40],
    ['TOTAL GENERAL', '2026-01-03', 999, 999],
    ['Gran Total', '2026-01-04', 999, 999],
    ['SKILL TOTALIZADORA', '2026-01-05', 20, 15], // nombre real que solo CONTIENE "total": no se debe descartar
  ];
  const res = traficoParseFilas(aoa);
  assert.ok(!res.error, res.error);
  assert.deepEqual(res.skills.sort(), ['SKILL TOTALIZADORA', 'SKILL X']);
  assert.equal(res.filas.length, 2);
  assert.equal(res.avisos.filter((a) => /TOTAL\/resumen/.test(a)).length, 4);
});

// ── Agregacion: el requisito mas delicado — nunca promediar los % diarios ──
test('agregacion: nivel de atencion mensual = contestadas del mes / total del mes (NO el promedio de los % diarios)', () => {
  // Dia 1: 100 llamadas, 50 contestadas -> 50%. Dia 2: 10 llamadas, 10 contestadas -> 100%.
  // Promedio simple de los dos % (incorrecto): (50+100)/2 = 75%.
  // Correcto (ponderado por volumen real): (50+10)/(100+10) = 54.545...% ≈ 54.55%.
  const filas = [
    { fecha: '2026-01-01', skillName: 'X', totalLlamadas: 100, contestadas: 50 },
    { fecha: '2026-01-02', skillName: 'X', totalLlamadas: 10, contestadas: 10 },
  ];
  const agregadoMes = traficoAgregar(filas, { granularidad: 'mes' });
  assert.equal(agregadoMes.length, 1);
  assert.equal(agregadoMes[0].totalLlamadas, 110);
  assert.equal(agregadoMes[0].contestadas, 60);
  assert.notEqual(agregadoMes[0].nivelAtencionPct, 75, 'NO debe ser el promedio simple de 50% y 100%');
  assert.equal(agregadoMes[0].nivelAtencionPct, 54.55);
});

test('agregacion: granularidad dia/mes/anio agrega los volumenes correctamente', () => {
  const filas = [
    { fecha: '2026-01-05', skillName: 'X', totalLlamadas: 10, contestadas: 8 },
    { fecha: '2026-01-20', skillName: 'X', totalLlamadas: 20, contestadas: 18 },
    { fecha: '2026-02-10', skillName: 'X', totalLlamadas: 30, contestadas: 25 },
    { fecha: '2027-01-01', skillName: 'X', totalLlamadas: 5, contestadas: 5 },
  ];
  const porDia = traficoAgregar(filas, { granularidad: 'dia' });
  assert.equal(porDia.length, 4);

  const porMes = traficoAgregar(filas, { granularidad: 'mes' });
  assert.equal(porMes.length, 3);
  const enero2026 = porMes.find((p) => p.periodo === '2026-01');
  assert.equal(enero2026.totalLlamadas, 30);
  assert.equal(enero2026.contestadas, 26);

  const porAnio = traficoAgregar(filas, { granularidad: 'anio' });
  assert.equal(porAnio.length, 2);
  const anio2026 = porAnio.find((p) => p.periodo === '2026');
  assert.equal(anio2026.totalLlamadas, 60);
  assert.equal(anio2026.contestadas, 51);
});

test('filtro combinable: varias skills se suman salvo que se pidan como series separadas', () => {
  const filas = [
    { fecha: '2026-01-01', skillName: 'A', totalLlamadas: 100, contestadas: 90 },
    { fecha: '2026-01-01', skillName: 'B', totalLlamadas: 50, contestadas: 40 },
  ];
  const combinado = traficoAgregar(filas, { granularidad: 'dia', combinar: true });
  assert.equal(combinado.length, 1);
  assert.equal(combinado[0].totalLlamadas, 150);
  assert.equal(combinado[0].contestadas, 130);
  assert.equal(combinado[0].skillName, null);

  const separado = traficoAgregar(filas, { granularidad: 'dia', combinar: false });
  assert.equal(separado.length, 2);
  assert.deepEqual(separado.map((s) => s.skillName).sort(), ['A', 'B']);
});

test('filtro por skill y por rango de fechas (previo a agregar)', () => {
  const filas = [
    { fecha: '2026-01-01', skillName: 'A', totalLlamadas: 10, contestadas: 9 },
    { fecha: '2026-01-15', skillName: 'B', totalLlamadas: 20, contestadas: 18 },
    { fecha: '2026-02-01', skillName: 'A', totalLlamadas: 30, contestadas: 25 },
  ];
  const soloA = traficoFiltrarFilas(filas, { skills: ['A'] });
  assert.equal(soloA.length, 2);

  const rango = traficoFiltrarFilas(filas, { desde: '2026-01-10', hasta: '2026-01-31' });
  assert.equal(rango.length, 1);
  assert.equal(rango[0].skillName, 'B');
});

test('traficoVentana12Meses: ventana movil de 12 meses calendario, nunca antes del primer dato real (pedido de Edwin, llamada 2026-09-15)', () => {
  // Caso central del pedido: "cuando lleguemos a enero de 2027, se debe
  // quitar enero de 2026" -> con el dato mas reciente en enero-2027, la
  // ventana arranca en febrero-2026 (12 meses: feb-2026..ene-2027), enero-2026 queda afuera.
  assert.equal(traficoVentana12Meses('2027-01-15', '2020-01-01'), '2026-02-01');
  // Mas de 2 años de historia disponible: siempre se recorta a los ultimos 12 meses.
  assert.equal(traficoVentana12Meses('2026-09-05', '2020-01-01'), '2025-10-01');
  // Menos de 12 meses de historia real: nunca antes del primer dato (no inventa periodo vacio).
  assert.equal(traficoVentana12Meses('2026-03-15', '2026-01-01'), '2026-01-01');
  // Exactamente 12 meses de historia: la ventana coincide con el minimo disponible.
  assert.equal(traficoVentana12Meses('2026-12-31', '2026-01-01'), '2026-01-01');
  // Sin fecha maxima (sin datos): usa el minimo si lo hay, o null.
  assert.equal(traficoVentana12Meses(null, '2026-01-01'), '2026-01-01');
  assert.equal(traficoVentana12Meses(null, null), null);
});

test('filtro por sede (consolidacion HOSPITAL LA MARIA): solo deja las filas de la sede pedida', () => {
  const filas = [
    { fecha: '2026-01-01', skillName: 'A', sede: 'CASTILLA', totalLlamadas: 10, contestadas: 9 },
    { fecha: '2026-01-01', skillName: 'B', sede: 'SEDE33', totalLlamadas: 20, contestadas: 18 },
  ];
  const castilla = traficoFiltrarFilas(filas, { sede: 'CASTILLA' });
  assert.equal(castilla.length, 1);
  assert.equal(castilla[0].skillName, 'A');

  const sinFiltro = traficoFiltrarFilas(filas, {});
  assert.equal(sinFiltro.length, 2, 'sin sede en opts, no filtra por sede (campanas de una sola sede)');
});

test('fixture EJEMPLO_FILTROS.xlsx (aportado con la hoja GRAFICA de referencia): agregado combinado por periodo unico', () => {
  const aoa = leerHojaXlsxComoAoA(FIXTURE_FILTROS, 'DATA');
  const res = traficoParseFilas(aoa);
  assert.ok(!res.error, res.error);
  // 12 filas de datos reales + 2 filas totalmente en blanco al final (rango
  // de origen de la tabla dinamica de la hoja GRAFICA) que se ignoran sin
  // aviso, igual que cualquier fila vacia de cualquier carga de este sistema.
  assert.equal(res.filas.length, 12);

  const agregado = traficoAgregar(res.filas, { granularidad: 'anio', combinar: true });
  assert.equal(agregado.length, 1); // un solo skill, un solo mes -> un solo periodo agregado
  const a = agregado[0];
  assert.equal(a.totalLlamadas, 1867);
  assert.equal(a.contestadas, 1847);
  assert.equal(a.llamadasAbandonadas, 20);

  // El calculo correcto (contestadas del periodo / total del periodo) NO es
  // el mismo numero que el "Promedio de NIVEL DE ATENCION" que arma la
  // tabla dinamica de Excel en la hoja GRAFICA de este mismo archivo
  // (0.986431545189923 -> 98.64%, un promedio simple de los % diarios,
  // exactamente el calculo incorrecto que este motor evita). El correcto:
  assert.equal(a.nivelAtencionPct, 98.93);
  assert.notEqual(a.nivelAtencionPct, 98.64);

  // Mismo criterio para tasa de abandono: promedio simple de la hoja GRAFICA
  // da 0.01356845481007698 -> 1.36%; el correcto (abandonadas/total) es:
  assert.equal(a.tasaAbandonoPct, 1.07);
  assert.notEqual(a.tasaAbandonoPct, 1.36);
});

// ── traficoValidarNuevoMapeo: formulario "Registrar skill nuevo" (mapeo ──
// manual Wolkvox -> campana, Fase 30/32) — valida ANTES de llamar al PUT
// /calidad/trafico/skills/:skillName real, sin backend ni DOM de por medio.
test('traficoValidarNuevoMapeo: SKILL_NAME vacio (o solo espacios) se rechaza con mensaje claro', () => {
  assert.match(traficoValidarNuevoMapeo({ skillName: '', campana: 'ORLANT' }).error, /Escribe el SKILL_NAME/);
  assert.match(traficoValidarNuevoMapeo({ skillName: '   ', campana: 'ORLANT' }).error, /Escribe el SKILL_NAME/);
});

test('traficoValidarNuevoMapeo: sin campana seleccionada se rechaza con mensaje claro', () => {
  const r = traficoValidarNuevoMapeo({ skillName: 'CALL_INBOUND_AURORA', campana: '' });
  assert.match(r.error, /Selecciona la campana/);
});

test('traficoValidarNuevoMapeo: campana multi-sede sin sede elegida se rechaza', () => {
  const r = traficoValidarNuevoMapeo({
    skillName: 'CALL_HLM', campana: 'HOSPITAL LA MARIA', sede: '',
    sedesDisponibles: [{ valor: 'CASTILLA' }, { valor: 'SEDE33' }],
  });
  assert.match(r.error, /mas de una sede/);
});

test('traficoValidarNuevoMapeo: SKILL_NAME que ya existe en la tabla se rechaza, no se deja que el upsert lo pise en silencio', () => {
  const r = traficoValidarNuevoMapeo({
    skillName: 'CALL_YA_MAPEADO', campana: 'ORLANT',
    skillsExistentes: ['CALL_YA_MAPEADO', 'OTRO_SKILL'],
  });
  assert.match(r.error, /ya existe en la tabla de abajo/);
});

test('traficoValidarNuevoMapeo: camino feliz -- recorta espacios, no exige sede si la campana no es multi-sede, sede queda null', () => {
  const r = traficoValidarNuevoMapeo({
    skillName: '  CALL_INBOUND_AURORA  ', campana: 'CLINICA AURORA',
    sedesDisponibles: [], skillsExistentes: ['OTRO_SKILL'],
  });
  assert.equal(r.error, undefined);
  assert.equal(r.ok, true);
  assert.equal(r.skillName, 'CALL_INBOUND_AURORA');
  assert.equal(r.campana, 'CLINICA AURORA');
  assert.equal(r.sede, null);
});

test('traficoValidarNuevoMapeo: camino feliz con campana multi-sede -- conserva la sede elegida', () => {
  const r = traficoValidarNuevoMapeo({
    skillName: 'CALL_HLM_CASTILLA', campana: 'HOSPITAL LA MARIA', sede: 'CASTILLA',
    sedesDisponibles: [{ valor: 'CASTILLA' }, { valor: 'SEDE33' }],
  });
  assert.equal(r.ok, true);
  assert.equal(r.sede, 'CASTILLA');
});

// ── traficoResolverSkillsControles / traficoModoDisplaySkills (Fase 65) ──
// Cubre el bug real de la Fase 64: el comparador de "varias lineas" podia
// quedar con una seleccion vieja de 2+ lineas y ganarle a una eleccion
// nueva del usuario en el desplegable principal.
test('traficoResolverSkillsControles: sin nada seleccionado en ningun control -> modo "todas"', () => {
  const r = traficoResolverSkillsControles([], '');
  assert.deepEqual(r, { skills: [], modo: 'todas', skillUna: null });
});

test('traficoResolverSkillsControles: una linea elegida en el desplegable principal -> esa sola', () => {
  const r = traficoResolverSkillsControles([], 'CALL_A');
  assert.deepEqual(r, { skills: ['CALL_A'], modo: 'una', skillUna: 'CALL_A' });
});

test('traficoResolverSkillsControles: el comparador con SOLO 1 seleccionada no cuenta -- cae al desplegable principal', () => {
  const r = traficoResolverSkillsControles(['CALL_A'], 'CALL_B');
  assert.deepEqual(r, { skills: ['CALL_B'], modo: 'una', skillUna: 'CALL_B' });
});

test('traficoResolverSkillsControles: comparador con 2+ gana, sin importar el desplegable principal', () => {
  const r = traficoResolverSkillsControles(['CALL_A', 'CALL_C'], 'CALL_B');
  assert.deepEqual(r, { skills: ['CALL_A', 'CALL_C'], modo: 'multi', skillUna: null });
});

test('traficoResolverSkillsControles: valor "__multi__" (opcion informativa deshabilitada) del desplegable nunca se toma como una linea real', () => {
  const r = traficoResolverSkillsControles([], '__multi__');
  assert.deepEqual(r, { skills: [], modo: 'todas', skillUna: null });
});

test('traficoResolverSkillsControles: el bug real de la Fase 64 -- comparador con 2+ lineas VIEJAS ya no le gana a una eleccion NUEVA del desplegable, porque trafico.js limpia el comparador al cambiar el desplegable (aqui se simula ese estado ya limpio)', () => {
  // Antes del arreglo: seleccionCmp seguia trayendo ['CALL_A','CALL_C']
  // (nunca se limpiaba) y esta funcion (la logica ya existia) las usaba
  // sin mirar que el usuario acababa de elegir CALL_B en el desplegable.
  // El arreglo real esta en _traficoSkillPrincipalCambio (trafico.js): en
  // cuanto el desplegable cambia, vacia el comparador -- por eso, para
  // cuando se llega aqui, seleccionCmp ya esta vacio.
  const comparadorYaLimpio = [];
  const r = traficoResolverSkillsControles(comparadorYaLimpio, 'CALL_B');
  assert.deepEqual(r, { skills: ['CALL_B'], modo: 'una', skillUna: 'CALL_B' });
});

test('traficoModoDisplaySkills: estado.skills con todas las skills reales -> modo "todas"', () => {
  const r = traficoModoDisplaySkills(['CALL_A', 'CALL_B', 'CALL_C'], ['CALL_A', 'CALL_B', 'CALL_C']);
  assert.deepEqual(r, { todas: true, una: null, subsetParcial: false });
});

test('traficoModoDisplaySkills: estado.skills con 1 sola -> modo "una", la reporta en `una`', () => {
  const r = traficoModoDisplaySkills(['CALL_A', 'CALL_B', 'CALL_C'], ['CALL_B']);
  assert.deepEqual(r, { todas: false, una: 'CALL_B', subsetParcial: false });
});

test('traficoModoDisplaySkills: estado.skills con 2+ pero no todas -> subsetParcial true (dispara la opcion "Varias lineas" del desplegable, hallazgo #2 de la Fase 64)', () => {
  const r = traficoModoDisplaySkills(['CALL_A', 'CALL_B', 'CALL_C'], ['CALL_A', 'CALL_C']);
  assert.deepEqual(r, { todas: false, una: null, subsetParcial: true });
});

test('traficoModoDisplaySkills: 2+ seleccionadas que resultan ser TODAS las reales -> modo "todas", no subsetParcial (mismo conteo que datosSkills)', () => {
  const r = traficoModoDisplaySkills(['CALL_A', 'CALL_B'], ['CALL_A', 'CALL_B']);
  assert.deepEqual(r, { todas: true, una: null, subsetParcial: false });
});

// ── traficoAhtPromedioPeriodo (Fase 65) ──────────────────────────────────
// Conecta la tarjeta manual "AHT Promedio" de 6 clientes al dato real de
// Wolkvox -- esta funcion tiene que coincidir EXACTO con el promedio
// ponderado que ya usa traficoAgregar para la sub-pestaña "AHT", no
// inventar una formula nueva.
test('traficoAhtPromedioPeriodo: promedio ponderado por TOTAL LLAMADAS, no un promedio simple', () => {
  const filas = [
    { totalLlamadas: 100, ahtSegundos: 200 },
    { totalLlamadas: 300, ahtSegundos: 240 },
  ];
  // Simple (200+240)/2 = 220 seria INCORRECTO -- ponderado: (100*200+300*240)/400 = 230.
  assert.equal(traficoAhtPromedioPeriodo(filas), 230);
});

test('traficoAhtPromedioPeriodo: filas sin ahtSegundos (null) se ignoran, no cuentan como 0', () => {
  const filas = [
    { totalLlamadas: 100, ahtSegundos: null },
    { totalLlamadas: 200, ahtSegundos: 250 },
  ];
  assert.equal(traficoAhtPromedioPeriodo(filas), 250);
});

test('traficoAhtPromedioPeriodo: filas con totalLlamadas 0 no aportan peso (division por cero evitada)', () => {
  const filas = [
    { totalLlamadas: 0, ahtSegundos: 999 },
    { totalLlamadas: 50, ahtSegundos: 180 },
  ];
  assert.equal(traficoAhtPromedioPeriodo(filas), 180);
});

test('traficoAhtPromedioPeriodo: sin filas -> null (no 0, que se veria como un dato real)', () => {
  assert.equal(traficoAhtPromedioPeriodo([]), null);
  assert.equal(traficoAhtPromedioPeriodo(undefined), null);
});

test('traficoAhtPromedioPeriodo: todas las filas sin ahtSegundos -> null', () => {
  const filas = [{ totalLlamadas: 100, ahtSegundos: null }, { totalLlamadas: 50, ahtSegundos: null }];
  assert.equal(traficoAhtPromedioPeriodo(filas), null);
});

test('traficoAhtPromedioPeriodo: coincide EXACTO con traficoAgregar (granularidad "anio", 1 solo bucket) -- misma formula, mismo resultado que la sub-pestaña AHT', () => {
  const filas = [
    { fecha: '2026-01-01', skillName: 'A', totalLlamadas: 100, contestadas: 90, ahtSegundos: 200 },
    { fecha: '2026-06-01', skillName: 'A', totalLlamadas: 300, contestadas: 280, ahtSegundos: 240 },
  ];
  const agregado = traficoAgregar(filas, { granularidad: 'anio', combinar: true });
  assert.equal(agregado.length, 1);
  assert.equal(agregado[0].periodo, '2026');
  assert.equal(traficoAhtPromedioPeriodo(filas), agregado[0].ahtSegundos);
  assert.equal(traficoAhtPromedioPeriodo(filas), 230);
});
