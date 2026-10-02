// guardia-contrasenas-seed-fase110.test.js — Fase 110 (URGENTE): prueba de
// guardia contra una regresion futura del mismo problema (6 usuarios de
// ejemplo con contraseña fija en el codigo de un repo PUBLICO, seguian
// activos en produccion con esa contraseña intacta). Escaneo estatico, no
// de comportamiento: falla si alguna de las contraseñas de ejemplo
// conocidas aparece, fuera de server/tests/, en un archivo que no
// comprueba config.isProduction -- es decir, una semilla nueva que
// pudiera correr en produccion sin el mismo candado que ya tiene
// server/db.js. No es a prueba de bombas (un candado puede estar mal
// puesto y este escaneo no entiende el flujo), pero detecta el caso obvio
// de "se agrego una contraseña de ejemplo fija y nadie puso el if".
'use strict';

const fs = require('fs');
const path = require('path');
const { test } = require('node:test');
const assert = require('node:assert/strict');

const SERVER_DIR = path.join(__dirname, '..');
const DIRS_EXCLUIDOS = new Set(['node_modules', 'tests', 'data']);

// Las 6 contraseñas de ejemplo reales (server/db.js) -- nunca se imprimen
// en el mensaje de assert, solo se usan para buscar coincidencias.
const CONTRASENAS_EJEMPLO = ['calidad123', 'inv123', 'ger123', 'cli123', 'aux123', 'admin456'];

function listarArchivosJs(dir) {
  const resultado = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (DIRS_EXCLUIDOS.has(entry.name)) continue;
      resultado.push(...listarArchivosJs(path.join(dir, entry.name)));
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      resultado.push(path.join(dir, entry.name));
    }
  }
  return resultado;
}

test('guardia: ninguna contraseña fija de las semillas de ejemplo aparece en server/ (fuera de tests/) sin el candado isProduction', () => {
  const archivos = listarArchivosJs(SERVER_DIR);
  assert.ok(archivos.length > 20, 'el escaneo deberia recorrer decenas de archivos -- si encuentra muy pocos, revisar DIRS_EXCLUIDOS');

  const archivosSinCandado = [];
  for (const archivo of archivos) {
    const contenido = fs.readFileSync(archivo, 'utf8');
    const tieneContrasenaFija = CONTRASENAS_EJEMPLO.some(
      (p) => contenido.includes(`'${p}'`) || contenido.includes(`"${p}"`)
    );
    if (!tieneContrasenaFija) continue;
    if (!contenido.includes('isProduction')) {
      archivosSinCandado.push(path.relative(SERVER_DIR, archivo));
    }
  }

  assert.deepEqual(
    archivosSinCandado,
    [],
    'estos archivos tienen una contraseña de ejemplo fija pero no comprueban isProduction en ningun lado -- ' +
      'podrian crear o dejar activos usuarios de ejemplo en produccion (ver Fase 110)'
  );
});
