// fase116-rango-global-hueco.test.js — Fase 116 (hallazgo real, archivo
// de WhatsApp ago-sep/2026): el rango de reemplazo de la Fase 115 se
// calculaba POR SKILL/COLA (primera..ultima fecha de ESA skill/cola dentro
// del archivo) -- si la skill/cola no tenia actividad en los primeros dias
// que el archivo SI cubria para OTRAS skills/colas, su propio rango
// arrancaba mas tarde y un residuo viejo anterior a ese arranque sobrevivia
// sin detectarse. Confirmado en produccion: WHATSAPP FONIATRIA no tuvo
// mensajes el 2026-08-01/02 (Wolkvox no genero fila), asi que una fila
// vieja de periodo completo (2026-08-01..31) quedo huerfana tras subir el
// archivo diario real (that no trae FONIATRIA hasta el 08-03).
//
// Fix: el rango de borrado es el GLOBAL del archivo completo (primera..
// ultima fecha de CUALQUIER fila, sin importar la skill/cola) -- nunca el
// de cada skill/cola por separado. Una skill/cola ausente del archivo
// sigue sin tocarse en absoluto. Datos SIEMPRE inventados.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { request, app, tokenFor, MASTER_PASSWORD } = require('./helpers');

const auth = (t) => ({ Authorization: `Bearer ${t}` });

function filaVoz(over) {
  return Object.assign({ fecha: '2026-08-01', skillName: 'SKILL FASE116', totalLlamadas: 1, contestadas: 1 }, over);
}
function filaWpp(over) {
  return Object.assign({ colaWhatsapp: 'WHATSAPP FASE116', fechaInicio: '2026-08-01', fechaFin: '2026-08-01', totalWhatsapp: 1, contestados: 1 }, over);
}

test('Trafico de Llamadas: una skill sin actividad los primeros dias del archivo (hueco) SI borra un residuo anterior a su propio primer dia', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const skillConHueco = 'SKILL FASE116 HUECO ' + Math.random().toString(36).slice(2, 6);
  const otraSkill = 'SKILL FASE116 OTRA ' + Math.random().toString(36).slice(2, 6);

  // Residuo viejo: una fila del dia 1 para la skill con hueco.
  await request(app).post('/api/calidad/trafico/carga').set(auth(admin)).send({
    filas: [filaVoz({ skillName: skillConHueco, fecha: '2026-08-01', totalLlamadas: 99, contestadas: 99 })],
  });

  // Archivo nuevo: trae el dia 1 para OTRA skill (asi el rango GLOBAL del
  // archivo arranca el dia 1), pero la skill con hueco solo aparece desde
  // el dia 3 -- su propio rango (si se calculara por skill) arrancaria ahi,
  // dejando el residuo del dia 1 sin detectar.
  const carga = await request(app).post('/api/calidad/trafico/carga').set(auth(admin)).send({
    filas: [
      filaVoz({ skillName: otraSkill, fecha: '2026-08-01', totalLlamadas: 5, contestadas: 5 }),
      filaVoz({ skillName: skillConHueco, fecha: '2026-08-03', totalLlamadas: 7, contestadas: 7 }),
    ],
  });
  assert.equal(carga.status, 201, JSON.stringify(carga.body));
  assert.equal(carga.body.borradas, 1, 'el residuo del dia 1 de la skill con hueco debe borrarse (rango GLOBAL del archivo)');

  const rows = await request(app).get('/api/calidad/nivel-servicio/diario?campana=' + encodeURIComponent('(SIN ASIGNAR)')).set(auth(admin));
  const filasHueco = rows.body.filter((r) => r.skillName === skillConHueco);
  assert.deepEqual(filasHueco.map((r) => r.fecha), ['2026-08-03'], 'el residuo del dia 1 ya no debe existir, solo el dia 3 real');
});

test('Trafico de Llamadas: una skill AUSENTE del archivo nuevo nunca se toca, aunque otra skill traiga ese mismo rango', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const skillAusente = 'SKILL FASE116 AUSENTE ' + Math.random().toString(36).slice(2, 6);
  const otraSkill = 'SKILL FASE116 PRESENTE ' + Math.random().toString(36).slice(2, 6);

  await request(app).post('/api/calidad/trafico/carga').set(auth(admin)).send({
    filas: [filaVoz({ skillName: skillAusente, fecha: '2026-08-01', totalLlamadas: 99, contestadas: 99 })],
  });

  const carga = await request(app).post('/api/calidad/trafico/carga').set(auth(admin)).send({
    filas: [filaVoz({ skillName: otraSkill, fecha: '2026-08-01', totalLlamadas: 5, contestadas: 5 })],
  });
  assert.equal(carga.status, 201, JSON.stringify(carga.body));

  const rows = await request(app).get('/api/calidad/nivel-servicio/diario?campana=' + encodeURIComponent('(SIN ASIGNAR)')).set(auth(admin));
  assert.ok(rows.body.some((r) => r.skillName === skillAusente && r.fecha === '2026-08-01'), 'la skill ausente del archivo nunca se toca');
});

