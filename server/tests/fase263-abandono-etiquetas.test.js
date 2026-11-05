// fase263-abandono-etiquetas.test.js — Fase 263 (pedido del 05/11): en la
// grafica de Abandono (Trafico de Llamadas y de WhatsApp, todos los clientes)
// la linea del % ya no se monta sobre las etiquetas de cantidad y % de las
// barras: barras abajo, linea (y meta) en la franja de arriba. Sin quitar
// etiquetas. Datos SINTETICOS.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const T = require('../../public/js/trafico-logic.js');

// posicion relativa (0 abajo, 1 arriba) de un valor en una escala [min, max]
const pos = (v, min, max) => (v - min) / (max - min);
const agregado = (filas) => filas.map(([ab, pct]) => ({ llamadasAbandonadas: ab, tasaAbandonoPct: pct }));

test('barras hasta el 55 % de la altura; la linea entre el 74 % y el 96 %, en 3, 6 y 30 barras', () => {
  const casos = {
    3: agregado([[40, 5], [15, 1.6], [90, 8.4]]),
    6: agregado([[40, 5], [15, 1.6], [90, 8.4], [25, 2.1], [60, 4.5], [120, 8.1]]),
    30: agregado(Array.from({ length: 30 }, (_, i) => [5 + ((i * 7) % 40), Math.round(((5 + ((i * 7) % 40)) / 900) * 1000) / 10])),
  };
  for (const [n, a] of Object.entries(casos)) {
    const e = T.traficoAbandonoEscalas(a, null);
    const maxB = Math.max(...a.map((x) => x.llamadasAbandonadas));
    assert.ok(Math.abs(pos(maxB, 0, e.yMax) - T.TRAFICO_ABANDONO_BARRAS_ALTO) < 1e-9, n + ': la barra mas alta llega al 55 %');
    a.forEach((x) => {
      const p = pos(x.tasaAbandonoPct, e.y2Min, e.y2Max);
      assert.ok(p >= T.TRAFICO_ABANDONO_LINEA_DESDE - 1e-9 && p <= T.TRAFICO_ABANDONO_LINEA_HASTA + 1e-9, n + ': punto de la linea en la franja de arriba (' + p + ')');
    });
  }
});

test('la meta tambien queda en la franja; linea plana no se exagera; sin datos -> null', () => {
  const a = agregado([[10, 2], [20, 3]]);
  const e = T.traficoAbandonoEscalas(a, 5);
  assert.ok(pos(5, e.y2Min, e.y2Max) <= T.TRAFICO_ABANDONO_LINEA_HASTA + 1e-9);
  assert.ok(pos(2, e.y2Min, e.y2Max) >= T.TRAFICO_ABANDONO_LINEA_DESDE - 1e-9);
  const plana = T.traficoAbandonoEscalas(agregado([[10, 3], [12, 3]]), null);
  assert.ok(plana.y2Max - plana.y2Min > 2, 'una linea plana no se vuelve una montaña');
  assert.equal(T.traficoAbandonoEscalas([], null), null);
  assert.ok(T.traficoAbandonoEscalas(agregado([[0, 0], [0, 0]]), null).yMax > 0, 'todo en 0 no rompe la escala');
});

test('la grafica usa las escalas y sigue mostrando la etiqueta de cada barra (cantidad y %)', () => {
  const js = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'trafico.js'), 'utf8');
  const i = js.indexOf('function _traficoDibujarAbandono');
  const cuerpo = js.slice(i, js.indexOf('\nfunction ', i + 10));
  assert.match(cuerpo, /traficoAbandonoEscalas\(agregadoComb, umbralAb && umbralAb\.verde\)/);
  assert.match(cuerpo, /oAband\.scales\.y2\.min = escAb\.y2Min; oAband\.scales\.y2\.max = escAb\.y2Max;/);
  assert.match(cuerpo, /formatter: function\(v, ctx\)\{ return etiquetaBarra\(ctx\.dataIndex\); \}/, 'las etiquetas de 2 lineas siguen');
  assert.deepEqual(T.traficoAbandonoEtiquetaBarra(agregado([[1234, 5.25]]))(0), ['1.234', '5,3 %']);
});
