// fase137-partec-escape-popup-interno.test.js — Fase 137, Parte C: bug
// real encontrado al investigar un hallazgo de produccion (2 fallos de
// revision-final.js al cambiar de pestana en ORLANT, justo despues de
// exportar). Reproducido en LOCAL (seed:demo) con el recorrido COMPLETO
// de correrChequeosAdmin: el Escape que scripts/produccion/
// revision-final.js presiona por costumbre despues de exportar (de
// cuando Escape todavia no hacia nada) ahora cierra el dashboard ENTERO
// de ORLANT -- confirmado que esto NO pasaba en el commit justo antes
// del PR #377 (F04), y que #gd-export-menu ya no existia en el DOM en el
// momento exacto del Escape (el boton "Excel" ya lo habia cerrado con su
// propio toggle) -- un popup NO tiene que seguir abierto para que pase.
//
// Arreglo con 2 partes en motion-helpers.js (ver su comentario de
// cabecera para el detalle completo): 1) un popup interno TODAVIA
// abierto (registrado) intercepta Escape, nunca cascadea al overlay; 2)
// un popup cerrado hace <400ms (por click, clic afuera, o por el propio
// Escape del punto 1) deja el Escape "gastado" un instante, sin cerrar
// el overlay -- el caso real de arriba.
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

function construirDomFalso() {
  var registro = {};

  class ElementoFalso {
    constructor(id, parent) {
      this.id = id;
      this.parentElement = parent || null;
      this._clases = new Set();
      this.classList = {
        add: (c) => this._clases.add(c),
        remove: (c) => this._clases.delete(c),
        contains: (c) => this._clases.has(c),
      };
      if (registro[id]) throw new Error('id duplicado: ' + id);
      registro[id] = this;
    }
  }

  class DocumentoFalso extends EventTarget {
    getElementById(id) { return registro[id] || null; }
  }

  return { ElementoFalso, documentoFalso: new DocumentoFalso() };
}

function cargarMotionHelpers() {
  if (typeof global.requestAnimationFrame !== 'function') {
    global.requestAnimationFrame = (cb) => setTimeout(cb, 16);
  }
  delete require.cache[path.join(__dirname, '..', '..', 'public', 'js', 'motion-helpers.js')];
  return require(path.join(__dirname, '..', '..', 'public', 'js', 'motion-helpers.js'));
}

function dispararEscape(documentoFalso) {
  var ev = new Event('keydown');
  ev.key = 'Escape';
  documentoFalso.dispatchEvent(ev);
}

function prepararOverlayAbierto(dom, mod) {
  var overlay = new dom.ElementoFalso('gd-overlay');
  var modal = new dom.ElementoFalso('gd-modal', overlay);
  overlay.classList.add('show');
  mod.motionAbrirModal('gd-modal'); // empuja 'gd-overlay' a MOTION_OVERLAY_STACK, igual que el app real
  return overlay;
}

test('con un popup interno registrado (todavia abierto), Escape lo cierra a EL -- nunca cascade al overlay (F04, PR 8, sigue intacto)', () => {
  var dom = construirDomFalso();
  global.document = dom.documentoFalso;
  var mod = cargarMotionHelpers();
  var overlay = prepararOverlayAbierto(dom, mod);

  var overlayCerrado = false;
  global.closeGenericDashboard = function () { overlayCerrado = true; overlay.classList.remove('show'); };

  var popupCerrado = false;
  mod.motionRegistrarPopupInterno('gd-export-menu', function () {
    popupCerrado = true;
    mod.motionDesregistrarPopupInterno('gd-export-menu');
  });

  dispararEscape(dom.documentoFalso);

  assert.equal(popupCerrado, true, 'el popup deberia haberse cerrado');
  assert.equal(overlayCerrado, false, 'el overlay NUNCA deberia cerrarse en el mismo Escape que cerro el popup');
  assert.equal(overlay.classList.contains('show'), true, 'el dashboard sigue abierto');

  delete global.document;
  delete global.closeGenericDashboard;
});

test('HALLAZGO REAL: un popup cerrado por OTRO camino (ej. clic en "Excel") deja un Escape de costumbre sin efecto en el overlay -- periodo de gracia', () => {
  var dom = construirDomFalso();
  global.document = dom.documentoFalso;
  var mod = cargarMotionHelpers();
  var overlay = prepararOverlayAbierto(dom, mod);

  var overlayCerrado = false;
  global.closeGenericDashboard = function () { overlayCerrado = true; overlay.classList.remove('show'); };

  // Simula EXACTAMENTE lo que _gdExport() hace al hacer clic en "Excel":
  // se registra al abrir, se desregistra al cerrar -- SIN pasar por
  // Escape (el camino real del bug).
  mod.motionRegistrarPopupInterno('gd-export-menu', function () {});
  mod.motionDesregistrarPopupInterno('gd-export-menu');

  // El Escape "de costumbre" de revision-final.js llega justo despues.
  dispararEscape(dom.documentoFalso);

  assert.equal(overlayCerrado, false, 'el overlay NO deberia cerrarse -- este Escape ya estaba "gastado" por el cierre reciente del popup');
  assert.equal(overlay.classList.contains('show'), true, 'el dashboard sigue abierto (esto es lo que revision-final.js necesita para poder seguir con la 2a pestana)');

  delete global.document;
  delete global.closeGenericDashboard;
});

test('sin ningun popup activo ni cierre reciente (periodo de gracia ya vencido), Escape sigue cerrando el overlay de mas arriba -- regresion del PR 8 (F04)', async () => {
  var dom = construirDomFalso();
  global.document = dom.documentoFalso;
  var mod = cargarMotionHelpers();
  var overlay = prepararOverlayAbierto(dom, mod);

  var overlayCerrado = false;
  global.closeGenericDashboard = function () { overlayCerrado = true; overlay.classList.remove('show'); };

  // Deja pasar el periodo de gracia (400ms) sin ningun popup de por medio.
  await new Promise((r) => setTimeout(r, 450));

  dispararEscape(dom.documentoFalso);

  assert.equal(overlayCerrado, true, 'Escape deberia seguir cerrando el dashboard cuando no hay ningun popup interno de por medio -- la funcion original del PR 8 no se rompio');
  assert.equal(overlay.classList.contains('show'), false);

  delete global.document;
  delete global.closeGenericDashboard;
});

test('motionDesregistrarPopupInterno(id, false) NO marca el periodo de gracia -- uso interno de motionRegistrarPopupInterno al re-registrar, no cuenta como "cierre"', () => {
  var dom = construirDomFalso();
  global.document = dom.documentoFalso;
  var mod = cargarMotionHelpers();

  assert.equal(mod._popupCerradoHace(), 0);
  mod.motionRegistrarPopupInterno('x', function () {});
  // Re-registrar el MISMO id (motionRegistrarPopupInterno llama a
  // motionDesregistrarPopupInterno(id, false) por dentro) no deberia
  // activar el periodo de gracia.
  mod.motionRegistrarPopupInterno('x', function () {});
  assert.equal(mod._popupCerradoHace(), 0, 'un re-registro no es un cierre real');
  assert.equal(mod._popupsInternos().length, 1, 'sigue habiendo exactamente 1 popup registrado, no 2');

  delete global.document;
});