test('POST /calidad/trafico/carga/impacto (voz): informa el mismo filasABorrar con rango GLOBAL, sin escribir nada', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const skillConHueco = 'SKILL FASE116 IMPACTO ' + Math.random().toString(36).slice(2, 6);
  const otraSkill = 'SKILL FASE116 IMPACTO OTRA ' + Math.random().toString(36).slice(2, 6);

  await request(app).post('/api/calidad/trafico/carga').set(auth(admin)).send({
    filas: [filaVoz({ skillName: skillConHueco, fecha: '2026-08-01', totalLlamadas: 99, contestadas: 99 })],
  });

  const impacto = await request(app).post('/api/calidad/trafico/carga/impacto').set(auth(admin)).send({
    filas: [
      filaVoz({ skillName: otraSkill, fecha: '2026-08-01', totalLlamadas: 5, contestadas: 5 }),
      filaVoz({ skillName: skillConHueco, fecha: '2026-08-03', totalLlamadas: 7, contestadas: 7 }),
    ],
  });
  const par = impacto.body.find((p) => p.skillName === skillConHueco);
  assert.ok(par, JSON.stringify(impacto.body));
  assert.equal(par.filasABorrar, 1);

  const rows = await request(app).get('/api/calidad/nivel-servicio/diario?campana=' + encodeURIComponent('(SIN ASIGNAR)')).set(auth(admin));
  assert.ok(rows.body.some((r) => r.skillName === skillConHueco && r.fecha === '2026-08-01'), 'impacto no debe haber escrito nada');
});

test('Trafico de WhatsApp: una cola sin actividad los primeros dias del archivo (hueco) SI borra un residuo anterior a su propio primer dia (caso real FONIATRIA)', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const colaConHueco = 'WHATSAPP FASE116 HUECO ' + Math.random().toString(36).slice(2, 6);
  const otraCola = 'WHATSAPP FASE116 OTRA ' + Math.random().toString(36).slice(2, 6);

  // Residuo viejo: un periodo completo de agosto para la cola con hueco
  // (equivalente a la plantilla vieja de periodo, antes del formato diario).
  await request(app).post('/api/calidad/trafico/whatsapp/carga').set(auth(admin)).send({
    campana: 'ORLANT',
    filas: [filaWpp({ colaWhatsapp: colaConHueco, fechaInicio: '2026-08-01', fechaFin: '2026-08-31', totalWhatsapp: 31, contestados: 29 })],
  });

  // Archivo diario nuevo: otra cola SI trae el dia 1 (rango GLOBAL arranca
  // ahi), pero la cola con hueco solo aparece desde el dia 3.
  const carga = await request(app).post('/api/calidad/trafico/whatsapp/carga').set(auth(admin)).send({
    campana: 'ORLANT',
    filas: [
      filaWpp({ colaWhatsapp: otraCola, fechaInicio: '2026-08-01', fechaFin: '2026-08-01', totalWhatsapp: 5, contestados: 5 }),
      filaWpp({ colaWhatsapp: colaConHueco, fechaInicio: '2026-08-03', fechaFin: '2026-08-03', totalWhatsapp: 7, contestados: 7 }),
    ],
  });
  assert.equal(carga.status, 201, JSON.stringify(carga.body));
  assert.equal(carga.body.borradas, 1, 'el periodo viejo completo (01..31) debe borrarse (rango GLOBAL del archivo)');

  const rows = await request(app).get('/api/calidad/trafico/whatsapp?campana=ORLANT').set(auth(admin));
  const filasHueco = rows.body.filter((r) => r.colaWhatsapp === colaConHueco);
  assert.deepEqual(filasHueco.map((r) => r.fechaInicio), ['2026-08-03'], 'el periodo viejo ya no debe existir, solo el dia 3 real');
});

test('POST /calidad/trafico/whatsapp/carga/impacto: informa el mismo filasABorrar con rango GLOBAL, sin escribir nada', async () => {
  const admin = await tokenFor('admin', MASTER_PASSWORD);
  const colaConHueco = 'WHATSAPP FASE116 IMPACTO ' + Math.random().toString(36).slice(2, 6);
  const otraCola = 'WHATSAPP FASE116 IMPACTO OTRA ' + Math.random().toString(36).slice(2, 6);

  await request(app).post('/api/calidad/trafico/whatsapp/carga').set(auth(admin)).send({
    campana: 'ORLANT',
    filas: [filaWpp({ colaWhatsapp: colaConHueco, fechaInicio: '2026-08-01', fechaFin: '2026-08-31', totalWhatsapp: 31, contestados: 29 })],
  });

  const impacto = await request(app).post('/api/calidad/trafico/whatsapp/carga/impacto').set(auth(admin)).send({
    campana: 'ORLANT',
    filas: [
      filaWpp({ colaWhatsapp: otraCola, fechaInicio: '2026-08-01', fechaFin: '2026-08-01', totalWhatsapp: 5, contestados: 5 }),
      filaWpp({ colaWhatsapp: colaConHueco, fechaInicio: '2026-08-03', fechaFin: '2026-08-03', totalWhatsapp: 7, contestados: 7 }),
    ],
  });
  const par = impacto.body.find((p) => p.colaWhatsapp === colaConHueco && p.filasABorrar > 0);
  assert.ok(par, JSON.stringify(impacto.body));
  assert.equal(par.filasABorrar, 1);

  const rows = await request(app).get('/api/calidad/trafico/whatsapp?campana=ORLANT').set(auth(admin));
  assert.ok(rows.body.some((r) => r.colaWhatsapp === colaConHueco && r.fechaInicio === '2026-08-01'), 'impacto no debe haber escrito nada');
});
