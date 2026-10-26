// fase170-salida-por-asesor.test.js — Fase 170 (pedido de Edwin): la salida
// de ORLANT se calcula con la Tipificacion de los 2 CDR (Fase 168) en los
// meses que la tienen, repartida en 3P/General segun la linea de cada asesor
// en ese mes (tabla asesor_linea, la edita un administrador). Sin linea =
// "Sin asignar" (suma al total). Se decide por canal: el canal sin CDR sigue
// con el archivo mensual. Todo SINTETICO.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { salidaCombinadaPorMes } = require('../salida-cdr');
const { request, app, tokenFor, MASTER_PASSWORD, SEED, db } = require('./helpers');

const auth = (t) => ({ Authorization: `Bearer ${t}` });
const JS = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', f), 'utf8');
const tip = (agente, fecha, skill, tipo) => [agente, fecha, '09:00:00', null, 'Agendada', skill, null, null, tipo, null, null];

async function preparar(admin) {
  const post = async (url, body) => { const r = await request(app).post(url).set(auth(admin)).send(body); assert.equal(r.status, 201, url + ' ' + JSON.stringify(r.body)); };
  // Archivo mensual de Edwin: octubre, noviembre y diciembre de 2025.
  await post('/api/calidad/salida/carga', { campana: 'ORLANT', filas: [['2025-10', 10, 20, 3, 4], ['2025-11', 100, 200, 30, 40], ['2025-12', 7, 8, 9, 10]] });
  // Noviembre con los 2 CDR: llamadas de salida de Ana (3), Beto (2) y Caro (1). Fase 183: en ORLANT el
  // "-" de internalcall tambien es salida, asi que Ana suma 4.
  await post('/api/calidad/tipificacion/carga', { campana: 'ORLANT', canal: 'LLAMADAS', filas: [
    tip('Ana', '2025-11-03', 'LLAMADAS DE SALIDA', 'outbound_ma'), tip('Ana', '2025-11-04', 'LLAMADAS DE SALIDA', 'outbound_ma'), tip('Ana', '2025-11-05', 'LLAMADAS DE SALIDA', 'outbound_ma'),
    tip('Beto', '2025-11-03', 'LLAMADAS DE SALIDA', 'outbound_ma'), tip('Beto', '2025-11-06', 'LLAMADAS DE SALIDA', 'outbound_ma'),
    tip('Caro', '2025-11-07', 'LLAMADAS DE SALIDA', 'outbound_ma'),
    tip('Ana', '2025-11-08', '-', 'otro'), tip('Beto', '2025-11-08', 'CALL INBOUND ORLANT 3P', 'inbound'),
  ] });
  await post('/api/calidad/tipificacion/carga', { campana: 'ORLANT', canal: 'WHATSAPP', filas: [
    tip('Ana', '2025-11-03', 'WHATSAPP DE SALIDA', 'outbound_ma'), tip('Caro', '2025-11-04', 'WHATSAPP DE SALIDA', 'outbound_ma'), tip('Caro', '2025-11-05', 'WHATSAPP DE SALIDA', 'outbound_ma'),
    tip('Beto', '2025-11-05', 'WHATSAPP 3P', 'inbound'),
    // Diciembre: solo el CDR de WhatsApp (las llamadas siguen del archivo).
    tip('Ana', '2025-12-02', 'WHATSAPP DE SALIDA', 'outbound_ma'),
  ] });
}

