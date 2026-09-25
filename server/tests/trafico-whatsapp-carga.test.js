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
  assert.equal(row.asaSegundos, null);
  assert.equal(row.ahtSegundos, null, 'AHT (Fase 68, Pedido 5) es opcional -- ausente en el archivo debe quedar null, no 0');
});
