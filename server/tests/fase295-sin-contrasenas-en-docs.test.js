// fase295-sin-contrasenas-en-docs.test.js — Fase 295 (09/11/2026): la bitácora
// tenía escrita la contraseña temporal de una cuenta de cliente (CLIENTES_DASH)
// desde la Fase 137. El repo es público, así que se retiró del archivo y la
// cuenta se rota desde la plataforma. Esta prueba falla si una contraseña
// temporal/inicial vuelve a quedar escrita en un .md del repo, con la forma en
// que apareció ("contraseña temporal (`valor`)", "clave inicial: `valor`", ...).
// Las contraseñas de cuentas reales viven solo como hash bcrypt en la base y se
// cambian desde Usuarios (admin) o "Cambiar contraseña" (la propia cuenta).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..', '..');
const SALTAR = new Set(['node_modules', '.git', 'data', 'coverage']);

function archivosMd(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SALTAR.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) archivosMd(p, out);
    else if (e.name.toLowerCase().endsWith('.md')) out.push(p);
  }
  return out;
}

const PATRON = /(contrase(?:ñ|n)a|clave|password)\s+(?:temporal|inicial|provisional)\s*(?:\(|:|es|era|=)?\s*`[^`\s]+`/gi;

test('ningún .md del repo deja escrita una contraseña temporal o inicial', () => {
  const md = archivosMd(RAIZ, []);
  assert.ok(md.length > 10, 'se esperaban varios .md en el repo');
  const hallazgos = [];
  for (const f of md) {
    const txt = fs.readFileSync(f, 'utf8');
    for (const m of txt.matchAll(PATRON)) {
      const linea = txt.slice(0, m.index).split('\n').length;
      // Nunca se imprime el valor encontrado: solo archivo y línea.
      hallazgos.push(path.relative(RAIZ, f) + ':' + linea);
    }
  }
  assert.deepEqual(hallazgos, [], 'contraseña escrita en: ' + hallazgos.join(', '));
});

test('el patrón detecta la forma en que apareció (sin usar el valor real)', () => {
  PATRON.lastIndex = 0;
  assert.match('su contraseña temporal (`EjemploNoReal`) nunca', PATRON);
  PATRON.lastIndex = 0;
  assert.doesNotMatch('la contraseña temporal se cambia desde la plataforma', PATRON);
});
