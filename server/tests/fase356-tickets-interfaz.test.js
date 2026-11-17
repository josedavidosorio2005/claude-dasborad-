// fase356-tickets-interfaz.test.js — Fase 356: interfaz de «Sugerencias / Tickets».
// Lógica pura (public/js/tickets-logic.js) y cableado de la página. Datos SINTETICOS.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const L = require('../../public/js/tickets-logic.js');
const V = require('../validation');

const PUB = path.join(__dirname, '..', '..', 'public');
const INDEX = fs.readFileSync(path.join(PUB, 'index.html'), 'utf8');

test('tipos, estados y límite iguales en la interfaz y en el servidor', () => {
  assert.deepEqual(L.TICKETS_TIPOS.map((t) => t.valor), V.TICKET_TIPOS);
  assert.deepEqual(L.TICKETS_ESTADOS.map((t) => t.valor), V.TICKET_ESTADOS);
  assert.equal(L.TICKETS_TEXTO_MAX, V.TICKET_TEXTO_MAX);
  assert.deepEqual(L.TICKETS_TIPOS.map((t) => t.etiqueta), ['Sugerencia', 'Problema', 'Pregunta']);
  assert.deepEqual(L.TICKETS_ESTADOS.map((t) => t.etiqueta), ['Nuevo', 'En revisión', 'Resuelto']);
  assert.equal(L.TICKETS_AVISO_PRIVACIDAD, 'No incluyas datos de pacientes ni datos personales.');
  assert.equal(L.ticketsCampanaLbl('GENERAL'), 'General (plataforma)');
});

test('quién gestiona (solo para mostrar botones)', () => {
  assert.equal(L.ticketsEsGestor('ADMIN', true), true);
  assert.equal(L.ticketsEsGestor(null, true), true); // admin maestro
  assert.equal(L.ticketsEsGestor('REPORTES', false), true);
  for (const r of ['CLIENTES_DASH', 'SUPERVISOR', 'CALIDAD', 'ASESOR', 'GERENCIA']) assert.equal(L.ticketsEsGestor(r, false), false, r);
  assert.equal(L.ticketsPuedeBorrar(true), true);
  assert.equal(L.ticketsPuedeBorrar(false), false);
});

test('contador de caracteres y validación', () => {
  assert.equal(L.ticketsContador('').texto, '0 / ' + (2000).toLocaleString('es-CO'));
  assert.equal(L.ticketsContador('a'.repeat(2001)).sobra, true);
  assert.equal(L.ticketsTextoValido('   '), false);
  assert.equal(L.ticketsTextoValido('a'.repeat(2000)), true);
  assert.equal(L.ticketsTextoValido('a'.repeat(2001)), false);
  assert.equal(L.ticketsBadgeTexto(0), '');
  assert.equal(L.ticketsBadgeTexto(3), '3');
  assert.equal(L.ticketsBadgeTexto(150), '99+');
  assert.equal(L.ticketsBotonEtiqueta(1), 'Sugerencias / Tickets (1 nuevo)');
  assert.equal(L.ticketsBotonEtiqueta(4), 'Sugerencias / Tickets (4 nuevos)');
  assert.equal(L.ticketsBotonEtiqueta(0), 'Sugerencias / Tickets');
});

test('fechas en hora de Colombia', () => {
  // 17/11/2026 20:30 UTC = 3:30 p. m. en Bogotá (UTC-5).
  const f = L.ticketsFecha('2026-11-17T20:30:00.000Z');
  assert.match(f, /17\/11\/2026/);
  assert.match(f, /3:30/);
  assert.equal(L.ticketsFecha('no-es-fecha'), '');
});

