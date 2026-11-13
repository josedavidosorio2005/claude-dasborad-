// fase354-hlm-sedes.test.js — Fase 354 (reunion con Edwin del 13/11): Hospital La Maria por
// sede («Sede Castilla» y «Sede 33»), cada una su campaña hija. Datos SINTETICOS.
//  - la migracion crea las 2 sedes como copia de HLM (sin Calidad), no mueve ni borra nada
//    y es idempotente;
//  - permisos: quien ve HLM ve las 2 sedes; con una sede marcada, solo esa;
//  - el tablero del padre («Sin sede») es solo del administrador;
//  - las cargas van por sede (al padre: 400 claro) y no se mezclan entre sedes;
//  - las listas por cliente que tenian a HLM tienen sus 2 sedes.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');
const dbMod = require('../db');
const reg = require('../clientes-registro');
const S = require('../../public/js/sedes-logic.js');

const H = (t) => ({ Authorization: 'Bearer ' + t });
const HLM = 'HOSPITAL LA MARIA';
const CAS = 'HOSPITAL LA MARIA - CASTILLA';
const S33 = 'HOSPITAL LA MARIA - SEDE 33';
const fila = (skillName, fecha, total, contestadas) => ({ fecha, skillName, totalLlamadas: total, contestadas, llamadasAbandonadas: total - contestadas });
function crear(user, rol, perms) {
  db.prepare(`INSERT INTO users (nombre, user, rol, active, password_hash, perms, createdAt, debe_cambiar_password) VALUES (?,?,?,1,?,?,?,0)`)
    .run('Persona ' + user, user, rol, bcrypt.hashSync('Clave#2026x', 4), JSON.stringify(perms), new Date().toISOString());
  return tokenFor(user, 'Clave#2026x');
}
let admin, cliAmbas, cliCastilla, supAmbas, supS33, cliSoloSede;

before(async () => {
  admin = await tokenFor('admin', MASTER_PASSWORD);
  cliAmbas = await crear('f354_cli', 'CLIENTES_DASH', { ClientesDash: true, ['cliente_' + HLM]: true });
  // Desde Usuarios: HLM marcado y solo Castilla marcada (la otra sede queda en false).
  cliCastilla = await crear('f354_cli_cas', 'CLIENTES_DASH', { ClientesDash: true, ['cliente_' + HLM]: true, ['cliente_' + CAS]: true, ['cliente_' + S33]: false });
  cliSoloSede = await crear('f354_cli_s33', 'CLIENTES_DASH', { ClientesDash: true, ['cliente_' + S33]: true });
  supAmbas = await crear('f354_sup', 'SUPERVISOR', { ['supervisa_' + HLM]: true });
  supS33 = await crear('f354_sup33', 'SUPERVISOR', { ['supervisa_' + HLM]: true, ['supervisa_' + S33]: true });
});

test('migracion: las 2 sedes son copia de HLM (sin Calidad) y el padre lista sus sedes', () => {
  const r = reg.leerRegistro(db);
  const padre = r.find((c) => c.nombre === HLM);
  assert.deepEqual(padre.parametros.sedes, reg.HLM_SEDES);
  assert.equal(padre.parametros.sedesNombre, 'Hospital La María');
  for (const [nombre, etiqueta] of [[CAS, 'Sede Castilla'], [S33, 'Sede 33']]) {
    const c = r.find((x) => x.nombre === nombre);
    assert.ok(c, nombre);
    assert.deepEqual(c.modulos, padre.modulos.filter((m) => m !== 'calidad'), 'mismos modulos, Calidad se decide despues');
    assert.equal(c.parametros.sedeDe, HLM);
    assert.equal(c.parametros.sedeEtiqueta, etiqueta);
    assert.deepEqual(c.parametros.sedes, []);
    assert.equal(c.parametros.asesorOcultoCliente, padre.parametros.asesorOcultoCliente, 'mismos parametros que el padre');
    const cfg = db.prepare('SELECT titulo, layout FROM dashboards_config WHERE cliente = ?').get(nombre);
    const tabs = JSON.parse(cfg.layout).tabs;
    assert.equal(cfg.titulo, db.prepare('SELECT titulo FROM dashboards_config WHERE cliente = ?').get(HLM).titulo);
    assert.ok(!tabs.some((t) => t.key === 'calidad'));
    for (const k of ['trafico', 'trafico_whatsapp', 'total_trafico']) assert.equal(tabs.find((t) => t.key === k).oculta, false, k + ' visible');
    assert.ok(!cfg.layout.includes('"' + HLM + '"'), 'ningun panel apunta al padre');
    assert.deepEqual(db.prepare('SELECT codigo, nombre FROM skills_whatsapp WHERE campana = ?').all(nombre), [{ codigo: '0', nombre: 'WHATSAPP DE SALIDA' }]);
  }
  assert.equal(r.filter((c) => c.parametros.sedeDe).length, 2);
});

