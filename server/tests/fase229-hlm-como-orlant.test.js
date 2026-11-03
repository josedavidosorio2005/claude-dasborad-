// fase229-hlm-como-orlant.test.js — Fase 229 (OK del usuario, 03/11): Hospital
// La Maria como ORLANT, igual que Aurora en la Fase 220: Tipificacion (CDR de
// llamadas y WhatsApp), "Llamadas y WhatsApp de salida" (del CDR, regla de
// ORLANT provisional en SALIDA_POR_CLIENTE), "Total tráfico" y WhatsApp por
// rangos de tiempo. Modulos de salud y Calidad, no. Datos inventados.
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { db, cleanup } = require('./helpers');
const dbMod = require('../db');
const t = require('../tipificaciones');
const reg = require('../clientes-registro');
const { salidaCombinadaPorMes } = require('../salida-cdr');
const { totalTraficoPorMes } = require('../total-trafico');
const centro = require('../centro-cargas');
const { derivarListasRegistro } = require('../../public/js/registro-clientes.js');
const { HLM, HLM_MODULOS, hlmEsperada, auroraEsperada } = require('./helpers-aurora');

after(cleanup);

function fila(agente, skill, tipo, skillId, n, dia = 1) {
  return Array.from({ length: n }, (_, k) => [agente, '2026-10-' + String(dia + (k % 9)).padStart(2, '0'), null, 1, 'AGENDADO', skill, 60, '1', tipo, null, skillId]);
}
// HLM, octubre: llamadas -> 5 de salida ("-"), 7 de entrada; WhatsApp -> 2 de salida (SKILL_ID 0), 4 de entrada.
t.cargarTipificaciones(db, { campana: HLM, canal: 'LLAMADAS', archivoNombre: 'cdr.xlsx', cargadoPorNombre: 'test', filas: [
  ...fila('ASESOR X', '-', 'outbound_ma', '-', 3),
  ...fila('ASESOR Y', '-', 'otro', '-', 2),
  ...fila('ASESOR X', 'COLA HLM', 'inbound', '700', 7),
] });
t.cargarTipificaciones(db, { campana: HLM, canal: 'WHATSAPP', archivoNombre: 'chat.xlsx', cargadoPorNombre: 'test', filas: [
  ...fila('ASESOR X', 'WPP HLM', 'outbound_ma', '0', 2),
  ...fila('ASESOR Y', 'WPP HLM', 'inbound', '15', 4),
] });

test('registro: los modulos de ORLANT sin salud ni nada nuevo de Calidad, y reparto General / 3P', () => {
  const r = reg.leerRegistro(db).find((c) => c.nombre === HLM);
  assert.deepEqual(r.modulos, HLM_MODULOS);
  assert.equal(r.parametros.salidaUsaClasificacion, true);
  assert.deepEqual(r.parametros.sedes, [], 'sin sedes hasta que Edwin diga');
  for (const m of ['agendas', 'efectividad_agendamiento', 'inasistencia', 'efectividad_citas', 'calidad_resumen']) assert.ok(!r.modulos.includes(m), m);
  assert.equal(db.prepare('SELECT 1 FROM calidad_plantillas WHERE campana = ?').get(HLM), undefined, 'Calidad sigue sin plantilla');
});

test('tablero: Salida, Total tráfico y Tipificacion; las pestañas de antes, tal cual', () => {
  const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get(HLM);
  assert.deepEqual(JSON.parse(row.layout), hlmEsperada().layout);
  // Las pestañas comunes son las mismas de Aurora (cambiando el nombre del cliente), sin contar "oculta".
  const sinOculta = (x) => JSON.stringify(Object.assign({}, x, { oculta: undefined }));
  const aur = auroraEsperada().layout.tabs;
  hlmEsperada().layout.tabs.forEach((x) => assert.equal(sinOculta(x).split(HLM).join('CLINICA AURORA'), sinOculta(aur.find((a) => a.key === x.key)), x.key));
});

test('Cargar Datos: CDR de Tipificacion y WhatsApp por rangos; la salida sale del CDR (sin la hoja manual)', () => {
  const listas = derivarListasRegistro(reg.leerRegistro(db));
  assert.ok(listas.tipificacionExtra.includes(HLM));
  assert.ok(listas.whatsappTiempos.includes(HLM));
  assert.equal(centro.cargaRetiradaPara(HLM, centro.CARGAS_POR_MODULO.salida[0]), true);
  assert.deepEqual(db.prepare('SELECT codigo, nombre FROM skills_whatsapp WHERE campana = ?').all(HLM), [{ codigo: '0', nombre: 'WHATSAPP DE SALIDA' }]);
});

