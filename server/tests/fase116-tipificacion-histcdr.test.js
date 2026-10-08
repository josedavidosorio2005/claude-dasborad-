// fase116-tipificacion-histcdr.test.js — Fase 116 (archivo real de Edwin,
// TIPIFICACIONES_ago-sep_2026.xlsx): el export completo HistCDR de Wolkvox
// trae 20 columnas (AGENT_NAME, DATE, DESTINY, TELEPHONE, COST, TIME_SEC,
// TIME_MIN, COD_ACT, DESCRIPTION_COD_ACT, COD_ACT_2, DESCRIPTION_COD_ACT_2,
// TYPE_INTERACTION, CUSTOMER_ID, HUNG_UP, CAMPAIGN_ID, CONN_ID, SKILL_ID,
// SKILL_NAME, AGENT_ID, COMMENT) -- sin columna HORA propia (a diferencia
// del formato viejo "hoja DATA"): DATE trae FECHA Y HORA juntas.
//
// Verificado contra el archivo real (solo ESTRUCTURA, nunca datos de
// pacientes): la celda DATE llega con numFmt "m/d/yy h:mm" -- con
// cellNF:true (necesario para que Trafico detecte el % real, cargas.js)
// SheetJS la convierte a un objeto Date dentro de
// XLSX.utils.sheet_to_json(ws,{header:1}), corrida por la zona horaria LOCAL
// de quien sube el archivo (mismo hallazgo exacto que WAIT_TIME/AHT, Fase
// 115) -- de ahi que la hora SOLO se derive del valor CRUDO recuperado de
// `ws` (tipificacionValorCrudoSiFechaBoxeada), nunca del Date boxeado.
//
// Caso real usado en estas pruebas: serial 46265.75425925926 == "8/31/26
// 18:06" (18:06:08 hora local de Colombia) -> fecha "2026-08-31", hora
// "18:06:08". Datos SIEMPRE inventados (nunca el archivo real de Edwin).
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  tipificacionCeldaRef,
  tipificacionValorCrudoSiFechaBoxeada,
  tipificacionParseFilas,
  tipificacionFilaComoArray,
} = require('../../public/js/tipificacion-logic.js');

// Columnas EXACTAS del export HistCDR real (20), en el mismo orden.
const HEADER_HISTCDR = [
  'AGENT_NAME', 'DATE', 'DESTINY', 'TELEPHONE', 'COST', 'TIME_SEC', 'TIME_MIN',
  'COD_ACT', 'DESCRIPTION_COD_ACT', 'COD_ACT_2', 'DESCRIPTION_COD_ACT_2',
  'TYPE_INTERACTION', 'CUSTOMER_ID', 'HUNG_UP', 'CAMPAIGN_ID', 'CONN_ID',
  'SKILL_ID', 'SKILL_NAME', 'AGENT_ID', 'COMMENT',
];
const IDX_HISTCDR = {};
HEADER_HISTCDR.forEach((h, i) => { IDX_HISTCDR[h] = i; });

// Serial real (ver cabecera) -- un Date "boxeado" cualquiera que lo
// represente; la logica nunca confia en su valor, solo en la celda cruda.
const SERIAL_REAL = 46265.75425925926;
const FECHA_BOXEADA = new Date('2026-08-31T23:06:07.999Z');

function filaHistCdrBoxeada(over) {
  const row = new Array(HEADER_HISTCDR.length).fill(null);
  row[IDX_HISTCDR.AGENT_NAME] = 'ASESOR DEMO UNO';
  row[IDX_HISTCDR.DATE] = FECHA_BOXEADA;
  row[IDX_HISTCDR.DESTINY] = '3010000000';
  row[IDX_HISTCDR.TELEPHONE] = '3010000000';
  row[IDX_HISTCDR.TIME_MIN] = 3;
  row[IDX_HISTCDR.DESCRIPTION_COD_ACT] = 'AGENDADA_InConexion';
  row[IDX_HISTCDR.TYPE_INTERACTION] = 'inbound';
  row[IDX_HISTCDR.CUSTOMER_ID] = 'CUST-0001-PACIENTE';
  row[IDX_HISTCDR.CONN_ID] = 'CONN-0001';
  row[IDX_HISTCDR.SKILL_NAME] = 'LINEA DE SALIDA';
  row[IDX_HISTCDR.COMMENT] = 'comentario con dato de paciente';
  Object.assign(row, over || {});
  return row;
}

test('tipificacionValorCrudoSiFechaBoxeada: Date + ws con la celda cruda numerica -> recupera el serial real (ignora el Date)', () => {
  const ws = { [tipificacionCeldaRef(1, 1)]: { t: 'n', v: SERIAL_REAL } };
  assert.equal(tipificacionValorCrudoSiFechaBoxeada(FECHA_BOXEADA, ws, 1, 1), SERIAL_REAL);
});

test('tipificacionValorCrudoSiFechaBoxeada: sin ws -- devuelve el Date tal cual', () => {
  assert.equal(tipificacionValorCrudoSiFechaBoxeada(FECHA_BOXEADA, null, 1, 1), FECHA_BOXEADA);
});

