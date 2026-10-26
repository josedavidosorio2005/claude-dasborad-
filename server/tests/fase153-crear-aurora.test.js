// fase153-crear-aurora.test.js — Fase 153 (P3): CLINICA AURORA desde la
// plantilla de cliente, por migracion idempotente que corre DESPUES de
// fase134_borrar_clientes_v1. Una base nueva termina todas las migraciones
// con Aurora; ORLANT y MOBILIZE no cambian; nadie la ve salvo el admin
// completo; sin usuarios, permisos ni plantilla de Calidad.
// (El caso "base vieja con la Aurora anterior" esta en
// fase134-borrar-clientes-migracion.test.js.)
'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { app, db, request, tokenFor, login, MASTER_PASSWORD, SEED, cleanup } = require('./helpers');
const { generarLayout, PERFILES_ACTUALES } = require('../plantillas-cliente');
const reg = require('../clientes-registro');
const { campaignAccess } = require('../auth');

after(cleanup);

const AURORA = 'CLINICA AURORA';
const auth = (t) => ({ Authorization: 'Bearer ' + t });
const fila = () => db.prepare('SELECT titulo, vista, secciones, layout FROM dashboards_config WHERE cliente = ?').get(AURORA);

test('una base nueva termina todas las migraciones con Aurora, creada despues de la Fase 134', () => {
  const orden = db.prepare('SELECT name FROM schema_migrations ORDER BY rowid').all().map((r) => r.name);
  const i134 = orden.indexOf('fase134_borrar_clientes_v1');
  const iAur = orden.indexOf('fase153_crear_clinica_aurora_v1');
  assert.ok(i134 !== -1 && iAur > i134, 'la creacion corre despues del borrado de la Fase 134');
  // Despues de Aurora solo pueden venir migraciones de fases posteriores que no la tocan.
  const POSTERIORES = ['fase155_pct_atencion_abandono_v1', 'fase160_crear_hospital_la_maria_v1', 'fase161_indices_v1', 'fase163_skill_por_cliente_v1',
    // Fase 168: solo tocan ORLANT (mapa de skills de WhatsApp y su panel de Tipificacion).
    'fase168_skills_whatsapp_v1', 'fase168_orlant_tipificacion_dos_canales_v1',
    // Fase 170: solo crea la tabla asesor_linea (vacia).
    'fase170_asesor_linea_v1',
    // Fase 172: tabla nueva + modulo y panel de MOBILIZE (no toca Aurora/HLM).
    'fase172_calidad_resumen_v1',
    // Fase 174: parametro salidaNoConectada de ORLANT y MOBILIZE (no toca Aurora/HLM).
    'fase174_salida_no_conectada_v1',
    // Fase 186: solo crea la tabla asesor_clasificacion (vacia).
    'fase186_asesor_clasificacion_v1',
    // Fase 187: copia lineas de ORLANT y enciende salidaUsaClasificacion (no toca Aurora/HLM).
    'fase187_salida_una_clasificacion_v1'];
  assert.deepEqual(orden.slice(iAur + 1).filter((n) => !POSTERIORES.includes(n)), [], 'ninguna migracion vieja corre despues de crear Aurora');
  assert.ok(fila(), 'Aurora sigue ahi al final');
  const r = reg.leerRegistro(db).find((c) => c.nombre === AURORA);
  assert.deepEqual(r.modulos, ['flujo_llamadas', 'flujo_whatsapp', 'calidad']);
  assert.equal(r.dashboard, true);
  assert.equal(r.logo, null);
  assert.equal(r.parametros.asesorVisibleCliente, false);
  assert.equal(r.parametros.traficoDosHojas, false, 'sin las hojas propias de ORLANT en Cargar Datos');
});

