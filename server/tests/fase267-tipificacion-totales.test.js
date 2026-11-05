// fase267-tipificacion-totales.test.js — Fase 267 (pedido del 05/11): la
// pestaña Tipificacion pide sus totales en UN pedido por mitad (/totales) y
// el tablero, al abrirse, solo los meses (/meses). Las cifras deben quedar
// IDENTICAS: esta prueba corre el calculo VIEJO (las funciones del navegador
// de antes, contra las rutas de antes, por la API real) y el NUEVO, con datos
// inventados, y los compara en muchos filtros. Tambien compara la consulta
// vieja y la nueva de los skills de /opciones.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { request, app, tokenFor, MASTER_PASSWORD, db } = require('./helpers');
const T = require('../tipificaciones');
const { tramosDeMeses } = require('../tipificacion-totales');

const JS = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', f), 'utf8');
const L = require('../../public/js/tipificacion-logic.js');
const auth = (t) => ({ Authorization: `Bearer ${t}` });
const MESES = ['2026-08', '2026-09', '2026-10'];

// Datos inventados, con una semilla fija (siempre los mismos).
let semilla = 7;
const azar = (n) => { semilla = (semilla * 16807) % 2147483647; return semilla % n; };
const ins = db.prepare(`INSERT INTO tipificaciones (campana, canal, agente, fecha, hora, tipificacion, skill, tipoInteraccion, skillId, createdAt)
  VALUES (?, ?, ?, ?, '09:00:00', ?, ?, ?, ?, 'x')`);
const AGENTES = ['Ana', 'Beto', 'Caro', 'Dani', 'Eva', 'Fito'];
const TIPOS = Array.from({ length: 16 }, (_, k) => 'TIPO_' + k).concat(['Cliente_no_contesta', 'AGENDADA', '-']);
const SKILLS_LL = [['CALL INBOUND GENERAL', 'inbound', '1'], ['CALL INBOUND 3P', 'inbound', '2'], ['-', 'outbound_ma', ''], ['-', 'otro', ''],
  ['LLAMADAS DE SALIDA', 'outbound_ma', '0'], ['LLAMADAS DE SALIDA', 'outbound_ma', '4070'], ['LINEA DE SALIDA', null, ''], ['LLAMADAS DE SALIDA', 'inbound', '0']];
const SKILLS_WA = [['WHATSAPP GENERAL', 'inbound', '5'], ['WHATSAPP 3P', 'inbound', '6'], ['WHATSAPP DE SALIDA', 'outbound_ma', '0']];
function sembrar(campana, canales) {
  db.transaction(() => {
    for (const canal of canales) {
      const skills = canal === 'LLAMADAS' ? SKILLS_LL : SKILLS_WA;
      for (const mes of MESES) {
        for (let k = 0; k < 400; k++) {
          const s = skills[azar(skills.length)];
          ins.run(campana, canal, AGENTES[azar(AGENTES.length)], mes + '-' + String(1 + azar(28)).padStart(2, '0'), TIPOS[Math.floor(Math.sqrt(azar(TIPOS.length * TIPOS.length)))], s[0], s[1], s[2]);
        }
      }
    }
  })();
}
sembrar('ORLANT', ['LLAMADAS', 'WHATSAPP']);
sembrar('MOBILIZE', ['LLAMADAS']);
db.prepare("INSERT INTO asesor_clasificacion (campana, agente, linea, updatedAt) VALUES ('ORLANT','Ana','GENERAL','x'), ('ORLANT','Beto','3P','x'), ('ORLANT','Caro','GENERAL','x')").run();

// El navegador (tipificacion.js real) en un sandbox, con apiRequest contra la API real.
async function navegador() {
  const token = await tokenFor('admin', MASTER_PASSWORD);
  const pedidos = [];
  const ctx = {
    console, URLSearchParams, encodeURIComponent,
    document: { getElementById: () => null },
    esc: (s) => String(s == null ? '' : s), isFullAdmin: () => true, showToast: () => {}, textoFormatoNombre: (s) => String(s),
    _gd: { mesesSel: [], periodos: MESES.slice().reverse() },
    apiRequest: async (m, url) => {
      pedidos.push(url);
      const r = await request(app).get('/api' + url).set(auth(token));
      if (r.status !== 200) throw new Error(url + ' -> ' + r.status + ' ' + JSON.stringify(r.body));
      return r.body;
    },
  };
  vm.createContext(ctx);
  for (const f of ['mes-global-logic.js', 'tipificacion-logic.js', 'clasificacion-asesores-logic.js']) vm.runInContext(JS(f), ctx);
  vm.runInContext('function _gdMeses(){ return (_gd && _gd.mesesSel) || []; }', ctx);
  vm.runInContext(JS('tipificacion.js'), ctx);
  return { ctx, pedidos };
}

