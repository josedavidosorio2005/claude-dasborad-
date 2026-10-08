// fase118-histcdr-privacidad.test.js — Fase 118, Parte 2B: datos de
// pacientes del HistCDR nunca llegan a ningun lugar que no deban.
//
// El export completo HistCDR de Wolkvox (20 columnas, ver
// fase116-tipificacion-histcdr.test.js) trae columnas con datos reales de
// pacientes: TELEPHONE, CUSTOMER_ID, COMMENT, CONN_ID, DESTINY y COST.
// Esta prueba demuestra, con valores centinela UNICOS por columna, que
// ninguno de esos valores sobrevive en ninguno de los puntos pedidos:
//
//   1. El payload que arma el navegador (tipificacionParseFilas /
//      tipificacionFilaComoArray) -- ya cubierto en parte por
//      fase116-tipificacion-histcdr.test.js (TELEPHONE/CUSTOMER_ID/
//      COMMENT/CONN_ID/DESTINY); aqui se repite con valores propios +
//      COST (que esa prueba no cubria) para una demostracion autocontenida
//      de esta fase.
//   2. El esquema del servidor (tipificacionFilaArraySchema, validation.js)
//      es un z.tuple(...) de 6 elementos SIN .rest() -- un 7mo elemento
//      (por ejemplo, un cliente comprometido que mande TELEPHONE a mano,
//      saltandose el navegador) se RECHAZA con 400 antes de tocar la base
//      o el permiso -- demostrado aqui disparando la peticion real contra
//      el servidor.
//   3. La base SQLite: la tabla `tipificaciones` (server/db.js) no tiene
//      columna para telefono/comentario/etc -- estructuralmente no puede
//      guardar lo que nunca llega. Confirmado aqui leyendo la fila
//      insertada completa (SELECT *) tras una carga legitima.
//   4. Los logs del servidor: ni server/routes/tipificaciones.js ni
//      server/tipificaciones.js tienen un solo console.log/console.error
//      (confirmado por grep, Fase 118) -- el unico log de esta ruta es
//      logEvent('TIPIFICACION_CARGA', ...), que solo guarda conteos y la
//      campana, nunca una fila.
//   5. El Historial: mismo logEvent de arriba -- se confirma aqui que su
//      payload no contiene ningun centinela.
//   6. Las respuestas de la API: GET /calidad/tipificacion/por-tipo hace
//      `SELECT tipificacion, COUNT(*) ... GROUP BY tipificacion` (ver
//      server/tipificaciones.js) -- nunca selecciona ni agente ni ninguna
//      otra columna de texto libre con datos de paciente. Confirmado aqui
//      pidiendo ese endpoint tras la carga y revisando la respuesta cruda.
//   7. Los exports a Excel: el dashboard de Tipificacion solo consume estos
//      mismos endpoints agregados (nunca una ruta "filas crudas") -- no
//      hay superficie nueva que revisar mas alla de (6).
//
// Datos SIEMPRE inventados (centinelas con prefijo FASE118_CENTINELA_).
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, tokenFor, MASTER_PASSWORD, db } = require('./helpers');
const {
  tipificacionColIndexMap,
  tipificacionParseFilas,
  tipificacionFilaComoArray,
} = require('../../public/js/tipificacion-logic.js');

const auth = (t) => ({ Authorization: `Bearer ${t}` });

// Columnas EXACTAS del export HistCDR real (20), mismo orden que
// fase116-tipificacion-histcdr.test.js.
const HEADER_HISTCDR = [
  'AGENT_NAME', 'DATE', 'DESTINY', 'TELEPHONE', 'COST', 'TIME_SEC', 'TIME_MIN',
  'COD_ACT', 'DESCRIPTION_COD_ACT', 'COD_ACT_2', 'DESCRIPTION_COD_ACT_2',
  'TYPE_INTERACTION', 'CUSTOMER_ID', 'HUNG_UP', 'CAMPAIGN_ID', 'CONN_ID',
  'SKILL_ID', 'SKILL_NAME', 'AGENT_ID', 'COMMENT',
];
const IDX = {};
HEADER_HISTCDR.forEach((h, i) => { IDX[h] = i; });

