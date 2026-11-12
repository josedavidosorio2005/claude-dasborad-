// fase345-paleta.test.js — Fase 345: paleta 3 «Segura para daltonismo» (Okabe-Ito sin semaforo),
// elegida por el usuario el 12/11/2026 y ajustada para pasar la medicion con daltonismo. Vive en
// UN solo archivo (public/css/paleta.css); estas pruebas miden ese archivo y que nadie mas tenga
// colores de serie escritos.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const C = require('../../public/js/contraste-logic.js');
const PAL = require('./helpers-paleta');

const PUB = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'public', f), 'utf8');
const CVD = ['protanopia', 'deuteranopia', 'tritanopia'];
const dN = (a, b) => C.contrasteDeltaE(a, b);
const dC = (a, b) => Math.min(...CVD.map((t) => C.contrasteDeltaE(C.contrasteSimularCvd(a, t), C.contrasteSimularCvd(b, t))));
const TEMAS = [['claro', PAL.claro], ['oscuro', PAL.oscuro]];

test('valores elegidos: tema claro con el azul #0072B2 de la paleta 3; botones de la propuesta 3', () => {
  assert.equal(PAL.claro.series[0], '#0072B2');
  assert.equal(PAL.oscuro.series[0], '#56B4E9');
  assert.equal(PAL.claro.series[4], '#7A5C2E', 'el marron no cambia');
  assert.equal(PAL.oscuro.series[4], '#D9B27A');
  const c = PAL.claro.tokens, o = PAL.oscuro.tokens;
  assert.deepEqual([c['btn-primario-bg'], c['btn-secundario-bg'], c['btn-secundario-fg'], c['btn-suave-bg'], c['btn-suave-fg'], c['btn-suave-borde']], ['#004150', '#ffffff', '#0072B2', '#eaf4fb', '#00507d', '#bcdcf0']);
  assert.deepEqual([o['btn-primario-bg'], o['btn-secundario-bg'], o['btn-secundario-fg'], o['btn-suave-bg'], o['btn-suave-fg'], o['btn-suave-borde']], ['#004150', '#132c35', '#56B4E9', '#122f42', '#cfe9f8', '#2c5a78']);
});

test('20 series y 6 tonos de texto por tema, hex validos y sin repetir', () => {
  for (const [, t] of TEMAS) {
    assert.equal(t.series.length, 20);
    assert.equal(t.texto.length, 6);
    assert.equal(new Set(t.series.map((x) => x.toLowerCase())).size, 20);
  }
});

test('cada serie >= 3:1 contra la tarjeta, la superficie sutil y el fondo de su tema (WCAG 1.4.11)', () => {
  for (const [nombre, t] of TEMAS) {
    for (const s of t.series) for (const f of PAL.FONDOS[nombre]) assert.ok(C.contrasteRazon(s, f) >= 3, `${nombre} ${s} vs ${f}: ${C.contrasteRazon(s, f).toFixed(2)}`);
  }
});

test('las 8 primeras se distinguen (deltaE >= 12) con vision normal y con los 3 daltonismos; las 20, >= 12 con vision normal', () => {
  for (const [nombre, t] of TEMAS) {
    for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) {
      assert.ok(Math.min(dN(t.series[i], t.series[j]), dC(t.series[i], t.series[j])) >= 12, `${nombre} ${t.series[i]}/${t.series[j]}`);
    }
    for (let i = 0; i < 20; i++) for (let j = i + 1; j < 20; j++) assert.ok(dN(t.series[i], t.series[j]) >= 12, `${nombre} ${t.series[i]}/${t.series[j]}`);
  }
});

test('roles: principal (1), secundaria (2) y linea (3) a deltaE >= 40; principal/secundaria >= 30 con daltonismo', () => {
  for (const [nombre, t] of TEMAS) {
    const [p, s, l] = t.series;
    for (const [a, b] of [[p, s], [p, l], [s, l]]) assert.ok(dN(a, b) >= 40, `${nombre} ${a}/${b}: ${dN(a, b).toFixed(1)}`);
    assert.ok(dC(p, s) >= 30, `${nombre} principal/secundaria con daltonismo: ${dC(p, s).toFixed(1)}`);
  }
});

