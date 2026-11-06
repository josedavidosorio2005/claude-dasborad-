// fase279-diccionario-como-html.test.js — Fase 279 (pedido de Edwin, 06/11):
// Mobilize › Calidad › Diccionario igual al del HTML de Edwin (buildDict,
// modelo "weighted") y con la plantilla con la que se califica hoy (principal y
// activa), no la de los monitoreos del periodo. En produccion abria la plantilla
// vieja (10 items, agrupada por categoria, "Sin descripción") en vez de la de 14.
// La REFERENCIA es buildDict del HTML, transcrita (no se copia el HTML al repo).
// Plantillas SINTETICAS.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'calidad-panel.js'), 'utf8');
function cargar() {
  const ctx = { esc: (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;'), caDiccionarioHtml: () => 'VIEJO' };
  vm.createContext(ctx);
  const fn = (nombre) => { const i = SRC.indexOf('function ' + nombre + '('); return i === -1 ? '' : SRC.slice(i, SRC.indexOf('\n}\n', i) + 2); };
  vm.runInContext(fn('cmpPlantillaDiccionario') + fn('cmpDiccionarioHtml'), ctx);
  return ctx;
}

const PESOS = [4, 10, 5, 4, 10, 8, 12, 12, 12, 5, 6, 6, 3, 3];
const CRIT = [2, 5, 6, 7, 8];
const CATS = ['Apertura', 'Cumplimiento normativo', 'Validación de datos', 'Validación de datos', 'Validación de datos', 'Validación de datos', 'Gestión operativa', 'Gestión operativa', 'Gestión operativa', 'Comunicación', 'Comunicación', 'Comunicación', 'Cierre', 'Gestión del tiempo'];
const NUEVA = { id: 9, campana: 'MOBILIZE', nombre: 'Mobilize 2026 ajustada', motor: 'standard', principal: true, activo: true,
  items: PESOS.map((w, k) => ({ n: k + 1, cat: CATS[k], label: 'Ítem inventado ' + (k + 1), weight: w, critico: CRIT.includes(k + 1), admiteNA: true, descripcion: 'Descripción inventada ' + (k + 1), vinetas: [] })) };
const VIEJA = { id: 8, campana: 'MOBILIZE', nombre: 'MOBILIZE', motor: 'standard', principal: false, activo: false,
  items: Array.from({ length: 10 }, (_, k) => ({ n: k + 1, cat: 'GRUPO', label: 'Viejo ' + (k + 1), weight: 10, critico: k < 5, admiteNA: true, descripcion: '', vinetas: [] })) };
const OTRA = { id: 12, campana: 'CLINICA AURORA', nombre: 'Aurora', motor: 'standard', principal: true, activo: true, items: [] };

// buildDict del HTML (modelo weighted), reducido a su contenido.
function referencia(pl) {
  const ITEMS = pl.items.map((it) => ({ n: it.n, name: it.label, cat: it.cat, w: it.weight, tipo: it.critico ? 'C' : 'NC', desc: it.descripcion }));
  const nc = ITEMS.filter((i) => i.tipo === 'C').length;
  const critTag = (it) => (it.tipo === 'C' ? `⚠ Crítico · peso ${it.w}% · NO = −20 pts` : `Peso ${it.w}% · NO = −${it.w} pts`);
  return {
    titulo: 'Diccionario de criterios · ' + pl.nombre,
    reglas: [`${ITEMS.length} ítems · ${nc} críticos · los pesos suman 100%`, '⚠ Crítico NO resta 20 pts', 'SI o N/A suman el peso del ítem · NO en no crítico pierde su peso', '1 crítico fallado = Alerta · 2 o más = Crítico absoluto'],
    tarjetas: ITEMS.map((it) => [it.n, it.name, critTag(it), it.cat, it.desc, '+' + it.w, '+' + it.w, it.tipo === 'C' ? String(it.w - 20) : '0']),
  };
}
// Lo mismo, leido del HTML que arma SINCO.
const sinTags = (s) => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
function leer(html) {
  const reglas = [...html.match(/<div class="ca-reglas cmp-reglas">([\s\S]*?)<\/div>/)[1].matchAll(/<span>((?:(?!<\/span>$)[\s\S])*?(?:<\/span>[^<]*)?)<\/span>(?=<span>|$)/g)].map((m) => sinTags(m[1]));
  const tarjetas = [...html.matchAll(/<article class="ca-dcard cmp-dcard">([\s\S]*?)<\/article>/g)].map((m) => {
    const a = m[1];
    const h5 = a.match(/<h5><span class="cc2-num">(\d+)<\/span> ([\s\S]*?) <span class="cc2-pill[^"]*">([^<]+)<\/span><\/h5>/);
    const imp = [...a.matchAll(/<div><span>(SI|N\/A|NO)<\/span><span>([^<]+)<\/span><\/div>/g)].map((x) => x[2]);
    return [Number(h5[1]), h5[2], h5[3], (a.match(/<p class="cmp-dcat">([^<]*)<\/p>/) || [])[1], (a.match(/<\/p><p>([^<]*)<\/p>/) || [])[1], ...imp];
  });
  return { reglas, tarjetas };
}

test('abre la plantilla principal y activa (14 items), no la de los monitoreos (vieja, 10)', () => {
  const c = cargar();
  assert.equal(c.cmpPlantillaDiccionario('MOBILIZE', 8, [VIEJA, NUEVA, OTRA]).id, 9);
  assert.equal(c.cmpPlantillaDiccionario('MOBILIZE', 8, [VIEJA]).id, 8, 'sin principal, la de los monitoreos');
  assert.equal(c.cmpPlantillaDiccionario('CLINICA AURORA', 8, [VIEJA, NUEVA, OTRA]).id, 12, 'cada campaña la suya');
});

test('el contenido es el de buildDict del HTML: reglas, 14 tarjetas en orden, peso, categoria e impacto', () => {
  const c = cargar();
  const html = c.cmpDiccionarioHtml(NUEVA);
  const ref = referencia(NUEVA);
  const sc = leer(html);
  assert.deepEqual(sc.reglas, ref.reglas);
  assert.equal(sc.tarjetas.length, 14);
  assert.deepEqual(sc.tarjetas, ref.tarjetas);
  assert.doesNotMatch(html, /<h4/, 'sin agrupar por categoria (antes salian encabezados por categoria)');
  assert.ok(SRC.includes("_cmpAbrir('Diccionario de criterios · ' + pl.nombre, cmpDiccionarioHtml(pl))"), 'mismo titulo que el HTML');
});

test('una plantilla de descuento (motor sura) sigue con el diccionario de siempre', () => {
  assert.equal(cargar().cmpDiccionarioHtml({ motor: 'sura', items: [] }), 'VIEJO');
});
