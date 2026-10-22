// fase164-tipificacion.test.js — Fase 164, lote 1 (auditoria de diseno):
// D-02: en la torta de Tipificacion dos categorias podian salir del mismo
// color (el color sale de un hash del nombre; con 12 colores y 9 categorias
// chocaban 3). D-04: la tabla de Tipificacion mostraba "24.92%" (punto) en
// vez de la coma es-CO del resto de la app.
// Las categorias son las de la base de demostracion (seed-demo), con la
// paleta real de charts.js (PC).
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { paletaColorPara, paletaColoresSinRepetir } = require('../../public/js/paleta-logic.js');

const JS = path.join(__dirname, '..', '..', 'public', 'js');
const PC = fs.readFileSync(path.join(JS, 'charts.js'), 'utf8').match(/var PC=\[([^\]]+)\]/)[1].split(',').map((s) => s.trim().replace(/'/g, ''));
// Orden de la torta: de mas a menos registros.
const CATEGORIAS = ['Agendamiento de cita', 'Cancelación', 'Información general', 'Reprogramación', 'Resultados', 'Otro motivo', 'Autorizaciones', 'Quejas', 'Llamada caída'];

test('punto de partida: con el hash solo, varias categorias comparten color', () => {
  const colores = CATEGORIAS.map((c) => paletaColorPara(c, PC));
  assert.ok(new Set(colores).size < CATEGORIAS.length, 'se esperaba al menos un choque (es el defecto que se corrige)');
});

test('paletaColoresSinRepetir: ningun color repetido en una misma grafica', () => {
  const colores = paletaColoresSinRepetir(CATEGORIAS, PC);
  assert.equal(colores.length, CATEGORIAS.length);
  assert.equal(new Set(colores).size, CATEGORIAS.length);
  colores.forEach((c) => assert.ok(PC.includes(c), c + ' esta en la paleta'));
});

test('paletaColoresSinRepetir: cada categoria conserva su color propio salvo choque', () => {
  const colores = paletaColoresSinRepetir(CATEGORIAS, PC);
  const vistos = new Set();
  CATEGORIAS.forEach((c, i) => {
    const propio = paletaColorPara(c, PC);
    if (!vistos.has(propio)) assert.equal(colores[i], propio, c + ' debia conservar su color');
    vistos.add(propio);
  });
  // la categoria con mas registros siempre queda con su color de siempre
  assert.equal(colores[0], paletaColorPara(CATEGORIAS[0], PC));
});

test('paletaColoresSinRepetir: mas categorias que colores no se cuelga (repite solo lo inevitable)', () => {
  const muchas = Array.from({ length: PC.length + 5 }, (_, i) => 'Categoria ' + i);
  const colores = paletaColoresSinRepetir(muchas, PC);
  assert.equal(colores.length, muchas.length);
  assert.equal(new Set(colores).size, PC.length);
  assert.deepEqual(paletaColoresSinRepetir([], PC), []);
});

// Render real de la mitad de Llamadas (tipificacion.js en un sandbox), con
// las funciones de paleta de verdad.
async function renderTipificacion() {
  const elementos = {}, graficas = [];
  const total = 1500;
  const cant = [410, 243, 168, 154, 122, 112, 109, 94, 88];
  const sandbox = {
    document: { getElementById: (id) => (elementos[id] = elementos[id] || { id, innerHTML: '', value: '' }) },
    apiRequest: async (m, url) => (url.indexOf('/resumen-salida') !== -1 ? { total: 0, conectadas: 0, noConectadas: 0 } : { total, datos: CATEGORIAS.map((t, i) => ({ tipificacion: t, cantidad: cant[i] })) }),
    _gdChart: (id, cfg) => graficas.push({ id, cfg }),
    loPie: (t) => ({ t }),
    tipificacionEtiqueta: (t) => t,
    paletaColorPara: (e) => paletaColorPara(e, PC),
    paletaColoresSinRepetir: (l) => paletaColoresSinRepetir(l, PC),
    showToast: () => {}, esc: (s) => String(s), textoFormatoNombre: (v) => v, URLSearchParams,
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(JS, 'tipificacion.js'), 'utf8'), sandbox);
  return { sandbox, elementos, graficas };
}

test('D-02: la torta de Tipificacion no repite colores', async () => {
  const { sandbox, graficas } = await renderTipificacion();
  vm.runInContext("_tipificacionPanelConfig[0] = { mostrarTablaDetalle: true }; _tipificacionEstadoCompartido[0] = { mes: '2026-09', desde: '', hasta: '' };", sandbox);
  await sandbox._tipificacionDibujarCanal('ORLANT', 0, 'LLAMADAS', { meses: ['2026-09'] });
  const torta = graficas.find((g) => g.cfg.type === 'pie');
  assert.ok(torta, 'se dibujo la torta');
  const colores = torta.cfg.data.datasets[0].backgroundColor;
  assert.equal(new Set(colores).size, colores.length);
});

test('D-04: la tabla de Tipificacion usa coma decimal es-CO ("24,92 %"), mismos 2 decimales', () => {
  const src = fs.readFileSync(path.join(JS, 'tipificacion.js'), 'utf8');
  const sandbox = { esc: (s) => String(s), tipificacionEtiqueta: (t) => t };
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox);
  const html = sandbox._tipificacionTablaDetalleHtml([{ tipificacion: 'Agendamiento de cita', cantidad: 148 }, { tipificacion: 'Cancelación', cantidad: 446 }], 594);
  assert.match(html, /<td>24,92 %<\/td>/);
  assert.match(html, /<td>75,08 %<\/td>/);
  assert.doesNotMatch(html, /\d\.\d{2}%/);
});
