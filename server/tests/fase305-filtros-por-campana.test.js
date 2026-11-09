// fase305-filtros-por-campana.test.js — Fase 305 (10/11/2026).
// 3) BUG: un filtro elegido en una campaña (ej. Tráfico «Día») aparecia aplicado
//    en otra. Ahora cada CLIENTE guarda sus propios filtros (objetos de estado de
//    los paneles + ?tv_/?tvw_ de la URL). Corre el codigo REAL de
//    dashboard-generic.js en un sandbox.
// 1) Aurora › Agendas: nombres completos en el eje. 2) Aurora: «Errores» de ultima.
// 4) Mobilize: botones resaltados (solo Mobilize; ORLANT igual).
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const JS = path.join(__dirname, '..', '..', 'public', 'js');
const GSRC = fs.readFileSync(path.join(JS, 'dashboard-generic.js'), 'utf8');

function sandbox() {
  const i = GSRC.indexOf('var GD_ESTADO_A_REINICIAR');
  const fin = GSRC.indexOf('\n}\n', GSRC.indexOf('function gdReiniciarFiltros(')) + 2;
  const url = { pathname: '/', search: '', hash: '' };
  const ctx = {
    URLSearchParams,
    location: url,
    history: { replaceState: (_s, _t, u) => { const q = u.indexOf('?'); url.search = q === -1 ? '' : u.slice(q).split('#')[0]; } },
    _gd: { charts: {} },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(GSRC.slice(i, fin), ctx, { filename: 'dashboard-generic.js' });
  // Los objetos de estado que en la app crean los paneles.
  vm.runInContext('GD_ESTADO_A_REINICIAR.concat(GD_ESTADO_POR_PANEL).forEach(function(n){ window[n] = {}; });', ctx);
  return { ctx, url };
}

test('cambiar un filtro en la campaña A no altera la campaña B; cada una recuerda los suyos', () => {
  const { ctx, url } = sandbox();
  const run = (c) => vm.runInContext(c, ctx);
  // A = ORLANT: Trafico por dia (estado + URL), linea 3P en salida, vista NPS en la encuesta.
  run("gdCambiarEstadoACliente('ORLANT')");
  run("_traficoEstado['ORLANT'] = { granularidad: 'dia' }; _traficoWppEstado['ORLANT'] = { granularidad: 'dia' }; _salLinea[0] = { llamadas: '3P' }; _encuestaVistaQ1[0] = 'nps';");
  url.search = '?tv_gran=dia&tvw_gran=dia&otro=1';
  // B = Aurora (nunca abierta): nada de lo de A.
  run("gdCambiarEstadoACliente('CLINICA AURORA')");
  assert.equal(run('Object.keys(_traficoEstado).length + Object.keys(_traficoWppEstado).length + Object.keys(_salLinea).length + Object.keys(_encuestaVistaQ1).length'), 0);
  assert.equal(url.search, '?otro=1', 'los tv_/tvw_ de A salen de la URL; lo demas se queda');
  run("_traficoEstado['CLINICA AURORA'] = { granularidad: 'anio' };");
  url.search = '?otro=1&tv_gran=anio';
  // C = HLM: tampoco ve lo de A ni lo de B.
  run("gdCambiarEstadoACliente('HOSPITAL LA MARIA')");
  assert.equal(run('Object.keys(_traficoEstado).length'), 0);
  assert.ok(!/tv_/.test(url.search));
  // Volver a A: sus filtros, tal cual.
  run("gdCambiarEstadoACliente('ORLANT')");
  assert.equal(run("_traficoEstado['ORLANT'].granularidad"), 'dia');
  assert.equal(run("_salLinea[0].llamadas"), '3P');
  assert.equal(run("_encuestaVistaQ1[0]"), 'nps');
  assert.equal(run("_traficoEstado['CLINICA AURORA']"), undefined);
  assert.match(url.search, /tv_gran=dia/);
  assert.match(url.search, /tvw_gran=dia/);
  // Volver a B: los suyos.
  run("gdCambiarEstadoACliente('CLINICA AURORA')");
  assert.equal(run("_traficoEstado['CLINICA AURORA'].granularidad"), 'anio');
  assert.match(url.search, /tv_gran=anio/);
});

test('abrir otra vez el MISMO cliente no toca nada (ORLANT usado solo: igual que antes)', () => {
  const { ctx, url } = sandbox();
  const run = (c) => vm.runInContext(c, ctx);
  run("gdCambiarEstadoACliente('ORLANT'); _traficoEstado['ORLANT'] = { granularidad: 'dia' };");
  url.search = '?tv_gran=dia';
  run("gdCambiarEstadoACliente('ORLANT')");
  assert.equal(run("_traficoEstado['ORLANT'].granularidad"), 'dia');
  assert.equal(url.search, '?tv_gran=dia');
});

test('cerrar sesion borra los filtros de todos los clientes', () => {
  const { ctx, url } = sandbox();
  const run = (c) => vm.runInContext(c, ctx);
  run("gdCambiarEstadoACliente('ORLANT'); _traficoEstado['ORLANT'] = { granularidad: 'dia' };");
  run("gdCambiarEstadoACliente('MOBILIZE'); gdReiniciarFiltros(); gdCambiarEstadoACliente('ORLANT');");
  assert.equal(run('Object.keys(_traficoEstado).length'), 0);
  assert.equal(url.search, '');
});

test('el cambio de cliente se hace al abrir el tablero (normal y vista previa), protegido', () => {
  assert.match(GSRC, /if\(typeof gdCambiarEstadoACliente === 'function'\) gdCambiarEstadoACliente\(cliente\);/);
  assert.match(GSRC, /if\(typeof gdCambiarEstadoACliente === 'function'\) gdCambiarEstadoACliente\(config\.cliente\);/);
  // Los estados por panel (indice i, no campaña) tambien se apartan.
  for (const n of ['_salLinea', '_encuestaVistaQ1', '_errEstado']) assert.match(GSRC, new RegExp("GD_ESTADO_POR_PANEL = \\[[^\\]]*'" + n + "'"));
});

test('Aurora: «Errores» siempre de ultima (despues de Tipificación)', () => {
  const G = require('../../public/js/graficas-lineas-logic.js');
  const tabs = ['trafico', 'errores', 'tipificacion', 'agendas_usuaria', 'salida', 'total_trafico', 'trafico_whatsapp'].map((key) => ({ key }));
  const out = G.pestanasOrdenCliente(tabs, 'CLINICA AURORA').map((t) => t.key);
  assert.equal(out[out.length - 1], 'errores');
  assert.deepEqual(out, ['trafico', 'trafico_whatsapp', 'total_trafico', 'salida', 'agendas_usuaria', 'tipificacion', 'errores']);
  const orl = ['trafico', 'trafico_whatsapp', 'salida', 'total_trafico', 'agendamiento'].map((key) => ({ key }));
  assert.deepEqual(G.pestanasOrdenCliente(orl, 'ORLANT').map((t) => t.key), ['trafico', 'trafico_whatsapp', 'total_trafico', 'salida', 'agendamiento'], 'ORLANT igual que en la Fase 300');
});

test('Mobilize: botones resaltados; ORLANT, Aurora (fuera de Agendas), HLM y SURA no', () => {
  const G = require('../../public/js/graficas-lineas-logic.js');
  assert.equal(G.gdBotonesResaltados('MOBILIZE'), true);
  for (const c of ['ORLANT', 'CLINICA AURORA', 'HOSPITAL LA MARIA', 'SURA', '', undefined]) assert.equal(G.gdBotonesResaltados(c), false, String(c));
  assert.match(GSRC, /ovB\.classList\.toggle\('gd-botones-resaltados', typeof gdBotonesResaltados === 'function' && gdBotonesResaltados\(_gd\.cliente\)\)/);
});

test('Aurora › Agendas: nombres completos en el eje (varias lineas; sin «…»)', () => {
  const L = require('../../public/js/agendas-usuaria-logic.js');
  assert.deepEqual(L.auPartirEtiqueta('PROFESIONAL FICTICIO 10', 14), ['PROFESIONAL', 'FICTICIO 10']);
  assert.equal(L.auPartirEtiqueta('ONCOLOGIA', 14), 'ONCOLOGIA');
  assert.deepEqual(L.auPartirEtiqueta('OTORRINOLARINGOLOGIA PEDIATRICA', 14), ['OTORRINOLARINGOLOGIA', 'PEDIATRICA'], 'palabra larga entera');
  const largo = 'NOMBRE MUY LARGO DE UNA ESPECIALIDAD FICTICIA';
  assert.equal([].concat(L.auPartirEtiqueta(largo, 14)).join(' '), largo, 'no se pierde ninguna palabra');
  const au = fs.readFileSync(path.join(JS, 'agendas-usuaria.js'), 'utf8');
  const g2 = au.slice(au.indexOf('function _auPintarG2'), au.indexOf('// Botones: la base redibuja'));
  assert.doesNotMatch(g2, /…/, 'ya no se cortan los nombres');
  assert.match(g2, /auPartirEtiqueta\(t, 14\)/);
});
