// fase186-clasificacion-asesores.test.js — Fase 186 (pedido de Edwin, 26/10,
// solo ORLANT). La salida de Tipificacion (llamadas: skill "-"; WhatsApp:
// SKILL_ID 0) se reparte en "Salida General" / "Salida 3P" segun la
// clasificacion del asesor (por cliente, tabla asesor_clasificacion). Sin
// clasificar = "Sin clasificar", nunca se descarta: General + 3P + Sin
// clasificar = salida del canal, y el total del mes no cambia. Todo SINTETICO.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { salidaPorLinea } = require('../clasificacion-asesores');
const { tipificacionesPorTipo, tipificacionesResumenSalida } = require('../tipificaciones');
const L = require('../../public/js/clasificacion-asesores-logic.js');
const { request, app, tokenFor, MASTER_PASSWORD, SEED, db } = require('./helpers');

const auth = (t) => ({ Authorization: `Bearer ${t}` });
const JS = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'js', f), 'utf8');
const tip = (agente, dia, skill, tipo) => [agente, '2026-10-' + dia, '09:00:00', null, 'AGENDADA', skill, null, null, tipo, null, null];
const veces = (n, f) => Array.from({ length: n }, f);

// Llamadas: 14 registros, 11 de salida ("-" con cualquier tipo, Fase 183):
// Ana 5 (4 outbound + 1 interna), Beto 3, Caro 2, Dani 1; 3 de entrada.
const LLAMADAS = [
  ...veces(4, () => tip('Ana', '02', '-', 'outbound_ma')), tip('Ana', '02', '-', 'otro'),
  ...veces(2, () => tip('Ana', '03', 'CALL INBOUND ORLANT 3P', 'inbound')),
  ...veces(3, () => tip('Beto', '04', '-', 'outbound_ma')), tip('Beto', '04', 'CALL INBOUND ORLANT GENERAL', 'inbound'),
  ...veces(2, () => tip('Caro', '05', '-', 'outbound_ma')),
  tip('Dani', '06', '-', 'outbound_ma'),
];
// WhatsApp: 10 registros, 6 de salida (SKILL_ID 0): Ana 2, Caro 3, Eva 1; Beto 4 de entrada.
const WHATSAPP = [
  ...veces(2, () => tip('Ana', '02', 'WHATSAPP DE SALIDA', 'outbound_ma')),
  ...veces(3, () => tip('Caro', '03', 'WHATSAPP DE SALIDA', 'outbound_ma')),
  tip('Eva', '04', 'WHATSAPP DE SALIDA', 'outbound_ma'),
  ...veces(4, () => tip('Beto', '05', 'WHATSAPP 3P', 'inbound')),
];
const Q = (canal, extra) => ({ campana: 'ORLANT', canal, mes: '2026-10', ...extra });

test('migracion: tabla asesor_clasificacion vacia, solo 3P o GENERAL, un asesor una vez por cliente, con triggers', () => {
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM asesor_clasificacion').get().n, 0);
  assert.throws(() => db.prepare("INSERT INTO asesor_clasificacion (campana, agente, linea, updatedAt) VALUES ('ORLANT','X','OTRA','x')").run());
  db.prepare("INSERT INTO asesor_clasificacion (campana, agente, linea, updatedAt) VALUES ('ORLANT','X','3P','x')").run();
  assert.throws(() => db.prepare("INSERT INTO asesor_clasificacion (campana, agente, linea, updatedAt) VALUES ('ORLANT','X','GENERAL','x')").run());
  db.prepare("DELETE FROM asesor_clasificacion WHERE agente = 'X'").run();
  assert.ok(db.prepare("SELECT COUNT(*) AS n FROM sqlite_master WHERE type='trigger' AND tbl_name='asesor_clasificacion'").get().n >= 3);
  db.crearAsesorClasificacion(); // idempotente
});

