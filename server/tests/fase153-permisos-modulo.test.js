// fase153-permisos-modulo.test.js — Fase 153 (Centro de cargas, PR 5):
// permiso de carga POR MODULO para CALIDAD (`cargar_<modulo>`, apagado por
// defecto, se activa por usuario en Usuarios). cargarDatos (REPORTES/ADMIN o
// asignado) sigue cargando todo; CALIDAD sin cargarDatos carga SOLO sus
// modulos y SOLO en los clientes de su campaignAccess. Ningun otro rol gana
// nada con un cargar_<modulo>.
'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { app, db, request, tokenFor, MASTER_PASSWORD, SEED, cleanup } = require('./helpers');
const { canLoadModule, canLoadAnyModule } = require('../auth');
const { MODULOS_CON_PERMISO, CARGAS_POR_MODULO, cargaPorId } = require('../centro-cargas');
const L = require('../../public/js/centro-cargas-logic.js');
const V = require('../cargas-versiones');
const { cargarTipificaciones } = require('../tipificaciones');

after(cleanup);
const auth = (t) => ({ Authorization: 'Bearer ' + t });
const C = 'MOBILIZE';
const OTRO = 'ORLANT';

// crodriguez (CALIDAD) queda con acceso SOLO a MOBILIZE + los cargar_ dados.
function permsCalidad(extra) {
  const u = db.prepare("SELECT perms FROM users WHERE user = 'crodriguez'").get();
  const p = JSON.parse(u.perms || '{}');
  Object.keys(p).filter((k) => k.startsWith('cargar_') || k.startsWith('campana_') || k === 'cargarDatos').forEach((k) => delete p[k]);
  Object.assign(p, { ['campana_' + C]: true, ['campana_' + OTRO]: false }, extra || {});
  db.prepare("UPDATE users SET perms = ? WHERE user = 'crodriguez'").run(JSON.stringify(p));
}
const luBody = (campana, dia) => ({ campana, archivoNombre: 'p.xlsx', filas: [['Asesor P', '2026-0' + dia + '-05', 'CONTESTADA', 'SKILL P']] });
const citasBody = { campana: C, archivoNombre: 'c.xlsx', filas: [['2026-05', 10, 8]] };

test('reglas puras: cargarDatos todo; CALIDAD solo sus cargar_; otros roles nada', () => {
  const cal = (perms) => ({ rol: 'CALIDAD', perms });
  assert.equal(canLoadModule(cal({}), 'llamadas_unicas'), false, 'apagado por defecto');
  assert.equal(canLoadAnyModule(cal({})), false);
  assert.equal(canLoadModule(cal({ cargar_llamadas_unicas: true }), 'llamadas_unicas'), true);
  assert.equal(canLoadModule(cal({ cargar_llamadas_unicas: true }), 'tipificacion'), false);
  assert.equal(canLoadAnyModule(cal({ cargar_llamadas_unicas: true })), true);
  assert.equal(canLoadAnyModule(cal({ cargar_calidad: true })), false, 'Calidad no es un modulo con permiso de carga');
  for (const rol of ['SUPERVISOR', 'GERENCIA', 'CLIENTES_DASH', 'ASESOR', 'INVENTARIO', 'GESTION_HUMANA', 'AUX_ADMIN']) {
    assert.equal(canLoadModule({ rol, perms: { cargar_llamadas_unicas: true } }, 'llamadas_unicas'), false, rol);
  }
  assert.equal(canLoadModule({ rol: 'REPORTES', perms: { cargarDatos: true } }, 'tipificacion'), true, 'REPORTES sigue igual');
  assert.equal(canLoadModule({ rol: 'ADMIN', perms: {} }, 'tipificacion'), true, 'ADMIN sigue igual');
});

test('la lista del navegador coincide con la del servidor, y cada carga con su modulo', () => {
  assert.deepEqual(L.CENTRO_MODULOS_PERMISO.map((m) => m.id), MODULOS_CON_PERMISO);
  Object.values(CARGAS_POR_MODULO).flat().forEach((c) => assert.equal(L.centroModuloDeCarga(c.id), cargaPorId(c.id).modulo, c.id));
  const u = { rol: 'CALIDAD', perms: { cargar_encuesta: true } };
  assert.equal(L.centroPuedeCargarModulo(u, false, 'encuesta'), true);
  assert.equal(L.centroPuedeCargarModulo(u, false, 'agendas'), false);
  assert.equal(L.centroPuedeCargarAlgo({ rol: 'SUPERVISOR', perms: { cargar_encuesta: true } }, false), false);
});

