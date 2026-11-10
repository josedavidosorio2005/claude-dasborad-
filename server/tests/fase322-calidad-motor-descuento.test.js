// fase322-calidad-motor-descuento.test.js — Fase 322 (10/11/2026): motor «descuento» de
// Calidad (Televentas SURA, plan C1) con los porcentajes exactos del pedido, el importador,
// el formulario comun (nota en vivo = servidor), la cedula enmascarada y que los demas
// motores no cambian. Datos SINTETICOS (asesores, cedulas y textos inventados).
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const bcrypt = require('bcryptjs');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');
const calc = require('../calidad-logic');
const imp = require('../calidad-plantilla-import');
const C = require('../../public/js/calidad-calificar-logic.js');
const CA = require('../../public/js/calidad-analisis-logic.js');
const pub = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', f), 'utf8');
const H = (t) => ({ Authorization: 'Bearer ' + t });

// Archivo de plantilla como lo importa el administrador (formato del importador).
const ARCHIVO = {
  formato: 'inconexion-plantilla-calidad', version: 1, nombre: 'Televentas SURA', campana: 'SURA', motor: 'descuento',
  campos: ['asesor', 'idAgente', 'fecha', 'idLlamada', 'codificacion', 'evaluador', 'cedula', 'idContacto', 'tipificacionSistema', 'observaciones', 'estrategia', 'motivoTexto', 'causa'],
  // Fase 324: orden, nombres y opciones de la matriz oficial del supervisor (el calculo no cambia).
  items: [
    { n: 1, categoria: 'Criterios de calidad', nombre: 'Saludo y despedida', opciones: [{ texto: 'Cumple saludo y despedida', descuento: 0 }, { texto: 'No realiza saludo', descuento: 9 }, { texto: 'No realiza despedida', descuento: 6 }, { texto: 'No realiza saludo ni despedida', descuento: 15 }] },
    { n: 2, categoria: 'Criterios de calidad', nombre: 'Intencionalidad / Venta Consciente', critico: true },
    { n: 3, categoria: 'Criterios de calidad', nombre: 'Filtros obligatorios y perfilación', critico: true },
    { n: 4, categoria: 'Criterios de calidad', nombre: 'Amabilidad y trato hacia el cliente', critico: true },
    { n: 5, categoria: 'Criterios de calidad', nombre: 'Escucha y respuesta al cliente', descuento: 28 },
    { n: 6, categoria: 'Criterios de calidad', nombre: 'Expresión verbal, seguridad y confianza', descuento: 10 },
    { n: 7, categoria: 'Criterios de calidad', nombre: 'Conocimiento del producto', critico: true },
    { n: 8, categoria: 'Criterios de calidad', nombre: 'Tipificación', descuento: 30 },
    { n: 9, categoria: 'Criterios de calidad', nombre: 'Manejo de objeciones', opciones: [{ texto: 'Cumple manejo de objeciones', descuento: 0 }, { texto: 'Maneja 2 objeciones', descuento: 7 }, { texto: 'Maneja 1 objeción', descuento: 10 }, { texto: 'Sin manejo de objeciones', descuento: 12 }] },
  ],
};
const v = imp.validarPlantillaImport(ARCHIVO, { campanas: ['ORLANT', 'SURA'] });
const ITEMS = v.plantilla && v.plantilla.items;
const TODO = () => Object.fromEntries(ITEMS.map((it) => [it.n, 'SI']));
const nota = (cambios) => calc.computeScore(ITEMS, Object.assign(TODO(), cambios), 'descuento').puntaje;
// calComputeScore del navegador (calidad.js), aislado para compararlo con el servidor.
const calSrc = pub('calidad.js'); const i0 = calSrc.indexOf('function calComputeScore(');
const ctx = {}; vm.createContext(ctx); vm.runInContext(calSrc.slice(i0, calSrc.indexOf('\n}\n', i0) + 2), ctx);

