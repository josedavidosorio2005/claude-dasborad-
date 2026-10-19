// fase154-rutas-con-sesion.test.js — Fase 154: recorre TODAS las rutas de
// Express y falla si alguna no exige sesion (requireActor, requireDataLoader
// o requirePermission), salvo la lista blanca explicita de abajo. Complementa
// fase118-matriz-acceso (que exige una politica declarada por ruta, pero no
// mira el middleware). Una ruta nueva sin sesion hace fallar esta prueba.
'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { app, cleanup } = require('./helpers');

after(cleanup);

// Unicas rutas de la API que se usan sin sesion.
const SIN_SESION = new Set(['GET /api/health', 'POST /api/auth/login']);
// El frontend estatico (index y el fallback de la SPA) no es API.
const FRONTEND = new Set(['GET /', 'GET /index.html', 'GET /{*splat}']);
const GUARDIAS = new Set(['requireActor', 'requireDataLoader', 'requirePermission']);

function rutasSinSesion(aplicacion, prefijoApi) {
  const sin = [];
  let total = 0;
  (function walk(stack, prefijo) {
    stack.forEach((l) => {
      if (l.route) {
        const nombres = l.route.stack.map((s) => s.handle && s.handle.name);
        Object.keys(l.route.methods).forEach((m) => {
          const clave = m.toUpperCase() + ' ' + prefijo + l.route.path;
          if (FRONTEND.has(clave)) return;
          total += 1;
          if (!SIN_SESION.has(clave) && !nombres.some((n) => GUARDIAS.has(n))) sin.push(clave);
        });
      } else if (l.handle && l.handle.stack) {
        // Los routers de dominio cuelgan del router de la API (/api).
        walk(l.handle.stack, l.name === 'router' && prefijo === '' ? prefijoApi : prefijo);
      }
    });
  })((aplicacion.router || aplicacion._router).stack, '');
  return { sin, total };
}

test('todas las rutas exigen sesion, salvo login y health', () => {
  const { sin, total } = rutasSinSesion(app, '/api');
  assert.ok(total >= 140, 'inventario completo de rutas (' + total + ')');
  assert.deepEqual(sin, [], 'rutas sin sesion: ' + sin.join(', '));
});

test('la prueba detecta de verdad una ruta sin sesion (control)', () => {
  const falsa = express();
  const r = express.Router();
  r.get('/datos-abiertos', (req, res) => res.json({}));
  r.get('/health', (req, res) => res.json({}));
  falsa.use('/api', r);
  assert.deepEqual(rutasSinSesion(falsa, '/api').sin, ['GET /api/datos-abiertos']);
});
