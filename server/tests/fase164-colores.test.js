// fase164-colores.test.js — Fase 164 (lote 2): colores de las graficas.
// - Agendas e Inasistencia "por especialidad" (barras, una sola serie): un
//   solo color para todas las barras y sin leyenda, igual que "Calidad por
//   asesor" (D-03). Antes cada barra salia de un color distinto (hash del
//   nombre), y dos especialidades podian compartir color.
// - Torta generica (panel tipo 'pie' del tablero): sin colores repetidos,
//   igual que Tipificacion (paletaColoresSinRepetir, D-02).
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const JS = path.join(__dirname, '..', '..', 'public', 'js');
const leer = (f) => fs.readFileSync(path.join(JS, f), 'utf8');
function cuerpo(src, desde, hasta) {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, 'no se encontro: ' + desde);
  return src.slice(i, src.indexOf(hasta, i + desde.length));
}

test('Agendas por especialidad: Fase 183, un color por barra sin repetir y sin leyenda', () => {
  const b = cuerpo(leer('agendas.js'), "if(vista === 'especialidad'){", "} else if(vista === 'mensual'){");
  assert.ok(b.includes('paletaColoresSinRepetir(datos.map(function(r){ return r.especialidad; }))'));
  assert.ok(b.includes('backgroundColor: coloresEsp || '));
  assert.match(b, /o1\.plugins\.legend = \{ display:false \};/);
});

test('Inasistencia por especialidad: un solo color (serie principal) y sin leyenda', () => {
  const b = cuerpo(leer('inasistencia.js'), "var labels = ordenadas.map(", "var notaEl = document.getElementById('inasist-esp-nota-'");
  assert.doesNotMatch(b, /paletaColorPara/, 'ya no un color por especialidad');
  assert.match(b, /backgroundColor: \(typeof colorSerie==='function' \? colorSerie\('principal'\)/);
  assert.match(b, /o\.plugins\.legend = \{ display:false \};/);
});

test('torta generica: sin colores repetidos (paletaColoresSinRepetir)', () => {
  const b = cuerpo(leer('dashboard-generic.js'), "if(p.tipo === 'pie'){", '_gdRenderNotasPanel(p, i);');
  assert.match(b, /backgroundColor: paletaColoresSinRepetir\(pr\.labels\|\|\[\]\)/);
  assert.doesNotMatch(b, /paletaColorPara/);
});

test('paletaColoresSinRepetir: la misma etiqueta repetida conserva su color; las distintas no chocan', () => {
  const { paletaColoresSinRepetir } = require('../../public/js/paleta-logic.js');
  const PC = leer('charts.js').match(/var PC=\[([^\]]+)\]/)[1].split(',').map((s) => s.trim().replace(/'/g, ''));
  const etiquetas = ['Financiero', 'Financiero', 'Financiero', 'Financiero', 'Operativo', 'Operativo', 'Operativo', 'Operativo', 'Calidad', 'Clientes', 'Clientes', 'Clientes'];
  const c = paletaColoresSinRepetir(etiquetas, PC);
  const porEtiqueta = {};
  etiquetas.forEach((e, i) => {
    if (porEtiqueta[e]) assert.equal(c[i], porEtiqueta[e], e + ' repetida: mismo color');
    porEtiqueta[e] = c[i];
  });
  assert.equal(new Set(Object.values(porEtiqueta)).size, 4, '4 categorias, 4 colores distintos');
});
