// fase118-matriz-acceso.test.js — Fase 118, Parte 2A: matriz de acceso
// EJECUTADA, no leida.
//
// 1) Inventaria TODAS las rutas reales montadas en el router de Express
//    (createApp()._router / .router, recorrido programatico -- nunca a
//    mano) y exige que cada una tenga una politica declarada en POLITICA
//    mas abajo: una ruta nueva sin entrada ahi hace fallar esta prueba
//    (verSinPolitica()).
// 2) Para cada ruta GET (la mayoria, y la superficie real de fuga de
//    datos), ejecuta la peticion real contra los 10 roles de seed:demo
//    (mas ADMIN) -- cada uno sembrado con acceso SOLO a la campana/cliente
//    'ORLANT' via seedUsers() de scripts/seed-demo-lib/users.js -- y
//    compara el status real contra la politica declarada, incluyendo
//    'CLINICA AURORA' como campana/cliente AJENA (debe bloquear a
//    cualquiera que no sea ADMIN).
// 3) Para las escrituras, cubre con body valido (ver validation.js) los
//    casos de mayor riesgo: las 3 escaladas CRITICAS de la Fase 102
//    (usuarios/permisos), el limite canEvaluateCampaign/canManageMonitoreos
//    de Calidad, y el limite can(actor,'Modulo') de Inventario/Gerencia/
//    GestionHumana. Las 7 familias de endpoints de carga masiva (Trafico x2,
//    Agendas, Tipificacion, Inasistencia, Efectividad x2) usan esquemas Zod
//    de fila con muchas columnas obligatorias (ver server/validation.js:
//    traficoFilaSchema, agendasFilaArraySchema, tipificacionFilaArraySchema,
//    inasistenciaFilaArraySchema, efectividad*FilaArraySchema) -- esta
//    prueba NO arma un body valido completo para esas (quedaria como un
//    segundo proyecto de pruebas en si mismo); en vez de eso confirma por
//    LECTURA DE CODIGO (ver docs/auditoria-seguridad-fase102.md y el grep
//    citado en el reporte de la Fase 118) que las 7 siguen el mismo patron
//    `canLoadData(req.actor)` + `campaignAccess(req.actor, body.campana)`
//    ya verificado DINAMICAMENTE aqui en /monitoreos, /inventario/items,
//    /gerencia/kpis y /gh/personal -- marcado explicito, no se reporta como
//    "verificado" con el mismo peso que el resto de esta matriz.
'use strict';

const os = require('os');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');

function setEnvDefault(key, value) {
  if (process.env[key] === undefined || process.env[key] === '') process.env[key] = value;
}
const tmpDb = path.join(os.tmpdir(), `inconexion-test-matriz-${process.pid}-${crypto.randomBytes(6).toString('hex')}.db`);
setEnvDefault('NODE_ENV', 'test');
setEnvDefault('JWT_SECRET', crypto.randomBytes(48).toString('hex'));
setEnvDefault('JWT_EXPIRES_IN', '1h');
setEnvDefault('MASTER_ADMIN_USER', 'admin');
const MASTER_PASSWORD = 'MasterMatriz#2026';
setEnvDefault('MASTER_ADMIN_PASSWORD_HASH', bcrypt.hashSync(MASTER_PASSWORD, 10));
setEnvDefault('DB_PATH', tmpDb);
setEnvDefault('TRUST_PROXY', 'false');
setEnvDefault('RATE_LIMIT_MAX', '1000000');
setEnvDefault('LOGIN_RATE_LIMIT_MAX', '1000000');

const { createApp } = require('../server');
const db = require('../db');
const { seedUsers } = require('../scripts/seed-demo-lib/users');

const app = createApp();

const PROPIA = 'ORLANT';
const AJENA = 'CLINICA AURORA'; // existe en CLIENTES_LIST/CAMPANAS_CALIDAD real, nunca sembrada para estos actores

let tokens = {}; // rol -> token
let actores = {}; // rol -> {id, user, rol}