test('importador: «Televentas SURA» con 9 ítems, 4 críticos, sin N/A, opciones SI/OP1..OP3, peor caso 5 %', () => {
  assert.ok(!v.error, v.error);
  assert.equal(v.plantilla.engine, 'descuento');
  assert.equal(ITEMS.length, 9); assert.equal(ITEMS.filter((i) => i.critico).length, 4);
  assert.ok(ITEMS.every((i) => i.admiteNA === false), 'sin N/A');
  assert.deepEqual(ITEMS[0].opciones.map((o) => [o.v, o.descuento]), [['SI', 0], ['OP1', 9], ['OP2', 6], ['OP3', 15]]);
  assert.deepEqual(ITEMS[8].opciones.map((o) => [o.v, o.descuento]), [['SI', 0], ['OP1', 7], ['OP2', 10], ['OP3', 12]]);
  assert.equal(v.resumen.peorSinCriticos, 5);
  const mal = (cambio, re) => assert.match(imp.validarPlantillaImport(Object.assign({}, ARCHIVO, cambio), { campanas: ['SURA'] }).error || '', re);
  mal({ items: [{ n: 1, nombre: 'X', opciones: [{ texto: 'A', descuento: 3 }, { texto: 'B', descuento: 5 }] }] }, /primera opción es la que cumple/);
  mal({ items: [{ n: 1, nombre: 'X' }] }, /falta el descuento del NO/);
});

test('motor descuento: los porcentajes exactos del pedido', () => {
  assert.equal(nota({}), 100, 'todo cumple');
  for (const n of [2, 3, 4, 7]) assert.equal(nota({ [n]: 'NO' }), 0, 'crítico ' + n + ' en NO -> 0 %');
  assert.equal(nota({ 2: 'NO', 5: 'NO' }), 0);
  assert.equal(nota({ 1: 'OP1' }), 91, 'no realiza saludo −9'); assert.equal(nota({ 1: 'OP2' }), 94, 'no realiza despedida −6'); assert.equal(nota({ 1: 'OP3' }), 85, 'ni saludo ni despedida −15');
  assert.equal(nota({ 5: 'NO' }), 72, 'escucha −28'); assert.equal(nota({ 6: 'NO' }), 90, 'expresión −10'); assert.equal(nota({ 8: 'NO' }), 70, 'tipificación −30');
  assert.equal(nota({ 9: 'OP1' }), 93, 'maneja 2 −7'); assert.equal(nota({ 9: 'OP2' }), 90, 'maneja 1 −10'); assert.equal(nota({ 9: 'OP3' }), 88, 'sin manejo −12');
  assert.equal(nota({ 1: 'OP3', 5: 'NO', 6: 'NO', 8: 'NO', 9: 'OP3' }), 5, 'peor sin fallar críticos = 5 %');
  const r = calc.computeScore(ITEMS, Object.assign(TODO(), { 7: 'NO' }), 'descuento');
  assert.equal(r.fallos, 1); assert.match(r.clasificacion, /CRITICO/);
  assert.match(calc.computeScore(ITEMS, Object.assign(TODO(), { 8: 'NO' }), 'descuento').clasificacion, /NO CRITICO/, '70 = No crítico');
  assert.match(calc.computeScore(ITEMS, Object.assign(TODO(), { 6: 'NO' }), 'descuento').clasificacion, /SOBRESALIENTE/, '90 = Sobresaliente');
  assert.match(calc.computeScore(ITEMS, Object.assign(TODO(), { 5: 'NO', 9: 'OP1' }), 'descuento').clasificacion, /🔴 CRITICO/, '65 = Crítico');
});