test('salida con la regla de ORLANT (provisional): sin clasificar va a "Sin clasificar" y cuenta en el Total', () => {
  assert.deepEqual(t.SALIDA_POR_CLIENTE[HLM], { regla: 'guion', clasificacionAsesores: true });
  const oct = salidaCombinadaPorMes(db, HLM).find((f) => f.mes === '2026-10');
  assert.deepEqual([oct.llamadas3p, oct.llamadasGeneral, oct.llamadasSinAsignar], [0, 0, 5]);
  assert.deepEqual([oct.wpp3p, oct.wppGeneral, oct.wppSinAsignar], [0, 0, 2]);
  const tt = totalTraficoPorMes(db, HLM).find((f) => f.mes === '2026-10');
  assert.deepEqual([tt.llamadasSalida, tt.whatsappSalida], [5, 2]);
});

test('la migracion es idempotente y conserva lo que ya tenia HLM', () => {
  // Simula una pestaña de Trafico ya destapada y retocada a mano.
  const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get(HLM);
  const layout = JSON.parse(row.layout);
  layout.tabs[0].oculta = false;
  layout.tabs[0].label = 'Tráfico (retocado)';
  db.prepare('UPDATE dashboards_config SET layout = ? WHERE cliente = ?').run(JSON.stringify(layout), HLM);
  dbMod.habilitarHospitalLaMariaComoOrlant();
  dbMod.habilitarHospitalLaMariaComoOrlant();
  const despues = JSON.parse(db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get(HLM).layout);
  assert.deepEqual(despues, layout);
  assert.deepEqual(reg.leerRegistro(db).find((c) => c.nombre === HLM).modulos, HLM_MODULOS);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM skills_whatsapp WHERE campana = ?').get(HLM).n, 1);
});

test('Aurora no cambia con la migracion de HLM', () => {
  const aur = JSON.parse(db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get('CLINICA AURORA').layout);
  assert.deepEqual(aur, auroraEsperada().layout);
  assert.ok(!derivarListasRegistro(reg.leerRegistro(db)).whatsappTiempos.includes('CLINICA AURORA'));
});

// ── WhatsApp por rangos sin datos: la grafica mensual de siempre ──
function sandboxTiempos({ conRangos, conMensual }) {
  const llamadas = [];
  const el = { innerHTML: '' };
  const sb = {
    console,
    LISTAS_REGISTRO: { whatsappTiempos: [HLM] },
    document: { getElementById: (id) => (id === 'gd-p0' ? { dataset: { campana: HLM } } : el), querySelector: () => null },
    apiRequest: async () => (conRangos ? { meses: ['2026-10'], skills: [] } : { meses: [], skills: [] }),
    _traficoWpp: conMensual ? { [HLM]: { filas: [{ fecha: '2026-08-01' }] } } : {},
    _traficoWppSubtabActivo: { [HLM]: 'sl' },
    TRAFICO_WPP_SUBTAB_TITULOS: {},
    _traficoSubtabContentHTML: () => '<div id="grafica-mensual"></div>',
    _traficoWppRenderContenido: (i) => llamadas.push('mensual ' + i),
    canLoadData: () => true,
  };
  vm.createContext(sb);
  const p = path.join(__dirname, '..', '..', 'public', 'js', 'whatsapp-tiempos.js');
  vm.runInContext(fs.readFileSync(p, 'utf8'), sb, { filename: p });
  return { sb, el, llamadas };
}

test('WhatsApp por rangos sin tiempos cargados: si hay % mensual, se ve la grafica mensual con una nota', async () => {
  const { sb, el, llamadas } = sandboxTiempos({ conRangos: false, conMensual: true });
  await sb._wppTiemposRender(0, HLM);
  assert.deepEqual(llamadas, ['mensual 0']);
  assert.match(el.innerHTML, /se muestra el nivel de servicio mensual/);
  assert.match(el.innerHTML, /grafica-mensual/);
  assert.equal(sb._wppTiemposActivo(0), false, 'los filtros y Excel/PDF vuelven a ser los de la grafica mensual');
});

test('WhatsApp por rangos sin tiempos ni % mensual: el aviso de siempre', async () => {
  const { sb, el, llamadas } = sandboxTiempos({ conRangos: false, conMensual: false });
  await sb._wppTiemposRender(0, HLM);
  assert.deepEqual(llamadas, []);
  assert.match(el.innerHTML, /Sin tiempos de respuesta de WhatsApp cargados/);
  assert.equal(sb._wppTiemposActivo(0), true);
});
