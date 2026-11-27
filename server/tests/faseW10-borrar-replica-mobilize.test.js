// faseW10-borrar-replica-mobilize.test.js — Fase W10 (pedido del usuario, 26/11/2026): borrar DEL TODO la réplica
// «MOBILIZE PRUEBAS API». El panel de Wolkvox de MOBILIZE pasa al real; el destino `replica` sale del código (sin
// destino, D.destino lanza); el dry-run cuenta sin escribir; la migración hace un respaldo y luego borra su tablero,
// su fila y sus datos, sin tocar el MOBILIZE real (si cambia una cifra del real, se deshace). Datos INVENTADOS; la
// réplica la arma la prueba con la función de la Fase W1 (ya no se crea al arrancar).
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { db, app, request, tokenFor, MASTER_PASSWORD } = require('./helpers');
const dbMod = require('../db');
const auto = require('../wolkvox-auto');
const D = require('../wolkvox-destinos');
const B = require('../borrar-replica-mobilize');

const R = 'MOBILIZE PRUEBAS API';
const REAL = 'MOBILIZE';
const SKILL = 'SKILL INVENTADA W10';
const TOKEN = 'TOKEN-FALSO-W10-no-es-real-0123456789';
const ENV = { NODE_ENV: 'test', WOLKVOX_MOBILIZE_TOKEN: TOKEN, WOLKVOX_MOBILIZE_SERVIDOR: 'servidorfalsow10', WOLKVOX_REAL_ACTIVO: '1', WOLKVOX_REAL_MODULOS: 'flujo_hora' };
const H = (t) => ({ Authorization: 'Bearer ' + t });
const n = (sql, ...a) => db.prepare(sql).get(...a).n;
const ok = (cuerpo) => Promise.resolve({ status: 200, json: () => Promise.resolve(cuerpo) });
const ts = new Date().toISOString();
const dirRespaldo = fs.mkdtempSync(path.join(os.tmpdir(), 'w10-respaldo-'));
let admin, cliente;

function sembrar(campana, fecha, k) {
  for (let i = 0; i < k; i++) {
    db.prepare("INSERT INTO calidad_nivel_servicio_diario (campana, fecha, skillName, totalLlamadas, contestadas, archivoNombre, cargadoPorNombre, createdAt) VALUES (?, ?, ?, 10, 9, 'inventado', 'prueba', ?)").run(campana, fecha.slice(0, 8) + String(i + 1).padStart(2, '0'), 'SKILL W10 ' + campana, ts);
  }
  db.prepare("INSERT INTO flujo_hora (campana, fecha, hora, skill, ingresadas, contestadas, abandonadas, archivoNombre, cargadoPorNombre, createdAt) VALUES (?, ?, 8, 'SKILL W10', 3, 2, 1, 'inventado', 'prueba', ?)").run(campana, fecha, ts);
}
const huellaReal = () => JSON.stringify(['calidad_nivel_servicio_diario', 'flujo_hora', 'dashboards_config:cliente', 'clientes_registro:nombre'].map((t) => {
  const [tabla, col] = t.split(':');
  return db.prepare('SELECT * FROM ' + tabla + ' WHERE ' + (col || 'campana') + ' = ? ORDER BY rowid').all(REAL);
}));

before(async () => {
  admin = await tokenFor('admin', MASTER_PASSWORD);
  dbMod.crearReplicaMobilizeApi();
  auto.asegurarTablas(db);
  sembrar(R, '2026-11-02', 3);
  sembrar(REAL, '2030-01-02', 2);
  db.prepare("INSERT INTO wolkvox_login_diario (operacion, fecha, agentId, agentName, primerLogin, ultimoLogout, sesiones, segundos) VALUES ('MOBILIZE', '2026-11-03', '9001', 'PERSONA INVENTADA W10', '08:00:00', '17:00:00', 1, 32400)").run();
  db.prepare("INSERT INTO historial (ts, fecha, accion, nombre, username, rol, actor, detalle) VALUES (?, '26/11/2026', 'WOLKVOX_AUTO', NULL, NULL, NULL, 'prueba', ?)").run(Date.now(), R + ' · skill_1 · inventado');
  const u = await request(app).post('/api/users').set(H(admin)).send({ nombre: 'Persona Ficticia W10', user: 'w10_cliente', password: 'Clave#FaseW10xy', rol: 'CLIENTES_DASH', perms: { cliente_MOBILIZE: true } });
  assert.equal(u.status, 201, JSON.stringify(u.body));
  const p = JSON.parse(db.prepare('SELECT perms FROM users WHERE id = ?').get(u.body.id).perms);
  p['cliente_' + R] = true; // metido directo, como si alguien lo hubiera marcado
  db.prepare('UPDATE users SET perms = ? WHERE id = ?').run(JSON.stringify(p), u.body.id);
  cliente = await tokenFor('w10_cliente', 'Clave#FaseW10xy');
});

