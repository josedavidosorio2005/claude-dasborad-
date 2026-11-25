// faseGH9-cedula-nombre-inventario.test.js — Pedido de Edwin (25/11/2026): en el Inventario, al escribir la cédula de
// un agente nuevo, su nombre desde Talento humano. Reglas del usuario:
//   - solo ADMIN y SISTEMAS; coincidencia exacta; devuelve SOLO el nombre;
//   - límite de intentos propio y bajo;
//   - la cédula no va a logs, respuestas de error ni Historial;
//   - si no está en Talento humano, se deja crear con el nombre escrito a mano (aviso visible); bloquear es cambiar
//     una constante (CEDULA_SIN_GH).
// Cédulas y nombres INVENTADOS.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');
const GH = require('../gh-estado');
const NGH = require('../gh-novedades');
const A = require('../activos');

const H = (t) => ({ Authorization: 'Bearer ' + t });
const CED = '900111222';           // en Talento humano (inventada)
const CED_PUNTOS = '900.111.222';  // la misma, con puntos
const CED_NO = '900333444';        // no está (inventada)
const NOMBRE = 'Persona Inventada Prueba Uno';
let admin, sis, sis2, cal;
function crear(user, rol, perms) {
  db.prepare(`INSERT INTO users (nombre, user, rol, active, password_hash, perms, createdAt, debe_cambiar_password) VALUES (?,?,?,1,?,?,?,0)`)
    .run('Prueba ' + user, user, rol, bcrypt.hashSync('Clave#2026x', 4), JSON.stringify(perms || {}), new Date().toISOString());
}
before(async () => {
  GH.crearTablas(db);
  const emp = [
    { id: 'e1', numId: CED, nombre: NOMBRE, cargo: 'Cargo inventado', salario: 1234567, celular: '3000000000', estado: 'Activo' },
    { id: 'e2', numId: '800555666', nombre: 'Otra Persona Inventada', estado: 'Activo' },
  ];
  db.prepare("INSERT OR REPLACE INTO gh_estado (clave, valor, version, actualizadoPor, actualizadoAt) VALUES (?, ?, 1, 'prueba', ?)")
    .run('inconexion_gh_empleados_v1', JSON.stringify(emp), new Date().toISOString());
  crear('gh9_sis', 'SISTEMAS'); crear('gh9_sis2', 'SISTEMAS'); crear('gh9_cal', 'CALIDAD', { Calidad: true });
  admin = await tokenFor('admin', MASTER_PASSWORD);
  [sis, sis2, cal] = await Promise.all(['gh9_sis', 'gh9_sis2', 'gh9_cal'].map((u) => tokenFor(u, 'Clave#2026x')));
});
const buscar = (t, documento) => request(app).post('/api/activos/gh-nombre').set(H(t)).send({ documento });

test('encuentra el nombre por coincidencia exacta (con o sin puntos) y devuelve SOLO el nombre', async () => {
  for (const d of [CED, CED_PUNTOS]) {
    const r = await buscar(admin, d);
    assert.equal(r.status, 200);
    assert.deepEqual(r.body, { encontrado: true, nombre: NOMBRE }, 'nada más del empleado (cargo, salario, contacto)');
  }
  assert.deepEqual((await buscar(sis, CED)).body, { encontrado: true, nombre: NOMBRE });
  // Exacta: un prefijo o una cédula parecida no sirve.
  assert.deepEqual((await buscar(admin, CED.slice(0, 6))).body, { encontrado: false });
  assert.deepEqual((await buscar(admin, CED + '9')).body, { encontrado: false });
  assert.equal(NGH.nombrePorDocumento(db, ''), null);
});

test('no encontrada: aviso, y se deja crear el agente con el nombre escrito a mano (regla «avisar»)', async () => {
  assert.deepEqual((await buscar(admin, CED_NO)).body, { encontrado: false });
  assert.equal(A.CEDULA_SIN_GH, 'avisar');
  const r = await request(app).post('/api/activos/agentes').set(H(admin)).send({ nombre: 'Nombre Escrito A Mano', documento: CED_NO });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  // Bloquear es cambiar la constante: el código ya tiene esa rama.
  assert.match(fs.readFileSync(path.join(__dirname, '..', 'activos.js'), 'utf8'), /if \(CEDULA_SIN_GH === 'bloquear' && v\.documento && !require\('\.\/gh-novedades'\)\.nombrePorDocumento\(db, v\.documento\)\)/);
  const L = require('../../public/js/activos.js');
  assert.deepEqual(L.activosCedulaAviso({ encontrado: false }), { texto: 'No se encontró en Talento humano. Escribe el nombre a mano.', clase: 'no' });
  assert.deepEqual(L.activosCedulaAviso({ encontrado: true, nombre: 'x' }), { texto: 'Nombre tomado de Talento humano.', clase: 'si' });
});

