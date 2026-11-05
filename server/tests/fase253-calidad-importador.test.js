// fase253-calidad-importador.test.js — Fase 253 (plan de Calidad B2): importar
// una plantilla de calidad en pantalla (validacion + vista previa), versiones
// de plantilla (familia) y permiso por plantilla que sobrevive a una version
// nueva. Plantilla y datos SINTETICOS (la real de Mobilize vive fuera del repo).
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');
const dbMod = require('../db');
const imp = require('../calidad-plantilla-import');

const auth = (t) => ({ Authorization: `Bearer ${t}` });
const PW = 'Clave#Fase253x';
const hoy = new Date().toISOString().slice(0, 10);
let admin, cal, calSinPlantilla;

function archivo(extra) {
  return Object.assign({
    formato: 'inconexion-plantilla-calidad', version: 1, nombre: 'Sintetica 253', campana: 'MOBILIZE', motor: 'standard',
    campos: ['asesor', 'idAgente', 'fecha', 'placa', 'tipoLlamada', 'idLlamada', 'codigo', 'evaluador', 'motivo', 'obs'],
    etiquetas: { idLlamada: 'ID de grabación', codigo: 'Tipificación' },
    items: [
      { n: 1, categoria: 'Apertura', nombre: 'Saluda', peso: 30, descripcion: 'Saludo sintetico', vinetas: ['a', 'b'] },
      { n: 2, categoria: 'Gestion', nombre: 'Valida datos', peso: 40, critico: true, descripcion: 'Validacion sintetica' },
      { n: 3, categoria: 'Cierre', nombre: 'Despide', peso: 30, admiteNA: false },
    ],
  }, extra);
}
const importar = (tok, body) => request(app).post('/api/calidad/plantillas/importar').set(auth(tok)).send(body);

async function crear(user, rol, perms) {
  const r = await request(app).post('/api/users').set(auth(admin)).send({ nombre: 'Persona ' + user, user, password: PW, rol, perms });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return { id: r.body.id, token: await tokenFor(user, PW) };
}

before(async () => {
  admin = await tokenFor('admin', MASTER_PASSWORD);
  calSinPlantilla = await crear('cal253b', 'CALIDAD', { campana_MOBILIZE: true });
});

test('migracion: familiaId nueva, opcional e idempotente; filas viejas intactas', () => {
  assert.ok(db.prepare('PRAGMA table_info(calidad_plantillas)').all().some((c) => c.name === 'familiaId'));
  const antes = JSON.stringify(db.prepare('SELECT * FROM calidad_plantillas ORDER BY id').all());
  dbMod.migrarCalidadPlantillasFamilia();
  assert.equal(JSON.stringify(db.prepare('SELECT * FROM calidad_plantillas ORDER BY id').all()), antes);
});

test('validacion del archivo: formato, campaña, motor, pesos, items y campos', () => {
  const C = { campanas: ['ORLANT', 'MOBILIZE'] };
  const ok = imp.validarPlantillaImport(archivo(), C);
  assert.equal(ok.error, undefined);
  assert.deepEqual(ok.plantilla.items.map((i) => [i.n, i.cat, i.label, i.weight, i.critico, i.admiteNA]),
    [[1, 'Apertura', 'Saluda', 30, false, true], [2, 'Gestion', 'Valida datos', 40, true, true], [3, 'Cierre', 'Despide', 30, false, false]]);
  assert.deepEqual(ok.plantilla.campos.map((c) => c.k), ['asesor', 'idAgente', 'fecha', 'placa', 'tipoLlamada', 'idLlamada', 'codificacion', 'evaluador', 'motivo', 'observaciones']);
  assert.equal(ok.plantilla.campos.find((c) => c.k === 'codificacion').etiqueta, 'Tipificación');
  assert.deepEqual(ok.resumen, { items: 3, criticos: 1, sumaPesos: 100, categorias: ['Apertura', 'Gestion', 'Cierre'] });
  assert.ok(ok.avisos.some((a) => /Ítem 3: sin descripción/.test(a)));
  const mal = (x, re) => assert.match(imp.validarPlantillaImport(archivo(x), C).error, re, JSON.stringify(x).slice(0, 80));
  mal({ formato: 'otro' }, /no es una plantilla/);
  mal({ version: 2 }, /Versión/);
  mal({ campana: 'SURA' }, /no tiene Calidad/);
  mal({ motor: 'descuento' }, /no soportado/);
  mal({ nombre: ' ' }, /nombre/);
  mal({ campos: ['asesor', 'fecha', 'cedula'] }, /no permitido/);
  mal({ items: [] }, /ítems/);
  mal({ items: [{ n: 1, nombre: 'a', peso: 50 }, { n: 1, nombre: 'b', peso: 50 }] }, /repetido/);
  mal({ items: [{ n: 1, nombre: 'a', peso: 50 }, { n: 2, nombre: 'b', peso: 40 }] }, /sumar 100 \(suman 90\)/);
  mal({ items: [{ n: 1, nombre: '', peso: 100 }] }, /falta el nombre/);
  mal({ items: [{ n: 1, nombre: 'a', peso: 100, critico: 'si' }] }, /verdadero o falso/);
  assert.match(imp.validarPlantillaImport(null, C).error, /no es una plantilla/);
});