test('el dashboard de Aurora es el de la plantilla: pestanas como ORLANT, todas ocultas, sin datos', () => {
  const f = fila();
  const cfg = { titulo: f.titulo, vista: f.vista, secciones: JSON.parse(f.secciones), layout: JSON.parse(f.layout) };
  assert.deepEqual(cfg, generarLayout({ nombre: AURORA, titulo: 'Dashboard Clínica Aurora', modulos: ['flujo_llamadas', 'flujo_whatsapp', 'calidad'] }));
  assert.deepEqual(cfg.layout.tabs.map((t) => t.key), ['trafico', 'trafico_whatsapp', 'calidad']);
  cfg.layout.tabs.forEach((t) => assert.equal(t.oculta, true, t.key));
  // Mismas pestanas que ORLANT (salvo la campana).
  const orl = generarLayout(PERFILES_ACTUALES.ORLANT).layout.tabs;
  for (const t of cfg.layout.tabs) {
    const o = orl.find((x) => x.key === t.key);
    assert.deepEqual(JSON.parse(JSON.stringify(t.panels).split(AURORA).join('ORLANT')), o.panels, t.key);
  }
  for (const tabla of ['dashboard_cargas', 'calidad_nivel_servicio_diario', 'trafico_whatsapp', 'monitoreos']) {
    const col = tabla === 'dashboard_cargas' ? 'cliente' : 'campana';
    assert.equal(db.prepare(`SELECT COUNT(*) AS n FROM ${tabla} WHERE ${col} = ?`).get(AURORA).n, 0, tabla);
  }
});

test('sin plantilla de Calidad (no se inventan items) y sin usuarios ni permisos nuevos', () => {
  assert.equal(db.prepare('SELECT 1 FROM calidad_plantillas WHERE campana = ?').get(AURORA), undefined);
  for (const u of db.prepare('SELECT user, perms FROM users').all()) {
    assert.doesNotMatch(u.perms, /AURORA/, u.user + ' no debe tener ninguna clave de Aurora');
  }
});

test('ORLANT y MOBILIZE no cambian: registro igual a la semilla y dashboards iguales a la foto', () => {
  // Fase 160: HLM se prueba en fase160-crear-hlm.test.js.
  const r = reg.leerRegistro(db).filter((c) => c.nombre !== AURORA && c.nombre !== 'HOSPITAL LA MARIA');
  assert.deepEqual(r.map((c) => ({ nombre: c.nombre, modulos: c.modulos, parametros: c.parametros, logo: c.logo })),
    reg.REGISTRO_INICIAL.map((c) => ({ nombre: c.nombre, modulos: c.modulos, parametros: c.parametros, logo: c.logo })));
  for (const c of ['ORLANT', 'MOBILIZE']) {
    const f = db.prepare('SELECT titulo, vista, secciones, layout FROM dashboards_config WHERE cliente = ?').get(c);
    const actual = { titulo: f.titulo, vista: f.vista ? JSON.parse(f.vista) : null, secciones: JSON.parse(f.secciones), layout: JSON.parse(f.layout) };
    assert.equal(JSON.stringify(actual), JSON.stringify(generarLayout(PERFILES_ACTUALES[c])), c);
  }
  // Aurora va despues de los dos en las listas.
  assert.deepEqual(reg.listaClientes(db).slice(0, 3), ['ORLANT', 'MOBILIZE', AURORA]);
});

test('idempotente: correrla otra vez no duplica ni pisa un cambio del admin', () => {
  const antes = db.prepare('SELECT COUNT(*) AS n FROM dashboards_config').get().n;
  db.prepare("UPDATE dashboards_config SET titulo = 'Editado por el admin' WHERE cliente = ?").run(AURORA);
  db.crearClinicaAurora();
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM dashboards_config').get().n, antes);
  assert.equal(fila().titulo, 'Editado por el admin');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM clientes_registro WHERE nombre = ?').get(AURORA).n, 1);
  db.prepare("UPDATE dashboards_config SET titulo = 'Dashboard Clínica Aurora' WHERE cliente = ?").run(AURORA);
});