before(async () => {
  const { porRol } = seedUsers(db, { clientesList: [PROPIA], campanasCalidad: [PROPIA] });
  actores = porRol;
  for (const [rol, row] of Object.entries(porRol)) {
    const u = db.prepare('SELECT * FROM users WHERE id = ?').get(row.id);
    // seedUsers no devuelve la contrasena si el usuario ya existia (idempotente);
    // en una DB temporal siempre se CREA de cero, asi que mejor forzamos una
    // contrasena conocida directo en la fila para no depender de ese detalle.
    const pass = 'Demo#' + rol + '2026';
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(pass, 10), row.id);
    const res = await request(app).post('/api/auth/login').send({ user: u.user, password: pass });
    assert.equal(res.status, 200, `login de seed demo ${rol} (${u.user}) deberia funcionar: ${JSON.stringify(res.body)}`);
    tokens[rol] = res.body.token;
  }
  const admLogin = await request(app).post('/api/auth/login').send({ user: 'admin', password: MASTER_PASSWORD });
  assert.equal(admLogin.status, 200);
  tokens.ADMIN_MASTER = admLogin.body.token;
});

after(() => {
  try { db.closeDb(); } catch (_) {}
  for (const suffix of ['', '-wal', '-shm']) {
    try { fs.unlinkSync(tmpDb + suffix); } catch (_) {}
  }
});

function auth(rol) {
  return { Authorization: 'Bearer ' + tokens[rol] };
}

const TODOS_LOS_ROLES = ['ADMIN', 'AUX_ADMIN', 'CALIDAD', 'INVENTARIO', 'GERENCIA', 'GESTION_HUMANA', 'CLIENTES_DASH', 'SUPERVISOR', 'ASESOR', 'REPORTES'];

// ══════════════════════════════════════════════════════════════════
// 1) INVENTARIO REAL DE RUTAS (recorrido programatico del router, no a mano)
// ══════════════════════════════════════════════════════════════════
function inventarioRutas() {
  const router = app.router || app._router;
  const rutas = [];
  function walk(stack) {
    stack.forEach((layer) => {
      if (layer.route) {
        const methods = Object.keys(layer.route.methods).filter((m) => layer.route.methods[m]);
        methods.forEach((m) => rutas.push(m.toUpperCase() + ' ' + layer.route.path));
      } else if (layer.name === 'router' && layer.handle.stack) {
        walk(layer.handle.stack);
      }
    });
  }
  walk(router.stack);
  // Excluye el frontend estatico/SPA fallback (servirIndice) -- no es API.
  return rutas.filter((r) => !/^GET (\/|\/index\.html|\/\{\*splat\})$/.test(r));
}

// ══════════════════════════════════════════════════════════════════
// 2) POLITICA DECLARADA — una entrada por cada ruta real de /api.
//    tipo:
//      'open'          — requireActor solamente, cualquier autenticado pasa.
//      'admin'         — isFullAdmin(actor) obligatorio.
//      'scopedRead'    — campaignAccess(actor, <query.campana|query.cliente>).
//      'scopedWrite'   — canLoadData(actor) Y campaignAccess(actor, body.campana).
//      'modulo:X'      — can(actor, 'X') (Inventario/Gerencia/GestionHumana).
//      'permiso:X'     — requirePermission(X) / accion puntual de usuarios.
//      'calidadEval'   — canEvaluateCampaign (rol CALIDAD/SUPERVISOR + campana).
//      'calidadManage' — canManageMonitoreos (rol REPORTES + campana).
//      'dataLoaderGlobal' — requireDataLoader (canLoadData global, sin
//                           distincion de cliente -- ver comentario de
//                           dashboards.js sobre /dashboard/secciones y
//                           /dashboard/cargas).
//      'cargaManual'   — familia de endpoints de carga masiva con esquema de
//                        fila complejo (ver cabecera del archivo): politica
//                        confirmada por LECTURA de codigo, no ejecutada aqui.
//      'skip'          — fuera de alcance de esta matriz (health, auth/login,
//                        guia-uso publica-tras-login, seed-demo/estado).
const POLITICA = {};
function declarar(rutas, tipo, extra) {
  rutas.forEach((r) => { POLITICA[r] = { tipo, ...extra }; });
}

declarar(['GET /health', 'POST /auth/login'], 'skip');
declarar(['PUT /auth/password', 'POST /auth/logout', 'GET /seed-demo/estado', 'GET /guia-uso'], 'open');
declarar(['GET /users'], 'open'); // ver routes/usuarios.js: perms/lastLogin se redactan adentro, no 403
declarar(['GET /historial', 'GET /seguridad/alertas'], 'admin');

declarar(['POST /users'], 'permiso:crearUsuarios');
declarar(['PUT /users/:id'], 'permiso:editarUsuarios');
declarar(['PUT /users/:id/password'], 'permiso:cambiarPassword');
declarar(['PUT /users/:id/active'], 'permiso:suspenderUsuarios');
declarar(['PUT /users/:id/perms'], 'permiso:gestionPermisos');
declarar(['DELETE /users/:id'], 'permiso:eliminarUsuarios');

