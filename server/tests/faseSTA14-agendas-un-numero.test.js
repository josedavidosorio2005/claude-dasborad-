// faseSTA14-agendas-un-numero.test.js — pedidos de Edwin (27/11/2026) para la Gestión STA (Gráficas del administrador
// y vista del cliente de ORLANT, que usan el mismo STA_MARKUP):
//  1) «Agendas por entidad» y «Agendas por servicio»: UN solo número por barra, el de las citas (el más alto), con la
//     etiqueta «agendas» («71 agendas», no «70 agendas · 71 citas»); el largo y el orden van por ese número; sin la
//     palabra «citas» en esas gráficas (tampoco en el subtítulo).
//  2) Fuera «Por Fecha Ingreso Sta», «Por Fecha Autorización» y «Por Fecha Expiración».
// Sin cambiar datos. Gestiones INVENTADAS.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { STA_MARKUP } = require('../../public/js/orlant-sta-app.js');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'orlant-sta-app.js'), 'utf8');
// La función real del archivo publicado, con fmt/esc mínimos.
const cuerpo = SRC.match(/function valAgendas[\s\S]*?(?=\nfunction agrupar)/)[0];
const filasCampoGest = new Function('fmt', 'esc', cuerpo + '\nreturn filasCampoGest;')((n) => n.toLocaleString('es-CO'), (s) => String(s));

const g = (entidad, citas) => ({ Entidad: entidad, _citas: citas });

test('agendas: un solo número (citas, el más alto) con la etiqueta «agendas»; largo y orden por ese número', () => {
  // A: 70 casos con 71 citas · B: 3 casos con 10 citas · C: 5 casos sin citas registradas (gana el número de casos).
  const lista = [...Array(69).fill(0).map(() => g('Entidad A', 1)), g('Entidad A', 2), g('Entidad B', 4), g('Entidad B', 3), g('Entidad B', 3), ...Array(5).fill(0).map(() => g('Entidad C', 0))];
  const f = filasCampoGest(lista, 'Entidad', true);
  assert.deepEqual(f.map((x) => [x.label, x.vals, x.etq]), [['Entidad A', [71], '71 agendas'], ['Entidad B', [10], '10 agendas'], ['Entidad C', [5], '5 agendas']]);
  for (const x of f) { assert.doesNotMatch(x.etq + x.tip, /citas?/i); assert.match(x.tip, /Agendas: <b>\d+<\/b>/); }
});

test('gestiones (sin citas) no cambian: número de gestiones', () => {
  const f = filasCampoGest([g('X', 5), g('X', 0), g('Y', 9)], 'Entidad', false);
  assert.deepEqual(f.map((x) => [x.label, x.vals, x.etq]), [['X', [2], '2'], ['Y', [1], '1']]);
});

test('sin «citas» en las tarjetas de agendas por entidad y por servicio', () => {
  for (const id of ['grAgEnt', 'grAgServ']) {
    const i = STA_MARKUP.indexOf('id="' + id + '"');
    const card = STA_MARKUP.slice(STA_MARKUP.lastIndexOf('<div class="card"', i), i);
    assert.doesNotMatch(card, /citas/i, id);
    assert.match(card, /Agendas de las gestiones efectivas, por (entidad|servicio)/);
  }
});

test('fuera las gráficas por fecha de ingreso, autorización y expiración (en las dos vistas: mismo markup)', () => {
  for (const x of ['grIng', 'grAut', 'grExp', 'Por Fecha Ingreso Sta', 'Por Fecha Autorización', 'Por Fecha Expiración']) {
    assert.ok(!STA_MARKUP.includes(x), x);
    assert.ok(!SRC.includes("'" + x + "'") && !SRC.includes("$('" + x), x);
  }
  assert.match(SRC, /const ids=\['grEnt2','grServ2','grEst','grCups'\];/);
  const vistas = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'orlant-sta.js'), 'utf8');
  assert.equal((vistas.match(/_staHojaCss\(\) \+ STA_MARKUP/g) || []).length, 2, 'admin y cliente montan el mismo markup');
});

test('recuadros de arriba: sin «Agendas (efectivas)» ni «Fuera de gestión»; el de citas se llama «Agendas»', () => {
  const kpis = SRC.match(/\$\('grKpis'\)\.innerHTML=\[[^\n]*/)[0];
  assert.match(kpis, /^\$\('grKpis'\)\.innerHTML=\[\['Gestionados',fmt\(gs\.length\)\],\['Agendas',fmt\(citas\)\],\['Efectividad/);
  for (const x of ['Agendas (efectivas)', 'Citas agendadas', 'Fuera de gestión']) assert.ok(!kpis.includes(x), x);
});

test('gestiones por entidad y por servicio: solo el número de gestiones (sin citas ni agendas)', () => {
  assert.match(SRC, /\[\['grGeEnt','Entidad'\],\['grGeServ','Servicio'\]\]\.forEach[^\n]*filasCampoGest\(gs,campo,false\)/);
  for (const x of filasCampoGest([g('X', 3), g('X', 1)], 'Entidad', false)) assert.doesNotMatch(x.etq + x.tip, /citas|agendas/i);
});
