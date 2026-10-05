// fase122-alias-asesores.test.js — Fase 122 (reunion con Edwin, 2026-10-05):
// tabla de alias de nombre de asesor (alias -> canonico, por campana),
// aplicada en el servidor al guardar Tipificacion/Agendas/Efectividad de
// Agendamiento. Casos reales que la motivan (nombres SIEMPRE inventados en
// este archivo, nunca los reales): la misma persona llega con 2 nombres
// distintos entre archivos, o con una errata puntual de tipeo.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, db, tokenFor, MASTER_PASSWORD, SEED } = require('./helpers');
const { aliasNorm, resolverAlias, cargarAliasMapa, aplicarAliasAFilas } = require('../alias-asesores');

const auth = (t) => ({ Authorization: `Bearer ${t}` });
const CAMPANA = 'ORLANT';

function rand() { return Math.random().toString(36).slice(2, 8).toUpperCase(); }
// campanaSchema no acepta "_" (solo letras/numeros/espacios y .-/) -- un
// nombre de campana ficticio por prueba, con espacio, nunca choca con
// ORLANT real.
function campanaFicticia() { return 'CAMPANA FICTICIA ' + rand(); }

// ── Unidad: normalizacion y resolucion (sin DB) ─────────────────────────
test('aliasNorm: mayusculas, sin tildes, espacios colapsados', () => {
  assert.equal(aliasNorm('  María   José  '), 'MARIA JOSE');
  assert.equal(aliasNorm('Ñandu Núñez'), 'NANDU NUNEZ');
  assert.equal(aliasNorm(null), '');
});

test('resolverAlias: con alias -> canonico; sin alias -> el nombre tal cual', () => {
  const mapa = { 'NOMBRE VIEJO': 'Nombre Nuevo' };
  assert.equal(resolverAlias(mapa, 'nombre viejo'), 'Nombre Nuevo'); // normalizado para buscar
  assert.equal(resolverAlias(mapa, 'Otro Nombre'), 'Otro Nombre');
});

test('aplicarAliasAFilas: sin ningun alias cargado -> devuelve las filas tal cual, 0 unificadas', () => {
  const campana = campanaFicticia();
  const filas = [{ agente: 'X', n: 1 }, { agente: 'Y', n: 2 }];
  const res = aplicarAliasAFilas(db, campana, filas, 'agente');
  assert.equal(res.filasUnificadas, 0);
  assert.equal(res.asesoresUnificados, 0);
  assert.deepEqual(res.filas, filas);
});

test('aplicarAliasAFilas: cuenta FILAS y NOMBRES ORIGINALES DISTINTOS unificados, nunca muta las filas originales', () => {
  const campana = campanaFicticia();
  const now = new Date().toISOString();
  db.prepare('INSERT INTO alias_asesores (campana, alias, canonico, createdAt) VALUES (?,?,?,?)').run(campana, 'ALIAS DEMO UNO', 'CANONICO DEMO', now);
  const filas = [
    { agente: 'alias demo uno', n: 1 },
    { agente: 'ALIAS DEMO UNO', n: 2 }, // misma persona, otra variante de mayusculas
    { agente: 'OTRO ASESOR', n: 3 },
  ];
  const res = aplicarAliasAFilas(db, campana, filas, 'agente');
  assert.equal(res.filasUnificadas, 2);
  assert.equal(res.asesoresUnificados, 1); // un solo nombre ORIGINAL distinto, aunque en 2 filas
  assert.equal(res.filas[0].agente, 'CANONICO DEMO');
  assert.equal(res.filas[1].agente, 'CANONICO DEMO');
  assert.equal(res.filas[2].agente, 'OTRO ASESOR');
  assert.equal(filas[0].agente, 'alias demo uno', 'las filas originales no deben mutarse');
});