// Con daltonismo rojo-verde, el marron de Okabe-Ito se acerca al rojo y al verde del semaforo
// (deltaE ~4-7): por eso el semaforo NUNCA depende solo del color (Fase 133: simbolo ●/◆/■ y texto,
// semaforoBadgeHtml). Con vision normal, toda serie queda lejos del semaforo.
test('ninguna serie se parece al semaforo con vision normal (deltaE >= 30); el semaforo lleva simbolo y texto', () => {
  for (const [nombre, t] of TEMAS) {
    for (const s of t.series) for (const sem of PAL.SEMAFORO[nombre]) assert.ok(dN(s, sem) >= 30, `${nombre} ${s} se parece a ${sem}: ${dN(s, sem).toFixed(1)}`);
  }
  const sem = PUB('js/semaforo-logic.js');
  assert.match(sem, /function semaforoBadgeHtml\(/);
  assert.match(sem, /sr-only/);
});

test('texto: los tonos de texto de cada serie y los botones llegan a 4,5:1; el rosa claro de grafica NO', () => {
  for (const [nombre, t] of TEMAS) {
    for (const x of t.texto) for (const f of PAL.FONDOS[nombre]) assert.ok(C.contrasteRazon(x, f) >= 4.5, `${nombre} texto ${x} vs ${f}`);
    const k = t.tokens;
    for (const [bg, fg] of [[k['btn-primario-bg'], k['btn-primario-fg']], [k['btn-secundario-bg'], k['btn-secundario-fg']], [k['btn-suave-bg'], k['btn-suave-fg']]]) {
      assert.ok(C.contrasteRazon(bg, fg) >= 4.5, `${nombre} boton ${fg} sobre ${bg}`);
    }
    for (const f of PAL.FONDOS[nombre]) assert.ok(C.contrasteRazon(k.acento, f) >= 3, `${nombre} foco/acento vs ${f}`);
  }
  assert.ok(C.contrasteRazon(PAL.claro.series[2], '#ffffff') < 4.5, 'el rosa de grafica no sirve como texto');
  assert.equal(PAL.claro.texto[2], '#A8377F', 'en texto se usa el rosa oscuro');
  assert.ok(C.contrasteRazon('#ffffff', PAL.claro.series[2]) < 4.5, 'tampoco como fondo de boton con letra blanca');
});

test('un solo lugar: charts.js sin colores de serie; styles.css e index.html usan paleta.css', () => {
  const ch = PUB('js/charts.js');
  assert.ok(ch.includes("getPropertyValue('--serie-'+i)"));
  assert.doesNotMatch(ch, /var PC=\['#|var PC_DARK=|PC_EXTRA_CLARO=|SERIE_PRINCIPAL='#/);
  assert.match(ch, /function colorTextoSerie\(hex\)/);
  const html = PUB('index.html');
  const iP = html.indexOf('<link rel="stylesheet" href="css/paleta.css">'), iS = html.indexOf('<link rel="stylesheet" href="css/styles.css">');
  assert.ok(iP !== -1 && iP < iS, 'paleta.css antes de styles.css');
  const css = PUB('css/styles.css');
  assert.match(css, /--c-primary-mid:var\(--acento\)/);
  assert.match(css, /\.btn-sm\.btn-ver-datos\{background:var\(--btn-suave-bg\)/);
  // Ningun color de serie de la paleta escrito a mano en styles.css (solo en paleta.css).
  for (const s of PAL.claro.series.concat(PAL.oscuro.series)) assert.ok(!css.toLowerCase().includes(s.toLowerCase()), 'styles.css repite ' + s);
});

test('etiquetas de datos con el color de la serie pasan por colorTextoSerie (texto >= 4,5:1)', () => {
  assert.match(PUB('js/total-trafico.js'), /colorTextoSerie\(color\)/);
  assert.match(PUB('js/salida.js'), /colorTextoSerie\(color\)/);
  assert.match(PUB('js/lineas-internas.js'), /colorTextoSerie\(ctx\.dataset\.borderColor\)/);
  assert.match(PUB('js/aurora-bases.js'), /colorTextoSerie\(color\)/);
});

test('excepciones: Aurora/HLM y Lineas internas a la paleta; Agendas de Aurora conserva su azul de marca; Ultima actualizacion sin cambio', () => {
  const G = require('../../public/js/graficas-lineas-logic.js');
  const c = G.graficasLineasColores(false, PAL.claro.PC);
  assert.deepEqual([c.total, c.llamadas, c.whatsapp], PAL.claro.PC.slice(0, 3));
  assert.equal(c.sube, '#15803d', 'la variacion (mejora/empeora) es estado: sigue en el semaforo con ▲/▼');
  assert.match(PUB('js/lineas-internas.js'), /_liVar\('--serie-3'/);
  assert.doesNotMatch(PUB('js/lineas-internas.js'), /_liVar\('--c-danger'/);
  assert.match(PUB('js/agendas-usuaria-logic.js'), /claro: \{ total: '#0a2540', citas: '#1565c0'/, 'AU_PALETA (azul de Aurora) se respeta');
  assert.match(PUB('css/styles.css'), /--c-actualizacion:#FF8C1A/);
});

test('ningun color de la paleta escrito fuera de paleta.css (ni como respaldo)', () => {
  const hex = [...new Set(PAL.claro.series.concat(PAL.oscuro.series, PAL.claro.texto, PAL.oscuro.texto).map((h) => h.toLowerCase()))];
  const raiz = path.join(__dirname, '..', '..', 'public');
  const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? (e.name === 'vendor' ? [] : walk(path.join(d, e.name))) : [path.join(d, e.name)]));
  const fuera = [];
  for (const f of walk(raiz).filter((x) => /.(js|css|html)$/.test(x) && !x.endsWith('paleta.css'))) {
    const src = fs.readFileSync(f, 'utf8').toLowerCase();
    hex.filter((h) => src.includes(h)).forEach((h) => fuera.push(path.relative(raiz, f) + ' ' + h));
  }
  assert.deepEqual(fuera, []);
});
