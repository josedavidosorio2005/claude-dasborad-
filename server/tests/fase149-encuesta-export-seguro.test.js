// fase149-encuesta-export-seguro.test.js — Fase 149 (auditoria 148, hallazgo
// bajo): el Excel de la Encuesta de Mobilize (comentarios de texto libre)
// ya NO cae en silencio a las filas crudas si falta la proteccion
// anti-formula (xlsxFilasSeguras): no exporta y muestra un error.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'encuesta.js'), 'utf8');
const ini = SRC.indexOf('function _encuestaExportExcel');
const FN = SRC.slice(ini, SRC.indexOf('\nfunction ', ini + 1));

function correr(conProteccion) {
  const toasts = [];
  const escritos = [];
  const ctx = {
    toasts, escritos,
    showToast: (m, t) => toasts.push({ m, t }),
    document: { getElementById: () => ({ dataset: { campana: 'MOBILIZE' } }) },
    _encuestaDatosExport: () => [{ hoja: 'Comentarios', filas: [{ Comentario: '=HYPERLINK("x")' }] }],
    XLSX: {
      utils: { book_new: () => ({ hojas: [] }), json_to_sheet: (f) => f, book_append_sheet: (wb, ws) => wb.hojas.push(ws) },
      writeFile: (wb) => escritos.push(wb),
    },
  };
  if (conProteccion) ctx.xlsxFilasSeguras = (filas) => filas.map((f) => ({ Comentario: "'" + f.Comentario }));
  vm.createContext(ctx);
  vm.runInContext(FN + '\n_encuestaExportExcel(0);', ctx);
  return ctx;
}

test('sin xlsxFilasSeguras: no escribe ningun Excel y avisa con un error', () => {
  const r = correr(false);
  assert.equal(r.escritos.length, 0);
  assert.equal(r.toasts.length, 1);
  assert.equal(r.toasts[0].t, 'error');
});

test('con xlsxFilasSeguras: exporta las filas ya neutralizadas', () => {
  const r = correr(true);
  assert.equal(r.escritos.length, 1);
  assert.equal(r.escritos[0].hojas[0][0].Comentario, "'=HYPERLINK(\"x\")");
  assert.equal(r.toasts.length, 0);
});
