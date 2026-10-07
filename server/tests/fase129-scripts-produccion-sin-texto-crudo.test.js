// fase129-scripts-produccion-sin-texto-crudo.test.js — Fase 129. Guarda de
// CI (estática, sin navegador) contra la CLASE de bug real de esta fase:
// un script de scripts/produccion/*.js que hace
// `page.evaluate(() => apiRequest('GET', '.../opciones?...'))` y reenvía
// ese resultado CRUDO (p. ej. `opciones.entidades`, una lista de
// entidades/pacientes reales) hasta un `console.log`/`JSON.stringify`, en
// vez de reducirlo a conteos/números/estados DENTRO del propio
// `page.evaluate` (mismo criterio que `veredictoSubvista`,
// scripts/produccion/revision-final.js).
//
// ALCANCE (deliberadamente acotado, no es un linter general): solo
// endpoints cuya ruta contiene "/opciones" -- en este repo son universos
// de filtro (entidad/asesor/examen/profesional) que pueden traer texto
// real de clientes, exactamente la forma del incidente real
// (`/calidad/inasistencia/opciones`). Un script nuevo con esta forma
// exacta rompe esta prueba en el mismo PR que lo introduce.
//
// PENDIENTE (fuera del alcance de esta fase, documentado para no fingir
// que ya quedó cerrado -- revisado a mano, NO solo supuesto):
// `revision-final.js` reenvía crudo `/ranking`, `/users` y `/historial`
// de la misma forma, pero en TODOS los casos el código que sigue reduce
// a conteos/booleanos explícitos antes de cualquier log (confirmado
// línea por línea: nunca sale un `asesor`/`user`/`username` real en
// `reporte`). `carga-real-patron.js`, en cambio, SÍ tiene un hallazgo
// real nuevo (no de esta fase, pre-existente): su `reporte...ranking`
// incluye `asesor: top.asesor` y `asesor: bottom.asesor` -- el nombre
// real del asesor con mejor y peor efectividad -- en el objeto que
// termina en `console.log(JSON.stringify(reporte, ...))`. Reportado al
// usuario aparte; esta prueba no lo cubre todavía (el alcance de hoy es
// ".../opciones", no ".../ranking") y el archivo no se reescribió sin
// que el usuario lo pidiera.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const DIR_PRODUCCION = path.join(__dirname, '..', '..', 'scripts', 'produccion');

