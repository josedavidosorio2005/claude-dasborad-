// fase159-flujo-histqueue-wolkvox.test.js — Fase 159: el reporte nativo
// de la cola de Wolkvox (hoja "HistQueue<fecha>-<hora>") trae las llamadas
// como INBOUND_CALLS / ANSWER_CALLS / ABANDON_CALLS. El lector solo conocia
// TOTAL LLAMADAS / LLAMADAS CONTESTADAS / LLAMADAS ABANDONADAS (y los alias
// de Mobilize), asi que la hoja no se reconocia y el Centro de cargas
// terminaba diciendo "No se encontro la hoja DATA". Verificado contra la
// estructura del archivo real (solo encabezados, tipos de celda y
// agregados): en todas sus filas INBOUND_CALLS = ANSWER_CALLS +
// ABANDON_CALLS. Datos 100% sinteticos.
'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const XLSX = require('../../public/js/vendor/xlsx-0.20.3.full.min.js');
const T = require('../../public/js/trafico-logic.js');
const CL = require('../../public/js/cargas-logic.js');
const CC = require('../../public/js/centro-cargas-logic.js');
const { app, db, request, tokenFor, MASTER_PASSWORD, cleanup } = require('./helpers');

after(cleanup);
const auth = (t) => ({ Authorization: 'Bearer ' + t });

const HOJA = 'HistQueue20261020-115718';
const ENCABEZADO = ['SKILL_NAME', 'DATE', 'INBOUND_CALLS', 'ANSWER_CALLS', 'ABANDON_CALLS',
  'SERVICE_LEVEL_10SEC', 'SERVICE_LEVEL_20SEC', 'SERVICE_LEVEL_30SEC', 'ABANDON', 'ASA', 'ATA', 'WAIT_TIME', 'AHT'];
// Mismo mapeo que _cargasTraficoColumnas (cargas.js).
const COLUMNAS_TRAFICO = T.TRAFICO_COLUMNAS.map((c) => ({ key: c.key, label: c.label, labelAlt: c.aliases, opcional: !c.obligatoria }));

const serial = (iso) => Math.round(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 86400000) + 25569;
// 14 dias del 11 al 31 de agosto (7 sin filas dentro del rango, ninguno del 1 al 10).
const DIAS = [11, 12, 13, 14, 18, 19, 20, 21, 22, 25, 26, 27, 28, 31];
const SKILLS = ['SKILL SAC', 'Skill Key Account'];
// 17 filas: los 14 dias en SKILL SAC y 3 en Skill Key Account. 67 / 64 / 3.
function filasSinteticas() {
  const filas = [];
  DIAS.forEach((d, i) => {
    const ab = i < 3 ? 1 : 0;
    filas.push({ skill: SKILLS[0], fecha: '2026-08-' + String(d).padStart(2, '0'), ans: (i < 11 ? 4 : 3) + 0, ab });
  });
  [12, 20, 27].forEach((d) => filas.push({ skill: SKILLS[1], fecha: '2026-08-' + String(d).padStart(2, '0'), ans: 1, ab: 0 }));
  // ajuste a los totales de la prueba: 64 contestadas, 3 abandonadas
  const ans = filas.reduce((a, f) => a + f.ans, 0);
  filas[filas.length - 1].ans += 64 - ans;
  return filas;
}

