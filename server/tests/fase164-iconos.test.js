// fase164-iconos.test.js — Fase 164 (lote 2): emojis de pantalla por iconos
// Lucide del sprite del repo. Los textos de estado de Calidad los calcula el
// servidor y se guardan asi (con emoji) en la base y en las exportaciones:
// eso NO cambia. Solo cambia como se pintan en pantalla (calEstadoHtml).
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const L = require('../../public/js/calidad-dashboard-logic.js');
const calidadLogic = require('../calidad-logic.js');

const PUB = path.join(__dirname, '..', '..', 'public');
const leer = (r) => fs.readFileSync(path.join(PUB, r), 'utf8');
const sprite = leer('img/iconos/lucide.svg');

test('calEstadoHtml: el emoji pasa a icono Lucide decorativo y la palabra queda como texto', () => {
  assert.equal(typeof L.calEstadoHtml, 'function');
  const h = L.calEstadoHtml('🔴 CRITICO');
  assert.match(h, /^<span class="estado-con-icono estado-critico"><svg class="icono" aria-hidden="true" focusable="false"><use href="img\/iconos\/lucide\.svg#i-punto"><\/use><\/svg>CRITICO<\/span>$/);
  assert.doesNotMatch(h, /🔴/);
  const casos = { '🟡 NO CRITICO': ['punto', 'medio'], '🟢 SOBRESALIENTE': ['punto', 'ok'], '✅ SIN FALLOS CRITICOS': ['circle-check', 'ok'],
    '⚠️ ALERTA': ['triangle-alert', 'medio'], '🚨 CRITICO FRECUENTE': ['octagon-alert', 'critico'], '❌ No': ['circle-x', 'critico'] };
  for (const [t, [icono, tono]] of Object.entries(casos)) {
    const x = L.calEstadoHtml(t);
    assert.ok(x.includes('#i-' + icono + '"'), t);
    assert.ok(x.includes('estado-' + tono), t);
    assert.ok(x.includes('aria-hidden="true"'), t + ': icono decorativo');
    assert.ok(x.includes(t.replace(/^\S+\s/, '')), t + ': la palabra sigue');
  }
  assert.match(L.calEstadoHtml('📞 Llamada'), /#i-phone".*Llamada/);
  assert.match(L.calEstadoHtml('💬 WPP'), /#i-message-circle".*WPP/);
  assert.match(L.calEstadoHtml('⛔ Desactivada'), /#i-ban".*Desactivada/);
});

test('calEstadoHtml: en la tarjeta del tablero el icono no trae color propio (lo da la meta)', () => {
  assert.doesNotMatch(L.calEstadoHtml('🔴 CRITICO', { sinColor: true }), /estado-critico/);
  assert.match(leer('js/dashboard-generic.js'), /qaBadge\+calEstadoHtml\(r\.clasificacion, \{ sinColor:true \}\)/);
});

test('calEstadoHtml: texto sin emoji queda igual y escapado', () => {
  assert.equal(L.calEstadoHtml('—'), '—');
  assert.equal(L.calEstadoHtml('<b>x</b>'), '&lt;b&gt;x&lt;/b&gt;');
  assert.equal(L.calEstadoHtml(null), '');
});

test('todos los iconos que se usan existen en el sprite del repo', () => {
  for (const id of ['circle', 'punto', 'circle-check', 'triangle-alert', 'octagon-alert', 'circle-x', 'ban', 'phone', 'message-circle',
    'package', 'chart-column', 'contact', 'layout-dashboard', 'upload']) {
    assert.ok(sprite.includes('<symbol id="i-' + id + '"'), id);
  }
  assert.doesNotMatch(leer('index.html'), /unpkg|jsdelivr|lucide@/, 'nada de CDN');
});

test('los datos y las exportaciones NO cambian: el servidor y el resumen siguen con el mismo texto', () => {
  const r = L.calDashResumen([{ puntaje: 50 }]);
  assert.equal(r.clasificacion, '🔴 CRITICO', 'la exportacion del tablero (_gdExportarCalidad) usa este texto');
  assert.match(leer('js/dashboard-generic.js'), /Clasificacion: r\.clasificacion,/);
  const src = fs.readFileSync(path.join(__dirname, '..', 'calidad-logic.js'), 'utf8');
  assert.match(src, /'🔴 CRITICO' : puntaje < 90 \? '🟡 NO CRITICO' : '🟢 SOBRESALIENTE'/);
  assert.ok(calidadLogic);
});

test('pantallas sin emoji: Calidad, Metas, Mis resultados e inicio de modulos', () => {
  const emoji = /'[^']*(?:🔴|🟡|🟢|✅|❌|⛔|⚠️|🚨|💬|📞)[^']*'/;
  for (const f of ['js/calidad.js', 'js/metas.js', 'js/mis-resultados.js']) {
    const lineas = leer(f).split('\n').filter((l) => emoji.test(l) && !/^\s*\/\//.test(l));
    for (const l of lineas) {
      // Solo quedan los textos que son DATOS (calculo del estado), nunca pintados directo.
      assert.ok(/calEstadoHtml\(|var (clasificacion|clasif|alerta|cumpleTxt|clasifGeneral)\s*=|nivelCritico\s*=/.test(l), f + ': ' + l.trim().slice(0, 90));
    }
  }
  const mods = leer('js/constants.js').match(/var DASH_MODULES = \[[\s\S]*?\];/)[0];
  assert.doesNotMatch(mods, /&#1\d{4,5};|&#10003;/, 'los modulos del inicio ya no usan emoji');
  assert.match(mods, /lucide\.svg#i-circle-check/);
  assert.match(leer('js/dashboards-core.js'), /dash-icon"><svg class="icono" aria-hidden="true" focusable="false"><use href="img\/iconos\/lucide\.svg#i-upload">/);
});
