// fase174-orlant-reglas-cdr.test.js — Fase 174 (reglas de ORLANT confirmadas
// por Edwin): out_pre es salida (y no entrada de CANCELACIONES); "no
// conectada" es por cliente, en el registro (ORLANT: NO_CONTESTAN + BUZON;
// MOBILIZE: Cliente_no_contesta); plantillas con el export completo de
// Wolkvox (20 columnas del HistCDR, 32 del HistChat). Todo SINTETICO.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const T = require('../../public/js/tipificacion-logic.js');
const REG = require('../../public/js/registro-clientes.js');
const { salidaCombinadaPorMes } = require('../salida-cdr');
const { salidaNoConectadaDe } = require('../tipificaciones');
const { CARGAS, columnasDeCarga } = require('../../scripts/plantillas/modulos');
const reg = require('../clientes-registro');
const { request, app, tokenFor, MASTER_PASSWORD, db } = require('./helpers');

const auth = (t) => ({ Authorization: `Bearer ${t}` });
// Encabezado del HistCDR real (20 columnas, en orden), valores inventados.
const HISTCDR = ['AGENT_NAME', 'DATE', 'DESTINY', 'TELEPHONE', 'COST', 'TIME_SEC', 'TIME_MIN', 'COD_ACT', 'DESCRIPTION_COD_ACT',
  'COD_ACT_2', 'DESCRIPTION_COD_ACT_2', 'TYPE_INTERACTION', 'CUSTOMER_ID', 'HUNG_UP', 'CAMPAIGN_ID', 'CONN_ID', 'SKILL_ID',
  'SKILL_NAME', 'AGENT_ID', 'COMMENT'];
let n = 0;
const fila = (asesor, fecha, desc, tipo, skillId, skillName) => {
  n++;
  return [asesor, fecha, '3000000000', '3000000000', 0, 60 + n, 1, '1', desc, '-', '-', tipo, '100' + n, 'customer', '-', 'c' + n, skillId, skillName, '0', 'texto'];
};
function cdrSintetico() {
  return [HISTCDR,
    fila('Ana', '2025-11-03', 'NO_CONTESTAN', 'outbound_ma', '-', '-'),
    fila('Ana', '2025-11-03', 'BUZON', 'outbound_ma', '-', '-'),
    fila('Ana', '2025-11-03', 'AGENDADA_InConexion', 'outbound_ma', '-', '-'),
    fila('Beto', '2025-11-04', 'NO_CONTESTAN', 'out_pre', '4070', 'CANCELACIONES Y REPROGRAMACION'),
    fila('Beto', '2025-11-04', 'CITA_CANCELADA', 'out_pre', '4070', 'CANCELACIONES Y REPROGRAMACION'),
    fila('Beto', '2025-11-04', 'CITA_CANCELADA', 'inbound', '4070', 'CANCELACIONES Y REPROGRAMACION'),
    fila('Caro', '2025-11-05', 'Cliente_no_contesta', 'outbound_ma', '-', '-'),
    fila('Caro', '2025-11-05', 'Consulta', 'internalcall_que', '-', '-'),
  ];
}

test('lector: out_pre = salida (outbound_ma, skill LLAMADAS DE SALIDA, SKILL_ID 4070 conservado); no cuenta en CANCELACIONES', () => {
  const r = T.tipificacionParseFilas(cdrSintetico(), null, 'LLAMADAS');
  assert.ok(!r.error, r.error);
  assert.equal(r.salida, 6, '4 outbound_ma + 2 out_pre');
  const outPre = r.filas.filter((f) => f.skillId === '4070' && f.skill === 'LLAMADAS DE SALIDA');
  assert.equal(outPre.length, 2);
  outPre.forEach((f) => assert.equal(f.tipoInteraccion, 'outbound_ma'));
  assert.deepEqual(r.filas.filter((f) => f.skill === 'CANCELACIONES Y REPROGRAMACION').map((f) => f.tipoInteraccion), ['inbound'], 'en CANCELACIONES solo queda la de entrada');
  assert.equal(r.filas.find((f) => f.agente === 'Caro' && f.tipificacion === 'Consulta').skill, '-', 'internalcall sigue sin contar');
  // WhatsApp no cambia: out_pre no aplica al skill de llamadas.
  assert.ok(T.TIPIFICACION_CDR_TIPO_INTERACCION_SALIDA.includes('out_pre'));
});

