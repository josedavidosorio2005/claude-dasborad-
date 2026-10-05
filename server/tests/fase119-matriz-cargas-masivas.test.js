// fase119-matriz-cargas-masivas.test.js — Fase 119, Parte 3: cierra el
// hueco que la matriz de acceso de la Fase 118
// (fase118-matriz-acceso.test.js) dejo explicito -- las 7 familias de
// endpoints de carga masiva (esquemas Zod de fila demasiado grandes para
// esa matriz generica) quedaban confirmadas solo por LECTURA de codigo,
// no EJECUTADAS. Aqui se ejecutan de verdad, con los mismos cuerpos
// minimos validos ya probados en fase119-cargas-multi-mes.test.js,
// contra los 10 roles de seed:demo (sembrados con acceso SOLO a ORLANT)
// y 'CLINICA AURORA' como campaña ajena. Datos SIEMPRE inventados.
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
const tmpDb = path.join(os.tmpdir(), `inconexion-test-cargasmasivas-${process.pid}-${crypto.randomBytes(6).toString('hex')}.db`);
setEnvDefault('NODE_ENV', 'test');
setEnvDefault('JWT_SECRET', crypto.randomBytes(48).toString('hex'));
setEnvDefault('JWT_EXPIRES_IN', '1h');
setEnvDefault('MASTER_ADMIN_USER', 'admin');
const MASTER_PASSWORD = 'MasterCargasMasivas#2026';
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
const AJENA = 'CLINICA AURORA';
const TODOS_LOS_ROLES = ['ADMIN', 'AUX_ADMIN', 'CALIDAD', 'INVENTARIO', 'GERENCIA', 'GESTION_HUMANA', 'CLIENTES_DASH', 'SUPERVISOR', 'ASESOR', 'REPORTES'];

let tokens = {};

before(async () => {
  const { porRol } = seedUsers(db, { clientesList: [PROPIA], campanasCalidad: [PROPIA] });
  for (const [rol, row] of Object.entries(porRol)) {
    const u = db.prepare('SELECT * FROM users WHERE id = ?').get(row.id);
    const pass = 'Demo#' + rol + '2026';
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(pass, 10), row.id);
    const res = await request(app).post('/api/auth/login').send({ user: u.user, password: pass });
    assert.equal(res.status, 200, `login de seed demo ${rol} deberia funcionar: ${JSON.stringify(res.body)}`);
    tokens[rol] = res.body.token;
  }
  const admLogin = await request(app).post('/api/auth/login').send({ user: 'admin', password: MASTER_PASSWORD });
  assert.equal(admLogin.status, 200);
  tokens.ADMIN = admLogin.body.token;
});

after(() => {
  try { db.closeDb(); } catch (_) {}
  for (const suffix of ['', '-wal', '-shm']) {
    try { fs.unlinkSync(tmpDb + suffix); } catch (_) {}
  }
});

function auth(rol) { return { Authorization: 'Bearer ' + tokens[rol] }; }

// Solo REPORTES (cargarDatos:true en el seed) y ADMIN deberian pasar
// canLoadData; el resto (incluido CLIENTES_DASH) debe quedar en 403. Para
// la campaña AJENA, ni REPORTES pasa (campaignAccess tambien exige
// campana_/cliente_ de esa campaña puntual, que el seed nunca le dio) --
// EXCEPTO Trafico de Llamadas (ver abajo).
function deberiaPasar(rol, campana, familiaNombre) {
  if (rol === 'ADMIN') return true;
  if (rol === 'REPORTES') {
    // Hallazgo real (Fase 119, confirmado por lectura de
    // routes/trafico.js tras esta prueba fallar): a diferencia de las
    // otras 6 familias, POST /calidad/trafico/carga (voz) NO tiene
    // `campana` en su body ni gate de campaignAccess -- decision
    // EXPLICITA y documentada de una auditoria anterior (comentario en
    // routes/trafico.js: "auditoria 2026-09-15"), porque un solo archivo
    // trae varias skills que pueden resolver a campañas distintas via
    // el mapeo de trafico-skills.js. El limite real de este endpoint es
    // solo canLoadData (el permiso global "Cargar Datos"), nunca por
    // campaña puntual -- a diferencia de las otras 6 familias, que
    // double-gatean con campaignAccess ademas de canLoadData. Esto
    // significa que CUALQUIER actor con cargarDatos=true (sin importar a
    // que campaña especifica tenga acceso) puede cargar Trafico de
    // Llamadas de OTRA campaña con solo mapear una skill nueva a ella.
    // No es un bug nuevo -- es la unica de las 7 familias con esta
    // inconsistencia, documentada aqui para que quede visible (ver
    // reporte de cierre de la Fase 119).
    if (familiaNombre === 'Tráfico de Llamadas') return true;
    return campana === PROPIA;
  }
  return false;
}