// Libro igual al export nativo: fecha serial con formato m/d/yy, porcentajes
// y ASA/ATA como texto, WAIT_TIME/AHT como hora de Excel, y dos AHT "----".
function libroHistQueue(opts) {
  const o = opts || {};
  const enc = o.encabezado || ENCABEZADO;
  const ws = {};
  const filas = filasSinteticas();
  const put = (r, c, cell) => { ws[XLSX.utils.encode_cell({ r, c })] = cell; };
  enc.forEach((h, c) => put(0, c, { t: 's', v: h }));
  filas.forEach((f, i) => {
    const r = i + 1;
    const inbound = f.ans + f.ab;
    put(r, 0, { t: 's', v: f.skill });
    put(r, 1, { t: 'n', v: serial(f.fecha), z: 'm/d/yy' });
    put(r, 2, { t: 'n', v: inbound });
    put(r, 3, { t: 'n', v: f.ans });
    put(r, 4, { t: 'n', v: f.ab });
    put(r, 5, { t: 's', v: '80.5 %' });
    put(r, 6, { t: 's', v: '90.25 %' });
    put(r, 7, { t: 's', v: '100.0 %' });
    put(r, 8, { t: 's', v: '3.1%' });
    put(r, 9, { t: 's', v: '12.5' });
    put(r, 10, { t: 's', v: '30' });
    put(r, 11, { t: 'n', v: 15 / 86400, z: 'h:mm:ss' });
    put(r, 12, i < 2 ? { t: 's', v: '----' } : { t: 'n', v: 215 / 86400, z: 'h:mm:ss' });
  });
  let ultima = filas.length;
  if (o.basura) {
    // fila vacia, encabezado repetido y fila de total al final
    ultima += 2;
    enc.forEach((h, c) => put(ultima, c, { t: 's', v: h }));
    ultima += 1;
    put(ultima, 0, { t: 's', v: 'TOTAL' }); put(ultima, 1, { t: 'n', v: serial('2026-08-31'), z: 'm/d/yy' });
    put(ultima, 2, { t: 'n', v: 67 }); put(ultima, 3, { t: 'n', v: 64 }); put(ultima, 4, { t: 'n', v: 3 });
  }
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: ultima, c: enc.length - 1 } });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, HOJA);
  // Ida y vuelta por un .xlsx real, leido con las MISMAS opciones de cargas.js.
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return XLSX.read(buf, { type: 'buffer', sheetStubs: true, cellNF: true });
}
function leer(wb) {
  const ws = wb.Sheets[wb.SheetNames[0]];
  return { ws, aoa: XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: null }) };
}
const suma = (filas, k) => filas.reduce((a, f) => a + (f[k] || 0), 0);

test('la hoja HistQueue nativa se reconoce por sus encabezados, sin cambiarle el nombre', () => {
  const wb = libroHistQueue();
  assert.deepEqual(wb.SheetNames, [HOJA]);
  const enc = CL.cargasLeerEncabezadoAcotado(XLSX.utils, wb.Sheets[HOJA], 20);
  assert.deepEqual(enc, ENCABEZADO);
  assert.ok(CL.cargasEncabezadosCoinciden(enc, COLUMNAS_TRAFICO), 'INBOUND_CALLS/ANSWER_CALLS deben calzar con las obligatorias');
});

test('voz o WhatsApp: el mismo encabezado diario de Wolkvox lo decide el destino elegido en el Centro', () => {
  const W = require('../../public/js/trafico-whatsapp-logic.js');
  const canal = (enc, elegido) => CL.cargasDetectarCanalTrafico(enc, T.traficoColIndexMap, W.traficoWppColIndexMap, W.traficoWppEsFormatoDiario, elegido);
  assert.equal(canal(ENCABEZADO, 'voz'), 'voz', 'Centro -> Flujo de Llamadas');
  assert.equal(canal(ENCABEZADO, 'whatsapp'), 'whatsapp', 'Centro -> Flujo de WhatsApp');
  assert.equal(canal(ENCABEZADO), 'whatsapp', 'fuera del Centro: igual que antes (Fase 116)');
  assert.equal(canal(ENCABEZADO.concat(['SERVICE_LEVEL_5MIN']), 'voz'), 'whatsapp', 'una columna solo de WhatsApp manda');
  assert.equal(canal(['SKILL_NAME', 'DATE', 'TOTAL LLAMADAS', 'LLAMADAS CONTESTADAS']), 'voz', 'ORLANT de siempre');
  assert.equal(canal(['NOMBRE_COLA_WHATSAPP', 'FECHA INICIO', 'FECHA FIN', 'TOTAL WHATSAPP', 'WHATSAPP CONTESTADOS'], 'voz'), 'whatsapp', 'formato de periodo');
});

