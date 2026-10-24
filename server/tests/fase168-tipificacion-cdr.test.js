// fase168-tipificacion-cdr.test.js — Fase 168 (reunion con Edwin del
// 23/10/2026): ORLANT actualiza Tipificacion con solo los 2 CDR de Wolkvox.
//   - WhatsApp: el HistChat nuevo trae SKILL_ID (numerico) y NO SKILL_NAME;
//     el nombre sale del mapa codigo -> nombre por cliente (tabla
//     skills_whatsapp, semilla de ORLANT, editable por un admin). SKILL_ID 0 =
//     WhatsApp de SALIDA; uno fuera del mapa se ignora con UN aviso agrupado.
//   - Llamadas: SKILL "-" = LLAMADAS DE SALIDA (no las internalcall* ni las
//     filas sin tipo).
//   - Vista de ORLANT: Llamadas y WhatsApp lado a lado, sin tabla de detalle.
// Todo SINTETICO (nunca datos reales).
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const T = require('../../public/js/tipificacion-logic.js');
const CL = require('../../public/js/cargas-logic.js');
const { SEMILLA_ORLANT } = require('../skills-whatsapp');
const { CONFIGS } = require('../dashboard-config-seed');
const { generarLayout, PERFILES_ACTUALES } = require('../plantillas-cliente');
const { request, app, tokenFor, MASTER_PASSWORD, SEED, db } = require('./helpers');

const RAIZ = path.join(__dirname, '..', '..');
const JS = (f) => fs.readFileSync(path.join(RAIZ, 'public', 'js', f), 'utf8');
const auth = (t) => ({ Authorization: `Bearer ${t}` });
const MAPA = Object.fromEntries(SEMILLA_ORLANT);

// Encabezados como los exports reales (mismas columnas, valores inventados).
const HISTCHAT = ['CONN_ID', 'CHANNEL', 'DATE', 'DATE_CLOSE', 'CUSTOMER_NAME', 'CUSTOMER_PHONE', 'AGENT_NAME', 'COD_ACT', 'DESCRIPTION_COD_ACT', 'COMMENTS', 'SKILL_ID'];
const chat = (skillId, fecha, asesor, tip) => ['c-' + Math.random(), 'whatsapp', fecha, fecha, 'Paciente Inventado', '3000000000', asesor || 'Asesor Uno', '1', tip || 'Agendamiento', 'texto', skillId];
const HISTCDR = ['AGENT_NAME', 'DATE', 'TELEPHONE', 'TIME_SEC', 'DESCRIPTION_COD_ACT', 'TYPE_INTERACTION', 'CONN_ID', 'SKILL_ID', 'SKILL_NAME', 'COMMENT'];
let n = 0;
// Fecha en texto: sin la hoja cruda (ws) el lector no recupera un Date; cada fila con su TIME_SEC propio (no son duplicados).
const llamada = (tipo, skillId, skillName) => ['Asesor Uno', '2026-09-02', '3000000000', 60 + n++, 'Agendada', tipo, 'x' + n, skillId, skillName, 'texto'];

// ── Reconocer el archivo ──────────────────────────────────────────────────

test('HistChat por SKILL_ID (sin SKILL_NAME) se reconoce como WHATSAPP; el HistCDR sigue siendo LLAMADAS', () => {
  assert.equal(CL.cargasEsHistChatPorSkillId(HISTCHAT), true);
  assert.equal(CL.cargasDetectarCanalTipificacion(HISTCHAT), 'WHATSAPP');
  assert.equal(CL.cargasDetectarCanalTipificacion(HISTCDR), 'LLAMADAS', 'el CDR de llamadas trae SKILL_NAME');
  assert.equal(CL.cargasEsHistChatPorSkillId(HISTCDR), false);
  // Formato anterior (NOMBRE DE SKILL) sigue igual.
  assert.equal(CL.cargasDetectarCanalTipificacion(['AGENT_NAME', 'DATE', 'DESCRIPTION_COD_ACT', 'NOMBRE DE SKILL']), 'WHATSAPP');
  // Sin una columna propia de los chats (CHANNEL, o CONN_ID + DATE_CLOSE) no se adivina.
  assert.equal(CL.cargasEsHistChatPorSkillId(['AGENT_NAME', 'DATE', 'DESCRIPTION_COD_ACT', 'SKILL_ID']), false);
  assert.equal(CL.cargasEsHistChatPorSkillId(['AGENT_NAME', 'DATE', 'DESCRIPTION_COD_ACT', 'SKILL_ID', 'CONN_ID', 'DATE_CLOSE']), true);
  assert.equal(CL.cargasDetectarCanalTipificacion(['AGENT_NAME', 'DATE', 'DESCRIPTION_COD_ACT', 'SKILL_ID']), null);
});

