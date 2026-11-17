// fase361-calidad-arreglos.test.js — Fase 361 (pendientes de la revisión del 13/11):
//  1) Portal del supervisor › Calidad: una campaña del registro SIN plantilla ya no abre el módulo
//     en otra campaña: su recuadro se ve, sin enlace, con «Sin plantilla de Calidad».
//  2) Una sola clave de nombre en Calidad (calClaveNombre, la de la Fase 353b): servidor («propios»
//     del evaluador) y navegador (resúmenes, listas y gráficas por asesor). SINTETICO.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');

const PUB = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'public', f), 'utf8');
const { calClaveNombre } = require('../../public/js/calidad-nombre-clave.js');
const enlace = require('../enlace-asesor');
const { caResumenAsesores, caResumenDescuento, caKpis } = require('../../public/js/calidad-analisis-logic.js');
const { ceKey } = require('../../public/js/calidad-equipo-logic.js');
const dash = require('../../public/js/calidad-dashboard-logic.js');

// ── 1) Recuadro sin plantilla ─────────────────────────────────────────────
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const tarjeta = () => {
  const ctx = {};
  const src = PUB('js/session.js');
  const ini = src.indexOf('function supervisorCampanaCardHtml');
  const fin = src.indexOf('function supervisorAbrirCalidad');
  new Function('esc', 'ctx', src.slice(ini, fin) + '; ctx.f = supervisorCampanaCardHtml;')(esc, ctx);
  return ctx.f;
};

test('1: sin plantilla, el recuadro se ve pero no es un enlace (ni clic, ni teclado, ni foco)', () => {
  const html = tarjeta()('CAMPANA <INVENTADA>', { meta: 24, realizados: 6, pct: 25 }, true);
  assert.match(html, /^<div class="cal-camp-card cal-camp-sin-plantilla" aria-disabled="true">/);
  assert.ok(html.includes('Sin plantilla de Calidad'));
  assert.ok(html.includes('CAMPANA &lt;INVENTADA&gt;') && !html.includes('<INVENTADA>'), 'nombre escapado');
  for (const no of ['onclick', 'onkeydown', 'role="button"', 'tabindex', 'Abrir Calidad', 'data-campana']) assert.ok(!html.includes(no), 'no debe llevar ' + no);
});

test('1: con plantilla, el recuadro sigue igual que en la Fase 352 C', () => {
  const html = tarjeta()('X', undefined);
  assert.match(html, /^<div class="cal-camp-card" role="button" tabindex="0" data-campana="X"/);
  assert.ok(html.includes('Abrir Calidad ›'));
});