test('registro: "no conectada" por cliente (ORLANT NO_CONTESTAN + BUZON; MOBILIZE Cliente_no_contesta); sin parametro, el de siempre', () => {
  const porNombre = Object.fromEntries(reg.leerRegistro(db).map((c) => [c.nombre, c.parametros.salidaNoConectada]));
  assert.deepEqual(porNombre.ORLANT, ['NO_CONTESTAN', 'BUZON']);
  assert.deepEqual(porNombre.MOBILIZE, ['Cliente_no_contesta']);
  assert.deepEqual(salidaNoConectadaDe(db, 'CLINICA AURORA'), ['Cliente_no_contesta'], 'sin parametro: el valor por defecto');
  // Copia del navegador y helper del lector.
  const orl = REG.REGISTRO_CLIENTES.find((c) => c.nombre === 'ORLANT');
  assert.deepEqual(T.tipificacionNoConectadaDe(orl.parametros), ['NO_CONTESTAN', 'BUZON']);
  assert.deepEqual(T.tipificacionNoConectadaDe({}), ['Cliente_no_contesta']);
  // Ninguna regla por nombre de cliente en el codigo de tipificacion.
  const src = require('fs').readFileSync(require.resolve('../tipificaciones'), 'utf8');
  assert.doesNotMatch(src, /campana === 'ORLANT'|NO_CONTESTAN/);
});

test('migracion: idempotente y no pisa un cambio de un administrador', () => {
  db.prepare("UPDATE clientes_registro SET parametros = json_set(parametros, '$.salidaNoConectada', json('[\"NO_CONTESTAN\"]')) WHERE nombre = 'ORLANT'").run();
  db.agregarSalidaNoConectada();
  assert.deepEqual(salidaNoConectadaDe(db, 'ORLANT'), ['NO_CONTESTAN']);
  db.prepare("UPDATE clientes_registro SET parametros = json_set(parametros, '$.salidaNoConectada', json('[\"NO_CONTESTAN\",\"BUZON\"]')) WHERE nombre = 'ORLANT'").run();
});

test('API: tarjetas de salida de ORLANT con su regla; Fase 183: las out_pre de CANCELACIONES quedan en su skill', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const r = T.tipificacionParseFilas(cdrSintetico(), null, 'LLAMADAS');
  const filas = r.filas.map(T.tipificacionFilaComoArray);
  const c = await request(app).post('/api/calidad/tipificacion/carga').set(auth(admin)).send({ campana: 'ORLANT', canal: 'LLAMADAS', filas });
  assert.equal(c.status, 201, JSON.stringify(c.body));
  const s = await request(app).get('/api/calidad/tipificacion/resumen-salida').query({ campana: 'ORLANT', desde: '2025-11-01', hasta: '2025-11-30' }).set(auth(admin));
  assert.equal(s.status, 200);
  // Fase 183: las 2 out_pre de CANCELACIONES ya no son salida (Edwin, 26/10); el "-" cuenta con
  // cualquier tipo: 4 outbound_ma + 1 "-" de otro tipo = 5.
  // No conectadas = NO_CONTESTAN + BUZON. Cliente_no_contesta NO es regla de ORLANT.
  assert.equal(s.body.total, 5);
  assert.equal(s.body.conectadas + s.body.noConectadas, 5);
  assert.equal(s.body.soloTotal, true);
  // Fase 183: Llamadas de salida trae las 5; CANCELACIONES, la de entrada + las 2 out_pre.
  const q = (skill) => request(app).get('/api/calidad/tipificacion/por-tipo').query({ campana: 'ORLANT', canal: 'LLAMADAS', desde: '2025-11-01', hasta: '2025-11-30', skill }).set(auth(admin));
  assert.equal((await q('LLAMADAS DE SALIDA')).body.total, 5);
  assert.equal((await q('CANCELACIONES Y REPROGRAMACION')).body.total, 3);
  // Fase 170: salida por asesor (sin linea asignada = Sin asignar); Fase 183: sin las out_pre.
  const nov = salidaCombinadaPorMes(db, 'ORLANT').find((m) => m.mes === '2025-11');
  assert.equal(nov.llamadasSinAsignar, 5);
});

