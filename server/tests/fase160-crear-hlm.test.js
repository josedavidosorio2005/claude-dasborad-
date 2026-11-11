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
const { auroraEsperada, hlmEsperada } = require('./helpers-aurora'); // Fase 220 / 229
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
    'fase186_asesor_clasificacion_v1',
    // Fase 187: copia lineas de ORLANT y enciende salidaUsaClasificacion (no toca Aurora/HLM).
    'fase187_salida_una_clasificacion_v1',
    // Fase 191: columna unicaDia en tipificaciones y tabla llamadas_abandonadas (no toca Aurora/HLM).
    'fase191_llamadas_unicas_fuentes_v1',
    // Fase 194: solo crea la tabla llamadas_no_conectadas (vacia).
    'fase194_llamadas_no_conectadas_v1',
    // Fase 196: tabla flujo_hora + modulo y pestaña de MOBILIZE (no toca Aurora/HLM).
    'fase196_flujo_hora_v1',
    // Fase 210: columnas nuevas de agendas y 2 tablas vacias de ORLANT (no toca Aurora/HLM).
    'fase210_agendas_usuarios_lineas_v1',
    // Fase 215: agrega SURA (tablero propio) al registro (no toca Aurora/HLM).
    'fase215_crear_sura_televentas_v1',
    // Fase 218: logo nuevo de ORLANT (solo su columna logo; no toca Aurora/HLM).
    'fase218_logo_orlant_v1',
    // Fase 219: pestaña Total tráfico de ORLANT (no toca Aurora/HLM).
    'fase219_total_trafico_v1',
    // Fase 220: solo destapa Trafico de Llamadas/WhatsApp de Aurora (no toca HLM).
    'fase220_aurora_trafico_visible_v1',
    // Fase 220: salida, Tipificacion y Total trafico de Aurora (no toca HLM).
    'fase220_aurora_salida_v1',
    // Fase 227: solo el resumen de Flujo de Llamadas de MOBILIZE (no toca Aurora/HLM).
    'dashboards_config_mobilize_resumen_tarjetas_v1',
    // Fase 231: solo el resumen de Flujo de Llamadas de MOBILIZE (no toca Aurora/HLM).
    'dashboards_config_mobilize_resumen_solo_titulos_v1',
    // Fase 248: solo el orden del resumen de Flujo de Llamadas de MOBILIZE (no toca Aurora/HLM).
    'dashboards_config_mobilize_resumen_orden_v2',
    // Fase 229: HLM como ORLANT (no toca Aurora).
    'fase229_hlm_como_orlant_v1',
    // Fase 230: WhatsApp por rangos de Aurora (no toca HLM).
    'fase230_aurora_whatsapp_tiempos_v1',
    // Fase 237: varias plantillas de Calidad (no toca Aurora/HLM).
    'fase237_calidad_plantillas_varias_v1',
    // Fase 252: columnas opcionales de Calidad (no toca Aurora/HLM).
    'fase252_calidad_campos_v1',
    // Fase 253: familia de versiones de plantilla (no toca Aurora/HLM).
    'fase253_calidad_plantillas_familia_v1',
    // Fase 256: panel de monitoreos en la pestaña Calidad de Mobilize (no toca Aurora/HLM).
    'fase256_mobilize_calidad_monitoreos_panel_v1',
    // Fase 259: Agendas por usuaria en Aurora (tabla nueva + modulo; HLM no se toca).
    'fase259_aurora_agendas_usuaria_v1',
    // Fase 262: panel de monitoreos en Calidad de Aurora y HLM (la pestaña no cambia de lugar).
    'fase262_calidad_monitoreos_aurora_hlm_v1',
    // Fase 265: columnas nuevas y 3 vistas de Agendas por usuaria (solo Aurora).
    'fase265_agendas_usuaria_vistas_v1',
    // Fase 269: Calidad solo con el resultado de los monitoreos (Mobilize, Aurora y HLM; sin datos que tocar).
    'fase269_calidad_solo_monitoreos_v1',
    'fase284_aurora_errores_v1',
    'fase285_logo_aurora_v1', // Fases 284 y 285 (logo de Aurora: solo su columna logo)
    'fase287_asesor_oculto_cliente_v1', // Fase 287: parametro asesorOcultoCliente de Aurora y HLM
    'fase301_agendas_usuaria_base_v1', // Fase 301: columna base en agendas_usuaria (ADD COLUMN, sin tocar filas)
    'fase302_agendas_tres_bases_v1', // Fase 302: columnas entidad/prof y la pestaña «Agendas» (sobre una base nueva ya viene asi)
    'fase306_aurora_inasistencia_encuestas_v1', // Fase 306: tablas y pestañas Inasistencia y Encuestas (solo Aurora)
    'fase307_orlant_calidad_monitoreos_v1', // Fase 307: monitoreos al final de Calidad de ORLANT (no toca Aurora/HLM)
    'fase311_aurora_lineas_internas_v1', // Fase 311: tablas y pestaña «Gestión líneas internas» (solo Aurora)
    'fase317_agendas_nombres_cliente_aurora_v1', // Fase 317: el cliente de Aurora ve nombres en Agendas
    'fase320_titulo_flujo_li_v1', // Fase 320: titulo del flujo de líneas internas (WhatsApp)
    'fase321_sura_modulo_calidad_v1', // Fase 321: SURA con modulo de Calidad
    'fase331_encuesta_monitoreo_v1']; // Fase 331: tablas y columna nuevas de Calidad de encuestas (solo siembra reglas de MOBILIZE)
  assert.deepEqual(orden.slice(iHlm + 1).filter((n) => !POSTERIORES.includes(n)), [], 'ninguna migracion vieja corre despues de crear HLM');
  const r = reg.leerRegistro(db).find((c) => c.nombre === HLM);
  assert.ok(r, 'HLM en el registro de clientes');
  // Fase 229: + WhatsApp por rangos, Salida y Tipificacion (fase229_hlm_como_orlant_v1).
  assert.deepEqual(r.modulos, ['flujo_llamadas', 'flujo_whatsapp', 'whatsapp_tiempos', 'salida', 'tipificacion', 'calidad']);
  assert.equal(r.dashboard, true);
  assert.deepEqual(r.parametros.sedes, [], 'las sedes quedan por definir');
  assert.equal(r.parametros.traficoDosHojas, false);
  assert.equal(r.parametros.asesorVisibleCliente, false);
});

