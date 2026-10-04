// trafico-whatsapp-carga.test.js — POST /api/calidad/trafico/whatsapp/carga
// + GET /api/calidad/trafico/whatsapp (Fase 50). Mismo patron que
// trafico-carga.test.js (voz), simplificado: aqui la campana se manda
// explicita (alcance actual: solo ORLANT, sin mapeo cola->campana).
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, tokenFor, MASTER_PASSWORD } = require('./helpers');

const auth = (t) => ({ Authorization: `Bearer ${t}` });

function fila(over) {
  return {
    colaWhatsapp: 'WHATSAPP DEMO',
    fechaInicio: '2026-06-01',
    fechaFin: '2026-06-30',
    totalWhatsapp: 100,
    contestados: 90,
    ...over,
  };
}

test('POST /calidad/trafico/whatsapp/carga: solo quien tiene el permiso Cargar Datos puede subir', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const create = await request(app)
    .post('/api/users')
    .set(auth(admin))
    .send({ nombre: 'X', user: 'wpp_noadmin_' + Math.random().toString(36).slice(2, 7), password: 'ClaveWpp1234', rol: 'CALIDAD', perms: { Calidad: true, 'campana_ORLANT': true } });
  assert.equal(create.status, 201);
  const token = await tokenFor(create.body.user, 'ClaveWpp1234');
  const res = await request(app)
    .post('/api/calidad/trafico/whatsapp/carga')
    .set(auth(token))
    .send({ campana: 'ORLANT', filas: [fila()] });
  assert.equal(res.status, 403);
});

test('carga valida: se guarda y se puede leer de vuelta con los mismos numeros', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const cola = 'WHATSAPP TEST ' + Math.random().toString(36).slice(2, 8);
  const res = await request(app)
    .post('/api/calidad/trafico/whatsapp/carga')
    .set(auth(admin))
    .send({
      campana: 'ORLANT',
      archivoNombre: 'PLANTILLA_TRAFICO_WHATSAPP_EJEMPLO.xlsx',
      filas: [fila({ colaWhatsapp: cola, totalWhatsapp: 4844, contestados: 4697, abandonados: 147, serviceLevel10secPct: 31.73, asaSegundos: 9230.35, ataSegundos: 79125.8, ahtSegundos: 215 })],
    });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.insertadas, 1);
  assert.deepEqual(res.body.colas, [cola]);

  const rows = await request(app).get('/api/calidad/trafico/whatsapp?campana=ORLANT').set(auth(admin));
  assert.equal(rows.status, 200);
  const row = rows.body.find((r) => r.colaWhatsapp === cola);
  assert.ok(row, 'la cola cargada debe aparecer en la lectura');
  assert.equal(row.totalWhatsapp, 4844);
  assert.equal(row.contestados, 4697);
  assert.equal(row.abandonados, 147);
  assert.equal(row.serviceLevel10secPct, 31.73);
  assert.equal(row.asaSegundos, 9230.35);
  assert.equal(row.ataSegundos, 79125.8);
  assert.equal(row.ahtSegundos, 215, 'AHT opcional (Fase 68, Pedido 5) debe guardarse y leerse de vuelta igual que los demas campos opcionales');
});

test('idempotencia: volver a subir la misma cola+periodo actualiza, no duplica', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const cola = 'WHATSAPP IDEMPOTENTE ' + Math.random().toString(36).slice(2, 8);

  const uno = await request(app)
    .post('/api/calidad/trafico/whatsapp/carga')
    .set(auth(admin))
    .send({ campana: 'ORLANT', filas: [fila({ colaWhatsapp: cola, totalWhatsapp: 100, contestados: 80 })] });
  assert.equal(uno.status, 201);

  const dos = await request(app)
    .post('/api/calidad/trafico/whatsapp/carga')
    .set(auth(admin))
    .send({ campana: 'ORLANT', filas: [fila({ colaWhatsapp: cola, totalWhatsapp: 300, contestados: 270 })] });
  assert.equal(dos.status, 201);

  const rows = await request(app).get('/api/calidad/trafico/whatsapp?campana=ORLANT').set(auth(admin));
  const filasCola = rows.body.filter((r) => r.colaWhatsapp === cola);
  assert.equal(filasCola.length, 1, 'no debe duplicar la fila (campana, colaWhatsapp, fechaInicio, fechaFin)');
  assert.equal(filasCola[0].totalWhatsapp, 300, 'debe reflejar el valor de la SEGUNDA carga, no sumar ambas');
});

