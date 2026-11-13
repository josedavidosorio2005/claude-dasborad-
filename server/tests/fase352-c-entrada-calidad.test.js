// fase352-c-entrada-calidad.test.js — Fase 352 (C, reunion con Edwin del 13/11): en el portal del
// supervisor › Calidad, cada campaña es un recuadro con la meta y el avance del mes; al tocarlo (o con
// Enter / Espacio) se abre directo la Calidad de esa campaña. Sin el paso «Abrir Módulo de Calidad».
// Mismos permisos: las mismas campañas de antes (campana_<X>) y el modulo vuelve a revisar el acceso.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const PUB = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'public', f), 'utf8');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const tarjeta = () => {
  const ctx = {};
  const src = PUB('js/session.js');
  const ini = src.indexOf('function supervisorCampanaCardHtml');
  const fin = src.indexOf('function supervisorAbrirCalidad');
  new Function('esc', 'ctx', src.slice(ini, fin) + '; ctx.f = supervisorCampanaCardHtml;')(esc, ctx);
  return ctx.f;
};

test('C: el recuadro es un boton accesible con teclado y abre la Calidad de su campaña', () => {
  const f = tarjeta();
  const html = f('CAMPANA <INVENTADA>', { meta: 24, realizados: 6, pct: 25, realizadosLlamada: 6, metaLlamada: 24, pctLlamadaCompl: 25, auditaWpp: false });
  assert.match(html, /^<div class="cal-camp-card" role="button" tabindex="0" data-campana="CAMPANA &lt;INVENTADA&gt;"/);
  assert.ok(html.includes('aria-label="Abrir la Calidad de CAMPANA &lt;INVENTADA&gt;"'));
  assert.ok(html.includes('onclick="supervisorAbrirCalidad(this.dataset.campana)"'));
  assert.ok(html.includes("if(event.key==='Enter'||event.key===' '){event.preventDefault();supervisorAbrirCalidad(this.dataset.campana)}"));
  assert.ok(html.includes('<b>6 / 24</b><span class="">25%</span>'));
  assert.ok(html.includes('<span style="width:25%"></span>'));
  assert.ok(html.includes('<dt>WhatsApp</dt><dd>-</dd>'));
  assert.ok(!html.includes('<INVENTADA>'), 'el nombre va escapado');
});

test('C: sin meta individual, el recuadro igual abre la campaña; con 100 % o mas, en verde y la barra no pasa de 100', () => {
  const f = tarjeta();
  assert.ok(f('CAMPANA INVENTADA', undefined).includes('Sin meta individual asignada este mes'));
  const lleno = f('X', { meta: 10, realizados: 12, pct: 120, realizadosLlamada: 12, metaLlamada: 10, pctLlamadaCompl: 120, auditaWpp: true, realizadosWpp: 0, metaWpp: 0, pctWppCompl: null });
  assert.ok(lleno.includes('<span class="peak">120%</span>'));
  assert.ok(lleno.includes('width:100%'));
  assert.ok(lleno.includes('<dt>WhatsApp</dt><dd>0/0</dd>'));
});

test('C: sin el paso intermedio; mismas campañas de antes; openCalidad abre en la campaña elegida', () => {
  const html = PUB('index.html');
  assert.doesNotMatch(html, /<button[^>]*>Abrir Módulo de Calidad<\/button>/, 'ya no hay boton intermedio');
  assert.ok(html.includes('<div class="cal-camp-grid" id="supervisor-meta-cards"></div>'));
  const s = PUB('js/session.js');
  assert.ok(s.includes("var campanas = calidadCampanasRegistro().filter(function(c){ return currentUser.perms['campana_'+c]===true; }); // Fase 262"), 'mismo filtro de permisos');
  assert.ok(s.includes("function supervisorAbrirCalidad(camp){ if(typeof openCalidad === 'function') openCalidad(camp); }"));
  const cal = PUB('js/calidad.js');
  assert.ok(cal.includes("async function openCalidad(campana){\n  if(typeof campana === 'string' && campana) _ccampana = campana;"));
  // Sin acceso a esa campaña, el selector cae en la primera de las suyas (el permiso manda).
  assert.ok(cal.includes('if(accesibles.indexOf(_ccampana)===-1) _ccampana = accesibles[0];'));
});