// Calidad — plantillas/monitoreos/codificaciones/metas/nivel de servicio
declarar(['GET /calidad/plantillas'], 'open'); // filtra por campana adentro (lista), no 403 -- Fase 102 PR #225
declarar(['GET /monitoreos/mios', 'GET /monitoreos/mios/nuevos', 'PUT /monitoreos/:id/visto'], 'open'); // auto-scoped por actor.id/nombre
declarar(['GET /monitoreos'], 'scopedRead');
declarar(['POST /monitoreos'], 'calidadEval');
declarar(['POST /monitoreos/bulk'], 'calidadEval');
declarar(['PUT /monitoreos/:id', 'DELETE /monitoreos/:id'], 'calidadManage');
declarar(['GET /calidad/codificaciones'], 'scopedRead');
declarar(['POST /calidad/codificaciones/bulk', 'PUT /calidad/codificaciones/:id'], 'admin');
// Fase 122: alias de nombre de asesor -- a diferencia de codificaciones
// (lectura scoped por campana, escritura admin), aqui las 3 operaciones
// son admin-only (alta/baja/lista, pedido explicito de InCo).
declarar(['GET /alias-asesores', 'POST /alias-asesores', 'DELETE /alias-asesores/:id'], 'admin');
declarar(['GET /metas/cumplimiento', 'GET /metas/mi-meta'], 'scopedRead');
declarar(['GET /metas'], 'scopedReadOrAdmin'); // con campana: scoped: sin campana: admin
declarar(['POST /metas', 'PUT /metas/:id', 'DELETE /metas/:id'], 'admin');
declarar(['GET /calidad/nivel-servicio'], 'scopedReadOrAdmin');
declarar(['POST /calidad/nivel-servicio', 'PUT /calidad/nivel-servicio/:id', 'DELETE /calidad/nivel-servicio/:id'], 'admin');
declarar(['GET /calidad/nivel-servicio/diario'], 'scopedRead');
declarar(['POST /calidad/nivel-servicio/carga-diaria'], 'cargaManual');

// Trafico / Trafico WhatsApp / Agendas / Efectividad x2 / Tipificacion / Inasistencia
declarar(['GET /calidad/trafico/plantilla', 'GET /calidad/trafico/skills', 'GET /calidad/trafico/cobertura', 'GET /calidad/trafico/whatsapp/plantilla'], 'dataLoaderGlobal');
declarar(['PUT /calidad/trafico/skills/:skillName'], 'dataLoaderGlobal');
declarar(['GET /calidad/trafico/whatsapp'], 'scopedRead');
declarar(['POST /calidad/trafico/carga', 'POST /calidad/trafico/carga/impacto', 'POST /calidad/trafico/whatsapp/carga', 'POST /calidad/trafico/whatsapp/carga/impacto'], 'cargaManual');
declarar(['GET /calidad/agendas/opciones', 'GET /calidad/agendas/especialidad', 'GET /calidad/agendas/mensual', 'GET /calidad/agendas/linea', 'GET /calidad/agendas/ranking'], 'scopedRead');
declarar(['POST /calidad/agendas/carga/impacto', 'POST /calidad/agendas/carga'], 'cargaManual');
declarar(['GET /calidad/efectividad-agendamiento/opciones', 'GET /calidad/efectividad-agendamiento/ranking'], 'scopedRead');
declarar(['POST /calidad/efectividad-agendamiento/carga/impacto', 'POST /calidad/efectividad-agendamiento/carga'], 'cargaManual');
declarar(['GET /calidad/tipificacion/opciones', 'GET /calidad/tipificacion/por-tipo'], 'scopedRead');
declarar(['POST /calidad/tipificacion/carga/impacto', 'POST /calidad/tipificacion/carga'], 'cargaManual');
declarar(['GET /calidad/inasistencia/opciones', 'GET /calidad/inasistencia/resumen', 'GET /calidad/inasistencia/especialidad', 'GET /calidad/inasistencia/mensual'], 'scopedRead');
declarar(['POST /calidad/inasistencia/carga/impacto', 'POST /calidad/inasistencia/carga'], 'cargaManual');
declarar(['GET /calidad/efectividad-citas/opciones', 'GET /calidad/efectividad-citas/mensual'], 'scopedRead');
declarar(['POST /calidad/efectividad-citas/carga/impacto', 'POST /calidad/efectividad-citas/carga'], 'cargaManual');
declarar(['GET /calidad/salida/opciones', 'GET /calidad/salida/mensual'], 'scopedRead');
declarar(['POST /calidad/salida/carga/impacto', 'POST /calidad/salida/carga'], 'cargaManual');

