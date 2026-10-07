// Fase 130 (Parte 7): el limite general de /api ahora tiene DOS cupos
// separados -- por IP para quien no tiene sesion, por USUARIO para quien
// si la tiene. Baja ambos ANTES de cargar helpers/config para poder
// agotarlos en pocas peticiones.
process.env.RATE_LIMIT_MAX = '2'; // anonimo, por IP
process.env.RATE_LIMIT_MAX_AUTENTICADO = '4'; // autenticado, por usuario
process.env.RATE_LIMIT_WINDOW_MS = String(60 * 1000);
process.env.LOGIN_RATE_LIMIT_MAX = '10000'; // no interfiere con este test

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, tokenFor, SEED } = require('./helpers');

test('autenticado por usuario no comparte cupo con el limite anonimo por IP', async () => {
  // 2 logins (peticiones SIN sesion todavia) ya agotan el cupo anonimo (2).
  const tokenCrodriguez = await tokenFor('crodriguez', SEED.crodriguez);
  const tokenMlopez = await tokenFor('mlopez', SEED.mlopez);

  // Una peticion anonima mas (misma IP) ya deberia estar bloqueada --
  // confirma que el cupo anonimo de verdad esta en 2/2.
  const anonBloqueado = await request(app).get('/api/dashboard/clientes');
  assert.equal(anonBloqueado.status, 429, 'el cupo anonimo (2) ya deberia estar agotado por los 2 logins');

  // crodriguez autenticado: 4 peticiones (el limite autenticado completo),
  // todas deberian pasar aunque el cupo anonimo ya este en 0 -- prueba que
  // NO comparte el mismo contador.
  for (let i = 0; i < 4; i++) {
    const res = await request(app).get('/api/dashboard/clientes').set('Authorization', `Bearer ${tokenCrodriguez}`);
    assert.equal(res.status, 200, `peticion autenticada ${i + 1} de crodriguez deberia pasar (200), no ${res.status}`);
  }
  // La 5ta ya agota su cupo propio.
  const crodriguezBloqueado = await request(app).get('/api/dashboard/clientes').set('Authorization', `Bearer ${tokenCrodriguez}`);
  assert.equal(crodriguezBloqueado.status, 429, 'crodriguez deberia estar bloqueado tras agotar su propio cupo de 4');

  // mlopez, misma IP que crodriguez (mismo supertest/app), con su propio
  // cupo intacto -- 4 peticiones mas deberian pasar igual, SIN verse
  // afectadas porque crodriguez ya agoto el suyo.
  for (let i = 0; i < 4; i++) {
    const res = await request(app).get('/api/dashboard/clientes').set('Authorization', `Bearer ${tokenMlopez}`);
    assert.equal(res.status, 200, `peticion autenticada ${i + 1} de mlopez deberia pasar (200), no ${res.status}`);
  }
});