// El calculo de ANTES de la Fase 267 (tipificacion.js hasta la v1.133.0):
// torta por tramo, tarjetas de salida mes a mes y tarjetas de linea por tramo.
async function calculoViejo(ctx, i, campana, canal, compartido, deCanal, conSalida, conLineas) {
  const out = { porTipo: await ctx._tipificacionPorTipo(campana, canal, compartido, deCanal) };
  if (conSalida) out.resumenSalida = await ctx._tipificacionResumenSalidaMeses(i, campana, compartido, deCanal);
  if (conLineas) {
    const sinFiltro = Object.assign({}, deCanal, { tipo: '', linea: '' });
    const partes = await ctx._tipificacionPedirPorTramos('/calidad/tipificacion/salida-por-linea', compartido, (c) => ctx._tipificacionQueryString(campana, canal, c, sinFiltro));
    out.lineas = partes.length === 1 ? partes[0] : L.tipificacionSumarCampos(partes, ['total', 'salida', 'general', 'p3', 'sinClasificar']);
  }
  return out;
}
const plano = (x) => JSON.parse(JSON.stringify(x));

test('tramos: misma regla que el navegador (tipificacionTramosMeses)', () => {
  for (const m of [[], ['2026-10'], ['2026-08', '2026-10'], ['2026-08', '2026-09', '2026-10'], ['2026-12', '2027-01', '2027-03'], ['2028-02', '2028-02']]) {
    assert.deepEqual(tramosDeMeses(m), L.tipificacionTramosMeses(m), JSON.stringify(m));
  }
});

test('ORLANT: /totales da EXACTAMENTE lo mismo que el calculo viejo (MESES x filtros de cada mitad)', async () => {
  const { ctx, pedidos } = await navegador();
  vm.runInContext("_tipificacionClasifPorPanel[0] = true; _tipificacionSentidoPorCampana['ORLANT'] = true;", ctx);
  const filtros = [{}, { agente: 'Ana' }, { skill: 'LLAMADAS DE SALIDA' }, { skill: 'CANCELACIONES Y REPROGRAMACION' }, { skill: 'CALL INBOUND 3P' },
    { tipo: 'salida' }, { tipo: 'entrada' }, { linea: 'GENERAL' }, { linea: '3P' }, { linea: 'SIN' }, { agente: 'Beto', tipo: 'salida', linea: '3P' }];
  let casos = 0;
  for (const sel of [[], ['2026-09'], ['2026-10'], ['2026-08', '2026-10'], ['2026-08', '2026-09'], ['2026-08', '2026-09', '2026-10']]) {
    ctx._gd.mesesSel = sel;
    vm.runInContext('_tipificacionMesSincronizado = {};', ctx);
    ctx._tipificacionSincronizarConMesGlobal(0, MESES);
    const compartido = vm.runInContext('_tipificacionEstadoCompartido[0]', ctx);
    for (const canal of ['LLAMADAS', 'WHATSAPP']) {
      for (const deCanal of filtros) {
        const conSalida = canal === 'LLAMADAS';
        const viejo = await calculoViejo(ctx, 0, 'ORLANT', canal, compartido, deCanal, conSalida, true);
        pedidos.length = 0;
        const nuevo = await ctx._tipificacionTotales(0, 'ORLANT', canal, compartido, deCanal, conSalida, true);
        assert.equal(pedidos.length, 1, 'un solo pedido');
        const clave = JSON.stringify({ sel, canal, deCanal });
        assert.deepEqual(plano(nuevo.porTipo), plano(viejo.porTipo), 'torta ' + clave);
        assert.deepEqual(plano(nuevo.lineas), plano(viejo.lineas), 'lineas ' + clave);
        if (conSalida) assert.deepEqual(plano(nuevo.resumenSalida), plano(viejo.resumenSalida), 'salida ' + clave);
        else assert.equal(nuevo.resumenSalida, undefined);
        casos++;
      }
    }
  }
  assert.equal(casos, 6 * 2 * 11);
  // Los datos no estan vacios (si no, la comparacion no probaria nada).
  const r = await ctx._tipificacionTotales(0, 'ORLANT', 'LLAMADAS', { mes: '2026-09' }, {}, true, true);
  assert.ok(r.porTipo.total > 300 && r.resumenSalida.total > 50 && r.lineas.general > 10 && r.lineas.p3 > 5 && r.lineas.sinClasificar > 10);
});

