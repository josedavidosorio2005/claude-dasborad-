// fase141-llamadas-salida.test.js — Fase 141 (Parte C, reunion con Edwin del
// 13/10/2026): "Llamadas de salida" de Mobilize, mitad derecha de la pestaña
// "Llamadas Únicas". Cubre: parser (columnas sin importar mayusculas/
// espacios, SKILL_ID -> tipo, rechazo con aviso, filas vacias, unica por
// dia+telefono+tipo, telefonos en ambos tipos), migracion (tabla nueva sin
// telefono), API (reemplazo por rango, permisos, nombres de asesor SOLO para
// roles internos), plan de carga y panel (2 mitades, tarjetas en orden,
// estado vacio). Todo con datos SINTETICOS.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const {
  LLAMADAS_SALIDA_COLUMNAS,
  LLAMADAS_SALIDA_ORDEN_ARRAY,
  llamadasSalidaColIndexMap,
  llamadasSalidaParseFilas,
} = require('../../public/js/llamadas-salida-logic.js');
const { CAMPOS_FILA } = require('../llamadas-salida');
const { cargasPlanConsolidado } = require('../../public/js/cargas-logic.js');
const { request, app, tokenFor, MASTER_PASSWORD, SEED, db } = require('./helpers');

const HEADER = ['AGENT_NAME', 'DATE', 'TELEPHONE', 'DESCRIPTION_COD_ACT', 'SKILL_ID'];
const CON = 'LLAMADAS DE SALIDA CONECTADAS';
const NO = 'LLAMADAS DE SALIDA NO CONECTADAS';
const aoaDe = (filas) => [HEADER, ...filas];
const auth = (t) => ({ Authorization: `Bearer ${t}` });
const CENTINELA_TEL = '3009998877123';

// ── Parser ────────────────────────────────────────────────────────────────

test('parser: contrato del payload = [agente, fecha, tipo, tipificacion], igual al del servidor y sin telefono', () => {
  assert.deepEqual(LLAMADAS_SALIDA_ORDEN_ARRAY, ['agente', 'fecha', 'tipo', 'tipificacion']);
  assert.deepEqual(CAMPOS_FILA, LLAMADAS_SALIDA_ORDEN_ARRAY);
  assert.deepEqual(LLAMADAS_SALIDA_COLUMNAS.map((c) => c.label), HEADER);
});

test('parser: encabezados sin importar mayusculas ni espacios', () => {
  const map = llamadasSalidaColIndexMap([' agent_name ', 'Date', 'telephone', 'Description_Cod_Act', 'skill_id']);
  assert.deepEqual(map, { agente: 0, fecha: 1, telefono: 2, tipificacion: 3, tipo: 4 });
});

test('parser: SKILL_ID -> CONECTADA / NO_CONECTADA (mayusculas/acentos/espacios), otro valor se rechaza con aviso', () => {
  const r = llamadasSalidaParseFilas(aoaDe([
    ['Asesor Uno', '2026-09-01', '3001', 'AGENDO CITA', CON],
    ['Asesor Uno', '2026-09-01', '3002', 'NO CONTESTA', '  llamadas de salida  no conectadas '],
    ['Asesor Uno', '2026-09-01', '3003', 'X', 'NO CONTESTADAS'],
  ]));
  assert.deepEqual(r.filas.map((f) => f[2]), ['CONECTADA', 'NO_CONECTADA']);
  assert.equal(r.avisos.length, 1);
  assert.match(r.avisos[0], /Fila 4: SKILL_ID "NO CONTESTADAS" no es/);
});

test('parser: filas totalmente vacias se ignoran sin aviso; columna faltante = error sin filas parciales', () => {
  const r = llamadasSalidaParseFilas(aoaDe([[null, null, null, null, null], ['', '', '', '', ''], ['Asesor Uno', '2026-09-02', '3001', 'A', CON]]));
  assert.equal(r.filas.length, 1);
  assert.equal(r.avisos.length, 0);
  const e = llamadasSalidaParseFilas([['AGENT_NAME', 'DATE', 'TELEPHONE', 'DESCRIPTION_COD_ACT'], ['A', '2026-09-02', '1', 'x']]);
  assert.match(e.error, /Faltan columnas obligatorias: SKILL_ID/);
  assert.equal(e.filas, undefined);
});

