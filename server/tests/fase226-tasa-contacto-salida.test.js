// fase226-tasa-contacto-salida.test.js — Fase 226 (pedido de Edwin, reunion
// 03/11, solo Mobilize): en "Llamadas Unicas y de Salida", mitad de salida,
// tarjeta "Tasa de contacto llamadas de salida" = conectadas / total x 100.
// Con MESES = Todos, el resumen del servidor; con meses marcados, suma de
// conectadas y de total de esos meses (nunca promedio de porcentajes).
// Total pendiente -> "Pendiente"; total 0 -> "—".
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const JS = path.join(__dirname, '..', '..', 'public', 'js');
const { llamadasSalidaTasaContacto } = require(path.join(JS, 'llamadas-unicas-logic.js'));
const G = require(path.join(JS, 'mes-global-logic.js'));

// _llamadasResumenMeses es del panel (llamadas-unicas.js): se evalua sola.
function resumenMeses(mesesSel) {
  const src = fs.readFileSync(path.join(JS, 'llamadas-unicas.js'), 'utf8');
  const ini = src.indexOf('function _llamadasResumenMeses');
  const fin = src.indexOf('\n}\n', ini) + 2;
  const ctx = { _gd: { mesesSel }, gdSumarMeses: G.gdSumarMeses };
  vm.createContext(ctx);
  vm.runInContext(src.slice(ini, fin), ctx);
  return ctx._llamadasResumenMeses;
}

const SERVIDOR = { total: 320, noConectadas: 184, conectadas: 136, noConectadasPendiente: false };
const POR_MES = [
  { periodo: '2026-08', total: 100, noConectadas: 60, conectadas: 40 },
  { periodo: '2026-09', total: 134, noConectadas: 83, conectadas: 51 },
  { periodo: '2026-10', total: 86, noConectadas: 41, conectadas: 45 },
];
const CAMPOS = ['total', 'noConectadas', 'conectadas'];

test('Todos: conectadas / total del resumen del servidor, 1 decimal con coma', () => {
  const r = resumenMeses([])(SERVIDOR, POR_MES, CAMPOS);
  assert.equal(llamadasSalidaTasaContacto(r), '42,5 %'); // 136 / 320
});

test('un mes: la tasa de ese mes', () => {
  const r = resumenMeses(['2026-10'])(SERVIDOR, POR_MES.filter((m) => m.periodo === '2026-10'), CAMPOS);
  assert.equal(llamadasSalidaTasaContacto(r), '52,3 %'); // 45 / 86
});

test('dos meses: suma de conectadas / suma de total, nunca promedio de porcentajes', () => {
  const dos = POR_MES.filter((m) => m.periodo !== '2026-09');
  const r = resumenMeses(['2026-08', '2026-10'])(SERVIDOR, dos, CAMPOS);
  assert.equal(llamadasSalidaTasaContacto(r), '45,7 %'); // (40 + 45) / (100 + 86) = 45,70 %
  // el promedio de 40,0 % y 52,3 % daria 46,2 %: no es eso
  assert.notEqual(llamadasSalidaTasaContacto(r), '46,2 %');
});

test('total pendiente (mes sin reporte de no conectadas): "Pendiente", nunca un numero', () => {
  const conPendiente = [{ periodo: '2026-08', total: null, noConectadas: null, conectadas: 27 }, POR_MES[2]];
  const r = resumenMeses(['2026-08', '2026-10'])(SERVIDOR, conPendiente, CAMPOS);
  assert.equal(r.total, null);
  assert.equal(llamadasSalidaTasaContacto(r), 'Pendiente');
  assert.equal(llamadasSalidaTasaContacto({ total: null, conectadas: 10 }), 'Pendiente');
});

test('total 0: "—"', () => {
  assert.equal(llamadasSalidaTasaContacto({ total: 0, conectadas: 0 }), '—');
  assert.equal(llamadasSalidaTasaContacto(null), 'Pendiente');
});

test('la tarjeta va de 4.ª en la mitad de salida con el titulo exacto', () => {
  const src = fs.readFileSync(path.join(JS, 'llamadas-unicas.js'), 'utf8');
  const kpis = src.slice(src.indexOf('function _llamadasSalidaKpisHtml'), src.indexOf('\n}\n', src.indexOf('function _llamadasSalidaKpisHtml')));
  const titulos = [...kpis.matchAll(/<div class="kl">([^<]+)<\/div>/g)].map((m) => m[1]);
  assert.deepEqual(titulos, ['Total llamadas de salida', 'Llamadas de salida no conectadas', 'Llamadas de salida conectadas', 'Tasa de contacto llamadas de salida']);
  assert.match(kpis, /llamadasSalidaTasaContacto\(resumen\)/);
});
