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

// Fase 146 (pedido de Edwin, 14/10): el isotipo ya no va ENCIMA de "SInCo"
// sino a su IZQUIERDA, en la misma linea, dentro de un contenedor flex
// centrado (.marca-sinco). Estas 2 pruebas reemplazan las de la Fase 145.
test('login: isotipo a la IZQUIERDA de "SInCo" en el mismo contenedor, color + blanco con @2x, alt y tamaño fijo', () => {
  const iCont = loginBox.indexOf('<div class="marca-sinco marca-sinco-login">');
  const iClaro = loginBox.indexOf('<img class="isotipo-tema-claro"');
  const iOscuro = loginBox.indexOf('<img class="isotipo-tema-oscuro"');
  const iTitulo = loginBox.indexOf('<h1 class="app-name app-name-login" data-app-name>SInCo</h1>');
  const iFin = loginBox.indexOf('</div>', iTitulo);
  assert.ok(iCont !== -1 && iCont < iClaro && iClaro < iOscuro && iOscuro < iTitulo && iTitulo < iFin, 'logo(s) y luego "SInCo", dentro de .marca-sinco-login');
  assert.equal(loginBox.indexOf('login-isotipo'), -1, 'ya no queda el contenedor de la Fase 145 (logo encima)');
  assert.ok(loginBox.includes("<img class=\"isotipo-tema-claro\" src=\"img/marca/isotipo-color.png\" srcset=\"img/marca/isotipo-color.png 1x, img/marca/isotipo-color@2x.png 2x\" alt=\"InConexion\" width=\"38\" height=\"36\">"), "<img class=\"isotipo-tema-claro\" src=\"img/marca/isotipo-color.png\" srcset=\"img/marca/isotipo-color.png 1x, img/marca/isotipo-color@2x.png 2x\" alt=\"InConexion\" width=\"38\" height=\"36\">");
  assert.ok(loginBox.includes("<img class=\"isotipo-tema-oscuro\" src=\"img/marca/isotipo-blanco.png\" srcset=\"img/marca/isotipo-blanco.png 1x, img/marca/isotipo-blanco@2x.png 2x\" alt=\"InConexion\" width=\"38\" height=\"36\">"), "<img class=\"isotipo-tema-oscuro\" src=\"img/marca/isotipo-blanco.png\" srcset=\"img/marca/isotipo-blanco.png 1x, img/marca/isotipo-blanco@2x.png 2x\" alt=\"InConexion\" width=\"38\" height=\"36\">");
  for (const f of ['isotipo-color.png', 'isotipo-color@2x.png', 'isotipo-blanco.png', 'isotipo-blanco@2x.png']) {
    assert.ok(fs.existsSync(path.join(PUB, 'img', 'marca', f)), f);
  }
});

test('login y bienvenida: una sola linea centrada, tamaño reservado en CSS (no salta), cada tema con su isotipo', () => {
  assert.ok(css.includes(".marca-sinco{display:flex;align-items:center;justify-content:center;flex-wrap:nowrap;gap:var(--space-3);}"), ".marca-sinco{display:flex;align-items:center;justify-content:center;flex-wrap:nowrap;gap:var(--space-3);}");
  assert.ok(css.includes(".marca-sinco img{display:block;flex:none;object-fit:contain;}"), ".marca-sinco img{display:block;flex:none;object-fit:contain;}");
  assert.ok(css.includes(".marca-sinco-login img{width:38px;height:36px;}"), ".marca-sinco-login img{width:38px;height:36px;}");
  assert.ok(css.includes(".marca-sinco-login .isotipo-tema-oscuro{display:none;}"), ".marca-sinco-login .isotipo-tema-oscuro{display:none;}");
  assert.ok(css.includes("[data-theme=\"dark\"] .marca-sinco-login .isotipo-tema-claro{display:none;}"), "[data-theme=\"dark\"] .marca-sinco-login .isotipo-tema-claro{display:none;}");
  assert.ok(css.includes("[data-theme=\"dark\"] .marca-sinco-login .isotipo-tema-oscuro{display:block;}"), "[data-theme=\"dark\"] .marca-sinco-login .isotipo-tema-oscuro{display:block;}");
  assert.ok(css.includes(".marca-sinco-bienvenida img{width:46px;height:44px;"), ".marca-sinco-bienvenida img{width:46px;height:44px;");
  assert.ok(!css.includes('.login-isotipo'), 'sin reglas viejas de la Fase 145');
  // Bienvenida: isotipo BLANCO (fondo teal en los 2 temas) a la izquierda de "SInCo"
  const bienv = html.slice(html.indexOf('<div class="user-welcome">'), html.indexOf('<h1 id="welcome-name">'));
  const bienvPlano = bienv.replace(/\s+/g, ' ');
  assert.ok(bienvPlano.includes("<div class=\"marca-sinco marca-sinco-bienvenida\"> <img src=\"img/marca/isotipo-blanco.png\" srcset=\"img/marca/isotipo-blanco.png 1x, img/marca/isotipo-blanco@2x.png 2x\" alt=\"InConexion\" width=\"46\" height=\"44\"> <div class=\"app-name app-name-bienvenida\" data-app-name>SInCo</div> </div>"), "<div class=\"marca-sinco marca-sinco-bienvenida\"> <img src=\"img/marca/isotipo-blanco.png\" srcset=\"img/marca/isotipo-blanco.png 1x, img/marca/isotipo-blanco@2x.png 2x\" alt=\"InConexion\" width=\"46\" height=\"44\"> <div class=\"app-name app-name-bienvenida\" data-app-name>SInCo</div> </div>");
  assert.doesNotMatch(bienv, /isotipo-color/);
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

// Fase 146 (pedido de Edwin): tildes en los textos VISIBLES de index.html.
test('index.html: textos visibles con tilde; ids, for, value y nombres de campos sin cambios', () => {
  for (const t of ['>Cerrar Sesión<', '>Selecciona un módulo para continuar<', 'Gestión de Usuarios', '>Último ingreso<', 'Campaña']) {
    assert.ok(html.includes(t), t);
  }
  const visible = html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/g, '')
    .match(/>[^<>]+<|(?:placeholder|aria-label|title|alt)="[^"]*"/g)
    .join(' ');
  for (const w of ['Sesion', 'modulo', 'Gestion', 'Campana', 'campana', 'Periodo', 'Ultimo', 'Metrica', 'Categoria', 'Codificacion', 'Configuracion', 'automaticamente', 'Telefono', 'Pestanas']) {
    assert.doesNotMatch(visible, new RegExp('(?<![\\wÀ-ÿ])' + w + '(?![\\wÀ-ÿ])'), 'queda "' + w + '" sin tilde en un texto visible');
  }
  // lo que NO se toca: ids/for/name/value con "campana", "gestion", "periodo"
  for (const a of ['id="gh-campana"', 'for="gh-campana"', 'id="carga-periodo"', 'id="cal-campana-sel"', 'id="meta-campana-sel"']) {
    assert.ok(html.includes(a), a);
  }
});
