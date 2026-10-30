// fase220-aurora-trafico-visible.test.js — Fase 220 (pedido del 30/10):
// Clinica Aurora muestra Trafico de Llamadas y Trafico de WhatsApp desde ya,
// sin datos (cada pestaña con su aviso). Solo cambian esas 2 pestañas de
// Aurora; ORLANT, Mobilize, Hospital La Maria y SURA quedan identicos. La
// carga del reporte de WhatsApp ya estaba lista (Fase 160). Datos inventados.
'use strict';

const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { db, cleanup } = require('./helpers');
const reg = require('../clientes-registro');
const { derivarListasRegistro } = require('../../public/js/registro-clientes.js');
const centro = require('../centro-cargas');

after(cleanup);
const AURORA = 'CLINICA AURORA';
const layoutDe = (c) => JSON.parse(db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get(c).layout);
const fotoOtros = () => ['ORLANT', 'MOBILIZE', 'HOSPITAL LA MARIA', 'SURA']
  .map((c) => db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get(c))
  .map((r) => (r ? r.layout : null));

test('Aurora: Trafico de Llamadas y de WhatsApp visibles; Calidad sigue oculta', () => {
  const tabs = layoutDe(AURORA).tabs;
  assert.deepEqual(tabs.map((t) => t.key + (t.oculta ? '*' : '')), ['trafico', 'trafico_whatsapp', 'calidad*']);
});

test('la migracion es idempotente y no toca a ningun otro cliente', () => {
  const antesOtros = fotoOtros();
  const antes = JSON.stringify(layoutDe(AURORA));
  // Como estaba al crearla (todo oculto): la migracion solo destapa Trafico.
  const l = layoutDe(AURORA);
  l.tabs.forEach((t) => { t.oculta = true; });
  db.prepare('UPDATE dashboards_config SET layout = ? WHERE cliente = ?').run(JSON.stringify(l), AURORA);
  db.mostrarTraficoAurora();
  db.mostrarTraficoAurora();
  assert.equal(JSON.stringify(layoutDe(AURORA)), antes);
  assert.deepEqual(fotoOtros(), antesOtros);
  assert.ok(db.prepare("SELECT 1 FROM schema_migrations WHERE name = 'fase220_aurora_trafico_visible_v1'").get());
});

test('la carga de Trafico de Llamadas y de WhatsApp de Aurora sigue lista (Cargar Datos y Centro de cargas)', () => {
  const listas = derivarListasRegistro(reg.leerRegistro(db));
  assert.ok(listas.traficoWhatsapp.includes(AURORA), 'plantilla de Trafico en 2 hojas (LLAMADAS / WHATSAPP)');
  assert.ok(!listas.traficoUnificado.includes(AURORA), 'sin las hojas propias de ORLANT');
  const ids = (centro.CARGAS_POR_MODULO.flujo_llamadas || []).concat(centro.CARGAS_POR_MODULO.flujo_whatsapp || []).map((c) => c.id);
  assert.deepEqual(ids, ['flujo_llamadas', 'flujo_whatsapp']);
  const r = reg.leerRegistro(db).find((c) => c.nombre === AURORA);
  assert.deepEqual(r.modulos, ['flujo_llamadas', 'flujo_whatsapp', 'calidad'], 'el PR 1 no agrega modulos');
});