test('salida por linea: General + 3P + Sin clasificar = salida de cada canal; el total del mes no cambia; solo admin clasifica', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  for (const [canal, filas] of [['LLAMADAS', LLAMADAS], ['WHATSAPP', WHATSAPP]]) {
    const r = await request(app).post('/api/calidad/tipificacion/carga').set(auth(admin)).send({ campana: 'ORLANT', canal, archivoNombre: 'sint.xlsx', filas });
    assert.equal(r.status, 201, JSON.stringify(r.body));
  }

  // Sin clasificar a nadie: toda la salida queda en "Sin clasificar" (no se pierde).
  assert.deepEqual(salidaPorLinea(db, Q('LLAMADAS')), { canal: 'LLAMADAS', total: 14, salida: 11, general: 0, p3: 0, sinClasificar: 11 });
  assert.deepEqual(salidaPorLinea(db, Q('WHATSAPP')), { canal: 'WHATSAPP', total: 10, salida: 6, general: 0, p3: 0, sinClasificar: 6 });

  // La lista: asesores de los 2 CDR, con su salida. Solo el administrador la ve y la cambia.
  const g = await request(app).get('/api/calidad/tipificacion/clasificacion-asesores').query({ campana: 'ORLANT' }).set(auth(admin));
  assert.equal(g.status, 200);
  assert.deepEqual(g.body.asesores, [
    { agente: 'Ana', linea: null, salidaLlamadas: 5, salidaWpp: 2 },
    { agente: 'Beto', linea: null, salidaLlamadas: 3, salidaWpp: 0 },
    { agente: 'Caro', linea: null, salidaLlamadas: 2, salidaWpp: 3 },
    { agente: 'Dani', linea: null, salidaLlamadas: 1, salidaWpp: 0 },
    { agente: 'Eva', linea: null, salidaLlamadas: 0, salidaWpp: 1 },
  ]);
  const cli = await tokenFor('agomez', SEED.agomez);
  const cal = await tokenFor('crodriguez', SEED.crodriguez);
  for (const t of [cli, cal]) {
    assert.equal((await request(app).get('/api/calidad/tipificacion/clasificacion-asesores').query({ campana: 'ORLANT' }).set(auth(t))).status, 403);
    assert.equal((await request(app).put('/api/calidad/tipificacion/clasificacion-asesores').set(auth(t)).send({ campana: 'ORLANT', asignaciones: [] })).status, 403);
  }
  const put = (asignaciones) => request(app).put('/api/calidad/tipificacion/clasificacion-asesores').set(auth(admin)).send({ campana: 'ORLANT', asignaciones });
  assert.equal((await put([{ agente: 'Ana', linea: 'OTRA' }])).status, 400);
  assert.equal((await put([{ agente: 'Ana', linea: '3P' }, { agente: 'Ana', linea: 'GENERAL' }])).status, 400);

  // Ana General; Beto y Caro 3P; Dani y Eva sin clasificar; Fede (sin filas hoy) General, se conserva.
  const p = await put([{ agente: 'Ana', linea: 'GENERAL' }, { agente: 'Beto', linea: '3P' }, { agente: 'Caro', linea: '3P' },
    { agente: 'Dani', linea: null }, { agente: 'Eva', linea: null }, { agente: 'Fede', linea: 'GENERAL' }]);
  assert.equal(p.status, 200, JSON.stringify(p.body));
  assert.deepEqual([p.body.general, p.body.p3, p.body.sinClasificar], [2, 2, 2]);
  assert.deepEqual(p.body.asesores.find((a) => a.agente === 'Fede'), { agente: 'Fede', linea: 'GENERAL', salidaLlamadas: 0, salidaWpp: 0 });

  // El reparto: llamadas 5 + 5 + 1 = 11, WhatsApp 2 + 3 + 1 = 6. El total del mes sigue en 14 y 10.
  const llam = salidaPorLinea(db, Q('LLAMADAS'));
  const wpp = salidaPorLinea(db, Q('WHATSAPP'));
  assert.deepEqual(llam, { canal: 'LLAMADAS', total: 14, salida: 11, general: 5, p3: 5, sinClasificar: 1 });
  assert.deepEqual(wpp, { canal: 'WHATSAPP', total: 10, salida: 6, general: 2, p3: 3, sinClasificar: 1 });
  for (const r of [llam, wpp]) assert.equal(r.general + r.p3 + r.sinClasificar, r.salida, 'General + 3P + Sin clasificar = salida ' + r.canal);
  // La salida es la misma que cuentan las demas vistas: la regla de llamadas de ORLANT y el SKILL_ID 0 de WhatsApp.
  assert.equal(llam.salida, db.prepare("SELECT COUNT(*) AS n FROM tipificaciones WHERE campana='ORLANT' AND canal='LLAMADAS' AND TRIM(skill)='-'").get().n);
  assert.equal(wpp.salida, tipificacionesPorTipo(db, Q('WHATSAPP', { skill: 'WHATSAPP DE SALIDA' })).total);
  assert.equal(tipificacionesResumenSalida(db, { campana: 'ORLANT', mes: '2026-10' }).totalLlamadas, 14, 'Total llamadas no cambia');

  // Filtro "Línea de salida" en las 2 vistas: la torta de cada canal queda con la salida de esa linea.
  for (const [canal, esperado] of [['LLAMADAS', { GENERAL: 5, '3P': 5, SIN: 1 }], ['WHATSAPP', { GENERAL: 2, '3P': 3, SIN: 1 }]]) {
    let suma = 0;
    for (const linea of ['GENERAL', '3P', 'SIN']) {
      const r = await request(app).get('/api/calidad/tipificacion/por-tipo').query(Q(canal, { linea })).set(auth(admin));
      assert.equal(r.status, 200);
      assert.equal(r.body.total, esperado[linea], canal + ' ' + linea);
      suma += r.body.total;
    }
    assert.equal(suma, canal === 'LLAMADAS' ? 11 : 6);
  }
  // Con el filtro de agente: Caro es 3P, su salida de WhatsApp (3) sale en 3P y no en General.
  assert.equal(tipificacionesPorTipo(db, Q('WHATSAPP', { agente: 'Caro', linea: '3P' })).total, 3);
  assert.equal(tipificacionesPorTipo(db, Q('WHATSAPP', { agente: 'Caro', linea: 'GENERAL' })).total, 0);

  // El usuario del cliente ve el resultado (tarjetas), no la lista.
  const rc = await request(app).get('/api/calidad/tipificacion/salida-por-linea').query(Q('WHATSAPP')).set(auth(cli));
  assert.equal(rc.status, 200);
  assert.deepEqual(rc.body, wpp);
  // Solo ORLANT.
  assert.equal((await request(app).get('/api/calidad/tipificacion/salida-por-linea').query({ campana: 'MOBILIZE', canal: 'LLAMADAS' }).set(auth(admin))).status, 404);
  const op = await request(app).get('/api/calidad/tipificacion/opciones').query({ campana: 'ORLANT', canal: 'WHATSAPP' }).set(auth(admin));
  assert.equal(op.body.clasificacionAsesores, true);
  const opM = await request(app).get('/api/calidad/tipificacion/opciones').query({ campana: 'MOBILIZE', canal: 'LLAMADAS' }).set(auth(admin));
  assert.equal(opM.body.clasificacionAsesores, false);
  assert.ok(db.prepare("SELECT COUNT(*) AS n FROM historial WHERE accion = 'CLASIFICACION_ASESORES'").get().n >= 1, 'queda en el Historial');
});