test('migracion: idempotente y no mueve lo ya cargado en HLM («Sin sede»)', () => {
  require('../trafico-skills').cargarTrafico(db, { archivoNombre: 'x.xlsx', cargadoPorNombre: 'test', filas: [fila('F354 SIN SEDE', '2026-08-03', 10, 8)], campana: HLM });
  const antes = db.prepare('SELECT COUNT(*) n FROM calidad_nivel_servicio_diario WHERE campana = ?').get(HLM).n;
  const fotoReg = JSON.stringify(reg.leerRegistro(db));
  const fotoCfg = JSON.stringify(db.prepare('SELECT cliente, layout FROM dashboards_config ORDER BY cliente').all());
  dbMod.crearSedesHospitalLaMaria();
  assert.equal(JSON.stringify(reg.leerRegistro(db)), fotoReg);
  assert.equal(JSON.stringify(db.prepare('SELECT cliente, layout FROM dashboards_config ORDER BY cliente').all()), fotoCfg);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM calidad_nivel_servicio_diario WHERE campana = ?').get(HLM).n, antes);
  assert.ok(antes >= 1);
});

test('permisos (logica): HLM -> las 2 sedes; con una sede marcada, solo esa; sin HLM, nada', () => {
  const r = reg.leerRegistro(db);
  const p = (perms) => S.permisosConSedes(perms, r);
  assert.deepEqual(S.sedesVisibles(r, HLM, p({ ['cliente_' + HLM]: true }), false).map((s) => s.campana), [CAS, S33]);
  assert.deepEqual(S.sedesVisibles(r, HLM, p({ ['cliente_' + HLM]: true, ['cliente_' + CAS]: true, ['cliente_' + S33]: false }), false).map((s) => s.campana), [CAS]);
  assert.deepEqual(S.sedesVisibles(r, HLM, p({ ['cliente_' + S33]: true }), false).map((s) => s.campana), [S33]);
  assert.deepEqual(S.sedesVisibles(r, HLM, p({ cliente_ORLANT: true }), false), []);
  assert.deepEqual(S.sedesVisibles(r, HLM, {}, true).map((s) => s.campana), [CAS, S33], 'el administrador ve las 2');
  // Las desmarcadas (false) no cuentan como restriccion: HLM marcado y ninguna sede = las 2.
  assert.deepEqual(S.sedesVisibles(r, HLM, p({ ['cliente_' + HLM]: true, ['cliente_' + CAS]: false, ['cliente_' + S33]: false }), false).length, 2);
  // Tarjetas: sin las sedes sueltas; el padre si ve alguna sede.
  const lista = ['ORLANT', HLM, CAS, S33];
  assert.deepEqual(S.clientesParaTarjetas(lista, r, p({ ['cliente_' + S33]: true }), false), [HLM]);
  assert.deepEqual(S.clientesParaTarjetas(lista, r, {}, true), ['ORLANT', HLM]);
  assert.deepEqual(S.clientesParaTarjetas(lista, r, { cliente_ORLANT: true }, false), ['ORLANT']);
  assert.equal(S.sedeEtiqueta(r, CAS), 'Sede Castilla');
  assert.equal(S.padreDeSede(r, S33), HLM);
  assert.equal(S.padreDeSede(r, HLM), null);
});

