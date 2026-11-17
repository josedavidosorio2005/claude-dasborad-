// fase360-generador-televentas.test.js — Fase 360: el generador de Televentas (SURA) produce
// EXACTAMENTE el tablero publicado (public/js/sura-televentas-app.js y su CSS). Antes, fases
// anteriores habían corregido a mano el archivo publicado (botón «Descargar» según permiso y dos
// ajustes de estilo de la Fase 216) y regenerar los habría borrado.
//
// El HTML de Edwin trae datos reales y NUNCA va al repo ni a GitHub: esta prueba lo lee de la
// variable de entorno STV_HTML_EDWIN (ruta local). Sin ella (CI), la comparación completa se
// salta y lo dice; las comprobaciones del generador de abajo corren siempre.
//   PowerShell: $env:STV_HTML_EDWIN='<ruta>\seguimiento_ventas_offline.html'; node --test tests/fase360-generador-televentas.test.js
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const RAIZ = path.join(__dirname, '..', '..');
const GEN = path.join(RAIZ, 'scripts', 'sura', 'generar-televentas.js');
const HTML = process.env.STV_HTML_EDWIN || '';

test('el generador ya trae los arreglos que antes solo estaban a mano', () => {
  const g = fs.readFileSync(GEN, 'utf8');
  assert.match(g, /for \(const t of \['dl', 'edl', 'idl'\]\)/, '«Descargar» según PERM.puedeDescargar en ventas, estrategias e iniciales');
  assert.match(g, /PERM&&PERM\.puedeDescargar===false/);
  assert.match(g, /overflow-wrap:anywhere\} \/\* Fase 216: nombres de archivo largos no se salen de la tarjeta \*\//);
  assert.match(g, /\.row label select\{max-width:100%\} \/\* Fase 216: opciones largas no ensanchan el tablero en el celular \*\//);
  assert.doesNotMatch(g, /\n\.m small\{overflow-wrap:anywhere\}\n/, 'sin el bloque suelto del final (quedaba distinto a lo publicado)');
  const app = fs.readFileSync(path.join(RAIZ, 'public', 'js', 'sura-televentas-app.js'), 'utf8');
  assert.equal(app.split('PERM&&PERM.puedeDescargar===false').length - 1, 3);
});

test('regenerado desde el HTML de Edwin = tablero publicado, byte a byte', (t) => {
  if (!HTML || !fs.existsSync(HTML)) {
    t.skip('sin STV_HTML_EDWIN (el HTML de Edwin no va al repo ni a CI): correr en local');
    return;
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'stv-gen-'));
  try {
    fs.mkdirSync(path.join(tmp, 'public', 'js'), { recursive: true });
    fs.mkdirSync(path.join(tmp, 'public', 'css'), { recursive: true });
    execFileSync(process.execPath, [GEN, HTML, tmp], { stdio: ['ignore', 'ignore', 'pipe'] }); // el script solo imprime tamaños
    for (const f of [['js', 'sura-televentas-app.js'], ['css', 'sura-televentas-app.css']]) {
      const nuevo = fs.readFileSync(path.join(tmp, 'public', ...f));
      const publicado = fs.readFileSync(path.join(RAIZ, 'public', ...f));
      assert.ok(nuevo.equals(publicado), f.join('/') + ': lo regenerado no es igual a lo publicado');
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