test('parser: unica = dia + telefono + tipo; reporta (sin resolver) cuantos dia+telefono aparecen en ambos tipos', () => {
  const r = llamadasSalidaParseFilas(aoaDe([
    ['Asesor Uno', '2026-09-03', '300 1', 'A', NO],
    ['Asesor Uno', '2026-09-03', '3001', 'A', NO], // mismo dia+tel+tipo -> duplicado
    ['Asesor Uno', '2026-09-03', '3001', 'B', CON], // mismo dia+tel, otro tipo -> cuenta
    ['Asesor Uno', '2026-09-04', '3001', 'B', CON], // otro dia -> cuenta
    ['Asesor Dos', '2026-09-03', '3002', 'C', CON],
  ]));
  assert.equal(r.filas.length, 4);
  assert.equal(r.duplicadosQuitados, 1);
  assert.equal(r.telefonosEnAmbosTipos, 1);
  assert.ok(!JSON.stringify(r.filas).includes('3001'), 'el telefono nunca sale del parser');
});

// ── Migracion ─────────────────────────────────────────────────────────────

test('migracion: tabla llamadas_salida existe, sin columna de telefono, con su indice', () => {
  const cols = db.prepare('PRAGMA table_info(llamadas_salida)').all().map((c) => c.name).sort();
  assert.deepEqual(cols, ['agente', 'archivoNombre', 'campana', 'cargadoPorNombre', 'createdAt', 'fecha', 'id', 'tipificacion', 'tipo']);
  const idx = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='llamadas_salida'").all().map((r) => r.name);
  assert.ok(idx.includes('idx_llamadas_salida_campana_fecha'));
  const mig = db.prepare("SELECT name FROM schema_migrations WHERE name = 'fase141_llamadas_salida_tabla_v1'").get();
  assert.ok(mig, 'la migracion queda registrada (corre una sola vez)');
});

// ── API ───────────────────────────────────────────────────────────────────

function filasSept() {
  return llamadasSalidaParseFilas(aoaDe([
    ['Asesor Uno', '2026-09-01', '3001', 'AGENDO CITA', CON],
    ['Asesor Uno', '2026-09-01', '3002', 'NO CONTESTA', NO],
    ['Asesor Dos', '2026-09-15', '3003', 'NO CONTESTA', NO],
    ['Asesor Dos', '2026-09-30', CENTINELA_TEL, 'AGENDO CITA', CON],
  ])).filas;
}