// { nombre, endpoint, bodyFn(campana) } -- bodyFn arma un body VALIDO
// minimo (pasa Zod) para esa campaña, reusando las mismas formas de fila
// ya confirmadas en fase119-cargas-multi-mes.test.js.
const FAMILIAS = [
  {
    nombre: 'Tráfico de Llamadas',
    endpoint: '/api/calidad/trafico/carga',
    // Sin campaña explicita -- resuelve por mapeo skill->campaña. Se mapea
    // una skill nueva a cada campaña antes de cada intento (requiere
    // admin, pero el MAPEO no es lo que se prueba aqui, solo la carga).
    async bodyFn(campana, tag) {
      const skill = 'SKILL_MATRIZ_' + tag + '_' + Math.random().toString(36).slice(2, 8);
      await request(app).put('/api/calidad/trafico/skills/' + encodeURIComponent(skill)).set(auth('ADMIN')).send({ campana });
      return { filas: [{ fecha: '2026-03-10', skillName: skill, totalLlamadas: 10, contestadas: 9, nivelAtencionPct: 90 }] };
    },
  },
  {
    nombre: 'Tráfico de WhatsApp',
    endpoint: '/api/calidad/trafico/whatsapp/carga',
    bodyFn: async (campana) => ({ campana, filas: [{ colaWhatsapp: 'COLA MATRIZ ' + Math.random().toString(36).slice(2, 8), fechaInicio: '2026-03-01', fechaFin: '2026-03-31', totalWhatsapp: 10, contestados: 9 }] }),
  },
  {
    nombre: 'Tipificación',
    endpoint: '/api/calidad/tipificacion/carga',
    bodyFn: async (campana) => ({ campana, canal: 'LLAMADAS', filas: [['Asesor Matriz', '2026-03-10', '10:00:00', 2, 'AGENDADA_InConexion', 'SKILL MATRIZ']] }),
  },
  {
    nombre: 'Agendas',
    endpoint: '/api/calidad/agendas/carga',
    bodyFn: async (campana) => ({ campana, filas: [['ASESOR MATRIZ', 'SEDE X', 'EXAMEN X', 'ESP X', 'DR X', '2026-03-10 10:00:00', 'GENERAL', 'EPS X']] }),
  },
  {
    nombre: 'Inasistencia',
    endpoint: '/api/calidad/inasistencia/carga',
    bodyFn: async (campana) => ({ campana, filas: [['2026-03', 'SEDE MATRIZ', 'ESP MATRIZ', 'EPS MATRIZ', 1, 1, 0, 5, 7]] }),
  },
  {
    nombre: 'Efectividad de Agendamiento',
    endpoint: '/api/calidad/efectividad-agendamiento/carga',
    bodyFn: async (campana) => ({ campana, filas: [['2026-03', 'ASESOR MATRIZ', 80, 40]] }),
  },
  {
    nombre: 'Efectividad de Citas',
    endpoint: '/api/calidad/efectividad-citas/carga',
    bodyFn: async (campana) => ({ campana, filas: [['2026-03', 60, 30]] }),
  },
];

