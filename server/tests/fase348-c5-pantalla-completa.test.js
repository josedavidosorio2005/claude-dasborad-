// fase348-c5-pantalla-completa.test.js — Fase 348, punto C5 (reunion con Edwin del 12/11): ver
// las listas del Modulo de Calidad (Monitoreos, Detalle por mes, Calidad de encuestas) en pantalla
// completa. Escape sale sin cerrar el modulo (salvo que haya un dialogo abierto encima, que se cierra
// primero); cerrar el modulo o cambiar de campaña tambien la quitan.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PUB = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'public', f), 'utf8');

function contexto() {
  const oyentes = [];
  const clases = () => { const s = new Set(); return { add: (c) => s.add(c), remove: (c) => s.delete(c), contains: (c) => s.has(c) }; };
  const modal = { classList: clases() };
  const boton = { attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, removeAttribute(k) { delete this.attrs[k]; }, focus() {}, textContent: '' };
  const card = { classList: clases(), scrollTop: 50, closest: (s) => (s === '#calidad-modal' ? modal : null), querySelector: () => boton };
  let dialogoAbierto = false;
  const ctx = {
    setTimeout, clearTimeout, esc: (s) => String(s),
    document: {
      addEventListener: (t, f, cap) => oyentes.push({ t, f, cap }),
      querySelector: (s) => (/cc2-ov:not\(\[hidden\]\)/.test(s) && dialogoAbierto ? {} : null),
      querySelectorAll: () => [boton],
    },
  };
  vm.createContext(ctx);
  vm.runInContext(PUB('js/calidad-listas-logic.js') + '\n' + PUB('js/calidad-listas.js'), ctx);
  const esc = oyentes.find((o) => o.t === 'keydown' && o.cap === true);
  return { ctx, modal, card, boton, esc, abrirDialogo: (v) => { dialogoAbierto = v; } };
}

test('C5: entrar y salir pone y quita las clases (y el transform del modulo)', () => {
  const { ctx, modal, card, boton } = contexto();
  assert.match(ctx.clBotonPantallaHtml(), /aria-pressed="false"[^>]*>Pantalla completa</);
  ctx.clEntrarPantalla(card);
  assert.equal(card.classList.contains('cl-pantalla'), true);
  assert.equal(modal.classList.contains('cl-con-pantalla'), true);
  assert.equal(card.scrollTop, 0);
  assert.equal(boton.textContent, 'Salir de pantalla completa');
  assert.equal(boton.attrs['aria-pressed'], 'true');
  assert.match(ctx.clBotonPantallaHtml(), /Salir de pantalla completa/);
  ctx.clSalirPantalla();
  assert.equal(card.classList.contains('cl-pantalla'), false);
  assert.equal(modal.classList.contains('cl-con-pantalla'), false);
  assert.equal(boton.textContent, 'Pantalla completa');
  ctx.clSalirPantalla(); // dos veces no falla
});

test('C5: Escape sale de pantalla completa, pero no si hay un dialogo del modulo abierto', () => {
  const { ctx, card, esc, abrirDialogo } = contexto();
  assert.ok(esc, 'oyente de Escape en captura');
  const ev = () => ({ key: 'Escape', detenido: false, stopPropagation() { this.detenido = true; }, preventDefault() {} });
  ctx.clEntrarPantalla(card);
  abrirDialogo(true);
  const e1 = ev(); esc.f(e1);
  assert.equal(card.classList.contains('cl-pantalla'), true, 'el dialogo se cierra primero');
  assert.equal(e1.detenido, false);
  abrirDialogo(false);
  const e2 = ev(); esc.f(e2);
  assert.equal(card.classList.contains('cl-pantalla'), false);
  assert.equal(e2.detenido, true, 'no llega al Escape que cierra el modulo');
  const e3 = ev(); esc.f(e3);
  assert.equal(e3.detenido, false, 'sin pantalla completa, Escape sigue cerrando el modulo');
});

test('C5: el boton esta en las tres listas; cerrar el modulo y cambiar de campaña la quitan', () => {
  assert.match(PUB('js/calidad-listas.js'), /clBuscadorHtml\(id, conTelefono\) \+ clBotonPantallaHtml\(\)/);
  assert.match(PUB('js/calidad-analisis.js'), /clBuscadorHtml\('det', conTel\) \+ clBotonPantallaHtml\(\)/);
  assert.match(PUB('js/calidad-encuestas.js'), /clBuscadorHtml\(idLista, conTel\) \+ clBotonPantallaHtml\(\)/);
  const cal = PUB('js/calidad.js');
  assert.match(cal, /function closeCalidad\(\)\{\n  if\(typeof clSalirPantalla==='function'\) clSalirPantalla\(\);/);
  assert.match(cal, /function calReiniciarVistaListas\(\)\{\n  clSalirPantalla\(\);/);
  const css = PUB('css/styles.css');
  assert.match(css, /#calidad-modal\.cl-con-pantalla\{transform:none;transition:none\}/);
  assert.match(css, /\.aurora-card\.cl-pantalla\{position:fixed;inset:0;z-index:var\(--z-panel\)/);
});
