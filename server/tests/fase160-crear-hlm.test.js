// fase160-crear-hlm.test.js — Fase 160 ("OK crear HLM"): HOSPITAL LA MARIA
// como un solo cliente, igual que Aurora: Flujo de Llamadas, Flujo de
// WhatsApp y Calidad (ocultas, sin datos, sin plantilla de Calidad), sin
// sedes todavia, visible solo para el admin completo. Migracion idempotente
// despues de fase134_borrar_clientes_v1. ORLANT, MOBILIZE y Aurora no cambian.
'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { app, db, request, tokenFor, MASTER_PASSWORD, SEED, cleanup } = require('./helpers');
const { generarLayout, PERFILES_ACTUALES } = require('../plantillas-cliente');
const reg = require('../clientes-registro');
const { campaignAccess } = require('../auth');

after(cleanup);

const HLM = 'HOSPITAL LA MARIA';
const AURORA = 'CLINICA AURORA';
const auth = (t) => ({ Authorization: 'Bearer ' + t });
const cfgDe = (c) => {
  const f = db.prepare('SELECT titulo, vista, secciones, layout FROM dashboards_config WHERE cliente = ?').get(c);
  return f && { titulo: f.titulo, vista: f.vista ? JSON.parse(f.vista) : null, secciones: JSON.parse(f.secciones), layout: JSON.parse(f.layout) };
};

test('una base nueva termina todas las migraciones con HLM, creada despues de la Fase 134 y de Aurora', () => {
  const orden = db.prepare('SELECT name FROM schema_migrations ORDER BY rowid').all().map((r) => r.name);
  const i134 = orden.indexOf('fase134_borrar_clientes_v1');
  const iAur = orden.indexOf('fase153_crear_clinica_aurora_v1');
  const iHlm = orden.indexOf('fase160_crear_hospital_la_maria_v1');
  assert.ok(i134 !== -1 && iAur > i134 && iHlm > iAur, 'HLM se crea despues del borrado de la Fase 134');
  // Despues de HLM solo pueden venir migraciones de fases posteriores que no la tocan.
  const POSTERIORES = ['fase163_skill_por_cliente_v1',
    // Fase 168: solo tocan ORLANT (mapa de skills de WhatsApp y su panel de Tipificacion).
    'fase168_skills_whatsapp_v1', 'fase168_orlant_tipificacion_dos_canales_v1',
    // Fase 170: solo crea la tabla asesor_linea (vacia).
    'fase170_asesor_linea_v1',
    // Fase 172: tabla nueva + modulo y panel de MOBILIZE (no toca Aurora/HLM).
    'fase172_calidad_resumen_v1',
    // Fase 174: parametro salidaNoConectada de ORLANT y MOBILIZE (no toca Aurora/HLM).
    'fase174_salida_no_conectada_v1',
    // Fase 186: solo crea la tabla asesor_clasificacion (vacia).
    'fase186_asesor_clasificacion_v1'];
  assert.deepEqual(orden.slice(iHlm + 1).filter((n) => !POSTERIORES.includes(n)), [], 'ninguna migracion vieja corre despues de crear HLM');
  const r = reg.leerRegistro(db).find((c) => c.nombre === HLM);
  assert.ok(r, 'HLM en el registro de clientes');
  assert.deepEqual(r.modulos, ['flujo_llamadas', 'flujo_whatsapp', 'calidad']);
  assert.equal(r.dashboard, true);
  assert.deepEqual(r.parametros.sedes, [], 'las sedes quedan por definir');
  assert.equal(r.parametros.traficoDosHojas, false);
  assert.equal(r.parametros.asesorVisibleCliente, false);
});

