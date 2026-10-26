// fase187-salida-una-clasificacion.test.js — Fase 187 (OK de Edwin, 26/10:
// una sola clasificacion de asesores). La pestaña "Llamadas y WhatsApp de
// salida" (Fase 170) usa la clasificacion por cliente de Tipificacion (Fase
// 186) cuando el cliente tiene parametros.salidaUsaClasificacion = true; la
// linea mes a mes deja de usarse pero NO se borra. Antes de encenderlo, el
// administrador ve (solo lectura) que meses tienen linea propia. Todo SINTETICO.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { salidaCombinadaPorMes, inventarioLineasPorMes } = require('../salida-cdr');
const { salidaPorLinea } = require('../clasificacion-asesores');
const { request, app, tokenFor, MASTER_PASSWORD, SEED, db } = require('./helpers');

const auth = (t) => ({ Authorization: `Bearer ${t}` });
const JS = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', f), 'utf8');
const tip = (agente, fecha, skill, tipo) => [agente, fecha, '09:00:00', null, 'AGENDADA', skill, null, null, tipo, null, null];
const veces = (n, f) => Array.from({ length: n }, f);
function encender(valor) {
  const r = db.prepare("SELECT parametros FROM clientes_registro WHERE nombre = 'ORLANT'").get();
  const p = JSON.parse(r.parametros || '{}');
  if (valor) p.salidaUsaClasificacion = true; else delete p.salidaUsaClasificacion;
  db.prepare("UPDATE clientes_registro SET parametros = ? WHERE nombre = 'ORLANT'").run(JSON.stringify(p));
}

