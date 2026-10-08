// fase122-tipificacion-histchat.test.js — Fase 122 (export HistChat de
// WhatsApp de Wolkvox, archivo real TIPIFICACIONES_WPP.xlsx de Edwin,
// hoja "HistChat<fecha>-<hora>", cambia en cada export): 33 columnas, entre
// ellas CHANNEL, DATE, DATE_CLOSE, AGENT_NAME, DESCRIPTION_COD_ACT y
// "NOMBRE DE SKILL" (NO trae SKILL_NAME, a diferencia de HistCDR/formato
// viejo) -- nunca HORA ni TIME_MIN propias.
//
// Antes de esta fase: (1) el reconocimiento por encabezados
// (_cargasBuscarHojaPorEncabezados, cargas.js) solo aceptaba Tipificacion de
// LLAMADAS, nunca WHATSAPP -- un archivo con una hoja de nombre cambiante
// nunca se reconocia; (2) tipificacionParseFilas exigia SKILL_NAME exacto
// (este archivo no lo trae); (3) la eliminacion de duplicados exactos de la
// Fase 88 habria borrado en silencio 226 filas reales (envios masivos
// NO_CONTESTAN creados en el mismo segundo por el mismo asesor -- chats
// DISTINTOS con su propio CONN_ID, que nunca se lee ni se guarda).
//
// Datos SIEMPRE inventados (nunca el archivo real de Edwin, que tiene datos
// de pacientes reales).
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  tipificacionCeldaRef,
  tipificacionColIndexMap,
  tipificacionParseFilas,
  tipificacionFilaComoArray,
} = require('../../public/js/tipificacion-logic.js');
const { cargasDetectarCanalTipificacion } = require('../../public/js/cargas-logic.js');

// Subconjunto representativo de las 33 columnas reales de HistChat -- solo
// las que importan para estas pruebas (orden real conservado para las
// primeras; el resto del archivo real trae mas columnas de PII que esta
// plataforma nunca lee, ver fase122-tipificacion-histchat-privacidad abajo).
const HEADER_HISTCHAT = [
  'CONN_ID', 'CHANNEL', 'DATE', 'DATE_CLOSE', 'ROUTING', 'CUSTOMER_NAME',
  'CUSTOMER_EMAIL', 'CUSTOMER_PHONE', 'CUSTOMER_CHARS', 'ASSIGNMENT_TIME',
  'AGENT_AVERAGE_RESPONSE_TIME', 'AGENT_ID', 'AGENT_NAME', 'AGENT_CHARS',
  'TIME_ON_AGENT', 'CHAT_DURATION', 'COD_ACT', 'DESCRIPTION_COD_ACT',
  'TRANSFER', 'TRANSFER_TYPE', 'COMMENTS', 'CUSTOMER_ID', 'SKILL_ID',
  'FIRST RESPONSE TIME', 'LAST_PARTICIPANT_WHO_SPOKE', 'EXTRA_FIELD',
  'COMMENT', 'USER_ID', 'FEELING', 'AGENT_DNI', 'AGENT_ANSWERS', 'BSUID',
  'NOMBRE DE SKILL',
];
const IDX = {};
HEADER_HISTCHAT.forEach((h, i) => { IDX[h] = i; });

const HEADER_HISTCDR = ['AGENT_NAME', 'DATE', 'DESCRIPTION_COD_ACT', 'TYPE_INTERACTION', 'SKILL_NAME'];
const HEADER_VIEJO_WHATSAPP = ['AGENT_NAME', 'DATE', 'HORA', 'TIME_MIN', 'DESCRIPTION_COD_ACT', 'SKILL_NAME'];