test('solo el administrador importa; la vista previa no escribe nada', async () => {
  const nCal = await importar(calSinPlantilla.token, { archivo: archivo() });
  assert.equal(nCal.status, 403);
  const antes = db.prepare('SELECT COUNT(*) AS n FROM calidad_plantillas').get().n;
  const prev = await importar(admin, { archivo: archivo(), principal: true });
  assert.equal(prev.status, 200, JSON.stringify(prev.body));
  assert.equal(prev.body.confirmado, false);
  assert.equal(prev.body.plan.accion, 'nueva');
  assert.equal(prev.body.plan.principal, true);
  assert.ok(prev.body.plan.principalAnterior, 'MOBILIZE ya tiene principal (la generica)');
  assert.equal(prev.body.plantilla.items.length, 3);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM calidad_plantillas').get().n, antes);
  const mala = await importar(admin, { archivo: archivo({ items: [{ n: 1, nombre: 'x', peso: 10 }] }) });
  assert.equal(mala.status, 400);
  assert.match(mala.body.error, /sumar 100/);
});

test('importar como principal: los monitoreos viejos siguen con su plantilla (no se recalculan)', async () => {
  const generica = db.prepare("SELECT * FROM calidad_plantillas WHERE campana = 'MOBILIZE' AND principal = 1").get();
  // monitoreo viejo con la generica (plantillaId NULL = la principal de siempre)
  const viejo = await request(app).post('/api/monitoreos').set(auth(admin)).send({ campana: 'MOBILIZE', asesor: 'Asesor Sintetico', fecha: hoy, canal: 'LLAMADA', answers: { 1: 'SI' } });
  assert.equal(viejo.status, 201, JSON.stringify(viejo.body));
  assert.equal(viejo.body.plantillaId, null);
  const r = await importar(admin, { archivo: archivo(), principal: true, confirmar: true });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const nueva = r.body.plantilla;
  assert.equal(nueva.principal, true);
  assert.equal(nueva.version, 1);
  assert.equal(nueva.familiaId, nueva.id);
  assert.equal(nueva.completoObligatorio, true);
  const fila = db.prepare('SELECT * FROM monitoreos WHERE id = ?').get(viejo.body.id);
  assert.equal(fila.plantillaId, generica.id, 'el viejo ahora guarda el id de la generica');
  assert.equal(fila.puntaje, viejo.body.puntaje);
  const g = db.prepare('SELECT principal, activo FROM calidad_plantillas WHERE id = ?').get(generica.id);
  assert.deepEqual(g, { principal: 0, activo: 1 }, 'la generica sigue activa, ya no principal');
  const una = await request(app).get('/api/calidad/plantillas').set(auth(admin));
  assert.equal(una.body.find((x) => x.campana === 'MOBILIZE').id, nueva.id, 'la principal de Mobilize es la nueva');
  // nuevo monitoreo con la principal nueva: guarda su id (no NULL)
  const m = await request(app).post('/api/monitoreos').set(auth(admin)).send({ campana: 'MOBILIZE', asesor: 'Asesor Sintetico', fecha: hoy, canal: 'LLAMADA', answers: { 1: 'SI', 2: 'NO', 3: 'SI' } });
  assert.equal(m.status, 201, JSON.stringify(m.body));
  assert.equal(m.body.plantillaId, nueva.id);
  assert.equal(m.body.puntaje, 80);
  assert.equal(m.body.extras.motivo, '2. Valida datos');
});

