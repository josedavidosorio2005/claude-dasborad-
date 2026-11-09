// fase284-errores-aurora.test.js — Fase 284 (pedido de Edwin, 06/11): pestaña
// «Errores» (errores de agendamiento) de Clinica Aurora. Modelo de Edwin: linea por
// mes (ene-26 a sep-26: 5, 7, 1, 3, 8, 12, 4, 4, 2), plan de accion del mes y errores
// por asesora del mes. Asesoras, observaciones y planes INVENTADOS.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { app, db, request, tokenFor, MASTER_PASSWORD } = require('./helpers');
const reg = require('../clientes-registro');
const E = require('../../public/js/errores.js');

const AURORA = 'CLINICA AURORA';
const H = (t) => ({ Authorization: 'Bearer ' + t });
const CLAVE = 'ClavePrueba1234';
async function cuenta(rol, perms) {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const user = 'err_' + Math.random().toString(36).slice(2, 8);
  const r = await request(app).post('/api/users').set(H(admin)).send({ nombre: 'Cuenta Sintética', user, password: CLAVE, rol, perms });
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return tokenFor(user, CLAVE);
}
const layoutDe = (c) => JSON.parse(db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get(c).layout);

test('migracion: modulo `errores` solo en Aurora; pestaña «Errores» justo despues de «Agendas por usuaria», visible', () => {
  const r = reg.leerRegistro(db);
  assert.ok(r.find((c) => c.nombre === AURORA).modulos.includes('errores'));
  for (const c of r.filter((x) => x.nombre !== AURORA)) assert.ok(!(c.modulos || []).includes('errores'), c.nombre);
  const tabs = layoutDe(AURORA).tabs;
  const i = tabs.findIndex((t) => t.key === 'agendas_usuaria') + 2; // Fase 306: entre Agendas y Errores van Inasistencia y Encuestas
  assert.ok(i > 1);
  assert.deepEqual(tabs.slice(i - 1, i + 1).map((t) => t.key), ['inasistencia_au', 'encuestas_au']);
  assert.equal(tabs[i + 1].key, 'errores');
  assert.equal(tabs[i + 1].label, 'Errores');
  assert.ok(!tabs[i + 1].oculta, 'se ve aunque no haya errores');
  assert.deepEqual(tabs[i + 1].panels, [{ tipo: 'errores_panel', campana: AURORA, titulo: 'Errores de agendamiento' }]);
  for (const c of ['ORLANT', 'MOBILIZE', 'HOSPITAL LA MARIA']) {
    const row = db.prepare('SELECT layout FROM dashboards_config WHERE cliente = ?').get(c);
    if (row) assert.ok(!row.layout.includes('errores_panel'), c);
  }
});

test('permisos: el cliente solo ve; el supervisor del cliente y el admin registran; otros no', async () => {
  const cliente = await cuenta('CLIENTES_DASH', { ClientesDash: true, cliente_CLINICA_AURORA: false, ['cliente_' + AURORA]: true });
  const sup = await cuenta('SUPERVISOR', { Calidad: true, ['supervisa_' + AURORA]: true });
  const supOtro = await cuenta('SUPERVISOR', { Calidad: true, supervisa_ORLANT: true });
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const nuevo = { campana: AURORA, mes: '2026-09', asesor: 'Asesora Inventada', cantidad: 1, observacion: 'Agendó en la sede equivocada.' };
  const g = await request(app).get('/api/calidad/errores?campana=' + encodeURIComponent(AURORA)).set(H(cliente));
  assert.equal(g.status, 200); assert.equal(g.body.puedeEditar, false);
  assert.equal((await request(app).post('/api/calidad/errores').set(H(cliente)).send(nuevo)).status, 403, 'el cliente no edita');
  assert.equal((await request(app).post('/api/calidad/errores').set(H(supOtro)).send(nuevo)).status, 403, 'supervisor de otro cliente');
  assert.equal((await request(app).get('/api/calidad/errores?campana=' + encodeURIComponent(AURORA)).set(H(supOtro))).status, 403);
  const s = await request(app).post('/api/calidad/errores').set(H(sup)).send(nuevo);
  assert.equal(s.status, 201, JSON.stringify(s.body));
  assert.equal((await request(app).get('/api/calidad/errores?campana=' + encodeURIComponent(AURORA)).set(H(sup))).body.puedeEditar, true);
  assert.equal((await request(app).delete('/api/calidad/errores/' + s.body.id).set(H(admin))).status, 200, 'el admin tambien');
  assert.equal((await request(app).get('/api/calidad/errores?campana=ORLANT').set(H(admin))).status, 404, 'ORLANT no tiene el modulo');
});