function filaHistChat(over) {
  const row = new Array(HEADER_HISTCHAT.length).fill(null);
  row[IDX.CONN_ID] = 'CONN-FICTICIO-0001';
  row[IDX.CHANNEL] = 'whatsapp';
  row[IDX.CUSTOMER_NAME] = 'PACIENTE FICTICIO';
  row[IDX.CUSTOMER_EMAIL] = 'paciente.ficticio@ejemplo.com';
  row[IDX.CUSTOMER_PHONE] = '3000000000';
  row[IDX.AGENT_NAME] = 'ASESOR DEMO UNO';
  row[IDX.DESCRIPTION_COD_ACT] = 'NO_CONTESTAN';
  row[IDX.COMMENTS] = 'comentario con dato de paciente';
  row[IDX.CUSTOMER_ID] = 'CUST-FICTICIO-0001';
  row[IDX.EXTRA_FIELD] = 'extra ficticio';
  row[IDX.COMMENT] = 'otro comentario ficticio';
  row[IDX.USER_ID] = 'USER-FICTICIO-0001';
  row[IDX.AGENT_DNI] = '0000000000';
  row[IDX.BSUID] = 'BSUID-FICTICIO';
  row[IDX['NOMBRE DE SKILL']] = 'WHATSAPP ORLANT 3P';
  Object.assign(row, over || {});
  return row;
}

// ── Deteccion de canal (distingue HistChat de HistCDR y del formato viejo) ──
test('cargasDetectarCanalTipificacion: HistChat (NOMBRE DE SKILL, sin SKILL_NAME) -> WHATSAPP', () => {
  assert.equal(cargasDetectarCanalTipificacion(HEADER_HISTCHAT), 'WHATSAPP');
});
test('cargasDetectarCanalTipificacion: HistCDR (SKILL_NAME real) -> LLAMADAS', () => {
  assert.equal(cargasDetectarCanalTipificacion(HEADER_HISTCDR), 'LLAMADAS');
});
test('cargasDetectarCanalTipificacion: formato viejo de WhatsApp (SKILL_NAME real, Fase 77) -> LLAMADAS (nunca WHATSAPP por encabezados -- ese formato se reconoce por nombre exacto de hoja)', () => {
  assert.equal(cargasDetectarCanalTipificacion(HEADER_VIEJO_WHATSAPP), 'LLAMADAS');
});
test('cargasDetectarCanalTipificacion: un header sin ninguna de las 2 marcas -> null (ambiguo)', () => {
  assert.equal(cargasDetectarCanalTipificacion(['FOO', 'BAR']), null);
});

// ── Alias de columna NOMBRE DE SKILL -> skill ───────────────────────────
test('tipificacionColIndexMap: reconoce "NOMBRE DE SKILL" como la columna skill (alias, Fase 122)', () => {
  const map = tipificacionColIndexMap(HEADER_HISTCHAT);
  assert.equal(map.skill, IDX['NOMBRE DE SKILL']);
  assert.equal(map.agente, IDX.AGENT_NAME);
  assert.equal(map.tipificacion, IDX.DESCRIPTION_COD_ACT);
  assert.equal(map.fecha, IDX.DATE);
  assert.equal(map.hora, undefined); // no hay columna HORA propia en HistChat
});

// ── Parseo: fecha+hora juntas en DATE (serial de Excel), sin columna HORA ──
// Mismo mecanismo de la Fase 116 (tipificacionValorCrudoSiFechaBoxeada):
// 31/07/2026 23:05:00 UTC == 31/07/2026 18:05:00 hora Colombia.
const SERIAL_31JUL_1805 = 46234.753472222225; // 31/07/2026 18:05:00 hora Colombia
const FECHA_BOXEADA = new Date('2026-07-31T23:05:00.000Z');