test('una sola clasificacion: la pestaña de salida usa la por cliente; lo guardado mes a mes no se pierde y se ve antes de migrar', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  encender(false); // como estaba antes de la migracion (paso 2)
  const post = async (canal, filas) => {
    const r = await request(app).post('/api/calidad/tipificacion/carga').set(auth(admin)).send({ campana: 'ORLANT', canal, archivoNombre: 's.xlsx', filas });
    assert.equal(r.status, 201, JSON.stringify(r.body));
  };
  // Septiembre y octubre 2025. Llamadas de salida: Ana 3+2, Beto 2+1, Caro 1+1. WhatsApp: Ana 1+1, Caro 2+0.
  await post('LLAMADAS', [...veces(3, () => tip('Ana', '2025-09-02', '-', 'outbound_ma')), ...veces(2, () => tip('Beto', '2025-09-03', '-', 'outbound_ma')), tip('Caro', '2025-09-04', '-', 'outbound_ma'),
    tip('Beto', '2025-09-05', 'CALL INBOUND ORLANT 3P', 'inbound')]);
  await post('LLAMADAS', [...veces(2, () => tip('Ana', '2025-10-02', '-', 'outbound_ma')), tip('Beto', '2025-10-03', '-', 'outbound_ma'), tip('Caro', '2025-10-04', '-', 'outbound_ma')]);
  await post('WHATSAPP', [tip('Ana', '2025-09-02', 'WHATSAPP DE SALIDA', 'outbound_ma'), ...veces(2, () => tip('Caro', '2025-09-03', 'WHATSAPP DE SALIDA', 'outbound_ma'))]);
  await post('WHATSAPP', [tip('Ana', '2025-10-02', 'WHATSAPP DE SALIDA', 'outbound_ma')]);

  // Lo guardado mes a mes (Fase 170): septiembre Ana 3P, Beto General; octubre Ana General (cambio), Beto General.
  const putMes = (mes, asignaciones) => request(app).put('/api/calidad/salida/asesores').set(auth(admin)).send({ campana: 'ORLANT', mes, asignaciones });
  assert.equal((await putMes('2025-09', [{ agente: 'Ana', linea: '3P' }, { agente: 'Beto', linea: 'GENERAL' }])).status, 200);
  assert.equal((await putMes('2025-10', [{ agente: 'Ana', linea: 'GENERAL' }, { agente: 'Beto', linea: 'GENERAL' }])).status, 200);
  // Clasificacion por cliente (Tipificacion): Ana 3P, Caro 3P, Beto sin clasificar.
  const r = await request(app).put('/api/calidad/tipificacion/clasificacion-asesores').set(auth(admin))
    .send({ campana: 'ORLANT', asignaciones: [{ agente: 'Ana', linea: '3P' }, { agente: 'Caro', linea: '3P' }] });
  assert.equal(r.status, 200);

  // Sin encender: la pestaña sigue con la linea por mes (igual que la Fase 170).
  let porMes = Object.fromEntries(salidaCombinadaPorMes(db, 'ORLANT').map((f) => [f.mes, f]));
  assert.deepEqual([porMes['2025-09'].llamadas3p, porMes['2025-09'].llamadasGeneral, porMes['2025-09'].llamadasSinAsignar], [3, 2, 1]);
  assert.equal(porMes['2025-09'].lineaPorCliente, undefined);

  // Inventario de solo lectura (antes de migrar): que meses tienen linea propia y que asesor cambia de linea.
  const inv = await request(app).get('/api/calidad/salida/lineas-por-mes').query({ campana: 'ORLANT' }).set(auth(admin));
  assert.equal(inv.status, 200);
  assert.deepEqual(inv.body.meses, [{ mes: '2025-09', asesores: 2, p3: 1, general: 1 }, { mes: '2025-10', asesores: 2, p3: 0, general: 2 }]);
  assert.deepEqual(inv.body.conflictos, [{ agente: 'Ana', porMes: { '2025-09': '3P', '2025-10': 'GENERAL' } }]);
  assert.deepEqual(inv.body.propuesta, { Beto: 'GENERAL' });
  assert.deepEqual(inv.body.distintaDeClasificacion, []);
  assert.equal(inv.body.usaClasificacionPorCliente, false);
  for (const [u, pw] of [['agomez', SEED.agomez], ['crodriguez', SEED.crodriguez]]) {
    const t = await tokenFor(u, pw);
    assert.equal((await request(app).get('/api/calidad/salida/lineas-por-mes').query({ campana: 'ORLANT' }).set(auth(t))).status, 403, u);
  }

  // Encendido: todos los meses con la clasificacion por cliente (Ana y Caro 3P, Beto sin clasificar).
  encender(true);
  porMes = Object.fromEntries(salidaCombinadaPorMes(db, 'ORLANT').map((f) => [f.mes, f]));
  assert.deepEqual(porMes['2025-09'], { mes: '2025-09', llamadas3p: 4, llamadasGeneral: 0, llamadasSinAsignar: 2, wpp3p: 3, wppGeneral: 0, wppSinAsignar: 0,
    fuenteLlamadas: 'cdr', fuenteWpp: 'cdr', asesoresSinAsignar: 1, lineaPorCliente: true });
  assert.deepEqual(porMes['2025-10'], { mes: '2025-10', llamadas3p: 3, llamadasGeneral: 0, llamadasSinAsignar: 1, wpp3p: 1, wppGeneral: 0, wppSinAsignar: 0,
    fuenteLlamadas: 'cdr', fuenteWpp: 'cdr', asesoresSinAsignar: 1, lineaPorCliente: true });
  // Una sola clasificacion: la pestaña de salida y la Tipificacion dan lo mismo en cada mes.
  for (const mes of ['2025-09', '2025-10']) {
    const ll = salidaPorLinea(db, { campana: 'ORLANT', canal: 'LLAMADAS', mes });
    const wp = salidaPorLinea(db, { campana: 'ORLANT', canal: 'WHATSAPP', mes });
    const f = porMes[mes];
    assert.deepEqual([f.llamadas3p, f.llamadasGeneral, f.llamadasSinAsignar], [ll.p3, ll.general, ll.sinClasificar], 'llamadas ' + mes);
    assert.deepEqual([f.wpp3p, f.wppGeneral, f.wppSinAsignar], [wp.p3, wp.general, wp.sinClasificar], 'WhatsApp ' + mes);
    assert.equal(f.llamadas3p + f.llamadasGeneral + f.llamadasSinAsignar, ll.salida, 'General + 3P + Sin clasificar = salida ' + mes);
  }
  // Lo guardado mes a mes sigue en la base (no se borra) y ya no se puede cambiar.
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM asesor_linea WHERE campana = 'ORLANT'").get().n, 4);
  const p409 = await putMes('2025-09', []);
  assert.equal(p409.status, 409);
  assert.match(p409.body.error, /Clasificación de asesores/);
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM asesor_linea WHERE campana = 'ORLANT'").get().n, 4);
  // Cambiar la clasificacion por cliente cambia la pestaña en todos los meses.
  await request(app).put('/api/calidad/tipificacion/clasificacion-asesores').set(auth(admin))
    .send({ campana: 'ORLANT', asignaciones: [{ agente: 'Ana', linea: '3P' }, { agente: 'Caro', linea: '3P' }, { agente: 'Beto', linea: 'GENERAL' }] });
  const sep = salidaCombinadaPorMes(db, 'ORLANT').find((f) => f.mes === '2025-09');
  assert.deepEqual([sep.llamadas3p, sep.llamadasGeneral, sep.llamadasSinAsignar, sep.asesoresSinAsignar], [4, 2, 0, 0]);
  encender(false);
});

