// dashboards-config-orlant-texto-tildes-migracion.test.js — prueba la
// migracion `dashboards_config_orlant_texto_tildes_v1` (server/db.js), Fase
// 87 (tema C, nota del jefe: "unificar tipo de letra / letra capital").
// Mismo patron que orlant-kpis-vacios-migracion.test.js: sembrar el layout
// VIEJO a mano *antes* de requerir db.js, y verificar "despues".
'use strict';

const os = require('os');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const tmpDb = path.join(os.tmpdir(), `inconexion-orlant-texto-tildes-${process.pid}-${crypto.randomBytes(6).toString('hex')}.db`);

// Forma "vieja" reconocible (pre-Fase 87): sin tildes, con "Trafico"/
// "Tipificacion"/"Linea General"/etc tal como estaban antes de esta fase.
const LAYOUT_ORLANT_VIEJO = {
  tabs: [
    { key: 'flujo', label: 'Flujo Mensual', oculta: true, panels: [
      { tipo: 'line', titulo: 'Llamadas Linea General por mes', series: [] },
    ], subtabs: [
      { key: 'llamadasgeneral', label: 'Llamadas Linea General', indices: [0] },
    ] },
    { key: 'tipificacion', label: 'Tipificacion', oculta: true, panels: [
      { tipo: 'tipificacion_panel', titulo: 'Tipificacion', campana: 'ORLANT' },
    ] },
    { key: 'agendamiento', label: 'Agendamiento', oculta: true, panels: [
      { tipo: 'combo', titulo: 'Ordenamiento medico', barras: [{ label: 'Gestionados', fuente: {} }] },
      { tipo: 'combo', titulo: 'Recuperacion de cancelados', barras: [] },
      { tipo: 'line', titulo: 'Agendas por linea', series: [{ label: 'Linea General', fuente: {} }, { label: 'Linea 3P', fuente: {} }] },
      { tipo: 'line', titulo: 'Total agendas — variacion % mes a mes', series: [{ label: '% Variacion', fuente: {} }] },
    ], subtabs: [
      { key: 'ordmed', label: 'Ordenamiento Medico', indices: [0] },
      { key: 'recuperacion', label: 'Recuperacion de Cancelados', indices: [1] },
      { key: 'agendasporlinea', label: 'Agendas por Linea', indices: [2] },
      { key: 'variacion', label: 'Variacion % Agendas', indices: [3] },
    ] },
    { key: 'inasistencia', label: 'Inasistencia', oculta: true, panels: [], subtabs: [
      { key: 'audifonos', label: 'Audifonos', indices: [0] },
      { key: 'audiologia', label: 'Audiologia', indices: [1] },
      { key: 'examenes', label: 'Examenes', indices: [2] },
    ] },
    { key: 'sta', label: 'Gestion STA', oculta: true, panels: [
      { tipo: 'bar', titulo: 'Ordenes por servicio (año)', series: [{ label: 'Ordenes', fuente: {} }] },
      { tipo: 'combo', titulo: 'STA por mes', barras: [{ label: 'Ordenes Cargadas', fuente: {} }] },
    ], subtabs: [
      { key: 'porservicio', label: 'Ordenes por Servicio (año)', indices: [0] },
      { key: 'porestado', label: 'Estado de Ordenes (año)', indices: [1] },
    ] },
    { key: 'efectividad', label: 'Efectividad Citas', oculta: true, panels: [
      { tipo: 'combo', titulo: 'Efectividad de citas', barras: [{ label: 'Citas para el mes', fuente: {} }] },
    ] },
    { key: 'calidad', label: 'Calidad', panels: [
      { tipo: 'calidad_pie', campana: 'ORLANT', titulo: 'Distribucion de clasificacion' },
    ] },
    { key: 'trafico', label: 'Trafico de Llamadas', panels: [{ tipo: 'trafico_combo' }] },
    { key: 'trafico_whatsapp', label: 'Trafico de WhatsApp', panels: [{ tipo: 'trafico_whatsapp_combo', campana: 'ORLANT' }] },
  ],
};

// Otro cliente con el MISMO texto viejo -- confirma que la migracion (SOLO
// ORLANT, pedido explicito) nunca lo toca, aunque coincida exacto.
const LAYOUT_OTRO_VIEJO = {
  tabs: [
    { key: 'tipificacion', label: 'Tipificacion', panels: [] },
    { key: 'trafico', label: 'Trafico de Llamadas', panels: [{ tipo: 'trafico_combo' }] },
  ],
};

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
const now = '28/09/2026 09:00:00';
const insertar = pre.prepare(
  `INSERT INTO dashboards_config (cliente, titulo, vista, secciones, layout, activo, createdAt, updatedAt)
   VALUES (?,?,?,?,?,1,?,?)`
);
insertar.run('ORLANT', 'Dashboard Clinica Orlant', null, '{}', JSON.stringify(LAYOUT_ORLANT_VIEJO), now, now);
insertar.run('MOVILIZE', 'Dashboard Movilize', null, '{}', JSON.stringify(LAYOUT_OTRO_VIEJO), now, now);
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

function layoutDe(cliente) {
  const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get(cliente);
  return JSON.parse(row.layout);
}