test('HistChat: DATE boxeado por SheetJS, con `ws` -- fecha y hora correctas (hora sale de la fraccion de DATE, no hay columna HORA)', () => {
  const aoa = [HEADER_HISTCHAT, filaHistChat({ [IDX.DATE]: FECHA_BOXEADA })];
  const ws = { [tipificacionCeldaRef(1, IDX.DATE)]: { t: 'n', v: SERIAL_31JUL_1805 } };
  const res = tipificacionParseFilas(aoa, ws, 'WHATSAPP');
  assert.ok(!res.error, JSON.stringify(res));
  assert.equal(res.filas.length, 1);
  assert.equal(res.filas[0].fecha, '2026-07-31');
  assert.equal(res.filas[0].hora, '18:05:00');
  assert.equal(res.filas[0].duracionMin, null); // nunca CHAT_DURATION/TIME_ON_AGENT
  assert.equal(res.filas[0].skill, 'WHATSAPP ORLANT 3P');
});

// ── Zona horaria: TZ=UTC vs TZ=America/Bogota deben dar el MISMO resultado
// (mismo mecanismo que fase119-zonas-horarias.test.js) -- se corre este
// mismo archivo de prueba 2 veces, una por cada TZ, en el procedimiento de
// verificacion de esta fase (no aqui: node:test no permite cambiar TZ a
// mitad de proceso de forma confiable). Esta prueba confirma que el
// resultado NUNCA depende de `new Date()`/getters LOCALES -- solo lee el
// valor crudo de `ws`, que es independiente de la zona horaria del proceso.
test('HistChat: el resultado no usa ningun getter LOCAL del Date boxeado (solo el valor crudo de ws)', () => {
  const aoa = [HEADER_HISTCHAT, filaHistChat({ [IDX.DATE]: FECHA_BOXEADA })];
  const ws = { [tipificacionCeldaRef(1, IDX.DATE)]: { t: 'n', v: SERIAL_31JUL_1805 } };
  const resA = tipificacionParseFilas(aoa, ws, 'WHATSAPP');
  // Un Date boxeado DISTINTO (otra zona horaria lo habria boxeado distinto)
  // pero con la MISMA celda cruda -- el resultado debe ser identico, porque
  // solo se lee `ws`, nunca el objeto Date.
  const aoaOtraZona = [HEADER_HISTCHAT, filaHistChat({ [IDX.DATE]: new Date('2026-08-01T04:05:00.000Z') })];
  const resB = tipificacionParseFilas(aoaOtraZona, ws, 'WHATSAPP');
  assert.deepEqual(resA.filas, resB.filas);
});

test('HistChat: una fila del 31/07 con cierre el 01/08 (DATE_CLOSE) usa DATE (31/07), nunca DATE_CLOSE -- DATE_CLOSE ni siquiera se lee', () => {
  // DATE_CLOSE no esta en TIPIFICACION_COLUMNAS -- no hay forma de que
  // "contamine" el resultado aunque la fila la traiga con un valor
  // deliberadamente distinto (01/08) al de DATE (31/07).
  const aoa = [HEADER_HISTCHAT, filaHistChat({
    [IDX.DATE]: FECHA_BOXEADA,
    [IDX.DATE_CLOSE]: new Date('2026-08-01T02:00:00.000Z'),
  })];
  const ws = { [tipificacionCeldaRef(1, IDX.DATE)]: { t: 'n', v: SERIAL_31JUL_1805 } };
  const res = tipificacionParseFilas(aoa, ws, 'WHATSAPP');
  assert.ok(!res.error, JSON.stringify(res));
  assert.equal(res.filas[0].fecha, '2026-07-31');
});

// ── Duplicados: la Fase 88 NO se aplica al canal WHATSAPP ───────────────
test('WHATSAPP: 2 chats con la MISMA tupla agente+fecha+hora+tipificacion+skill (envio masivo en el mismo segundo) se CONSERVAN los 2 -- nunca se tratan como duplicado', () => {
  const filaA = filaHistChat({ [IDX.DATE]: FECHA_BOXEADA, [IDX.CONN_ID]: 'CONN-FICTICIO-0001' });
  const filaB = filaHistChat({ [IDX.DATE]: FECHA_BOXEADA, [IDX.CONN_ID]: 'CONN-FICTICIO-0002' }); // chat DISTINTO, mismo segundo
  const aoa = [HEADER_HISTCHAT, filaA, filaB];
  const ws = {
    [tipificacionCeldaRef(1, IDX.DATE)]: { t: 'n', v: SERIAL_31JUL_1805 },
    [tipificacionCeldaRef(2, IDX.DATE)]: { t: 'n', v: SERIAL_31JUL_1805 },
  };
  const res = tipificacionParseFilas(aoa, ws, 'WHATSAPP');
  assert.ok(!res.error, JSON.stringify(res));
  assert.equal(res.filas.length, 2, 'las 2 filas deben conservarse: son 2 chats reales, no un duplicado');
});