test('código: ya no hay destino «replica»; sin destino, lanza; la réplica no está en la lista cerrada', () => {
  assert.ok(!('replica' in D.DESTINOS));
  assert.throws(() => D.destino(), /Falta el destino/);
  assert.throws(() => D.destino('replica'), /no permitido/);
  assert.ok(!D.CAMPANAS_PERMITIDAS.includes(R));
  assert.equal(D.destinoInterno(R), null);
  assert.equal(require('../wolkvox').operacionDeCampana(R), null);
  assert.equal(require('../wolkvox').operacionDeCampana(REAL), 'MOBILIZE');
  assert.throws(() => require('../wolkvox-ingesta').reemplazarMesFlujo(db, { mes: '2026-11', filas: [], cargadoPorNombre: 'x' }), /no permitida/);
  assert.equal(require('../puntualidad').config(R), null);
});

test('dry-run (inventario): cuenta sin escribir; réplica y real por separado; solo conteos', async () => {
  const antes = huellaReal();
  const inv = B.inventario(db);
  assert.equal(inv.existe, true);
  assert.equal(inv.puedeBorrar, true);
  const t = Object.fromEntries(inv.tablas.map((x) => [x.tabla, x]));
  assert.equal(t.calidad_nivel_servicio_diario.replica, 3);
  assert.ok(t.calidad_nivel_servicio_diario.real >= 2);
  assert.equal(t.flujo_hora.replica, 1);
  assert.equal(t.dashboards_config.replica, 1);
  assert.equal(inv.loginAgentes.filas, 1);
  assert.equal(inv.loginAgentes.seBorra, true);
  assert.equal(inv.usuariosConPermisoDeLaReplica, 1);
  assert.ok(inv.seQueda.historialQueLaNombra >= 1);
  assert.ok(!JSON.stringify(inv).includes('PERSONA INVENTADA'), 'sin valores de los datos');
  assert.equal(huellaReal(), antes);
  // La ruta: solo el administrador completo.
  const r = await request(app).get('/api/wolkvox/replica-mobilize/inventario').set(H(admin));
  assert.equal(r.status, 200);
  assert.equal(r.body.totalFilasReplica, inv.totalFilasReplica);
  assert.equal((await request(app).get('/api/wolkvox/replica-mobilize/inventario').set(H(cliente))).status, 403);
  assert.equal((await request(app).get('/api/wolkvox/replica-mobilize/inventario')).status, 401);
});

test('si el respaldo falla, no se borra nada', () => {
  const antes = B.inventario(db).totalFilasReplica;
  const r = dbMod.borrarReplicaMobilizeApi({ dirRespaldo, respaldar: () => { throw new Error('disco lleno inventado'); } });
  assert.equal(r.estado, 'sin_respaldo');
  assert.equal(B.inventario(db).totalFilasReplica, antes);
  assert.ok(db.prepare('SELECT 1 FROM clientes_registro WHERE nombre = ?').get(R));
});

test('con una asesora en la réplica, no se borra nada', () => {
  db.prepare("UPDATE users SET asesorCampana = ? WHERE user = 'w10_cliente'").run(R);
  try {
    assert.equal(B.borrar(db).estado, 'no_permitido');
    assert.ok(db.prepare('SELECT 1 FROM clientes_registro WHERE nombre = ?').get(R));
  } finally { db.prepare("UPDATE users SET asesorCampana = NULL WHERE user = 'w10_cliente'").run(); }
});

test('migración: respaldo y después el borrado; el real intacto; Historial se queda; idempotente', () => {
  const antes = huellaReal();
  const hist = n('SELECT COUNT(*) n FROM historial WHERE detalle LIKE ?', '%' + R + '%');
  const r = dbMod.borrarReplicaMobilizeApi({ dirRespaldo });
  assert.equal(r.estado, 'borrada', JSON.stringify(r));
  assert.ok(fs.existsSync(path.join(dirRespaldo, r.respaldo)) && fs.statSync(path.join(dirRespaldo, r.respaldo)).size > 0, 'el respaldo existe');
  assert.equal(r.borradas.calidad_nivel_servicio_diario, 3);
  assert.equal(r.borradas.flujo_hora, 1);
  assert.equal(r.borradas.dashboards_config, 1);
  assert.equal(r.borradas.clientes_registro, 1);
  assert.equal(r.borradas.wolkvox_login_diario, 1);
  assert.equal(r.borradas.permisos_de_usuarios, 1);
  for (const { tabla, col } of B.inventario(db).tablas.map((x) => ({ tabla: x.tabla, col: x.columna }))) assert.equal(n('SELECT COUNT(*) n FROM "' + tabla + '" WHERE ' + col + ' = ?', R), 0, tabla);
  assert.equal(huellaReal(), antes, 'el MOBILIZE real no cambió');
  assert.equal(n('SELECT COUNT(*) n FROM historial WHERE detalle LIKE ?', '%' + R + '%'), hist, 'el Historial no se toca');
  const p = JSON.parse(db.prepare("SELECT perms FROM users WHERE user = 'w10_cliente'").get().perms);
  assert.deepEqual(p, { cliente_MOBILIZE: true }, 'solo se quitó la clave de la réplica');
  assert.equal(B.inventario(db).existe, false);
  assert.equal(dbMod.borrarReplicaMobilizeApi({ dirRespaldo }).estado, 'nada', 'idempotente');
});