// Umbrales
declarar(['GET /umbrales'], 'open');
declarar(['POST /umbrales', 'PUT /umbrales/:id', 'DELETE /umbrales/:id'], 'admin');

// Dashboards
declarar(['GET /dashboard/clientes'], 'open');
declarar(['GET /dashboard/secciones/:cliente', 'GET /dashboard/cargas'], 'dataLoaderGlobal');
declarar(['GET /dashboards/config', 'GET /dashboards/config/:cliente', 'POST /dashboards/config', 'PUT /dashboards/config/:cliente', 'DELETE /dashboards/config/:cliente'], 'admin');
declarar(['GET /dashboard/:cliente'], 'skip'); // gate por adapter.permiso variable segun el cliente -- cubierto indirectamente via can('Inventario'|'Gerencia'|'GestionHumana') en sus rutas propias
declarar(['POST /dashboard/cargas', 'DELETE /dashboard/cargas/:id'], 'dataLoaderGlobal');

// Fase 126: borrado de produccion por base+rango, solo administrador
// completo (ver server/tests/fase126-admin-borrado-rango.test.js para la
// matriz de candados especifica de esta ruta: dry-run, conteo esperado,
// campana fija a ORLANT, etc).
declarar(['POST /admin/borrado-rango'], 'admin');

// Inventario / Gerencia / Gestion Humana (modulos internos globales, sin campana)
declarar(['GET /inventario/items', 'GET /inventario/resumen', 'GET /inventario/movimientos'], 'modulo:Inventario');
declarar(['POST /inventario/items', 'PUT /inventario/items/:id', 'DELETE /inventario/items/:id', 'POST /inventario/movimientos', 'POST /inventario/carga-items', 'POST /inventario/carga-movimientos'], 'modulo:Inventario');
declarar(['GET /gerencia/kpis', 'GET /gerencia/periodos', 'GET /gerencia/resumen'], 'modulo:Gerencia');
declarar(['POST /gerencia/kpis', 'PUT /gerencia/kpis/:id', 'DELETE /gerencia/kpis/:id', 'POST /gerencia/carga'], 'moduloYcarga:Gerencia');
declarar(['GET /gh/personal', 'GET /gh/resumen'], 'modulo:GestionHumana');
declarar(['POST /gh/personal', 'PUT /gh/personal/:id', 'DELETE /gh/personal/:id'], 'modulo:GestionHumana');

// Query extra obligatoria por ruta (mas alla de `campana`), segun el
// esquema Zod real de validation.js (confirmado por lectura, Fase 118).
const EXTRA_QUERY = {
  'GET /calidad/efectividad-agendamiento/ranking': { mes: '2026-09' },
  'GET /calidad/tipificacion/opciones': { canal: 'LLAMADAS' },
  'GET /calidad/tipificacion/por-tipo': { canal: 'LLAMADAS' },
};

const rutasReales = inventarioRutas();

test('Fase 118 2A: toda ruta real tiene politica declarada (falla si aparece una ruta nueva sin clasificar)', () => {
  const sinPolitica = rutasReales.filter((r) => !POLITICA[r]);
  assert.deepEqual(sinPolitica, [], `Rutas SIN politica declarada en POLITICA (ver fase118-matriz-acceso.test.js): ${JSON.stringify(sinPolitica)}`);
});

test('Fase 118 2A: no hay politica declarada para una ruta que ya no existe (evita falsos positivos de cobertura)', () => {
  const huerfanas = Object.keys(POLITICA).filter((r) => POLITICA[r].tipo !== 'skip-noexiste' && !rutasReales.includes(r));
  assert.deepEqual(huerfanas, [], `Entradas de POLITICA que ya no corresponden a ninguna ruta real: ${JSON.stringify(huerfanas)}`);
});

