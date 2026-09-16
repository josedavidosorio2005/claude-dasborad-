const { test } = require('node:test');
const assert = require('node:assert/strict');
const { paletaColorPara } = require('../../public/js/paleta-logic');

const PAL = ['#a', '#b', '#c', '#d', '#e'];

test('paletaColorPara: la misma etiqueta siempre da el mismo color', () => {
  const c1 = paletaColorPara('Contactados', PAL);
  const c2 = paletaColorPara('Contactados', PAL);
  const c3 = paletaColorPara('Contactados', PAL);
  assert.equal(c1, c2);
  assert.equal(c2, c3);
});

test('paletaColorPara: no depende de mayusculas ni espacios al inicio/final', () => {
  assert.equal(paletaColorPara('Ventas', PAL), paletaColorPara('  ventas  ', PAL));
  assert.equal(paletaColorPara('VENTAS', PAL), paletaColorPara('ventas', PAL));
});

test('paletaColorPara: etiquetas distintas tienden a repartirse en la paleta (no todas al mismo color)', () => {
  const etiquetas = ['Contactados', 'Ventas', 'Gestionados', 'Meta', 'Conversion', 'AHT'];
  const colores = new Set(etiquetas.map((e) => paletaColorPara(e, PAL)));
  assert.ok(colores.size >= 2, 'se esperaban al menos 2 colores distintos entre 6 etiquetas variadas');
});

test('paletaColorPara: el color esta siempre dentro de la paleta dada', () => {
  ['a', 'b', 'c', '', 'algo raro con ñ y tildes áéíóú', '123'].forEach((e) => {
    assert.ok(PAL.includes(paletaColorPara(e, PAL)));
  });
});

test('paletaColorPara: null/undefined no rompe (misma etiqueta vacia siempre igual)', () => {
  assert.equal(paletaColorPara(null, PAL), paletaColorPara(undefined, PAL));
  assert.equal(paletaColorPara(null, PAL), paletaColorPara('', PAL));
});

test('paletaColorPara: el orden en que se piden las etiquetas no cambia su color (a prueba de reordenamientos del Excel)', () => {
  const etiquetas = ['Objecion precio', 'No contesta', 'Numero equivocado', 'Interesado'];
  const primeraVuelta = etiquetas.map((e) => paletaColorPara(e, PAL));
  const reordenadas = etiquetas.slice().reverse();
  const segundaVuelta = reordenadas.map((e) => paletaColorPara(e, PAL));
  etiquetas.forEach((e, i) => {
    const colorOriginal = primeraVuelta[i];
    const colorTrasReordenar = segundaVuelta[reordenadas.indexOf(e)];
    assert.equal(colorOriginal, colorTrasReordenar, `"${e}" cambio de color al reordenar`);
  });
});

test('paletaColorPara: sin paleta explicita usa PC global si existe, si no un default', () => {
  const color = paletaColorPara('Cualquiera');
  assert.equal(typeof color, 'string');
  assert.ok(color.startsWith('#'));
});
