// fase152-b8-kpi-tarjeta.test.js — Fase 152 (B8 + B3): tarjeta KPI
// ejecutiva (variacion solo con mes anterior real, meta solo con umbral,
// mes en curso parcial y sin comparacion, sparkline preparada y apagada).
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const k = require('../../public/js/kpi-tarjeta-logic.js');
const m = require('../../public/js/mes-global-logic.js');
const { mesNombreLargo } = require('../../public/js/mes-nombre-logic.js');
const PUB = path.join(__dirname, '..', '..', 'public');
const leer = (r) => fs.readFileSync(path.join(PUB, r), 'utf8');

test('kpiVariacion: sin mes anterior con datos no hay variacion (nunca un "0 %" inventado)', () => {
  assert.equal(k.kpiVariacion(120, null), null);
  assert.equal(k.kpiVariacion(120, undefined), null);
  assert.equal(k.kpiVariacion(null, 100), null);
  assert.equal(k.kpiTarjetaHtml({ valor: '120', etiqueta: 'Total de llamadas', variacion: k.kpiVariacion(120, null) }).includes('kpi-var'), false);
});

test('kpiVariacion: conteos en %, porcentajes en puntos, y "mejor si baja"', () => {
  const c = k.kpiVariacion(110, 100, { unidad: 'num', mesAnteriorLbl: 'agosto' });
  assert.equal(c.dir, 'sube'); assert.equal(c.bueno, true); assert.equal(c.valor, '+10 %'); assert.equal(c.contra, 'vs. agosto');
  const p = k.kpiVariacion(85.5, 88, { unidad: 'pct' });
  assert.equal(p.dir, 'baja'); assert.equal(p.valor, '−2,5 pts'); assert.equal(p.bueno, false);
  const a = k.kpiVariacion(4, 6, { unidad: 'pct', mejorBaja: true });
  assert.equal(a.bueno, true, 'el abandono que baja es bueno');
  const cero = k.kpiVariacion(5, 0, { unidad: 'num' });
  assert.equal(cero.valor, '+5', 'contra 0 se muestra la diferencia, no un % infinito');
  assert.equal(k.kpiVariacion(7, 7).dir, 'igual');
  assert.equal(k.kpiVariacion(7, 7).bueno, null);
});

test('kpiVariacion: el mes en curso nunca se compara', () => {
  const v = k.kpiVariacion(50, 100, { mesEnCurso: true });
  assert.deepEqual(v, { enCurso: true, texto: 'Mes en curso: sin comparación' });
  const html = k.kpiTarjetaHtml({ valor: '50', etiqueta: 'Total', variacion: v });
  assert.match(html, /Mes en curso: sin comparación/);
  assert.doesNotMatch(html, /▲|▼/);
});

test('kpiMeta: sin umbral no hay meta ni semaforo; con umbral, texto + color + estado', () => {
  assert.equal(k.kpiMeta(90, null), null);
  const mayor = k.kpiMeta(92.4, { verde: 90, amarillo: 70, direccion: 'mayor_es_mejor' }, { unidad: 'pct' });
  assert.deepEqual(mayor, { texto: 'Meta 90 %', color: 'verde', estado: 'Cumple la meta' });
  assert.equal(k.kpiMeta(75, { verde: 90, amarillo: 70 }, { unidad: 'pct' }).estado, 'Cerca de la meta');
  const menor = k.kpiMeta(12, { verde: 5, amarillo: 10, direccion: 'menor_es_mejor' }, { unidad: 'pct' });
  assert.deepEqual(menor, { texto: 'Meta máx. 5 %', color: 'rojo', estado: 'No cumple la meta' });
  assert.equal(k.kpiMeta(null, { verde: 80, amarillo: 65 }, { unidad: 'pct' }).color, null, 'sin dato: meta visible, sin color');
});