test('cargas.js: el slot de WhatsApp acepta el HistChat por SKILL_ID y le pasa el mapa de skills al lector', () => {
  const src = JS('cargas.js');
  assert.match(src, /!\(esTipificacion && h\.canalTipificacion==='WHATSAPP' && cargasEsHistChatPorSkillId\(headerRow0\)\)\) continue;/);
  assert.match(src, /apiRequest\('GET','\/calidad\/tipificacion\/skills-whatsapp\?campana='/);
  assert.match(src, /\{ skillsWhatsapp: _cargasSkillsWhatsappMapa \}/);
  assert.match(src, /extra = ' — de salida: '\+r\.salida\+\(r\.ignoradasPorSkill \? ', ignoradas por skill: '\+r\.ignoradasPorSkill : ''\);/);
});

// ── WhatsApp por SKILL_ID ─────────────────────────────────────────────────

test('WhatsApp: el skill sale del mapa; 0 = WhatsApp de SALIDA (outbound_ma), los demas de entrada', () => {
  const r = T.tipificacionParseFilas([HISTCHAT,
    chat('4327', '2026-09-01'), chat('0', '2026-09-01'), chat(4306, '2026-09-02'), chat('4338', '2026-09-03'),
  ], null, 'WHATSAPP', { skillsWhatsapp: MAPA });
  assert.equal(r.error, undefined);
  assert.deepEqual(r.filas.map((f) => [f.skill, f.skillId, f.tipoInteraccion]), [
    ['WHATSAPP GENERAL', '4327', 'inbound'],
    ['WHATSAPP DE SALIDA', '0', 'outbound_ma'],
    ['WHATSAPP 3P', '4306', 'inbound'],
    ['WHATSAPP CONFIRMACIONES', '4338', 'inbound'],
  ]);
  assert.equal(r.salida, 1);
  assert.equal(r.ignoradasPorSkill, 0);
  assert.deepEqual(r.avisos, []);
});

test('WhatsApp: SKILL_ID fuera del mapa se ignora con UN solo aviso agrupado (no uno por fila)', () => {
  const filas = [HISTCHAT];
  for (let k = 0; k < 40; k++) filas.push(chat(k % 2 ? '4323' : '4308', '2026-09-05'));
  filas.push(chat('4327', '2026-09-05'));
  const r = T.tipificacionParseFilas(filas, null, 'WHATSAPP', { skillsWhatsapp: MAPA });
  assert.equal(r.filas.length, 1);
  assert.equal(r.ignoradasPorSkill, 40);
  assert.equal(r.avisos.length, 1);
  assert.equal(r.avisos[0], '40 fila(s) con un SKILL_ID que no está en la tabla de skills de WhatsApp de este cliente, se ignoraron: 4308 (20), 4323 (20). Si alguno es de WhatsApp, agréguelo en "Skills de WhatsApp".');
});

test('WhatsApp: el mes sale de DATE -- filas del 31/08 en el archivo de septiembre se leen con su fecha real', () => {
  const r = T.tipificacionParseFilas([HISTCHAT, chat('4327', '2026-08-31'), chat('4327', '2026-09-01')], null, 'WHATSAPP', { skillsWhatsapp: MAPA });
  assert.deepEqual(r.filas.map((f) => f.fecha), ['2026-08-31', '2026-09-01']);
  assert.deepEqual(T.tipificacionRangoFechas(r.filas), { desde: '2026-08-31', hasta: '2026-09-01' });
});

