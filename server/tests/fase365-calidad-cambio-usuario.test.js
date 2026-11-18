// fase365-calidad-cambio-usuario.test.js — Fase 365 (bug de Edwin, 18/11): al entrar con una asesora,
// salir y entrar con otro usuario en la misma pestaña, Calidad «no reconocía» los formularios: las
// plantillas se cargaban una vez por sesión con el acceso de la asesora (solo su campaña) y nunca se
// reiniciaban. Reproducido en local con la base demo (demo_asesor -> demo_calidad: solo ORLANT;
// limpio: MOBILIZE y ORLANT). Ahora se reinicia todo lo de Calidad que depende del usuario.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const JS = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', f), 'utf8');

test('calReiniciarSesion deja Calidad como recién abierta (sin plantillas ni elecciones del usuario anterior)', () => {
  const src = JS('calidad.js');
  const i = src.indexOf('function calReiniciarSesion()');
  assert.ok(i > 0);
  const fin = src.indexOf('\n}\n', i) + 2;
  const ctx = {
    _calPlantillasLoaded: true,
    CAL_PLANTILLAS: { ORLANT: { items: [1], engine: 'standard' } },
    CAL_PLANTILLAS_TODAS: [{ id: 1 }],
    _calClientesConDashboard: ['ORLANT'],
    _calPlantillaElegida: { ORLANT: 7 },
    _calResOpciones: { ORLANT: {} },
  };
  const refPlantillas = ctx.CAL_PLANTILLAS;
  vm.createContext(ctx);
  vm.runInContext(src.slice(i, fin) + '\ncalReiniciarSesion();', ctx);
  assert.equal(ctx._calPlantillasLoaded, false);
  assert.equal(Object.keys(ctx.CAL_PLANTILLAS).length, 0);
  assert.equal(ctx.CAL_PLANTILLAS, refPlantillas, 'se vacía el mismo objeto (otros archivos lo tienen referenciado)');
  assert.equal(JSON.stringify(ctx.CAL_PLANTILLAS_TODAS), '[]');
  assert.equal(ctx._calClientesConDashboard, null);
  assert.equal(JSON.stringify(ctx._calPlantillaElegida), '{}');
  assert.equal(JSON.stringify(ctx._calResOpciones), '{}');
});

test('se llama al cerrar sesión, al entrar (las dos entradas) y al entrar o salir de «Ver como»', () => {
  const ses = JS('session.js');
  const salir = ses.slice(ses.indexOf('function doLogout'), ses.indexOf('function doLogout') + 3000);
  assert.match(salir, /calReiniciarSesion\(\)/);
  assert.equal((ses.match(/calReiniciarSesion\(\)/g) || []).length, 3);
  const vc = JS('ver-como.js');
  const limpiar = vc.slice(vc.indexOf('function _verComoLimpiarPantalla'), vc.indexOf('function _verComoLimpiarPantalla') + 1500);
  assert.match(limpiar, /calReiniciarSesion\(\)/);
});
