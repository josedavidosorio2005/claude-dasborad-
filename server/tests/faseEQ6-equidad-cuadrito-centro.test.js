// faseEQ6-equidad-cuadrito-centro.test.js — pedido de Edwin (27/11/2026): en el Centro de cargas de ORLANT, un
// cuadrito «Equidad profesionales» al lado del de Calidad, con su mismo estilo («Al día» o «Pendiente», meses con
// datos en el año y última carga). La sección (texto, bases y meses) sale solo al abrir el cuadrito, como Calidad.
// No cambia la carga ni los datos. Datos INVENTADOS.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

global.esc = require('../../public/js/esc.js').esc;
Object.assign(global, require('../../public/js/centro-cargas-logic.js'));
const C = require('../../public/js/centro-equidad.js');
const PUB = path.join(__dirname, '..', '..', 'public', 'js');

const g = (id, nombre, meses) => ({ id, nombre, meses: meses.map(([mes, citas, cargadoEn]) => ({ mes, citas, cargadoEn: cargadoEn || '' })) });

test('resumen del año: meses con datos, última carga y «Al día» solo si cada base tiene el mes anterior', () => {
  const r = { grupos: [g('polizas', 'Pólizas', [['2031-09', 10, '2031-10-02T10:00:00Z'], ['2031-10', 8, '2031-11-03T09:00:00Z']]), g('prepagada', 'Medicina prepagada', [['2031-10', 5, '2031-11-02T09:00:00Z']]), g('particulares', 'Particulares', [['2030-12', 3, '2031-01-05T00:00:00Z']])] };
  assert.deepEqual(C.ccEquidadResumenAnio(r, 2031, '2031-11'), { mesesConDatos: 2, ultimaCarga: '2031-11-03T09:00:00Z', alDia: false });
  r.grupos[2].meses.push({ mes: '2031-10', citas: 2, cargadoEn: '2031-11-04T08:00:00Z' });
  assert.deepEqual(C.ccEquidadResumenAnio(r, 2031, '2031-11'), { mesesConDatos: 2, ultimaCarga: '2031-11-04T08:00:00Z', alDia: true });
  assert.equal(C.ccEquidadResumenAnio(r, 2030, '2031-11').alDia, true, 'un año pasado con datos está al día');
  assert.deepEqual(C.ccEquidadResumenAnio({ grupos: [] }, 2031, '2031-11'), { mesesConDatos: 0, ultimaCarga: '', alDia: false });
});

test('cuadrito: mismo estilo que los módulos (cc-tarjeta), abre la sección y escapa los textos', () => {
  const r = { grupos: [g('polizas', 'Pólizas <x>', [['2031-10', 8, '2031-11-03T09:00:00Z']])] };
  const h = C.ccEquidadTarjetaHtml(r, 2031, '2031-11');
  assert.match(h, /^<button type="button" class="cc-tarjeta cc-tarjeta-equidad" onclick="ccAbrirModulo\('equidad'\)">/);
  assert.match(h, /<span class="cc-pill cc-pill-ok">Al día<\/span>/);
  assert.match(h, /<span class="cc-tarjeta-nombre">Equidad profesionales<\/span><span class="cc-tarjeta-dato">1 mes con datos en 2031<\/span><span class="cc-tarjeta-sub">Última carga: /);
  assert.ok(h.includes('Pólizas &lt;x&gt;') && !h.includes('<x>'));
  const vacio = C.ccEquidadTarjetaHtml({ grupos: [] }, 2031, '2031-11');
  assert.match(vacio, /cc-pill-falta">Pendiente<\/span>[\s\S]*Nada cargado en 2031/);
  assert.equal(C.CC_EQUIDAD_ID, 'equidad');
});

test('Centro de cargas: el cuadrito va después de Calidad y la sección solo se ve abierta', () => {
  const cc = fs.readFileSync(path.join(PUB, 'centro-cargas.js'), 'utf8');
  assert.match(cc, /if \(m\.id === 'calidad'\) html \+= eq;/);
  assert.match(cc, /html \+ \(conCalidad \? '' : eq\) \+ '<\/div>'/, 'sin Calidad, al final');
  assert.match(cc, /ccEquidadMostrar\(_ccEsEquidad\(\)\);/);
  assert.match(cc, /function _ccEsEquidad\(\) \{ return _cc\.cliente === 'ORLANT' && [^}]*_cc\.modulo === CC_EQUIDAD_ID; \}/);
  assert.match(cc, /if \(_ccEsEquidad\(\)\) _ccRenderEquidad\(\); else if \(_cc\.modulo\) _ccRenderModulo\(\); else _ccRenderTarjetas\(\);/);
  const eq = fs.readFileSync(path.join(PUB, 'centro-equidad.js'), 'utf8');
  assert.match(eq, /c\.hidden = !\(typeof _cc !== 'undefined' && _cc && _cc\.modulo === CC_EQUIDAD_ID\);/, 'no siempre abierta');
  assert.doesNotMatch(eq, /\n  c\.hidden = false;/);
  // La carga no cambia: mismas rutas.
  assert.match(eq, /apiRequest\('POST', '\/orlant\/equidad\/cargas\/' \+ encodeURIComponent\(g\.id\)/);
});
