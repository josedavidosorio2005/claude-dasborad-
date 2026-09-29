// mes-global-logic.test.js — Fase 86, tema 3. El selector "MES" de arriba
// (_gd.mesSel) sincroniza los 5 paneles autonomos (Trafico Llamadas/
// WhatsApp, Agendas, Tipificacion, Calidad) y decide si "Comparar contra"
// (que solo aplica a paneles de RESUMEN) se esconde. Esta prueba cubre la
// logica pura extraida a mes-global-logic.js: gdFinDeMes (fin de la
// ventana movil de 12 meses de Trafico/Calidad) y gdTodosAutonomos
// (cuando se esconde "Comparar contra").
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { GD_TIPOS_AUTONOMOS, gdTodosAutonomos, gdFinDeMes, gdMesesUnion, gdMesPorDefecto } = require('../../public/js/mes-global-logic.js');
const { CONFIGS } = require('../dashboard-config-seed.js');

test('gdFinDeMes: ultimo dia de meses de 31, 30, 28 (no bisiesto) y 29 dias (bisiesto)', () => {
  assert.equal(gdFinDeMes('2026-08'), '2026-08-31');
  assert.equal(gdFinDeMes('2025-04'), '2025-04-30');
  assert.equal(gdFinDeMes('2026-02'), '2026-02-28'); // 2026 no es bisiesto
  assert.equal(gdFinDeMes('2028-02'), '2028-02-29'); // 2028 si es bisiesto
  assert.equal(gdFinDeMes('2026-12'), '2026-12-31');
});

test('gdTodosAutonomos: true solo si TODOS los paneles visibles son de tipo autonomo', () => {
  assert.equal(gdTodosAutonomos([{ tipo: 'agendas_panel' }]), true);
  assert.equal(gdTodosAutonomos([{ tipo: 'agendas_panel' }, { tipo: 'tipificacion_panel' }]), true);
  assert.equal(gdTodosAutonomos([{ tipo: 'agendas_panel' }, { tipo: 'kpi_row' }]), false);
  assert.equal(gdTodosAutonomos([{ tipo: 'kpi_row' }, { tipo: 'line' }]), false);
});

test('gdTodosAutonomos: una lista vacia nunca cuenta como "todos autonomos" (nada que esconder)', () => {
  assert.equal(gdTodosAutonomos([]), false);
  assert.equal(gdTodosAutonomos(undefined), false);
});

function tiposDePanelUsadosPorTodosLosClientes() {
  const tipos = new Set();
  for (const dash of CONFIGS) {
    const layout = dash.layout || {};
    for (const tab of layout.tabs || []) {
      for (const p of tab.panels || []) {
        if (p.tipo) tipos.add(p.tipo);
      }
    }
  }
  return tipos;
}

// Lista CERRADA (mismo patron que dashboard-generic-export-fase85-lista-
// cerrada.test.js): si una fase futura agrega un tipo de panel nuevo a
// algun cliente sembrado, esta prueba EMPIEZA A FALLAR hasta que alguien
// decida a proposito si es autonomo (su propia ventana de tiempo, sin
// "periodo anterior") o de resumen (usa "Comparar contra") -- nunca se cae
// en un tercer estado sin clasificar.
const GD_TIPOS_RESUMEN_CONOCIDOS = ['bar', 'combo', 'line', 'nota_kpi', 'pie', 'kpi_row', 'tabla'];

test('lista CERRADA de tipos de panel: todo tipo usado por un cliente sembrado es autonomo o de resumen, nunca sin clasificar', () => {
  const usados = tiposDePanelUsadosPorTodosLosClientes();
  const conocidos = new Set([...GD_TIPOS_AUTONOMOS, ...GD_TIPOS_RESUMEN_CONOCIDOS]);
  const sinClasificar = [...usados].filter((t) => !conocidos.has(t));
  assert.deepEqual(sinClasificar, [], `estos tipos de panel se usan en algun dashboard sembrado pero no estan clasificados como autonomo ni de resumen: ${sinClasificar.join(', ')}`);
});

