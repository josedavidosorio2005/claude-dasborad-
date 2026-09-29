// sin-duckdns.test.js — Fase 93. duckdns se retiro de produccion por
// completo (29/09/2026): produccion es solo https://informa.inconexion.com.co.
// Esta prueba de guardia falla si alguien reintroduce una referencia activa
// a duckdns en las rutas que SI son funcionales (server/, public/, deploy/,
// .github/workflows/, .github/scripts/, README.md) -- por ejemplo, un
// default de PROD_URL vuelto a copiar de un script viejo, o un dominio de
// ejemplo en un workflow nuevo.
//
// Dos excepciones deliberadas, acotadas linea por linea (todo lo demas en
// esas rutas sigue fallando la prueba):
// - CLAUDE.md: la nota de retiro ("duckdns se retiro el 29/09/2026 ... no
//   volver a usarlo") -- se permite solo en lineas que tambien digan
//   "retir" (retiro/retirado/retirar).
// - .github/workflows/dominio-produccion.yml: el paso "Tipo de
//   DEPLOY_SSH_HOST" clasifica el host generico (usa duckdns / es una IP /
//   otro nombre) sin nunca imprimir el valor del secret -- necesita seguir
//   reconociendo el patron "duckdns.org" para siempre, no es un residuo de
//   esta fase.
//
// PROGRESS.md y AWS_DEPLOY_REPORT.md quedan FUERA de esta prueba a
// proposito: son bitacoras aditivas con menciones historicas que nunca se
// reescriben (ver la nota al inicio de cada una).
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const THIS_FILE = __filename;

const RUTAS_A_ESCANEAR = [
  'server',
  'public',
  'deploy',
  '.github/workflows',
  '.github/scripts',
  'CLAUDE.md',
  'README.md',
];

// Clave = ruta relativa al repo (con '/', como en RUTAS_A_ESCANEAR o mas
// especifica). Valor = lineas con "duckdns" toleradas SI ademas matchean
// alguno de estos patrones. Cualquier otra mencion en esa misma ruta sigue
// fallando la prueba.
const EXCEPCIONES = {
  'CLAUDE.md': [/retir/i],
  '.github/workflows/dominio-produccion.yml': [/duckdns\.org\*/, /usa duckdns/, /no duckdns/],
};

const DIRS_IGNORADOS = new Set(['node_modules', '.git']);
const EXT_BINARIAS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.woff', '.woff2', '.ttf', '.eot',
  '.pdf', '.zip', '.db', '.sqlite', '.xlsx', '.xls', '.db-journal', '.db-wal', '.db-shm',
]);

function listarArchivos(rutaAbsoluta) {
  const stat = fs.statSync(rutaAbsoluta, { throwIfNoEntry: false });
  if (!stat) return [];
  if (stat.isFile()) return [rutaAbsoluta];
  if (!stat.isDirectory()) return [];
  const out = [];
  for (const entry of fs.readdirSync(rutaAbsoluta)) {
    if (DIRS_IGNORADOS.has(entry)) continue;
    out.push(...listarArchivos(path.join(rutaAbsoluta, entry)));
  }
  return out;
}

function leerTexto(rutaAbsoluta) {
  if (EXT_BINARIAS.has(path.extname(rutaAbsoluta).toLowerCase())) return null;
  try {
    return fs.readFileSync(rutaAbsoluta, 'utf8');
  } catch (e) {
    return null;
  }
}

test('ninguna ruta funcional menciona duckdns, salvo las excepciones deliberadas y acotadas', () => {
  const hallazgos = [];
  for (const ruta of RUTAS_A_ESCANEAR) {
    const absoluta = path.join(REPO_ROOT, ruta);
    for (const archivo of listarArchivos(absoluta)) {
      if (archivo === THIS_FILE) continue;
      const texto = leerTexto(archivo);
      if (!texto) continue;
      const rel = path.relative(REPO_ROOT, archivo).split(path.sep).join('/');
      const permitidas = EXCEPCIONES[rel] || [];
      texto.split('\n').forEach((linea, i) => {
        if (!/duckdns/i.test(linea)) return;
        if (permitidas.some((re) => re.test(linea))) return;
        hallazgos.push(`${rel}:${i + 1}: ${linea.trim()}`);
      });
    }
  }
  assert.deepEqual(hallazgos, [], 'referencias a duckdns fuera de las excepciones permitidas:\n' + hallazgos.join('\n'));
});
