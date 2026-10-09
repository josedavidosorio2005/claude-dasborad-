// fase136-f08-toast-no-autenticado-login.test.js — Fase 136, F08
// (investigado aparte, hallazgo real de la Fase 135): un toast "No se
// pudieron cargar tus resultados: No autenticado" aparecia en la
// pantalla de LOGIN, antes de iniciar sesion.
//
// Causa real: las 4 paginas (#admin-page/#user-page/#asesor-page/
// #supervisor-page) viven TODAS en el DOM a la vez, ocultas con CSS --
// document.getElementById('mr-kpis') encontraba el elemento del Portal
// Asesor aunque nunca se hubiera abierto. Cambiar el tema ANTES de
// iniciar sesion disparaba renderMisResultados() (via
// refrescarGraficasTema(), theme.js), que llama a GET /monitoreos/mios
// (requiere sesion) -- sin sesion, el 401 terminaba en un toast visible
// en el login.
//
// Fix: un guard de `authToken` (api.js, variable en memoria que ya
// existia, misma fuente de verdad que usa el resto de la app) al
// PRINCIPIO de refrescarGraficasTema() -- nunca se toco ninguna regla de
// autenticacion/sesion/permiso, solo se evita llamar a una funcion que
// pide datos autenticados cuando ya se sabe que no hay sesion.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { request, app } = require('./helpers');

test('refrescarGraficasTema() no hace nada si no hay sesion (authToken vacio) -- el guard va ANTES de los 3 bloques existentes, sin tocarlos', async () => {
  const res = await request(app).get('/js/theme.js');
  assert.equal(res.status, 200);
  const fn = res.text.match(/function refrescarGraficasTema\(\)\{([\s\S]*?)\n\}/)[1];
  const primeraLinea = fn.trim().split('\n')[0];
  assert.match(primeraLinea, /if\(typeof authToken === 'undefined' \|\| !authToken\) return;/, 'el guard deberia ser la primera linea de la funcion -- corta ANTES de cualquiera de los 3 bloques (dashboard/calidad/mis-resultados)');
  // Los 3 bloques originales siguen intactos despues del guard.
  assert.match(fn, /renderGenericTab\(_gd\.tab\)/);
  assert.match(fn, /renderCalReportes\(\)/);
  assert.match(fn, /renderMisResultados\(\)/);
});

test('no se toco ninguna regla de autenticacion real -- authToken sigue siendo la misma variable de api.js, sin un mecanismo nuevo', async () => {
  const api = await request(app).get('/js/api.js');
  assert.equal(api.status, 200);
  assert.match(api.text, /var authToken = null;/, 'authToken deberia seguir siendo la misma variable de siempre, sin cambios');
});