test('mismo cola en periodos distintos no colisiona (fechaInicio/fechaFin son parte de la clave)', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const cola = 'WHATSAPP DOS PERIODOS ' + Math.random().toString(36).slice(2, 6);
  await request(app)
    .post('/api/calidad/trafico/whatsapp/carga')
    .set(auth(admin))
    .send({
      campana: 'ORLANT',
      filas: [
        fila({ colaWhatsapp: cola, fechaInicio: '2026-07-01', fechaFin: '2026-07-31', totalWhatsapp: 50, contestados: 45 }),
        fila({ colaWhatsapp: cola, fechaInicio: '2026-08-01', fechaFin: '2026-08-31', totalWhatsapp: 60, contestados: 55 }),
      ],
    });
  const rows = await request(app).get('/api/calidad/trafico/whatsapp?campana=ORLANT').set(auth(admin));
  const filasCola = rows.body.filter((r) => r.colaWhatsapp === cola);
  assert.equal(filasCola.length, 2, 'dos periodos distintos deben quedar como 2 filas separadas');
});

test('GET /calidad/trafico/whatsapp respeta el acceso por campana', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const create = await request(app)
    .post('/api/users')
    .set(auth(admin))
    .send({ nombre: 'X', user: 'wpp_sincamp_' + Math.random().toString(36).slice(2, 7), password: 'ClaveWpp1234', rol: 'CALIDAD', perms: { Calidad: true } });
  const token = await tokenFor(create.body.user, 'ClaveWpp1234');
  const res = await request(app).get('/api/calidad/trafico/whatsapp?campana=ORLANT').set(auth(token));
  assert.equal(res.status, 403);
});

test('validacion: fila sin NOMBRE_COLA_WHATSAPP -> 400 (defensa en el servidor, no solo en el navegador)', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const res = await request(app)
    .post('/api/calidad/trafico/whatsapp/carga')
    .set(auth(admin))
    .send({ campana: 'ORLANT', filas: [{ fechaInicio: '2026-06-01', fechaFin: '2026-06-30', totalWhatsapp: 100, contestados: 90 }] });
  assert.equal(res.status, 400);
});

test('validacion: contestados > totalWhatsapp -> 400', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const res = await request(app)
    .post('/api/calidad/trafico/whatsapp/carga')
    .set(auth(admin))
    .send({ campana: 'ORLANT', filas: [fila({ totalWhatsapp: 50, contestados: 60 })] });
  assert.equal(res.status, 400);
});

test('validacion: fechaFin anterior a fechaInicio -> 400', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const res = await request(app)
    .post('/api/calidad/trafico/whatsapp/carga')
    .set(auth(admin))
    .send({ campana: 'ORLANT', filas: [fila({ fechaInicio: '2026-06-30', fechaFin: '2026-06-01' })] });
  assert.equal(res.status, 400);
});

test('un archivo con estructura invalida es rechazado y la carga anterior sigue intacta', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const cola = 'WHATSAPP POINT1 ' + Math.random().toString(36).slice(2, 6);

  const buena = await request(app)
    .post('/api/calidad/trafico/whatsapp/carga')
    .set(auth(admin))
    .send({ campana: 'ORLANT', filas: [fila({ colaWhatsapp: cola, totalWhatsapp: 77, contestados: 70 })] });
  assert.equal(buena.status, 201, JSON.stringify(buena.body));

  const rota = await request(app)
    .post('/api/calidad/trafico/whatsapp/carga')
    .set(auth(admin))
    .send({ campana: 'ORLANT', filas: [{ fechaInicio: '2026-06-01', fechaFin: '2026-06-30', totalWhatsapp: 999, contestados: 999 }] });
  assert.equal(rota.status, 400);

  const rows = await request(app).get('/api/calidad/trafico/whatsapp?campana=ORLANT').set(auth(admin));
  const filasCola = rows.body.filter((r) => r.colaWhatsapp === cola);
  assert.equal(filasCola.length, 1);
  assert.equal(filasCola[0].totalWhatsapp, 77, 'el dato de la carga buena no debe cambiar');
});