test('el lector procesa el archivo nativo: 17 filas, 67 / 64 / 3, sin inventar AHT', () => {
  const { ws, aoa } = leer(libroHistQueue());
  const r = T.traficoParseFilas(aoa, ws);
  assert.ok(!r.error, r.error);
  assert.equal(r.filas.length, 17);
  assert.equal(suma(r.filas, 'totalLlamadas'), 67);
  assert.equal(suma(r.filas, 'contestadas'), 64);
  assert.equal(suma(r.filas, 'llamadasAbandonadas'), 3);
  assert.deepEqual(r.skills, ['SKILL SAC', 'Skill Key Account']);
  assert.deepEqual(r.meses, ['2026-08']);
  const fechas = r.filas.map((f) => f.fecha).sort();
  assert.equal(fechas[0], '2026-08-11');
  assert.equal(fechas[fechas.length - 1], '2026-08-31');
  const f0 = r.filas[0];
  assert.equal(f0.serviceLevel10secPct, 80.5);
  assert.equal(f0.serviceLevel20secPct, 90.25);
  assert.equal(f0.serviceLevel30secPct, 100);
  assert.equal(f0.asaSegundos, 12.5);
  assert.equal(f0.ataSegundos, 30);
  assert.equal(f0.waitTimeSegundos, 15);
  assert.equal(r.filas.filter((f) => f.ahtSegundos === undefined).length, 2, '"----" queda sin dato, nunca 0');
  assert.equal(r.filas.filter((f) => f.ahtSegundos === 215).length, 15);
});

test('resumen para la vista previa: fechas, skills e ingresadas/contestadas/abandonadas', () => {
  const { ws, aoa } = leer(libroHistQueue());
  const r = T.traficoResumenCarga(T.traficoParseFilas(aoa, ws).filas);
  assert.deepEqual(r, { ingresadas: 67, contestadas: 64, abandonadas: 3, desde: '2026-08-11', hasta: '2026-08-31', dias: 14, skills: ['SKILL SAC', 'Skill Key Account'] });
});

test('fila vacia, encabezado repetido y fila TOTAL se omiten con aviso (no se suman)', () => {
  const { ws, aoa } = leer(libroHistQueue({ basura: true }));
  const r = T.traficoParseFilas(aoa, ws);
  assert.ok(!r.error, r.error);
  assert.equal(r.filas.length, 17);
  assert.equal(suma(r.filas, 'totalLlamadas'), 67);
  assert.equal(r.avisos.filter((a) => /se omitio/.test(a)).length, 2, JSON.stringify(r.avisos));
});

test('alias y compatibilidad: ORLANT (TOTAL LLAMADAS...) y Mobilize viejo (LLAMADAS INGRESADAS...) siguen igual', () => {
  const orlant = ['SKILL_NAME', 'DATE', 'TOTAL LLAMADAS', 'LLAMADAS CONTESTADAS', 'LLAMADAS ABANDONADAS', 'ASA'];
  const mobilizeViejo = ['TIPO DE LINEA', 'DÍA', 'LLAMADAS INGRESADAS', 'LLAMADAS CONTESTADAS', 'LLAMADAS ABANDONADAS'];
  for (const enc of [orlant, mobilizeViejo]) {
    assert.ok(CL.cargasEncabezadosCoinciden(enc, COLUMNAS_TRAFICO), enc.join(','));
    const r = T.traficoParseFilas([enc, ['SKILL X', '01/08/2026', 10, 8, 2, '5']]);
    assert.ok(!r.error, r.error);
    assert.deepEqual([r.filas[0].totalLlamadas, r.filas[0].contestadas, r.filas[0].llamadasAbandonadas], [10, 8, 2]);
  }
  // Columnas en otro orden y una adicional desconocida.
  const r = T.traficoParseFilas([['EXTRA', 'ANSWER_CALLS', 'DATE', 'INBOUND_CALLS', 'SKILL_NAME'], ['x', 8, '01/08/2026', 10, 'SKILL X']]);
  assert.ok(!r.error, r.error);
  assert.deepEqual([r.filas[0].totalLlamadas, r.filas[0].contestadas, r.filas[0].llamadasAbandonadas], [10, 8, undefined]);
});