test('1: el portal decide con las campañas que tienen plantilla (calCampanas) y el CSS marca el recuadro', () => {
  const src = PUB('js/session.js');
  const ini = src.indexOf('async function renderSupervisorMetaTable');
  const cuerpo = src.slice(ini, src.indexOf('function doLogout', ini));
  assert.ok(cuerpo.includes('calCampanas()'));
  assert.ok(cuerpo.includes('supervisorCampanaCardHtml(camp, null, true)'));
  const css = PUB('css/styles.css');
  assert.match(css, /\.cal-camp-card\.cal-camp-sin-plantilla\{cursor:default;/);
});

// ── 2) Una sola clave de nombre ───────────────────────────────────────────
test('2: calClaveNombre: mayúsculas con tilde y Ñ, espacios dobles/especiales/invisibles; las tildes cuentan', () => {
  assert.equal(calClaveNombre('  ÁNGELA  MUÑOZ​ '), 'ángela muñoz');
  assert.equal(calClaveNombre('Ana  Pérez'), 'ana pérez');
  assert.notEqual(calClaveNombre('Ángela'), calClaveNombre('Angela'), 'con y sin tilde no es el mismo nombre');
  assert.equal(calClaveNombre(null), '');
  assert.equal(enlace.claveNombre, calClaveNombre, 'el servidor usa la misma función');
});

test('2: ceKey ya no junta letras «s» (antes /s+/ sin barra) y une espacios dobles y guion bajo', () => {
  assert.equal(ceKey('JESSICA  ROSSI'), 'jessica rossi');
  assert.notEqual(ceKey('Jessica'), ceKey('Jesica'));
  assert.equal(ceKey('ana_maria  lopez'), 'ana maria lopez');
});

test('2: resúmenes del módulo: la misma persona con espacio doble o especial queda en UNA fila', () => {
  const mons = [
    { asesor: 'ÁNGELA MUÑOZ', puntaje: 100, fallos: 0 },
    { asesor: 'ángela  muñoz', puntaje: 80, fallos: 1 },
    { asesor: 'Ángela Muñoz ', puntaje: 90, fallos: 0 },
    { asesor: 'Otra Persona', puntaje: 50, fallos: 0 },
  ];
  const filas = caResumenAsesores(mons);
  assert.equal(filas.length, 2);
  assert.equal(filas[0].asesor, 'ÁNGELA MUÑOZ', 'se muestra el primer nombre visto');
  assert.equal(filas[0].monitoreos, 3);
  assert.equal(caKpis(mons).asesores, 2);
  assert.equal(caResumenDescuento(mons.map((m) => Object.assign({ engine: 'sura' }, m))).length, 2);
});

test('2: pestaña Calidad del tablero: gráficas y filtro por asesor con la misma clave', () => {
  const mons = [
    { asesor: 'ÁNGELA MUÑOZ', puntaje: 100 },
    { asesor: 'ángela  muñoz', puntaje: 80 },
    { asesor: 'Otra Persona', puntaje: 50 },
    { asesor: '', puntaje: 10 },
  ];
  assert.deepEqual(dash.calDashAsesoresDistintos(mons), ['Otra Persona', 'ÁNGELA MUÑOZ']);
  assert.deepEqual(dash.calDashPromedioPorAsesor(mons), [{ asesor: 'ÁNGELA MUÑOZ', promedio: 90 }, { asesor: 'Otra Persona', promedio: 50 }]);
  const vs = dash.calDashPuntajeVsEquipo(mons);
  assert.equal(vs.filas.length, 2);
  assert.deepEqual(vs.filas[0], { asesor: 'ÁNGELA MUÑOZ', promedio: 90, encima: true });
  assert.equal(dash.calDashFiltrarMonitoreos(mons, { asesores: ['ÁNGELA MUÑOZ'] }).length, 2, 'el filtro trae las dos escrituras');
});

test('2: index.html carga calidad-nombre-clave.js antes de los archivos que la usan', () => {
  const html = PUB('index.html');
  const i = html.indexOf('js/calidad-nombre-clave.js');
  assert.ok(i > 0);
  for (const f of ['js/calidad-dashboard-logic.js', 'js/calidad-analisis-logic.js', 'js/calidad-equipo-logic.js']) assert.ok(html.indexOf(f) > i, f);
});

// Servidor: «propios» del evaluador en monitoreos viejos sin id (comparación por nombre).
const H = (t) => ({ Authorization: 'Bearer ' + t });
const PW = 'Clave#Fase361x';
const hoy = new Date().toISOString().slice(0, 10);
let admin, cal, viejo;
before(async () => {
  admin = await tokenFor('admin', MASTER_PASSWORD);
  const r = await request(app).post('/api/users').set(H(admin)).send({ nombre: 'Ángela Ficticia Trescientos', user: 'cal361', password: PW, rol: 'CALIDAD', perms: { Calidad: true, campana_MOBILIZE: true } });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  cal = await tokenFor('cal361', PW);
  const m = await request(app).post('/api/monitoreos').set(H(admin)).send({ campana: 'MOBILIZE', asesor: 'Asesora Ficticia 361', fecha: hoy, canal: 'LLAMADA', answers: { 1: 'SI' } });
  assert.ok(m.body && m.body.id, JSON.stringify(m.body));
  viejo = m.body.id;
  // Como un monitoreo viejo: sin id de evaluador y el nombre en MAYÚSCULAS con tilde y espacio doble.
  db.prepare('UPDATE monitoreos SET evaluadorUserId = NULL, evaluador = ? WHERE id = ?').run('ÁNGELA  FICTICIA TRESCIENTOS ', viejo);
});

test('2: el rol CALIDAD ve como suyo el monitoreo viejo aunque su nombre venga en mayúsculas con tilde', async () => {
  const lista = await request(app).get('/api/monitoreos').query({ campana: 'MOBILIZE' }).set(H(cal));
  assert.equal(lista.status, 200);
  assert.deepEqual(lista.body.map((m) => m.id), [viejo]);
  const total = await request(app).get('/api/monitoreos/total').query({ campana: 'MOBILIZE' }).set(H(cal));
  assert.equal(total.status, 200);
  assert.equal(total.body.propios, 1);
});

test('2: lower() de SQLite no habría bastado (por eso nombre_clave)', () => {
  const r = db.prepare("SELECT lower(trim(?)) = lower(trim(?)) AS lower_ok, nombre_clave(?) = nombre_clave(?) AS clave_ok")
    .get('ÁNGELA  FICTICIA', 'Ángela Ficticia', 'ÁNGELA  FICTICIA', 'Ángela Ficticia');
  assert.equal(r.lower_ok, 0);
  assert.equal(r.clave_ok, 1);
});