// Fase 75 (hallazgo Fase 74, pendiente A1): antes de este endpoint,
// guardarTraficoWpp() (public/js/trafico-whatsapp.js) sobrescribia un
// periodo ya cargado en silencio -- WhatsApp era la unica de las dos cargas
// de Trafico sin el mismo aviso "se reemplazaran N registros" que ya tenia
// voz (POST /calidad/trafico/carga/impacto, routes/trafico.js).
test('POST /calidad/trafico/whatsapp/carga/impacto: cuenta cuantas filas se reemplazarian SIN escribir nada', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const cola = 'WHATSAPP IMPACTO ' + Math.random().toString(36).slice(2, 6);
  await request(app)
    .post('/api/calidad/trafico/whatsapp/carga')
    .set(auth(admin))
    .send({ campana: 'ORLANT', filas: [fila({ colaWhatsapp: cola, totalWhatsapp: 100, contestados: 90 })] });

  const impacto = await request(app)
    .post('/api/calidad/trafico/whatsapp/carga/impacto')
    .set(auth(admin))
    .send({ campana: 'ORLANT', filas: [fila({ colaWhatsapp: cola, totalWhatsapp: 999, contestados: 999 })] });
  assert.equal(impacto.status, 200, JSON.stringify(impacto.body));
  const par = impacto.body.find((p) => p.colaWhatsapp === cola);
  assert.ok(par, JSON.stringify(impacto.body));
  assert.equal(par.filasExistentes, 1);
  assert.equal(par.fechaInicio, '2026-06-01');
  assert.equal(par.fechaFin, '2026-06-30');

  // No debe haber escrito nada: el valor guardado sigue siendo el original (100), no 999.
  const rows = await request(app).get('/api/calidad/trafico/whatsapp?campana=ORLANT').set(auth(admin));
  const row = rows.body.find((r) => r.colaWhatsapp === cola);
  assert.equal(row.totalWhatsapp, 100, '/carga/impacto no debe escribir nada en la base');
});

test('POST /calidad/trafico/whatsapp/carga/impacto: un periodo nuevo (nunca cargado) reporta 0 filas existentes', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const cola = 'WHATSAPP IMPACTO NUEVO ' + Math.random().toString(36).slice(2, 6);
  const impacto = await request(app)
    .post('/api/calidad/trafico/whatsapp/carga/impacto')
    .set(auth(admin))
    .send({ campana: 'ORLANT', filas: [fila({ colaWhatsapp: cola })] });
  assert.equal(impacto.status, 200);
  const par = impacto.body.find((p) => p.colaWhatsapp === cola);
  assert.equal(par.filasExistentes, 0);
});

// Fase 115 (mismo hallazgo real que voz -- trafico-carga.test.js -- aplicado
// a WhatsApp: el residuo de prueba de la Fase 67 tambien dejo 5 filas
// huerfanas en trafico_whatsapp). Una carga reemplaza TODO el rango
// [primera..ultima fechaInicio] que trae el archivo, por cola -- no solo los
// periodos presentes.
test('una carga con un periodo menos (dentro del rango de la anterior) BORRA ese periodo sobrante', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const cola = 'WHATSAPP RANGO ' + Math.random().toString(36).slice(2, 6);

  const primera = await request(app)
    .post('/api/calidad/trafico/whatsapp/carga')
    .set(auth(admin))
    .send({
      campana: 'ORLANT',
      filas: [
        fila({ colaWhatsapp: cola, fechaInicio: '2026-07-01', fechaFin: '2026-07-07', totalWhatsapp: 10, contestados: 9 }),
        fila({ colaWhatsapp: cola, fechaInicio: '2026-07-08', fechaFin: '2026-07-14', totalWhatsapp: 20, contestados: 18 }), // periodo sobrante
        fila({ colaWhatsapp: cola, fechaInicio: '2026-07-15', fechaFin: '2026-07-21', totalWhatsapp: 30, contestados: 27 }),
      ],
    });
  assert.equal(primera.status, 201, JSON.stringify(primera.body));
  assert.equal(primera.body.borradas, 0);

  // Archivo que llega despues: mismo rango [07-01..07-21], SIN el periodo del medio.
  const segunda = await request(app)
    .post('/api/calidad/trafico/whatsapp/carga')
    .set(auth(admin))
    .send({
      campana: 'ORLANT',
      filas: [
        fila({ colaWhatsapp: cola, fechaInicio: '2026-07-01', fechaFin: '2026-07-07', totalWhatsapp: 11, contestados: 10 }),
        fila({ colaWhatsapp: cola, fechaInicio: '2026-07-15', fechaFin: '2026-07-21', totalWhatsapp: 31, contestados: 28 }),
      ],
    });
  assert.equal(segunda.status, 201, JSON.stringify(segunda.body));
  assert.equal(segunda.body.insertadas, 2);
  assert.equal(segunda.body.borradas, 1, 'el periodo 07-08..07-14 (dentro del rango 07-01..07-21) debe borrarse');

  const rows = await request(app).get('/api/calidad/trafico/whatsapp?campana=ORLANT').set(auth(admin));
  const filasCola = rows.body.filter((r) => r.colaWhatsapp === cola);
  assert.equal(filasCola.length, 2, 'el periodo sobrante ya no debe existir');
  assert.ok(!filasCola.some((r) => r.fechaInicio === '2026-07-08'));
});