test('WhatsApp por SKILL_ID sin mapa: error claro (nunca adivina el nombre); el formato anterior con NOMBRE DE SKILL sigue igual', () => {
  const e = T.tipificacionParseFilas([HISTCHAT, chat('4327', '2026-09-01')], null, 'WHATSAPP');
  assert.match(e.error, /trae SKILL_ID y no SKILL_NAME: falta la tabla de skills de WhatsApp/);
  const viejo = T.tipificacionParseFilas([['AGENT_NAME', 'DATE', 'DESCRIPTION_COD_ACT', 'NOMBRE DE SKILL'], ['Asesor Uno', '2026-09-01', 'Agendamiento', 'WHATSAPP GENERAL']], null, 'WHATSAPP');
  assert.deepEqual(viejo.filas.map((f) => [f.skill, f.tipoInteraccion]), [['WHATSAPP GENERAL', null]]);
  // Llamadas nunca usa el mapa: sin SKILL_NAME sigue faltando la columna.
  assert.match(T.tipificacionParseFilas([HISTCHAT, chat('4327', '2026-09-01')], null, 'LLAMADAS', { skillsWhatsapp: MAPA }).error, /Faltan columnas obligatorias: SKILL_NAME/);
});

test('privacidad: del HistChat no se lee nombre, telefono, comentarios ni CONN_ID', () => {
  const r = T.tipificacionParseFilas([HISTCHAT, chat('4327', '2026-09-01')], null, 'WHATSAPP', { skillsWhatsapp: MAPA });
  const fila = JSON.stringify(r.filas[0]);
  assert.doesNotMatch(fila, /Paciente Inventado|3000000000|texto|c-0\./);
  assert.deepEqual(T.tipificacionFilaComoArray(r.filas[0]).length, T.TIPIFICACION_ORDEN_ARRAY.length, 'CHANNEL no viaja al servidor');
});

// ── Llamadas: "-" = salida ────────────────────────────────────────────────

test('Llamadas: SKILL "-" = LLAMADAS DE SALIDA; internalcall* y filas sin tipo NO cuentan como salida', () => {
  const r = T.tipificacionParseFilas([HISTCDR,
    llamada('outbound_ma', '-', '-'), llamada('outbound_ma', '-', '-'),
    llamada('internalcall', '-', '-'), llamada('internalcall_inb', '-', '-'), llamada('-', '-', '-'),
    llamada('inbound', '4308', 'CALL INBOUND ORLANT 3P'), llamada('out_pre', '4070', 'CANCELACIONES Y REPROGRAMACION'),
  ], null, 'LLAMADAS');
  // Fase 174 (regla de Edwin): out_pre tambien es salida (antes quedaba en CANCELACIONES Y REPROGRAMACION).
  assert.deepEqual(r.filas.map((f) => f.skill), ['LLAMADAS DE SALIDA', 'LLAMADAS DE SALIDA', '-', '-', '-', 'CALL INBOUND ORLANT 3P', 'LLAMADAS DE SALIDA']);
  assert.equal(r.salida, 3, 'de salida = outbound_ma + out_pre');
  assert.equal(r.filas[6].skillId, '4070', 'el SKILL_ID original se conserva');
  // Formato viejo sin TYPE_INTERACTION: "-" queda tal cual.
  const viejo = T.tipificacionParseFilas([['AGENT_NAME', 'DATE', 'DESCRIPTION_COD_ACT', 'SKILL_NAME'], ['Asesor Uno', '2026-09-01', 'Agendada', '-']], null, 'LLAMADAS');
  assert.equal(viejo.filas[0].skill, '-');
});

test('etiquetas: los skills de salida se ven "Llamadas de salida" / "WhatsApp de salida"; el resto con la regla de siempre', () => {
  assert.equal(T.tipificacionEtiquetaSkill('LLAMADAS DE SALIDA'), 'Llamadas de salida');
  assert.equal(T.tipificacionEtiquetaSkill('WHATSAPP DE SALIDA'), 'WhatsApp de salida');
  assert.equal(T.tipificacionEtiquetaSkill('WHATSAPP 3P'), 'WhatsApp 3P');
});

// ── Mapa en la base: migracion y API ──────────────────────────────────────

test('migracion: tabla skills_whatsapp con la semilla de ORLANT (9), idempotente, sin pisar una edicion, con triggers de datos_version', () => {
  const filas = db.prepare("SELECT codigo, nombre FROM skills_whatsapp WHERE campana = 'ORLANT' ORDER BY CAST(codigo AS INTEGER)").all();
  assert.deepEqual(filas.map((f) => [f.codigo, f.nombre]), SEMILLA_ORLANT);
  db.prepare("UPDATE skills_whatsapp SET nombre = 'EDITADO' WHERE campana = 'ORLANT' AND codigo = '4042'").run();
  db.crearSkillsWhatsapp();
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM skills_whatsapp WHERE campana = 'ORLANT'").get().n, 9);
  assert.equal(db.prepare("SELECT nombre FROM skills_whatsapp WHERE campana = 'ORLANT' AND codigo = '4042'").get().nombre, 'EDITADO');
  db.prepare("UPDATE skills_whatsapp SET nombre = 'WHATSAPP PAUTAS' WHERE campana = 'ORLANT' AND codigo = '4042'").run();
  const triggers = db.prepare("SELECT name FROM sqlite_master WHERE type = 'trigger' AND tbl_name = 'skills_whatsapp'").all();
  assert.ok(triggers.length >= 3, 'insert/update/delete suben datos_version');
});

