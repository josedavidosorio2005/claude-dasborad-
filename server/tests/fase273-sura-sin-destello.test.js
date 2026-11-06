// fase273-sura-sin-destello.test.js — Fase 273 (punto 5 de Edwin, 06/11): al
// abrir el tablero de SURA se veia ~2 s «Cargar información» (p1, la pestaña
// activa del marcado del HTML de Edwin) mientras llegaban el resumen y las
// bases. Ahora, hasta aplicar los permisos, solo un indicador de carga; si la
// carga falla, un mensaje (nunca «Cargar información»). No depende del rol.
//
// Corre el openSuraTeleventas REAL (public/js/sura-televentas.js) contra un DOM
// minimo que imita el marcado (pestañas p1 «on» + p9, secciones p1 visible y
// p9 oculta) y aplica la regla del <style> en linea (.wrap.stv-cargando oculta
// todo menos el indicador). La API es lenta (300 ms por pedido) y los datos
// son inventados. Con el codigo de antes de la Fase 273 esta prueba falla:
// durante la espera queda visible p1.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'sura-televentas.js'), 'utf8');
const LENTO_MS = 300;

function clases(inicial) {
  const s = new Set(inicial || []);
  return { add: (c) => s.add(c), remove: (c) => s.delete(c), contains: (c) => s.has(c), toggle: (c, on) => { const v = on === undefined ? !s.has(c) : !!on; if (v) s.add(c); else s.delete(c); return v; }, _s: s };
}
function el(tag, props) {
  return Object.assign({ tag, hidden: false, children: [], classList: clases(), dataset: {}, attrs: {}, textContent: '', innerHTML: '',
    setAttribute(k, v) { this.attrs[k] = v; }, set className(v) { this.classList = clases(String(v).split(/\s+/)); },
    get lastChild() { return { set textContent(v) { this._t = v; } }; } }, props);
}

// DOM minimo del tablero: lo que importa es que p1 nace visible y «on».
function montarMarcado(root) {
  const wrap = el('div'); wrap.classList = clases(['wrap']);
  const tab = (p, on) => { const t = el('button', { dataset: { p } }); t.classList = clases(on ? ['tab', 'on'] : ['tab']); return t; };
  const tabs = [tab('p1', true), tab('p9'), tab('p2')];
  const sec = (p, hidden) => el('section', { id: p, hidden });
  const secs = [sec('p1', false), sec('p9', true), sec('p2', true)];
  const header = el('header', { children: tabs });
  wrap.children = [header].concat(secs);
  // El clic de la app: la pestaña elegida queda «on» y solo su seccion visible.
  tabs.forEach((t) => { t.click = () => { tabs.forEach((x) => x.classList.toggle('on', x === t)); secs.forEach((s) => { s.hidden = s.id !== t.dataset.p; }); }; });
  wrap.querySelector = (sel) => (sel === '.stv-cargando-ind' ? wrap.children.find((c) => c.classList.contains('stv-cargando-ind')) || null : null);
  wrap.insertBefore = (n) => { wrap.children.unshift(n); };
  root._wrap = wrap; root._tabs = tabs; root._secs = secs;
}

// ¿Que seccion se ve? Aplica el `hidden` y la regla en linea de la Fase 273.
function visibles(root) {
  const wrap = root._wrap;
  const ocultaPorCarga = (c) => wrap.classList.contains('stv-cargando') && !c.classList.contains('stv-cargando-ind') &&
    /\.wrap\.stv-cargando>\*:not\(\.stv-cargando-ind\)\{display:none!important\}/.test(SRC);
  return {
    secciones: root._secs.filter((s) => !s.hidden && !ocultaPorCarga(s)).map((s) => s.id),
    pestanaOn: ocultaPorCarga(wrap.children.find((c) => c.tag === 'header')) ? null : (root._tabs.find((t) => t.classList.contains('on')) || {}).dataset.p,
    indicador: wrap.classList.contains('stv-cargando') ? (wrap.children.find((c) => c.classList.contains('stv-cargando-ind')) || {}).lastChild : null,
    cargando: wrap.classList.contains('stv-cargando'),
  };
}

