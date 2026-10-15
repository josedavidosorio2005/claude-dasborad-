// a11y-teclado.js — InConexion Platform (Fase 144, A2: hallazgos D01, D02,
// D09 y D19 de la Fase 143). Pegamento con el DOM de a11y-logic.js:
//
//  1. Controles con role="button" que no son <button> (opciones del menu
//     lateral, tarjetas de modulo de la bienvenida): Enter y Espacio los
//     activan igual que un clic (antes no hacian nada: WCAG 2.1.1).
//  2. Barras de pestañas (.aurora-tabs con .atab, .gd-subtabs con
//     .gd-subtab-btn): role="tablist"/"tab", aria-selected, tabindex
//     itinerante y flechas/Inicio/Fin (patron APG, activacion manual). No se
//     toca ningun lugar donde se dibujan: se sincroniza con la clase que ya
//     marca la activa (atab-active / on), asi que sirve para todos los
//     modulos (tablero, Calidad, Gerencia, Trafico, Inasistencia...).
//  3. Menu lateral movil: el boton ☰ dice aria-expanded y Escape lo cierra.
//
// Sin dependencias; no anima nada (respeta motion-helpers.js tal cual).
'use strict';

(function () {
  var SEL_TABLIST = '.aurora-tabs, .gd-subtabs';
  var SEL_TAB = '.atab, .gd-subtab-btn';
  var _idSeq = 0;

  function esActiva(btn) {
    return btn.classList.contains('atab-active') || btn.classList.contains('on');
  }
  function tabsDe(lista) {
    return Array.prototype.filter.call(lista.querySelectorAll(SEL_TAB), function (b) {
      return b.closest(SEL_TABLIST) === lista;
    });
  }

  function marcarTablist(lista) {
    if (lista.getAttribute('role') !== 'tablist') lista.setAttribute('role', 'tablist');
    if (!lista.hasAttribute('aria-label') && lista.id === 'gd-tabs') lista.setAttribute('aria-label', 'Secciones del tablero');
    var tabs = tabsDe(lista);
    if (!tabs.length) return;
    var iActiva = -1;
    tabs.forEach(function (t, i) { if (esActiva(t)) iActiva = i; });
    var tabindex = a11yTabindexItinerante(tabs.length, iActiva);
    tabs.forEach(function (t, i) {
      if (!t.id) t.id = 'a11y-tab-' + (++_idSeq);
      if (t.getAttribute('role') !== 'tab') t.setAttribute('role', 'tab');
      var sel = String(i === iActiva);
      if (t.getAttribute('aria-selected') !== sel) t.setAttribute('aria-selected', sel);
      var ti = String(tabindex[i]);
      if (t.getAttribute('tabindex') !== ti) t.setAttribute('tabindex', ti);
    });
    // El contenido de las pestañas del tablero vive en #gd-panels.
    if (lista.id === 'gd-tabs') {
      var panel = document.getElementById('gd-panels');
      if (panel) {
        if (panel.getAttribute('role') !== 'tabpanel') panel.setAttribute('role', 'tabpanel');
        if (iActiva >= 0) {
          tabs.forEach(function (t) { t.setAttribute('aria-controls', 'gd-panels'); });
          if (panel.getAttribute('aria-labelledby') !== tabs[iActiva].id) panel.setAttribute('aria-labelledby', tabs[iActiva].id);
        }
      }
    }
  }

  function sincronizarTodo() {
    Array.prototype.forEach.call(document.querySelectorAll(SEL_TABLIST), marcarTablist);
    sincronizarToggleSidebar();
  }

  // ── Menu lateral: aria-expanded del boton ☰ ──────────────────────────
  function sincronizarToggleSidebar() {
    var esMovil = typeof SIDEBAR_MQ_MOVIL === 'string' && window.matchMedia && window.matchMedia(SIDEBAR_MQ_MOVIL).matches;
    Array.prototype.forEach.call(document.querySelectorAll('.navbar-menu-toggle'), function (btn) {
      var page = btn.closest('.app-page');
      if (!page) return;
      var abierto = esMovil ? page.classList.contains('sidebar-open') : document.documentElement.getAttribute('data-sidebar-collapsed') !== '1';
      var v = String(!!abierto);
      if (btn.getAttribute('aria-expanded') !== v) btn.setAttribute('aria-expanded', v);
    });
  }
  window.a11ySincronizarToggleSidebar = sincronizarToggleSidebar;

  // ── Teclado ───────────────────────────────────────────────────────────
  document.addEventListener('keydown', function (e) {
    var t = e.target;
    if (!t || !t.closest) return;
    // 1) role="button" que no es un <button>/<input> nativo.
    if (a11yEsTeclaDeActivacion(e.key) && t.getAttribute('role') === 'button' && !/^(BUTTON|INPUT|SELECT|TEXTAREA)$/.test(t.tagName)) {
      e.preventDefault();
      t.click();
      return;
    }
    // 2) Flechas dentro de una barra de pestañas.
    if (t.getAttribute('role') === 'tab') {
      var lista = t.closest('[role="tablist"]');
      if (!lista) return;
      var tabs = tabsDe(lista).filter(function (b) { return b.offsetParent !== null; });
      var sig = a11yIndiceTabSiguiente(tabs.indexOf(t), tabs.length, e.key);
      if (sig >= 0) {
        e.preventDefault();
        tabs[sig].focus();
        if (tabs[sig].scrollIntoView) tabs[sig].scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }
      return;
    }
    // 3) Escape cierra el menu lateral movil abierto (si no hay un dialogo
    //    encima: esos ya cierran con Escape en motion-helpers.js).
    if (e.key === 'Escape') {
      var abierta = document.querySelector('.app-page.sidebar-open');
      var hayDialogo = typeof MOTION_OVERLAY_STACK !== 'undefined' && MOTION_OVERLAY_STACK && MOTION_OVERLAY_STACK.length;
      if (abierta && !hayDialogo && typeof closeSidebar === 'function') {
        closeSidebar();
        var btn = abierta.querySelector('.navbar-menu-toggle');
        if (btn) btn.focus();
      }
    }
  });

  // ── Mantener los roles al dia cuando los modulos redibujan ────────────
  var pendiente = false;
  function programar() {
    if (pendiente) return;
    pendiente = true;
    (window.requestAnimationFrame || setTimeout)(function () { pendiente = false; sincronizarTodo(); });
  }
  function iniciar() {
    sincronizarTodo();
    if (window.MutationObserver) {
      new MutationObserver(programar).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
      new MutationObserver(programar).observe(document.documentElement, { attributes: true, attributeFilter: ['data-sidebar-collapsed'] });
    }
    window.addEventListener('resize', programar);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