test('una carga de WhatsApp NUNCA borra periodos fuera de su propio rango, aunque sean de la misma cola', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const cola = 'WHATSAPP RANGO LIMITE ' + Math.random().toString(36).slice(2, 6);

  await request(app)
    .post('/api/calidad/trafico/whatsapp/carga')
    .set(auth(admin))
    .send({ campana: 'ORLANT', filas: [fila({ colaWhatsapp: cola, fechaInicio: '2026-06-01', fechaFin: '2026-06-30', totalWhatsapp: 5, contestados: 5 })] });

  const carga = await request(app)
    .post('/api/calidad/trafico/whatsapp/carga')
    .set(auth(admin))
    .send({ campana: 'ORLANT', filas: [fila({ colaWhatsapp: cola, fechaInicio: '2026-07-01', fechaFin: '2026-07-31', totalWhatsapp: 10, contestados: 9 })] });
  assert.equal(carga.status, 201, JSON.stringify(carga.body));
  assert.equal(carga.body.borradas, 0, 'junio esta fuera del rango de esta carga (solo julio), nunca se toca');

  const rows = await request(app).get('/api/calidad/trafico/whatsapp?campana=ORLANT').set(auth(admin));
  const filasCola = rows.body.filter((r) => r.colaWhatsapp === cola);
  assert.ok(filasCola.some((r) => r.fechaInicio === '2026-06-01'), 'junio debe seguir intacto');
});

test('POST /calidad/trafico/whatsapp/carga/impacto informa filasABorrar (dentro del rango) SIN escribir nada', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const cola = 'WHATSAPP IMPACTO BORRAR ' + Math.random().toString(36).slice(2, 6);

  await request(app)
    .post('/api/calidad/trafico/whatsapp/carga')
    .set(auth(admin))
    .send({
      campana: 'ORLANT',
      filas: [
        fila({ colaWhatsapp: cola, fechaInicio: '2026-08-01', fechaFin: '2026-08-07', totalWhatsapp: 10, contestados: 9 }),
        fila({ colaWhatsapp: cola, fechaInicio: '2026-08-08', fechaFin: '2026-08-14', totalWhatsapp: 20, contestados: 18 }),
        fila({ colaWhatsapp: cola, fechaInicio: '2026-08-15', fechaFin: '2026-08-21', totalWhatsapp: 30, contestados: 27 }),
      ],
    });

  const impacto = await request(app)
    .post('/api/calidad/trafico/whatsapp/carga/impacto')
    .set(auth(admin))
    .send({
      campana: 'ORLANT',
      filas: [
        fila({ colaWhatsapp: cola, fechaInicio: '2026-08-01', fechaFin: '2026-08-07', totalWhatsapp: 11, contestados: 10 }),
        fila({ colaWhatsapp: cola, fechaInicio: '2026-08-15', fechaFin: '2026-08-21', totalWhatsapp: 31, contestados: 28 }),
      ],
    });
  assert.equal(impacto.status, 200, JSON.stringify(impacto.body));
  const reemplazos = impacto.body.filter((p) => p.colaWhatsapp === cola && p.filasExistentes > 0);
  const borrados = impacto.body.filter((p) => p.colaWhatsapp === cola && p.filasABorrar > 0);
  assert.equal(reemplazos.length, 2, '08-01..07 y 08-15..21 ya existen y se reemplazarian');
  assert.equal(borrados.length, 1, 'el periodo 08-08..14 esta dentro del rango y no viene en el archivo nuevo');
  assert.equal(borrados[0].fechaInicio, '2026-08-08');
  assert.equal(borrados[0].filasExistentes, 0, 'un periodo que se borra nunca se cuenta tambien como "reemplazado"');

  // No debe haber escrito/borrado nada todavia.
  const rows = await request(app).get('/api/calidad/trafico/whatsapp?campana=ORLANT').set(auth(admin));
  assert.equal(rows.body.filter((r) => r.colaWhatsapp === cola).length, 3, '/carga/impacto no debe borrar ni escribir nada en la base');
});