test('Mobilize: con su fila de filtros (mes / rango / Tipo) y siguiendo MESES, lo mismo que antes; sin tarjetas de linea', async () => {
  const { ctx } = await navegador();
  // Cada escenario deja el estado como lo deja la app: MESES (sincroniza el
  // periodo y los meses de las tarjetas) o la fila de filtros puesta a mano.
  const sincronizar = (sel) => () => {
    ctx._gd.mesesSel = sel;
    vm.runInContext('_tipificacionMesSincronizado = {};', ctx);
    ctx._tipificacionSincronizarConMesGlobal(0, MESES);
    return vm.runInContext('_tipificacionEstadoCompartido[0]', ctx);
  };
  const aMano = (c) => () => { sincronizar(['2026-08', '2026-10'])(); vm.runInContext('_tipificacionEstadoCompartido[0] = ' + JSON.stringify(c), ctx); return vm.runInContext('_tipificacionEstadoCompartido[0]', ctx); };
  const escenarios = [aMano({ mes: '2026-09', desde: '', hasta: '' }), aMano({ mes: '', desde: '2026-08-10', hasta: '2026-09-20' }), sincronizar([]), sincronizar(['2026-08', '2026-10']), sincronizar(['2026-09'])];
  for (const escenario of escenarios) {
    const compartido = escenario();
    for (const deCanal of [{}, { tipo: 'inbound' }, { tipo: 'outbound_ma' }, { skill: '-' }, { skill: 'LLAMADAS DE SALIDA' }, { agente: 'Eva' }]) {
      const viejo = await calculoViejo(ctx, 0, 'MOBILIZE', 'LLAMADAS', compartido, deCanal, true, false);
      const nuevo = await ctx._tipificacionTotales(0, 'MOBILIZE', 'LLAMADAS', compartido, deCanal, true, false);
      assert.deepEqual(plano(nuevo.porTipo), plano(viejo.porTipo), JSON.stringify({ compartido, deCanal }));
      assert.deepEqual(plano(nuevo.resumenSalida), plano(viejo.resumenSalida), JSON.stringify({ compartido, deCanal }));
      assert.equal(nuevo.lineas, undefined);
    }
  }
});

test('/opciones: la consulta nueva de skills da la misma lista que la vieja (regla fila por fila); /meses = los meses de /opciones', async () => {
  for (const campana of ['ORLANT', 'MOBILIZE']) {
    const nueva = T.tipificacionesOpciones(db, campana, 'LLAMADAS').skills;
    // La de antes: la misma regla evaluada sobre cada fila del historial.
    const vieja = db.prepare(`SELECT DISTINCT ${T.skillOpcionesSql(campana)} AS v FROM tipificaciones WHERE campana = ? AND canal = ? ORDER BY v`).all(campana, 'LLAMADAS').map((r) => r.v);
    assert.deepEqual(nueva, vieja, campana);
    assert.ok(nueva.length >= 4, campana + ': ' + nueva.join(' | '));
  }
  assert.ok(T.tipificacionesOpciones(db, 'ORLANT', 'LLAMADAS').skills.includes('CANCELACIONES Y REPROGRAMACION'));
  const token = await tokenFor('admin', MASTER_PASSWORD);
  for (const campana of ['ORLANT', 'MOBILIZE', 'CLINICA AURORA']) {
    const r = await request(app).get('/api/calidad/tipificacion/meses').query({ campana }).set(auth(token));
    assert.equal(r.status, 200);
    assert.deepEqual(Object.keys(r.body), ['LLAMADAS', 'WHATSAPP']);
    for (const canal of ['LLAMADAS', 'WHATSAPP']) assert.deepEqual(r.body[canal], T.tipificacionesOpciones(db, campana, canal).meses, campana + ' ' + canal);
  }
});

test('/totales y /meses: permisos y validacion como las demas rutas de Tipificacion', async () => {
  assert.equal((await request(app).get('/api/calidad/tipificacion/totales').query({ campana: 'ORLANT', canal: 'LLAMADAS' })).status, 401);
  assert.equal((await request(app).get('/api/calidad/tipificacion/meses').query({ campana: 'ORLANT' })).status, 401);
  const token = await tokenFor('admin', MASTER_PASSWORD);
  const get = (q) => request(app).get('/api/calidad/tipificacion/totales').query(q).set(auth(token));
  assert.equal((await get({ campana: 'ORLANT', canal: 'LLAMADAS', meses: '2026-13' })).status, 400);
  assert.equal((await get({ campana: 'ORLANT', canal: 'LLAMADAS', salida: 'si' })).status, 400);
  assert.equal((await get({ campana: 'ORLANT', canal: 'FAX' })).status, 400);
  // Mobilize no usa la clasificacion de asesores: aunque se pidan, no hay tarjetas de linea.
  const m = await get({ campana: 'MOBILIZE', canal: 'LLAMADAS', mes: '2026-09', lineas: '1' });
  assert.equal(m.status, 200);
  assert.equal(m.body.lineas, undefined);
  // WhatsApp nunca trae tarjetas de salida (son de llamadas).
  assert.equal((await get({ campana: 'ORLANT', canal: 'WHATSAPP', mes: '2026-09', salida: '1' })).body.resumenSalida, undefined);
});

test('el navegador: las 2 mitades y sus opciones se piden a la vez; al abrir el tablero, solo /meses', () => {
  const s = JS('tipificacion.js');
  assert.ok(s.includes("await Promise.all(canalesAUsar.map(function(c){ return _tipificacionDibujarCanal(campana, i, c.canal, opPorCanal[c.canal]); }));"));
  assert.ok(s.includes('await Promise.all(canalesAUsar.map(function(c){ return _tipificacionCargarOpciones(campana, c.canal); }));'));
  assert.ok(s.includes("apiRequest('GET', '/calidad/tipificacion/totales?'+params.toString())"));
  const g = JS('dashboard-generic.js');
  assert.ok(g.includes("'/calidad/tipificacion/meses?campana='+encodeURIComponent(campTip)"));
  assert.ok(!g.includes("'/calidad/tipificacion/opciones?campana='"), 'el tablero ya no pide las opciones completas al abrirse');
});