test('nota en vivo del formulario (cc2Nota) y la copia del navegador (calComputeScore) = servidor, en todas las combinaciones', () => {
  const resp = ITEMS.map((it) => C.cc2Opciones(it, 'descuento').map((o) => o.v));
  let total = 0;
  const rec = (k, a) => {
    if (k === ITEMS.length) {
      const s = calc.computeScore(ITEMS, a, 'descuento');
      assert.equal(C.cc2Nota(ITEMS, a, 'descuento'), s.puntaje, JSON.stringify(a));
      assert.equal(JSON.stringify(ctx.calComputeScore(ITEMS, a, 'descuento')), JSON.stringify(s)); // otro contexto vm: se compara el contenido
      total++; return;
    }
    for (const r of resp[k]) rec(k + 1, Object.assign({}, a, { [ITEMS[k].n]: r }));
  };
  rec(0, {});
  assert.equal(total, 2 ** 4 * 4 * 2 * 2 * 2 * 4, 'todas: 16 × 4 × 8 × 4');
  assert.equal(C.cc2Faltantes(ITEMS, Object.assign(TODO(), { 5: 'N/A' }), 'descuento').length, 1, 'N/A no vale');
  assert.deepEqual(C.cc2Opciones(ITEMS[4], 'descuento').map((o) => o.v), ['SI', 'NO'], 'sin N/A');
  assert.equal(C.cc2SubItem(ITEMS[1], 'descuento'), '⚠ Crítico · NO = nota 0 %');
  assert.equal(C.cc2SubItem(ITEMS[4], 'descuento'), 'NO = −28 %');
  assert.equal(C.cc2SubItem(ITEMS[0], 'descuento'), 'No realiza saludo −9 % · No realiza despedida −6 % · No realiza saludo ni despedida −15 %');
  assert.equal(C.cc2Motivo(ITEMS, Object.assign(TODO(), { 1: 'OP2', 8: 'NO' }), 'descuento'), '1. Saludo y despedida (No realiza despedida) · 8. Tipificación');
  assert.equal(C.cc2Alerta(1, 'descuento').t, 'Crítico en NO: nota 0 %');
  assert.equal(C.cc2Alerta(1).t, 'Alerta — 1 crítico', 'motor standard igual que antes');
});

test('diccionario: reglas del motor e impacto de cada respuesta', () => {
  const p = { engine: 'descuento', items: ITEMS };
  const reglas = CA.caReglasDiccionario(p);
  assert.ok(reglas.some((r) => /deja la nota en 0 %/.test(r)) && reglas.some((r) => /Peor nota sin fallar críticos: 5 %/.test(r)));
  assert.deepEqual(CA.caImpacto(ITEMS[0], 'descuento'), [['Cumple saludo y despedida', '0 %'], ['No realiza saludo', '−9 %'], ['No realiza despedida', '−6 %'], ['No realiza saludo ni despedida', '−15 %']]);
  assert.deepEqual(CA.caImpacto(ITEMS[1], 'descuento'), [['SI', '0 %'], ['NO', 'nota 0 %']]);
  assert.deepEqual(CA.caImpacto({ weight: 5, critico: false }), [['SI', '+5'], ['N/A', '+5'], ['NO', '0']], 'standard igual');
});

test('los motores standard y sura no cambian', () => {
  const it = [{ n: 1, weight: 40, critico: true }, { n: 2, weight: 60, critico: false }];
  assert.equal(calc.computeScore(it, { 1: 'NO', 2: 'SI' }, 'standard').puntaje, 80);
  assert.equal(calc.computeScore(it, { 1: 'SI', 2: 'N/A' }, 'standard').puntaje, 100);
  assert.equal(calc.computeScore(it, { 1: 'SI', 2: 'N/A' }, 'sura').puntaje, 40);
});

let admin, sup, cli, ases, idAses;
before(async () => {
  admin = await tokenFor('admin', MASTER_PASSWORD);
  const crear = (nombre, user, rol, perms, camp) => Number(db.prepare(`INSERT INTO users (nombre, user, rol, active, password_hash, perms, asesorCampana, createdAt, debe_cambiar_password) VALUES (?,?,?,1,?,?,?,?,0)`)
    .run(nombre, user, rol, bcrypt.hashSync('Clave#2026x', 4), JSON.stringify(perms), camp, new Date().toISOString()).lastInsertRowid);
  crear('Supervisor Ficticio 322', 'f322_sup', 'SUPERVISOR', { campana_SURA: true, ClientesDash: true, supervisa_SURA: true }, null);
  crear('Cliente Ficticio 322', 'f322_cli', 'CLIENTES_DASH', { ClientesDash: true, cliente_SURA: true }, null);
  idAses = crear('asesor_ficticio_322', 'Asesor_F_32201', 'ASESOR', {}, 'SURA');
  sup = await tokenFor('f322_sup', 'Clave#2026x'); cli = await tokenFor('f322_cli', 'Clave#2026x'); ases = await tokenFor('Asesor_F_32201', 'Clave#2026x');
});