test('API: carga + impacto + reemplazo por rango (recargar no duplica, otro mes no borra el anterior)', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const impacto = await request(app).post('/api/calidad/llamadas-salida/carga/impacto').set(auth(admin))
    .send({ campana: 'MOBILIZE', filas: filasSept() });
  assert.equal(impacto.status, 200, JSON.stringify(impacto.body));
  assert.equal(impacto.body.filasNuevas, 4);
  assert.equal(impacto.body.conectadas, 2);
  assert.equal(impacto.body.noConectadas, 2);
  assert.equal(impacto.body.desde, '2026-09-01');
  assert.equal(impacto.body.hasta, '2026-09-30');

  const c1 = await request(app).post('/api/calidad/llamadas-salida/carga').set(auth(admin))
    .send({ campana: 'MOBILIZE', archivoNombre: 'sintetico.xlsx', filas: filasSept() });
  assert.equal(c1.status, 201, JSON.stringify(c1.body));
  const c2 = await request(app).post('/api/calidad/llamadas-salida/carga').set(auth(admin))
    .send({ campana: 'MOBILIZE', archivoNombre: 'sintetico.xlsx', filas: filasSept() });
  assert.equal(c2.body.borradas, 4);
  const oct = llamadasSalidaParseFilas(aoaDe([['Asesor Uno', '2026-10-01', '3001', 'A', CON]])).filas;
  const c3 = await request(app).post('/api/calidad/llamadas-salida/carga').set(auth(admin)).send({ campana: 'MOBILIZE', filas: oct });
  assert.equal(c3.body.borradas, 0);

  const resumen = await request(app).get('/api/calidad/llamadas-salida/resumen').query({ campana: 'MOBILIZE' }).set(auth(admin));
  assert.deepEqual(resumen.body, { total: 5, noConectadas: 2, conectadas: 3 });
  const sept = await request(app).get('/api/calidad/llamadas-salida/resumen').query({ campana: 'MOBILIZE', desde: '2026-09-01', hasta: '2026-09-30' }).set(auth(admin));
  assert.deepEqual(sept.body, { total: 4, noConectadas: 2, conectadas: 2 });
  const porMes = await request(app).get('/api/calidad/llamadas-salida/por-mes').query({ campana: 'MOBILIZE' }).set(auth(admin));
  assert.deepEqual(porMes.body.map((m) => [m.periodo, m.total, m.noConectadas, m.conectadas]), [['2026-09', 4, 2, 2], ['2026-10', 1, 0, 1]]);
  const detalle = await request(app).get('/api/calidad/llamadas-salida/detalle').query({ campana: 'MOBILIZE', desde: '2026-09-01', hasta: '2026-09-30' }).set(auth(admin));
  assert.equal(detalle.status, 200);
  assert.deepEqual(detalle.body.porAsesor.map((r) => [r.agente, r.total]), [['Asesor Dos', 2], ['Asesor Uno', 2]]);
  assert.deepEqual(detalle.body.porDia.map((r) => r.fecha), ['2026-09-01', '2026-09-15', '2026-09-30']);

  const todo = JSON.stringify([impacto.body, c1.body, resumen.body, porMes.body, detalle.body, db.prepare('SELECT * FROM llamadas_salida').all()]);
  assert.ok(!todo.includes(CENTINELA_TEL), 'el telefono nunca llega ni a la base ni a las respuestas');
});

test('API: una fila con un 5to elemento (telefono colado) se rechaza con 400', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const res = await request(app).post('/api/calidad/llamadas-salida/carga').set(auth(admin))
    .send({ campana: 'MOBILIZE', filas: [['Asesor X', '2026-09-02', 'CONECTADA', 'A', CENTINELA_TEL]] });
  assert.equal(res.status, 400);
  const mal = await request(app).post('/api/calidad/llamadas-salida/carga').set(auth(admin))
    .send({ campana: 'MOBILIZE', filas: [['Asesor X', '2026-09-02', 'ABANDONADA', 'A']] });
  assert.equal(mal.status, 400, 'tipo fuera de CONECTADA/NO_CONECTADA');
});

// Fase 147 ("OK nombres para cliente", pedido de Edwin): el cliente
// (CLIENTES_DASH) CON acceso a MOBILIZE ve y filtra por asesor. Antes esta
// prueba exigia lo contrario.
test('API: cliente de MOBILIZE (CLIENTES_DASH) ve la lista de asesores, filtra por asesor y ve el detalle; no puede cargar', async () => {
  const cli = await tokenFor('agomez', SEED.agomez);
  const op = await request(app).get('/api/calidad/llamadas-salida/opciones').query({ campana: 'MOBILIZE' }).set(auth(cli));
  assert.equal(op.status, 200);
  assert.ok(Array.isArray(op.body.meses));
  assert.ok(op.body.agentes.includes('Asesor Uno'), 'lista de asesores para el cliente de Mobilize');
  const porAgente = await request(app).get('/api/calidad/llamadas-salida/resumen').query({ campana: 'MOBILIZE', agente: 'Asesor Uno' }).set(auth(cli));
  assert.equal(porAgente.status, 200);
  const porMesAgente = await request(app).get('/api/calidad/llamadas-salida/por-mes').query({ campana: 'MOBILIZE', agente: 'Asesor Uno' }).set(auth(cli));
  assert.equal(porMesAgente.status, 200);
  const detalle = await request(app).get('/api/calidad/llamadas-salida/detalle').query({ campana: 'MOBILIZE' }).set(auth(cli));
  assert.equal(detalle.status, 200);
  assert.ok(detalle.body.porAsesor.some((r) => r.agente === 'Asesor Uno'));
  const carga = await request(app).post('/api/calidad/llamadas-salida/carga').set(auth(cli)).send({ campana: 'MOBILIZE', filas: filasSept() });
  assert.equal(carga.status, 403, 'sin permiso de Cargar Datos');
});