test('cargarAliasMapa: una sola consulta trae todos los alias de la campana', () => {
  const campana = campanaFicticia();
  const now = new Date().toISOString();
  db.prepare('INSERT INTO alias_asesores (campana, alias, canonico, createdAt) VALUES (?,?,?,?)').run(campana, 'A', 'B', now);
  db.prepare('INSERT INTO alias_asesores (campana, alias, canonico, createdAt) VALUES (?,?,?,?)').run(campana, 'C', 'D', now);
  const mapa = cargarAliasMapa(db, campana);
  assert.equal(Object.keys(mapa).length, 2);
  assert.equal(mapa.A, 'B');
  assert.equal(mapa.C, 'D');
});

// ── Endpoint de administracion: alta/baja/lista ─────────────────────────
test('GET/POST/DELETE /alias-asesores: solo administrador', async () => {
  const token = await tokenFor(SEED ? 'crodriguez' : 'crodriguez', 'calidad123'); // CALIDAD, no admin
  const campana = campanaFicticia();
  const get = await request(app).get(`/api/alias-asesores?campana=${encodeURIComponent(campana)}`).set(auth(token));
  assert.equal(get.status, 403);
  const post = await request(app).post('/api/alias-asesores').set(auth(token)).send({ campana, alias: 'X DEMO', canonico: 'Y DEMO' });
  assert.equal(post.status, 403);
  const del = await request(app).delete('/api/alias-asesores/999999').set(auth(token));
  assert.equal(del.status, 403);
});

test('POST /alias-asesores: alta valida, Cache-Control: no-store, auditada en el historial', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const campana = campanaFicticia();
  const res = await request(app).post('/api/alias-asesores').set(auth(admin)).send({ campana, alias: 'NOMBRE VIEJO DEMO', canonico: 'NOMBRE NUEVO DEMO' });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.headers['cache-control'], 'no-store');
  assert.equal(res.body.alias, 'NOMBRE VIEJO DEMO');
  assert.equal(res.body.canonico, 'NOMBRE NUEVO DEMO');
  assert.ok(res.body.id);

  const hist = await request(app).get('/api/historial').set(auth(admin));
  assert.equal(hist.status, 200);
  const evento = hist.body.find((h) => h.accion === 'ALIAS_ASESOR_CREADO' && h.nombre === 'NOMBRE VIEJO DEMO');
  assert.ok(evento, 'el alta de alias debe quedar en el historial');
});

test('POST /alias-asesores: un alias no puede apuntar a si mismo', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const campana = campanaFicticia();
  const res = await request(app).post('/api/alias-asesores').set(auth(admin)).send({ campana, alias: 'MISMO NOMBRE', canonico: 'mismo nombre' });
  assert.equal(res.status, 400);
});

test('POST /alias-asesores: no puede repetirse el mismo alias dos veces en la misma campana (409)', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const campana = campanaFicticia();
  const r1 = await request(app).post('/api/alias-asesores').set(auth(admin)).send({ campana, alias: 'ALIAS REPETIDO', canonico: 'CANONICO UNO' });
  assert.equal(r1.status, 201);
  const r2 = await request(app).post('/api/alias-asesores').set(auth(admin)).send({ campana, alias: 'alias repetido', canonico: 'CANONICO DOS' });
  assert.equal(r2.status, 409);
});

test('POST /alias-asesores: un alias nunca puede apuntar a OTRO alias -- sin cadenas, sin ciclos', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const campana = campanaFicticia();
  const base = await request(app).post('/api/alias-asesores').set(auth(admin)).send({ campana, alias: 'PRIMER ALIAS', canonico: 'SEGUNDO NOMBRE' });
  assert.equal(base.status, 201);
  // Cadena: PRIMER ALIAS -> SEGUNDO NOMBRE; ahora intenta TERCERO -> PRIMER ALIAS (el canonico ya es un alias existente).
  const cadena = await request(app).post('/api/alias-asesores').set(auth(admin)).send({ campana, alias: 'TERCER ALIAS', canonico: 'PRIMER ALIAS' });
  assert.equal(cadena.status, 400);
  // Ciclo inverso: SEGUNDO NOMBRE -> PRIMER ALIAS (cerraria el ciclo A->B->A).
  const ciclo = await request(app).post('/api/alias-asesores').set(auth(admin)).send({ campana, alias: 'SEGUNDO NOMBRE', canonico: 'PRIMER ALIAS' });
  assert.equal(ciclo.status, 400);
});

