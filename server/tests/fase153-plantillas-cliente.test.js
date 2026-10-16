// fase153-plantillas-cliente.test.js — Fase 153 (Paso 3): catalogo de
// modulos y generador de layout. Prueba de "foto": con su perfil, la
// plantilla reproduce EXACTO el layout que ORLANT y MOBILIZE ya tienen en
// la base tras todas las migraciones. El generador no escribe nada.
'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { db, cleanup } = require('./helpers');
const { schemas } = require('../validation');
const P = require('../plantillas-cliente');
const reg = require('../clientes-registro');

after(cleanup);

function layoutActual(cliente) {
  const r = db.prepare('SELECT titulo, vista, secciones, layout FROM dashboards_config WHERE cliente = ?').get(cliente);
  return { titulo: r.titulo, vista: r.vista ? JSON.parse(r.vista) : null, secciones: JSON.parse(r.secciones), layout: JSON.parse(r.layout) };
}

for (const cliente of ['ORLANT', 'MOBILIZE']) {
  test(`foto: el layout generado para ${cliente} es IDENTICO al que tiene hoy`, () => {
    const generado = P.generarLayout(P.PERFILES_ACTUALES[cliente]);
    const actual = layoutActual(cliente);
    assert.deepStrictEqual(generado, actual);
    // Ademas, byte a byte (mismo orden de claves y de pestanas).
    assert.equal(JSON.stringify(generado), JSON.stringify(actual));
  });
}

test('los perfiles usan exactamente los modulos del registro de clientes', () => {
  // Fase 153 (P3): CLINICA AURORA tambien esta en el registro, pero no tiene
  // "perfil actual" (se creo desde la plantilla, ver fase153-crear-aurora).
  const registro = reg.leerRegistro(db);
  for (const nombre of Object.keys(P.PERFILES_ACTUALES)) {
    const c = registro.find((x) => x.nombre === nombre);
    assert.deepEqual(P.PERFILES_ACTUALES[nombre].modulos.slice().sort(), c.modulos.slice().sort(), nombre);
  }
});

test('catalogo: ids unicos, base "Contact center" y Calidad al final', () => {
  const ids = P.CATALOGO.map((m) => m.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(ids[ids.length - 1], 'calidad');
  assert.deepEqual(P.BASE_CONTACT_CENTER, ['flujo_llamadas', 'flujo_whatsapp', 'tipificacion', 'calidad']);
  P.BASE_CONTACT_CENTER.forEach((id) => assert.ok(ids.includes(id)));
  assert.equal(P.CATALOGO.find((m) => m.id === 'salida').disponibleParaNuevos, false, 'Salida depende de la hoja manual de ORLANT');
});

test('cliente nuevo con la base: todas las pestanas ocultas, sin especificos, y el constructor la acepta', () => {
  const g = P.generarLayout({ nombre: 'CLIENTE PRUEBA', modulos: P.BASE_CONTACT_CENTER.concat(['agendas', 'inasistencia']) });
  assert.equal(g.titulo, 'Dashboard CLIENTE PRUEBA');
  assert.deepEqual(g.layout.tabs.map((t) => t.key), ['trafico', 'trafico_whatsapp', 'agendamiento', 'inasistencia', 'tipificacion', 'calidad']);
  g.layout.tabs.forEach((t) => assert.equal(t.oculta, true, t.key));
  g.layout.tabs.forEach((t) => t.panels.forEach((p) => {
    if (p.campana) assert.equal(p.campana, 'CLIENTE PRUEBA');
  }));
  assert.deepEqual(Object.keys(g.secciones), ['notas']);
  // Agendas sin Efectividad de Agendamiento: sin el panel ni la sub-pestana del ranking.
  const ag = g.layout.tabs.find((t) => t.key === 'agendamiento');
  assert.equal(ag.panels.length, 3);
  assert.equal(ag.subtabs.length, 3);
  const r = schemas.dashboardConfigBody.safeParse(Object.assign({ cliente: 'CLIENTE PRUEBA' }, g));
  assert.ok(r.success, JSON.stringify(r.error && r.error.issues));
});

test('rechaza modulos desconocidos y sub-vistas sin su modulo', () => {
  assert.throws(() => P.generarLayout({ nombre: 'X', modulos: ['no_existe'] }), /Módulo desconocido/);
  assert.throws(() => P.generarLayout({ nombre: 'X', modulos: ['whatsapp_tiempos'] }), /necesita flujo_whatsapp/);
  assert.throws(() => P.generarLayout({ nombre: '', modulos: [] }), /Falta el nombre/);
});

test('generar no escribe en la base ni crea clientes (HLM sigue sin existir)', () => {
  const antes = db.prepare('SELECT COUNT(*) AS n FROM dashboards_config').get().n;
  P.generarLayout({ nombre: 'HOSPITAL LA MARIA', modulos: P.BASE_CONTACT_CENTER });
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM dashboards_config').get().n, antes);
  // Fase 153 (P3): CLINICA AURORA existe, pero la crea su migracion
  // (fase153-crear-aurora.test.js), nunca generarLayout.
  for (const c of ['HOSPITAL LA MARIA']) {
    assert.equal(db.prepare('SELECT 1 FROM dashboards_config WHERE cliente = ?').get(c), undefined, c);
    assert.equal(db.prepare('SELECT 1 FROM clientes_registro WHERE nombre = ?').get(c), undefined, c);
  }
});