test('migracion dashboards_config_orlant_texto_tildes_v1: la columna `titulo` (aparte de layout) tambien se corrige para ORLANT', () => {
  const row = db.prepare('SELECT titulo FROM dashboards_config WHERE cliente = ?').get('ORLANT');
  assert.equal(row.titulo, 'Dashboard Clínica Orlant');
});

test('migracion dashboards_config_orlant_texto_tildes_v1: `titulo` de otro cliente NUNCA se toca', () => {
  const row = db.prepare('SELECT titulo FROM dashboards_config WHERE cliente = ?').get('MOVILIZE');
  assert.equal(row.titulo, 'Dashboard Movilize');
});

test('migracion dashboards_config_orlant_texto_tildes_v1: tabs de nivel superior con tildes/capitalizacion correcta', () => {
  const layout = layoutDe('ORLANT');
  const porKey = {};
  layout.tabs.forEach((t) => { porKey[t.key] = t.label; });
  assert.equal(porKey.tipificacion, 'Tipificación');
  assert.equal(porKey.sta, 'Gestión STA');
  assert.equal(porKey.trafico, 'Tráfico de Llamadas');
  assert.equal(porKey.trafico_whatsapp, 'Tráfico de WhatsApp');
});

test('migracion dashboards_config_orlant_texto_tildes_v1: subtabs y titulos/labels de panel, a cualquier profundidad', () => {
  const layout = layoutDe('ORLANT');
  const flujo = layout.tabs.find((t) => t.key === 'flujo');
  assert.equal(flujo.panels[0].titulo, 'Llamadas Línea General por mes');
  assert.equal(flujo.subtabs[0].label, 'Llamadas Línea General');

  // Busca por titulo/tipo en vez de indice fijo: otra migracion no
  // relacionada (dashboards_config_orlant_agendas_panel_v1, Fase 78) puede
  // insertar un panel nuevo al inicio de este mismo tab si el fixture de
  // esta prueba calza con su forma "vieja" -- no es asunto de esta prueba,
  // que solo verifica el TEXTO, no la posicion de los paneles.
  const agenda = layout.tabs.find((t) => t.key === 'agendamiento');
  const pOrdMed = agenda.panels.find((p) => p.tipo === 'combo' && /Ordenamiento/.test(p.titulo));
  const pRecup = agenda.panels.find((p) => p.tipo === 'combo' && /Recuperaci/.test(p.titulo));
  const pAgLinea = agenda.panels.find((p) => p.tipo === 'line' && /Agendas por l/.test(p.titulo));
  const pVar = agenda.panels.find((p) => p.tipo === 'line' && /variaci/.test(p.titulo));
  assert.equal(pOrdMed.titulo, 'Ordenamiento médico');
  assert.equal(pRecup.titulo, 'Recuperación de cancelados');
  assert.equal(pAgLinea.titulo, 'Agendas por línea');
  assert.equal(pAgLinea.series[0].label, 'Línea General');
  assert.equal(pAgLinea.series[1].label, 'Línea 3P');
  assert.equal(pVar.series[0].label, '% Variación');
  assert.deepEqual(agenda.subtabs.map((s) => s.label).sort(), ['Agendas por Línea', 'Ordenamiento Médico', 'Recuperación de Cancelados', 'Variación % Agendas'].sort());

  const inasist = layout.tabs.find((t) => t.key === 'inasistencia');
  assert.deepEqual(inasist.subtabs.map((s) => s.label), ['Audífonos', 'Audiología', 'Exámenes']);

  const sta = layout.tabs.find((t) => t.key === 'sta');
  assert.equal(sta.panels[0].titulo, 'Órdenes por servicio (año)');
  assert.equal(sta.panels[0].series[0].label, 'Órdenes');
  assert.equal(sta.panels[1].barras[0].label, 'Órdenes Cargadas');
  assert.deepEqual(sta.subtabs.map((s) => s.label), ['Órdenes por Servicio (Año)', 'Estado de Órdenes (Año)']);

  const efect = layout.tabs.find((t) => t.key === 'efectividad');
  assert.equal(efect.panels[0].barras[0].label, 'Citas para el Mes');

  const calidad = layout.tabs.find((t) => t.key === 'calidad');
  assert.equal(calidad.panels[0].titulo, 'Distribución de clasificación');
});

test('migracion dashboards_config_orlant_texto_tildes_v1: NUNCA toca otro cliente, aunque el texto coincida exacto', () => {
  const layout = layoutDe('MOVILIZE');
  assert.equal(layout.tabs[0].label, 'Tipificacion', 'MOVILIZE conserva su texto viejo tal cual');
  assert.equal(layout.tabs[1].label, 'Trafico de Llamadas', 'MOVILIZE conserva su texto viejo tal cual');
});

test('migracion dashboards_config_orlant_texto_tildes_v1: `key`/`tipo`/`campana` (identificadores, no texto de interfaz) no cambian', () => {
  const layout = layoutDe('ORLANT');
  assert.equal(layout.tabs.find((t) => t.key === 'trafico_whatsapp').panels[0].campana, 'ORLANT');
  assert.equal(layout.tabs.find((t) => t.key === 'tipificacion').panels[0].tipo, 'tipificacion_panel');
});

test.after(() => {
  try { db.closeDb(); } catch (e) {}
  try { fs.unlinkSync(tmpDb); } catch (e) {}
});