test('nadie la ve salvo el admin completo: el dashboard da 403 a todos los demas', async () => {
  const master = await tokenFor('admin', MASTER_PASSWORD);
  const ruta = '/api/dashboard/' + encodeURIComponent(AURORA);
  assert.equal((await request(app).get(ruta).set(auth(master))).status, 200, 'admin maestro');
  for (const [user, pass] of Object.entries(SEED)) {
    const t = await tokenFor(user, pass);
    const r = await request(app).get(ruta).set(auth(t));
    const row = db.prepare('SELECT rol, perms FROM users WHERE user = ?').get(user);
    if (row.rol === 'ADMIN') {
      assert.equal(r.status, 200, user + ' (ADMIN completo)');
    } else {
      assert.equal(r.status, 403, user + ' (' + row.rol + ')');
      assert.equal(campaignAccess({ rol: row.rol, perms: JSON.parse(row.perms) }, AURORA), false, user);
    }
  }
});

test('el rol cliente (con acceso a TODOS los clientes de antes) no ve Aurora en su lista', async () => {
  const { dashClientesVisibles } = require('../../public/js/dashboards-logic.js');
  const t = await tokenFor('agomez', SEED.agomez);
  const lista = (await request(app).get('/api/dashboard/clientes').set(auth(t))).body.listaClientes;
  // Fase 154: el servidor ya ni le manda el nombre (antes solo lo ocultaba el navegador).
  assert.ok(!lista.includes(AURORA), 'el nombre no llega a quien no tiene acceso');
  const u = (await login('agomez', SEED.agomez)).body.user;
  assert.deepEqual(dashClientesVisibles(lista, u, false), ['ORLANT', 'MOBILIZE']);
  const ta = await tokenFor('admin', MASTER_PASSWORD);
  const listaAdmin = (await request(app).get('/api/dashboard/clientes').set(auth(ta))).body.listaClientes;
  assert.deepEqual(dashClientesVisibles(listaAdmin, null, true).slice(0, 3), ['ORLANT', 'MOBILIZE', AURORA], 'el admin completo si la ve');
});

test('tablero: Flujo de Llamadas/WhatsApp se destapan solos al tener datos; sin pestanas visibles sale un aviso', () => {
  const G = require('../../public/js/mes-global-logic.js');
  const f = fila();
  const layout = JSON.parse(f.layout);
  assert.equal(G.gdTodasLasPestanasOcultas(layout), true, 'Aurora sin datos: aviso en vez de pagina en blanco');
  assert.equal(G.gdDestaparPorDatos(layout, 'trafico_combo', 'ORLANT'), 0, 'solo destapa los paneles de SU campana');
  assert.equal(G.gdDestaparPorDatos(layout, 'trafico_combo', AURORA), 1);
  assert.deepEqual(layout.tabs.filter((t) => !t.oculta).map((t) => t.key), ['trafico']);
  assert.equal(G.gdTodasLasPestanasOcultas(layout), false);
  assert.equal(G.gdDestaparPorDatos(layout, 'trafico_whatsapp_combo', AURORA), 1);
  assert.equal(layout.tabs.find((t) => t.key === 'calidad').oculta, true, 'Calidad sigue oculta (sin plantilla todavia)');
  // ORLANT y MOBILIZE: sus pestanas de Flujo ya estan visibles, no cambia nada.
  for (const c of ['ORLANT', 'MOBILIZE']) {
    const l = generarLayout(PERFILES_ACTUALES[c]).layout;
    const antes = JSON.stringify(l);
    G.gdDestaparPorDatos(l, 'trafico_combo', c);
    G.gdDestaparPorDatos(l, 'trafico_whatsapp_combo', c);
    assert.equal(JSON.stringify(l), antes, c);
    assert.equal(G.gdTodasLasPestanasOcultas(l), false, c);
  }
  const js = require('fs').readFileSync(require('path').join(__dirname, '..', '..', 'public', 'js', 'dashboard-generic.js'), 'utf8');
  assert.match(js, /gdDestaparPorDatos\(_gd\.config\.layout, 'trafico_combo', _gd\.cliente\)/);
  assert.match(js, /gdDestaparPorDatos\(_gd\.config\.layout, 'trafico_whatsapp_combo', _gd\.cliente\)/);
  assert.match(js, /if\(!esModulo && gdTodasLasPestanasOcultas\(layoutGd\)\)/);
});