test('version nueva: misma familia, la anterior queda inactiva con sus monitoreos; el permiso sigue valiendo', async () => {
  const v1 = db.prepare("SELECT * FROM calidad_plantillas WHERE campana = 'MOBILIZE' AND nombre = 'Sintetica 253' AND activo = 1").get();
  cal = await crear('cal253a', 'CALIDAD', { campana_MOBILIZE: true, ['plantilla_' + v1.id]: true });
  const antesV2 = await request(app).post('/api/monitoreos').set(auth(cal.token)).send({ campana: 'MOBILIZE', plantillaId: v1.id, asesor: 'Asesor Sintetico', fecha: hoy, canal: 'LLAMADA', answers: { 1: 'SI', 2: 'SI', 3: 'SI' } });
  assert.equal(antesV2.status, 201, JSON.stringify(antesV2.body));
  const prev = await importar(admin, { archivo: archivo({ items: [{ n: 1, nombre: 'Saluda', peso: 50 }, { n: 2, nombre: 'Valida', peso: 50, critico: true }] }) });
  assert.equal(prev.body.plan.accion, 'version');
  assert.equal(prev.body.plan.version, 2);
  assert.equal(prev.body.plan.reemplaza.id, v1.id);
  assert.ok(prev.body.plan.reemplaza.monitoreos >= 2);
  assert.equal(prev.body.plan.principal, true, 'hereda la principal');
  const r = await importar(admin, { archivo: archivo({ items: [{ n: 1, nombre: 'Saluda', peso: 50 }, { n: 2, nombre: 'Valida', peso: 50, critico: true }] }), confirmar: true });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const v2 = r.body.plantilla;
  assert.equal(v2.version, 2);
  assert.equal(v2.familiaId, v1.id);
  assert.equal(v2.principal, true);
  assert.equal(db.prepare('SELECT activo FROM calidad_plantillas WHERE id = ?').get(v1.id).activo, 0);
  assert.equal(db.prepare('SELECT plantillaId FROM monitoreos WHERE id = ?').get(antesV2.body.id).plantillaId, v1.id, 'el monitoreo de la v1 sigue con la v1');
  // con plantilla_<v1.id> (familia) puede usar la v2
  const lista = await request(app).get('/api/calidad/plantillas/todas').set(auth(cal.token));
  const enLista = lista.body.find((p) => p.id === v2.id);
  assert.ok(enLista && enLista.usable, 'la v2 es usable con el permiso de la familia');
  const m = await request(app).post('/api/monitoreos').set(auth(cal.token)).send({ campana: 'MOBILIZE', plantillaId: v2.id, asesor: 'Asesor Sintetico', fecha: hoy, canal: 'LLAMADA', answers: { 1: 'SI', 2: 'SI' } });
  assert.equal(m.status, 201, JSON.stringify(m.body));
  // la v1 (inactiva) ya no se usa para monitoreos nuevos
  const v1nuevo = await request(app).post('/api/monitoreos').set(auth(cal.token)).send({ campana: 'MOBILIZE', plantillaId: v1.id, asesor: 'Asesor Sintetico', fecha: hoy, canal: 'LLAMADA', answers: { 1: 'SI', 2: 'SI', 3: 'SI' } });
  assert.equal(v1nuevo.status, 400);
  // lista de administracion: las dos versiones, con su conteo de monitoreos
  const adm = await request(app).get('/api/calidad/plantillas/admin').set(auth(admin));
  assert.equal(adm.status, 200);
  const fam = adm.body.filter((p) => p.familiaId === v1.id).map((p) => [p.version, p.activo]);
  assert.deepEqual(fam, [[2, true], [1, false]]);
  const noAdm = await request(app).get('/api/calidad/plantillas/admin').set(auth(cal.token));
  assert.equal(noAdm.status, 403);
});

