// fase134-dry-run-listas-coinciden.test.js — el script de dry-run
// (scripts/fase134-dry-run-borrado.js) es AUTOCONTENIDO a proposito (no
// hace require('../db'), ver el comentario de su cabecera) -- reproduce a
// mano la lista de 12 clientes y las 19 tablas de la migracion real
// `fase134_borrar_clientes_v1` (server/db.js). Esta prueba lee los 2
// archivos como texto y falla si las listas alguna vez se desincronizan.
'use strict';
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');
const assert = require('node:assert/strict');

const dbJs = fs.readFileSync(path.join(__dirname, '..', 'db.js'), 'utf8');
const dryRunJs = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'fase134-dry-run-borrado.js'), 'utf8');

function extraerArrayDeStrings(texto, nombreConst) {
  const m = texto.match(new RegExp(nombreConst + '\\s*=\\s*\\[([\\s\\S]*?)\\];'));
  assert.ok(m, 'no se encontro ' + nombreConst);
  const items = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
  assert.ok(items.length > 0, nombreConst + ' quedo vacia -- revisar el regex de extraccion');
  return items;
}

test('CLIENTES_ELIMINADOS_FASE134 es identica en db.js y en el script de dry-run', () => {
  const enDb = extraerArrayDeStrings(dbJs, 'CLIENTES_ELIMINADOS_FASE134');
  const enDryRun = extraerArrayDeStrings(dryRunJs, 'CLIENTES_ELIMINADOS_FASE134');
  assert.deepEqual(enDryRun, enDb);
});

test('TABLAS_CAMPANA_FASE134 es identica en db.js y en el script de dry-run', () => {
  const enDb = extraerArrayDeStrings(dbJs, 'TABLAS_CAMPANA_FASE134');
  const enDryRun = extraerArrayDeStrings(dryRunJs, 'TABLAS_CAMPANA_FASE134');
  assert.deepEqual(enDryRun, enDb);
});

test('TABLAS_CLIENTE_FASE134 es identica en db.js y en el script de dry-run', () => {
  const enDb = extraerArrayDeStrings(dbJs, 'TABLAS_CLIENTE_FASE134');
  const enDryRun = extraerArrayDeStrings(dryRunJs, 'TABLAS_CLIENTE_FASE134');
  assert.deepEqual(enDryRun, enDb);
});
