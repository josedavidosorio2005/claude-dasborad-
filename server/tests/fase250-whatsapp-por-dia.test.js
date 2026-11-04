// fase250-whatsapp-por-dia.test.js — Fase 250 (pedido de Edwin, 04/11): en
// Trafico de WhatsApp › Flujo de WhatsApp se puede ver por dia, como en Flujo
// de Llamadas. Solo si cada fila de la base es de un dia (base diaria de
// Wolkvox); con filas de periodo (varios dias) el control no se ofrece.
// Las cifras por mes no cambian: la suma de los dias = el total del mes.
// Datos sinteticos.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const JS = path.join(__dirname, '..', '..', 'public', 'js');
const L = require(path.join(JS, 'trafico-whatsapp-logic.js'));

function diarias() {
  const filas = [];
  for (const mes of ['2026-09', '2026-10']) {
    for (let d = 1; d <= 28; d++) {
      for (const cola of ['COLA A', 'COLA B']) {
        const dia = mes + '-' + String(d).padStart(2, '0');
        const total = 20 + ((d * 7 + cola.length) % 13);
        const ab = d % 4;
        filas.push({ colaWhatsapp: cola, fechaInicio: dia, fechaFin: dia, totalWhatsapp: total, contestados: total - ab, abandonados: ab,
          serviceLevel20secPct: 60 + (d % 30), asaSegundos: 30 + d, ataSegundos: ab ? 50 + d : null, ahtSegundos: 200 + d });
      }
    }
  }
  return filas;
}

test('traficoWppPeriodoDe: "dia" devuelve AAAA-MM-DD; mes y año siguen igual', () => {
  assert.equal(L.traficoWppPeriodoDe('2026-10-07', 'dia'), '2026-10-07');
  assert.equal(L.traficoWppPeriodoDe('2026-10-07', 'mes'), '2026-10');
  assert.equal(L.traficoWppPeriodoDe('2026-10-07', 'anio'), '2026');
});

test('"Dia" solo se ofrece si TODAS las filas son de un dia', () => {
  const f = diarias();
  assert.equal(L.traficoWppTieneDia(f), true);
  assert.deepEqual(L.traficoWppGranularidades(f), ['dia', 'mes', 'anio']);
  const conPeriodo = f.concat([{ colaWhatsapp: 'COLA A', fechaInicio: '2026-08-01', fechaFin: '2026-08-31', totalWhatsapp: 900, contestados: 850 }]);
  assert.equal(L.traficoWppTieneDia(conPeriodo), false);
  assert.deepEqual(L.traficoWppGranularidades(conPeriodo), ['mes', 'anio']);
  assert.equal(L.traficoWppTieneDia([]), false);
  assert.deepEqual(L.traficoWppGranularidades([]), ['mes', 'anio']);
});

test('suma de los dias = total del mes (ingresados, contestados, abandonados), combinado y por cola', () => {
  const f = diarias();
  for (const combinar of [true, false]) {
    const porMes = L.traficoWppAgregarPorPeriodo(f, { granularidad: 'mes', combinar });
    const porDia = L.traficoWppAgregarPorPeriodo(f, { granularidad: 'dia', combinar });
    assert.equal(porDia.length, combinar ? 56 : 112);
    for (const m of porMes) {
      const dias = porDia.filter((d) => d.periodo.slice(0, 7) === m.periodo && (combinar || d.skillName === m.skillName));
      const suma = (k) => dias.reduce((a, d) => a + d[k], 0);
      assert.equal(suma('totalLlamadas'), m.totalLlamadas, m.periodo + ' total');
      assert.equal(suma('contestadas'), m.contestadas, m.periodo + ' contestadas');
      assert.equal(suma('llamadasAbandonadas'), m.llamadasAbandonadas, m.periodo + ' abandonadas');
    }
  }
  // el mes visto por dia o por mes da el mismo % de atencion (se recalcula de las sumas)
  const mes = L.traficoWppAgregarPorPeriodo(f, { granularidad: 'mes' })[1];
  const dias = L.traficoWppAgregarPorPeriodo(f, { granularidad: 'dia' }).filter((d) => d.periodo.startsWith('2026-10'));
  const t = dias.reduce((a, d) => a + d.totalLlamadas, 0), c = dias.reduce((a, d) => a + d.contestadas, 0);
  assert.equal(Math.round((c / t) * 10000) / 100, mes.nivelAtencionPct);
});

test('la pantalla arma el desplegable con traficoWppGranularidades y cae a "mes" si no hay dia', () => {
  const src = fs.readFileSync(path.join(JS, 'trafico-whatsapp.js'), 'utf8');
  assert.match(src, /var granOpc = traficoWppGranularidades\(datosCampana\.filas\);\n {2}if\(granOpc\.indexOf\(estado\.granularidad\) === -1\) estado\.granularidad = 'mes';/);
  assert.match(src, /'<select id="tww-f-gran-'\+i\+'">' \+ granOpc\.map\(/);
  assert.match(src, /var GRAN_LABEL = \{ dia:'Dia', mes:'Mes', anio:'Año' \};/);
  // mismo rotulo que Llamadas
  assert.match(fs.readFileSync(path.join(JS, 'trafico.js'), 'utf8'), /var GRAN_LABEL = \{ dia:'Dia', mes:'Mes', anio:'Año' \};/);
});