test('Mobilize no cambia: su "no conectada" sigue siendo Cliente_no_contesta', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const filas = [
    ['Asesor Uno', '2025-11-10', '09:00:00', 1, 'Cliente_no_contesta', 'LLAMADAS DE SALIDA', 60, '1', 'outbound_ma', 'agent', '-'],
    ['Asesor Uno', '2025-11-10', '10:00:00', 1, 'NO_CONTESTAN', 'LLAMADAS DE SALIDA', 61, '1', 'outbound_ma', 'agent', '-'],
  ];
  assert.equal((await request(app).post('/api/calidad/tipificacion/carga').set(auth(admin)).send({ campana: 'MOBILIZE', canal: 'LLAMADAS', filas })).status, 201);
  const s = await request(app).get('/api/calidad/tipificacion/resumen-salida').query({ campana: 'MOBILIZE', desde: '2025-11-01', hasta: '2025-11-30' }).set(auth(admin));
  assert.deepEqual(s.body, { total: 2, conectadas: 1, noConectadas: 1 });
});

test('plantillas: el export completo de Wolkvox en su orden (20 del HistCDR, 32 del HistChat)', () => {
  const cols = (archivo) => columnasDeCarga(CARGAS.find((c) => c.archivo === archivo)).map((x) => x.encabezado);
  assert.deepEqual(cols('PLANTILLA_TIPIFICACION_LLAMADAS.xlsx'), HISTCDR);
  assert.deepEqual(cols('PLANTILLA_TIPIFICACION_WHATSAPP.xlsx'), ['CONN_ID', 'CHANNEL', 'DATE', 'DATE_CLOSE', 'ROUTING', 'CUSTOMER_NAME',
    'CUSTOMER_EMAIL', 'CUSTOMER_PHONE', 'CUSTOMER_CHARS', 'ASSIGNMENT_TIME', 'AGENT_AVERAGE_RESPONSE_TIME', 'AGENT_ID', 'AGENT_NAME',
    'AGENT_CHARS', 'TIME_ON_AGENT', 'CHAT_DURATION', 'COD_ACT', 'DESCRIPTION_COD_ACT', 'TRANSFER', 'TRANSFER_TYPE', 'COMMENTS',
    'CUSTOMER_ID', 'SKILL_ID', 'FIRST RESPONSE TIME', 'LAST_PARTICIPANT_WHO_SPOKE', 'EXTRA_FIELD', 'COMMENT', 'USER_ID', 'FEELING',
    'AGENT_DNI', 'AGENT_ANSWERS', 'BSUID']);
  const llam = CARGAS.find((c) => c.archivo === 'PLANTILLA_TIPIFICACION_LLAMADAS.xlsx');
  assert.match(llam.origen, /\[ruta pendiente de confirmar con Edwin\]/);
  assert.match(llam.origen, /out_pre/);
  // Las columnas con datos personales siguen sin leerse.
  const map = T.tipificacionColIndexMap(HISTCDR);
  T.TIPIFICACION_CDR_COLUMNAS_PII_PROHIBIDAS.forEach((p) => assert.ok(!Object.values(map).includes(HISTCDR.indexOf(p)), p));
});

test('DATE como texto "aaaa-mm-dd hh:mm:ss" (como lo puede dar la API): fecha y hora', () => {
  assert.equal(T.tipificacionParseFecha('2025-11-03 08:15:00'), '2025-11-03');
  assert.equal(T.tipificacionParseFecha('2025-11-03T08:15'), '2025-11-03');
  assert.equal(T.tipificacionParseFecha('2025-11-03 de mañana'), null);
  const r = T.tipificacionParseFilas([HISTCDR, fila('Ana', '2025-11-03 08:15:00', 'BUZON', 'outbound_ma', '-', '-')], null, 'LLAMADAS');
  assert.equal(r.filas[0].fecha, '2025-11-03');
  assert.equal(r.filas[0].hora, '08:15:00');
});