test('kpiTarjetaHtml: meta con punto + texto (no solo color) y valores escapados', () => {
  const html = k.kpiTarjetaHtml({ valor: '<b>1</b>', etiqueta: 'Nivel de atención', meta: k.kpiMeta(95, { verde: 90, amarillo: 70 }, { unidad: 'pct' }) });
  assert.match(html, /class="aurora-kpi kpi-ejecutiva kpi-green"/);
  assert.match(html, /kpi-meta-punto kpi-meta-verde" aria-hidden="true"/);
  assert.match(html, /Meta 90 % · Cumple la meta/);
  assert.match(html, /&lt;b&gt;1&lt;\/b&gt;/);
  assert.doesNotMatch(html, /<b>1<\/b>/);
});

test('sparkline: preparada pero apagada; necesita 3 o mas meses', () => {
  assert.equal(k.KPI_SPARKLINE_ACTIVO, false);
  assert.equal(k.KPI_SPARKLINE_MIN_MESES, 3);
  assert.equal(k.kpiSparklinePuntos([1, 2]), null);
  assert.equal(k.kpiSparklinePuntos([1, null, 2]), null);
  assert.equal(k.kpiSparklinePuntos([1, 2, 3], 80, 20), '0,20 40,10 80,0');
});

test('B3: mes en curso, mes anterior y rango de un mes calendario', () => {
  assert.equal(m.gdEsMesEnCurso('2026-10', '2026-10-16'), true);
  assert.equal(m.gdEsMesEnCurso('2026-09', '2026-10-16'), false);
  assert.equal(m.gdEsMesEnCurso('2026-11', '2026-10-16'), false, 'un mes futuro no es "en curso"');
  assert.equal(m.gdMesAnterior('2026-10'), '2026-09');
  assert.equal(m.gdMesAnterior('2026-01'), '2025-12');
  assert.equal(m.gdMesDelRango('2026-09-01', '2026-09-30', '2026-10-16'), '2026-09');
  assert.equal(m.gdMesDelRango('2026-10-01', '2026-10-15', '2026-10-16'), '2026-10', 'mes en curso hasta hoy');
  assert.equal(m.gdMesDelRango('2026-09-01', '2026-09-15', '2026-10-16'), '', 'medio mes cerrado no es un mes');
  assert.equal(m.gdMesDelRango('2026-08-01', '2026-09-30', '2026-10-16'), '', 'dos meses no se comparan');
  assert.equal(m.gdMesDelRango('2026-09-02', '2026-09-30', '2026-10-16'), '');
});

test('B3: rotulo "parcial, hasta el día N" (fuente diaria) o "mes en curso" (mensual); vacio si el mes cerro', () => {
  assert.equal(m.gdRotuloMesParcial('2026-10', '2026-10-16', '2026-10-15', mesNombreLargo), 'Octubre 2026 — parcial, hasta el día 15');
  assert.equal(m.gdRotuloMesParcial('2026-10', '2026-10-16', null, mesNombreLargo), 'Octubre 2026 — mes en curso, parcial');
  assert.equal(m.gdRotuloMesParcial('2026-10', '2026-10-16', '2026-09-30', mesNombreLargo), 'Octubre 2026 — mes en curso, parcial', 'un dia de otro mes no cuenta');
  assert.equal(m.gdRotuloMesParcial('2026-09', '2026-10-16', '2026-09-30', mesNombreLargo), '');
  assert.equal(m.gdHoyLocal(new Date(2026, 9, 6)), '2026-10-06');
});

test('estilos: cifra a --fs-kpi y etiqueta sin MAYUSCULAS', () => {
  const css = leer('css/styles.css');
  assert.match(css, /\.aurora-kpi \.kv\{font-size:var\(--fs-kpi\)/);
  const kl = css.match(/\.aurora-kpi \.kl\{[^}]*\}/)[0];
  assert.doesNotMatch(kl, /uppercase/);
  const lbl = css.match(/\.aurora-kpi \.kpi-lbl\{[^}]*\}/)[0];
  assert.doesNotMatch(lbl, /uppercase/);
});

test('Trafico: sin umbral no hay semaforo de respaldo quemado (90/70) y la meta sale de Umbrales', () => {
  const src = leer('js/trafico.js');
  assert.doesNotMatch(src, /colorNivelFallback/);
  assert.match(src, /kpiMeta\(totales\.nivelAtencion, umbralDe\('nivel_atencion'\)/);
  assert.match(src, /nivelServicioMetrica: 'service_level'/, 'nivel de servicio de llamadas: umbral service_level');
  assert.doesNotMatch(leer('js/trafico-whatsapp.js'), /nivelServicioMetrica/, 'WhatsApp: sin meta acordada');
});

test('Salida: compara solo contra el mes inmediatamente anterior y nunca en el mes en curso', () => {
  const src = leer('js/salida.js');
  // Fase 207: con UN mes marcado en MESES (con varios no hay comparacion).
  assert.match(src, /anterior\.mes !== gdMesAnterior\(unico\.mes\)/);
  assert.match(src, /mesEnCurso: enCursoSal/);
  assert.match(src, /variacion: unico \? kpiVariacion\(totalLlam, totalLlamAnt, optsSal\) : null/);
});

test('el script nuevo se carga despues de esc.js y semaforo-logic.js', () => {
  const html = leer('index.html');
  const i = (s) => html.indexOf('<script src="js/' + s + '"></script>');
  assert.ok(i('kpi-tarjeta-logic.js') > i('semaforo-logic.js'));
  assert.ok(i('kpi-tarjeta-logic.js') > i('esc.js'));
  assert.ok(i('kpi-tarjeta-logic.js') < i('trafico.js'));
});