test('encabezado desconocido: no se reconoce y el aviso dice que falta y que encontro (nunca "falta DATA")', () => {
  const enc = ENCABEZADO.map((h) => (h === 'INBOUND_CALLS' ? 'LLAMADAS_RECIBIDAS' : h));
  assert.ok(!CL.cargasEncabezadosCoinciden(enc, COLUMNAS_TRAFICO));
  const msg = CL.cargasDiagnosticoSinHoja('Trafico de Llamadas', [{ nombre: HOJA, encabezado: enc }], COLUMNAS_TRAFICO);
  assert.ok(msg, 'debe haber diagnostico');
  assert.match(msg, /HistQueue20261020-115718/);
  assert.match(msg, /TOTAL LLAMADAS \(o LLAMADAS INGRESADAS, INBOUND_CALLS\)/);
  assert.match(msg, /LLAMADAS_RECIBIDAS/);
  assert.doesNotMatch(msg, /DATA/);
  // Una hoja sin nada en comun (ej. INSTRUCCIONES) no genera diagnostico.
  assert.equal(CL.cargasDiagnosticoSinHoja('Trafico de Llamadas', [{ nombre: 'INSTRUCCIONES', encabezado: ['PASO', 'DETALLE'] }], COLUMNAS_TRAFICO), null);
  // Y cargasProcesarHoja usa el diagnostico en vez de "No se encontro la hoja".
  const r = CL.cargasProcesarHoja({ tipo: 'trafico', hoja: 'DATA', titulo: 'Trafico de Llamadas' }, null, null, T.traficoParseFilas, [HOJA], msg);
  assert.equal(r.error, msg);
});

test('un archivo de otro modulo no entra como Flujo de Llamadas', () => {
  const histCdr = ['AGENT_NAME', 'DATE', 'DESTINY', 'TELEPHONE', 'TIME_SEC', 'COD_ACT', 'DESCRIPTION_COD_ACT', 'SKILL_NAME'];
  assert.ok(!CL.cargasEncabezadosCoinciden(histCdr, COLUMNAS_TRAFICO), 'Tipificacion (HistCDR)');
  const unicas = ['AGENT_NAME', 'DATE', 'TELEPHONE', 'SKILL_NAME'];
  assert.ok(!CL.cargasEncabezadosCoinciden(unicas, COLUMNAS_TRAFICO), 'Llamadas unicas');
});

test('cliente equivocado: skills que no son de MOBILIZE se ignoran en el Centro (no se guardan)', () => {
  const { ws, aoa } = leer(libroHistQueue());
  const r = Object.assign({ tipo: 'trafico' }, T.traficoParseFilas(aoa, ws));
  const f = CC.centroFiltrarResultado(r, 'flujo_llamadas', '2026-08', { skillsDelCliente: { 'OTRA SKILL': true } });
  assert.equal((f.filas || []).length, 0);
  const g = CC.centroFiltrarResultado(r, 'flujo_llamadas', '2026-08', { skillsDelCliente: { 'SKILL SAC': true, 'Skill Key Account': true } });
  assert.equal(g.filas.length, 17);
});