test('API: un cliente SIN acceso a MOBILIZE (solo ORLANT) no ve nada de Mobilize, y en ORLANT no ve nombres de asesor', async () => {
  // Cliente igual a agomez pero solo con ORLANT.
  const base = db.prepare("SELECT * FROM users WHERE user = 'agomez'").get();
  const perms = JSON.parse(base.perms);
  Object.keys(perms).forEach((k) => { if (/MOBILIZE/.test(k)) perms[k] = false; });
  const cols = Object.keys(base).filter((c) => c !== 'id');
  const fila = Object.assign({}, base, { user: 'cli_solo_orlant_f147', perms: JSON.stringify(perms) });
  db.prepare('DELETE FROM users WHERE user = ?').run('cli_solo_orlant_f147');
  db.prepare('INSERT INTO users (' + cols.join(',') + ') VALUES (' + cols.map((c) => '@' + c).join(',') + ')').run(fila);
  const cli = await tokenFor('cli_solo_orlant_f147', SEED.agomez);
  for (const ruta of ['opciones', 'resumen', 'por-mes', 'detalle']) {
    const r = await request(app).get('/api/calidad/llamadas-salida/' + ruta).query({ campana: 'MOBILIZE' }).set(auth(cli));
    assert.equal(r.status, 403, 'MOBILIZE ' + ruta);
    assert.ok(!JSON.stringify(r.body).includes('Asesor'));
  }
  const opO = await request(app).get('/api/calidad/llamadas-salida/opciones').query({ campana: 'ORLANT' }).set(auth(cli));
  assert.equal(opO.status, 200);
  assert.equal(opO.body.agentes, undefined, 'ORLANT no esta en la lista: el cliente no recibe nombres');
  const detO = await request(app).get('/api/calidad/llamadas-salida/detalle').query({ campana: 'ORLANT' }).set(auth(cli));
  assert.equal(detO.status, 403);
  const agO = await request(app).get('/api/calidad/llamadas-salida/resumen').query({ campana: 'ORLANT', agente: 'X' }).set(auth(cli));
  assert.equal(agO.status, 403);
  db.prepare('DELETE FROM users WHERE user = ?').run('cli_solo_orlant_f147');
});

test('API: filtro por Tipo (Conectada / No conectada) en la mitad de salida (Fase 147: el archivo no trae skill real)', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const todo = await request(app).get('/api/calidad/llamadas-salida/resumen').query({ campana: 'MOBILIZE' }).set(auth(admin));
  const con = await request(app).get('/api/calidad/llamadas-salida/resumen').query({ campana: 'MOBILIZE', tipo: 'CONECTADA' }).set(auth(admin));
  const sin = await request(app).get('/api/calidad/llamadas-salida/resumen').query({ campana: 'MOBILIZE', tipo: 'NO_CONECTADA' }).set(auth(admin));
  assert.equal(con.status, 200);
  assert.equal(con.body.noConectadas, 0);
  assert.equal(sin.body.conectadas, 0);
  assert.equal(con.body.total + sin.body.total, todo.body.total);
  const mal = await request(app).get('/api/calidad/llamadas-salida/resumen').query({ campana: 'MOBILIZE', tipo: 'OTRO' }).set(auth(admin));
  assert.equal(mal.status, 400);
});

