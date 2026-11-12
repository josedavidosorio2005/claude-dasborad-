// fase331-pr2-pestana-encuestas.test.js — Fase 331 (PR 2): pestaña "Calidad de encuestas"
// en Calidad › Mobilize. Hora de la llamada (para ubicar la grabacion junto con el ID),
// textos de la lista, asesor llenado solo si coincide, y el cableado de la pestaña y de los
// dos formularios de Calificar. Sigue SIN telefono. Datos SINTETICOS.
'use strict';
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const L = require('../../public/js/encuesta-logic.js');
const C = require('../../public/js/calidad-encuestas-logic.js');
const { request, app, db, tokenFor, MASTER_PASSWORD } = require('./helpers');

const H = (t) => ({ Authorization: 'Bearer ' + t });
const PUB = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'public', f), 'utf8');
let admin;
before(async () => { admin = await tokenFor('admin', MASTER_PASSWORD); });

test('hora: sale de DATE (Date local, serial de Excel con fraccion, texto); sin hora queda vacia', () => {
  assert.equal(L.encuestaParseHora(new Date(2026, 8, 1, 7, 5)), '07:05');
  assert.equal(L.encuestaParseHora(46300.75), '18:00');
  assert.equal(L.encuestaParseHora(46300 + (10 * 60 + 31) / 1440), '10:31');
  assert.equal(L.encuestaParseHora(46300), '');
  assert.equal(L.encuestaParseHora('2026-09-01 9:07:59'), '09:07');
  assert.equal(L.encuestaParseHora('01/09/2026 23:59'), '23:59');
  assert.equal(L.encuestaParseHora('2026-09-01'), '');
  assert.equal(L.encuestaParseHora(''), '');
  const r = L.encuestaParseFilas([
    ['AGENT_NAME', 'SKILL_NAME', 'DATE', 'Q01', 'Q02', 'Q03', 'Q04', 'CONN_ID', 'ANI'],
    ['Asesor Uno', 'SKILL A', '2026-09-01 14:20', 2, 1, 2, 1, 'CONN-H1', '3000000000'],
  ]);
  assert.deepEqual(r.filas, [['2026-09-01', 'Asesor Uno', 'SKILL A', 2, 1, 2, 1, '', 'CONN-H1', '14:20', '3000000000']]); // Fase 344: + ANI al final
});

test('API: la carga guarda la hora y Calidad de encuestas la devuelve; la forma vieja (9 campos) sigue valida', async () => {
  const c = await request(app).post('/api/calidad/encuestas/carga').set(H(admin)).send({ campana: 'MOBILIZE', filas: [
    ['2025-02-03', 'Asesor Ficticio Uno', 'SKILL X', 1, null, null, null, '', 'CONN-H1', '14:20'],
    ['2025-02-04', 'Asesor Ficticio Dos', 'SKILL X', 2, null, null, null, '', 'CONN-H2'],
  ] });
  assert.equal(c.status, 201, JSON.stringify(c.body));
  const r = await request(app).get('/api/calidad/encuestas/monitoreo').query({ campana: 'MOBILIZE', meses: '2025-02' }).set(H(admin));
  assert.equal(r.status, 200);
  assert.deepEqual(r.body.filas.map((f) => [f.connId, f.hora]), [['CONN-H2', ''], ['CONN-H1', '14:20']]);
  const b = await request(app).post('/api/calidad/encuestas/monitoreo/bloqueo').set(H(admin)).send({ campana: 'MOBILIZE', connId: 'CONN-H1' });
  assert.equal(b.body.llamada.hora, '14:20', 'el formulario recibe la hora');
  await request(app).post('/api/calidad/encuestas/monitoreo/liberar').set(H(admin)).send({ campana: 'MOBILIZE', connId: 'CONN-H1' });
  const mala = await request(app).post('/api/calidad/encuestas/carga').set(H(admin)).send({ campana: 'MOBILIZE', filas: [['2025-02-05', 'A', 'S', 1, null, null, null, '', 'X', '25:00']] });
  assert.equal(mala.status, 400);
  assert.deepEqual(db.prepare('PRAGMA table_info(encuestas)').all().map((x) => x.name).filter((n) => /tel|ani/i.test(n)), ['telefono'], 'Fase 344: solo la columna telefono (ANI)');
});

test('textos: preguntas mal calificadas, fecha, aviso de las que no traen ID', () => {
  assert.equal(C.cenFallasTexto([{ pregunta: 'q1', valor: 3 }, { pregunta: 'q3', valor: 2 }, { pregunta: 'q4', valor: 1 }]), 'P1: 3 · P3: No · P4: 1');
  assert.equal(C.cenValorTexto('q3', 1), 'Sí');
  assert.equal(C.cenFecha('2026-09-01'), '01/09/2026');
  assert.equal(C.cenAvisoSinId(0), '');
  assert.match(C.cenAvisoSinId(1), /^1 encuesta mal calificada no trae ID/);
  assert.match(C.cenAvisoSinId(4), /^4 encuestas mal calificadas no traen ID/);
});