function sandbox({ perm, falla }) {
  const textos = { 'stv-title': el('h2'), 'stv-sub': el('p') };
  const overlay = el('div'); overlay.classList = clases();
  const root = {
    set innerHTML(v) { montarMarcado(this); },
    querySelector(sel) { return sel === '.wrap' ? this._wrap : sel === '.tab.on' ? this._tabs.find((t) => t.classList.contains('on')) : sel === '.tab:not([hidden])' ? this._tabs.find((t) => !t.hidden) : null; },
    querySelectorAll(sel) { return sel === '.tab' ? this._tabs : []; },
  };
  const pedidos = [];
  const ctx = {
    console, setTimeout,
    window: {},
    document: {
      body: { style: {} },
      getElementById: (id) => (id === 'stv-overlay' ? overlay : textos[id] || null),
      createElement: (t) => el(t),
    },
    STV_MARKUP: '<div class="wrap">…</div>',
    showToast: () => {},
    // API lenta con datos inventados (resumen + 2 bases de ventas).
    apiRequest: (metodo, ruta) => new Promise((res, rej) => setTimeout(() => {
      pedidos.push(metodo + ' ' + ruta);
      if (falla) return rej(new Error('sin red'));
      res(/resumen$/.test(ruta) ? Object.assign({ bases: [{ tipo: 'ventas', mes: '2026-09' }, { tipo: 'ventas', mes: '2026-10' }], config: {} }, perm) : { filas: [['Asesor 1', 3]] });
    }, LENTO_MS)),
    // La app real necesita el DOM completo; aqui solo su cargar(): resumen y bases por la API.
    stvCrearApp: (r, api) => ({ cargar: async () => { const R = await api.resumen(); await Promise.all(R.bases.map((b) => api.base(b.tipo, b.mes))); return R; } }),
  };
  vm.createContext(ctx);
  vm.runInContext(SRC, ctx, { filename: 'sura-televentas.js' });
  ctx._stv.host = {}; ctx._stv.root = root; // como si _stvCrearHost ya hubiera corrido
  return { ctx, root, textos, pedidos };
}

const ROLES = {
  administrador: { pestanas: ['p1', 'p9', 'p2'], puedeEditar: true },
  supervisor: { pestanas: ['p9', 'p2'], puedeEditar: false },
  reportes: { pestanas: ['p9', 'p2'], puedeEditar: false },
};

for (const [rol, perm] of Object.entries(ROLES)) {
  test(`${rol}: con la API lenta nunca se ve «Cargar información»; primero el indicador, luego el tablero`, async () => {
    const { ctx, root, textos, pedidos } = sandbox({ perm });
    const abierto = ctx.openSuraTeleventas('SURA');
    // Mitad de la espera (resumen pedido, bases todavia no).
    await new Promise((r) => setTimeout(r, LENTO_MS / 2));
    let v = visibles(root);
    assert.deepEqual(v.secciones, [], 'mientras carga no se ve ninguna seccion (antes: p1, «Cargar información»)');
    assert.equal(v.pestanaOn, null, 'ni las pestañas');
    assert.ok(v.cargando && v.indicador, 'se ve el indicador de carga');
    assert.equal(textos['stv-sub'].textContent, 'Cargando…');
    // Despues del resumen, mientras llegan las bases: sigue el indicador.
    await new Promise((r) => setTimeout(r, LENTO_MS));
    v = visibles(root);
    assert.deepEqual(v.secciones, [], 'sigue sin verse nada mientras llegan las bases');
    await abierto;
    assert.equal(pedidos.length, 3, 'resumen + 2 bases');
    v = visibles(root);
    assert.equal(v.cargando, false, 'el indicador se quita');
    assert.deepEqual(v.secciones, ['p9'], 'sale el tablero en Cumplimiento');
    assert.equal(v.pestanaOn, 'p9');
    assert.equal(root._tabs[0].hidden, true, '«Cargar información» sigue fuera del tablero (Fase 242)');
  });
}

test('si la carga falla: mensaje de error, sin pestañas y sin «Cargar información»', async () => {
  const { ctx, root } = sandbox({ perm: ROLES.administrador, falla: true });
  await ctx.openSuraTeleventas('SURA');
  const v = visibles(root);
  assert.deepEqual(v.secciones, []);
  assert.equal(v.pestanaOn, null);
  assert.ok(root._wrap.children[0].classList.contains('stv-error'), 'indicador en modo error (sin spinner)');
});