test('LLAMADAS (y sin el parametro canal): la misma tupla repetida SI se quita por la Fase 88, sin cambios de comportamiento', () => {
  const headerViejo = ['AGENT_NAME', 'DATE', 'HORA', 'TIME_MIN', 'DESCRIPTION_COD_ACT', 'SKILL_NAME'];
  const filaVieja = ['ASESOR DEMO UNO', '15/08/2026', '6:06:08 p. m.', 3, 'AGENDADA_InConexion', 'LLAMADAS DE SALIDA'];
  const aoa = [headerViejo, filaVieja, filaVieja.slice()];
  const resLlamadas = tipificacionParseFilas(aoa, null, 'LLAMADAS');
  const resSinCanal = tipificacionParseFilas(aoa);
  assert.equal(resLlamadas.filas.length, 1);
  assert.equal(resSinCanal.filas.length, 1);
});

// ── Privacidad: columnas de PII de HistChat nunca llegan al resultado ───
test('Privacidad: el archivo HistChat completo (33 columnas, con PII ficticia) nunca deja pasar CUSTOMER_*/COMMENTS/COMMENT/EXTRA_FIELD/USER_ID/AGENT_DNI/BSUID/CONN_ID/ROUTING al resultado', () => {
  const VALORES_SENSIBLES = [
    'PACIENTE FICTICIO', 'paciente.ficticio@ejemplo.com', '3000000000',
    'comentario con dato de paciente', 'CUST-FICTICIO-0001', 'extra ficticio',
    'otro comentario ficticio', 'USER-FICTICIO-0001', '0000000000',
    'BSUID-FICTICIO', 'CONN-FICTICIO-0001',
  ];
  const aoa = [HEADER_HISTCHAT, filaHistChat({ [IDX.DATE]: FECHA_BOXEADA })];
  const ws = { [tipificacionCeldaRef(1, IDX.DATE)]: { t: 'n', v: SERIAL_31JUL_1805 } };
  const res = tipificacionParseFilas(aoa, ws, 'WHATSAPP');
  assert.ok(!res.error, JSON.stringify(res));

  const filaObj = res.filas[0];
  // Fase 131 (Parte 3): 5 claves nuevas, legitimas -- HistChat SI trae
  // COD_ACT/SKILL_ID (se leen), pero no TIME_SEC/TYPE_INTERACTION/HUNG_UP
  // (quedan null). Ninguna de las columnas PII de la lista de arriba
  // (CUSTOMER_*/COMMENTS/COMMENT/EXTRA_FIELD/USER_ID/AGENT_DNI/BSUID/
  // CONN_ID/ROUTING) aparece como clave.
  assert.deepEqual(
    Object.keys(filaObj).sort(),
    ['agente', 'codAct', 'duracionMin', 'duracionSeg', 'fecha', 'hora', 'hungUp', 'skill', 'skillId', 'tipificacion', 'tipoInteraccion'].sort()
  );

  const payloadJson = JSON.stringify(filaObj);
  const arrayJson = JSON.stringify(tipificacionFilaComoArray(filaObj));
  VALORES_SENSIBLES.forEach((v) => {
    assert.ok(!payloadJson.includes(v), 'el objeto fila no debe contener: ' + v);
    assert.ok(!arrayJson.includes(v), 'el payload array no debe contener: ' + v);
  });
});
