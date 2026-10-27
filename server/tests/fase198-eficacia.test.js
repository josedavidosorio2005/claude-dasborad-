// fase198-eficacia.test.js — Fase 198 (Mobilize): indicador "Eficacia" al
// lado del One & Done. Eficacia = contestadas de ingreso con codigo positivo /
// contestadas de ingreso del mes (CDR de Tipificacion). Datos SINTETICOS con
// la forma de octubre: 89 contestadas de ingreso, 31 "Agendamiento_de_
// mantenimientos" + 11 "Link_de_pagos" = 42 positivas -> 47,2 %.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
// helpers primero: arma el entorno de prueba antes de cargar el servidor.
const { request, app, tokenFor, MASTER_PASSWORD } = require('./helpers');
const E = require('../eficacia');
const { eficaciaNotaTexto } = require('../../public/js/eficacia.js');

const auth = (t) => ({ Authorization: `Bearer ${t}` });
const LISTA = E.EFICACIA_CODIGOS_POSITIVOS.MOBILIZE;

test('la lista vive en un solo lugar y tiene los 11 códigos de Kelly', () => {
  assert.equal(LISTA.length, 11);
  assert.ok(LISTA.includes('Agendamiento de mantenimientos') && LISTA.includes('Cómo realizar pagos'));
  const front = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'eficacia.js'), 'utf8');
  assert.ok(!front.includes('Acuerdos de pago'), 'el navegador no repite la lista');
});

test('comparación: sin tildes, sin mayúsculas, "_" como espacio y también con la letra acentuada borrada', () => {
  const casos = {
    Agendamiento_de_mantenimientos: 'Agendamiento de mantenimientos',
    LINK_DE_PAGOS: 'Link de pagos',
    Como_pagar_una_multa: 'Cómo pagar una multa',
    Cmo_pagar_una_multa: 'Cómo pagar una multa', // Wolkvox borra la "ó"
    Confirmacin_de_pago_realizado: 'Confirmación de pago realizado',
    'Solicitud  envio de  factura': 'Solicitud envío de factura',
    Otros_motivos: null,
    Preguntas_Frecuentes: null,
    TIMEOUTACW: null,
  };
  for (const [t, esperado] of Object.entries(casos)) assert.equal(E.eficaciaCodigoDe(t, LISTA), esperado, t);
});

test('API: octubre 42 de 89 = 47,2 %; la salida no cuenta; mes a mes', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const fila = (tip, skill, dia) => ['Asesor Uno', '2025-03-' + dia, '09:00:00', null, tip, skill, null, null, skill === '-' ? 'outbound_ma' : 'inbound', null, null];
  const veces = (n, tip, skill, dia) => Array.from({ length: n }, () => fila(tip, skill, dia || '03'));
  const marzo = [
    ...veces(31, 'Agendamiento_de_mantenimientos', 'SKILL SAC'),
    ...veces(11, 'Link_de_pagos', 'SKILL SAC'),
    ...veces(19, 'Otros_motivos', 'SKILL SAC'),
    ...veces(8, 'Preguntas_Frecuentes', 'SKILL SAC'),
    ...veces(18, 'TIMEOUTACW', 'SKILL SAC'),
    ...veces(2, 'Otros_motivos', 'Skill Key Account'),
    ...veces(45, 'Link_de_pagos', '-'), // salida: no cuenta ni arriba ni abajo
  ];
  const abril = [...veces(3, 'Felicitaciones', 'SKILL SAC', '05'), ...veces(1, 'Otros_motivos', 'SKILL SAC', '05')].map((f) => { f[1] = '2025-04-05'; return f; });
  for (const filas of [marzo, abril]) {
    const r = await request(app).post('/api/calidad/tipificacion/carga').set(auth(admin)).send({ campana: 'MOBILIZE', canal: 'LLAMADAS', archivoNombre: 'cdr.xlsx', filas });
    assert.equal(r.status, 201);
  }
  const res = (await request(app).get('/api/calidad/tipificacion/eficacia').query({ campana: 'MOBILIZE', desde: '2025-03-01', hasta: '2025-04-30' }).set(auth(admin))).body;
  assert.deepEqual(res.codigos, LISTA);
  assert.deepEqual(res.meses.map((m) => [m.periodo, m.positivas, m.contestadas, m.pct]), [['2025-03', 42, 89, 47.2], ['2025-04', 3, 4, 75]]);
  assert.deepEqual(res.meses[0].porCodigo, { 'Agendamiento de mantenimientos': 31, 'Link de pagos': 11 });
  const sinAcceso = await request(app).get('/api/calidad/tipificacion/eficacia').query({ campana: 'ORLANT' }).set(auth(admin));
  assert.deepEqual(sinAcceso.body, { codigos: null, meses: [] }, 'una campaña sin lista no tiene Eficacia');
});

test('pantalla: tarjeta al lado de One & Done, gráfica debajo y nota con la lista', () => {
  const s = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'trafico.js'), 'utf8');
  assert.ok(s.includes("<div class=\"oad-ef-fila\"><div id=\"'+prefijo+'-oad-kpi-'+i+'\" class=\"oad-ef-slot\"></div><div id=\"'+prefijo+'-ef-kpi-'+i+'\" class=\"oad-ef-slot\"></div></div>"));
  assert.ok(s.includes("_eficaciaDibujar(i, campana, estado.desde, estado.hasta)"));
  const nota = eficaciaNotaTexto(LISTA);
  assert.match(nota, /^Eficacia = llamadas contestadas de ingreso con un código positivo ÷ llamadas contestadas de ingreso del mes/);
  assert.ok(nota.includes('Acuerdos de pago; Confirmación de pago realizado') && nota.includes('"_" como espacio'));
});
