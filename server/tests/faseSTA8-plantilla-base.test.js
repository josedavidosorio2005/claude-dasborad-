// faseSTA8-plantilla-base.test.js — pendiente del STA de ORLANT (23/11/2026): «Descargar plantilla» en el
// panel de carga de Gestión STA. Un Excel VACÍO, solo con los 8 encabezados que pide la carga (los mismos
// CAMPOS que exige server/orlant-sta.js), sin filas de ejemplo. Por scripts/orlant/generar-sta.js.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const XLSX = require('../../public/js/vendor/xlsx-0.20.3.full.min.js');
const STA = require('../orlant-sta');

const APP = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'orlant-sta-app.js'), 'utf8');
function fuente(nombre) {
  const i = APP.search(new RegExp('\\nfunction ' + nombre + '\\('));
  assert.ok(i >= 0, 'no está la función ' + nombre);
  const resto = APP.slice(i + 1);
  return resto.slice(0, resto.slice(1).search(/\n(?:async )?function |\nconst |\nlet /) + 1);
}
const CAMPOS_APP = JSON.parse(APP.match(/const CAMPOS = (\[[^\]]*\])/)[1].replace(/'/g, '"'));

test('los encabezados de la plantilla son exactamente los que pide la carga, en el mismo orden', () => {
  assert.deepEqual(CAMPOS_APP, STA.CAMPOS);
  assert.equal(STA.CAMPOS.length, 8);
});

test('«Descargar plantilla» arma un Excel con solo los 8 encabezados y ninguna fila', () => {
  let archivo = null, nombre = null, aviso = null;
  const ctx = { CAMPOS: CAMPOS_APP, toast: (t) => { aviso = t; },
    XLSX: Object.assign({}, XLSX, { writeFile: (wb, n) => { archivo = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }); nombre = n; } }) };
  vm.createContext(ctx);
  vm.runInContext(fuente('descargarPlantilla'), ctx);
  ctx.descargarPlantilla();
  assert.equal(aviso, null);
  assert.equal(nombre, 'Plantilla_base_STA.xlsx');
  const wb = XLSX.read(archivo, { type: 'buffer' });
  assert.deepEqual(wb.SheetNames, ['Base STA']);
  const aoa = XLSX.utils.sheet_to_json(wb.Sheets['Base STA'], { header: 1, defval: '' });
  assert.deepEqual(aoa, [STA.CAMPOS], 'una sola fila: los encabezados');
  // sin SheetJS avisa en vez de romperse
  const ctx2 = { CAMPOS: CAMPOS_APP, toast: (t) => { aviso = t; } };
  vm.createContext(ctx2); vm.runInContext(fuente('descargarPlantilla'), ctx2); ctx2.descargarPlantilla();
  assert.match(aviso, /No se pudo preparar el archivo de Excel/);
});

test('el botón está en el panel de carga y llama a STAapp.descargarPlantilla (generado, sin editar el HTML de Edwin)', () => {
  const markup = JSON.parse(APP.match(/var STA_MARKUP = (".*?");\n/s)[1]);
  const i = markup.indexOf('Cargar base de datos'), j = markup.indexOf('Historial de cargas');
  assert.ok(i > 0 && j > i);
  assert.match(markup.slice(i, j), /onclick="STAapp\.descargarPlantilla\(\)">Descargar plantilla<\/button>/);
  assert.match(APP, /var STAapp = \{[^}]*descargarPlantilla/);
  const gen = fs.readFileSync(path.join(__dirname, '..', '..', 'scripts', 'orlant', 'generar-sta.js'), 'utf8');
  assert.match(gen, /function descargarPlantilla\(\)/);
});
