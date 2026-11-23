// faseGH6-th-salario-sede.test.js — Fase GH6 (Edwin, 23/11/2026): en «Talento humano», salario y sede
// son OBLIGATORIOS en la ficha del empleado (aviso claro en el campo), y las gráficas no fallan con
// registros viejos que no los tengan. Lee lo GENERADO (public/gestion-humana/talento-humano-app.js) y
// ejecuta sus funciones en una VM. Datos INVENTADOS.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const APP = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'gestion-humana', 'talento-humano-app.js'), 'utf8');
const tramo = (a, b) => { const i = APP.indexOf(a); const j = APP.indexOf(b, i); assert.ok(i >= 0 && j > i, 'no encontré ' + a); return APP.slice(i, j); };

// Ficha mínima con todos los campos obligatorios llenos (valores inventados).
function contexto() {
  const ctx = { DB: [], pd: (s) => (s ? new Date(s) : null), edad: () => 30, String, Object, Math, Set, console };
  vm.createContext(ctx);
  vm.runInContext(tramo('const F=[', '// campos que se revisan') + '\n' + tramo('function validate(e){', '/* ===================== HISTORIAL DE CARGOS') +
    '\nthis.F=F;this.validate=validate;', ctx);
  return ctx;
}
function fichaCompleta(ctx) {
  const e = {};
  ctx.F.forEach((f) => { if (f[5]) e[f[0]] = f[2] === 'date' ? '2020-01-15' : f[2] === 'num' || f[2] === 'money' ? '1' : 'Dato inventado'; });
  e.correo = 'persona@ejemplo.test'; e.salario = '1500000'; e.sede = 'Sede inventada';
  return e;
}

test('la ficha no se guarda sin salario (o con salario 0) ni sin sede, con aviso claro en el campo', () => {
  const ctx = contexto();
  const ok = fichaCompleta(ctx);
  assert.deepEqual(Object.keys(ctx.validate(ok)), [], 'una ficha completa pasa');
  for (const sal of ['', '0', '-5', 'abc', undefined]) {
    const er = ctx.validate(Object.assign({}, ok, { salario: sal }));
    assert.match(String(er.salario), /El salario es obligatorio/, 'salario ' + sal);
  }
  for (const sede of ['', '   ', undefined, null]) {
    const er = ctx.validate(Object.assign({}, ok, { sede }));
    assert.match(String(er.sede), /La sede es obligatoria/, 'sede ' + JSON.stringify(sede));
  }
  // Un registro viejo sin los dos campos, al editarse, marca los dos.
  const viejo = Object.assign({}, ok); delete viejo.salario; delete viejo.sede;
  assert.deepEqual(Object.keys(ctx.validate(viejo)).sort(), ['salario', 'sede']);
});

test('«Nómina mensual por cargo» con registros viejos sin salario no da NaN', () => {
  const ctx = { esc: (s) => String(s), PAL: ['#111', '#222'], Math, Object, String };
  vm.createContext(ctx);
  vm.runInContext(tramo('function sumBy(', '\nfunction legend(') + '\n' + tramo('function cols(', '\nfunction stack(') + '\nthis.sumBy=sumBy;this.cols=cols;', ctx);
  const viejos = [{ cargo: 'Asesor' }, { cargo: 'Asesor', salario: '' }, { cargo: '' }];
  const svg = ctx.cols(ctx.sumBy(viejos, (e) => e.cargo), null, (n) => '$ ' + n, 'grad', 1100);
  assert.ok(svg.startsWith('<svg'), 'dibuja la gráfica');
  assert.ok(!/NaN|Infinity/.test(svg), 'sin NaN ni Infinity en el SVG');
  assert.match(svg, /Sin dato/);
  const mixto = ctx.cols(ctx.sumBy([{ cargo: 'Asesor', salario: 1000 }, { cargo: 'Líder' }], (e) => e.cargo), null, String, 'grad', 1100);
  assert.ok(!/NaN|Infinity/.test(mixto));
});

test('las listas de sedes y cargos no fallan si un registro viejo trae un número', () => {
  const ctx = { DB: [{ sede: 'Norte' }, { sede: 33 }, { sede: '' }, {}], activos: null, Set, String };
  ctx.activos = () => ctx.DB;
  vm.createContext(ctx);
  const uniq = APP.match(/function uniq\(k\)\{[^\n]*\}/)[0];
  const uniqA = APP.match(/const uniqA=k=>[^\n]*;/)[0];
  vm.runInContext(uniq + '\n' + uniqA + '\nthis.uniq=uniq;this.uniqA=uniqA;', ctx);
  assert.deepEqual(Array.from(ctx.uniq('sede')), [33, 'Norte']);
  assert.deepEqual(Array.from(ctx.uniqA('sede')), [33, 'Norte']);
});

test('el cambio vive en el generador (lo generado no se edita a mano)', () => {
  const gen = fs.readFileSync(path.join(__dirname, '..', '..', 'scripts', 'gestion-humana', 'generar-talento-humano.js'), 'utf8');
  assert.match(gen, /Fase GH6/);
  assert.ok(APP.includes('/* SinCo (GH6): salario y sede obligatorios, con aviso claro. */'));
});