test('Excel (nombre del asesor, línea): coincide sin mayusculas, tildes ni espacios de mas; lo que no coincide se avisa y no se aplica', () => {
  const conocidos = ['ANA MARÍA RÍOS', 'BETO PEREZ', 'Caro Gil', 'DANI', 'EVA', 'José Pérez', 'JOSE PEREZ'];
  const r = L.clasifLeerExcel([
    ['Listado de Isa'],
    ['Nombre del asesor', 'Línea'],
    ['ana maria rios', 'General'],
    ['  BETO   PEREZ ', 'Línea 3P'],
    ['caro gil', '3p'],
    ['Zoe Inexistente', 'General'],
    ['Dani', 'Otra'],
    ['Eva', 'General'],
    ['eva', 'LINEA 3P'],
    ['Jose Perez', 'General'],
    [null, null],
  ], conocidos);
  assert.deepEqual(r.asignaciones, { 'ANA MARÍA RÍOS': 'GENERAL', 'BETO PEREZ': '3P', 'Caro Gil': '3P' });
  assert.equal(r.coincidencias, 3);
  assert.deepEqual(r.sinCoincidencia, ['Zoe Inexistente'], 'sin cruce inventado');
  assert.deepEqual(r.lineaInvalida, [{ fila: 7, nombre: 'Dani', valor: 'Otra' }]);
  assert.deepEqual(r.conflictos, ['EVA'], 'con las 2 lineas: no se elige ninguna');
  assert.deepEqual(r.ambiguos, ['Jose Perez'], 'coincide con 2 asesores: no se aplica');
  assert.equal(r.filasLeidas, 8);
  const av = L.clasifAvisosExcel(r);
  assert.equal(av[0], '3 asesor(es) del archivo coinciden con los de los CDR y quedaron elegidos abajo (falta Guardar).');
  assert.ok(av.includes('1 nombre(s) del archivo no coinciden con ningún asesor de los CDR y no se aplicaron: Zoe Inexistente.'));
  assert.ok(av.some((a) => a.startsWith('1 fila(s) sin nombre o con una línea que no es "General" ni "3P": fila 7 ("Otra")')));
  assert.ok(L.clasifLeerExcel([['Asesor', 'Sede'], ['ANA', 'X']], conocidos).error, 'sin columna Línea: error, no adivina');
});

