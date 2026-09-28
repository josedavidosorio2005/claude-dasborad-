// dashboards-config-put-round-trip-fase85.test.js — Fase 85, Paso 3.
//
// PUT /api/dashboards/config/:cliente ya perdio campos en silencio DOS
// veces por el mismo motivo (Zod descarta por defecto cualquier campo no
// declarado en un z.object): Fase 74 (oculta/subtabs de layout.tabs) y
// Fase 84 (notasExtra de una seccion, autoTrafico de una columna). Ambas
// veces la prueba que lo atrapo fue especifica a esos campos puntuales --
// esta prueba es GENERAL: toma la config YA SEMBRADA de CADA cliente real
// (dashboard-config-seed.js, la insertan tal cual en dashboards_config al
// arrancar el servidor -- ver db.js), la manda de vuelta por PUT SIN
// TOCAR NADA, y confirma que lo que se lee despues es IDENTICO byte a
// byte a lo que habia antes del PUT. Si un campo nuevo se agrega a algun
// cliente en el futuro (a cualquier nivel: seccion, columna, tab, subtab,
// vista) y el schema (server/validation.js) no lo declara, esta prueba
// falla para ESE cliente sin tener que saber de antemano cual campo es --
// la correccion es la misma de las Fases 74/84: declarar el campo en el
// schema y, si hace falta, una migracion _v2 que repare la produccion ya
// afectada.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, tokenFor, MASTER_PASSWORD, db } = require('./helpers');

const auth = (t) => ({ Authorization: `Bearer ${t}` });

test('PUT /api/dashboards/config/:cliente, sin tocar nada, conserva byte-a-byte la config de CADA cliente sembrado (prueba general -- Fase 74 y Fase 84 fueron casos puntuales de este mismo bug)', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const clientes = db.prepare('SELECT cliente FROM dashboards_config WHERE activo = 1 ORDER BY cliente').all().map((r) => r.cliente);
  assert.ok(clientes.length >= 1, 'debe haber al menos un dashboard sembrado para que esta prueba tenga sentido');

  const perdidos = [];
  for (const cliente of clientes) {
    const antes = await request(app).get('/api/dashboards/config/' + encodeURIComponent(cliente)).set(auth(admin));
    assert.equal(antes.status, 200, `GET inicial de ${cliente}: ${JSON.stringify(antes.body)}`);
    const { updatedAt: _updatedAtAntes, ...cuerpoAntes } = antes.body;

    // PUT del cuerpo TAL CUAL se leyo -- ningun campo tocado a proposito.
    const put = await request(app)
      .put('/api/dashboards/config/' + encodeURIComponent(cliente))
      .set(auth(admin))
      .send(cuerpoAntes);
    assert.equal(put.status, 200, `PUT de ${cliente}: ${JSON.stringify(put.body)}`);

    const despues = await request(app).get('/api/dashboards/config/' + encodeURIComponent(cliente)).set(auth(admin));
    assert.equal(despues.status, 200);
    const { updatedAt: _updatedAtDespues, ...cuerpoDespues } = despues.body;

    try {
      assert.deepEqual(cuerpoDespues, cuerpoAntes);
    } catch (e) {
      perdidos.push({ cliente, error: e.message });
    }
  }

  assert.deepEqual(perdidos, [], 'estos clientes perdieron algun campo en un PUT que no los tocaba: ' + JSON.stringify(perdidos, null, 2));
});