test('servidor: importar en SURA, calificar con opciones, cédula enmascarada, respuestas inválidas 400, Mis resultados del asesor', async () => {
  const i = await request(app).post('/api/calidad/plantillas/importar').set(H(admin)).send({ archivo: ARCHIVO, confirmar: true, principal: true });
  assert.equal(i.status, 201, JSON.stringify(i.body));
  const base = { campana: 'SURA', asesor: 'asesor_ficticio_322', asesorUserId: idAses, fecha: new Date().toISOString().slice(0, 10), canal: 'LLAMADA', observaciones: 'Observación ficticia',
    extras: { cedula: '1.098.765.432', idContacto: 'C-1', estrategia: 'Estrategia ficticia', motivoTexto: 'Motivo ficticio', causa: 'Causa ficticia', idAgente: 'A-9' } };
  const m = await request(app).post('/api/monitoreos').set(H(sup)).send(Object.assign({}, base, { answers: Object.assign(TODO(), { 1: 'OP1', 9: 'OP3' }) }));
  assert.equal(m.status, 201, JSON.stringify(m.body));
  assert.equal(m.body.puntaje, 79, '100 − 9 − 12');
  const fila = db.prepare('SELECT extras FROM monitoreos WHERE id = ?').get(m.body.id);
  const ex = JSON.parse(fila.extras);
  assert.equal(ex.cedula, '••••5432', 'solo los últimos 4 dígitos');
  assert.ok(!fila.extras.includes('1098765432') && !fila.extras.includes('1.098.765.432'), 'nunca la cédula completa');
  assert.equal(ex.estrategia, 'Estrategia ficticia');
  const c0 = await request(app).post('/api/monitoreos').set(H(sup)).send(Object.assign({}, base, { answers: Object.assign(TODO(), { 3: 'NO' }) }));
  assert.equal(c0.body.puntaje, 0, 'crítico en NO');
  assert.equal((await request(app).post('/api/monitoreos').set(H(sup)).send(Object.assign({}, base, { answers: Object.assign(TODO(), { 6: 'OP1' }) }))).status, 400, 'opción en un ítem sin opciones');
  assert.equal((await request(app).post('/api/monitoreos').set(H(sup)).send(Object.assign({}, base, { answers: Object.assign(TODO(), { 6: 'N/A' }) }))).status, 400, 'sin N/A');
  assert.equal((await request(app).post('/api/monitoreos').set(H(sup)).send(Object.assign({}, base, { answers: Object.assign(TODO(), { 1: 'NO' }) }))).status, 400, 'en un ítem con opciones, NO no vale');
  const mios = await request(app).get('/api/monitoreos/mios').set(H(ases));
  assert.deepEqual(mios.body.map((x) => x.puntaje).sort(), [0, 79]);
  const lc = await request(app).get('/api/monitoreos?campana=SURA').set(H(cli));
  assert.equal(lc.status, 200);
  assert.ok(lc.body.every((x) => !x.extras || (x.extras.cedula === undefined && x.extras.estrategia === undefined && x.extras.motivoTexto === undefined)), 'la cuenta cliente no recibe cédula ni textos libres');
  assert.equal((await request(app).post('/api/monitoreos').set(H(sup)).send(Object.assign({}, base, { extras: { causa: 'llamar al 3001234567' }, answers: TODO() }))).status, 400, 'textos libres con el filtro de datos de pacientes');
});

test('front: botones por opción, subtítulos y nota en vivo según el motor; campos nuevos', () => {
  const src = pub('calidad-calificar.js');
  assert.doesNotThrow(() => new vm.Script(src));
  for (const f of ['calidad-calificar-logic.js', 'calidad.js', 'calidad-analisis-logic.js', 'calidad-analisis.js', 'calidad-panel.js', 'calidad-equipo-logic.js', 'mis-resultados.js']) assert.doesNotThrow(() => new vm.Script(pub(f)), f);
  assert.match(src, /cc2Opciones\(it, _cc2Eng\(\)\)/);
  assert.match(src, /var nota = cc2Nota\(p\.items, a, eng\);/);
  assert.match(src, /Se guarda solo con los últimos 4 dígitos\./);
  assert.match(src, /var CC2_EXTRAS = \['placa', 'tipoLlamada', 'idAgente', 'idContacto', 'tipificacionSistema', 'estrategia', 'causa', 'motivoTexto', 'cedula'\];/);
  assert.match(pub('calidad-equipo-logic.js'), /m === 'descuento' \? 'deduct'/);
});
