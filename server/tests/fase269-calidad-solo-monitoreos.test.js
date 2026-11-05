// fase269-calidad-solo-monitoreos.test.js — Fase 269 (pedido de Edwin, 05/11):
// la pestaña Calidad de MOBILIZE, CLINICA AURORA y HOSPITAL LA MARIA queda solo
// con "Resultado de los monitoreos" (lo calificado en la plataforma). Lo de
// antes (resumen de Cargar datos, indicadores, torta, barras) deja de
// mostrarse; ningun dato se borra. ORLANT no cambia (pendiente de decision).
'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { db, cleanup } = require('./helpers');
const { generarLayout, PERFILES_ACTUALES } = require('../plantillas-cliente');

after(cleanup);

const layoutDe = (c) => JSON.parse(db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get(c).layout);
const calidadDe = (c) => layoutDe(c).tabs.find((t) => t.key === 'calidad');
const guardar = (c, l) => db.prepare('UPDATE dashboards_config SET layout = ? WHERE cliente = ?').run(JSON.stringify(l), c);

test('base nueva: Mobilize, Aurora y HLM con Calidad solo de monitoreos; ORLANT con la suya de siempre', () => {
  assert.deepEqual(calidadDe('MOBILIZE').panels, [{ tipo: 'calidad_monitoreos_panel', campana: 'MOBILIZE' }]);
  for (const c of ['CLINICA AURORA', 'HOSPITAL LA MARIA']) {
    const t = calidadDe(c);
    assert.deepEqual(t.panels, [{ tipo: 'calidad_monitoreos_panel', campana: c }], c);
    assert.equal(t.oculta, true, c + ': sigue oculta hasta el primer monitoreo');
  }
  assert.deepEqual(calidadDe('ORLANT').panels.map((p) => p.tipo), ['calidad_kpis', 'calidad_pie', 'calidad_bar_asesores']);
  // La plantilla (cliente nuevo) tambien: solo monitoreos; ORLANT con su ajuste.
  assert.deepEqual(generarLayout(PERFILES_ACTUALES.MOBILIZE).layout.tabs.find((t) => t.key === 'calidad').panels.map((p) => p.tipo), ['calidad_monitoreos_panel']);
  assert.deepEqual(generarLayout(PERFILES_ACTUALES.ORLANT).layout.tabs.find((t) => t.key === 'calidad').panels.map((p) => p.tipo), ['calidad_kpis', 'calidad_pie', 'calidad_bar_asesores']);
});

test('migracion sobre la forma de produccion: quita los 4 paneles viejos, deja el resto, no borra datos, idempotente', () => {
  // Forma de produccion antes de la Fase 269.
  const mob = layoutDe('MOBILIZE');
  mob.tabs.find((t) => t.key === 'calidad').panels = [
    { tipo: 'calidad_resumen_panel', campana: 'MOBILIZE' }, { tipo: 'calidad_kpis', campana: 'MOBILIZE' },
    { tipo: 'calidad_pie', campana: 'MOBILIZE', titulo: 'Distribución de clasificación' }, { tipo: 'calidad_monitoreos_panel', campana: 'MOBILIZE' }];
  guardar('MOBILIZE', mob);
  const aur = layoutDe('CLINICA AURORA');
  aur.tabs.find((t) => t.key === 'calidad').panels = [
    { tipo: 'calidad_kpis', campana: 'CLINICA AURORA' }, { tipo: 'calidad_pie', campana: 'CLINICA AURORA', titulo: 'x' },
    { tipo: 'calidad_bar_asesores', campana: 'CLINICA AURORA', titulo: 'y' }, { tipo: 'nota_kpi', titulo: 'otro panel' }, { tipo: 'calidad_monitoreos_panel', campana: 'CLINICA AURORA' }];
  guardar('CLINICA AURORA', aur);
  // HLM sin el panel de monitoreos: no se toca.
  const hlm = layoutDe('HOSPITAL LA MARIA');
  hlm.tabs.find((t) => t.key === 'calidad').panels = [{ tipo: 'calidad_kpis', campana: 'HOSPITAL LA MARIA' }];
  guardar('HOSPITAL LA MARIA', hlm);
  const orlAntes = layoutDe('ORLANT');
  // Datos viejos: un resumen de Cargar datos y un monitoreo.
  db.prepare("INSERT INTO calidad_resumen_asesor (campana, mes, agente, monitoreos, puntaje, fallos, archivoNombre, cargadoPorNombre, createdAt) VALUES ('MOBILIZE','2026-10','Asesor Ficticio',3,90,0,'x.xlsx','t','x')").run();
  const nRes = db.prepare('SELECT COUNT(*) AS n FROM calidad_resumen_asesor').get().n;
  const nMon = db.prepare('SELECT COUNT(*) AS n FROM monitoreos').get().n;

  db.calidadSoloMonitoreos();
  assert.deepEqual(calidadDe('MOBILIZE').panels, [{ tipo: 'calidad_monitoreos_panel', campana: 'MOBILIZE' }]);
  assert.deepEqual(calidadDe('CLINICA AURORA').panels.map((p) => p.tipo), ['nota_kpi', 'calidad_monitoreos_panel'], 'un panel que no es de los 4 se queda');
  assert.deepEqual(calidadDe('HOSPITAL LA MARIA').panels.map((p) => p.tipo), ['calidad_kpis'], 'sin panel de monitoreos: intacta');
  assert.deepEqual(layoutDe('ORLANT'), orlAntes, 'ORLANT no se toca');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM calidad_resumen_asesor').get().n, nRes, 'el resumen de Cargar datos no se borra');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM monitoreos').get().n, nMon);
  // Las demas pestañas de Mobilize, iguales.
  const otras = (l) => l.tabs.filter((t) => t.key !== 'calidad');
  assert.deepEqual(otras(layoutDe('MOBILIZE')), otras(mob));
  const despues = JSON.stringify([layoutDe('MOBILIZE'), layoutDe('CLINICA AURORA')]);
  db.calidadSoloMonitoreos();
  assert.equal(JSON.stringify([layoutDe('MOBILIZE'), layoutDe('CLINICA AURORA')]), despues, 'idempotente');
});
