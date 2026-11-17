// fase357d-ver-como-interfaz.test.js — Fase 357 D: interfaz de «Ver como este usuario».
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { verComoTexto } = require('../../public/js/ver-como.js');
const PUB = path.join(__dirname, '..', '..', 'public');
const leer = (r) => fs.readFileSync(path.join(PUB, r), 'utf8');

test('texto de la franja: nombre, rol, solo lectura y hora de fin en Colombia', () => {
  const t = verComoTexto('Ana', 'CLIENTES_DASH', '2026-11-17T20:30:00.000Z');
  assert.match(t, /^Viendo como Ana \(CLIENTES_DASH\) · solo lectura · hasta 3:30/);
  assert.equal(verComoTexto('Ana', 'ASESOR', 'no'), 'Viendo como Ana (ASESOR) · solo lectura');
});

test('Usuarios: «Ver como este usuario» solo para ADMIN, nunca hacia un ADMIN ni una cuenta suspendida', () => {
  const u = leer('js/users.js');
  assert.match(u, /var canVerComo = isFullAdmin\(\) && u\.rol!=='ADMIN' && u\.active/);
  assert.match(u, /verComoIniciar\('\+u\.id\+'\)">Ver como este usuario<\/button>/);
});

test('página: franja con «Volver a mi sesión», script cargado y salida segura', () => {
  const i = leer('index.html');
  assert.match(i, /id="ver-como-banner" class="ver-como-banner hidden" role="status"/);
  assert.match(i, /onclick="verComoVolver\(\)">Volver a mi sesión<\/button>/);
  assert.ok(i.indexOf('js/session.js') < i.indexOf('js/ver-como.js'));
  const s = leer('js/session.js');
  assert.match(s, /_loginDatos = data;/);
  assert.match(s, /function doLogout\(\)\{\s*\/\/[^\n]*\n\s*if\(typeof verComoAntesDeSalir === 'function'\) verComoAntesDeSalir\(\);/);
  const v = leer('js/ver-como.js');
  assert.match(v, /'\/admin\/ver-como\/fin'/);
  assert.ok(!/localStorage|sessionStorage/.test(v), 'el token del administrador nunca se guarda en el navegador');
  const css = leer('css/styles.css');
  assert.match(css, /\.ver-como-banner\.hidden\{display:none\}/);
});