test('al volver a abrir, el tablero ya armado se queda a la vista mientras recarga (sin indicador)', async () => {
  const { ctx, root } = sandbox({ perm: ROLES.supervisor });
  await ctx.openSuraTeleventas('SURA');
  const otra = ctx.openSuraTeleventas('SURA');
  await new Promise((r) => setTimeout(r, LENTO_MS / 2));
  assert.deepEqual(visibles(root).secciones, ['p9']);
  assert.equal(visibles(root).cargando, false);
  await otra;
});

test('la regla de carga va en un <style> en linea del Shadow DOM, antes de la hoja externa', () => {
  const ctx = sandbox({ perm: ROLES.supervisor }).ctx;
  const hoja = ctx._stvHojaCss();
  assert.ok(hoja.indexOf('<style>') === 0 && hoja.indexOf('<style>') < hoja.indexOf('<link'), 'el estilo en linea no espera al .css');
  assert.match(hoja, /\.wrap\.stv-cargando>\*:not\(\.stv-cargando-ind\)\{display:none!important\}/);
  assert.match(hoja, /prefers-reduced-motion:reduce/, 'el spinner respeta el movimiento reducido');
});

// ── Tableros genericos (ORLANT, Mobilize, Aurora, HLM): mismo criterio ──
// Corre el openGenericDashboard REAL (extraido de dashboard-generic.js) con la
// API lenta: mientras llega /dashboard/<cliente>, el cuerpo muestra el
// indicador (antes quedaba en blanco), nunca un aviso de «Cargar Datos»; el
// primer dibujo del tablero lo reemplaza. Si falla, queda vacio.
function sandboxGenerico({ falla }) {
  const gsrc = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'dashboard-generic.js'), 'utf8');
  const i = gsrc.indexOf('var GD_CARGANDO_HTML');
  const ini = i !== -1 ? i : gsrc.indexOf('async function openGenericDashboard(');
  const fin = gsrc.indexOf('\n}\n', gsrc.indexOf('async function openGenericDashboard(')) + 2;
  const nodos = {};
  const nodo = (id) => (nodos[id] = nodos[id] || { id, innerHTML: '', textContent: '', classList: clases(), style: {} });
  const ctx = {
    setTimeout, _gd: {},
    document: { getElementById: nodo },
    _gdBloquearScrollFondo() {}, _gdObservarAlturaHeader() {}, showToast() {},
    apiRequest: () => new Promise((res, rej) => setTimeout(() => (falla ? rej(new Error('sin red')) : res({ config: { layout: { tabs: [] } }, secciones: {} })), LENTO_MS)),
    _gdBootstrap: async () => { nodo('gd-panels').innerHTML = '<div class="aurora-card">Tráfico de Llamadas</div>'; },
  };
  vm.createContext(ctx);
  vm.runInContext(gsrc.slice(ini, fin), ctx, { filename: 'dashboard-generic.js' });
  return { ctx, nodo };
}

test('tablero generico con la API lenta: indicador mientras carga, nunca «Cargar Datos», y luego el tablero', async () => {
  const { ctx, nodo } = sandboxGenerico({});
  const p = ctx.openGenericDashboard('ORLANT');
  await new Promise((r) => setTimeout(r, LENTO_MS / 2));
  const cuerpo = nodo('gd-panels').innerHTML;
  assert.match(cuerpo, /class="loading-state[^"]*"[^>]*role="status"/, 'indicador de carga (antes: cuerpo en blanco)');
  assert.match(cuerpo, /class="spinner"/);
  assert.doesNotMatch(cuerpo, /Cargar Datos/i);
  await p;
  assert.match(nodo('gd-panels').innerHTML, /Tráfico de Llamadas/, 'el tablero reemplaza al indicador');
});

test('tablero generico: si /dashboard falla, el indicador no se queda pegado', async () => {
  const { ctx, nodo } = sandboxGenerico({ falla: true });
  await ctx.openGenericDashboard('ORLANT');
  assert.equal(nodo('gd-panels').innerHTML, '');
});