test('un rol sin permiso del Inventario recibe 403; sin sesión, 401', async () => {
  assert.equal((await buscar(cal, CED)).status, 403);
  assert.equal((await request(app).post('/api/activos/gh-nombre').send({ documento: CED })).status, 401);
});

test('documento con formato inválido: 400 sin repetir lo que se mandó', async () => {
  const raro = '<x>' + CED;
  const r = await buscar(admin, raro);
  assert.equal(r.status, 400);
  assert.ok(!JSON.stringify(r.body).includes(CED));
});

test('el límite de intentos propio corta (por usuario) y no afecta a otro usuario', async () => {
  let ultimo;
  for (let i = 0; i < 20; i++) { ultimo = await buscar(sis2, '7000000' + String(i).padStart(2, '0')); assert.equal(ultimo.status, 200, 'intento ' + (i + 1)); }
  const cortado = await buscar(sis2, CED);
  assert.equal(cortado.status, 429);
  assert.ok(!JSON.stringify(cortado.body).includes(CED));
  assert.equal((await buscar(sis, CED)).status, 200, 'otro usuario sigue');
});

test('la cédula no aparece en los logs, en los errores ni en el Historial', async () => {
  const visto = [];
  const orig = { log: console.log, error: console.error, warn: console.warn, out: process.stdout.write.bind(process.stdout) };
  const capt = (...a) => visto.push(a.map(String).join(' '));
  console.log = capt; console.error = capt; console.warn = capt;
  process.stdout.write = (c, ...r) => { visto.push(String(c)); return orig.out(c, ...r); };
  try {
    await buscar(admin, CED); await buscar(admin, CED_NO); await buscar(admin, '<y>' + CED);
  } finally { console.log = orig.log; console.error = orig.error; console.warn = orig.warn; process.stdout.write = orig.out; }
  assert.ok(!visto.join('\n').includes(CED) && !visto.join('\n').includes(CED_NO), 'nada en consola');
  const h = db.prepare('SELECT * FROM historial').all().map((r) => JSON.stringify(r)).join('\n');
  assert.ok(!h.includes(CED) && !h.includes(CED_PUNTOS), 'nada en el Historial');
  // La ruta lleva la cédula en el cuerpo, nunca en la URL (lo único que registra el log de accesos).
  const rutas = fs.readFileSync(path.join(__dirname, '..', 'routes', 'activos.js'), 'utf8');
  assert.match(rutas, /router\.post\('\/activos\/gh-nombre'/);
  assert.doesNotMatch(rutas, /gh-nombre[^\n]*req\.query/);
});

test('navegador: los dos formularios de agente nuevo buscan al cambiar la cédula y tienen su aviso', () => {
  const js = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'activos.js'), 'utf8');
  const html = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'index.html'), 'utf8');
  assert.ok(js.includes(String.raw`onchange="activosCedulaGh(\'ac-g-doc\',\'ac-g-nombre\',\'ac-g-doc-aviso\')"><p class="ac-gh-aviso" id="ac-g-doc-aviso" role="status" aria-live="polite"></p>`), 'formulario de asignar: agente nuevo');
  assert.match(html, /id="ac-ag-documento"[^>]*onchange="activosCedulaGh\('ac-ag-documento','ac-ag-nombre','ac-ag-doc-aviso'\)"><p class="ac-gh-aviso" id="ac-ag-doc-aviso" role="status" aria-live="polite"><\/p>/);
  assert.match(js, /apiRequest\('POST', '\/activos\/gh-nombre', \{ documento: v \}\)/);
  assert.doesNotMatch(js, /console\.(log|error)\([^)]*documento/);
  // Un nombre corregido a mano ya no es «de Talento humano»: otra búsqueda no lo pisa.
  assert.match(js, /nom\.oninput = function \(\) \{ nom\.dataset\.gh = ''; \};/);
  assert.match(js, /if \(r && r\.encontrado && \(!nom\.value\.trim\(\) \|\| nom\.dataset\.gh === '1'\)\)/);
});