test('tipificacionValorCrudoSiFechaBoxeada: un numero normal (no Date) se devuelve sin tocar, aunque haya ws', () => {
  const ws = { [tipificacionCeldaRef(1, 1)]: { t: 'n', v: 999 } };
  assert.equal(tipificacionValorCrudoSiFechaBoxeada(46000, ws, 1, 1), 46000);
});

test('HistCDR: DATE boxeado por SheetJS, con `ws` -- fecha correcta y HORA derivada de la fraccion de dia (sin columna HORA propia)', () => {
  const aoa = [HEADER_HISTCDR, filaHistCdrBoxeada()];
  const ws = { [tipificacionCeldaRef(1, IDX_HISTCDR.DATE)]: { t: 'n', v: SERIAL_REAL } };
  const res = tipificacionParseFilas(aoa, ws);
  assert.ok(!res.error, JSON.stringify(res));
  assert.equal(res.filas.length, 1);
  assert.equal(res.filas[0].fecha, '2026-08-31');
  assert.equal(res.filas[0].hora, '18:06:08');
});

test('HistCDR: DATE boxeado SIN `ws` -- la fila se descarta (DATE invalida), nunca se inventa una fecha fragil dependiente de zona horaria', () => {
  const aoa = [HEADER_HISTCDR, filaHistCdrBoxeada()];
  const res = tipificacionParseFilas(aoa); // sin ws
  assert.ok(res.error, 'sin ws no hay como recuperar el serial real -- DATE queda invalida, ninguna fila valida');
  assert.ok(/DATE invalida/.test(res.avisos[0]));
});

test('HistCDR: fraccion de dia exactamente 0 (fecha sin hora real) -- hora queda null, nunca "00:00:00" inventado', () => {
  const serialSinHora = 46265; // mismo dia, sin fraccion
  const aoa = [HEADER_HISTCDR, filaHistCdrBoxeada({ [IDX_HISTCDR.DATE]: new Date('2026-08-31T05:00:00.000Z') })];
  const ws = { [tipificacionCeldaRef(1, IDX_HISTCDR.DATE)]: { t: 'n', v: serialSinHora } };
  const res = tipificacionParseFilas(aoa, ws);
  assert.ok(!res.error, JSON.stringify(res));
  assert.equal(res.filas[0].fecha, '2026-08-31');
  assert.equal(res.filas[0].hora, null);
});

test('Formato viejo (hoja DATA, columna HORA propia) sigue funcionando igual, aunque se pase `ws`', () => {
  const headerViejo = ['AGENT_NAME', 'DATE', 'HORA', 'TIME_MIN', 'DESCRIPTION_COD_ACT', 'SKILL_NAME'];
  const filaVieja = ['ASESOR DEMO UNO', '15/08/2026', '6:06:08 p. m.', 3, 'AGENDADA_InConexion', 'LLAMADAS DE SALIDA'];
  const aoa = [headerViejo, filaVieja];
  // ws vacio: DATE aqui es texto, no numero, asi que no hay nada que
  // recuperar -- el comportamiento debe ser EXACTAMENTE igual con o sin ws.
  const resConWs = tipificacionParseFilas(aoa, {});
  const resSinWs = tipificacionParseFilas(aoa);
  assert.deepEqual(resConWs.filas, resSinWs.filas);
  assert.equal(resConWs.filas[0].fecha, '2026-08-15');
  assert.equal(resConWs.filas[0].hora, '18:06:08');
});

// ── Privacidad (Fase 116, obligatorio del pedido): TELEPHONE, CUSTOMER_ID,
// COMMENT, CONN_ID y DESTINY nunca deben llegar al payload que se manda al
// servidor -- ni en el objeto `filas` que arma tipificacionParseFilas, ni en
// el array compacto que de verdad se envia (tipificacionFilaComoArray).
test('Privacidad: el archivo HistCDR completo (20 columnas) nunca deja pasar TELEPHONE/CUSTOMER_ID/COMMENT/CONN_ID/DESTINY al resultado', () => {
  const VALORES_SENSIBLES = ['3010000000', 'CUST-0001-PACIENTE', 'CONN-0001', 'comentario con dato de paciente'];
  const aoa = [HEADER_HISTCDR, filaHistCdrBoxeada()];
  const ws = { [tipificacionCeldaRef(1, IDX_HISTCDR.DATE)]: { t: 'n', v: SERIAL_REAL } };
  const res = tipificacionParseFilas(aoa, ws);
  assert.ok(!res.error, JSON.stringify(res));

  const filaObj = res.filas[0];
  // Fase 131 (Parte 3): 5 claves nuevas, legitimas (ninguna es PII -- ver
  // TIPIFICACION_CDR_COLUMNAS_PII_PROHIBIDAS en tipificacion-logic.js). Las
  // 7 columnas PROHIBIDAS (DESTINY/TELEPHONE/COST/CUSTOMER_ID/CONN_ID/
  // CAMPAIGN_ID/COMMENT, mas COD_ACT_2/DESCRIPTION_COD_ACT_2) sigue sin
  // aparecer ninguna.
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