// ══════════════════════════════════════════════════════════════════
// 3) MATRIZ DINAMICA — lecturas (GET): los 10 roles x propia/ajena.
// ══════════════════════════════════════════════════════════════════
function quienDeberiaPasarScoped(rol) {
  // campaignAccess: campana_PROPIA o cliente_PROPIA -- ver seedUsers().
  return ['ADMIN', 'CALIDAD', 'GERENCIA', 'CLIENTES_DASH', 'SUPERVISOR', 'REPORTES'].includes(rol);
}
function quienDeberiaPasarModulo(mod) {
  return { Inventario: ['ADMIN', 'INVENTARIO'], Gerencia: ['ADMIN', 'GERENCIA'], GestionHumana: ['ADMIN', 'GESTION_HUMANA'] }[mod];
}
function quienDeberiaPasarDataLoaderGlobal(rol) {
  // canLoadData: isFullAdmin o perms.cargarDatos===true -- en nuestro seed, solo REPORTES lo trae por defecto.
  return ['ADMIN', 'REPORTES'].includes(rol);
}

for (const [ruta, pol] of Object.entries(POLITICA)) {
  const [method, rawPath] = ruta.split(' ');
  if (method !== 'GET') continue;
  if (pol.tipo === 'skip' || pol.tipo === 'open' || pol.tipo === 'admin') continue; // open/admin se prueban aparte, una vez

  test(`Fase 118 2A matriz GET ${ruta} [${pol.tipo}] — 10 roles x propia/ajena`, async () => {
    const necesitaCliente = rawPath.includes(':cliente');
    const necesitaSkill = rawPath.includes(':skillName');
    let urlPath = rawPath.replace(':id', '1').replace(':skillName', 'skill-demo');

    for (const rol of TODOS_LOS_ROLES) {
      for (const campana of [PROPIA, AJENA]) {
        let url = '/api' + urlPath.replace(':cliente', encodeURIComponent(campana));
        if (!necesitaCliente) url += '?campana=' + encodeURIComponent(campana);
        const extra = EXTRA_QUERY[ruta];
        if (extra) url += '&' + Object.entries(extra).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
        const res = await request(app).get(url).set(auth(rol));

        let deberiaPasar;
        if (pol.tipo === 'scopedRead' || pol.tipo === 'scopedReadOrAdmin') {
          deberiaPasar = rol === 'ADMIN' || (campana === PROPIA && quienDeberiaPasarScoped(rol));
        } else if (pol.tipo.startsWith('modulo:')) {
          const mod = pol.tipo.split(':')[1];
          deberiaPasar = quienDeberiaPasarModulo(mod).includes(rol);
        } else if (pol.tipo === 'dataLoaderGlobal') {
          deberiaPasar = quienDeberiaPasarDataLoaderGlobal(rol);
        } else {
          continue; // calidadEval/calidadManage/cargaManual/moduloYcarga se prueban aparte (necesitan POST)
        }

        if (deberiaPasar) {
          assert.notEqual(res.status, 403, `${rol} campana=${campana} en ${ruta} deberia tener acceso (esperado != 403), vino ${res.status}: ${JSON.stringify(res.body)}`);
        } else {
          assert.equal(res.status, 403, `${rol} campana=${campana} en ${ruta} NO deberia tener acceso (esperado 403), vino ${res.status}: ${JSON.stringify(res.body)}`);
        }
      }
    }
  });
}

test('Fase 118 2A: rutas "open" responden 200/datos a cualquier rol autenticado, nunca 401/403', async () => {
  const abiertas = Object.entries(POLITICA).filter(([r, p]) => p.tipo === 'open' && r.startsWith('GET'));
  for (const [ruta] of abiertas) {
    const [, rawPath] = ruta.split(' ');
    const url = '/api' + rawPath.replace(':id', '1').replace(':cliente', PROPIA).replace(':skillName', 'skill-demo');
    for (const rol of TODOS_LOS_ROLES) {
      const res = await request(app).get(url).set(auth(rol));
      assert.notEqual(res.status, 401, `${ruta} con ${rol} no deberia dar 401`);
      assert.notEqual(res.status, 403, `${ruta} con ${rol} no deberia dar 403 (es 'open')`);
    }
  }
});

