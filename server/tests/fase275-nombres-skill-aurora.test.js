// fase275-nombres-skill-aurora.test.js — Fase 275 (pedido de Edwin, 06/11):
// en Clinica Aurora, Tipificacion de WhatsApp, el filtro COLA muestra el nombre
// de los skills conocidos (4019, 4062, 4063) en vez de "Skill <ID>". Solo cambia
// el texto: lo guardado, el valor del filtro y los conteos siguen iguales.
// Todo SINTETICO (asesores y chats inventados).
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const T = require('../../public/js/tipificacion-logic.js');
const { cargarTipificaciones, tipificacionesPorTipo } = require('../tipificaciones');
const { db } = require('./helpers');

const AURORA = 'CLINICA AURORA';
const MAPA_AURORA = { 0: 'WHATSAPP DE SALIDA' }; // lo que tiene Aurora en skills_whatsapp (Fase 220)
const H = ['CONN_ID', 'CHANNEL', 'DATE', 'DATE_CLOSE', 'AGENT_NAME', 'DESCRIPTION_COD_ACT', 'SKILL_ID'];
const TIPOS = ['AGENDADA', 'INFORMACION', 'CONFIRMADA', 'REPROGRAMADA'];
function chats(n, skillId, dia) {
  return Array.from({ length: n }, (_, k) => ['C' + skillId + dia + k, 'whatsapp', '2026-10-' + dia + ' 09:' + String(10 + (k % 40)).padStart(2, '0') + ':00',
    '2026-10-' + dia + ' 10:00:00', 'ASESORA ' + (k % 4), TIPOS[k % TIPOS.length], skillId]);
}
// Octubre de mentiras: 3 skills conocidos, 2 desconocidos y la salida (0).
const CANTIDAD = { 4019: 23, 4062: 11, 4063: 7, 4166: 5, 4169: 3, 0: 9 };
const ARCHIVO = [H, ...Object.entries(CANTIDAD).flatMap(([id, n], j) => chats(n, id, String(10 + j)))];

