// fase314-lineas-internas-ajustes.test.js — Fase 314 (10/11/2026, Clinica Aurora ›
// Gestión líneas internas): nivel de atencion en vez de nivel de servicio, cantidades
// siempre visibles sobre las barras, tortas lado a lado y la vista como boton aparte.
// Datos SINTETICOS (cifras inventadas con la misma forma que el reporte de Wolkvox).
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const L = require('../../public/js/lineas-internas-logic.js');
const T = require('../../public/js/trafico-logic.js');
const pub = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'public', f), 'utf8');

// 5 areas con los totales de octubre (solo cifras agregadas): 230 total, 181 contestadas.
const AREAS = [['4170', 19, 2], ['4165', 35, 33], ['4169', 38, 32], ['4166', 66, 63], ['4171', 72, 51]];
const FILAS = [];
AREAS.forEach(([skill, total, cont]) => {
  // repartidas en 2 dias para que «Todas» tenga que sumar, no promediar
  FILAS.push({ mes: '2026-10', fecha: '2026-10-06', skill, total: total - 1, contestadas: cont - (cont ? 1 : 0), abandonadas: total - cont - (cont ? 0 : 1), nivelServicio: 50 });
  FILAS.push({ mes: '2026-10', fecha: '2026-10-07', skill, total: 1, contestadas: cont ? 1 : 0, abandonadas: cont ? 0 : 1, nivelServicio: 0 });
});

test('nivel de atencion: «Todas» = suma de contestadas / suma del total (181 / 230 = 78,7 %), no promedio de %', () => {
  const s = L.liFlujoSerie(FILAS, ['2026-10'], '');
  assert.equal(s.resumen.total, 230); assert.equal(s.resumen.contestadas, 181);
  assert.equal(s.resumen.nivelAtencion, T.traficoPctAtencionAbandono(230, 181, 49).nivelAtencionPct, 'la misma funcion de las otras pestañas');
  assert.equal(Math.round(s.resumen.nivelAtencion * 10) / 10, 78.7);
  const promedioDePct = s.puntos.reduce((a, p) => a + p.nivelAtencion, 0) / s.puntos.length;
  assert.notEqual(Math.round(promedioDePct * 10) / 10, 78.7, 'el promedio de % daria otra cifra');
  // Cada area y cada dia, con su propia suma.
  const pat = L.liFlujoSerie(FILAS, [], '4169');
  assert.equal(pat.resumen.nivelAtencion, T.traficoPctAtencionAbandono(38, 32, 6).nivelAtencionPct);
  assert.equal(L.liFlujoSerie(FILAS, [], '4170').resumen.nivelAtencion, Math.round(2 / 19 * 10000) / 100);
  assert.equal(L.liFlujoSerie([], [], '').resumen.nivelAtencion, null, 'sin llamadas: sin dato, nunca 0 % ni 100 %');
});

test('el flujo ya no muestra el nivel de servicio: tarjeta, linea, eje y exportar dicen «Nivel de atención»', () => {
  const src = pub('js/lineas-internas.js');
  const flujo = src.slice(src.indexOf('function _liRenderFlujo'), src.indexOf('function _liSelect'));
  assert.ok(!/Nivel de servicio|nivelServicio/.test(flujo), 'nada de nivel de servicio en la grafica');
  assert.match(flujo, /'Nivel de atención'\)/);
  assert.match(flujo, /label: 'Nivel de atención \(%\)'.*x\.nivelAtencion/);
  assert.match(src, /'Nivel de atención \(%\)': x\.nivelAtencion/);
});

test('cantidades sobre las barras: visibles SIEMPRE (las 5 areas por dia, «Todas» y el 0)', () => {
  for (const n of [1, 5, 12, 13, 17, 19, 21, 31, 60]) {
    for (const ancho of [310, 695, 1367]) {
      const e = L.liEtiquetasBarras(n, ancho);
      assert.equal(e.display, true, `n=${n} ancho=${ancho}`);
      assert.ok(e.tamano >= 9, 'letra legible');
    }
  }
  // Area Patologia: 19 dias en octubre; antes se apagaban con mas de 12 barras.
  assert.equal(L.liEtiquetasBarras(19, 1367).display, true);
  assert.equal(L.liCantidadTexto(0), '0', 'el cero tambien se escribe');
  assert.equal(L.liCantidadTexto(1234), (1234).toLocaleString('es-CO'));
  const src = pub('js/lineas-internas.js');
  assert.ok(!/length <= 12 \? 'auto' : false/.test(src), 'ya no se apagan con mas de 12 puntos');
  assert.match(src, /display: et\.display/);
  assert.match(src, /liCantidadTexto\(v\)/);
});

test('tortas lado a lado (llamadas a la izquierda) y apiladas en pantallas angostas', () => {
  const g = pub('js/dashboard-generic.js');
  assert.match(g, /class="li-tortas"/);
  const css = pub('css/styles.css');
  assert.match(css, /\.li-tortas\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /@media \(max-width:700px\)\{\.li-tortas\{grid-template-columns:1fr\}\}/);
  const { lineasInternasTab } = require('../plantillas-cliente');
  assert.deepEqual(lineasInternasTab('CLINICA AURORA').panels.map((p) => p.tipo).slice(1), ['aurora_li_cdr_panel', 'aurora_li_whatsapp_panel'], 'llamadas primero (izquierda), WhatsApp despues (derecha)');
});

test('«Gestión líneas internas» como boton aparte (no en la fila); Errores vuelve a ser la ultima de la fila', () => {
  const html = pub('index.html');
  const i = html.indexOf('id="gd-cerrar-btn"'), j = html.indexOf('id="gd-li-btn"');
  assert.ok(i !== -1 && j > i, 'debajo de los botones (despues de Cerrar)');
  assert.match(html, /<div class="gd-li-wrap hidden" id="gd-li-wrap">/);
  const g = pub('js/dashboard-generic.js');
  assert.match(g, /var GD_TABS_BOTON_APARTE = \['lineas_internas'\];/);
  assert.match(g, /_gdTabsVisibles\(\)\.filter\(function\(t\)\{ return GD_TABS_BOTON_APARTE\.indexOf\(t\.key\) === -1; \}\)/);
  assert.match(g, /var hay = _gdTabsVisibles\(\)\.some/, 'mismo acceso: solo si la vista existe y no esta oculta para quien mira');
  // La fila de Aurora, sin la vista aparte, termina en Errores.
  const G = require('../../public/js/graficas-lineas-logic.js');
  const tabs = ['trafico', 'trafico_whatsapp', 'total_trafico', 'salida', 'agendas_usuaria', 'tipificacion', 'inasistencia_au', 'encuestas_au', 'errores', 'calidad', 'lineas_internas'].map((key) => ({ key }));
  const fila = G.pestanasOrdenCliente(tabs, 'CLINICA AURORA').map((t) => t.key).filter((k) => k !== 'lineas_internas');
  assert.equal(fila[fila.length - 1], 'errores');
});