test('reporte parcial de agosto: la vista previa avisa que no trae el mes completo', () => {
  const { ws, aoa } = leer(libroHistQueue());
  const fechas = T.traficoParseFilas(aoa, ws).filas.map((f) => f.fecha);
  const txt = CC.centroTextoCobertura('2026-08', fechas, '2026-10-20');
  assert.equal(txt, 'Ojo: el archivo no trae agosto completo. Tiene datos de 14 de 31 días: faltan del 1 al 10 de agosto y 7 día(s) más entre el 11 y el 31. Los días que no vienen no se rellenan con cero.');
  const todos = Array.from({ length: 31 }, (_, i) => '2026-08-' + String(i + 1).padStart(2, '0'));
  assert.equal(CC.centroTextoCobertura('2026-08', todos, '2026-10-20'), null, 'mes completo: sin aviso');
  // Mes en curso: cuenta solo hasta hoy.
  const hastaHoy = Array.from({ length: 20 }, (_, i) => '2026-10-' + String(i + 1).padStart(2, '0'));
  assert.equal(CC.centroTextoCobertura('2026-10', hastaHoy, '2026-10-20'), null);
});

test('guardar el archivo parcial no toca los dias 1-10 ni otro cliente, y los numeros quedan exactos', async () => {
  const t = await tokenFor('admin', MASTER_PASSWORD);
  for (const s of [...SKILLS, 'SKILL ORLANT F159']) {
    const c = s === 'SKILL ORLANT F159' ? 'ORLANT' : 'MOBILIZE';
    const m = await request(app).put('/api/calidad/trafico/skills/' + encodeURIComponent(s)).set(auth(t)).send({ campana: c });
    assert.equal(m.status, 200, JSON.stringify(m.body));
  }
  // Ya cargado antes: 1 al 10 de agosto de MOBILIZE, y agosto de otro cliente.
  const previo = [];
  for (let d = 1; d <= 10; d++) previo.push({ fecha: '2026-08-' + String(d).padStart(2, '0'), skillName: 'SKILL SAC', totalLlamadas: 50, contestadas: 45, llamadasAbandonadas: 5 });
  for (let d = 1; d <= 31; d++) previo.push({ fecha: '2026-08-' + String(d).padStart(2, '0'), skillName: 'SKILL ORLANT F159', totalLlamadas: 7, contestadas: 6, llamadasAbandonadas: 1 });
  assert.equal((await request(app).post('/api/calidad/trafico/carga').set(auth(t)).send({ filas: previo })).status, 201);
  const leerBase = (skill) => db.prepare('SELECT fecha, totalLlamadas, contestadas, llamadasAbandonadas, ahtSegundos FROM calidad_nivel_servicio_diario WHERE skillName = ? ORDER BY fecha').all(skill);
  const orlantAntes = leerBase('SKILL ORLANT F159');

  const { ws, aoa } = leer(libroHistQueue());
  const parsed = Object.assign({ tipo: 'trafico' }, T.traficoParseFilas(aoa, ws));
  const f = CC.centroFiltrarResultado(parsed, 'flujo_llamadas', '2026-08', { skillsDelCliente: { 'SKILL SAC': true, 'Skill Key Account': true } });
  const g = await request(app).post('/api/calidad/trafico/carga').set(auth(t)).send({ archivoNombre: 'sintetico.xlsx', filas: f.filas });
  assert.equal(g.status, 201, JSON.stringify(g.body));

  const sac = leerBase('SKILL SAC');
  assert.equal(sac.filter((r) => r.fecha <= '2026-08-10').length, 10, 'los dias 1-10 siguen');
  assert.ok(sac.filter((r) => r.fecha <= '2026-08-10').every((r) => r.totalLlamadas === 50 && r.contestadas === 45));
  assert.deepEqual(leerBase('SKILL ORLANT F159'), orlantAntes, 'otro cliente intacto');
  const nuevas = [...sac.filter((r) => r.fecha >= '2026-08-11'), ...leerBase('Skill Key Account')];
  assert.equal(nuevas.length, 17);
  assert.equal(suma(nuevas, 'totalLlamadas'), 67);
  assert.equal(suma(nuevas, 'contestadas'), 64);
  assert.equal(suma(nuevas, 'llamadasAbandonadas'), 3);
  assert.equal(nuevas.filter((r) => r.ahtSegundos === null).length, 2, 'AHT "----" se guarda vacio, no 0');
});