test('asesor: se llena solo si coincide con UN usuario (sin importar tildes ni mayusculas); si no, lo elige el evaluador', () => {
  const lista = [{ nombre: 'Persona Ficticia Ñandú Pérez' }, { nombre: 'Otra Persona' }, { nombre: 'Doble Nombre' }, { nombre: 'doble  nombre' }];
  assert.equal(C.cenBuscarAsesor('PERSONA FICTICIA ÑANDU PEREZ', lista).nombre, 'Persona Ficticia Ñandú Pérez');
  assert.equal(C.cenBuscarAsesor('Persona Ficticia', lista), null, 'parecido no basta');
  assert.equal(C.cenBuscarAsesor('Doble Nombre', lista), null, 'dos que coinciden: no se adivina');
  assert.equal(C.cenBuscarAsesor('', lista), null);
});

test('estado de cada fila: calificar, la esta calificando otra persona, solo lectura, resuelta', () => {
  assert.deepEqual(C.cenEstadoFila({ estado: 'pendiente', bloqueo: null }, true), { tipo: 'calificar', texto: 'Calificar' });
  assert.deepEqual(C.cenEstadoFila({ estado: 'pendiente', bloqueo: { propio: true } }, true), { tipo: 'calificar', texto: 'Seguir calificando' });
  assert.deepEqual(C.cenEstadoFila({ estado: 'pendiente', bloqueo: { propio: false } }, true), { tipo: 'bloqueada', texto: 'La está calificando otra persona' });
  assert.equal(C.cenEstadoFila({ estado: 'pendiente', bloqueo: null }, false).tipo, 'lectura', 'Reportes y Gerencia: solo ven');
  assert.equal(C.cenEstadoFila({ estado: 'resuelta' }, true).tipo, 'resuelta');
});

test('pestaña: oculta hasta que el servidor da acceso, con contador; panel, aviso de la llamada y scripts en orden', () => {
  const html = PUB('index.html');
  assert.match(html, /<button class="atab" data-ctab="encuestas" id="ctab-btn-encuestas" onclick="switchCalTab\('encuestas'\)" hidden>Calidad de encuestas<span class="cen-badge" id="cen-badge"/);
  assert.ok(html.includes('<div id="cpanel-encuestas" class="atab-panel">'));
  assert.ok(html.includes('<div class="cen-banner" id="cen-banner" role="status" hidden></div>'));
  const i = (s) => html.indexOf('<script src="js/' + s + '"></script>');
  assert.ok(i('encuesta-logic.js') > 0 && i('encuesta-logic.js') < i('calidad-encuestas-logic.js'));
  assert.ok(i('calidad-calificar.js') < i('calidad-encuestas.js') && i('calidad-encuestas-logic.js') < i('calidad-encuestas.js'));
  const js = PUB('js/calidad-encuestas.js');
  assert.ok(js.includes("'/calidad/encuestas/monitoreo/conteo?campana='"), 'el servidor decide si se ve (403 = oculta)');
  assert.ok(js.includes('btn.hidden = !_cen.activa;'));
  // Fase 344: el telefono sale solo si el servidor lo manda (verTelefono); ver fase344-telefono-calidad-encuestas.
  assert.ok(js.includes("(d.verTelefono ? '<th>Teléfono</th>' : '')"), 'telefono solo con verTelefono');
  assert.ok(!/onclick="cenAbrir\(/.test(js), 'el ID de la llamada no va dentro de un onclick (delegacion con data-conn)');
  assert.ok(js.includes("navigator.clipboard.writeText(texto)"), 'boton Copiar');
});

test('formularios: los dos Calificar mandan el CONN_ID solo en un monitoreo NUEVO y vuelven a la lista', () => {
  const cal = PUB('js/calidad.js');
  // Fase 340: el formulario viejo (submitMonitoreo de calidad.js) se retiro; queda solo el comun (cc2).
  assert.ok(!cal.includes('async function submitMonitoreo('));
  assert.ok(cal.includes("if(typeof cenAlSalirDelModulo==='function') cenAlSalirDelModulo(); // Fase 331: libera la llamada abierta"), 'cerrar el modulo libera el bloqueo');
  const cc2 = PUB('js/calidad-calificar.js');
  assert.ok(cc2.includes("var deEncuesta = !editando && typeof cenModoActivo === 'function' && cenModoActivo();"));
  assert.ok(cc2.includes('if (deEncuesta) cenDespuesDeGuardar();'));
  const css = PUB('css/styles.css');
  const bloque = css.slice(css.indexOf('/* Fase 331: Calidad de encuestas'));
  assert.ok(!/#[0-9a-f]{3,6}\b/i.test(bloque), 'solo tokens del sistema de diseño, sin colores sueltos');
  assert.ok(bloque.includes('.cen-banner[hidden],.cen-badge[hidden],#ctab-btn-encuestas[hidden]{display:none}'));
});