test('panel de Wolkvox en el MOBILIZE real: estado (con SU última corrida), sin «Ejecutar ahora»; la réplica ya no responde', async () => {
  db.prepare("INSERT INTO wolkvox_auto_corridas (franja, inicio, fin, estado, consultas, detalle) VALUES ('w10 real', '2026-11-26T18:00:00Z', '2026-11-26T18:00:05Z', 'ok', 25, 'MOBILIZE · skill_1 · inventado · 25 consultas')").run();
  db.prepare("INSERT INTO wolkvox_auto_corridas (franja, inicio, fin, estado, consultas, detalle) VALUES ('w10 aurora', '2026-11-26T18:01:00Z', '2026-11-26T18:01:05Z', 'ok', 3, 'CLINICA AURORA PRUEBAS API · skill_1 · inventado')").run();
  const e = await request(app).get('/api/wolkvox/estado').query({ campana: REAL }).set(H(admin));
  assert.equal(e.status, 200, JSON.stringify(e.body));
  assert.equal(e.body.autoDisponible, false, 'el real no tiene «Ejecutar ahora»');
  assert.equal(e.body.auto.campana, REAL);
  assert.equal(e.body.auto.interruptor, 'WOLKVOX_REAL_ACTIVO');
  assert.equal(e.body.auto.ultimaCorrida.franja, 'w10 real', 'solo las corridas del real');
  assert.ok(!JSON.stringify(e.body).includes(TOKEN));
  assert.equal((await request(app).get('/api/wolkvox/estado').query({ campana: REAL }).set(H(cliente))).status, 403);
  assert.equal((await request(app).post('/api/wolkvox/auto/ejecutar').set(H(admin)).send({ campana: REAL })).status, 404);
  assert.equal((await request(app).get('/api/wolkvox/estado').query({ campana: R }).set(H(admin))).status, 404);
  assert.equal((await request(app).post('/api/wolkvox/agente/flujo').send({})).status === 404 || (await request(app).post('/api/wolkvox/agente/flujo').send({})).status === 401, true, 'la entrada B1 ya no existe');
  // Pantalla: el botón sale para el administrador en el real; la «Última consulta automática» sin detalle.
  global.isFullAdmin = () => true; global.esClienteInterno = () => false;
  const W = require('../../public/js/wolkvox-prueba.js');
  assert.equal(W.wvPruebaVisible(REAL), true);
  assert.equal(W.wvPruebaVisible('ORLANT'), false);
  assert.equal(W.wvUltimaTexto({ ultimaCorrida: { inicio: '2026-11-26T18:00:00Z', estado: 'ok', consultas: 25 } }), '26/11/2026 13:00 · ok · 25 consultas');
  assert.equal(W.wvUltimaTexto({ ultimaCorrida: null }), 'Ninguna todavía');
  assert.equal(W.wvUltimaTexto(null), '—');
});

test('programador: con WOLKVOX_REAL_ACTIVO corre SOLO el real, una vez por franja (también tras reiniciar)', async () => {
  db.prepare('INSERT INTO trafico_skill_mapeo (skillName, campana, sede, createdAt, updatedAt) VALUES (?, ?, NULL, ?, ?)').run(SKILL, REAL, ts, ts);
  const falso = () => { const f = { apis: [] }; f.fetch = (url) => { const api = new URL(url).searchParams.get('api'); f.apis.push(api); return api === 'skill_1' ? ok({ code: 200, msg: '1 records were found', data: [{ skill_name: SKILL, inbound_calls: '5', answer_calls: '4', abandon_calls: '1', service_level_20seg: '80.0 %' }] }) : ok({ code: 200, msg: '0 records were found', data: [] }); }; return f; };
  const tick = async (ahora, f) => { const p = auto.iniciar(db, { reloj: () => ahora, cadaMs: 3600 * 1000, env: ENV, fetchImpl: f.fetch, logEvent: () => {}, leerInterruptor: async (e, nom) => nom === 'WOLKVOX_REAL_ACTIVO', leerValor: async (e, nom) => ENV[nom] }); try { return await p.tick(); } finally { p.detener(); } };
  const f1 = falso();
  await tick(new Date('2026-11-05T12:05:00Z'), f1); // 05/11 07:05: del 1 al 4 de noviembre
  assert.deepEqual(f1.apis, ['skill_1', 'skill_1', 'skill_1', 'skill_1', 'skill_7']);
  assert.equal(n("SELECT COUNT(*) n FROM wolkvox_auto_corridas WHERE franja = '2026-11-05 07'"), 0, 'sin franja de la réplica');
  const f2 = falso();
  await tick(new Date('2026-11-05T12:40:00Z'), f2);
  assert.deepEqual(f2.apis, [], 'la misma franja no se repite');
});
