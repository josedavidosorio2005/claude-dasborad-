// fase310-carga-modulo-login.test.js — Fase 310 (hallazgos 2 y 5 de la revision de
// seguridad del 09/11): (1) una carga solo se acepta si el modulo es de esa campaña
// segun el registro de clientes (400 si no); (2) el usuario del login se compara sin
// distinguir mayusculas (la contraseña si las distingue) y no se puede crear ni
// renombrar un usuario que ya exista con otras mayusculas. Datos SINTETICOS.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');

const H = (t) => ({ Authorization: 'Bearer ' + t });
const AUR = 'CLINICA AURORA';
let admin, supMob, asesor;
const ina = (campana) => ({ campana, archivoNombre: 'sintetico.xls', filas: [{ mes: '2026-10', especialidad: 'ESPECIALIDAD FICTICIA', total: 10, noAsistio: 1 }] });
function crear(user, rol, perms, pw) {
  db.prepare(`INSERT INTO users (nombre, user, rol, active, password_hash, perms, createdAt, debe_cambiar_password) VALUES (?,?,?,1,?,?,?,0)`)
    .run('Persona ' + user, user, rol, bcrypt.hashSync(pw || 'Clave#2026x', 4), JSON.stringify(perms), new Date().toISOString());
}
before(async () => {
  admin = await tokenFor('admin', MASTER_PASSWORD);
  crear('f310_sup_mob', 'SUPERVISOR', { campana_MOBILIZE: true }); supMob = await tokenFor('f310_sup_mob', 'Clave#2026x');
  crear('f310_ase', 'ASESOR', { campana_MOBILIZE: true }); asesor = await tokenFor('f310_ase', 'Clave#2026x');
});

test('carga: modulo de la campaña pasa; modulo de otra campaña -> 400 con mensaje claro', async () => {
  const ok = await request(app).post('/api/calidad/aurora-inasistencia/carga').set(H(admin)).send(ina(AUR));
  assert.equal(ok.status, 201, JSON.stringify(ok.body));
  for (const c of ['MOBILIZE', 'ORLANT', 'HOSPITAL LA MARIA']) {
    const r = await request(app).post('/api/calidad/aurora-inasistencia/carga').set(H(admin)).send(ina(c));
    assert.equal(r.status, 400, c);
    assert.match(r.body.error, new RegExp('no es de la campaña ' + c));
    const imp = await request(app).post('/api/calidad/aurora-inasistencia/carga/impacto').set(H(admin)).send(ina(c));
    assert.equal(imp.status, 400, c + ' (impacto)');
  }
  // Una campaña que no esta en el registro tampoco acepta cargas.
  assert.equal((await request(app).post('/api/calidad/aurora-inasistencia/carga').set(H(admin)).send(ina('CAMPANA INEXISTENTE'))).status, 400);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM aurora_inasistencia WHERE campana <> ?").get(AUR).n, 0, 'nada se guardo fuera de Aurora');
});

test('carga: ORLANT sigue cargando sus modulos igual que siempre', async () => {
  const fila = ['2026-03', 'SEDE ORLANT', 'ESP ORLANT', 'EPS ORLANT', 1, 1, 0, 5, 7];
  const r = await request(app).post('/api/calidad/inasistencia/carga').set(H(admin)).send({ campana: 'ORLANT', filas: [fila] });
  assert.equal(r.status, 201, JSON.stringify(r.body));
});

test('carga: sin permiso o sin acceso a la campaña sigue siendo 403 (no se revela la configuracion)', async () => {
  // SUPERVISOR de MOBILIZE: en Aurora no tiene acceso -> 403, no 400.
  assert.equal((await request(app).post('/api/calidad/aurora-inasistencia/carga').set(H(supMob)).send(ina(AUR))).status, 403);
  // En su campaña, un modulo que no es de ella -> 400.
  assert.equal((await request(app).post('/api/calidad/aurora-inasistencia/carga').set(H(supMob)).send(ina('MOBILIZE'))).status, 400);
  // ASESOR: 403 siempre.
  assert.equal((await request(app).post('/api/calidad/aurora-inasistencia/carga').set(H(asesor)).send(ina('MOBILIZE'))).status, 403);
});

test('login: el usuario no distingue mayusculas; la contraseña si', async () => {
  crear('Prueba_ABC_310', 'ASESOR', { campana_ORLANT: true }, 'Clave#Fase310x');
  for (const u of ['Prueba_ABC_310', 'PRUEBA_ABC_310', 'prueba_abc_310', 'pRUEBA_aBC_310']) {
    const r = await request(app).post('/api/auth/login').send({ user: u, password: 'Clave#Fase310x' });
    assert.equal(r.status, 200, u);
    assert.equal(r.body.user.user, 'Prueba_ABC_310', 'devuelve el nombre guardado, sin cambiarlo');
  }
  for (const p of ['clave#Fase310x', 'CLAVE#FASE310X', 'Clave#fase310x']) {
    assert.equal((await request(app).post('/api/auth/login').send({ user: 'Prueba_ABC_310', password: p })).status, 401, 'contraseña con otra mayuscula');
  }
  assert.equal(db.prepare("SELECT user FROM users WHERE user = 'Prueba_ABC_310'").get().user, 'Prueba_ABC_310', 'el nombre guardado no cambia');
});

test('usuarios: crear o renombrar a un nombre que ya existe con otras mayusculas -> 409; el reservado del admin, en cualquier forma -> 400', async () => {
  const nuevo = (user) => request(app).post('/api/users').set(H(admin)).send({ nombre: 'Persona ' + user, user, password: 'Clave#Fase310y', rol: 'ASESOR', perms: {}, asesorCampana: 'ORLANT' });
  assert.equal((await nuevo('PRUEBA_abc_310')).status, 409);
  const otro = await nuevo('Otro_Usuario_310');
  assert.equal(otro.status, 201, JSON.stringify(otro.body));
  assert.equal((await request(app).put('/api/users/' + otro.body.id).set(H(admin)).send({ user: 'prueba_ABC_310' })).status, 409, 'renombrar a un duplicado');
  assert.equal((await request(app).put('/api/users/' + otro.body.id).set(H(admin)).send({ user: 'OTRO_usuario_310' })).status, 200, 'cambiar las mayusculas de su propio nombre si se puede');
  assert.equal((await nuevo('ADMIN')).status, 400);
});