test('API: rol interno con acceso ve la lista de asesores; sin acceso a la campana = 403', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const op = await request(app).get('/api/calidad/llamadas-salida/opciones').query({ campana: 'MOBILIZE' }).set(auth(admin));
  assert.ok(op.body.agentes.includes('Asesor Uno'));
  const inv = await tokenFor('mlopez', SEED.mlopez);
  for (const ruta of ['opciones', 'resumen', 'por-mes', 'detalle']) {
    const r = await request(app).get('/api/calidad/llamadas-salida/' + ruta).query({ campana: 'MOBILIZE' }).set(auth(inv));
    assert.equal(r.status, 403, ruta);
  }
});

// ── Plan de carga ─────────────────────────────────────────────────────────

test('Cargar Datos: el plan agrega la hoja "Llamadas de salida" solo cuando se pasan sus columnas (MOBILIZE)', () => {
  const cols = LLAMADAS_SALIDA_COLUMNAS.map((c) => ({ label: c.label, opcional: !c.obligatoria }));
  const args = [{}, null, null, null, null, null, null, null, null, null, undefined, null];
  const sin = cargasPlanConsolidado(...args, null);
  assert.ok(!sin.some((h) => h.tipo === 'llamadas_salida'));
  const con = cargasPlanConsolidado(...args, cols);
  const slot = con.find((h) => h.tipo === 'llamadas_salida');
  assert.ok(slot);
  assert.equal(slot.hoja, 'LLAMADAS_SALIDA');
  assert.equal(slot.titulo, 'Llamadas de salida');
});

// ── Panel ─────────────────────────────────────────────────────────────────

const PANEL_JS = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'llamadas-unicas.js'), 'utf8');

function escHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function renderPanel({ rol, respuestas, campana = 'MOBILIZE' }) {
  const elementos = {};
  const pedidos = [];
  const sandbox = {
    document: { getElementById: (id) => (elementos[id] = elementos[id] || { id, innerHTML: '', value: '', dataset: {} }) },
    apiRequest: async (m, url) => {
      pedidos.push(url);
      const clave = Object.keys(respuestas).find((k) => url.indexOf(k) !== -1);
      if (!clave) throw new Error('sin respuesta para ' + url);
      return respuestas[clave];
    },
    currentUser: { rol },
    _gd: { cliente: 'MOBILIZE' },
    _gdChart: () => {},
    esc: escHtml,
    textoFormatoNombre: (v) => v,
    canLoadData: () => rol === 'ADMIN',
    LLAMADAS_UNICAS_SKILL_ABANDONADA_ETIQUETA: 'Abandonadas',
    encodeURIComponent,
  };
  vm.createContext(sandbox);
  vm.runInContext(PANEL_JS, sandbox);
  await sandbox._llamadasUnicasRenderPanel({ campana }, 7);
  return { html: elementos['gd-p7'].innerHTML, ingreso: elementos['lu-ing-7'].innerHTML, salida: elementos['ls-sal-7'].innerHTML, elementos, pedidos };
}

const CON_DATOS = {
  '/llamadas-unicas/opciones': { meses: ['2026-09'], agentes: ['Asesor Uno'], skills: ['SKILL SAC'] },
  '/llamadas-unicas/resumen': { contestadas: 88, abandonadas: 0, total: 88 },
  '/llamadas-unicas/por-mes': [{ periodo: '2026-09', contestadas: 88, abandonadas: 0, total: 88 }],
  '/llamadas-salida/opciones': { meses: ['2026-09'], agentes: ['Asesor Uno'] },
  '/llamadas-salida/resumen': { total: 111, noConectadas: 52, conectadas: 59 },
  '/llamadas-salida/por-mes': [{ periodo: '2026-09', total: 111, noConectadas: 52, conectadas: 59 }],
  '/llamadas-salida/detalle': { porAsesor: [{ agente: 'Asesor Uno', total: 111, noConectadas: 52, conectadas: 59 }], porDia: [{ fecha: '2026-09-01', total: 5, noConectadas: 2, conectadas: 3 }] },
};

function etiquetasKpi(html) {
  return Array.from(html.matchAll(/<div class="kv">([^<]*)<\/div><div class="kl">([^<]*)<\/div>/g)).map((m) => [m[1], m[2]]);
}