test('Fase 118 2A: rutas "admin" bloquean a los 9 roles no-admin, pasan ADMIN', async () => {
  const adminRutas = Object.entries(POLITICA).filter(([r, p]) => p.tipo === 'admin' && r.startsWith('GET'));
  for (const [ruta] of adminRutas) {
    const [, rawPath] = ruta.split(' ');
    // Fase 122: GET /alias-asesores exige `campana` en la query (igual que
    // calidadQuery de /calidad/codificaciones) -- se agrega aqui mismo, de
    // forma generica para CUALQUIER ruta admin futura que tambien la
    // necesite, en vez de un caso especial por ruta. Inofensivo para las
    // rutas admin que no la usan (Zod ignora claves de mas que no esten en
    // su esquema, ninguna de estas usa `.strict()`).
    const url = '/api' + rawPath.replace(':id', '1').replace(':cliente', PROPIA) + '?campana=' + encodeURIComponent(PROPIA);
    for (const rol of TODOS_LOS_ROLES) {
      const res = await request(app).get(url).set(auth(rol));
      if (rol === 'ADMIN') assert.notEqual(res.status, 403, `${ruta} con ADMIN no deberia dar 403`);
      else assert.equal(res.status, 403, `${ruta} con ${rol} deberia dar 403 (admin-only), vino ${res.status}`);
    }
  }
});

test('Fase 118 2A: GET /users sin rol de gestion de usuarios NO trae perms ajenos ni lastLogin (redaccion, no 403)', async () => {
  for (const rol of ['CALIDAD', 'INVENTARIO', 'GERENCIA', 'GESTION_HUMANA', 'CLIENTES_DASH', 'SUPERVISOR', 'ASESOR', 'REPORTES']) {
    const res = await request(app).get('/api/users').set(auth(rol));
    assert.equal(res.status, 200);
    const otros = res.body.filter((u) => u.user !== 'demo_' + rol.toLowerCase());
    otros.forEach((u) => {
      assert.deepEqual(u.perms, {}, `${rol} no deberia ver perms de ${u.user}`);
      assert.equal(u.lastLogin, undefined, `${rol} no deberia ver lastLogin de ${u.user}`);
    });
  }
  // AUX_ADMIN con editarUsuarios SI ve la vista completa (fullView), por diseno.
  const resAux = await request(app).get('/api/users').set(auth('AUX_ADMIN'));
  assert.equal(resAux.status, 200);
});

// ══════════════════════════════════════════════════════════════════
// 4) Calidad: canEvaluateCampaign (crear monitoreo) / canManageMonitoreos (editar/borrar)
// ══════════════════════════════════════════════════════════════════
function monitoreoBody(campana) {
  return { campana, asesor: 'Asesor Demo Matriz', fecha: '2026-09-15', canal: 'LLAMADA', answers: { '1': 'SI' } };
}

test('Fase 118 2A: POST /monitoreos (crear) solo CALIDAD/SUPERVISOR con acceso a la campana (canEvaluateCampaign)', async () => {
  for (const rol of TODOS_LOS_ROLES) {
    for (const campana of [PROPIA, AJENA]) {
      const res = await request(app).post('/api/monitoreos').set(auth(rol)).send(monitoreoBody(campana));
      const deberiaPasar = rol === 'ADMIN' || (campana === PROPIA && (rol === 'CALIDAD' || rol === 'SUPERVISOR'));
      if (deberiaPasar) assert.notEqual(res.status, 403, `crear monitoreo ${rol}/${campana} no deberia dar 403: ${JSON.stringify(res.body)}`);
      else assert.equal(res.status, 403, `crear monitoreo ${rol}/${campana} deberia dar 403, vino ${res.status}: ${JSON.stringify(res.body)}`);
    }
  }
});

test('Fase 118 2A: PUT/DELETE /monitoreos/:id solo REPORTES con acceso a la campana del monitoreo (canManageMonitoreos), nunca el autor original', async () => {
  // Admin crea un monitoreo real en ORLANT para tener un :id valido que editar/borrar.
  const creado = await request(app).post('/api/monitoreos').set(auth('ADMIN')).send(monitoreoBody(PROPIA));
  assert.equal(creado.status, 201, JSON.stringify(creado.body));
  const id = creado.body.id;
  for (const rol of TODOS_LOS_ROLES) {
    const res = await request(app).put(`/api/monitoreos/${id}`).set(auth(rol)).send({ observaciones: 'editado por matriz 118' });
    const deberiaPasar = rol === 'ADMIN' || rol === 'REPORTES'; // REPORTES tiene campana_ORLANT en el seed
    if (deberiaPasar) assert.notEqual(res.status, 403, `editar monitoreo con ${rol} no deberia dar 403: ${JSON.stringify(res.body)}`);
    else assert.equal(res.status, 403, `editar monitoreo con ${rol} deberia dar 403 (ni CALIDAD, que lo creo, puede editar: solo REPORTES/ADMIN), vino ${res.status}`);
  }
  const borrar = await request(app).delete(`/api/monitoreos/${id}`).set(auth('CLIENTES_DASH'));
  assert.equal(borrar.status, 403);
});

