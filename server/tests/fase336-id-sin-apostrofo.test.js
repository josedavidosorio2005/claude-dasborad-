// fase336-id-sin-apostrofo.test.js — Fase 336: en Calidad de encuestas (Mobilize) el ID de la
// llamada se muestra y se copia sin el apostrofo inicial que trae Wolkvox; el dato guardado y el
// cruce (bloqueo, encuestaConnId) siguen con el valor original. Datos SINTETICOS.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const C = require('../../public/js/calidad-encuestas-logic.js');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');

const H = (t) => ({ Authorization: 'Bearer ' + t });
const PUB = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', f), 'utf8');
let admin;
before(async () => { admin = await tokenFor('admin', MASTER_PASSWORD); });

test('cenIdVisible: quita solo el apostrofo (o comilla tipografica) inicial', () => {
  assert.equal(C.cenIdVisible("'1111.2222.3333.1790000000.12345"), '1111.2222.3333.1790000000.12345');
  assert.equal(C.cenIdVisible("’ABC-1"), 'ABC-1');
  assert.equal(C.cenIdVisible("''ABC"), 'ABC');
  assert.equal(C.cenIdVisible("AB'C"), "AB'C", 'un apostrofo en medio se respeta');
  assert.equal(C.cenIdVisible('ABC'), 'ABC');
  assert.equal(C.cenIdVisible(null), '');
});

test('el dato guardado y el cruce no cambian: el bloqueo y el monitoreo usan el ID original', async () => {
  const id = "'9999.0000.1111.1790000000.42";
  const c = await request(app).post('/api/calidad/encuestas/carga').set(H(admin)).send({ campana: 'MOBILIZE', filas: [['2025-02-10', 'Asesor Ficticio', 'SKILL X', 1, null, null, null, '', id, '10:00']] });
  assert.equal(c.status, 201, JSON.stringify(c.body));
  assert.equal(db.prepare("SELECT connId FROM encuestas WHERE fecha = '2025-02-10'").get().connId, id, 'se guarda tal cual');
  const l = await request(app).get('/api/calidad/encuestas/monitoreo').query({ campana: 'MOBILIZE', meses: '2025-02' }).set(H(admin));
  assert.ok(l.body.filas.some((f) => f.connId === id), 'la API devuelve el original (el navegador lo limpia al mostrar)');
  assert.equal((await request(app).post('/api/calidad/encuestas/monitoreo/bloqueo').set(H(admin)).send({ campana: 'MOBILIZE', connId: id })).status, 200);
  await request(app).post('/api/calidad/encuestas/monitoreo/liberar').set(H(admin)).send({ campana: 'MOBILIZE', connId: id });
});

test('pantalla: lista, aviso del formulario y ventana «Monitoreo» muestran y copian el ID limpio; «Calificar» usa el original', () => {
  const js = PUB('calidad-encuestas.js');
  assert.ok(js.includes('var v = cenIdVisible(connId);'));
  assert.ok(js.includes(`<code>' + _cenEsc(v) + '</code><button type="button" class="btn-sm cen-copiar" data-conn="' + _cenEsc(v) + '"`));
  assert.ok(js.includes(`class="btn-primary btn-sm cen-abrir" data-conn="' + _cenEsc(f.connId) + '"`), 'abrir/bloquear con el original');
  assert.ok(PUB('encuesta-monitoreo.js').includes('esc(cenIdVisible(f.connId))'));
});