// _tipificacionOptionsHtml REAL (public/js/tipificacion.js), con esc() de la plataforma.
function opcionesHtml(valores, etiqueta) {
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'tipificacion.js'), 'utf8');
  const ini = src.indexOf('function _tipificacionOptionsHtml(');
  const fn = src.slice(ini, src.indexOf('\n}\n', ini) + 2);
  const ctx = { textoFormatoNombre: (s) => s, esc: (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;') };
  vm.createContext(ctx);
  vm.runInContext(fn, ctx);
  return ctx._tipificacionOptionsHtml(valores, '', etiqueta);
}
const opciones = (html) => [...html.matchAll(/<option value="([^"]*)"[^>]*>([^<]*)<\/option>/g)].map((m) => ({ valor: m[1], texto: m[2] }));

test('Aurora: los 3 skills conocidos con su nombre; los desconocidos y la salida como hoy', () => {
  const e = (v) => T.tipificacionEtiquetaSkill(v, AURORA);
  assert.equal(e('Skill 4019'), 'Whatsapp de entrada');
  assert.equal(e('Skill 4062'), 'Confirmaciones whatsapp');
  assert.equal(e('Skill 4063'), 'Recordaciones 3 dias');
  assert.equal(e('Skill 4166'), 'Skill 4166');
  assert.equal(e('Skill 4169'), 'Skill 4169');
  assert.equal(e('WHATSAPP DE SALIDA'), 'WhatsApp de salida', 'la salida (SKILL_ID 0) sigue igual');
  assert.equal(T.tipificacionEtiquetaSkill('Skill 4019', 'clinica aurora'), 'Whatsapp de entrada', 'el nombre del cliente sin importar mayusculas');
});

test('ORLANT, Mobilize, HLM y sin cliente: sin cambios (mismo texto que antes de la Fase 275)', () => {
  for (const camp of ['ORLANT', 'MOBILIZE', 'HOSPITAL LA MARIA', undefined]) {
    for (const v of ['Skill 4019', 'Skill 4062', 'Skill 4063', 'Skill 4166', 'WHATSAPP DE SALIDA', 'LLAMADAS DE SALIDA', 'AGENDAMIENTO ORLANT']) {
      assert.equal(T.tipificacionEtiquetaSkill(v, camp), T.tipificacionEtiquetaSkill(v), `${camp} ${v}`);
    }
  }
  assert.deepEqual(Object.keys(T.TIPIFICACION_NOMBRES_SKILL_CLIENTE), [AURORA], 'solo Aurora por ahora');
});

test('filtro Cola: el valor de cada opcion es el mismo de antes (lo que va al servidor); solo cambia el texto', () => {
  const r = T.tipificacionParseFilas(ARCHIVO, null, 'WHATSAPP', { skillsWhatsapp: MAPA_AURORA });
  assert.equal(r.error, undefined);
  const skills = [...new Set(r.filas.map((f) => f.skill))].sort();
  assert.deepEqual(skills, ['Skill 4019', 'Skill 4062', 'Skill 4063', 'Skill 4166', 'Skill 4169', 'WHATSAPP DE SALIDA'], 'lo guardado no cambia');
  const antes = opciones(opcionesHtml(skills, T.tipificacionEtiquetaSkill));
  const despues = opciones(opcionesHtml(skills, (v) => T.tipificacionEtiquetaSkill(v, AURORA)));
  assert.deepEqual(despues.map((o) => o.valor), antes.map((o) => o.valor), 'mismos valores, en el mismo orden');
  assert.deepEqual(despues.map((o) => o.texto), ['Todos', 'Whatsapp de entrada', 'Confirmaciones whatsapp', 'Recordaciones 3 dias', 'Skill 4166', 'Skill 4169', 'WhatsApp de salida']);
  assert.deepEqual(antes.map((o) => o.texto), ['Todos', 'Skill 4019', 'Skill 4062', 'Skill 4063', 'Skill 4166', 'Skill 4169', 'WhatsApp de salida']);
});

test('conteos: elegir cada opcion del filtro da exactamente lo mismo antes y despues (servidor real, base de prueba)', () => {
  const r = T.tipificacionParseFilas(ARCHIVO, null, 'WHATSAPP', { skillsWhatsapp: MAPA_AURORA });
  cargarTipificaciones(db, { campana: AURORA, canal: 'WHATSAPP', archivoNombre: 'sintetico.xlsx', cargadoPorNombre: 'test', filas: r.filas.map(T.tipificacionFilaComoArray) });
  const skills = [...new Set(r.filas.map((f) => f.skill))].sort();
  const contar = (skill) => tipificacionesPorTipo(db, { campana: AURORA, canal: 'WHATSAPP', mes: '2026-10', skill: skill || undefined });
  const antes = opciones(opcionesHtml(skills, T.tipificacionEtiquetaSkill)).map((o) => [o.valor, contar(o.valor)]);
  const despues = opciones(opcionesHtml(skills, (v) => T.tipificacionEtiquetaSkill(v, AURORA))).map((o) => [o.valor, contar(o.valor)]);
  assert.deepEqual(despues, antes, 'mismos conteos y mismas tipificaciones por opcion');
  const total = (v) => despues.find((x) => x[0] === v)[1].total;
  assert.equal(total(''), 58, 'Todos');
  assert.equal(total('Skill 4019'), 23);
  assert.equal(total('Skill 4062'), 11);
  assert.equal(total('Skill 4063'), 7);
  assert.equal(total('Skill 4166'), 5);
  assert.equal(total('Skill 4169'), 3);
  assert.equal(total('WHATSAPP DE SALIDA'), 9);
});

test('el filtro Cola del panel usa el nombre del cliente del panel', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'tipificacion.js'), 'utf8');
  assert.ok(src.includes('_tipificacionOptionsHtml(op.skills, estadoCanal.skill, function(v){ return tipificacionEtiquetaSkill(v, campana); })'));
});