// ══════════════════════════════════════════════════════════════════
// 5) Modulos internos: Inventario / Gerencia / Gestion Humana (escritura)
// ══════════════════════════════════════════════════════════════════
test('Fase 118 2A: POST /inventario/items solo rol INVENTARIO o ADMIN', async () => {
  const body = { nombre: 'Item matriz 118', cantidad: 1 };
  for (const rol of TODOS_LOS_ROLES) {
    const res = await request(app).post('/api/inventario/items').set(auth(rol)).send(body);
    const deberiaPasar = rol === 'ADMIN' || rol === 'INVENTARIO';
    if (deberiaPasar) assert.notEqual(res.status, 403, `${rol}: ${JSON.stringify(res.body)}`);
    else assert.equal(res.status, 403, `${rol} deberia dar 403, vino ${res.status}`);
  }
});

test('Fase 118 2A: POST /gerencia/kpis exige canLoadData (cargarDatos) -- GERENCIA del seed NO lo trae (solo lectura), REPORTES SI', async () => {
  // dashboards.js / gerencia.js: cargar KPIs es canLoadData (permiso generico
  // "Cargar Datos"), deliberadamente INDEPENDIENTE de can('Gerencia') -- quien
  // sube datos no tiene que ser quien ve el dashboard ejecutivo. Confirmado
  // por lectura de server/routes/gerencia.js (POST /gerencia/kpis, linea 81).
  const body = { periodo: '2026-09', nombre: 'KPI matriz 118', valor: 1 };
  for (const rol of TODOS_LOS_ROLES) {
    const res = await request(app).post('/api/gerencia/kpis').set(auth(rol)).send(body);
    const deberiaPasar = quienDeberiaPasarDataLoaderGlobal(rol); // ADMIN o REPORTES (cargarDatos:true en el seed)
    if (deberiaPasar) assert.notEqual(res.status, 403, `${rol}: ${JSON.stringify(res.body)}`);
    else assert.equal(res.status, 403, `${rol} deberia dar 403 (gerencia es de solo lectura sin cargarDatos), vino ${res.status}`);
  }
  // Control explicito: GERENCIA (con acceso de VISTA al modulo) sigue sin
  // poder cargar KPIs -- es la aseveracion central de esta prueba.
  const resGerencia = await request(app).post('/api/gerencia/kpis').set(auth('GERENCIA')).send(body);
  assert.equal(resGerencia.status, 403, 'GERENCIA (solo vista) no deberia poder cargar KPIs');
});

test('Fase 118 2A: POST /gh/personal solo rol GESTION_HUMANA o ADMIN', async () => {
  const body = { nombre: 'Persona matriz 118', fecha_ingreso: '2026-01-15' };
  for (const rol of TODOS_LOS_ROLES) {
    const res = await request(app).post('/api/gh/personal').set(auth(rol)).send(body);
    const deberiaPasar = rol === 'ADMIN' || rol === 'GESTION_HUMANA';
    if (deberiaPasar) assert.notEqual(res.status, 403, `${rol}: ${JSON.stringify(res.body)}`);
    else assert.equal(res.status, 403, `${rol} deberia dar 403, vino ${res.status}`);
  }
});

// ══════════════════════════════════════════════════════════════════
// 6) Las 3 escaladas CRITICAS de la Fase 102 — reconfirmadas explicitamente
// ══════════════════════════════════════════════════════════════════
test('Fase 118 2A / Fase 102 escalada #1: crearUsuarios NO alcanza para crear un ADMIN o AUX_ADMIN', async () => {
  const res = await request(app).post('/api/users').set(auth('AUX_ADMIN')).send({
    nombre: 'Intento Escalada', user: 'intento_escalada_118', password: 'Intento#2026xx', rol: 'ADMIN',
  });
  assert.equal(res.status, 403, JSON.stringify(res.body));
  const res2 = await request(app).post('/api/users').set(auth('AUX_ADMIN')).send({
    nombre: 'Intento Escalada 2', user: 'intento_escalada_118b', password: 'Intento#2026xx', rol: 'AUX_ADMIN',
  });
  assert.equal(res2.status, 403, JSON.stringify(res2.body));
  // Control: AUX_ADMIN SI puede crear un rol no estructural (ej. INVENTARIO).
  const ok = await request(app).post('/api/users').set(auth('AUX_ADMIN')).send({
    nombre: 'Usuario normal 118', user: 'usuario_normal_118', password: 'Normal#2026xx', rol: 'INVENTARIO',
  });
  assert.equal(ok.status, 201, JSON.stringify(ok.body));
});

