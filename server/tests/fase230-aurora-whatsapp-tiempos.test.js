// fase230-aurora-whatsapp-tiempos.test.js — Fase 230 (OK del usuario, 03/11):
// Clinica Aurora con WhatsApp por rangos de tiempo, como ORLANT y HLM. Solo
// cambia el registro (modulo whatsapp_tiempos): las pestañas, la regla de
// salida y lo demas de Aurora quedan igual. Modulos de salud y Calidad, no.
'use strict';

const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { db, cleanup } = require('./helpers');
const dbMod = require('../db');
const t = require('../tipificaciones');
const reg = require('../clientes-registro');
const { generarLayout, TABS_EXTRA } = require('../plantillas-cliente');
const { derivarListasRegistro } = require('../../public/js/registro-clientes.js');
const { AURORA, AURORA_MODULOS, auroraEsperada, hlmEsperada } = require('./helpers-aurora');

after(cleanup);

const layoutDe = (c) => JSON.parse(db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get(c).layout);

test('registro: Aurora con whatsapp_tiempos y sin salud', () => {
  const r = reg.leerRegistro(db).find((c) => c.nombre === AURORA);
  assert.deepEqual(r.modulos, AURORA_MODULOS);
  assert.ok(r.modulos.includes('whatsapp_tiempos'));
  for (const m of ['agendas', 'efectividad_agendamiento', 'inasistencia', 'efectividad_citas', 'calidad_resumen']) assert.ok(!r.modulos.includes(m), m);
  assert.equal(r.parametros.salidaUsaClasificacion, true);
  assert.ok(derivarListasRegistro(reg.leerRegistro(db)).whatsappTiempos.includes(AURORA), 'Cargar Datos ofrece los tiempos por rango');
});

test('las pestañas de Aurora son las mismas de la Fase 220 (la sub-vista no agrega pestaña)', () => {
  const antes = generarLayout({ nombre: AURORA, titulo: 'Dashboard Clínica Aurora', modulos: ['flujo_llamadas', 'flujo_whatsapp', 'salida', 'tipificacion', 'calidad'], visibles: ['flujo_llamadas', 'flujo_whatsapp'] });
  const i = antes.layout.tabs.findIndex((x) => x.key === 'salida');
  antes.layout.tabs.splice(i + 1, 0, TABS_EXTRA.total_trafico.crear(AURORA));
  // Fase 259: "Agendas por usuaria" SI agrega una pestaña (aparte de esta fase).
  // Fase 284: tambien sin "Errores" (las dos pestañas son posteriores a esta migracion).
  const sinFase259 = (l) => Object.assign({}, l, { tabs: l.tabs.filter((x) => x.key !== 'agendas_usuaria' && x.key !== 'errores') });
  assert.deepEqual(sinFase259(layoutDe(AURORA)), antes.layout);
  assert.deepEqual(layoutDe(AURORA), auroraEsperada().layout);
});

test('la regla de salida de Aurora sigue igual (provisional) y HLM no cambia', () => {
  assert.deepEqual(t.SALIDA_POR_CLIENTE[AURORA], { regla: 'guion', clasificacionAsesores: false, sinLineas: true, whatsappSalidaSkillIds: ['0', '4062', '4063'] }); // Fases 277-278
  assert.deepEqual(layoutDe('HOSPITAL LA MARIA'), hlmEsperada().layout);
});

test('la migracion es idempotente y conserva retoques de Aurora', () => {
  const layout = layoutDe(AURORA);
  layout.tabs[0].label = 'Tráfico (retocado)';
  db.prepare('UPDATE dashboards_config SET layout = ? WHERE cliente = ?').run(JSON.stringify(layout), AURORA);
  dbMod.habilitarWhatsappTiemposAurora();
  dbMod.habilitarWhatsappTiemposAurora();
  assert.deepEqual(layoutDe(AURORA), layout);
  assert.deepEqual(reg.leerRegistro(db).find((c) => c.nombre === AURORA).modulos, AURORA_MODULOS);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM skills_whatsapp WHERE campana = ?').get(AURORA).n, 1);
});

test('Aurora sin tiempos por rango cargados: el aviso como ORLANT, sin la grafica mensual (Fase 272)', async () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const vm = require('node:vm');
  const llamadas = [];
  const el = { innerHTML: '' };
  const sb = {
    console,
    LISTAS_REGISTRO: derivarListasRegistro(reg.leerRegistro(db)),
    document: { getElementById: (id) => (id === 'gd-p0' ? { dataset: { campana: AURORA } } : el), querySelector: () => null },
    apiRequest: async () => ({ meses: [], skills: [] }),
    _traficoWpp: { [AURORA]: { filas: [{ fecha: '2026-10-01' }] } },
    _traficoWppSubtabActivo: { [AURORA]: 'sl' },
    TRAFICO_WPP_SUBTAB_TITULOS: {},
    _traficoSubtabContentHTML: () => '<div id="grafica-mensual"></div>',
    _traficoWppRenderContenido: (i) => llamadas.push('mensual ' + i),
    canLoadData: () => true,
  };
  vm.createContext(sb);
  const p = path.join(__dirname, '..', '..', 'public', 'js', 'whatsapp-tiempos.js');
  vm.runInContext(fs.readFileSync(p, 'utf8'), sb, { filename: p });
  await sb._wppTiemposRender(0, AURORA);
  assert.deepEqual(llamadas, []);
  assert.doesNotMatch(el.innerHTML, /grafica-mensual|nivel de servicio mensual/);
  assert.match(el.innerHTML, /Sin tiempos de respuesta de WhatsApp cargados/);
});
