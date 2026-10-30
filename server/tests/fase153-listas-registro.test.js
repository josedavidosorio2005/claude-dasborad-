// fase153-listas-registro.test.js — Fase 153 (Paso 2): las listas por
// modulo (cargas, asesor visible, WhatsApp por rangos, logos) salen del
// registro de clientes. Sin cambio visible: ORLANT y MOBILIZE ven
// exactamente las mismas cargas y pantallas que antes.
'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { app, db, request, tokenFor, MASTER_PASSWORD, cleanup } = require('./helpers');
const reg = require('../clientes-registro');
const { REGISTRO_CLIENTES, derivarListasRegistro } = require('../../public/js/registro-clientes.js');

after(cleanup);

const PUB = path.join(__dirname, '..', '..', 'public');
const leer = (r) => fs.readFileSync(path.join(PUB, r), 'utf8');

// Las listas fijas tal como estaban antes de la Fase 153.
const ANTES = {
  traficoUnificado: ['ORLANT'], // CARGAS_CLIENTES_TRAFICO_UNIFICADO
  traficoWhatsapp: ['ORLANT'], // Fase 160: Trafico en 2 hojas por tener Flujo de WhatsApp
  tipificacionExtra: ['MOBILIZE'], // CARGAS_CLIENTES_TIPIFICACION_EXTRA
  llamadasUnicas: ['MOBILIZE'], // CARGAS_CLIENTES_LLAMADAS_UNICAS
  llamadasSalida: ['MOBILIZE'], // CARGAS_CLIENTES_LLAMADAS_SALIDA
  whatsappTiempos: ['ORLANT'], // CARGAS_CLIENTES_WHATSAPP_TIEMPOS y WPP_TIEMPOS_CAMPANAS
  calidadResumen: ['MOBILIZE'], // Fase 172
  flujoHora: ['MOBILIZE'], // Fase 196
  encuesta: ['MOBILIZE'], // CARGAS_CLIENTES_ENCUESTA
  asesorVisibleCliente: ['MOBILIZE'], // LU_CAMPANAS_ASESOR_VISIBLE_CLIENTE y CAMPANAS_ASESOR_VISIBLE_CLIENTE
  logos: {
    ORLANT: { src: 'img/clientes/orlant-logo.png', src2x: 'img/clientes/orlant-logo@2x.png', alt: 'Orlant', width: 92, height: 28, alto: 28, altoMovil: 22 }, // Fase 218
    MOBILIZE: { src: 'img/clientes/mobilize-logo.png', src2x: 'img/clientes/mobilize-logo@2x.png', alt: 'Mobilize', width: 140, height: 25 },
  },
  claseUltimaActualizacion: { MOBILIZE: 'gd-ultima-act-mobilize' },
};

test('el respaldo del navegador es igual a la semilla del servidor', () => {
  const servidor = reg.REGISTRO_INICIAL.map((c) => ({ nombre: c.nombre, modulos: c.modulos, parametros: c.parametros, logo: c.logo }));
  assert.deepEqual(JSON.parse(JSON.stringify(REGISTRO_CLIENTES)), servidor);
});

test('las listas derivadas del registro son IDENTICAS a las fijas de antes', () => {
  assert.deepEqual(JSON.parse(JSON.stringify(derivarListasRegistro(REGISTRO_CLIENTES))), ANTES);
  // Y con el registro real de la base (lo que recibe el navegador).
  // Fase 160: en la base tambien estan Aurora y HLM (Flujo de WhatsApp, sin el resto de ORLANT).
  const conBase = JSON.parse(JSON.stringify(derivarListasRegistro(reg.registroParaNavegador(db))));
  assert.deepEqual(conBase.traficoWhatsapp, ['ORLANT', 'CLINICA AURORA', 'HOSPITAL LA MARIA']);
  assert.deepEqual(Object.assign(conBase, { traficoWhatsapp: ['ORLANT'] }), ANTES);
});

test('servidor: el cliente solo ve nombres de asesor en las campanas marcadas', () => {
  assert.equal(reg.asesorVisibleCliente(db, 'MOBILIZE'), true);
  assert.equal(reg.asesorVisibleCliente(db, 'ORLANT'), false);
  assert.equal(reg.asesorVisibleCliente(db, 'NO EXISTE'), false);
  assert.doesNotMatch(fs.readFileSync(path.join(__dirname, '..', 'routes', 'llamadas-salida.js'), 'utf8'), /CAMPANAS_ASESOR_VISIBLE_CLIENTE = \[/);
});

test('GET /api/dashboard/clientes trae el registro (modulos, parametros, logo)', async () => {
  const t = await tokenFor('admin', MASTER_PASSWORD);
  const r = await request(app).get('/api/dashboard/clientes').set({ Authorization: 'Bearer ' + t });
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.registro.map((c) => c.nombre), ['ORLANT', 'MOBILIZE', 'CLINICA AURORA', 'HOSPITAL LA MARIA', 'SURA']); // Fase 153 (P3) + Fase 160 + Fase 215
  r.body.registro.forEach((c) => assert.deepEqual(Object.keys(c).sort(), ['logo', 'modulos', 'nombre', 'parametros']));
});

test('ya no quedan listas fijas por cliente en los archivos del navegador', () => {
  const js = ['cargas.js', 'llamadas-unicas.js', 'whatsapp-tiempos.js', 'dashboard-generic.js'].map((f) => leer('js/' + f)).join('\n');
  assert.doesNotMatch(js, /var (CARGAS_CLIENTES_\w+|LU_CAMPANAS_ASESOR_VISIBLE_CLIENTE|WPP_TIEMPOS_CAMPANAS) = \[/);
  assert.doesNotMatch(js, /'img\/clientes\//, 'las rutas de logos viven en el registro');
  assert.doesNotMatch(js, /_gd\.cliente === 'MOBILIZE' \? ' gd-ultima-act-mobilize'/);
  const core = leer('js/dashboards-core.js');
  assert.match(core, /aplicarRegistroClientes\(r\.registro\)/);
});

test('registro-clientes.js se carga despues de constants.js y antes de quien usa las listas', () => {
  const html = leer('index.html');
  const i = (s) => html.indexOf('<script src="js/' + s + '"></script>');
  assert.ok(i('registro-clientes.js') > i('constants.js'));
  for (const f of ['cargas.js', 'llamadas-unicas.js', 'whatsapp-tiempos.js', 'dashboard-generic.js', 'dashboards-core.js']) {
    assert.ok(i(f) > i('registro-clientes.js'), f);
  }
});

test('un cliente nuevo en el registro activa sus cargas solo por sus modulos (sin tocar codigo)', () => {
  const nuevo = { nombre: 'CLIENTE PRUEBA', modulos: ['flujo_llamadas', 'tipificacion', 'calidad', 'encuesta'], parametros: { sedes: [] }, logo: null };
  const l = derivarListasRegistro(REGISTRO_CLIENTES.concat([nuevo]));
  assert.deepEqual(l.tipificacionExtra, ['MOBILIZE', 'CLIENTE PRUEBA']);
  assert.deepEqual(l.encuesta, ['MOBILIZE', 'CLIENTE PRUEBA']);
  assert.deepEqual(l.llamadasUnicas, ['MOBILIZE']);
  assert.deepEqual(l.asesorVisibleCliente, ['MOBILIZE'], 'sin el parametro, el cliente no ve asesores');
  assert.equal(l.logos['CLIENTE PRUEBA'], undefined, 'sin logo: queda oculto');
});