const CENTINELAS = {
  TELEPHONE: 'FASE118_CENTINELA_TELEPHONE_3009998877',
  CUSTOMER_ID: 'FASE118_CENTINELA_CUSTOMER_ID_PAC0042',
  COMMENT: 'FASE118_CENTINELA_COMMENT_dato_sensible_paciente',
  CONN_ID: 'FASE118_CENTINELA_CONN_ID_9988776655',
  DESTINY: 'FASE118_CENTINELA_DESTINY_3011112222',
  COST: 'FASE118_CENTINELA_COST_123456',
};

function filaHistCdr() {
  const row = new Array(HEADER_HISTCDR.length).fill(null);
  row[IDX.AGENT_NAME] = 'Asesor Centinela';
  row[IDX.DATE] = '2026-09-10';
  row[IDX.DESTINY] = CENTINELAS.DESTINY;
  row[IDX.TELEPHONE] = CENTINELAS.TELEPHONE;
  row[IDX.COST] = CENTINELAS.COST;
  row[IDX.TIME_MIN] = 4;
  row[IDX.DESCRIPTION_COD_ACT] = 'AGENDADA_InConexion';
  row[IDX.CUSTOMER_ID] = CENTINELAS.CUSTOMER_ID;
  row[IDX.CONN_ID] = CENTINELAS.CONN_ID;
  row[IDX.SKILL_NAME] = 'LINEA DEMO FASE 118';
  row[IDX.COMMENT] = CENTINELAS.COMMENT;
  return row;
}

test('Fase 118 2B.1: tipificacionParseFilas/tipificacionFilaComoArray nunca incluyen los 6 centinelas del HistCDR completo', () => {
  const map = tipificacionColIndexMap(HEADER_HISTCDR);
  // Confirma que el parser NO sabe donde estan las columnas sensibles (no
  // estan en el mapa de columnas reconocidas) -- la proteccion es
  // estructural, no un filtro aplicado despues.
  ['DESTINY', 'TELEPHONE', 'COST', 'CUSTOMER_ID', 'CONN_ID', 'COMMENT'].forEach((col) => {
    const key = { DESTINY: 'destiny', TELEPHONE: 'telephone', COST: 'cost', CUSTOMER_ID: 'customerId', CONN_ID: 'connId', COMMENT: 'comment' }[col];
    assert.equal(map[key], undefined, `${col} no deberia aparecer en el mapa de columnas reconocidas`);
  });

  const aoa = [HEADER_HISTCDR, filaHistCdr()];
  const res = tipificacionParseFilas(aoa);
  assert.ok(!res.error, JSON.stringify(res));
  assert.equal(res.filas.length, 1);

  const filaObj = res.filas[0];
  const filaArr = tipificacionFilaComoArray(filaObj);
  const payloadJson = JSON.stringify(filaObj);
  const arrayJson = JSON.stringify(filaArr);
  Object.values(CENTINELAS).forEach((v) => {
    assert.ok(!payloadJson.includes(v), `el objeto fila no debe contener: ${v}`);
    assert.ok(!arrayJson.includes(v), `el payload array (lo que se manda al servidor) no debe contener: ${v}`);
  });
  // Fase 131 (Parte 3): 5 claves nuevas, legitimas (ninguna es PII).
  assert.deepEqual(
    Object.keys(filaObj).sort(),
    ['agente', 'codAct', 'duracionMin', 'duracionSeg', 'fecha', 'hora', 'hungUp', 'skill', 'skillId', 'tipificacion', 'tipoInteraccion'].sort()
  );
});

test('Fase 118 2B.2: el servidor RECHAZA (400) una fila con un 12vo elemento (cliente comprometido saltandose el navegador)', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const filaConCentinelaColado = ['Asesor Centinela', '2026-09-10', '18:06:08', 4, 'AGENDADA_InConexion', 'LINEA DEMO FASE 118', null, null, null, null, null, CENTINELAS.TELEPHONE];
  const res = await request(app)
    .post('/api/calidad/tipificacion/carga')
    .set(auth(admin))
    .send({ campana: 'ORLANT', canal: 'LLAMADAS', filas: [filaConCentinelaColado] });
  assert.equal(res.status, 400, JSON.stringify(res.body));
  assert.ok(!JSON.stringify(res.body).includes(CENTINELAS.TELEPHONE), 'el error de validacion tampoco debe hacer eco del centinela');

  const enBase = db.prepare("SELECT COUNT(*) AS n FROM tipificaciones WHERE skill = 'LINEA DEMO FASE 118'").get();
  assert.equal(enBase.n, 0, 'nada debio insertarse en SQLite');
});