test('migracion: tabla asesor_linea vacia, solo 3P o GENERAL, con triggers de datos_version', () => {
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM asesor_linea').get().n, 0);
  assert.throws(() => db.prepare("INSERT INTO asesor_linea (campana, mes, agente, linea, updatedAt) VALUES ('ORLANT','2025-01','X','OTRA','x')").run());
  assert.ok(db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='trigger' AND tbl_name='asesor_linea'").get().n >= 3);
  db.crearAsesorLinea(); // idempotente
});

test('salida del CDR por linea del asesor; sin linea = "Sin asignar"; el canal sin CDR sigue del archivo; editor solo admin', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  // Fase 187: ORLANT usa la clasificacion por cliente; esta prueba es del modo mes a mes (sin el parametro).
  const reg = db.prepare("SELECT parametros FROM clientes_registro WHERE nombre = 'ORLANT'").get();
  const par = JSON.parse(reg.parametros); delete par.salidaUsaClasificacion;
  db.prepare("UPDATE clientes_registro SET parametros = ? WHERE nombre = 'ORLANT'").run(JSON.stringify(par));
  await preparar(admin);

  // Sin lineas: todo noviembre (CDR) queda "Sin asignar". Fase 183: 7, con el "-" que no es outbound_ma.
  let nov = salidaCombinadaPorMes(db, 'ORLANT').find((f) => f.mes === '2025-11');
  assert.deepEqual(nov, { mes: '2025-11', llamadas3p: 0, llamadasGeneral: 0, llamadasSinAsignar: 7, wpp3p: 0, wppGeneral: 0, wppSinAsignar: 3,
    fuenteLlamadas: 'cdr', fuenteWpp: 'cdr', asesoresSinAsignar: 3 });

  // El editor: asesores del mes con sus salidas.
  const g = await request(app).get('/api/calidad/salida/asesores').query({ campana: 'ORLANT', mes: '2025-11' }).set(auth(admin));
  assert.equal(g.status, 200);
  assert.deepEqual(g.body.asesores, [
    { agente: 'Ana', llamadas: 4, wpp: 1, linea: null },
    { agente: 'Beto', llamadas: 2, wpp: 0, linea: null },
    { agente: 'Caro', llamadas: 1, wpp: 2, linea: null },
  ]);

  // Solo un administrador asigna.
  const cal = await tokenFor('crodriguez', SEED.crodriguez);
  assert.equal((await request(app).put('/api/calidad/salida/asesores').set(auth(cal)).send({ campana: 'ORLANT', mes: '2025-11', asignaciones: [] })).status, 403);
  assert.equal((await request(app).put('/api/calidad/salida/asesores').set(auth(admin)).send({ campana: 'ORLANT', mes: '2025-11', asignaciones: [{ agente: 'Ana', linea: 'OTRA' }] })).status, 400);
  assert.equal((await request(app).put('/api/calidad/salida/asesores').set(auth(admin)).send({ campana: 'ORLANT', mes: '2025-11', asignaciones: [{ agente: 'Ana', linea: '3P' }, { agente: 'Ana', linea: 'GENERAL' }] })).status, 400);

  // Ana 3P, Beto General, Caro sin asignar.
  const p = await request(app).put('/api/calidad/salida/asesores').set(auth(admin)).send({ campana: 'ORLANT', mes: '2025-11',
    asignaciones: [{ agente: 'Ana', linea: '3P' }, { agente: 'Beto', linea: 'GENERAL' }, { agente: 'Caro', linea: null }] });
  assert.equal(p.status, 200, JSON.stringify(p.body));
  assert.equal(p.body.guardadas, 2);

  const m = await request(app).get('/api/calidad/salida/mensual').query({ campana: 'ORLANT' }).set(auth(admin));
  const porMes = Object.fromEntries(m.body.filter((f) => f.mes.startsWith('2025-1')).map((f) => [f.mes, f]));
  assert.deepEqual(porMes['2025-11'], { mes: '2025-11', llamadas3p: 4, llamadasGeneral: 2, llamadasSinAsignar: 1, wpp3p: 1, wppGeneral: 0, wppSinAsignar: 2,
    fuenteLlamadas: 'cdr', fuenteWpp: 'cdr', asesoresSinAsignar: 1 }, 'noviembre del CDR (el archivo 100/200/30/40 ya no manda)');
  assert.equal(porMes['2025-10'].fuenteLlamadas, 'archivo', 'octubre sin CDR: archivo');
  assert.deepEqual([porMes['2025-10'].llamadas3p, porMes['2025-10'].llamadasGeneral], [10, 20]);
  // Diciembre: llamadas del archivo, WhatsApp del CDR (Ana sin linea en diciembre).
  assert.deepEqual([porMes['2025-12'].fuenteLlamadas, porMes['2025-12'].llamadas3p, porMes['2025-12'].fuenteWpp, porMes['2025-12'].wppSinAsignar], ['archivo', 7, 'cdr', 1]);

  // Las lineas son POR MES: copiar es explicito (aqui: noviembre no se aplica a diciembre).
  const dic = await request(app).get('/api/calidad/salida/asesores').query({ campana: 'ORLANT', mes: '2025-12' }).set(auth(admin));
  assert.deepEqual(dic.body.asesores, [{ agente: 'Ana', llamadas: 0, wpp: 1, linea: null }]);

  // Opciones: los meses con CDR estan (aunque no tengan archivo).
  const op = await request(app).get('/api/calidad/salida/opciones').query({ campana: 'ORLANT' }).set(auth(admin));
  assert.ok(['2025-10', '2025-11', '2025-12'].every((x) => op.body.meses.includes(x)));
  assert.ok(db.prepare("SELECT COUNT(*) AS n FROM historial WHERE accion = 'SALIDA_LINEAS_ASESOR'").get().n >= 1, 'queda en el Historial');
});

test('vista: totales con "Sin asignar", aviso, editor solo para admin en meses con CDR; Excel con Sin asignar y Fuente', () => {
  const s = JS('salida.js');
  // Fase 188: Total = General + 3P + Sin asignar/clasificar (salidaValorLinea con 'TOTAL').
  // Fase 189: cada grafica con su propia linea.
  assert.match(s, /var totalLlam = salidaValorLinea\(delMes, 'llamadas', lineas\.llamadas\);/);
  assert.match(s, /no tienen línea \(3P o General\)/);
  assert.match(s, /if\(_salEsAdmin\(\) && filaMes && \(filaMes\.fuenteLlamadas === 'cdr' \|\| filaMes\.fuenteWpp === 'cdr'\)\) await _salCargarEditor/);
  assert.match(s, /aria-label="Línea de '\+esc\(a\.agente\)\+'"/);
  // Fase 183: la grafica es una sola serie con toda la salida del mes.
  // Fase 188: la serie es la de la linea elegida (Total por defecto).
  assert.ok(s.includes("label: tituloEje, data: filas.map(function(f){ return salidaValorLinea(f, canal, linea || 'TOTAL'); })"));
  assert.doesNotMatch(s, /label:'Sin asignar'/);
  const g = JS('dashboard-generic.js');
  // Fase 187: "Sin asignar" o "Sin clasificar" segun la fila (_salSinTexto).
  assert.match(g, /\[_salSinTexto\(f\)\]: sin, 'Total': total, '% 3P': pct\(f\.llamadas3p, total\), 'Fuente': fuente\(f\.fuenteLlamadas\)/);
});