test('POST /calidad/trafico/whatsapp/carga/impacto: solo quien tiene el permiso Cargar Datos puede consultarlo', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const create = await request(app)
    .post('/api/users')
    .set(auth(admin))
    .send({ nombre: 'X', user: 'wpp_impacto_noadmin_' + Math.random().toString(36).slice(2, 7), password: 'ClaveWpp1234', rol: 'CALIDAD', perms: { Calidad: true, 'campana_ORLANT': true } });
  const token = await tokenFor(create.body.user, 'ClaveWpp1234');
  const res = await request(app)
    .post('/api/calidad/trafico/whatsapp/carga/impacto')
    .set(auth(token))
    .send({ campana: 'ORLANT', filas: [fila()] });
  assert.equal(res.status, 403);
});

test('las columnas opcionales ausentes no llegan como 0 sino como null', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const cola = 'WHATSAPP SIN OPCIONALES ' + Math.random().toString(36).slice(2, 6);
  const res = await request(app)
    .post('/api/calidad/trafico/whatsapp/carga')
    .set(auth(admin))
    .send({ campana: 'ORLANT', filas: [{ colaWhatsapp: cola, fechaInicio: '2026-06-01', fechaFin: '2026-06-30', totalWhatsapp: 100, contestados: 90 }] });
  assert.equal(res.status, 201);
  const rows = await request(app).get('/api/calidad/trafico/whatsapp?campana=ORLANT').set(auth(admin));
  const row = rows.body.find((r) => r.colaWhatsapp === cola);
  assert.equal(row.abandonados, null);
  assert.equal(row.serviceLevel20secPct, null);
  assert.equal(row.serviceLevel5minPct, null, 'SERVICE_LEVEL_5MIN (Fase 87, tema B) es opcional -- ausente en el archivo debe quedar null, no 0');
  assert.equal(row.asaSegundos, null);
  assert.equal(row.ahtSegundos, null, 'AHT (Fase 68, Pedido 5) es opcional -- ausente en el archivo debe quedar null, no 0');
});

// Fase 87 (tema B, nota del jefe: "En WhatsApp el nivel de servicio es de 5
// minutos"): serviceLevel5minPct se guarda y se lee de vuelta igual que los
// demas campos opcionales, y una recarga del mismo periodo lo actualiza sin
// duplicar (mismo mecanismo de upsert que ya cubre el resto de la fila).
test('serviceLevel5minPct (Tema B) se guarda y se lee de vuelta igual que los demas campos opcionales', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const cola = 'WHATSAPP SL5MIN ' + Math.random().toString(36).slice(2, 8);
  const res = await request(app)
    .post('/api/calidad/trafico/whatsapp/carga')
    .set(auth(admin))
    .send({ campana: 'ORLANT', filas: [fila({ colaWhatsapp: cola, serviceLevel5minPct: 96.42 })] });
  assert.equal(res.status, 201, JSON.stringify(res.body));

  const rows = await request(app).get('/api/calidad/trafico/whatsapp?campana=ORLANT').set(auth(admin));
  const row = rows.body.find((r) => r.colaWhatsapp === cola);
  assert.equal(row.serviceLevel5minPct, 96.42);
});

test('recargar un periodo que ya existia con SERVICE_LEVEL_5MIN nuevo actualiza el dato sin duplicar', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const cola = 'WHATSAPP SL5MIN RECARGA ' + Math.random().toString(36).slice(2, 6);

  await request(app)
    .post('/api/calidad/trafico/whatsapp/carga')
    .set(auth(admin))
    .send({ campana: 'ORLANT', filas: [fila({ colaWhatsapp: cola })] }); // sin SERVICE_LEVEL_5MIN, como agosto

  const dos = await request(app)
    .post('/api/calidad/trafico/whatsapp/carga')
    .set(auth(admin))
    .send({ campana: 'ORLANT', filas: [fila({ colaWhatsapp: cola, serviceLevel5minPct: 91.5 })] });
  assert.equal(dos.status, 201);

  const rows = await request(app).get('/api/calidad/trafico/whatsapp?campana=ORLANT').set(auth(admin));
  const filasCola = rows.body.filter((r) => r.colaWhatsapp === cola);
  assert.equal(filasCola.length, 1, 'no debe duplicar la fila');
  assert.equal(filasCola[0].serviceLevel5minPct, 91.5, 'debe reflejar el dato de la SEGUNDA carga');
});
