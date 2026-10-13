// fase139-sinco-nombre.test.js — Fase 139 (Prioridad 2): el nombre de la
// plataforma pasa a SInCo (exacto: S, I y C mayusculas) en la pantalla de
// ingreso, la de bienvenida y el <title>, definido en UNA constante
// (APP_NAME, public/js/constants.js). Falla si alguien escribe otra grafia
// ("SINCO", "Sinco"...) o si el texto de respaldo del HTML se desincroniza
// de la constante.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, '..', '..', 'public');
const html = fs.readFileSync(path.join(PUBLIC_DIR, 'index.html'), 'utf8');
const constants = fs.readFileSync(path.join(PUBLIC_DIR, 'js', 'constants.js'), 'utf8');

function bloque(id) {
  const ini = html.indexOf('<div id="' + id + '"');
  assert.ok(ini >= 0, 'no se encontro #' + id);
  const fin = html.indexOf('\n</div>', ini);
  return html.slice(ini, fin);
}

test('APP_NAME es exactamente "SInCo"', () => {
  const m = constants.match(/var APP_NAME = '([^']+)';/);
  assert.ok(m, 'falta var APP_NAME en constants.js');
  assert.equal(m[1], 'SInCo');
});

test('el <title> y cada [data-app-name] traen el mismo texto que APP_NAME', () => {
  const nombre = constants.match(/var APP_NAME = '([^']+)';/)[1];
  assert.equal(html.match(/<title>([^<]+)<\/title>/)[1], nombre);
  const marcados = [...html.matchAll(/<(\w+)[^>]*\sdata-app-name[^>]*>([^<]*)<\/\1>/g)];
  assert.equal(marcados.length, 2, 'se esperaba el nombre en el login y en la bienvenida');
  marcados.forEach((m) => assert.equal(m[2], nombre));
  assert.ok(bloque('login-page').includes('data-app-name'), 'el login no muestra el nombre');
  assert.ok(bloque('user-page').includes('data-app-name'), 'la bienvenida no muestra el nombre');
});

test('constants.js aplica APP_NAME al <title> y a [data-app-name]', () => {
  assert.match(constants, /document\.title = APP_NAME;/);
  assert.match(constants, /querySelectorAll\('\[data-app-name\]'\)/);
});

test('login y bienvenida no usan otra grafia del nombre ni el texto viejo', () => {
  for (const id of ['login-page', 'user-page']) {
    const visible = bloque(id).replace(/<[^>]+>/g, ' ');
    assert.doesNotMatch(visible, /\bSINCO\b|\bSinco\b|\bsinco\b|INCONEXION PLATFORM/, 'grafia incorrecta en #' + id);
    assert.doesNotMatch(visible, /Acceso a la plataforma/i, 'quedo "Acceso a la plataforma" en #' + id);
  }
});