test('CALIDAD SIN permiso de modulo: no ve el Centro, no sube, no elimina, no deshace', async () => {
  permsCalidad();
  const t = await tokenFor('crodriguez', SEED.crodriguez);
  const ta = await tokenFor('admin', MASTER_PASSWORD);
  // Una version de llamadas_unicas (hecha por el admin) para intentar deshacerla.
  await request(app).post('/api/calidad/llamadas-unicas/carga').set(auth(ta)).send(luBody(C, 4));
  await request(app).post('/api/calidad/llamadas-unicas/carga').set(auth(ta)).send(luBody(C, 4));
  const vid = V.listar(db, C, { carga: 'llamadas_unicas' })[0].id;
  const casos = [
    ['get', '/api/centro-cargas/' + C],
    ['get', '/api/centro-cargas/' + C + '/versiones'],
    ['get', '/api/centro-cargas/' + C + '/llamadas_unicas/2026-04/datos'],
    ['get', '/api/centro-cargas/' + C + '/llamadas_unicas/2026-04/conteo?desde=2026-04-01&hasta=2026-04-30'],
    ['delete', '/api/centro-cargas/' + C + '/llamadas_unicas/2026-04'],
    ['post', '/api/centro-cargas/versiones/' + vid + '/deshacer'],
    ['get', '/api/centro-cargas-plantillas/PLANTILLA_LLAMADAS_UNICAS.xlsx'],
    ['get', '/api/dashboard/secciones/' + C],
  ];
  for (const [m, url] of casos) assert.equal((await request(app)[m](url).set(auth(t))).status, 403, m + ' ' + url);
  for (const url of ['/api/calidad/llamadas-unicas/carga/impacto', '/api/calidad/llamadas-unicas/carga']) {
    assert.equal((await request(app).post(url).set(auth(t)).send(luBody(C, 4))).status, 403, url);
  }
  assert.equal(db.prepare("SELECT COUNT(*) n FROM llamadas_unicas WHERE campana = ? AND substr(fecha,1,7) = '2026-04'").get(C).n, 1, 'nada cambio');
});

test('CALIDAD CON cargar_llamadas_unicas: solo ese modulo, solo sus clientes', async () => {
  permsCalidad({ cargar_llamadas_unicas: true });
  const t = await tokenFor('crodriguez', SEED.crodriguez);
  const ta = await tokenFor('admin', MASTER_PASSWORD);

  // El Centro muestra solo ese modulo.
  const cc = await request(app).get('/api/centro-cargas/' + C).set(auth(t));
  assert.equal(cc.status, 200, JSON.stringify(cc.body));
  assert.deepEqual(cc.body.modulos.map((m) => m.id), ['llamadas_unicas']);
  assert.equal((await request(app).get('/api/centro-cargas/' + OTRO).set(auth(t))).status, 403, 'cliente fuera de su campaignAccess');
  assert.equal((await request(app).get('/api/dashboard/secciones/' + C).set(auth(t))).status, 200);
  assert.equal((await request(app).get('/api/dashboard/secciones/' + OTRO).set(auth(t))).status, 403);
  assert.equal((await request(app).get('/api/dashboard/cargas?cliente=' + C).set(auth(t))).status, 403, 'Gestion de base sigue siendo de cargarDatos');

  // Sube Llamadas Unicas y de Salida (mismo modulo), nunca en otro cliente ni otro modulo.
  assert.equal((await request(app).post('/api/calidad/llamadas-unicas/carga/impacto').set(auth(t)).send(luBody(C, 6))).status, 200);
  assert.equal((await request(app).post('/api/calidad/llamadas-unicas/carga').set(auth(t)).send(luBody(C, 6))).status, 201);
  const sal = await request(app).post('/api/calidad/llamadas-salida/carga').set(auth(t)).send({ campana: C, archivoNombre: 's.xlsx', filas: [['Asesor P', '2026-06-05', 'EFECTIVA', 'Tipificacion X']] });
  assert.notEqual(sal.status, 403, 'Llamadas de Salida es del mismo modulo: ' + JSON.stringify(sal.body));
  assert.equal((await request(app).post('/api/calidad/llamadas-unicas/carga').set(auth(t)).send(luBody(OTRO, 6))).status, 403, 'ORLANT no es suyo');
  assert.equal((await request(app).post('/api/calidad/efectividad-citas/carga').set(auth(t)).send(citasBody)).status, 403, 'otro modulo');

  // Eliminar y Deshacer: solo en su modulo.
  const del = await request(app).delete('/api/centro-cargas/' + C + '/llamadas_unicas/2026-06').set(auth(t));
  assert.equal(del.status, 200, JSON.stringify(del.body));
  assert.equal((await request(app).post('/api/centro-cargas/versiones/' + del.body.version.id + '/deshacer').set(auth(t))).status, 200);
  const fila = (ag) => [ag, '2026-03-03', null, null, 'Consulta', 'SKILL', null, null, null, null, null];
  cargarTipificaciones(db, { campana: C, canal: 'LLAMADAS', archivoNombre: 'l.xlsx', cargadoPorNombre: 'P', filas: [fila('L1')] });
  cargarTipificaciones(db, { campana: C, canal: 'LLAMADAS', archivoNombre: 'l2.xlsx', cargadoPorNombre: 'P', filas: [fila('L2')] });
  const vTip = V.listar(db, C, { carga: 'tipificacion_llamadas' })[0].id;
  assert.equal((await request(app).delete('/api/centro-cargas/' + C + '/tipificacion_llamadas/2026-03').set(auth(t))).status, 403);
  assert.equal((await request(app).post('/api/centro-cargas/versiones/' + vTip + '/deshacer').set(auth(t))).status, 403);
  assert.equal((await request(app).get('/api/centro-cargas/' + C + '/tipificacion_llamadas/2026-03/datos').set(auth(t))).status, 403);
  const vs = (await request(app).get('/api/centro-cargas/' + C + '/versiones').set(auth(t))).body.versiones;
  assert.ok(vs.length > 0 && vs.every((v) => v.carga === 'llamadas_unicas' || v.carga === 'llamadas_salida'), 'solo versiones de su modulo');
  assert.ok((await request(app).get('/api/centro-cargas/' + C + '/versiones').set(auth(ta))).body.versiones.some((v) => v.carga === 'tipificacion_llamadas'), 'el admin las ve todas');

  // Plantillas: la de su modulo si, la de otro no.
  assert.equal((await request(app).get('/api/centro-cargas-plantillas/PLANTILLA_LLAMADAS_UNICAS.xlsx').set(auth(t))).status, 200);
  assert.equal((await request(app).get('/api/centro-cargas-plantillas/PLANTILLA_TIPIFICACION_LLAMADAS.xlsx').set(auth(t))).status, 403);
});

