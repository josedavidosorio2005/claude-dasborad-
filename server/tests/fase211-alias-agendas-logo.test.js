// fase211-alias-agendas-logo.test.js — Fase 211 (28/10).
// 1) El alias de asesor (Fase 122) tambien se aplica AL CONSULTAR las agendas
//    del formato anterior: un alias creado despues de la carga cambia el
//    nombre de esos meses sin reescribir lo guardado, y el filtro Agente lo
//    sigue. La base cruda no cambia (su nombre sale de la lista de usuarios).
// 2) Logo de InConexion en la barra de todos los tableros, a la izquierda de
//    "Actualizar datos": blanco (la barra es --c-brand en los 2 temas), y en
//    el telefono solo el isotipo. Nombres SIEMPRE inventados.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { request, app, tokenFor, MASTER_PASSWORD, db } = require('./helpers');

const auth = (t) => ({ Authorization: `Bearer ${t}` });
const PUB = path.join(__dirname, '..', '..', 'public');

test('alias al consultar: ago/sep (formato anterior) salen con el nombre canonico, sin reescribir lo guardado', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const vieja = await request(app).post('/api/calidad/agendas/carga').set(auth(admin)).send({ campana: 'ORLANT', filas: [
    ['PERSONA VIEJA', 'S1', 'EX', 'ESP', 'PROF', '2026-08-05 08:00:00', 'GENERAL', 'EPS DEMO'],
    ['PERSONA VIEJA', 'S1', 'EX', 'ESP', 'PROF', '2026-09-05 08:00:00', '3P', 'EPS DEMO'],
    ['OTRA PERSONA', 'S1', 'EX', 'ESP', 'PROF', '2026-09-06 08:00:00', '3P', 'EPS DEMO'],
  ] });
  assert.equal(vieja.status, 201, JSON.stringify(vieja.body));
  // Octubre crudo: el usuario U3 ya es de la persona con el nombre nuevo.
  await request(app).put('/api/calidad/agendas/codigos-entidad').set(auth(admin)).send({ campana: 'ORLANT', codigos: [{ codigo: 'EPSG', linea: 'GENERAL' }] });
  await request(app).put('/api/calidad/agendas/usuarios').set(auth(admin)).send({ campana: 'ORLANT', usuarios: [{ usuario: 'U3', asesor: 'Persona Nombre Nuevo' }] });
  const cruda = await request(app).post('/api/calidad/agendas/carga').set(auth(admin)).send({ campana: 'ORLANT', formato: 'cruda', filas: [
    ['U3', 'S1', 'EX', 'ESP', 'PROF', '2026-10-02 09:00:00', 'EPSG', 'ENT'],
  ] });
  assert.equal(cruda.status, 201, JSON.stringify(cruda.body));
  const q = (ruta, extra) => request(app).get('/api/calidad/agendas/' + ruta).query({ campana: 'ORLANT', ...extra }).set(auth(admin));
  const total = async (asesor) => (await q('mensual', { asesor })).body.reduce((s, r) => s + r.cantidad, 0);

  assert.ok((await q('opciones')).body.asesores.includes('PERSONA VIEJA'));
  assert.equal(await total('Persona Nombre Nuevo'), 1);

  // Alias creado DESPUES de la carga: ago/sep pasan al nombre nuevo (con
  // mayusculas/tildes distintas en el alias, la comparacion es normalizada).
  const al = await request(app).post('/api/alias-asesores').set(auth(admin)).send({ campana: 'ORLANT', alias: 'persona  vieja', canonico: 'Persona Nombre Nuevo' });
  assert.equal(al.status, 201, JSON.stringify(al.body));
  const op = (await q('opciones')).body.asesores;
  assert.ok(!op.includes('PERSONA VIEJA'));
  assert.ok(op.includes('Persona Nombre Nuevo'));
  assert.ok(op.includes('OTRA PERSONA'));
  assert.equal(await total('Persona Nombre Nuevo'), 3); // ago 1 + sep 1 + oct 1
  assert.deepEqual((await q('mensual', { asesor: 'Persona Nombre Nuevo' })).body.map((r) => [r.mes, r.cantidad]), [['2026-08', 1], ['2026-09', 1], ['2026-10', 1]]);
  assert.equal(await total('PERSONA VIEJA'), 0);
  const rk = (await q('ranking', { mes: '2026-09' })).body.filas.map((f) => f.asesor).sort();
  assert.deepEqual(rk, ['OTRA PERSONA', 'Persona Nombre Nuevo']);
  // Lo guardado no cambia.
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM agendas WHERE asesor = 'PERSONA VIEJA'").get().n, 2);
  // Sin alias: vuelve el nombre guardado.
  await request(app).delete('/api/alias-asesores/' + al.body.id).set(auth(admin));
  assert.equal(await total('PERSONA VIEJA'), 2);
});

test('logo de InConexion en la barra de todos los tableros: a la izquierda de "Actualizar datos", blanco, isotipo en el telefono', () => {
  const html = fs.readFileSync(path.join(PUB, 'index.html'), 'utf8');
  const acciones = html.slice(html.indexOf('<div class="gd-header-acciones"'), html.indexOf('id="gd-cerrar-btn"'));
  const iLogo = acciones.indexOf('class="gd-marca-inconexion"');
  const iAct = acciones.indexOf('id="gd-actualizar-btn"');
  assert.ok(iLogo > -1 && iAct > -1 && iLogo < iAct, 'el logo va antes (a la izquierda) de Actualizar datos');
  assert.match(acciones, /class="gd-marca-logo" src="img\/marca\/logo-horizontal-blanco\.png"[^>]*alt="InConexion" width="110" height="22"/);
  assert.match(acciones, /class="gd-marca-isotipo" src="img\/marca\/isotipo-blanco\.png"[^>]*alt="InConexion" width="26" height="25"/);
  for (const f of ['logo-horizontal-blanco.png', 'logo-horizontal-blanco@2x.png', 'isotipo-blanco.png', 'isotipo-blanco@2x.png']) {
    assert.ok(fs.existsSync(path.join(PUB, 'img', 'marca', f)), f);
  }
  // El logo del cliente no cambia.
  assert.match(html, /<img id="gd-cliente-logo" class="gd-cliente-logo"/);
  const css = fs.readFileSync(path.join(PUB, 'css', 'styles.css'), 'utf8');
  assert.match(css, /\.gd-marca-isotipo\{display:none !important;/);
  assert.match(css, /@media\(max-width:480px\)\{\n  #gd-modal \.gd-marca-logo\{display:none !important;\}\n  #gd-modal \.gd-marca-isotipo\{display:block !important;\}/);
  // La barra es --c-brand en los 2 temas (por eso el logo blanco sirve en los 2).
  const oscuro = css.slice(css.indexOf(':root[data-theme="dark"]{'), css.indexOf('}', css.indexOf(':root[data-theme="dark"]{')));
  assert.ok(!/--c-brand:/.test(oscuro));
});
