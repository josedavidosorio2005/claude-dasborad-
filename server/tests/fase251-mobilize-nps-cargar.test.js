// fase251-mobilize-nps-cargar.test.js — Fase 251 (pedidos de Edwin, 04/11, solo
// Mobilize):
//  1. NPS: debajo del numero quedan el titulo con el valor y la linea de la
//     formula; sin el detalle de promotores/pasivos/detractores ni la nota.
//  2. Cargar datos: sin "Calidad" (monitoreos por Excel) ni "Tipificacion de
//     WhatsApp". Solo se dejan de mostrar: los datos y tablas siguen, y el
//     aviso "Falta <mes>" ya no los cuenta. Otros clientes igual.
// Datos sinteticos.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { db } = require('./helpers');
const CC = require('../centro-cargas');
const { CATALOGO } = require('../plantillas-cliente');

const JS = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', f), 'utf8');

test('NPS: solo el valor y la formula', () => {
  const ctx = { esc: (s) => String(s), console };
  vm.createContext(ctx);
  vm.runInContext(JS('encuesta-logic.js') + '\n' + JS('encuesta.js'), ctx);
  const V = Array.from({ length: 11 }, (_, v) => ({ valor: v, cantidad: { 0: 3, 6: 9, 8: 3, 9: 10, 10: 21 }[v] || 0 }));
  const html = ctx._encuestaNpsHtml(ctx.encuestaNps({ valores: V }));
  const txt = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  assert.equal(txt, 'NPS (promotores − detractores) 41,3 NPS = 67,4 % de promotores − 26,1 % de detractores = 41,3');
  assert.doesNotMatch(html, /enc-nps-detalle|enc-nps-nota|pasivos/);
  // sin respuestas: el aviso de siempre
  assert.match(ctx._encuestaNpsHtml(ctx.encuestaNps({ valores: [] })), /Nadie contestó la pregunta 1/);
});

test('Cargar datos de Mobilize: sin Calidad vieja ni Tipificacion de WhatsApp; ORLANT, Aurora y HLM igual', () => {
  const mob = CC.resumenCliente(db, 'MOBILIZE', 2026, CATALOGO);
  assert.ok(!mob.some((m) => m.id === 'calidad'), 'sin la seccion Calidad vieja');
  // Fase 339 (pedido de Edwin): tampoco «Calidad: resumen por asesor» (Calidad se hace en la plataforma).
  assert.ok(!mob.some((m) => m.id === 'calidad_resumen'), 'sin Calidad: resumen por asesor');
  assert.deepEqual(mob.find((m) => m.id === 'tipificacion').cargas.map((c) => c.id), ['tipificacion_llamadas']);
  for (const cli of ['ORLANT', 'CLINICA AURORA', 'HOSPITAL LA MARIA']) {
    const mods = CC.resumenCliente(db, cli, 2026, CATALOGO);
    if (!mods) continue;
    const tip = mods.find((m) => m.id === 'tipificacion');
    if (tip) assert.deepEqual(tip.cargas.map((c) => c.id), ['tipificacion_llamadas', 'tipificacion_whatsapp'], cli);
    if (cli === 'ORLANT') assert.ok(mods.some((m) => m.id === 'calidad'), 'ORLANT sigue con Calidad');
  }
});

test('ocultar no borra: los datos siguen y se pueden descargar; el aviso "Falta <mes>" ya no los cuenta', () => {
  const ins = db.prepare(`INSERT INTO tipificaciones (campana, canal, agente, fecha, tipificacion, skill, archivoNombre, cargadoPorNombre, createdAt)
    VALUES ('MOBILIZE', 'WHATSAPP', 'Asesor Sintetico 251', '2026-08-05', 'Consulta', 'SKILL', 'sint.xlsx', 'Persona S', '2026-09-02T10:00:00Z')`);
  ins.run();
  try {
    const carga = CC.cargaPorId('tipificacion_whatsapp');
    assert.ok(carga, 'la carga sigue existiendo');
    assert.equal(CC.cargaRetiradaPara('MOBILIZE', carga), true);
    assert.equal(CC.cargaRetiradaPara('ORLANT', carga), false);
    const n = db.prepare("SELECT COUNT(*) AS n FROM tipificaciones WHERE campana = 'MOBILIZE' AND canal = 'WHATSAPP' AND agente = 'Asesor Sintetico 251'").get().n;
    assert.equal(n, 1);
    // el Centro calcula "Falta <mes>" solo con las cargas que recibe del servidor
    const tip = CC.resumenCliente(db, 'MOBILIZE', 2026, CATALOGO).find((m) => m.id === 'tipificacion');
    assert.ok(tip.cargas.every((c) => c.id !== 'tipificacion_whatsapp'));
    assert.match(JS('centro-cargas.js'), /var alDia = m\.cargas\.every\(/);
  } finally {
    db.prepare("DELETE FROM tipificaciones WHERE agente = 'Asesor Sintetico 251'").run();
  }
  assert.deepEqual(CC.CARGAS_RETIRADAS_POR_CLIENTE.MOBILIZE, ['calidad', 'tipificacion_whatsapp', 'calidad_resumen']); // Fase 339
});
