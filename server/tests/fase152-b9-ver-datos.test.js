// fase152-b9-ver-datos.test.js — Fase 152 (B9): "Ver datos" en cada grafica
// (tabla con los mismos numeros, sin pedir nada al servidor) y la fraccion
// "3 de 45" en los tooltips donde aplica.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const v = require('../../public/js/ver-datos-logic.js');

const PUB = path.join(__dirname, '..', '..', 'public');
const leer = (r) => fs.readFileSync(path.join(PUB, r), 'utf8');

test('fraccionTexto: "3 de 45" con miles es-CO; nada si no hay denominador', () => {
  assert.equal(v.fraccionTexto(3, 45), '3 de 45');
  assert.equal(v.fraccionTexto(4325, 4547), '4.325 de 4.547');
  assert.equal(v.fraccionTexto(3, 0), null);
  assert.equal(v.fraccionTexto(null, 45), null);
  assert.equal(v.fraccionTexto(3, undefined), null);
});

test('fraccionDePunto: series con num/den y porciones de torta', () => {
  const ds = { data: [95, 90], fraccion: { num: [95, 9], den: [100, 10] } };
  assert.equal(v.fraccionDePunto('line', ds, 0), '95 de 100');
  assert.equal(v.fraccionDePunto('line', ds, 1), '9 de 10');
  assert.equal(v.fraccionDePunto('bar', { data: [1, 2] }, 0), null, 'una barra de conteo no lleva fraccion');
  assert.equal(v.fraccionDePunto('doughnut', { data: [3, 30, 12] }, 0), '3 de 45');
});

test('verDatosTabla: mismas etiquetas y series de la grafica; la meta no es un dato', () => {
  const data = {
    labels: ['Agosto 2026', 'Septiembre 2026'],
    datasets: [
      { label: 'Total', data: [4547, 1912] },
      { label: 'Nivel de atención', data: [95.1, null] },
      { label: 'Meta 90 %', esMeta: true, data: [90, 90] },
    ],
  };
  const t = v.verDatosTabla(data);
  assert.deepEqual(t.columnas, ['Período', 'Total', 'Nivel de atención']);
  assert.deepEqual(t.filas, [['Agosto 2026', '4.547', '95,1'], ['Septiembre 2026', '1.912', '—']]);
  const conFmt = v.verDatosTabla(data, { formatear: (j, i, val) => (val === null ? '—' : j + ':' + i + ':' + val), primeraColumna: 'Mes' });
  assert.equal(conFmt.columnas[0], 'Mes');
  assert.equal(conFmt.filas[0][2], '1:0:95.1', 'usa el formateador (el texto del tooltip)');
  assert.deepEqual(v.verDatosTabla({ labels: ['A'], datasets: [{ data: [3] }] }).columnas, ['Período', 'Valor']);
});

test('verDatosHtml: tabla accesible (caption, th de columna y de fila) y escapada', () => {
  const html = v.verDatosHtml({ columnas: ['Período', '<b>x</b>'], filas: [['<i>Ago</i>', '1']] }, 'Datos de <script>');
  assert.match(html, /<caption class="sr-only">Datos de &lt;script&gt;<\/caption>/);
  assert.match(html, /<th scope="col">&lt;b&gt;x&lt;\/b&gt;<\/th>/);
  assert.match(html, /<th scope="row">&lt;i&gt;Ago&lt;\/i&gt;<\/th><td>1<\/td>/);
  assert.doesNotMatch(html, /<script>|<b>x|<i>Ago/);
  assert.match(v.verDatosHtml({ columnas: ['A', 'B'], filas: [] }), /colspan="2">Sin datos\./);
});

test('sinPrefijoSerie: la celda no repite el nombre de la serie del tooltip', () => {
  assert.equal(v.sinPrefijoSerie('Total: 4.547', 'Total'), '4.547');
  assert.equal(v.sinPrefijoSerie('95,1 % (4.325 de 4.547)', 'Nivel'), '95,1 % (4.325 de 4.547)');
});

test('dialogo "Ver datos": patron A3b, sin onclick en linea, y boton por grafica desde _gdChart', () => {
  const html = leer('index.html');
  const tag = html.match(/<div [^>]*id="modal-ver-datos"[^>]*>/)[0];
  assert.match(tag, /role="dialog"/);
  assert.match(tag, /aria-modal="true"/);
  assert.match(tag, /aria-labelledby="modal-ver-datos-title"/);
  const bloque = html.slice(html.indexOf('id="modal-ver-datos"'), html.indexOf('<div class="toast"'));
  assert.doesNotMatch(bloque, /onclick=/, 'sin onclick nuevos (fase CSP aparte)');
  const mh = require('../../public/js/motion-helpers.js');
  assert.ok('modal-ver-datos' in mh.MOTION_DIALOGOS_SIMPLES, 'Escape, foco e inert del patron A3b');
  const gd = leer('js/dashboard-generic.js');
  assert.match(gd, /_gdVerDatosBoton\(el, canvasId, empty\);/);
  assert.match(gd, /btn\.addEventListener\('click', function\(\)\{ abrirVerDatos\(canvasId\); \}\);/);
  assert.match(gd, /btn\.setAttribute\('aria-haspopup', 'dialog'\);/);
  assert.match(gd, /btn\.hidden = !!vacio;/, 'sin datos, sin boton');
  // No pide nada al servidor: arma la tabla con chart.data.
  const abrir = gd.slice(gd.indexOf('function abrirVerDatos'), gd.indexOf('function cerrarVerDatos'));
  assert.doesNotMatch(abrir, /apiRequest|fetch\(/);
  assert.match(abrir, /verDatosTabla\(chart\.data/);
});

test('fraccion en los tooltips: tortas automaticas y series de % con sus conteos', () => {
  const gd = leer('js/dashboard-generic.js');
  assert.match(gd, /_gdAgregarFraccionTooltip\(cfg\);\n  _gd\.charts\[canvasId\] = new Chart\(el, cfg\);/);
  const traf = leer('js/trafico.js');
  assert.match(traf, /fraccion: \{ num: agregado\.map\(function\(a\)\{ return a\.contestadas; \}\), den: agregado\.map\(function\(a\)\{ return a\.totalLlamadas; \}\) \}/);
  assert.match(traf, /fraccion: \{ num: agregadoComb\.map\(function\(a\)\{ return a\.llamadasAbandonadas; \}\)/);
  assert.match(leer('js/efectividad-citas.js'), /d\.fraccion = \{ num: filas\.map\(function\(f\)\{ return f\.atendidas; \}\), den: filas\.map\(function\(f\)\{ return f\.agendas; \}\) \}/);
  assert.match(leer('js/efectividad-agendamiento.js'), /d\.fraccion = \{ num: filas\.map\(function\(f\)\{ return f\.agendas; \}\), den: filas\.map\(function\(f\)\{ return f\.gestiones; \}\) \}/);
  assert.match(leer('js/whatsapp-tiempos.js'), /fraccionTexto\(x\.cantidad, r\.total\)/);
});

test('el script nuevo se carga antes de dashboard-generic.js', () => {
  const html = leer('index.html');
  const i = (s) => html.indexOf('<script src="js/' + s + '"></script>');
  assert.ok(i('ver-datos-logic.js') > i('esc.js'));
  assert.ok(i('ver-datos-logic.js') < i('dashboard-generic.js'));
});