test('tarjetas: Sin clasificar solo si hay; la nota dice la salida del canal', () => {
  const t = L.clasifTarjetasSalida({ salida: 11, general: 5, p3: 5, sinClasificar: 1 }, 'LLAMADAS');
  assert.deepEqual(t.tarjetas.map((x) => [x.etiqueta, x.valor]), [['Salida General', 5], ['Salida 3P', 5], ['Sin clasificar', 1]]);
  assert.equal(t.nota, 'Salida de llamadas: 11');
  assert.deepEqual(L.clasifTarjetasSalida({ salida: 6, general: 2, p3: 4, sinClasificar: 0 }, 'WHATSAPP').tarjetas.map((x) => x.clave), ['GENERAL', '3P']);
});

test('vista: boton solo para el administrador, filtro "Línea de salida" compartido por las 2 mitades, tarjetas y torta por linea', () => {
  const s = JS('tipificacion.js');
  assert.ok(s.includes("if(clasif && typeof isFullAdmin === 'function' && isFullAdmin()){"));
  assert.ok(s.includes('onclick="tipifAbrirClasificacion(\'+i+\')">Clasificación de asesores</button>'));
  assert.ok(s.includes("<label for=\"tipif-f-linea-'+i+'\">Línea (General / 3P)</label>")); // Fase 219: texto nuevo
  assert.ok(s.includes("linea: v('tipif-f-linea-'+i)"), 'el filtro es del bloque compartido (Mes/rango), no de una mitad');
  assert.ok(s.includes("if(compartido.linea) params.set('linea', compartido.linea);"));
  assert.ok(s.includes("'/calidad/tipificacion/salida-por-linea?'"));
  // Fase 190: la torta "salida por línea" salio (ver fase190-tipif-sin-tortas-linea.test.js).
  const html = fs.readFileSync(path.join(__dirname, '..', '..', 'public', 'index.html'), 'utf8');
  assert.ok(html.indexOf('js/clasificacion-asesores-logic.js') > -1 && html.indexOf('js/clasificacion-asesores-logic.js') < html.indexOf('js/tipificacion.js'));
  assert.match(html, /id="tipif-clasif-excel" accept="\.xlsx,\.xls,\.csv"/);
});
