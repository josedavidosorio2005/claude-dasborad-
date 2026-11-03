// fase223-fechas-texto.test.js — Fase 223 (revision del 3-nov, H2/H3/H4):
//  - H2: "05/10/2026" es 5 de octubre (DD/MM, Colombia), no 10 de mayo.
//  - H3: una fecha con hora de las 7 p. m. en adelante no se corre al dia
//    siguiente (antes `new Date(texto).toISOString()` la pasaba a UTC).
//  - H4: el "mes actual" por defecto es el de Colombia, no el de UTC.
// Una sola funcion (gdFechaTextoAIso, mes-global-logic.js) para los 4
// lectores de Excel; WhatsApp conserva su orden M/D/AAAA (export Wolkvox).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const JS = path.join(__dirname, '..', '..', 'public', 'js');
const { gdFechaTextoAIso, gdHoyLocal } = require(path.join(JS, 'mes-global-logic.js'));
const { cmParseFecha } = require(path.join(JS, 'calidad-carga-masiva-logic.js'));
const { traficoParseFecha } = require(path.join(JS, 'trafico-logic.js'));
const { traficoWppParseFecha } = require(path.join(JS, 'trafico-whatsapp-logic.js'));
const { fechaLimitesHoyColombia } = require('../fecha-limites');

// metas.js es solo del navegador: se evalua con mes-global-logic.js en el mismo sandbox.
function nsdParseFecha() {
  const sb = { console };
  sb.window = sb;
  vm.createContext(sb);
  vm.runInContext(fs.readFileSync(path.join(JS, 'mes-global-logic.js'), 'utf8'), sb);
  vm.runInContext(fs.readFileSync(path.join(JS, 'metas.js'), 'utf8'), sb);
  return sb._nsdParseFecha;
}

test('gdFechaTextoAIso: texto DD/MM/AAAA, con hora y fechas imposibles', () => {
  const casos = {
    '05/10/2026': '2026-10-05',
    '31/10/2026 20:30': '2026-10-31',
    '2026-10-31 23:59': '2026-10-31',
    '2026-10-31T20:30:00': '2026-10-31',
    '2026/10/31 21:00': '2026-10-31',
    '31-10-2026': '2026-10-31',
    '1/2/2026': '2026-02-01',
    '31/10/2026 8:30 p. m.': '2026-10-31',
    '13/13/2026': null,
    '31/02/2026': null,
    '29/02/2026': null,
    '29/02/2028': '2028-02-29',
    'octubre 31': null,
    '': null,
  };
  for (const [t, esperado] of Object.entries(casos)) assert.equal(gdFechaTextoAIso(t), esperado, JSON.stringify(t));
  assert.equal(gdFechaTextoAIso(null), null);
  assert.equal(gdFechaTextoAIso(new Date(NaN)), null);
});

test('gdFechaTextoAIso: fecha nativa de SheetJS y serial de Excel, como antes', () => {
  const XLSX = require('./helpers/sura-sinteticos').XLSX;
  // 46326 = 31/10/2026; 0.854 = 20:30
  const ws = XLSX.utils.aoa_to_sheet([['fecha'], [46326 + 20.5 / 24], [46326]]);
  ws.A2.z = 'yyyy-mm-dd hh:mm'; ws.A3.z = 'yyyy-mm-dd';
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'h');
  const leido = XLSX.read(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }), { cellDates: true }).Sheets.h;
  assert.ok(leido.A2.v instanceof Date);
  assert.equal(gdFechaTextoAIso(leido.A2.v), '2026-10-31');
  assert.equal(gdFechaTextoAIso(leido.A3.v), '2026-10-31');
  assert.equal(gdFechaTextoAIso(46326 + 20.5 / 24), '2026-10-31');
  assert.equal(gdFechaTextoAIso(46326), '2026-10-31');
});

test('WhatsApp conserva su orden M/D/AAAA y ya no corre la hora', () => {
  assert.equal(gdFechaTextoAIso('10/05/2026 20:30', { mesPrimero: true }), '2026-10-05');
  assert.equal(traficoWppParseFecha('10/05/2026'), '2026-10-05'); // regla mCorto de siempre
  assert.equal(traficoWppParseFecha('10/05/2026 20:30'), '2026-10-05'); // mismo orden con hora
  assert.equal(traficoWppParseFecha('8/1/26'), '2026-08-01');
  assert.equal(traficoWppParseFecha('2026-10-31 20:30'), '2026-10-31');
});

test('los 4 lectores de Excel usan la misma regla', () => {
  const nsd = nsdParseFecha();
  for (const f of [cmParseFecha, traficoParseFecha, nsd]) {
    assert.equal(f('05/10/2026'), '2026-10-05', f.name);
    assert.equal(f('31/10/2026 20:30'), '2026-10-31', f.name);
    assert.equal(f('2026-10-31 23:59'), '2026-10-31', f.name);
    assert.equal(f('13/13/2026'), null, f.name);
  }
  assert.equal(traficoWppParseFecha('2026-10-31 23:59'), '2026-10-31');
  assert.equal(nsd(46326), null, 'Nivel de servicio diario sigue sin aceptar un numero suelto');
});

test('con TZ=America/Bogota a las 8 p. m. del 31/10: el texto no se corre y el mes actual es 2026-10', () => {
  const ahora = '2026-11-01T01:00:00Z'; // 31/10/2026 20:00 en Colombia
  const codigo = `
    const js = ${JSON.stringify(JS)};
    const m = require(js + '/mes-global-logic.js');
    const c = require(js + '/calidad-carga-masiva-logic.js');
    const t = require(js + '/trafico-logic.js');
    const f = require(${JSON.stringify(path.join(__dirname, '..', 'fecha-limites.js'))});
    const d = new Date(${JSON.stringify(ahora)});
    console.log(JSON.stringify({
      navegador: m.gdHoyLocal(d).slice(0, 7),
      servidor: f.fechaLimitesHoyColombia(d).slice(0, 7),
      utc: d.toISOString().slice(0, 7),
      cm: c.cmParseFecha('2026-10-31 20:30'),
      trafico: t.traficoParseFecha('2026-10-31 21:15'),
    }));`;
  const r = JSON.parse(execFileSync(process.execPath, ['-e', codigo], { env: { ...process.env, TZ: 'America/Bogota' } }).toString());
  assert.equal(r.utc, '2026-11', 'la hora simulada ya es noviembre en UTC');
  assert.equal(r.navegador, '2026-10');
  assert.equal(r.servidor, '2026-10');
  assert.equal(r.cm, '2026-10-31');
  assert.equal(r.trafico, '2026-10-31');
  assert.equal(fechaLimitesHoyColombia(new Date(ahora)), '2026-10-31');
  assert.equal(typeof gdHoyLocal(), 'string');
});

test('no quedan "mes actual" ni "hoy" calculados en UTC en las pantallas y rutas de H4', () => {
  const navegador = ['calidad.js', 'metas.js', 'gerencia.js', 'session.js', 'inventario.js', 'historial.js'];
  for (const f of navegador) {
    assert.doesNotMatch(fs.readFileSync(path.join(JS, f), 'utf8'), /new Date\(\)\.toISOString\(\)\.slice\(0, ?(7|10)\)/, f);
  }
  const servidor = ['routes/calidad.js', 'routes/gerencia.js', 'dashboard-adapters.js'];
  for (const f of servidor) {
    assert.doesNotMatch(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), /new Date\(\)\.toISOString\(\)\.slice\(0, ?(7|10)\)/, f);
  }
});
