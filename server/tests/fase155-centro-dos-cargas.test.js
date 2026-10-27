// fase155-centro-dos-cargas.test.js — Fase 155 (reunion con Edwin, 19/10):
// en el Centro de cargas, un modulo con DOS archivos muestra arriba las dos
// opciones juntas ("Unicas de ingreso" / "De salida"; "Llamadas" /
// "WhatsApp"), cada una con su cuadricula de meses, Subir/Reemplazar y
// Descargar plantilla. Y la plantilla de cada una dice que archivo va en cada
// carga y de que reporte de Wolkvox sale.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const XLSX = require('../../public/js/vendor/xlsx-0.20.3.full.min.js');
const L = require('../../public/js/centro-cargas-logic.js');

const RAIZ = path.join(__dirname, '..', '..');

test('etiquetas cortas de las dos opciones y carga visible por defecto', () => {
  assert.equal(L.centroEtiquetaCarga({ id: 'llamadas_unicas', nombre: 'Llamadas Únicas (ingreso)' }), 'Únicas de ingreso');
  assert.equal(L.centroEtiquetaCarga({ id: 'llamadas_salida', nombre: 'Llamadas de Salida' }), 'De salida');
  assert.equal(L.centroEtiquetaCarga({ id: 'tipificacion_llamadas' }), 'Llamadas');
  assert.equal(L.centroEtiquetaCarga({ id: 'tipificacion_whatsapp' }), 'WhatsApp');
  assert.equal(L.centroEtiquetaCarga({ id: 'agendas', nombre: 'Agendas' }), 'Agendas');
  const m = { cargas: [{}, {}] };
  assert.equal(L.centroCargaVisible(m, undefined), 0);
  assert.equal(L.centroCargaVisible(m, 1), 1);
  assert.equal(L.centroCargaVisible(m, 5), 0);
});

function contexto() {
  const els = {};
  const el = (id) => (els[id] = els[id] || { innerHTML: '', classList: { toggle() {}, add() {}, remove() {} }, scrollTop: 0 });
  const ctx = {
    document: { getElementById: el, addEventListener() {}, querySelectorAll: () => [] },
    esc: (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'),
    iconoSvg: (n) => '<svg data-i="' + n + '"></svg>',
    els,
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(RAIZ, 'public', 'js', 'centro-cargas-logic.js'), 'utf8'), ctx);
  vm.runInContext(fs.readFileSync(path.join(RAIZ, 'public', 'js', 'centro-cargas.js'), 'utf8'), ctx);
  return ctx;
}
function meses() {
  return ['2026-08', '2026-09'].map((mes) => ({ mes, registros: mes === '2026-09' ? 10 : 0, ultimaCarga: null, cargadoPor: null, archivo: null }));
}

test('Centro: modulo con dos archivos -> selector arriba y se ve una carga a la vez', () => {
  const ctx = contexto();
  vm.runInContext(`
    _cc.cliente = 'MOBILIZE'; _cc.anio = 2026; _cc.versiones = [];
    _cc.modulos = [{ id: 'llamadas_unicas', nombre: 'Llamadas Únicas y de Salida', cargas: [
      { id: 'llamadas_unicas', nombre: 'Llamadas Únicas (ingreso)', plantilla: 'PLANTILLA_LLAMADAS_UNICAS.xlsx', meses: __m1 },
      { id: 'llamadas_salida', nombre: 'Llamadas de Salida', plantilla: 'PLANTILLA_LLAMADAS_SALIDA.xlsx', meses: __m2 } ] }];
    _cc.modulo = 'llamadas_unicas';`.replace('__m1', JSON.stringify(meses())).replace('__m2', JSON.stringify(meses())), ctx);
  vm.runInContext('_ccRenderModulo()', ctx);
  let html = ctx.els['cc-body'].innerHTML;
  const sel = html.indexOf('cc-selector');
  assert.ok(sel !== -1, 'hay selector');
  assert.ok(sel < html.indexOf('cc-carga'), 'el selector va arriba de la cuadricula');
  assert.match(html, /aria-pressed="true"[^>]*>Únicas de ingreso</);
  assert.match(html, /aria-pressed="false"[^>]*>De salida</);
  assert.equal((html.match(/<section class="cc-carga"/g) || []).length, 1, 'una cuadricula a la vez');
  assert.ok(html.includes('PLANTILLA_LLAMADAS_UNICAS.xlsx') && !html.includes('PLANTILLA_LLAMADAS_SALIDA.xlsx'));
  assert.match(html, /ccSubir\(0,1\)/, 'Subir/Reemplazar de la carga elegida (indice real)');
  // Elegir "De salida"
  vm.runInContext('ccElegirCarga(1)', ctx);
  html = ctx.els['cc-body'].innerHTML;
  assert.match(html, /aria-pressed="true"[^>]*>De salida</);
  assert.ok(html.includes('PLANTILLA_LLAMADAS_SALIDA.xlsx') && !html.includes('PLANTILLA_LLAMADAS_UNICAS.xlsx'));
  assert.match(html, /ccSubir\(1,1\)/, 'los botones apuntan a la segunda carga');
  assert.match(html, /ccDescargarCargado\(1,1\)/);
});

test('Centro: modulo con un solo archivo -> sin selector', () => {
  const ctx = contexto();
  vm.runInContext(`_cc.cliente = 'ORLANT'; _cc.anio = 2026; _cc.versiones = [];
    _cc.modulos = [{ id: 'agendas', nombre: 'Agendas', cargas: [{ id: 'agendas', nombre: 'Agendas', plantilla: 'PLANTILLA_AGENDAS.xlsx', meses: ${JSON.stringify(meses())} }] }];
    _cc.modulo = 'agendas'; _ccRenderModulo();`, ctx);
  assert.ok(!ctx.els['cc-body'].innerHTML.includes('cc-selector'));
});

test('plantillas de los modulos con dos archivos: INSTRUCCIONES dice que va en cada carga y de que reporte sale', () => {
  const casos = {
    // Fase 194: los dos reportes de Wolkvox del modulo.
    'PLANTILLA_LLAMADAS_ABANDONADAS.xlsx': ['"Abandonadas" (esta plantilla)', '"No conectadas"', 'CDR', 'Tipificación'],
    'PLANTILLA_LLAMADAS_NO_CONECTADAS.xlsx': ['"Abandonadas"', '"No conectadas" (esta plantilla)', 'no se quitan repetidas'],
    'PLANTILLA_TIPIFICACION_LLAMADAS.xlsx': ['"Llamadas"', '"WhatsApp"', 'CDR', 'HistChat', 'Esta plantilla es la de "Llamadas"'],
    'PLANTILLA_TIPIFICACION_WHATSAPP.xlsx': ['"Llamadas"', '"WhatsApp"', 'CDR', 'HistChat', 'Esta plantilla es la de "WhatsApp"'],
  };
  for (const [archivo, textos] of Object.entries(casos)) {
    const wb = XLSX.read(fs.readFileSync(path.join(RAIZ, 'server', 'plantillas', archivo)), { type: 'buffer' });
    const fila = XLSX.utils.sheet_to_json(wb.Sheets.INSTRUCCIONES, { header: 1, defval: '' }).find((f) => f[0] === 'Archivos del módulo');
    assert.ok(fila, archivo + ': falta la fila "Archivos del módulo"');
    textos.forEach((t) => assert.ok(fila[1].includes(t), archivo + ' no dice: ' + t));
  }
});