test('POST /alias-asesores: canonico que NO aparece en ningun archivo cargado -- se crea igual, con advertencia', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const campana = campanaFicticia();
  // Siembra un dato conocido para esta campana ficticia, para que la
  // busqueda de "conocidos" encuentre algo y pueda decidir que el
  // canonico propuesto NO esta ahi.
  db.prepare(
    `INSERT INTO agendas (campana, asesor, sede, examen, especialidad, profesional, fechaSolicitud, tipoLinea, entidad, archivoNombre, cargadoPorNombre, createdAt)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(campana, 'ASESOR YA CONOCIDO', 'SEDE', 'EXAMEN', 'ESP', 'PROF', '2026-01-01 08:00:00', 'GENERAL', 'SIN ENTIDAD', '', '-', new Date().toISOString());
  const res = await request(app).post('/api/alias-asesores').set(auth(admin)).send({ campana, alias: 'ALIAS SIN DATOS', canonico: 'ASESOR QUE NO EXISTE TODAVIA' });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.ok(res.body.advertencia, 'debe advertir que el canonico no aparece en ningun archivo cargado');
});

test('POST /alias-asesores: canonico que SI aparece en un archivo ya cargado -- sin advertencia', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const campana = campanaFicticia();
  db.prepare(
    `INSERT INTO agendas (campana, asesor, sede, examen, especialidad, profesional, fechaSolicitud, tipoLinea, entidad, archivoNombre, cargadoPorNombre, createdAt)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(campana, 'ASESOR YA CONOCIDO', 'SEDE', 'EXAMEN', 'ESP', 'PROF', '2026-01-01 08:00:00', 'GENERAL', 'SIN ENTIDAD', '', '-', new Date().toISOString());
  const res = await request(app).post('/api/alias-asesores').set(auth(admin)).send({ campana, alias: 'ALIAS CON DATOS', canonico: 'ASESOR YA CONOCIDO' });
  assert.equal(res.status, 201, JSON.stringify(res.body));
  assert.equal(res.body.advertencia, undefined);
});

test('DELETE /alias-asesores/:id: borra de verdad, 404 si no existe, auditado', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const campana = campanaFicticia();
  const creado = await request(app).post('/api/alias-asesores').set(auth(admin)).send({ campana, alias: 'A BORRAR', canonico: 'CANONICO BORRAR' });
  assert.equal(creado.status, 201);
  const del = await request(app).delete(`/api/alias-asesores/${creado.body.id}`).set(auth(admin));
  assert.equal(del.status, 200);
  const del404 = await request(app).delete(`/api/alias-asesores/${creado.body.id}`).set(auth(admin));
  assert.equal(del404.status, 404);
  const lista = await request(app).get(`/api/alias-asesores?campana=${encodeURIComponent(campana)}`).set(auth(admin));
  assert.equal(lista.body.find((r) => r.id === creado.body.id), undefined);
});

// ── Integracion: el alias se aplica de verdad al GUARDAR ────────────────
test('Tipificacion: el alias se aplica al guardar -- el nombre guardado es el CANONICO, no el que trajo el archivo', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const campana = campanaFicticia();
  await request(app).post('/api/alias-asesores').set(auth(admin)).send({ campana, alias: 'AGENTE VIEJO TIP', canonico: 'AGENTE CANONICO TIP' });

  const fila = ['AGENTE VIEJO TIP', '2026-08-05', null, null, 'NO_CONTESTAN', 'SKILL DEMO'];
  const impacto = await request(app).post('/api/calidad/tipificacion/carga/impacto').set(auth(admin)).send({ campana, canal: 'LLAMADAS', filas: [fila] });
  assert.equal(impacto.status, 200, JSON.stringify(impacto.body));
  assert.equal(impacto.body.filasUnificadasPorAlias, 1);
  assert.equal(impacto.body.asesoresUnificadosPorAlias, 1);

  const carga = await request(app).post('/api/calidad/tipificacion/carga').set(auth(admin)).send({ campana, canal: 'LLAMADAS', filas: [fila] });
  assert.equal(carga.status, 201, JSON.stringify(carga.body));

  const opciones = await request(app).get(`/api/calidad/tipificacion/opciones?campana=${encodeURIComponent(campana)}&canal=LLAMADAS`).set(auth(admin));
  assert.ok(opciones.body.agentes.includes('AGENTE CANONICO TIP'));
  assert.ok(!opciones.body.agentes.includes('AGENTE VIEJO TIP'));
});