test('tablero: quien ve HLM abre las 2 sedes; el padre («Sin sede») es solo del administrador', async () => {
  const abrir = async (t, c) => (await request(app).get('/api/dashboard/' + encodeURIComponent(c)).set(H(t))).status;
  assert.equal(await abrir(admin, HLM), 200);
  assert.equal(await abrir(admin, CAS), 200);
  for (const t of [cliAmbas, supAmbas]) {
    // Fase 354b: con «Datos anteriores» prendido (migracion), el padre se abre en solo lectura;
    // con la opcion apagada vuelve a ser solo del administrador (fase354b-hlm-datos-anteriores).
    assert.equal(await abrir(t, HLM), 200, 'el padre: datos anteriores');
    assert.equal(await abrir(t, CAS), 200);
    assert.equal(await abrir(t, S33), 200);
  }
  assert.equal(await abrir(cliCastilla, CAS), 200);
  assert.equal(await abrir(cliCastilla, S33), 403, 'solo su sede');
  assert.equal(await abrir(supS33, S33), 200);
  assert.equal(await abrir(supS33, CAS), 403, 'el supervisor de una sede, solo esa');
  assert.equal(await abrir(cliSoloSede, S33), 200);
  assert.equal(await abrir(cliSoloSede, CAS), 403);
  // La lista de clientes trae el padre (para la pantalla de sedes) y sus sedes visibles.
  const lst = (await request(app).get('/api/dashboard/clientes').set(H(cliSoloSede))).body;
  assert.ok(lst.listaClientes.includes(HLM) && lst.listaClientes.includes(S33) && !lst.listaClientes.includes(CAS));
  assert.ok(lst.registro.some((c) => c.nombre === HLM && c.parametros.sedes.length === 2));
  // El login entrega los permisos ya con las sedes heredadas.
  const login = await request(app).post('/api/auth/login').send({ user: 'f354_cli', password: 'Clave#2026x' });
  assert.equal(login.body.user.perms['cliente_' + CAS], true);
  assert.equal(login.body.user.perms['cliente_' + S33], true);
});

test('cargas: al padre no (400 «se suben por sede»); cada sede guarda lo suyo y no se mezcla', async () => {
  const body = (campana, total) => ({ campana, archivoNombre: 'sintetico.xlsx', filas: [fila('F354 LINEA', '2026-10-01', total, total - 1)] });
  const alPadre = await request(app).post('/api/calidad/trafico/carga').set(H(admin)).send(body(HLM, 50));
  assert.equal(alPadre.status, 400);
  assert.match(alPadre.body.error, /se suben por sede/);
  const tip = await request(app).post('/api/calidad/tipificacion/carga').set(H(admin))
    .send({ campana: HLM, canal: 'LLAMADAS', filas: [['ASESOR X', '2026-10-02', null, 1, 'AGENDADO', 'COLA', 60, '1', 'inbound', null, '700']] });
  assert.equal(tip.status, 400, JSON.stringify(tip.body));
  assert.match(tip.body.error, /se suben por sede/);

  assert.equal((await request(app).post('/api/calidad/trafico/carga').set(H(admin)).send(body(CAS, 30))).status, 201);
  assert.equal((await request(app).post('/api/calidad/trafico/carga').set(H(admin)).send(body(S33, 70))).status, 201);
  const diario = async (c) => (await request(app).get('/api/calidad/nivel-servicio/diario?campana=' + encodeURIComponent(c)).set(H(admin))).body
    .filter((r) => r.skillName === 'F354 LINEA').map((r) => r.totalLlamadas);
  assert.deepEqual(await diario(CAS), [30]);
  assert.deepEqual(await diario(S33), [70]);
  assert.deepEqual(await diario(HLM), [], 'nada nuevo en el padre');
  // El supervisor de la Sede 33 sube a su sede, no a Castilla.
  assert.equal((await request(app).post('/api/calidad/trafico/carga').set(H(supS33)).send(body(S33, 71))).status, 201);
  assert.equal((await request(app).post('/api/calidad/trafico/carga').set(H(supS33)).send(body(CAS, 31))).status, 403);
});

test('listas por cliente: donde estaba HLM estan sus 2 sedes (salida, retiradas, menu, lineas)', () => {
  const t = require('../tipificaciones');
  const centro = require('../centro-cargas');
  const menu = require('../../public/js/gd-menu-lateral.js');
  const gl = require('../../public/js/graficas-lineas-logic.js');
  for (const c of [CAS, S33]) {
    assert.deepEqual(t.SALIDA_POR_CLIENTE[c], t.SALIDA_POR_CLIENTE[HLM]);
    assert.deepEqual(centro.CARGAS_RETIRADAS_POR_CLIENTE[c], centro.CARGAS_RETIRADAS_POR_CLIENTE[HLM]);
    assert.equal(menu.gdMenuLateralActivo(c), true);
    assert.equal(gl.graficasLineasAplica(c), true);
    assert.equal(gl.totalTraficoLineasAplica(c), true);
  }
});