test('el dashboard de HLM es el de la plantilla: como Aurora/ORLANT, todo oculto y sin datos', () => {
  const cfg = cfgDe(HLM);
  assert.deepEqual(cfg, generarLayout({ nombre: HLM, titulo: 'Dashboard Hospital La María', modulos: ['flujo_llamadas', 'flujo_whatsapp', 'calidad'] }));
  assert.deepEqual(cfg.layout.tabs.map((t) => t.key), ['trafico', 'trafico_whatsapp', 'calidad']);
  cfg.layout.tabs.forEach((t) => assert.equal(t.oculta, true, t.key));
  const aur = cfgDe(AURORA).layout.tabs;
  cfg.layout.tabs.forEach((t, k) => assert.equal(JSON.stringify(t).split(HLM).join(AURORA), JSON.stringify(aur[k]), 'igual que Aurora: ' + t.key));
  for (const tabla of ['dashboard_cargas', 'calidad_nivel_servicio_diario', 'trafico_whatsapp', 'monitoreos']) {
    const col = tabla === 'dashboard_cargas' ? 'cliente' : 'campana';
    assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM ${tabla} WHERE ${col} = ?`).get(HLM).n, 0, tabla);
  }
  assert.equal(db.prepare('SELECT 1 FROM calidad_plantillas WHERE campana = ?').get(HLM), undefined, 'Calidad sin plantilla');
});

test('ORLANT, MOBILIZE y Aurora no cambian', () => {
  for (const c of ['ORLANT', 'MOBILIZE']) {
    assert.equal(JSON.stringify(cfgDe(c)), JSON.stringify(generarLayout(PERFILES_ACTUALES[c])), c);
  }
  assert.deepEqual(cfgDe(AURORA), generarLayout({ nombre: AURORA, titulo: 'Dashboard Clínica Aurora', modulos: ['flujo_llamadas', 'flujo_whatsapp', 'calidad'] }));
  const r = reg.leerRegistro(db).filter((c) => c.nombre !== HLM && c.nombre !== AURORA);
  assert.deepEqual(r.map((c) => ({ nombre: c.nombre, modulos: c.modulos, parametros: c.parametros, logo: c.logo })),
    reg.REGISTRO_INICIAL.map((c) => ({ nombre: c.nombre, modulos: c.modulos, parametros: c.parametros, logo: c.logo })));
  assert.deepEqual(reg.listaClientes(db), ['ORLANT', 'MOBILIZE', AURORA, HLM]);
});

test('sin usuarios ni permisos nuevos', () => {
  for (const u of db.prepare('SELECT user, perms FROM users').all()) {
    assert.doesNotMatch(u.perms, /LA MARIA/, u.user + ' no debe tener ninguna clave de HLM');
  }
});

test('idempotente: correrla otra vez no duplica ni pisa un cambio del admin', () => {
  const antes = db.prepare('SELECT COUNT(*) AS n FROM dashboards_config').get().n;
  db.prepare("UPDATE dashboards_config SET titulo = 'Editado por el admin' WHERE cliente = ?").run(HLM);
  db.crearHospitalLaMaria();
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM dashboards_config').get().n, antes);
  assert.equal(cfgDe(HLM).titulo, 'Editado por el admin');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM clientes_registro WHERE nombre = ?').get(HLM).n, 1);
  db.prepare("UPDATE dashboards_config SET titulo = 'Dashboard Hospital La María' WHERE cliente = ?").run(HLM);
});

test('nadie la ve salvo el admin completo', async () => {
  const ruta = '/api/dashboard/' + encodeURIComponent(HLM);
  assert.equal((await request(app).get(ruta).set(auth(await tokenFor('admin', MASTER_PASSWORD)))).status, 200);
  for (const [user, pass] of Object.entries(SEED)) {
    const r = await request(app).get(ruta).set(auth(await tokenFor(user, pass)));
    const row = db.prepare('SELECT rol, perms FROM users WHERE user = ?').get(user);
    if (row.rol === 'ADMIN') assert.equal(r.status, 200, user);
    else {
      assert.equal(r.status, 403, user + ' (' + row.rol + ')');
      assert.equal(campaignAccess({ rol: row.rol, perms: JSON.parse(row.perms) }, HLM), false, user);
      const lista = (await request(app).get('/api/dashboard/clientes').set(auth(await tokenFor(user, pass)))).body.listaClientes || [];
      assert.ok(!lista.includes(HLM), user + ' no recibe el nombre');
    }
  }
});