test('Agendas: el alias se aplica al guardar', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const campana = campanaFicticia();
  await request(app).post('/api/alias-asesores').set(auth(admin)).send({ campana, alias: 'ASESOR VIEJO AG', canonico: 'ASESOR CANONICO AG' });

  const fila = ['ASESOR VIEJO AG', 'SEDE DEMO', 'EXAMEN DEMO', 'ESPECIALIDAD DEMO', 'PROFESIONAL DEMO', '2026-08-05 08:00:00', 'GENERAL', 'SIN ENTIDAD'];
  const carga = await request(app).post('/api/calidad/agendas/carga').set(auth(admin)).send({ campana, filas: [fila] });
  assert.equal(carga.status, 201, JSON.stringify(carga.body));

  const opciones = await request(app).get(`/api/calidad/agendas/opciones?campana=${encodeURIComponent(campana)}`).set(auth(admin));
  assert.ok(opciones.body.asesores.includes('ASESOR CANONICO AG'));
  assert.ok(!opciones.body.asesores.includes('ASESOR VIEJO AG'));
});

test('Efectividad de Agendamiento: el alias se aplica al guardar, y 2 variantes que caen en el MISMO canonico del MISMO mes se fusionan sumando gestiones/agendas (no chocan contra el UNIQUE)', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const campana = campanaFicticia();
  await request(app).post('/api/alias-asesores').set(auth(admin)).send({ campana, alias: 'VARIANTE UNO EA', canonico: 'ASESOR CANONICO EA' });
  await request(app).post('/api/alias-asesores').set(auth(admin)).send({ campana, alias: 'VARIANTE DOS EA', canonico: 'ASESOR CANONICO EA' });

  const mes = '2026-08';
  const filas = [
    [mes, 'VARIANTE UNO EA', 100, 40],
    [mes, 'VARIANTE DOS EA', 50, 20],
  ];
  const impacto = await request(app).post('/api/calidad/efectividad-agendamiento/carga/impacto').set(auth(admin)).send({ campana, filas });
  assert.equal(impacto.status, 200, JSON.stringify(impacto.body));
  assert.equal(impacto.body.filasNuevas, 1, 'las 2 variantes del mismo mes deben fusionarse en 1 sola fila');
  assert.equal(impacto.body.filasUnificadasPorAlias, 2);
  assert.equal(impacto.body.asesoresUnificadosPorAlias, 2);

  const carga = await request(app).post('/api/calidad/efectividad-agendamiento/carga').set(auth(admin)).send({ campana, filas });
  assert.equal(carga.status, 201, JSON.stringify(carga.body));
  assert.equal(carga.body.insertadas, 1);

  const ranking = await request(app).get(`/api/calidad/efectividad-agendamiento/ranking?campana=${encodeURIComponent(campana)}&mes=${mes}`).set(auth(admin));
  assert.equal(ranking.status, 200, JSON.stringify(ranking.body));
  assert.equal(ranking.body.filas.length, 1);
  assert.equal(ranking.body.filas[0].asesor, 'ASESOR CANONICO EA');
  assert.equal(ranking.body.filas[0].gestiones, 150);
  assert.equal(ranking.body.filas[0].agendas, 60);
});