function listarScriptsJs(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listarScriptsJs(full));
    else if (entry.isFile() && entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

// Extrae el texto completo de cada llamada `page.evaluate(...)` (el
// argumento completo, balanceando parentesis -- ignora parentesis dentro
// de strings/template literals para no cortar antes de tiempo).
function extraerCallbacksDeEvaluate(codigoFuente) {
  const callbacks = [];
  const marcador = 'page.evaluate(';
  let desde = 0;
  while (true) {
    const inicio = codigoFuente.indexOf(marcador, desde);
    if (inicio === -1) break;
    let i = inicio + marcador.length;
    let profundidad = 1; // ya contamos el '(' de "page.evaluate("
    let enString = null; // null | '"' | "'" | '`'
    for (; i < codigoFuente.length && profundidad > 0; i++) {
      const c = codigoFuente[i];
      if (enString) {
        if (c === '\\') { i++; continue; } // salta el caracter escapado
        if (c === enString) enString = null;
        continue;
      }
      if (c === '"' || c === "'" || c === '`') { enString = c; continue; }
      if (c === '(') profundidad++;
      else if (c === ')') profundidad--;
    }
    callbacks.push(codigoFuente.slice(inicio + marcador.length, i - 1));
    desde = i;
  }
  return callbacks;
}

// Indice de el ')' que cierra el '(' en `indiceApertura` (string-aware,
// mismo criterio de escaneo que extraerCallbacksDeEvaluate) -- -1 si no
// hay un cierre balanceado dentro del texto.
function indiceCierreParen(texto, indiceApertura) {
  let profundidad = 1;
  let enString = null;
  for (let i = indiceApertura + 1; i < texto.length; i++) {
    const c = texto[i];
    if (enString) {
      if (c === '\\') { i++; continue; }
      if (c === enString) enString = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') { enString = c; continue; }
    if (c === '(') profundidad++;
    else if (c === ')') { profundidad--; if (profundidad === 0) return i; }
  }
  return -1;
}

// La forma PRECISA del bug real: el cuerpo entero del callback, sin
// NINGUN otro paso antes ni despues, es `(await )?apiRequest(...)` -- con
// o sin `async`, con o sin llaves/`return`. Se parsea de verdad (nunca un
// solo regex con `[^]*` greedy -- esa version inicial daba falsos
// positivos con bloques de varios `apiRequest` donde el ULTIMO paso SI
// selecciona campos explicitos, como `fase122-recarga-tipificacion-alias-falla.js`).
function callbackEsPeligroso(textoCallback) {
  let cuerpo = textoCallback.trim().replace(/^async\s*/, '');
  const mArrow = /^\(\s*\)\s*=>\s*/.exec(cuerpo);
  if (!mArrow) return false;
  cuerpo = cuerpo.slice(mArrow[0].length).trim();

  let dentroBloque = false;
  if (cuerpo.startsWith('{')) { dentroBloque = true; cuerpo = cuerpo.slice(1).trim(); }
  cuerpo = cuerpo.replace(/^return\s+/, '').replace(/^await\s+/, '');
  if (!cuerpo.startsWith('apiRequest(')) return false;

  const idxApertura = cuerpo.indexOf('(');
  const idxCierre = indiceCierreParen(cuerpo, idxApertura);
  if (idxCierre === -1) return false; // parentesis sin cerrar -- no es la forma que buscamos

  let resto = cuerpo.slice(idxCierre + 1).trim().replace(/^;/, '').trim();
  if (dentroBloque) resto = resto.replace(/^\}/, '').trim();
  // Peligroso SOLO si de verdad no queda nada mas despues del
  // apiRequest(...) -- cualquier paso adicional (otro apiRequest, un
  // `return {...}` con campos explicitos, un .filter/.length, etc.)
  // hace que esta funcion devuelva false.
  if (resto !== '') return false;

  // Alcance de ESTA guarda: endpoints ".../opciones" -- en este repo son
  // universos de filtro (entidad/asesor/examen/profesional) que pueden
  // traer texto real de clientes, exactamente la forma del incidente
  // real (`/calidad/inasistencia/opciones`). Otros endpoints
  // (resumen/mensual/por-tipo/ranking/users/historial/...) NO entran en
  // el alcance de esta guarda puntual -- ver el comentario de cabecera
  // del archivo para el pendiente de auditar esos por separado.
  return /\/opciones(\?|['"`])/.test(cuerpo.slice(0, idxCierre + 1));
}

test('ningun script real de scripts/produccion/ reenvia el resultado crudo de apiRequest sin seleccionar campos', () => {
  const archivos = listarScriptsJs(DIR_PRODUCCION);
  assert.ok(archivos.length > 0, 'se esperaba encontrar al menos un script en scripts/produccion/');
  const hallazgos = [];
  for (const archivo of archivos) {
    const codigo = fs.readFileSync(archivo, 'utf8');
    for (const cb of extraerCallbacksDeEvaluate(codigo)) {
      if (callbackEsPeligroso(cb)) {
        hallazgos.push(path.relative(path.join(__dirname, '..', '..'), archivo));
      }
    }
  }
  assert.deepEqual(
    hallazgos,
    [],
    'Estos scripts tienen un page.evaluate que reenvia el resultado crudo de apiRequest sin seleccionar campos (la forma exacta del incidente real de la Fase 129): ' + JSON.stringify(hallazgos)
  );
});

// ── Pruebas del detector en si (fixtures en memoria, nunca datos reales
// ni archivos del repo -- confirman que el detector SI atrapa la forma
// exacta del bug original y que NO marca formas seguras equivalentes). ──

test('detector: atrapa la forma exacta del incidente real (arrow de una sola expresion)', () => {
  const codigo = "reporte.opciones = await page.evaluate(() =>\n  apiRequest('GET', '/calidad/inasistencia/opciones?campana=ORLANT')\n);";
  const cbs = extraerCallbacksDeEvaluate(codigo);
  assert.equal(cbs.length, 1);
  assert.equal(callbackEsPeligroso(cbs[0]), true);
});

test('detector: atrapa la variante con bloque y "return await apiRequest(...)" sin nada mas', () => {
  const codigo = "await page.evaluate(async () => { return await apiRequest('GET', '/calidad/agendas/opciones?campana=ORLANT'); });";
  const cbs = extraerCallbacksDeEvaluate(codigo);
  assert.equal(callbackEsPeligroso(cbs[0]), true);
});

test('detector: NO marca un reenvio crudo de un endpoint que no es .../opciones (fuera del alcance de hoy)', () => {
  const codigo = "await page.evaluate(() => apiRequest('GET', '/calidad/inasistencia/resumen?campana=ORLANT&mes=2026-08'));";
  const cbs = extraerCallbacksDeEvaluate(codigo);
  assert.equal(callbackEsPeligroso(cbs[0]), false);
});

test('detector: NO marca un callback que selecciona campos explicitos antes de devolver', () => {
  const codigo = [
    'reporte.opciones = await page.evaluate(async () => {',
    "  const o = await apiRequest('GET', '/calidad/inasistencia/opciones?campana=ORLANT');",
    '  return { meses: o.meses, entidadesCount: o.entidades.length };',
    '});',
  ].join('\n');
  const cbs = extraerCallbacksDeEvaluate(codigo);
  assert.equal(callbackEsPeligroso(cbs[0]), false);
});

test('detector: NO marca un callback que no toca apiRequest para nada', () => {
  const codigo = "await page.evaluate(() => document.querySelectorAll('canvas').length);";
  const cbs = extraerCallbacksDeEvaluate(codigo);
  assert.equal(callbackEsPeligroso(cbs[0]), false);
});

test('extractor de callbacks: encuentra las 2 llamadas de un archivo con varias, cada una por separado', () => {
  const codigo = [
    "await page.evaluate(() => apiRequest('GET', '/calidad/agendas/opciones?campana=ORLANT'));",
    "await page.evaluate(() => document.title);",
  ].join('\n');
  const cbs = extraerCallbacksDeEvaluate(codigo);
  assert.equal(cbs.length, 2);
  assert.equal(callbackEsPeligroso(cbs[0]), true);
  assert.equal(callbackEsPeligroso(cbs[1]), false);
});
