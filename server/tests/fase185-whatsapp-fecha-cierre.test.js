// Fase 185 (Edwin, octubre de WhatsApp: 9.036 filas en el archivo y 8.976 en
// el tablero; salida 2.663 y 2.646). Wolkvox arma el HistChat por FECHA DE
// CIERRE: los chats abiertos el ultimo dia del mes anterior vienen en el
// archivo del mes siguiente. Con DATE (apertura) se iban al mes anterior y,
// al reemplazar el rango, borraban ese dia del archivo anterior. Ahora el dia
// sale de DATE_CLOSE. Todo SINTETICO.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const T = require('../../public/js/tipificacion-logic.js');
const { cargarTipificaciones, tipificacionesPorTipo } = require('../tipificaciones');
const { db } = require('./helpers');

const MAPA = Object.fromEntries(require('../skills-whatsapp').SEMILLA_ORLANT);
const H = ['CONN_ID', 'CHANNEL', 'DATE', 'DATE_CLOSE', 'AGENT_NAME', 'DESCRIPTION_COD_ACT', 'SKILL_ID'];
// n chats de un skill, abiertos `abre` y cerrados `cierra` (texto aaaa-mm-dd hh:mm:ss).
function chats(n, skillId, abre, cierra) {
  return Array.from({ length: n }, (_, k) => ['C' + skillId + abre + k, 'whatsapp', abre + ' 23:' + String(10 + (k % 40)).padStart(2, '0') + ':00',
    cierra ? cierra + ' 08:00:00' : '', 'ASESOR ' + (k % 3), 'GESTION', skillId]);
}
// "Octubre": 30 chats abiertos y cerrados en octubre + 6 abiertos el 30/09 y
// cerrados el 1/10 (2 de salida) + 1 de un skill sin mapear (4308).
const OCTUBRE = [H, ...chats(20, '4306', '2026-10-02', '2026-10-02'), ...chats(10, '0', '2026-10-03', '2026-10-03'),
  ...chats(4, '4327', '2026-09-30', '2026-10-01'), ...chats(2, '0', '2026-09-30', '2026-10-01'), ...chats(1, '4308', '2026-10-04', '2026-10-04')];

test('HistChat: el dia sale de DATE_CLOSE -- las 37 filas del archivo quedan en octubre (salida 12), rango solo de octubre', () => {
  const r = T.tipificacionParseFilas(OCTUBRE, null, 'WHATSAPP', { skillsWhatsapp: MAPA });
  assert.equal(r.error, undefined);
  assert.equal(r.filas.length, 37);
  assert.equal(r.filas.filter((f) => f.fecha.startsWith('2026-10')).length, 37, 'sin el arreglo, 6 se iban a septiembre');
  assert.equal(r.filas.filter((f) => f.tipoInteraccion === 'outbound_ma').length, 12);
  assert.deepEqual(T.tipificacionRangoFechas(r.filas), { desde: '2026-10-01', hasta: '2026-10-04' });
  assert.equal(r.filas.filter((f) => f.skill === 'Skill 4308').length, 1, 'el skill sin mapear se guarda como "Skill 4308"');
});

test('HistChat: una fila sin DATE_CLOSE usa DATE y lo avisa; el archivo sin la columna sigue con DATE', () => {
  const r = T.tipificacionParseFilas([H, ...chats(2, '4306', '2026-10-05', '2026-10-05'), ...chats(1, '4306', '2026-10-06', '')], null, 'WHATSAPP', { skillsWhatsapp: MAPA });
  assert.equal(r.filas.length, 3);
  assert.ok(r.avisos.includes('1 fila(s) sin DATE_CLOSE: se tomó la fecha de DATE.'));
  const sinCol = T.tipificacionParseFilas([H.filter((h) => h !== 'DATE_CLOSE'), ['C1', 'whatsapp', '2026-09-30 23:00:00', 'ASESOR 1', 'GESTION', '4306']], null, 'WHATSAPP', { skillsWhatsapp: MAPA });
  assert.equal(sinCol.filas[0].fecha, '2026-09-30');
});

test('ninguna fila se pierde en silencio: resumen de omitidas por causa al principio de los avisos', () => {
  const malas = [['X1', 'whatsapp', '2026-10-07 09:00:00', '2026-10-07 09:10:00', '', 'GESTION', '4306'],
    ['X2', 'whatsapp', 'no es fecha', 'tampoco', 'ASESOR 1', 'GESTION', '4306']];
  const r = T.tipificacionParseFilas([H, ...chats(3, '4306', '2026-10-07', '2026-10-07'), ...malas], null, 'WHATSAPP', { skillsWhatsapp: MAPA });
  assert.equal(r.filas.length, 3);
  assert.equal(r.avisos[0], 'De 5 fila(s) del archivo se omitieron 2: 1 sin asesor, tipificación o skill, 1 con fecha inválida o vacía (detalle fila por fila abajo).');
});

test('DATE en texto "dd/mm/aaaa hh:mm:ss" ya no se descarta', () => {
  assert.equal(T.tipificacionParseFecha('01/10/2026 08:15:30'), '2026-10-01');
  assert.equal(T.tipificacionParseFecha('1/10/2026 8:15 p. m.'), '2026-10-01');
  assert.equal(T.tipificacionParseFecha('31/02/2026x'), null);
});

test('cargar septiembre y despues octubre ya no borra el 30/09; el total cuenta el skill sin mapear', () => {
  const sep = T.tipificacionParseFilas([H, ...chats(5, '4306', '2026-09-30', '2026-09-30'), ...chats(3, '4306', '2026-09-01', '2026-09-01')], null, 'WHATSAPP', { skillsWhatsapp: MAPA });
  const oct = T.tipificacionParseFilas(OCTUBRE, null, 'WHATSAPP', { skillsWhatsapp: MAPA });
  const cargar = (r) => cargarTipificaciones(db, { campana: 'ORLANT', canal: 'WHATSAPP', archivoNombre: 'x.xlsx', cargadoPorNombre: 'test', filas: r.filas.map(T.tipificacionFilaComoArray) });
  cargar(sep);
  cargar(oct);
  const total = (mes) => tipificacionesPorTipo(db, { campana: 'ORLANT', canal: 'WHATSAPP', mes }).total;
  assert.equal(total('2026-09'), 8, 'sin el arreglo, octubre borraba los 5 chats del 30/09');
  assert.equal(total('2026-10'), 37);
  assert.equal(tipificacionesPorTipo(db, { campana: 'ORLANT', canal: 'WHATSAPP', mes: '2026-10', skill: 'Skill 4308' }).total, 1);
});

test('vista: tarjeta "Total WhatsApp" en la mitad de WhatsApp, del mismo total que la torta', () => {
  const s = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', 'tipificacion.js'), 'utf8');
  assert.ok(s.includes("if(p.mostrarTarjetasSalida && esMultiCanal && c.canal === 'WHATSAPP')"));
  assert.ok(s.includes("(resultado.total||0).toLocaleString('es-CO')+'</div><div class=\"kl\">Total WhatsApp</div>"));
});