test('lista e hilo: todo texto escapado; el autor solo para el gestor', () => {
  const t = { id: 7, tipo: 'PROBLEMA', campana: 'GENERAL', estado: 'EN_REVISION', descripcion: '<img src=x onerror=alert(1)>', autorNombre: '<b>Ana</b>', autorRol: 'CLIENTES_DASH', createdAt: '2026-11-17T20:30:00Z', respuestas: 1 };
  const conAutor = L.ticketsListaHtml([t], true);
  assert.doesNotMatch(conAutor, /<img src=x/);
  assert.doesNotMatch(conAutor, /<b>Ana/);
  assert.match(conAutor, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(conAutor, /&lt;b&gt;Ana&lt;\/b&gt;/);
  assert.match(conAutor, /data-tk-id="7"/);
  assert.match(conAutor, /En revisión/);
  assert.match(conAutor, /General \(plataforma\)/);
  assert.match(conAutor, /1 respuesta</);
  assert.doesNotMatch(L.ticketsListaHtml([t], false), /Ana/);
  assert.match(L.ticketsListaHtml([], false), /No hay tickets/);
  const hilo = L.ticketsHiloHtml([{ texto: '<script>x</script>', autorNombre: 'Rep', autorRol: 'REPORTES', createdAt: '2026-11-17T20:30:00Z', esMia: false }, { texto: 'ok', autorNombre: 'Yo', autorRol: 'CLIENTES_DASH', createdAt: '2026-11-17T20:31:00Z', esMia: true }]);
  assert.doesNotMatch(hilo, /<script>/);
  assert.match(hilo, /Tú \(CLIENTES_DASH\)/);
  assert.match(hilo, /tk-msg tk-msg-mio/);
  assert.match(L.ticketsHiloHtml([]), /Todavía no hay respuestas/);
  assert.doesNotMatch(L.ticketsOpcionesHtml([{ valor: '"x', etiqueta: '<i>' }], null, true), /<i>|"x"/);
});

test('página: botón en los 4 menús de cuenta, contador, diálogo, scripts y Escape', () => {
  const menus = (INDEX.match(/class="navbar-profile-dropdown"/g) || []).length;
  const botones = (INDEX.match(/class="navbar-help-link tk-menu-btn"[^>]*onclick="ticketsAbrir\(\)">Sugerencias \/ Tickets<span class="tk-badge hidden" data-tk-badge/g) || []).length;
  assert.equal(menus, 4);
  assert.equal(botones, 4);
  assert.equal((INDEX.match(/<span class="tk-badge tk-badge-punto hidden" data-tk-badge aria-hidden="true"><\/span><\/button>/g) || []).length, 4);
  assert.match(INDEX, /id="modal-tickets"/);
  assert.match(INDEX, /<textarea id="tk-desc" rows="6" maxlength="2000" required/);
  assert.match(INDEX, /<textarea id="tk-resp" rows="3" maxlength="2000"/);
  assert.match(INDEX, /data-tk-tab="todos"[^>]*>Todos/);
  // Clase propia: el CI de pantallas recorre todos los .gd-subtab-btn de la página.
  const dialogo = INDEX.slice(INDEX.indexOf('id="modal-tickets"'), INDEX.indexOf('<!-- Fase 355: «Exportar PDF»'));
  assert.doesNotMatch(dialogo, /gd-subtab/);
  assert.equal((dialogo.match(/class="tk-tab-btn[^"]*" data-tk-tab=/g) || []).length, 3);
  assert.match(fs.readFileSync(path.join(PUB, 'js', 'a11y-teclado.js'), 'utf8'), /SEL_TAB = '[^']*\.tk-tab-btn'/);
  assert.doesNotMatch(INDEX.slice(INDEX.indexOf('id="modal-tickets"'), INDEX.indexOf('<!-- Fase 355: «Exportar PDF»')), /type="file"/);
  const iL = INDEX.indexOf('js/tickets-logic.js'), iU = INDEX.indexOf('js/tickets.js');
  assert.ok(iL > 0 && iU > iL);
  const mh = fs.readFileSync(path.join(PUB, 'js', 'motion-helpers.js'), 'utf8');
  assert.match(mh, /'modal-tickets':/);
  const ses = fs.readFileSync(path.join(PUB, 'js', 'session.js'), 'utf8');
  assert.equal((ses.match(/ticketsAlEntrar\(\)/g) || []).length, 2, 'entrada del admin maestro y del resto');
  assert.match(ses, /ticketsAlSalir\(\)/);
  const ui = fs.readFileSync(path.join(PUB, 'js', 'tickets.js'), 'utf8');
  assert.doesNotMatch(ui, /\.innerHTML\s*=\s*[^;]*\b(t|r)\.(descripcion|texto|autorNombre)/, 'el texto del servidor no va directo a innerHTML');
  assert.match(ui, /_tkEl\('tk-det-desc'\)\.textContent = t\.descripcion/);
});

// Hallazgo de la verificación en Brave: .tk-gestion/.tk-borrar-wrap/.tk-filtros usan
// display:flex/grid DESPUÉS de .hidden{display:none}, así que el cliente veía «Estado» y
// «Borrar» (el servidor igual los rechaza). Cada caja con display propio necesita su .hidden.
test('CSS: las cajas que se ocultan con .hidden tienen su regla .hidden propia', () => {
  const css = fs.readFileSync(path.join(PUB, 'css', 'styles.css'), 'utf8');
  for (const sel of ['.tk-gestion', '.tk-borrar-wrap', '.tk-filtros', '.tk-confirmar', '.tk-badge']) {
    assert.match(css, new RegExp(sel.replace('.', '\\.') + '\\.hidden[^{]*\\{[^}]*display:none'), sel);
  }
});
