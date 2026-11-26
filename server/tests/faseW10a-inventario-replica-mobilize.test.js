// faseW10a-inventario-replica-mobilize.test.js — Fase W10a (26/11/2026): dry-run del borrado de la réplica
// «MOBILIZE PRUEBAS API». SOLO LECTURA: cuenta por tabla (réplica y, como control, el MOBILIZE real), sin valores
// de los datos y sin escribir nada. Solo el administrador completo. Datos INVENTADOS en la base temporal.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { db, app, request, tokenFor, MASTER_PASSWORD } = require('./helpers');
const I = require('../inventario-replica-mobilize');

const R = 'MOBILIZE PRUEBAS API';
const H = (t) => ({ Authorization: 'Bearer ' + t });
const ts = new Date().toISOString();
let admin, cliente;
// Huella de TODA la base: filas por tabla (para comprobar que el inventario no escribe nada).
const huella = () => JSON.stringify(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all()
  .map(({ name }) => [name, db.prepare('SELECT COUNT(*) n FROM "' + name + '"').get().n, db.prepare('SELECT COALESCE(MAX(rowid), 0) m FROM "' + name + '"').get().m]));

before(async () => {
  admin = await tokenFor('admin', MASTER_PASSWORD);
  const ins = db.prepare("INSERT INTO calidad_nivel_servicio_diario (campana, fecha, skillName, totalLlamadas, contestadas, archivoNombre, cargadoPorNombre, createdAt) VALUES (?, ?, 'SKILL W10A', 10, 9, 'inventado', 'prueba', ?)");
  for (const f of ['2026-11-02', '2026-11-03', '2026-11-04']) ins.run(R, f, ts);
  ins.run('MOBILIZE', '2030-01-02', ts);
  const u = await request(app).post('/api/users').set(H(admin)).send({ nombre: 'Persona Ficticia W10a', user: 'w10a_cliente', password: 'Clave#FaseW10axy', rol: 'CLIENTES_DASH', perms: { cliente_MOBILIZE: true } });
  assert.equal(u.status, 201, JSON.stringify(u.body));
  cliente = await tokenFor('w10a_cliente', 'Clave#FaseW10axy');
});

test('inventario: cuenta la réplica y el real por tabla, sin escribir nada y sin valores', () => {
  const antes = huella();
  const inv = I.inventario(db);
  assert.equal(huella(), antes, 'no escribe nada');
  assert.equal(inv.campana, R);
  assert.equal(inv.existe, true);
  assert.equal(inv.registro.interna, true);
  assert.equal(inv.registro.replicaDe, 'MOBILIZE');
  const t = Object.fromEntries(inv.tablas.map((x) => [x.tabla, x]));
  assert.equal(t.calidad_nivel_servicio_diario.replica, 3);
  assert.ok(t.calidad_nivel_servicio_diario.real >= 1);
  assert.ok(t.dashboards_config.replica >= 1, 'su tablero');
  assert.ok(!inv.tablas.some((x) => ['historial', 'users', 'clientes_registro', 'wolkvox_auto_corridas'].includes(x.tabla)), 'auditoría y registro fuera de la lista');
  assert.equal(inv.totalFilasReplica, inv.tablas.reduce((a, x) => a + x.replica, 0));
  assert.equal(inv.usuariosAsesorasDeLaReplica, 0);
  assert.equal(inv.puedeBorrar, true);
  assert.equal(inv.loginAgentes.seBorra, true, 'solo la réplica usa el login de MOBILIZE');
  assert.ok(!JSON.stringify(inv).includes('SKILL W10A'), 'solo conteos');
});

test('el módulo no tiene ninguna escritura', () => {
  const src = require('fs').readFileSync(require.resolve('../inventario-replica-mobilize'), 'utf8');
  for (const p of [/\bDELETE\b/, /\bUPDATE\b/, /\bINSERT\b/, /\bDROP\b/, /\bVACUUM\b/, /\.run\(/, /\.exec\(/]) assert.ok(!p.test(src), String(p));
  assert.deepEqual(Object.keys(I).sort(), ['NOMBRE', 'REAL', 'inventario']);
});

test('ruta: solo el administrador completo (cliente 403, sin sesión 401), sin cambiar nada', async () => {
  const antes = huella();
  const r = await request(app).get('/api/wolkvox/replica-mobilize/inventario').set(H(admin));
  assert.equal(r.status, 200);
  assert.equal(r.body.campana, R);
  assert.equal(r.body.totalFilasReplica, I.inventario(db).totalFilasReplica);
  assert.equal((await request(app).get('/api/wolkvox/replica-mobilize/inventario').set(H(cliente))).status, 403);
  assert.equal((await request(app).get('/api/wolkvox/replica-mobilize/inventario')).status, 401);
  assert.equal(huella(), antes, 'la ruta no escribe nada');
});