test('vista: la pestaña de salida usa "Sin clasificar" y la misma ventana; el admin ve lo guardado mes a mes', () => {
  const s = JS('salida.js');
  assert.ok(s.includes("function _salSinTexto(f){ return f && f.lineaPorCliente ? 'Sin clasificar' : 'Sin asignar'; }"));
  assert.ok(s.includes("onclick=\"salAbrirClasificacion(\\''+esc(campana)+'\\', \\''+esc(mesSel)+'\\')\">Clasificación de asesores</button>"));
  assert.ok(s.includes("'/calidad/salida/lineas-por-mes?campana='"));
  // Fase 189: la tabla se arma por canal ("Llamadas sin clasificar" / "WhatsApp sin clasificar").
  assert.ok(s.includes("fila(canal+' '+sinTxt,"));
  const t = JS('tipificacion.js');
  assert.ok(t.includes('async function tipifAbrirClasificacionCliente(campana, alGuardar){'));
  assert.ok(t.includes("if(typeof _tipifClasif.alGuardar === 'function') _tipifClasif.alGuardar();"));
  assert.ok(JS('dashboard-generic.js').includes("'Línea General': f.llamadasGeneral, [_salSinTexto(f)]: sin,"));
});

test('migracion (paso 2): copia a la clasificacion por cliente solo los asesores con una sola linea, sin pisar ni borrar nada; enciende el parametro; idempotente', () => {
  db.prepare("DELETE FROM asesor_linea WHERE campana = 'ORLANT'").run();
  db.prepare("DELETE FROM asesor_clasificacion WHERE campana = 'ORLANT'").run();
  const ins = db.prepare("INSERT INTO asesor_linea (campana, mes, agente, linea, updatedAt) VALUES ('ORLANT', ?, ?, ?, 'x')");
  // Mig1: 3P en 2 meses (se copia). Mig2: 3P y General (no se copia). Mig3: General, ya clasificado 3P (no se pisa).
  ins.run('2025-08', 'Mig1', '3P'); ins.run('2025-09', 'Mig1', '3P');
  ins.run('2025-08', 'Mig2', '3P'); ins.run('2025-09', 'Mig2', 'GENERAL');
  ins.run('2025-09', 'Mig3', 'GENERAL');
  db.prepare("INSERT INTO asesor_clasificacion (campana, agente, linea, updatedAt) VALUES ('ORLANT', 'Mig3', '3P', 'x')").run();
  encender(false);
  const inv = inventarioLineasPorMes(db, 'ORLANT');
  assert.deepEqual(inv.propuesta, { Mig1: '3P', Mig3: 'GENERAL' });
  assert.deepEqual(inv.conflictos.map((c) => c.agente), ['Mig2']);
  assert.deepEqual(inv.distintaDeClasificacion, [{ agente: 'Mig3', porMes: 'GENERAL', porCliente: '3P' }]);

  db.activarSalidaUnaClasificacion();
  db.activarSalidaUnaClasificacion(); // idempotente
  const clasif = Object.fromEntries(db.prepare("SELECT agente, linea FROM asesor_clasificacion WHERE campana = 'ORLANT'").all().map((f) => [f.agente, f.linea]));
  assert.deepEqual(clasif, { Mig1: '3P', Mig3: '3P' }, 'Mig1 copiado, Mig2 sin copiar (dos lineas), Mig3 sin pisar');
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM asesor_linea WHERE campana = 'ORLANT'").get().n, 5, 'lo guardado mes a mes queda intacto');
  assert.equal(JSON.parse(db.prepare("SELECT parametros FROM clientes_registro WHERE nombre = 'ORLANT'").get().parametros).salidaUsaClasificacion, true);
  assert.equal(JSON.parse(db.prepare("SELECT parametros FROM clientes_registro WHERE nombre = 'MOBILIZE'").get().parametros).salidaUsaClasificacion, undefined, 'solo ORLANT');
  assert.ok(db.prepare("SELECT 1 FROM schema_migrations WHERE name = 'fase187_salida_una_clasificacion_v1'").get(), 'corre sola con el deploy');
});
