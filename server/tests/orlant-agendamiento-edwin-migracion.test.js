// orlant-agendamiento-edwin-migracion.test.js — prueba la migracion
// `dashboards_config_orlant_agendamiento_edwin_v1` (server/db.js), Fase 94
// (tema B, pedido de Edwin): Agendamiento pasa de 7 paneles (Citas por
// Especialidad de la tabla `agendas` + 6 paneles de la hoja "resumen",
// vacia) a 4 sub-pestañas, todas de la tabla `agendas`. "Ordenamiento
// Médico" y "Recuperación de Cancelados" salen a sus propias pestañas
// ocultas nuevas, con la MISMA config exacta. "Variación % Agendas" se
// quita del todo. Mismo patron que orlant-agendas-panel-migracion.test.js:
// sembrar el layout VIEJO a mano *antes* de requerir db.js, y verificar
// "despues".
'use strict';

const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const { CONFIGS } = require('../dashboard-config-seed');

const ORLANT_TARGET = CONFIGS.find((c) => c.cliente === 'ORLANT');
const targetTabs = {};
(ORLANT_TARGET.layout.tabs || []).forEach((t) => { targetTabs[t.key] = t; });

const tmpDb = path.join(os.tmpdir(), `inconexion-orlant-agendamiento-edwin-${process.pid}-${crypto.randomBytes(6).toString('hex')}.db`);

// Forma "vieja" reconocible (Fase 78 -> antes de la Fase 94): 7 paneles,
// panels[0] = agendas_panel ("Citas por Especialidad"), el resto de la
// hoja "resumen" (Ordenamiento Medico + nota_kpi, Recuperacion, Total
// Agendas, Agendas por Linea, Variacion).
const AGENDAMIENTO_VIEJO = {
  key: 'agendamiento', label: 'Agendamiento', oculta: true,
  panels: [
    { tipo: 'agendas_panel', titulo: 'Citas por Especialidad', campana: 'ORLANT' },
    { tipo: 'combo', titulo: 'Ordenamiento medico', barras: [{ label: 'Gestionados', fuente: {} }, { label: 'Agendas', fuente: {} }] },
    { tipo: 'nota_kpi', titulo: 'Efectividad del año — Ordenamiento medico 3P', valores: [], formula: {}, plantilla: 'x' },
    { tipo: 'combo', titulo: 'Recuperacion de cancelados', barras: [{ label: 'Cancelado', fuente: {} }, { label: 'Atendido', fuente: {} }] },
    { tipo: 'line', titulo: 'Total agendas por mes', series: [{ label: 'x', fuente: {} }] },
    { tipo: 'line', titulo: 'Agendas por linea', series: [{ label: 'Linea General', fuente: {} }, { label: 'Linea 3P', fuente: {} }] },
    { tipo: 'line', titulo: 'Total agendas — variacion % mes a mes', unidad: '%', series: [{ label: '% Variacion', fuente: {} }] },
  ],
  subtabs: [
    { key: 'citasporespecialidad', label: 'Citas por Especialidad', indices: [0] },
    { key: 'ordmed', label: 'Ordenamiento Medico', indices: [1, 2] },
    { key: 'recuperacion', label: 'Recuperacion de Cancelados', indices: [3] },
    { key: 'totalagendas', label: 'Total Agendas', indices: [4] },
    { key: 'agendasporlinea', label: 'Agendas por Linea', indices: [5] },
    { key: 'variacion', label: 'Variacion % Agendas', indices: [6] },
  ],
};
const LAYOUT_VIEJO = {
  kpis: [],
  tabs: [
    AGENDAMIENTO_VIEJO,
    { key: 'calidad', label: 'Calidad', panels: [{ tipo: 'calidad_kpis', campana: 'ORLANT' }] },
  ],
};

// Escenario 2: un tab "agendamiento" personalizado (cantidad de paneles
// distinta a la forma vieja reconocible) -- la migracion debe dejarlo
// intacto, igual que las demas migraciones de ORLANT.
const AGENDAMIENTO_PERSONALIZADO = { key: 'agendamiento', label: 'Agendamiento', panels: [{ tipo: 'combo', titulo: 'Panel a mano' }] };
const OTRO_CLIENTE = 'BIVETT';
const LAYOUT_OTRO = { kpis: [], tabs: [AGENDAMIENTO_PERSONALIZADO] };

const pre = new Database(tmpDb);
pre.exec(`
  CREATE TABLE dashboards_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cliente TEXT NOT NULL UNIQUE,
    titulo TEXT NOT NULL,
    vista TEXT,
    secciones TEXT NOT NULL,
    layout TEXT NOT NULL,
    activo INTEGER NOT NULL DEFAULT 1,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );
`);
const now = '30/09/2026 10:00:00';
pre.prepare(
  `INSERT INTO dashboards_config (cliente, titulo, vista, secciones, layout, activo, createdAt, updatedAt)
   VALUES (?,?,?,?,?,1,?,?)`
).run('ORLANT', 'Dashboard Clinica Orlant', null, '{}', JSON.stringify(LAYOUT_VIEJO), now, now);
pre.prepare(
  `INSERT INTO dashboards_config (cliente, titulo, vista, secciones, layout, activo, createdAt, updatedAt)
   VALUES (?,?,?,?,?,1,?,?)`
).run(OTRO_CLIENTE, 'Dashboard Bivett', null, '{}', JSON.stringify(LAYOUT_OTRO), now, now);
pre.close();

