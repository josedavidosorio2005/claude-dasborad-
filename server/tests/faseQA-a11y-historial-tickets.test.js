// faseQA-a11y-historial-tickets.test.js — Revisión con axe-core del 25/11 (local, base de demostración):
//   (a) la tabla del Historial se desplazaba solo con el mouse a 375 y 768 px (scrollable-region-focusable);
//   (b) la tarjeta «Sugerencias / Tickets» tenía un nombre accesible sin su texto visible (label-content-name-mismatch);
//   (c) el código de la ventana del Inventario anterior (retirado en la Fase 383) seguía en la página.
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const PUB = path.join(__dirname, '../../public');
const html = fs.readFileSync(path.join(PUB, 'index.html'), 'utf8');

test('(a) el contenedor de la tabla del Historial recibe el foco y tiene nombre (se desplaza con el teclado)', () => {
  const m = html.match(/<div class="table-wrap" id="hist-table-wrap"([^>]*)>\s*<table><thead><tr>\s*<th>Fecha y Hora<\/th>/);
  assert.ok(m, 'falta el contenedor de la tabla del Historial');
  assert.match(m[1], /tabindex="0"/);
  assert.match(m[1], /role="region"/);
  assert.match(m[1], /aria-label="[^"]+"/);
  // El foco visible ya lo da la regla global [tabindex]:focus-visible.
  assert.match(fs.readFileSync(path.join(PUB, 'css/styles.css'), 'utf8'), /\[tabindex\]:focus-visible/);
});

// Ejecuta tickets.js en un sandbox con un DOM mínimo (solo lo que usa _tkPintarContador).
function pintarContador(n) {
  const vm = require('vm');
  const L = require('../../public/js/tickets-logic.js');
  const el = (clases, sr) => {
    const attrs = {};
    const set = new Set(clases);
    return { attrs, sr, classList: { contains: (c) => set.has(c), toggle() {} }, setAttribute: (k, v) => { attrs[k] = v; }, removeAttribute: (k) => { delete attrs[k]; },
      querySelector: (q) => (q === '[data-tk-sr]' ? sr : null) };
  };
  const srTarjeta = { textContent: '' };
  const tarjeta = el(['dash-btn', 'tk-menu-btn'], srTarjeta);
  tarjeta.attrs['aria-label'] = 'Sugerencias / Tickets'; // lo que quedaba de antes
  const enlace = el(['tk-menu-btn']);
  const document = { querySelectorAll: (q) => (q === '.tk-menu-btn' ? [tarjeta, enlace] : []), getElementById: () => null, querySelector: () => null, addEventListener() {} };
  const ctx = vm.createContext({ document, window: {}, ticketsBadgeTexto: L.ticketsBadgeTexto, ticketsBotonEtiqueta: L.ticketsBotonEtiqueta, setInterval() {}, clearInterval() {} });
  vm.runInContext(fs.readFileSync(path.join(PUB, 'js/tickets.js'), 'utf8'), ctx);
  vm.runInContext('_tkPintarContador(' + n + ')', ctx);
  return { tarjeta, srTarjeta, enlace };
}

test('(b) la tarjeta «Sugerencias / Tickets» no tapa su texto visible con aria-label; los nuevos van al lector de pantalla', () => {
  const core = fs.readFileSync(path.join(PUB, 'js/dashboards-core.js'), 'utf8');
  assert.match(core, /<div class="dash-label">'\+t\.label\+'<\/div>'\+\s*\(esTk\?'<span class="sr-only" data-tk-sr><\/span>':''\)/);
  const con = pintarContador(4);
  assert.equal(con.tarjeta.attrs['aria-label'], undefined, 'sin aria-label en la tarjeta: su nombre es el texto visible');
  assert.equal(con.srTarjeta.textContent, ' (4 nuevos)');
  assert.equal(con.enlace.attrs['aria-label'], 'Sugerencias / Tickets (4 nuevos)', 'los enlaces del menú lateral siguen igual');
  const sin = pintarContador(0);
  assert.equal(sin.srTarjeta.textContent, '');
  assert.equal(sin.enlace.attrs['aria-label'], 'Sugerencias / Tickets');
});