test('Fase 118 2A / Fase 102 escalada #2: cambiarPassword NO alcanza para resetear la clave de un ADMIN/AUX_ADMIN existente', async () => {
  const objetivo = db.prepare("SELECT id FROM users WHERE rol = 'AUX_ADMIN'").get();
  const res = await request(app).put(`/api/users/${objetivo.id}/password`).set(auth('AUX_ADMIN')).send({ password: 'NuevaClave#2026xx' });
  assert.equal(res.status, 403, JSON.stringify(res.body));
});

test('Fase 118 2A / Fase 102 escalada #3: gestionPermisos NO permite auto-otorgarse isAdmin ni otros permisos propios', async () => {
  // El seed no da gestionPermisos a nadie por defecto -- se lo damos a AUX_ADMIN
  // solo para esta prueba puntual (via admin), que es exactamente el escenario
  // original: "un actor CON gestionPermisos se autoedita".
  const auxRow = db.prepare("SELECT id FROM users WHERE rol = 'AUX_ADMIN'").get();
  const dar = await request(app).put(`/api/users/${auxRow.id}/perms`).set(auth('ADMIN')).send({ perms: { gestionPermisos: true, crearUsuarios: true, editarUsuarios: true, cambiarPassword: true, suspenderUsuarios: false, eliminarUsuarios: false } });
  assert.equal(dar.status, 200, JSON.stringify(dar.body));
  const reLogin = await request(app).post('/api/auth/login').send({ user: 'demo_aux_admin', password: 'Demo#AUX_ADMIN2026' });
  assert.equal(reLogin.status, 200);
  const tokenAux = reLogin.body.token;
  const autoescalada = await request(app)
    .put(`/api/users/${auxRow.id}/perms`)
    .set({ Authorization: 'Bearer ' + tokenAux })
    .send({ perms: { isAdmin: true } });
  assert.equal(autoescalada.status, 403, JSON.stringify(autoescalada.body));
});

// ══════════════════════════════════════════════════════════════════
// 7) CLIENTES_DASH nunca llega a nada de otra campana/modulo administrativo
//    (resumen agregado, apoyandose en la matriz de arriba + checks propios)
// ══════════════════════════════════════════════════════════════════
test('Fase 118 2A: CLIENTES_DASH -- 0 accesos fuera de ORLANT ni a ningun modulo administrativo', async () => {
  const rutasAdminYModulo = Object.entries(POLITICA).filter(([r, p]) =>
    r.startsWith('GET') && (p.tipo === 'admin' || p.tipo.startsWith('modulo:') || p.tipo === 'dataLoaderGlobal')
  );
  for (const [ruta] of rutasAdminYModulo) {
    const [, rawPath] = ruta.split(' ');
    // Fase 122: mismo agregado inofensivo de `?campana=` que la prueba de
    // arriba ("rutas admin bloquean...") -- GET /alias-asesores la exige.
    const url = '/api' + rawPath.replace(':id', '1').replace(':cliente', PROPIA) + '?campana=' + encodeURIComponent(PROPIA);
    const res = await request(app).get(url).set(auth('CLIENTES_DASH'));
    assert.equal(res.status, 403, `CLIENTES_DASH en ${ruta} deberia dar 403, vino ${res.status}`);
  }
  for (const [ruta, pol] of Object.entries(POLITICA)) {
    if (!ruta.startsWith('GET') || (pol.tipo !== 'scopedRead' && pol.tipo !== 'scopedReadOrAdmin')) continue;
    const [, rawPath] = ruta.split(' ');
    let urlAjena = '/api' + rawPath.replace(':cliente', AJENA) + (rawPath.includes(':cliente') ? '' : '?campana=' + encodeURIComponent(AJENA));
    const extra = EXTRA_QUERY[ruta];
    if (extra) urlAjena += '&' + Object.entries(extra).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
    const res = await request(app).get(urlAjena).set(auth('CLIENTES_DASH'));
    assert.equal(res.status, 403, `CLIENTES_DASH en ${ruta}?campana=AJENA deberia dar 403, vino ${res.status}`);
  }
});