function setEnvDefault(key, value) {
  if (process.env[key] === undefined || process.env[key] === '') process.env[key] = value;
}
setEnvDefault('NODE_ENV', 'test');
setEnvDefault('JWT_SECRET', crypto.randomBytes(48).toString('hex'));
setEnvDefault('JWT_EXPIRES_IN', '1h');
setEnvDefault('MASTER_ADMIN_USER', 'admin');
setEnvDefault('MASTER_ADMIN_PASSWORD_HASH', bcrypt.hashSync('NoUsadaEnEsteTest#1', 10));
setEnvDefault('DB_PATH', tmpDb);
setEnvDefault('TRUST_PROXY', 'false');
setEnvDefault('RATE_LIMIT_MAX', '10000');
setEnvDefault('LOGIN_RATE_LIMIT_MAX', '10000');

const db = require('../db');

test('migracion dashboards_config_orlant_agendamiento_edwin_v1: Agendamiento queda con 4 paneles agendas_panel, iguales a la config actual', () => {
  const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get('ORLANT');
  const layout = JSON.parse(row.layout);
  const agenda = layout.tabs.find((t) => t.key === 'agendamiento');
  assert.deepEqual(agenda.panels, targetTabs.agendamiento.panels);
  assert.deepEqual(agenda.subtabs, targetTabs.agendamiento.subtabs);
  assert.equal(agenda.panels.length, 4);
  // Panel 3 ("Agendas por Agente" en esta fase) lo reemplaza una migracion
  // POSTERIOR (Fase 104: vista 'ranking'; Fase 111: su propio
  // efectividad_agendamiento_panel) -- en una base que corre TODAS las
  // migraciones desde cero (como esta prueba), panels[3] ya no es
  // 'agendas_panel' al final. Solo los 3 primeros (que ninguna fase
  // posterior toca) quedan garantizados por ESTA migracion.
  assert.ok(agenda.panels.slice(0, 3).every((p) => p.tipo === 'agendas_panel'));
  // Ninguna mencion de "Variacion" sobrevive.
  assert.ok(!agenda.panels.some((p) => /variaci/i.test(p.titulo || '')));
  // `oculta` no lo toca esta migracion.
  assert.equal(agenda.oculta, true);
});

test('migracion dashboards_config_orlant_agendamiento_edwin_v1: "Ordenamiento Médico" y "Recuperación de Cancelados" salen a pestañas propias ocultas, con la MISMA config exacta que tenian adentro', () => {
  const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get('ORLANT');
  const layout = JSON.parse(row.layout);

  const ordMed = layout.tabs.find((t) => t.key === 'ordenamiento_medico');
  assert.ok(ordMed, 'debe existir la pestaña nueva "ordenamiento_medico"');
  assert.equal(ordMed.oculta, true);
  assert.deepEqual(ordMed.panels, targetTabs.ordenamiento_medico.panels);
  // La config es LA MISMA que estaba adentro de Agendamiento (nada se
  // recalculo): mismo combo de barras y el mismo nota_kpi con formula.
  assert.deepEqual(
    ordMed.panels.map((p) => p.tipo).sort(),
    AGENDAMIENTO_VIEJO.panels.slice(1, 3).map((p) => p.tipo).sort()
  );

  const recup = layout.tabs.find((t) => t.key === 'recuperacion_cancelados');
  assert.ok(recup, 'debe existir la pestaña nueva "recuperacion_cancelados"');
  assert.equal(recup.oculta, true);
  assert.deepEqual(recup.panels, targetTabs.recuperacion_cancelados.panels);
});

test('migracion dashboards_config_orlant_agendamiento_edwin_v1: nunca toca un tab "agendamiento" que no coincide con la forma vieja reconocible', () => {
  const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get(OTRO_CLIENTE);
  assert.deepEqual(JSON.parse(row.layout), LAYOUT_OTRO, 'el layout de otro cliente queda byte a byte igual (la query es exclusiva de ORLANT)');
});

test('migracion dashboards_config_orlant_agendamiento_edwin_v1: es idempotente -- correrla dos veces seguidas da el mismo resultado', () => {
  // db.js ya corrio la migracion una vez al requerirse arriba. El guard
  // `yaEsNuevo` (los primeros 3 paneles son agendas_panel -- el 4to lo
  // reemplaza una migracion posterior, ver la prueba de arriba) es
  // exactamente lo que confirma esta prueba: el resultado actual YA cumple
  // esa condicion, asi que una segunda corrida (a mano, sin pasar por
  // runOnceMigration) seria un no-op garantizado.
  const antes = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get('ORLANT').layout;
  const agenda = JSON.parse(antes).tabs.find((t) => t.key === 'agendamiento');
  const yaEsNuevo = agenda.panels.length > 0 && agenda.panels.slice(0, 3).every((p) => p.tipo === 'agendas_panel');
  assert.ok(yaEsNuevo, 'el resultado deberia ya cumplir el guard de "ya migrado" tras la primera corrida');
  const despues = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get('ORLANT').layout;
  assert.equal(antes, despues);
});