test('Fase 118 2B.3-2B.6: carga legitima -- SQLite, Historial y GET /por-tipo nunca contienen los centinelas', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const aoa = [HEADER_HISTCDR, filaHistCdr()];
  const parsed = tipificacionParseFilas(aoa);
  assert.ok(!parsed.error, JSON.stringify(parsed));
  const filasPayload = parsed.filas.map(tipificacionFilaComoArray);

  const carga = await request(app)
    .post('/api/calidad/tipificacion/carga')
    .set(auth(admin))
    .send({ campana: 'ORLANT', canal: 'LLAMADAS', archivoNombre: 'fase118-centinela.xlsx', filas: filasPayload });
  assert.equal(carga.status, 201, JSON.stringify(carga.body));
  assert.ok(!JSON.stringify(carga.body).split('').some(() => false)); // noop, deja explicito que se revisa la respuesta completa abajo
  Object.values(CENTINELAS).forEach((v) => {
    assert.ok(!JSON.stringify(carga.body).includes(v), `la respuesta 201 no debe contener: ${v}`);
  });

  // 2B.3 -- SQLite: la fila insertada completa (SELECT *) no trae ninguna
  // columna con datos de paciente (la tabla no tiene donde ponerlos).
  const fila = db.prepare("SELECT * FROM tipificaciones WHERE skill = 'LINEA DEMO FASE 118' ORDER BY id DESC LIMIT 1").get();
  assert.ok(fila, 'la fila legitima si debe quedar guardada');
  const filaJson = JSON.stringify(fila);
  Object.values(CENTINELAS).forEach((v) => {
    assert.ok(!filaJson.includes(v), `la fila guardada en SQLite no debe contener: ${v}`);
  });
  // Fase 131 (Parte 3): 5 columnas nuevas en la tabla, todas legitimas.
  assert.deepEqual(
    Object.keys(fila).sort(),
    [
      'id', 'campana', 'canal', 'agente', 'fecha', 'hora', 'duracionMin', 'tipificacion', 'skill',
      'duracionSeg', 'codAct', 'tipoInteraccion', 'hungUp', 'skillId',
      'archivoNombre', 'cargadoPorNombre', 'createdAt',
    ].sort()
  );

  // 2B.5 -- Historial: el evento TIPIFICACION_CARGA no trae ningun centinela.
  const hist = await request(app).get('/api/historial').set(auth(admin));
  assert.equal(hist.status, 200);
  const eventoCarga = hist.body.find((h) => h.accion === 'TIPIFICACION_CARGA' && (h.detalle || '').includes('reemplazada'));
  assert.ok(eventoCarga, 'deberia existir el evento de esta carga en el Historial');
  const histJson = JSON.stringify(eventoCarga);
  Object.values(CENTINELAS).forEach((v) => {
    assert.ok(!histJson.includes(v), `el evento del Historial no debe contener: ${v}`);
  });

  // 2B.6 -- GET /calidad/tipificacion/por-tipo: solo agregados (tipificacion + conteo).
  const porTipo = await request(app)
    .get('/api/calidad/tipificacion/por-tipo')
    .query({ campana: 'ORLANT', canal: 'LLAMADAS' })
    .set(auth(admin));
  assert.equal(porTipo.status, 200);
  const porTipoJson = JSON.stringify(porTipo.body);
  Object.values(CENTINELAS).forEach((v) => {
    assert.ok(!porTipoJson.includes(v), `GET /calidad/tipificacion/por-tipo no debe contener: ${v}`);
  });
});

test('Fase 118 2B.4: ni server/routes/tipificaciones.js ni server/tipificaciones.js tienen console.log/error/warn/debug (grep estatico)', () => {
  const fs = require('fs');
  const path = require('path');
  const archivos = [
    path.join(__dirname, '..', 'routes', 'tipificaciones.js'),
    path.join(__dirname, '..', 'tipificaciones.js'),
  ];
  archivos.forEach((f) => {
    const src = fs.readFileSync(f, 'utf8');
    assert.ok(!/console\.(log|error|warn|debug)\(/.test(src), `${f} no deberia tener console.* (solo logEvent, que nunca guarda filas crudas)`);
  });
});