test('API: el admin lee y guarda el mapa; quien solo carga Tipificacion lo lee pero no lo cambia; sin permiso, 403', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const g = await request(app).get('/api/calidad/tipificacion/skills-whatsapp').query({ campana: 'ORLANT' }).set(auth(admin));
  assert.equal(g.status, 200, JSON.stringify(g.body));
  assert.deepEqual(g.body.skills.map((s) => s.codigo), SEMILLA_ORLANT.map((s) => s[0]));

  // CALIDAD con permiso de cargar Tipificacion: lee, no guarda.
  const fila = db.prepare("SELECT perms FROM users WHERE user = 'crodriguez'").get();
  const perms = JSON.parse(fila.perms);
  db.prepare("UPDATE users SET perms = ? WHERE user = 'crodriguez'").run(JSON.stringify({ ...perms, cargar_tipificacion: true }));
  const cal = await tokenFor('crodriguez', SEED.crodriguez);
  assert.equal((await request(app).get('/api/calidad/tipificacion/skills-whatsapp').query({ campana: 'ORLANT' }).set(auth(cal))).status, 200);
  assert.equal((await request(app).put('/api/calidad/tipificacion/skills-whatsapp').set(auth(cal)).send({ campana: 'ORLANT', skills: [] })).status, 403);
  db.prepare("UPDATE users SET perms = ? WHERE user = 'crodriguez'").run(fila.perms);

  // Sin permiso de carga (inventario): 403.
  const inv = await tokenFor('mlopez', SEED.mlopez);
  assert.equal((await request(app).get('/api/calidad/tipificacion/skills-whatsapp').query({ campana: 'ORLANT' }).set(auth(inv))).status, 403);

  // Guardar (admin): reemplaza la lista; codigos repetidos o no numericos = 400.
  const nuevo = SEMILLA_ORLANT.map(([codigo, nombre]) => ({ codigo, nombre })).concat([{ codigo: '4400', nombre: 'WHATSAPP NUEVO' }]);
  const p = await request(app).put('/api/calidad/tipificacion/skills-whatsapp').set(auth(admin)).send({ campana: 'ORLANT', skills: nuevo });
  assert.equal(p.status, 200, JSON.stringify(p.body));
  assert.equal(p.body.skills.length, 10);
  assert.equal((await request(app).put('/api/calidad/tipificacion/skills-whatsapp').set(auth(admin)).send({ campana: 'ORLANT', skills: [{ codigo: '1', nombre: 'A' }, { codigo: '1', nombre: 'B' }] })).status, 400);
  assert.equal((await request(app).put('/api/calidad/tipificacion/skills-whatsapp').set(auth(admin)).send({ campana: 'ORLANT', skills: [{ codigo: 'abc', nombre: 'A' }] })).status, 400);
  // Se deja como la semilla.
  await request(app).put('/api/calidad/tipificacion/skills-whatsapp').set(auth(admin)).send({ campana: 'ORLANT', skills: SEMILLA_ORLANT.map(([codigo, nombre]) => ({ codigo, nombre })) });
  const h = db.prepare("SELECT accion FROM historial WHERE accion = 'SKILLS_WHATSAPP_GUARDAR'").all();
  assert.ok(h.length >= 2, 'queda en el Historial');
});

// ── Reemplazo por fechas: nunca se borra el resto de agosto ───────────────

