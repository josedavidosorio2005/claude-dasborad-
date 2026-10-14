// fase145-login-logo-contrasena.test.js — Fase 145 (pedido de Edwin para la
// entrega): (1) isotipo de InConexion dentro de la tarjeta del login,
// centrado encima de "SInCo" (color en claro, blanco en oscuro, @2x, 48px de
// alto fijo para que la tarjeta no salte); (2) "Contraseña" con ñ en todos
// los textos visibles de index.html, sin tocar ids/for/nombres de campos.
'use strict';

const fs = require('fs');
const path = require('path');
const { test } = require('node:test');
const assert = require('node:assert/strict');

const PUB = path.join(__dirname, '..', '..', 'public');
const html = fs.readFileSync(path.join(PUB, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(PUB, 'css', 'styles.css'), 'utf8');
const loginBox = html.slice(html.indexOf('<div class="login-box">'), html.indexOf('<div class="login-error"'));

test('login: isotipo dentro de la tarjeta, antes de "SInCo", color + blanco con @2x, alt y tamaño fijo', () => {
  const iLogo = loginBox.indexOf('<div class="login-isotipo">');
  const iTitulo = loginBox.indexOf('<h1 class="app-name app-name-login"');
  assert.ok(iLogo !== -1 && iLogo < iTitulo, 'el isotipo va encima de "SInCo", dentro de .login-box');
  assert.match(loginBox, /<img class="isotipo-tema-claro" src="img\/marca\/isotipo-color\.png" srcset="img\/marca\/isotipo-color\.png 1x, img\/marca\/isotipo-color@2x\.png 2x" alt="InConexion" width="50" height="48">/);
  assert.match(loginBox, /<img class="isotipo-tema-oscuro" src="img\/marca\/isotipo-blanco\.png" srcset="img\/marca\/isotipo-blanco\.png 1x, img\/marca\/isotipo-blanco@2x\.png 2x" alt="InConexion" width="50" height="48">/);
  for (const f of ['isotipo-color.png', 'isotipo-color@2x.png', 'isotipo-blanco.png', 'isotipo-blanco@2x.png']) {
    assert.ok(fs.existsSync(path.join(PUB, 'img', 'marca', f)), f);
  }
});

test('login: el alto del isotipo esta reservado en CSS (no salta) y cada tema muestra solo su version', () => {
  assert.match(css, /\.login-isotipo\{height:48px;/);
  assert.match(css, /\.login-isotipo img\{display:block;width:50px;height:48px;/);
  assert.match(css, /\.login-isotipo \.isotipo-tema-oscuro\{display:none;\}/);
  assert.match(css, /\[data-theme="dark"\] \.login-isotipo \.isotipo-tema-claro\{display:none;\}/);
  assert.match(css, /\[data-theme="dark"\] \.login-isotipo \.isotipo-tema-oscuro\{display:block;\}/);
});

test('el logo pequeño de la esquina del login sigue igual', () => {
  const login = html.slice(html.indexOf('<div id="login-page">'), html.indexOf('<!-- ', html.indexOf('<div id="login-page">') + 10));
  assert.match(login, /<img class="marca-esquina" src="img\/marca\/logo-horizontal-blanco\.png" srcset="img\/marca\/logo-horizontal-blanco\.png 1x, img\/marca\/logo-horizontal-blanco@2x\.png 2x" alt="InConexion" width="120" height="24">/);
});

test('"Contraseña" con ñ en todos los textos de index.html; ya no queda "Contrasena"', () => {
  assert.doesNotMatch(html, /contrasena/i);
  for (const t of ['<label for="password">Contraseña</label>', 'placeholder="Ingrese su contraseña"', '<label for="mu-pass">Contraseña</label>',
    '<h3 id="modal-pass-title">Cambiar Contraseña</h3>', '<label for="pass-new">Nueva Contraseña</label>',
    '<h3 id="modal-change-own-password-title">Cambiar mi Contraseña</h3>', '<label for="cop-actual">Contraseña Actual</label>',
    '<label for="cop-nueva">Nueva Contraseña</label>', '<label for="cop-confirmar">Confirmar Nueva Contraseña</label>',
    'aria-label="Mostrar contraseña"', '>Cambiar mi contraseña</button>']) {
    assert.ok(html.includes(t), t);
  }
});

test('ids, for y funciones de los campos de contraseña no cambian', () => {
  for (const id of ['password', 'mu-pass', 'pass-new', 'pass-confirm', 'cop-actual', 'cop-nueva', 'cop-confirmar']) {
    assert.match(html, new RegExp('id="' + id + '"'), id);
    assert.match(html, new RegExp("toggleEye\\('" + id + "',this\\)"), id);
  }
  assert.match(html, /onclick="abrirCambiarPasswordModal\(\)"/);
  assert.match(html, /<option value="PASSWORD">Cambio de contraseña<\/option>/);
});