test('el dashboard de HLM es el de la plantilla: como Aurora/ORLANT, todo oculto (menos Total tráfico) y sin datos', () => {
  const cfg = cfgDe(HLM);
  // Fase 229: + Salida, Total trafico y Tipificacion (fase229_hlm_como_orlant_v1).
  assert.deepEqual(cfg, hlmEsperada());
  assert.deepEqual(cfg.layout.tabs.map((t) => t.key), ['trafico', 'trafico_whatsapp', 'salida', 'total_trafico', 'tipificacion', 'calidad']);
  cfg.layout.tabs.forEach((t) => assert.equal(t.oculta, t.key === 'total_trafico' ? undefined : true, t.key));
  const aur = cfgDe(AURORA).layout.tabs;
  // Fase 220: Aurora tiene Trafico visible; HLM no (todo oculto). Lo demas, igual.
  const sinOculta = (t) => JSON.stringify(Object.assign({}, t, { oculta: undefined }));
  // Fase 220: Aurora ademas tiene Salida, Total trafico y Tipificacion; las de HLM son iguales a las suyas.
  cfg.layout.tabs.forEach((t) => assert.equal(sinOculta(t).split(HLM).join(AURORA), sinOculta(aur.find((a) => a.key === t.key)), 'igual que Aurora: ' + t.key));
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
  assert.deepEqual(cfgDe(AURORA), auroraEsperada()); // Fase 220
  const r = reg.leerRegistro(db).filter((c) => c.nombre !== HLM && c.nombre !== AURORA && c.nombre !== 'SURA'); // Fase 215
  assert.deepEqual(r.map((c) => ({ nombre: c.nombre, modulos: c.modulos, parametros: c.parametros, logo: c.logo })),
    reg.REGISTRO_INICIAL.map((c) => ({ nombre: c.nombre, modulos: c.modulos, parametros: c.parametros, logo: c.logo })));
  assert.deepEqual(reg.listaClientes(db), ['ORLANT', 'MOBILIZE', AURORA, HLM, 'SURA']); // Fase 215: SURA despues de HLM
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