test('los numeros del modelo de Edwin: errores por mes, por asesora del mes y el plan de accion', async () => {
  db.prepare('DELETE FROM errores_agendamiento').run();
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const POR_MES = { '2026-01': 5, '2026-02': 7, '2026-03': 1, '2026-04': 3, '2026-05': 8, '2026-06': 12, '2026-07': 4, '2026-08': 4 };
  for (const [mes, n] of Object.entries(POR_MES)) {
    const r = await request(app).post('/api/calidad/errores').set(H(admin)).send({ campana: AURORA, mes, asesor: 'Asesora Tres', cantidad: n, observacion: 'Error inventado de ' + mes });
    assert.equal(r.status, 201);
  }
  // Septiembre: 2 errores individuales, uno por asesora (como el modelo).
  await request(app).post('/api/calidad/errores').set(H(admin)).send({ campana: AURORA, mes: '2026-09', asesor: 'Asesora Uno', observacion: 'Fecha de cita equivocada.' });
  await request(app).post('/api/calidad/errores').set(H(admin)).send({ campana: AURORA, mes: '2026-09', asesor: 'Asesora Dos', observacion: 'No confirmó la especialidad.' });
  const p = await request(app).put('/api/calidad/errores/plan').set(H(admin)).send({ campana: AURORA, mes: '2026-09', texto: 'Primer párrafo inventado.\n\nSegundo párrafo inventado.' });
  assert.equal(p.status, 200, JSON.stringify(p.body));
  const r = (await request(app).get('/api/calidad/errores?campana=' + encodeURIComponent(AURORA)).set(H(admin))).body;
  assert.deepEqual(r.porMes.map((x) => x.errores), [5, 7, 1, 3, 8, 12, 4, 4, 2]);
  assert.deepEqual(r.porAsesor['2026-09'].map((a) => [a.asesor, a.errores]), [['Asesora Dos', 1], ['Asesora Uno', 1]]);
  assert.equal(r.porAsesor['2026-09'][0].registros[0].observacion, 'No confirmó la especialidad.', '«Ver observación»');
  assert.equal(r.planes['2026-09'].texto, 'Primer párrafo inventado.\n\nSegundo párrafo inventado.');
});

test('alias de Usuarios del sistema: se guarda y se muestra el nombre real; la lista de asesoras', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  db.prepare("INSERT OR IGNORE INTO alias_asesores (campana, alias, canonico, createdAt) VALUES (?, 'usr0099', 'Asesora Real Inventada', '2026-11-06')").run(AURORA);
  const r = await request(app).post('/api/calidad/errores').set(H(admin)).send({ campana: AURORA, mes: '2026-10', asesor: 'usr0099' });
  assert.equal(r.body.asesor, 'Asesora Real Inventada');
  const lista = (await request(app).get('/api/calidad/errores/asesoras?campana=' + encodeURIComponent(AURORA)).set(H(admin))).body.asesoras;
  assert.ok(lista.includes('Asesora Real Inventada') && !lista.includes('usr0099'));
});

test('editar y borrar con registro de quien lo hizo; sin datos de pacientes', async () => {
  const sup = await cuenta('SUPERVISOR', { ['supervisa_' + AURORA]: true });
  const c = await request(app).post('/api/calidad/errores').set(H(sup)).send({ campana: AURORA, mes: '2026-10', asesor: 'Asesora Uno', cantidad: 2, observacion: 'Dos citas sin confirmar.' });
  const e = await request(app).put('/api/calidad/errores/' + c.body.id).set(H(sup)).send({ cantidad: 3 });
  assert.equal(e.status, 200); assert.equal(e.body.cantidad, 3); assert.equal(e.body.editadoPorNombre, 'Cuenta Sintética');
  const malo = await request(app).post('/api/calidad/errores').set(H(sup)).send({ campana: AURORA, mes: '2026-10', asesor: 'Asesora Uno', observacion: 'Paciente con documento 1036 555 777' });
  assert.equal(malo.status, 400); assert.match(malo.body.error, /datos de pacientes/);
  assert.equal((await request(app).put('/api/calidad/errores/plan').set(H(sup)).send({ campana: AURORA, mes: '2026-10', texto: 'Llamar al 3001234567' })).status, 400);
  assert.equal((await request(app).delete('/api/calidad/errores/' + c.body.id).set(H(sup))).status, 200);
  const hist = db.prepare("SELECT accion, detalle FROM historial WHERE accion LIKE 'ERROR_AGENDAMIENTO_%' ORDER BY id DESC LIMIT 3").all();
  assert.deepEqual(hist.map((h) => h.accion), ['ERROR_AGENDAMIENTO_BORRADO', 'ERROR_AGENDAMIENTO_EDITADO', 'ERROR_AGENDAMIENTO_CREADO']);
  assert.ok(hist.every((h) => !/confirmar/.test(h.detalle)), 'el historial no copia la observacion');
});

test('navegador: la linea sigue a MESES; el panel esta conectado y el boton es solo para quien edita', () => {
  assert.deepEqual(E.erroresMesesVisibles(['2026-09', '2026-01', '2026-05'], []), ['2026-01', '2026-05', '2026-09'], 'sin marcar = todos');
  assert.deepEqual(E.erroresMesesVisibles(['2026-09', '2026-01', '2026-05'], ['2026-05', '2026-09']), ['2026-05', '2026-09']);
  const pub = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'public', f), 'utf8');
  assert.match(pub('js/dashboard-generic.js'), /if\(p\.tipo === 'errores_panel'\)\{ _erroresRenderPanel\(p, i\); return; \}/);
  assert.match(pub('js/mes-global-logic.js'), /GD_TIPOS_SIGUEN_MESES = \[[^\]]*'errores_panel'/);
  assert.match(pub('js/errores.js'), /var boton = d\.puedeEditar \? '<button type="button" class="btn-primary err-agregar"/);
  assert.ok(pub('index.html').includes('<script src="js/errores.js"></script>'));
});