test('carga de WhatsApp de septiembre con filas del 31/08: reemplaza solo esas fechas, el resto de agosto queda', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const fila = (fecha, skill, skillId, tipo) => ['Asesor Uno', fecha, '09:00:00', null, 'Agendamiento', skill, null, null, tipo, null, skillId];
  const agosto = [];
  for (let d = 1; d <= 31; d++) agosto.push(fila('2026-08-' + String(d).padStart(2, '0'), 'WHATSAPP GENERAL', '4327', 'inbound'));
  let r = await request(app).post('/api/calidad/tipificacion/carga').set(auth(admin)).send({ campana: 'ORLANT', canal: 'WHATSAPP', filas: agosto });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const septiembre = [fila('2026-08-31', 'WHATSAPP 3P', '4306', 'inbound'), fila('2026-09-01', 'WHATSAPP DE SALIDA', '0', 'outbound_ma'), fila('2026-09-30', 'WHATSAPP GENERAL', '4327', 'inbound')];
  r = await request(app).post('/api/calidad/tipificacion/carga').set(auth(admin)).send({ campana: 'ORLANT', canal: 'WHATSAPP', filas: septiembre });
  assert.equal(r.status, 201);
  assert.equal(r.body.borradas, 1, 'solo el 31/08');
  const n = db.prepare("SELECT COUNT(*) AS n FROM tipificaciones WHERE campana='ORLANT' AND canal='WHATSAPP' AND fecha BETWEEN '2026-08-01' AND '2026-08-30'").get().n;
  assert.equal(n, 30, 'del 1 al 30 de agosto no se toca');
});

// ── Vista de ORLANT ───────────────────────────────────────────────────────

test('ORLANT: Tipificacion con Llamadas y WhatsApp lado a lado, sin tabla de detalle (seed, migracion y plantilla de layout)', () => {
  const panel = CONFIGS.find((c) => c.cliente === 'ORLANT').layout.tabs.find((t) => t.key === 'tipificacion').panels[0];
  assert.equal(panel.soloCanal, undefined, 'las 2 mitades');
  assert.equal(panel.mostrarTablaDetalle, undefined, 'sin la tabla de abajo');
  assert.equal(panel.mostrarFiltroTipo, true);
  const generado = generarLayout(PERFILES_ACTUALES.ORLANT).layout.tabs.find((t) => t.key === 'tipificacion').panels[0];
  assert.deepEqual(generado, panel);
  const mob = generarLayout(PERFILES_ACTUALES.MOBILIZE).layout.tabs.find((t) => t.key === 'tipificacion').panels[0];
  assert.equal(mob.soloCanal, 'LLAMADAS', 'Mobilize no cambia');
  // Migracion sobre la forma de la Fase 138 (la que tiene produccion).
  const row = db.prepare("SELECT layout FROM dashboards_config WHERE cliente = 'ORLANT'").get();
  const layout = JSON.parse(row.layout);
  layout.tabs.find((t) => t.key === 'tipificacion').panels = [{ tipo: 'tipificacion_panel', titulo: 'Tipificación', campana: 'ORLANT', soloCanal: 'LLAMADAS', mostrarFiltroTipo: true, mostrarTablaDetalle: true, mostrarTarjetasSalida: true }];
  db.prepare("UPDATE dashboards_config SET layout = ? WHERE cliente = 'ORLANT'").run(JSON.stringify(layout));
  db.migrarOrlantTipificacionDosCanales();
  const despues = JSON.parse(db.prepare("SELECT layout FROM dashboards_config WHERE cliente = 'ORLANT'").get().layout);
  assert.deepEqual(despues.tabs.find((t) => t.key === 'tipificacion').panels, [panel]);
  // Si un admin lo edito a mano, no se pisa.
  despues.tabs.find((t) => t.key === 'tipificacion').panels[0].titulo = 'Editado';
  db.prepare("UPDATE dashboards_config SET layout = ? WHERE cliente = 'ORLANT'").run(JSON.stringify(despues));
  db.migrarOrlantTipificacionDosCanales();
  assert.equal(JSON.parse(db.prepare("SELECT layout FROM dashboards_config WHERE cliente = 'ORLANT'").get().layout).tabs.find((t) => t.key === 'tipificacion').panels[0].titulo, 'Editado');
});

test('tipificacion.js: tarjetas de salida solo en la mitad de Llamadas; el filtro de skill usa la etiqueta de salida', () => {
  const src = JS('tipificacion.js');
  assert.match(src, /if\(p\.mostrarTarjetasSalida && c\.canal === 'LLAMADAS'\)\{/);
  assert.match(src, /if\(p\.mostrarTarjetasSalida && canal === 'LLAMADAS'\)\{/);
  assert.match(src, /_tipificacionOptionsHtml\(op\.skills, estadoCanal\.skill, tipificacionEtiquetaSkill\)/);
});