test('Panel: 2 mitades (ingreso izquierda, salida derecha) en .aurora-grid-2.lu-mitades, cada una con su titulo', async () => {
  const r = await renderPanel({ rol: 'ADMIN', respuestas: CON_DATOS });
  assert.match(r.html, /<div class="aurora-grid-2 lu-mitades"><div class="aurora-card" id="lu-ing-7"><\/div><div class="aurora-card" id="ls-sal-7"><\/div><\/div>/);
  assert.match(r.ingreso, /Llamadas de ingreso únicas/);
  assert.match(r.salida, /Llamadas de salida/);
});

test('Panel: tarjetas en el orden pedido (ingreso: total/contestadas/abandonadas; salida: total/no conectadas/conectadas)', async () => {
  const r = await renderPanel({ rol: 'ADMIN', respuestas: CON_DATOS });
  assert.deepEqual(etiquetasKpi(r.elementos['lu-kpis-7'].innerHTML), [['88', 'Total únicas'], ['88', 'Contestadas únicas'], ['0', 'Abandonadas únicas']]);
  assert.deepEqual(etiquetasKpi(r.elementos['ls-kpis-7'].innerHTML), [
    ['111', 'Total llamadas de salida'], ['52', 'Llamadas de salida no conectadas'], ['59', 'Llamadas de salida conectadas'],
  ]);
});

test('Panel: rol interno ve filtro Asesor y detalle por asesor/dia en la mitad de salida', async () => {
  const r = await renderPanel({ rol: 'ADMIN', respuestas: CON_DATOS });
  assert.match(r.salida, /id="ls-f-agente-7"/);
  assert.match(r.elementos['ls-detalle-7'].innerHTML, /Detalle por asesor[\s\S]*Asesor Uno[\s\S]*Detalle por día[\s\S]*01\/09\/26/);
});

// Fase 147: el cliente de MOBILIZE ve el filtro Asesor en las dos mitades y
// el detalle; el cliente de otra campaña no (lista cerrada, igual que el
// servidor). La mitad de salida tiene ademas el filtro Tipo.
test('Panel: cliente de MOBILIZE ve filtro Asesor en las 2 mitades, filtro Tipo y el detalle', async () => {
  const r = await renderPanel({ rol: 'CLIENTES_DASH', respuestas: CON_DATOS });
  assert.match(r.ingreso, /id="lu-f-agente-7"/);
  assert.match(r.salida, /id="ls-f-agente-7"/);
  assert.match(r.salida, /id="ls-f-tipo-7"[\s\S]*Conectada[\s\S]*No conectada/);
  assert.ok(r.pedidos.some((u) => u.indexOf('/detalle') !== -1));
  assert.match(r.elementos['ls-detalle-7'].innerHTML, /Detalle por asesor/);
});

test('Panel: cliente de OTRA campaña no ve filtro Asesor, no pide /detalle y no recibe ningun nombre', async () => {
  const r = await renderPanel({ rol: 'CLIENTES_DASH', respuestas: CON_DATOS, campana: 'ORLANT' });
  assert.ok(!/ls-f-agente|lu-f-agente/.test(r.ingreso + r.salida));
  assert.ok(!r.pedidos.some((u) => u.indexOf('/detalle') !== -1));
  assert.equal(r.elementos['ls-detalle-7'].innerHTML, '');
});

test('Panel: sin datos de salida -> estado vacio claro en la mitad derecha, sin cifras; la izquierda sigue normal', async () => {
  const resp = Object.assign({}, CON_DATOS, { '/llamadas-salida/opciones': { meses: [] } });
  const r = await renderPanel({ rol: 'CLIENTES_DASH', respuestas: resp });
  assert.match(r.salida, /Sin llamadas de salida cargadas todavía\./);
  assert.ok(!/aurora-kpi/.test(r.salida));
  assert.ok(!r.pedidos.some((u) => u.indexOf('/llamadas-salida/resumen') !== -1));
  assert.deepEqual(etiquetasKpi(r.elementos['lu-kpis-7'].innerHTML)[0], ['88', 'Total únicas']);
});
