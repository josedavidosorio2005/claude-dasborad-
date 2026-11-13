// fase352-b-ver-observacion.test.js — Fase 352 (B, reunion con Edwin del 13/11): en las listas de
// Calidad la observacion ya no va completa en la fila; un boton «Ver observación» la abre en una
// ventana con X, clic afuera y Escape. Y la X arriba en las ventanas de Calidad que no la tenian.
// Datos INVENTADOS.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const PUB = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'public', f), 'utf8');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const cargar = () => {
  const ctx = {};
  new Function('esc', 'document', 'ctx', PUB('js/ver-observacion.js') + '; ctx.boton = verObsBotonHtml; ctx.hay = verObsHay;')(esc, {}, ctx);
  return ctx;
};

test('B: el boton guarda la observacion escapada (sin HTML) y sin observacion muestra «—»', () => {
  const V = cargar();
  const html = V.boton('Retro inventada <b>con</b> "comillas"\ny salto', 'Monitoreo del 2026-11-10');
  assert.match(html, /^<button type="button" class="btn-sm vobs-btn"/);
  assert.ok(html.includes('&lt;b&gt;con&lt;/b&gt; &quot;comillas&quot;'), 'el texto va escapado');
  assert.ok(!html.includes('<b>'));
  assert.ok(html.includes('>Ver observación</button>'));
  assert.ok(html.includes('event.stopPropagation();verObsAbrir(this)'), 'no abre el detalle de la fila');
  assert.equal(V.boton(''), '—');
  assert.equal(V.boton('   '), '—');
  assert.equal(V.boton(null), '—');
  assert.equal(V.hay([{ observaciones: '' }, { observaciones: 'algo' }]), true);
  assert.equal(V.hay([{ observaciones: '' }, {}]), false, 'cuenta de cliente: el servidor no manda observaciones, no hay columna');
});

test('B: la ventana tiene X, cierra con clic afuera y con Escape solo ella, y pinta con textContent', () => {
  const js = PUB('js/ver-observacion.js');
  assert.ok(js.includes('class="cmp-x" id="vobs-x" aria-label="Cerrar"'));
  assert.ok(js.includes("ov.addEventListener('click', function (e) { if (e.target === ov) verObsCerrar(); });"));
  assert.ok(js.includes("if (e.key === 'Escape' && ov && !ov.hidden) { e.preventDefault(); e.stopImmediatePropagation(); verObsCerrar(); }"));
  assert.ok(js.includes('}, true);'), 'en captura: corre antes que la ventana del panel');
  assert.ok(js.includes("document.getElementById('vobs-texto').textContent ="));
  assert.doesNotMatch(js.replace(/ov\.innerHTML = [^;]+;/, ''), /innerHTML/, 'el texto nunca va por innerHTML');
  assert.ok(js.includes('_vobsDisparador.focus()'), 'el foco vuelve al boton');
});

test('B: las listas usan el boton en vez del texto completo', () => {
  const em = PUB('js/encuesta-monitoreo.js');
  assert.ok(em.includes("verObsBotonHtml(m.observaciones, 'Llamada del ' + cenFecha(f.fecha))"));
  assert.doesNotMatch(em, /esc\(f\.monitoreo \? \(m\.observaciones/);
  const ce = PUB('js/calidad-encuestas.js');
  assert.ok(ce.includes("verObsBotonHtml(m.observaciones, 'Llamada del ' + cenFecha(f.fecha))"));
  assert.doesNotMatch(ce, /_cenEsc\(m\.observaciones/);
  const cp = PUB('js/calidad-panel.js');
  assert.equal((cp.match(/verObsBotonHtml\(m\.observaciones, 'Monitoreo del '/g) || []).length, 2, 'Llamadas con fallas y Detalle del mes');
  assert.equal((cp.match(/\(conObs \? '<th>Observación<\/th>' : ''\)/g) || []).length, 2, 'la columna solo si alguna fila trae observacion');
  const html = PUB('index.html');
  assert.ok(html.indexOf('js/ver-observacion.js') < html.indexOf('js/calidad-panel.js"'));
});

test('B: X arriba en las 4 ventanas de Calidad que no la tenian', () => {
  const html = PUB('index.html');
  assert.ok(html.includes(`onclick="cc2CerrarDialogo('cc2-ov-criterio')"><span aria-hidden="true">×</span>`), 'criterio de un item');
  assert.ok(html.includes(`onclick="cc2CerrarDialogo('ca-ov-detalle')"><span aria-hidden="true">×</span>`), 'detalle de un monitoreo (modulo)');
  assert.ok(html.includes('onclick="encMonCerrar()"><span aria-hidden="true">×</span>'), 'Encuesta › Monitoreo');
  assert.ok(PUB('js/calidad.js').includes('onclick="calCerrarFecha()"><span aria-hidden="true">×</span>'), 'Cambiar fecha del monitoreo');
});