test('GD_TIPOS_AUTONOMOS cubre exactamente los 5 paneles autonomos de ORLANT (Trafico Llamadas/WhatsApp, Agendas, Tipificacion, Calidad)', () => {
  const orlant = CONFIGS.find((d) => d.cliente === 'ORLANT');
  assert.ok(orlant, 'ORLANT debe estar sembrado');
  const usados = new Set();
  for (const tab of (orlant.layout && orlant.layout.tabs) || []) {
    for (const p of tab.panels || []) if (p.tipo) usados.add(p.tipo);
  }
  const autonomosUsados = [...usados].filter((t) => GD_TIPOS_AUTONOMOS.indexOf(t) !== -1).sort();
  assert.deepEqual(autonomosUsados, ['agendas_panel', 'calidad_kpis', 'calidad_pie', 'tipificacion_panel', 'trafico_combo', 'trafico_whatsapp_combo']);
});

// ── gdMesesUnion / gdMesPorDefecto (Fase 90, tema B) ─────────────────────
// Hallazgo real en produccion: el selector "MES" de arriba solo miraba
// dashboard_cargas (nunca Agendas/Tipificacion/Trafico/Calidad, que viven
// en sus propias tablas) -- ORLANT abria en "Sep-26" con el subtitulo asi,
// pero el selector solo ofrecia "Ago-26" como opcion (mesSel no era ni
// siquiera una opcion real, por eso el <select> se veia en blanco).
test('gdMesesUnion: junta varias listas, sin duplicados, ordenada de mas reciente a mas antiguo', () => {
  assert.deepEqual(
    gdMesesUnion([['2026-04', '2026-07'], ['2026-08'], ['2026-07', '2026-05']]),
    ['2026-08', '2026-07', '2026-05', '2026-04']
  );
});

test('gdMesesUnion: acepta fechas completas (AAAA-MM-DD) o ya recortadas (AAAA-MM), ignora valores vacios/invalidos', () => {
  assert.deepEqual(
    gdMesesUnion([['2026-08-15', '2025-04-30 19:00:00'], ['2026-08'], [null, '', undefined, 'x']]),
    ['2026-08', '2025-04']
  );
});

test('gdMesesUnion: listas vacias o ausentes -> lista vacia', () => {
  assert.deepEqual(gdMesesUnion([]), []);
  assert.deepEqual(gdMesesUnion([[], []]), []);
  assert.deepEqual(gdMesesUnion(undefined), []);
});

test('gdMesPorDefecto: el hallazgo real -- Trafico Llamadas/Tipificacion en Ago-26, dashboard_cargas con una fila suelta en Sep-26 -- el mes por defecto es Ago-26, no Sep-26', () => {
  const mesesPrincipales = gdMesesUnion([['2026-08'], ['2026-08']]); // Trafico Llamadas + Tipificacion
  const mesesTodos = gdMesesUnion([['2026-09'], mesesPrincipales, ['2025-04']]); // dashboard_cargas (Sep suelto) + Agendas (Abr-25)
  assert.deepEqual(mesesTodos, ['2026-09', '2026-08', '2025-04'], 'Sep-26 SI es una opcion valida del selector (existe en algun dato)');
  assert.equal(gdMesPorDefecto(mesesPrincipales, mesesTodos), '2026-08', 'el mes por defecto nunca es un mes sin Trafico Llamadas/Tipificacion si existe uno mejor');
});

test('gdMesPorDefecto: sin Trafico Llamadas ni Tipificacion (ej. Clinica Aurora/Hospital La Maria hoy) -> el mes mas reciente con CUALQUIER dato', () => {
  const mesesPrincipales = gdMesesUnion([[], []]);
  const mesesTodos = gdMesesUnion([['2026-06'], ['2026-05']]);
  assert.equal(gdMesPorDefecto(mesesPrincipales, mesesTodos), '2026-06');
});

test('gdMesPorDefecto: sin ningun dato en absoluto -> cadena vacia (selector "Sin datos")', () => {
  assert.equal(gdMesPorDefecto([], []), '');
  assert.equal(gdMesPorDefecto(undefined, undefined), '');
});

test('gdMesPorDefecto: nunca devuelve un mes que no este en mesesTodos (defensivo -- el selector solo ofrece mesesTodos como opciones)', () => {
  // mesesPrincipales con un mes que por algun motivo no llego a mesesTodos:
  // cae a mesesTodos[0] en vez de devolver un mes "fantasma".
  assert.equal(gdMesPorDefecto(['2026-09'], ['2026-08', '2026-07']), '2026-08');
});