test('Flujo de Llamadas por permiso de modulo: nunca deja skills "(SIN ASIGNAR)"; con cargarDatos sigue igual', async () => {
  permsCalidad({ cargar_flujo_llamadas: true });
  const now = '2026-10-19T00:00:00.000Z';
  db.prepare('INSERT OR REPLACE INTO trafico_skill_mapeo (skillName, campana, createdAt, updatedAt) VALUES (?, ?, ?, ?)').run('SKILL MOBILIZE P5', C, now, now);
  const t = await tokenFor('crodriguez', SEED.crodriguez);
  const ta = await tokenFor('admin', MASTER_PASSWORD);
  const body = (skill) => ({ archivoNombre: 't.xlsx', filas: [{ fecha: '2026-05-04', skillName: skill, totalLlamadas: 10, contestadas: 9 }] });
  const sin = await request(app).post('/api/calidad/trafico/carga').set(auth(t)).send(body('SKILL NUEVA P5'));
  assert.equal(sin.status, 403);
  assert.match(sin.body.error, /sin asignar/);
  assert.equal((await request(app).post('/api/calidad/trafico/carga/impacto').set(auth(t)).send(body('SKILL NUEVA P5'))).status, 403);
  assert.equal((await request(app).post('/api/calidad/trafico/carga').set(auth(t)).send(body('SKILL MOBILIZE P5'))).status, 201);
  assert.equal((await request(app).get('/api/calidad/trafico/skills').set(auth(t))).status, 200, 'el Centro lee el mapeo para filtrar');
  assert.equal((await request(app).put('/api/calidad/trafico/skills/' + encodeURIComponent('SKILL NUEVA P5')).set(auth(t)).send({ campana: C })).status, 403, 'asignar skills sigue siendo de cargarDatos');
  // El admin (cargarDatos) sigue pudiendo cargar una skill nueva, que queda sin asignar como siempre.
  assert.equal((await request(app).post('/api/calidad/trafico/carga').set(auth(ta)).send(body('SKILL NUEVA ADMIN P5'))).status, 201);
});

test('un cargar_<modulo> no le da nada a otro rol (GERENCIA con acceso a MOBILIZE)', async () => {
  const u = db.prepare("SELECT perms FROM users WHERE user = 'jherrera'").get();
  const p = Object.assign(JSON.parse(u.perms || '{}'), { cargar_llamadas_unicas: true, ['campana_' + C]: true });
  db.prepare("UPDATE users SET perms = ? WHERE user = 'jherrera'").run(JSON.stringify(p));
  const t = await tokenFor('jherrera', SEED.jherrera);
  assert.equal((await request(app).get('/api/centro-cargas/' + C).set(auth(t))).status, 403);
  assert.equal((await request(app).post('/api/calidad/llamadas-unicas/carga').set(auth(t)).send(luBody(C, 7))).status, 403);
});