test('activar/desactivar: la principal no se desactiva; no dos versiones activas de la misma familia', async () => {
  const generica = db.prepare("SELECT * FROM calidad_plantillas WHERE campana = 'MOBILIZE' AND nombre <> 'Sintetica 253' AND familiaId IS NULL AND activo = 1 AND principal = 0").get();
  const principal = db.prepare("SELECT * FROM calidad_plantillas WHERE campana = 'MOBILIZE' AND principal = 1").get();
  const v1 = db.prepare("SELECT * FROM calidad_plantillas WHERE campana = 'MOBILIZE' AND nombre = 'Sintetica 253' AND version = 1").get();
  const put = (id, activo, tok) => request(app).put('/api/calidad/plantillas/' + id + '/activo').set(auth(tok || admin)).send({ activo });
  assert.equal((await put(principal.id, false)).status, 400);
  assert.equal((await put(v1.id, true)).status, 400);
  assert.equal((await put(generica.id, false, cal.token)).status, 403);
  const off = await put(generica.id, false);
  assert.equal(off.status, 200, JSON.stringify(off.body));
  assert.equal(off.body.activo, false);
  const on = await put(generica.id, true);
  assert.equal(on.body.activo, true);
});

test('ORLANT sin cambios: su plantilla principal y sus monitoreos siguen igual', async () => {
  const orl = db.prepare("SELECT * FROM calidad_plantillas WHERE campana = 'ORLANT' AND principal = 1").get();
  assert.equal(orl.familiaId, null);
  assert.equal(orl.campos, null);
  const r = await request(app).post('/api/monitoreos').set(auth(admin)).send({ campana: 'ORLANT', asesor: 'Asesor Sintetico', fecha: hoy, canal: 'LLAMADA', answers: { 1: 'SI' } });
  assert.equal(r.status, 201);
  assert.equal(r.body.plantillaId, null, 'la principal vieja sigue guardando NULL, como siempre');
});

test('navegador: leer el archivo, explicar el plan y agrupar versiones', () => {
  const F = require('../../public/js/calidad-plantillas-logic.js');
  assert.match(F.cplLeerArchivo('{nope', 10).error, /JSON válido/);
  assert.match(F.cplLeerArchivo('{"formato":"x"}', 10).error, /no es una plantilla/);
  assert.match(F.cplLeerArchivo('{}', F.CPL_MAX_BYTES + 1).error, /muy grande/);
  assert.equal(F.cplLeerArchivo('﻿' + JSON.stringify(archivo()), 100).archivo.nombre, 'Sintetica 253');
  const nueva = F.cplPlanTexto({ accion: 'nueva', version: 1, principal: true, principalAnterior: { id: 9, nombre: 'Generica' } }, 'P', 'MOBILIZE');
  assert.match(nueva[0], /plantilla nueva "P" en MOBILIZE/);
  assert.match(nueva[1], /principal de MOBILIZE.*"Generica".*sigue activa/);
  const ver = F.cplPlanTexto({ accion: 'version', version: 3, reemplaza: { id: 5, version: 2, monitoreos: 7 }, principal: true, principalAnterior: { id: 5, nombre: 'P' } }, 'P', 'MOBILIZE');
  assert.match(ver[0], /versión 3.*versión 2 queda desactivada.*7 monitoreo/);
  assert.equal(ver[1], 'Queda como plantilla principal de MOBILIZE.');
  assert.match(F.cplPlanTexto({ accion: 'nueva', version: 1, principal: false }, 'P', 'ORLANT')[1], /No cambia la plantilla principal/);
  const g = F.cplAgrupar([{ id: 4, familiaId: 2, version: 2, campana: 'MOBILIZE' }, { id: 1, familiaId: 1, campana: 'ORLANT' }, { id: 2, familiaId: 2, version: 1, campana: 'MOBILIZE' }, { id: 3, familiaId: 3, version: 1, campana: 'MOBILIZE' }]);
  assert.deepEqual(g.map((x) => [x.campana, x.filas.map((f) => f.id)]), [['MOBILIZE', [4, 2, 3]], ['ORLANT', [1]]]);
  assert.equal(F.cplSumaPesos([{ weight: 33.3 }, { weight: 66.7 }]), 100);
});
