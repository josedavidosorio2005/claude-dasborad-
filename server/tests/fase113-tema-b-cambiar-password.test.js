// Fase 113 (tema B): "Cambiar mi contrasena" (autoservicio) + invalidacion
// de tokens al cambiar una contrasena (propia o por reseteo de admin).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, login, tokenFor, MASTER_PASSWORD, SEED } = require('./helpers');

const auth = (t) => ({ Authorization: `Bearer ${t}` });

test('cambiar mi contrasena: contrasena actual incorrecta -> 401, nada cambia', async () => {
  const t = await tokenFor('crodriguez', SEED.crodriguez);
  const res = await request(app)
    .put('/api/auth/password')
    .set(auth(t))
    .send({ currentPassword: 'esta-mal', newPassword: 'NuevaClaveValida123' });
  assert.equal(res.status, 401);

  // el token viejo sigue sirviendo (no se toco nada)
  const check = await request(app).get('/api/users').set(auth(t));
  assert.equal(check.status, 200);
});

test('cambiar mi contrasena: reglas de largo -- nueva contrasena corta -> 400', async () => {
  const t = await tokenFor('crodriguez', SEED.crodriguez);
  const res = await request(app)
    .put('/api/auth/password')
    .set(auth(t))
    .send({ currentPassword: SEED.crodriguez, newPassword: 'corta1' });
  assert.equal(res.status, 400);
});

test('cambiar mi contrasena: no puede ser igual al nombre de usuario', async () => {
  const t = await tokenFor('crodriguez', SEED.crodriguez);
  const res = await request(app)
    .put('/api/auth/password')
    .set(auth(t))
    .send({ currentPassword: SEED.crodriguez, newPassword: 'crodriguez' });
  assert.equal(res.status, 400);
});

test('cambiar mi contrasena: caso exitoso -- devuelve un token NUEVO, el VIEJO deja de servir, y queda en el Historial', async () => {
  const adminToken = await tokenFor('admin', MASTER_PASSWORD);
  const tokenViejo = await tokenFor('crodriguez', SEED.crodriguez);
  const nuevaClave = 'ClaveNuevaReal#2026';

  const res = await request(app)
    .put('/api/auth/password')
    .set(auth(tokenViejo))
    .send({ currentPassword: SEED.crodriguez, newPassword: nuevaClave });
  assert.equal(res.status, 200);
  assert.ok(res.body.token, 'debe devolver un token nuevo');
  assert.notEqual(res.body.token, tokenViejo);

  // el token VIEJO ya no sirve, ni siquiera para la misma peticion que lo uso
  const conViejo = await request(app).get('/api/users').set(auth(tokenViejo));
  assert.equal(conViejo.status, 401);

  // el token NUEVO si sirve
  const conNuevo = await request(app).get('/api/users').set(auth(res.body.token));
  assert.equal(conNuevo.status, 200);

  // login con la clave vieja ya no funciona; con la nueva si
  const conClaveVieja = await login('crodriguez', SEED.crodriguez);
  assert.equal(conClaveVieja.status, 401);
  const conClaveNueva = await login('crodriguez', nuevaClave);
  assert.equal(conClaveNueva.status, 200);

  const hist = await request(app).get('/api/historial').set(auth(adminToken));
  const evento = hist.body.find((h) => h.accion === 'PASSWORD_PROPIA' && h.username === 'crodriguez');
  assert.ok(evento, 'debe quedar "Cambio de contrasena (propio)" en el Historial');
  assert.ok(!/ClaveNuevaReal/.test(JSON.stringify(evento)), 'la contrasena nunca debe aparecer en el Historial');
});

test('reseteo de contrasena por ADMIN tambien invalida los tokens viejos de ese usuario', async () => {
  const adminToken = await tokenFor('admin', MASTER_PASSWORD);
  const list = await request(app).get('/api/users').set(auth(adminToken));
  const target = list.body.find((u) => u.user === 'mlopez');
  assert.ok(target);

  const tokenViejo = await tokenFor('mlopez', SEED.mlopez);
  const resetRes = await request(app)
    .put(`/api/users/${target.id}/password`)
    .set(auth(adminToken))
    .send({ password: 'ResetAdmin#2026' });
  assert.equal(resetRes.status, 200);

  const conViejo = await request(app).get('/api/users').set(auth(tokenViejo));
  assert.equal(conViejo.status, 401, 'el token emitido ANTES del reseteo debe dejar de servir');

  const conClaveNueva = await login('mlopez', 'ResetAdmin#2026');
  assert.equal(conClaveNueva.status, 200);
});

test('el admin maestro no puede usar el autoservicio de cambio de contrasena', async () => {
  const t = await tokenFor('admin', MASTER_PASSWORD);
  const res = await request(app)
    .put('/api/auth/password')
    .set(auth(t))
    .send({ currentPassword: MASTER_PASSWORD, newPassword: 'NuevaClaveValida123' });
  assert.equal(res.status, 400);
});
