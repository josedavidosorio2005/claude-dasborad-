// faseSTA-orlant-gestion-sta-app.test.js — Fase STA (parte 2): la app «Gestión STA» generada desde el
// HTML de Edwin (scripts/orlant/generar-sta.js → public/js/orlant-sta-app.js + css). Guardiana: el
// generador reproduce EXACTAMENTE lo publicado (nadie edita la app a mano), los manejadores en línea
// llaman a funciones que existen, y no queda nada de IndexedDB ni de crear/cambiar agentes.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const REPO = path.join(__dirname, '..', '..');
const leer = (p) => fs.readFileSync(path.join(REPO, p), 'utf8');

test('el generador reproduce exactamente orlant-sta-app.js y orlant-sta-app.css', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sta-gen-'));
  fs.mkdirSync(path.join(tmp, 'public', 'js'), { recursive: true });
  fs.mkdirSync(path.join(tmp, 'public', 'css'), { recursive: true });
  execFileSync(process.execPath, [path.join(REPO, 'scripts', 'orlant', 'generar-sta.js'), path.join(REPO, 'docs', 'orlant', 'sta', 'Gestion_STA.html'), tmp], { stdio: 'pipe' });
  assert.equal(fs.readFileSync(path.join(tmp, 'public/js/orlant-sta-app.js'), 'utf8'), leer('public/js/orlant-sta-app.js'), 'regenera con: node scripts/orlant/generar-sta.js');
  assert.equal(fs.readFileSync(path.join(tmp, 'public/css/orlant-sta-app.css'), 'utf8'), leer('public/css/orlant-sta-app.css'));
  fs.rmSync(tmp, { recursive: true, force: true });
});

test('la app: sin IndexedDB, sin crear/cambiar agentes ni borrar todo; manejadores con STAapp que existen', () => {
  const js = leer('public/js/orlant-sta-app.js');
  const { STA_MARKUP, staCrearApp } = require('../../public/js/orlant-sta-app.js');
  assert.equal(typeof staCrearApp, 'function');
  assert.ok(!/indexedDB|sessionStorage|function crearAgente|function cambiarAgente|function borrarTodo|function restaurarRespaldo/.test(js));
  assert.ok(!/Cambiar agente|nuevoAgente|Renombrar/.test(STA_MARKUP + js), 'sin «Cambiar de agente» ni crear/renombrar agentes');
  assert.ok(!/xlsx\.js \(C\) 2013-present SheetJS/.test(js), 'sin SheetJS embebido');
  const objeto = js.match(/var STAapp = \{ ([^}]*) \};/);
  assert.ok(objeto, 'STAapp definido');
  const exportadas = new Set(objeto[1].split(',').map((s) => s.trim().split(':')[0].trim()));
  const usadas = new Set([...(STA_MARKUP + js).matchAll(/STAapp\.(\w+|\$)\(/g)].map((m) => m[1]));
  for (const f of usadas) assert.ok(exportadas.has(f), 'STAapp.' + f + ' no existe');
  for (const f of ['tabSup', 'asignar', 'devolverSel', 'pasarSel', 'abrirCodificar', 'guardarCodificacion', 'crearTipi', 'pedirBorrarCarga', 'descargarCarga']) assert.ok(exportadas.has(f), f);
  // sin manejadores que llamen funciones globales sueltas
  for (const m of (STA_MARKUP + js).matchAll(/ on(?:click|change|input|keydown)="([^"]*)"/g)) assert.match(m[1], /STAapp\./, m[1].slice(0, 60));
});

test('la plataforma: overlay, scripts y tarjeta «Gestión STA» después de Calidad, solo para quien corresponde', () => {
  const i = leer('public/index.html');
  assert.match(i, /id="sta-overlay"/);
  assert.match(i, /<script src="js\/orlant-sta-app\.js"><\/script>\n<script src="js\/orlant-sta\.js"><\/script>/);
  assert.match(leer('public/js/dashboards-core.js'), /staVeTarjeta\(currentUser, isFullAdmin\(\)\)[\s\S]*onDashBtn\(\\'Calidad\\'\)[\s\S]*afterend/);
  const { staVeTarjeta } = require('../../public/js/orlant-sta.js');
  assert.equal(staVeTarjeta(null, true), true, 'admin maestro');
  assert.equal(staVeTarjeta({ rol: 'GERENCIA', perms: {} }, false), true);
  assert.equal(staVeTarjeta({ rol: 'SUPERVISOR', perms: { supervisa_ORLANT: true } }, false), true);
  assert.equal(staVeTarjeta({ rol: 'SUPERVISOR', perms: { supervisa_MOBILIZE: true } }, false), false);
  assert.equal(staVeTarjeta({ rol: 'ASESOR', asesorCampana: 'ORLANT', perms: {} }, false), true);
  assert.equal(staVeTarjeta({ rol: 'ASESOR', asesorCampana: 'MOBILIZE', perms: {} }, false), false);
  assert.equal(staVeTarjeta({ rol: 'CLIENTES_DASH', perms: { cliente_ORLANT: true } }, false), false, 'el cliente nunca ve la tarjeta');
});

test('portal del asesor: «Gestión STA» oculto salvo para el ASESOR de ORLANT', () => {
  const i = leer('public/index.html');
  assert.match(i, /<li id="asesor-menu-sta-li" class="hidden"><a id="asesor-menu-sta" role="button" tabindex="0" onclick="openOrlantSta\(\)">/);
  assert.match(leer('public/js/session.js'), /asesor-menu-sta-li[\s\S]*staVeTarjeta\(currentUser,false\)[\s\S]*showAsesorSection\('calidad'\);/);
});
