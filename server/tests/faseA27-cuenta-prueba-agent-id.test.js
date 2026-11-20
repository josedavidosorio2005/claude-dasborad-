// faseA27-cuenta-prueba-agent-id.test.js — Fase A27 (20/11/2026): la cuenta de pruebas de Wolkvox se
// reconoce por su agent_id (visto en el Historial de la corrida de octubre), con cualquier nombre. La
// huella del nombre sigue como respaldo. Listas por defecto (sin configurar nada).
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const M = require('../wolkvox-modulos');

test('el agent_id de la cuenta de pruebas está en la lista y basta para excluirla', () => {
  assert.ok(M.PRUEBA_IDS.includes('12319'));
  assert.ok(M.PRUEBA_IDS.every((id) => /^[A-Za-z0-9_.-]{1,40}$/.test(id)));
  assert.equal(M.esCuentaPrueba({ agent_id: '12319', agent_name: 'NOMBRE INVENTADO A27' }), true);
  assert.equal(M.esCuentaPrueba({ agent_id: 12319 }), true, 'también si llega como número');
  assert.equal(M.esCuentaPrueba({ agent_id: ' 12319 ' }), true);
  assert.equal(M.esCuentaPrueba({ agent_id: '123190', agent_name: 'NOMBRE INVENTADO A27' }), false);
  assert.equal(M.esCuentaPrueba({ agent_id: '1001', agent_name: 'NOMBRE INVENTADO A27' }), false);
  const r = M.quitarCuentasPrueba([{ agent_id: '12319', agent_name: 'X' }, { agent_id: '1001', agent_name: 'Y' }]);
  assert.equal(r.quitadas, 1);
  assert.deepEqual(r.ids, ['12319']);
});