for (const familia of FAMILIAS) {
  test(`Fase 119 3: matriz de acceso EJECUTADA — ${familia.nombre} (${familia.endpoint}) × 10 roles × propia/ajena`, async () => {
    for (const rol of TODOS_LOS_ROLES) {
      for (const campana of [PROPIA, AJENA]) {
        const body = await familia.bodyFn(campana, rol + '_' + campana.replace(/\s+/g, ''));
        const res = await request(app).post(familia.endpoint).set(auth(rol)).send(body);
        if (deberiaPasar(rol, campana, familia.nombre)) {
          assert.notEqual(res.status, 403, `${familia.nombre}: ${rol}/${campana} deberia tener acceso (!=403), vino ${res.status}: ${JSON.stringify(res.body)}`);
        } else {
          assert.equal(res.status, 403, `${familia.nombre}: ${rol}/${campana} NO deberia tener acceso (403), vino ${res.status}: ${JSON.stringify(res.body)}`);
        }
      }
    }
  });
}

test('Fase 119 3: hallazgo real -- Trafico de Llamadas es la UNICA de las 7 familias sin campaignAccess en la carga (solo canLoadData, por diseño documentado)', async () => {
  // Confirma explicitamente la asimetria encontrada arriba: REPORTES
  // (cargarDatos:true, pero SOLO campana_ORLANT en el seed) SI puede
  // cargar Trafico de Llamadas mapeado a CLINICA AURORA...
  const skill = 'SKILL_HALLAZGO_' + Date.now();
  await request(app).put('/api/calidad/trafico/skills/' + encodeURIComponent(skill)).set(auth('ADMIN')).send({ campana: AJENA });
  const traficoAurora = await request(app).post('/api/calidad/trafico/carga').set(auth('REPORTES'))
    .send({ filas: [{ fecha: '2026-03-15', skillName: skill, totalLlamadas: 5, contestadas: 4, nivelAtencionPct: 80 }] });
  assert.equal(traficoAurora.status, 201, 'confirma el hallazgo: Trafico de Llamadas no exige campaignAccess, solo canLoadData');

  // ...pero NINGUNA de las otras 6 SI tiene campana explicita en el body
  // (Tipificacion, con canal propio, confirmada aparte).
  const otras = [
    { nombre: 'Trafico de WhatsApp', endpoint: '/api/calidad/trafico/whatsapp/carga', body: { campana: AJENA, filas: [{ colaWhatsapp: 'COLA H', fechaInicio: '2026-03-01', fechaFin: '2026-03-31', totalWhatsapp: 5, contestados: 4 }] } },
    { nombre: 'Agendas', endpoint: '/api/calidad/agendas/carga', body: { campana: AJENA, filas: [['ASESOR H', 'SEDE H', 'EXAMEN H', 'ESP H', 'DR H', '2026-03-15 10:00:00', 'GENERAL', 'EPS H']] } },
    { nombre: 'Inasistencia', endpoint: '/api/calidad/inasistencia/carga', body: { campana: AJENA, filas: [['2026-03', 'SEDE H', 'ESP H', 'EPS H', 1, 1, 0, 5, 7]] } },
    { nombre: 'Efectividad de Agendamiento', endpoint: '/api/calidad/efectividad-agendamiento/carga', body: { campana: AJENA, filas: [['2026-03', 'ASESOR H', 80, 40]] } },
    { nombre: 'Efectividad de Citas', endpoint: '/api/calidad/efectividad-citas/carga', body: { campana: AJENA, filas: [['2026-03', 60, 30]] } },
  ];
  for (const o of otras) {
    const res = await request(app).post(o.endpoint).set(auth('REPORTES')).send(o.body);
    assert.equal(res.status, 403, `${o.nombre} SI debe bloquear a REPORTES contra CLINICA AURORA (contraste con Trafico de Llamadas), vino ${res.status}`);
  }
});

test('Fase 119 3: CLIENTES_DASH no puede cargar NADA en ninguna de las 7 familias (ni su propia campaña)', async () => {
  for (const familia of FAMILIAS) {
    const body = await familia.bodyFn(PROPIA, 'cliedash');
    const res = await request(app).post(familia.endpoint).set(auth('CLIENTES_DASH')).send(body);
    assert.equal(res.status, 403, `${familia.nombre}: CLIENTES_DASH no debe poder cargar, vino ${res.status}`);
  }
});
